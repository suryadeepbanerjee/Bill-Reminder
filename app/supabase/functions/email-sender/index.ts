// Edge Function: email-sender
// Called by reminder-dispatcher
// Responsibility: Calls Resend API, writes notification_log

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { internalError } from "../_shared/http.ts";
import { renderNotificationEmail } from "./templates/notification.ts";

/* H-4: HTML-escape user-controlled values before they reach the email
 * template — a malicious bill title must render as text, not markup. */
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

	// Guard: only reminder-dispatcher (or any caller with CRON_SECRET) may send
	const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
	if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
		return new Response(JSON.stringify({ error: "unauthorized" }), {
			headers: { ...corsHeaders(req), "Content-Type": "application/json" },
			status: 401,
		});
	}

	try {
		const { reminderId, userId, billId, email, subject, billName, amount, dueDate, status } = await req.json();

		const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
		const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
		const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

		if (!resendApiKey) {
			throw new Error("RESEND_API_KEY environment variable is not set");
		}

		const supabase = createClient(supabaseUrl, supabaseServiceKey);

		// Build status-aware message
		const messageMap: Record<string, string> = {
			overdue: `Your bill <strong>${escapeHtml(billName || "Your Bill")}</strong> is <strong style="color:#dc2626;">overdue</strong>. Please make the payment at your earliest convenience.`,
			due_today: `Your bill <strong>${escapeHtml(billName || "Your Bill")}</strong> is <strong style="color:#ea580c;">due today</strong>. Don't forget to make the payment.`,
			expected_payment: `Your bill <strong>${escapeHtml(billName || "Your Bill")}</strong> has a payment expected soon. Please ensure sufficient funds.`,
			generated: `A new occurrence for <strong>${escapeHtml(billName || "Your Bill")}</strong> has been generated. Review the details below.`,
			upcoming: `Your bill <strong>${escapeHtml(billName || "Your Bill")}</strong> is coming up. Here's a heads-up so you don't miss it.`,
		};
		const message =
			messageMap[status || "upcoming"] ||
			`Your bill "<strong>${escapeHtml(billName || "Your Bill")}</strong>" is due on <strong>${escapeHtml(dueDate || "soon")}</strong>.`;

		// Render HTML using template module.
		// `title` (the subject, which embeds the user-controlled bill title)
		// reaches the template's <h1>{{title}}</h1> — escape it so a malicious
		// bill title cannot inject markup into the email (audit finding).
		const htmlBody = renderNotificationEmail({
			title: escapeHtml(subject || "Bill Reminder"),
			message,
			billName: escapeHtml(billName || "Your Bill"),
			amount: escapeHtml(amount || "Check details"),
			dueDate: escapeHtml(dueDate || "Check details"),
			status: status || "upcoming",
			actionUrl: `https://billreminder.suryadeepbanerjee.in/bill/${billId}`,
		});

		// Send email via Resend
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
				subject: subject || "Bill Reminder",
				html: htmlBody,
			}),
		});

		const result = await response.json();

		if (!response.ok) {
			// Log failure
			await supabase.from("notification_log").insert({
				scheduled_reminder_id: reminderId,
				user_id: userId,
				channel: "email",
				provider_message_id: result.id,
				status: "failed",
				error: result.message || `HTTP ${response.status}`,
			});

			await supabase.from("scheduled_reminders").update({ status: "failed", sent_at: new Date().toISOString() }).eq("id", reminderId);

			return new Response(JSON.stringify({ success: false, error: result.message }), {
				headers: { ...corsHeaders(req), "Content-Type": "application/json" },
				status: 200,
			});
		}

		// Log success
		await supabase.from("notification_log").insert({
			scheduled_reminder_id: reminderId,
			user_id: userId,
			channel: "email",
			provider_message_id: result.id,
			status: "sent",
		});

		await supabase.from("scheduled_reminders").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", reminderId);

		return new Response(JSON.stringify({ success: true, messageId: result.id }), {
			headers: { ...corsHeaders(req), "Content-Type": "application/json" },
			status: 200,
		});
	} catch (error) {
		return internalError(req, "email-sender", error);
	}
});
