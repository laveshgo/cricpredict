// Firestore CRUD helpers for Fantasy Draft system (Auction-based)
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  FantasyLeague,
  FantasyLeagueSettings,
  FantasySquad,
  FantasyPickedPlayer,
  FantasyUserWeeklyScore,
  AuctionState,
  AuctionPlayer,
  AuctionBid,
  AuctionStatus,
  AuctionRules,
  AuctionLogEntry,
} from '@/types/fantasy';

// =================== FANTASY LEAGUES ===================

export async function createFantasyLeague(
  league: Omit<FantasyLeague, 'id'>
): Promise<string> {
  const ref = doc(collection(db, 'fantasyLeagues'));
  await setDoc(ref, { ...league, id: ref.id });
  return ref.id;
}

export async function getFantasyLeague(leagueId: string): Promise<FantasyLeague | null> {
  const snap = await getDoc(doc(db, 'fantasyLeagues', leagueId));
  return snap.exists() ? (snap.data() as FantasyLeague) : null;
}

export async function getFantasyLeaguesByTournament(tournamentId: string): Promise<FantasyLeague[]> {
  const q = query(
    collection(db, 'fantasyLeagues'),
    where('tournamentId', '==', tournamentId),
    where('isPublic', '==', true)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as FantasyLeague);
}

export async function getUserFantasyLeagues(
  tournamentId: string,
  userId: string
): Promise<FantasyLeague[]> {
  const q = query(
    collection(db, 'fantasyLeagues'),
    where('tournamentId', '==', tournamentId),
    where('memberUids', 'array-contains', userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as FantasyLeague);
}

// Get ALL fantasy leagues a user belongs to (across all tournaments)
export async function getAllUserFantasyLeagues(
  userId: string
): Promise<FantasyLeague[]> {
  const q = query(
    collection(db, 'fantasyLeagues'),
    where('memberUids', 'array-contains', userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as FantasyLeague);
}

export async function joinFantasyLeague(
  leagueId: string,
  userId: string,
  memberInfo: { displayName: string; username: string }
): Promise<void> {
  await updateDoc(doc(db, 'fantasyLeagues', leagueId), {
    memberUids: arrayUnion(userId),
    [`members.${userId}`]: {
      displayName: memberInfo.displayName,
      username: memberInfo.username,
      joinedAt: new Date().toISOString(),
    },
  });
}

export async function leaveFantasyLeague(leagueId: string, userId: string): Promise<void> {
  await updateDoc(doc(db, 'fantasyLeagues', leagueId), {
    memberUids: arrayRemove(userId),
  });
}

export async function updateFantasyLeagueSettings(
  leagueId: string,
  settings: Partial<FantasyLeagueSettings>
): Promise<void> {
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings)) {
    updates[`settings.${key}`] = value;
  }
  await updateDoc(doc(db, 'fantasyLeagues', leagueId), updates);
}

// =================== AUCTION STATE ===================

export async function createAuctionState(state: AuctionState): Promise<void> {
  await setDoc(doc(db, 'fantasyAuctions', state.leagueId), state);
}

export async function getAuctionState(leagueId: string): Promise<AuctionState | null> {
  const snap = await getDoc(doc(db, 'fantasyAuctions', leagueId));
  return snap.exists() ? (snap.data() as AuctionState) : null;
}

// Real-time listener for auction state — the core of the live auction
export function onAuctionStateUpdate(
  leagueId: string,
  callback: (state: AuctionState | null) => void
): () => void {
  return onSnapshot(doc(db, 'fantasyAuctions', leagueId), (snap) => {
    callback(snap.exists() ? (snap.data() as AuctionState) : null);
  });
}

// Start the auction (admin only — set status to 'live', present first player)
export async function startAuction(leagueId: string): Promise<void> {
  const snap = await getDoc(doc(db, 'fantasyAuctions', leagueId));
  if (!snap.exists()) throw new Error('Auction not found');

  const state = snap.data() as AuctionState;
  if (state.playerOrder.length === 0) throw new Error('No players in auction');

  const firstPlayer = state.playerOrder[0];
  const timerEndsAt = new Date(Date.now() + state.timerDuration * 1000).toISOString();

  await updateDoc(doc(db, 'fantasyAuctions', leagueId), {
    status: 'live',
    currentIndex: 0,
    currentPlayer: firstPlayer,
    currentSet: firstPlayer.set,
    currentBid: firstPlayer.basePrice,
    currentBidderId: null,
    currentBidderName: null,
    bidHistory: [],
    passedUserIds: [],
    holdsUsed: {},
    timerEndsAt,
    startedAt: new Date().toISOString(),
  });

  // Also lock the league
  await updateDoc(doc(db, 'fantasyLeagues', leagueId), {
    auctionStatus: 'live',
    'settings.addLocked': true,
  });
}

