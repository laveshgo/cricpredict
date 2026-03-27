'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { isValidUsername } from '@/lib/auth-helpers';
import { Trophy, Mail, User, Key, ArrowRight, Loader2, AtSign } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

type Mode = 'choose' | 'username-login' | 'username-signup' | 'email-password' | 'email-otp';
type EmailMode = 'signin' | 'signup';

export default function SignInPage() {
  const router = useRouter();
  const {
    user,
    needsUsername,
    signInWithGoogle,
    signInWithUsernamePassword,
    signUpWithUsername,
    signUpWithEmailPassword,
    sendEmailOTP,
    forgotPasswordByUsername,
  } = useAuth();

  const [mode, setMode] = useState<Mode>('choose');
  const [emailMode, setEmailMode] = useState<EmailMode>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resetSent, setResetSent] = useState('');

  // Username format validation (no Firestore check here — user isn't authed yet)
  const [validationMsg, setValidationMsg] = useState('');

  useEffect(() => {
    if (mode !== 'username-signup') return;
    if (!username) {
      setValidationMsg('');
      return;
    }
    const validation = isValidUsername(username);
    setValidationMsg(validation.ok ? '' : (validation.error || ''));
  }, [username, mode]);

  // Redirect if already signed in
  useEffect(() => {
    if (user && !needsUsername) {
      router.push('/');
    } else if (user && needsUsername) {
      router.push('/auth/setup-username');
    }
  }, [user, needsUsername, router]);

  // Don't render the form while redirecting
  if (user) return null;

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err.code === 'auth/account-exists-with-different-credential') {
        setError('An account with this email already exists using a different sign-in method. Try signing in with email & password or email link instead.');
      } else {
        setError(err.message || 'Google sign-in failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameLogin = async () => {
    if (!username.trim() || !password) {
      setError('Username and password are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signInWithUsernamePassword(username.trim(), password);
    } catch (err: any) {
      if (err.message === 'Username not found') {
        setError('Username not found. Check spelling or create a new account.');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Wrong password. If you signed up with Google or email link, you may not have set a password yet. Sign in with that method first, then set a password in your profile.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Try again later or reset your password.');
      } else {
        setError(err.message || 'Sign-in failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameSignup = async () => {
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (validationMsg) {
      setError(validationMsg);
      return;
    }

    setLoading(true);
    setError('');
    try {
      await signUpWithUsername(username.trim(), password, email.trim() || undefined);
      // Profile is created inline, auth state change will redirect to home
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Try signing in instead.');
      } else if (err.message?.includes('already taken')) {
        setError('Username was just taken. Pick another one on the next step.');
      } else {
        setError(err.message || 'Signup failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailPassword = async () => {
    if (!email.trim() || !password) {
      setError('Email and password are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (emailMode === 'signup') {
        await signUpWithEmailPassword(email.trim(), password);
        // Will redirect to username setup via needsUsername
      } else {
        const { signInWithEmailAndPassword } = await import('firebase/auth');
        const { auth } = await import('@/lib/firebase');
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError('No account with this email. Sign up instead?');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Wrong password. If you signed up with Google or email link, you may not have a password set. Try those methods, or use "Forgot password?".');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Email already registered. Try signing in, or use a different sign-in method.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password must be at least 6 characters.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Try again later or reset your password.');
      } else {
        setError(err.message || 'Failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailOTP = async () => {
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await sendEmailOTP(email.trim());
      setOtpSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send sign-in link');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordByUsername = async () => {
    if (!username.trim()) {
      setError('Enter your username first, then click forgot password.');
      return;
    }
    setLoading(true);
    setError('');
    setResetSent('');
    try {
      const maskedEmail = await forgotPasswordByUsername(username.trim());
      setResetSent(maskedEmail);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setError('');
    setResetSent('');
    setValidationMsg('');
  };

  return (
    <div className="auth-inputs flex flex-col items-center justify-center min-h-[80vh] px-4 bg-[var(--bg-primary)]">
      <div className="w-full max-w-sm">
        {/* Logo Section */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <div className="relative w-16 h-16 flex items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-cyan-500 shadow-lg shadow-[var(--accent)]/30">
              <Trophy size={32} className="text-white relative z-10" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text mb-2">CricPredict</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Sign in to predict & compete
          </p>
        </div>

        {/* Error */}
        {error && (
          <Badge variant="destructive" className="mb-4 w-full px-4 py-3 h-auto rounded-xl animate-fade-in bg-[var(--error-dim)] text-[var(--error)] border border-[var(--error)]">
            {error}
          </Badge>
        )}

        {/* Success message for password reset */}
        {resetSent && (
          <Badge className="mb-4 w-full px-4 py-3 h-auto rounded-xl animate-fade-in bg-[var(--success-dim)] text-[var(--success)] border border-[var(--success)]">
            Password reset email sent to {resetSent}! Check your inbox.
          </Badge>
        )}

        {/* =================== CHOOSE METHOD =================== */}
        {mode === 'choose' && (
          <div className="space-y-3 animate-fade-in">
            {/* Google */}
            <Button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 h-auto px-4 py-3 rounded-xl text-sm font-semibold bg-white hover:shadow-lg hover:shadow-white/20 hover:bg-gray-50 text-gray-900 transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2a10.341 10.341 0 00-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
              Continue with Google
            </Button>

            <div className="flex items-center gap-3 my-4">
              <Separator className="flex-1 bg-[var(--accent-dim)]" />
              <span className="text-xs text-[var(--text-muted)]">or</span>
              <Separator className="flex-1 bg-[var(--accent-dim)]" />
            </div>

            {/* Username + Password */}
            <Button
              onClick={() => switchMode('username-login')}
              variant="outline"
              className="w-full glass-card flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium h-auto bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--bg-hover)] hover:border-[var(--accent)] hover:shadow-lg hover:shadow-[var(--accent)]/10 transition-all duration-300"
            >
              <User size={16} className="text-[var(--accent)]" />
              Sign in with Username
            </Button>

            {/* Email + Password */}
            <Button
              onClick={() => { switchMode('email-password'); setEmailMode('signin'); }}
              variant="outline"
              className="w-full glass-card flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium h-auto bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--bg-hover)] hover:border-[var(--accent)] hover:shadow-lg hover:shadow-[var(--accent)]/10 transition-all duration-300"
            >
              <Key size={16} className="text-[var(--accent)]" />
              Sign in with Email & Password
            </Button>

            {/* Email OTP / Magic Link */}
            <Button
              onClick={() => switchMode('email-otp')}
              variant="outline"
              className="w-full glass-card flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium h-auto bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--bg-hover)] hover:border-[var(--accent)] hover:shadow-lg hover:shadow-[var(--accent)]/10 transition-all duration-300"
            >
              <Mail size={16} className="text-[var(--accent)]" />
              Sign in with Email Link (no password)
            </Button>
          </div>
        )}

        {/* =================== USERNAME + PASSWORD (LOGIN) =================== */}
        {mode === 'username-login' && (
          <Card className="glass-card border border-[var(--bg-hover)] bg-[var(--bg-card)] animate-fade-in">
            <CardContent className="space-y-4 pt-6">
              <div>
                <label className="text-xs font-semibold block mb-2 text-[var(--text-secondary)] uppercase tracking-wide">
                  Username
                </label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="your_username"
                  autoFocus
                  className="bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-hover)] rounded-lg focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-2 text-[var(--text-secondary)] uppercase tracking-wide">
                  Password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  onKeyDown={(e) => e.key === 'Enter' && handleUsernameLogin()}
                  className="bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-hover)] rounded-lg focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all"
                />
              </div>
              <Button
                onClick={handleUsernameLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold h-auto bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-lg shadow-[var(--accent)]/20 transition-all"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                Sign in
              </Button>

              {/* Forgot password */}
              <div className="text-center">
                <Button
                  onClick={handleForgotPasswordByUsername}
                  disabled={loading}
                  variant="ghost"
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] h-auto p-0 transition-colors"
                >
                  Forgot password?
                </Button>
              </div>

              <p className="text-xs text-center text-[var(--text-muted)]">
                Don&apos;t have an account?{' '}
                <Button
                  onClick={() => switchMode('username-signup')}
                  variant="ghost"
                  className="text-[var(--accent)] hover:text-[var(--accent-hover)] h-auto p-0 text-xs transition-colors"
                >
                  Create one
                </Button>
              </p>
              <Button
                onClick={() => switchMode('choose')}
                variant="ghost"
                className="w-full text-xs text-center py-2 h-auto text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                ← Back to all options
              </Button>
            </CardContent>
          </Card>
        )}

        {/* =================== USERNAME + PASSWORD (SIGNUP) =================== */}
        {mode === 'username-signup' && (
          <Card className="glass-card border border-[var(--bg-hover)] bg-[var(--bg-card)] animate-fade-in">
            <CardContent className="space-y-4 pt-6">
              <p className="text-xs text-[var(--text-secondary)]">
                Email is optional but helps with password recovery.
              </p>

              {/* Username */}
              <div>
                <label className="text-xs font-semibold flex items-center gap-1 mb-2 text-[var(--text-secondary)] uppercase tracking-wide">
                  <AtSign size={12} /> Username
                </label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="pick_a_username"
                  maxLength={20}
                  autoFocus
                  className={`bg-[var(--bg-primary)] text-[var(--text-primary)] border rounded-lg focus:outline-none focus:ring-1 transition-all ${validationMsg ? 'border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]/20' : 'border-[var(--bg-hover)] focus:border-[var(--accent)] focus:ring-[var(--accent)]/20'}`}
                />
                <p className={`text-xs mt-1 ${validationMsg ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'}`}>
                  {validationMsg || '3-20 chars: letters, numbers, underscores'}
                </p>
              </div>

              {/* Email (optional) */}
              <div>
                <label className="text-xs font-semibold flex items-center gap-1 mb-2 text-[var(--text-secondary)] uppercase tracking-wide">
                  <Mail size={12} /> Email <span className="font-normal text-xs">(optional)</span>
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-hover)] rounded-lg focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all"
                />
              </div>

              {/* Password */}
              <div>
                <label className="text-xs font-semibold flex items-center gap-1 mb-2 text-[var(--text-secondary)] uppercase tracking-wide">
                  <Key size={12} /> Password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-hover)] rounded-lg focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all"
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="text-xs font-semibold block mb-2 text-[var(--text-secondary)] uppercase tracking-wide">
                  Confirm Password
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  onKeyDown={(e) => e.key === 'Enter' && handleUsernameSignup()}
                  className="bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-hover)] rounded-lg focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all"
                />
              </div>

              <Button
                onClick={handleUsernameSignup}
                disabled={loading || !!validationMsg}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold h-auto bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-lg shadow-[var(--accent)]/20 transition-all"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {loading ? 'Creating account...' : 'Create account'}
              </Button>

              <p className="text-xs text-center text-[var(--text-muted)]">
                Already have an account?{' '}
                <Button
                  onClick={() => switchMode('username-login')}
                  variant="ghost"
                  className="text-[var(--accent)] hover:text-[var(--accent-hover)] h-auto p-0 text-xs transition-colors"
                >
                  Sign in
                </Button>
              </p>
              <Button
                onClick={() => switchMode('choose')}
                variant="ghost"
                className="w-full text-xs text-center py-2 h-auto text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                ← Back to all options
              </Button>
            </CardContent>
          </Card>
        )}

        {/* =================== EMAIL + PASSWORD =================== */}
        {mode === 'email-password' && (
          <Card className="glass-card border border-[var(--bg-hover)] bg-[var(--bg-card)] animate-fade-in">
            <CardContent className="space-y-4 pt-6">
              {/* Toggle sign in / sign up */}
              <div className="flex gap-2 p-1 rounded-xl mb-2 bg-[var(--bg-elevated)]">
                {(['signin', 'signup'] as EmailMode[]).map((m) => (
                  <Button
                    key={m}
                    onClick={() => { setEmailMode(m); setError(''); setResetSent(''); }}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold h-auto transition-all ${
                      emailMode === m
                        ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20'
                        : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                    variant="outline"
                  >
                    {m === 'signin' ? 'Sign In' : 'Sign Up'}
                  </Button>
                ))}
              </div>

              <div>
                <label className="text-xs font-semibold block mb-2 text-[var(--text-secondary)] uppercase tracking-wide">
                  Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                  className="bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-hover)] rounded-lg focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-2 text-[var(--text-secondary)] uppercase tracking-wide">
                  Password {emailMode === 'signup' && <span className="font-normal text-xs">(min 6 chars)</span>}
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  onKeyDown={(e) => e.key === 'Enter' && handleEmailPassword()}
                  className="bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-hover)] rounded-lg focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all"
                />
              </div>
              <Button
                onClick={handleEmailPassword}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold h-auto bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-lg shadow-[var(--accent)]/20 transition-all"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {emailMode === 'signin' ? 'Sign in' : 'Create account'}
              </Button>
              {emailMode === 'signup' && (
                <p className="text-xs text-center text-[var(--text-muted)]">
                  You&apos;ll choose a username on the next step.
                </p>
              )}
              {emailMode === 'signin' && (
                <div className="text-center">
                  <Button
                    onClick={async () => {
                      if (!email.trim()) {
                        setError('Enter your email first, then click forgot password.');
                        return;
                      }
                      setLoading(true);
                      setError('');
                      try {
                        await sendPasswordResetEmail(auth, email.trim());
                        setResetSent(email.trim());
                      } catch (err: any) {
                        if (err.code === 'auth/user-not-found') {
                          setError('No account with this email. Sign up instead?');
                        } else {
                          setError(err.message || 'Failed to send reset email');
                        }
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    variant="ghost"
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] h-auto p-0 transition-colors"
                  >
                    Forgot password?
                  </Button>
                </div>
              )}
              <Button
                onClick={() => switchMode('choose')}
                variant="ghost"
                className="w-full text-xs text-center py-2 h-auto text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                ← Back to all options
              </Button>
            </CardContent>
          </Card>
        )}

        {/* =================== EMAIL OTP / MAGIC LINK =================== */}
        {mode === 'email-otp' && (
          <Card className="glass-card border border-[var(--bg-hover)] bg-[var(--bg-card)] animate-fade-in">
            <CardContent className="space-y-4 pt-6">
              {otpSent ? (
                <div className="p-6 text-center rounded-xl glass-card border border-[var(--accent)]/20 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-card)]">
                  <Mail size={48} className="mx-auto mb-4 text-[var(--accent)] glow-pulse" />
                  <h3 className="text-lg font-bold mb-2 gradient-text">
                    Check your email
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)]">
                    We sent a sign-in link to <strong className="text-[var(--text-primary)]">{email}</strong>. Click the link in the email to sign in.
                  </p>
                  <p className="text-xs mt-4 text-[var(--text-muted)]">
                    Didn&apos;t get it? Check spam, or{' '}
                    <Button
                      onClick={() => { setOtpSent(false); setError(''); }}
                      variant="ghost"
                      className="text-[var(--accent)] hover:text-[var(--accent-hover)] h-auto p-0 text-xs transition-colors"
                    >
                      try again
                    </Button>
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-[var(--text-secondary)]">
                    We&apos;ll email you a sign-in link.
                  </p>
                  <div>
                    <label className="text-xs font-semibold block mb-2 text-[var(--text-secondary)] uppercase tracking-wide">
                      Email
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleEmailOTP()}
                      className="bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--bg-hover)] rounded-lg focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/20 transition-all"
                    />
                  </div>
                  <Button
                    onClick={handleEmailOTP}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold h-auto bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-lg shadow-[var(--accent)]/20 transition-all"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                    Send sign-in link
                  </Button>
                </>
              )}
              <Button
                onClick={() => { switchMode('choose'); setOtpSent(false); }}
                variant="ghost"
                className="w-full text-xs text-center py-2 h-auto text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                ← Back to all options
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
