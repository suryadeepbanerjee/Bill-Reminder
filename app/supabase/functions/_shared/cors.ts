// Shared CORS helper for Edge Functions.
// Restricts browser access to known origins instead of the previous
// "Access-Control-Allow-Origin: *". Native (Expo) and server-side callers
// are unaffected — CORS is a browser-only mechanism.
//
// The website is the only browser client:
//   https://billreminder.suryadeepbanerjee.in
// Local Vite dev server origins are allowed for testing.

export const ALLOWED_ORIGINS = [
  "https://billreminder.suryadeepbanerjee.in",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : "";

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-cron-secret",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
  if (allowOrigin) {
    headers["Access-Control-Allow-Origin"] = allowOrigin;
    headers["Vary"] = "Origin";
  }
  return headers;
}