// Place a bid (with transaction for race conditions)
export async function placeBid(
  leagueId: string,
  userId: string,
  userName: string,
  bidAmount: number
): Promise<void> {
  const auctionRef = doc(db, 'fantasyAuctions', leagueId);

  await runTransaction(db, async (txn) => {
    const snap = await txn.get(auctionRef);
    if (!snap.exists()) throw new Error('Auction not found');

    const state = snap.data() as AuctionState;
    if (state.status !== 'live') throw new Error('Auction not active');
    if (!state.currentPlayer) throw new Error('No player up for bid');

    // Check user hasn't passed
    if (state.passedUserIds.includes(userId)) throw new Error('Already passed');

    // Check bid is higher than current
    if (bidAmount <= state.currentBid) throw new Error('Bid must be higher');

    // Check user has enough budget
    const userBudget = state.budgets[userId];
    if (!userBudget) throw new Error('User not in auction');
    if (bidAmount > userBudget.remaining) throw new Error('Not enough budget');

    // Check user hasn't reached max squad size
    if (userBudget.playerCount >= state.maxSquadSize) throw new Error('Squad is full');

    const newBid: AuctionBid = {
      userId,
      userName,
      amount: bidAmount,
      timestamp: new Date().toISOString(),
    };

    // Reset timer on new bid
    const timerEndsAt = new Date(Date.now() + state.timerDuration * 1000).toISOString();

    txn.update(auctionRef, {
      currentBid: bidAmount,
      currentBidderId: userId,
      currentBidderName: userName,
      bidHistory: [...state.bidHistory, newBid],
      timerEndsAt,
    });
  });
}

// Pass on current player (user opts out)
export async function passOnPlayer(leagueId: string, userId: string): Promise<void> {
  await updateDoc(doc(db, 'fantasyAuctions', leagueId), {
    passedUserIds: arrayUnion(userId),
  });
}

// Use a hold — adds holdDuration seconds to the timer (transaction for safety)
export async function useHold(
  leagueId: string,
  userId: string
): Promise<void> {
  const auctionRef = doc(db, 'fantasyAuctions', leagueId);

  await runTransaction(db, async (txn) => {
    const snap = await txn.get(auctionRef);
    if (!snap.exists()) throw new Error('Auction not found');

    const state = snap.data() as AuctionState;
    if (state.status !== 'live') throw new Error('Auction not active');
    if (!state.currentPlayer) throw new Error('No player up for bid');

    const rules = state.rules;
    const maxHolds = rules.holdsPerPlayer ?? 5;
    const holdSecs = rules.holdDuration ?? 30;

    const holdsUsed = state.holdsUsed || {};
    const myHolds = holdsUsed[userId] || 0;
    if (myHolds >= maxHolds) throw new Error('No holds remaining');

    // Extend the timer by holdDuration seconds from now or from current end, whichever is later
    const currentEnd = state.timerEndsAt ? new Date(state.timerEndsAt).getTime() : Date.now();
    const base = Math.max(currentEnd, Date.now());
    const newTimerEndsAt = new Date(base + holdSecs * 1000).toISOString();

    txn.update(auctionRef, {
      [`holdsUsed.${userId}`]: myHolds + 1,
      timerEndsAt: newTimerEndsAt,
    });
  });
}

// Helper: determine if we should go to selection phase or straight to completed
function shouldEnterSelection(
  unsoldPlayerIds: string[],
  budgets: AuctionState['budgets'],
  maxSquadSize: number
): boolean {
  if (unsoldPlayerIds.length === 0) return false;
  // Check if any user has spots remaining
  return Object.values(budgets).some(b => b.playerCount < maxSquadSize);
}

