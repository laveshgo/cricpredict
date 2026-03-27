'use client';

import { useState, useMemo } from 'react';
import type { Tournament, TournamentPrediction } from '@/types';
import { ChevronDown, ChevronUp, Trophy, Medal, TrendingDown, Zap, Target, Star, Users } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  predictions: TournamentPrediction[];
  tournament: Tournament;
}

export default function ConsensusView({ predictions, tournament }: Props) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [expandedVoters, setExpandedVoters] = useState<Record<string, boolean>>({});

  if (predictions.length < 2) {
    return (
      <div className="py-12 text-center rounded-xl" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <Users size={36} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--accent)' }} />
        <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Need 2+ predictions</h3>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Share the group link with friends to see consensus!
        </p>
      </div>
    );
  }

  // O(1) lookups instead of linear .find() on every call
  const teamMap = useMemo(() => new Map(tournament.teams.map(t => [t.name, t])), [tournament.teams]);
  const defaultColor = { bg: '#555', text: '#fff', accent: '#666' };
  const getTeamColor = (name: string) => teamMap.get(name)?.color || defaultColor;
  const getTeamShort = (name: string) => teamMap.get(name)?.shortName || name;

  const total = predictions.length;

  const toggleVoters = (key: string) => {
    setExpandedVoters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ─── Memoized aggregation — only recalculates when predictions/tournament change ───
  const { winnerSorted, ruSorted, avgRanking, top4Sorted, lastPlaceSorted, runsSorted, wicketsSorted, mvpSorted } = useMemo(() => {
    // Winner
    const winnerVoters: Record<string, string[]> = {};
    predictions.forEach((p) => {
      if (p.winner) {
        if (!winnerVoters[p.winner]) winnerVoters[p.winner] = [];
        winnerVoters[p.winner].push(p.userName);
      }
    });

    // Runner-up
    const ruVoters: Record<string, string[]> = {};
    predictions.forEach((p) => {
      if (p.runnerUp) {
        if (!ruVoters[p.runnerUp]) ruVoters[p.runnerUp] = [];
        ruVoters[p.runnerUp].push(p.userName);
      }
    });

    // Average ranking
    const teamNames = tournament.teams.map((t) => t.name);
    const avgRank = teamNames
      .map((team) => {
        const positions = predictions
          .map((p) => p.teamRanking.indexOf(team))
          .filter((idx) => idx >= 0)
          .map((idx) => idx + 1);
        const avg = positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : 99;
        return { team, avg, count: positions.length };
      })
      .sort((a, b) => a.avg - b.avg);

    // Top 4 qualifiers
    const top4Counts: Record<string, string[]> = {};
    predictions.forEach((p) => {
      p.teamRanking.slice(0, 4).forEach((team) => {
        if (!top4Counts[team]) top4Counts[team] = [];
        top4Counts[team].push(p.userName);
      });
    });

    // Last place
    const lastPlaceCounts: Record<string, string[]> = {};
    predictions.forEach((p) => {
      const last = p.teamRanking[p.teamRanking.length - 1];
      if (last) {
        if (!lastPlaceCounts[last]) lastPlaceCounts[last] = [];
        lastPlaceCounts[last].push(p.userName);
      }
    });

    // Runs
    const runsVoters: Record<string, string[]> = {};
    predictions.forEach((p) => {
      p.runs.filter(Boolean).forEach((player) => {
        if (!runsVoters[player]) runsVoters[player] = [];
        if (!runsVoters[player].includes(p.userName)) runsVoters[player].push(p.userName);
      });
    });

    // Wickets
    const wicketsVoters: Record<string, string[]> = {};
    predictions.forEach((p) => {
      p.wickets.filter(Boolean).forEach((player) => {
        if (!wicketsVoters[player]) wicketsVoters[player] = [];
        if (!wicketsVoters[player].includes(p.userName)) wicketsVoters[player].push(p.userName);
      });
    });

    // MVP
    const mvpVoters: Record<string, string[]> = {};
    predictions.forEach((p) => {
      if (p.mvp) {
        if (!mvpVoters[p.mvp]) mvpVoters[p.mvp] = [];
        mvpVoters[p.mvp].push(p.userName);
      }
    });

    return {
      winnerSorted: Object.entries(winnerVoters).sort((a, b) => b[1].length - a[1].length),
      ruSorted: Object.entries(ruVoters).sort((a, b) => b[1].length - a[1].length),
      avgRanking: avgRank,
      top4Sorted: Object.entries(top4Counts).sort((a, b) => b[1].length - a[1].length),
      lastPlaceSorted: Object.entries(lastPlaceCounts).sort((a, b) => b[1].length - a[1].length),
      runsSorted: Object.entries(runsVoters).sort((a, b) => b[1].length - a[1].length).slice(0, 8),
      wicketsSorted: Object.entries(wicketsVoters).sort((a, b) => b[1].length - a[1].length).slice(0, 8),
      mvpSorted: Object.entries(mvpVoters).sort((a, b) => b[1].length - a[1].length).slice(0, 5),
    };
  }, [predictions, tournament]);

  // Most controversial pick — smallest majority for winner
  const controversialTeam = winnerSorted.length >= 2
    ? { top: winnerSorted[0], second: winnerSorted[1], spread: winnerSorted[0][1].length - winnerSorted[1][1].length }
    : null;

  // Unanimous picks — anyone picked by 100%
  const unanimousWinner = winnerSorted.find(([, v]) => v.length === total);
  const unanimousRU = ruSorted.find(([, v]) => v.length === total);

  // ─── Helpers ───
  const pct = (count: number) => Math.round((count / total) * 100);

  // Theme-aware subtle colors
  const subtleBg = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)';
  const subtleBorder = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
  const subtleDivider = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)';
  const expandBg = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';

  const SectionHeader = ({ icon: Icon, label }: { icon: typeof Trophy; label: string }) => (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={14} style={{ color: 'var(--accent)' }} />
      <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: subtleBorder }} />
    </div>
  );

  const MAX_VISIBLE_VOTERS = 6;
  const isSmallGroup = total <= 20;

  const VoterList = ({ voterKey, voters }: { voterKey: string; voters: string[] }) => {
    // Don't show expand button for large groups — just the count is enough
    if (!isSmallGroup) return null;

    const isExpanded = expandedVoters[voterKey];
    const visibleNames = voters.slice(0, MAX_VISIBLE_VOTERS);
    const remaining = voters.length - MAX_VISIBLE_VOTERS;

    return (
      <>
        <button
          onClick={() => toggleVoters(voterKey)}
          className="shrink-0 w-5 h-5 rounded flex items-center justify-center transition-colors"
          style={{ background: isExpanded ? expandBg : 'transparent' }}
        >
          {isExpanded
            ? <ChevronUp size={11} style={{ color: 'var(--text-muted)' }} />
            : <ChevronDown size={11} style={{ color: 'var(--text-muted)' }} />}
        </button>
        {isExpanded && (
          <div className="col-span-full mt-1 mb-1 ml-8 text-[10px] font-medium animate-fade-in" style={{ color: 'var(--gold)' }}>
            {visibleNames.join(', ')}{remaining > 0 ? ` and ${remaining} other${remaining > 1 ? 's' : ''}` : ''}
          </div>
        )}
      </>
    );
  };

  const TeamBar = ({ team, voters, sectionKey, showPct = true }: { team: string; voters: string[]; sectionKey: string; showPct?: boolean }) => {
    const color = getTeamColor(team);
    const percentage = pct(voters.length);
    const voterKey = `${sectionKey}-${team}`;
    return (
      <div className="grid items-center gap-2" style={{ gridTemplateColumns: isSmallGroup ? '2.5rem 1fr auto auto' : '2.5rem 1fr auto' }}>
        {/* Team badge */}
        <div
          className="flex items-center justify-center rounded-md text-[9px] font-black h-6"
          style={{ background: color.bg, color: color.text }}
        >
          {getTeamShort(team)}
        </div>
        {/* Bar */}
        <div className="h-5 rounded-md overflow-hidden" style={{ background: subtleBg }}>
          <div
            className="h-full rounded-md transition-all duration-500"
            style={{
              width: `${Math.max(percentage, 8)}%`,
              background: `linear-gradient(90deg, ${color.bg}cc, ${color.bg}55)`,
            }}
          />
        </div>
        {/* Count */}
        <span className="text-[11px] font-bold tabular-nums min-w-[2.5rem] text-right" style={{ color: showPct ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
          {showPct ? `${percentage}%` : `${voters.length}/${total}`}
        </span>
        <VoterList voterKey={voterKey} voters={voters} />
      </div>
    );
  };

  const PlayerBar = ({ name, voters, sectionKey, barColor }: { name: string; voters: string[]; sectionKey: string; barColor: string }) => {
    const percentage = pct(voters.length);
    const voterKey = `${sectionKey}-${name}`;
    return (
      <div className="grid items-center gap-2" style={{ gridTemplateColumns: isSmallGroup ? '6.5rem 1fr auto auto' : '6.5rem 1fr auto' }}>
        <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          {name}
        </span>
        <div className="h-4 rounded-md overflow-hidden" style={{ background: subtleBg }}>
          <div
            className="h-full rounded-md transition-all duration-500"
            style={{ width: `${Math.max(percentage, 8)}%`, background: barColor, opacity: 0.75 }}
          />
        </div>
        <span className="text-[10px] font-bold tabular-nums min-w-[2rem] text-right" style={{ color: 'var(--text-secondary)' }}>
          {voters.length}/{total}
        </span>
        <VoterList voterKey={voterKey} voters={voters} />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* ─── Quick Stats Row ─── */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        <div className="rounded-xl p-3 text-center" style={{ background: isLight ? 'rgba(184,134,11,0.08)' : 'rgba(255,215,0,0.06)', border: isLight ? '1px solid rgba(184,134,11,0.18)' : '1px solid rgba(255,215,0,0.12)' }}>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#FFD700' }}>Favourite</div>
          {winnerSorted[0] && (
            <>
              <div
                className="inline-flex items-center justify-center rounded-lg text-[10px] font-black px-2.5 py-1 mx-auto"
                style={{ background: getTeamColor(winnerSorted[0][0]).bg, color: getTeamColor(winnerSorted[0][0]).text }}
              >
                {getTeamShort(winnerSorted[0][0])}
              </div>
              <div className="text-[10px] font-bold mt-1" style={{ color: 'var(--text-secondary)' }}>
                {pct(winnerSorted[0][1].length)}% picked
              </div>
            </>
          )}
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: isLight ? 'rgba(5,150,105,0.08)' : 'rgba(0,212,170,0.06)', border: isLight ? '1px solid rgba(5,150,105,0.18)' : '1px solid rgba(0,212,170,0.12)' }}>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--accent)' }}>Predictions</div>
          <div className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>{total}</div>
          <div className="text-[10px] font-bold" style={{ color: 'var(--text-secondary)' }}>submitted</div>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: isLight ? 'rgba(219,39,119,0.08)' : 'rgba(244,114,182,0.06)', border: isLight ? '1px solid rgba(219,39,119,0.18)' : '1px solid rgba(244,114,182,0.12)' }}>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#F472B6' }}>
            {unanimousWinner ? 'Unanimous' : 'Split'}
          </div>
          {unanimousWinner ? (
            <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
              Everyone picked {getTeamShort(unanimousWinner[0])}!
            </div>
          ) : controversialTeam ? (
            <div className="text-[10px] font-bold" style={{ color: 'var(--text-secondary)' }}>
              {getTeamShort(controversialTeam.top[0])} vs {getTeamShort(controversialTeam.second[0])}
              <br />
              <span style={{ color: 'var(--text-muted)' }}>{controversialTeam.spread} vote gap</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* ─── Consensus Ranking ─── */}
      <div>
        <SectionHeader icon={Target} label="Consensus Ranking" />
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: `1px solid ${subtleBorder}` }}
        >
          {avgRanking.map(({ team, avg }, idx) => {
            const color = getTeamColor(team);
            const isTopFour = idx < 4;
            return (
              <div
                key={team}
                className="flex items-center gap-2.5 px-3 py-2"
                style={{
                  borderBottom: idx < avgRanking.length - 1 ? `1px solid ${subtleDivider}` : 'none',
                  background: isTopFour ? `${color.bg}${isLight ? '18' : '08'}` : 'transparent',
                }}
              >
                <span
                  className="text-[11px] font-black w-5 text-center tabular-nums"
                  style={{ color: isTopFour ? color.bg : 'var(--text-muted)' }}
                >
                  {idx + 1}
                </span>
                <div
                  className="flex items-center justify-center rounded-md text-[8px] font-black w-8 h-6 shrink-0"
                  style={{ background: color.bg, color: color.text }}
                >
                  {getTeamShort(team)}
                </div>
                <span className="text-xs font-semibold flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                  {team}
                </span>
                {/* Mini bar showing avg spread */}
                <div className="w-20 h-3 rounded-full overflow-hidden" style={{ background: subtleBg }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(100 - ((avg - 1) / (tournament.teams.length - 1)) * 100, 8)}%`,
                      background: `${color.bg}88`,
                    }}
                  />
                </div>
                <span className="text-[10px] font-bold w-6 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                  {avg.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Top 4 Qualifiers ─── */}
      <div>
        <SectionHeader icon={Zap} label="Playoff Qualifiers" />
        <div className="space-y-1.5">
          {top4Sorted.map(([team, voters]) => (
            <TeamBar key={team} team={team} voters={voters} sectionKey="top4" />
          ))}
        </div>
      </div>

      {/* ─── Winner & Runner-up ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <SectionHeader icon={Trophy} label="Winner Picks" />
          <div className="space-y-1.5">
            {winnerSorted.map(([team, voters]) => (
              <TeamBar key={team} team={team} voters={voters} sectionKey="winner" />
            ))}
          </div>
        </div>
        <div>
          <SectionHeader icon={Medal} label="Runner-up Picks" />
          <div className="space-y-1.5">
            {ruSorted.map(([team, voters]) => (
              <TeamBar key={team} team={team} voters={voters} sectionKey="ru" />
            ))}
          </div>
        </div>
      </div>

      {/* ─── Last Place ─── */}
      {lastPlaceSorted.length > 0 && (
        <div>
          <SectionHeader icon={TrendingDown} label="Predicted Last Place" />
          <div className="space-y-1.5">
            {lastPlaceSorted.map(([team, voters]) => (
              <TeamBar key={team} team={team} voters={voters} sectionKey="last" />
            ))}
          </div>
        </div>
      )}

      {/* ─── Player Picks ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {runsSorted.length > 0 && (
          <div>
            <SectionHeader icon={Target} label="Most Picked Run Scorers" />
            <div className="space-y-1.5">
              {runsSorted.map(([name, voters]) => (
                <PlayerBar key={name} name={name} voters={voters} sectionKey="runs" barColor="#62B4FF" />
              ))}
            </div>
          </div>
        )}
        {wicketsSorted.length > 0 && (
          <div>
            <SectionHeader icon={Zap} label="Most Picked Wicket Takers" />
            <div className="space-y-1.5">
              {wicketsSorted.map(([name, voters]) => (
                <PlayerBar key={name} name={name} voters={voters} sectionKey="wickets" barColor="#A78BFA" />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── MVP ─── */}
      {mvpSorted.length > 0 && (
        <div>
          <SectionHeader icon={Star} label="MVP Picks" />
          <div className="space-y-1.5">
            {mvpSorted.map(([name, voters]) => (
              <PlayerBar key={name} name={name} voters={voters} sectionKey="mvp" barColor="#FFD700" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
