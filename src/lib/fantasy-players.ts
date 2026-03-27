// Fantasy player pool with roles and pricing for IPL 2026
// Prices: 4.0 - 14.0 credits (steps of 0.5)
// Tiers: elite (12-14), premium (9-11), standard (6-8.5), economy (4-5.5)
// Total budget: 100 credits for 15 players

import type { FantasyPoolPlayer, PlayerRole, AuctionPlayer, AuctionSet } from '@/types/fantasy';
import { AUCTION_SETS, AUCTION_SET_ORDER } from '@/types/fantasy';
import { IPL_PLAYERS, IPL_TEAMS } from '@/lib/ipl2026';

// ─── Role assignments for all IPL 2026 players ───
// Format: [playerName, role, price, isForeign]
type PlayerData = [string, PlayerRole, number, boolean];

const PLAYER_DATA: Record<string, PlayerData[]> = {
  'Chennai Super Kings': [
    ['Ruturaj Gaikwad', 'BAT', 10, false],
    ['MS Dhoni', 'WK', 9, false],
    ['Sanju Samson', 'WK', 10.5, false],
    ['Shivam Dube', 'AR', 8.5, false],
    ['Noor Ahmad', 'BOWL', 7, true],
    ['Rahul Chahar', 'BOWL', 7, false],
    ['Dewald Brevis', 'BAT', 7.5, true],
    ['Khaleel Ahmed', 'BOWL', 7, false],
    ['Ayush Mhatre', 'BAT', 6.5, false],
    ['Ramakrishna Ghosh', 'WK', 5, false],
    ['Mukesh Choudhary', 'BOWL', 5.5, false],
    ['Urvil Patel', 'BAT', 5, false],
    ['Anshul Kamboj', 'AR', 5.5, false],
    ['Shreyas Gopal', 'BOWL', 5.5, false],
    ['Spencer Johnson', 'BOWL', 7, true],
    ['Jamie Overton', 'AR', 7, true],
    ['Prashant Veer', 'BOWL', 4, false],
    ['Kartik Sharma', 'BOWL', 4, false],
    ['Matthew Short', 'AR', 6.5, true],
    ['Sarfaraz Khan', 'BAT', 6, false],
    ['Zakary Foulkes', 'BOWL', 4.5, true],
    ['Matt Henry', 'BOWL', 7.5, true],
    ['Akeal Hosein', 'BOWL', 6, true],
    ['Gurjapneet Singh', 'BOWL', 4.5, false],
  ],
  'Mumbai Indians': [
    ['Hardik Pandya', 'AR', 11, false],
    ['Rohit Sharma', 'BAT', 12, false],
    ['Suryakumar Yadav', 'BAT', 12, false],
    ['Tilak Varma', 'BAT', 9.5, false],
    ['Ryan Rickelton', 'BAT', 7, true],
    ['Jasprit Bumrah', 'BOWL', 13, false],
    ['Trent Boult', 'BOWL', 10, true],
    ['Corbin Bosch', 'AR', 6, true],
    ['Naman Dhir', 'BAT', 6, false],
    ['Will Jacks', 'AR', 9, true],
    ['Robin Minz', 'WK', 5, false],
    ['Raj Bawa', 'AR', 5, false],
    ['Raghu Sharma', 'BAT', 4, false],
    ['Mitchell Santner', 'AR', 7.5, true],
    ['AM Ghazanfar', 'BOWL', 5.5, true],
    ['Ashwani Kumar', 'BOWL', 4, false],
    ['Deepak Chahar', 'BOWL', 8, false],
    ['Shardul Thakur', 'AR', 7, false],
    ['Sherfane Rutherford', 'BAT', 6, true],
    ['Mayank Markande', 'BOWL', 4.5, false],
    ['Quinton de Kock', 'WK', 9.5, true],
    ['Danish Malewar', 'BAT', 4, false],
    ['Mohammed Salahuddin Izhar', 'BOWL', 4, false],
    ['Atharva Ankolekar', 'AR', 4.5, false],
    ['Mayank Rawat', 'BAT', 4, false],
  ],
  'Royal Challengers Bengaluru': [
    ['Virat Kohli', 'BAT', 14, false],
    ['Philip Salt', 'WK', 10, true],
    ['Rajat Patidar', 'BAT', 8.5, false],
    ['Devdutt Padikkal', 'BAT', 7, false],
    ['Jitesh Sharma', 'WK', 6.5, false],
    ['Krunal Pandya', 'AR', 7.5, false],
    ['Venkatesh Iyer', 'AR', 7.5, false],
    ['Josh Hazlewood', 'BOWL', 10, true],
    ['Nuwan Thushara', 'BOWL', 6.5, true],
    ['Suyash Sharma', 'BOWL', 5, false],
    ['Abhinandan Singh', 'BOWL', 4, false],
    ['Rasikh Salam Dar', 'BOWL', 5.5, false],
    ['Swapnil Singh', 'AR', 5, false],
    ['Tim David', 'BAT', 8, true],
    ['Jacob Bethell', 'AR', 8, true],
    ['Romario Shepherd', 'AR', 6, true],
    ['Jacob Duffy', 'BOWL', 5, true],
    ['Mangesh Yadav', 'BOWL', 4, false],
    ['Satvik Deswal', 'WK', 4, false],
    ['Vicky Ostwal', 'BOWL', 4.5, false],
    ['Vihaan Malhotra', 'BAT', 4, false],
    ['Kanishk Chouhan', 'BOWL', 4, false],
    ['Jordan Cox', 'BAT', 5, true],
    ['Bhuvneshwar Kumar', 'BOWL', 7.5, false],
  ],
  'Kolkata Knight Riders': [
    ['Ajinkya Rahane', 'BAT', 7.5, false],
    ['Rinku Singh', 'BAT', 9, false],
    ['Angkrish Raghuvanshi', 'BAT', 5.5, false],
    ['Manish Pandey', 'BAT', 5.5, false],
    ['Rovman Powell', 'BAT', 7, true],
    ['Sunil Narine', 'AR', 10.5, true],
    ['Ramandeep Singh', 'AR', 6, false],
    ['Anukul Roy', 'AR', 5, false],
    ['Varun Chakaravarthy', 'BOWL', 9, false],
    ['Vaibhav Arora', 'BOWL', 6.5, false],
    ['Umran Malik', 'BOWL', 6.5, false],
    ['Cameron Green', 'AR', 8, true],
    ['Finn Allen', 'WK', 6.5, true],
    ['Matheesha Pathirana', 'BOWL', 8.5, true],
    ['Rachin Ravindra', 'AR', 7.5, true],
    ['Tejasvi Dahiya', 'WK', 4, false],
    ['Kartik Tyagi', 'BOWL', 5, false],
    ['Prashant Solanki', 'BOWL', 4, false],
    ['Daksh Kamra', 'BAT', 4, false],
    ['Sarthak Ranjan', 'BAT', 4, false],
    ['Rahul Tripathi', 'BAT', 6.5, false],
    ['Tim Seifert', 'WK', 5, true],
    ['Blessing Muzarabani', 'BOWL', 5.5, true],
    ['Saurabh R Dubey', 'BAT', 4, false],
  ],
  'Delhi Capitals': [
    ['Axar Patel', 'AR', 9, false],
    ['KL Rahul', 'WK', 11.5, false],
    ['Abishek Porel', 'WK', 6, false],
    ['Tristan Stubbs', 'BAT', 7, true],
    ['Karun Nair', 'BAT', 7.5, false],
    ['Sameer Rizvi', 'BAT', 5.5, false],
    ['Ashutosh Sharma', 'AR', 5.5, false],
    ['Vipraj Nigam', 'AR', 4.5, false],
    ['Madhav Tiwari', 'BAT', 4.5, false],
    ['Tripurana Vijay', 'BAT', 4, false],
    ['Ajay Jadav Mandal', 'AR', 4, false],
    ['Kuldeep Yadav', 'BOWL', 9, false],
    ['Mitchell Starc', 'BOWL', 11, true],
    ['T Natarajan', 'BOWL', 7, false],
    ['Mukesh Kumar', 'BOWL', 6, false],
    ['Dushmantha Chameera', 'BOWL', 5.5, true],
    ['Nitish Rana', 'BAT', 6, false],
    ['David Miller', 'BAT', 8, true],
    ['Auqib Nabi Dar', 'BOWL', 4, false],
    ['Pathum Nissanka', 'BAT', 7, true],
    ['Lungi Ngidi', 'BOWL', 7.5, true],
    ['Sahil Parakh', 'BOWL', 4, false],
    ['Prithvi Shaw', 'BAT', 6, false],
    ['Kyle Jamieson', 'BOWL', 6, true],
  ],
  'Rajasthan Royals': [
    ['Riyan Parag', 'AR', 8.5, false],
    ['Yashasvi Jaiswal', 'BAT', 12.5, false],
    ['Vaibhav Sooryavanshi', 'BAT', 5.5, false],
    ['Shimron Hetmyer', 'BAT', 7.5, true],
    ['Shubham Dubey', 'BAT', 5, false],
    ['Aman Rao Perala', 'BAT', 4, false],
    ['Lhuan-dre Pretorius', 'AR', 5.5, true],
    ['Ravi Singh', 'BAT', 4, false],
    ['Dhruv Jurel', 'WK', 7, false],
    ['Donovan Ferreira', 'AR', 5, true],
    ['Ravindra Jadeja', 'AR', 10, false],
    ['Dasun Shanaka', 'AR', 6, true],
    ['Ravi Bishnoi', 'BOWL', 7, false],
    ['Adam Milne', 'BOWL', 5.5, true],
    ['Kuldeep Sen', 'BOWL', 5, false],
    ['Sushant Mishra', 'BOWL', 4.5, false],
    ['Yash Raj Punja', 'AR', 4, false],
    ['Vignesh Puthur', 'BOWL', 4, false],
    ['Brijesh Sharma', 'WK', 4, false],
    ['Yudhvir Singh Charak', 'AR', 4, false],
    ['Jofra Archer', 'BOWL', 11, true],
    ['Kwena Maphaka', 'BOWL', 5.5, true],
    ['Nandre Burger', 'BOWL', 6, true],
    ['Tushar Deshpande', 'BOWL', 6.5, false],
    ['Sandeep Sharma', 'BOWL', 5.5, false],
  ],
  'Punjab Kings': [
    ['Shreyas Iyer', 'BAT', 11, false],
    ['Nehal Wadhera', 'BAT', 6, false],
    ['Priyansh Arya', 'WK', 5.5, false],
    ['Pyla Avinash', 'BAT', 4, false],
    ['Musheer Khan', 'AR', 6, false],
    ['Harnoor Singh', 'BAT', 4.5, false],
    ['Prabhsimran Singh', 'WK', 5, false],
    ['Vishnu Vinod', 'WK', 4.5, false],
    ['Marcus Stoinis', 'AR', 9, true],
    ['Marco Jansen', 'AR', 9.5, true],
    ['Shashank Singh', 'BAT', 6.5, false],
    ['Azmatullah Omarzai', 'AR', 7, true],
    ['Harpreet Brar', 'AR', 6, false],
    ['Suryansh Shedge', 'AR', 5, false],
    ['Mitchell Owen', 'BAT', 5, true],
    ['Arshdeep Singh', 'BOWL', 9, false],
    ['Yuzvendra Chahal', 'BOWL', 8.5, false],
    ['Lockie Ferguson', 'BOWL', 9, true],
    ['Vijaykumar Vyshak', 'BOWL', 6, false],
    ['Yash Thakur', 'BOWL', 5.5, false],
    ['Xavier Bartlett', 'BOWL', 6, true],
    ['Ben Dwarshuis', 'BOWL', 5.5, true],
    ['Cooper Connolly', 'AR', 5, true],
    ['Praveen Dubey', 'AR', 4.5, false],
    ['Vishal Nishad', 'BOWL', 4, false],
  ],
  'SunRisers Hyderabad': [
    ['Pat Cummins', 'BOWL', 12, true],
    ['Travis Head', 'BAT', 12, true],
    ['Abhishek Sharma', 'AR', 9, false],
    ['Aniket Verma', 'BAT', 4.5, false],
    ['Ishan Kishan', 'WK', 9, false],
    ['Heinrich Klaasen', 'WK', 12, true],
    ['Nitish Kumar Reddy', 'AR', 8.5, false],
    ['Harshal Patel', 'BOWL', 8, false],
    ['Brydon Carse', 'BOWL', 7, true],
    ['Jaydev Unadkat', 'BOWL', 5.5, false],
    ['Kamindu Mendis', 'AR', 7.5, true],
    ['Harsh Dubey', 'BOWL', 4.5, false],
    ['Eshan Malinga', 'BOWL', 4, false],
    ['Zeeshan Ansari', 'BOWL', 4, false],
    ['Shivang Kumar', 'BOWL', 4, false],
    ['Salil Arora', 'BAT', 4, false],
    ['Sakib Hussain', 'BOWL', 4, false],
    ['Onkar Tukaram Tarmale', 'BAT', 4, false],
    ['Amit Kumar', 'BAT', 4, false],
    ['Praful Hinge', 'BAT', 4, false],
    ['Krains Fuletra', 'BAT', 4, false],
    ['Liam Livingstone', 'AR', 8, true],
    ['Shivam Mavi', 'BOWL', 5.5, false],
    ['David Payne', 'BOWL', 5, true],
    ['Smaran Ravichandran', 'BAT', 4, false],
  ],
  'Gujarat Titans': [
    ['Shubman Gill', 'BAT', 12.5, false],
    ['Sai Sudharsan', 'BAT', 8.5, false],
    ['Jos Buttler', 'WK', 11.5, true],
    ['Rashid Khan', 'BOWL', 11, true],
    ['Kagiso Rabada', 'BOWL', 11, true],
    ['Glenn Phillips', 'WK', 7.5, true],
    ['Mohammed Siraj', 'BOWL', 8.5, false],
    ['Washington Sundar', 'AR', 7.5, false],
    ['Prasidh Krishna', 'BOWL', 7, false],
    ['Ravisrinivasan Sai Kishore', 'BOWL', 6.5, false],
    ['M Shahrukh Khan', 'BAT', 6, false],
    ['Rahul Tewatia', 'AR', 6.5, false],
    ['Ishant Sharma', 'BOWL', 5, false],
    ['Jayant Yadav', 'AR', 5.5, false],
    ['Manav Suthar', 'BOWL', 5.5, false],
    ['Kumar Kushagra', 'WK', 4.5, false],
    ['Anuj Rawat', 'WK', 5, false],
    ['Gurnoor Brar', 'AR', 5, false],
    ['Arshad Khan', 'BOWL', 4.5, false],
    ['Nishant Sindhu', 'AR', 4.5, false],
    ['Jason Holder', 'AR', 7.5, true],
    ['Tom Banton', 'WK', 5, true],
    ['Ashok Sharma', 'BOWL', 4, false],
    ['Luke Wood', 'BOWL', 5, true],
    ['Prithvi Raj Yarra', 'BAT', 4, false],
  ],
  'Lucknow Super Giants': [
    ['Rishabh Pant', 'WK', 13, false],
    ['Nicholas Pooran', 'WK', 10, true],
    ['Mitchell Marsh', 'AR', 9, true],
    ['Aiden Markram', 'BAT', 7.5, true],
    ['Ayush Badoni', 'BAT', 7, false],
    ['Abdul Samad', 'BAT', 5.5, false],
    ['Matthew Breetzke', 'BAT', 5, true],
    ['Himmat Singh', 'BAT', 4.5, false],
    ['Shahbaz Ahmed', 'AR', 6, false],
    ['Arshin Kulkarni', 'AR', 5.5, false],
    ['Mayank Prabhu Yadav', 'BOWL', 4.5, false],
    ['Avesh Khan', 'BOWL', 7, false],
    ['Mohsin Khan', 'BOWL', 6, false],
    ['Manimaran Siddharth', 'BOWL', 5.5, false],
    ['Digvesh Singh Rathi', 'BOWL', 4, false],
    ['Prince Yadav', 'BOWL', 4, false],
    ['Akash Maharaj Singh', 'BAT', 4, false],
    ['Mohammed Shami', 'BOWL', 10, false],
    ['Arjun Sachin Tendulkar', 'BOWL', 4.5, false],
    ['Josh Inglis', 'WK', 6, true],
    ['Mukul Choudhary', 'BOWL', 4, false],
    ['Akshat Raghuwanshi', 'BAT', 4, false],
    ['Anrich Nortje', 'BOWL', 8.5, true],
    ['Wanindu Hasaranga', 'AR', 8.5, true],
    ['Naman Tiwari', 'BAT', 4, false],
  ],
};

