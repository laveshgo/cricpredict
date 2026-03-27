// =================== FANTASY DRAFT TYPES ===================

export type PlayerRole = 'WK' | 'BAT' | 'AR' | 'BOWL';

// ─── Player in the fantasy pool (with base pricing) ───
export interface FantasyPoolPlayer {
  id: string;                    // unique: "teamShort_playerName" slug
  name: string;                  // "Virat Kohli"
  team: string;                  // "Royal Challengers Bengaluru"
  teamShort: string;             // "RCB"
  role: PlayerRole;
  price: number;                 // base price for auction (in Cr)
  tier: 'elite' | 'premium' | 'standard' | 'economy';
  isForeign: boolean;            // overseas player flag
}

// ─── Player bought in auction ───
export interface FantasyPickedPlayer {
  playerId: string;              // references FantasyPoolPlayer.id
  name: string;
  team: string;
  teamShort: string;
  role: PlayerRole;
  price: number;                 // actual price paid in auction (can be higher than base)
  basePrice: number;             // original base price
}

// ─── Role constraints for squad composition ───
export interface RoleConstraints {
  WK: { min: number; max: number };   // 1-2
  BAT: { min: number; max: number };  // 3-5
  AR: { min: number; max: number };   // 1-3
  BOWL: { min: number; max: number }; // 3-5
}

export const DEFAULT_ROLE_CONSTRAINTS: RoleConstraints = {
  WK: { min: 1, max: 2 },
  BAT: { min: 3, max: 5 },
  AR: { min: 1, max: 3 },
  BOWL: { min: 3, max: 5 },
};

// ─── Fantasy scoring rules ───
export interface FantasyScoringRules {
  // Batting
  runPoints: number;
  boundaryBonus: number;
  sixBonus: number;
  thirtyBonus: number;
  halfCenturyBonus: number;
  centuryBonus: number;
  duckPenalty: number;
  strikeRateBonus: { threshold: number; bonus: number };
  strikeRatePenalty: { threshold: number; penalty: number };

  // Bowling
  wicketPoints: number;
  threeWicketBonus: number;
  fiveWicketBonus: number;
  maidenPoints: number;
  economyBonus: { threshold: number; bonus: number };
  economyPenalty: { threshold: number; penalty: number };

  // Fielding
  catchPoints: number;
  stumpingPoints: number;
  runOutPoints: number;

  // Match awards
  potmPoints: number;

  // Captain / Vice-Captain
  captainMultiplier: number;
  vcMultiplier: number;

  // Penalties
  dncPenalty: number;
}

export const DEFAULT_FANTASY_SCORING: FantasyScoringRules = {
  runPoints: 1,
  boundaryBonus: 1,
  sixBonus: 2,
  thirtyBonus: 4,
  halfCenturyBonus: 8,
  centuryBonus: 16,
  duckPenalty: -2,
  strikeRateBonus: { threshold: 170, bonus: 6 },
  strikeRatePenalty: { threshold: 70, penalty: -6 },
  wicketPoints: 25,
  threeWicketBonus: 4,
  fiveWicketBonus: 8,
  maidenPoints: 12,
  economyBonus: { threshold: 5, bonus: 6 },
  economyPenalty: { threshold: 10, penalty: -6 },
  catchPoints: 8,
  stumpingPoints: 12,
  runOutPoints: 6,
  potmPoints: 16,
  captainMultiplier: 2,
  vcMultiplier: 1.5,
  dncPenalty: 0,
};

// ─── Auction audit log entry (admin actions visible to all) ───
export type AuctionLogAction = 'player_removed' | 'player_added' | 'budget_adjusted';

export interface AuctionLogEntry {
  id: string;                      // unique id
  action: AuctionLogAction;
  adminId: string;
  adminName: string;
  targetUserId: string;
  targetUserName: string;
  playerId?: string;
  playerName?: string;
  playerRole?: PlayerRole;
  playerTeamShort?: string;
  amount?: number;                 // refund amount or price
  reason?: string;
  timestamp: string;
}

// =================== AUCTION SYSTEM ===================

// ─── Auction rules (configurable by admin before starting) ───
export interface AuctionRules {
  maxForeignPlayers: number;     // max overseas players per squad (default 4)
  minWK: number;                 // minimum wicket-keepers (default 1)
  minBAT: number;                // minimum batters (default 3)
  minAR: number;                 // minimum all-rounders (default 1)
  minBOWL: number;               // minimum bowlers (default 3)
  holdsPerPlayer: number;        // how many times a user can pause the timer per player (default 5)
  holdDuration: number;          // seconds added per hold (default 30)
}

export const DEFAULT_AUCTION_RULES: AuctionRules = {
  maxForeignPlayers: 4,
  minWK: 1,
  minBAT: 3,
  minAR: 1,
  minBOWL: 3,
  holdsPerPlayer: 5,
  holdDuration: 30,
};

