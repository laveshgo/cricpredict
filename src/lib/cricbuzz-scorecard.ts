/**
 * Cricbuzz match list + scorecard fetcher.
 * Uses Cricbuzz's internal APIs (no API key needed), same approach as cricbuzz-free.ts.
 *
 * Endpoints used:
 *   1. Match list:  https://www.cricbuzz.com/api/cricket-series/{seriesId}/matches
 *   2. Scorecard:   https://www.cricbuzz.com/api/html/cricket-scorecard/{matchId}
 *      Fallback:    RSC page scraping from /live-cricket-scorecard/{matchId}/...
 *
 * Returns structured PlayerMatchStats[] per match.
 */

import * as cheerio from 'cheerio';

// ---------- Types ----------

export interface CricbuzzMatch {
  matchId: number;
  matchDesc: string;       // "1st Match" etc.
  matchFormat: string;      // "T20"
  startDate: string;
  status: string;           // "Complete", "Live", "Upcoming"
  statusText: string;       // "RCB Won by 5 Wkts"
  team1: { id: number; name: string; shortName: string; score?: string };
  team2: { id: number; name: string; shortName: string; score?: string };
  venueId?: number;
  venueName?: string;
  seriesId: number;
}

export interface ScorecardBatter {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  isOut: boolean;
  dismissal?: string;
  wicketCode?: string;             // e.g. "lbw", "bowled", "caught", "" = not out/dnb
  impactSub?: 'in' | 'out';       // IPL impact player: "in" = subbed in, "out" = subbed out
  dots?: number;
  singles?: number;
  doubles?: number;
  triples?: number;
}

export interface ScorecardBowler {
  name: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  dotBalls?: number;
  noBalls?: number;
  wides?: number;
  impactSub?: 'in' | 'out';       // IPL impact player
}

export interface ScorecardFielder {
  name: string;
  catches: number;
  stumpings: number;
  runOuts: number;
}

export interface MatchScorecard {
  matchId: number;
  matchDesc: string;
  team1: string;
  team2: string;
  statusText: string;
  potm?: string;           // Player of the Match name
  innings: Array<{
    team: string;
    teamShort: string;
    score: string;          // "185/5 (20)"
    batters: ScorecardBatter[];
    bowlers: ScorecardBowler[];
    fielders: ScorecardFielder[];
  }>;
}

// ---------- Config ----------

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function cbHeaders(): HeadersInit {
  return {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/json,*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: 'https://www.cricbuzz.com',
  };
}

async function fetchWithTimeout(url: string, timeout = 10000): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, {
      headers: cbHeaders(),
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    return res;
  } catch (err: any) {
    console.warn(`[cricbuzz-scorecard] Fetch error for ${url}: ${err.message}`);
    return null;
  }
}

// ---------- Match List ----------

/**
 * Fetch the list of matches for a series.
 * Cricbuzz internal API: /api/cricket-series/{seriesId}/matches
 */
export async function fetchSeriesMatches(seriesId: string): Promise<CricbuzzMatch[]> {
  // Try the internal JSON API first
  const apiUrl = `https://www.cricbuzz.com/api/cricket-series/${seriesId}/matches`;
  const res = await fetchWithTimeout(apiUrl);

  if (res?.ok) {
    try {
      const data = await res.json();
      const matches = parseMatchListFromApi(data);
      if (matches.length > 0) {
        console.log(`[cricbuzz-scorecard] ✓ Match list API: ${matches.length} matches`);
        return matches;
      }
    } catch (err) {
      console.warn('[cricbuzz-scorecard] Failed to parse match list API response:', err);
    }
  }

  // Fallback: try the series schedule page (RSC scraping)
  const pageUrls = [
    `https://www.cricbuzz.com/cricket-series/${seriesId}/series/matches`,
    `https://www.cricbuzz.com/cricket-series/${seriesId}/indian-premier-league-2025/matches`,
  ];

  for (const url of pageUrls) {
    const pageRes = await fetchWithTimeout(url);
    if (!pageRes?.ok) continue;

    const html = await pageRes.text();
    if (!html.includes('self.__next_f.push')) continue;

    const matches = parseMatchListFromRSC(html);
    if (matches.length > 0) {
      console.log(`[cricbuzz-scorecard] ✓ Match list RSC: ${matches.length} matches`);
      return matches;
    }
  }

  console.warn('[cricbuzz-scorecard] Could not fetch match list');
  return [];
}

