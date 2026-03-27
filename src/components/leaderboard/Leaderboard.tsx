'use client';

import type { LeaderboardEntry } from '@/types';
import { Trophy, User, TrendingUp, Zap, Award, Target, Swords } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface Props {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  onUserClick?: (userId: string) => void;
}

export default function Leaderboard({ entries, currentUserId, onUserClick }: Props) {
  const sorted = [...entries].sort((a, b) => b.score.total - a.score.total);

  if (sorted.length === 0) {
    return (
      <div className="glass-card p-8 text-center border border-[var(--bg-elevated)] rounded-lg animate-fade-in">
        <Trophy size={40} className="text-[var(--accent)] mx-auto mb-4" />
        <h3 className="text-lg font-bold mb-2 gradient-text">No predictions yet</h3>
        <p className="text-sm text-[var(--text-muted)]">
          Leaderboard will appear after members submit predictions.
        </p>
      </div>
    );
  }

  const maxScore = Math.max(...sorted.map(e => e.score.total), 1);
  const topThree = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  const medalEmoji = (rank: number) =>
    rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';

  const rankColor = (rank: number) =>
    rank === 1
      ? 'var(--gold)'
      : rank === 2
      ? 'var(--silver)'
      : rank === 3
      ? 'var(--bronze)'
      : 'var(--text-muted)';

  const rankGradient = (rank: number) =>
    rank === 1
      ? 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,215,0,0.03))'
      : rank === 2
      ? 'linear-gradient(135deg, rgba(192,196,208,0.12), rgba(192,196,208,0.02))'
      : rank === 3
      ? 'linear-gradient(135deg, rgba(232,147,74,0.12), rgba(232,147,74,0.02))'
      : 'var(--bg-card)';

  // Score bar width relative to leader
  const barWidth = (score: number) => `${Math.max((score / maxScore) * 100, 8)}%`;

  // Score category breakdown mini-bar
  const ScoreMiniBar = ({ entry, rank }: { entry: LeaderboardEntry; rank: number }) => {
    const categories = [
      { key: 'ranking', val: entry.score.ranking, label: 'Rank', color: 'var(--accent)' },
      { key: 'winner', val: entry.score.winner + entry.score.runnerUp, label: 'W/RU', color: 'var(--gold)' },
      { key: 'runs', val: entry.score.runs, label: 'Bat', color: '#62B4FF' },
      { key: 'wickets', val: entry.score.wickets, label: 'Bowl', color: '#A78BFA' },
      { key: 'mvp', val: entry.score.mvp, label: 'MVP', color: 'var(--warning)' },
      { key: 'matches', val: entry.score.matches, label: 'Match', color: 'var(--pink)' },
    ].filter(c => c.val > 0);

    const total = entry.score.total || 1;

    return (
      <div className="flex items-center gap-0.5 h-2 w-full rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
        {categories.map((cat) => (
          <div
            key={cat.key}
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(cat.val / total) * 100}%`,
              background: cat.color,
              opacity: 0.85,
            }}
            title={`${cat.label}: ${cat.val}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* ═══════ PODIUM — Top 3 ═══════ */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-2">
          {/* Reorder: 2nd, 1st, 3rd for visual podium */}
          {[topThree[1], topThree[0], topThree[2]].filter(Boolean).map((entry) => {
            if (!entry) return null;
            const rank = sorted.indexOf(entry) + 1;
            const isMe = entry.userId === currentUserId;
            const isFirst = rank === 1;

            return (
              <div
                key={entry.userId}
                onClick={() => onUserClick?.(entry.userId)}
                role={onUserClick ? 'button' : undefined}
                className={`relative flex flex-col items-center text-center p-3 sm:p-4 rounded-xl transition-all duration-300 ${isFirst ? 'sm:-mt-3' : 'mt-2 sm:mt-4'} ${onUserClick ? 'cursor-pointer hover:scale-[1.03]' : ''}`}
                style={{
                  background: rankGradient(rank),
                  border: isMe
                    ? '2px solid var(--accent)'
                    : `1px solid ${rankColor(rank)}33`,
                  boxShadow: isFirst
                    ? '0 0 30px rgba(255,215,0,0.12), 0 4px 20px rgba(0,0,0,0.3)'
                    : '0 4px 12px rgba(0,0,0,0.2)',
                }}
              >
                {/* Medal */}
                <div className="text-2xl sm:text-3xl mb-1">{medalEmoji(rank)}</div>

                {/* Avatar */}
                <Avatar className={`w-10 h-10 sm:w-12 sm:h-12 mb-2 ring-2 ring-offset-2 ring-offset-transparent`} style={{ '--tw-ring-color': rankColor(rank) } as any}>
                  <AvatarImage src={entry.photoURL || ''} alt={entry.userName} referrerPolicy="no-referrer" />
                  <AvatarFallback style={{ background: 'var(--bg-elevated)' }}>
                    <User size={16} className="text-[var(--text-muted)]" />
                  </AvatarFallback>
                </Avatar>

                {/* Name */}
                <p className="text-xs sm:text-sm font-bold truncate w-full" style={{ color: 'var(--text-primary)' }}>
                  {entry.userName}
                </p>
                {isMe && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5" style={{ background: 'var(--accent-ghost)', color: 'var(--accent)' }}>
                    you
                  </span>
                )}

                {/* Score */}
                <div
                  className="text-lg sm:text-2xl font-black mt-2 tabular-nums"
                  style={{ color: rankColor(rank) }}
                >
                  {entry.score.total}
                </div>
                <span className="text-[9px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  points
                </span>

                {/* Mini score bar */}
                <div className="w-full mt-2">
                  <ScoreMiniBar entry={entry} rank={rank} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════ REST OF LEADERBOARD ═══════ */}
      {rest.length > 0 && (
        <div className="space-y-2">
          {/* Header row */}
          <div className="flex items-center px-4 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            <span className="w-8 text-center">#</span>
            <span className="flex-1 ml-3">Player</span>
            <span className="hidden sm:block w-48 text-right mr-3">Breakdown</span>
            <span className="w-14 text-right">Score</span>
          </div>

          {rest.map((entry) => {
            const rank = sorted.indexOf(entry) + 1;
            const isMe = entry.userId === currentUserId;

            return (
              <div
                key={entry.userId}
                onClick={() => onUserClick?.(entry.userId)}
                role={onUserClick ? 'button' : undefined}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all duration-200 hover:scale-[1.005] ${onUserClick ? 'cursor-pointer' : ''}`}
                style={{
                  background: isMe ? 'var(--accent-ghost)' : 'var(--bg-card)',
                  border: isMe ? '1px solid var(--accent-dim)' : '1px solid var(--border)',
                }}
              >
                {/* Rank number */}
                <span
                  className="w-8 text-center text-sm font-bold tabular-nums shrink-0"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {rank}
                </span>

                {/* Avatar */}
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarImage src={entry.photoURL || ''} alt={entry.userName} referrerPolicy="no-referrer" />
                  <AvatarFallback style={{ background: 'var(--bg-elevated)' }}>
                    <User size={12} className="text-[var(--text-muted)]" />
                  </AvatarFallback>
                </Avatar>

                {/* Name + score bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {entry.userName}
                    </span>
                    {isMe && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'var(--accent-ghost)', color: 'var(--accent)' }}>
                        you
                      </span>
                    )}
                  </div>
                  {/* Score bar — relative to leader */}
                  <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: barWidth(entry.score.total),
                        background: 'linear-gradient(90deg, var(--accent), var(--accent-dim))',
                        opacity: 0.7,
                      }}
                    />
                  </div>
                </div>

                {/* Category breakdown — desktop only */}
                <div className="hidden sm:flex items-center gap-1 shrink-0 w-48 justify-end">
                  {[
                    { val: entry.score.ranking, label: 'R', color: 'var(--accent)' },
                    { val: entry.score.winner, label: 'W', color: 'var(--gold)' },
                    { val: entry.score.runnerUp, label: 'RU', color: 'var(--silver)' },
                    { val: entry.score.runs, label: 'B', color: '#62B4FF' },
                    { val: entry.score.wickets, label: 'Wk', color: '#A78BFA' },
                    { val: entry.score.mvp, label: 'MVP', color: 'var(--warning)' },
                  ].map(({ val, label, color }) => (
                    <div
                      key={label}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums"
                      style={{
                        background: val > 0 ? `${color}18` : 'var(--bg-primary)',
                        color: val > 0 ? color : 'var(--text-muted)',
                        opacity: val > 0 ? 1 : 0.5,
                      }}
                      title={`${label}: ${val}`}
                    >
                      {val}
                    </div>
                  ))}
                </div>

                {/* Total Score */}
                <div
                  className="text-sm font-black w-14 text-right tabular-nums shrink-0"
                  style={{ color: 'var(--accent)' }}
                >
                  {entry.score.total}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Score Legend */}
      <div className="flex flex-wrap justify-center gap-3 pt-2 pb-1">
        {[
          { color: 'var(--accent)', label: 'Rank' },
          { color: 'var(--gold)', label: 'Winner/RU' },
          { color: '#62B4FF', label: 'Batting' },
          { color: '#A78BFA', label: 'Bowling' },
          { color: 'var(--warning)', label: 'MVP' },
          { color: 'var(--pink)', label: 'Matches' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
