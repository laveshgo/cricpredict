'use client';

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Share2, User, Download } from 'lucide-react';
import type { TournamentPrediction, Tournament } from '@/types';

// Lazy load heavy components
const ShareCard = dynamic(() => import('@/components/prediction/ShareCard'));
const PredictionSummary = dynamic(() => import('@/components/prediction/PredictionSummary'));

interface AllPicksTabProps {
  allPredictions: TournamentPrediction[];
  tournament: Tournament;
  currentUserId?: string;
  groupName: string;
}

function AllPicksTab({
  allPredictions,
  tournament,
  currentUserId,
  groupName,
}: AllPicksTabProps) {
  const [expandedPrediction, setExpandedPrediction] = useState<string | null>(null);
  const [shareCardPrediction, setShareCardPrediction] = useState<TournamentPrediction | null>(null);

  // O(1) team lookup map
  const teamMap = useMemo(() => new Map(tournament.teams.map(t => [t.name, t])), [tournament.teams]);

  // Export predictions as CSV
  const exportCSV = () => {
    if (!tournament || allPredictions.length === 0) return;
    const teams = tournament.teams.map(t => t.shortName);
    const headers = ['User', ...teams.map((_, i) => `Rank${i + 1}`), 'Winner', 'Runner-up', ...Array.from({ length: 5 }, (_, i) => `RunScorer${i + 1}`), ...Array.from({ length: 5 }, (_, i) => `WicketTaker${i + 1}`), 'MVP', 'Submitted'];
    const rows = allPredictions.map(p => [
      p.userName,
      ...p.teamRanking.map(t => teamMap.get(t)?.shortName || t),
      teamMap.get(p.winner)?.shortName || p.winner,
      teamMap.get(p.runnerUp)?.shortName || p.runnerUp,
      ...p.runs,
      ...p.wickets,
      p.mvp,
      new Date(p.submittedAt).toLocaleString('en-IN'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tournament.shortName}-predictions.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <p className="text-sm text-[var(--text-secondary)]">
          {allPredictions.length} prediction{allPredictions.length !== 1 ? 's' : ''} submitted
        </p>
        <div className="flex gap-2">
          <Button
            onClick={exportCSV}
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs border-[var(--accent-dim)] text-[var(--accent)] hover:bg-[var(--accent-ghost)]"
          >
            <Download size={12} />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Compact user list with expand */}
      {allPredictions.map((pred) => (
        <div key={pred.userId}>
          <button
            onClick={() => setExpandedPrediction(expandedPrediction === pred.userId ? null : pred.userId)}
            className="w-full text-left"
          >
            <Card className={`glass-card transition-all duration-200 hover:border-[var(--accent-dim)] ${
              expandedPrediction === pred.userId ? 'border-[var(--accent)] shadow-lg shadow-[var(--accent)]/10' : ''
            } ${pred.userId === currentUserId ? 'border-[var(--accent)] border-opacity-50' : ''}`}>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-[var(--bg-elevated)]">
                    <User size={14} className="text-[var(--text-muted)]" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {pred.userName}
                    </span>
                    {pred.userId === currentUserId && (
                      <Badge className="text-[9px] px-1.5 py-0 bg-[var(--accent)]/20 text-[var(--accent)] border-[var(--accent)]/40">you</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {new Date(pred.submittedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {pred.winner && (
                      <>
                        <span className="text-[10px] text-[var(--text-muted)]">·</span>
                        <Badge
                          style={{ background: teamMap.get(pred.winner)?.color?.bg || '#333', color: teamMap.get(pred.winner)?.color?.text || '#fff' }}
                          className="text-[9px] px-1.5 py-0"
                        >
                          {teamMap.get(pred.winner)?.shortName || '?'}
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
                <div className="shrink-0">
                  {expandedPrediction === pred.userId ? <ChevronUp size={16} className="text-[var(--accent)]" /> : <ChevronDown size={16} className="text-[var(--text-muted)]" />}
                </div>
              </CardContent>
            </Card>
          </button>

          {expandedPrediction === pred.userId && (
            <div className="mt-2 mb-4 animate-fade-in">
              <PredictionSummary
                prediction={pred}
                tournament={tournament}
                isCurrentUser={pred.userId === currentUserId}
              />
              {pred.winner && (
                <Button
                  onClick={(e) => { e.stopPropagation(); setShareCardPrediction(pred); }}
                  variant="ghost"
                  size="sm"
                  className="mt-2 gap-1.5 text-xs text-[var(--accent)] hover:bg-[var(--accent-ghost)]"
                >
                  <Share2 size={12} />
                  Share as Image
                </Button>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Share Card Modal */}
      {shareCardPrediction && (
        <ShareCard
          prediction={shareCardPrediction}
          tournament={tournament}
          groupName={groupName}
          onClose={() => setShareCardPrediction(null)}
        />
      )}
    </div>
  );
}

export default React.memo(AllPicksTab);
