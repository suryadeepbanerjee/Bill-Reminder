// Edge Function: reminder-dispatcher
// Trigger: pg_cron, every 5 min
// Purpose: Claims pending reminders, routes each to push-sender or email-sender.
//          Email reminders are batched into ONE digest email per user per run.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { internalError } from "../_shared/http.ts";

type EmailItem = {
	reminderId: string;
	userId: string;
	billId: string;
	billName: string;
	amount: string;
	dueDate: string;
	status: string;
};

serve(async (req: Request) => {
	if (req.method === "OPTIONS") {
		return new Response("ok", { headers: corsHeaders(req) });
	}

	// Guard: only allow calls with a valid CRON_SECRET (pg_cron sender)
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

		// Claim pending reminders atomically
		const { data: pendingReminders, error: claimError } = await supabase
			.rpc("claim_pending_reminders");

		if (claimError) throw claimError;

		let pushedSent = 0;
		let emailsSent = 0; // count of digest emails (one per user)
		let failed = 0;

		// Email batch accumulation per recipient (user_id → items)
		const emailBatchByUser = new Map<string, EmailItem[]>();

		// Dispatch each claimed reminder
		for (const reminder of pendingReminders || []) {
			try {
				// Get occurrence and bill details for the notification content
				const { data: occurrence, error: occError } = await supabase
					.from("bill_occurrences")
					.select("id, bill_id, due_date, state")
					.eq("id", reminder.occurrence_id)
					.single();

				if (occError) throw occError;

				// Get bill details
				const { data: bill, error: billError } = await supabase
					.from("bills")
					.select("id, title, amount_expected, currency, household_id")
					.eq("id", occurrence?.bill_id)
					.single();

				if (billError) throw billError;

				// Decide routing based on the reminder's channel
				if (reminder.channel === "push") {
					// Get the user's push tokens
					const { data: pushTokens, error: tokensError } = await supabase
						.from("push_tokens")
						.select("id")
						.eq("user_id", reminder.user_id);

					if (tokensError) throw tokensError;

					if (!pushTokens || pushTokens.length === 0) {
						await updateReminderStatus(supabase, reminder.id);
						continue;
					}

					// Call push-sender with the reminder payload
					const pushResponse = await fetch(
						`${supabaseUrl}/functions/v1/push-sender`,
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								"x-cron-secret": cronSecret,
							},
							body: JSON.stringify({
								reminderId: reminder.id,
								userId: reminder.user_id,
								title: `Bill due: ${bill.title}`,
							}),
						}
					);

					if (!pushResponse.ok) {
						throw new Error(`push-sender failed (status ${pushResponse.status})`);
					}

					pushedSent++;
				} else {
					// ── Email channel ──────────────────────────────────────────────
					// House rule: only admins and super_admins receive email — check role.
					const { data: memberRole, error: roleError } = await supabase
						.from("household_members")
						.select("role")
						.eq("household_id", bill.household_id)
						.eq("user_id", reminder.user_id)
						.single();

					if (roleError) throw roleError;

					const canEmail =
						memberRole?.role === "admin" || memberRole?.role === "super_admin";

					const { data: profile, error: profileError } = await supabase
						.from("profiles")
						.select("email, email_notifications_enabled")
						.eq("id", reminder.user_id)
						.single();

					if (profileError) throw profileError;

					if (!profile?.email_notifications_enabled || !canEmail) {
						await updateReminderStatus(supabase, reminder.id);
						continue;
					}

					const amountText = `${bill.amount_expected} ${bill.currency}`;
					const item: EmailItem = {
						reminderId: reminder.id,
						userId: reminder.user_id,
						billId: bill.id,
						billName: bill.title,
						amount: amountText,
						dueDate: occurrence?.due_date ?? "",
						status: occurrence?.state ?? "upcoming",
					};

					const existing = emailBatchByUser.get(reminder.user_id) ?? [];
					existing.push(item);
					emailBatchByUser.set(reminder.user_id, existing);
				}
			} catch (e) {
				failed++;
				await updateReminderStatus(supabase, reminder.id);
			}
		}

		// Send ONE digest email per user with all their overdue/today bills
		for (const [userId, items] of emailBatchByUser) {
			try {
				const { data: profile, error: profileError } = await supabase
					.from("profiles")
					.select("email")
					.eq("id", userId)
					.single();

				if (profileError || !profile?.email) {
					failed += items.length;
					for (const item of items) {
						await updateReminderStatus(supabase, item.reminderId);
					}
					continue;
				}

				const emailResponse = await fetch(
					`${supabaseUrl}/functions/v1/email-sender`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"x-cron-secret": cronSecret,
						},
						body: JSON.stringify({
							email: profile.email,
							items,
						}),
					}
				);

				if (!emailResponse.ok) {
					throw new Error(`email-sender failed (status ${emailResponse.status})`);
				}

				emailsSent++;
			} catch (e) {
				failed += items.length;
				for (const item of items) {
					await updateReminderStatus(supabase, item.reminderId);
				}
			}
		}

		return new Response(
			JSON.stringify({ pushedSent, emailsSent, failed }),
			{ headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
		);
	} catch (e) {
		return internalError(req, "reminder-dispatcher", e);
	}
});

async function updateReminderStatus(
	supabase: ReturnType<typeof createClient>,
	reminderId: string,
	status = "failed",
) {
	const { error } = await supabase
		.from("scheduled_reminders")
		.update({ status })
		.eq("id", reminderId);
	if (error) throw error;
}