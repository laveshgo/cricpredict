/**
 * Flatten MatchScorecardDoc[] into per-player per-match stats.
 *
 * This is the bridge between the single source of truth (matchScorecards)
 * and the shape that the fantasy points calculator expects.
 *
 * Runs server-side in the refresh-matches route when rebuilding tournamentStats.
 */

import type { MatchScorecardDoc, PlayerMatchStatsDoc } from '@/types/fantasy';

/**
 * Check if a dismissal string indicates LBW.
 * Examples: "lbw b Bumrah", "lbw b Starc"
 */
function isLbwDismissal(dismissal: string): boolean {
  return dismissal.toLowerCase().startsWith('lbw');
}

/**
 * Check if a dismissal string indicates bowled.
 * Examples: "b Bumrah", "b Starc"
 * Must NOT match "lbw b ..." or "c ... b ..."
 */
function isBowledDismissal(dismissal: string): boolean {
  const d = dismissal.trim().toLowerCase();
  // "b Name" — starts with "b " and nothing before it
  return /^b\s+\w/.test(d);
}

/**
 * Extract the bowler name from a dismissal string.
 * "lbw b Bumrah" → "Bumrah"
 * "b Starc" → "Starc"
 * "c Pant b Bumrah" → "Bumrah"
 * "st Pant b Chahal" → "Chahal"
 * Returns null if no bowler can be extracted (e.g. "run out")
 */
function extractBowlerName(dismissal: string): string | null {
  // Most dismissals have " b <BowlerName>" somewhere
  const match = dismissal.match(/\bb\s+(.+)$/i);
  if (match) return match[1].trim();
  return null;
}

/**
 * Flatten a list of scorecards into per-player-per-match stat docs.
 * Produces the same shape as the old `playerMatchStats` Firestore collection,
 * so all downstream calculators work without changes.
 */
