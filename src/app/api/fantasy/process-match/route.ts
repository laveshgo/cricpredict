import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { rateLimit } from '@/lib/rate-limit';
import { fetchMatchScorecard } from '@/lib/cricbuzz-scorecard';
import { processMatchForLeague, processMatchFromStats } from '@/lib/fantasy-scoring-engine';
import { DEFAULT_FANTASY_SCORING } from '@/types/fantasy';
import type { FantasyUserWeeklyScore, FantasyPlayerMatchPoints, PlayerMatchStats } from '@/types/fantasy';

/**
 * POST /api/fantasy/process-match
 *
 * Body: { leagueId, matchId, weekNumber }
 *
 * Admin-only endpoint. Fetches scorecard, calculates fantasy points
 * for all squads in the league, and saves/updates weekly scores in Firestore.
 *
 * Flow:
 *   1. Verify admin is the league creator
 *   2. Fetch scorecard from Cricbuzz
 *   3. Load all squads for the league
 *   4. Calculate fantasy points per squad
 *   5. Save to Firestore (fantasyUserScores collection)
 *   6. Return summary
 */

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

  // Rate limit
  const { limited } = rateLimit(uid, 5, 60_000);
  if (limited) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  // Parse body
  let body: { leagueId: string; matchId: number; weekNumber: number };
  try {
    body = await request.json();
    if (!body.leagueId || !body.matchId || !body.weekNumber) {
      return NextResponse.json({ error: 'Missing leagueId, matchId, or weekNumber' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { leagueId, matchId, weekNumber } = body;

  try {
    // 1. Verify league exists and user is admin
    const leagueDoc = await adminDb.collection('fantasyLeagues').doc(leagueId).get();
    if (!leagueDoc.exists) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }
    const league = leagueDoc.data()!;
    if (league.createdBy !== uid) {
      return NextResponse.json({ error: 'Only the league admin can process scores' }, { status: 403 });
    }

    // 2. Try to read scorecard from tournament match data first, fall back to Cricbuzz
    let scorecard: Awaited<ReturnType<typeof fetchMatchScorecard>> | null = null;
    let usedTournamentData = false;

    if (league.tournamentId) {
      const matchDoc = await adminDb
        .collection('tournaments').doc(league.tournamentId).collection('matches').doc(String(matchId))
        .get();
      if (matchDoc.exists) {
        const matchData = matchDoc.data()!;
        if (matchData.scorecardAvailable && matchData.playerStats?.length > 0) {
          // We have stored tournament-level data — use it directly (skip Cricbuzz fetch)
          usedTournamentData = true;
          // Build a synthetic scorecard for processMatchForLeague
          scorecard = {
            team1: matchData.team1?.shortName || matchData.team1?.name || '',
            team2: matchData.team2?.shortName || matchData.team2?.name || '',
            potm: matchData.potm || '',
            innings: (matchData.innings || []).map((inn: any) => ({
              team: inn.team,
              teamShort: inn.teamShort,
              score: inn.score,
              batters: [],
              bowlers: [],
              fielders: [],
            })),
            playerStats: matchData.playerStats,
          } as any;
        }
      }
    }

    // Fall back to Cricbuzz if no tournament data
    if (!scorecard) {
      scorecard = await fetchMatchScorecard(matchId);
    }

    if (!scorecard || (!(scorecard as any).playerStats?.length && scorecard.innings.length === 0)) {
      return NextResponse.json({
        error: 'Could not fetch scorecard. Make sure the match is completed and the matchId is correct.',
      }, { status: 404 });
    }

    // 3. Load all squads for this league (or create them from auction state)
    let squadsSnap = await adminDb.collection('fantasySquads')
      .where('leagueId', '==', leagueId)
      .get();

    // If no squads exist, auto-create them from auction state
    if (squadsSnap.empty) {
      const auctionDoc = await adminDb.collection('fantasyAuctions').doc(leagueId).get();
      if (!auctionDoc.exists) {
        return NextResponse.json({ error: 'No auction data found for this league' }, { status: 404 });
      }
      const auction = auctionDoc.data()!;
      if (auction.status !== 'completed') {
        return NextResponse.json({ error: 'Auction is not completed yet' }, { status: 400 });
      }

      // Build squads from soldPlayers grouped by boughtBy (userId)
      const soldByUser = new Map<string, any[]>();
      for (const p of (auction.soldPlayers || [])) {
        const uid = p.boughtBy;
        if (!soldByUser.has(uid)) soldByUser.set(uid, []);
        soldByUser.get(uid)!.push(p);
      }

      const createBatch = adminDb.batch();
      for (const [squadUserId, players] of soldByUser) {
        const budgetInfo = auction.budgets?.[squadUserId] || { total: 100, spent: 0, remaining: 100, playerCount: 0 };
        const memberInfo = league.members?.[squadUserId] || {};
        const ref = adminDb.collection('fantasySquads').doc();
        createBatch.set(ref, {
          id: ref.id,
          leagueId,
          tournamentId: league.tournamentId || '',
          userId: squadUserId,
          userName: memberInfo.username || memberInfo.displayName || 'User',
          displayName: memberInfo.displayName || memberInfo.username || 'User',
          squadName: memberInfo.displayName || memberInfo.username || 'User',
          totalBudget: budgetInfo.total,
          spent: budgetInfo.spent,
          remaining: budgetInfo.remaining,
          players: players.map((p: any) => ({
            playerId: p.playerId,
            name: p.playerName,
            team: p.team || '',
            teamShort: p.teamShort || '',
            role: p.role || 'BAT',
            price: p.soldPrice || 0,
            basePrice: p.basePrice || 0,
          })),
          playingXI: [],
          bench: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      await createBatch.commit();
      console.log(`[process-match] Auto-created ${soldByUser.size} squad docs for league ${leagueId}`);

      // Re-fetch
      squadsSnap = await adminDb.collection('fantasySquads')
        .where('leagueId', '==', leagueId)
        .get();
    }

    if (squadsSnap.empty) {
      return NextResponse.json({ error: 'No squads found and could not create them' }, { status: 404 });
    }

    const squads = squadsSnap.docs.map(doc => {
      const d = doc.data();
      return {
        squadId: doc.id,
        userId: d.userId,
        userName: d.displayName || d.userName || 'User',
        displayName: d.displayName || d.userName || 'User',
        players: d.players || [],
        captainId: d.captainId,
        viceCaptainId: d.viceCaptainId,
      };
    });

    // 4. Get scoring rules (league overrides or defaults)
    const scoringRules = {
      ...DEFAULT_FANTASY_SCORING,
      ...(league.settings?.scoringOverrides || {}),
    };

    // 5. Process match — use stored playerStats if available, otherwise parse scorecard
    let results: ReturnType<typeof processMatchForLeague>;

    if (usedTournamentData && (scorecard as any).playerStats?.length) {
      // Use pre-computed playerStats from tournament match data
      results = processMatchFromStats(
        (scorecard as any).playerStats as PlayerMatchStats[],
        String(matchId),
        squads,
        scoringRules
      );
    } else {
      results = processMatchForLeague(
        scorecard!,
        String(matchId),
        squads,
        scoringRules
      );
    }

    // 6. Save to Firestore — merge with existing weekly scores
    const batch = adminDb.batch();
    const summary: Array<{
      userId: string;
      userName: string;
      matchPoints: number;
      playersScored: number;
    }> = [];

    for (const result of results) {
      const scoreDocId = `${result.squadId}_week${weekNumber}`;
      const scoreRef = adminDb.collection('fantasyUserScores').doc(scoreDocId);
      const existingDoc = await scoreRef.get();

      if (existingDoc.exists) {
        // Append to existing week scores (add this match's player scores)
        const existing = existingDoc.data() as FantasyUserWeeklyScore;

        // Check if this match was already processed (avoid double-counting)
        const alreadyProcessed = existing.playerScores?.some(
          ps => ps.matchId === String(matchId)
        );

        if (alreadyProcessed) {
          // Update existing scores for this match (re-process)
          const otherMatchScores = existing.playerScores.filter(
            ps => ps.matchId !== String(matchId)
          );
          const updatedScores = [...otherMatchScores, ...result.playerScores];
          const weekTotal = updatedScores.reduce((s, ps) => s + ps.finalTotal, 0);

          // Recalculate cumulative from previous weeks
          const prevWeekScores = await getPreviousWeeksCumulative(
            adminDb, result.squadId, weekNumber
          );
          const cumulativeTotal = prevWeekScores + weekTotal;

          batch.update(scoreRef, {
            playerScores: updatedScores,
            weekTotal,
            cumulativeTotal,
            calculatedAt: new Date().toISOString(),
          });
        } else {
          // Add new match scores to existing week
          const updatedScores = [...(existing.playerScores || []), ...result.playerScores];
          const weekTotal = updatedScores.reduce((s, ps) => s + ps.finalTotal, 0);

          const prevWeekScores = await getPreviousWeeksCumulative(
            adminDb, result.squadId, weekNumber
          );
          const cumulativeTotal = prevWeekScores + weekTotal;

          batch.update(scoreRef, {
            playerScores: updatedScores,
            weekTotal,
            cumulativeTotal,
            calculatedAt: new Date().toISOString(),
          });
        }
      } else {
        // Create new week score document
        const prevWeekScores = await getPreviousWeeksCumulative(
          adminDb, result.squadId, weekNumber
        );
        const weekTotal = result.matchTotal;
        const cumulativeTotal = prevWeekScores + weekTotal;

        const weekScore: FantasyUserWeeklyScore = {
          id: scoreDocId,
          squadId: result.squadId,
          leagueId,
          userId: result.userId,
          userName: result.userName,
          tournamentId: league.tournamentId || '',
          weekNumber,
          playerScores: result.playerScores,
          benchScores: [],
          weekTotal,
          cumulativeTotal,
          calculatedAt: new Date().toISOString(),
        };

        batch.set(scoreRef, weekScore);
      }

      summary.push({
        userId: result.userId,
        userName: result.userName,
        matchPoints: result.matchTotal,
        playersScored: result.playerScores.length,
      });
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      matchId,
      weekNumber,
      scorecard: {
        team1: scorecard.team1,
        team2: scorecard.team2,
        potm: scorecard.potm || null,
        innings: scorecard.innings.length,
      },
      results: summary,
      processedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[fantasy/process-match] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get cumulative total points from all weeks before the given week number.
 */
async function getPreviousWeeksCumulative(
  db: FirebaseFirestore.Firestore,
  squadId: string,
  currentWeek: number
): Promise<number> {
  if (currentWeek <= 1) return 0;

  // Get the previous week's cumulative total
  const prevDocId = `${squadId}_week${currentWeek - 1}`;
  const prevDoc = await db.collection('fantasyUserScores').doc(prevDocId).get();

  if (prevDoc.exists) {
    return (prevDoc.data() as any).cumulativeTotal || 0;
  }

  // If previous week doesn't exist, sum all earlier weeks
  let total = 0;
  for (let w = 1; w < currentWeek; w++) {
    const docId = `${squadId}_week${w}`;
    const doc = await db.collection('fantasyUserScores').doc(docId).get();
    if (doc.exists) {
      total += (doc.data() as any).weekTotal || 0;
    }
  }
  return total;
}
