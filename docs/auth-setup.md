# Authentication Setup Guide

This document outlines the manual steps required to fully configure the authentication infrastructure for Bill Reminder.

## 1. Supabase Dashboard Configuration

### SMTP Setup (Resend)
By default, Supabase sends emails from a generic address with rate limits. We use Resend for reliable, branded email delivery.

1. Go to your **Supabase Dashboard** > **Project Settings** > **Auth** > **SMTP Settings**.
2. Enable **Enable Custom SMTP**.
3. Configure the following fields based on your Resend SMTP credentials:
   - **Host**: `smtp.resend.com`
   - **Port**: `465` (or `587`)
   - **User**: `resend`
   - **Password**: Your Resend API Key (starts with `re_`)
   - **Sender Email**: `auth@billreminder.suryadeepbanerjee.in`
   - **Sender Name**: `Bill Reminder`

### Email Templates
Update the email templates in Supabase with the branded HTML we have generated.

1. Go to **Authentication** > **Email Templates**.
2. For each template type (Confirm Signup, Reset Password, Magic Link, Change Email Address):
   - Replace the default content with the corresponding HTML file located in `supabase/templates/`.
   - Ensure the template uses `{{ .ConfirmationURL }}` for the link href.

### Redirect URLs
1. Go to **Authentication** > **URL Configuration**.
2. Set the **Site URL** (can be your production web URL if you have one, or just `http://localhost:8081` for local web).
3. Under **Redirect URLs**, add the deep-link scheme for the app:
   - `bill-reminder://callback`
   - `exp://*` (Optional: helps during local Expo Go testing, though unreliable for auth)

---

## 2. DNS Configuration (Resend)

To ensure emails from `auth@billreminder.suryadeepbanerjee.in` are delivered successfully and avoid spam folders, you must verify the domain in Resend.

1. Log into your **Resend Dashboard**.
2. Go to **Domains** > **Add Domain**.
3. Enter `billreminder.suryadeepbanerjee.in`.
4. Resend will provide DNS records. Add them to your domain registrar (e.g., Cloudflare, Namecheap, Vercel).
   - **SPF** (TXT record)
   - **DKIM** (TXT records)
   - **DMARC** (TXT record)
5. Wait for Resend to verify the domain (usually takes a few minutes to an hour).

---

## 3. Expo Deep-Linking & Development Build

### The Expo Go Limitation
Expo Go intercepts deep links (like `bill-reminder://`) in a way that is unreliable for Supabase Auth redirect URLs, especially for Magic Links and Password Resets.

### Solution: Development Build
For testing the complete authentication flow (including email verification, magic links, and password resets) on a physical device or simulator, you **must** use an Expo Development Build.

1. Install the `expo-dev-client`:
   ```bash
   npx expo install expo-dev-client
   ```
2. Build the app for your platform:
   - **iOS Simulator**: `npx expo run:ios`
   - **Android Emulator**: `npx expo run:android`
   - **Cloud Build (EAS)**: `eas build --profile development`

Once running in the Development Build, the `bill-reminder://` scheme will correctly route the callback URL back into the `expo-router` system, and `lib/supabase/client.ts` will capture the session.
