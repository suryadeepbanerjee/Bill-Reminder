import { View, Text } from "react-native";
import { OccurrenceState } from "@shared/types";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../lib/theme";

interface BillStateChipProps {
  state: OccurrenceState;
  /** Custom label override — e.g. "3 days overdue" from formatOverdueLabel */
  label?: string;
}

const stateConfig: Record<OccurrenceState, {
  icon:    keyof typeof Ionicons.glyphMap;
  color:   string;
  bg:      string;
  label:   string;
}> = {
  upcoming:         { icon: "time-outline",             color: Colors.neutral[500], bg: "bg-neutral-100 dark:bg-neutral-800", label: "Upcoming"         },
  generated:        { icon: "time-outline",             color: Colors.sky[600],     bg: "bg-sky-50 dark:bg-sky-950",          label: "Generated"        },
  expected_payment: { icon: "calendar-outline",         color: Colors.sky[600],     bg: "bg-sky-50 dark:bg-sky-950",          label: "Pay soon"         },
  due_today:        { icon: "alert-outline",            color: Colors.amber[600],   bg: "bg-amber-50 dark:bg-amber-950",      label: "Due today"        },
  overdue:          { icon: "warning-outline",          color: Colors.amber[700],   bg: "bg-amber-50 dark:bg-amber-950",      label: "Overdue"          },
  paid:             { icon: "checkmark-circle-outline", color: Colors.emerald[600], bg: "bg-emerald-50 dark:bg-emerald-950",  label: "Paid"             },
  archived:         { icon: "archive-outline",          color: Colors.neutral[400], bg: "bg-neutral-100 dark:bg-neutral-800", label: "Archived"         },
};

export function BillStateChip({ state, label }: BillStateChipProps) {
  const cfg = stateConfig[state];
  const displayLabel = label ?? cfg.label;

  return (
    <View
      className={`flex-row items-center gap-1 px-2 py-1 rounded-pill self-start ${cfg.bg}`}
      accessibilityRole="text"
      accessibilityLabel={displayLabel}
    >
      <Ionicons name={cfg.icon} size={12} color={cfg.color} />
      <Text style={{ color: cfg.color }} className="text-caption font-medium">
        {displayLabel}
      </Text>
    </View>
  );
}
