// turnstile-guard — bot + abuse gate for every sensitive flow.
//
// 1. Verifies the caller's Cloudflare Turnstile token against the secret
//    (TURNSTILE_SECRET_KEY). With no secret configured the verification is
//    skipped (local dev), but rate limiting still applies.
// 2. Applies a sliding-window rate limit per IP (+ per account when the
//    caller sends a user JWT) via the service-role-only RPC rate_gate_check.
//
// Response contract:
//   200 { ok: true }
//   400 { error }                       unknown action / bad body
//   401 { error }                       captcha token missing or invalid
//   429 { error, retryAfterSeconds }    rate limited

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type Policy = { limit: number; windowSeconds: number };

const POLICIES: Record<string, Policy> = {
  signin:          { limit: 5,  windowSeconds: 15 * 60 },
  signup:          { limit: 3,  windowSeconds: 15 * 60 },
  otp_request:     { limit: 5,  windowSeconds: 15 * 60 },
  otp_verify:      { limit: 10, windowSeconds: 15 * 60 },
  recover:         { limit: 5,  windowSeconds: 15 * 60 },
  resend_verify:   { limit: 5,  windowSeconds: 15 * 60 },
  password_change: { limit: 5,  windowSeconds: 15 * 60 },
  invite:          { limit: 20, windowSeconds: 60 * 60 },
};

function json(req: Request, body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function verifyTurnstile(
  token: string,
  remoteIp: string
): Promise<{ ok: boolean; codes?: string[] }> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) return { ok: true }; // guard not configured (local dev)
  if (!token) return { ok: false, codes: ["missing-input-response"] };

  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp && remoteIp !== "unknown") form.set("remoteip", remoteIp);

  const resp = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!resp.ok) return { ok: false, codes: [`http_${resp.status}`] };

  const data = (await resp.json()) as { success?: boolean; "error-codes"?: string[] };
  return { ok: data.success === true, codes: data["error-codes"] };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return json(req, { error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => null);
    const action = typeof body?.action === "string" ? body.action : "";
    const captchaToken =
      typeof body?.captchaToken === "string" ? body.captchaToken : "";

    const policy = POLICIES[action];
    if (!policy) return json(req, { error: "Unknown action" }, 400);

    // ── 1. Bot gate ────────────────────────────────────────────────────────
    const ip = clientIp(req);
    const verify = await verifyTurnstile(captchaToken, ip);
    if (!verify.ok) {
      console.warn(`turnstile-guard captcha rejected action=${action} codes=${verify.codes?.join(",")}`);
      return json(
        req,
        { error: "We couldn't verify you're human. Please try again.", code: "captcha_invalid" },
        401
      );
    }

    // ── 2. Rate limit (IP + authenticated account when a user JWT is sent) ─
    let actor = ip;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await userClient.auth.getUser();
      if (user) actor = `${ip}|${user.id}`;
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await adminClient.rpc("rate_gate_check", {
      p_action:         action,
      p_actor:          actor,
      p_limit:          policy.limit,
      p_window_seconds: policy.windowSeconds,
    });

    if (error) {
      console.error(`turnstile-guard rate_gate_check failed: ${error.message}`);
      return json(req, { error: "Internal error" }, 500);
    }

    const row = data?.[0] as { allowed?: boolean; retry_after_seconds?: number } | undefined;
    if (!row?.allowed) {
      const wait = row?.retry_after_seconds ?? policy.windowSeconds;
      const message =
        wait <= 60
          ? "Too many attempts. Please try again in a moment."
          : `Too many attempts. Please try again in ${Math.ceil(wait / 60)} minute${Math.ceil(wait / 60) === 1 ? "" : "s"}.`;
      return json(req, { error: message, retryAfterSeconds: wait }, 429);
    }

    return json(req, { ok: true }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`turnstile-guard error: ${message}`);
    return json(req, { error: "Internal error" }, 500);
  }
});
