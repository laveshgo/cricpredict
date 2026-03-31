'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Calendar, CheckCircle, Clock, Radio, Loader2, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getMatchesForTournament, getMatchScorecard } from '@/lib/fantasy-firestore';
import type { CricketMatch, MatchStatus, MatchScorecardDoc, ScorecardInnings } from '@/types/fantasy';

/** Parse a date that could be an ISO string or a Unix timestamp (ms) stored as string. */
function parseDate(d: string): Date {
  return new Date(isNaN(Number(d)) ? d : Number(d));
}

// Impact player substitute icon — swap arrows styled green (in) or red (out)
function SubIcon({ type }: { type: 'in' | 'out' }) {
  const color = type === 'in' ? '#34d399' : '#f87171'; // emerald-400 / red-400
  const title = type === 'in' ? 'Impact sub (in)' : 'Impact sub (out)';
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width={12} height={12} className="shrink-0 inline-block" aria-label={title}>
      <title>{title}</title>
      <path d="M3 6 L7 2 8 3 6 5 14 5 14 7 6 7 8 9 7 10 Z M15 12 L11 8 10 9 12 11 4 11 4 13 12 13 10 15 11 16 Z" fill={color} />
    </svg>
  );
}

interface TournamentFixturesProps {
  tournamentId: string;
  isLight: boolean;
}

type FilterTab = 'all' | 'completed' | 'upcoming' | 'live';

const STATUS_CONFIG: Record<MatchStatus, { label: string; cls: string; icon: typeof CheckCircle }> = {
  completed: { label: 'Completed', cls: 'bg-emerald-500/15 text-emerald-400', icon: CheckCircle },
  live: { label: 'Live', cls: 'bg-red-500/15 text-red-400', icon: Radio },
  upcoming: { label: 'Upcoming', cls: 'bg-blue-500/15 text-blue-400', icon: Clock },
  no_result: { label: 'No Result', cls: 'bg-gray-500/15 text-gray-400', icon: Clock },
  abandoned: { label: 'Abandoned', cls: 'bg-gray-500/15 text-gray-400', icon: Clock },
};

// ─── Innings scorecard sub-component ───

