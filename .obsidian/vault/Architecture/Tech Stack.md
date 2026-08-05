# Tech Stack

```yaml
mobile:
  framework: Expo SDK 54
  react_native: 0.81.5
  router: expo-router 6.0.0
  styling: nativewind 4.2.1 (tailwindcss 3.4.17)
  state: zustand 5.0.0 + @tanstack/react-query 5.62.0
  forms: react-hook-form 7.54.0 + zod 3.24.0
  animations: react-native-reanimated 4.1.1
  gestures: react-native-gesture-handler 2.28.0
  notifications: expo-notifications 0.32.0
  secure_storage: expo-secure-store 15.0.8
  haptics: expo-haptics 15.0.8
  icons: @expo/vector-icons 15.0.3
  auth: @react-native-google-signin/google-signin 16.1.4
  database: @supabase/supabase-js 2.49.0

backend:
  database: Supabase (PostgreSQL)
  auth: Supabase Auth
  edge_functions: Deno
  cron: pg_cron
  email: Resend API
  push: Expo Push API

landing:
  framework: React + Vite
  animations: Framer Motion
  deploy: Vercel
  domain: billreminder.suryadeepbanerjee.in

env:
  mobile:
    - EXPO_PUBLIC_SUPABASE_URL
    - EXPO_PUBLIC_SUPABASE_ANON_KEY
  edge_functions:
    - SUPABASE_URL
    - SUPABASE_SERVICE_ROLE_KEY
    - RESEND_API_KEY
    - CRON_SECRET
```

## Why These Choices

| Choice | Reason |
|--------|--------|
| Expo over bare RN | Fast iteration, OTA updates, managed workflow |
| NativeWind over StyleSheet | Tailwind classes, dark mode, consistent design system |
| Zustand over Redux | Lightweight, no boilerplate, perfect for auth state |
| React Query over SWR | Better mutation support, optimistic updates, query invalidation |
| Supabase over Firebase | PostgreSQL, real RPC, pg_cron, RLS, open source |
| Resend over SendGrid | Modern API, React email support, generous free tier |
| Zod over Yup | TypeScript-first, co-locate with React Hook Form |
