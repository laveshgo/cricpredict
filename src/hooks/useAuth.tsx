'use client';

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  sendPasswordResetEmail,
  ActionCodeSettings,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { getProfile, getEmailByUsername, isValidUsername, updateProfile as updateFirestoreProfile } from '@/lib/auth-helpers';
import type { UserProfile } from '@/types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  needsUsername: boolean; // true if signed in but no profile/username yet
  signInWithGoogle: () => Promise<void>;
  signInWithUsernamePassword: (username: string, password: string) => Promise<void>;
  signUpWithUsername: (username: string, password: string, email?: string) => Promise<void>;
  signUpWithEmailPassword: (email: string, password: string) => Promise<void>;
  sendEmailOTP: (email: string) => Promise<void>;
  completeEmailOTP: (email: string, url: string) => Promise<void>;
  forgotPasswordByUsername: (username: string) => Promise<string>;
  signOut: () => Promise<void>;
  reloadProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  needsUsername: false,
  signInWithGoogle: async () => {},
  signInWithUsernamePassword: async () => {},
  signUpWithUsername: async () => {},
  signUpWithEmailPassword: async () => {},
  sendEmailOTP: async () => {},
  completeEmailOTP: async () => {},
  forgotPasswordByUsername: async () => '',
  signOut: async () => {},
  reloadProfile: async () => {},
});


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsUsername, setNeedsUsername] = useState(false);
  const signingIn = useRef(false);

  const loadProfile = async (firebaseUser: User, retries = 2) => {
    try {
      const p = await getProfile(firebaseUser.uid);
      if (p && p.username && p.firstName) {
        // Auto-sync emailVerified from Firebase Auth → Firestore
        if (firebaseUser.emailVerified && !p.emailVerified && p.email) {
          try {
            await updateFirestoreProfile(firebaseUser.uid, { emailVerified: true });
            p.emailVerified = true;
          } catch {}
        }
        setProfile(p);
        setNeedsUsername(false);
      } else {
        // User exists in Firebase Auth but profile is incomplete (no username or no firstName)
        setProfile(p);
        setNeedsUsername(true);
      }
    } catch (err: any) {
      // Token may not be ready yet after account creation — retry
      if (err?.code === 'permission-denied' && retries > 0) {
        await new Promise((r) => setTimeout(r, 1000));
        return loadProfile(firebaseUser, retries - 1);
      }
      // After retries, assume new user needing setup
      console.warn('loadProfile failed:', err);
      setProfile(null);
      setNeedsUsername(true);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await loadProfile(firebaseUser);
      } else {
        setProfile(null);
        setNeedsUsername(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps — subscription runs once; loadProfile only captures stable setState refs
  }, []);

  // Check for email link sign-in on page load
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const email = window.localStorage.getItem('emailForSignIn');
      if (email) {
        signInWithEmailLink(auth, email, window.location.href)
          .then(() => {
            window.localStorage.removeItem('emailForSignIn');
          })
          .catch((err) => {
            console.error('Email link sign-in error:', err);
          });
      }
    }
  }, []);

  // =================== AUTH METHODS ===================

  const signInWithGoogle = async () => {
    if (signingIn.current) return;
    signingIn.current = true;
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (
        error?.code !== 'auth/cancelled-popup-request' &&
        error?.code !== 'auth/popup-closed-by-user'
      ) {
        console.error('Google sign-in error:', error);
        throw error;
      }
    } finally {
      signingIn.current = false;
    }
  };

  const signInWithUsernamePassword = async (username: string, password: string) => {
    const usernameLower = username.toLowerCase();
    let lastAuthError: any = null;

    // Strategy 1: Try new placeholder email format
    try {
      await signInWithEmailAndPassword(auth, `${usernameLower}@noreply.cricpredict.local`, password);
      return;
    } catch (err: any) {
      lastAuthError = err;
    }

    // Strategy 1b: Fallback for accounts created with old placeholder domain
    try {
      await signInWithEmailAndPassword(auth, `${usernameLower}@cricpredict.app`, password);
      return;
    } catch (err: any) {
      // Fall through to Firestore lookup
    }

    // Strategy 2: Look up the real email from Firestore, then try that
    try {
      const email = await getEmailByUsername(usernameLower);
      if (email) {
        // Found a real email — try signing in with it
        try {
          await signInWithEmailAndPassword(auth, email, password);
          return;
        } catch (err: any) {
          // This is a definitive wrong-password — the email exists, password is wrong
          throw new Error('Wrong password. If you signed up with Google or email link, you may not have set a password yet. Sign in with that method first, then set a password in your profile.');
        }
      } else {
        // Username not found in Firestore either
        throw new Error('Username not found. Please check spelling or sign up first.');
      }
    } catch (err: any) {
      // If it's our own thrown errors, re-throw them
      if (err instanceof Error && (err.message.includes('Wrong password') || err.message.includes('Username not found'))) {
        throw err;
      }
      // permission-denied means Firestore rules don't allow public reads
      if (err?.code === 'permission-denied') {
        // Fall back to the original auth error
        if (lastAuthError) {
          throw new Error('Wrong password. If you signed up with Google or email link, you may not have set a password yet. Sign in with that method first, then set a password in your profile.');
        }
      }
      throw err;
    }
  };

  /**
   * Sign up with username + password.
   * Creates Firebase Auth account, then redirects to setup-username page
   * which handles the Firestore profile creation (by that time token is ready).
   * Stores the desired username in localStorage so setup-username can pre-fill it.
   */
  const signUpWithUsername = async (username: string, password: string, email?: string) => {
    const usernameLower = username.toLowerCase();

    // Validate username format only (no Firestore check — user isn't authed yet)
    const validation = isValidUsername(usernameLower);
    if (!validation.ok) throw new Error(validation.error || 'Invalid username');

    // Use provided email or generate placeholder for Firebase Auth
    const accountEmail = email?.trim() || `${usernameLower}@noreply.cricpredict.local`;

    // Create Firebase Auth account
    await createUserWithEmailAndPassword(auth, accountEmail, password);

    // Save desired username + email for the setup-username page to use.
    // The setup-username page will do the actual Firestore username reservation
    // (at that point the auth token is ready).
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('pendingUsername', usernameLower);
      if (email?.trim()) {
        window.localStorage.setItem('pendingEmail', email.trim());
      }
    }
    // onAuthStateChanged will fire → needsUsername=true → redirect to setup-username
  };

  const signUpWithEmailPassword = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
    // Don't create profile here — the username setup page will do that
  };

  const sendEmailOTP = async (email: string) => {
    const emailLinkSettings: ActionCodeSettings = {
      url: typeof window !== 'undefined' ? window.location.origin + '/auth/verify' : 'http://localhost:3000/auth/verify',
      handleCodeInApp: true,
    };
    await sendSignInLinkToEmail(auth, email, emailLinkSettings);
    // Save email in localStorage so we can complete sign-in after redirect
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('emailForSignIn', email);
    }
  };

  const completeEmailOTP = async (email: string, url: string) => {
    if (!isSignInWithEmailLink(auth, url)) {
      throw new Error('Invalid sign-in link');
    }
    await signInWithEmailLink(auth, email, url);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('emailForSignIn');
    }
  };

  /**
   * Forgot password by username — looks up the user's email and sends a reset link.
   * Returns a masked version of the email for UI display.
   * Throws if no email is on the account (username-only with no real email).
   */
  const forgotPasswordByUsername = async (username: string): Promise<string> => {
    const usernameLower = username.toLowerCase();

    // Try Firestore lookup for the email
    let email: string | null = null;
    try {
      email = await getEmailByUsername(usernameLower);
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        // Can't read Firestore before auth.
        // Try sending reset to the placeholder email — Firebase will silently
        // succeed even if there's no real inbox, so this won't help much.
        // Better to tell the user to sign in another way.
        throw new Error('Cannot look up username before signing in. If you forgot your password, try signing in with Google or email link instead.');
      }
      throw err;
    }

    if (!email) {
      throw new Error('Username not found');
    }
    if (email.endsWith('@noreply.cricpredict.local') || email.endsWith('@cricpredict.app')) {
      throw new Error('This account has no real email. Sign in with your username & password, then add an email in your profile to enable password reset.');
    }

    await sendPasswordResetEmail(auth, email);
    const [local, domain] = email.split('@');
    const masked = local[0] + '***@' + domain;
    return masked;
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setProfile(null);
      setNeedsUsername(false);
    } catch (error) {
      console.error('Sign-out error:', error);
    }
  };

  const reloadProfile = async () => {
    if (user) {
      await loadProfile(user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        needsUsername,
        signInWithGoogle,
        signInWithUsernamePassword,
        signUpWithUsername,
        signUpWithEmailPassword,
        sendEmailOTP,
        completeEmailOTP,
        forgotPasswordByUsername,
        signOut,
        reloadProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