function InningsCard({ innings, potm }: { innings: ScorecardInnings; potm?: string }) {
  return (
    <div className="space-y-3">
      {/* Innings header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[var(--text-primary)]">{innings.teamShort || innings.team}</span>
        <span className="text-xs font-semibold text-[var(--text-secondary)]">{innings.score}</span>
      </div>

      {/* Batting table */}
      {innings.batters.length > 0 && (() => {
        const batted = innings.batters.filter(b => !(b.dismissal === 'did not bat' || (!b.balls && !b.runs && !b.isOut)));
        const dnbPlayers = innings.batters.filter(b => b.dismissal === 'did not bat' || (!b.balls && !b.runs && !b.isOut));
        return (
        <div>
          <div className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            Batting
          </div>
          {/* Header row */}
          <div className="flex items-center gap-1 px-2 py-1 text-[11px] sm:text-[10px] font-semibold text-[var(--text-muted)] uppercase">
            <span className="flex-1 sm:w-[40%] sm:flex-none shrink-0">Batter</span>
            <span className="flex-1 hidden sm:block"></span>
            <span className="w-8 text-right">R</span>
            <span className="w-8 text-right">B</span>
            <span className="w-6 text-right">4s</span>
            <span className="w-6 text-right">6s</span>
            <span className="w-10 text-right">SR</span>
          </div>
          {batted.map((b, i) => {
            const isPotm = potm && b.name.toLowerCase().includes(potm.split(' ').pop()?.toLowerCase() || '___');
            const hasDismissal = b.dismissal && b.dismissal !== 'out' && b.dismissal !== 'not out' && b.dismissal !== 'did not bat' && b.dismissal.length > 3;
            return (
              <div key={`${b.name}-${i}`} className="group">
                <div className="flex items-center gap-1 px-2 py-1.5 hover:bg-[var(--bg-elevated)]/60 rounded transition-colors">
                  {/* Position + Name */}
                  <div className="flex items-center gap-1 min-w-0 flex-1 sm:w-[40%] sm:flex-none shrink-0">
                    <span className="text-[11px] sm:text-[10px] text-[var(--text-muted)] w-3 shrink-0">{b.battingPosition}.</span>
                    <span className="text-[13px] sm:text-xs text-[var(--text-primary)] truncate">{b.name}</span>
                    {b.impactSub && <SubIcon type={b.impactSub} />}
                    {isPotm && <Star size={9} className="text-amber-400 fill-amber-400 shrink-0" />}
                  </div>
                  {/* Dismissal / not out — in the middle between name and stats */}
                  <div className="flex-1 min-w-0 hidden sm:block">
                    {hasDismissal ? (
                      <span className="text-[9px] text-[var(--text-muted)] italic truncate block">{b.dismissal}</span>
                    ) : !b.isOut ? (
                      <span className="text-[9px] text-emerald-400 font-medium">not out</span>
                    ) : null}
                  </div>
                  {/* Stats columns */}
                  <span className={`w-8 text-right text-[13px] sm:text-xs font-bold ${
                    b.runs >= 100 ? 'text-amber-400' : b.runs >= 50 ? 'text-amber-400' : b.runs >= 30 ? 'text-blue-400' : 'text-[var(--text-primary)]'
                  }`}>{b.runs}</span>
                  <span className="w-8 text-right text-[11px] sm:text-[10px] text-[var(--text-muted)]">{b.balls}</span>
                  <span className="w-6 text-right text-[11px] sm:text-[10px] text-[var(--text-muted)]">{b.fours || '-'}</span>
                  <span className="w-6 text-right text-[11px] sm:text-[10px] text-[var(--text-muted)]">{b.sixes || '-'}</span>
                  <span className={`w-10 text-right text-[11px] sm:text-[10px] ${
                    b.strikeRate > 150 ? 'text-emerald-400 font-semibold' : 'text-[var(--text-muted)]'
                  }`}>{b.strikeRate ? b.strikeRate.toFixed(1) : '-'}</span>
                </div>
                {/* Dismissal on mobile (below name since middle column is hidden) */}
                {hasDismissal && (
                  <div className="px-2 pl-7 -mt-1 pb-0.5 sm:hidden">
                    <span className="text-[11px] text-[var(--text-muted)] italic">{b.dismissal}</span>
                  </div>
                )}
                {!b.isOut && !hasDismissal && (
                  <div className="px-2 pl-7 -mt-1 pb-0.5 sm:hidden">
                    <span className="text-[11px] text-emerald-400 font-medium">not out</span>
                  </div>
                )}
              </div>
            );
          })}
          {/* Extras */}
          {innings.extras && (
            <div className="flex items-center gap-1 px-2 py-1.5 border-t border-[var(--border)]/50 mt-1">
              <span className="text-[10px] text-[var(--text-muted)] font-medium">Extras</span>
              <span className="text-[10px] text-[var(--text-secondary)] font-bold ml-1">{innings.extras.total}</span>
              <span className="text-[9px] text-[var(--text-muted)] ml-1">
                ({[
                  innings.extras.byes ? `b ${innings.extras.byes}` : null,
                  innings.extras.legByes ? `lb ${innings.extras.legByes}` : null,
                  innings.extras.wides ? `w ${innings.extras.wides}` : null,
                  innings.extras.noBalls ? `nb ${innings.extras.noBalls}` : null,
                  innings.extras.penalty ? `pen ${innings.extras.penalty}` : null,
                ].filter(Boolean).join(', ')})
              </span>
            </div>
          )}
          {/* Did not bat — horizontal list */}
          {dnbPlayers.length > 0 && (
            <div className="px-2 pt-2 pb-1 border-t border-[var(--border)]/50 mt-1">
              <span className="text-[11px] sm:text-[10px] text-[var(--text-muted)] font-semibold">Did not bat: </span>
              <span className="text-[11px] sm:text-[10px] text-[var(--text-muted)]">
                {dnbPlayers.map((b, i) => (
                  <span key={b.name}>
                    <span className="text-[var(--text-secondary)]">{b.name}</span>
                    {b.impactSub && <>{' '}<SubIcon type={b.impactSub} /></>}
                    {i < dnbPlayers.length - 1 && ', '}
                  </span>
                ))}
              </span>
            </div>
          )}
        </div>
        );
      })()}

      {/* Bowling table */}
      {innings.bowlers.length > 0 && (
        <div>
          <div className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            Bowling
          </div>
          {/* Header */}
          <div className="flex items-center gap-1 px-2 py-1 text-[11px] sm:text-[10px] font-semibold text-[var(--text-muted)] uppercase">
            <span className="flex-1">Bowler</span>
            <span className="w-8 text-right">O</span>
            <span className="w-8 text-right">M</span>
            <span className="w-8 text-right">R</span>
            <span className="w-6 text-right">W</span>
            <span className="w-10 text-right">Econ</span>
          </div>
          {innings.bowlers.map((bw, i) => {
            const isBowlerPotm = potm && bw.name.toLowerCase().includes(potm.split(' ').pop()?.toLowerCase() || '___');
            return (
            <div key={`${bw.name}-${i}`} className="flex items-center gap-1 px-2 py-1.5 hover:bg-[var(--bg-elevated)]/60 rounded transition-colors">
              <div className="flex-1 min-w-0 flex items-center gap-1">
                <span className="text-[13px] sm:text-xs text-[var(--text-primary)] truncate">{bw.name}</span>
                {bw.impactSub && <SubIcon type={bw.impactSub} />}
                {isBowlerPotm && <Star size={10} className="text-amber-400 fill-amber-400 shrink-0" />}
              </div>
              <span className="w-8 text-right text-[11px] sm:text-[10px] text-[var(--text-muted)]">{bw.overs}</span>
              <span className="w-8 text-right text-[11px] sm:text-[10px] text-[var(--text-muted)]">{bw.maidens || '-'}</span>
              <span className="w-8 text-right text-[11px] sm:text-[10px] text-[var(--text-muted)]">{bw.runsConceded}</span>
              <span className={`w-6 text-right text-[13px] sm:text-xs font-bold ${
                bw.wickets >= 3 ? 'text-purple-400' : 'text-[var(--text-primary)]'
              }`}>{bw.wickets}</span>
              <span className={`w-10 text-right text-[11px] sm:text-[10px] ${
                bw.economy <= 6 ? 'text-emerald-400 font-semibold' : bw.economy >= 10 ? 'text-red-400' : 'text-[var(--text-muted)]'
              }`}>{bw.economy.toFixed(1)}</span>
            </div>
            );
          })}
        </div>
      )}

      {/* Fielding highlights */}
      {innings.fielders.length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Fielding
          </div>
          <div className="flex flex-wrap gap-1.5">
            {innings.fielders.map((f, i) => {
              const parts: string[] = [];
              if (f.catches) parts.push(`${f.catches}c`);
              if (f.stumpings) parts.push(`${f.stumpings}st`);
              if (f.runOuts) parts.push(`${f.runOuts}ro`);
              return (
                <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-[var(--bg-elevated)] border border-[var(--border)]">
                  <span className="text-[var(--text-primary)] font-medium">{f.name}</span>
                  <span className="text-emerald-400 font-bold">{parts.join(', ')}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Fall of Wickets */}
      {innings.fallOfWickets && innings.fallOfWickets.length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
            Fall of Wickets
          </div>
          <div className="flex flex-wrap gap-1.5">
            {innings.fallOfWickets.map((fow) => (
              <span key={fow.wicketNumber} className="text-[9px] text-[var(--text-muted)]">
                {fow.wicketNumber}-{fow.runs}{fow.overs ? ` (${fow.overs})` : ''}
                {fow.batterName ? ` ${fow.batterName}` : ''}
                {fow.wicketNumber < (innings.fallOfWickets?.length || 0) ? ',' : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Full scorecard for a match ───

function MatchScorecard({ scorecard, isLight }: {
  scorecard: MatchScorecardDoc;
  isLight: boolean;
}) {
  const [activeInnings, setActiveInnings] = useState(0);

  if (!scorecard.innings || scorecard.innings.length === 0) {
    return (
      <p className="text-xs text-[var(--text-muted)] text-center py-3">
        No scorecard data available for this match.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* POTM banner */}
      {scorecard.potm && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20">
          <Star size={12} className="text-amber-400 fill-amber-400" />
          <span className="text-[10px] text-amber-400 font-semibold">Player of the Match:</span>
          <span className="text-[10px] text-[var(--text-primary)] font-medium">{scorecard.potm}</span>
        </div>
      )}

      {/* Innings tabs (if more than 1) */}
      {scorecard.innings.length > 1 && (
        <div className="flex gap-2">
          {scorecard.innings.map((inn, idx) => (
            <button
              key={idx}
              onClick={(e) => { e.stopPropagation(); setActiveInnings(idx); }}
              className={`px-3 py-1 rounded-full text-[10px] font-semibold border transition-all ${
                activeInnings === idx
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--accent)]/50'
              }`}
            >
              {inn.teamShort || inn.team} — {inn.score}
            </button>
          ))}
        </div>
      )}

      {/* Active innings */}
      <InningsCard innings={scorecard.innings[activeInnings]} potm={scorecard.potm} />
    </div>
  );
}

// ─── Main component ───

export default function TournamentFixtures({ tournamentId, isLight }: TournamentFixturesProps) {
  const [matches, setMatches] = useState<CricketMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [scorecards, setScorecards] = useState<Map<string, MatchScorecardDoc>>(new Map());
  const [loadingScorecard, setLoadingScorecard] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getMatchesForTournament(tournamentId);
        if (!cancelled) {
          data.sort((a, b) => {
            if (a.status === 'live' && b.status !== 'live') return -1;
            if (b.status === 'live' && a.status !== 'live') return 1;
            return parseDate(a.startDate).getTime() - parseDate(b.startDate).getTime();
          });
          setMatches(data);
        }
      } catch (err) {
        console.error('Failed to load fixtures:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [tournamentId]);

  // Fetch full scorecard on demand when a match is expanded
  const handleToggleMatch = useCallback(async (matchId: string, scorecardFetched: boolean) => {
    if (expandedMatch === matchId) {
      setExpandedMatch(null);
      return;
    }
    setExpandedMatch(matchId);

    if (!scorecardFetched) return;
    if (scorecards.has(matchId)) return; // already cached

    setLoadingScorecard(matchId);
    try {
      const sc = await getMatchScorecard(matchId);
      if (sc) {
        setScorecards(prev => new Map(prev).set(matchId, sc));
      }
    } catch (err) {
      console.error(`Failed to load scorecard for match ${matchId}:`, err);
    } finally {
      setLoadingScorecard(null);
    }
  }, [expandedMatch, scorecards]);

  const counts = useMemo(() => ({
    all: matches.length,
    completed: matches.filter(m => m.status === 'completed').length,
    upcoming: matches.filter(m => m.status === 'upcoming').length,
    live: matches.filter(m => m.status === 'live').length,
  }), [matches]);

  const filtered = useMemo(() => {
    if (filter === 'all') return matches;
    return matches.filter(m => m.status === filter);
  }, [matches, filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <Card className="border-[var(--border)]">
        <CardContent className="p-8 text-center">
          <Calendar size={32} className="text-[var(--text-muted)] mx-auto mb-2" />
          <p className="text-sm font-medium text-[var(--text-primary)] mb-1">No fixtures yet</p>
          <p className="text-xs text-[var(--text-muted)]">
            Tournament admin needs to refresh match data from Cricbuzz.
          </p>
        </CardContent>
      </Card>
    );
  }

  const FILTER_TABS: Array<{ key: FilterTab; label: string }> = [
    { key: 'all', label: `All (${counts.all})` },
    ...(counts.live > 0 ? [{ key: 'live' as FilterTab, label: `Live (${counts.live})` }] : []),
    { key: 'completed', label: `Done (${counts.completed})` },
    { key: 'upcoming', label: `Upcoming (${counts.upcoming})` },
  ];

  return (
    <div className="space-y-3">
      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all shrink-0 ${
              filter === key
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--accent)]/50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Match list */}
      <div className="space-y-2">
        {filtered.map((match) => {
          const cfg = STATUS_CONFIG[match.status] || STATUS_CONFIG.upcoming;
          const StatusIcon = cfg.icon;
          const isExpanded = expandedMatch === match.id;
          const canExpand = match.status === 'completed' && match.scorecardFetched;

          return (
            <Card
              key={match.id}
              className={`border overflow-hidden transition-all ${
                canExpand ? 'cursor-pointer hover:border-[var(--accent)]/30' : ''
              } ${isExpanded ? 'border-[var(--accent)]/40' : 'border-[var(--border)]'}`}
              onClick={() => canExpand && handleToggleMatch(match.id, match.scorecardFetched)}
            >
              <CardContent className="p-0">
                <div className="p-3">
                  {/* Match description + date + status */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-[var(--text-muted)]">{match.matchDesc}</span>
                      {match.startDate && (
                        <span className="text-[10px] text-[var(--text-muted)]">
                          · {parseDate(match.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge className={`${cfg.cls} border-0 text-[9px] gap-1`}>
                        <StatusIcon size={8} />
                        {cfg.label}
                      </Badge>
                      {canExpand && (
                        <span className="text-[var(--text-muted)]">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Teams */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-[var(--text-primary)]">
                        {match.team1.shortName || match.team1.name}
                      </span>
                      {match.team1.score && (
                        <span className="text-sm font-medium text-[var(--text-secondary)]">
                          {match.team1.score}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-[var(--text-primary)]">
                        {match.team2.shortName || match.team2.name}
                      </span>
                      {match.team2.score && (
                        <span className="text-sm font-medium text-[var(--text-secondary)]">
                          {match.team2.score}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Result text */}
                  {match.statusText && match.status === 'completed' && (
                    <p className="text-[10px] text-[var(--text-muted)] mt-2 italic">
                      {match.statusText}
                    </p>
                  )}

                  {/* POTM */}
                  {match.potm && !isExpanded && (
                    <p className="text-[10px] text-amber-400 mt-1">
                      ★ {match.potm}
                    </p>
                  )}

                  {/* Time for upcoming */}
                  {match.status === 'upcoming' && match.startDate && (
                    <p className="text-[10px] text-[var(--text-muted)] mt-2">
                      {parseDate(match.startDate).toLocaleDateString(undefined, {
                        weekday: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>

                {/* Expanded scorecard */}
                {isExpanded && (
                  <div className="border-t border-[var(--border)] px-3 py-3 bg-[var(--bg-elevated)]/30">
                    {loadingScorecard === match.id ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" />
                        <span className="text-xs text-[var(--text-muted)] ml-2">Loading scorecard...</span>
                      </div>
                    ) : scorecards.has(match.id) ? (
                      <MatchScorecard
                        scorecard={scorecards.get(match.id)!}
                        isLight={isLight}
                      />
                    ) : (
                      <p className="text-xs text-[var(--text-muted)] text-center py-3">
                        No scorecard data available.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-xs text-[var(--text-muted)] text-center py-4">
          No {filter} matches.
        </p>
      )}
    </div>
  );
}
