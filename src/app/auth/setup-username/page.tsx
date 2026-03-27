'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { isValidUsername, isUsernameTaken, createProfile } from '@/lib/auth-helpers';
import type { UserProfile } from '@/types';
import { User, Check, X, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function SetupUsernamePage() {
  const router = useRouter();
  const { user, profile, needsUsername, loading: authLoading, reloadProfile } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [validationMsg, setValidationMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [firstNameTouched, setFirstNameTouched] = useState(false);

  // Pre-fill from localStorage (username signup flow) or from Google display name
  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;

    const pendingUsername = window.localStorage.getItem('pendingUsername');
    const pendingEmail = window.localStorage.getItem('pendingEmail');

    if (pendingUsername) {
      setUsername(pendingUsername);
      // Clean up
      window.localStorage.removeItem('pendingUsername');
      window.localStorage.removeItem('pendingEmail');
      return;
    }

    // For Google/email signups, pre-fill name and suggest username
    if (user.displayName) {
      const parts = user.displayName.trim().split(/\s+/);
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');

      // Auto-suggest a username from display name
      if (!username) {
        const suggested = user.displayName
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '')
          .slice(0, 20);
        if (suggested.length >= 3) {
          setUsername(suggested);
        }
      }
    }
  }, [user]);

  // Redirect if not needed
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/signin');
    }
    if (!authLoading && user && !needsUsername && profile?.username && profile?.firstName) {
      router.push('/');
    }
  }, [authLoading, user, needsUsername, profile, router]);

  // Auto-suggest username when first/last name changes (only for email/Google signups who don't have a pending username)
  useEffect(() => {
    // Don't overwrite if user already typed a username manually
    if (!firstName) return;

    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    const suggested = fullName
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 20);

    // Only auto-suggest if the current username is empty or was previously auto-generated
    if (suggested.length >= 3) {
      setUsername((prev) => {
        // If the field is empty, or the previous value looks auto-generated from the name, update it
        if (!prev || prev === suggested) return suggested;
        // Check if previous value was an auto-suggestion (derived from some version of the name)
        const prevFromName = [firstName, lastName].filter(Boolean).join(' ')
          .toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 20);
        if (prev === prevFromName) return suggested;
        return prev; // User has manually edited, don't overwrite
      });
    }
  }, [firstName, lastName]);

  // Debounced username availability check
  useEffect(() => {
    setAvailable(null);
    const validation = isValidUsername(username);
    if (!validation.ok) {
      setValidationMsg(validation.error || '');
      return;
    }
    setValidationMsg('');

    const timer = setTimeout(async () => {
      setChecking(true);
      try {
        const taken = await isUsernameTaken(username);
        setAvailable(!taken);
      } catch {
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = async () => {
    if (!firstName.trim()) {
      setError('First name is required');
      setFirstNameTouched(true);
      return;
    }
    const validation = isValidUsername(username);
    if (!validation.ok) {
      setError(validation.error || 'Invalid username');
      return;
    }
    if (!available) {
      setError('Username is taken. Pick a different one.');
      return;
    }
    if (!user) return;

    setSaving(true);
    setError('');
    try {
      // Determine real email (ignore placeholder domains)
      const firebaseEmail = user.email || '';
      const isPlaceholderEmail = firebaseEmail.endsWith('@cricpredict.app') || firebaseEmail.endsWith('@noreply.cricpredict.local');
      const realEmail = isPlaceholderEmail ? '' : firebaseEmail;

      // Determine auth provider
      const providerId = user.providerData[0]?.providerId;
      const authProvider = providerId === 'google.com' ? 'google' as const
        : isPlaceholderEmail ? 'username' as const
        : 'email' as const;

      const trimmedFirst = firstName.trim();
      const trimmedLast = lastName.trim();
      const displayName = [trimmedFirst, trimmedLast].filter(Boolean).join(' ');

      const newProfile: UserProfile = {
        uid: user.uid,
        username: username.toLowerCase(),
        firstName: trimmedFirst,
        lastName: trimmedLast,
        displayName,
        email: realEmail,
        emailVerified: isPlaceholderEmail ? false : (user.emailVerified || false),
        ...(user.photoURL ? { photoURL: user.photoURL } : {}),
        authProvider,
        createdAt: new Date().toISOString(),
      };
      await createProfile(newProfile);
      await reloadProfile();
      router.push('/');
    } catch (err: any) {
      if (err.message?.includes('already taken')) {
        setError('Username was just taken. Pick another one.');
        setAvailable(false);
      } else {
        setError(err.message || 'Failed to create profile');
      }
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={24} className="animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="auth-inputs flex flex-col items-center justify-center min-h-[70vh] px-4 bg-[var(--bg-primary)]">
      <div className="w-full max-w-md">
        <Card className="glass-card border border-[var(--bg-hover)] bg-[var(--bg-card)]">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-6">
              <div className="relative w-20 h-20 flex items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-cyan-500 border-2 border-[var(--accent)]/50 shadow-lg shadow-[var(--accent)]/30 glow-pulse">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="w-20 h-20 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User size={32} className="text-white" />
                )}
              </div>
            </div>
            <CardTitle className="text-2xl font-bold gradient-text mb-2">
              Complete your profile
            </CardTitle>
            <CardDescription className="text-sm text-[var(--text-muted)]">
              Choose a display name and username.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {error && (
              <Badge variant="destructive" className="w-full px-4 py-3 h-auto rounded-xl bg-[var(--error-dim)] text-[var(--error)] border border-[var(--error)]">
                {error}
              </Badge>
            )}

            {/* First Name + Last Name side by side */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-semibold block mb-2 text-[var(--text-secondary)] uppercase tracking-wide">
                  First Name <span className="text-[var(--error)]">*</span>
                </label>
                <Input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  onBlur={() => setFirstNameTouched(true)}
                  placeholder="First name"
                  autoFocus
                  className={`bg-[var(--bg-primary)] text-[var(--text-primary)] border rounded-lg focus:outline-none focus:ring-1 transition-all ${
                    firstNameTouched && !firstName.trim()
                      ? 'border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]/20'
                      : 'border-[var(--bg-hover)] focus:border-[var(--accent)] focus:ring-[var(--accent)]/20'
                  }`}
                />
                {firstNameTouched && !firstName.trim() && (
                  <p className="text-xs mt-1 text-[var(--error)]">Required</p>
                )}
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold block mb-2 text-[var(--text-secondary)] uppercase tracking-wide">
                  Last Name
                </label>
                <Input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-hover)] rounded-lg focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all"
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="text-xs font-semibold block mb-2 text-[var(--text-secondary)] uppercase tracking-wide">
                Username <span className="text-[var(--error)]">*</span>
              </label>
              <div className="relative">
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="pick_a_username"
                  maxLength={20}
                  className={`pr-10 bg-[var(--bg-primary)] text-[var(--text-primary)] border rounded-lg focus:outline-none focus:ring-1 transition-all ${
                    validationMsg
                      ? 'border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]/20'
                      : available === true
                      ? 'border-[var(--success)] focus:border-[var(--success)] focus:ring-[var(--success)]/20 shadow-lg shadow-[var(--success)]/10'
                      : available === false
                      ? 'border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]/20'
                      : 'border-[var(--bg-hover)] focus:border-[var(--accent)] focus:ring-[var(--accent)]/20'
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checking && <Loader2 size={14} className="animate-spin text-[var(--text-muted)]" />}
                  {!checking && available === true && <Check size={14} className="text-[var(--success)] glow-pulse" />}
                  {!checking && available === false && <X size={14} className="text-[var(--error)]" />}
                </div>
              </div>
              <p className={`text-xs mt-2 ${validationMsg || available === false ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'}`}>
                {validationMsg || (available === false ? 'Username is taken' : available === true ? 'Available!' : '3-20 chars: letters, numbers, underscores')}
              </p>
            </div>

            {/* Email display — hide placeholder emails */}
            {user?.email && !user.email.endsWith('@cricpredict.app') && !user.email.endsWith('@noreply.cricpredict.local') && (
              <div>
                <label className="text-xs font-semibold block mb-2 text-[var(--text-secondary)] uppercase tracking-wide">
                  Email
                </label>
                <div className="px-4 py-3 rounded-lg text-sm flex items-center justify-between bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--bg-hover)] glass-card">
                  <span>{user.email}</span>
                  {user.emailVerified && (
                    <span className="text-xs flex items-center gap-1 text-[var(--success)]">
                      <Check size={12} /> Verified
                    </span>
                  )}
                </div>
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={saving || !available || !!validationMsg || !firstName.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold h-auto bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-lg shadow-[var(--accent)]/20 transition-all mt-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {saving ? 'Creating...' : 'Continue'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
