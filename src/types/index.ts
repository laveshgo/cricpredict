// =================== CORE TYPES ===================

export interface Tournament {
  id: string;
  name: string;               // "IPL 2026"
  shortName: string;           // "IPL"
  season: string;              // "2026"
  type: 'T20' | 'ODI' | 'Test';
  status: 'upcoming' | 'live' | 'completed';
  cricbuzzSeriesId?: string;   // e.g. "9241"
  startDate: string;           // ISO date
  endDate: string;
  teams: Team[];
  players: Record<string, string[]>; // teamName -> playerNames[]
  scoring: ScoringConfig;
  createdBy: string;           // userId
  createdAt: string;
  isPublic: boolean;           // visible on home page
  imageUrl?: string;
}

export interface Team {
  name: string;                // "Chennai Super Kings"
  shortName: string;           // "CSK"
  color: TeamColor;
}

export interface TeamColor {
  bg: string;
  text: string;
  accent: string;
}

export interface ScoringConfig {
  rankExact: number;
  rankOff1: number;
  rankOff2: number;
  winner: number;
  runnerUp: number;
  runsExact: number;
  runsPartial: number;
  wicketsExact: number;
  wicketsPartial: number;
  mvp: number;
  matchWinner?: number;        // points for correct match prediction
}

export const DEFAULT_SCORING: ScoringConfig = {
  rankExact: 10,
  rankOff1: 5,
  rankOff2: 2,
  winner: 25,
  runnerUp: 15,
  runsExact: 15,
  runsPartial: 5,
  wicketsExact: 15,
  wicketsPartial: 5,
  mvp: 30,
  matchWinner: 5,
};

// =================== GROUPS ===================

export interface Group {
  id: string;
  name: string;
  tournamentId: string;
  createdBy: string;           // userId
  createdAt: string;
  isPublic: boolean;           // anyone can discover & join
  memberUids: string[];        // UIDs of all members (single source of truth)
  settings: GroupSettings;
}

export interface GroupSettings {
  deadline: string;            // ISO datetime
  forceLocked: boolean;
  addLocked: boolean;          // admin can lock adding new participants
  memberLimit?: number | null; // max members allowed (min 2), null/undefined = unlimited
}

// =================== USERS ===================

export interface UserProfile {
  uid: string;
  username: string;            // unique, lowercase, public identity
  firstName: string;           // required
  lastName: string;            // optional (can be empty string)
  displayName: string;         // computed: "firstName lastName".trim()
  email: string;               // unique, optional for username-only signups
  emailVerified: boolean;
  photoURL?: string;
  authProvider: 'google' | 'email' | 'username'; // how they signed up
  createdAt: string;
}

// =================== PREDICTIONS ===================

export interface TournamentPrediction {
  id: string;
  groupId: string;
  tournamentId: string;
  userId: string;
  userName: string;
  teamRanking: string[];       // team names in predicted order
  winner: string;
  runnerUp: string;
  runs: string[];              // top 5 run scorers
  wickets: string[];           // top 5 wicket takers
  mvp: string;
  submittedAt: string;
  isLocked: boolean;
}

export interface MatchPrediction {
  id: string;
  groupId: string;
  matchId: string;
  tournamentId: string;
  userId: string;
  userName: string;
  predictedWinner: string;     // team name
  submittedAt: string;
}

// =================== MATCHES ===================

export interface Match {
  id: string;
  tournamentId: string;
  team1: string;
  team2: string;
  date: string;                // ISO datetime
  venue?: string;
  status: 'upcoming' | 'live' | 'completed';
  winner?: string;             // team name (filled after match)
  cricbuzzMatchId?: string;
}

// =================== ACTUAL RESULTS ===================

export interface ActualResults {
  groupId: string;
  tournamentId: string;
  teamRanking: string[];
  winner: string;
  runnerUp: string;
  runs: string[];
  wickets: string[];
  mvp: string;
  lastUpdated: string;
  teamQualifyStatus?: Record<string, 'Q' | 'E'>;  // from Cricbuzz: Q=qualified, E=eliminated
}

// =================== SCORES ===================

export interface ScoreBreakdown {
  ranking: number;
  winner: number;
  runnerUp: number;
  runs: number;
  wickets: number;
  mvp: number;
  matches: number;
  total: number;
  details: {
    ranking: Array<{ team: string; predicted: number; actual: number | string; pts: number }>;
    runs: Array<{ player: string; predicted: number; pts: number }>;
    wickets: Array<{ player: string; predicted: number; pts: number }>;
  };
}

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  photoURL?: string;
  score: ScoreBreakdown;
}
