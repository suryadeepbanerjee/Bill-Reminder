import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useHouseholdStore } from "../../stores/household-store";
import { useToast } from "./Toast";

export default function FAB({ label = "Add bill", to = "/app/add-bill" }: { label?: string; to?: string }) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  return (
    <button
      type="button"
      onClick={() => {
        const role = useHouseholdStore.getState().activeHousehold?.member.role;
        if (role === "member") {
          showToast("You are a member of this group, you cannot perform this action.", "error");
          return;
        }
        navigate(to);
      }}
      className="fixed bottom-20 lg:bottom-8 right-4 sm:right-6 z-40 inline-flex items-center gap-2 pl-4 pr-5 h-12 rounded-pill bg-accent text-accent-text shadow-fab hover:bg-accent-hover transition-all duration-150 active:scale-95"
    >
      <Plus size={20} strokeWidth={2.5} />
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}