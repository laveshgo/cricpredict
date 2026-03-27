'use client';

import { useMemo } from 'react';
import type { Tournament, TournamentPrediction } from '@/types';
import { Trophy, Target, Award, Zap, Star } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { Badge } from '@/components/ui/badge';

interface Props {
  prediction: TournamentPrediction;
  tournament: Tournament;
  isCurrentUser?: boolean;
}

export default function PredictionSummary({ prediction, tournament, isCurrentUser }: Props) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const teamMap = useMemo(() => new Map(tournament.teams.map(t => [t.name, t])), [tournament.teams]);

  const getTeamColor = (name: string) => {
    const team = teamMap.get(name);
    return team?.color || { bg: 'var(--bg-hover)', text: 'var(--text-primary)', accent: '#666' };
  };

  const getTeamShort = (name: string) => {
    return teamMap.get(name)?.shortName || name;
  };

  return (
    <div
      className="rounded-xl overflow-hidden animate-fade-in"
      style={{
        background: 'var(--bg-card)',
        border: isCurrentUser
          ? '1px solid var(--accent)'
          : '1px solid var(--border)',
        boxShadow: isCurrentUser ? '0 0 20px var(--accent-glow)' : 'none',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {prediction.userName}
          </span>
          {isCurrentUser && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent-ghost)', color: 'var(--accent)' }}>
              you
            </span>
          )}
        </div>
        <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
          {new Date(prediction.submittedAt).toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* ─── Team Ranking ─── */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Trophy size={12} style={{ color: 'var(--accent)' }} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Points Table
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {prediction.teamRanking.map((team, idx) => {
              const color = getTeamColor(team);
              return (
                <div
                  key={team}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-bold"
                  style={{
                    background: idx < 4 ? `${color.bg}${isLight ? '28' : '15'}` : 'var(--bg-primary)',
                    border: idx < 4 ? `1px solid ${color.bg}${isLight ? '50' : '30'}` : '1px solid var(--border)',
                    color: idx < 4 ? color.bg : 'var(--text-muted)',
                  }}
                >
                  <span className="tabular-nums">{idx + 1}</span>
                  <span
                    className="w-8 h-5 rounded-md flex items-center justify-center text-[8px] font-black"
                    style={{ background: color.bg, color: color.text }}
                  >
                    {getTeamShort(team)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Winner / Runner-up / MVP row ─── */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {/* Winner */}
          <div
            className="p-2.5 rounded-lg text-center"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-center gap-1 mb-1.5">
              <Award size={10} style={{ color: 'var(--gold)' }} />
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--gold)' }}>Winner</span>
            </div>
            {prediction.winner ? (
              <div
                className="w-10 h-6 rounded-md mx-auto flex items-center justify-center text-[9px] font-black shadow-sm"
                style={{ background: getTeamColor(prediction.winner).bg, color: getTeamColor(prediction.winner).text }}
              >
                {getTeamShort(prediction.winner)}
              </div>
            ) : (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
            )}
          </div>

          {/* Runner-up */}
          <div
            className="p-2.5 rounded-lg text-center"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-center gap-1 mb-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--silver)' }}>Runner-up</span>
            </div>
            {prediction.runnerUp ? (
              <div
                className="w-10 h-6 rounded-md mx-auto flex items-center justify-center text-[9px] font-black shadow-sm"
                style={{ background: getTeamColor(prediction.runnerUp).bg, color: getTeamColor(prediction.runnerUp).text }}
              >
                {getTeamShort(prediction.runnerUp)}
              </div>
            ) : (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
            )}
          </div>

          {/* MVP */}
          <div
            className="p-2.5 rounded-lg text-center"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-center gap-1 mb-1.5">
              <Star size={10} style={{ color: 'var(--gold)' }} />
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--gold)' }}>MVP</span>
            </div>
            <p className="text-[11px] font-semibold truncate" style={{ color: prediction.mvp ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {prediction.mvp || '—'}
            </p>
          </div>
        </div>

        {/* ─── Players: Runs & Wickets ─── */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {/* Run Scorers */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Target size={11} style={{ color: '#62B4FF' }} />
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Runs
              </span>
            </div>
            <div className="space-y-0.5">
              {prediction.runs.filter(Boolean).map((p, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px]">
                  <span className="font-black tabular-nums w-4 text-center" style={{ color: '#62B4FF' }}>{i + 1}</span>
                  <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p}</span>
                </div>
              ))}
              {prediction.runs.filter(Boolean).length === 0 && (
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>—</span>
              )}
            </div>
          </div>

          {/* Wicket Takers */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Zap size={11} style={{ color: '#A78BFA' }} />
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Wickets
              </span>
            </div>
            <div className="space-y-0.5">
              {prediction.wickets.filter(Boolean).map((p, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px]">
                  <span className="font-black tabular-nums w-4 text-center" style={{ color: '#A78BFA' }}>{i + 1}</span>
                  <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p}</span>
                </div>
              ))}
              {prediction.wickets.filter(Boolean).length === 0 && (
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>—</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