export function flattenScorecardsToPlayerStats(
  scorecards: MatchScorecardDoc[]
): PlayerMatchStatsDoc[] {
  const results: PlayerMatchStatsDoc[] = [];

  for (const sc of scorecards) {
    // Track players we've already seen in this match (avoid double-counting)
    const seenPlayers = new Set<string>();

    // Helper to find a result entry by statsId
    const findEntry = (statsId: string) => results.find(r => r.id === statsId);

    for (let innIdx = 0; innIdx < sc.innings.length; innIdx++) {
      const inn = sc.innings[innIdx];

      // ── Batters ──
      for (const b of inn.batters) {
        const playerId = b.playerId || `${inn.teamShort.toLowerCase()}_${b.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')}`;
        const statsId = `${sc.matchId}_${playerId}`;

        // Find or create entry for this player in this match
        let existing = findEntry(statsId);
        if (!existing) {
          existing = {
            id: statsId,
            playerId,
            playerName: b.name,
            matchId: sc.matchId,
            tournamentId: sc.tournamentId,
            team: inn.teamShort,
            didBat: false,
            didBowl: false,
            inPlayingXI: true,
          };
          results.push(existing);
          seenPlayers.add(playerId);
        }

        // Fill batting stats
        existing.didBat = true;
        existing.runs = b.runs;
        existing.ballsFaced = b.balls;
        existing.fours = b.fours;
        existing.sixes = b.sixes;
        existing.isOut = b.isOut;
      }

      // ── Bowlers (from the opposing team) ──
      for (const bw of inn.bowlers) {
        const playerId = bw.playerId || (() => {
          // Bowlers belong to the OTHER team
          const bowlerTeam = innIdx === 0
            ? (sc.innings[1]?.teamShort || inn.teamShort)
            : (sc.innings[0]?.teamShort || inn.teamShort);
          return `${bowlerTeam.toLowerCase()}_${bw.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')}`;
        })();
        const statsId = `${sc.matchId}_${playerId}`;

        let existing = findEntry(statsId);
        if (!existing) {
          const bowlerTeam = innIdx === 0
            ? (sc.innings[1]?.teamShort || inn.teamShort)
            : (sc.innings[0]?.teamShort || inn.teamShort);
          existing = {
            id: statsId,
            playerId,
            playerName: bw.name,
            matchId: sc.matchId,
            tournamentId: sc.tournamentId,
            team: bowlerTeam,
            didBat: false,
            didBowl: false,
            inPlayingXI: true,
          };
          results.push(existing);
          seenPlayers.add(playerId);
        }

        // Fill bowling stats (accumulate across innings if same bowler bowls in both)
        existing.didBowl = true;
        existing.wickets = (existing.wickets || 0) + bw.wickets;
        existing.oversBowled = (existing.oversBowled || 0) + bw.overs;
        existing.runsConceded = (existing.runsConceded || 0) + bw.runsConceded;
        existing.maidens = (existing.maidens || 0) + bw.maidens;
        if (bw.dotBalls != null) {
          existing.dotBalls = (existing.dotBalls || 0) + bw.dotBalls;
        }
      }

      // ── Fielders ──
      for (const f of inn.fielders) {
        // Fielders are from the bowling team (opposing team to the batting side)
        const fielderTeam = innIdx === 0
          ? (sc.innings[1]?.teamShort || inn.teamShort)
          : (sc.innings[0]?.teamShort || inn.teamShort);
        const playerId = `${fielderTeam.toLowerCase()}_${f.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')}`;
        const statsId = `${sc.matchId}_${playerId}`;

        let existing = findEntry(statsId);
        if (!existing) {
          existing = {
            id: statsId,
            playerId,
            playerName: f.name,
            matchId: sc.matchId,
            tournamentId: sc.tournamentId,
            team: fielderTeam,
            didBat: false,
            didBowl: false,
            inPlayingXI: true,
          };
          results.push(existing);
          seenPlayers.add(playerId);
        }

        // Accumulate fielding stats across innings
        existing.catches = (existing.catches || 0) + f.catches;
        existing.stumpings = (existing.stumpings || 0) + f.stumpings;
        existing.runOuts = (existing.runOuts || 0) + f.runOuts;
      }

      // ── LBW/Bowled wicket detection ──
      // Use wicketCode (reliable) or fall back to dismissal string parsing
      for (const b of inn.batters) {
        if (!b.isOut) continue;

        // Detect LBW/bowled via wicketCode first, then dismissal string
        const wc = (b.wicketCode || '').toLowerCase();
        const isLbw = wc ? wc === 'lbw' : (b.dismissal ? isLbwDismissal(b.dismissal) : false);
        const isBowled = wc ? wc === 'bowled' : (b.dismissal ? isBowledDismissal(b.dismissal) : false);

        if (!isLbw && !isBowled) continue;

        // Extract bowler name to credit
        const bowlerName = b.dismissal ? extractBowlerName(b.dismissal) : null;
        if (!bowlerName) continue;

        const bowlerTeam = innIdx === 0
          ? (sc.innings[1]?.teamShort || inn.teamShort)
          : (sc.innings[0]?.teamShort || inn.teamShort);

        const bowlerNameLower = bowlerName.toLowerCase();
        const bowlerEntry = results.find(r => {
          if (r.matchId !== sc.matchId) return false;
          if (!r.didBowl) return false;
          const entryLastName = r.playerName.split(' ').pop()?.toLowerCase() || '';
          const dismissalLastName = bowlerNameLower.split(' ').pop() || '';
          return entryLastName === dismissalLastName && r.team === bowlerTeam;
        });

        if (bowlerEntry) {
          if (isLbw) {
            bowlerEntry.lbwWickets = (bowlerEntry.lbwWickets || 0) + 1;
          } else if (isBowled) {
            bowlerEntry.bowledWickets = (bowlerEntry.bowledWickets || 0) + 1;
          }
        }
      }
    }

    // ── POTM flag ──
    if (sc.potm) {
      const potmLower = sc.potm.toLowerCase();
      for (const r of results) {
        if (r.matchId !== sc.matchId) continue;
        // Match by last name or full name
        if (r.playerName.toLowerCase() === potmLower ||
            potmLower.includes(r.playerName.split(' ').pop()?.toLowerCase() || '___')) {
          r.isPotm = true;
          break;
        }
      }
    }
  }

  return results;
}
