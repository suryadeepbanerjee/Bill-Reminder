# Supabase Setup Guide

## 1. Project Initialization
1. Create a new project in the Supabase Dashboard.
2. Link your local project: `npx supabase link --project-ref <your-project-ref>`

## 2. Environment Variables
You need to configure the following variables in the `.env` file of your Expo app:
```env
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```
For the Edge Functions / Resend integration (Phase 5), set the secrets via CLI:
```bash
npx supabase secrets set RESEND_API_KEY=your_key
npx supabase secrets set RESEND_FROM_EMAIL=notifications@yourdomain.com
```

## 3. Applying Migrations
Apply all 16 migrations sequentially to ensure the database schema, functions, triggers, and RLS policies are set up correctly:
```bash
npx supabase db push
```
If you encounter issues during push or want to reset a local database:
```bash
npx supabase db reset
```

## 4. Authentication Configuration
In the Supabase Dashboard under **Authentication > Providers**:
- Enable **Email/Password**.
- Enable **Google** (Input your Google Client ID and Secret for iOS/Android/Web).

## 5. Cron Jobs and Edge Functions (Future Phases)
You will need to deploy the Edge functions and configure the pg_cron extension (to periodically run the RPC claims).
```bash
npx supabase functions deploy
```