// Helper: mark auction as completed or entering selection phase
function completeAuctionUpdates(enterSelection: boolean = false): Record<string, unknown> {
  const base: Record<string, unknown> = {
    currentPlayer: null,
    currentSet: null,
    currentBid: 0,
    currentBidderId: null,
    currentBidderName: null,
    bidHistory: [],
    passedUserIds: [],
    holdsUsed: {},
    timerEndsAt: null,
  };
  if (enterSelection) {
    base.status = 'selection';
    base.selectionPicks = {};
    base.selectionConfirmed = [];
  } else {
    base.status = 'completed';
    base.completedAt = new Date().toISOString();
  }
  return base;
}

// Check if all squads are full
function allSquadsFull(budgets: AuctionState['budgets'], maxSquadSize: number): boolean {
  return Object.values(budgets).every(b => b.playerCount >= maxSquadSize);
}

// Sell current player to highest bidder and move to next
export async function soldAndNext(leagueId: string): Promise<void> {
  const auctionRef = doc(db, 'fantasyAuctions', leagueId);

  await runTransaction(db, async (txn) => {
    const snap = await txn.get(auctionRef);
    if (!snap.exists()) throw new Error('Auction not found');

    const state = snap.data() as AuctionState;

    // Guard: if already completed or no current player, skip
    if (state.status === 'completed' || !state.currentPlayer) return;

    const updates: Record<string, unknown> = {};
    const updatedBudgets = { ...state.budgets };

    if (state.currentBidderId) {
      // Player sold
      const soldEntry = {
        playerId: state.currentPlayer.playerId,
        playerName: state.currentPlayer.name,
        team: state.currentPlayer.team,
        teamShort: state.currentPlayer.teamShort,
        role: state.currentPlayer.role,
        isForeign: state.currentPlayer.isForeign ?? false,
        basePrice: state.currentPlayer.basePrice,
        soldPrice: state.currentBid,
        boughtBy: state.currentBidderId,
        boughtByName: state.currentBidderName,
      };

      // Update buyer's budget
      const buyerBudget = state.budgets[state.currentBidderId];
      const newBudget = {
        ...buyerBudget,
        spent: buyerBudget.spent + state.currentBid,
        remaining: buyerBudget.remaining - state.currentBid,
        playerCount: buyerBudget.playerCount + 1,
      };

      updatedBudgets[state.currentBidderId] = newBudget;
      updates.soldPlayers = [...state.soldPlayers, soldEntry];
      updates[`budgets.${state.currentBidderId}`] = newBudget;
    } else {
      // Player unsold
      updates.unsoldPlayers = [...new Set([...state.unsoldPlayers, state.currentPlayer.playerId])];
    }

    // Check if all squads are now full — auto-end
    if (allSquadsFull(updatedBudgets, state.maxSquadSize)) {
      // All squads full — no selection needed
      Object.assign(updates, completeAuctionUpdates(false));
      updates.currentIndex = state.currentIndex + 1;
      txn.update(auctionRef, updates);
      return;
    }

    // Move to next player
    const nextIndex = state.currentIndex + 1;
    if (nextIndex >= state.playerOrder.length) {
      // No more players — check if selection phase needed
      const allUnsold = updates.unsoldPlayers as string[] ?? state.unsoldPlayers;
      const goToSelection = shouldEnterSelection(allUnsold, updatedBudgets, state.maxSquadSize);
      Object.assign(updates, completeAuctionUpdates(goToSelection));
      updates.currentIndex = nextIndex;
    } else {
      const nextPlayer = state.playerOrder[nextIndex];
      updates.currentIndex = nextIndex;
      updates.currentPlayer = nextPlayer;
      updates.currentSet = nextPlayer.set;
      updates.currentBid = nextPlayer.basePrice;
      updates.currentBidderId = null;
      updates.currentBidderName = null;
      updates.bidHistory = [];
      updates.passedUserIds = [];
      updates.holdsUsed = {};

      // Add buffer for sold/set-change animations so the timer doesn't eat into bidding time
      const wasSold = !!state.currentBidderId;
      const setChanging = nextPlayer.set !== state.currentSet;
      // Sold overlay = 1200ms, set-change overlay = 1800ms (shows after sold clears)
      let animBufferMs = 0;
      if (wasSold) animBufferMs += 1200;
      if (setChanging) animBufferMs += 1800;
      updates.timerEndsAt = new Date(Date.now() + animBufferMs + state.timerDuration * 1000).toISOString();
    }

    txn.update(auctionRef, updates);
  });
}

