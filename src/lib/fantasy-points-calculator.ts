/**
 * On-demand fantasy points calculator.
 *
 * Takes shared tournament-level playerMatchStats + a league's squads + scoring rules
 * and computes fantasy leaderboard data entirely on the client.
 *
 * No Firestore writes — everything is derived from the shared flat collections.
 */

import type {
  FantasyScoringRules,
  FantasyPlayerMatchPoints,
  PlayerMatchStatsDoc,
  FantasyPickedPlayer,
} from '@/types/fantasy';
import { DEFAULT_FANTASY_SCORING } from '@/types/fantasy';
import { playerNamesMatch } from './fantasy-scoring-engine';

// ─── Calculate points for one player in one match ───

/**
 * Calculate fantasy points for a single player based on their match stats.
 * Identical logic to calculatePlayerFantasyPoints in fantasy-scoring-engine.ts,
 * but operates on PlayerMatchStatsDoc (the flattened shape from tournamentStats).
 */
export function calculatePointsForPlayer(
  stats: PlayerMatchStatsDoc,
  rules: FantasyScoringRules = DEFAULT_FANTASY_SCORING,
  isCaptain = false,
  isViceCaptain = false
): FantasyPlayerMatchPoints {
  let battingPoints = 0;
  let bowlingPoints = 0;
  let fieldingPoints = 0;
  let bonusPoints = 0;
  let penaltyPoints = 0;

  // ── Playing XI bonus ──
  if (stats.inPlayingXI) {
    bonusPoints += rules.playingXIPoints;
  }

  // ── Batting ──
  if (stats.didBat) {
    const runs = stats.runs || 0;
    const balls = stats.ballsFaced || 0;

    // Per run
    battingPoints += runs * rules.runPoints;

    // Boundary bonuses
    battingPoints += (stats.fours || 0) * rules.fourBonus;
    battingPoints += (stats.sixes || 0) * rules.sixBonus;

    // Milestone bonuses (highest only)
    if (runs >= 100) bonusPoints += rules.milestone100;
    else if (runs >= 75) bonusPoints += rules.milestone75;
    else if (runs >= 50) bonusPoints += rules.milestone50;
    else if (runs >= 25) bonusPoints += rules.milestone25;

    // Duck penalty (out for 0, must have faced at least 1 ball)
    if (runs === 0 && stats.isOut && balls > 0) {
      penaltyPoints += rules.duckPenalty;
    }

    // Strike rate tiers (eligible: min 10 balls faced OR 20+ runs)
    if (balls >= 10 || runs >= 20) {
      const sr = balls > 0 ? (runs / balls) * 100 : 0;
      if (sr > 190) bonusPoints += rules.srAbove190;
      else if (sr > 170) bonusPoints += rules.sr170to190;
      else if (sr > 150) bonusPoints += rules.sr150to170;
      else if (sr > 130) bonusPoints += rules.sr130to150;
      else if (sr >= 70 && sr <= 100) penaltyPoints += rules.sr70to100;
      else if (sr >= 60 && sr < 70) penaltyPoints += rules.sr60to70;
      else if (sr >= 50 && sr < 60) penaltyPoints += rules.sr50to60;
    }
  }

  // ── Bowling ──
  if (stats.didBowl) {
    const wickets = stats.wickets || 0;
    const overs = stats.oversBowled || 0;
    const runsConceded = stats.runsConceded || 0;

    // Per wicket
    bowlingPoints += wickets * rules.wicketPoints;

    // Dot ball bonus
    bowlingPoints += (stats.dotBalls || 0) * rules.dotBallPoints;

    // LBW/Bowled bonus
    const lbwBowledCount = (stats.lbwWickets || 0) + (stats.bowledWickets || 0);
    bowlingPoints += lbwBowledCount * rules.lbwBowledBonus;

    // Maiden overs
    bowlingPoints += (stats.maidens || 0) * rules.maidenPoints;

    // Wicket milestones (highest only)
    if (wickets >= 5) bonusPoints += rules.wickets5Bonus;
    else if (wickets >= 4) bonusPoints += rules.wickets4Bonus;
    else if (wickets >= 3) bonusPoints += rules.wickets3Bonus;

    // Economy rate tiers (min 2 overs bowled)
    if (overs >= 2) {
      const economy = runsConceded / overs;
      if (economy < 5) bonusPoints += rules.econBelow5;
      else if (economy < 6) bonusPoints += rules.econ5to6;
      else if (economy < 7) bonusPoints += rules.econ6to7;
      else if (economy < 8) bonusPoints += rules.econ7to8;
      else if (economy >= 10 && economy < 11) penaltyPoints += rules.econ10to11;
      else if (economy >= 11 && economy < 12) penaltyPoints += rules.econ11to12;
      else if (economy >= 12) penaltyPoints += rules.econAbove12;
    }
  }

  // ── Fielding ──
  const catches = stats.catches || 0;
  fieldingPoints += catches * rules.catchPoints;
  // 3+ catches bonus (once per match)
  if (catches >= 3) fieldingPoints += rules.threeCatchBonus;
  fieldingPoints += (stats.stumpings || 0) * rules.stumpingPoints;
  fieldingPoints += (stats.runOuts || 0) * rules.runOutPoints;

  const baseTotal = battingPoints + bowlingPoints + fieldingPoints + bonusPoints + penaltyPoints;
  const multiplier = isCaptain ? rules.captainMultiplier
    : isViceCaptain ? rules.vcMultiplier
    : 1;
  const finalTotal = Math.round(baseTotal * multiplier);

  return {
    playerId: stats.playerId,
    playerName: stats.playerName,
    team: stats.team,
    matchId: stats.matchId,
    battingPoints,
    bowlingPoints,
    fieldingPoints,
    bonusPoints,
    penaltyPoints,
    baseTotal,
    isCaptain,
    isViceCaptain,
    multiplier,
    finalTotal,
  };
}

