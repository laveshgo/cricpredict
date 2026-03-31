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
  // Playing XI
  playingXIPoints: number;              // +4 for being named in Starting XI

  // Batting - Base
  runPoints: number;                    // +1 per run
  fourBonus: number;                    // +4 boundary bonus
  sixBonus: number;                     // +6 six bonus
  duckPenalty: number;                  // -2 (only if batter is dismissed for 0)

  // Batting Milestones (highest only)
  milestone25: number;                  // +4
  milestone50: number;                  // +8
  milestone75: number;                  // +12
  milestone100: number;                 // +16

  // Strike Rate Bonus/Penalty (min 10 balls faced OR 20 runs)
  srAbove190: number;                   // +8
  sr170to190: number;                   // +6
  sr150to170: number;                   // +4
  sr130to150: number;                   // +2
  sr70to100: number;                    // -2
  sr60to70: number;                     // -4
  sr50to60: number;                     // -6

  // Bowling
  dotBallPoints: number;                // +2 per dot ball
  wicketPoints: number;                 // +30 per wicket (excluding run outs)
  lbwBowledBonus: number;               // +8 for LBW/bowled dismissal
  maidenPoints: number;                 // +12 per maiden over

  // Bowling Milestones (highest only)
  wickets3Bonus: number;                // +8
  wickets4Bonus: number;                // +12
  wickets5Bonus: number;                // +16

  // Economy Rate Bonus/Penalty (min 2 overs bowled)
  econBelow5: number;                   // +8
  econ5to6: number;                     // +6
  econ6to7: number;                     // +4
  econ7to8: number;                     // +2
  econ10to11: number;                   // -2
  econ11to12: number;                   // -4
  econAbove12: number;                  // -6

  // Fielding
  catchPoints: number;                  // +8
  threeCatchBonus: number;              // +4 (once per match if 3+ catches)
  runOutPoints: number;                 // +10
  stumpingPoints: number;               // +12

  // Captain / Vice-Captain
  captainMultiplier: number;
  vcMultiplier: number;
}

