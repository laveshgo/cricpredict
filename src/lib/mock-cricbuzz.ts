/**
 * Mock Cricbuzz data for testing (IPL 2025 final standings).
 * Used when NEXT_PUBLIC_CRICBUZZ_MOCK=true or seriesId=mock.
 * Avoids burning RapidAPI quota during development.
 */

export const MOCK_POINTS_TABLE = {
  pointsTable: [
    {
      groupName: 'Teams',
      pointsTableInfo: [
        { teamId: 65, teamName: 'PBKS', teamFullName: 'Punjab Kings', matchesPlayed: 14, matchesWon: 9, matchesLost: 4, noRes: 1, points: 19, nrr: '+0.372', teamQualifyStatus: 'Q' },
        { teamId: 59, teamName: 'RCB', teamFullName: 'Royal Challengers Bengaluru', matchesPlayed: 14, matchesWon: 9, matchesLost: 4, noRes: 1, points: 19, nrr: '+0.301', teamQualifyStatus: 'Q' },
        { teamId: 971, teamName: 'GT', teamFullName: 'Gujarat Titans', matchesPlayed: 14, matchesWon: 9, matchesLost: 5, points: 18, nrr: '+0.254', teamQualifyStatus: 'Q' },
        { teamId: 62, teamName: 'MI', teamFullName: 'Mumbai Indians', matchesPlayed: 14, matchesWon: 8, matchesLost: 6, points: 16, nrr: '+1.142', teamQualifyStatus: 'Q' },
        { teamId: 61, teamName: 'DC', teamFullName: 'Delhi Capitals', matchesPlayed: 14, matchesWon: 7, matchesLost: 6, noRes: 1, points: 15, nrr: '+0.011', teamQualifyStatus: 'E' },
        { teamId: 255, teamName: 'SRH', teamFullName: 'Sunrisers Hyderabad', matchesPlayed: 14, matchesWon: 6, matchesLost: 7, noRes: 1, points: 13, nrr: '-0.241', teamQualifyStatus: 'E' },
        { teamId: 966, teamName: 'LSG', teamFullName: 'Lucknow Super Giants', matchesPlayed: 14, matchesWon: 6, matchesLost: 8, points: 12, nrr: '-0.376', teamQualifyStatus: 'E' },
        { teamId: 63, teamName: 'KKR', teamFullName: 'Kolkata Knight Riders', matchesPlayed: 14, matchesWon: 5, matchesLost: 7, noRes: 2, points: 12, nrr: '-0.305', teamQualifyStatus: 'E' },
        { teamId: 64, teamName: 'RR', teamFullName: 'Rajasthan Royals', matchesPlayed: 14, matchesWon: 4, matchesLost: 10, points: 8, nrr: '-0.549', teamQualifyStatus: 'E' },
        { teamId: 58, teamName: 'CSK', teamFullName: 'Chennai Super Kings', matchesPlayed: 14, matchesWon: 4, matchesLost: 10, points: 8, nrr: '-0.647', teamQualifyStatus: 'E' },
      ],
    },
  ],
};

export const MOCK_MOST_RUNS = {
  t20StatsList: {
    values: [
      { values: ['1', 'Virat Kohli', 'RCB', '16', '741', '52.92', '151.22'] },
      { values: ['2', 'Shubman Gill', 'GT', '16', '660', '44.00', '141.33'] },
      { values: ['3', 'Travis Head', 'SRH', '14', '567', '43.61', '183.17'] },
      { values: ['4', 'Shreyas Iyer', 'PBKS', '16', '551', '36.73', '149.59'] },
      { values: ['5', 'Jos Buttler', 'GT', '16', '541', '36.06', '156.06'] },
    ],
  },
};

export const MOCK_MOST_WICKETS = {
  t20StatsList: {
    values: [
      { values: ['1', 'Jasprit Bumrah', 'MI', '16', '27', '14.33', '7.39'] },
      { values: ['2', 'Kagiso Rabada', 'GT', '16', '24', '18.75', '8.33'] },
      { values: ['3', 'Arshdeep Singh', 'PBKS', '16', '19', '25.42', '8.66'] },
      { values: ['4', 'Varun Chakaravarthy', 'KKR', '14', '18', '22.66', '7.26'] },
      { values: ['5', 'Rashid Khan', 'GT', '16', '18', '24.00', '7.33'] },
    ],
  },
};