// ─── Helper to generate player ID ───
function makePlayerId(teamShort: string, playerName: string): string {
  return `${teamShort}_${playerName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

// ─── Helper to get tier from price ───
function getTier(price: number): FantasyPoolPlayer['tier'] {
  if (price >= 12) return 'elite';
  if (price >= 9) return 'premium';
  if (price >= 6) return 'standard';
  return 'economy';
}

// ─── Build the full fantasy player pool ───
export function buildFantasyPlayerPool(): FantasyPoolPlayer[] {
  const pool: FantasyPoolPlayer[] = [];

  for (const team of IPL_TEAMS) {
    const teamData = PLAYER_DATA[team.name];
    if (!teamData) continue;

    for (const [name, role, price, isForeign] of teamData) {
      pool.push({
        id: makePlayerId(team.shortName, name),
        name,
        team: team.name,
        teamShort: team.shortName,
        role,
        price,
        isForeign,
        tier: getTier(price),
      });
    }
  }

  return pool;
}

// ─── Pre-built pool (cached) ───
let _cachedPool: FantasyPoolPlayer[] | null = null;

export function getFantasyPlayerPool(): FantasyPoolPlayer[] {
  if (!_cachedPool) {
    _cachedPool = buildFantasyPlayerPool();
  }
  return _cachedPool;
}

// ─── Lookup helpers ───
export function getFantasyPlayer(playerId: string): FantasyPoolPlayer | undefined {
  return getFantasyPlayerPool().find(p => p.id === playerId);
}

export function getFantasyPlayersByTeam(teamName: string): FantasyPoolPlayer[] {
  return getFantasyPlayerPool().filter(p => p.team === teamName);
}

export function getFantasyPlayersByRole(role: PlayerRole): FantasyPoolPlayer[] {
  return getFantasyPlayerPool().filter(p => p.role === role);
}

export function getFantasyPlayersByTier(tier: FantasyPoolPlayer['tier']): FantasyPoolPlayer[] {
  return getFantasyPlayerPool().filter(p => p.tier === tier);
}

// ─── Validation helpers ───
export const FANTASY_BUDGET = 100;
export const FANTASY_SQUAD_SIZE = 15;
export const FANTASY_XI_SIZE = 11;
export const FANTASY_MAX_PER_TEAM = 3;
export const BID_INCREMENT = 0.25;
export const TIMER_DURATION = 15; // seconds


// ─── Shuffle array (Fisher-Yates) ───
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Build auction player order (grouped by role and tier, shuffled within each) ───
export function buildAuctionPlayerOrder(): AuctionPlayer[] {
  const pool = getFantasyPlayerPool();
  const result: AuctionPlayer[] = [];
  let order = 0;

  for (const setKey of AUCTION_SET_ORDER) {
    const setConfig = AUCTION_SETS[setKey];
    const { role, tier } = setConfig;

    // Get all players of this role, sorted by price descending
    const rolePlayers = pool.filter(p => p.role === role).sort((a, b) => b.price - a.price);

    // Split into tiers: marquee (top 10), set2 (next 10), set3 (rest)
    let playersInSet: FantasyPoolPlayer[];
    if (tier === 'marquee') {
      playersInSet = rolePlayers.slice(0, 10);
    } else if (tier === 'set2') {
      playersInSet = rolePlayers.slice(10, 20);
    } else {
      playersInSet = rolePlayers.slice(20);
    }

    const shuffled = shuffle(playersInSet);

    for (const player of shuffled) {
      result.push({
        playerId: player.id,
        name: player.name,
        team: player.team,
        teamShort: player.teamShort,
        role: player.role,
        isForeign: player.isForeign,
        set: setKey,
        basePrice: setConfig.basePrice,
        order: order++,
      });
    }
  }

  return result;
}

// ─── Get players for a specific auction set ───
export function getAuctionSetPlayers(set: AuctionSet): FantasyPoolPlayer[] {
  const pool = getFantasyPlayerPool();
  const setConfig = AUCTION_SETS[set];
  const { role, tier } = setConfig;
  const rolePlayers = pool.filter(p => p.role === role).sort((a, b) => b.price - a.price);

  if (tier === 'marquee') return rolePlayers.slice(0, 10);
  if (tier === 'set2') return rolePlayers.slice(10, 20);
  return rolePlayers.slice(20);
}
