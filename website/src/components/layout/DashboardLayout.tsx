import { Navigate, Outlet, useLocation } from "react-router-dom";
import AppShell from "./AppShell";
import { useAuthStore } from "../../stores/auth-store";
import { savePendingPath } from "../../lib/pending-path";

function SplashScreen() {
  return (
    <div className="min-h-screen w-full bg-canvas flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-11 h-11 rounded-xl overflow-hidden">
          <img src="/logo-mark.png" alt="Bill Reminder" className="w-11 h-11 object-cover" />
        </div>
        <div className="w-7 h-7 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
      </div>
    </div>
  );
}

/**
 * Auth-gated app shell.
 * When a signed-out user lands on a protected route, remember where they were
 * heading so sign-in can return them there (deep-link destination preservation).
 */
export default function DashboardLayout({ children }: { children?: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) return <SplashScreen />;
  if (!user) {
    savePendingPath(location);
    return <Navigate to="/sign-in" replace />;
  }

  return <AppShell>{children ?? <Outlet />}</AppShell>;
}