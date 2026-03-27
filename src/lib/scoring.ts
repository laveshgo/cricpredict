/**
 * Scoring engine — ported from the original IPL prediction app.
 * Calculates scores by comparing predictions against actual results.
 */

import type {
  ScoringConfig,
  TournamentPrediction,
  ActualResults,
  ScoreBreakdown,
  MatchPrediction,
  Match,
} from '@/types';

// =================== FUZZY MATCHING ===================

/** Simple fuzzy match: checks if every word in `query` appears in `target` */
export function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase().trim();
  if (q === t) return true;

  const qWords = q.split(/\s+/);
  return qWords.every((w) => t.includes(w));
}

/** Find canonical player name from a list using fuzzy matching */
export function findCanonicalPlayer(
  name: string,
  allPlayers: string[]
): string | null {
  // Exact match first
  const exact = allPlayers.find(
    (p) => p.toLowerCase() === name.toLowerCase()
  );
  if (exact) return exact;

  // Fuzzy match
  const fuzzy = allPlayers.find((p) => fuzzyMatch(name, p) || fuzzyMatch(p, name));
  return fuzzy || null;
}

// =================== SCORE CALCULATION ===================

export function calculateScore(
  prediction: TournamentPrediction,
  actual: ActualResults,
  scoring: ScoringConfig,
  matchPredictions: MatchPrediction[] = [],
  matches: Match[] = []
): ScoreBreakdown {
  const breakdown: ScoreBreakdown = {
    ranking: 0,
    winner: 0,
    runnerUp: 0,
    runs: 0,
    wickets: 0,
    mvp: 0,
    matches: 0,
    total: 0,
    details: {
      ranking: [],
      runs: [],
      wickets: [],
    },
  };

  // --- Team Ranking ---
  if (prediction.teamRanking.length > 0 && actual.teamRanking.length > 0) {
    prediction.teamRanking.forEach((team, idx) => {
      const predictedRank = idx + 1;
      const actualIdx = actual.teamRanking.indexOf(team);
      const actualRank = actualIdx >= 0 ? actualIdx + 1 : '-';
      let pts = 0;

      if (actualIdx >= 0) {
        const diff = Math.abs(idx - actualIdx);
        if (diff === 0) pts = scoring.rankExact;
        else if (diff === 1) pts = scoring.rankOff1;
        else if (diff === 2) pts = scoring.rankOff2;
      }

      breakdown.ranking += pts;
      breakdown.details.ranking.push({
        team,
        predicted: predictedRank,
        actual: actualRank,
        pts,
      });
    });
  }

  // --- Winner ---
  if (
    prediction.winner &&
    actual.winner &&
    prediction.winner.toLowerCase() === actual.winner.toLowerCase()
  ) {
    breakdown.winner = scoring.winner;
  }

  // --- Runner Up ---
  if (
    prediction.runnerUp &&
    actual.runnerUp &&
    prediction.runnerUp.toLowerCase() === actual.runnerUp.toLowerCase()
  ) {
    breakdown.runnerUp = scoring.runnerUp;
  }

  // --- Top Run Scorers ---
  if (prediction.runs.length > 0 && actual.runs.length > 0) {
    prediction.runs.forEach((player, idx) => {
      const predictedRank = idx + 1;
      const actualIdx = actual.runs.findIndex(
        (a) => a.toLowerCase() === player.toLowerCase()
      );
      let pts = 0;

      if (actualIdx >= 0) {
        if (actualIdx === idx) pts = scoring.runsExact;
        else pts = scoring.runsPartial;
      }

      breakdown.runs += pts;
      breakdown.details.runs.push({ player, predicted: predictedRank, pts });
    });
  }

  // --- Top Wicket Takers ---
  if (prediction.wickets.length > 0 && actual.wickets.length > 0) {
    prediction.wickets.forEach((player, idx) => {
      const predictedRank = idx + 1;
      const actualIdx = actual.wickets.findIndex(
        (a) => a.toLowerCase() === player.toLowerCase()
      );
      let pts = 0;

      if (actualIdx >= 0) {
        if (actualIdx === idx) pts = scoring.wicketsExact;
        else pts = scoring.wicketsPartial;
      }

      breakdown.wickets += pts;
      breakdown.details.wickets.push({ player, predicted: predictedRank, pts });
    });
  }

  // --- MVP ---
  if (
    prediction.mvp &&
    actual.mvp &&
    prediction.mvp.toLowerCase() === actual.mvp.toLowerCase()
  ) {
    breakdown.mvp = scoring.mvp;
  }

  // --- Match-by-Match ---
  if (scoring.matchWinner && matchPredictions.length > 0) {
    const completedMatches = matches.filter(
      (m) => m.status === 'completed' && m.winner
    );
    for (const match of completedMatches) {
      const mp = matchPredictions.find((p) => p.matchId === match.id);
      if (mp && mp.predictedWinner === match.winner) {
        breakdown.matches += scoring.matchWinner;
      }
    }
  }

  // --- Total ---
  breakdown.total =
    breakdown.ranking +
    breakdown.winner +
    breakdown.runnerUp +
    breakdown.runs +
    breakdown.wickets +
    breakdown.mvp +
    breakdown.matches;

  return breakdown;
}