// ─── Auction player set (role-based, like IPL pools) ───
export type AuctionSet =
  | 'marquee_bat' | 'marquee_bowl' | 'marquee_ar' | 'marquee_wk'
  | 'set2_bat' | 'set2_bowl' | 'set2_ar' | 'set2_wk'
  | 'set3_bat' | 'set3_bowl' | 'set3_ar' | 'set3_wk';

export interface AuctionSetConfig {
  name: string;
  label: string;
  basePrice: number;             // base price for players in this set (in Cr)
  role: PlayerRole;
  tier: 'marquee' | 'set2' | 'set3';
}

// Ordered list of sets (auction follows this order)
export const AUCTION_SET_ORDER: AuctionSet[] = [
  'marquee_bat', 'marquee_bowl', 'marquee_ar', 'marquee_wk',
  'set2_bat', 'set2_bowl', 'set2_ar', 'set2_wk',
  'set3_bat', 'set3_bowl', 'set3_ar', 'set3_wk',
];

export const AUCTION_SETS: Record<AuctionSet, AuctionSetConfig> = {
  marquee_bat:  { name: 'marquee_bat',  label: 'Marquee Batters',       basePrice: 2,    role: 'BAT',  tier: 'marquee' },
  marquee_bowl: { name: 'marquee_bowl', label: 'Marquee Bowlers',       basePrice: 2,    role: 'BOWL', tier: 'marquee' },
  marquee_ar:   { name: 'marquee_ar',   label: 'Marquee All-rounders',  basePrice: 2,    role: 'AR',   tier: 'marquee' },
  marquee_wk:   { name: 'marquee_wk',   label: 'Marquee Wicket-keepers',basePrice: 2,    role: 'WK',   tier: 'marquee' },
  set2_bat:     { name: 'set2_bat',     label: 'Set 2 Batters',         basePrice: 1,    role: 'BAT',  tier: 'set2' },
  set2_bowl:    { name: 'set2_bowl',    label: 'Set 2 Bowlers',         basePrice: 1,    role: 'BOWL', tier: 'set2' },
  set2_ar:      { name: 'set2_ar',      label: 'Set 2 All-rounders',    basePrice: 1,    role: 'AR',   tier: 'set2' },
  set2_wk:      { name: 'set2_wk',      label: 'Set 2 Wicket-keepers',  basePrice: 1,    role: 'WK',   tier: 'set2' },
  set3_bat:     { name: 'set3_bat',     label: 'Set 3 Batters',         basePrice: 0.5,  role: 'BAT',  tier: 'set3' },
  set3_bowl:    { name: 'set3_bowl',    label: 'Set 3 Bowlers',         basePrice: 0.5,  role: 'BOWL', tier: 'set3' },
  set3_ar:      { name: 'set3_ar',      label: 'Set 3 All-rounders',    basePrice: 0.5,  role: 'AR',   tier: 'set3' },
  set3_wk:      { name: 'set3_wk',      label: 'Set 3 Wicket-keepers',  basePrice: 0.5,  role: 'WK',   tier: 'set3' },
};

// ─── Auction player entry (player + which set they're in) ───
export interface AuctionPlayer {
  playerId: string;
  name: string;
  team: string;
  teamShort: string;
  role: PlayerRole;
  isForeign: boolean;
  set: AuctionSet;
  basePrice: number;             // base price from their set
  order: number;                 // order within the set (shuffled)
}

// ─── A single bid in the auction ───
export interface AuctionBid {
  userId: string;
  userName: string;
  amount: number;
  timestamp: string;
}

// ─── Current state of the auction (Firestore real-time doc) ───
export type AuctionStatus = 'lobby' | 'live' | 'paused' | 'selection' | 'completed';

export interface AuctionState {
  id: string;                    // same as leagueId
  leagueId: string;
  tournamentId: string;
  status: AuctionStatus;

  // Player order for auction (full list, shuffled within sets)
  playerOrder: AuctionPlayer[];

  // Current auction slot
  currentIndex: number;          // index into playerOrder
  currentPlayer: AuctionPlayer | null;
  currentSet: AuctionSet | null;

  // Bidding state for current player
  currentBid: number;            // current highest bid amount
  currentBidderId: string | null;
  currentBidderName: string | null;
  bidHistory: AuctionBid[];      // bids for current player
  passedUserIds: string[];       // users who passed on current player

  // Timer
  timerEndsAt: string | null;    // ISO timestamp when timer expires
  timerDuration: number;         // seconds (default 15)

  // Holds — per-user hold count for current player (reset on next player)
  holdsUsed: Record<string, number>;  // userId -> holds used this player

  // Budget tracking per user
  budgets: Record<string, {
    total: number;
    spent: number;
    remaining: number;
    playerCount: number;
  }>;

