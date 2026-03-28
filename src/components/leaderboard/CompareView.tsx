'use client';

import { useMemo } from 'react';
import type { TournamentPrediction, ActualResults, Tournament, ScoreBreakdown } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';

const DEFAULT_TEAM_COLOR = { bg: '#333', text: '#fff', accent: '#666' };

interface Props {
  predictions: [TournamentPrediction, TournamentPrediction];
  scores: [ScoreBreakdown, ScoreBreakdown];
  actualResults: ActualResults;
  tournament: Tournament;
}

export default function CompareView({ predictions, scores, actualResults, tournament }: Props) {
  const [predA, predB] = predictions;
  const [scoreA, scoreB] = scores;

  const teamMap = useMemo(() => new Map(tournament.teams.map(t => [t.name, t])), [tournament.teams]);

  const getTeamShort = (name: string) => {
    return teamMap.get(name)?.shortName || name;
  };

  const getTeamColor = (name: string) => {
    return teamMap.get(name)?.color || DEFAULT_TEAM_COLOR;
  };

  const rankMapA = useMemo(() => {
    const m = new Map<string, number>();
    predA.teamRanking.forEach((t, i) => m.set(t, i + 1));
    return m;
  }, [predA.teamRanking]);

  const rankMapB = useMemo(() => {
    const m = new Map<string, number>();
    predB.teamRanking.forEach((t, i) => m.set(t, i + 1));
    return m;
  }, [predB.teamRanking]);

  const categories = [
    { label: 'Rankings', a: scoreA.ranking, b: scoreB.ranking },
    { label: 'Winner', a: scoreA.winner, b: scoreB.winner },
    { label: 'Runner-up', a: scoreA.runnerUp, b: scoreB.runnerUp },
    { label: 'Batting', a: scoreA.runs, b: scoreB.runs },
    { label: 'Bowling', a: scoreA.wickets, b: scoreB.wickets },
    { label: 'MVP', a: scoreA.mvp, b: scoreB.mvp },
    { label: 'Matches', a: scoreA.matches, b: scoreB.matches },
    { label: 'Total', a: scoreA.total, b: scoreB.total },
  ];

  return (
    <div className="space-y-4">
      {/* ─── Header with names and totals ─── */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 items-center text-center">
        <div
          className="p-3 sm:p-4 rounded-xl"
          style={{
            background: scoreA.total >= scoreB.total
              ? 'linear-gradient(135deg, rgba(46,204,113,0.1), rgba(46,204,113,0.02))'
              : 'var(--bg-card)',
            border: scoreA.total >= scoreB.total
              ? '1px solid rgba(46,204,113,0.2)'
              : '1px solid var(--border)',
          }}
        >
          <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{predA.userName}</p>
          <p className="text-xl sm:text-2xl font-black mt-1 tabular-nums" style={{ color: scoreA.total >= scoreB.total ? 'var(--success)' : 'var(--text-muted)' }}>
            {scoreA.total}
          </p>
        </div>
        <div className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>vs</div>
        <div
          className="p-3 sm:p-4 rounded-xl"
          style={{
            background: scoreB.total >= scoreA.total
              ? 'linear-gradient(135deg, rgba(52,152,219,0.1), rgba(52,152,219,0.02))'
              : 'var(--bg-card)',
            border: scoreB.total >= scoreA.total
              ? '1px solid rgba(52,152,219,0.2)'
              : '1px solid var(--border)',
          }}
        >
          <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{predB.userName}</p>
          <p className="text-xl sm:text-2xl font-black mt-1 tabular-nums" style={{ color: scoreB.total >= scoreA.total ? 'var(--success)' : 'var(--text-muted)' }}>
            {scoreB.total}
          </p>
        </div>
      </div>

      {/* ─── Category Comparison Bars ─── */}
      <div>
        <div className="px-1 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Score Comparison
          </span>
        </div>
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          {categories.map(({ label, a, b }) => {
            const max = Math.max(a, b, 1);
            const isTotal = label === 'Total';
            return (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold tabular-nums" style={{ color: a >= b ? 'var(--success)' : 'var(--text-muted)' }}>{a}</span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${isTotal ? 'text-[var(--accent)]' : ''}`} style={!isTotal ? { color: 'var(--text-muted)' } : {}}>
                    {label}
                  </span>
                  <span className="text-xs font-bold tabular-nums" style={{ color: b >= a ? 'var(--success)' : 'var(--text-muted)' }}>{b}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(a / max) * 100}%`,
                        background: a >= b ? 'var(--success)' : 'rgba(136,136,136,0.3)',
                        float: 'right',
                      }}
                    />
                  </div>
                  <div className="w-px h-4" style={{ background: 'var(--bg-elevated)' }} />
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(b / max) * 100}%`,
                        background: b >= a ? 'var(--success)' : 'rgba(136,136,136,0.3)',
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Team Rankings Side-by-Side ─── */}
      <div>
        <div className="px-1 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Team Rankings
          </span>
        </div>
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {/* Header */}
          <div
            className="grid grid-cols-[1fr_auto_1fr] gap-x-2 sm:gap-x-3 px-3 sm:px-4 py-1.5 text-[9px] font-bold uppercase tracking-wider"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
          >
            <div className="text-center">{predA.userName}</div>
            <div className="text-center w-14">#</div>
            <div className="text-center">{predB.userName}</div>
          </div>
          {actualResults.teamRanking.map((team, idx) => {
            const posA = rankMapA.get(team) ?? 0;
            const posB = rankMapB.get(team) ?? 0;
            const color = getTeamColor(team);
            const isLast = idx === actualResults.teamRanking.length - 1;
            return (
              <div
                key={team}
                className="grid grid-cols-[1fr_auto_1fr] gap-x-2 sm:gap-x-3 px-3 sm:px-4 py-2 items-center"
                style={{
                  background: 'var(--bg-card)',
                  borderBottom: isLast ? 'none' : '1px solid var(--border)',
                }}
              >
                <div className="flex items-center justify-center gap-1">
                  <span className="text-xs font-semibold tabular-nums" style={{ color: posA === idx + 1 ? 'var(--success)' : 'var(--text-primary)' }}>
                    {posA}
                  </span>
                  {posA === idx + 1 && <Check size={10} style={{ color: 'var(--success)' }} />}
                </div>
                <div className="text-center w-14">
                  <Badge style={{ background: color.bg, color: color.text }} className="text-[9px] px-1.5 py-0">
                    {getTeamShort(team)}
                  </Badge>
                </div>
                <div className="flex items-center justify-center gap-1">
                  <span className="text-xs font-semibold tabular-nums" style={{ color: posB === idx + 1 ? 'var(--success)' : 'var(--text-primary)' }}>
                    {posB}
                  </span>
                  {posB === idx + 1 && <Check size={10} style={{ color: 'var(--success)' }} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Player Picks Side-by-Side ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Run Scorers */}
        <div>
          <div className="px-1 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              Run Scorers
            </span>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {Array.from({ length: 5 }).map((_, idx) => {
              const pA = predA.runs[idx] || '—';
              const pB = predB.runs[idx] || '—';
              const actualPlayer = actualResults.runs[idx]?.toLowerCase();
              const matchA = actualPlayer && pA.toLowerCase() === actualPlayer;
              const matchB = actualPlayer && pB.toLowerCase() === actualPlayer;
              return (
                <div
                  key={`runs-${idx}`}
                  className="grid grid-cols-[1fr_auto_1fr] gap-x-2 px-3 py-2 text-xs"
                  style={{
                    background: 'var(--bg-card)',
                    borderBottom: idx < 4 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div className="truncate" style={{ color: matchA ? 'var(--success)' : 'var(--text-primary)' }}>{pA}</div>
                  <div className="font-black text-center w-6 tabular-nums" style={{ color: '#62B4FF' }}>{idx + 1}</div>
                  <div className="truncate text-right" style={{ color: matchB ? 'var(--success)' : 'var(--text-primary)' }}>{pB}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Wicket Takers */}
        <div>
          <div className="px-1 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              Wicket Takers
            </span>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {Array.from({ length: 5 }).map((_, idx) => {
              const pA = predA.wickets[idx] || '—';
              const pB = predB.wickets[idx] || '—';
              const actualPlayer = actualResults.wickets[idx]?.toLowerCase();
              const matchA = actualPlayer && pA.toLowerCase() === actualPlayer;
              const matchB = actualPlayer && pB.toLowerCase() === actualPlayer;
              return (
                <div
                  key={`wkts-${idx}`}
                  className="grid grid-cols-[1fr_auto_1fr] gap-x-2 px-3 py-2 text-xs"
                  style={{
                    background: 'var(--bg-card)',
                    borderBottom: idx < 4 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div className="truncate" style={{ color: matchA ? 'var(--success)' : 'var(--text-primary)' }}>{pA}</div>
                  <div className="font-black text-center w-6 tabular-nums" style={{ color: '#A78BFA' }}>{idx + 1}</div>
                  <div className="truncate text-right" style={{ color: matchB ? 'var(--success)' : 'var(--text-primary)' }}>{pB}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
