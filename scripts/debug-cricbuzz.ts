/**
 * Debug: try ALL Cricbuzz scorecard paths and show what works.
 * Run with: npx tsx scripts/debug-cricbuzz.ts
 */

import * as cheerio from 'cheerio';

const MATCH_ID = 149618;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function tryFetch(label: string, url: string) {
  console.log(`\n=== ${label} ===`);
  console.log('URL:', url);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/json,*/*', Referer: 'https://www.cricbuzz.com' },
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Length:', text.length);
    if (text.length === 0) { console.log('(empty)'); return null; }
    if (text.length < 200) { console.log('Body:', text); return null; }
    return text;
  } catch (err: any) {
    console.log('Error:', err.message);
    return null;
  }
}

async function main() {
  // 1. HTML scorecard API
  await tryFetch('HTML API', `https://www.cricbuzz.com/api/html/cricket-scorecard/${MATCH_ID}`);

  // 2. JSON full-scorecard
  await tryFetch('JSON full-scorecard', `https://www.cricbuzz.com/api/cricket-match/${MATCH_ID}/full-scorecard`);

  // 3. JSON scorecard
  await tryFetch('JSON scorecard', `https://www.cricbuzz.com/api/cricket-match/${MATCH_ID}/scorecard`);

  // 4. JSON commentary (sometimes has scorecard)
  await tryFetch('JSON commentary', `https://www.cricbuzz.com/api/cricket-match/${MATCH_ID}/commentary`);

  // 5. RSC page - the main fallback
  const rscUrl = `https://www.cricbuzz.com/live-cricket-scorecard/${MATCH_ID}/match`;
  const rscHtml = await tryFetch('RSC page', rscUrl);

  if (rscHtml) {
    // Check if it has RSC payloads
    const hasRSC = rscHtml.includes('self.__next_f.push');
    console.log('Has RSC payloads:', hasRSC);

    if (hasRSC) {
      // Extract RSC payloads
      const payloads: string[] = [];
      const regex = /self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g;
      let m;
      while ((m = regex.exec(rscHtml)) !== null) {
        try { payloads.push(JSON.parse(`"${m[1]}"`)); } catch { payloads.push(m[1]); }
      }
      const payload = payloads.join('');
      console.log('Combined payload length:', payload.length);

      // Search for scorecard-related keys
      for (const key of ['scoreCard', 'scorecard', 'batsmenData', 'batTeamDetails', 'outDec', 'dismissal', 'batName']) {
        const idx = payload.indexOf(key);
        console.log(`  "${key}" found:`, idx !== -1 ? `yes (at index ${idx})` : 'no');
        if (idx !== -1 && key === 'outDec') {
          // Show context around outDec
          console.log('    context:', payload.substring(Math.max(0, idx - 20), idx + 80));
        }
        if (idx !== -1 && key === 'batName') {
          console.log('    context:', payload.substring(Math.max(0, idx - 20), idx + 80));
        }
      }

      // Try to find and parse scoreCard JSON
      for (const key of ['scoreCard', 'scorecard']) {
        const idx = payload.indexOf(`"${key}"`);
        if (idx === -1) continue;

        // Find the containing object
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
          const scArray = data.scoreCard || data.scorecard || [];
          console.log(`\nParsed ${key}: ${scArray.length} innings`);
          if (scArray.length > 0) {
            const inn = scArray[0];
            console.log('Innings 1 keys:', Object.keys(inn));
            const batData = inn.batTeamDetails?.batsmenData || inn.batsmen || {};
            const batEntries = typeof batData === 'object' && !Array.isArray(batData) ? Object.values(batData) : batData;
            if (batEntries.length > 0) {
              console.log('\nFirst 2 batters FULL data:');
              console.log(JSON.stringify(batEntries[0], null, 2));
              if (batEntries[1]) console.log(JSON.stringify(batEntries[1], null, 2));
            }
          }
        } catch (e: any) {
          console.log(`Failed to parse ${key} JSON:`, e.message);
        }
      }
    }

    // Also try parsing as regular HTML (maybe Cricbuzz serves server-rendered HTML now)
    const $ = cheerio.load(rscHtml);
    const tables = $('table');
    console.log('\nHTML tables found:', tables.length);

    // Look for any element with dismissal-like text
    const allText = $.text();
    const caughtMatch = allText.match(/c [A-Z][a-z]+ b [A-Z][a-z]+/);
    if (caughtMatch) console.log('Found dismissal-like text:', caughtMatch[0]);

    const bowledMatch = allText.match(/b [A-Z][a-z]+/);
    if (bowledMatch) console.log('Found bowled text:', bowledMatch[0]);

    // Check for Travis Head anywhere
    if (allText.includes('Travis Head')) {
      console.log('Travis Head found in page text');
      const idx = allText.indexOf('Travis Head');
      console.log('Context:', allText.substring(idx, idx + 150));
    }
  }
}

main().catch(console.error);
