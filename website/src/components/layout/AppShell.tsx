import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutGrid, Receipt, Settings, Plus, LogOut, ChevronDown,
  Check, Users, Bell,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth-store";
import { useHousehold } from "../../hooks/useHousehold";
import { useProfile } from "../../hooks/useProfile";
import { useToast } from "../ui/Toast";
import { useConfirm } from "../ui/Confirm";

const NAV = [
  { to: "/app/dashboard", label: "Dashboard", Icon: LayoutGrid },
  { to: "/app/bills",     label: "Bills",     Icon: Receipt },
];

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const { user } = useAuthStore();
  const { households, activeHousehold, setActiveHousehold } = useHousehold();
  const { data: profile } = useProfile();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const [householdOpen, setHouseholdOpen] = useState(false);

  const displayName = profile?.display_name ?? user?.email?.split("@")[0] ?? "Your account";

  const handleSignOut = async () => {
    const ok = await confirm({
      title: "Sign out",
      message: "Are you sure you want to sign out?",
      confirmLabel: "Sign out",
      destructive: true,
    });
    if (!ok) return;
    await supabase.auth.signOut();
    navigate("/");
  };

  const switchHousehold = (id: string) => {
    const h = households.find((x) => x.household.id === id);
    if (h) setActiveHousehold(h);
    setHouseholdOpen(false);
    navigate("/app/dashboard");
    showToast(`Switched to ${h!.household.name}`);
  };

  const linkClass = ({ isActive }: { isActive: boolean }): string =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-input text-sm font-medium transition-all duration-150 ${
      isActive
        ? "bg-accent/10 text-accent border border-accent/20"
        : "text-secondary hover:bg-input hover:text-primary border border-transparent"
    }`;

  return (
    <div className="min-h-screen bg-canvas">
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-border bg-surface">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M9 2C6.79 2 5 3.68 5 5.75V11H13V5.75C13 3.68 11.21 2 9 2Z" fill="white"/>
              <rect x="4" y="10.5" width="10" height="1.25" rx="0.625" fill="white"/>
              <circle cx="9" cy="13.5" r="1.2" fill="white"/>
            </svg>
          </div>
          <span className="text-sm font-bold text-primary tracking-tight">Bill Reminder</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={linkClass} end={to === "/app/dashboard"}>
              <Icon size={17} />
              {label}
            </NavLink>
          ))}

          <NavLink to="/app/settings/members" className={linkClass}>
            <Users size={17} />
            Household
          </NavLink>
        </nav>

        {/* Household switcher */}
        <div className="px-3 pb-3">
          <div className="rounded-card border border-border bg-input/50">
            <button
              type="button"
              onClick={() => setHouseholdOpen((v) => !v)}
              className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left"
            >
              <span className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-[13px] font-bold text-accent shrink-0">
                {(activeHousehold?.household.name[0] ?? "H").toUpperCase()}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-semibold text-primary truncate">
                  {activeHousehold?.household.name ?? "…"}
                </span>
              </span>
              <ChevronDown size={15} className={`text-secondary transition-transform ${householdOpen ? "rotate-180" : ""}`} />
            </button>
            {householdOpen && (
              <div className="px-2 pb-2 border-t border-border pt-2 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-secondary px-2 pb-1">
                  Your Households
                </p>
                {households.map((h) => (
                  <button
                    key={h.household.id}
                    type="button"
                    onClick={() => switchHousehold(h.household.id)}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-[13px] transition-colors ${
                      activeHousehold?.household.id === h.household.id
                        ? "bg-accent/10 text-accent font-semibold"
                        : "text-primary hover:bg-input"
                    }`}
                  >
                    <span>{h.household.name}</span>
                    <span className="ml-auto">
                      {activeHousehold?.household.id === h.household.id && <Check size={15} className="text-accent" />}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setHouseholdOpen(false);
                    navigate("/app/settings/members");
                  }}
                  className="w-full text-left px-2 py-2 text-[13px] font-semibold text-accent hover:bg-input rounded-md transition-colors"
                >
                  + New household
                </button>
              </div>
            )}
          </div>
        </div>

        {/* User row + sign out */}
        <div className="px-3 pb-4 border-t border-border pt-3 flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-sm font-bold text-accent shrink-0">
            {displayName[0]?.toUpperCase() ?? "?"}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-primary truncate">{displayName}</p>
            <p className="text-[11px] text-secondary truncate">{profile?.email ?? user?.email ?? ""}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            className="p-2 rounded-lg text-secondary hover:bg-error/10 hover:text-error transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ───────────────────────────────────────────────── */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 bg-canvas/90 backdrop-blur border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
              <path d="M9 2C6.79 2 5 3.68 5 5.75V11H13V5.75C13 3.68 11.21 2 9 2Z" fill="white"/>
              <rect x="4" y="10.5" width="10" height="1.25" rx="0.625" fill="white"/>
              <circle cx="9" cy="13.5" r="1.2" fill="white"/>
            </svg>
          </div>
          <span className="text-sm font-bold text-primary tracking-tight">Bill Reminder</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate("/app/settings")}
            className="p-2 rounded-lg text-secondary"
            aria-label="Settings"
          >
            <Settings size={19} />
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="p-2 rounded-lg text-secondary"
            aria-label="Sign out"
          >
            <LogOut size={19} />
          </button>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <main className="lg:ml-64 pb-20 lg:pb-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 lg:py-8">
          {children}
        </div>
      </main>

      {/* ── Mobile bottom nav ───────────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-canvas/95 backdrop-blur border-t border-border flex items-stretch">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} end={to === "/app/dashboard"}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-1 py-2.5 ${
                isActive ? "text-accent" : "text-secondary"
              }`
            }
          >
            <Icon size={20} />
            <span className="text-[10px] font-semibold tracking-wide">{label}</span>
          </NavLink>
        ))}
        <NavLink to="/app/settings" end
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-1 py-2.5 ${
              isActive ? "text-accent" : "text-secondary"
            }`
          }
        >
          <Settings size={20} />
          <span className="text-[10px] font-semibold tracking-wide">Settings</span>
        </NavLink>
      </nav>
    </div>
  );
}