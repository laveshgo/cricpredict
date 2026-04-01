'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getAllUserFantasyLeagues } from '@/lib/fantasy-firestore';
import type { FantasyLeague } from '@/types/fantasy';
import Link from 'next/link';
import { Swords, ChevronRight, Loader2 } from 'lucide-react';

export default function FantasyPage() {
  const { user, loading: authLoading } = useAuth();
  const [leagues, setLeagues] = useState<FantasyLeague[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) { setLoading(false); return; }
    getAllUserFantasyLeagues(user.uid)
      .then(setLeagues)
      .catch((err) => console.error('Failed to load fantasy leagues:', err))
      .finally(() => setLoading(false));
  }, [authLoading, user]);

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={24} className="animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <Swords size={36} className="text-[var(--text-muted)] mb-3" />
        <p className="text-base font-semibold text-[var(--text-primary)] mb-1">Fantasy Leagues</p>
        <p className="text-sm text-[var(--text-muted)]">Sign in to view your fantasy leagues</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="px-4 pt-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Fantasy Leagues</h2>
        <p className="text-xs text-[var(--text-muted)] mt-1">{leagues.length} league{leagues.length !== 1 ? 's' : ''}</p>
      </div>

      {leagues.length === 0 ? (
        <div className="bg-[var(--bg-card)] rounded-2xl mx-4 py-12 text-center">
          <Swords size={32} className="text-[var(--accent)] opacity-40 mx-auto mb-3" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">No leagues yet</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Open a tournament from Home to create or join a league</p>
        </div>
      ) : (
        <div className="bg-[var(--bg-card)] rounded-2xl mx-4 overflow-hidden">
          {leagues.map((league, i) => {
            const s = league.auctionStatus;
            const statusCfg = s === 'live' ? { label: 'LIVE', cls: 'bg-red-500/15 text-red-400' }
              : s === 'paused' ? { label: 'Paused', cls: 'bg-yellow-500/15 text-yellow-500' }
              : s === 'selection' ? { label: 'Picking', cls: 'bg-blue-500/15 text-blue-400' }
              : s === 'completed' ? { label: 'Done', cls: 'bg-green-500/15 text-green-400' }
              : { label: 'Lobby', cls: 'bg-[var(--bg-elevated)] text-[var(--text-muted)]' };
            return (
              <div key={league.id}>
                <Link href={`/fantasy/${league.tournamentId}/league/${league.id}`} className="block active:scale-[0.98] transition-transform">
                  <div className="flex items-center gap-3 px-4 py-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--accent)]/15 shrink-0">
                      <Swords size={18} className="text-[var(--accent)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-[var(--text-primary)] truncate">{league.name}</h4>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${statusCfg.cls}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {league.memberUids.length} member{league.memberUids.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-[var(--text-muted)] shrink-0" />
                  </div>
                </Link>
                {i < leagues.length - 1 && <div className="h-px bg-[var(--border)] mx-4" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
