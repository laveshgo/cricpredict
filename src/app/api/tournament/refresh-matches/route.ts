import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { rateLimit } from '@/lib/rate-limit';
import { fetchSeriesMatches, fetchMatchScorecard } from '@/lib/cricbuzz-scorecard';
import { flattenScorecardsToPlayerStats } from '@/lib/scorecard-flatten';
import type { MatchStatus, MatchScorecardDoc, ScorecardBatterEntry, ScorecardBowlerEntry, ScorecardFieldingEntry, ScorecardInnings } from '@/types/fantasy';

/** Recursively strip undefined values from an object (Firestore rejects them). */
function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined) as T;
  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== undefined) {
        cleaned[key] = stripUndefined(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

/**
 * POST /api/tournament/refresh-matches
 *
 * Body: { tournamentId }
 *
 * Tournament-creator-only endpoint. Fetches match list + scorecards from Cricbuzz,
 * writes to:
 *   - matches/{id}            — fixture + result info
 *   - matchScorecards/{id}    — full raw scorecard (single source of truth)
 *   - players/{id}            — global player registry
 *
 * No playerMatchStats — per-player stats are precomputed into
 * tournamentStats/{tournamentId} (materialized view) after scorecard writes.
 */

function resolveMatchStatus(m: any): MatchStatus {
  const s = (m.status || '').toLowerCase();
  const st = (m.statusText || '').toLowerCase();
  if (s.includes('complete') || st.includes('won') || st.includes('tie')) return 'completed';
  if (st.includes('no result') || st.includes('abandoned')) return 'no_result';
  if (s.includes('live') || s.includes('in progress')) return 'live';
  return 'upcoming';
}

/** Generate a stable player ID from name + team. */
function makePlayerId(name: string, teamShort: string): string {
  return `${teamShort.toLowerCase()}_${name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`;
}

export async function POST(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Rate limit: 3 req/min
  const { limited } = rateLimit(uid, 3, 60_000);
  if (limited) {
    return NextResponse.json({ error: 'Rate limited. Please wait a minute.' }, { status: 429 });
  }

  // Parse body
  let tournamentId: string;
  try {
    const body = await request.json();
    tournamentId = body.tournamentId;
    if (!tournamentId) throw new Error('Missing tournamentId');
  } catch {
    return NextResponse.json({ error: 'Missing tournamentId in body' }, { status: 400 });
  }

  try {
    // 1. Verify tournament exists and user is creator
    const tournamentDoc = await adminDb.collection('tournaments').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }
    const tournament = tournamentDoc.data()!;
    if (tournament.createdBy !== uid) {
      return NextResponse.json({ error: 'Only the tournament creator can refresh match data' }, { status: 403 });
    }

    const seriesId = tournament.cricbuzzSeriesId;
    if (!seriesId) {
      return NextResponse.json({ error: 'Tournament has no cricbuzzSeriesId configured' }, { status: 400 });
    }

    // 2. Fetch match list from Cricbuzz
    const cricbuzzMatches = await fetchSeriesMatches(seriesId);
    if (cricbuzzMatches.length === 0) {
      return NextResponse.json({ error: 'Could not fetch matches from Cricbuzz' }, { status: 502 });
    }

    // 3. Load existing matches to know which have scorecards
    const existingMatchesSnap = await adminDb.collection('matches')
      .where('tournamentId', '==', tournamentId)
      .get();
    const existingMatches = new Map<string, any>();
    existingMatchesSnap.docs.forEach(d => existingMatches.set(d.id, d.data()));

    // 4. Process each match
    let newScorecards = 0;
    let updatedMatches = 0;
    let newPlayers = 0;
    const completedMatchIds: string[] = [];

    // Track known players to avoid redundant writes
    const knownPlayerIds = new Set<string>();

    const matchBatch = adminDb.batch();

    for (const m of cricbuzzMatches) {
      const matchId = String(m.matchId);
      const status = resolveMatchStatus(m);
      const existing = existingMatches.get(matchId);

      // Build match document
      const matchDoc = stripUndefined({
        id: matchId,
        cricbuzzMatchId: m.matchId,
        tournamentId,
        matchDesc: m.matchDesc || '',
        matchNumber: null,
        status,
        statusText: m.statusText || '',
        team1: {
          name: m.team1?.name || '',
          shortName: m.team1?.shortName || '',
          score: m.team1?.score || null,
        },
        team2: {
          name: m.team2?.name || '',
          shortName: m.team2?.shortName || '',
          score: m.team2?.score || null,
        },
        startDate: m.startDate || '',
        venue: m.venueName || null,
        potm: existing?.potm || null,
        innings: existing?.innings || null,
        scorecardFetched: existing?.scorecardFetched || false,
        fetchedAt: existing?.fetchedAt || null,
      });

      // Fetch scorecard for completed matches we haven't processed yet
      if (status === 'completed' && !existing?.scorecardFetched) {
        try {
          const scorecard = await fetchMatchScorecard(m.matchId);
          if (scorecard && scorecard.innings.length > 0) {
            // Update match doc with innings summary + potm
            matchDoc.potm = scorecard.potm || null;
            matchDoc.innings = scorecard.innings.map(inn => stripUndefined({
              team: inn.team,
              teamShort: inn.teamShort,
              score: inn.score,
              overs: null,
            }));
            matchDoc.scorecardFetched = true;
            matchDoc.fetchedAt = new Date().toISOString();

            // Build full scorecard doc (source of truth for all stats)
            const scorecardDoc: MatchScorecardDoc = {
              id: matchId,
              matchId,
              tournamentId,
              matchDesc: m.matchDesc || '',
              statusText: m.statusText || '',
              team1: scorecard.team1,
              team2: scorecard.team2,
              potm: scorecard.potm,
              innings: scorecard.innings.map((inn, innIdx) => {
                const inningsDoc: ScorecardInnings = {
                  team: inn.team,
                  teamShort: inn.teamShort,
                  score: inn.score,
                  batters: inn.batters.map((b, i): ScorecardBatterEntry => ({
                    name: b.name,
                    playerId: makePlayerId(b.name, inn.teamShort),
                    battingPosition: i + 1,
                    runs: b.runs,
                    balls: b.balls,
                    fours: b.fours,
                    sixes: b.sixes,
                    strikeRate: b.strikeRate,
                    isOut: b.isOut,
                    dismissal: b.dismissal || (b.isOut ? 'out' : 'not out'),
                    wicketCode: b.wicketCode,
                    impactSub: b.impactSub,
                    dots: b.dots,
                    singles: b.singles,
                    doubles: b.doubles,
                    triples: b.triples,
                  })),
                  bowlers: inn.bowlers.map((bw): ScorecardBowlerEntry => ({
                    name: bw.name,
                    playerId: makePlayerId(bw.name,
                      innIdx === 0
                        ? (scorecard.innings[1]?.teamShort || inn.teamShort)
                        : (scorecard.innings[0]?.teamShort || inn.teamShort)
                    ),
                    overs: bw.overs,
                    maidens: bw.maidens,
                    runsConceded: bw.runs,
                    wickets: bw.wickets,
                    economy: bw.economy,
                    dotBalls: bw.dotBalls,
                    noBalls: bw.noBalls,
                    wides: bw.wides,
                    impactSub: bw.impactSub,
                  })),
                  fielders: inn.fielders.map((f): ScorecardFieldingEntry => ({
                    name: f.name,
                    catches: f.catches,
                    stumpings: f.stumpings,
                    runOuts: f.runOuts,
                  })),
                };
                return inningsDoc;
              }),
              fetchedAt: new Date().toISOString(),
            };

            // Write scorecard (the single source of truth)
            const scorecardRef = adminDb.collection('matchScorecards').doc(matchId);
            await scorecardRef.set(stripUndefined(scorecardDoc));

            // Register players in global registry
            const playerBatch = adminDb.batch();
            const allNames = new Set<string>();

            for (const inn of scorecard.innings) {
              for (const b of inn.batters) {
                const pid = makePlayerId(b.name, inn.teamShort);
                if (!knownPlayerIds.has(pid)) {
                  knownPlayerIds.add(pid);
                  allNames.add(pid);
                  playerBatch.set(adminDb.collection('players').doc(pid), stripUndefined({
                    id: pid,
                    name: b.name,
                    team: inn.team,
                    teamShort: inn.teamShort,
                    role: 'BAT',
                    isForeign: false,
                    tournaments: [tournamentId],
                  }), { merge: true });
                }
              }
              // Bowlers belong to the other team
              const bowlerTeamIdx = scorecard.innings.indexOf(inn) === 0 ? 1 : 0;
              const bowlerTeam = scorecard.innings[bowlerTeamIdx]?.teamShort || inn.teamShort;
              const bowlerTeamFull = scorecard.innings[bowlerTeamIdx]?.team || inn.team;

              for (const bw of inn.bowlers) {
                const pid = makePlayerId(bw.name, bowlerTeam);
                if (!knownPlayerIds.has(pid)) {
                  knownPlayerIds.add(pid);
                  allNames.add(pid);
                  playerBatch.set(adminDb.collection('players').doc(pid), stripUndefined({
                    id: pid,
                    name: bw.name,
                    team: bowlerTeamFull,
                    teamShort: bowlerTeam,
                    role: 'BOWL',
                    isForeign: false,
                    tournaments: [tournamentId],
                  }), { merge: true });
                }
              }
            }

            if (allNames.size > 0) {
              await playerBatch.commit();
              newPlayers += allNames.size;
            }

            newScorecards++;
          }
        } catch (err) {
          console.warn(`[refresh-matches] Scorecard fetch failed for match ${matchId}:`, err);
        }
      }

      if (status === 'completed' && matchDoc.scorecardFetched) {
        completedMatchIds.push(matchId);
      }

      // Write match doc
      const ref = adminDb.collection('matches').doc(matchId);
      matchBatch.set(ref, matchDoc, { merge: true });
      updatedMatches++;
    }

    await matchBatch.commit();

    // Rebuild the materialized view: tournamentStats/{tournamentId}
    // Read ALL scorecards for this tournament, flatten into per-player stats, write as one doc.
    if (newScorecards > 0) {
      const allScorecardsSnap = await adminDb.collection('matchScorecards')
        .where('tournamentId', '==', tournamentId)
        .get();
      const allScorecards = allScorecardsSnap.docs.map(d => d.data() as MatchScorecardDoc);
      const flatStats = flattenScorecardsToPlayerStats(allScorecards);

      await adminDb.collection('tournamentStats').doc(tournamentId).set(stripUndefined({
        id: tournamentId,
        tournamentId,
        stats: flatStats,
        matchCount: allScorecards.length,
        rebuiltAt: new Date().toISOString(),
      }));

      console.log(`[refresh-matches] Rebuilt tournamentStats: ${flatStats.length} player-match entries from ${allScorecards.length} scorecards`);
    }

    console.log(`[refresh-matches] Tournament ${tournamentId}: ${updatedMatches} matches, ${newScorecards} new scorecards, ${newPlayers} players`);

    return NextResponse.json({
      success: true,
      tournamentId,
      matchesFound: cricbuzzMatches.length,
      matchesUpdated: updatedMatches,
      newScorecards,
      completedMatches: completedMatchIds.length,
      newPlayers,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[refresh-matches] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
