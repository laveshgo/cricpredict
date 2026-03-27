import { Skeleton } from '@/components/ui/skeleton';

export default function GroupLoading() {
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      <Skeleton className="h-10 w-64 bg-[var(--bg-hover)]" />
      <Skeleton className="h-5 w-40 bg-[var(--bg-hover)]" />
      <div className="flex gap-2 mt-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-28 rounded-lg bg-[var(--bg-hover)]" />
        ))}
      </div>
      <div className="space-y-3 mt-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg bg-[var(--bg-hover)]" />
        ))}
      </div>
    </div>
  );
}
