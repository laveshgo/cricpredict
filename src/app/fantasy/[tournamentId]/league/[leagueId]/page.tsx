'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  onFantasyLeagueUpdate,
  onAuctionStateUpdate,
  joinFantasyLeague,
  leaveFantasyLeague,
  createAuctionState,
  startAuction,
  updateFantasyLeagueSettings,
} from '@/lib/fantasy-firestore';
import { onTournament } from '@/lib/firestore';
import { buildAuctionPlayerOrder, getAuctionSetPlayers, FANTASY_BUDGET, FANTASY_SQUAD_SIZE, BID_INCREMENT, TIMER_DURATION } from '@/lib/fantasy-players';
import type { FantasyLeague, AuctionState, AuctionRules, AuctionSet } from '@/types/fantasy';
import { DEFAULT_AUCTION_RULES, AUCTION_SET_ORDER, AUCTION_SETS } from '@/types/fantasy';
import type { Tournament } from '@/types';
import {
  ArrowLeft,
  Users,
  Swords,
  Crown,
  Copy,
  Check,
  UserPlus,
  LogOut,
  Loader2,
  Play,
  Zap,
  Clock,
  Shield,
  Settings,
  ChevronDown,
  ChevronUp,
  ListOrdered,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

// ─── Role label map ───
const ROLE_LABELS: Record<string, string> = {
  BAT: 'Batters',
  BOWL: 'Bowlers',
  AR: 'All-rounders',
  WK: 'Wicket-keepers',
};

export default function FantasyLeaguePage() {
  const params = useParams();
  const router = useRouter();
  const tournamentId = params.tournamentId as string;
  const leagueId = params.leagueId as string;
  const { user, profile, loading: authLoading } = useAuth();
  const [league, setLeague] = useState<FantasyLeague | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);

  // ─── Admin settings state ───
  const [showRules, setShowRules] = useState(false);
  const [showSetPreview, setShowSetPreview] = useState(false);
  const [rules, setRules] = useState<AuctionRules>(DEFAULT_AUCTION_RULES);
  const [squadSize, setSquadSize] = useState(FANTASY_SQUAD_SIZE);
  const [budget, setBudget] = useState(FANTASY_BUDGET);
  const [bidInc, setBidInc] = useState(BID_INCREMENT);
  const [timerDur, setTimerDur] = useState(TIMER_DURATION);
  const [skippedSets, setSkippedSets] = useState<AuctionSet[]>([]);
  const [savingRules, setSavingRules] = useState(false);

  // Sync from league settings
  useEffect(() => {
    if (league?.settings) {
      const s = league.settings;
      if (s.auctionRules) setRules(s.auctionRules);
      if (s.maxSquadSize) setSquadSize(s.maxSquadSize);
      if (s.totalBudget) setBudget(s.totalBudget);
      if (s.bidIncrement) setBidInc(s.bidIncrement);
      if (s.timerDuration) setTimerDur(s.timerDuration);
      if (s.skippedSets) setSkippedSets(s.skippedSets);
    }
  }, [league?.settings]);

  // ─── Set preview data ───
  const [expandedSet, setExpandedSet] = useState<string | null>(null);
  const setPreview = useMemo(() => {
    return AUCTION_SET_ORDER.map(setKey => {
      const config = AUCTION_SETS[setKey];
      const players = getAuctionSetPlayers(setKey);
      return {
        key: setKey,
        label: config.label,
        basePrice: config.basePrice,
        role: config.role,
        tier: config.tier,
        players,
        totalPlayers: players.length,
      };
    });
  }, []);

  // ─── Real-time listeners ───
  useEffect(() => {
    if (authLoading || !user) return;
    const unsubs: (() => void)[] = [];

    unsubs.push(onTournament(tournamentId, setTournament));

    unsubs.push(onFantasyLeagueUpdate(leagueId, (l) => {
      setLeague(l);
      setLoading(false);
    }));

    unsubs.push(onAuctionStateUpdate(leagueId, setAuctionState));

    return () => unsubs.forEach(u => u());
  }, [tournamentId, leagueId, authLoading, user]);

  // ─── Derived ───
  const isMember = league?.memberUids.includes(user?.uid || '') ?? false;
  const isAdmin = league?.createdBy === user?.uid;
  const memberCount = league?.memberUids.length || 0;

  // If auction is active (live/paused/selection), redirect to auction room
  useEffect(() => {
    if (auctionState && ['live', 'paused', 'selection'].includes(auctionState.status) && isMember) {
      router.push(`/fantasy/${tournamentId}/auction/${leagueId}`);
    }
  }, [auctionState, isMember, tournamentId, leagueId, router]);

  // ─── Join ───
  const handleJoin = async () => {
    if (!user || !profile) return;
    setJoining(true);
    try {
      await joinFantasyLeague(leagueId, user.uid, {
        displayName: profile.displayName || profile.username || 'User',
        username: profile.username || 'user',
      });
    } catch (err) {
      console.error('Failed to join:', err);
    } finally {
      setJoining(false);
    }
  };

  // ─── Leave ───
  const handleLeave = async () => {
    if (!user || isAdmin) return;
    setLeaving(true);
    try {
      await leaveFantasyLeague(leagueId, user.uid);
      router.push(`/tournament/${tournamentId}?tab=fantasy`);
    } catch (err) {
      console.error('Failed to leave:', err);
    } finally {
      setLeaving(false);
    }
  };

  // ─── Save settings ───
  const handleSaveRules = async () => {
    if (!isAdmin || !league) return;
    setSavingRules(true);
    try {
      await updateFantasyLeagueSettings(leagueId, {
        auctionRules: rules,
        maxSquadSize: squadSize,
        totalBudget: budget,
        bidIncrement: bidInc,
        timerDuration: timerDur,
        skippedSets,
      });
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSavingRules(false);
    }
  };

  // ─── Start Auction (admin only) ───
  const handleStartAuction = async () => {
    if (!user || !isAdmin || !league) return;
    setStarting(true);
    try {
      // Create auction state if it doesn't exist
      if (!auctionState) {
        const s = league.settings;
        const setsToSkip = s?.skippedSets ?? skippedSets;
        const playerOrder = buildAuctionPlayerOrder().filter(p => !setsToSkip.includes(p.set));
        const aBudget = s?.totalBudget ?? budget;
        const aSquadSize = s?.maxSquadSize ?? squadSize;
        const aBidInc = s?.bidIncrement ?? bidInc;
        const aTimer = s?.timerDuration ?? timerDur;
        const currentRules = s?.auctionRules ?? rules;

        const budgets: AuctionState['budgets'] = {};
        for (const uid of league.memberUids) {
          budgets[uid] = {
            total: aBudget,
            spent: 0,
            remaining: aBudget,
            playerCount: 0,
          };
        }

        const newState: AuctionState = {
          id: leagueId,
          leagueId,
          tournamentId,
          status: 'lobby',
          playerOrder,
          currentIndex: -1,
          currentPlayer: null,
          currentSet: null,
          currentBid: 0,
          currentBidderId: null,
          currentBidderName: null,
          bidHistory: [],
          passedUserIds: [],
          holdsUsed: {},
          timerEndsAt: null,
          timerDuration: aTimer,
          budgets,
          soldPlayers: [],
          unsoldPlayers: [],
          auctionLog: [],
          maxSquadSize: aSquadSize,
          totalBudget: aBudget,
          bidIncrement: aBidInc,
          rules: currentRules,
          selectionPicks: {},
          selectionConfirmed: [],
        };

        await createAuctionState(newState);
      }

      // Start the auction
      await startAuction(leagueId);
      router.push(`/fantasy/${tournamentId}/auction/${leagueId}`);
    } catch (err) {
      console.error('Failed to start auction:', err);
    } finally {
      setStarting(false);
    }
  };

  // ─── Copy invite link ───
  const handleCopyLink = () => {
    const url = `${window.location.origin}/fantasy/${tournamentId}/league/${leagueId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Auth guard ───
  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <Swords size={40} className="text-[var(--accent)] mx-auto mb-3" />
        <h2 className="text-xl font-bold mb-2 text-[var(--text-primary)]">Sign in to view this league</h2>
        <Link href="/auth/signin">
          <Button className="bg-[var(--accent)] hover:bg-[var(--accent)] text-white">Sign in</Button>
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

  if (!league) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <Swords size={40} className="text-[var(--text-muted)] mx-auto mb-3" />
        <h2 className="text-xl font-bold text-[var(--text-primary)]">League not found</h2>
      </div>
    );
  }

  // ─── NON-MEMBER LANDING PAGE (always shown before any league content) ───
  if (!isMember) {
    const isLocked = league.settings?.addLocked;
    const limit = league.settings?.memberLimit;
    const isFull = limit ? memberCount >= limit : false;
    const spotsLeft = limit ? limit - memberCount : null;
    const auctionCompleted = auctionState?.status === 'completed';
    const auctionLive = auctionState?.status === 'live';
    const creatorInfo = league.members?.[league.createdBy];

    return (
      <div className="mx-auto max-w-md px-4 py-8 sm:py-16 text-center animate-fade-in">
        {/* Back button */}
        <div className="flex justify-start mb-6">
          <Link href={`/tournament/${tournamentId}?tab=fantasy`}>
            <button className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--bg-elevated)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors">
              <ArrowLeft size={16} className="text-[var(--text-muted)]" />
            </button>
          </Link>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="h-1.5 bg-gradient-to-r from-[var(--accent)] via-cyan-500 to-transparent" />
          <div className="px-6 py-10">
            {/* Icon */}
            <div className="mb-5 inline-flex items-center justify-center w-20 h-20 rounded-full bg-[var(--accent)]/10">
              <Swords size={40} className="text-[var(--accent)]" />
            </div>

            {/* League name */}
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-[var(--accent)] to-cyan-400 bg-clip-text text-transparent mb-2">
              {league.name}
            </h1>

            {/* Tournament badge */}
            <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-1 bg-[var(--accent)]/10 text-[var(--accent)]">
              {tournament?.name || 'Tournament'} — Fantasy Auction
            </span>

            {/* Created by */}
            {creatorInfo && (
              <p className="text-xs text-[var(--text-muted)] mb-4">
                Created by <span className="font-semibold text-[var(--text-secondary)]">{creatorInfo.displayName}</span>
              </p>
            )}

            {/* Stats row */}
            <div className="flex justify-center gap-6 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--text-primary)]">{memberCount}</div>
                <div className="text-xs font-medium text-[var(--text-muted)]">Members</div>
              </div>
              <div style={{ width: '1px', background: 'var(--border)' }} />
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--text-primary)]">{budget}</div>
                <div className="text-xs font-medium text-[var(--text-muted)]">Cr Budget</div>
              </div>
              <div style={{ width: '1px', background: 'var(--border)' }} />
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--text-primary)]">{squadSize}</div>
                <div className="text-xs font-medium text-[var(--text-muted)]">Players</div>
              </div>
            </div>

            {/* Info chips */}
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {[
                { label: 'Live Auction', icon: Swords },
                { label: `${timerDur}s Timer`, icon: Clock },
                { label: `Max ${rules.maxForeignPlayers} OS`, icon: Shield },
              ].map(({ label, icon: Icon }) => (
                <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border)]">
                  <Icon size={11} className="text-[var(--accent)]" />
                  {label}
                </div>
              ))}
            </div>

            {/* Members preview */}
            {league.members && Object.keys(league.members).length > 0 && (
              <div className="mb-6 px-3 py-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)]">
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <Users size={12} className="text-[var(--text-muted)]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Members</span>
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {Object.values(league.members).slice(0, 8).map((m, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border)]">
                      {m.displayName}
                    </span>
                  ))}
                  {Object.keys(league.members).length > 8 && (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border)]">
                      +{Object.keys(league.members).length - 8} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Join / Locked / Full / Completed */}
            {auctionCompleted ? (
              <div className="w-full py-5 rounded-xl flex flex-col items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--border)]">
                <Check size={24} className="text-[var(--text-muted)]" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">Auction has ended</p>
                <p className="text-xs text-[var(--text-muted)]">This league&apos;s auction is complete. New members can no longer join.</p>
              </div>
            ) : auctionLive ? (
              <div className="w-full py-5 rounded-xl flex flex-col items-center gap-2 bg-orange-500/10 border border-orange-500/30">
                <Zap size={24} className="text-orange-400" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">Auction is LIVE</p>
                <p className="text-xs text-[var(--text-muted)]">The auction is currently running. You can&apos;t join mid-auction.</p>
              </div>
            ) : isLocked ? (
              <div className="w-full py-5 rounded-xl flex flex-col items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--border)]">
                <Shield size={24} className="text-red-400" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">This league is closed</p>
                <p className="text-xs text-[var(--text-muted)]">The admin has closed this league to new members.</p>
              </div>
            ) : isFull ? (
              <div className="w-full py-5 rounded-xl flex flex-col items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--border)]">
                <Users size={24} className="text-orange-400" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">This league is full</p>
                <p className="text-xs text-[var(--text-muted)]">{memberCount}/{limit} members</p>
              </div>
            ) : (
              <>
                {spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 5 && (
                  <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg mb-3 animate-pulse bg-red-500/10 border border-red-500/30">
                    <Clock size={14} className="text-red-400" />
                    <span className="text-sm font-bold text-red-400">
                      Only {spotsLeft} {spotsLeft === 1 ? 'spot' : 'spots'} remaining
                    </span>
                  </div>
                )}
                <Button
                  onClick={handleJoin}
                  disabled={joining}
                  className="w-full py-6 text-base font-bold rounded-xl bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-[var(--accent)]/30 gap-2"
                >
                  {joining ? (
                    <><Loader2 size={20} className="animate-spin" /> Joining...</>
                  ) : (
                    <><UserPlus size={20} /> Join This League</>
                  )}
                </Button>
                <p className="mt-5 text-sm leading-relaxed text-[var(--text-secondary)]">
                  Join to participate in the live auction, build your squad, and compete all season.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Auction status teaser */}
        {auctionState && !auctionCompleted && !auctionLive && (
          <div className="mt-6 rounded-xl px-5 py-4 bg-[var(--bg-card)] border border-[var(--border)]">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Swords size={14} className="text-[var(--accent)]" />
              <span className="text-xs font-bold text-[var(--text-primary)]">Auction Status</span>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {auctionState.status === 'lobby' ? 'Waiting to start — join now before the auction begins!'
                : auctionState.status === 'paused' ? 'Auction is paused — join now to participate when it resumes.'
                : auctionState.status === 'selection' ? 'Re-auction round in progress.'
                : 'Auction has completed.'}
            </p>
          </div>
        )}
      </div>
    );
  }

  // If auction is completed, show results
  if (auctionState?.status === 'completed') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/tournament/${tournamentId}?tab=fantasy`}>
            <button className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--bg-elevated)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors">
              <ArrowLeft size={16} className="text-[var(--text-muted)]" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">{league.name}</h1>
            <p className="text-xs text-[var(--text-muted)]">Auction Complete</p>
          </div>
        </div>

        {/* Results per user */}
        {Object.entries(auctionState.budgets).map(([uid, budget]) => {
          const userPlayers = auctionState.soldPlayers.filter(p => p.boughtBy === uid);
          const memberInfo = league.members?.[uid];
          const isMe = uid === user?.uid;

          return (
            <Card key={uid} className={`mb-4 border ${isMe ? 'border-[var(--accent)]/30 bg-[var(--accent)]/5' : 'border-[var(--bg-elevated)] bg-[var(--bg-card)]'}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-[var(--accent)]" />
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                      {memberInfo?.displayName || 'User'}
                    </span>
                    {isMe && <Badge className="bg-[var(--accent)]/15 text-[var(--accent)] border-0 text-[9px]">you</Badge>}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {userPlayers.length} players — {budget.spent.toFixed(1)} Cr spent
                  </div>
                </div>
                <div className="space-y-1">
                  {userPlayers.map(p => (
                    <div key={p.playerId} className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-[var(--bg-elevated)]">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge className="text-[8px] font-bold px-1 py-0 border bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)]">
                          {p.role}
                        </Badge>
                        <span className="text-xs text-[var(--text-primary)] truncate">{p.playerName}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">{p.teamShort}</span>
                        {p.isForeign && (
                          <span className="text-[10px] shrink-0" title="Overseas">✈</span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-[var(--accent)] shrink-0">{p.soldPrice} Cr</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // ─── LOBBY VIEW ───
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/tournament/${tournamentId}?tab=fantasy`}>
          <button className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--bg-elevated)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors">
            <ArrowLeft size={16} className="text-[var(--text-muted)]" />
          </button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-[var(--text-primary)] truncate">{league.name}</h1>
          <p className="text-xs text-[var(--text-muted)]">
            {tournament?.name || 'Tournament'} — Fantasy Auction
          </p>
        </div>
      </div>

      {/* League Info */}
      <Card className="glass-card border border-[var(--bg-elevated)] mb-4">
        <CardContent className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-cyan-500 flex items-center justify-center shadow-lg shadow-[var(--accent)]/30">
                <Swords size={26} className="text-white" />
              </div>
              <div>
                <span className="text-lg font-bold text-[var(--text-primary)]">Waiting Room</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge className={`text-[10px] border-0 ${
                    league.isPublic ? 'bg-[var(--success)]/15 text-[var(--success)]' : 'bg-[var(--warning)]/15 text-[var(--warning)]'
                  }`}>
                    {league.isPublic ? 'Public' : 'Private'}
                  </Badge>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {memberCount} member{memberCount !== 1 ? 's' : ''} joined
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCopyLink} size="sm" variant="outline" className="border-[var(--border)] text-[var(--text-secondary)] gap-1.5 text-xs">
                {copied ? <Check size={14} className="text-[var(--success)]" /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Invite'}
              </Button>
              {!isMember && (
                <Button onClick={handleJoin} disabled={joining} size="sm" className="bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent-hover)] gap-1.5 text-xs">
                  {joining ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  Join
                </Button>
              )}
              {isMember && !isAdmin && (
                <Button onClick={handleLeave} disabled={leaving} size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1.5 text-xs">
                  {leaving ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                  Leave
                </Button>
              )}
            </div>
          </div>

          {/* Auction info chips */}
          <div className="flex flex-wrap gap-2 mb-5">
            {[
              { icon: Users, label: `${squadSize} Players Each` },
              { icon: Zap, label: `${budget} Cr Budget` },
              { icon: Clock, label: `${timerDur}s Bid Timer` },
              { icon: Users, label: `Max ${rules.maxForeignPlayers} Overseas ✈` },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border)]">
                <Icon size={12} className="text-[var(--accent)]" />
                {label}
              </div>
            ))}
          </div>

          {/* Members list */}
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Members ({memberCount})
          </h3>
          <div className="space-y-2">
            {league.memberUids.map((uid) => {
              const memberInfo = league.members?.[uid];
              const isMe = uid === user?.uid;
              const isLeagueAdmin = uid === league.createdBy;

              return (
                <div
                  key={uid}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${
                    isMe ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/20' : 'bg-[var(--bg-elevated)]'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)]">
                    {(memberInfo?.displayName || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-[var(--text-primary)] truncate block">
                      {memberInfo?.displayName || memberInfo?.username || 'User'}
                    </span>
                    {memberInfo?.username && (
                      <span className="text-[10px] text-[var(--text-muted)]">@{memberInfo.username}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isMe && <Badge className="bg-[var(--accent)]/15 text-[var(--accent)] border-0 text-[9px] px-1.5 py-0">you</Badge>}
                    {isLeagueAdmin && (
                      <Badge className="bg-yellow-500/15 text-yellow-500 border-0 text-[9px] px-1.5 py-0 flex items-center gap-0.5">
                        <Crown size={9} /> Admin
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ─── Auction Rules (admin only) ─── */}
      {isAdmin && isMember && (
        <Card className="glass-card border border-[var(--bg-elevated)] mb-4">
          <button
            onClick={() => setShowRules(!showRules)}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-2">
              <Settings size={16} className="text-[var(--accent)]" />
              <span className="text-sm font-bold text-[var(--text-primary)]">Auction Rules</span>
              <Badge className="bg-[var(--accent)]/15 text-[var(--accent)] border-0 text-[9px]">Admin</Badge>
            </div>
            {showRules ? <ChevronUp size={16} className="text-[var(--text-muted)]" /> : <ChevronDown size={16} className="text-[var(--text-muted)]" />}
          </button>

          {showRules && (
            <CardContent className="px-4 pb-4 pt-0 space-y-4">
              <p className="text-[11px] text-[var(--text-muted)]">
                Configure auction settings before starting. All participants will follow these constraints.
              </p>

              {/* General auction settings */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Auction Settings</span>

                {/* Squad Size */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-[var(--accent)]" />
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Squad Size</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSquadSize(v => Math.max(5, v - 1))}
                      className="w-8 h-8 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)]"
                    >-</button>
                    <span className="w-8 text-center text-sm font-bold text-[var(--text-primary)]">{squadSize}</span>
                    <button
                      onClick={() => setSquadSize(v => Math.min(25, v + 1))}
                      className="w-8 h-8 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)]"
                    >+</button>
                  </div>
                </div>

                {/* Budget */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-[var(--accent)]" />
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Budget (Cr)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setBudget(v => Math.max(10, v - 10))}
                      className="w-8 h-8 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)]"
                    >-</button>
                    <span className="w-10 text-center text-sm font-bold text-[var(--text-primary)]">{budget}</span>
                    <button
                      onClick={() => setBudget(v => Math.min(500, v + 10))}
                      className="w-8 h-8 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)]"
                    >+</button>
                  </div>
                </div>

                {/* Bid Increment */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowLeft size={14} className="text-[var(--accent)] rotate-180" />
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Bid Increment (Cr)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setBidInc(v => Math.max(0.25, +(v - 0.25).toFixed(2)))}
                      className="w-8 h-8 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)]"
                    >-</button>
                    <span className="w-10 text-center text-sm font-bold text-[var(--text-primary)]">{bidInc}</span>
                    <button
                      onClick={() => setBidInc(v => Math.min(5, +(v + 0.25).toFixed(2)))}
                      className="w-8 h-8 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)]"
                    >+</button>
                  </div>
                </div>

                {/* Timer Duration */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-[var(--accent)]" />
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Bid Timer (sec)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setTimerDur(v => Math.max(5, v - 5))}
                      className="w-8 h-8 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)]"
                    >-</button>
                    <span className="w-8 text-center text-sm font-bold text-[var(--text-primary)]">{timerDur}</span>
                    <button
                      onClick={() => setTimerDur(v => Math.min(60, v + 5))}
                      className="w-8 h-8 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)]"
                    >+</button>
                  </div>
                </div>
              </div>

              {/* Foreign player limit */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">✈</span>
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">Max Overseas Players</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setRules(r => ({ ...r, maxForeignPlayers: Math.max(0, r.maxForeignPlayers - 1) }))}
                    className="w-8 h-8 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)]"
                  >-</button>
                  <span className="w-8 text-center text-sm font-bold text-[var(--text-primary)]">{rules.maxForeignPlayers}</span>
                  <button
                    onClick={() => setRules(r => ({ ...r, maxForeignPlayers: Math.min(11, r.maxForeignPlayers + 1) }))}
                    className="w-8 h-8 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)]"
                  >+</button>
                </div>
              </div>

              {/* Minimum role requirements */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Minimum Per Role</span>
                {([
                  { key: 'minWK' as const, label: 'Wicket-keepers', emoji: '🧤' },
                  { key: 'minBAT' as const, label: 'Batters', emoji: '🏏' },
                  { key: 'minAR' as const, label: 'All-rounders', emoji: '⭐' },
                  { key: 'minBOWL' as const, label: 'Bowlers', emoji: '🎯' },
                ]).map(({ key, label, emoji }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{emoji}</span>
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">{label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setRules(r => ({ ...r, [key]: Math.max(0, r[key] - 1) }))}
                        className="w-8 h-8 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)]"
                      >-</button>
                      <span className="w-8 text-center text-sm font-bold text-[var(--text-primary)]">{rules[key]}</span>
                      <button
                        onClick={() => setRules(r => ({ ...r, [key]: Math.min(squadSize, r[key] + 1) }))}
                        className="w-8 h-8 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)]"
                      >+</button>
                    </div>
                  </div>
                ))}

                {/* Total minimum validation */}
                {(() => {
                  const total = rules.minWK + rules.minBAT + rules.minAR + rules.minBOWL;
                  const isValid = total <= squadSize;
                  return (
                    <div className={`text-[10px] mt-1 ${isValid ? 'text-[var(--text-muted)]' : 'text-red-400 font-semibold'}`}>
                      Total minimum: {total} / {squadSize} slots
                      {!isValid && ' — exceeds squad size!'}
                    </div>
                  );
                })()}
              </div>

              {/* Hold settings */}
              <div className="mt-3 pt-3 border-t border-[var(--border)]">
                <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Thinking Time (Holds)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)] mb-1">Holds Per Player</div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setRules(r => ({ ...r, holdsPerPlayer: Math.max(0, r.holdsPerPlayer - 1) }))}
                        className="w-8 h-8 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)]"
                      >-</button>
                      <span className="w-8 text-center text-sm font-bold text-[var(--text-primary)]">{rules.holdsPerPlayer}</span>
                      <button
                        onClick={() => setRules(r => ({ ...r, holdsPerPlayer: Math.min(20, r.holdsPerPlayer + 1) }))}
                        className="w-8 h-8 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)]"
                      >+</button>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--text-muted)] mb-1">Hold Duration (sec)</div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setRules(r => ({ ...r, holdDuration: Math.max(5, r.holdDuration - 5) }))}
                        className="w-8 h-8 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)]"
                      >-</button>
                      <span className="w-8 text-center text-sm font-bold text-[var(--text-primary)]">{rules.holdDuration}</span>
                      <button
                        onClick={() => setRules(r => ({ ...r, holdDuration: Math.min(120, r.holdDuration + 5) }))}
                        className="w-8 h-8 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] hover:border-[var(--accent)]"
                      >+</button>
                    </div>
                  </div>
                </div>
                <div className="text-[9px] text-[var(--text-muted)] mt-1.5">
                  Each player gets {rules.holdsPerPlayer} hold{rules.holdsPerPlayer !== 1 ? 's' : ''} of {rules.holdDuration}s extra thinking time per player
                </div>
              </div>

              {/* Save button */}
              <Button
                onClick={handleSaveRules}
                disabled={savingRules || (rules.minWK + rules.minBAT + rules.minAR + rules.minBOWL > squadSize)}
                size="sm"
                className="w-full bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent-hover)] gap-1.5 text-xs h-9"
              >
                {savingRules ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {savingRules ? 'Saving...' : 'Save Rules'}
              </Button>
            </CardContent>
          )}
        </Card>
      )}

      {/* ─── Non-admin rules view ─── */}
      {!isAdmin && isMember && (
        <Card className="glass-card border border-[var(--bg-elevated)] mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Settings size={14} className="text-[var(--accent)]" />
              <span className="text-xs font-bold text-[var(--text-primary)]">Auction Settings</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="px-2.5 py-1.5 rounded-md bg-[var(--bg-elevated)] text-[10px]">
                <span className="text-[var(--text-muted)]">Squad Size:</span>{' '}
                <span className="font-bold text-[var(--text-primary)]">{squadSize}</span>
              </div>
              <div className="px-2.5 py-1.5 rounded-md bg-[var(--bg-elevated)] text-[10px]">
                <span className="text-[var(--text-muted)]">Budget:</span>{' '}
                <span className="font-bold text-[var(--text-primary)]">{budget} Cr</span>
              </div>
              <div className="px-2.5 py-1.5 rounded-md bg-[var(--bg-elevated)] text-[10px]">
                <span className="text-[var(--text-muted)]">Bid Increment:</span>{' '}
                <span className="font-bold text-[var(--text-primary)]">{bidInc} Cr</span>
              </div>
              <div className="px-2.5 py-1.5 rounded-md bg-[var(--bg-elevated)] text-[10px]">
                <span className="text-[var(--text-muted)]">Bid Timer:</span>{' '}
                <span className="font-bold text-[var(--text-primary)]">{timerDur}s</span>
              </div>
              <div className="px-2.5 py-1.5 rounded-md bg-[var(--bg-elevated)] text-[10px]">
                <span className="text-[var(--text-muted)]">Max Overseas ✈:</span>{' '}
                <span className="font-bold text-[var(--text-primary)]">{rules.maxForeignPlayers}</span>
              </div>
              <div className="px-2.5 py-1.5 rounded-md bg-[var(--bg-elevated)] text-[10px]">
                <span className="text-[var(--text-muted)]">Min WK:</span>{' '}
                <span className="font-bold text-[var(--text-primary)]">{rules.minWK}</span>
              </div>
              <div className="px-2.5 py-1.5 rounded-md bg-[var(--bg-elevated)] text-[10px]">
                <span className="text-[var(--text-muted)]">Min BAT:</span>{' '}
                <span className="font-bold text-[var(--text-primary)]">{rules.minBAT}</span>
              </div>
              <div className="px-2.5 py-1.5 rounded-md bg-[var(--bg-elevated)] text-[10px]">
                <span className="text-[var(--text-muted)]">Min AR:</span>{' '}
                <span className="font-bold text-[var(--text-primary)]">{rules.minAR}</span>
              </div>
              <div className="px-2.5 py-1.5 rounded-md bg-[var(--bg-elevated)] text-[10px]">
                <span className="text-[var(--text-muted)]">Min BOWL:</span>{' '}
                <span className="font-bold text-[var(--text-primary)]">{rules.minBOWL}</span>
              </div>
              <div className="px-2.5 py-1.5 rounded-md bg-[var(--bg-elevated)] text-[10px]">
                <span className="text-[var(--text-muted)]">Holds:</span>{' '}
                <span className="font-bold text-[var(--text-primary)]">{rules.holdsPerPlayer} × {rules.holdDuration}s</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Set Order Preview ─── */}
      <Card className="glass-card border border-[var(--bg-elevated)] mb-4">
        <button
          onClick={() => setShowSetPreview(!showSetPreview)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-2">
            <ListOrdered size={16} className="text-[var(--accent)]" />
            <span className="text-sm font-bold text-[var(--text-primary)]">Auction Set Order</span>
            <Badge className="bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border)] text-[9px]">
              {AUCTION_SET_ORDER.length - skippedSets.length}/{AUCTION_SET_ORDER.length} sets
            </Badge>
          </div>
          {showSetPreview ? <ChevronUp size={16} className="text-[var(--text-muted)]" /> : <ChevronDown size={16} className="text-[var(--text-muted)]" />}
        </button>

        {showSetPreview && (
          <CardContent className="px-4 pb-4 pt-0 space-y-2">
            <p className="text-[11px] text-[var(--text-muted)] mb-3">
              Players come in random order within each set, but sets follow this fixed sequence.
              {isAdmin && ' Tap the toggle to skip a set.'}
            </p>
            {setPreview.map((set, idx) => {
              const isExpanded = expandedSet === set.key;
              const isSkipped = skippedSets.includes(set.key as AuctionSet);
              return (
                <div key={set.key} className={isSkipped ? 'opacity-50' : ''}>
                  <div className={`flex items-center gap-0 rounded-lg bg-[var(--bg-elevated)] ${
                    set.tier === 'marquee' && !isSkipped ? 'border border-yellow-500/20' : ''
                  } ${isExpanded ? 'rounded-b-none' : ''}`}>
                    {/* Skip toggle (admin only) */}
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSkippedSets(prev =>
                            prev.includes(set.key as AuctionSet)
                              ? prev.filter(s => s !== set.key)
                              : [...prev, set.key as AuctionSet]
                          );
                        }}
                        className={`ml-2 w-8 h-[18px] rounded-full shrink-0 relative transition-colors ${
                          isSkipped
                            ? 'bg-[var(--bg-card)] border border-[var(--border)]'
                            : 'bg-[var(--accent)]'
                        }`}
                        title={isSkipped ? 'Enable this set' : 'Skip this set'}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-[1px] transition-all ${
                          isSkipped ? 'left-[2px]' : 'left-[16px]'
                        }`} />
                      </button>
                    )}

                    <button
                      onClick={() => setExpandedSet(isExpanded ? null : set.key)}
                      className="flex-1 flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover)] rounded-r-lg"
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                        isSkipped
                          ? 'bg-[var(--bg-card)] text-[var(--text-muted)]'
                          : set.tier === 'marquee'
                            ? 'bg-yellow-500/20 text-yellow-500'
                            : set.tier === 'set2'
                            ? 'bg-blue-500/15 text-blue-400'
                            : 'bg-[var(--bg-card)] text-[var(--text-muted)]'
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs font-semibold block ${isSkipped ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-primary)]'}`}>{set.label}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {isSkipped ? 'Skipped' : `${set.totalPlayers} players — Base ${set.basePrice} Cr`}
                        </span>
                      </div>
                      {!isSkipped && set.tier === 'marquee' && (
                        <Badge className="bg-yellow-500/15 text-yellow-500 border-0 text-[8px] shrink-0">Marquee</Badge>
                      )}
                      {isSkipped && (
                        <Badge className="bg-red-500/10 text-red-400 border-0 text-[8px] shrink-0">Skipped</Badge>
                      )}
                      {!isSkipped && (
                        isExpanded
                          ? <ChevronUp size={14} className="text-[var(--text-muted)] shrink-0" />
                          : <ChevronDown size={14} className="text-[var(--text-muted)] shrink-0" />
                      )}
                    </button>
                  </div>

                  {isExpanded && !isSkipped && (
                    <div className={`px-3 pb-3 pt-1.5 bg-[var(--bg-elevated)] rounded-b-lg space-y-1 ${
                      set.tier === 'marquee' ? 'border border-t-0 border-yellow-500/20' : ''
                    }`}>
                      {set.players.map(player => (
                        <div
                          key={player.id}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-[var(--bg-card)]"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-[var(--text-primary)] truncate">{player.name}</span>
                            <span className="text-[10px] text-[var(--text-muted)]">{player.teamShort}</span>
                            {player.isForeign && (
                              <span className="text-[10px] shrink-0" title="Overseas">✈</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {set.players.length === 0 && (
                        <div className="text-[10px] text-[var(--text-muted)] text-center py-2">No players in this set</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        )}
      </Card>

      {/* Start Auction button (admin only) */}
      {isAdmin && isMember && memberCount >= 2 && (
        <Button
          onClick={handleStartAuction}
          disabled={starting}
          className="w-full bg-gradient-to-r from-[var(--accent)] to-cyan-500 text-white font-bold hover:opacity-90 gap-2 h-12 text-base shadow-lg shadow-[var(--accent)]/30"
        >
          {starting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Starting Auction...
            </>
          ) : (
            <>
              <Play size={18} />
              Start Auction ({memberCount} members)
            </>
          )}
        </Button>
      )}

      {isAdmin && memberCount < 2 && (
        <div className="text-center py-4 text-sm text-[var(--text-muted)]">
          Need at least 2 members to start the auction. Share the invite link!
        </div>
      )}

      {!isAdmin && isMember && (
        <div className="glass-card border border-[var(--bg-elevated)] rounded-xl p-6 text-center">
          <Loader2 size={24} className="text-[var(--accent)] mx-auto mb-3 animate-spin" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">Waiting for admin to start the auction...</p>
          <p className="text-[10px] text-[var(--text-muted)] mt-1">You'll be redirected automatically when it begins.</p>
        </div>
      )}
    </div>
  );
}
