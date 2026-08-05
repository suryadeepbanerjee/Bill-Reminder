import CategoryIconBadge from "./CategoryIconBadge";

interface CategoryPillProps {
  name:  string;
  icon:  string;
  color: string;
  size?: number;
}

export default function CategoryPill({ name, icon, color, size = 22 }: CategoryPillProps) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-input border border-border">
      <CategoryIconBadge icon={icon} color={color} size={size} />
      <span className="text-xs font-medium text-secondary">{name}</span>
    </span>
  );
}