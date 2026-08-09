import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { internalError } from "../_shared/http.ts";
import { leaveUrl } from "../_shared/site.ts";
import { getRateLimiter } from "../_shared/rate-limit.ts";
import { EMAIL_LOGO_HTML } from "../_shared/email-logo.ts";

/**
 * leave-household — sends a one-time verification link to the caller's email.
 *
 * Mirrors the invite flow: the membership row UUID is embedded in the link and
 * acts as a single-use token (only usable while the row is "active"), so the
 * actual removal happens on confirm (leave-household-by-code), with no login
 * required at click time.
 *
 * Body: { householdId: string }
 *
 * Guards:
 *   - caller must be an active member of the household
 *   - an admin may only leave when another active admin remains
 *   - rate-limited (5 requests / hour / caller)
 */

function json(req: Request, body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

/* HTML-escape user-provided values before interpolating into the Resend
 * template (same rule as invite-member — never render markup from raw input). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const { householdId } = await req.json();
    if (!householdId) {
      return json(req, { error: "householdId is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey   = Deno.env.get("RESEND_API_KEY");
    const authHeader  = req.headers.get("Authorization") ?? "";

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceKey);

    // ── 1. Verify caller is an active member ─────────────────────────────────
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) {
      return json(req, { error: "Not authenticated" }, 401);
    }

    // Rate limit: per authenticated user (the DB 5/hr gate below stays)
    const blocked = await getRateLimiter().enforce(req, "leave-household", {
      type: "user",
      value: caller.id,
    });
    if (blocked) return blocked;

    const { data: member } = await adminClient
      .from("household_members")
      .select("id, role, invited_email")
      .eq("household_id", householdId)
      .eq("user_id", caller.id)
      .eq("status", "active")
      .maybeSingle();

    if (!member) {
      return json(req, { error: "You are not an active member of this household." }, 403);
    }

    // ── 2. Super admins need another active super admin behind them ──────────
    if (member.role === "super_admin") {
      const { data: otherAdmins, error: adminsError } = await adminClient
        .from("household_members")
        .select("id")
        .eq("household_id", householdId)
        .eq("status", "active")
        .eq("role", "super_admin")
        .neq("id", member.id)
        .limit(1);

      if (adminsError) throw new Error(`Super admin lookup failed: ${adminsError.message}`);
      if (!otherAdmins || otherAdmins.length === 0) {
        return json(
          req,
          { error: "You are the only super admin. Delete the household from the app instead." },
          403
        );
      }
    }

    // ── 3. Abuse gate ─────────────────────────────────────────────────────────
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { data: gate, error: gateError } = await adminClient.rpc("rate_gate_check", {
      p_action:         "leave",
      p_actor:          `${ip}|${caller.id}`,
      p_limit:          5,
      p_window_seconds: 60 * 60,
    });

    if (gateError) {
      throw new Error(`Rate gate failed: ${gateError.message}`);
    }
    if (!gate?.[0]?.allowed) {
      return json(req, { error: "Too many leave requests. Please try again later." }, 429);
    }

    // ── 4. Send the verification email ───────────────────────────────────────
    const email = caller.email ?? member.invited_email;
    if (!email) {
      return json(req, { error: "No verified email address is linked to this account." }, 400);
    }
    if (!resendKey) {
      throw new Error("Email service is not configured. Please set RESEND_API_KEY.");
    }

    const confirmUrl  = escapeHtml(leaveUrl(householdId, member.id));
    const safeEmail   = escapeHtml(email);
    const safeDomain  = "Bill Reminder";

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#080810;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#080810;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#141420;border-radius:16px;border:1px solid #262626;overflow:hidden;">
          <tr>
<td style="padding:32px 32px 24px;text-align:center;">
              ${EMAIL_LOGO_HTML}
              <h1 style="color:#F5F5F5;font-size:22px;font-weight:700;margin:0 0 8px;">Leave this household?</h1>
              <p style="color:#A3A3A3;font-size:15px;margin:0;line-height:1.7;">
                We received a request to remove your access from this household on
                <strong style="color:#F5F5F5;">${safeDomain}</strong>.
              </p>
              <p style="color:#A3A3A3;font-size:15px;margin:14px 0 0;line-height:1.7;">
                If this was you, click the button below to confirm. You will lose access to the household's bills.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;text-align:center;">
              <a href="${confirmUrl}" style="display:inline-block;background-color:#D1A920;color:#080810;font-size:16px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;">Confirm Leave</a>
              <p style="color:#525252;font-size:12px;margin:16px 0 0;">
                If the button doesn't work, copy this link:<br>
                <a href="${confirmUrl}" style="color:#A3A3A3;text-decoration:underline;">${confirmUrl}</a>
              </p>
              <p style="color:#525252;font-size:12px;margin:12px 0 0;">
                If you didn't request this, you can ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        from:    "Bill Reminder <billalert@billreminder.suryadeepbanerjee.in>",
        to:      [email],
        subject: "Confirm leaving the household on Bill Reminder",
        html,
      }),
    });

    if (!resp.ok) {
      let detail = "";
      try {
        const j = await resp.json();
        detail = j?.message ?? JSON.stringify(j);
      } catch {
        detail = await resp.text();
      }
      console.error("Resend email failed (leave-household):", resp.status, detail?.slice(0, 200));
      throw new Error("The email could not be sent. Please try again later.");
    }

    return json(
      req,
      { success: true, message: `We sent a confirmation link to ${safeEmail}.` },
      200
    );
  } catch (err: any) {
    return internalError(req, "leave-household", err);
  }
});