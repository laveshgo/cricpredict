/**
 * Auth & username helpers for Firestore.
 *
 * Collections:
 *   - users/{uid}        → UserProfile
 *   - usernames/{username} → { uid: string }   (uniqueness index)
 *   - emails/{email}      → { uid: string }    (lookup by email)
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import type { UserProfile } from '@/types';

// =================== USERNAME VALIDATION ===================

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export function isValidUsername(username: string): { ok: boolean; error?: string } {
  if (!username) return { ok: false, error: 'Username is required' };
  if (username.length < 3) return { ok: false, error: 'Minimum 3 characters' };
  if (username.length > 20) return { ok: false, error: 'Maximum 20 characters' };
  if (!USERNAME_RE.test(username))
    return { ok: false, error: 'Only letters, numbers, and underscores' };
  return { ok: true };
}

// =================== USERNAME UNIQUENESS ===================

export async function isUsernameTaken(username: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'usernames', username.toLowerCase()));
  return snap.exists();
}

export async function isEmailTaken(email: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'emails', email.toLowerCase()));
  if (!snap.exists()) return false;
  // Verify the referenced user still exists (handles stale entries from deleted accounts)
  const uid = snap.data().uid;
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (!userSnap.exists()) {
    // Stale entry — clean it up
    await deleteDoc(doc(db, 'emails', email.toLowerCase()));
    return false;
  }
  return true;
}

// =================== LOOKUP ===================

/** Find a user's email by their username (for username+password login) */
export async function getEmailByUsername(username: string): Promise<string | null> {
  const snap = await getDoc(doc(db, 'usernames', username.toLowerCase()));
  if (!snap.exists()) return null;
  const uid = snap.data().uid;
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (!userSnap.exists()) return null;
  const profile = userSnap.data() as UserProfile;
  return profile.email || null;
}

/** Get profile by uid */
export async function getProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

// =================== CREATE / UPDATE PROFILE ===================

/**
 * Create a new user profile with a unique username.
 * Uses a Firestore transaction to ensure username uniqueness.
 */
/** Strip undefined values from an object (Firestore rejects undefined) */
function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const clean = {} as any;
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) clean[key] = val;
  }
  return clean;
}

export async function createProfile(profile: UserProfile): Promise<void> {
  const usernameLower = profile.username.toLowerCase();
  const cleanProfile = stripUndefined(profile);

  await runTransaction(db, async (transaction) => {
    // Check username not taken
    const usernameRef = doc(db, 'usernames', usernameLower);
    const usernameSnap = await transaction.get(usernameRef);
    if (usernameSnap.exists()) {
      throw new Error('Username is already taken');
    }

    // Reserve the username
    transaction.set(usernameRef, { uid: profile.uid });

    // Save user profile (stripped of any undefined fields)
    transaction.set(doc(db, 'users', profile.uid), cleanProfile);

    // Index by email if provided
    if (profile.email) {
      transaction.set(doc(db, 'emails', profile.email.toLowerCase()), {
        uid: profile.uid,
      });
    }
  });
}

/**
 * Update username — releases old one, claims new one atomically.
 */
export async function updateUsername(
  uid: string,
  oldUsername: string,
  newUsername: string
): Promise<void> {
  const oldLower = oldUsername.toLowerCase();
  const newLower = newUsername.toLowerCase();

  if (oldLower === newLower) return;

  await runTransaction(db, async (transaction) => {
    const newRef = doc(db, 'usernames', newLower);
    const newSnap = await transaction.get(newRef);
    if (newSnap.exists()) {
      throw new Error('Username is already taken');
    }

    // Release old username
    transaction.delete(doc(db, 'usernames', oldLower));
    // Claim new username
    transaction.set(newRef, { uid });
    // Update profile — preserve the user's preferred casing
    transaction.update(doc(db, 'users', uid), { username: newUsername });
  });
}

/**
 * Update profile fields (displayName, email, photoURL).
 * If email changes, updates the email index too.
 */
export async function updateProfile(
  uid: string,
  updates: Partial<Pick<UserProfile, 'firstName' | 'lastName' | 'displayName' | 'email' | 'photoURL' | 'emailVerified'>>
): Promise<void> {
  const currentProfile = await getProfile(uid);
  if (!currentProfile) throw new Error('Profile not found');

  // If email changed, update email index atomically
  if (updates.email && updates.email !== currentProfile.email) {
    const emailLower = updates.email.toLowerCase();

    await runTransaction(db, async (transaction) => {
      // Check email uniqueness INSIDE the transaction
      const emailRef = doc(db, 'emails', emailLower);
      const emailSnap = await transaction.get(emailRef);
      if (emailSnap.exists()) {
        // Verify the referenced user still exists
        const existingUid = emailSnap.data().uid;
        if (existingUid !== uid) {
          const userSnap = await transaction.get(doc(db, 'users', existingUid));
          if (userSnap.exists()) {
            throw new Error('Email is already associated with another account');
          }
          // Stale entry — we'll overwrite it below
        }
      }

      // Remove old email index
      if (currentProfile.email) {
        transaction.delete(doc(db, 'emails', currentProfile.email.toLowerCase()));
      }
      // Add new email index
      transaction.set(emailRef, { uid });
      // Update profile
      transaction.update(doc(db, 'users', uid), updates);
    });
  } else {
    // Simple update, no email change
    await updateDoc(doc(db, 'users', uid), updates);
  }
}