// ─── Squad result for one user ───

export interface SquadMatchResult {
  matchId: string;
  playerScores: FantasyPlayerMatchPoints[];
  matchTotal: number;
}

export interface SquadLeaderboardEntry {
  userId: string;
  userName: string;
  displayName: string;
  squadId: string;
  players: FantasyPickedPlayer[];
  captainId?: string;
  viceCaptainId?: string;
  matchResults: SquadMatchResult[];     // per-match breakdown
  totalPoints: number;                  // sum across all matches
  matchesPlayed: number;                // how many matches had at least 1 player score
}

// ─── Compute full leaderboard for a league ───

/**
 * Given all tournament playerMatchStats and all squads in a league,
 * compute the full leaderboard with per-match breakdowns.
 *
 * This runs entirely client-side, no Firestore writes.
 */
export function computeLeagueLeaderboard(
  allStats: PlayerMatchStatsDoc[],
  completedMatchIds: string[],
  squads: Array<{
    squadId: string;
    userId: string;
    userName: string;
    displayName: string;
    players: FantasyPickedPlayer[];
    captainId?: string;
    viceCaptainId?: string;
  }>,
  scoringRules: FantasyScoringRules = DEFAULT_FANTASY_SCORING
): SquadLeaderboardEntry[] {
  // Group stats by matchId for efficient lookup
  const statsByMatch = new Map<string, PlayerMatchStatsDoc[]>();
  for (const stat of allStats) {
    if (!completedMatchIds.includes(stat.matchId)) continue;
    const arr = statsByMatch.get(stat.matchId) || [];
    arr.push(stat);
    statsByMatch.set(stat.matchId, arr);
  }

  const entries: SquadLeaderboardEntry[] = [];

  for (const squad of squads) {
    const matchResults: SquadMatchResult[] = [];

    for (const matchId of completedMatchIds) {
      const matchStats = statsByMatch.get(matchId) || [];
      if (matchStats.length === 0) continue;

      const playerScores: FantasyPlayerMatchPoints[] = [];

      for (const squadPlayer of squad.players) {
        // Find this squad player in the match stats using name matching
        const stat = matchStats.find(ms => playerNamesMatch(squadPlayer.name, ms.playerName));
        if (!stat) continue;

        const isCaptain = squad.captainId === squadPlayer.playerId;
        const isVC = squad.viceCaptainId === squadPlayer.playerId;

        const points = calculatePointsForPlayer(stat, scoringRules, isCaptain, isVC);
        // Use squad's playerId for consistency
        points.playerId = squadPlayer.playerId;
        playerScores.push(points);
      }

      if (playerScores.length > 0) {
        matchResults.push({
          matchId,
          playerScores,
          matchTotal: playerScores.reduce((sum, ps) => sum + ps.finalTotal, 0),
        });
      }
    }

    const totalPoints = matchResults.reduce((sum, mr) => sum + mr.matchTotal, 0);

    entries.push({
      userId: squad.userId,
      userName: squad.userName,
      displayName: squad.displayName,
      squadId: squad.squadId,
      players: squad.players,
      captainId: squad.captainId,
      viceCaptainId: squad.viceCaptainId,
      matchResults,
      totalPoints,
      matchesPlayed: matchResults.length,
    });
  }

  // Sort by total points descending
  entries.sort((a, b) => b.totalPoints - a.totalPoints);

  return entries;
}

