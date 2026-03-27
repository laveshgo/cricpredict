'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getTournaments, getUserGroups } from '@/lib/firestore';
import { getAllUserFantasyLeagues } from '@/lib/fantasy-firestore';
// seedIPL2026 is dynamically imported below to avoid shipping seed data in production bundle
import type { Tournament, Group } from '@/types';
import type { FantasyLeague } from '@/types/fantasy';
import Link from 'next/link';
import {
  Trophy,
  Users,
  Plus,
  LogIn,
  ChevronRight,
  Clock,
  Zap,
  CheckCircle,
  Swords,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// Status badge component with Sleeper styling
function StatusBadge({ status }: { status: Tournament['status'] }) {
  const config = {
    upcoming: { label: 'Upcoming', bg: 'bg-[#FFB547]/10', border: 'border-[#FFB547]/30', text: 'text-[#FFB547]', icon: Clock },
    live: { label: 'Live', bg: 'bg-[#00D4AA]/15', border: 'border-[#00D4AA]/40', text: 'text-[#00D4AA]', icon: Zap },
    completed: { label: 'Completed', bg: 'bg-[#6b7280]/10', border: 'border-[#6b7280]/30', text: 'text-[#9ca3af]', icon: CheckCircle },
  };
  const c = config[status];
  const Icon = c.icon;

  return (
    <div className="inline-flex">
      <Badge
        className={`text-xs font-semibold flex items-center gap-1.5 border ${c.bg} ${c.border} ${c.text} ${
          status === 'live' ? 'animate-pulse' : ''
        }`}
      >
        {status === 'live' && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00D4AA] glow-pulse" />
        )}
        <Icon size={12} />
        {c.label}
      </Badge>
    </div>
  );
}

// Tournament card with glow effect
function TournamentCard({ tournament }: { tournament: Tournament }) {
  return (
    <Link href={`/tournament/${tournament.id}`}>
      <div className="glow-card bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden cursor-pointer h-full group transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,212,170,0.2)]">
        <div className="p-6 flex flex-col gap-4 h-full">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                {tournament.name}
              </h3>
              <p className="text-sm mt-1 text-[var(--text-muted)]">
                {tournament.type} · {tournament.teams.length} teams
              </p>
            </div>
            <StatusBadge status={tournament.status} />
          </div>

          {/* Animated team color strip */}
          <div className="flex gap-1.5 mt-2">
            {tournament.teams.slice(0, 10).map((team) => (
              <div
                key={team.shortName}
                className="h-1.5 flex-1 rounded-full transition-all duration-300 group-hover:h-3"
                style={{ background: team.color.bg }}
                title={team.name}
              />
            ))}
          </div>

          <div className="flex items-center justify-between mt-auto pt-2 border-t border-[var(--border)]">
            <span className="text-xs text-[var(--text-muted)]">
              {new Date(tournament.startDate).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
              })}{' '}
              –{' '}
              {new Date(tournament.endDate).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <ChevronRight
              size={16}
              className="text-[var(--text-muted)] group-hover:text-[var(--accent)] group-hover:translate-x-1 transition-all duration-200"
            />
          </div>
        </div>
      </div>
    </Link>
  );
}

// Tournament skeleton loader with shimmer
function TournamentSkeleton() {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden p-6 space-y-4">
      <Skeleton className="h-6 w-2/3 bg-[var(--bg-hover)] animate-shimmer" />
      <Skeleton className="h-4 w-1/2 bg-[var(--bg-hover)] animate-shimmer" />
      <div className="flex gap-1.5">
        <Skeleton className="h-1.5 flex-1 rounded-full bg-[var(--bg-hover)] animate-shimmer" />
        <Skeleton className="h-1.5 flex-1 rounded-full bg-[var(--bg-hover)] animate-shimmer" />
        <Skeleton className="h-1.5 flex-1 rounded-full bg-[var(--bg-hover)] animate-shimmer" />
      </div>
      <Skeleton className="h-4 w-1/3 bg-[var(--bg-hover)] animate-shimmer" />
    </div>
  );
}

