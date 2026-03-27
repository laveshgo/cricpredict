'use client';

import { useMemo } from 'react';
import type { TournamentPrediction, ActualResults, Tournament, ScoreBreakdown as ScoreBreakdownType } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';

const DEFAULT_TEAM_COLOR = { bg: '#333', text: '#fff', accent: '#666' };

function MatchIcon({ match }: { match: boolean }) {
  return match ? (
    <Check size={13} style={{ color: 'var(--success)' }} />
  ) : (
    <X size={13} style={{ color: 'var(--error)', opacity: 0.5 }} />
  );
}

function ScorePill({ pts }: { pts: number }) {
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums"
      style={{
        background: pts > 0 ? 'rgba(46, 204, 113, 0.15)' : 'rgba(136, 136, 136, 0.08)',
        color: pts > 0 ? 'var(--success)' : 'var(--text-muted)',
      }}
    >
      {pts > 0 ? `+${pts}` : '0'}
    </span>
  );
}

interface Props {
  prediction: TournamentPrediction;
  actualResults: ActualResults;
  tournament: Tournament;
  score: ScoreBreakdownType;
  isCompare?: boolean;
}

export default function ScoreBreakdownView({ prediction, actualResults, tournament, score, isCompare }: Props) {
  const teamMap = useMemo(() => new Map(tournament.teams.map(t => [t.name, t])), [tournament.teams]);

  const getTeamColor = (name: string) => {
    const team = teamMap.get(name);
    return team?.color || DEFAULT_TEAM_COLOR;
  };

  const getTeamShort = (name: string) => {
    return teamMap.get(name)?.shortName || name;
  };

  // Score summary categories
  const categories = [
    { label: 'Rank', pts: score.ranking, color: 'var(--accent)' },
    { label: 'W', pts: score.winner, color: 'var(--gold)' },
    { label: 'RU', pts: score.runnerUp, color: 'var(--silver)' },
    { label: 'Bat', pts: score.runs, color: '#62B4FF' },
    { label: 'Bowl', pts: score.wickets, color: '#A78BFA' },
    { label: 'MVP', pts: score.mvp, color: 'var(--gold)' },
    { label: 'Match', pts: score.matches, color: 'var(--pink)' },
  ];

  return (
    <div className="space-y-4">
      {/* ─── Score Summary ─── */}
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Score Breakdown
          </span>
          <span className="text-lg font-black tabular-nums" style={{ color: 'var(--accent)' }}>
            {score.total} <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>pts</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {categories.map(({ label, pts, color }) => (
            <div
              key={label}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold"
              style={{
                background: pts > 0 ? `${color}15` : 'var(--bg-primary)',
                color: pts > 0 ? color : 'var(--text-muted)',
              }}
            >
              <span>{label}</span>
              <span className="font-black tabular-nums">{pts}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Team Rankings ─── */}
      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Team Rankings
          </span>
          <ScorePill pts={score.ranking} />
        </div>
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {/* Header */}
          <div
            className="flex items-center px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
          >
            <span className="w-14">Team</span>
            <span className="flex-1 text-center">Pred</span>
            <span className="flex-1 text-center">Actual</span>
            <span className="w-14 text-right">Pts</span>
          </div>
          {score.details.ranking.map(({ team, predicted, actual, pts }, idx) => {
            const color = getTeamColor(team);
            const isLast = idx === score.details.ranking.length - 1;
            return (
              <div
                key={team}
                className="flex items-center px-3 py-2"
                style={{
                  background: pts > 0
                    ? 'linear-gradient(90deg, rgba(46,204,113,0.06), transparent)'
                    : 'var(--bg-card)',
                  borderBottom: isLast ? 'none' : '1px solid var(--border)',
                }}
              >
                <Badge
                  style={{ background: color.bg, color: color.text }}
                  className="text-[9px] px-1.5 py-0 shrink-0 w-14 justify-center"
                >
                  {getTeamShort(team)}
                </Badge>
                <span className="flex-1 text-center text-xs font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {predicted}
                </span>
                <span className="flex-1 text-center text-xs font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {actual}
                </span>
                <div className="w-14 flex items-center justify-end gap-1">
                  <MatchIcon match={pts > 0} />
                  <ScorePill pts={pts} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Winner & Runner-up ─── */}
      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Winner & Runner-up
          </span>
          <ScorePill pts={score.winner + score.runnerUp} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Winner', pred: prediction.winner, actual: actualResults.winner, pts: score.winner, accent: 'var(--gold)' },
            { label: 'Runner-up', pred: prediction.runnerUp, actual: actualResults.runnerUp, pts: score.runnerUp, accent: 'var(--silver)' },
          ].map(({ label, pred, actual, pts, accent }) => (
            <div
              key={label}
              className="p-3 rounded-xl"
              style={{
                background: pts > 0
                  ? 'linear-gradient(135deg, rgba(46,204,113,0.06), transparent)'
                  : 'var(--bg-card)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>{label}</span>
                <div className="flex items-center gap-1">
                  <MatchIcon match={pts > 0} />
                  <ScorePill pts={pts} />
                </div>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--text-muted)' }}>Pred:</span>
                  {pred ? (
                    <Badge style={{ background: getTeamColor(pred).bg, color: getTeamColor(pred).text }} className="text-[9px] px-1.5 py-0">
                      {getTeamShort(pred)}
                    </Badge>
                  ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--text-muted)' }}>Actual:</span>
                  {actual ? (
                    <Badge style={{ background: getTeamColor(actual).bg, color: getTeamColor(actual).text }} className="text-[9px] px-1.5 py-0">
                      {getTeamShort(actual)}
                    </Badge>
                  ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Run Scorers & Wicket Takers ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Run Scorers */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              Run Scorers
            </span>
            <ScorePill pts={score.runs} />
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {score.details.runs.map(({ player, predicted, pts }, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-2 text-xs"
                style={{
                  background: pts > 0 ? 'linear-gradient(90deg, rgba(46,204,113,0.06), transparent)' : 'var(--bg-card)',
                  borderBottom: idx < score.details.runs.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <span className="font-black w-5 text-center tabular-nums" style={{ color: '#62B4FF' }}>{predicted}</span>
                <span className="flex-1 truncate font-medium" style={{ color: 'var(--text-primary)' }}>{player || '—'}</span>
                <div className="flex items-center gap-1">
                  <MatchIcon match={pts > 0} />
                  <ScorePill pts={pts} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Wicket Takers */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              Wicket Takers
            </span>
            <ScorePill pts={score.wickets} />
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {score.details.wickets.map(({ player, predicted, pts }, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-2 text-xs"
                style={{
                  background: pts > 0 ? 'linear-gradient(90deg, rgba(46,204,113,0.06), transparent)' : 'var(--bg-card)',
                  borderBottom: idx < score.details.wickets.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <span className="font-black w-5 text-center tabular-nums" style={{ color: '#A78BFA' }}>{predicted}</span>
                <span className="flex-1 truncate font-medium" style={{ color: 'var(--text-primary)' }}>{player || '—'}</span>
                <div className="flex items-center gap-1">
                  <MatchIcon match={pts > 0} />
                  <ScorePill pts={pts} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── MVP ─── */}
      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            MVP
          </span>
          <ScorePill pts={score.mvp} />
        </div>
        <div
          className="flex items-center justify-between p-3 rounded-xl"
          style={{
            background: score.mvp > 0
              ? 'linear-gradient(135deg, rgba(255,215,0,0.06), transparent)'
              : 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--text-muted)' }}>Pred:</span>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{prediction.mvp || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--text-muted)' }}>Actual:</span>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{actualResults.mvp || '—'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <MatchIcon match={score.mvp > 0} />
            <ScorePill pts={score.mvp} />
          </div>
        </div>
      </div>
    </div>
  );
}
