// Edge Function: reminder-materializer
// Trigger: pg_cron, every 15 min
// Responsibility: Reads bill_reminder_rules + open occurrences, inserts due
// scheduled_reminders rows — one row PER USER whose per-bill preferences
// enable that channel (bill_notification_preferences).

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { internalError } from "../_shared/http.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  // Guard: only allow calls with a valid CRON_SECRET
  const authHeader = req.headers.get("Authorization") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all enabled reminder rules with their bills
    const { data: rules, error: rulesError } = await supabase
      .from("bill_reminder_rules")
      .select(`
        *,
        bills!inner (
          id,
          household_id,
          created_by,
          title
        )
      `)
      .eq("enabled", true);

    if (rulesError) throw rulesError;

    let remindersCreated = 0;
    let rulesProcessed = 0;

    for (const rule of rules || []) {
      try {
        rulesProcessed++;

        // Per-account, per-bill preferences for this bill: which users want
        // push and which want email for THIS bill.
        const { data: prefs, error: prefsError } = await supabase
          .from("bill_notification_preferences")
          .select("user_id, push_enabled, email_enabled")
          .eq("bill_id", rule.bills.id);

        if (prefsError) {
          console.error(`Error fetching prefs for bill ${rule.bills.id}:`, prefsError.message);
          continue;
        }

        const pushUsers = (prefs ?? [])
          .filter((p) => p.push_enabled)
          .map((p) => p.user_id);
        const emailUsers = (prefs ?? [])
          .filter((p) => p.email_enabled)
          .map((p) => p.user_id);

        // If nobody in the household opted into any channel, nothing to do.
        if (pushUsers.length === 0 && emailUsers.length === 0) continue;

        // Find open occurrences for this bill (exclude soft-deleted)
        const { data: occurrences, error: occError } = await supabase
          .from("bill_occurrences")
          .select("*")
          .eq("bill_id", rule.bills.id)
          .is("deleted_at", null)
          .in("state", ["upcoming", "generated", "expected_payment", "due_today", "overdue"]);

        if (occError) {
          console.error(`Error fetching occurrences for bill ${rule.bills.id}:`, occError.message);
          continue;
        }

        for (const occurrence of occurrences || []) {
          // Determine the anchor date based on rule.anchor
          let anchorDateStr: string | null = null;
          if (rule.anchor === "generation") {
            anchorDateStr = occurrence.generation_date;
          } else if (rule.anchor === "expected_payment") {
            anchorDateStr = occurrence.expected_payment_date;
          } else {
            anchorDateStr = occurrence.due_date;
          }

          if (!anchorDateStr) continue;

          // Calculate scheduled_for date
          const anchorDate = new Date(anchorDateStr + "T00:00:00");
          const scheduledFor = new Date(anchorDate);
          scheduledFor.setDate(scheduledFor.getDate() + rule.offset_days);
          scheduledFor.setHours(9, 0, 0, 0); // 9:00 AM

          // Pick recipients per channel from the per-account prefs.
          // If the rule broadcasts to the channel, each opted-in user gets
          // their own scheduled_reminders row (unique per user now).
          const channelRecipients: { users: string[]; channel: string }[] = [];
          if (rule.channel === "push" || rule.channel === "both") {
            channelRecipients.push({ users: pushUsers, channel: "push" });
          }
          if (rule.channel === "email" || rule.channel === "both") {
            channelRecipients.push({ users: emailUsers, channel: "email" });
          }

          // For overdue occurrences: create daily reminders regardless of offset_days.
          if (occurrence.state === "overdue" || occurrence.state === "due_today") {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            for (const { users, channel } of channelRecipients) {
              for (const userId of users) {
                const { count } = await supabase
                  .from("scheduled_reminders")
                  .select("id", { count: "exact", head: true })
                  .eq("occurrence_id", occurrence.id)
                  .eq("rule_id", rule.id)
                  .eq("channel", channel)
                  .eq("user_id", userId)
                  .gte("scheduled_for", todayStart.toISOString());

                if (count && count > 0) continue; // Already have one for today

                // Create reminder scheduled for today at 9AM (or now if past 9AM)
                const todayAt9 = new Date();
                todayAt9.setHours(9, 0, 0, 0);
                if (todayAt9.getTime() < Date.now()) {
                  todayAt9.setTime(Date.now()); // fire immediately if past 9AM
                }

                const { error: insertError } = await supabase
                  .from("scheduled_reminders")
                  .insert({
                    occurrence_id: occurrence.id,
                    rule_id: rule.id,
                    user_id: userId,
                    scheduled_for: todayAt9.toISOString(),
                    channel,
                    status: "pending",
                  })
                  .select()
                  .single();

                if (insertError && insertError.code !== "23505") {
                  console.error(`Error inserting daily overdue reminder:`, insertError.message);
                } else if (!insertError) {
                  remindersCreated++;
                }
              }
            }
            continue; // Handled overdue/due_today separately, skip standard logic
          }

          // Standard logic: skip if scheduled_for is before today (already fired)
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          if (scheduledFor.getTime() < todayStart.getTime()) continue;

          // Insert scheduled reminders per user (idempotent via unique constraint)
          for (const { users, channel } of channelRecipients) {
            for (const userId of users) {
              const { error: insertError } = await supabase
                .from("scheduled_reminders")
                .insert({
                  occurrence_id: occurrence.id,
                  rule_id: rule.id,
                  user_id: userId,
                  scheduled_for: scheduledFor.toISOString(),
                  channel,
                  status: "pending",
                })
                .select()
                .single();

              // Unique constraint violation means it already exists — that's fine
              if (insertError && insertError.code !== "23505") {
                console.error(`Error inserting scheduled reminder:`, insertError.message);
              } else if (!insertError) {
                remindersCreated++;
              }
            }
          }
        }
      } catch (e) {
        console.error(`Error processing rule ${rule.id}:`, e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        rulesProcessed,
        remindersCreated,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return internalError(req, "reminder-materializer", error);
  }
});