function parseMatchListFromApi(data: any): CricbuzzMatch[] {
  const matches: CricbuzzMatch[] = [];

  // Cricbuzz API structure: { matchDetails: [{ matchDetailsMap: { key, match: [...] } }] }
  // or: { typeMatches: [{ matchScheduleList: [{ matchScheduleMap: { match: [...] } }] }] }
  // The exact structure varies, so we handle multiple formats

  const addMatch = (m: any) => {
    if (!m?.matchId) return;
    const match: CricbuzzMatch = {
      matchId: m.matchId,
      matchDesc: m.matchDesc || m.matchDescription || '',
      matchFormat: m.matchFormat || 'T20',
      startDate: m.startDate || m.startDt || '',
      status: m.status || '',
      statusText: m.statusText || m.status || '',
      team1: {
        id: m.team1?.teamId || 0,
        name: m.team1?.teamName || m.team1?.teamSName || '',
        shortName: m.team1?.teamSName || m.team1?.teamName || '',
        score: m.team1?.score,
      },
      team2: {
        id: m.team2?.teamId || 0,
        name: m.team2?.teamName || m.team2?.teamSName || '',
        shortName: m.team2?.teamSName || m.team2?.teamName || '',
        score: m.team2?.score,
      },
      venueId: m.venueId,
      venueName: m.venueName,
      seriesId: m.seriesId || 0,
    };
    matches.push(match);
  };

  // Format 1: matchDetails array
  if (Array.isArray(data?.matchDetails)) {
    for (const detail of data.matchDetails) {
      const mapData = detail?.matchDetailsMap;
      if (mapData?.match) {
        for (const m of (Array.isArray(mapData.match) ? mapData.match : [mapData.match])) {
          addMatch(m?.matchInfo || m);
        }
      }
    }
  }

  // Format 2: typeMatches array
  if (Array.isArray(data?.typeMatches)) {
    for (const type of data.typeMatches) {
      for (const schedule of (type?.matchScheduleList || type?.seriesMatches || [])) {
        const map = schedule?.matchScheduleMap || schedule?.seriesAdWrapper;
        if (map?.match) {
          for (const m of (Array.isArray(map.match) ? map.match : [map.match])) {
            addMatch(m?.matchInfo || m);
          }
        }
        if (Array.isArray(map?.matches)) {
          for (const m of map.matches) addMatch(m?.matchInfo || m);
        }
      }
    }
  }

  // Format 3: flat matches array
  if (Array.isArray(data?.matches)) {
    for (const m of data.matches) addMatch(m?.matchInfo || m);
  }

  // Format 4: matchScheduleMap
  if (data?.matchScheduleMap?.match) {
    for (const m of (Array.isArray(data.matchScheduleMap.match) ? data.matchScheduleMap.match : [data.matchScheduleMap.match])) {
      addMatch(m?.matchInfo || m);
    }
  }

  return matches;
}

function parseMatchListFromRSC(html: string): CricbuzzMatch[] {
  // Extract RSC payloads and look for match data
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

  // Try to find matchDetails or similar structures
  for (const key of ['matchDetails', 'matchScheduleMap', 'typeMatches', 'matches']) {
    const idx = payload.indexOf(`"${key}"`);
    if (idx === -1) continue;

    // Extract the containing JSON object
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
      const matches = parseMatchListFromApi(data);
      if (matches.length > 0) return matches;
    } catch { /* continue */ }
  }

  return [];
}

// ---------- Scorecard ----------

/**
 * Fetch the full scorecard for a match.
 * Primary: Cricbuzz HTML scorecard API
 * Fallback: RSC page scraping
 */
