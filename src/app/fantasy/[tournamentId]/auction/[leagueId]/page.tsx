'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import {
  onAuctionStateUpdate,
  onFantasyLeagueUpdate,
  placeBid,
  passOnPlayer,
  soldAndNext,
  pauseAuction,
  resumeAuction,
  endAuctionEarly,
  skipCurrentSet,
  useHold,
  removePlayerFromTeam,
  toggleSelectionPick,
  confirmSelectionPicks,
  completeSelectionPhase,
} from '@/lib/fantasy-firestore';
import type { FantasyLeague, AuctionState, AuctionPlayer, PlayerRole, AuctionRules, AuctionLogEntry } from '@/types/fantasy';
import { AUCTION_SETS, AUCTION_SET_ORDER, DEFAULT_AUCTION_RULES } from '@/types/fantasy';
import { getFantasyPlayerPool } from '@/lib/fantasy-players';
import {
  Gavel,
  Timer,
  StopCircle,
  Zap,
  Users,
  ArrowUp,
  XCircle,
  Pause,
  Play,
  SkipForward,
  Crown,
  Shield,
  Loader2,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Trash2,
  MessageSquare,
  ScrollText,
  ChevronsRight,
  Hand,
  ListChecks,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ─── Role colors ───
const ROLE_COLORS: Record<PlayerRole, { dark: string; light: string }> = {
  WK: { dark: 'bg-amber-500/20 text-amber-400 border-amber-500/30', light: 'bg-amber-100 text-amber-700 border-amber-300' },
  BAT: { dark: 'bg-blue-500/20 text-blue-400 border-blue-500/30', light: 'bg-blue-100 text-blue-700 border-blue-300' },
  AR: { dark: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', light: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  BOWL: { dark: 'bg-purple-500/20 text-purple-400 border-purple-500/30', light: 'bg-purple-100 text-purple-700 border-purple-300' },
};

const ROLE_LABELS: Record<PlayerRole, string> = {
  WK: 'Wicket-keeper',
  BAT: 'Batsman',
  AR: 'All-rounder',
  BOWL: 'Bowler',
};

export default function AuctionRoomPage() {
  const params = useParams();
  const router = useRouter();
  const tournamentId = params.tournamentId as string;
  const leagueId = params.leagueId as string;
  const { user, profile, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [auction, setAuction] = useState<AuctionState | null>(null);
  const [league, setLeague] = useState<FantasyLeague | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidding, setBidding] = useState(false);
  const [passing, setPassing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showBudgets, setShowBudgets] = useState(false);
  const [showSold, setShowSold] = useState(false);
  const [showBidHistory, setShowBidHistory] = useState(false);
  const [showAuctionLog, setShowAuctionLog] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [showAdminLog, setShowAdminLog] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ playerId: string; playerName: string; ownerId: string; ownerName: string } | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [removing, setRemoving] = useState(false);
  const [expandedBudgetUser, setExpandedBudgetUser] = useState<string | null>(null);
  const [confirmSkipSet, setConfirmSkipSet] = useState(false);
  const [skippingSet, setSkippingSet] = useState(false);
  const [holding, setHolding] = useState(false);

  // ─── Animation states ───
  const [newSetAnim, setNewSetAnim] = useState<{ label: string; basePrice: number } | null>(null);
  const [soldAnim, setSoldAnim] = useState<{ playerName: string; price: number; buyerName: string; role: PlayerRole } | null>(null);
  const [playerEntryKey, setPlayerEntryKey] = useState(0); // bumped on each new player for card entrance anim

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const sellingRef = useRef(false); // guard against duplicate soldAndNext calls
  const prevSetRef = useRef<string | null>(null);
  const prevSoldCountRef = useRef<number>(0);
  const prevPlayerIdRef = useRef<string | null>(null);

  // ─── Real-time listeners ───
  useEffect(() => {
    if (authLoading || !user) return;
    const unsubs: (() => void)[] = [];

    unsubs.push(onAuctionStateUpdate(leagueId, (state) => {
      setAuction(state);
      setLoading(false);
    }));

    unsubs.push(onFantasyLeagueUpdate(leagueId, setLeague));

    return () => unsubs.forEach(u => u());
  }, [leagueId, authLoading, user]);

  // ─── Detect set change → show new set animation ───
  useEffect(() => {
    if (!auction?.currentSet || auction.status !== 'live') return;
    const setKey = auction.currentSet;
    if (prevSetRef.current !== null && prevSetRef.current !== setKey) {
      const config = AUCTION_SETS[setKey];
      if (config) {
        setNewSetAnim({ label: config.label, basePrice: config.basePrice });
        const t = setTimeout(() => setNewSetAnim(null), 1800);
        return () => clearTimeout(t);
      }
    }
    prevSetRef.current = setKey;
  }, [auction?.currentSet, auction?.status]);

  // ─── Detect sold event → show sold animation ───
  useEffect(() => {
    if (!auction) return;
    const soldCount = auction.soldPlayers.length;
    if (prevSoldCountRef.current > 0 && soldCount > prevSoldCountRef.current) {
      const lastSold = auction.soldPlayers[soldCount - 1];
      if (lastSold) {
        setSoldAnim({
          playerName: lastSold.playerName,
          price: lastSold.soldPrice,
          buyerName: lastSold.boughtByName || 'Unknown',
          role: lastSold.role,
        });
        const t = setTimeout(() => setSoldAnim(null), 1200);
        prevSoldCountRef.current = soldCount;
        return () => clearTimeout(t);
      }
    }
    prevSoldCountRef.current = soldCount;
  }, [auction?.soldPlayers.length]);

  // ─── Detect new player → bump entry key for card animation ───
  useEffect(() => {
    if (!auction?.currentPlayer) return;
    const pid = auction.currentPlayer.playerId;
    if (prevPlayerIdRef.current !== null && prevPlayerIdRef.current !== pid) {
      setPlayerEntryKey(k => k + 1);
    }
    prevPlayerIdRef.current = pid;
  }, [auction?.currentPlayer?.playerId]);

  // ─── Derived state ───
  const isAdmin = league?.createdBy === user?.uid;
  const isAdminRef = useRef(isAdmin);
  isAdminRef.current = isAdmin;

  // ─── Countdown timer ───
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (!auction?.timerEndsAt || auction.status !== 'live') {
      setTimeLeft(0);
      return;
    }

    const tick = () => {
      const endTime = new Date(auction.timerEndsAt!).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0 && isAdminRef.current && !sellingRef.current) {
        sellingRef.current = true;
        soldAndNext(leagueId)
          .catch(console.error)
          .finally(() => { sellingRef.current = false; });
      }
    };

    tick();
    timerRef.current = setInterval(tick, 200);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [auction?.timerEndsAt, auction?.status, leagueId]);
  const myBudget = auction?.budgets[user?.uid || ''];
  const hasPassed = auction?.passedUserIds.includes(user?.uid || '') ?? false;
  const isHighestBidder = auction?.currentBidderId === user?.uid;
  const nextBidAmount = auction ? auction.currentBid + auction.bidIncrement : 0;
  const rules: AuctionRules = auction?.rules || DEFAULT_AUCTION_RULES;

  // Pre-group sold players by buyer for O(1) lookups
  const soldByUser = useMemo(() => {
    const map = new Map<string, typeof auction extends null ? never : NonNullable<typeof auction>['soldPlayers']>();
    if (!auction) return map;
    for (const p of auction.soldPlayers) {
      const arr = map.get(p.boughtBy);
      if (arr) arr.push(p);
      else map.set(p.boughtBy, [p]);
    }
    return map;
  }, [auction]);

  const myPlayers = useMemo(() => {
    if (!user) return [];
    return soldByUser.get(user.uid) || [];
  }, [soldByUser, user]);

  // My squad composition stats
  const mySquadStats = useMemo(() => {
    const stats = { WK: 0, BAT: 0, AR: 0, BOWL: 0, foreign: 0, total: 0 };
    for (const p of myPlayers) {
      stats[p.role]++;
      if (p.isForeign) stats.foreign++;
      stats.total++;
    }
    return stats;
  }, [myPlayers]);

  // Check if bidding on current player would violate foreign limit
  const currentPlayerForeignBlock = useMemo(() => {
    if (!auction?.currentPlayer) return false;
    return auction.currentPlayer.isForeign && mySquadStats.foreign >= rules.maxForeignPlayers;
  }, [auction?.currentPlayer, mySquadStats.foreign, rules.maxForeignPlayers]);

  // Remaining slots needed for each role
  const slotsRemaining = useMemo(() => {
    if (!auction) return null;
    const slotsLeft = (auction.maxSquadSize) - mySquadStats.total;
    const minNeeded = {
      WK: Math.max(0, rules.minWK - mySquadStats.WK),
      BAT: Math.max(0, rules.minBAT - mySquadStats.BAT),
      AR: Math.max(0, rules.minAR - mySquadStats.AR),
      BOWL: Math.max(0, rules.minBOWL - mySquadStats.BOWL),
    };
    const totalMinNeeded = minNeeded.WK + minNeeded.BAT + minNeeded.AR + minNeeded.BOWL;
    return { slotsLeft, minNeeded, totalMinNeeded };
  }, [auction, mySquadStats, rules]);

  // Check if bidding on current player would make it impossible to meet role minimums
  // e.g. 3 slots left, need 3 bowlers still → can only bid on bowlers
  const roleBlock = useMemo(() => {
    if (!auction?.currentPlayer || !slotsRemaining) return null;
    const { slotsLeft, minNeeded, totalMinNeeded } = slotsRemaining;
    const role = auction.currentPlayer.role;
    const roleStillNeeded = minNeeded[role] > 0;

    // If all remaining slots are needed for unfulfilled minimums
    // and this player's role doesn't need filling, block
    if (slotsLeft <= totalMinNeeded && !roleStillNeeded) {
      // Figure out which roles are still needed for the warning
      const neededRoles = (['WK', 'BAT', 'AR', 'BOWL'] as const).filter(r => minNeeded[r] > 0);
      return {
        blocked: true,
        reason: `Must save ${slotsLeft} remaining slot${slotsLeft !== 1 ? 's' : ''} for: ${neededRoles.map(r => `${minNeeded[r]} ${r}`).join(', ')}`,
      };
    }

    return null;
  }, [auction?.currentPlayer, slotsRemaining]);

  const canBid = auction?.status === 'live' &&
    !hasPassed &&
    !isHighestBidder &&
    myBudget &&
    nextBidAmount <= myBudget.remaining &&
    (myBudget.playerCount < auction.maxSquadSize) &&
    !currentPlayerForeignBlock &&
    !roleBlock;

  // Hold tracking
  const myHoldsUsed = (auction?.holdsUsed || {})[user?.uid || ''] || 0;
  const maxHolds = rules.holdsPerPlayer ?? 5;
  const holdsLeft = maxHolds - myHoldsUsed;
  const canHold = auction?.status === 'live' && holdsLeft > 0 && !hasPassed;

  // All active bidders (haven't passed and have budget)
  const activeBidders = useMemo(() => {
    if (!auction || !league) return 0;
    return league.memberUids.filter(uid => {
      if (auction.passedUserIds.includes(uid)) return false;
      const budget = auction.budgets[uid];
      if (!budget) return false;
      if (budget.playerCount >= auction.maxSquadSize) return false;
      return true;
    }).length;
  }, [auction, league]);

  // ─── Bid handler ───
  const handleBid = async () => {
    if (!user || !profile || !canBid || !auction) return;
    setBidding(true);
    try {
      await placeBid(
        leagueId,
        user.uid,
        profile.displayName || profile.username || 'User',
        nextBidAmount
      );
    } catch (err: any) {
      console.error('Bid failed:', err.message);
    } finally {
      setBidding(false);
    }
  };

  // ─── Pass handler ───
  const handlePass = async () => {
    if (!user || hasPassed) return;
    setPassing(true);
    try {
      await passOnPlayer(leagueId, user.uid);
    } catch (err) {
      console.error('Pass failed:', err);
    } finally {
      setPassing(false);
    }
  };

  // ─── Hold handler ───
  const handleHold = async () => {
    if (!user || !canHold) return;
    setHolding(true);
    try {
      await useHold(leagueId, user.uid);
    } catch (err: any) {
      console.error('Hold failed:', err.message);
    } finally {
      setHolding(false);
    }
  };

  // ─── Admin remove player handler ───
  const handleRemovePlayer = async () => {
    if (!removeTarget || !user || !profile || !isAdmin) return;
    setRemoving(true);
    try {
      await removePlayerFromTeam(
        leagueId,
        removeTarget.playerId,
        user.uid,
        profile.displayName || profile.username || 'Admin',
        removeReason.trim() || undefined
      );
      setRemoveTarget(null);
      setRemoveReason('');
    } catch (err: any) {
      console.error('Remove failed:', err.message);
    } finally {
      setRemoving(false);
    }
  };

  // Audit log entries
  const auctionLog: AuctionLogEntry[] = auction?.auctionLog || [];

  // ─── Loading / auth states ───
  if (loading || authLoading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Loader2 size={32} className="text-[var(--accent)] mx-auto animate-spin mb-3" />
        <p className="text-sm text-[var(--text-muted)]">Connecting to auction room...</p>
      </div>
    );
  }

  if (!auction || !league) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Gavel size={40} className="text-[var(--text-muted)] mx-auto mb-3" />
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Auction not found</h2>
      </div>
    );
  }

  // ─── SELECTION PHASE — pick from unsold players ───
  if (auction.status === 'selection') {
    const uid = user?.uid || '';
    const userBudget = auction.budgets[uid];
    const spotsLeft = userBudget ? auction.maxSquadSize - userBudget.playerCount : 0;
    const selMaxPicks = spotsLeft * 4;
    const myPicks: string[] = auction.selectionPicks?.[uid] || [];
    const atLimit = selMaxPicks > 0 && myPicks.length >= selMaxPicks;
    const hasConfirmed = auction.selectionConfirmed?.includes(uid) ?? false;
    const allConfirmed = league.memberUids.every(
      (m: string) => auction.selectionConfirmed?.includes(m) || (auction.budgets[m]?.playerCount ?? 0) >= auction.maxSquadSize
    );

    // How many of each role the user still needs (based on minimums)
    const roleSpotsNeeded: Record<PlayerRole, number> = {
      WK: Math.max(0, (rules.minWK || 0) - mySquadStats.WK),
      BAT: Math.max(0, (rules.minBAT || 0) - mySquadStats.BAT),
      AR: Math.max(0, (rules.minAR || 0) - mySquadStats.AR),
      BOWL: Math.max(0, (rules.minBOWL || 0) - mySquadStats.BOWL),
    };
    // Count how many of each role the user has picked so far (for minimum validation)
    const pickedRoleCounts: Record<PlayerRole, number> = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
    // Collect ALL unique unsold players grouped by role, sub-grouped by set tier
    const unsoldByRole: Record<PlayerRole, AuctionPlayer[]> = { WK: [], BAT: [], AR: [], BOWL: [] };
    // Build lookup: playerOrder + full pool fallback (ensures ALL unsold players are found)
    const playerOrderMap = new Map<string, AuctionPlayer>();
    for (const p of auction.playerOrder) playerOrderMap.set(p.playerId, p);
    // Fallback: build AuctionPlayer entries from the full fantasy pool for any missing players
    const fullPool = getFantasyPlayerPool();
    const poolByRole = new Map<string, typeof fullPool>();
    for (const fp of fullPool) {
      const arr = poolByRole.get(fp.role);
      if (arr) arr.push(fp);
      else poolByRole.set(fp.role, [fp]);
    }
    const roleRankMap = new Map<string, number>();
    for (const [, rolePlayers] of poolByRole) {
      rolePlayers.sort((a, b) => b.price - a.price);
      rolePlayers.forEach((p, i) => roleRankMap.set(p.id, i));
    }
    for (const fp of fullPool) {
      if (!playerOrderMap.has(fp.id)) {
        const idx = roleRankMap.get(fp.id) ?? 99;
        const tier = idx < 10 ? 'marquee' : idx < 20 ? 'set2' : 'set3';
        const setKey = `${tier}_${fp.role.toLowerCase()}` as keyof typeof AUCTION_SETS;
        const setConfig = AUCTION_SETS[setKey];
        playerOrderMap.set(fp.id, {
          playerId: fp.id,
          name: fp.name,
          team: fp.team,
          teamShort: fp.teamShort,
          role: fp.role,
          isForeign: fp.isForeign,
          set: setKey,
          basePrice: setConfig?.basePrice ?? 0.5,
          order: 0,
        });
      }
    }

    const seenUnsold = new Set<string>();
    for (const pid of auction.unsoldPlayers) {
      if (seenUnsold.has(pid)) continue;
      seenUnsold.add(pid);
      const p = playerOrderMap.get(pid);
      if (p) unsoldByRole[p.role].push(p);
    }
    // Sort within each role: marquee first, then set2, then set3
    const SET_TIER_ORDER: Record<string, number> = {};
    for (let i = 0; i < AUCTION_SET_ORDER.length; i++) SET_TIER_ORDER[AUCTION_SET_ORDER[i]] = i;
    for (const role of ['WK', 'BAT', 'AR', 'BOWL'] as PlayerRole[]) {
      unsoldByRole[role].sort((a, b) => (SET_TIER_ORDER[a.set] ?? 99) - (SET_TIER_ORDER[b.set] ?? 99));
    }

    // Populate picked role counts now that playerOrderMap is ready
    for (const pid of myPicks) {
      const p = playerOrderMap.get(pid);
      if (p) pickedRoleCounts[p.role]++;
    }

    return (
      <div className="mx-auto max-w-lg px-4 py-4 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-blue-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-[var(--accent)]/30">
            <ListChecks size={26} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">Pick for Re-Auction</h2>
          <p className="text-xs text-[var(--text-muted)]">
            {spotsLeft > 0
              ? 'Select unsold players you want re-auctioned'
              : 'Your squad is full — you can still nominate players for others!'}
          </p>
        </div>

        {/* Confirmation status */}
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--bg-elevated)] mb-3 text-[10px]">
          <span className="text-[var(--text-muted)]">
            {auction.selectionConfirmed?.length || 0}/{league.memberUids.length} confirmed
          </span>
          <span className="font-bold text-[var(--text-secondary)]">
            {myPicks.length}/{selMaxPicks} nominated
          </span>
        </div>

        {/* Role minimums checklist — shows picked / needed per role */}
        {spotsLeft > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--bg-elevated)] mb-3 flex-wrap">
            <span className="text-[9px] text-[var(--text-muted)] font-semibold mr-1">Min:</span>
            {(['WK', 'BAT', 'AR', 'BOWL'] as PlayerRole[]).map(r => {
              const need = roleSpotsNeeded[r];
              if (need <= 0) {
                return (
                  <span key={r} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">
                    ✓ {r}
                  </span>
                );
              }
              const picked = pickedRoleCounts[r];
              const met = picked >= need;
              return (
                <span key={r} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  met ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {picked}/{need} {r}
                </span>
              );
            })}
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ml-auto ${
              spotsLeft <= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {spotsLeft} spots left
            </span>
          </div>
        )}

        {hasConfirmed || spotsLeft <= 0 ? (
          <div className="text-center py-8">
            <UserCheck size={32} className="text-[var(--success)] mx-auto mb-2" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {spotsLeft <= 0 ? 'Squad full!' : 'Picks confirmed!'}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Waiting for others to confirm...</p>

            {/* Admin: start re-auction */}
            {isAdmin && (
              <Button
                onClick={() => completeSelectionPhase(leagueId)}
                className="mt-4 bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent-hover)] gap-2"
                disabled={!allConfirmed}
              >
                <Gavel size={16} />
                {allConfirmed ? 'Start Re-Auction' : 'Waiting for all...'}
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* ─── All Squads overview ─── */}
            <details className="mb-3 group">
              <summary className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--bg-elevated)] text-xs font-semibold text-[var(--text-secondary)] cursor-pointer list-none">
                <span>All Squads</span>
                <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-1 mt-1.5">
                {Object.entries(auction.budgets)
                  .sort(([a], [b]) => (a === uid ? -1 : b === uid ? 1 : 0))
                  .map(([mUid, budget]) => {
                    const memberInfo = league?.members?.[mUid];
                    const isMe = mUid === uid;
                    const mPlayersRaw = soldByUser.get(mUid) || [];
                    const mSeenIds = new Set<string>();
                    const mPlayers = mPlayersRaw.filter(p => { if (mSeenIds.has(p.playerId)) return false; mSeenIds.add(p.playerId); return true; });
                    const mSpotsLeft = auction.maxSquadSize - budget.playerCount;
                    const mRoleStats: Record<string, number> = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
                    for (const p of mPlayers) mRoleStats[p.role]++;
                    const confirmed = auction.selectionConfirmed?.includes(mUid);

                    return (
                      <details key={mUid} className="group/user">
                        <summary className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer list-none ${
                          isMe ? 'bg-[var(--accent)]/10' : 'bg-[var(--bg-elevated)]'
                        }`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <ChevronDown size={10} className="text-[var(--text-muted)] shrink-0 transition-transform group-open/user:rotate-180" />
                            <span className="text-xs text-[var(--text-primary)] truncate">
                              {memberInfo?.displayName || 'User'}
                            </span>
                            {isMe && <span className="text-[9px] text-[var(--accent)]">(you)</span>}
                            {confirmed && <Check size={10} className="text-[var(--success)] shrink-0" />}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[9px] text-[var(--text-muted)]">
                              {budget.playerCount}/{auction.maxSquadSize}
                            </span>
                            <span className="text-[10px] font-bold text-[var(--accent)]">{budget.remaining.toFixed(1)} Cr</span>
                          </div>
                        </summary>
                        <div className="ml-4 mt-1 mb-1.5 space-y-0.5">
                          {/* Role breakdown */}
                          <div className="flex gap-1.5 px-2 py-1">
                            {(['WK', 'BAT', 'AR', 'BOWL'] as PlayerRole[]).map(r => {
                              const minKey = `min${r}` as keyof AuctionRules;
                              const minVal = (rules[minKey] as number) || 0;
                              const met = mRoleStats[r] >= minVal;
                              return (
                                <span key={r} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  met ? 'bg-[var(--bg-card)] text-[var(--text-muted)]' : 'bg-red-500/10 text-red-400'
                                }`}>
                                  {mRoleStats[r]}/{minVal} {r}
                                </span>
                              );
                            })}
                          </div>
                          {mPlayers.length > 0 ? mPlayers.map(p => (
                            <div key={p.playerId} className="flex items-center justify-between px-2.5 py-1 rounded-md bg-[var(--bg-card)]">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Badge className={`text-[7px] font-bold px-1 py-0 border ${isLight ? ROLE_COLORS[p.role].light : ROLE_COLORS[p.role].dark}`}>
                                  {p.role}
                                </Badge>
                                <span className="text-[11px] text-[var(--text-primary)] truncate">{p.playerName}</span>
                                <span className="text-[9px] text-[var(--text-muted)]">{p.teamShort}</span>
                                {p.isForeign && <span className="text-[8px]">✈</span>}
                              </div>
                              <span className="text-[10px] font-bold text-[var(--accent)] shrink-0">{p.soldPrice} Cr</span>
                            </div>
                          )) : (
                            <div className="px-2.5 py-1.5 rounded-md bg-[var(--bg-card)] text-[10px] text-[var(--text-muted)]">
                              No players yet
                            </div>
                          )}
                          {mSpotsLeft > 0 && (
                            <div className="px-2 text-[9px] text-[var(--text-muted)]">
                              {mSpotsLeft} spot{mSpotsLeft !== 1 ? 's' : ''} remaining
                            </div>
                          )}
                        </div>
                      </details>
                    );
                  })}
              </div>
            </details>

            {/* Unsold players grouped by role, sub-grouped by set tier */}
            {(['WK', 'BAT', 'AR', 'BOWL'] as PlayerRole[]).map(role => {
              const players = unsoldByRole[role];
              if (players.length === 0) return null;

              // Sub-group by set tier (marquee / set2 / set3)
              const byTier: { tier: string; label: string; players: AuctionPlayer[] }[] = [];
              const tierMap: Record<string, AuctionPlayer[]> = {};
              for (const p of players) {
                const tierKey = AUCTION_SETS[p.set]?.tier || 'set3';
                if (!tierMap[tierKey]) tierMap[tierKey] = [];
                tierMap[tierKey].push(p);
              }
              for (const tier of ['marquee', 'set2', 'set3']) {
                if (tierMap[tier]?.length) {
                  byTier.push({
                    tier,
                    label: tier === 'marquee' ? 'Marquee' : tier === 'set2' ? 'Set 2' : 'Set 3',
                    players: tierMap[tier],
                  });
                }
              }

              return (
                <div key={role} className="mb-4">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Badge className={`text-[9px] font-bold px-1.5 py-0.5 border ${isLight ? ROLE_COLORS[role].light : ROLE_COLORS[role].dark}`}>
                      {role}
                    </Badge>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {ROLE_LABELS[role]} — {players.length} available
                      {roleSpotsNeeded[role] > 0 && (
                        <span className="text-red-400 font-semibold"> (min {roleSpotsNeeded[role]} required)</span>
                      )}
                    </span>
                  </div>
                  {byTier.map(({ tier, label, players: tierPlayers }) => (
                    <div key={tier} className="mb-2">
                      <div className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 mb-1 rounded ${
                        tier === 'marquee'
                          ? 'text-yellow-500 bg-yellow-500/10'
                          : tier === 'set2'
                            ? 'text-blue-400 bg-blue-500/10'
                            : 'text-[var(--text-muted)] bg-[var(--bg-card)]'
                      }`}>
                        {label} ({tierPlayers.length})
                      </div>
                      <div className="space-y-1">
                        {tierPlayers.map(p => {
                          const isPicked = myPicks.includes(p.playerId);
                          const disabled = !isPicked && atLimit;
                          return (
                            <button
                              key={p.playerId}
                              disabled={disabled}
                              onClick={async () => {
                                if (!user || !profile) return;
                                try {
                                  await toggleSelectionPick(leagueId, user.uid, profile.displayName || profile.username || 'User', p.playerId);
                                } catch (err: any) { console.error(err.message); }
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
                                isPicked
                                  ? 'bg-[var(--accent)]/15 border-2 border-[var(--accent)]/50'
                                  : disabled
                                    ? 'bg-[var(--bg-elevated)] border-2 border-transparent opacity-40 cursor-not-allowed'
                                    : 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-card)] border-2 border-transparent hover:border-[var(--accent)]/20'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {isPicked && <Check size={13} className="text-[var(--accent)] shrink-0" />}
                                <span className={`text-xs truncate ${isPicked ? 'font-bold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                  {p.name}
                                </span>
                                <span className="text-[10px] text-[var(--text-muted)]">{p.teamShort}</span>
                                {p.isForeign && <span className="text-[9px]">✈</span>}
                              </div>
                              <span className="text-[10px] font-semibold text-[var(--text-muted)] shrink-0">{p.basePrice} Cr</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Confirm picks for re-auction */}
            {(() => {
              const unmetRoles: { role: PlayerRole; need: number; picked: number }[] = [];
              for (const r of ['WK', 'BAT', 'AR', 'BOWL'] as PlayerRole[]) {
                if (roleSpotsNeeded[r] > 0 && pickedRoleCounts[r] < roleSpotsNeeded[r]) {
                  unmetRoles.push({ role: r, need: roleSpotsNeeded[r], picked: pickedRoleCounts[r] });
                }
              }
              const canConfirm = unmetRoles.length === 0;

              return (
                <>
                  <Button
                    onClick={async () => {
                      if (user && profile) {
                        await confirmSelectionPicks(leagueId, user.uid, profile.displayName || profile.username || 'User');
                      }
                    }}
                    disabled={!canConfirm}
                    className={`w-full mt-3 font-bold gap-2 h-12 text-base ${
                      canConfirm
                        ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shadow-lg shadow-[var(--accent)]/30'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] cursor-not-allowed opacity-60'
                    }`}
                  >
                    <Check size={18} />
                    Confirm {myPicks.length > 0 ? `${myPicks.length} Pick${myPicks.length !== 1 ? 's' : ''}` : '(No Picks)'}
                  </Button>
                  {!canConfirm && (
                    <p className="text-[10px] text-red-400 text-center mt-1.5">
                      Pick at least {unmetRoles.map(u => `${u.need - u.picked} more ${u.role}`).join(', ')} to confirm
                    </p>
                  )}
                  {canConfirm && (
                    <p className="text-[10px] text-[var(--text-muted)] text-center mt-1.5">
                      Selected players will be re-auctioned once everyone confirms.
                    </p>
                  )}
                </>
              );
            })()}
          </>
        )}

        {/* My budget info */}
        {userBudget && (
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-[var(--text-muted)]">
            <span><Zap size={12} className="inline text-[var(--accent)]" /> {userBudget.remaining.toFixed(1)} Cr left</span>
            <span><Users size={12} className="inline" /> {userBudget.playerCount}/{auction.maxSquadSize} players</span>
          </div>
        )}
      </div>
    );
  }

  // Auction completed — redirect to league page
  if (auction.status === 'completed') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Gavel size={28} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold gradient-text mb-2">Auction Complete!</h2>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          {auction.soldPlayers.length} players sold, {new Set(auction.unsoldPlayers).size} unsold
        </p>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          You bought {myPlayers.length} players for {myBudget?.spent.toFixed(1)} Cr
        </p>
        <Button
          onClick={() => router.push(`/fantasy/${tournamentId}/league/${leagueId}`)}
          className="bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent-hover)] gap-2"
        >
          <Shield size={16} />
          View Results
        </Button>
      </div>
    );
  }

  // ─── LIVE AUCTION ROOM ───
  const currentPlayer = auction.currentPlayer;
  const currentSetConfig = auction.currentSet ? AUCTION_SETS[auction.currentSet] : null;
  const progress = auction.playerOrder.length > 0
    ? ((auction.currentIndex + 1) / auction.playerOrder.length) * 100
    : 0;

  return (
    <div className="mx-auto max-w-lg px-4 py-4 animate-fade-in relative">
      {/* ─── Inline keyframes ─── */}
      <style>{`
        @keyframes auc-card-enter {
          0% { opacity: 0; transform: translateY(24px) scale(0.96); }
          60% { opacity: 1; transform: translateY(-3px) scale(1.01); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes auc-incard-sold {
          0% { opacity: 0; transform: scale(0.9); }
          15% { opacity: 1; transform: scale(1.04); }
          30% { transform: scale(1); }
          75% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes auc-incard-set {
          0% { opacity: 0; transform: scale(0.9); }
          12% { opacity: 1; transform: scale(1.03); }
          25% { transform: scale(1); }
          78% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes auc-sold-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        .auc-card-enter { animation: auc-card-enter 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        .auc-incard-sold { animation: auc-incard-sold 1.2s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        .auc-incard-set { animation: auc-incard-set 1.8s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        .auc-sold-bounce { animation: auc-sold-pulse 0.35s cubic-bezier(0.22, 1, 0.36, 1); }
      `}</style>

      {/* Header bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Gavel size={18} className="text-[var(--accent)]" />
          <span className="text-sm font-bold text-[var(--text-primary)]">{league.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {auction.status === 'paused' && (
            <Badge className="bg-[var(--warning)]/15 text-[var(--warning)] border-0 text-[10px]">Paused</Badge>
          )}
          <span className="text-[10px] text-[var(--text-muted)]">
            {auction.currentIndex + 1}/{auction.playerOrder.length}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-[var(--bg-elevated)] mb-4 overflow-hidden">
        <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* Current Set label */}
      {currentSetConfig && (
        <div className="text-center mb-3">
          <Badge className="bg-[var(--accent)]/15 text-[var(--accent)] border-0 text-xs font-bold">
            {currentSetConfig.label} — Base {currentSetConfig.basePrice} Cr
          </Badge>
        </div>
      )}

      {/* ─── PLAYER CARD ─── */}
      {currentPlayer && (
        <Card key={playerEntryKey} className="auc-card-enter mb-4 border-2 border-[var(--accent)]/30 bg-gradient-to-b from-[var(--accent)]/5 to-transparent overflow-hidden relative">
          {/* ── In-card: Sold animation ── */}
          {soldAnim && (
            <div className="auc-incard-sold absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-[var(--bg-card)]/95 backdrop-blur-sm">
              <div className="auc-sold-bounce text-3xl font-black text-[var(--accent)] tracking-tight mb-1">SOLD!</div>
              <div className="text-base font-bold text-[var(--text-primary)]">{soldAnim.playerName}</div>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge className={`text-[9px] font-bold px-1.5 py-0.5 border ${isLight ? ROLE_COLORS[soldAnim.role].light : ROLE_COLORS[soldAnim.role].dark}`}>
                  {soldAnim.role}
                </Badge>
                <span className="text-xl font-black text-[var(--accent)]">{soldAnim.price.toFixed(2)} Cr</span>
              </div>
              <div className="text-xs text-[var(--text-secondary)] mt-1.5 flex items-center gap-1">
                <Crown size={11} className="text-yellow-500" />
                {soldAnim.buyerName}
              </div>
            </div>
          )}

          {/* ── In-card: New Set animation ── */}
          {newSetAnim && !soldAnim && (
            <div className="auc-incard-set absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-[var(--bg-card)]/95 backdrop-blur-sm">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--accent)] to-purple-500 flex items-center justify-center mb-2 shadow-lg shadow-[var(--accent)]/30">
                <Gavel size={22} className="text-white" />
              </div>
              <div className="text-[10px] uppercase tracking-[0.25em] font-bold text-[var(--accent)] mb-1">New Set</div>
              <div className="text-lg font-black text-[var(--text-primary)]">{newSetAnim.label}</div>
              <div className="text-sm font-semibold text-[var(--text-secondary)] mt-0.5">Base Price: {newSetAnim.basePrice} Cr</div>
            </div>
          )}

          <CardContent className="p-5 text-center">
            {/* Player avatar placeholder */}
            <div className="w-20 h-20 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)] mx-auto mb-3 flex items-center justify-center">
              <span className="text-2xl font-bold text-[var(--text-muted)]">
                {currentPlayer.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </span>
            </div>

            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">
              {currentPlayer.name}
            </h2>

            <div className="flex items-center justify-center gap-2 mb-3">
              <Badge className={`text-[10px] font-bold px-2 py-0.5 border ${isLight ? ROLE_COLORS[currentPlayer.role].light : ROLE_COLORS[currentPlayer.role].dark}`}>
                {ROLE_LABELS[currentPlayer.role]}
              </Badge>
              <span className="text-xs text-[var(--text-muted)]">{currentPlayer.team}</span>
              {currentPlayer.isForeign && (
                <Badge className="bg-orange-500/15 text-orange-400 border-0 text-[9px] flex items-center gap-0.5">
                  ✈ Overseas
                </Badge>
              )}
            </div>

            {/* Foreign limit warning */}
            {currentPlayerForeignBlock && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center gap-2">
                <AlertTriangle size={14} className="text-red-400" />
                <span className="text-xs text-red-400 font-semibold">
                  Overseas limit reached ({mySquadStats.foreign}/{rules.maxForeignPlayers})
                </span>
              </div>
            )}

            {/* Role minimum block warning */}
            {!currentPlayerForeignBlock && roleBlock && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center gap-2">
                <AlertTriangle size={14} className="text-orange-400" />
                <span className="text-xs text-orange-400 font-semibold">
                  {roleBlock.reason}
                </span>
              </div>
            )}

            {/* Current bid */}
            <div className="bg-[var(--bg-elevated)] rounded-xl p-4 mb-4">
              <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">
                {auction.currentBidderId ? 'Current Bid' : 'Base Price'}
              </div>
              <div className="text-4xl font-black text-[var(--accent)]">
                {auction.currentBid.toFixed(2)} <span className="text-base font-semibold">Cr</span>
              </div>
              {auction.currentBidderName && (
                <div className="text-xs text-[var(--text-secondary)] mt-1 flex items-center justify-center gap-1">
                  <Crown size={10} className="text-yellow-500" />
                  {auction.currentBidderName}
                  {isHighestBidder && <span className="text-[var(--accent)]">(You!)</span>}
                </div>
              )}
            </div>

            {/* Bid history for current player */}
            {auction.bidHistory.length > 0 && (
              <div className="mb-4">
                <button
                  onClick={() => setShowBidHistory(!showBidHistory)}
                  className="flex items-center justify-center gap-1.5 mx-auto text-[10px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  {showBidHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {auction.bidHistory.length} bid{auction.bidHistory.length !== 1 ? 's' : ''}
                </button>
                {showBidHistory && (
                  <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                    {[...auction.bidHistory].reverse().map((bid, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between px-2.5 py-1 rounded-md text-[10px] ${
                          i === 0 ? 'bg-[var(--accent)]/10' : 'bg-[var(--bg-card)]'
                        }`}
                      >
                        <span className={`font-semibold ${
                          bid.userId === user?.uid ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
                        }`}>
                          {bid.userName}{bid.userId === user?.uid ? ' (you)' : ''}
                        </span>
                        <span className="font-bold text-[var(--text-primary)]">{bid.amount.toFixed(2)} Cr</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Timer — show full duration while sold/set animation is playing */}
            {(() => {
              const animActive = !!(soldAnim || newSetAnim);
              const display = animActive ? auction.timerDuration : timeLeft;
              return (
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-4 ${
                  animActive
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                    : timeLeft <= 5
                      ? 'bg-red-500/15 text-red-400 animate-pulse'
                      : timeLeft <= 10
                        ? 'bg-[var(--warning)]/15 text-[var(--warning)]'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                }`}>
                  <Timer size={14} />
                  {display}s
                </div>
              );
            })()}

            {/* Bid actions */}
            <div className="flex gap-2">
              {!hasPassed && !isHighestBidder && auction.status === 'live' && (
                <>
                  <Button
                    onClick={handleBid}
                    disabled={!canBid || bidding}
                    className="flex-1 bg-[var(--accent)] text-white font-bold hover:bg-[var(--accent-hover)] gap-2 h-12 text-base shadow-lg shadow-[var(--accent)]/30 disabled:opacity-50"
                  >
                    {bidding ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : currentPlayerForeignBlock ? (
                      <>
                        <AlertTriangle size={18} />
                        Overseas Limit
                      </>
                    ) : roleBlock ? (
                      <>
                        <AlertTriangle size={18} />
                        Slots Reserved
                      </>
                    ) : (
                      <>
                        <ArrowUp size={18} />
                        Bid {nextBidAmount.toFixed(2)} Cr
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handlePass}
                    disabled={passing}
                    variant="outline"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1.5 h-12 px-4"
                  >
                    {passing ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={16} />}
                    Pass
                  </Button>
                </>
              )}

              {hasPassed && (
                <div className="flex-1 h-12 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center text-sm text-[var(--text-muted)]">
                  You passed on this player
                </div>
              )}

              {isHighestBidder && (
                <div className="flex-1 h-12 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/30 flex items-center justify-center text-sm font-semibold text-[var(--accent)] gap-2">
                  <Check size={16} />
                  You're the highest bidder!
                </div>
              )}
            </div>

            {/* Hold button — extra thinking time */}
            {auction.status === 'live' && !hasPassed && maxHolds > 0 && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <Button
                  onClick={handleHold}
                  disabled={!canHold || holding}
                  size="sm"
                  variant="outline"
                  className="border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:border-[var(--accent)] gap-1.5 h-8 px-3 text-xs disabled:opacity-40"
                >
                  {holding ? <Loader2 size={12} className="animate-spin" /> : <Hand size={13} />}
                  Hold (+{rules.holdDuration ?? 30}s)
                </Button>
                <span className={`text-[10px] font-bold ${holdsLeft > 0 ? 'text-[var(--text-muted)]' : 'text-red-400'}`}>
                  {holdsLeft}/{maxHolds} left
                </span>
              </div>
            )}

            {/* Active bidders count */}
            <div className="mt-3 text-[10px] text-[var(--text-muted)]">
              {activeBidders} active bidder{activeBidders !== 1 ? 's' : ''} — {auction.passedUserIds.length} passed
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Admin Controls ─── */}
      {isAdmin && (
        <div className="flex gap-2 mb-4">
          {auction.status === 'live' && (
            <Button
              onClick={() => pauseAuction(leagueId)}
              size="sm"
              variant="outline"
              className="flex-1 border-[var(--warning)]/30 text-[var(--warning)] hover:bg-[var(--warning)]/10 gap-1.5"
            >
              <Pause size={14} />
              Pause
            </Button>
          )}
          {auction.status === 'paused' && (
            <Button
              onClick={() => resumeAuction(leagueId)}
              size="sm"
              className="flex-1 bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] gap-1.5"
            >
              <Play size={14} />
              Resume
            </Button>
          )}
          <Button
            onClick={() => {
              if (!sellingRef.current) {
                sellingRef.current = true;
                soldAndNext(leagueId)
                  .catch(console.error)
                  .finally(() => { sellingRef.current = false; });
              }
            }}
            size="sm"
            variant="outline"
            className="flex-1 border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] gap-1.5"
          >
            <SkipForward size={14} />
            {auction.currentBidderId ? 'Sold! Next' : 'Unsold, Next'}
          </Button>
          {!confirmSkipSet && (
            <Button
              onClick={() => setConfirmSkipSet(true)}
              size="sm"
              variant="outline"
              className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10 gap-1.5"
              title="Skip rest of this set"
            >
              <ChevronsRight size={14} />
              Skip Set
            </Button>
          )}
        </div>
      )}

      {/* Skip Set Confirmation */}
      {isAdmin && confirmSkipSet && (
        <div className="mb-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-orange-400 font-semibold">Skip remaining players in this set?</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
              {auction.currentBidderId ? 'Current bid will be sold.' : 'Current player will be unsold.'} Remaining players in {currentSetConfig?.label || 'this set'} will be marked unsold.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              onClick={async () => {
                setSkippingSet(true);
                try {
                  await skipCurrentSet(leagueId);
                } catch (err) { console.error(err); }
                finally { setSkippingSet(false); setConfirmSkipSet(false); }
              }}
              disabled={skippingSet}
              size="sm"
              className="bg-orange-500 text-white hover:bg-orange-600 gap-1 text-xs"
            >
              {skippingSet ? <Loader2 size={12} className="animate-spin" /> : <ChevronsRight size={12} />}
              Skip
            </Button>
            <Button onClick={() => setConfirmSkipSet(false)} size="sm" variant="outline" className="border-[var(--border)] text-[var(--text-muted)] text-xs">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* End Auction (admin) */}
      {isAdmin && !confirmEnd && (
        <button
          onClick={() => setConfirmEnd(true)}
          className="w-full text-center text-xs text-red-400/60 hover:text-red-400 py-2 mb-3 transition-colors"
        >
          End Auction Early
        </button>
      )}
      {isAdmin && confirmEnd && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-3">
          <p className="text-xs text-red-400">End auction now? Current bid will be sold. Remaining players become unsold.</p>
          <div className="flex gap-2 shrink-0">
            <Button
              onClick={async () => {
                setEnding(true);
                try {
                  await endAuctionEarly(leagueId);
                } catch (err) { console.error(err); }
                finally { setEnding(false); }
              }}
              disabled={ending}
              size="sm"
              className="bg-red-500 text-white hover:bg-red-600 gap-1 text-xs"
            >
              {ending ? <Loader2 size={12} className="animate-spin" /> : <StopCircle size={12} />}
              End
            </Button>
            <Button onClick={() => setConfirmEnd(false)} size="sm" variant="outline" className="border-[var(--border)] text-[var(--text-muted)] text-xs">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ─── My Budget + Squad Stats ─── */}
      {myBudget && (
        <Card className="mb-3 border border-[var(--bg-elevated)] bg-[var(--bg-card)]">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Zap size={14} className="text-[var(--accent)]" />
                  <span className="text-sm font-bold text-[var(--text-primary)]">{myBudget.remaining.toFixed(1)} Cr</span>
                  <span className="text-[10px] text-[var(--text-muted)]">left</span>
                </div>
                <div className="w-px h-4 bg-[var(--border)]" />
                <div className="flex items-center gap-1.5">
                  <Users size={12} className="text-[var(--text-muted)]" />
                  <span className="text-xs text-[var(--text-secondary)]">{myBudget.playerCount}/{auction.maxSquadSize}</span>
                </div>
              </div>
              <div className="flex-1 max-w-[100px] mx-3 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${(myBudget.spent / myBudget.total) * 100}%` }} />
              </div>
            </div>

            {/* Squad composition chips */}
            <div className="flex flex-wrap gap-1.5">
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold ${
                mySquadStats.foreign >= rules.maxForeignPlayers
                  ? 'bg-red-500/15 text-red-400'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
              }`}>
                ✈ {mySquadStats.foreign}/{rules.maxForeignPlayers} OS
              </div>
              {(['WK', 'BAT', 'AR', 'BOWL'] as PlayerRole[]).map(role => {
                const minKey = `min${role}` as keyof AuctionRules;
                const min = rules[minKey] as number;
                const current = mySquadStats[role];
                const met = current >= min;
                return (
                  <div key={role} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold ${
                    met ? 'bg-[var(--bg-elevated)] text-[var(--text-muted)]' : 'bg-orange-500/10 text-orange-400'
                  }`}>
                    {current}/{min} {role}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Collapsible: All Budgets ─── */}
      <button
        onClick={() => setShowBudgets(!showBudgets)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--bg-elevated)] mb-2 text-xs font-semibold text-[var(--text-secondary)]"
      >
        <span>All Budgets</span>
        {showBudgets ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {showBudgets && (
        <div className="space-y-1 mb-3">
          {Object.entries(auction.budgets)
            .sort(([, a], [, b]) => b.remaining - a.remaining)
            .map(([uid, budget]) => {
              const memberInfo = league?.members?.[uid];
              const isMe = uid === user?.uid;
              const userPlayers = soldByUser.get(uid) || [];
              const isExpanded = expandedBudgetUser === uid;
              return (
                <div key={uid}>
                  <button
                    onClick={() => setExpandedBudgetUser(isExpanded ? null : uid)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg ${
                      isMe ? 'bg-[var(--accent)]/10' : 'bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isExpanded ? <ChevronUp size={10} className="text-[var(--text-muted)] shrink-0" /> : <ChevronDown size={10} className="text-[var(--text-muted)] shrink-0" />}
                      <span className="text-xs text-[var(--text-primary)] truncate">
                        {memberInfo?.displayName || 'User'}
                      </span>
                      {isMe && <span className="text-[9px] text-[var(--accent)]">(you)</span>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] text-[var(--text-muted)]">{budget.playerCount} players</span>
                      <span className="text-xs font-bold text-[var(--accent)]">{budget.remaining.toFixed(1)} Cr</span>
                    </div>
                  </button>
                  {isExpanded && userPlayers.length > 0 && (
                    <div className="ml-4 mt-1 space-y-0.5 mb-1">
                      {userPlayers.map(p => (
                        <div key={p.playerId} className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-[var(--bg-card)]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Badge className={`text-[7px] font-bold px-1 py-0 border ${isLight ? ROLE_COLORS[p.role].light : ROLE_COLORS[p.role].dark}`}>
                              {p.role}
                            </Badge>
                            <span className="text-[11px] text-[var(--text-primary)] truncate">{p.playerName}</span>
                            <span className="text-[9px] text-[var(--text-muted)]">{p.teamShort}</span>
                            {p.isForeign && <span className="text-[8px]">✈</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-bold text-[var(--accent)]">{p.soldPrice} Cr</span>
                            {isAdmin && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRemoveTarget({
                                    playerId: p.playerId,
                                    playerName: p.playerName,
                                    ownerId: uid,
                                    ownerName: memberInfo?.displayName || p.boughtByName || 'User',
                                  });
                                  setRemoveReason('');
                                }}
                                className="p-0.5 rounded hover:bg-red-500/15 text-red-400/50 hover:text-red-400 transition-colors"
                                title="Remove player"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {isExpanded && userPlayers.length === 0 && (
                    <div className="ml-4 mt-1 mb-1 px-2.5 py-1.5 rounded-md bg-[var(--bg-card)] text-[10px] text-[var(--text-muted)]">
                      No players bought yet
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* ─── Remove Player Confirmation Modal ─── */}
      {removeTarget && (
        <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Trash2 size={14} className="text-red-400" />
            <span className="text-xs font-bold text-red-400">Remove Player</span>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mb-2">
            Remove <span className="font-bold text-[var(--text-primary)]">{removeTarget.playerName}</span> from{' '}
            <span className="font-bold text-[var(--text-primary)]">{removeTarget.ownerName}</span>&apos;s team?
            Budget will be refunded. This action is logged and visible to all members.
          </p>
          <input
            type="text"
            value={removeReason}
            onChange={(e) => setRemoveReason(e.target.value)}
            placeholder="Reason (optional but recommended)"
            className="w-full px-2.5 py-1.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] mb-2 outline-none focus:border-[var(--accent)]"
          />
          <div className="flex gap-2">
            <Button
              onClick={handleRemovePlayer}
              disabled={removing}
              size="sm"
              className="bg-red-500 text-white hover:bg-red-600 gap-1 text-xs flex-1"
            >
              {removing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Confirm Remove
            </Button>
            <Button
              onClick={() => { setRemoveTarget(null); setRemoveReason(''); }}
              size="sm"
              variant="outline"
              className="border-[var(--border)] text-[var(--text-muted)] text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ─── Collapsible: My Players (sold) ─── */}
      {myPlayers.length > 0 && (
        <>
          <button
            onClick={() => setShowSold(!showSold)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--bg-elevated)] mb-2 text-xs font-semibold text-[var(--text-secondary)]"
          >
            <span>My Squad ({myPlayers.length})</span>
            {showSold ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showSold && (
            <div className="space-y-1 mb-3">
              {myPlayers.map(p => (
                <div key={p.playerId} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-elevated)]">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge className={`text-[8px] font-bold px-1 py-0 border ${isLight ? ROLE_COLORS[p.role].light : ROLE_COLORS[p.role].dark}`}>
                      {p.role}
                    </Badge>
                    <span className="text-xs text-[var(--text-primary)] truncate">{p.playerName}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">{p.teamShort}</span>
                    {p.isForeign && <span className="text-[9px] shrink-0" title="Overseas">✈</span>}
                  </div>
                  <span className="text-xs font-bold text-[var(--accent)] shrink-0">{p.soldPrice} Cr</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Admin Activity Log (visible to all) ─── */}
      {auctionLog.length > 0 && (
        <>
          <button
            onClick={() => setShowAdminLog(!showAdminLog)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-orange-500/5 border border-orange-500/20 mb-2 text-xs font-semibold text-orange-400"
          >
            <span className="flex items-center gap-1.5">
              <ScrollText size={13} />
              Admin Log ({auctionLog.length})
            </span>
            {showAdminLog ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showAdminLog && (
            <div className="space-y-1.5 mb-3 max-h-48 overflow-y-auto">
              {[...auctionLog].reverse().map((entry) => (
                <div key={entry.id} className="px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-orange-500/10">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5">
                      {entry.action === 'player_removed' && <Trash2 size={10} className="text-red-400" />}
                      <span className="text-[10px] font-bold text-[var(--text-primary)]">
                        {entry.action === 'player_removed' ? 'Player Removed' : entry.action}
                      </span>
                    </div>
                    <span className="text-[9px] text-[var(--text-muted)]">
                      {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    <span className="font-semibold">{entry.adminName}</span> removed{' '}
                    <span className="font-semibold text-[var(--text-primary)]">{entry.playerName}</span>
                    {entry.playerTeamShort && <span className="text-[var(--text-muted)]"> ({entry.playerTeamShort})</span>}
                    {' '}from <span className="font-semibold">{entry.targetUserName}</span>&apos;s team
                    {entry.amount ? <span className="text-[var(--accent)]"> — {entry.amount} Cr refunded</span> : ''}
                  </p>
                  {entry.reason && (
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5 flex items-center gap-1">
                      <MessageSquare size={9} />
                      &quot;{entry.reason}&quot;
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Auction Log (all sold + unsold) ─── */}
      {(auction.soldPlayers.length > 0 || auction.unsoldPlayers.length > 0) && (
        <>
          {/* Last sold quick banner */}
          {auction.soldPlayers.length > 0 && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-[var(--success)]/10 border border-[var(--success)]/20 mb-2">
              <div className="text-[10px] text-[var(--success)] font-semibold">Last Sold</div>
              <div className="text-xs text-[var(--text-primary)]">
                {auction.soldPlayers[auction.soldPlayers.length - 1].playerName} — {' '}
                <span className="font-bold text-[var(--accent)]">
                  {auction.soldPlayers[auction.soldPlayers.length - 1].soldPrice} Cr
                </span>
                {' '}to {auction.soldPlayers[auction.soldPlayers.length - 1].boughtByName}
              </div>
            </div>
          )}

          {/* Full auction log */}
          <button
            onClick={() => setShowAuctionLog(!showAuctionLog)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--bg-elevated)] mb-2 text-xs font-semibold text-[var(--text-secondary)]"
          >
            <span>Auction Log ({auction.soldPlayers.length} sold, {new Set(auction.unsoldPlayers).size} unsold)</span>
            {showAuctionLog ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showAuctionLog && (
            <div className="space-y-1 mb-3 max-h-64 overflow-y-auto">
              {[...auction.soldPlayers].reverse().map((p) => {
                const isMyBuy = p.boughtBy === user?.uid;
                return (
                  <div key={p.playerId} className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                    isMyBuy ? 'bg-[var(--accent)]/10' : 'bg-[var(--bg-elevated)]'
                  }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge className={`text-[8px] font-bold px-1 py-0 border ${isLight ? ROLE_COLORS[p.role].light : ROLE_COLORS[p.role].dark}`}>
                        {p.role}
                      </Badge>
                      <span className="text-xs text-[var(--text-primary)] truncate">{p.playerName}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{p.teamShort}</span>
                      {p.isForeign && <span className="text-[9px] shrink-0">✈</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-[var(--accent)]">{p.soldPrice} Cr</span>
                      <span className="text-[10px] text-[var(--text-muted)]">→ {p.boughtByName}{isMyBuy ? ' (you)' : ''}</span>
                    </div>
                  </div>
                );
              })}
              {auction.unsoldPlayers.length > 0 && (
                <div className="pt-2 border-t border-[var(--border)]">
                  <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-3 mb-1">Unsold</div>
                  {[...new Set(auction.unsoldPlayers)].map((pid) => {
                    const fromOrder = auction.playerOrder.find(p => p.playerId === pid);
                    const playerInfo: AuctionPlayer | null = fromOrder ?? (() => {
                      const pool = getFantasyPlayerPool();
                      const poolMap = new Map(pool.map(p => [p.id, p]));
                      const fp = poolMap.get(pid);
                      return fp ? { playerId: fp.id, name: fp.name, team: fp.team, teamShort: fp.teamShort, role: fp.role, isForeign: fp.isForeign } as AuctionPlayer : null;
                    })();
                    if (!playerInfo) return null;
                    return (
                      <div key={pid} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] opacity-50">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge className="text-[8px] font-bold px-1 py-0 border bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)]">
                            {playerInfo.role}
                          </Badge>
                          <span className="text-xs text-[var(--text-muted)] truncate">{playerInfo.name}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">{playerInfo.teamShort}</span>
                        </div>
                        <span className="text-[10px] text-red-400">Unsold</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
