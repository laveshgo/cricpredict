'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

// Pages that DON'T require a complete profile
const PUBLIC_PATHS = [
  '/auth/signin',
  '/auth/setup-username',
  '/auth/verify',
];

export default function ProfileGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, needsUsername, loading } = useAuth();

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (loading || isPublicPath) return;

    // If user is signed in but needs to complete profile, redirect to setup
    if (user && needsUsername) {
      router.push('/auth/setup-username');
    }
  }, [loading, user, needsUsername, isPublicPath, pathname, router]);

  // Don't gate public paths
  if (isPublicPath) return <>{children}</>;

  // While loading, show spinner
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  // If signed in but profile incomplete, show loading while redirect happens
  if (user && needsUsername) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  return <>{children}</>;
}