export async function fetchMatchScorecard(matchId: number): Promise<MatchScorecard | null> {
  // Try the HTML scorecard API (returns HTML table)
  const apiUrl = `https://www.cricbuzz.com/api/html/cricket-scorecard/${matchId}`;
  const res = await fetchWithTimeout(apiUrl);

  if (res?.ok) {
    const html = await res.text();
    const scorecard = parseScorecardFromHtml(html, matchId);
    if (scorecard && scorecard.innings.length > 0) {
      console.log(`[cricbuzz-scorecard] ✓ Scorecard API: ${scorecard.innings.length} innings for match ${matchId}`);
      return scorecard;
    }
  }

  // Try the full scorecard JSON API
  const jsonApiUrl = `https://www.cricbuzz.com/api/cricket-match/${matchId}/full-scorecard`;
  const jsonRes = await fetchWithTimeout(jsonApiUrl);

  if (jsonRes?.ok) {
    try {
      const data = await jsonRes.json();
      const scorecard = parseScorecardFromJson(data, matchId);
      if (scorecard && scorecard.innings.length > 0) {
        console.log(`[cricbuzz-scorecard] ✓ Scorecard JSON API: ${scorecard.innings.length} innings for match ${matchId}`);
        return scorecard;
      }
    } catch { /* fall through */ }
  }

  // Fallback: RSC page scraping
  const pageUrl = `https://www.cricbuzz.com/live-cricket-scorecard/${matchId}/match`;
  const pageRes = await fetchWithTimeout(pageUrl);

  if (pageRes?.ok) {
    const html = await pageRes.text();
    if (html.includes('self.__next_f.push')) {
      const scorecard = parseScorecardFromRSC(html, matchId);
      if (scorecard && scorecard.innings.length > 0) {
        console.log(`[cricbuzz-scorecard] ✓ Scorecard RSC: ${scorecard.innings.length} innings for match ${matchId}`);
        return scorecard;
      }
    }
    // Also try parsing as regular HTML (the API endpoint might return HTML directly)
    const scorecard = parseScorecardFromHtml(html, matchId);
    if (scorecard && scorecard.innings.length > 0) {
      return scorecard;
    }
  }

  console.warn(`[cricbuzz-scorecard] Could not fetch scorecard for match ${matchId}`);
  return null;
}

function parseScorecardFromHtml(html: string, matchId: number): MatchScorecard | null {
  const $ = cheerio.load(html);
  const innings: MatchScorecard['innings'] = [];

  // Cricbuzz scorecard HTML has innings in div blocks with batting/bowling tables
  // Look for innings sections
  $('[id^="innings_"],.cb-scrd-itms,.scorecard-section,.innings-section').each(function () {
    const section = $(this);
    const teamName = section.find('.cb-scrd-hdr-rw,.innings-header,.scorecard-header').first().text().trim();
    const scoreText = section.find('.cb-scrd-hdr-rw .pull-right,.innings-score,.score-detail').first().text().trim();

    const batters: ScorecardBatter[] = [];
    const bowlers: ScorecardBowler[] = [];

    // Parse batting rows
    section.find('.cb-scrd-itms,.batting-row,.batsman-row').each(function () {
      const row = $(this);
      const cells = row.find('.cb-col,.cell,td');
      if (cells.length >= 6) {
        const name = cells.eq(0).text().trim();
        if (!name || name === 'Batter' || name === 'Batsman' || name.includes('Extras') || name.includes('Total')) return;

        const runs = parseInt(cells.eq(2).text().trim()) || 0;
        const balls = parseInt(cells.eq(3).text().trim()) || 0;
        const fours = parseInt(cells.eq(4).text().trim()) || 0;
        const sixes = parseInt(cells.eq(5).text().trim()) || 0;
        const sr = parseFloat(cells.eq(6).text().trim()) || 0;
        const dismissal = cells.eq(1).text().trim();

        batters.push({
          name: name.replace(/\(c\)|\(wk\)|\†/gi, '').trim(),
          runs,
          balls,
          fours,
          sixes,
          strikeRate: sr,
          isOut: !dismissal.toLowerCase().includes('not out'),
          dismissal,
        });
      }
    });

    // Parse bowling rows
    section.find('.cb-scrd-itms.cb-bowl,.bowling-row,.bowler-row').each(function () {
      const row = $(this);
      const cells = row.find('.cb-col,.cell,td');
      if (cells.length >= 5) {
        const name = cells.eq(0).text().trim();
        if (!name || name === 'Bowler' || name === 'Bowling') return;

        bowlers.push({
          name: name.replace(/\(c\)|\(wk\)|\†/gi, '').trim(),
          overs: parseFloat(cells.eq(1).text().trim()) || 0,
          maidens: parseInt(cells.eq(2).text().trim()) || 0,
          runs: parseInt(cells.eq(3).text().trim()) || 0,
          wickets: parseInt(cells.eq(4).text().trim()) || 0,
          economy: parseFloat(cells.eq(5).text().trim()) || 0,
        });
      }
    });

    if (batters.length > 0 || bowlers.length > 0) {
      innings.push({
        team: teamName || `Innings ${innings.length + 1}`,
        teamShort: teamName?.substring(0, 3).toUpperCase() || '',
        score: scoreText || '',
        batters,
        bowlers,
        fielders: extractFieldersFromDismissals(batters),
      });
    }
  });

  if (innings.length === 0) return null;

  // Try to find POTM
  let potm: string | undefined;
  const potmEl = $('[class*="potm"],.player-of-match,.cb-mom-itm');
  if (potmEl.length > 0) {
    potm = potmEl.find('.cb-font-18,.player-name,a').first().text().trim() || undefined;
  }

  return {
    matchId,
    matchDesc: '',
    team1: innings[0]?.team || '',
    team2: innings[1]?.team || innings[2]?.team || '',
    statusText: '',
    potm,
    innings,
  };
}

