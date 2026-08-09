import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { internalError } from "../_shared/http.ts";
import { getRateLimiter } from "../_shared/rate-limit.ts";
import { EMAIL_LOGO_HTML } from "../_shared/email-logo.ts";

/**
 * transfer-ownership — allows a super_admin to transfer ownership to an admin.
 * Uses a two-phase process:
 * Phase "request": validates permissions and target, checks rate limit, and triggers OTP.
 * Phase "confirm": verifies OTP, transfers ownership atomically, logs audit, and sends emails.
 */

function json(req: Request, body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

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
    const { phase, householdId, targetMemberId, otpToken } = await req.json();
    if (!householdId || !targetMemberId || !phase) {
      return json(req, { error: "householdId, targetMemberId, and phase are required" }, 400);
    }
    if (phase !== "request" && phase !== "confirm") {
      return json(req, { error: "phase must be 'request' or 'confirm'" }, 400);
    }
    if (phase === "confirm" && !otpToken) {
      return json(req, { error: "otpToken is required for confirm phase" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey   = Deno.env.get("RESEND_API_KEY");
    const authHeader  = req.headers.get("Authorization") ?? "";

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceKey);

    // 1. Verify caller is authenticated
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) {
      return json(req, { error: "Not authenticated" }, 401);
    }

    // Rate limit: both phases together, per authenticated user
    // (the per-phase DB gates of 3/hr and 5/hr remain below)
    const blocked = await getRateLimiter().enforce(req, "transfer-ownership", {
      type: "user",
      value: caller.id,
    });
    if (blocked) return blocked;

    // 2. Verify caller is super_admin of the household
    const { data: callerMember } = await adminClient
      .from("household_members")
      .select("id, role")
      .eq("household_id", householdId)
      .eq("user_id", caller.id)
      .eq("status", "active")
      .maybeSingle();

    if (!callerMember || callerMember.role !== "super_admin") {
      return json(req, { error: "Only the Owner can transfer ownership." }, 403);
    }

    // 3. Verify target is an active admin of the household
    const { data: targetMember } = await adminClient
      .from("household_members")
      .select("id, user_id, role, invited_email")
      .eq("id", targetMemberId)
      .eq("household_id", householdId)
      .eq("status", "active")
      .maybeSingle();

    if (!targetMember) {
      return json(req, { error: "Target member not found or not active." }, 404);
    }
    if (targetMember.role !== "admin") {
      return json(req, { error: "Target member must be an Admin before ownership can be transferred." }, 400);
    }
    if (targetMember.user_id === caller.id) {
      return json(req, { error: "You cannot transfer ownership to yourself." }, 400);
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    if (phase === "request") {
      // Phase 1: Request
      // Rate limit: 3 per hour
      const { data: gate, error: gateError } = await adminClient.rpc("rate_gate_check", {
        p_action:         "transfer-ownership-request",
        p_actor:          `${ip}|${caller.id}`,
        p_limit:          3,
        p_window_seconds: 60 * 60,
      });

      if (gateError) throw new Error(`Rate gate failed: ${gateError.message}`);
      if (!gate?.[0]?.allowed) {
        return json(req, { error: "Too many transfer requests. Please try again later." }, 429);
      }

      // Trigger OTP
      const { error: otpError } = await userClient.auth.signInWithOtp({ email: caller.email! });
      if (otpError) {
        throw new Error(`Failed to send OTP: ${otpError.message}`);
      }

      return json(req, { success: true, message: `Code sent to ${caller.email}` }, 200);
    }

    if (phase === "confirm") {
      // Phase 2: Confirm
      // Rate limit OTP attempts: 5 per hour
      const { data: gate, error: gateError } = await adminClient.rpc("rate_gate_check", {
        p_action:         "transfer-ownership-confirm",
        p_actor:          `${ip}|${caller.id}`,
        p_limit:          5,
        p_window_seconds: 60 * 60,
      });

      if (gateError) throw new Error(`Rate gate failed: ${gateError.message}`);
      if (!gate?.[0]?.allowed) {
        return json(req, { error: "Too many verification attempts. Please try again later." }, 429);
      }

      // Verify OTP
      const { error: verifyError } = await userClient.auth.verifyOtp({
        email: caller.email!,
        token: otpToken,
        type: "magiclink",
      });
      if (verifyError) {
        return json(req, { error: verifyError.message }, 400);
      }

      // Perform atomic ownership transfer using migration 064 RPC
      const { error: transferError } = await adminClient.rpc("transfer_household_ownership", {
        p_household_id: householdId,
        p_current_owner_id: caller.id,
        p_new_owner_id: targetMember.user_id,
      });

      if (transferError) {
        throw new Error(`Transfer RPC failed: ${transferError.message}`);
      }

      // Write audit log
      await adminClient.from("audit_log").insert({
        household_id: householdId,
        actor_id: caller.id,
        action: "transfer_ownership",
        entity_type: "household",
        entity_id: householdId,
        metadata: {
          from_user_id: caller.id,
          to_user_id: targetMember.user_id,
          to_member_id: targetMemberId,
        }
      });

      // Send notification emails (if RESEND_API_KEY is configured)
      if (resendKey) {
        // Fetch household name and target user profile for emails
        const { data: household } = await adminClient.from("households").select("name").eq("id", householdId).single();
        const { data: targetProfile } = await adminClient.from("profiles").select("display_name, email").eq("id", targetMember.user_id).single();
        const { data: callerProfile } = await adminClient.from("profiles").select("display_name").eq("id", caller.id).single();

        const householdName = household?.name || "the household";
        const newOwnerName = targetProfile?.display_name || "a member";
        const oldOwnerName = callerProfile?.display_name || "The previous owner";
        
        const targetEmail = targetProfile?.email || targetMember.invited_email;
        const callerEmail = caller.email;

        const emailPromises = [];

        // Email to Old Owner (Caller)
        if (callerEmail) {
          const oldOwnerHtml = generateEmailHtml(
            "Ownership Transferred",
            `You have transferred ownership of <strong style="color:#F5F5F5;">${escapeHtml(householdName)}</strong> to <strong style="color:#F5F5F5;">${escapeHtml(newOwnerName)}</strong>.`,
            `You are now an Admin in this household.`
          );
          emailPromises.push(
            fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Bill Reminder <billalert@billreminder.suryadeepbanerjee.in>",
                to: [callerEmail],
                subject: `Ownership transferred for ${householdName}`,
                html: oldOwnerHtml,
              }),
            })
          );
        }

        // Email to New Owner (Target)
        if (targetEmail) {
          const newOwnerHtml = generateEmailHtml(
            "You are now the Owner",
            `<strong style="color:#F5F5F5;">${escapeHtml(oldOwnerName)}</strong> has transferred ownership of <strong style="color:#F5F5F5;">${escapeHtml(householdName)}</strong> to you.`,
            `You now have full control over the household and its members.`
          );
          emailPromises.push(
            fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Bill Reminder <billalert@billreminder.suryadeepbanerjee.in>",
                to: [targetEmail],
                subject: `You are now the Owner of ${householdName}`,
                html: newOwnerHtml,
              }),
            })
          );
        }

        // Send emails in background
        Promise.all(emailPromises).catch(err => console.error("Email send failed:", err));
      }

      return json(req, { success: true }, 200);
    }

  } catch (err: any) {
    return internalError(req, "transfer-ownership", err);
  }
});

function generateEmailHtml(title: string, body1: string, body2: string) {
  return `
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
<td style="padding:32px 32px 32px;text-align:center;">
              ${EMAIL_LOGO_HTML}
              <h1 style="color:#F5F5F5;font-size:22px;font-weight:700;margin:0 0 8px;">${title}</h1>
              <p style="color:#A3A3A3;font-size:15px;margin:0;line-height:1.7;">
                ${body1}
              </p>
              <p style="color:#A3A3A3;font-size:15px;margin:14px 0 0;line-height:1.7;">
                ${body2}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
