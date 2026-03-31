'use client';

import { useState, useCallback } from 'react';
import { Loader2, RefreshCw, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getAuth } from 'firebase/auth';
import type { FantasyLeague, AuctionState } from '@/types/fantasy';

interface AdminScoringProps {
  league: FantasyLeague;
  auctionState: AuctionState;
  seriesId: string;
  isLight: boolean;
}

interface MatchInfo {
  matchId: number;
  matchDesc: string;
  status: string;
  statusText: string;
  team1: { name: string; shortName: string; score?: string };
  team2: { name: string; shortName: string; score?: string };
  startDate: string;
}

interface ProcessResult {
  success: boolean;
  matchId: number;
  weekNumber: number;
  scorecard?: {
    team1: string;
    team2: string;
    potm: string | null;
    innings: number;
  };
  results?: Array<{
    userId: string;
    userName: string;
    matchPoints: number;
    playersScored: number;
  }>;
  error?: string;
}

async function getAuthToken(): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

export default function AdminScoring({ league, auctionState, seriesId, isLight }: AdminScoringProps) {
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matchError, setMatchError] = useState('');
  const [processing, setProcessing] = useState<number | null>(null); // matchId being processed
  const [weekNumber, setWeekNumber] = useState(1);
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);
  const [expandedResult, setExpandedResult] = useState(false);

  const fetchMatches = useCallback(async () => {
    setLoadingMatches(true);
    setMatchError('');
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/fantasy/matches?seriesId=${seriesId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setMatches(data.matches || []);
    } catch (err: any) {
      setMatchError(err.message || 'Failed to fetch matches');
    } finally {
      setLoadingMatches(false);
    }
  }, [seriesId]);

  const processMatch = useCallback(async (matchId: number) => {
    setProcessing(matchId);
    setProcessResult(null);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/fantasy/process-match', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leagueId: league.id,
          matchId,
          weekNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProcessResult({ success: false, matchId, weekNumber, error: data.error || 'Failed' });
      } else {
        setProcessResult({ ...data, matchId, weekNumber });
      }
    } catch (err: any) {
      setProcessResult({ success: false, matchId, weekNumber, error: err.message || 'Network error' });
    } finally {
      setProcessing(null);
    }
  }, [league.id, weekNumber]);

  // Filter to completed matches
  const completedMatches = matches.filter(m =>
    m.status?.toLowerCase().includes('complete') ||
    m.statusText?.toLowerCase().includes('won') ||
    m.statusText?.toLowerCase().includes('tie') ||
    m.statusText?.toLowerCase().includes('no result')
  );

  const upcomingMatches = matches.filter(m =>
    !m.status?.toLowerCase().includes('complete') &&
    !m.statusText?.toLowerCase().includes('won') &&
    !m.statusText?.toLowerCase().includes('tie')
  );

  return (
    <div className="space-y-4">
      {/* Week number selector */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-[var(--text-secondary)]">Match Week:</label>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekNumber(Math.max(1, weekNumber - 1))}
            className="w-7 h-7 rounded-md flex items-center justify-center bg-[var(--bg-elevated)] border border-[var(--border)] text-xs font-bold text-[var(--text-secondary)] hover:border-[var(--accent)]/50"
          >
            -
          </button>
          <span className="w-8 text-center text-sm font-bold text-[var(--accent)]">{weekNumber}</span>
          <button
            onClick={() => setWeekNumber(weekNumber + 1)}
            className="w-7 h-7 rounded-md flex items-center justify-center bg-[var(--bg-elevated)] border border-[var(--border)] text-xs font-bold text-[var(--text-secondary)] hover:border-[var(--accent)]/50"
          >
            +
          </button>
        </div>
      </div>

      {/* Fetch matches button */}
      <Button
        onClick={fetchMatches}
        disabled={loadingMatches}
        className="w-full bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] gap-2"
      >
        {loadingMatches ? (
          <><Loader2 size={16} className="animate-spin" /> Fetching Matches...</>
        ) : (
          <><RefreshCw size={16} /> Fetch Match List from Cricbuzz</>
        )}
      </Button>

      {matchError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
          <AlertCircle size={14} className="text-red-400 shrink-0" />
          <span className="text-xs text-red-400">{matchError}</span>
        </div>
      )}

      {/* Process result */}
      {processResult && (
        <Card className={`border overflow-hidden ${processResult.success ? 'border-emerald-500/40' : 'border-red-500/40'}`}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              {processResult.success ? (
                <CheckCircle size={16} className="text-emerald-400" />
              ) : (
                <AlertCircle size={16} className="text-red-400" />
              )}
              <span className={`text-sm font-bold ${processResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                {processResult.success ? 'Scores Processed!' : 'Processing Failed'}
              </span>
            </div>

            {processResult.success && processResult.scorecard && (
              <div className="text-xs text-[var(--text-secondary)] mb-2">
                {processResult.scorecard.team1} vs {processResult.scorecard.team2}
                {processResult.scorecard.potm && ` · POTM: ${processResult.scorecard.potm}`}
                {' · '}Week {processResult.weekNumber}
              </div>
            )}

            {processResult.error && (
              <p className="text-xs text-red-400">{processResult.error}</p>
            )}

            {processResult.success && processResult.results && (
              <>
                <button
                  onClick={() => setExpandedResult(!expandedResult)}
                  className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)]"
                >
                  {expandedResult ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {processResult.results.length} teams scored
                </button>

                {expandedResult && (
                  <div className="mt-2 space-y-1 border-t border-[var(--border)] pt-2">
                    {processResult.results
                      .sort((a, b) => b.matchPoints - a.matchPoints)
                      .map((r, i) => (
                        <div key={r.userId} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`w-5 text-center font-bold ${
                              i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-400' : 'text-[var(--text-muted)]'
                            }`}>{i + 1}</span>
                            <span className="text-[var(--text-primary)]">{r.userName}</span>
                            <span className="text-[var(--text-muted)]">({r.playersScored} players)</span>
                          </div>
                          <span className="font-bold text-[var(--accent)]">{r.matchPoints} pts</span>
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Completed matches */}
      {completedMatches.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
            Completed Matches ({completedMatches.length})
          </p>
          <div className="space-y-1.5">
            {completedMatches.map((m) => (
              <div
                key={m.matchId}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-bold text-[var(--text-primary)]">{m.team1.shortName}</span>
                    <span className="text-[var(--text-muted)]">vs</span>
                    <span className="font-bold text-[var(--text-primary)]">{m.team2.shortName}</span>
                    <Badge className="bg-emerald-500/15 text-emerald-400 border-0 text-[9px] ml-1">Complete</Badge>
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">
                    {m.matchDesc} · {m.statusText}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => processMatch(m.matchId)}
                  disabled={processing !== null}
                  className="bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] text-[10px] h-7 px-2.5 gap-1"
                >
                  {processing === m.matchId ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Zap size={12} />
                  )}
                  Process
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming matches */}
      {upcomingMatches.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
            Upcoming / Live ({upcomingMatches.length})
          </p>
          <div className="space-y-1.5">
            {upcomingMatches.slice(0, 5).map((m) => (
              <div
                key={m.matchId}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--bg-elevated)]/50 border border-[var(--border)]/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-medium text-[var(--text-secondary)]">{m.team1.shortName}</span>
                    <span className="text-[var(--text-muted)]">vs</span>
                    <span className="font-medium text-[var(--text-secondary)]">{m.team2.shortName}</span>
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{m.matchDesc}</div>
                </div>
                <Badge className="bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] text-[9px]">
                  {m.status || 'Upcoming'}
                </Badge>
              </div>
            ))}
            {upcomingMatches.length > 5 && (
              <p className="text-[10px] text-[var(--text-muted)] text-center">
                +{upcomingMatches.length - 5} more matches
              </p>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {matches.length === 0 && !loadingMatches && !matchError && (
        <Card className="border-[var(--border)]">
          <CardContent className="p-6 text-center">
            <Zap size={24} className="text-[var(--text-muted)] mx-auto mb-2" />
            <p className="text-xs text-[var(--text-muted)]">
              Click &quot;Fetch Match List&quot; to load matches from Cricbuzz, then process completed matches to calculate fantasy scores.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Manual match ID input */}
      <Card className="border-[var(--border)]">
        <CardContent className="p-3">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
            Manual Process (by Match ID)
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const input = form.elements.namedItem('manualMatchId') as HTMLInputElement;
              const id = parseInt(input.value, 10);
              if (id > 0) processMatch(id);
            }}
            className="flex gap-2"
          >
            <input
              name="manualMatchId"
              type="number"
              placeholder="Cricbuzz Match ID"
              className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            />
            <Button
              type="submit"
              size="sm"
              disabled={processing !== null}
              className="bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] text-xs h-8 px-3 gap-1"
            >
              {processing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              Process
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
