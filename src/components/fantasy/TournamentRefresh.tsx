'use client';

import { useState, useCallback } from 'react';
import { Loader2, RefreshCw, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Trophy, Zap, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getAuth } from 'firebase/auth';

interface TournamentRefreshProps {
  tournamentId: string;
  tournamentName?: string;
  isCreator: boolean;
  isLight: boolean;
}

interface RefreshResult {
  success: boolean;
  matchesFound?: number;
  matchesUpdated?: number;
  newScorecards?: number;
  completedMatches?: number;
  leaguesProcessed?: number;
  scoresUpdated?: number;
  refreshedAt?: string;
  error?: string;
}

async function getAuthToken(): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

export default function TournamentRefresh({
  tournamentId,
  tournamentName,
  isCreator,
  isLight,
}: TournamentRefreshProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<RefreshResult | null>(null);
  const [expandedResult, setExpandedResult] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!isCreator) return;
    setRefreshing(true);
    setResult(null);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/tournament/refresh-matches', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tournamentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ success: false, error: data.error || `HTTP ${res.status}` });
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setResult({ success: false, error: err.message || 'Network error' });
    } finally {
      setRefreshing(false);
    }
  }, [tournamentId, isCreator]);

  if (!isCreator) {
    return (
      <Card className="border-[var(--border)]">
        <CardContent className="p-4 text-center">
          <Clock size={20} className="text-[var(--text-muted)] mx-auto mb-2" />
          <p className="text-xs text-[var(--text-muted)]">
            Match data is refreshed by the tournament admin. Points are auto-calculated when new scorecards are fetched.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Refresh button */}
      <Card className="border-[var(--border)] overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-[var(--accent)]/10">
              <Trophy size={18} className="text-[var(--accent)]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Refresh Match Data
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                Fetches latest match results from Cricbuzz, stores scorecards, and auto-calculates fantasy points for all leagues in{' '}
                <span className="font-semibold">{tournamentName || 'this tournament'}</span>.
              </p>
              <Button
                onClick={handleRefresh}
                disabled={refreshing}
                className="mt-3 bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] gap-2"
              >
                {refreshing ? (
                  <><Loader2 size={14} className="animate-spin" /> Refreshing...</>
                ) : (
                  <><RefreshCw size={14} /> Refresh All Matches</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card className={`border overflow-hidden ${result.success ? 'border-emerald-500/40' : 'border-red-500/40'}`}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              {result.success ? (
                <CheckCircle size={16} className="text-emerald-400" />
              ) : (
                <AlertCircle size={16} className="text-red-400" />
              )}
              <span className={`text-sm font-bold ${result.success ? 'text-emerald-400' : 'text-red-400'}`}>
                {result.success ? 'Refresh Complete!' : 'Refresh Failed'}
              </span>
            </div>

            {result.error && (
              <p className="text-xs text-red-400 mb-2">{result.error}</p>
            )}

            {result.success && (
              <>
                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="text-center p-2 rounded-lg bg-[var(--bg-elevated)]">
                    <div className="text-lg font-bold text-[var(--accent)]">{result.matchesFound ?? 0}</div>
                    <div className="text-[9px] text-[var(--text-muted)] uppercase">Matches</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-[var(--bg-elevated)]">
                    <div className="text-lg font-bold text-emerald-400">{result.newScorecards ?? 0}</div>
                    <div className="text-[9px] text-[var(--text-muted)] uppercase">New Scores</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-[var(--bg-elevated)]">
                    <div className="text-lg font-bold text-amber-400">{result.scoresUpdated ?? 0}</div>
                    <div className="text-[9px] text-[var(--text-muted)] uppercase">Points Calc</div>
                  </div>
                </div>

                <button
                  onClick={() => setExpandedResult(!expandedResult)}
                  className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)]"
                >
                  {expandedResult ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  Details
                </button>

                {expandedResult && (
                  <div className="mt-2 space-y-1 border-t border-[var(--border)] pt-2 text-xs text-[var(--text-secondary)]">
                    <div className="flex justify-between">
                      <span>Matches found</span>
                      <span className="font-medium text-[var(--text-primary)]">{result.matchesFound}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Matches updated</span>
                      <span className="font-medium text-[var(--text-primary)]">{result.matchesUpdated}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>New scorecards fetched</span>
                      <span className="font-medium text-emerald-400">{result.newScorecards}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Completed matches</span>
                      <span className="font-medium text-[var(--text-primary)]">{result.completedMatches}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Leagues processed</span>
                      <span className="font-medium text-[var(--text-primary)]">{result.leaguesProcessed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Scores updated</span>
                      <span className="font-medium text-amber-400">{result.scoresUpdated}</span>
                    </div>
                    {result.refreshedAt && (
                      <div className="flex justify-between">
                        <span>Refreshed at</span>
                        <span className="font-medium text-[var(--text-muted)]">
                          {new Date(result.refreshedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info card */}
      <Card className="border-[var(--border)]">
        <CardContent className="p-3">
          <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
            <Zap size={10} className="inline text-amber-400 mr-1" />
            <strong>How it works:</strong> Refresh fetches all fixtures from Cricbuzz, downloads scorecards for
            completed matches, and auto-calculates fantasy points for every league under this tournament.
            Rate limited to 3 refreshes per minute.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
