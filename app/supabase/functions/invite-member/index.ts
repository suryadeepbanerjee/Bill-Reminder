import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Invite resend policy ─────────────────────────────────────────────────────
// 2 minute cooldown between sends, max 3 resends (4 total sends),
// then a 1 hour lockout measured from the last successful send.
const RESEND_COOLDOWN_MS = 2 * 60 * 1000;
const MAX_SENDS          = 4; // initial invite + 3 resends
const LOCKOUT_MS         = 60 * 60 * 1000;

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* Return a 429 Response when a resend is not allowed yet, else null. */
function resendLimitCheck(inviteCount: number, lastSentMs: number, now: number): Response | null {
  const sinceLast = now - lastSentMs; // ms since last send

  if (inviteCount >= MAX_SENDS && sinceLast < LOCKOUT_MS) {
    const waitMin = Math.max(1, Math.ceil((LOCKOUT_MS - sinceLast) / 60000));
    return json(
      {
        error: "Too many invites sent to this email. Please try again after 1 hour.",
        retryAfterMs: LOCKOUT_MS - sinceLast,
        inviteCount,
      },
      429
    );
  }

  if (sinceLast < RESEND_COOLDOWN_MS) {
    const waitSec = Math.max(1, Math.ceil((RESEND_COOLDOWN_MS - sinceLast) / 1000));
    return json(
      {
        error: `Please wait ${waitSec}s before sending another invite.`,
        retryAfterMs: RESEND_COOLDOWN_MS - sinceLast,
        inviteCount,
      },
      429
    );
  }

  return null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { householdId, email } = await req.json();

    if (!householdId || !email) {
      return json({ error: "householdId and email are required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey   = Deno.env.get("RESEND_API_KEY");
    const authHeader  = req.headers.get("Authorization") ?? "";

    // Client with the caller's JWT (for RLS)
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service-role client (to look up auth users + insert member)
    const adminClient = createClient(supabaseUrl, serviceKey);

    // ── 1. Verify caller is admin of this household ────────────────────────
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) {
      return json({ error: "Not authenticated" }, 401);
    }

    const { data: callerMember } = await adminClient
      .from("household_members")
      .select("role")
      .eq("household_id", householdId)
      .eq("user_id", caller.id)
      .eq("status", "active")
      .single();

    if (!callerMember || callerMember.role !== "admin") {
      return json({ error: "Only admins can invite members" }, 403);
    }

    // ── 2. Look up the target user by email in auth.users ──────────────────
    const { data: authUsers, error: listError } = await adminClient.auth.admin.listUsers({
      filter: `email=${email}`,
    });

    if (listError) {
      throw new Error(`Failed to look up user: ${listError.message}`);
    }

    const targetUser = authUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!targetUser) {
      return json(
        { error: "No account found with this email. They must create an account first." },
        404
      );
    }

    // ── 3. Check if already a member ───────────────────────────────────────
    const { data: existing } = await adminClient
      .from("household_members")
      .select("id, status, invite_count, invite_last_sent_at")
      .eq("household_id", householdId)
      .eq("user_id", targetUser.id)
      .single();

    const nowIso = new Date().toISOString();

    if (existing) {
      if (existing.status === "active") {
        return json({ error: "This user is already a member of this household" }, 409);
      }

      // Invited or removed → resend path with rate limiting
      const inviteCount = existing.invite_count ?? 1;
      const lastSentMs  = existing.invite_last_sent_at
        ? new Date(existing.invite_last_sent_at).getTime()
        : Date.now();

      const blocked = resendLimitCheck(inviteCount, lastSentMs, Date.now());
      if (blocked) return blocked;

      await adminClient
        .from("household_members")
        .update({
          status:             "invited",
          invited_email:      email,
          invite_count:       inviteCount + 1,
          invite_last_sent_at: nowIso,
        })
        .eq("id", existing.id);
    } else {
      // ── 4. Insert the invite row ─────────────────────────────────────────
      const { error: insertError } = await adminClient
        .from("household_members")
        .insert({
          household_id:        householdId,
          user_id:             targetUser.id,
          invited_email:       email,
          role:                "editor",
          status:              "invited",
          invite_count:        1,
          invite_last_sent_at: nowIso,
        });

      if (insertError) {
        throw new Error(`Failed to create invite: ${insertError.message}`);
      }
    }

    // ── 5. Fetch household name for the email ──────────────────────────────
    const { data: household } = await adminClient
      .from("households")
      .select("name")
      .eq("id", householdId)
      .single();

    const householdName = household?.name ?? "a household";

    // Fetch caller's profile for display name
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("display_name")
      .eq("id", caller.id)
      .maybeSingle();

    const callerName = callerProfile?.display_name
      ?? caller.user_metadata?.display_name
      ?? caller.email?.split("@")[0]
      ?? "Someone";

    // ── 6. Send invite email via Resend ────────────────────────────────────
    if (!resendKey) {
      throw new Error("Email service is not configured. Please set RESEND_API_KEY.");
    }

    const webUrl = `https://billreminder.suryadeepbanerjee.in/accept-invite?hid=${householdId}`;

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
              <div style="font-size:32px;margin-bottom:16px;">🏠</div>
              <h1 style="color:#F5F5F5;font-size:22px;font-weight:700;margin:0 0 8px;">You're Invited!</h1>
              <p style="color:#A3A3A3;font-size:15px;margin:0;">
                <strong style="color:#F5F5F5;">${callerName}</strong> invited you to join
              </p>
              <p style="color:#D1A920;font-size:20px;font-weight:700;margin:12px 0 0;">${householdName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;text-align:center;">
              <a href="${webUrl}" style="display:inline-block;background-color:#D1A920;color:#080810;font-size:16px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;">
                Accept Invitation
              </a>
              <p style="color:#525252;font-size:12px;margin:16px 0 0;">
                If the button doesn't work, copy this link:<br>
                <a href="${webUrl}" style="color:#A3A3A3;text-decoration:underline;">${webUrl}</a>
              </p>
              <p style="color:#525252;font-size:12px;margin:12px 0 0;">
                If you didn't expect this invitation, you can safely ignore this email.
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
        subject: `${callerName} invited you to "${householdName}" on Bill Reminder`,
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
      console.error("Resend email failed:", resp.status, detail);
      throw new Error("The invitation was saved, but the email could not be sent. Please check the email service configuration.");
    }

    return json({ success: true, message: `Invitation sent to ${email}` }, 200);
  } catch (err: any) {
    console.error("invite-member error:", err);
    return json({ error: err.message ?? "Internal error" }, 500);
  }
});
