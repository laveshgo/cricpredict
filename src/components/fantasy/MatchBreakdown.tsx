'use client';

import { useEffect, useState, useMemo } from 'react';
import { Calendar, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  getLeagueSquads,
  getMatchesForTournament,
} from '@/lib/fantasy-firestore';
import { fetchTournamentPlayerStats } from '@/lib/fantasy-api';
import { computeLeagueLeaderboard, type SquadLeaderboardEntry, type SquadMatchResult } from '@/lib/fantasy-points-calculator';
import { DEFAULT_FANTASY_SCORING } from '@/types/fantasy';
import type { FantasySquad, CricketMatch, FantasyPlayerMatchPoints, PlayerRole } from '@/types/fantasy';
import type { FantasyLeague, AuctionState } from '@/types/fantasy';

const ROLE_COLORS: Record<PlayerRole, { dark: string; light: string }> = {
  WK: { dark: 'bg-amber-500/20 text-amber-400 border-amber-500/30', light: 'bg-amber-100 text-amber-700 border-amber-300' },
  BAT: { dark: 'bg-blue-500/20 text-blue-400 border-blue-500/30', light: 'bg-blue-100 text-blue-700 border-blue-300' },
  AR: { dark: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', light: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  BOWL: { dark: 'bg-purple-500/20 text-purple-400 border-purple-500/30', light: 'bg-purple-100 text-purple-700 border-purple-300' },
};

interface MatchBreakdownProps {
  league: FantasyLeague;
  auctionState: AuctionState;
  currentUserId: string;
  isLight: boolean;
}

export default function MatchBreakdown({ league, auctionState, currentUserId, isLight }: MatchBreakdownProps) {
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<SquadLeaderboardEntry[]>([]);
  const [matches, setMatches] = useState<CricketMatch[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [squads, allStats, tournamentMatches] = await Promise.all([
          getLeagueSquads(league.id),
          fetchTournamentPlayerStats(league.tournamentId),
          getMatchesForTournament(league.tournamentId),
        ]);
        if (cancelled) return;

        setMatches(tournamentMatches);

        const completedMatchIds = tournamentMatches
          .filter(m => m.status === 'completed' && m.scorecardFetched)
          .map(m => m.id);

        const squadData = squads.map(sq => ({
          squadId: sq.id,
          userId: sq.userId,
          userName: sq.userName,
          displayName: sq.displayName || sq.userName,
          players: sq.players || [],
          captainId: sq.captainId,
          viceCaptainId: sq.viceCaptainId,
        }));

        const scoringRules = { ...DEFAULT_FANTASY_SCORING, ...(league.settings?.scoringOverrides || {}) };
        const results = computeLeagueLeaderboard(allStats, completedMatchIds, squadData, scoringRules);

        if (!cancelled) {
          setLeaderboard(results);
          // Auto-select latest completed match
          if (completedMatchIds.length > 0) {
            const sorted = tournamentMatches
              .filter(m => completedMatchIds.includes(m.id))
              .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
            setSelectedMatchId(sorted[0]?.id || null);
          }
        }
      } catch (err) {
        console.error('Failed to load match breakdown:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [league.id, league.tournamentId, league.settings?.scoringOverrides]);

  // Get completed matches for selector
  const completedMatches = useMemo(() => {
    return matches
      .filter(m => m.status === 'completed' && m.scorecardFetched)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [matches]);

  // Get per-user scores for the selected match
  const matchScores = useMemo(() => {
    if (!selectedMatchId) return [];
    return leaderboard
      .map(entry => {
        const matchResult = entry.matchResults.find(mr => mr.matchId === selectedMatchId);
        return {
          userId: entry.userId,
          userName: entry.userName,
          displayName: entry.displayName,
          matchResult: matchResult || null,
          matchTotal: matchResult?.matchTotal || 0,
        };
      })
      .sort((a, b) => b.matchTotal - a.matchTotal);
  }, [leaderboard, selectedMatchId]);

  // Player role lookup from auction
  const playerRoleLookup = useMemo(() => {
    const map = new Map<string, PlayerRole>();
    auctionState.soldPlayers?.forEach(p => {
      map.set(p.playerId, p.role);
    });
    return map;
  }, [auctionState.soldPlayers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (completedMatches.length === 0) {
    return (
      <Card className="border-[var(--border)]">
        <CardContent className="p-8 text-center">
          <Calendar size={32} className="text-[var(--text-muted)] mx-auto mb-2" />
          <p className="text-sm font-medium text-[var(--text-primary)] mb-1">No match data yet</p>
          <p className="text-xs text-[var(--text-muted)]">
            Match-by-match breakdowns will appear here once scorecards are fetched.
          </p>
        </CardContent>
      </Card>
    );
  }

  const selectedMatch = completedMatches.find(m => m.id === selectedMatchId);

  return (
    <div className="space-y-4">
      {/* Match selector pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {completedMatches.map((m) => (
          <button
            key={m.id}
            onClick={() => { setSelectedMatchId(m.id); setExpandedUser(null); }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all shrink-0 ${
              m.id === selectedMatchId
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--accent)]/50'
            }`}
          >
            {m.team1.shortName} vs {m.team2.shortName}
          </button>
        ))}
      </div>

      {/* Match info */}
      {selectedMatch && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-[var(--text-muted)]">
            {selectedMatch.matchDesc}
            {selectedMatch.statusText && ` · ${selectedMatch.statusText}`}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {matchScores.filter(s => s.matchTotal > 0).length} teams scored
          </span>
        </div>
      )}

      {/* User scores for this match */}
      {matchScores.length === 0 ? (
        <Card className="border-[var(--border)]">
          <CardContent className="p-6 text-center">
            <p className="text-xs text-[var(--text-muted)]">No scores for this match.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {matchScores.map((ms, idx) => {
            const isMe = ms.userId === currentUserId;
            const isExpanded = expandedUser === ms.userId;
            const sortedPlayers = [...(ms.matchResult?.playerScores || [])].sort((a, b) => b.finalTotal - a.finalTotal);

            return (
              <Card
                key={ms.userId}
                className={`border overflow-hidden transition-all cursor-pointer ${
                  isMe ? 'border-[var(--accent)]/40 ring-1 ring-[var(--accent)]/20' : 'border-[var(--border)]'
                }`}
                onClick={() => setExpandedUser(isExpanded ? null : ms.userId)}
              >
                <CardContent className="p-0">
                  {/* Summary row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      idx === 0 ? 'bg-amber-500/20 text-amber-400'
                      : idx === 1 ? 'bg-gray-400/20 text-gray-400'
                      : idx === 2 ? 'bg-orange-600/20 text-orange-400'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                    }`}>
                      {idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-bold truncate ${isMe ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                          {ms.displayName}
                        </span>
                        {isMe && <Badge className="bg-[var(--accent)]/15 text-[var(--accent)] border-0 text-[9px]">you</Badge>}
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {sortedPlayers.length} players scored
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-[var(--accent)]">{ms.matchTotal} pts</div>
                    </div>

                    <div className="shrink-0 text-[var(--text-muted)]">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </div>

                  {/* Expanded: player-by-player breakdown */}
                  {isExpanded && sortedPlayers.length > 0 && (
                    <div className="border-t border-[var(--border)] bg-[var(--bg-elevated)]/50">
                      {/* Column headers */}
                      <div className="flex items-center gap-2 px-4 py-2 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)]/50">
                        <span className="flex-1">Player</span>
                        <span className="w-10 text-center">Bat</span>
                        <span className="w-10 text-center">Bowl</span>
                        <span className="w-10 text-center">Field</span>
                        <span className="w-10 text-center">Bonus</span>
                        <span className="w-12 text-right">Total</span>
                      </div>

                      {sortedPlayers.map((ps) => {
                        const role = playerRoleLookup.get(ps.playerId);
                        return (
                          <div key={ps.playerId} className="flex items-center gap-2 px-4 py-2 hover:bg-[var(--bg-elevated)]/80 transition-colors">
                            <div className="flex-1 min-w-0 flex items-center gap-1.5">
                              {role && (
                                <Badge className={`text-[7px] font-bold px-1 py-0 border shrink-0 ${isLight ? ROLE_COLORS[role].light : ROLE_COLORS[role].dark}`}>
                                  {role}
                                </Badge>
                              )}
                              <span className="text-xs text-[var(--text-primary)] truncate">{ps.playerName}</span>
                              <span className="text-[10px] text-[var(--text-muted)] shrink-0">{ps.team}</span>
                            </div>
                            <span className={`w-10 text-center text-xs ${ps.battingPoints > 0 ? 'text-blue-400' : ps.battingPoints < 0 ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
                              {ps.battingPoints || '-'}
                            </span>
                            <span className={`w-10 text-center text-xs ${ps.bowlingPoints > 0 ? 'text-purple-400' : ps.bowlingPoints < 0 ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
                              {ps.bowlingPoints || '-'}
                            </span>
                            <span className={`w-10 text-center text-xs ${ps.fieldingPoints > 0 ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`}>
                              {ps.fieldingPoints || '-'}
                            </span>
                            <span className={`w-10 text-center text-xs ${ps.bonusPoints > 0 ? 'text-amber-400' : ps.penaltyPoints < 0 ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
                              {(ps.bonusPoints + ps.penaltyPoints) || '-'}
                            </span>
                            <span className={`w-12 text-right text-xs font-bold ${ps.finalTotal > 0 ? 'text-[var(--text-primary)]' : ps.finalTotal < 0 ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
                              {ps.finalTotal}
                            </span>
                          </div>
                        );
                      })}

                      {/* Total row */}
                      <div className="flex items-center gap-2 px-4 py-2 border-t border-[var(--border)] font-bold">
                        <span className="flex-1 text-xs text-[var(--text-primary)]">Total</span>
                        <span className="w-10 text-center text-xs text-blue-400">
                          {sortedPlayers.reduce((s, p) => s + p.battingPoints, 0) || '-'}
                        </span>
                        <span className="w-10 text-center text-xs text-purple-400">
                          {sortedPlayers.reduce((s, p) => s + p.bowlingPoints, 0) || '-'}
                        </span>
                        <span className="w-10 text-center text-xs text-emerald-400">
                          {sortedPlayers.reduce((s, p) => s + p.fieldingPoints, 0) || '-'}
                        </span>
                        <span className="w-10 text-center text-xs text-amber-400">
                          {sortedPlayers.reduce((s, p) => s + p.bonusPoints + p.penaltyPoints, 0) || '-'}
                        </span>
                        <span className="w-12 text-right text-xs text-[var(--accent)]">{ms.matchTotal}</span>
                      </div>
                    </div>
                  )}

                  {isExpanded && sortedPlayers.length === 0 && (
                    <div className="border-t border-[var(--border)] px-4 py-3 bg-[var(--bg-elevated)]/50">
                      <p className="text-xs text-[var(--text-muted)] text-center">No players scored in this match</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
