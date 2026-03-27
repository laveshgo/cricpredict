/**
 * Seed script — creates the IPL 2026 tournament in Firestore if it doesn't exist.
 * Can be called from the browser console or an admin page.
 */

import { collection, getDocs, query, where, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { IPL_2026_TOURNAMENT } from './ipl2026';

export async function seedIPL2026(userId: string): Promise<string> {
  // Check if it already exists
  const existing = await getDocs(
    query(
      collection(db, 'tournaments'),
      where('name', '==', 'IPL 2026'),
      where('season', '==', '2026')
    )
  );

  if (!existing.empty) {
    return existing.docs[0].id;
  }

  // Create it
  const ref = doc(collection(db, 'tournaments'));
  await setDoc(ref, {
    ...IPL_2026_TOURNAMENT,
    createdBy: userId,
    createdAt: new Date().toISOString(),
  });

  return ref.id;
}
