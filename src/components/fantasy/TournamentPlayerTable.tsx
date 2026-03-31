'use client';

import { useEffect, useState, useMemo } from 'react';
import { Trophy, TrendingUp, Search, ChevronDown, ChevronUp, Star, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchTournamentPlayerStats } from '@/lib/fantasy-api';
import { computeTournamentPlayerTable, type TournamentPlayerPoints } from '@/lib/fantasy-points-calculator';
import type { PlayerMatchStatsDoc } from '@/types/fantasy';

const ROLE_COLORS: Record<string, { dark: string; light: string }> = {
  WK: { dark: 'bg-amber-500/20 text-amber-400', light: 'bg-amber-100 text-amber-700' },
  BAT: { dark: 'bg-blue-500/20 text-blue-400', light: 'bg-blue-100 text-blue-700' },
  AR: { dark: 'bg-emerald-500/20 text-emerald-400', light: 'bg-emerald-100 text-emerald-700' },
  BOWL: { dark: 'bg-purple-500/20 text-purple-400', light: 'bg-purple-100 text-purple-700' },
};

interface TournamentPlayerTableProps {
  tournamentId: string;
  isLight: boolean;
}

type SortKey = 'totalPoints' | 'battingPoints' | 'bowlingPoints' | 'fieldingPoints' | 'totalRuns' | 'totalWickets';

export default function TournamentPlayerTable({ tournamentId, isLight }: TournamentPlayerTableProps) {
  const [allStats, setAllStats] = useState<PlayerMatchStatsDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('totalPoints');
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [showCount, setShowCount] = useState(25);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const stats = await fetchTournamentPlayerStats(tournamentId);
        if (!cancelled) setAllStats(stats);
      } catch (err) {
        console.error('Failed to load tournament stats:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [tournamentId]);

  const playerTable = useMemo(() => {
    return computeTournamentPlayerTable(allStats);
  }, [allStats]);

  // Filter + sort
  const filteredPlayers = useMemo(() => {
    let result = playerTable;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.playerName.toLowerCase().includes(q) ||
        p.team.toLowerCase().includes(q)
      );
    }

    if (sortBy !== 'totalPoints') {
      result = [...result].sort((a, b) => b[sortBy] - a[sortBy]);
    }

    return result;
  }, [playerTable, search, sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (playerTable.length === 0) {
    return (
      <Card className="border-[var(--border)]">
        <CardContent className="p-8 text-center">
          <Trophy size={32} className="text-[var(--text-muted)] mx-auto mb-2" />
          <p className="text-sm font-medium text-[var(--text-primary)] mb-1">No player data yet</p>
          <p className="text-xs text-[var(--text-muted)]">
            Player stats will appear here once match scorecards are fetched.
          </p>
        </CardContent>
      </Card>
    );
  }

  const displayPlayers = filteredPlayers.slice(0, showCount);

  return (
    <div className="space-y-3">
      {/* Search + sort */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search player or team..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-xs bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
          />
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortKey)}
          className="px-3 py-2 rounded-lg text-xs bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
        >
          <option value="totalPoints">Total Points</option>
          <option value="battingPoints">Batting</option>
          <option value="bowlingPoints">Bowling</option>
          <option value="fieldingPoints">Fielding</option>
          <option value="totalRuns">Runs</option>
          <option value="totalWickets">Wickets</option>
        </select>
      </div>

      {/* Stats summary */}
      <div className="flex items-center justify-between px-1 text-[10px] text-[var(--text-muted)]">
        <span>{filteredPlayers.length} players</span>
        <span>{allStats.length} stat entries across {new Set(allStats.map(s => s.matchId)).size} matches</span>
      </div>

      {/* Table header */}
      <div className="flex items-center gap-2 px-4 py-2 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
        <span className="w-6 text-center">#</span>
        <span className="flex-1">Player</span>
        <span className="w-8 text-center">M</span>
        <span className="w-12 text-center">Bat</span>
        <span className="w-12 text-center">Bowl</span>
        <span className="w-10 text-center">Field</span>
        <span className="w-14 text-right">Points</span>
      </div>

      {/* Player rows */}
      {displayPlayers.map((player, idx) => {
        const rank = sortBy === 'totalPoints'
          ? playerTable.indexOf(player) + 1
          : idx + 1;
        const isExpanded = expandedPlayer === player.playerId;

        return (
          <Card
            key={player.playerId}
            className="border-[var(--border)] overflow-hidden cursor-pointer hover:border-[var(--accent)]/30 transition-colors"
            onClick={() => setExpandedPlayer(isExpanded ? null : player.playerId)}
          >
            <CardContent className="p-0">
              {/* Main row */}
              <div className="flex items-center gap-2 px-4 py-2.5">
                <span className={`w-6 text-center text-xs font-bold ${
                  rank === 1 ? 'text-amber-400' : rank === 2 ? 'text-gray-400' : rank === 3 ? 'text-orange-400' : 'text-[var(--text-muted)]'
                }`}>{rank}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                      {player.playerName}
                    </span>
                    {player.potmCount > 0 && (
                      <Star size={10} className="text-amber-400 fill-amber-400 shrink-0" />
                    )}
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)]">{player.team}</span>
                </div>

                <span className="w-8 text-center text-[10px] text-[var(--text-muted)]">{player.matches}</span>
                <span className="w-12 text-center text-xs text-blue-400">{player.battingPoints || '-'}</span>
                <span className="w-12 text-center text-xs text-purple-400">{player.bowlingPoints || '-'}</span>
                <span className="w-10 text-center text-xs text-emerald-400">{player.fieldingPoints || '-'}</span>
                <span className="w-14 text-right text-xs font-bold text-[var(--accent)]">{player.totalPoints}</span>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-[var(--border)] px-4 py-3 bg-[var(--bg-elevated)]/50">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[var(--text-muted)]">Runs</span>
                      <div className="font-bold text-[var(--text-primary)]">{player.totalRuns}</div>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">Wickets</span>
                      <div className="font-bold text-[var(--text-primary)]">{player.totalWickets}</div>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">Catches</span>
                      <div className="font-bold text-[var(--text-primary)]">{player.totalCatches}</div>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">POTM</span>
                      <div className="font-bold text-[var(--text-primary)]">{player.potmCount}</div>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">Best Match</span>
                      <div className="font-bold text-amber-400">{player.bestMatchPoints} pts</div>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">Avg/Match</span>
                      <div className="font-bold text-[var(--text-primary)]">
                        {player.matches > 0 ? Math.round(player.totalPoints / player.matches) : 0}
                      </div>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)]">Bonus</span>
                      <div className={`font-bold ${player.bonusPoints >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {player.bonusPoints >= 0 ? '+' : ''}{player.bonusPoints}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Show more */}
      {filteredPlayers.length > showCount && (
        <button
          onClick={() => setShowCount(showCount + 25)}
          className="w-full py-2.5 text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
        >
          Show more ({filteredPlayers.length - showCount} remaining)
        </button>
      )}
    </div>
  );
}
