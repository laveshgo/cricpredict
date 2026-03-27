'use client';

import type { Tournament, ActualResults } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trophy, Target, Zap, Award, TrendingUp, Star, ChevronUp, ChevronDown, Minus } from 'lucide-react';

interface Props {
  tournament: Tournament;
  actualResults: ActualResults | null;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
  lastCacheStatus?: 'HIT' | 'MISS';
}

export default function LiveData({ tournament, actualResults, onRefresh, isRefreshing, lastCacheStatus }: Props) {
  const getTeamColor = (name: string) => {
    const team = tournament.teams.find((t) => t.name === name);
    return team?.color || { bg: '#333', text: '#fff', accent: '#666' };
  };

  const getTeamShort = (name: string) => {
    const team = tournament.teams.find((t) => t.name === name);
    return team?.shortName || name;
  };

  // Empty state
  if (!actualResults) {
    return (
      <div className="space-y-4">
        {/* Refresh Header */}
        <div
          className="flex items-center justify-between p-4 rounded-xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Live Tournament Data</h3>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Fetch latest standings from Cricbuzz
            </p>
          </div>
          <Button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="gap-2 bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent-hover)]"
            size="sm"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Fetching...' : 'Fetch Live'}
          </Button>
        </div>

        {/* Empty Illustration */}
        <div
          className="flex flex-col items-center justify-center py-16 rounded-xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
            style={{ background: 'linear-gradient(135deg, var(--accent-ghost), transparent)' }}
          >
            <TrendingUp size={36} style={{ color: 'var(--accent)', opacity: 0.6 }} />
          </div>
          <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            No data available yet
          </p>
          <p className="text-xs mt-2 max-w-xs text-center" style={{ color: 'var(--text-muted)' }}>
            Hit the refresh button above to fetch live standings, stats, and player leaderboards from Cricbuzz.
          </p>
        </div>
      </div>
    );
  }

  const medalStyle = (idx: number) => {
    if (idx === 0) return { bg: 'var(--gold)', color: '#000', emoji: '🥇' };
    if (idx === 1) return { bg: 'var(--silver)', color: '#000', emoji: '🥈' };
    if (idx === 2) return { bg: 'var(--bronze)', color: '#000', emoji: '🥉' };
    return { bg: 'var(--bg-elevated)', color: 'var(--text-secondary)', emoji: '' };
  };

  return (
    <div className="space-y-5">
      {/* ─── Refresh Bar ─── */}
      <div
        className="flex items-center justify-between p-3 rounded-xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Updated: {new Date(actualResults.lastUpdated).toLocaleString('en-IN', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
            })}
          </p>
          {lastCacheStatus && (
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {lastCacheStatus === 'HIT' ? '⚡ Served from cache' : '🔄 Fresh data'}
            </p>
          )}
        </div>
        <Button
          onClick={onRefresh}
          disabled={isRefreshing}
          variant="outline"
          size="sm"
          className="gap-1.5 border-[var(--accent-dim)] text-[var(--accent)] hover:bg-[var(--accent-ghost)]"
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* ─── Points Table ─── */}
      {actualResults.teamRanking.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3 px-1">
            <Trophy size={16} style={{ color: 'var(--accent)' }} />
            <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
              Points Table
            </h3>
          </div>

          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {/* Table Header */}
            <div
              className="flex items-center px-4 py-2 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
            >
              <span className="w-8 text-center">#</span>
              <span className="flex-1 ml-2">Team</span>
              <span className="w-16 text-center">Status</span>
            </div>

            {actualResults.teamRanking.map((team, idx) => {
              const color = getTeamColor(team);
              const qualifyStatus = actualResults.teamQualifyStatus?.[team];
              // Only show Q/E when Cricbuzz actually provides the status
              const isQualified = qualifyStatus === 'Q';
              const isEliminated = qualifyStatus === 'E';
              const isLast = idx === actualResults.teamRanking.length - 1;

              return (
                <div
                  key={team}
                  className="flex items-center px-4 py-3 transition-colors"
                  style={{
                    background: isQualified
                      ? `linear-gradient(90deg, ${color.bg}12, transparent)`
                      : 'var(--bg-card)',
                    borderBottom: isLast ? 'none' : '1px solid var(--border)',
                  }}
                >
                  {/* Rank */}
                  <span
                    className="w-8 text-center text-sm font-black tabular-nums"
                    style={{ color: isQualified ? color.bg : 'var(--text-muted)' }}
                  >
                    {idx + 1}
                  </span>

                  {/* Team Badge + Name */}
                  <div className="flex items-center gap-2.5 flex-1 ml-2 min-w-0">
                    <div
                      className="w-9 h-6 rounded-md flex items-center justify-center text-[9px] font-black shrink-0 shadow-sm"
                      style={{ background: color.bg, color: color.text }}
                    >
                      {getTeamShort(team)}
                    </div>
                    <span
                      className="text-sm font-semibold truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {team}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="w-16 flex justify-center">
                    {isQualified ? (
                      <span
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                        style={{
                          background: `${color.bg}25`,
                          color: color.bg,
                          border: `1px solid ${color.bg}40`,
                        }}
                      >
                        Q
                      </span>
                    ) : isEliminated ? (
                      <span
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                        style={{
                          background: 'rgba(239,68,68,0.12)',
                          color: '#ef4444',
                          border: '1px solid rgba(239,68,68,0.25)',
                        }}
                      >
                        E
                      </span>
                    ) : (
                      <span
                        className="text-[9px] font-medium px-2 py-0.5 rounded-full"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        —
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Winner & Runner-up ─── */}
      {(actualResults.winner || actualResults.runnerUp) && (
        <div>
          <div className="flex items-center gap-2 mb-3 px-1">
            <Award size={16} style={{ color: 'var(--gold)' }} />
            <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
              Finals
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {actualResults.winner && (() => {
              const color = getTeamColor(actualResults.winner);
              return (
                <div
                  className="relative text-center p-5 rounded-xl overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${color.bg}18, ${color.bg}05)`,
                    border: `1px solid ${color.bg}30`,
                  }}
                >
                  <div className="text-3xl mb-2">🏆</div>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--gold)' }}>
                    Champion
                  </p>
                  <div
                    className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center text-xs font-black shadow-md mb-2"
                    style={{ background: color.bg, color: color.text }}
                  >
                    {getTeamShort(actualResults.winner)}
                  </div>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {actualResults.winner}
                  </p>
                </div>
              );
            })()}

            {actualResults.runnerUp && (() => {
              const color = getTeamColor(actualResults.runnerUp);
              return (
                <div
                  className="relative text-center p-5 rounded-xl overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${color.bg}10, ${color.bg}03)`,
                    border: `1px solid ${color.bg}20`,
                  }}
                >
                  <div className="text-3xl mb-2">🥈</div>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--silver)' }}>
                    Runner-up
                  </p>
                  <div
                    className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center text-xs font-black shadow-md mb-2"
                    style={{ background: color.bg, color: color.text }}
                  >
                    {getTeamShort(actualResults.runnerUp)}
                  </div>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {actualResults.runnerUp}
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ─── Player Stats: Runs & Wickets ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Top Run Scorers */}
        {actualResults.runs.filter(Boolean).length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3 px-1">
              <Target size={16} style={{ color: '#62B4FF' }} />
              <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                Top Run Scorers
              </h3>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {actualResults.runs.filter(Boolean).map((player, idx) => {
                const medal = medalStyle(idx);
                const isLast = idx === actualResults.runs.filter(Boolean).length - 1;
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{
                      background: idx === 0
                        ? 'linear-gradient(90deg, rgba(255,215,0,0.08), transparent)'
                        : 'var(--bg-card)',
                      borderBottom: isLast ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    {/* Rank circle */}
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                      style={{ background: medal.bg, color: medal.color }}
                    >
                      {medal.emoji || (idx + 1)}
                    </div>
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {player}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top Wicket Takers */}
        {actualResults.wickets.filter(Boolean).length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3 px-1">
              <Zap size={16} style={{ color: '#A78BFA' }} />
              <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                Top Wicket Takers
              </h3>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {actualResults.wickets.filter(Boolean).map((player, idx) => {
                const medal = medalStyle(idx);
                const isLast = idx === actualResults.wickets.filter(Boolean).length - 1;
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{
                      background: idx === 0
                        ? 'linear-gradient(90deg, rgba(167,139,250,0.08), transparent)'
                        : 'var(--bg-card)',
                      borderBottom: isLast ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                      style={{ background: medal.bg, color: medal.color }}
                    >
                      {medal.emoji || (idx + 1)}
                    </div>
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {player}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── MVP ─── */}
      {actualResults.mvp && (
        <div>
          <div className="flex items-center gap-2 mb-3 px-1">
            <Star size={16} style={{ color: 'var(--gold)' }} />
            <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
              Player of the Tournament
            </h3>
          </div>

          <div
            className="flex items-center gap-4 p-4 rounded-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(255,215,0,0.02))',
              border: '1px solid rgba(255,215,0,0.2)',
            }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-lg"
              style={{ background: 'var(--gold)', color: '#000' }}
            >
              <Award size={22} />
            </div>
            <div>
              <p className="text-base font-black" style={{ color: 'var(--text-primary)' }}>
                {actualResults.mvp}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: 'var(--gold)' }}>
                Man of the Tournament
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
