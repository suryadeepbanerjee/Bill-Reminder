# Auth System

## Supabase Auth Configuration

- **double_confirm_changes = true**: Email change requires OTP from BOTH old AND new email
- **flowType**: implicit (no PKCE)
- **Storage**: expo-secure-store (via ExpoSecureStoreAdapter)
- **Auto-refresh**: enabled
- **Session persistence**: enabled

## Auth Store (Zustand)

```typescript
// stores/auth-store.ts
interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isEmailVerified: boolean;
  setSession, setUser, setLoading, setEmailVerified, reset
}
```

- `user.email` is the source of truth for email
- Session stored in SecureStore on device

## Redirect URIs

- **Mobile**: `bill-reminder://callback`
- **Web**: `https://billreminder.suryadeepbanerjee.in/auth/callback`

## Auth Flow

1. User signs up via app or website
2. Supabase sends verification email
3. User clicks link → redirected to `/auth/callback`
4. Callback page handles: email verification, password reset, magic links
5. On success, redirect back to app via deep link

## Household Auto-Create

On first signup, if user has no households:
1. Create household named "{User's Name}'s Household"
2. Add user as admin member
3. Seed default categories from presets
