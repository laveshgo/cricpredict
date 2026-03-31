/**
 * Quick check: what does startDate look like from Cricbuzz?
 * Run: npx tsx scripts/debug-dates.ts
 */

const SERIES_ID = 9237; // IPL 2025 - adjust if different
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function main() {
  const url = `https://www.cricbuzz.com/api/cricket-series/${SERIES_ID}/matches`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  const data = await res.json() as any;

  const matches = data.matchDetails?.flatMap((g: any) =>
    g.matchDetailsMap?.match || []
  ) || [];

  console.log(`Found ${matches.length} matches\n`);
  for (const m of matches.slice(0, 5)) {
    const match = m.matchInfo || m;
    console.log(`${match.matchDesc}: startDate=${match.startDate} startDt=${match.startDt} type=${typeof match.startDate}`);
    console.log(`  As number: ${new Date(Number(match.startDate || match.startDt))}`);
    console.log(`  As string: ${new Date(match.startDate || match.startDt)}`);
    console.log();
  }
}

main().catch(console.error);
