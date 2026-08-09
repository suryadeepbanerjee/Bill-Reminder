import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutGrid, Receipt, Settings, Plus, LogOut,
  Check, Users, PanelLeftClose, PanelLeftOpen, ChevronUp,
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
    `flex items-center gap-3 ${sidebarCollapsed ? "justify-center px-2" : "px-3.5"} py-2.5 rounded-input text-sm font-medium transition-all duration-150 ${
      isActive
        ? "bg-accent/10 text-accent border border-accent/20"
        : "text-secondary hover:bg-input hover:text-primary border border-transparent"
    }`;

  return (
    <div className="min-h-screen bg-canvas">
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className={`hidden lg:flex fixed inset-y-0 left-0 ${sidebarCollapsed ? "w-[76px]" : "w-64"} flex-col border-r border-border bg-surface transition-[width] duration-200`}>
        <div className={`flex items-center h-16 border-b border-border ${sidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-5"}`}>
          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
            <img src="/logo-mark.png" alt="Bill Reminder" className="w-8 h-8 object-cover" />
          </div>
          {!sidebarCollapsed && <span className="text-sm font-bold text-primary tracking-tight">Bill Reminder</span>}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={linkClass} end={to === "/app/dashboard"}>
              <Icon size={17} />
              {!sidebarCollapsed && label}
            </NavLink>
          ))}

          <NavLink to="/app/settings/members" className={linkClass}>
            <Users size={17} />
            {!sidebarCollapsed && "Household"}
          </NavLink>

          <NavLink to="/app/settings" className={linkClass} end>
            <Settings size={17} />
            {!sidebarCollapsed && "Settings"}
          </NavLink>
        </nav>

        {/* Household switcher */}
        <div className="px-3 pb-3">
          <div className="rounded-card border border-border bg-input/50 flex flex-col-reverse">
            <button
              type="button"
              onClick={() => setHouseholdOpen((v) => !v)}
              className={`w-full flex items-center gap-2.5 py-3 text-left ${sidebarCollapsed ? "justify-center px-0" : "px-3.5"}`}
            >
              <span className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-[13px] font-bold text-accent shrink-0">
                {(activeHousehold?.household.name[0] ?? "H").toUpperCase()}
              </span>
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold text-primary truncate">
                      {activeHousehold?.household.name ?? "…"}
                    </span>
                  </span>
                  <ChevronUp size={15} className={`text-secondary transition-transform ${householdOpen ? "rotate-180" : ""}`} />
                </>
              )}
            </button>
            {householdOpen && !sidebarCollapsed && (
              <div className="px-2 pt-2 border-b border-border pb-2 space-y-1">
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
        <div className={`px-3 pb-4 border-t border-border pt-3 flex items-center gap-2.5 ${sidebarCollapsed ? "flex-col gap-1.5" : ""}`}>
          <span className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-sm font-bold text-accent shrink-0">
            {displayName[0]?.toUpperCase() ?? "?"}
          </span>
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-primary truncate">{displayName}</p>
              <p className="text-[11px] text-secondary truncate">{profile?.email ?? user?.email ?? ""}</p>
            </div>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            className="p-2 rounded-lg text-secondary hover:bg-error/10 hover:text-error transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setSidebarCollapsed((v) => !v)}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`flex items-center gap-3 ${sidebarCollapsed ? "justify-center w-full px-2" : "px-5"} h-12 border-t border-border text-secondary hover:text-primary hover:bg-input transition-colors text-[13px] font-medium shrink-0`}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          {!sidebarCollapsed && "Collapse sidebar"}
        </button>
      </aside>

      {/* ── Mobile top bar ───────────────────────────────────────────────── */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 bg-canvas/90 backdrop-blur border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg overflow-hidden">
            <img src="/logo-mark.png" alt="Bill Reminder" className="w-7 h-7 object-cover" />
          </div>
          <span className="text-sm font-bold text-primary tracking-tight">Bill Reminder</span>
        </div>
        <div className="flex items-center gap-1">
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
      <main className={`${sidebarCollapsed ? "lg:ml-[76px]" : "lg:ml-64"} pb-20 lg:pb-10 transition-[margin] duration-200`}>
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