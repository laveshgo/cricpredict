/**
 * Client-side helpers for calling server-side API routes.
 * Group creation and join go through server-side routes for security
 * (Admin SDK bypasses Firestore rules, ensuring proper access control).
 */
import { auth } from '@/lib/firebase';

async function getIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

/**
 * Join a group via server-side API route.
 */
export async function joinGroupApi(groupId: string): Promise<void> {
  const token = await getIdToken();
  const res = await fetch('/api/groups/join', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ groupId }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Failed to join group' }));
    throw new Error(data.error || 'Failed to join group');
  }
}

/**
 * Create a group via server-side API route.
 * Returns the new group ID.
 */
export async function createGroupApi(params: {
  name: string;
  tournamentId: string;
  isPublic: boolean;
  memberLimit?: number | null;
}): Promise<string> {
  const token = await getIdToken();
  const res = await fetch('/api/groups/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });

  const data = await res.json().catch(() => ({ error: 'Failed to create group' }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create group');
  }
  return data.groupId;
}