  // Results — who bought whom
  soldPlayers: {
    playerId: string;
    playerName: string;
    team: string;
    teamShort: string;
    role: PlayerRole;
    isForeign: boolean;
    basePrice: number;
    soldPrice: number;
    boughtBy: string;            // userId
    boughtByName: string;
  }[];

  unsoldPlayers: string[];       // playerIds that went unsold

  // Admin action audit log (visible to all members)
  auctionLog: AuctionLogEntry[];

  // Settings
  maxSquadSize: number;          // 15
  totalBudget: number;           // 100 Cr
  bidIncrement: number;          // 0.25 Cr

  // Auction rules (configurable by admin)
  rules: AuctionRules;

  // Post-auction unsold player selection phase
  // Max picks per user = their remaining squad slots (maxSquadSize - playerCount)
  selectionPicks: Record<string, string[]>; // userId -> array of selected playerIds
  selectionConfirmed: string[];    // userIds who have confirmed their picks

  startedAt?: string;
  completedAt?: string;
}

// =================== LEAGUE & SQUAD ===================

// ─── Fantasy League ───
export interface FantasyLeague {
  id: string;
  tournamentId: string;
  name: string;
  createdBy: string;             // userId (admin)
  createdAt: string;
  isPublic: boolean;
  memberUids: string[];
  members: {                     // denormalized member info
    [uid: string]: {
      displayName: string;
      username: string;
      joinedAt: string;
    };
  };
  auctionStatus: AuctionStatus;  // synced from auction state
  settings: FantasyLeagueSettings;
}

export interface FantasyLeagueSettings {
  addLocked: boolean;            // no new members
  memberLimit?: number | null;
  maxSquadSize: number;          // 15
  totalBudget: number;           // 100 Cr
  bidIncrement: number;          // 0.25 Cr
  timerDuration: number;         // 15 seconds
  auctionRules: AuctionRules;    // squad composition rules
  skippedSets: AuctionSet[];     // sets to skip in auction
  scoringOverrides?: Partial<FantasyScoringRules>;
}

export const DEFAULT_FANTASY_LEAGUE_SETTINGS: FantasyLeagueSettings = {
  addLocked: false,
  memberLimit: null,
  maxSquadSize: 15,
  totalBudget: 100,
  bidIncrement: 0.25,
  timerDuration: 15,
  auctionRules: DEFAULT_AUCTION_RULES,
  skippedSets: [],
};

// ─── User's fantasy squad (built through auction) ───
export interface FantasySquad {
  id: string;                    // auto-generated
  leagueId: string;
  tournamentId: string;
  userId: string;
  userName: string;
  displayName: string;
  squadName: string;

  // Budget
  totalBudget: number;
  spent: number;
  remaining: number;

  // Players bought in auction
  players: FantasyPickedPlayer[];

  // Playing XI + Captain (set after auction)
  playingXI: string[];
  bench: string[];
  captainId: string;
  viceCaptainId: string;

  createdAt: string;
  updatedAt: string;
}

// =================== SCORING & STATS ===================

// ─── Player match stats (from Cricbuzz) ───
export interface PlayerMatchStats {
  playerId: string;
  playerName: string;
  team: string;
  matchId: string;

  runs?: number;
  ballsFaced?: number;
  fours?: number;
  sixes?: number;
  isOut?: boolean;
  didBat?: boolean;

  wickets?: number;
  oversBowled?: number;
  runsConceded?: number;
  maidens?: number;
  dotBalls?: number;
  didBowl?: boolean;

  catches?: number;
  stumpings?: number;
  runOuts?: number;

  isPotm?: boolean;
  inPlayingXI?: boolean;
}

export interface FantasyPlayerMatchPoints {
  playerId: string;
  playerName: string;
  team: string;
  matchId: string;

  battingPoints: number;
  bowlingPoints: number;
  fieldingPoints: number;
  bonusPoints: number;
  penaltyPoints: number;
  baseTotal: number;

  isCaptain: boolean;
  isViceCaptain: boolean;
  multiplier: number;
  finalTotal: number;
}

export interface FantasyUserWeeklyScore {
  id: string;
  squadId: string;
  leagueId: string;
  userId: string;
  userName: string;
  tournamentId: string;
  weekNumber: number;

  playerScores: FantasyPlayerMatchPoints[];
  benchScores: FantasyPlayerMatchPoints[];

  weekTotal: number;
  cumulativeTotal: number;

  calculatedAt: string;
}

export interface FantasyLeaderboardEntry {
  userId: string;
  userName: string;
  displayName: string;
  photoURL?: string;
  squadId: string;
  squadName: string;
  weekPoints: number;
  totalPoints: number;
  rank: number;
  previousRank?: number;
}

// ─── Contest type enum (for tournament page) ───
export type ContestType = 'predictions' | 'fantasy';
