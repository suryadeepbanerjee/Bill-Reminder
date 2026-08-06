// Shared HTTP helpers for Edge Functions.
// Sanitizes error responses so no internal message (Postgres/Resend/Supabase
// internals) ever reaches a caller. Full detail goes to function logs, and a
// requestId is returned so an incident can be correlated with the logs.

import { corsHeaders } from "./cors.ts";

export function internalError(
  req: Request,
  context: string,
  err: unknown,
  status = 500
): Response {
  const requestId = crypto.randomUUID();
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${context}] requestId=${requestId} error=${message}`);
  return new Response(
    JSON.stringify({ error: "Internal error", requestId }),
    {
      status,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    }
  );
}
