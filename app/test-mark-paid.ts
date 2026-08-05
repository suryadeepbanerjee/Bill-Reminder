import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzeHFveHVvY2F0aHVwaHp5eHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODMxNTg2NTYsImV4cCI6MTk5ODczNDY1Nn0.GvV... (wait, let's just use the service key to bypass RLS, or grab anon key from env)";

async function run() {
  const supabase = createClient(supabaseUrl, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string);

  // Sign in or use service key
  // actually, let's just run SQL via psql!
}
