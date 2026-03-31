'use client';

import { useEffect, useState, useMemo } from 'react';
import { Trophy, ChevronDown, ChevronUp, Users, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  getLeagueSquads,
  getMatchesForTournament,
} from '@/lib/fantasy-firestore';
import { fetchTournamentPlayerStats } from '@/lib/fantasy-api';
import { computeLeagueLeaderboard, type SquadLeaderboardEntry } from '@/lib/fantasy-points-calculator';
import { DEFAULT_FANTASY_SCORING } from '@/types/fantasy';
import type { FantasySquad, CricketMatch } from '@/types/fantasy';
import type { FantasyLeague, AuctionState } from '@/types/fantasy';

interface FantasyLeaderboardProps {
  league: FantasyLeague;
  auctionState: AuctionState;
  currentUserId: string;
  isLight: boolean;
}

export default function FantasyLeaderboard({ league, auctionState, currentUserId, isLight }: FantasyLeaderboardProps) {
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<SquadLeaderboardEntry[]>([]);
  const [matches, setMatches] = useState<CricketMatch[]>([]);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Load squads, match stats, and matches in parallel
        const [squads, allStats, tournamentMatches] = await Promise.all([
          getLeagueSquads(league.id),
          fetchTournamentPlayerStats(league.tournamentId),
          getMatchesForTournament(league.tournamentId),
        ]);
        if (cancelled) return;

        setMatches(tournamentMatches);

        // Get completed match IDs
        const completedMatchIds = tournamentMatches
          .filter(m => m.status === 'completed' && m.scorecardFetched)
          .map(m => m.id);

        // Build squad data for calculator
        const squadData = squads.map(sq => ({
          squadId: sq.id,
          userId: sq.userId,
          userName: sq.userName,
          displayName: sq.displayName || sq.userName,
          players: sq.players || [],
          captainId: sq.captainId,
          viceCaptainId: sq.viceCaptainId,
        }));

        // Compute scoring rules
        const scoringRules = { ...DEFAULT_FANTASY_SCORING, ...(league.settings?.scoringOverrides || {}) };

        // Calculate leaderboard on-demand
        const results = computeLeagueLeaderboard(allStats, completedMatchIds, squadData, scoringRules);
        if (!cancelled) setLeaderboard(results);
      } catch (err) {
        console.error('Failed to load leaderboard:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [league.id, league.tournamentId, league.settings?.scoringOverrides]);

  // Match lookup for display
  const matchLookup = useMemo(() => {
    const map = new Map<string, CricketMatch>();
    matches.forEach(m => map.set(m.id, m));
    return map;
  }, [matches]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Card key={i} className="border-[var(--border)]">
            <CardContent className="p-4 h-16 animate-pulse bg-[var(--bg-hover)]" />
          </Card>
        ))}
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <Card className="border-[var(--border)]">
        <CardContent className="p-8 text-center">
          <Users size={32} className="text-[var(--text-muted)] mx-auto mb-2" />
          <p className="text-sm text-[var(--text-muted)]">No scores yet. Points will appear once match scorecards are fetched.</p>
        </CardContent>
      </Card>
    );
  }

  const hasScores = leaderboard.some(r => r.totalPoints > 0);
  const totalCompleted = matches.filter(m => m.status === 'completed' && m.scorecardFetched).length;

  return (
    <div className="space-y-2">
      {/* Summary header */}
      {hasScores && (
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-xs text-[var(--text-muted)]">
            After {totalCompleted} match{totalCompleted !== 1 ? 'es' : ''}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {leaderboard.length} teams
          </span>
        </div>
      )}

      {/* Podium for top 3 */}
      {hasScores && leaderboard.length >= 3 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[leaderboard[1], leaderboard[0], leaderboard[2]].map((r, idx) => {
            const isMe = r.userId === currentUserId;
            const heights = ['h-20', 'h-24', 'h-16'];
            const colors = [
              'from-gray-400/20 to-gray-500/5',
              'from-amber-400/20 to-amber-500/5',
              'from-orange-600/20 to-orange-700/5',
            ];
            const badges = ['🥈', '🥇', '🥉'];

            return (
              <div key={r.userId} className="flex flex-col items-center">
                <span className="text-lg mb-1">{badges[idx]}</span>
                <span className={`text-xs font-bold truncate max-w-full ${isMe ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                  {r.displayName}
                </span>
                <span className="text-sm font-bold text-[var(--accent)] mt-0.5">{r.totalPoints}</span>
                <div className={`w-full ${heights[idx]} rounded-t-lg bg-gradient-to-t ${colors[idx]} mt-1 border border-b-0 border-[var(--border)]`} />
              </div>
            );
          })}
        </div>
      )}

      {/* Full leaderboard */}
      {leaderboard.map((row, rank) => {
        const isMe = row.userId === currentUserId;
        const isExpanded = expandedUser === row.userId;

        return (
          <Card
            key={row.userId}
            className={`border overflow-hidden transition-all cursor-pointer ${
              isMe ? 'border-[var(--accent)]/40 ring-1 ring-[var(--accent)]/20' : 'border-[var(--border)]'
            }`}
            onClick={() => setExpandedUser(isExpanded ? null : row.userId)}
          >
            <CardContent className="p-0">
              {/* Main row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  rank === 0 ? 'bg-amber-500/20 text-amber-400'
                  : rank === 1 ? 'bg-gray-400/20 text-gray-400'
                  : rank === 2 ? 'bg-orange-600/20 text-orange-400'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                }`}>
                  {rank + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-bold truncate ${isMe ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                      {row.displayName}
                    </span>
                    {isMe && <Badge className="bg-[var(--accent)]/15 text-[var(--accent)] border-0 text-[9px]">you</Badge>}
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {row.players.length} players · {row.matchesPlayed} matches
                  </span>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-[var(--text-primary)]">{row.totalPoints} pts</div>
                </div>

                <div className="shrink-0 text-[var(--text-muted)]">
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>

              {/* Expanded: per-match breakdown */}
              {isExpanded && row.matchResults.length > 0 && (
                <div className="border-t border-[var(--border)] px-4 py-3 bg-[var(--bg-elevated)]/50">
                  <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                    Match Breakdown
                  </div>
                  <div className="space-y-1.5">
                    {row.matchResults.map((mr) => {
                      const match = matchLookup.get(mr.matchId);
                      return (
                        <div key={mr.matchId} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[var(--text-secondary)] truncate">
                              {match ? `${match.team1.shortName} vs ${match.team2.shortName}` : mr.matchId}
                            </span>
                            <span className="text-[var(--text-muted)] shrink-0">
                              ({mr.playerScores.length} scored)
                            </span>
                          </div>
                          <span className="font-bold text-[var(--text-primary)] shrink-0">{mr.matchTotal} pts</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold mt-2 pt-2 border-t border-[var(--border)]">
                    <span className="text-[var(--text-primary)]">Total</span>
                    <span className="text-[var(--accent)]">{row.totalPoints} pts</span>
                  </div>
                </div>
              )}

              {isExpanded && row.matchResults.length === 0 && (
                <div className="border-t border-[var(--border)] px-4 py-3 bg-[var(--bg-elevated)]/50">
                  <p className="text-xs text-[var(--text-muted)] text-center">No match scores yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {!hasScores && (
        <div className="text-center py-4">
          <p className="text-xs text-[var(--text-muted)]">
            All teams at 0 points. The leaderboard will update after match scorecards are fetched.
          </p>
        </div>
      )}
    </div>
  );
}
