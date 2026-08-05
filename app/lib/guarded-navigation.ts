/**
 * Central navigation guard — patches expo-router's imperative routing queue
 * exactly once at import time.
 *
 * WHY the routing queue: every navigation in expo-router funnels through
 * `routingQueue.add(...)` — `router.push / navigate / replace / back /
 * dismiss / dismissAll`, the `<Link>` component, and `<Redirect>` all land
 * here. Guarding this ONE function covers every navigation call site —
 * existing and future — with zero per-button code.
 *
 * The guard key is derived from the QUEUED ACTION, not the caller:
 * `nav:<type>:<resolved-screen>:<params>`. Consequences:
 *  - rapid taps on the same destination are deduped (same key),
 *  - the same target reached from DIFFERENT entry points (row tap + row CTA,
 *    FAB + empty-state button) is deduped too,
 *  - different destinations (`/bill/1` vs `/bill/2`) never block each other,
 *  - the guard is silent — press feedback behaves normally, only the
 *    navigation is deduped (600ms cooldown, no visible lockout).
 *
 * In-flight locks are released by the root layout on every route change
 * (screen blur), so the guard never leaks or sticks.
 *
 * Import this module once from the root layout (side-effect import).
 */

import { routingQueue } from "expo-router/build/global-state/routing";
import { tryAcquireAction, releaseAction } from "./action-guard";

const NAV_COOLDOWN_MS = 600;

interface QueueAction {
  type: string;
  payload?: {
    name?: string;
    params?: unknown;
    count?: number;
  };
}

function actionKey(action: QueueAction): string | null {
  switch (action.type) {
    case "GO_BACK":    return "nav:back";
    case "POP":        return `nav:dismiss:${action.payload?.count ?? 1}`;
    case "POP_TO_TOP": return "nav:dismiss-all";
    default: {
      const { name, params } = action.payload ?? {};
      if (!name) return null;
      return `nav:${action.type.toLowerCase()}:${name}:${JSON.stringify(params ?? {})}`;
    }
  }
}

const originalAdd = routingQueue.add;

routingQueue.add = (action) => {
  const key = actionKey(action as unknown as QueueAction);
  if (!key) {
    originalAdd(action);
    return;
  }
  if (!tryAcquireAction(key, NAV_COOLDOWN_MS)) return;
  try {
    originalAdd(action);
  } finally {
    releaseAction(key);
  }
};
