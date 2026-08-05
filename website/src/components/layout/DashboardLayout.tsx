import { Navigate, Outlet } from "react-router-dom";
import AppShell from "./AppShell";
import { useAuthStore } from "../../stores/auth-store";

function SplashScreen() {
  return (
    <div className="min-h-screen w-full bg-canvas flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-accent flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
            <path d="M9 2C6.79 2 5 3.68 5 5.75V11H13V5.75C13 3.68 11.21 2 9 2Z" fill="var(--color-accent-text)"/>
            <rect x="4" y="10.5" width="10" height="1.25" rx="0.625" fill="var(--color-accent-text)"/>
            <circle cx="9" cy="13.5" r="1.2" fill="var(--color-accent-text)"/>
          </svg>
        </div>
        <div className="w-7 h-7 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
      </div>
    </div>
  );
}

export default function DashboardLayout() {
  const { user, isLoading } = useAuthStore();

  if (isLoading) return <SplashScreen />;
  if (!user) return <Navigate to="/sign-in" replace />;

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}