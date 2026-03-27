// Fantasy scoring engine — calculates points from player match stats
import type {
  FantasyScoringRules,
  PlayerMatchStats,
  FantasyPlayerMatchPoints,
  PlayerRole,
} from '@/types/fantasy';
import { DEFAULT_FANTASY_SCORING } from '@/types/fantasy';

// ─── Calculate base fantasy points for a player in a match ───
export function calculatePlayerPoints(
  stats: PlayerMatchStats,
  role: PlayerRole,
  rules: FantasyScoringRules = DEFAULT_FANTASY_SCORING,
): Omit<FantasyPlayerMatchPoints, 'isCaptain' | 'isViceCaptain' | 'multiplier' | 'finalTotal'> {
  let battingPoints = 0;
  let bowlingPoints = 0;
  let fieldingPoints = 0;
  let bonusPoints = 0;
  let penaltyPoints = 0;

  // ─── Batting ───
  if (stats.didBat && stats.runs != null) {
    // Base run points
    battingPoints += stats.runs * rules.runPoints;

    // Boundary bonuses
    battingPoints += (stats.fours ?? 0) * rules.boundaryBonus;
    battingPoints += (stats.sixes ?? 0) * rules.sixBonus;

    // Milestone bonuses (only the highest applies)
    if (stats.runs >= 100) {
      bonusPoints += rules.centuryBonus;
    } else if (stats.runs >= 50) {
      bonusPoints += rules.halfCenturyBonus;
    } else if (stats.runs >= 30) {
      bonusPoints += rules.thirtyBonus;
    }

    // Strike rate bonus/penalty (min 10 balls faced)
    if (stats.ballsFaced && stats.ballsFaced >= 10) {
      const sr = (stats.runs / stats.ballsFaced) * 100;
      if (sr >= rules.strikeRateBonus.threshold) {
        bonusPoints += rules.strikeRateBonus.bonus;
      } else if (sr <= rules.strikeRatePenalty.threshold) {
        penaltyPoints += rules.strikeRatePenalty.penalty;
      }
    }

    // Duck penalty (BAT, WK, AR only — not pure bowlers)
    if (stats.runs === 0 && stats.isOut && role !== 'BOWL') {
      penaltyPoints += rules.duckPenalty;
    }
  }

  // ─── Bowling ───
  if (stats.didBowl && stats.wickets != null) {
    // Wicket points
    bowlingPoints += stats.wickets * rules.wicketPoints;

    // Maiden overs
    bowlingPoints += (stats.maidens ?? 0) * rules.maidenPoints;

    // Wicket haul bonuses (only highest applies)
    if (stats.wickets >= 5) {
      bonusPoints += rules.fiveWicketBonus;
    } else if (stats.wickets >= 3) {
      bonusPoints += rules.threeWicketBonus;
    }

    // Economy bonus/penalty (min 2 overs bowled)
    if (stats.oversBowled && stats.oversBowled >= 2 && stats.runsConceded != null) {
      const economy = stats.runsConceded / stats.oversBowled;
      if (economy <= rules.economyBonus.threshold) {
        bonusPoints += rules.economyBonus.bonus;
      } else if (economy >= rules.economyPenalty.threshold) {
        penaltyPoints += rules.economyPenalty.penalty;
      }
    }
  }

  // ─── Fielding ───
  fieldingPoints += (stats.catches ?? 0) * rules.catchPoints;
  fieldingPoints += (stats.stumpings ?? 0) * rules.stumpingPoints;
  fieldingPoints += (stats.runOuts ?? 0) * rules.runOutPoints;

  // ─── Player of the Match ───
  if (stats.isPotm) {
    bonusPoints += rules.potmPoints;
  }

  // ─── DNC penalty (was in team playing XI but didn't bat or bowl) ───
  if (stats.inPlayingXI && !stats.didBat && !stats.didBowl) {
    penaltyPoints += rules.dncPenalty;
  }

  const baseTotal = battingPoints + bowlingPoints + fieldingPoints + bonusPoints + penaltyPoints;

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
  };
}

// ─── Apply captain/VC multiplier ───
export function applyMultiplier(
  points: Omit<FantasyPlayerMatchPoints, 'isCaptain' | 'isViceCaptain' | 'multiplier' | 'finalTotal'>,
  captainId: string,
  vcId: string,
  rules: FantasyScoringRules = DEFAULT_FANTASY_SCORING,
): FantasyPlayerMatchPoints {
  const isCaptain = points.playerId === captainId;
  const isViceCaptain = points.playerId === vcId;
  const multiplier = isCaptain
    ? rules.captainMultiplier
    : isViceCaptain
      ? rules.vcMultiplier
      : 1;

  return {
    ...points,
    isCaptain,
    isViceCaptain,
    multiplier,
    finalTotal: Math.round(points.baseTotal * multiplier * 10) / 10, // round to 1 decimal
  };
}