// Pause / Resume auction
export async function pauseAuction(leagueId: string): Promise<void> {
  await updateDoc(doc(db, 'fantasyAuctions', leagueId), {
    status: 'paused',
    timerEndsAt: null,
  });
  await updateDoc(doc(db, 'fantasyLeagues', leagueId), {
    auctionStatus: 'paused',
  });
}

export async function resumeAuction(leagueId: string): Promise<void> {
  const snap = await getDoc(doc(db, 'fantasyAuctions', leagueId));
  if (!snap.exists()) return;
  const state = snap.data() as AuctionState;

  await updateDoc(doc(db, 'fantasyAuctions', leagueId), {
    status: 'live',
    timerEndsAt: new Date(Date.now() + state.timerDuration * 1000).toISOString(),
  });
  await updateDoc(doc(db, 'fantasyLeagues', leagueId), {
    auctionStatus: 'live',
  });
}

// End auction early (admin action)
export async function endAuctionEarly(leagueId: string): Promise<void> {
  const auctionRef = doc(db, 'fantasyAuctions', leagueId);

  await runTransaction(db, async (txn) => {
    const snap = await txn.get(auctionRef);
    if (!snap.exists()) throw new Error('Auction not found');

    const state = snap.data() as AuctionState;
    if (state.status === 'completed') return; // already done

    const updates: Record<string, unknown> = {};

    // If there's a current player with a bidder, sell them first
    if (state.currentPlayer && state.currentBidderId) {
      const soldEntry = {
        playerId: state.currentPlayer.playerId,
        playerName: state.currentPlayer.name,
        team: state.currentPlayer.team,
        teamShort: state.currentPlayer.teamShort,
        role: state.currentPlayer.role,
        isForeign: state.currentPlayer.isForeign ?? false,
        basePrice: state.currentPlayer.basePrice,
        soldPrice: state.currentBid,
        boughtBy: state.currentBidderId,
        boughtByName: state.currentBidderName,
      };

      const buyerBudget = state.budgets[state.currentBidderId];
      updates.soldPlayers = [...state.soldPlayers, soldEntry];
      updates[`budgets.${state.currentBidderId}`] = {
        ...buyerBudget,
        spent: buyerBudget.spent + state.currentBid,
        remaining: buyerBudget.remaining - state.currentBid,
        playerCount: buyerBudget.playerCount + 1,
      };
    }

    // Mark remaining players as unsold
    const remainingUnsold = state.playerOrder
      .slice(state.currentBidderId ? state.currentIndex + 1 : state.currentIndex)
      .map(p => p.playerId);
    const allUnsold = [...new Set([...state.unsoldPlayers, ...remainingUnsold])];
    updates.unsoldPlayers = allUnsold;

    // End auction immediately — no selection phase
    Object.assign(updates, completeAuctionUpdates(false));
    updates.currentIndex = state.playerOrder.length;

    txn.update(auctionRef, updates);
  });

  // Sync league status based on final auction state
  const finalSnap = await getDoc(doc(db, 'fantasyAuctions', leagueId));
  const finalStatus = finalSnap.exists() ? (finalSnap.data() as AuctionState).status : 'completed';
  await updateDoc(doc(db, 'fantasyLeagues', leagueId), {
    auctionStatus: finalStatus,
  });
}

