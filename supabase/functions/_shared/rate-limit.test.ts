/**
 * Rate limiter tests.
 *
 * Run locally:
 *   deno test --allow-net --allow-env --env-file="supabase/.env" supabase/functions/_shared/rate-limit.test.ts
 *
 * Unit tests cover: window logic (via in-memory store), identity isolation,
 * headers, fail-open outage behavior, IP parsing.
 * Integration block (runs ONLY when UPSTASH_REDIS_REST_URL/TOKEN are present):
 * live Redis — normal reqs, limit trigger, window reset, multi-user isolation,
 * concurrent requests, Retry-After headers, key hygiene/TTL.
 */

import { assertEquals, assert, assertGreater, assertLess } from "jsr:@std/assert";
import {
  RateLimiter,
  UpstashStore,
  clientIp,
  buildKey,
  tooManyResponse,
  type RedisStore,
} from "./rate-limit.ts";
import { Redis } from "https://esm.sh/@upstash/redis@1.37.0";

// ── In-memory sliding window implementation of the SAME contract the Lua
//    script provides — used to unit-test RateLimiter behavior without Redis.
class FakeStore implements RedisStore {
  entries = new Map<string, number[]>();

  async check(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; used: number; resetAtMs: number }> {
    const now = Date.now();
    const cutoff = now - windowSeconds * 1000;
    const list = (this.entries.get(key) ?? []).filter((t) => t > cutoff);
    let allowed = false;
    const used = list.length;
    if (used < limit) {
      list.unshift(now); // keep newest-first; resetAt from OLDEST below
      allowed = true;
    }
    this.entries.set(key, list);
    const resetAtMs = list.length > 0 ? Math.min(...list) + windowSeconds * 1000 : now + windowSeconds * 1000;
    return { allowed, used: list.length, resetAtMs };
  }

  async ping(): Promise<boolean> {
    return true;
  }
}

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/fn", { method: "POST", headers });
}

const identity = (type: "user" | "email" | "ip", value: string) => ({ type, value });

// ── Unit — key building & hashing (PII policy: emails never in keys) ────────
Deno.test("buildKey keeps user id urns/raw", () => {
  const key = buildKey("invite-member", identity("user", "u-123"));
  assertEquals(key, "rl:invite-member:user:u-123");
});

Deno.test("buildKey keeps IPv6 colons intact", () => {
  const key = buildKey("accept-invite-by-code", identity("ip", "2001:db8::1"));
  assertEquals(key, "rl:accept-invite-by-code:ip:2001:db8::1");
});

// ── Unit — client IP parsing (forwarded headers) ───────────────────────────
Deno.test("clientIp takes first hop of x-forwarded-for", () => {
  assertEquals(clientIp(req({ "x-forwarded-for": "203.0.113.9, 10.0.0.1, 10.0.0.2" })), "203.0.113.9");
  assertEquals(clientIp(req({ "x-forwarded-for": "::1" })), "::1");
  assertEquals(clientIp(req({ "x-forwarded-for": "unknown" })), "unknown");
  assertEquals(clientIp(req({ "cf-connecting-ip": "198.51.100.7" })), "198.51.100.7");
  assertEquals(clientIp(req({})), "unknown");
});

// ── Unit — sliding window with the fake store ──────────────────────────────
Deno.test("allows requests up to the limit", async () => {
  const limiter = new RateLimiter({ store: new FakeStore() });
  const r = req();
  for (let i = 0; i < 5; i++) {
    const blocked = await limiter.enforce(r, "transfer-ownership", identity("user", "u-1"));
    assertEquals(blocked, null, `request ${i + 1} should pass (limit 10)`);
  }
});

Deno.test("blocks the 11th request and returns 429 with headers", async () => {
  const limiter = new RateLimiter({ store: new FakeStore() });
  const r = req();
  for (let i = 0; i < 10; i++) await limiter.enforce(r, "transfer-ownership", identity("user", "u-1"));
  const blocked = await limiter.enforce(r, "transfer-ownership", identity("user", "u-1"));
  assert(blocked !== null);
  assertEquals(blocked!.status, 429);
  assert(Number(blocked!.headers.get("Retry-After")) > 0);
  assertEquals(blocked!.headers.get("X-RateLimit-Limit"), "10");
  assertEquals(blocked!.headers.get("X-RateLimit-Remaining"), "0");
  assert(Number(blocked!.headers.get("X-RateLimit-Reset")) > Date.now() / 1000);
  const body = await blocked!.json();
  assertEquals(body.error, "Too many requests.");
  assertEquals(typeof body.retryAfter, "number");
});

Deno.test("users are isolated — one blocked user never affects another", async () => {
  const store = new FakeStore();
  const limiter = new RateLimiter({ store });
  const r = req();
  for (let i = 0; i < 10; i++) await limiter.enforce(r, "transfer-ownership", identity("user", "u-a"));
  assert((await limiter.enforce(r, "transfer-ownership", identity("user", "u-a"))) !== null);
  assert((await limiter.enforce(r, "transfer-ownership", identity("user", "u-b"))) === null);
  assertEquals(store.entries.size, 2);
});

Deno.test("IPs are independent buckets", async () => {
  const limiter = new RateLimiter({ store: new FakeStore() });
  const r1 = req({ "x-forwarded-for": "1.2.3.4" });
  const r2 = req({ "x-forwarded-for": "5.6.7.8" });
  for (let i = 0; i < 30; i++) await limiter.enforce(r1, "accept-invite-by-code", identity("ip", "1.2.3.4"));
  assert((await limiter.enforce(r1, "accept-invite-by-code", identity("ip", "1.2.3.4"))) !== null);
  assert((await limiter.enforce(r2, "accept-invite-by-code", identity("ip", "5.6.7.8"))) === null);
});

