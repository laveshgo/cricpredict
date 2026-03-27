/**
 * Free Cricbuzz data fetcher — extracts data from Cricbuzz's public pages.
 * No API key required. Used as the PRIMARY data source.
 *
 * Cricbuzz uses Next.js with React Server Components (RSC) streaming.
 * Data is embedded inside `self.__next_f.push([1, "..."])` script blocks
 * as escaped JSON. We extract and parse the `pointsTableData` object
 * which has the EXACT same shape as the RapidAPI response.
 */

import * as cheerio from 'cheerio';

// ---------- Types matching existing RapidAPI response shapes ----------

interface PointsTableTeam {
  teamId: number;
  teamName: string;
  teamFullName: string;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  noRes?: number;
  points: number;
  nrr: string;
  teamQualifyStatus?: 'Q' | 'E';
}

interface PointsTableResponse {
  pointsTable: Array<{
    groupName: string;
    pointsTableInfo: PointsTableTeam[];
  }>;
}

interface StatsResponse {
  t20StatsList: {
    values: Array<{ values: string[] }>;
  };
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

// ---------- RSC payload extraction ----------

/**
 * Extract all RSC streaming payload strings from Cricbuzz HTML.
 * Cricbuzz embeds data via: self.__next_f.push([1, "...escaped JSON..."])
 * We collect all those strings and concatenate them.
 */
function extractRSCPayloads(html: string): string {
  const $ = cheerio.load(html);
  const payloads: string[] = [];

  $('script').each(function () {
    const content = $(this).html() || '';
    if (!content.includes('self.__next_f.push')) return;

    // Extract the string argument from self.__next_f.push([1, "..."])
    // The pattern is: self.__next_f.push([1,"<escaped content>"])
    const match = content.match(/self\.__next_f\.push\(\[1,"([\s\S]*)"\]\)/);
    if (match?.[1]) {
      // Unescape the JSON string (it's double-escaped)
      try {
        const unescaped = JSON.parse(`"${match[1]}"`);
        payloads.push(unescaped);
      } catch {
        // Some payloads might not be valid JSON strings, use raw
        payloads.push(match[1]);
      }
    }
  });

  return payloads.join('');
}

/**
 * Find and extract a JSON object from RSC payload by looking for a key.
 * The RSC payload contains mixed content (React elements + data).
 * We find the JSON object that contains the target key.
 */
function extractJSONFromPayload(payload: string, targetKey: string): any | null {
  // Find the position of the target key
  const keyIdx = payload.indexOf(`"${targetKey}"`);
  if (keyIdx === -1) {
    console.warn(`[cricbuzz-free] Key "${targetKey}" not found in RSC payload`);
    return null;
  }

  // Walk backwards to find the opening { of the containing object
  // We need to find the right level — the object that directly contains our key
  let braceCount = 0;
  let startIdx = keyIdx;
  for (let i = keyIdx; i >= 0; i--) {
    if (payload[i] === '}') braceCount++;
    if (payload[i] === '{') {
      if (braceCount === 0) {
        startIdx = i;
        break;
      }
      braceCount--;
    }
  }

  // Now find the matching closing }
  braceCount = 0;
  let endIdx = startIdx;
  for (let i = startIdx; i < payload.length; i++) {
    if (payload[i] === '{') braceCount++;
    if (payload[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }

  const jsonStr = payload.substring(startIdx, endIdx);
  try {
    return JSON.parse(jsonStr);
  } catch {
    console.warn(`[cricbuzz-free] Failed to parse JSON for key "${targetKey}" (length=${jsonStr.length})`);
    // Try a more targeted extraction — just get the value after the key
    return null;
  }
}

// ---------- Points Table ----------

function extractPointsTable(html: string): PointsTableResponse | null {
  const payload = extractRSCPayloads(html);
  if (!payload) {
    console.warn('[cricbuzz-free] No RSC payloads found');
    return null;
  }

  console.log(`[cricbuzz-free] RSC payload total length: ${payload.length}`);

  // Look for pointsTableData which contains the full points table
  const data = extractJSONFromPayload(payload, 'pointsTableData');
  if (data?.pointsTableData) {
    const ptData = data.pointsTableData;
    if (ptData.pointsTable && Array.isArray(ptData.pointsTable)) {
      console.log(`[cricbuzz-free] ✓ Found pointsTableData with ${ptData.pointsTable.length} group(s)`);
      return {
        pointsTable: ptData.pointsTable.map((group: any) => ({
          groupName: group.groupName || 'Teams',
          pointsTableInfo: (group.pointsTableInfo || []).map((t: any) => ({
            teamId: t.teamId || 0,
            teamName: t.teamName || '',
            teamFullName: t.teamFullName || '',
            matchesPlayed: t.matchesPlayed || 0,
            matchesWon: t.matchesWon || 0,
            matchesLost: t.matchesLost || 0,
            noRes: t.noRes || 0,
            points: t.points || 0,
            nrr: String(t.nrr ?? '+0.000'),
            ...(t.teamQualifyStatus === 'Q' || t.teamQualifyStatus === 'E'
              ? { teamQualifyStatus: t.teamQualifyStatus }
              : {}),
          })),
        })),
      };
    }
  }

  // Fallback: look for pointsTable directly
  const ptDirect = extractJSONFromPayload(payload, 'pointsTable');
  if (ptDirect?.pointsTable && Array.isArray(ptDirect.pointsTable)) {
    console.log(`[cricbuzz-free] ✓ Found pointsTable directly`);
    return ptDirect as PointsTableResponse;
  }

  console.warn('[cricbuzz-free] Could not extract points table from RSC payload');
  return null;
}

// ---------- Stats via Cricbuzz internal JSON API ----------

/**
 * Cricbuzz's frontend calls this internal API when switching stat tabs:
 *   https://www.cricbuzz.com/api/cricket-series/series-stats/{seriesId}/{statsType}
 *
 * This returns pure JSON with the same t20StatsList shape as RapidAPI.
 * No API key needed!
 */
async function fetchStatsFromApi(
  seriesId: string,
  statsType: 'mostRuns' | 'mostWickets'
): Promise<StatsResponse | null> {
  const url = `https://www.cricbuzz.com/api/cricket-series/series-stats/${seriesId}/${statsType}`;
  console.log(`[cricbuzz-free] Trying internal stats API: ${url}`);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      headers: cbHeaders(),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[cricbuzz-free] Stats API returned HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();

    // The API returns { t20StatsList: { headers: [...], values: [...] } }
    const statsList = data?.t20StatsList || data?.statsList;
    if (statsList?.values && Array.isArray(statsList.values)) {
      console.log(`[cricbuzz-free] ✓ Stats API returned ${statsList.values.length} entries for ${statsType}`);
      return {
        t20StatsList: {
          values: statsList.values.slice(0, 5),
        },
      };
    }

    console.warn(`[cricbuzz-free] Stats API response missing values. Keys: ${Object.keys(data).join(', ')}`);
    return null;
  } catch (err: any) {
    console.warn(`[cricbuzz-free] Stats API error: ${err.message || err}`);
    return null;
  }
}

/**
 * Fallback: extract most-runs from the stats page RSC payload.
 * Only works for mostRuns (the default initialStats on the page).
 */
function extractStatsFromPage(html: string): StatsResponse | null {
  const payload = extractRSCPayloads(html);
  if (!payload) return null;

  const keysToTry = ['t20StatsList', 'statsList'];
  for (const key of keysToTry) {
    const data = extractJSONFromPayload(payload, key);
    if (data) {
      const statsList = data[key] || data;
      if (statsList?.values && Array.isArray(statsList.values)) {
        console.log(`[cricbuzz-free] ✓ Found stats via RSC key "${key}" (${statsList.values.length} entries)`);
        return { t20StatsList: { values: statsList.values.slice(0, 5) } };
      }
    }
  }
  return null;
}

// ---------- URL patterns ----------

interface FetchAttempt {
  url: string;
  label: string;
}

function getPointsTableUrls(seriesId: string): FetchAttempt[] {
  return [
    { url: `https://www.cricbuzz.com/cricket-series/${seriesId}/series/points-table`, label: 'cb-series-page' },
    { url: `https://www.cricbuzz.com/cricket-series/${seriesId}/indian-premier-league-2025/points-table`, label: 'cb-ipl-page' },
  ];
}

function getStatsPageUrls(seriesId: string): FetchAttempt[] {
  // Fallback: full stats page (only has mostRuns in RSC payload)
  return [
    { url: `https://www.cricbuzz.com/cricket-series/${seriesId}/series/stats`, label: 'cb-stats-page' },
    { url: `https://www.cricbuzz.com/cricket-series/${seriesId}/indian-premier-league-2025/stats`, label: 'cb-ipl-stats-page' },
  ];
}

// ---------- Fetch page ----------

async function fetchPage(
  urls: FetchAttempt[],
  timeout = 10000
): Promise<{ html: string; label: string } | null> {
  for (const { url, label } of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(url, {
        headers: cbHeaders(),
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timer);

      if (!res.ok) {
        console.warn(`[cricbuzz-free] ${label} → HTTP ${res.status}`);
        continue;
      }

      const html = await res.text();
      console.log(`[cricbuzz-free] ${label} → HTTP ${res.status} | size=${html.length}`);

      if (html.length < 1000) {
        console.warn(`[cricbuzz-free] ${label} → response too small`);
        continue;
      }

      if (html.includes('self.__next_f.push')) {
        console.log(`[cricbuzz-free] ${label} → has RSC payloads ✓`);
        return { html, label };
      } else {
        console.warn(`[cricbuzz-free] ${label} → no RSC payloads found`);
      }
    } catch (err: any) {
      console.warn(`[cricbuzz-free] ${label} → error: ${err.message || err}`);
    }
  }
  return null;
}

// ---------- Public API ----------

export type CricbuzzDataType = 'points-table' | 'most-runs' | 'most-wickets';

/**
 * Fetch cricket data from Cricbuzz's public pages (no API key needed).
 * Returns JSON matching the RapidAPI response shape, or null on failure.
 */
export async function fetchCricbuzzFree(
  type: CricbuzzDataType,
  seriesId: string
): Promise<object | null> {
  console.log(`[cricbuzz-free] Attempting free fetch: type=${type}, seriesId=${seriesId}`);

  try {
    if (type === 'points-table') {
      const page = await fetchPage(getPointsTableUrls(seriesId));
      if (!page) return null;

      const result = extractPointsTable(page.html);
      if (result) {
        const teamCount = result.pointsTable.reduce((s, g) => s + g.pointsTableInfo.length, 0);
        console.log(`[cricbuzz-free] ✓ Points table: ${teamCount} teams from ${page.label}`);
      }
      return result;
    }

    if (type === 'most-runs' || type === 'most-wickets') {
      const cbStatsType = type === 'most-runs' ? 'mostRuns' : 'mostWickets';

      // Primary: Cricbuzz internal JSON API (works for both runs and wickets)
      const apiResult = await fetchStatsFromApi(seriesId, cbStatsType);
      if (apiResult) {
        console.log(`[cricbuzz-free] ✓ ${type}: ${apiResult.t20StatsList.values.length} players from internal API`);
        return apiResult;
      }

      // Fallback: RSC page scraping (only works for mostRuns)
      if (type === 'most-runs') {
        console.log(`[cricbuzz-free] Falling back to RSC page scraping for most-runs`);
        const page = await fetchPage(getStatsPageUrls(seriesId));
        if (page) {
          const pageResult = extractStatsFromPage(page.html);
          if (pageResult) {
            console.log(`[cricbuzz-free] ✓ most-runs: ${pageResult.t20StatsList.values.length} players from ${page.label} (RSC fallback)`);
            return pageResult;
          }
        }
      }

      return null;
    }

    return null;
  } catch (err) {
    console.error(`[cricbuzz-free] Fatal error for ${type}/${seriesId}:`, err);
    return null;
  }
}