// Skip the rest of the current set (admin action — jump to next set)
export async function skipCurrentSet(leagueId: string): Promise<void> {
  const auctionRef = doc(db, 'fantasyAuctions', leagueId);

  await runTransaction(db, async (txn) => {
    const snap = await txn.get(auctionRef);
    if (!snap.exists()) throw new Error('Auction not found');

    const state = snap.data() as AuctionState;
    if (state.status !== 'live' && state.status !== 'paused') return;
    if (!state.currentPlayer) return;

    const currentSet = state.currentSet;
    const updates: Record<string, unknown> = {};
    const updatedBudgets = { ...state.budgets };
    let updatedSold = [...state.soldPlayers];
    const skippedUnsold: string[] = [];

    // If current player has a bid, sell them first
    if (state.currentBidderId) {
      const soldEntry = {
        playerId: state.currentPlayer.playerId,
        playerName: state.currentPlayer.name,
        team: state.currentPlayer.team,
        teamShort: state.currentPlayer.teamShort,
        role: state.currentPlayer.role,
        isForeign: state.currentPlayer.isForeign ?? false,
        basePrice: state.currentPlayer.basePrice,
        soldPrice: state.currentBid,
        boughtBy: state.currentBidderId!,
        boughtByName: state.currentBidderName || 'Unknown',
      };

      const buyerBudget = state.budgets[state.currentBidderId!];
      const newBudget = {
        ...buyerBudget,
        spent: buyerBudget.spent + state.currentBid,
        remaining: buyerBudget.remaining - state.currentBid,
        playerCount: buyerBudget.playerCount + 1,
      };
      updatedBudgets[state.currentBidderId!] = newBudget;
      updatedSold = [...updatedSold, soldEntry];
      updates[`budgets.${state.currentBidderId!}`] = newBudget;
    } else {
      // Current player is unsold
      skippedUnsold.push(state.currentPlayer.playerId);
    }

    // Mark all remaining players in this set as unsold
    for (let i = state.currentIndex + 1; i < state.playerOrder.length; i++) {
      const p = state.playerOrder[i];
      if (p.set !== currentSet) break; // hit the next set
      skippedUnsold.push(p.playerId);
    }

    updates.soldPlayers = updatedSold;
    updates.unsoldPlayers = [...new Set([...state.unsoldPlayers, ...skippedUnsold])];

    // Find the first player of the next set
    let nextIndex = -1;
    for (let i = state.currentIndex + 1; i < state.playerOrder.length; i++) {
      if (state.playerOrder[i].set !== currentSet) {
        nextIndex = i;
        break;
      }
    }

    if (nextIndex === -1) {
      // No more sets — check for selection phase
      const allUnsold = updates.unsoldPlayers as string[];
      const goToSelection = shouldEnterSelection(allUnsold, updatedBudgets, state.maxSquadSize);
      Object.assign(updates, completeAuctionUpdates(goToSelection));
      updates.currentIndex = state.playerOrder.length;
    } else {
      const nextPlayer = state.playerOrder[nextIndex];
      updates.currentIndex = nextIndex;
      updates.currentPlayer = nextPlayer;
      updates.currentSet = nextPlayer.set;
      updates.currentBid = nextPlayer.basePrice;
      updates.currentBidderId = null;
      updates.currentBidderName = null;
      updates.bidHistory = [];
      updates.passedUserIds = [];
      updates.holdsUsed = {};
      // Set change always happens when skipping set — add animation buffer
      const setAnimMs = 1800;
      updates.timerEndsAt = new Date(Date.now() + setAnimMs + state.timerDuration * 1000).toISOString();
    }

    txn.update(auctionRef, updates);
  });
}

// Admin: Remove a player from someone's team (with audit logging)
export async function removePlayerFromTeam(
  leagueId: string,
  playerId: string,
  adminId: string,
  adminName: string,
  reason?: string
): Promise<void> {
  const auctionRef = doc(db, 'fantasyAuctions', leagueId);

  await runTransaction(db, async (txn) => {
    const snap = await txn.get(auctionRef);
    if (!snap.exists()) throw new Error('Auction not found');

    const state = snap.data() as AuctionState;

    // Find the sold player entry
    const soldIndex = state.soldPlayers.findIndex(p => p.playerId === playerId);
    if (soldIndex === -1) throw new Error('Player not found in sold list');

    const soldPlayer = state.soldPlayers[soldIndex];
    const ownerId = soldPlayer.boughtBy;
    const ownerBudget = state.budgets[ownerId];
    if (!ownerBudget) throw new Error('Owner budget not found');

    // Remove from sold list
    const updatedSold = [...state.soldPlayers];
    updatedSold.splice(soldIndex, 1);

    // Refund the budget
    const updatedBudget = {
      ...ownerBudget,
      spent: ownerBudget.spent - soldPlayer.soldPrice,
      remaining: ownerBudget.remaining + soldPlayer.soldPrice,
      playerCount: ownerBudget.playerCount - 1,
    };

    // Create audit log entry
    const logEntry: AuctionLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      action: 'player_removed',
      adminId,
      adminName,
      targetUserId: ownerId,
      targetUserName: soldPlayer.boughtByName || 'Unknown',
      playerId: soldPlayer.playerId,
      playerName: soldPlayer.playerName,
      playerRole: soldPlayer.role,
      playerTeamShort: soldPlayer.teamShort,
      amount: soldPlayer.soldPrice,
      reason: reason || undefined,
      timestamp: new Date().toISOString(),
    };

    const existingLog: AuctionLogEntry[] = state.auctionLog || [];

    txn.update(auctionRef, {
      soldPlayers: updatedSold,
      [`budgets.${ownerId}`]: updatedBudget,
      auctionLog: [...existingLog, logEntry],
    });
  });
}

