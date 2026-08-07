import {
  CreditCard, Smartphone, Wifi, Zap, Droplets, Flame, Shield, Calendar, Home,
  Landmark, Tv, Music, Cloud, Server, Globe, BookOpen, Dumbbell, HeartPulse,
  TrendingUp, Repeat, Layers, type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  "credit-card":  CreditCard,
  "smartphone":   Smartphone,
  "wifi":         Wifi,
  "zap":          Zap,
  "droplets":     Droplets,
  "flame":        Flame,
  "shield":       Shield,
  "calendar":     Calendar,
  "home":         Home,
  "landmark":     Landmark,
  "tv":           Tv,
  "music":        Music,
  "cloud":        Cloud,
  "server":       Server,
  "globe":        Globe,
  "book-open":    BookOpen,
  "dumbbell":     Dumbbell,
  "heart-pulse":  HeartPulse,
  "trending-up":  TrendingUp,
  "repeat":       Repeat,
  "layers":       Layers,
};

export function resolveIcon(lucideKey: string): LucideIcon {
  return ICON_MAP[lucideKey] ?? Layers;
}

interface CategoryIconBadgeProps {
  icon:  string;
  color: string;
  size?: number;
}

export default function CategoryIconBadge({ icon, color, size = 40 }: CategoryIconBadgeProps) {
  const Icon = resolveIcon(icon);
  return (
    <div
      className="flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        backgroundColor: `${color}1f`,
      }}
      aria-hidden
    >
      <Icon
        size={Math.round(size * 0.45)}
        className="text-[var(--icon-color)] [.dark_&]:!text-[var(--color-primary)]"
        style={{ "--icon-color": color } as React.CSSProperties}
      />
    </div>
  );
}