import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  arrayRemove,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  Tournament,
  Group,
  TournamentPrediction,
  MatchPrediction,
  Match,
  ActualResults,
  UserProfile,
  ScoringConfig,
  GroupSettings,
} from '@/types';

// =================== TOURNAMENTS ===================

export async function getTournaments(): Promise<Tournament[]> {
  const snap = await getDocs(
    query(collection(db, 'tournaments'), where('isPublic', '==', true), orderBy('startDate', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Tournament));
}

export async function getTournament(id: string): Promise<Tournament | null> {
  const snap = await getDoc(doc(db, 'tournaments', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Tournament) : null;
}

export async function createTournament(
  data: Omit<Tournament, 'id'>
): Promise<string> {
  const ref = doc(collection(db, 'tournaments'));
  await setDoc(ref, data);
  return ref.id;
}

export async function updateTournamentScoring(
  tournamentId: string,
  scoring: ScoringConfig
): Promise<void> {
  await updateDoc(doc(db, 'tournaments', tournamentId), { scoring });
}

export function onTournament(
  id: string,
  callback: (t: Tournament | null) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    doc(db, 'tournaments', id),
    (snap) => {
      callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as Tournament) : null);
    },
    (error) => {
      console.error('onTournament error:', error);
      onError?.(error);
    }
  );
}

// =================== GROUPS ===================

export async function createGroup(data: Omit<Group, 'id'>): Promise<string> {
  const ref = doc(collection(db, 'groups'));
  await setDoc(ref, data);
  return ref.id;
}

export async function getGroup(id: string): Promise<Group | null> {
  const snap = await getDoc(doc(db, 'groups', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Group) : null;
}

export async function getGroupsForTournament(tournamentId: string): Promise<Group[]> {
  const snap = await getDocs(
    query(
      collection(db, 'groups'),
      where('tournamentId', '==', tournamentId),
      where('isPublic', '==', true)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Group));
}

/** Get all groups a user belongs to (queries groups where memberUids contains the uid) */
export async function getUserGroups(userId: string): Promise<Group[]> {
  const snap = await getDocs(
    query(collection(db, 'groups'), where('memberUids', 'array-contains', userId))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Group));
}

// joinGroup is now server-side: see /api/groups/join/route.ts

export async function leaveGroup(groupId: string, userId: string) {
  await updateDoc(doc(db, 'groups', groupId), {
    memberUids: arrayRemove(userId),
  });
}

/** Batch-fetch member profiles. Pass memberUids directly to skip the group doc read. */
export async function getGroupMembers(groupIdOrUids: string | string[]): Promise<Pick<UserProfile, 'uid' | 'username' | 'firstName' | 'lastName' | 'displayName' | 'photoURL'>[]> {
  let memberUids: string[];

  if (Array.isArray(groupIdOrUids)) {
    memberUids = groupIdOrUids;
  } else {
    const groupSnap = await getDoc(doc(db, 'groups', groupIdOrUids));
    if (!groupSnap.exists()) return [];
    memberUids = groupSnap.data().memberUids || [];
  }

  if (memberUids.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < memberUids.length; i += 30) {
    chunks.push(memberUids.slice(i, i + 30));
  }

  const snapshots = await Promise.all(
    chunks.map(chunk => getDocs(query(collection(db, 'users'), where('uid', 'in', chunk))))
  );

  const members: Pick<UserProfile, 'uid' | 'username' | 'firstName' | 'lastName' | 'displayName' | 'photoURL'>[] = [];
  for (const snap of snapshots) {
    snap.docs.forEach((d) => {
      const data = d.data();
      members.push({
        uid: data.uid || d.id,
        username: data.username,
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        displayName: data.displayName || data.username,
        photoURL: data.photoURL,
      });
    });
  }

  return members;
}