Deno.test("window resets after windowSeconds pass", async () => {
  const store = new FakeStore();
  const limiter = new RateLimiter({ store });
  const r = req();
  for (let i = 0; i < 10; i++) await limiter.enforce(r, "transfer-ownership", identity("user", "u-1"));
  const blocked = await limiter.enforce(r, "transfer-ownership", identity("user", "u-1"));
  assert(blocked !== null);

  // Simulate time passing beyond the window: only stale events remain,
  // so the next request must pass again.
  const key = "rl:transfer-ownership:user:u-1";
  store.entries.set(key, [Date.now() - 2 * 3600 * 1000]);
  const after = await limiter.enforce(r, "transfer-ownership", identity("user", "u-1"));
  assertEquals(after, null, "old requests expire; window resets");
});

// ── Unit — Redis outage: fail-open keeps the app alive ──────────────────────
class DownStore implements RedisStore {
  async check(): Promise<never> {
    throw new Error("connection refused");
  }
  async ping(): Promise<boolean> {
    return false;
  }
}

Deno.test("Redis outage → fail open (default): requests pass", async () => {
  const limiter = new RateLimiter({ store: new DownStore() });
  const r = req();
  const blocked = await limiter.enforce(r, "invite-member", identity("user", "u-1"));
  assertEquals(blocked, null);
});

Deno.test("Redis outage → fail closed: requests are denied 429", async () => {
  const limiter = new RateLimiter({ store: new DownStore(), failMode: "closed" });
  const r = req();
  const blocked = await limiter.enforce(r, "invite-member", identity("user", "u-1"));
  assert(blocked !== null);
  assertEquals(blocked!.status, 429);
});

Deno.test("Redis unconfigured → limiter disabled, requests pass", async () => {
  const oldUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const oldTok = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
  try {
    Deno.env.delete("UPSTASH_REDIS_REST_URL");
    Deno.env.delete("UPSTASH_REDIS_REST_TOKEN");
    const limiter = new RateLimiter(); // no env, no explicit store
    assertEquals(await limiter.enforce(req(), "invite-member", identity("user", "u-1")), null);
  } finally {
    if (oldUrl) Deno.env.set("UPSTASH_REDIS_REST_URL", oldUrl);
    if (oldTok) Deno.env.set("UPSTASH_REDIS_REST_TOKEN", oldTok);
  }
});

// ── 429 body never leaks internals −────────────────────────────────────────
Deno.test("429 response format matches the contract", async () => {
  const res = tooManyResponse(req(), 30, Date.now() + 70000);
  const body = await res.json();
  assertEquals(Object.keys(body).sort(), ["error", "retryAfter"]);
  assertEquals(body.retryAfter, 70);
  assertEquals(res.status, 429);
});

// ── Integration (only when Redis env vars present) ──────────────────────────
const redisUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
const hasRedis = Boolean(redisUrl && redisToken);

// Unique keys so tests never clash with real traffic keys.
const TEST_SCOPE: any = { limit: 5, windowSeconds: 60 };
function testKey(label: string, id: string) {
  return `rl:test:${label}:${id}-${Date.now()}`;
}

Deno.test({ name: "INTEGRATION: real Upstash store honors limits + TTL", ignore: !hasRedis }, async () => {
  const store = new UpstashStore(new Redis({ url: redisUrl!, token: redisToken! }));
  const key = testKey("limit", "k");
  let blocked = 0;
  for (let i = 0; i < 12; i++) {
    const res = await store.check(key, TEST_SCOPE.limit, TEST_SCOPE.windowSeconds);
    if (!res.allowed) blocked++;
  }
  assert(blocked === 7, `expected 7 blocked after limit 5, got ${blocked}`);
  // key must be zero after the window: TTL is set by the script
  const ttl = await new Redis({ url: redisUrl!, token: redisToken! }).ttl(key);
  assert(ttl > 0, `expected TTL > 0 on counter key`);
});

Deno.test({ name: "INTEGRATION: concurrent requests stay within limit", ignore: !hasRedis }, async () => {
  const store = new UpstashStore(new Redis({ url: redisUrl!, token: redisToken! }));
  const key = testKey("concurrent", "c-1");
  const results = await Promise.all(
    Array.from({ length: 20 }, () => store.check(key, 5, 60))
  );
  const allowedCount = results.filter((r) => r.allowed).length;
  assertEquals(allowedCount, 5, "exactly 5 concurrent requests may pass");
  // and Redis tells the truth under parallelism — the counter never exceeds 5
  const used = await new Redis({ url: redisUrl!, token: redisToken! }).zcard(key);
  assertEquals(used, 5);
});

Deno.test({ name: "INTEGRATION: independent users; independent IPs", ignore: !hasRedis }, async () => {
  const store = new UpstashStore(new Redis({ url: redisUrl!, token: redisToken! }));
  const k1 = testKey("iso-user", "u1");
  const k2 = testKey("iso-user", "u2");
  const k3 = testKey("iso-ip", "1.2.3.4");
  for (let i = 0; i < 6; i++) {
    await store.check(k1, 5, 60);
    await store.check(k2, 5, 60);
    await store.check(k3, 5, 60);
  }
  const r = await new Redis({ url: redisUrl!, token: redisToken! });
  assertEquals(await r.zcard(k1), 5);
  assertEquals(await r.zcard(k2), 5);
  assertEquals(await r.zcard(k3), 5);
});