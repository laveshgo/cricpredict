'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  isValidUsername,
  isUsernameTaken,
  updateUsername,
  updateProfile,
} from '@/lib/auth-helpers';
import {
  User,
  Check,
  X,
  Loader2,
  Save,
  Shield,
  Mail,
  AtSign,
  LogOut,
  Key,
} from 'lucide-react';
import {
  updatePassword,
  EmailAuthProvider,
  linkWithCredential,
  sendPasswordResetEmail,
  verifyBeforeUpdateEmail,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, reloadProfile, signOut } = useAuth();

  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [validationMsg, setValidationMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username);
      setFirstName(profile.firstName || '');
      setLastName(profile.lastName || '');
    }
  }, [profile]);

  // Redirect if not signed in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/signin');
    }
  }, [authLoading, user, router]);

  // Debounced username check (only if changed)
  useEffect(() => {
    if (!profile || username === profile.username) {
      setAvailable(null);
      setValidationMsg('');
      return;
    }

    const validation = isValidUsername(username);
    if (!validation.ok) {
      setValidationMsg(validation.error || '');
      setAvailable(null);
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
  }, [username, profile]);

  const handleSave = async () => {
    if (!user || !profile) return;
    if (!firstName.trim()) {
      setSaveMsg('Error: First name is required');
      return;
    }
    setSaving(true);
    setSaveMsg('');

    try {
      // Update username if changed
      if (username !== profile.username) {
        const validation = isValidUsername(username);
        if (!validation.ok) {
          setSaveMsg('Error: ' + validation.error);
          setSaving(false);
          return;
        }
        if (!available) {
          setSaveMsg('Error: Username is taken');
          setSaving(false);
          return;
        }
        await updateUsername(user.uid, profile.username, username);
      }

      // Update name fields if changed
      const trimmedFirst = firstName.trim();
      const trimmedLast = lastName.trim();
      const newDisplayName = [trimmedFirst, trimmedLast].filter(Boolean).join(' ');

      if (trimmedFirst !== (profile.firstName || '') || trimmedLast !== (profile.lastName || '')) {
        await updateProfile(user.uid, {
          firstName: trimmedFirst,
          lastName: trimmedLast,
          displayName: newDisplayName,
        });
      }

      await reloadProfile();
      setSaveMsg('Profile updated!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err: any) {
      setSaveMsg('Error: ' + (err.message || 'Failed to update'));
    } finally {
      setSaving(false);
    }
  };

  const handleSetPassword = async () => {
    if (!user) return;
    if (newPassword.length < 6) {
      setPasswordMsg('Error: Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg('Error: Passwords do not match');
      return;
    }
    setPasswordSaving(true);
    setPasswordMsg('');
    try {
      const hasPasswordProvider = user.providerData.some(
        (p) => p.providerId === 'password'
      );

      if (hasPasswordProvider) {
        await updatePassword(user, newPassword);
      } else {
        if (!user.email) {
          setPasswordMsg('Error: No email on this account. Add an email first.');
          setPasswordSaving(false);
          return;
        }
        const credential = EmailAuthProvider.credential(user.email, newPassword);
        await linkWithCredential(user, credential);
      }

      setNewPassword('');
      setConfirmPassword('');
      setPasswordMsg('Password set! You can now sign in with username + password.');
      setTimeout(() => setPasswordMsg(''), 5000);
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setPasswordMsg('Error: For security, please sign out and sign in again before setting a password.');
      } else if (err.code === 'auth/provider-already-linked') {
        try {
          await updatePassword(user, newPassword);
          setNewPassword('');
          setConfirmPassword('');
          setPasswordMsg('Password updated!');
          setTimeout(() => setPasswordMsg(''), 5000);
        } catch (innerErr: any) {
          setPasswordMsg('Error: ' + (innerErr.message || 'Failed to update password'));
        }
      } else {
        setPasswordMsg('Error: ' + (err.message || 'Failed to set password'));
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      setPasswordMsg('Password reset email sent to ' + user.email);
      setTimeout(() => setPasswordMsg(''), 5000);
    } catch (err: any) {
      setPasswordMsg('Error: ' + (err.message || 'Failed to send reset email'));
    }
  };

  const hasChanges =
    profile &&
    (username !== profile.username ||
      firstName.trim() !== (profile.firstName || '') ||
      lastName.trim() !== (profile.lastName || ''));

  if (authLoading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={24} className="animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 animate-fade-in">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 gradient-text">
        Profile
      </h1>

      {/* Notification */}
      {saveMsg && (
        <div
          className={`mb-4 px-4 py-2.5 rounded-lg text-sm font-medium animate-fade-in border ${
            saveMsg.startsWith('Error')
              ? 'bg-[var(--error-dim)] text-[var(--error)] border-[var(--error)]/50'
              : 'bg-[var(--success-dim)] text-[var(--success)] border-[var(--success)]/50'
          }`}
        >
          {saveMsg}
        </div>
      )}

      {/* Avatar Card - Premium Glass */}
      <Card className="mb-6 glass-card border border-[var(--bg-elevated)] overflow-hidden glow-card">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Avatar className="w-20 h-20 border-2 border-[var(--accent)] ring-4 ring-[var(--accent)]/20 hover:ring-[var(--accent)]/40 transition-all glow-pulse">
              <AvatarImage src={profile.photoURL || ''} alt={profile.displayName} />
              <AvatarFallback className="bg-gradient-to-br from-[var(--accent)]/40 to-[var(--accent)]/20">
                <User size={32} className="text-[var(--accent)]" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-bold text-[var(--accent)] text-lg">
                @{profile.username}
              </p>
              <p className="text-base font-semibold text-[var(--text-primary)] mt-1">
                {profile.displayName}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-2">
                Joined {new Date(profile.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Form Card */}
      <Card className="glass-card border border-[var(--bg-elevated)]">
        <CardContent className="pt-6 space-y-4">
          {/* First Name + Last Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium uppercase tracking-wide flex items-center gap-1 mb-2 text-[var(--text-secondary)]">
                <User size={12} /> First Name <span className="text-[var(--error)]">*</span>
              </label>
              <Input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={`bg-[var(--bg-primary)] text-[var(--text-primary)] border focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-all ${
                  !firstName.trim() ? 'border-[var(--error)]/50' : 'border-[var(--bg-elevated)]'
                }`}
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide block mb-2 text-[var(--text-secondary)]">
                Last Name
              </label>
              <Input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-elevated)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-all"
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="text-xs font-medium uppercase tracking-wide flex items-center gap-1 mb-2 text-[var(--text-secondary)]">
              <AtSign size={12} /> Username
            </label>
            <div className="relative">
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                maxLength={20}
                className={`bg-[var(--bg-primary)] text-[var(--text-primary)] border pr-10 focus:ring-1 transition-all ${
                  username !== profile.username && (validationMsg || available === false)
                    ? 'border-[var(--error)]/50 focus:border-[var(--error)] focus:ring-[var(--error)]/20'
                    : username !== profile.username && available === true
                    ? 'border-[var(--success)]/50 focus:border-[var(--success)] focus:ring-[var(--success)]/20'
                    : 'border-[var(--bg-elevated)] focus:border-[var(--accent)] focus:ring-[var(--accent)]/20'
                }`}
              />
              {username !== profile.username && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checking && <Loader2 size={14} className="animate-spin text-[var(--text-muted)]" />}
                  {!checking && available === true && (
                    <Check size={14} className="text-[var(--success)] drop-shadow-lg" />
                  )}
                  {!checking && available === false && (
                    <X size={14} className="text-[var(--error)] drop-shadow-lg" />
                  )}
                </div>
              )}
            </div>
            {(validationMsg || (available === false && username !== profile.username)) && (
              <p className="text-xs mt-1 text-[var(--error)]">
                {validationMsg || 'Username is taken'}
              </p>
            )}
          </div>

          {/* Email Section */}
          <div>
            <label className="text-xs font-medium uppercase tracking-wide flex items-center gap-1 mb-2 text-[var(--text-secondary)]">
              <Mail size={12} /> Email
            </label>
            {profile.email ? (
              <div className="space-y-2">
                <div className="px-3 py-2.5 rounded-lg text-sm flex items-center justify-between bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-elevated)]">
                  <span>{profile.email}</span>
                  {profile.emailVerified ? (
                    <Badge className="bg-[var(--success-dim)] text-[var(--success)] text-xs flex items-center gap-1 border-[var(--success)]/50">
                      <Check size={12} /> Verified
                    </Badge>
                  ) : (
                    <Badge className="bg-[var(--warning-dim)] text-[var(--warning)] text-xs border-[var(--warning)]/50">
                      Pending
                    </Badge>
                  )}
                </div>
                {!profile.emailVerified && !changingEmail && (
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (!user) return;
                        setEmailMsg('');
                        try {
                          await verifyBeforeUpdateEmail(user, profile.email);
                          setEmailMsg('Verification email resent! Check your inbox.');
                          setTimeout(() => setEmailMsg(''), 5000);
                        } catch (err: any) {
                          setEmailMsg('Error: ' + (err.message || 'Failed to resend'));
                        }
                      }}
                      className="text-xs text-[var(--text-muted)] h-auto py-1 px-2 underline"
                    >
                      Resend verification
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (!user) return;
                        setEmailMsg('');
                        try {
                          await user.reload();
                          if (user.emailVerified) {
                            await updateProfile(user.uid, { emailVerified: true });
                            await reloadProfile();
                            setEmailMsg('Email verified!');
                            setTimeout(() => setEmailMsg(''), 3000);
                          } else {
                            setEmailMsg('Not verified yet. Click the link in the email we sent you.');
                            setTimeout(() => setEmailMsg(''), 4000);
                          }
                        } catch (err: any) {
                          setEmailMsg('Error: ' + (err.message || 'Failed to check'));
                        }
                      }}
                      className="text-xs text-[var(--accent)] h-auto py-1 px-2 underline"
                    >
                      I&apos;ve verified — check now
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setChangingEmail(true);
                        setNewEmail('');
                        setEmailMsg('');
                      }}
                      className="text-xs text-[var(--error)] h-auto py-1 px-2 underline"
                    >
                      Wrong email? Change it
                    </Button>
                  </div>
                )}
                {!profile.emailVerified && changingEmail && (
                  <div className="space-y-2">
                    <Input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Correct email address"
                      className="bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-elevated)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-all"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={async () => {
                          if (!newEmail.trim() || !user) return;
                          setEmailSaving(true);
                          setEmailMsg('');
                          try {
                            await verifyBeforeUpdateEmail(user, newEmail.trim());
                            await updateProfile(user.uid, { email: newEmail.trim(), emailVerified: false });
                            await reloadProfile();
                            setNewEmail('');
                            setChangingEmail(false);
                            setEmailMsg('Verification sent to new email! Check your inbox.');
                            setTimeout(() => setEmailMsg(''), 5000);
                          } catch (err: any) {
                            if (err.code === 'auth/requires-recent-login') {
                              setEmailMsg('Error: Please sign out and sign in again before changing email.');
                            } else if (err.code === 'auth/email-already-in-use') {
                              setEmailMsg('Error: This email is already used by another account.');
                            } else {
                              setEmailMsg('Error: ' + (err.message || 'Failed to update email'));
                            }
                          } finally {
                            setEmailSaving(false);
                          }
                        }}
                        disabled={emailSaving || !newEmail.trim()}
                        className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white font-semibold disabled:opacity-50 shadow-lg shadow-[var(--accent)]/30 h-8"
                        size="sm"
                      >
                        {emailSaving ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                        {emailSaving ? 'Updating...' : 'Update & verify'}
                      </Button>
                      <Button
                        onClick={() => {
                          setChangingEmail(false);
                          setEmailMsg('');
                        }}
                        variant="outline"
                        size="sm"
                        className="border-[var(--bg-elevated)] text-[var(--text-muted)] bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] h-8"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                {emailMsg && (
                  <div
                    className={`px-3 py-2 rounded-lg text-xs animate-fade-in border ${
                      emailMsg.startsWith('Error')
                        ? 'bg-[var(--error-dim)] text-[var(--error)] border-[var(--error)]'
                        : 'bg-[var(--success-dim)] text-[var(--success)] border-[var(--success)]'
                    }`}
                  >
                    {emailMsg}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-[var(--text-muted)]">
                  Add an email for password recovery.
                </p>
                {emailMsg && (
                  <div
                    className={`px-3 py-2 rounded-lg text-xs animate-fade-in border ${
                      emailMsg.startsWith('Error')
                        ? 'bg-[var(--error-dim)] text-[var(--error)] border-[var(--error)]'
                        : 'bg-[var(--success-dim)] text-[var(--success)] border-[var(--success)]'
                    }`}
                  >
                    {emailMsg}
                  </div>
                )}
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-elevated)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-all"
                />
                <Button
                  onClick={async () => {
                    if (!newEmail.trim() || !user) return;
                    setEmailSaving(true);
                    setEmailMsg('');
                    try {
                      await verifyBeforeUpdateEmail(user, newEmail.trim());
                      await updateProfile(user.uid, { email: newEmail.trim(), emailVerified: false });
                      await reloadProfile();
                      setNewEmail('');
                      setEmailMsg('Verification email sent! Click the link in your inbox to confirm. Once verified, you can use this email to sign in.');
                    } catch (err: any) {
                      if (err.code === 'auth/requires-recent-login') {
                        setEmailMsg('Error: For security, please sign out and sign in again before adding an email.');
                      } else if (err.code === 'auth/email-already-in-use') {
                        setEmailMsg('Error: This email is already used by another account.');
                      } else if (err.code === 'auth/invalid-email') {
                        setEmailMsg('Error: Invalid email address.');
                      } else {
                        setEmailMsg('Error: ' + (err.message || 'Failed to add email'));
                      }
                    } finally {
                      setEmailSaving(false);
                    }
                  }}
                  disabled={emailSaving || !newEmail.trim()}
                  className="w-full bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white font-semibold disabled:opacity-50 shadow-lg shadow-[var(--accent)]/30"
                  size="sm"
                >
                  {emailSaving ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  {emailSaving ? 'Adding...' : 'Add email'}
                </Button>
              </div>
            )}
          </div>

          {/* Auth Provider */}
          <div>
            <label className="text-xs font-medium uppercase tracking-wide flex items-center gap-1 mb-2 text-[var(--text-secondary)]">
              <Shield size={12} /> Signed in via
            </label>
            <div className="px-3 py-2.5 rounded-lg text-sm bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-elevated)]">
              {profile.authProvider === 'google' ? 'Google' : profile.authProvider === 'email' ? 'Email & Password' : 'Username & Password'}
            </div>
          </div>

          {/* Password Section */}
          <div className="pt-4 border-t border-[var(--bg-elevated)]/50">
            <label className="text-xs font-medium uppercase tracking-wide flex items-center gap-1 mb-2 text-[var(--text-secondary)]">
              <Key size={12} /> {user?.providerData.some((p) => p.providerId === 'password') ? 'Change Password' : 'Set Password'}
            </label>
            <p className="text-xs mb-3 text-[var(--text-muted)]">
              {user?.providerData.some((p) => p.providerId === 'password')
                ? 'Update your password for username/email login.'
                : 'Set a password so you can sign in with your username or email.'}
            </p>

            {passwordMsg && (
              <div
                className={`mb-3 px-3 py-2 rounded-lg text-xs animate-fade-in border ${
                  passwordMsg.startsWith('Error')
                    ? 'bg-[var(--error-dim)] text-[var(--error)] border-[var(--error)]/50'
                    : 'bg-[var(--success-dim)] text-[var(--success)] border-[var(--success)]/50'
                }`}
              >
                {passwordMsg}
              </div>
            )}

            <div className="space-y-2">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 chars)"
                className="bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-elevated)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-all"
              />
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
                className="bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-elevated)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 transition-all"
              />
              <Button
                onClick={handleSetPassword}
                disabled={passwordSaving || !newPassword || !confirmPassword}
                className="w-full bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white font-semibold disabled:opacity-50 shadow-lg shadow-[var(--accent)]/30"
              >
                {passwordSaving ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                {passwordSaving ? 'Setting...' : user?.providerData.some((p) => p.providerId === 'password') ? 'Update password' : 'Set password'}
              </Button>
              {user?.email && !user.email.endsWith('@cricpredict.app') && !user.email.endsWith('@noreply.cricpredict.local') && user.providerData.some((p) => p.providerId === 'password') && (
                <Button
                  onClick={handleSendPasswordReset}
                  variant="ghost"
                  className="w-full text-xs text-[var(--text-muted)] h-auto py-1"
                >
                  Or send a password reset email instead
                </Button>
              )}
            </div>
          </div>

          {/* Save Button */}
          {hasChanges && (
            <Button
              onClick={handleSave}
              disabled={saving || !firstName.trim() || (username !== profile.username && (!!validationMsg || available === false))}
              className="w-full mt-4 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white font-semibold disabled:opacity-50 shadow-lg shadow-[var(--accent)]/30"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Sign Out Button */}
      <Button
        onClick={async () => {
          await signOut();
          router.push('/');
        }}
        variant="outline"
        className="w-full mt-6 border-[var(--bg-elevated)] text-[var(--text-muted)] bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] hover:text-[var(--error)]"
      >
        <LogOut size={14} />
        Sign out
      </Button>
    </div>
  );
}