// =================== POST-AUCTION SELECTION ===================

// Toggle an unsold player pick during selection phase (add or remove)
export async function toggleSelectionPick(
  leagueId: string,
  userId: string,
  userName: string,
  playerId: string
): Promise<void> {
  const auctionRef = doc(db, 'fantasyAuctions', leagueId);

  await runTransaction(db, async (txn) => {
    const snap = await txn.get(auctionRef);
    if (!snap.exists()) throw new Error('Auction not found');

    const state = snap.data() as AuctionState;
    if (state.status !== 'selection') throw new Error('Not in selection phase');
    if (state.selectionConfirmed?.includes(userId)) throw new Error('Already confirmed');

    const currentPicks: string[] = state.selectionPicks?.[userId] || [];

    // If already picked, remove it (toggle off)
    if (currentPicks.includes(playerId)) {
      txn.update(auctionRef, {
        [`selectionPicks.${userId}`]: currentPicks.filter(p => p !== playerId),
      });
      return;
    }

    // Otherwise add — limit nominations to spotsLeft × 4
    if (!state.unsoldPlayers.includes(playerId)) throw new Error('Player not in unsold pool');

    const userBudget = state.budgets?.[userId];
    const spotsLeft = userBudget ? state.maxSquadSize - userBudget.playerCount : 0;
    const maxPicks = spotsLeft * 4;
    if (maxPicks > 0 && currentPicks.length >= maxPicks) {
      throw new Error(`Max ${maxPicks} picks allowed (${spotsLeft} spots × 4)`);
    }

    // Multiple users can nominate the same player — it'll be re-auctioned once
    txn.update(auctionRef, {
      [`selectionPicks.${userId}`]: [...currentPicks, playerId],
    });
  });
}

// Confirm selection picks — locks them in, adds players to soldPlayers & adjusts budget
export async function confirmSelectionPicks(
  leagueId: string,
  userId: string,
  userName: string
): Promise<void> {
  const auctionRef = doc(db, 'fantasyAuctions', leagueId);

  await runTransaction(db, async (txn) => {
    const snap = await txn.get(auctionRef);
    if (!snap.exists()) throw new Error('Auction not found');

    const state = snap.data() as AuctionState;
    if (state.status !== 'selection') throw new Error('Not in selection phase');
    if (state.selectionConfirmed?.includes(userId)) throw new Error('Already confirmed');

    // Just mark as confirmed — picks are stored already via toggleSelectionPick
    txn.update(auctionRef, {
      selectionConfirmed: [...(state.selectionConfirmed || []), userId],
    });
  });
}

// Admin: finalize selection phase → move to completed
// Start re-auction from selected unsold players (admin action after all confirm)
export async function completeSelectionPhase(leagueId: string): Promise<void> {
  const auctionRef = doc(db, 'fantasyAuctions', leagueId);

  await runTransaction(db, async (txn) => {
    const snap = await txn.get(auctionRef);
    if (!snap.exists()) throw new Error('Auction not found');

    const state = snap.data() as AuctionState;
    if (state.status !== 'selection') throw new Error('Not in selection phase');

    // Collect union of all users' picks (deduplicated, preserve order)
    const pickedIds = new Set<string>();
    for (const picks of Object.values(state.selectionPicks || {})) {
      for (const pid of picks as string[]) pickedIds.add(pid);
    }

    if (pickedIds.size === 0) {
      // No one picked anything — just complete the auction
      txn.update(auctionRef, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      });
      return;
    }

    // Build re-auction player order from picked unsold players
    const reAuctionOrder: AuctionState['playerOrder'] = [];
    let order = 0;
    for (const pid of pickedIds) {
      const playerInfo = state.playerOrder.find(p => p.playerId === pid);
      if (!playerInfo) continue;
      reAuctionOrder.push({
        ...playerInfo,
        set: playerInfo.set,       // keep original set for display
        order: order++,
        basePrice: playerInfo.basePrice,
      });
    }

    if (reAuctionOrder.length === 0) {
      txn.update(auctionRef, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      });
      return;
    }

    // Remove picked players from unsoldPlayers (they're going back to auction)
    const remainingUnsold = (state.unsoldPlayers || []).filter(
      (pid: string) => !pickedIds.has(pid)
    );

    // Append re-auction players to existing playerOrder (keep old entries for lookups)
    const fullPlayerOrder = [...state.playerOrder, ...reAuctionOrder];
    const reAuctionStartIndex = state.playerOrder.length;
    const firstPlayer = reAuctionOrder[0];

    txn.update(auctionRef, {
      status: 'live',
      playerOrder: fullPlayerOrder,
      currentIndex: reAuctionStartIndex,
      currentPlayer: firstPlayer,
      currentSet: firstPlayer.set,
      currentBid: firstPlayer.basePrice,
      currentBidderId: null,
      currentBidderName: null,
      bidHistory: [],
      passedUserIds: [],
      holdsUsed: {},
      timerEndsAt: new Date(Date.now() + state.timerDuration * 1000).toISOString(),
      unsoldPlayers: remainingUnsold,
      selectionPicks: {},
      selectionConfirmed: [],
    });
  });

  // Sync league status
  await updateDoc(doc(db, 'fantasyLeagues', leagueId), {
    auctionStatus: 'live',
  });
}

