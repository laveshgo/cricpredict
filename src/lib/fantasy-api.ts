/**
 * Client-side helper to read precomputed tournament player stats.
 *
 * Reads from tournamentStats/{tournamentId} — a single Firestore doc
 * that's rebuilt server-side whenever admin refreshes matches.
 *
 * Source of truth: matchScorecards → flattened on refresh → stored here.
 * No API route needed, no in-memory cache needed. Just one Firestore read.
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { PlayerMatchStatsDoc, TournamentStatsDoc } from '@/types/fantasy';

/**
 * Fetch per-player per-match stats for a tournament.
 * Reads the precomputed materialized view (one Firestore doc).
 */
export async function fetchTournamentPlayerStats(
  tournamentId: string
): Promise<PlayerMatchStatsDoc[]> {
  const snap = await getDoc(doc(db, 'tournamentStats', tournamentId));
  if (!snap.exists()) return [];
  const data = snap.data() as TournamentStatsDoc;
  return data.stats || [];
}