function parseScorecardFromJson(data: any, matchId: number): MatchScorecard | null {
  // Cricbuzz JSON scorecard structure
  const scorecard: MatchScorecard = {
    matchId,
    matchDesc: data.matchHeader?.matchDescription || '',
    team1: data.matchHeader?.team1?.name || '',
    team2: data.matchHeader?.team2?.name || '',
    statusText: data.matchHeader?.status || '',
    potm: data.matchHeader?.playersOfTheMatch?.[0]?.name ||
           data.matchHeader?.playerOfTheMatch?.name,
    innings: [],
  };

  // Scorecard data is usually in scoreCard array
  const scArray = data.scoreCard || data.scorecard || data.innings || [];
  for (const inn of (Array.isArray(scArray) ? scArray : [])) {
    const batters: ScorecardBatter[] = [];
    const bowlers: ScorecardBowler[] = [];

    // Parse batsmen
    const batData = inn.batTeamDetails?.batsmenData || inn.batsmen || inn.batting || {};
    const batEntries = typeof batData === 'object' && !Array.isArray(batData)
      ? Object.values(batData) : (Array.isArray(batData) ? batData : []);

    for (const b of batEntries) {
      const bat = b as any;
      if (!bat.batName && !bat.name) continue;
      const runs = bat.runs ?? bat.r ?? 0;
      const balls = bat.balls ?? bat.b ?? 0;
      const dismissalText = (bat.outDesc || bat.outDec || bat.dismissal || '').trim();
      const wicketCode = (bat.wicketCode || '').trim();
      // A player with 0(0), no dismissal text, and no wicketCode = did not bat
      const isDnb = runs === 0 && balls === 0 && !dismissalText && !wicketCode;
      const isOut = isDnb ? false
        : wicketCode ? true                                             // has a wicketCode = dismissed
        : dismissalText ? !dismissalText.toLowerCase().includes('not out')
        : (bat.isOut ?? false);
      batters.push({
        name: (bat.batName || bat.name || '').replace(/\(c\)|\(wk\)|\†/gi, '').trim(),
        runs,
        balls,
        fours: bat.fours ?? bat['4s'] ?? 0,
        sixes: bat.sixes ?? bat['6s'] ?? 0,
        strikeRate: bat.strikeRate ?? bat.sr ?? 0,
        isOut,
        dismissal: isDnb ? 'did not bat' : dismissalText,
        wicketCode: wicketCode || undefined,
        impactSub: bat.inMatchChange === 'MIN' ? 'in' : bat.inMatchChange === 'MOUT' ? 'out' : undefined,
        dots: bat.dots ?? undefined,
        singles: bat.ones ?? undefined,
        doubles: bat.twos ?? undefined,
        triples: bat.threes ?? undefined,
      });
    }

    // Parse bowlers
    const bowlData = inn.bowlTeamDetails?.bowlersData || inn.bowlers || inn.bowling || {};
    const bowlEntries = typeof bowlData === 'object' && !Array.isArray(bowlData)
      ? Object.values(bowlData) : (Array.isArray(bowlData) ? bowlData : []);

    for (const bw of bowlEntries) {
      const bowl = bw as any;
      if (!bowl.bowlName && !bowl.name) continue;
      bowlers.push({
        name: (bowl.bowlName || bowl.name || '').replace(/\(c\)|\(wk\)|\†/gi, '').trim(),
        overs: bowl.overs ?? bowl.o ?? 0,
        maidens: bowl.maidens ?? bowl.m ?? 0,
        runs: bowl.runs ?? bowl.r ?? 0,
        wickets: bowl.wickets ?? bowl.w ?? 0,
        economy: bowl.economy ?? bowl.econ ?? 0,
        dotBalls: bowl.dots ?? bowl.dotBalls ?? undefined,
        noBalls: bowl.no_balls ?? bowl.noBalls ?? undefined,
        wides: bowl.wides ?? bowl.wd ?? undefined,
        impactSub: bowl.inMatchChange === 'MIN' ? 'in' : bowl.inMatchChange === 'MOUT' ? 'out' : undefined,
      });
    }

    if (batters.length > 0 || bowlers.length > 0) {
      scorecard.innings.push({
        team: inn.batTeamDetails?.batTeamName || inn.batTeamName || inn.team || `Innings ${scorecard.innings.length + 1}`,
        teamShort: inn.batTeamDetails?.batTeamShortName || inn.batTeamShortName || '',
        score: inn.scoreDetails?.runs != null
          ? `${inn.scoreDetails.runs}/${inn.scoreDetails.wickets} (${inn.scoreDetails.overs})`
          : inn.score || '',
        batters,
        bowlers,
        fielders: extractFieldersFromDismissals(batters),
      });
    }
  }

  return scorecard.innings.length > 0 ? scorecard : null;
}

