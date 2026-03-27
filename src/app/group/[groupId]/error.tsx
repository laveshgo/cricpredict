'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function GroupError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Group page error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="mb-4 text-5xl">⚠️</div>
      <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
        Failed to load group
      </h2>
      <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-md">
        The group may not exist or you may not have access.
      </p>
      <div className="flex gap-3">
        <Button
          onClick={reset}
          className="bg-[var(--accent)] hover:bg-[var(--accent)] hover:opacity-90 text-white"
        >
          Try again
        </Button>
        <Link href="/">
          <Button variant="outline" className="border-[var(--border)] text-[var(--text-secondary)]">
            Go home
          </Button>
        </Link>
      </div>
    </div>
  );
}
