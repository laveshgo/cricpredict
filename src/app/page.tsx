'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTournamentCache } from '@/hooks/useTournamentCache';
import { getTournaments, getUserGroups } from '@/lib/firestore';
import { getAllUserFantasyLeagues } from '@/lib/fantasy-firestore';
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
import { Skeleton } from '@/components/ui/skeleton';

// ─── Status pill ───
function StatusPill({ status }: { status: Tournament['status'] }) {
  const cfg = {
    upcoming: { label: 'Upcoming', bg: 'bg-amber-500/15', text: 'text-amber-400', icon: Clock },
    live: { label: 'LIVE', bg: 'bg-emerald-500/15', text: 'text-emerald-400', icon: Zap },
    completed: { label: 'Completed', bg: 'bg-gray-500/15', text: 'text-gray-400', icon: CheckCircle },
  }[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${cfg.bg} ${cfg.text}`}>
      {status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

// ─── Tournament card — full-width, app-style ───
function TournamentCard({ tournament }: { tournament: Tournament }) {
  return (
    <Link href={`/tournament/${tournament.id}`} className="block active:scale-[0.98] transition-transform">
      <div className="bg-[var(--bg-card)] rounded-2xl p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-[var(--text-primary)] leading-tight">
              {tournament.name}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {tournament.type} · {tournament.teams.length} teams
            </p>
          </div>
          <StatusPill status={tournament.status} />
        </div>

        {/* Team color strip */}
        <div className="flex gap-1">
          {tournament.teams.slice(0, 10).map((team) => (
            <div
              key={team.shortName}
              className="h-2 flex-1 rounded-full"
              style={{ background: team.color.bg }}
            />
          ))}
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-[var(--text-muted)]">
            {new Date(tournament.startDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
            {' – '}
            {new Date(tournament.endDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <ChevronRight size={16} className="text-[var(--text-muted)]" />
        </div>
      </div>
    </Link>
  );
}

// ─── Contest row — Dream11 style list item ───
function ContestRow({ href, icon: Icon, iconBg, iconColor, title, subtitle, badge, badgeCls }: {
  href: string;
  icon: typeof Users;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  badge?: string;
  badgeCls?: string;
}) {
  return (
    <Link href={href} className="block active:scale-[0.98] transition-transform">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg} shrink-0`}>
          <Icon size={18} className={iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-[var(--text-primary)] truncate">{title}</h4>
            {badge && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${badgeCls}`}>
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{subtitle}</p>
        </div>
        <ChevronRight size={16} className="text-[var(--text-muted)] shrink-0" />
      </div>
    </Link>
  );
}

// ─── Section header ───
function SectionHeader({ icon: Icon, iconBg, iconColor, title, count }: {
  icon: typeof Trophy;
  iconBg: string;
  iconColor: string;
  title: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
        <Icon size={15} className={iconColor} />
      </div>
      <span className="text-sm font-bold text-[var(--text-primary)]">{title}</span>
      {count !== undefined && (
        <span className="text-xs text-[var(--text-muted)] ml-auto">{count}</span>
      )}
    </div>
  );
}

// ─── Skeleton loaders ───
function CardSkeleton() {
  return (
    <div className="bg-[var(--bg-card)] rounded-2xl p-4 space-y-3">
      <Skeleton className="h-5 w-2/3 bg-[var(--bg-hover)]" />
      <Skeleton className="h-3 w-1/3 bg-[var(--bg-hover)]" />
      <div className="flex gap-1">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-2 flex-1 rounded-full bg-[var(--bg-hover)]" />)}</div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <Skeleton className="w-10 h-10 rounded-xl bg-[var(--bg-hover)]" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32 bg-[var(--bg-hover)]" />
        <Skeleton className="h-3 w-20 bg-[var(--bg-hover)]" />
      </div>
    </div>
  );
}

// ─── Empty state ───
function EmptyState({ icon: Icon, iconColor, text, sub }: {
  icon: typeof Users;
  iconColor: string;
  text: string;
  sub: string;
}) {
  return (
    <div className="py-8 px-4 text-center">
      <Icon size={28} className={`${iconColor} opacity-40 mx-auto mb-2`} />
      <p className="text-sm font-medium text-[var(--text-secondary)]">{text}</p>
      <p className="text-xs text-[var(--text-muted)] mt-1">{sub}</p>
    </div>
  );
}

// ═══════════════ HOME PAGE ═══════════════

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const tournamentCache = useTournamentCache();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(true);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [myFantasyLeagues, setMyFantasyLeagues] = useState<FantasyLeague[]>([]);
  const [userDataLoading, setUserDataLoading] = useState(true);

  useEffect(() => {
    getTournaments()
      .then((ts) => { setTournaments(ts); tournamentCache.setAll(ts); })
      .catch((err) => console.error('Failed to load tournaments:', err))
      .finally(() => setTournamentsLoading(false));
  }, []);

  const loadedUserRef = useRef<string | null>(null);
  useEffect(() => {
    if (authLoading) return;
    if (!user) { setUserDataLoading(false); return; }
    if (loadedUserRef.current === user.uid) return;
    loadedUserRef.current = user.uid;
    setUserDataLoading(true);
    Promise.all([getUserGroups(user.uid), getAllUserFantasyLeagues(user.uid)])
      .then(([gs, fls]) => { setMyGroups(gs); setMyFantasyLeagues(fls); })
      .catch((err) => console.error('Failed to load user data:', err))
      .finally(() => setUserDataLoading(false));
  }, [authLoading, user]);

  const tournamentMap = useMemo(() => new Map(tournaments.map(t => [t.id, t])), [tournaments]);

  // ─── Signed-out hero ───
  if (!authLoading && !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] px-6 text-center">
        <div className="mb-6 w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-cyan-500 flex items-center justify-center">
          <Trophy size={40} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold mb-3 text-[var(--text-primary)]">CricPredict</h1>
        <p className="text-base mb-8 max-w-xs text-[var(--text-secondary)] leading-relaxed">
          Fantasy cricket contests with friends. Predict, compete, and win.
        </p>
        <Link href="/auth/signin" className="w-full max-w-xs">
          <Button className="w-full h-12 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-base font-bold rounded-xl">
            <LogIn size={20} className="mr-2" />
            Get Started
          </Button>
        </Link>
        <p className="text-xs mt-4 text-[var(--text-muted)]">Free forever. No credit card.</p>
      </div>
    );
  }

  // ─── Main app ───
  return (
    <div className="space-y-4 pb-4">
      {/* ─── Tournaments ─── */}
      <section className="px-4 pt-4 space-y-3">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Tournaments</h2>
        {tournamentsLoading ? (
          <div className="space-y-3"><CardSkeleton /><CardSkeleton /></div>
        ) : tournaments.length === 0 ? (
          <div className="bg-[var(--bg-card)] rounded-2xl py-12 text-center">
            <Trophy size={36} className="text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-sm text-[var(--text-secondary)]">No tournaments yet</p>
            {user && process.env.NODE_ENV === 'development' && (
              <Button
                onClick={async () => {
                  const { seedIPL2026 } = await import('@/lib/seed');
                  await seedIPL2026(user.uid);
                  const ts = await getTournaments();
                  setTournaments(ts);
                }}
                className="mt-4 bg-[var(--accent)] text-white rounded-xl"
              >
                <Plus size={16} className="mr-2" /> Add IPL 2026
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {tournaments.map((t) => <TournamentCard key={t.id} tournament={t} />)}
          </div>
        )}
      </section>

      {/* ─── My Contests ─── */}
      {user && (
        <>
          {/* Prediction Groups */}
          <section className="bg-[var(--bg-card)] rounded-2xl mx-4 overflow-hidden">
            <SectionHeader icon={Users} iconBg="bg-purple-500/15" iconColor="text-purple-400" title="Prediction Groups" count={myGroups.length} />
            <div className="h-px bg-[var(--border)]" />
            {userDataLoading ? (
              <div><RowSkeleton /><RowSkeleton /></div>
            ) : myGroups.length === 0 ? (
              <EmptyState icon={Users} iconColor="text-purple-400" text="No groups yet" sub="Open a tournament to create or join" />
            ) : (
              <div>
                {myGroups.map((g, i) => {
                  const t = tournamentMap.get(g.tournamentId);
                  const members = g.memberUids?.length || 0;
                  return (
                    <div key={g.id}>
                      <ContestRow
                        href={`/group/${g.id}`}
                        icon={Users}
                        iconBg="bg-purple-500/15"
                        iconColor="text-purple-400"
                        title={g.name}
                        subtitle={`${members} member${members !== 1 ? 's' : ''}${t ? ` · ${t.name}` : ''}`}
                      />
                      {i < myGroups.length - 1 && <div className="h-px bg-[var(--border)] mx-4" />}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Fantasy Leagues */}
          <section className="bg-[var(--bg-card)] rounded-2xl mx-4 overflow-hidden">
            <SectionHeader icon={Swords} iconBg="bg-[var(--accent)]/15" iconColor="text-[var(--accent)]" title="Fantasy Leagues" count={myFantasyLeagues.length} />
            <div className="h-px bg-[var(--border)]" />
            {userDataLoading ? (
              <div><RowSkeleton /><RowSkeleton /></div>
            ) : myFantasyLeagues.length === 0 ? (
              <EmptyState icon={Swords} iconColor="text-[var(--accent)]" text="No leagues yet" sub="Open a tournament to create or join" />
            ) : (
              <div>
                {myFantasyLeagues.map((league, i) => {
                  const t = tournamentMap.get(league.tournamentId);
                  const s = league.auctionStatus;
                  const statusCfg = s === 'live' ? { label: 'LIVE', cls: 'bg-red-500/15 text-red-400' }
                    : s === 'paused' ? { label: 'Paused', cls: 'bg-yellow-500/15 text-yellow-500' }
                    : s === 'selection' ? { label: 'Picking', cls: 'bg-blue-500/15 text-blue-400' }
                    : s === 'completed' ? { label: 'Done', cls: 'bg-green-500/15 text-green-400' }
                    : { label: 'Lobby', cls: 'bg-[var(--bg-elevated)] text-[var(--text-muted)]' };
                  return (
                    <div key={league.id}>
                      <ContestRow
                        href={`/fantasy/${league.tournamentId}/league/${league.id}`}
                        icon={Swords}
                        iconBg="bg-[var(--accent)]/15"
                        iconColor="text-[var(--accent)]"
                        title={league.name}
                        subtitle={`${league.memberUids.length} member${league.memberUids.length !== 1 ? 's' : ''}${t ? ` · ${t.name}` : ''}`}
                        badge={statusCfg.label}
                        badgeCls={statusCfg.cls}
                      />
                      {i < myFantasyLeagues.length - 1 && <div className="h-px bg-[var(--border)] mx-4" />}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
