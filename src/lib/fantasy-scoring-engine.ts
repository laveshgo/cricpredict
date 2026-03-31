/**
 * Fantasy scoring calculation engine.
 * Takes raw match scorecard data + scoring rules → returns FantasyPlayerMatchPoints[].
 *
 * Used by:
 *   1. Admin API route to process match scores
 *   2. Can run server-side or client-side (pure functions, no Firestore deps)
 */

import type {
  FantasyScoringRules,
  FantasyPlayerMatchPoints,
  PlayerMatchStats,
  FantasyPickedPlayer,
} from '@/types/fantasy';
import { DEFAULT_FANTASY_SCORING } from '@/types/fantasy';
import type { MatchScorecard } from './cricbuzz-scorecard';

// ---------- Name matching ----------

/**
 * Normalize a player name for matching.
 * Handles: "Virat Kohli" vs "V Kohli", "MS Dhoni" vs "Mahendra Singh Dhoni"
 * We match on last name + first letter of first name as a fallback.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two player names match.
 * Handles common variations in cricket player names.
 */
export function playerNamesMatch(squadName: string, scorecardName: string): boolean {
  const a = normalizeName(squadName);
  const b = normalizeName(scorecardName);

  // Exact match
  if (a === b) return true;

  // One contains the other (handles "Virat Kohli" vs "V Kohli")
  const aParts = a.split(' ');
  const bParts = b.split(' ');

  // Match by last name + first initial
  if (aParts.length >= 2 && bParts.length >= 2) {
    const aLast = aParts[aParts.length - 1];
    const bLast = bParts[bParts.length - 1];
    const aFirst = aParts[0][0];
    const bFirst = bParts[0][0];

    if (aLast === bLast && aFirst === bFirst) return true;
  }

  // Match by last name only when one name is abbreviated (e.g., "JM Sharma" vs "Jayant Yadav Sharma")
  if (aParts.length >= 2 && bParts.length >= 2) {
    const aLast = aParts[aParts.length - 1];
    const bLast = bParts[bParts.length - 1];
    if (aLast === bLast && (aParts[0].length <= 2 || bParts[0].length <= 2)) return true;
  }

  return false;
}

// ---------- Dismissal detection helpers ----------

function isLbwDismissal(dismissal: string): boolean {
  return dismissal.trim().toLowerCase().startsWith('lbw');
}

function isBowledDismissal(dismissal: string): boolean {
  return /^b\s+\w/i.test(dismissal.trim());
}

function extractBowlerName(dismissal: string): string | null {
  const match = dismissal.match(/\bb\s+(.+)$/i);
  if (match) return match[1].trim();
  return null;
}

// ---------- Convert scorecard to PlayerMatchStats ----------

/**
 * Convert a MatchScorecard into PlayerMatchStats[] for all players.
 * This maps raw batting/bowling/fielding data to our PlayerMatchStats type.
 */
export function scorecardToPlayerStats(
  scorecard: MatchScorecard,
  matchId: string
): PlayerMatchStats[] {
  const playerMap = new Map<string, PlayerMatchStats>();

  const getOrCreate = (name: string, team: string): PlayerMatchStats => {
    // Check if player already exists (by name match)
    for (const [key, existing] of playerMap) {
      if (playerNamesMatch(key, name)) return existing;
    }
    const stats: PlayerMatchStats = {
      playerId: '',
      playerName: name,
      team,
      matchId,
    };
    playerMap.set(name, stats);
    return stats;
  };

  for (const inn of scorecard.innings) {
    const battingTeam = inn.teamShort || inn.team;
    // The bowlers in this innings belong to the OTHER team
    const bowlingTeam = scorecard.innings.find(
      i => i.team !== inn.team && i.teamShort !== inn.teamShort
    )?.teamShort || scorecard.innings.find(
      i => i.team !== inn.team
    )?.team || '';

    // Batting stats
    for (const bat of inn.batters) {
      const stats = getOrCreate(bat.name, battingTeam);
      stats.didBat = true;
      stats.runs = (stats.runs || 0) + bat.runs;
      stats.ballsFaced = (stats.ballsFaced || 0) + bat.balls;
      stats.fours = (stats.fours || 0) + bat.fours;
      stats.sixes = (stats.sixes || 0) + bat.sixes;
      stats.isOut = bat.isOut;
    }

    // Bowling stats
    for (const bowl of inn.bowlers) {
      const stats = getOrCreate(bowl.name, bowlingTeam);
      stats.didBowl = true;
      stats.wickets = (stats.wickets || 0) + bowl.wickets;
      stats.oversBowled = (stats.oversBowled || 0) + bowl.overs;
      stats.runsConceded = (stats.runsConceded || 0) + bowl.runs;
      stats.maidens = (stats.maidens || 0) + bowl.maidens;
      stats.dotBalls = (stats.dotBalls || 0) + (bowl.dotBalls || 0);
    }

    // Fielding stats
    for (const fielder of inn.fielders) {
      // Fielders belong to the bowling team (they're fielding while the other team bats)
      const stats = getOrCreate(fielder.name, bowlingTeam);
      stats.catches = (stats.catches || 0) + fielder.catches;
      stats.stumpings = (stats.stumpings || 0) + fielder.stumpings;
      stats.runOuts = (stats.runOuts || 0) + fielder.runOuts;
    }

    // LBW/Bowled detection — use wicketCode (reliable) or fall back to dismissal string
    for (const bat of inn.batters) {
      if (!bat.isOut) continue;
      const wc = (bat.wicketCode || '').toLowerCase();
      const isLbw = wc ? wc === 'lbw' : (bat.dismissal ? isLbwDismissal(bat.dismissal) : false);
      const isBowled = wc ? wc === 'bowled' : (bat.dismissal ? isBowledDismissal(bat.dismissal) : false);
      if (!isLbw && !isBowled) continue;

      const bowlerName = bat.dismissal ? extractBowlerName(bat.dismissal) : null;
      if (!bowlerName) continue;

      for (const [, stats] of playerMap) {
        if (stats.team === bowlingTeam && playerNamesMatch(stats.playerName, bowlerName)) {
          if (isLbw) stats.lbwWickets = (stats.lbwWickets || 0) + 1;
          else if (isBowled) stats.bowledWickets = (stats.bowledWickets || 0) + 1;
          break;
        }
      }
    }
  }

  // Mark POTM
  if (scorecard.potm) {
    for (const [, stats] of playerMap) {
      if (playerNamesMatch(stats.playerName, scorecard.potm)) {
        stats.isPotm = true;
        break;
      }
    }
  }

  // Mark all players as in playing XI (they appeared in scorecard)
  for (const [, stats] of playerMap) {
    stats.inPlayingXI = true;
  }

  return Array.from(playerMap.values());
}

