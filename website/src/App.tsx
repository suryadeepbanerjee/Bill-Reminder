import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import Home from "./pages/Home";
import SignIn from "./pages/SignIn";
import SignInCode from "./pages/SignInCode";
import SignUp from "./pages/SignUp";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AuthCallback from "./pages/AuthCallback";
import AuthError from "./pages/AuthError";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";
import AcceptInvite from "./pages/AcceptInvite";
import DashboardLayout from "./components/layout/DashboardLayout";
import DashboardPage from "./pages/dashboard/DashboardPage";
import BillsPage from "./pages/dashboard/BillsPage";
import AddBillPage from "./pages/dashboard/AddBillPage";
import BillDetailPage from "./pages/dashboard/BillDetailPage";
import SettingsPage from "./pages/dashboard/SettingsPage";
import ProfilePage from "./pages/dashboard/ProfilePage";
import MembersPage from "./pages/dashboard/MembersPage";
import { ThemeProvider } from "./components/ThemeProvider";
import { ToastProvider } from "./components/ui/Toast";
import { ConfirmProvider } from "./components/ui/Confirm";
import { useAuthStore } from "./stores/auth-store";
import { useAuth } from "./hooks/useAuth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry:     1,
    },
  },
});

/** Applies the stored theme, but keeps the landing page (`/`) permanently dark. */
function RouteAwareTheme({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return <ThemeProvider forceDark={pathname === "/"}>{children}</ThemeProvider>;
}

/** Restores the Supabase session once for the whole app (needed on public pages too). */
function SessionSync() {
  useAuth();
  return null;
}

/** Redirects authenticated users away from public pages (e.g. `/` and auth). */
function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return null;
  if (user) return <Navigate to="/app/dashboard" replace />;
  return <>{children}</>;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: "instant" }); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <RouteAwareTheme>
          <ToastProvider>
            <ConfirmProvider>
              <SessionSync />
              <ScrollToTop />
              <Analytics />
              <Routes>
                {/* Public / landing */}
                <Route path="/" element={<RedirectIfAuthed><Home /></RedirectIfAuthed>} />
                <Route path="/sign-in" element={<RedirectIfAuthed><SignIn /></RedirectIfAuthed>} />
                <Route path="/sign-in-code" element={<RedirectIfAuthed><SignInCode /></RedirectIfAuthed>} />
                <Route path="/sign-up" element={<RedirectIfAuthed><SignUp /></RedirectIfAuthed>} />
                <Route path="/forgot-password" element={<RedirectIfAuthed><ForgotPassword /></RedirectIfAuthed>} />

                {/* Auth flows — never redirected */}
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/auth/error" element={<AuthError />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/accept-invite" element={<AcceptInvite />} />

                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<Terms />} />

                {/* Protected dashboard */}
                <Route path="/app" element={<DashboardLayout />}>
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="bills" element={<BillsPage />} />
                  <Route path="add-bill" element={<AddBillPage />} />
                  <Route path="bill/:id" element={<BillDetailPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="settings/profile" element={<ProfilePage />} />
                  <Route path="settings/members" element={<MembersPage />} />
                </Route>

                {/* Deep link — canonical bill URL. Same guard/shell as /app;
                    signed-out users are sent to sign-in and returned here. */}
                <Route
                  path="/bill/:id"
                  element={
                    <DashboardLayout>
                      <BillDetailPage />
                    </DashboardLayout>
                  }
                />

                {/* 404 — must be last */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ConfirmProvider>
          </ToastProvider>
        </RouteAwareTheme>
      </BrowserRouter>
    </QueryClientProvider>
  );
}