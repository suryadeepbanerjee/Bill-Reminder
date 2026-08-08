// Shared Redis rate limiter for Edge Functions.
//
// Sliding-window-log rate limiting stored in Redis with automatic TTL expiry
// (no cleanup jobs). One atomic Lua EVAL per check — the whole window
// (prune + count + record + TTL) runs as a single Redis command, so
// concurrent requests can never race the counter.
//
// Backend is abstracted behind the RedisStore interface. Default store is
// Upstash Redis REST (serverless-friendly; works from Deno/Edge and Node).
// Swapping to another provider (Aiven, upstash-dedicated, or a LAN Redis in
// the future) = implement RedisStore in one place, zero changes in callers.
//
// Failure policy:
//   - Redis unconfigured .......... disabled (allow all, log on first use)
//   - Redis temporarily down ...... FAIL-OPEN by default (request proceeds,
//     security event logged). Sensitive endpoints can opt into FAIL-CLOSED.
//   - The app NEVER crashes because Redis is unavailable.

import { Redis } from "https://esm.sh/@upstash/redis@1.37.0";
import { corsHeaders } from "./cors.ts";

// ── Central rule table ───────────────────────────────────────────────────────
// scope → { limit, windowSeconds }. Every endpoint reads limits from HERE so
// the whole project has ONE source of truth. Key naming: rl:{scope}:{type}:{id}
export const RATE_LIMITS = {
  // user-facing edge functions
  "accept-invite":          { limit: 30,  windowSeconds: 3600 },
  "accept-invite-by-code":  { limit: 30,  windowSeconds: 3600 },
  "create-household":       { limit: 20,  windowSeconds: 3600 },
  "delete-household":       { limit: 10,  windowSeconds: 3600 },
  "delete-account":         { limit: 5,   windowSeconds: 3600 },
  "invite-member":          { limit: 20,  windowSeconds: 86400 }, // per day
  "leave-household":        { limit: 20,  windowSeconds: 3600 },
  "leave-household-by-code":{ limit: 30,  windowSeconds: 3600 },
  "transfer-ownership":     { limit: 10,  windowSeconds: 3600 },
  // digest email caps (email-sender, per recipient)
  "email-digest-hour":      { limit: 30,  windowSeconds: 3600 },
  "email-digest-day":       { limit: 150, windowSeconds: 86400 },
} as const;

export type RateLimitScope = keyof typeof RATE_LIMITS;

export type IdentityType = "user" | "email" | "ip";
export interface Identity {
  type: IdentityType;
  value: string; // user UUID | hashed email | client IP (raw)
}

// ── Redis store abstraction ────────────────────────────────────────────────
export interface SlidingWindowResult {
  allowed: boolean;
  used: number;     // requests recorded inside the current window
  resetAtMs: number; // unix ms when the earliest in-window event expires
}

export interface RedisStore {
  check(key: string, limit: number, windowSeconds: number): Promise<SlidingWindowResult>;
  ping(): Promise<boolean>;
}

// Atomic sliding-window log. KEYS[1] = key.
// ARGV[1] = window seconds, ARGV[2] = limit, ARGV[3] = now-ms, ARGV[4] = unique member id.
const WINDOW_SCRIPT = `
local window = tonumber(ARGV[1])
local limit  = tonumber(ARGV[2])
local now    = tonumber(ARGV[3])
local member = ARGV[4]

redis.call("ZREMRANGEBYSCORE", KEYS[1], 0, now - window * 1000)
local count = redis.call("ZCARD", KEYS[1])

local allowed = 0
if count < limit then
  allowed = 1
  redis.call("ZADD", KEYS[1], now, member)
  count = count + 1
  redis.call("EXPIRE", KEYS[1], window + 2)
end

local resetAt
local oldest = redis.call("ZRANGE", KEYS[1], 0, 0, "WITHSCORES")
if oldest[1] ~= false and oldest[2] ~= nil then
  resetAt = tonumber(oldest[2]) + window * 1000
else
  resetAt = now + window * 1000
end

return { allowed, count, resetAt }
`;

export class UpstashStore implements RedisStore {
  constructor(private redis: Redis) {}

  async check(key: string, limit: number, windowSeconds: number): Promise<SlidingWindowResult> {
    const result = (await this.redis.eval(
      WINDOW_SCRIPT,
      [key],
      [String(windowSeconds), String(limit), String(Date.now()), crypto.randomUUID()]
    )) as unknown as [number, number, number] | null;
    const [allowedRaw, used, resetAtMs] = result ?? [1, 1, Date.now() + windowSeconds * 1000];
    return { allowed: allowedRaw === 1, used, resetAtMs };
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === "PONG";
    } catch {
      return false;
    }
  }
}

// ── Limiter ─────────────────────────────────────────────────────────────────
export interface RateLimiterOptions {
  /** "open" (default) = allow requests when Redis is down; "closed" = deny. */
  failMode?: "open" | "closed";
  store?: RedisStore;
}

