/**
 * App-only icon name mapping: Lucide (DB category icons) → Ionicons
 * (the icon set used by the React Native app).
 *
 * The format/date/currency helpers that used to live here are now in
 * `@shared/utils` — import them from there.
 */

export const LUCIDE_TO_IONICONS: Record<string, string> = {
  "credit-card":  "card-outline",
  "smartphone":   "phone-portrait-outline",
  "wifi":         "wifi-outline",
  "zap":          "flash-outline",
  "droplets":     "water-outline",
  "flame":        "flame-outline",
  "shield":       "shield-outline",
  "calendar":     "calendar-outline",
  "home":         "home-outline",
  "landmark":     "business-outline",
  "tv":           "tv-outline",
  "music":        "musical-notes-outline",
  "cloud":        "cloud-outline",
  "server":       "server-outline",
  "globe":        "globe-outline",
  "book-open":    "book-outline",
  "dumbbell":     "barbell-outline",
  "heart-pulse":  "heart-outline",
  "trending-up":  "trending-up-outline",
  "repeat":       "repeat-outline",
  "layers":       "layers-outline",
};

export function resolveIcon(lucideKey: string): string {
  return LUCIDE_TO_IONICONS[lucideKey] ?? "layers-outline";
}
