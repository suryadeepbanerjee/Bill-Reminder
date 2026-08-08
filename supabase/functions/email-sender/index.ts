// Edge Function: email-sender
// Called by reminder-dispatcher
// Responsibility: Calls Resend API (one digest email per user), writes notification_log per bill

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { internalError } from "../_shared/http.ts";
import {
	renderNotificationEmail,
	statusColorMap,
	type BillCardData,
} from "./templates/notification.ts";

/* H-4: HTML-escape user-controlled values before they reach the email
 * template — a malicious bill title must render as text, not markup. */
function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;")
		.toString();
}

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

	// Guard: only reminder-dispatcher (or any caller with CRON_SECRET) may send
	const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
	if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
		return new Response(JSON.stringify({ error: "unauthorized" }), {
			headers: { ...corsHeaders(req), "Content-Type": "application/json" },
			status: 401,
		});
	}

	try {
		const { email, subject, items } = await req.json();
		const batch: EmailItem[] = Array.isArray(items) && items.length > 0 ? items : [];

		if (!email || batch.length === 0) {
			return new Response(JSON.stringify({ error: "email and items[] are required" }), {
				headers: { ...corsHeaders(req), "Content-Type": "application/json" },
				status: 400,
			});
		}

		const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
		const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
		const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

		if (!resendApiKey) {
			throw new Error("RESEND_API_KEY environment variable is not set");
		}

		const supabase = createClient(supabaseUrl, supabaseServiceKey);

		// Map each reminder item into escaped template card data.
		const bills: BillCardData[] = batch.map((item) => ({
			billName: escapeHtml(item.billName || "Your Bill"),
			amount: escapeHtml(item.amount || "Check details"),
			dueDate: escapeHtml(item.dueDate || "Check details"),
			status: item.status || "upcoming",
			statusColor: statusColorMap[item.status || "upcoming"] || "#64748b",
		}));

		// Build content: single bill keeps the exact per-status copy; a digest
		// summarises the batch and shows every bill as its own card.
		const title = batch.length === 1
			? escapeHtml(batch[0].billName || "Bill Reminder")
			: `${batch.length} bills need your attention`;

		const subjectLine = subject || (batch.length === 1
			? `Bill Reminder: ${batch[0].billName || "Bill due"}`
			: `Bill Reminder: ${batch.length} bills need your attention`);

		let message: string;
		if (batch.length === 1) {
			const item = batch[0];
			const name = escapeHtml(item.billName || "Your Bill");
			const messageMap: Record<string, string> = {
				overdue: `Your bill <strong>${name}</strong> is <strong style="color:#dc2626;">overdue</strong>. Please make the payment at your earliest convenience. You can review all overdue bills below.`,
				due_today: `Your bill <strong>${name}</strong> is <strong style="color:#ea580c;">due today</strong>. Don't forget to make the payment.`,
				expected_payment: `Your bill <strong>${name}</strong> has a payment expected soon. Please ensure sufficient funds.`,
				generated: `A new occurrence for <strong>${name}</strong> has been generated. Review the details below.`,
				upcoming: `Your bill <strong>${name}</strong> is coming up. Here's a heads-up so you don't miss it.`,
			};
			message =
				messageMap[item.status || "upcoming"] ||
				`Your bill "<strong>${name}</strong>" is due on <strong>${escapeHtml(item.dueDate || "soon")}</strong>.`;
		} else {
			const overdue = batch.filter((b) => b.status === "overdue").length;
			const dueToday = batch.filter((b) => b.status === "due_today").length;
			const parts: string[] = [];
			if (overdue > 0) {
				parts.push(`<strong style="color:#dc2626;">${overdue} overdue</strong>`);
			}
			if (dueToday > 0) {
				parts.push(`<strong style="color:#ea580c;">${dueToday} due today</strong>`);
			}
			const summary = parts.length > 0 ? parts.join(" and ") : `${batch.length} bills`;
			message = `You have ${summary} bill${batch.length === 1 ? "" : "s"} pending. Review each bill below and make payments at your earliest convenience.`;
		}

		const htmlBody = renderNotificationEmail({
			title: escapeHtml(subject || title),
			subtitle: batch.length === 1 ? undefined : "Summary of bills that need your attention",
			message,
			bills,
		});

		// Send the ONE digest email via Resend
		const response = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${resendApiKey}`,
			},
			body: JSON.stringify({
				from: "Bill Reminder <billalert@billreminder.suryadeepbanerjee.in>",
				reply_to: "official@suryadeepbanerjee.in",
				to: email,
				subject: subjectLine,
				html: htmlBody,
			}),
		});

		const result = await response.json();

		// Log + mark each item together (one shared outcome for the batch)
		const outcomeStatus = response.ok ? "sent" : "failed";

		for (const item of batch) {
			await supabase.from("notification_log").insert({
				scheduled_reminder_id: item.reminderId,
				user_id: item.userId,
				channel: "email",
				provider_message_id: result.id ?? null,
				status: outcomeStatus,
				...(response.ok ? {} : { error: result.message || `HTTP ${response.status}` }),
			});

			await supabase
				.from("scheduled_reminders")
				.update({ status: outcomeStatus, sent_at: new Date().toISOString() })
				.eq("id", item.reminderId);
		}

		if (!response.ok) {
			return new Response(JSON.stringify({ success: false, error: result.message }), {
				headers: { ...corsHeaders(req), "Content-Type": "application/json" },
				status: 200,
			});
		}

		return new Response(JSON.stringify({ success: true, messageId: result.id, count: batch.length }), {
			headers: { ...corsHeaders(req), "Content-Type": "application/json" },
			status: 200,
		});
	} catch (error) {
		return internalError(req, "email-sender", error);
	}
});