export const DEFAULT_FANTASY_SCORING: FantasyScoringRules = {
  // Playing XI
  playingXIPoints: 4,

  // Batting - Base
  runPoints: 1,
  fourBonus: 4,
  sixBonus: 6,
  duckPenalty: -2,

  // Batting Milestones (highest only)
  milestone25: 4,
  milestone50: 8,
  milestone75: 12,
  milestone100: 16,

  // Strike Rate (min 10 balls OR 20 runs)
  srAbove190: 8,
  sr170to190: 6,
  sr150to170: 4,
  sr130to150: 2,
  sr70to100: -2,
  sr60to70: -4,
  sr50to60: -6,

  // Bowling
  dotBallPoints: 2,
  wicketPoints: 30,
  lbwBowledBonus: 8,
  maidenPoints: 12,

  // Bowling Milestones (highest only)
  wickets3Bonus: 8,
  wickets4Bonus: 12,
  wickets5Bonus: 16,

  // Economy Rate (min 2 overs)
  econBelow5: 8,
  econ5to6: 6,
  econ6to7: 4,
  econ7to8: 2,
  econ10to11: -2,
  econ11to12: -4,
  econAbove12: -6,

  // Fielding
  catchPoints: 8,
  threeCatchBonus: 4,
  runOutPoints: 10,
  stumpingPoints: 12,

  // Captain / VC
  captainMultiplier: 2,
  vcMultiplier: 1.5,
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
  lbwWickets?: number;                 // wickets via LBW dismissal
  bowledWickets?: number;              // wickets via bowled dismissal

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

// =================== GLOBAL FLAT COLLECTIONS ===================
//
// Architecture (scalable across years/tournaments):
//   players/{id}              — global player registry
//   matches/{id}              — match fixtures/results (ref tournamentId)
//   matchScorecards/{id}      — full raw cricket scorecards (single source of truth)
//
// Per-player stats are precomputed into tournamentStats/{tournamentId} (materialized view)
// which is rebuilt server-side whenever admin refreshes matches.
// Fantasy points are calculated client-side from tournamentStats + league scoring rules.
// matchScorecards is the source of truth; tournamentStats is the derived cache.

export type MatchStatus = 'upcoming' | 'live' | 'completed' | 'no_result' | 'abandoned';

// ─── Global player registry ───
// players/{id} — one record per player, shared across all tournaments
export interface CricketPlayer {
  id: string;                      // stable ID: "virat-kohli" or cricbuzz player ID
  name: string;                    // "Virat Kohli"
  shortName?: string;              // "V Kohli" (as seen on scorecards)
  team: string;                    // current team full name
  teamShort: string;               // "RCB"
  role: PlayerRole;                // WK | BAT | AR | BOWL
  isForeign: boolean;
  imageUrl?: string;
  cricbuzzId?: number;             // cricbuzz player ID for linking

  // Denormalized for quick lookups
  tournaments: string[];           // tournamentIds this player is part of
}

// ─── Global match collection ───
// matches/{id} — one record per match, references a tournament
export interface CricketMatch {
  id: string;                      // cricbuzz matchId as string
  cricbuzzMatchId: number;
  tournamentId: string;            // which tournament this match belongs to
  matchDesc: string;               // "1st Match", "Qualifier 1", etc.
  matchNumber?: number;            // numeric match number in the tournament
  status: MatchStatus;
  statusText: string;              // "RCB Won by 5 Wkts"

  team1: { name: string; shortName: string; score?: string };
  team2: { name: string; shortName: string; score?: string };
  startDate: string;
  venue?: string;

  potm?: string;                   // Player of the match name
  innings?: Array<{
    team: string;
    teamShort: string;
    score: string;
    overs?: string;
  }>;

  // Metadata
  scorecardFetched: boolean;       // whether matchScorecards doc has been written
  fetchedAt?: string;
}

// ─── Per-player per-match stats (derived shape) ───
// NOT stored in Firestore — derived on-demand from matchScorecards.
// This type is the interface between the scorecard flattener and the fantasy calculator.
export interface PlayerMatchStatsDoc {
  id: string;                      // "{matchId}_{playerId}"
  playerId: string;                // references CricketPlayer.id
  playerName: string;              // denormalized for quick display
  matchId: string;                 // references CricketMatch.id
  tournamentId: string;            // for querying all stats in a tournament
  team: string;                    // team short name

  // Batting
  runs?: number;
  ballsFaced?: number;
  fours?: number;
  sixes?: number;
  isOut?: boolean;
  didBat?: boolean;

  // Bowling
  wickets?: number;
  oversBowled?: number;
  runsConceded?: number;
  maidens?: number;
  dotBalls?: number;
  didBowl?: boolean;
  lbwWickets?: number;                 // wickets via LBW dismissal
  bowledWickets?: number;              // wickets via bowled dismissal

  // Fielding
  catches?: number;
  stumpings?: number;
  runOuts?: number;

  // Awards
  isPotm?: boolean;
  inPlayingXI?: boolean;
}

// ─── Full match scorecard (stored in matchScorecards/{matchId}) ───
// This is the raw cricket scorecard — batting order, dismissals, bowling figures, etc.
// Single source of truth for all match stats. Per-player aggregates are derived from this.

export interface ScorecardBatterEntry {
  name: string;                    // "Virat Kohli"
  playerId?: string;               // stable ID if resolved
  battingPosition: number;         // 1-based order they came in
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  isOut: boolean;
  dismissal?: string;              // "c Pant b Bumrah", "run out (Jadeja)", "not out", "did not bat"
  wicketCode?: string;             // "lbw", "bowled", "caught", etc. from Cricbuzz
  impactSub?: 'in' | 'out';       // IPL impact player: "in" = subbed in, "out" = subbed out
  // Granular shot breakdown
  dots?: number;
  singles?: number;
  doubles?: number;
  triples?: number;
}

export interface ScorecardBowlerEntry {
  name: string;
  playerId?: string;
  overs: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
  economy: number;
  dotBalls?: number;
  noBalls?: number;
  wides?: number;
  impactSub?: 'in' | 'out';       // IPL impact player
}

export interface ScorecardFieldingEntry {
  name: string;
  playerId?: string;
  catches: number;
  stumpings: number;
  runOuts: number;
}

export interface ScorecardExtras {
  total: number;
  byes?: number;
  legByes?: number;
  wides?: number;
  noBalls?: number;
  penalty?: number;
}

export interface ScorecardFOW {
  wicketNumber: number;            // 1, 2, 3...
  runs: number;                    // team score at fall
  overs?: string;                  // "6.3"
  batterName?: string;             // who got out
}

export interface ScorecardInnings {
  team: string;                    // "Royal Challengers Bengaluru"
  teamShort: string;               // "RCB"
  score: string;                   // "185/5 (20)"
  overs?: string;                  // "20"
  batters: ScorecardBatterEntry[];
  bowlers: ScorecardBowlerEntry[];
  fielders: ScorecardFieldingEntry[];
  extras?: ScorecardExtras;
  fallOfWickets?: ScorecardFOW[];
}

export interface MatchScorecardDoc {
  id: string;                      // same as matchId
  matchId: string;
  tournamentId: string;
  matchDesc: string;
  statusText: string;
  team1: string;
  team2: string;
  potm?: string;
  innings: ScorecardInnings[];
  fetchedAt: string;
}

// ─── Legacy TournamentMatch (kept for backward compat during migration) ───
export interface TournamentMatch {
  id: string;
  cricbuzzMatchId: number;
  matchDesc: string;
  status: MatchStatus;
  statusText: string;
  team1: { name: string; shortName: string; score?: string };
  team2: { name: string; shortName: string; score?: string };
  startDate: string;
  weekNumber?: number;
  playerStats?: PlayerMatchStats[];
  potm?: string;
  innings?: Array<{
    team: string;
    teamShort: string;
    score: string;
    batterCount: number;
    bowlerCount: number;
  }>;
  fetchedAt?: string;
  scorecardAvailable?: boolean;
}

// ─── Materialized view: precomputed per-player stats ───
// tournamentStats/{tournamentId} — ONE doc per tournament, rebuilt on refresh.
// Source of truth is matchScorecards. This is the derived cache.
// Clients read this single doc instead of loading all scorecards.
export interface TournamentStatsDoc {
  id: string;                        // same as tournamentId
  tournamentId: string;
  stats: PlayerMatchStatsDoc[];      // flattened per-player per-match stats
  matchCount: number;                // how many scorecards were processed
  rebuiltAt: string;                 // ISO timestamp of last rebuild
}

// ─── Contest type enum (for tournament page) ───
export type ContestType = 'predictions' | 'fantasy';
