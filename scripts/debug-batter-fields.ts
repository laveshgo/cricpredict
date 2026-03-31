/**
 * Debug: show ALL fields available on each batter and bowler from Cricbuzz.
 * Run with: npx tsx scripts/debug-batter-fields.ts [matchId]
 */

const MATCH_ID = parseInt(process.argv[2] || '149618', 10);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function main() {
  console.log(`\nFetching match ${MATCH_ID}...\n`);

  const url = `https://www.cricbuzz.com/live-cricket-scorecard/${MATCH_ID}/x`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,*/*', Referer: 'https://www.cricbuzz.com' },
  });
  const html = await res.text();

  const payloads: string[] = [];
  const regex = /self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    try { payloads.push(JSON.parse(`"${m[1]}"`)); } catch { payloads.push(m[1]); }
  }
  const payload = payloads.join('');

  for (const key of ['scoreCard', 'scorecard']) {
    const idx = payload.indexOf(`"${key}"`);
    if (idx === -1) continue;

    let braceCount = 0, startIdx = idx;
    for (let i = idx; i >= 0; i--) {
      if (payload[i] === '}') braceCount++;
      if (payload[i] === '{') { if (braceCount === 0) { startIdx = i; break; } braceCount--; }
    }
    braceCount = 0;
    let endIdx = startIdx;
    for (let i = startIdx; i < payload.length; i++) {
      if (payload[i] === '{') braceCount++;
      if (payload[i] === '}') { braceCount--; if (braceCount === 0) { endIdx = i + 1; break; } }
    }

    const data = JSON.parse(payload.substring(startIdx, endIdx));
    const scArray = data.scoreCard || data.scorecard || [];

    for (let innIdx = 0; innIdx < scArray.length; innIdx++) {
      const inn = scArray[innIdx];
      const teamName = inn.batTeamDetails?.batTeamShortName || `Inn ${innIdx + 1}`;

      // Show first 2 batters with ALL their fields
      const batData = inn.batTeamDetails?.batsmenData || {};
      const batEntries = typeof batData === 'object' && !Array.isArray(batData)
        ? Object.values(batData) : (Array.isArray(batData) ? batData : []);

      console.log(`\n${'='.repeat(60)}`);
      console.log(`${teamName} BATTING — showing first 2 batters (all fields):`);
      console.log('='.repeat(60));
      for (let i = 0; i < Math.min(2, batEntries.length); i++) {
        console.log(`\nBatter ${i + 1}:`, JSON.stringify(batEntries[i], null, 2));
      }

      // Show first 2 bowlers with ALL their fields
      const bowlData = inn.bowlTeamDetails?.bowlersData || {};
      const bowlEntries = typeof bowlData === 'object' && !Array.isArray(bowlData)
        ? Object.values(bowlData) : (Array.isArray(bowlData) ? bowlData : []);

      console.log(`\n${'-'.repeat(60)}`);
      console.log(`${teamName} innings — BOWLERS — showing first 2 bowlers (all fields):`);
      console.log('-'.repeat(60));
      for (let i = 0; i < Math.min(2, bowlEntries.length); i++) {
        console.log(`\nBowler ${i + 1}:`, JSON.stringify(bowlEntries[i], null, 2));
      }
    }
    return;
  }

  console.log('Could not find scoreCard data');
}

main().catch(console.error);
