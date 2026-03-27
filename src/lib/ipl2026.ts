// IPL 2026 tournament data — used as the default/seed tournament
import type { Tournament, Team, TeamColor } from '@/types';
import { DEFAULT_SCORING } from '@/types';

export const IPL_TEAM_COLORS: Record<string, TeamColor> = {
  'Chennai Super Kings': { bg: '#ffd700', text: '#1a1a2e', accent: '#f9a602' },
  'Mumbai Indians': { bg: '#004ba0', text: '#fff', accent: '#0078d7' },
  'Royal Challengers Bengaluru': { bg: '#d4213d', text: '#fff', accent: '#c41230' },
  'Kolkata Knight Riders': { bg: '#3a225d', text: '#fff', accent: '#7b3fe4' },
  'Delhi Capitals': { bg: '#004c93', text: '#fff', accent: '#ef1c25' },
  'Rajasthan Royals': { bg: '#ea1a85', text: '#fff', accent: '#254aa5' },
  'Punjab Kings': { bg: '#dd1f2d', text: '#fff', accent: '#a7a9ac' },
  'SunRisers Hyderabad': { bg: '#ff822a', text: '#000', accent: '#f7643b' },
  'Gujarat Titans': { bg: '#39b7e8', text: '#000', accent: '#5bcefa' },
  'Lucknow Super Giants': { bg: '#a72056', text: '#fff', accent: '#ffcc00' },
};

export const IPL_TEAMS: Team[] = [
  { name: 'Chennai Super Kings', shortName: 'CSK', color: IPL_TEAM_COLORS['Chennai Super Kings'] },
  { name: 'Mumbai Indians', shortName: 'MI', color: IPL_TEAM_COLORS['Mumbai Indians'] },
  { name: 'Royal Challengers Bengaluru', shortName: 'RCB', color: IPL_TEAM_COLORS['Royal Challengers Bengaluru'] },
  { name: 'Kolkata Knight Riders', shortName: 'KKR', color: IPL_TEAM_COLORS['Kolkata Knight Riders'] },
  { name: 'Delhi Capitals', shortName: 'DC', color: IPL_TEAM_COLORS['Delhi Capitals'] },
  { name: 'Rajasthan Royals', shortName: 'RR', color: IPL_TEAM_COLORS['Rajasthan Royals'] },
  { name: 'Punjab Kings', shortName: 'PBKS', color: IPL_TEAM_COLORS['Punjab Kings'] },
  { name: 'SunRisers Hyderabad', shortName: 'SRH', color: IPL_TEAM_COLORS['SunRisers Hyderabad'] },
  { name: 'Gujarat Titans', shortName: 'GT', color: IPL_TEAM_COLORS['Gujarat Titans'] },
  { name: 'Lucknow Super Giants', shortName: 'LSG', color: IPL_TEAM_COLORS['Lucknow Super Giants'] },
];

