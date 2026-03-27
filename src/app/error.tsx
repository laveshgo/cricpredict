'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="mb-4 text-5xl">⚠️</div>
      <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
        Something went wrong
      </h2>
      <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-md">
        An unexpected error occurred. Please try again.
      </p>
      <Button
        onClick={reset}
        className="bg-[var(--accent)] hover:bg-[var(--accent)] hover:opacity-90 text-white"
      >
        Try again
      </Button>
    </div>
  );
}
