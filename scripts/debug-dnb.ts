/**
 * Debug: check if Cricbuzz scorecard data includes "did not bat" players.
 * Fetches a completed match's RSC page, parses the JSON payload,
 * and logs all batting-related fields including noBatsman / yetToBat.
 *
 * Run with: npx tsx scripts/debug-dnb.ts [matchId]
 * Example:  npx tsx scripts/debug-dnb.ts 149618
 */

const MATCH_ID = parseInt(process.argv[2] || '149618', 10);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function main() {
  console.log(`\n🏏 Fetching Cricbuzz RSC scorecard for match ${MATCH_ID}...\n`);

  // Fetch RSC page
  const url = `https://www.cricbuzz.com/live-cricket-scorecard/${MATCH_ID}/x`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,*/*', Referer: 'https://www.cricbuzz.com' },
  });
  console.log('Status:', res.status);
  const html = await res.text();
  console.log('HTML length:', html.length);

  if (html.length < 500) {
    console.log('Body too short:', html.substring(0, 200));
    return;
  }

  // Extract RSC payloads
  const payloads: string[] = [];
  const regex = /self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    try {
      payloads.push(JSON.parse(`"${m[1]}"`));
    } catch {
      payloads.push(m[1]);
    }
  }
  const payload = payloads.join('');
  console.log('RSC payload length:', payload.length);

  // Find scoreCard data
  for (const key of ['scoreCard', 'scorecard', 'matchScoreDetails']) {
    const idx = payload.indexOf(`"${key}"`);
    if (idx === -1) continue;

    console.log(`\n✅ Found "${key}" at index ${idx}`);

    // Extract the JSON object containing this key
    let braceCount = 0;
    let startIdx = idx;
    for (let i = idx; i >= 0; i--) {
      if (payload[i] === '}') braceCount++;
      if (payload[i] === '{') {
        if (braceCount === 0) { startIdx = i; break; }
        braceCount--;
      }
    }

    braceCount = 0;
    let endIdx = startIdx;
    for (let i = startIdx; i < payload.length; i++) {
      if (payload[i] === '{') braceCount++;
      if (payload[i] === '}') {
        braceCount--;
        if (braceCount === 0) { endIdx = i + 1; break; }
      }
    }

    try {
      const data = JSON.parse(payload.substring(startIdx, endIdx));
      const scArray = data.scoreCard || data.scorecard || data.innings || [];

      console.log(`\nFound ${scArray.length} innings\n`);

      for (let innIdx = 0; innIdx < scArray.length; innIdx++) {
        const inn = scArray[innIdx];
        const teamName = inn.batTeamDetails?.batTeamName || inn.batTeamName || inn.team || `Innings ${innIdx + 1}`;
        const teamShort = inn.batTeamDetails?.batTeamShortName || inn.batTeamShortName || '';

        console.log(`\n${'='.repeat(60)}`);
        console.log(`INNINGS ${innIdx + 1}: ${teamName} (${teamShort})`);
        console.log('='.repeat(60));

        // Show batsmen who DID bat
        const batData = inn.batTeamDetails?.batsmenData || inn.batsmen || inn.batting || {};
        const batEntries = typeof batData === 'object' && !Array.isArray(batData)
          ? Object.values(batData) : (Array.isArray(batData) ? batData : []);

        console.log(`\n📊 Batters who batted: ${batEntries.length}`);
        for (const b of batEntries) {
          const bat = b as any;
          const name = bat.batName || bat.name || '?';
          console.log(`  ${name}: ${bat.runs ?? '?'}(${bat.balls ?? '?'}) - ${bat.outDesc || bat.outDec || bat.dismissal || '?'}`);
        }

        // Check ALL possible "did not bat" field names
        console.log('\n🔍 Checking for "did not bat" fields in innings object:');
        const dnbKeys = ['noBatsman', 'yetToBat', 'didNotBat', 'dnb', 'notBatted', 'yetToBatData'];
        for (const k of dnbKeys) {
          // Check in inn directly
          if (inn[k] !== undefined) {
            console.log(`  ✅ inn.${k}:`, JSON.stringify(inn[k], null, 2));
          }
          // Check in batTeamDetails
          if (inn.batTeamDetails?.[k] !== undefined) {
            console.log(`  ✅ inn.batTeamDetails.${k}:`, JSON.stringify(inn.batTeamDetails[k], null, 2));
          }
        }

        // Dump ALL keys of batTeamDetails to find any DNB-related field
        if (inn.batTeamDetails) {
          const btdKeys = Object.keys(inn.batTeamDetails);
          console.log(`\n📋 All batTeamDetails keys: [${btdKeys.join(', ')}]`);

          // Show any key that's NOT batsmenData and contains an array or object
          for (const k of btdKeys) {
            if (k === 'batsmenData') continue;
            const val = inn.batTeamDetails[k];
            if (typeof val === 'object' && val !== null) {
              console.log(`  📦 batTeamDetails.${k}:`, JSON.stringify(val, null, 2).substring(0, 500));
            } else if (typeof val === 'string' && val.length > 0) {
              console.log(`  📝 batTeamDetails.${k}: "${val}"`);
            }
          }
        }

        // Also dump ALL keys of the innings object itself
        const innKeys = Object.keys(inn);
        console.log(`\n📋 All innings keys: [${innKeys.join(', ')}]`);

        // Show any key that might contain player data (arrays/objects not already shown)
        for (const k of innKeys) {
          if (['batTeamDetails', 'bowlTeamDetails', 'scoreDetails', 'extrasData', 'partnershipsData', 'wicketsData'].includes(k)) continue;
          const val = inn[k];
          if (Array.isArray(val) && val.length > 0) {
            console.log(`  📦 inn.${k} (array, ${val.length} items):`, JSON.stringify(val[0], null, 2).substring(0, 300));
          } else if (typeof val === 'object' && val !== null) {
            console.log(`  📦 inn.${k}:`, JSON.stringify(val, null, 2).substring(0, 300));
          }
        }
      }

      // Also check the top-level keys of the data object
      console.log(`\n${'='.repeat(60)}`);
      console.log('TOP-LEVEL DATA KEYS:', Object.keys(data).join(', '));

      return; // Found what we needed
    } catch (err: any) {
      console.log('Parse error:', err.message);
    }
  }

  console.log('\n❌ Could not find scoreCard data in RSC payload');

  // Last resort: search for "noBat" or "yetToBat" anywhere in payload
  for (const needle of ['noBatsman', 'yetToBat', 'didNotBat', 'dnb']) {
    const idx2 = payload.indexOf(needle);
    if (idx2 !== -1) {
      console.log(`\n🔍 Found "${needle}" at payload index ${idx2}:`);
      console.log(payload.substring(Math.max(0, idx2 - 50), idx2 + 200));
    }
  }
}

main().catch(console.error);
