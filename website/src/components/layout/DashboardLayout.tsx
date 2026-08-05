import { Navigate, Outlet } from "react-router-dom";
import AppShell from "./AppShell";
import { useAuthStore } from "../../stores/auth-store";

function SplashScreen() {
  return (
    <div className="min-h-screen w-full bg-canvas flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-11 h-11 rounded-xl overflow-hidden">
          <img src="/fevicon.png" alt="Bill Reminder" className="w-11 h-11 object-cover" />
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