export function onGroup(
  id: string,
  callback: (g: Group | null) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    doc(db, 'groups', id),
    (snap) => {
      callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as Group) : null);
    },
    (error) => {
      console.error('onGroup error:', error);
      onError?.(error);
    }
  );
}

export async function updateGroupSettings(
  groupId: string,
  settings: Partial<GroupSettings>
): Promise<void> {
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings)) {
    updates[`settings.${key}`] = value;
  }
  await updateDoc(doc(db, 'groups', groupId), updates);
}

// =================== PREDICTIONS ===================

export async function savePrediction(pred: TournamentPrediction) {
  const ref = doc(db, 'predictions', pred.id);
  await setDoc(ref, pred);
}

export async function getPrediction(
  groupId: string,
  tournamentId: string,
  userId: string
): Promise<TournamentPrediction | null> {
  const snap = await getDocs(
    query(
      collection(db, 'predictions'),
      where('groupId', '==', groupId),
      where('tournamentId', '==', tournamentId),
      where('userId', '==', userId),
      limit(1)
    )
  );
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as TournamentPrediction;
}

export async function getGroupPredictions(
  groupId: string,
  tournamentId: string
): Promise<TournamentPrediction[]> {
  const snap = await getDocs(
    query(
      collection(db, 'predictions'),
      where('groupId', '==', groupId),
      where('tournamentId', '==', tournamentId)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TournamentPrediction));
}

export function onGroupPredictions(
  groupId: string,
  tournamentId: string,
  callback: (preds: TournamentPrediction[]) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    query(
      collection(db, 'predictions'),
      where('groupId', '==', groupId),
      where('tournamentId', '==', tournamentId)
    ),
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TournamentPrediction)));
    },
    (error) => {
      console.error('onGroupPredictions error:', error);
      onError?.(error);
    }
  );
}

// =================== MATCH PREDICTIONS ===================

export async function saveMatchPrediction(pred: MatchPrediction) {
  const ref = doc(db, 'matchPredictions', pred.id);
  await setDoc(ref, pred);
}

export async function getMatchPredictions(
  groupId: string,
  matchId: string
): Promise<MatchPrediction[]> {
  const snap = await getDocs(
    query(
      collection(db, 'matchPredictions'),
      where('groupId', '==', groupId),
      where('matchId', '==', matchId)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MatchPrediction));
}

/** Get ALL match predictions for a group (single query instead of N+1 per match) */
export async function getAllMatchPredictionsForGroup(
  groupId: string
): Promise<MatchPrediction[]> {
  const snap = await getDocs(
    query(
      collection(db, 'matchPredictions'),
      where('groupId', '==', groupId)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MatchPrediction));
}

// =================== MATCHES ===================

export async function getMatches(tournamentId: string): Promise<Match[]> {
  const snap = await getDocs(
    query(
      collection(db, 'matches'),
      where('tournamentId', '==', tournamentId),
      orderBy('date', 'asc')
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Match));
}

export function onMatches(
  tournamentId: string,
  callback: (matches: Match[]) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    query(
      collection(db, 'matches'),
      where('tournamentId', '==', tournamentId),
      orderBy('date', 'asc')
    ),
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Match)));
    },
    (error) => {
      console.error('onMatches error:', error);
      onError?.(error);
    }
  );
}

// =================== ACTUAL RESULTS ===================

export async function getActualResults(
  groupId: string
): Promise<ActualResults | null> {
  const snap = await getDoc(doc(db, 'actualResults', groupId));
  return snap.exists() ? (snap.data() as ActualResults) : null;
}

export async function saveActualResults(results: ActualResults) {
  await setDoc(doc(db, 'actualResults', results.groupId), results);
}

export function onActualResults(
  groupId: string,
  callback: (r: ActualResults | null) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    doc(db, 'actualResults', groupId),
    (snap) => {
      callback(snap.exists() ? (snap.data() as ActualResults) : null);
    },
    (error) => {
      console.error('onActualResults error:', error);
      onError?.(error);
    }
  );
}