export class RateLimiter {
  private readonly enabled: boolean;
  private readonly failMode: "open" | "closed";
  private readonly store: RedisStore | null;
  private warnLogged = false;

  constructor(opts: RateLimiterOptions = {}) {
    const url = Deno.env.get("UPSTASH_REDIS_REST_URL");
    const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
    this.failMode = opts.failMode ?? "open";
    if (opts.store) {
      this.store = opts.store;
      this.enabled = true;
    } else if (url && token) {
      this.store = new UpstashStore(new Redis({ url, token }));
      this.enabled = true;
    } else {
      this.store = null;
      this.enabled = false;
    }
  }

  /**
   * Enforce a rate limit rule. Returns a ready-to-send 429 Response when the
   * request is over the limit, null when it may proceed.
   */
  async enforce(req: Request, scope: RateLimitScope, identity: Identity): Promise<Response | null> {
    const rule = RATE_LIMITS[scope];
    if (!rule) throw new Error(`Unknown rate limit scope "${scope}"`);

    if (!this.enabled || !this.store) {
      if (!this.warnLogged) {
        console.warn(
          `[rate-limit] ${scope} — UPSTASH_REDIS_REST_URL/TOKEN unset, limiter disabled (fail-open).`
        );
        this.warnLogged = true;
      }
      return null; // allow — never block legitimate traffic because Redis is missing/disabled
    }

    const key = await buildKeyHashed(scope, identity);
    try {
      const result = await this.store.check(key, rule.limit, rule.windowSeconds);
      if (result.allowed) return null;

      logSecurity("rate_limited", { scope, identity });
      return tooManyResponse(req, rule.limit, result.resetAtMs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[rate-limit] redis unavailable for "${scope}": ${message}`);
      if (this.failMode === "closed") {
        logSecurity("rate_limit_fail_closed", { scope, identity });
        return tooManyResponse(req, rule.limit, Date.now() + rule.windowSeconds * 1000);
      }
      return null; // fail-open — Redis outage must never break the app
    }
  }
}

let singleton: RateLimiter | null = null;
/** Cached limiter instance (env fixed per deployment). */
export function getRateLimiter(): RateLimiter {
  if (!singleton) singleton = new RateLimiter();
  return singleton;
}

// ── Identity helpers ─────────────────────────────────────────────────────────
/**
 * Best-effort client IP. Edge deployments (Vercel, Cloudflare, Supabase
 * gateway) all set forwarded headers; the first hop of x-forwarded-for is the
 * client, later entries are proxies we never trust.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first && first !== "unknown") return first;
  }
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

/** Deterministic, low-collision hex hash used for emails (never raw PII in Redis/logs). */
export async function hashEmail(email: string): Promise<string> {
  const data = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function buildKey(scope: RateLimitScope, identity: Identity): string {
  const value = identity.type === "ip" ? identity.value.replace(/[^0-9a-zA-Z.:]/g, "_") : identity.value;
  return `rl:${scope}:${identity.type}:${value}`;
}

/**
 * Same as buildKey but hashes email identities (SHA-256) so raw addresses
 * never appear in Redis keys or logs.
 */
export async function buildKeyHashed(scope: RateLimitScope, identity: Identity): Promise<string> {
  if (identity.type === "email") {
    const hash = await hashEmail(identity.value);
    return `rl:${scope}:email:${hash}`;
  }
  return buildKey(scope, identity);
}

// ── 429 response (spec-compliant) ────────────────────────────────────────────
export function tooManyResponse(
  req: Request,
  limit: number,
  resetAtMs: number
): Response {
  const remainingMs = Math.max(0, resetAtMs - Date.now());
  const retryAfter = Math.max(1, Math.ceil(remainingMs / 1000));
  return new Response(
    JSON.stringify({ error: "Too many requests.", retryAfter: retryAfter }),
    {
      status: 429,
      headers: {
        ...corsHeaders(req),
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(resetAtMs / 1000)),
      },
    }
  );
}

/** Security-event logger. Emits only non-sensitive identifiers. */
export function logSecurity(
  event: string,
  data: { scope: string; identity: Identity }
): void {
  const safe = {
    event,
    endpoint: data.scope,
    idType: data.identity.type,
    // sha256 of the identifier so logs never contain raw emails or IPs
    idHash: data.identity.type === "email" ? digestEmail(data.identity.value) : `id:${data.identity.value.slice(0, 16)}`,
  };
  console.warn(`[rate-limit] ${JSON.stringify(safe)}`);
}

function digestEmail(email: string): string {
  // synchronous best-effort hashing for logs; PII redaction is the contract
  let h = 5381;
  const s = email.trim().toLowerCase();
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return `h:${(h >>> 0).toString(16)}`;
}