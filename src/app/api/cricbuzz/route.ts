import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { rateLimit } from '@/lib/rate-limit';
import { MOCK_POINTS_TABLE, MOCK_MOST_RUNS, MOCK_MOST_WICKETS } from '@/lib/mock-cricbuzz';
import { fetchCricbuzzFree, type CricbuzzDataType } from '@/lib/cricbuzz-free';

/**
 * Server-side proxy for cricket data with fallback chain:
 *
 *   1. Check aggressive cache (1 hour for points table, 30 min for stats)
 *   2. Try FREE scraping of Cricbuzz public pages (no API key)
 *   3. If free method fails → fallback to RapidAPI (100 req/month)
 *   4. If RapidAPI also fails → serve stale cache (if available)
 *
 * Requires a valid Firebase ID token (signature-verified via Admin SDK).
 *
 * Usage:
 *   /api/cricbuzz?type=points-table&seriesId=9241
 *   /api/cricbuzz?type=most-runs&seriesId=9241
 *   /api/cricbuzz?type=most-wickets&seriesId=9241
 */

const RAPIDAPI_HOST = 'cricbuzz-cricket.p.rapidapi.com';

// Aggressive cache TTLs — data only changes after matches finish
const CACHE_TTL: Record<string, number> = {
  'points-table': 60 * 60 * 1000,  // 1 hour  (changes only after a match)
  'most-runs':    30 * 60 * 1000,  // 30 min  (changes during a match)
  'most-wickets': 30 * 60 * 1000,  // 30 min
};
const DEFAULT_CACHE_TTL = 30 * 60 * 1000;

// Stale cache: serve old data if both sources fail (up to 24 hours)
const STALE_CACHE_TTL = 24 * 60 * 60 * 1000;

// In-memory cache: key = "type:seriesId", value = { data, timestamp, source }
const cache = new Map<string, { data: string; timestamp: number; source: string }>();

// Track RapidAPI usage to stay under quota
let rapidApiCallsThisMonth = 0;
let rapidApiMonthStart = new Date().getMonth();
const RAPIDAPI_MONTHLY_LIMIT = 90; // Leave 10 as buffer from the 100 limit

function checkRapidApiQuota(): boolean {
  const currentMonth = new Date().getMonth();
  if (currentMonth !== rapidApiMonthStart) {
    // New month — reset counter
    rapidApiCallsThisMonth = 0;
    rapidApiMonthStart = currentMonth;
  }
  return rapidApiCallsThisMonth < RAPIDAPI_MONTHLY_LIMIT;
}

// Map type names to RapidAPI endpoint patterns
function buildRapidApiUrl(type: string, seriesId: string): string {
  switch (type) {
    case 'points-table':
      return `https://${RAPIDAPI_HOST}/stats/v1/series/${seriesId}/points-table`;
    case 'most-runs':
      return `https://${RAPIDAPI_HOST}/stats/v1/series/${seriesId}?statsType=mostRuns`;
    case 'most-wickets':
      return `https://${RAPIDAPI_HOST}/stats/v1/series/${seriesId}?statsType=mostWickets`;
    default:
      throw new Error(`Unknown type: ${type}`);
  }
}

// ---------- Fetch from RapidAPI (fallback) ----------

async function fetchFromRapidApi(
  type: string,
  seriesId: string,
  apiKey: string
): Promise<{ data: string; noData?: boolean } | null> {
  if (!checkRapidApiQuota()) {
    console.warn('[cricbuzz] RapidAPI monthly quota nearly exhausted, skipping');
    return null;
  }

  let url: string;
  try {
    url = buildRapidApiUrl(type, seriesId);
  } catch {
    return null;
  }

  try {
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': apiKey,
      },
    });

    rapidApiCallsThisMonth++;

    if (res.status === 204) {
      return { data: JSON.stringify({ noData: true, message: 'Tournament has not started yet' }), noData: true };
    }

    if (!res.ok) {
      console.warn(`[cricbuzz] RapidAPI returned ${res.status} for ${type}/${seriesId}`);
      return null;
    }

    return { data: await res.text() };
  } catch (err) {
    console.error('[cricbuzz] RapidAPI fetch error:', err);
    return null;
  }
}

