// Edge Function: push-sender
// Called by reminder-dispatcher
// Responsibility: Sends push notifications (FCM V1 direct, or Expo push API as
//                 fallback for Expo-style tokens) and writes notification_log.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { internalError } from "../_shared/http.ts";

// ── OAuth2 (JWT bearer) minting for FCM V1 ───────────────────────────────────

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri: string;
};

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function base64UrlEncode(input: string | Uint8Array): string {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : input;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signWithPrivateKey(pem: string, data: Uint8Array): Promise<Uint8Array> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    der.buffer as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, data));
}

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const serviceAccountRaw = Deno.env.get("FCM_SERVICE_ACCOUNT");
  if (!serviceAccountRaw) {
    throw new Error("FCM_SERVICE_ACCOUNT secret is not set");
  }
  const sa: ServiceAccount = JSON.parse(serviceAccountRaw);

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64UrlEncode(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: sa.token_uri,
      iat: now,
      exp: now + 3600,
    })
  );
  const signingInput = `${header}.${claims}`;
  const signature = base64UrlEncode(
    await signWithPrivateKey(sa.private_key, new TextEncoder().encode(signingInput))
  );
  const assertion = `${signingInput}.${signature}`;

  const tokenResponse = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`OAuth token exchange failed (HTTP ${tokenResponse.status})`);
  }

  const tokenData = await tokenResponse.json();
  cachedAccessToken = {
    token: tokenData.access_token,
    expiresAt: now + (tokenData.expires_in ?? 3600) * 1000,
  };
  return cachedAccessToken.token;
}

// ── FCM V1 send ───────────────────────────────────────────────────────────────

async function sendFcmV1(
  token: string,
  payload: { title: string; body: string; reminderId: string; billId: string | null },
  projectId: string
): Promise<{ ok: boolean; providerId?: string; error?: string }> {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: payload.title, body: payload.body },
          data: {
            reminderId: payload.reminderId,
            billId: payload.billId ?? "",
          },
          android: {
            priority: "high",
            notification: {
              channelId: "reminders",
              sound: "default",
            },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const errBody = await response.json();
      message = errBody?.error?.message ?? JSON.stringify(errBody);
    } catch {
      // keep default message
    }
    return { ok: false, error: message };
  }

  const result = await response.json();
  return { ok: true, providerId: result.name };
}

// ── Expo push API (fallback for ExponentPushToken[...] tokens) ───────────────

async function sendExpoPush(
  tokens: string[],
  payload: { title: string; body: string; reminderId: string; billId: string | null }
): Promise<{ ok: boolean; providerId?: string; error?: string }> {
  const messages = tokens.map((t) => ({
    to: t,
    sound: "default",
    title: payload.title,
    body: payload.body,
    data: { reminderId: payload.reminderId, billId: payload.billId ?? null },
  }));

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });

  const result = await response.json();
  const hasErrors = result.data?.some((r: any) => r.status === "error");

  if (!response.ok || hasErrors) {
    return {
      ok: false,
      error: result.errors?.[0]?.message || result.data?.[0]?.message || `HTTP ${response.status}`,
    };
  }

  return { ok: true, providerId: result.data?.[0]?.id };
}

// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  // Guard: only reminder-dispatcher (or any caller with CRON_SECRET) may send
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const { reminderId, userId, title, body, billId } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's push tokens
    const { data: tokens, error: tokenError } = await supabase
      .from("push_tokens")
      .select("id, expo_push_token")
      .eq("user_id", userId);

    if (tokenError) throw tokenError;

    if (!tokens || tokens.length === 0) {
      // No push tokens — mark as skipped (user hasn't registered for push)
      await supabase
        .from("scheduled_reminders")
        .update({ status: "skipped", sent_at: new Date().toISOString() })
        .eq("id", reminderId);

      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "no_push_tokens" }),
        {
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const payload = { title, body, reminderId, billId: billId ?? null };

    // Route each token: raw FCM registration tokens go through FCM V1;
    // Expo-format tokens through the Expo push API.
    const expoTokens = tokens.filter((t) => t.expo_push_token.startsWith("ExponentPushToken["));
    const fcmTokens = tokens.filter((t) => !t.expo_push_token.startsWith("ExponentPushToken["));

    let providerId: string | undefined;
    let errorMessage: string | undefined;

    if (fcmTokens.length > 0) {
      const sa: ServiceAccount = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT")!);
      const results = await Promise.all(
        fcmTokens.map((t) => sendFcmV1(t.expo_push_token, payload, sa.project_id))
      );

      const succeeded = results.find((r) => r.ok);
      const failed = results.find((r) => !r.ok);

      if (succeeded) {
        providerId = succeeded.providerId;
      } else if (failed) {
        errorMessage = failed.error;
      }
    }

    if (!errorMessage && expoTokens.length > 0) {
      const expoResult = await sendExpoPush(expoTokens, payload);
      if (expoResult.ok) {
        providerId = expoResult.providerId;
      } else {
        errorMessage = expoResult.error;
      }
    }

    if (errorMessage) {
      // Log failure
      await supabase.from("notification_log").insert({
        scheduled_reminder_id: reminderId,
        user_id: userId,
        channel: "push",
        provider_message_id: providerId,
        status: "failed",
        error: errorMessage,
      });

      await supabase
        .from("scheduled_reminders")
        .update({ status: "failed", sent_at: new Date().toISOString() })
        .eq("id", reminderId);

      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        {
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Log success
    await supabase.from("notification_log").insert({
      scheduled_reminder_id: reminderId,
      user_id: userId,
      channel: "push",
      provider_message_id: providerId,
      status: "sent",
    });

    await supabase
      .from("scheduled_reminders")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", reminderId);

    return new Response(
      JSON.stringify({ success: true, provider: providerId ? "fcm_v1" : "expo" }),
      {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return internalError(req, "push-sender", error);
  }
});
