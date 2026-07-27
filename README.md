# Bill Reminder

A comprehensive SaaS platform and mobile application to help users manage, track, and pay their bills efficiently.

## Project Structure

This repository is organized as a monorepo with two main independent projects:

### 1. Mobile Application (`/app`)
- **Framework**: React Native with Expo (Expo Router)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **State Management**: Zustand
- **Database/Auth**: Supabase
- **Features**: Push notifications, bill tracking, categories, occurrences generation

To run the mobile application locally:
```bash
cd app
npm install
npx expo start
```

### 2. Landing Website (`/website`)
- **Framework**: React + Vite (TypeScript)
- **Styling**: Custom Design System with Tailwind CSS + CSS Variables
- **Animations**: Framer Motion
- **Features**: Authentication (Sign In, Sign Up, Password Reset, Email Verification Callback), Feature sections, Pricing, FAQ

To run the website locally:
```bash
cd website
npm install
npm run dev
```

## Deployment

### Website (Vercel)
The website is configured to be deployed on Vercel. 
- **Root Directory**: `website`
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
*(All Vercel configurations and routing rules are defined in `website/vercel.json`)*

### Backend (Supabase)
All Edge Functions, database migrations, types, and email templates are located in `/app/supabase`.

## Authentication Flow

Bill Reminder uses Supabase Authentication across both the mobile application and the website. The website's `/auth/callback` page handles all email verification flows, password resets, and magic link logic securely.
