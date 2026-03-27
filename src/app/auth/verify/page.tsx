'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Mail, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * This page handles the email magic link callback.
 * Firebase Auth processes the link automatically in the AuthProvider,
 * but this gives the user a nice landing page.
 */
export default function VerifyPage() {
  const router = useRouter();
  const { user, needsUsername, loading } = useAuth();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');

  useEffect(() => {
    // Give auth a moment to process the link
    const timer = setTimeout(() => {
      if (user) {
        setStatus('success');
        // Redirect after a brief pause
        setTimeout(() => {
          if (needsUsername) {
            router.push('/auth/setup-username');
          } else {
            router.push('/');
          }
        }, 1500);
      } else if (!loading) {
        setStatus('error');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [user, loading, needsUsername]);

  return (
    <div className="auth-inputs flex flex-col items-center justify-center min-h-[70vh] px-4 bg-[var(--bg-primary)] text-center">
      {status === 'verifying' && (
        <Card className="glass-card border border-[var(--bg-hover)] bg-[var(--bg-card)] w-full max-w-sm animate-fade-in">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 size={48} className="animate-spin mb-4 text-[var(--accent)] glow-pulse" />
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
              Verifying your email...
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              Hang tight, signing you in.
            </p>
          </CardContent>
        </Card>
      )}

      {status === 'success' && (
        <Card className="glass-card border border-[var(--success)]/30 bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-secondary)] w-full max-w-sm animate-fade-in shadow-lg shadow-[var(--success)]/10">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 p-3 rounded-full bg-[var(--success)]/10 border border-[var(--success)]/30">
              <CheckCircle size={48} className="text-[var(--success)] glow-pulse" />
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
              You&apos;re signed in!
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              Redirecting...
            </p>
          </CardContent>
        </Card>
      )}

      {status === 'error' && (
        <Card className="glass-card border border-[var(--error)]/30 bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-secondary)] w-full max-w-sm animate-fade-in shadow-lg shadow-[var(--error)]/10">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 p-3 rounded-full bg-[var(--error)]/10 border border-[var(--error)]/30">
              <XCircle size={48} className="text-[var(--error)]" />
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
              Verification failed
            </h2>
            <p className="text-sm mb-6 text-[var(--text-muted)]">
              The link may have expired. Try signing in again.
            </p>
            <Button
              onClick={() => router.push('/auth/signin')}
              className="px-6 py-3 rounded-xl text-sm font-semibold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-lg shadow-[var(--accent)]/20 transition-all"
            >
              Back to sign in
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