// ─── Calculate total XI points for a week ───
export function calculateWeeklyXIPoints(
  playerStats: PlayerMatchStats[],
  playingXI: string[],           // 11 playerIds
  bench: string[],               // 4 playerIds
  captainId: string,
  vcId: string,
  weekNumber: number,
  playerRoles: Record<string, PlayerRole>, // playerId -> role
  rules: FantasyScoringRules = DEFAULT_FANTASY_SCORING,
): {
  xiScores: FantasyPlayerMatchPoints[];
  benchScores: FantasyPlayerMatchPoints[];
  weekTotal: number;
} {
  const xiScores: FantasyPlayerMatchPoints[] = [];
  const benchScores: FantasyPlayerMatchPoints[] = [];

  // Calculate XI player scores
  for (const playerId of playingXI) {
    const stats = playerStats.filter(s => s.playerId === playerId);
    if (stats.length === 0) {
      // Player had no match this week — 0 points
      xiScores.push(applyMultiplier({
        playerId,
        playerName: '',
        team: '',
        matchId: '',
        battingPoints: 0,
        bowlingPoints: 0,
        fieldingPoints: 0,
        bonusPoints: 0,
        penaltyPoints: 0,
        baseTotal: 0,
      }, captainId, vcId, rules));
      continue;
    }

    // Sum points across all matches in the week
    let totalBase = 0;
    let totalBat = 0;
    let totalBowl = 0;
    let totalField = 0;
    let totalBonus = 0;
    let totalPenalty = 0;

    for (const stat of stats) {
      const role = playerRoles[playerId] || 'BAT';
      const pts = calculatePlayerPoints(stat, role, rules);
      totalBat += pts.battingPoints;
      totalBowl += pts.bowlingPoints;
      totalField += pts.fieldingPoints;
      totalBonus += pts.bonusPoints;
      totalPenalty += pts.penaltyPoints;
      totalBase += pts.baseTotal;
    }

    xiScores.push(applyMultiplier({
      playerId,
      playerName: stats[0].playerName,
      team: stats[0].team,
      matchId: stats.map(s => s.matchId).join(','),
      battingPoints: totalBat,
      bowlingPoints: totalBowl,
      fieldingPoints: totalField,
      bonusPoints: totalBonus,
      penaltyPoints: totalPenalty,
      baseTotal: totalBase,
    }, captainId, vcId, rules));
  }

  // Calculate bench scores (for display only, not counted)
  for (const playerId of bench) {
    const stats = playerStats.filter(s => s.playerId === playerId);
    if (stats.length === 0) continue;

    let totalBase = 0;
    for (const stat of stats) {
      const role = playerRoles[playerId] || 'BAT';
      const pts = calculatePlayerPoints(stat, role, rules);
      totalBase += pts.baseTotal;
    }

    benchScores.push({
      playerId,
      playerName: stats[0].playerName,
      team: stats[0].team,
      matchId: stats.map(s => s.matchId).join(','),
      battingPoints: 0,
      bowlingPoints: 0,
      fieldingPoints: 0,
      bonusPoints: 0,
      penaltyPoints: 0,
      baseTotal: totalBase,
      isCaptain: false,
      isViceCaptain: false,
      multiplier: 1,
      finalTotal: totalBase, // no multiplier on bench
    });
  }

  const weekTotal = xiScores.reduce((sum, s) => sum + s.finalTotal, 0);

  return { xiScores, benchScores, weekTotal };
}

// ─── Format points for display ───
export function formatPoints(points: number): string {
  if (points === 0) return '0';
  if (Number.isInteger(points)) return points.toString();
  return points.toFixed(1);
}

// ─── Get scoring rules description (for rules page) ───
export function getScoringDescription(rules: FantasyScoringRules = DEFAULT_FANTASY_SCORING) {
  return {
    batting: [
      { label: 'Run scored', points: rules.runPoints },
      { label: 'Boundary (4s)', points: rules.boundaryBonus },
      { label: 'Six', points: rules.sixBonus },
      { label: '30 runs bonus', points: rules.thirtyBonus },
      { label: 'Half-century bonus', points: rules.halfCenturyBonus },
      { label: 'Century bonus', points: rules.centuryBonus },
      { label: `Strike rate >${rules.strikeRateBonus.threshold}`, points: rules.strikeRateBonus.bonus },
      { label: `Strike rate <${rules.strikeRatePenalty.threshold}`, points: rules.strikeRatePenalty.penalty },
      { label: 'Duck (BAT/WK/AR)', points: rules.duckPenalty },
    ],
    bowling: [
      { label: 'Wicket', points: rules.wicketPoints },
      { label: '3-wicket haul bonus', points: rules.threeWicketBonus },
      { label: '5-wicket haul bonus', points: rules.fiveWicketBonus },
      { label: 'Maiden over', points: rules.maidenPoints },
      { label: `Economy <${rules.economyBonus.threshold}`, points: rules.economyBonus.bonus },
      { label: `Economy >${rules.economyPenalty.threshold}`, points: rules.economyPenalty.penalty },
    ],
    fielding: [
      { label: 'Catch', points: rules.catchPoints },
      { label: 'Stumping', points: rules.stumpingPoints },
      { label: 'Run out (direct)', points: rules.runOutPoints },
    ],
    awards: [
      { label: 'Player of the Match', points: rules.potmPoints },
    ],
    multipliers: [
      { label: 'Captain', points: `${rules.captainMultiplier}x` },
      { label: 'Vice-Captain', points: `${rules.vcMultiplier}x` },
    ],
  };
}