// ---------- Calculate fantasy points ----------

/**
 * Calculate fantasy points for a single player based on their match stats.
 *
 * Scoring system:
 * - Playing XI: +4
 * - Batting: per-run, boundary bonuses, milestones (25/50/75/100), tiered SR brackets
 * - Bowling: per-wicket, dot balls, LBW/bowled bonus, maidens, milestones (3/4/5w), tiered economy
 * - Fielding: catches, 3+ catch bonus, stumpings, run outs
 * - Captain 2x, VC 1.5x
 */
export function calculatePlayerFantasyPoints(
  stats: PlayerMatchStats,
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

// ---------- Process a match for a league ----------

/**
 * Process a match scorecard and calculate fantasy points for all squads in a league.
 *
 * Returns an array of per-user score objects ready to save to Firestore.
 */
export function processMatchForLeague(
  scorecard: MatchScorecard,
  matchId: string,
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
): Array<{
  userId: string;
  userName: string;
  squadId: string;
  playerScores: FantasyPlayerMatchPoints[];
  matchTotal: number;
}> {
  // Convert scorecard to raw player stats
  const matchStats = scorecardToPlayerStats(scorecard, matchId);

  const results: Array<{
    userId: string;
    userName: string;
    squadId: string;
    playerScores: FantasyPlayerMatchPoints[];
    matchTotal: number;
  }> = [];

  for (const squad of squads) {
    const playerScores: FantasyPlayerMatchPoints[] = [];

    for (const squadPlayer of squad.players) {
      // Find this squad player in the match stats
      const matchStat = matchStats.find(
        ms => playerNamesMatch(squadPlayer.name, ms.playerName)
      );

      if (matchStat) {
        // Player was in the match
        const isCaptain = squad.captainId === squadPlayer.playerId;
        const isVC = squad.viceCaptainId === squadPlayer.playerId;

        const points = calculatePlayerFantasyPoints(
          { ...matchStat, playerId: squadPlayer.playerId },
          scoringRules,
          isCaptain,
          isVC
        );
        points.playerId = squadPlayer.playerId;
        playerScores.push(points);
      }
      // Players not in the match get 0 points (we don't add them — no score)
    }

    const matchTotal = playerScores.reduce((sum, ps) => sum + ps.finalTotal, 0);

    results.push({
      userId: squad.userId,
      userName: squad.userName || squad.displayName,
      squadId: squad.squadId,
      playerScores,
      matchTotal,
    });
  }

  return results;
}

// ---------- Process from pre-computed PlayerMatchStats ----------

/**
 * Like processMatchForLeague, but takes pre-computed PlayerMatchStats[]
 * (e.g., from tournament-level stored match data) instead of a raw scorecard.
 * Avoids re-parsing the scorecard when data is already stored.
 */
export function processMatchFromStats(
  matchStats: PlayerMatchStats[],
  matchId: string,
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
): Array<{
  userId: string;
  userName: string;
  squadId: string;
  playerScores: FantasyPlayerMatchPoints[];
  matchTotal: number;
}> {
  const results: Array<{
    userId: string;
    userName: string;
    squadId: string;
    playerScores: FantasyPlayerMatchPoints[];
    matchTotal: number;
  }> = [];

  for (const squad of squads) {
    const playerScores: FantasyPlayerMatchPoints[] = [];

    for (const squadPlayer of squad.players) {
      const matchStat = matchStats.find(
        ms => playerNamesMatch(squadPlayer.name, ms.playerName)
      );

      if (matchStat) {
        const isCaptain = squad.captainId === squadPlayer.playerId;
        const isVC = squad.viceCaptainId === squadPlayer.playerId;

        const points = calculatePlayerFantasyPoints(
          { ...matchStat, playerId: squadPlayer.playerId, matchId },
          scoringRules,
          isCaptain,
          isVC
        );
        points.playerId = squadPlayer.playerId;
        playerScores.push(points);
      }
    }

    const matchTotal = playerScores.reduce((sum, ps) => sum + ps.finalTotal, 0);

    results.push({
      userId: squad.userId,
      userName: squad.userName || squad.displayName,
      squadId: squad.squadId,
      playerScores,
      matchTotal,
    });
  }

  return results;
}