// ─── Tournament-wide player points table ───

export interface TournamentPlayerPoints {
  playerId: string;
  playerName: string;
  team: string;
  matches: number;
  totalPoints: number;
  battingPoints: number;
  bowlingPoints: number;
  fieldingPoints: number;
  bonusPoints: number;
  // Key stats
  totalRuns: number;
  totalWickets: number;
  totalCatches: number;
  potmCount: number;
  // Best match
  bestMatchPoints: number;
  bestMatchId: string;
}

/**
 * Compute tournament-wide player points table from all playerMatchStats.
 * Uses DEFAULT scoring rules (not league-specific) for a universal view.
 */
export function computeTournamentPlayerTable(
  allStats: PlayerMatchStatsDoc[],
  scoringRules: FantasyScoringRules = DEFAULT_FANTASY_SCORING
): TournamentPlayerPoints[] {
  const playerMap = new Map<string, TournamentPlayerPoints>();

  // Group stats by player
  const statsByPlayer = new Map<string, PlayerMatchStatsDoc[]>();
  for (const stat of allStats) {
    const arr = statsByPlayer.get(stat.playerId) || [];
    arr.push(stat);
    statsByPlayer.set(stat.playerId, arr);
  }

  for (const [playerId, stats] of statsByPlayer) {
    let totalPts = 0, batPts = 0, bowlPts = 0, fieldPts = 0, bonPts = 0;
    let totalRuns = 0, totalWickets = 0, totalCatches = 0, potmCount = 0;
    let bestMatchPoints = 0, bestMatchId = '';

    for (const stat of stats) {
      const pts = calculatePointsForPlayer(stat, scoringRules);
      totalPts += pts.finalTotal;
      batPts += pts.battingPoints;
      bowlPts += pts.bowlingPoints;
      fieldPts += pts.fieldingPoints;
      bonPts += pts.bonusPoints + pts.penaltyPoints;

      totalRuns += stat.runs || 0;
      totalWickets += stat.wickets || 0;
      totalCatches += (stat.catches || 0) + (stat.stumpings || 0);
      if (stat.isPotm) potmCount++;

      if (pts.finalTotal > bestMatchPoints) {
        bestMatchPoints = pts.finalTotal;
        bestMatchId = stat.matchId;
      }
    }

    playerMap.set(playerId, {
      playerId,
      playerName: stats[0].playerName,
      team: stats[0].team,
      matches: stats.length,
      totalPoints: totalPts,
      battingPoints: batPts,
      bowlingPoints: bowlPts,
      fieldingPoints: fieldPts,
      bonusPoints: bonPts,
      totalRuns,
      totalWickets,
      totalCatches,
      potmCount,
      bestMatchPoints,
      bestMatchId,
    });
  }

  // Sort by total points descending
  const result = Array.from(playerMap.values());
  result.sort((a, b) => b.totalPoints - a.totalPoints);
  return result;
}