function parseScorecardFromRSC(html: string, matchId: number): MatchScorecard | null {
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

  // Look for scoreCard data
  for (const key of ['scoreCard', 'scorecard', 'matchScoreDetails']) {
    const idx = payload.indexOf(`"${key}"`);
    if (idx === -1) continue;

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
      return parseScorecardFromJson(data, matchId);
    } catch { /* continue */ }
  }

  return null;
}

// ---------- Fielding extraction from dismissals ----------

/**
 * Parse fielding contributions from dismissal strings.
 * E.g., "c Kohli b Bumrah" → catch by Kohli
 *        "st Dhoni b Chahal" → stumping by Dhoni
 *        "run out (Jadeja)" → run out by Jadeja
 */
function extractFieldersFromDismissals(batters: ScorecardBatter[]): ScorecardFielder[] {
  const fielderMap = new Map<string, { catches: number; stumpings: number; runOuts: number }>();

  const addFielding = (name: string, type: 'catches' | 'stumpings' | 'runOuts') => {
    if (!name || name.length < 2) return;
    const clean = name.replace(/\(c\)|\(wk\)|\†|sub\s*\(/gi, '').replace(/\)$/, '').trim();
    if (!clean) return;
    const existing = fielderMap.get(clean) || { catches: 0, stumpings: 0, runOuts: 0 };
    existing[type]++;
    fielderMap.set(clean, existing);
  };

  for (const batter of batters) {
    const d = batter.dismissal || '';
    if (!d) continue;

    // Caught: "c FielderName b BowlerName"
    const caughtMatch = d.match(/^c\s+(.+?)\s+b\s+/i);
    if (caughtMatch) {
      addFielding(caughtMatch[1], 'catches');
      continue;
    }

    // Caught & bowled: "c & b BowlerName"
    if (/^c\s*&\s*b\s+/i.test(d)) {
      const bowler = d.replace(/^c\s*&\s*b\s+/i, '').trim();
      addFielding(bowler, 'catches');
      continue;
    }

    // Stumped: "st FielderName b BowlerName"
    const stMatch = d.match(/^st\s+(.+?)\s+b\s+/i);
    if (stMatch) {
      addFielding(stMatch[1], 'stumpings');
      continue;
    }

    // Run out: "run out (FielderName)" or "run out (A/B)"
    const roMatch = d.match(/run\s+out\s*\(([^)]+)\)/i);
    if (roMatch) {
      // Sometimes multiple fielders: "run out (Jadeja/Dhoni)"
      const fielders = roMatch[1].split('/');
      // Credit the first fielder (direct hit or thrower)
      if (fielders[0]) addFielding(fielders[0].trim(), 'runOuts');
      continue;
    }
  }

  return Array.from(fielderMap.entries()).map(([name, stats]) => ({
    name,
    ...stats,
  }));
}
