/**
 * Cloudflare Worker — Free Cricbuzz Data Proxy
 *
 * Fetches cricket data from Cricbuzz's public pages/APIs (no API key needed).
 * Adds CORS headers so browser-based HTML sites can call it directly.
 *
 * Endpoints (clean paths, default seriesId = IPL 2025):
 *   GET /points-table
 *   GET /most-runs
 *   GET /most-wickets
 *   GET /most-runs?seriesId=9241    ← override for a different series
 *
 * Fallback chain (no caching — HTML site handles its own caching):
 *   1. Free Cricbuzz scraping (RSC pages + internal JSON API)
 *   2. RapidAPI (if free fails) — set RAPIDAPI_KEY in Worker env vars
 *
 * Deploy:
 *   1. Go to dash.cloudflare.com → Workers & Pages → Create
 *   2. Paste this code → Deploy
 *   3. Go to Settings → Variables → add RAPIDAPI_KEY
 *   4. Update your HTML site's WORKER_URL to the deployed URL
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const CB_HEADERS = {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/json,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.cricbuzz.com',
};

// ─── RSC Payload Extraction (for points table) ───────────────────────

function extractRSCPayloads(html) {
  const payloads = [];
  const regex = /self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const unescaped = JSON.parse(`"${match[1]}"`);
      payloads.push(unescaped);
    } catch {
      payloads.push(match[1]);
    }
  }
  return payloads.join('');
}

function extractJSONFromPayload(payload, targetKey) {
  const keyIdx = payload.indexOf(`"${targetKey}"`);
  if (keyIdx === -1) return null;

  let braceCount = 0;
  let startIdx = keyIdx;
  for (let i = keyIdx; i >= 0; i--) {
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
    return JSON.parse(payload.substring(startIdx, endIdx));
  } catch {
    return null;
  }
}

// ─── Points Table ────────────────────────────────────────────────────

async function fetchPointsTable(seriesId) {
  const urls = [
    `https://www.cricbuzz.com/cricket-series/${seriesId}/series/points-table`,
    `https://www.cricbuzz.com/cricket-series/${seriesId}/indian-premier-league-2025/points-table`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: CB_HEADERS });
      if (!res.ok) continue;

      const html = await res.text();
      if (html.length < 1000 || !html.includes('self.__next_f.push')) continue;

      const payload = extractRSCPayloads(html);
      const data = extractJSONFromPayload(payload, 'pointsTableData');

      if (data?.pointsTableData?.pointsTable) {
        const ptData = data.pointsTableData;
        return {
          pointsTable: ptData.pointsTable.map((group) => ({
            groupName: group.groupName || 'Teams',
            pointsTableInfo: (group.pointsTableInfo || []).map((t) => ({
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
    } catch {
      continue;
    }
  }
  return null;
}

// ─── Stats (Most Runs / Most Wickets) ────────────────────────────────

async function fetchStats(seriesId, statsType) {
  const cbType = statsType === 'most-runs' ? 'mostRuns' : 'mostWickets';
  const apiUrl = `https://www.cricbuzz.com/api/cricket-series/series-stats/${seriesId}/${cbType}`;

  try {
    const res = await fetch(apiUrl, { headers: CB_HEADERS });
    if (res.ok) {
      const data = await res.json();
      const statsList = data?.t20StatsList || data?.statsList;
      if (statsList?.values?.length) {
        return { t20StatsList: { values: statsList.values } };
      }
    }
  } catch {
    // fall through
  }

  // Fallback: RSC page scraping (only works for most-runs)
  if (statsType === 'most-runs') {
    const urls = [
      `https://www.cricbuzz.com/cricket-series/${seriesId}/series/stats`,
      `https://www.cricbuzz.com/cricket-series/${seriesId}/indian-premier-league-2025/stats`,
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url, { headers: CB_HEADERS });
        if (!res.ok) continue;

        const html = await res.text();
        if (!html.includes('self.__next_f.push')) continue;

        const payload = extractRSCPayloads(html);
        for (const key of ['t20StatsList', 'statsList']) {
          const data = extractJSONFromPayload(payload, key);
          const list = data?.[key] || data;
          if (list?.values?.length) {
            return { t20StatsList: { values: list.values } };
          }
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

// ─── RapidAPI Fallback ───────────────────────────────────────────────

const RAPIDAPI_HOST = 'cricbuzz-cricket.p.rapidapi.com';

function buildRapidApiUrl(type, seriesId) {
  switch (type) {
    case 'points-table':
      return `https://${RAPIDAPI_HOST}/stats/v1/series/${seriesId}/points-table`;
    case 'most-runs':
      return `https://${RAPIDAPI_HOST}/stats/v1/series/${seriesId}?statsType=mostRuns`;
    case 'most-wickets':
      return `https://${RAPIDAPI_HOST}/stats/v1/series/${seriesId}?statsType=mostWickets`;
    default:
      return null;
  }
}

async function fetchFromRapidApi(type, seriesId, apiKey) {
  const url = buildRapidApiUrl(type, seriesId);
  if (!url) return null;

  try {
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': apiKey,
      },
    });

    if (res.status === 204) return { noData: true };
    if (!res.ok) return null;

    return await res.json();
  } catch {
    return null;
  }
}

// ─── Main Handler ────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // Path-based routing: /points-table, /most-runs, /most-wickets
    const path = url.pathname.replace(/^\/+|\/+$/g, ''); // trim slashes

    // Default series ID — change this when a new IPL season starts
    // Optional override via ?seriesId= query param
    const DEFAULT_SERIES_ID = '9237'; // IPL 2025
    const seriesId = url.searchParams.get('seriesId') || DEFAULT_SERIES_ID;

    // Root path — show usage
    if (!path) {
      return jsonResponse({
        usage: {
          'points-table': '/points-table',
          'most-runs': '/most-runs',
          'most-wickets': '/most-wickets',
          'note': `Default seriesId=${DEFAULT_SERIES_ID}. Override with ?seriesId=XXXX`,
        },
      });
    }

    const validTypes = ['points-table', 'most-runs', 'most-wickets'];
    if (!validTypes.includes(path)) {
      return jsonResponse({ error: `Unknown path "/${path}". Use: ${validTypes.map(t => '/' + t).join(', ')}` }, 404);
    }

    if (!/^\d{1,10}$/.test(seriesId)) {
      return jsonResponse({ error: 'seriesId must be numeric' }, 400);
    }

    // ── Step 1: Try free Cricbuzz scraping ──
    let data = null;
    let source = 'unknown';

    if (path === 'points-table') {
      data = await fetchPointsTable(seriesId);
    } else {
      data = await fetchStats(seriesId, path);
    }

    if (data) {
      source = 'free-scrape';
    }

    // ── Step 2: Fallback to RapidAPI ──
    if (!data && env.RAPIDAPI_KEY) {
      data = await fetchFromRapidApi(path, seriesId, env.RAPIDAPI_KEY);
      if (data) {
        if (data.noData) {
          return jsonResponse(
            { noData: true, message: 'Tournament has not started yet' },
            200,
            { 'X-Source': 'rapidapi' }
          );
        }
        source = 'rapidapi';
      }
    }

    // ── All sources failed ──
    if (!data) {
      return jsonResponse({ error: 'Unable to fetch cricket data. Please try again later.' }, 502);
    }

    return jsonResponse(data, 200, { 'X-Source': source });
  },
};

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}
