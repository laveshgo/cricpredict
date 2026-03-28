import { Skeleton } from '@/components/ui/skeleton';

export default function TournamentLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      {/* Header card skeleton */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-48 bg-[var(--bg-hover)]" />
          <Skeleton className="h-6 w-20 rounded-full bg-[var(--bg-hover)]" />
        </div>
        <Skeleton className="h-4 w-36 bg-[var(--bg-hover)]" />
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-8 w-14 rounded-full bg-[var(--bg-hover)]" />
          ))}
        </div>
      </div>

      {/* Contest toggle skeleton */}
      <div className="flex gap-2">
        <Skeleton className="flex-1 h-20 rounded-xl bg-[var(--bg-hover)]" />
        <Skeleton className="flex-1 h-20 rounded-xl bg-[var(--bg-hover)]" />
      </div>

      {/* Content skeleton */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg bg-[var(--bg-hover)]" />
        ))}
      </div>
    </div>
  );
}