export const IPL_PLAYERS: Record<string, string[]> = {
  'Chennai Super Kings': ['Ruturaj Gaikwad','MS Dhoni','Sanju Samson','Shivam Dube','Noor Ahmad','Rahul Chahar','Dewald Brevis','Khaleel Ahmed','Ayush Mhatre','Ramakrishna Ghosh','Mukesh Choudhary','Urvil Patel','Anshul Kamboj','Shreyas Gopal','Spencer Johnson','Jamie Overton','Prashant Veer','Kartik Sharma','Matthew Short','Sarfaraz Khan','Zakary Foulkes','Matt Henry','Akeal Hosein','Gurjapneet Singh'],
  'Mumbai Indians': ['Hardik Pandya','Rohit Sharma','Suryakumar Yadav','Tilak Varma','Ryan Rickelton','Jasprit Bumrah','Trent Boult','Corbin Bosch','Naman Dhir','Will Jacks','Robin Minz','Raj Bawa','Raghu Sharma','Mitchell Santner','AM Ghazanfar','Ashwani Kumar','Deepak Chahar','Shardul Thakur','Sherfane Rutherford','Mayank Markande','Quinton de Kock','Danish Malewar','Mohammed Salahuddin Izhar','Atharva Ankolekar','Mayank Rawat'],
  'Royal Challengers Bengaluru': ['Virat Kohli','Philip Salt','Rajat Patidar','Devdutt Padikkal','Jitesh Sharma','Krunal Pandya','Venkatesh Iyer','Josh Hazlewood','Nuwan Thushara','Suyash Sharma','Abhinandan Singh','Rasikh Salam Dar','Swapnil Singh','Tim David','Jacob Bethell','Romario Shepherd','Jacob Duffy','Mangesh Yadav','Satvik Deswal','Vicky Ostwal','Vihaan Malhotra','Kanishk Chouhan','Jordan Cox','Bhuvneshwar Kumar'],
  'Kolkata Knight Riders': ['Ajinkya Rahane','Rinku Singh','Angkrish Raghuvanshi','Manish Pandey','Rovman Powell','Sunil Narine','Ramandeep Singh','Anukul Roy','Varun Chakaravarthy','Vaibhav Arora','Umran Malik','Cameron Green','Finn Allen','Matheesha Pathirana','Rachin Ravindra','Tejasvi Dahiya','Kartik Tyagi','Prashant Solanki','Daksh Kamra','Sarthak Ranjan','Rahul Tripathi','Tim Seifert','Blessing Muzarabani','Saurabh R Dubey'],
  'Delhi Capitals': ['Axar Patel','KL Rahul','Abishek Porel','Tristan Stubbs','Karun Nair','Sameer Rizvi','Ashutosh Sharma','Vipraj Nigam','Madhav Tiwari','Tripurana Vijay','Ajay Jadav Mandal','Kuldeep Yadav','Mitchell Starc','T Natarajan','Mukesh Kumar','Dushmantha Chameera','Nitish Rana','David Miller','Auqib Nabi Dar','Pathum Nissanka','Lungi Ngidi','Sahil Parakh','Prithvi Shaw','Kyle Jamieson'],
  'Rajasthan Royals': ['Riyan Parag','Yashasvi Jaiswal','Vaibhav Sooryavanshi','Shimron Hetmyer','Shubham Dubey','Aman Rao Perala','Lhuan-dre Pretorius','Ravi Singh','Dhruv Jurel','Donovan Ferreira','Ravindra Jadeja','Dasun Shanaka','Ravi Bishnoi','Adam Milne','Kuldeep Sen','Sushant Mishra','Yash Raj Punja','Vignesh Puthur','Brijesh Sharma','Yudhvir Singh Charak','Jofra Archer','Kwena Maphaka','Nandre Burger','Tushar Deshpande','Sandeep Sharma'],
  'Punjab Kings': ['Shreyas Iyer','Nehal Wadhera','Priyansh Arya','Pyla Avinash','Musheer Khan','Harnoor Singh','Prabhsimran Singh','Vishnu Vinod','Marcus Stoinis','Marco Jansen','Shashank Singh','Azmatullah Omarzai','Harpreet Brar','Suryansh Shedge','Mitchell Owen','Arshdeep Singh','Yuzvendra Chahal','Lockie Ferguson','Vijaykumar Vyshak','Yash Thakur','Xavier Bartlett','Ben Dwarshuis','Cooper Connolly','Praveen Dubey','Vishal Nishad'],
  'SunRisers Hyderabad': ['Pat Cummins','Travis Head','Abhishek Sharma','Aniket Verma','Ishan Kishan','Heinrich Klaasen','Nitish Kumar Reddy','Harshal Patel','Brydon Carse','Jaydev Unadkat','Kamindu Mendis','Harsh Dubey','Eshan Malinga','Zeeshan Ansari','Shivang Kumar','Salil Arora','Sakib Hussain','Onkar Tukaram Tarmale','Amit Kumar','Praful Hinge','Krains Fuletra','Liam Livingstone','Shivam Mavi','David Payne','Smaran Ravichandran'],
  'Gujarat Titans': ['Shubman Gill','Sai Sudharsan','Jos Buttler','Rashid Khan','Kagiso Rabada','Glenn Phillips','Mohammed Siraj','Washington Sundar','Prasidh Krishna','Ravisrinivasan Sai Kishore','M Shahrukh Khan','Rahul Tewatia','Ishant Sharma','Jayant Yadav','Manav Suthar','Kumar Kushagra','Anuj Rawat','Gurnoor Brar','Arshad Khan','Nishant Sindhu','Jason Holder','Tom Banton','Ashok Sharma','Luke Wood','Prithvi Raj Yarra'],
  'Lucknow Super Giants': ['Rishabh Pant','Nicholas Pooran','Mitchell Marsh','Aiden Markram','Ayush Badoni','Abdul Samad','Matthew Breetzke','Himmat Singh','Shahbaz Ahmed','Arshin Kulkarni','Mayank Prabhu Yadav','Avesh Khan','Mohsin Khan','Manimaran Siddharth','Digvesh Singh Rathi','Prince Yadav','Akash Maharaj Singh','Mohammed Shami','Arjun Sachin Tendulkar','Josh Inglis','Mukul Choudhary','Akshat Raghuwanshi','Anrich Nortje','Wanindu Hasaranga','Naman Tiwari'],
};

export const ALL_IPL_PLAYERS = Object.values(IPL_PLAYERS).flat().sort();

export function getPlayerTeam(playerName: string): string | null {
  for (const [team, players] of Object.entries(IPL_PLAYERS)) {
    if (players.includes(playerName)) return team;
  }
  return null;
}

export function getTeamByName(teamName: string): Team | undefined {
  return IPL_TEAMS.find(t => t.name === teamName);
}

// Seed tournament object for IPL 2026
export const IPL_2026_TOURNAMENT: Omit<Tournament, 'id' | 'createdBy' | 'createdAt'> = {
  name: 'IPL 2026',
  shortName: 'IPL',
  season: '2026',
  type: 'T20',
  status: 'live',
  cricbuzzSeriesId: '9241',
  startDate: '2026-03-22T00:00:00+05:30',
  endDate: '2026-05-25T00:00:00+05:30',
  teams: IPL_TEAMS,
  players: IPL_PLAYERS,
  scoring: DEFAULT_SCORING,
  isPublic: true,
};
