// ── Loading skeletons ─────────────────────────────────────────────────────────

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`bg-input animate-pulse rounded-md ${className}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-20" />
      </div>
      <SkeletonBlock className="h-24 rounded-card" />
      <div className="space-y-3">
        <SkeletonBlock className="h-4 w-40" />
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} className="h-16 rounded-card" />
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3 px-4 pt-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface border border-border rounded-card p-4 flex items-center gap-3">
          <SkeletonBlock className="w-10 h-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-3.5 w-32" />
            <SkeletonBlock className="h-3 w-20" />
          </div>
          <SkeletonBlock className="h-3.5 w-14" />
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center py-8 space-y-3">
        <SkeletonBlock className="w-14 h-14 rounded-full" />
        <SkeletonBlock className="h-4 w-40" />
        <SkeletonBlock className="h-8 w-28" />
      </div>
      <SkeletonBlock className="h-11 rounded-input" />
      <div className="space-y-3">
        <SkeletonBlock className="h-4 w-24" />
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} className="h-12 rounded-card" />
        ))}
      </div>
    </div>
  );
}

export default function LoadingSkeleton({ variant = "list", count }: { variant?: "list" | "dashboard" | "detail"; count?: number }) {
  if (variant === "dashboard") return <DashboardSkeleton />;
  if (variant === "detail") return <DetailSkeleton />;
  return <ListSkeleton count={count} />;
}