// ---------- Main handler ----------

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type');
  const seriesId = request.nextUrl.searchParams.get('seriesId');

  if (!type || !seriesId) {
    return NextResponse.json(
      { error: 'Missing "type" and/or "seriesId" query parameters' },
      { status: 400 }
    );
  }

  // Validate type
  if (!['points-table', 'most-runs', 'most-wickets'].includes(type)) {
    return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
  }

  // Validate seriesId is a numeric ID (or 'mock' for testing) to prevent path traversal / SSRF
  if (seriesId !== 'mock' && !/^\d{1,10}$/.test(seriesId)) {
    return NextResponse.json(
      { error: 'Invalid seriesId — must be a numeric ID' },
      { status: 400 }
    );
  }

  // Verify authentication - require a valid Firebase ID token (signature-verified)
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const idToken = authHeader.split('Bearer ')[1];
  if (!idToken) {
    return NextResponse.json(
      { error: 'Invalid authentication token' },
      { status: 401 }
    );
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
  } catch (err: any) {
    const message = err?.code === 'auth/id-token-expired' ? 'Token expired' : 'Token verification failed';
    return NextResponse.json({ error: message }, { status: 401 });
  }

  // Mock mode: return local test data
  if (process.env.CRICBUZZ_MOCK === 'true' || seriesId === 'mock') {
    const mockData = type === 'points-table' ? MOCK_POINTS_TABLE
      : type === 'most-runs' ? MOCK_MOST_RUNS
      : type === 'most-wickets' ? MOCK_MOST_WICKETS
      : { noData: true };
    return NextResponse.json(mockData, {
      headers: { 'X-Cache': 'MOCK', 'X-Source': 'mock' },
    });
  }

  // Rate limit: 30 requests per minute per user
  const { limited, retryAfterMs } = rateLimit(uid, 30, 60_000);
  if (limited) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((retryAfterMs || 60_000) / 1000)) },
      }
    );
  }

  // ── Step 1: Check aggressive cache ──────────────────────────────────
  const cacheKey = `${type}:${seriesId}`;
  const cached = cache.get(cacheKey);
  const ttl = CACHE_TTL[type] || DEFAULT_CACHE_TTL;

  if (cached && Date.now() - cached.timestamp < ttl) {
    return new Response(cached.data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${Math.floor(ttl / 1000)}`,
        'X-Cache': 'HIT',
        'X-Source': cached.source,
      },
    });
  }

  // ── Step 2: Try FREE Cricbuzz scraping ──────────────────────────────
  let data: string | null = null;
  let source = 'unknown';

  try {
    const freeResult = await fetchCricbuzzFree(type as CricbuzzDataType, seriesId);
    if (freeResult) {
      data = JSON.stringify(freeResult);
      source = 'free-scrape';
      console.log(`[cricbuzz] ✓ Free scrape succeeded for ${type}/${seriesId}`);
    } else {
      console.warn(`[cricbuzz] Free scrape returned null for ${type}/${seriesId}`);
    }
  } catch (err) {
    console.warn('[cricbuzz] Free scrape failed:', err);
  }

  // ── Step 3: Fallback to RapidAPI ────────────────────────────────────
  if (!data) {
    const apiKey = process.env.RAPIDAPI_KEY;
    if (apiKey) {
      console.log(`[cricbuzz] Falling back to RapidAPI for ${type}/${seriesId} (calls this month: ${rapidApiCallsThisMonth})`);
      const rapidResult = await fetchFromRapidApi(type, seriesId, apiKey);
      if (rapidResult) {
        data = rapidResult.data;
        source = 'rapidapi';

        // If tournament hasn't started, return early (don't cache "no data")
        if (rapidResult.noData) {
          return NextResponse.json(
            { noData: true, message: 'Tournament has not started yet — no data available' },
            { status: 200, headers: { 'X-Source': 'rapidapi' } }
          );
        }
      }
    } else {
      console.warn('[cricbuzz] No RAPIDAPI_KEY configured, cannot fall back');
    }
  }

  // ── Step 4: Serve stale cache if both sources failed ────────────────
  if (!data && cached && Date.now() - cached.timestamp < STALE_CACHE_TTL) {
    console.warn(`[cricbuzz] All sources failed — serving stale cache for ${cacheKey}`);
    return new Response(cached.data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
        'X-Cache': 'STALE',
        'X-Source': cached.source,
        'X-Stale-Age': String(Math.floor((Date.now() - cached.timestamp) / 1000)),
      },
    });
  }

  // ── All sources failed, no cache available ──────────────────────────
  if (!data) {
    return NextResponse.json(
      { error: 'Unable to fetch cricket data. Please try again later.' },
      { status: 502 }
    );
  }

  // ── Cache the successful response ───────────────────────────────────
  cache.set(cacheKey, { data, timestamp: Date.now(), source });

  return new Response(data, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${Math.floor(ttl / 1000)}`,
      'X-Cache': 'MISS',
      'X-Source': source,
    },
  });
}
