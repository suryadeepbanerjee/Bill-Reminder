#!/usr/bin/env node
// Test script: sends a test bill reminder email via the email-sender Edge Function
// Usage: node test-email.mjs <your-email>
// Example: node test-email.mjs suryadeep@example.com

const email = process.argv[2];
if (!email) {
  console.error("Usage: node test-email.mjs <email-address>");
  process.exit(1);
}

const SUPABASE_URL = "https://dyhajmtfkjtwkijhptjx.supabase.co";
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!ANON_KEY) {
  console.error("Set EXPO_PUBLIC_SUPABASE_ANON_KEY env var first.");
  console.error("Find it at: https://supabase.com/dashboard → Project → Settings → API → anon public");
  process.exit(1);
}

const body = {
  reminderId: "00000000-0000-0000-0000-000000000000",
  userId: "00000000-0000-0000-0000-000000000000",
  billId: "00000000-0000-0000-0000-000000000000",
  email,
  subject: "Test: Bill Reminder",
  billName: "Test Bill — Electricity",
  amount: "₹1,200",
  dueDate: new Date().toISOString().split("T")[0],
  status: "due_today",
};

console.log(`Sending test email to ${email}...`);
console.log(`Function: ${SUPABASE_URL}/functions/v1/email-sender`);

const res = await fetch(`${SUPABASE_URL}/functions/v1/email-sender`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${ANON_KEY}`,
    apikey: ANON_KEY,
  },
  body: JSON.stringify(body),
});

const data = await res.json();
console.log(`Status: ${res.status}`);
console.log("Response:", JSON.stringify(data, null, 2));

if (data.success) {
  console.log("\n✅ Email sent! Check your inbox.");
} else {
  console.log("\n❌ Email failed:", data.error);
}