// =================== FANTASY SQUADS ===================

export async function createFantasySquad(
  squad: Omit<FantasySquad, 'id'>
): Promise<string> {
  const ref = doc(collection(db, 'fantasySquads'));
  await setDoc(ref, { ...squad, id: ref.id });
  return ref.id;
}

export async function getFantasySquad(squadId: string): Promise<FantasySquad | null> {
  const snap = await getDoc(doc(db, 'fantasySquads', squadId));
  return snap.exists() ? (snap.data() as FantasySquad) : null;
}

export async function getUserSquadInLeague(
  leagueId: string,
  userId: string
): Promise<FantasySquad | null> {
  const q = query(
    collection(db, 'fantasySquads'),
    where('leagueId', '==', leagueId),
    where('userId', '==', userId),
    limit(1)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : (snap.docs[0].data() as FantasySquad);
}

export async function getLeagueSquads(leagueId: string): Promise<FantasySquad[]> {
  const q = query(
    collection(db, 'fantasySquads'),
    where('leagueId', '==', leagueId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as FantasySquad);
}

export async function updateFantasySquad(
  squadId: string,
  updates: Partial<FantasySquad>
): Promise<void> {
  await updateDoc(doc(db, 'fantasySquads', squadId), updates);
}

// =================== WEEKLY SCORES ===================

export async function saveUserWeeklyScore(score: FantasyUserWeeklyScore): Promise<void> {
  const docId = `${score.squadId}_week${score.weekNumber}`;
  await setDoc(doc(db, 'fantasyUserScores', docId), { ...score, id: docId });
}

export async function getUserWeeklyScore(
  squadId: string,
  weekNumber: number
): Promise<FantasyUserWeeklyScore | null> {
  const docId = `${squadId}_week${weekNumber}`;
  const snap = await getDoc(doc(db, 'fantasyUserScores', docId));
  return snap.exists() ? (snap.data() as FantasyUserWeeklyScore) : null;
}

export async function getLeagueWeeklyScores(
  leagueId: string,
  weekNumber: number
): Promise<FantasyUserWeeklyScore[]> {
  const q = query(
    collection(db, 'fantasyUserScores'),
    where('leagueId', '==', leagueId),
    where('weekNumber', '==', weekNumber)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as FantasyUserWeeklyScore);
}

export async function getAllUserScores(squadId: string): Promise<FantasyUserWeeklyScore[]> {
  const q = query(
    collection(db, 'fantasyUserScores'),
    where('squadId', '==', squadId),
    orderBy('weekNumber', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as FantasyUserWeeklyScore);
}

// =================== REAL-TIME LISTENERS ===================

export function onFantasyLeagueUpdate(
  leagueId: string,
  callback: (league: FantasyLeague | null) => void
): () => void {
  return onSnapshot(doc(db, 'fantasyLeagues', leagueId), (snap) => {
    callback(snap.exists() ? (snap.data() as FantasyLeague) : null);
  });
}

export function onLeagueSquadsUpdate(
  leagueId: string,
  callback: (squads: FantasySquad[]) => void
): () => void {
  const q = query(
    collection(db, 'fantasySquads'),
    where('leagueId', '==', leagueId)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => d.data() as FantasySquad));
  });
}
