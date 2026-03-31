'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTournamentCache } from '@/hooks/useTournamentCache';
import {
  onTournament,
  getGroupsForTournament,
  getUserGroups,
} from '@/lib/firestore';
import {
  getUserFantasyLeagues,
  getFantasyLeaguesByTournament,
  joinFantasyLeague,
} from '@/lib/fantasy-firestore';
import type { Tournament, Group } from '@/types';
import type { FantasyLeague, ContestType } from '@/types/fantasy';
import {
  Trophy,
  Users,
  Calendar,
  ChevronRight,
  Zap,
  Globe,
  Loader2,
  UserPlus,
  Clock,
  Target,
  Swords,
  Gavel,
  Plus,
  LogIn,
} from 'lucide-react';
import Link from 'next/link';
import { joinGroupApi, createGroupApi } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import TournamentRefresh from '@/components/fantasy/TournamentRefresh';
import TournamentFixtures from '@/components/fantasy/TournamentFixtures';
import TournamentPlayerTable from '@/components/fantasy/TournamentPlayerTable';

export default function TournamentPage() {
  const params = useParams();
  const router = useRouter();
  const tournamentId = params.tournamentId as string;
  const { user, profile, loading: authLoading } = useAuth();
  const tournamentCache = useTournamentCache();
  const cached = tournamentCache.get(tournamentId);

  const [tournament, setTournament] = useState<Tournament | null>(cached ?? null);
  const [publicGroups, setPublicGroups] = useState<Group[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [myFantasyLeagues, setMyFantasyLeagues] = useState<FantasyLeague[]>([]);
  const [publicFantasyLeagues, setPublicFantasyLeagues] = useState<FantasyLeague[]>([]);
  const [loading, setLoading] = useState(!cached);
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [groupModal, setGroupModal] = useState<'create' | 'join' | null>(null);
  const [groupModalName, setGroupModalName] = useState('');
  const [groupModalId, setGroupModalId] = useState('');
  const [groupModalPublic, setGroupModalPublic] = useState(false);
  const [groupModalLoading, setGroupModalLoading] = useState(false);
  const [groupModalError, setGroupModalError] = useState('');
  const [leagueJoinModal, setLeagueJoinModal] = useState(false);
  const [leagueJoinCode, setLeagueJoinCode] = useState('');
  const [leagueJoinLoading, setLeagueJoinLoading] = useState(false);
  const [leagueJoinError, setLeagueJoinError] = useState('');
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'fantasy' ? 'fantasy' : 'predictions';
  const [contestTab, setContestTab] = useState<ContestType>(initialTab);
  const [fantasySubTab, setFantasySubTab] = useState<'leagues' | 'fixtures' | 'players'>('leagues');

  const handleTabChange = (tab: ContestType) => {
    setContestTab(tab);
    const url = new URL(window.location.href);
    if (tab === 'fantasy') {
      url.searchParams.set('tab', 'fantasy');
    } else {
      url.searchParams.delete('tab');
    }
    window.history.replaceState({}, '', url.toString());
  };
  const { theme } = useTheme();
  const isLight = theme === 'light';

  useEffect(() => {
    const unsub = onTournament(tournamentId, (t) => {
      setTournament(t);
      if (t) tournamentCache.set(t);
      setLoading(false);
    });
    return () => unsub();
  }, [tournamentId]);

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      try {
        const [pg, ug, myFL, pubFL] = await Promise.all([
          getGroupsForTournament(tournamentId),
          getUserGroups(user.uid),
          getUserFantasyLeagues(tournamentId, user.uid),
          getFantasyLeaguesByTournament(tournamentId),
        ]);
        setPublicGroups(pg);
        setMyGroups(ug.filter((g) => g.tournamentId === tournamentId));
        setMyFantasyLeagues(myFL);
        setPublicFantasyLeagues(pubFL);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [tournamentId, authLoading, user]);

  // Show sign-in prompt for unauthenticated visitors
  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <Trophy size={40} className="text-[var(--accent)] mx-auto mb-3" />
        <h2 className="text-xl font-bold mb-2 text-[var(--text-primary)]">
          Sign in to view this tournament
        </h2>
        <p className="text-sm mb-4 text-[var(--text-muted)]">
          Sign in to continue.
        </p>
        <Link href="/auth/signin">
          <Button className="bg-[var(--accent)] hover:bg-[var(--accent)] text-white">
            Sign in
          </Button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Card className="bg-[var(--bg-card)] border-[var(--border)]">
          <CardContent className="p-8 h-48 animate-pulse bg-[var(--bg-hover)]" />
        </Card>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <Trophy size={40} className="text-[var(--text-muted)] mx-auto mb-3" />
        <h2 className="text-xl font-bold text-[var(--text-primary)]">
          Tournament not found
        </h2>
      </div>
    );
  }

  const handleJoinGroup = async (groupId: string) => {
    setJoiningGroupId(groupId);
    setJoinError(null);
    try {
      await joinGroupApi(groupId);
      // Refresh groups
      const pg = await getGroupsForTournament(tournamentId);
      setPublicGroups(pg);
      const ug = await getUserGroups(user!.uid);
      setMyGroups(ug.filter((g) => g.tournamentId === tournamentId));
    } catch (err: any) {
      setJoinError(err.message || 'Failed to join group');
    } finally {
      setJoiningGroupId(null);
    }
  };

  const refreshGroups = async () => {
    const pg = await getGroupsForTournament(tournamentId);
    setPublicGroups(pg);
    const ug = await getUserGroups(user!.uid);
    setMyGroups(ug.filter((g) => g.tournamentId === tournamentId));
  };

  const handleCreateGroup = async () => {
    if (!groupModalName.trim()) { setGroupModalError('Group name is required'); return; }
    setGroupModalLoading(true);
    setGroupModalError('');
    try {
      await createGroupApi({ name: groupModalName.trim(), tournamentId, isPublic: groupModalPublic, memberLimit: null });
      await refreshGroups();
      setGroupModal(null);
      setGroupModalName('');
    } catch (err: any) {
      setGroupModalError(err.message || 'Failed to create group');
    } finally {
      setGroupModalLoading(false);
    }
  };

  const handleJoinGroupById = async () => {
    if (!groupModalId.trim()) { setGroupModalError('Group ID is required'); return; }
    setGroupModalLoading(true);
    setGroupModalError('');
    try {
      await joinGroupApi(groupModalId.trim());
      await refreshGroups();
      setGroupModal(null);
      setGroupModalId('');
    } catch (err: any) {
      setGroupModalError(err.message || 'Failed to join group');
    } finally {
      setGroupModalLoading(false);
    }
  };

  const handleJoinLeagueByCode = async () => {
    if (!leagueJoinCode.trim() || !user || !profile) { setLeagueJoinError('League ID is required'); return; }
    setLeagueJoinLoading(true);
    setLeagueJoinError('');
    try {
      await joinFantasyLeague(leagueJoinCode.trim(), user.uid, {
        displayName: profile.displayName || profile.username || 'User',
        username: profile.username || 'user',
      });
      setLeagueJoinModal(false);
      setLeagueJoinCode('');
      router.push(`/fantasy/${tournamentId}/league/${leagueJoinCode.trim()}`);
    } catch (err: any) {
      setLeagueJoinError(err.message || 'Failed to join league');
    } finally {
      setLeagueJoinLoading(false);
    }
  };

  // Filter public groups: remove already-joined, closed, and full groups
  const myGroupIds = new Set(myGroups.map((g) => g.id));
  const visiblePublicGroups = publicGroups.filter((g) => {
    // Remove groups user already joined
    if (myGroupIds.has(g.id)) return false;
    // Remove closed groups
    if (g.settings?.addLocked) return false;
    // Remove full groups
    if (g.settings?.memberLimit && g.memberUids.length >= g.settings.memberLimit) return false;
    return true;
  });

  const statusColors: Record<string, { bg: string; text: string }> = {
    upcoming: { bg: 'bg-[var(--warning-dim)]', text: 'text-[var(--warning)]' },
    live: { bg: 'bg-[var(--success-dim)]', text: 'text-[var(--success)]' },
    completed: { bg: 'bg-[var(--text-muted)]', text: 'text-[var(--text-muted)]' },
  };

  const statusColor = statusColors[tournament.status] || statusColors.upcoming;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 animate-fade-in">
      {/* Tournament Header Card - Premium Glow Card */}
      <Card className="mb-8 glow-card border border-[var(--bg-elevated)]">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
                  {tournament.name}
                </h1>
                <Badge className={`${statusColor.bg} ${statusColor.text} border-0 text-xs font-semibold flex items-center gap-1.5 ${
                  tournament.status === 'live' ? 'shadow-lg shadow-[var(--success)]/40 glow-pulse' : ''
                }`}>
                  {tournament.status === 'live' && (
                    <span className="inline-block w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
                  )}
                  {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                </Badge>
              </div>
              <p className="text-sm flex flex-col gap-2 text-[var(--text-muted)]">
                <span className="flex items-center gap-2">
                  <Calendar size={14} className="text-[var(--accent)]" />
                  {new Date(tournament.startDate).toLocaleDateString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                  })} – {new Date(tournament.endDate).toLocaleDateString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span>{tournament.type}</span>
              </p>
            </div>
          </div>

          {/* Teams Badges */}
          <div className="flex flex-wrap gap-2 mt-5">
            {tournament.teams.map((team) => (
              <Badge
                key={team.shortName}
                className="team-badge text-xs font-semibold px-3 py-1.5 border shadow-lg transition-all hover:scale-105 min-w-[3.5rem] text-center justify-center"
                style={isLight ? {
                  backgroundColor: team.color.bg,
                  color: team.color.text,
                  borderColor: team.color.bg,
                  boxShadow: `0 2px 8px ${team.color.bg}40`,
                } : {
                  backgroundColor: `${team.color.bg}35`,
                  color: '#ffffff',
                  borderColor: `${team.color.bg}80`,
                  boxShadow: `0 0 12px ${team.color.bg}30`,
                }}
              >
                {team.shortName}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── Contest Type Toggle ─── */}
      <div className="flex gap-2 mb-6">
        {([
          { key: 'predictions' as ContestType, label: 'Predictions', icon: Target, desc: 'Predict the season' },
          { key: 'fantasy' as ContestType, label: 'Fantasy Draft', icon: Swords, desc: 'Build your squad' },
        ]).map(({ key, label, icon: Icon, desc }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={`flex-1 p-4 rounded-xl border-2 transition-all duration-200 text-left ${
              contestTab === key
                ? 'border-[var(--accent)] bg-[var(--accent)]/10 shadow-lg shadow-[var(--accent)]/10'
                : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent-dim)]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                contestTab === key ? 'bg-[var(--accent)]/20' : 'bg-[var(--bg-elevated)]'
              }`}>
                <Icon size={20} className={contestTab === key ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'} />
              </div>
              <div>
                <h3 className={`text-sm font-bold ${contestTab === key ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                  {label}
                </h3>
                <p className="text-[10px] text-[var(--text-muted)]">{desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* ─── PREDICTIONS TAB ─── */}
      {contestTab === 'predictions' && (
        <>
          {/* My Groups Section */}
          {myGroups.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-bold uppercase tracking-widest mb-4 text-[var(--text-secondary)] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"></span>
                My Groups
              </h2>
              <div className="space-y-3 stagger-children">
                {myGroups.map((g) => {
                  const memberCount = g.memberUids?.length || 0;
                  const limit = g.settings?.memberLimit;
                  return (
                    <Link key={g.id} href={`/group/${g.id}`}>
                      <Card className="glass-card border border-[var(--bg-elevated)] hover:border-[var(--accent)] transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-[var(--accent)]/20">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--accent)]/20 border border-[var(--accent)]/40 ring-2 ring-[var(--accent)]/10">
                                <Users size={18} className="text-[var(--accent)]" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-sm text-[var(--text-primary)]">
                                  {g.name}
                                </h4>
                                <p className="text-xs text-[var(--text-muted)]">
                                  {memberCount}{limit ? `/${limit}` : ''} member{memberCount !== 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                            <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Public Groups Section */}
          {visiblePublicGroups.length > 0 && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest mb-4 text-[var(--text-secondary)] flex items-center gap-2">
                <Globe size={14} />
                Public Groups
              </h2>
              {joinError && (
                <div className="mb-3 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--error)] bg-opacity-90 animate-fade-in">
                  {joinError}
                </div>
              )}
              <div className="space-y-3 stagger-children">
                {visiblePublicGroups.map((g) => {
                  const memberCount = g.memberUids?.length || 0;
                  const limit = g.settings?.memberLimit;
                  const spotsLeft = limit ? limit - memberCount : null;
                  const isJoining = joiningGroupId === g.id;

                  return (
                    <Card key={g.id} className="glass-card border border-[var(--bg-elevated)] hover:border-[var(--accent)] transition-all duration-300 hover:shadow-lg hover:shadow-[var(--accent)]/20">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          <Link href={`/group/${g.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--bg-elevated)] shrink-0">
                              <Users size={18} className="text-[var(--text-secondary)]" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-semibold text-sm text-[var(--text-primary)] truncate">
                                {g.name}
                              </h4>
                              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                                <span>{memberCount}{limit ? `/${limit}` : ''} member{memberCount !== 1 ? 's' : ''}</span>
                                {spotsLeft !== null && spotsLeft <= 9 && spotsLeft > 0 && (
                                  <span className="flex items-center gap-1 text-red-400 font-semibold">
                                    <Clock size={10} />
                                    {spotsLeft} {spotsLeft === 1 ? 'spot' : 'spots'} left
                                  </span>
                                )}
                              </div>
                            </div>
                          </Link>
                          <Button
                            onClick={(e) => {
                              e.preventDefault();
                              handleJoinGroup(g.id);
                            }}
                            disabled={isJoining}
                            size="sm"
                            className="shrink-0 bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent-hover)] gap-1.5 text-xs px-3"
                          >
                            {isJoining ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <>
                                <UserPlus size={14} />
                                Join
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Predictions Info + Create/Join */}
          <div className="glass-card border border-[var(--bg-elevated)] rounded-xl p-6 sm:p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/30">
              <Target size={28} className="text-white" />
            </div>
            <h3 className="text-lg font-bold gradient-text mb-2">
              Prediction Groups
            </h3>
            <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto mb-4">
              Predict rankings, top performers, and match winners.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mb-6">
              {[
                { label: 'Team Rankings', icon: Trophy },
                { label: 'Match Predictions', icon: Target },
                { label: 'Leaderboards', icon: Users },
              ].map(({ label, icon: Icon }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                >
                  <Icon size={12} className="text-purple-400" />
                  {label}
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-3">
              <Button
                onClick={() => { setGroupModal('create'); setGroupModalError(''); setGroupModalName(''); }}
                className="bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent-hover)] gap-2 shadow-lg shadow-[var(--accent)]/30"
              >
                <Plus size={16} />
                Create Group
              </Button>
              <Button
                onClick={() => { setGroupModal('join'); setGroupModalError(''); setGroupModalId(''); }}
                variant="outline"
                className="border-[var(--border)] text-[var(--text-secondary)] font-semibold gap-2"
              >
                <LogIn size={16} />
                Join Group
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ─── FANTASY DRAFT TAB ─── */}
      {contestTab === 'fantasy' && (
        <>
          {/* Tournament Admin: Refresh Match Data */}
          {tournament && user && tournament.createdBy === user.uid && (
            <div className="mb-6">
              <TournamentRefresh
                tournamentId={tournamentId}
                tournamentName={tournament.name}
                isCreator={true}
                isLight={isLight}
              />
            </div>
          )}

          {/* Fantasy sub-tabs */}
          <div className="flex gap-1 mb-6 p-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)]">
            {([
              { key: 'leagues' as const, label: 'Leagues', icon: Swords },
              { key: 'fixtures' as const, label: 'Fixtures', icon: Calendar },
              { key: 'players' as const, label: 'Player Stats', icon: Trophy },
            ]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setFantasySubTab(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  fantasySubTab === key
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Fixtures tab */}
          {fantasySubTab === 'fixtures' && (
            <div className="mb-8">
              <TournamentFixtures tournamentId={tournamentId} isLight={isLight} />
            </div>
          )}

          {/* Player Stats tab */}
          {fantasySubTab === 'players' && (
            <div className="mb-8">
              <TournamentPlayerTable tournamentId={tournamentId} isLight={isLight} />
            </div>
          )}

          {/* Leagues tab */}
          {fantasySubTab === 'leagues' && <>

          {/* My Fantasy Leagues */}
          {myFantasyLeagues.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-bold uppercase tracking-widest mb-4 text-[var(--text-secondary)] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"></span>
                My Leagues
              </h2>
              <div className="space-y-3 stagger-children">
                {myFantasyLeagues.map((league) => (
                  <Link key={league.id} href={`/fantasy/${tournamentId}/league/${league.id}`}>
                    <Card className="glass-card border border-[var(--bg-elevated)] hover:border-[var(--accent)] transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-[var(--accent)]/20">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--accent)]/20 border border-[var(--accent)]/40 ring-2 ring-[var(--accent)]/10">
                              <Swords size={18} className="text-[var(--accent)]" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm text-[var(--text-primary)]">
                                {league.name}
                              </h4>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-[var(--text-muted)]">
                                  {league.memberUids.length} member{league.memberUids.length !== 1 ? 's' : ''}
                                </p>
                                {(() => {
                                  const s = league.auctionStatus;
                                  const cfg = s === 'live' ? { label: 'Live', cls: 'bg-red-500/15 text-red-400', dot: 'bg-red-400 animate-pulse' }
                                    : s === 'paused' ? { label: 'Paused', cls: 'bg-yellow-500/15 text-yellow-500', dot: 'bg-yellow-500' }
                                    : s === 'selection' ? { label: 'Re-Auction Pick', cls: 'bg-blue-500/15 text-blue-400', dot: 'bg-blue-400 animate-pulse' }
                                    : s === 'completed' ? { label: 'Completed', cls: 'bg-green-500/15 text-green-400', dot: 'bg-green-400' }
                                    : { label: 'Not Started', cls: 'bg-[var(--bg-elevated)] text-[var(--text-muted)]', dot: 'bg-[var(--text-muted)]' };
                                  return (
                                    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cfg.cls}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
                                      {cfg.label}
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-[var(--text-muted)]" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Public Fantasy Leagues */}
          {(() => {
            const myLeagueIds = new Set(myFantasyLeagues.map(l => l.id));
            const visiblePublic = publicFantasyLeagues.filter(l => {
              if (myLeagueIds.has(l.id)) return false;
              if (l.settings?.addLocked) return false;
              if (l.settings?.memberLimit && l.memberUids.length >= l.settings.memberLimit) return false;
              return true;
            });
            return visiblePublic.length > 0 ? (
              <div className="mb-8">
                <h2 className="text-sm font-bold uppercase tracking-widest mb-4 text-[var(--text-secondary)] flex items-center gap-2">
                  <Globe size={14} />
                  Public Leagues
                </h2>
                <div className="space-y-3 stagger-children">
                  {visiblePublic.map((league) => (
                    <Link key={league.id} href={`/fantasy/${tournamentId}/league/${league.id}`}>
                      <Card className="glass-card border border-[var(--bg-elevated)] hover:border-[var(--accent)] transition-all duration-300 hover:shadow-lg hover:shadow-[var(--accent)]/20 cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--bg-elevated)] shrink-0">
                                <Swords size={18} className="text-[var(--text-secondary)]" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-semibold text-sm text-[var(--text-primary)] truncate">
                                  {league.name}
                                </h4>
                                <p className="text-xs text-[var(--text-muted)]">
                                  {league.memberUids.length} member{league.memberUids.length !== 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                            <div className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)]">
                              View
                              <ChevronRight size={14} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null;
          })()}

          {/* Fantasy Auction Info */}
          <div className="glass-card border border-[var(--bg-elevated)] rounded-xl p-6 sm:p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-cyan-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[var(--accent)]/30">
              <Gavel size={28} className="text-white" />
            </div>
            <h3 className="text-lg font-bold gradient-text mb-2">
              Fantasy Auction
            </h3>
            <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto mb-4">
              Run a live auction, bid on players, and build your squad.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mb-6">
              {[
                { label: 'Live Auction', icon: Gavel },
                { label: '100 Cr Budget', icon: Zap },
                { label: '15 Players', icon: Users },
              ].map(({ label, icon: Icon }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                >
                  <Icon size={12} className="text-[var(--accent)]" />
                  {label}
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-3">
              <Link href={`/fantasy/${tournamentId}/create`}>
                <Button className="bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent-hover)] gap-2 shadow-lg shadow-[var(--accent)]/30">
                  <Swords size={16} />
                  Create League
                </Button>
              </Link>
              <Button
                onClick={() => { setLeagueJoinModal(true); setLeagueJoinError(''); setLeagueJoinCode(''); }}
                variant="outline"
                className="border-[var(--border)] text-[var(--text-secondary)] font-semibold gap-2"
              >
                <LogIn size={16} />
                Join League
              </Button>
            </div>
          </div>
          </>}
        </>
      )}
      {/* Create / Join Group Modal */}
      {groupModal && (
        <Dialog open={true} onOpenChange={() => setGroupModal(null)}>
          <DialogContent className="border border-[var(--border)] bg-[var(--bg-card)] shadow-xl">
            <DialogHeader className="border-b border-[var(--border)] pb-4">
              <DialogTitle className="text-lg font-bold text-[var(--text-primary)]">
                {groupModal === 'create' ? 'Create a Group' : 'Join a Group'}
              </DialogTitle>
            </DialogHeader>

            {groupModalError && (
              <div className="px-4 py-3 rounded-lg bg-[var(--error)]/10 border border-[var(--error)]/30">
                <p className="text-sm text-[var(--error)]">{groupModalError}</p>
              </div>
            )}

            <div className="space-y-4 py-4">
              {groupModal === 'create' ? (
                <>
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">Group Name</label>
                    <Input
                      value={groupModalName}
                      onChange={e => setGroupModalName(e.target.value)}
                      placeholder="e.g. Office IPL League"
                      className="bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-primary)]"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={groupModalPublic}
                      onChange={e => setGroupModalPublic(e.target.checked)}
                      className="rounded border-[var(--border)]"
                    />
                    <span className="text-xs text-[var(--text-secondary)]">Make this group public (anyone can find and join)</span>
                  </label>
                </>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">Group ID</label>
                  <Input
                    value={groupModalId}
                    onChange={e => setGroupModalId(e.target.value)}
                    placeholder="Paste the group ID here"
                    className="bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-primary)]"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setGroupModal(null)} className="border-[var(--border)] text-[var(--text-muted)]">
                Cancel
              </Button>
              <Button
                onClick={groupModal === 'create' ? handleCreateGroup : handleJoinGroupById}
                disabled={groupModalLoading}
                className="bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent-hover)] gap-1.5"
              >
                {groupModalLoading && <Loader2 size={14} className="animate-spin" />}
                {groupModal === 'create' ? 'Create' : 'Join'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Join Fantasy League Modal */}
      {leagueJoinModal && (
        <Dialog open={true} onOpenChange={() => setLeagueJoinModal(false)}>
          <DialogContent className="border border-[var(--border)] bg-[var(--bg-card)] shadow-xl">
            <DialogHeader className="border-b border-[var(--border)] pb-4">
              <DialogTitle className="text-lg font-bold text-[var(--text-primary)]">
                Join a Fantasy League
              </DialogTitle>
            </DialogHeader>

            {leagueJoinError && (
              <div className="px-4 py-3 rounded-lg bg-[var(--error)]/10 border border-[var(--error)]/30">
                <p className="text-sm text-[var(--error)]">{leagueJoinError}</p>
              </div>
            )}

            <div className="space-y-4 py-4">
              <div>
                <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">League ID</label>
                <Input
                  value={leagueJoinCode}
                  onChange={e => setLeagueJoinCode(e.target.value)}
                  placeholder="Paste the league ID shared with you"
                  className="bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-primary)]"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setLeagueJoinModal(false)} className="border-[var(--border)] text-[var(--text-muted)]">
                Cancel
              </Button>
              <Button
                onClick={handleJoinLeagueByCode}
                disabled={leagueJoinLoading}
                className="bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent-hover)] gap-1.5"
              >
                {leagueJoinLoading && <Loader2 size={14} className="animate-spin" />}
                Join
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