// Group skeleton loader
function GroupSkeleton() {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-5 flex items-center gap-4">
      <Skeleton className="h-12 w-12 rounded-lg bg-[var(--bg-hover)] animate-shimmer" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32 bg-[var(--bg-hover)] animate-shimmer" />
        <Skeleton className="h-3 w-24 bg-[var(--bg-hover)] animate-shimmer" />
      </div>
    </div>
  );
}

// =================== HOME PAGE ===================

export default function HomePage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(true);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [myFantasyLeagues, setMyFantasyLeagues] = useState<FantasyLeague[]>([]);
  const [userDataLoading, setUserDataLoading] = useState(true);

  // Fetch tournaments immediately — no auth needed, don't wait for it
  useEffect(() => {
    getTournaments()
      .then(setTournaments)
      .catch((err) => console.error('Failed to load tournaments:', err))
      .finally(() => setTournamentsLoading(false));
  }, []);

  // Fetch user-specific data once auth resolves
  const loadedUserRef = useRef<string | null>(null);
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setUserDataLoading(false);
      return;
    }
    // Prevent duplicate loads for same user
    if (loadedUserRef.current === user.uid) return;
    loadedUserRef.current = user.uid;

    setUserDataLoading(true);
    Promise.all([
      getUserGroups(user.uid),
      getAllUserFantasyLeagues(user.uid),
    ])
      .then(([gs, fls]) => {
        setMyGroups(gs);
        setMyFantasyLeagues(fls);
      })
      .catch((err) => console.error('Failed to load user data:', err))
      .finally(() => setUserDataLoading(false));
  }, [authLoading, user]);

  const tournamentMap = useMemo(() => new Map(tournaments.map(t => [t.id, t])), [tournaments]);

  const loading = tournamentsLoading;

  // Hero section for signed-out users
  if (!authLoading && !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
        <div className="mb-8 p-4 rounded-2xl bg-[var(--accent-dim)]">
          <Trophy size={64} className="text-[var(--accent)]" />
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-[var(--accent)] via-purple-400 to-pink-400 bg-clip-text text-transparent">
          CricPredict
        </h1>
        <p className="text-lg mb-8 max-w-md text-[var(--text-secondary)]">
          Predict team rankings, top players, match winners — and compete with friends on live leaderboards.
        </p>
        <Link href="/auth/signin">
          <Button
            size="lg"
            className="bg-[var(--accent)] hover:bg-[var(--accent)] hover:opacity-90 text-white text-base"
          >
            <LogIn size={20} className="mr-2" />
            Sign in to get started
          </Button>
        </Link>
        <p className="text-xs mt-6 text-[var(--text-muted)]">
          Free forever. No credit card needed.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 animate-fade-in">
      {/* Tournaments Section */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">Tournaments</h1>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <TournamentSkeleton key={i} />
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <Card className="border-[var(--border)] bg-[var(--bg-card)]">
            <CardContent className="p-8 text-center">
              <Trophy size={40} className="text-[var(--text-muted)] mx-auto mb-4" />
              <p className="text-[var(--text-secondary)] mb-4">No tournaments available yet.</p>
              {user && process.env.NODE_ENV === 'development' && (
                <Button
                  onClick={async () => {
                    try {
                      const { seedIPL2026 } = await import('@/lib/seed');
                      await seedIPL2026(user.uid);
                      const ts = await getTournaments();
                      setTournaments(ts);
                    } catch (err) {
                      console.error('Seed failed:', err);
                    }
                  }}
                  className="bg-[var(--accent)] hover:bg-[var(--accent)] hover:opacity-90 text-white"
                >
                  <Plus size={16} className="mr-2" />
                  Add IPL 2026
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {tournaments.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        )}
      </div>

      {/* My Contests — Side-by-side: Prediction Groups | Fantasy Leagues */}
      {user && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ─── Prediction Groups ─── */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-purple-500/15">
                  <Users size={16} className="text-purple-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Prediction Groups</h3>
                  <p className="text-[10px] text-[var(--text-muted)]">{myGroups.length} group{myGroups.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>

            <div className="h-px bg-[var(--border)]" />

            {userDataLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2].map(i => <GroupSkeleton key={i} />)}
              </div>
            ) : myGroups.length === 0 ? (
              <div className="py-10 px-5 text-center">
                <div className="w-14 h-14 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
                  <Users size={22} className="text-purple-400/50" />
                </div>
                <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">No groups yet</p>
                <p className="text-xs text-[var(--text-muted)]">Open a tournament to create or join a prediction group</p>
              </div>
            ) : (
              <div className="px-4 pb-1">
                {myGroups.map((g, i) => {
                  const t = tournamentMap.get(g.tournamentId);
                  const members = g.memberUids?.length || 0;
                  return (
                    <Link key={g.id} href={`/group/${g.id}`}>
                      <div className={`flex items-center gap-3 px-2 py-3.5 hover:bg-[var(--bg-hover)] rounded-lg transition-colors cursor-pointer group ${i < myGroups.length - 1 ? 'border-b border-[var(--border-hover)]/30' : ''}`}>
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-purple-500/20 shrink-0">
                          <Users size={15} className="text-purple-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[13px] font-semibold text-[var(--text-primary)] truncate group-hover:text-purple-400 transition-colors">
                            {g.name}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-[var(--text-muted)]">
                              {members} member{members !== 1 ? 's' : ''}
                            </span>
                            {t && (
                              <>
                                <span className="text-[10px] text-[var(--text-muted)]">·</span>
                                <span className="text-[10px] text-purple-400/70 font-medium truncate">{t.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-[var(--text-muted)] shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─── Fantasy Leagues ─── */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--accent)]/15">
                  <Swords size={16} className="text-[var(--accent)]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Fantasy Leagues</h3>
                  <p className="text-[10px] text-[var(--text-muted)]">{myFantasyLeagues.length} league{myFantasyLeagues.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>

            <div className="h-px bg-[var(--border)]" />

            {userDataLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2].map(i => <GroupSkeleton key={i} />)}
              </div>
            ) : myFantasyLeagues.length === 0 ? (
              <div className="py-10 px-5 text-center">
                <div className="w-14 h-14 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-3">
                  <Swords size={22} className="text-[var(--accent)]/50" />
                </div>
                <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">No leagues yet</p>
                <p className="text-xs text-[var(--text-muted)]">Open a tournament to create or join a fantasy league</p>
              </div>
            ) : (
              <div className="px-4 pb-1">
                {myFantasyLeagues.map((league, i) => {
                  const t = tournamentMap.get(league.tournamentId);
                  const s = league.auctionStatus;
                  const statusCfg = s === 'live' ? { label: 'Live', cls: 'bg-red-500/15 text-red-400', dot: 'bg-red-400 animate-pulse' }
                    : s === 'paused' ? { label: 'Paused', cls: 'bg-yellow-500/15 text-yellow-500', dot: 'bg-yellow-500' }
                    : s === 'selection' ? { label: 'Picking', cls: 'bg-blue-500/15 text-blue-400', dot: 'bg-blue-400 animate-pulse' }
                    : s === 'completed' ? { label: 'Done', cls: 'bg-green-500/15 text-green-400', dot: 'bg-green-400' }
                    : { label: 'Lobby', cls: 'bg-[var(--bg-elevated)] text-[var(--text-muted)]', dot: 'bg-[var(--text-muted)]' };
                  return (
                    <Link key={league.id} href={`/fantasy/${league.tournamentId}/league/${league.id}`}>
                      <div className={`flex items-center gap-3 px-2 py-3.5 hover:bg-[var(--bg-hover)] rounded-lg transition-colors cursor-pointer group ${i < myFantasyLeagues.length - 1 ? 'border-b border-[var(--border-hover)]/30' : ''}`}>
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--accent)]/20 shrink-0 relative">
                          <Swords size={15} className="text-[var(--accent)]" />
                          {(s === 'live' || s === 'selection') && (
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-[var(--bg-card)] animate-pulse" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-[13px] font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                              {league.name}
                            </h4>
                            <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${statusCfg.cls}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                              {statusCfg.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-[var(--text-muted)]">
                              {league.memberUids.length} member{league.memberUids.length !== 1 ? 's' : ''}
                            </span>
                            {t && (
                              <>
                                <span className="text-[10px] text-[var(--text-muted)]">·</span>
                                <span className="text-[10px] text-[var(--accent)]/70 font-medium truncate">{t.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-[var(--text-muted)] shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
