/**
 * Debug: show inMatchChange / playingXIChange values for all players.
 * These fields indicate IPL impact player substitutions.
 * Run with: npx tsx scripts/debug-impact.ts [matchId]
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

      console.log(`\n${'='.repeat(60)}`);
      console.log(`INNINGS ${innIdx + 1}: ${teamName}`);
      console.log('='.repeat(60));

      // Batters
      const batData = inn.batTeamDetails?.batsmenData || {};
      const batEntries = typeof batData === 'object' && !Array.isArray(batData)
        ? Object.values(batData) : (Array.isArray(batData) ? batData : []);

      console.log('\nBATTERS:');
      for (const b of batEntries) {
        const bat = b as any;
        const name = bat.batName || bat.name || '?';
        const imc = bat.inMatchChange || '';
        const pxc = bat.playingXIChange || '';
        const sub = bat.isSubstitute ?? '';
        if (imc || pxc || sub) {
          console.log(`  📌 ${name.padEnd(25)} inMatchChange="${imc}"  playingXIChange="${pxc}"  isSubstitute=${sub}`);
        } else {
          console.log(`     ${name.padEnd(25)} (no change flags)`);
        }
      }

      // Bowlers
      const bowlData = inn.bowlTeamDetails?.bowlersData || {};
      const bowlEntries = typeof bowlData === 'object' && !Array.isArray(bowlData)
        ? Object.values(bowlData) : (Array.isArray(bowlData) ? bowlData : []);

      console.log('\nBOWLERS:');
      for (const bw of bowlEntries) {
        const bowl = bw as any;
        const name = bowl.bowlName || bowl.name || '?';
        const imc = bowl.inMatchChange || '';
        const pxc = bowl.playingXIChange || '';
        const sub = bowl.isSubstitute ?? '';
        if (imc || pxc || sub) {
          console.log(`  📌 ${name.padEnd(25)} inMatchChange="${imc}"  playingXIChange="${pxc}"  isSubstitute=${sub}`);
        } else {
          console.log(`     ${name.padEnd(25)} (no change flags)`);
        }
      }
    }
    return;
  }

  console.log('Could not find scoreCard data');
}

main().catch(console.error);
