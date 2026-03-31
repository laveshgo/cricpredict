import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Fetches MVP (Most Valuable Player) data from IPL's official S3 feed.
 *
 * Source: https://ipl-stats-sports-mechanic.s3.ap-south-1.amazonaws.com/ipl/feeds/stats/{season}-mvpPlayersList.js
 *
 * The feed is JSONP: `onMvp({...})` — we strip the wrapper and parse JSON.
 *
 * Usage:
 *   /api/ipl-mvp?season=2026
 */

const CACHE_TTL = 30 * 60 * 1000; // 30 min
const STALE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// In-memory cache keyed by season
const cache = new Map<string, { data: string; timestamp: number }>();

export async function GET(request: NextRequest) {
  const season = request.nextUrl.searchParams.get('season');

  if (!season || !/^\d{4}$/.test(season)) {
    return NextResponse.json(
      { error: 'Missing or invalid "season" parameter (e.g. 2026)' },
      { status: 400 }
    );
  }

  // Verify authentication
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const idToken = authHeader.split('Bearer ')[1];
  if (!idToken) {
    return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
  } catch (err: any) {
    const message = err?.code === 'auth/id-token-expired' ? 'Token expired' : 'Token verification failed';
    return NextResponse.json({ error: message }, { status: 401 });
  }

  // Rate limit: 30 requests per minute per user
  const { limited, retryAfterMs } = rateLimit(uid, 30, 60_000);
  if (limited) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((retryAfterMs || 60_000) / 1000)) } }
    );
  }

  // Check cache
  const cached = cache.get(season);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return new Response(cached.data, {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
    });
  }

  // Fetch from IPL S3
  let data: string | null = null;
  try {
    const url = `https://ipl-stats-sports-mechanic.s3.ap-south-1.amazonaws.com/ipl/feeds/stats/${season}-mvpPlayersList.js`;
    const res = await fetch(url, {
      headers: {
        'Referer': 'https://www.iplt20.com/',
        'User-Agent': 'Mozilla/5.0 (compatible; CricPredict/1.0)',
      },
    });

    if (!res.ok) {
      console.warn(`[ipl-mvp] S3 returned ${res.status} for season ${season}`);
    } else {
      const raw = await res.text();

      // Strip JSONP wrapper: onMvp({...}) → {...}
      const jsonStr = raw.replace(/^[^(]*\(/, '').replace(/\);?\s*$/, '');
      const parsed = JSON.parse(jsonStr);

      // Return the top player as MVP + full list for display
      const mvpList = (parsed.mvp || []).map((p: any) => ({
        rank: parseInt(p.Rank, 10),
        name: p.PlayerName,
        team: p.TeamCode,
        points: parseFloat(p.IndexValue),
        matches: parseInt(p.Matches, 10),
        fours: parseInt(p.Fours, 10),
        sixes: parseInt(p.Sixes, 10),
        wickets: parseInt(p.Wickets, 10),
        dotBalls: parseInt(p.DotBalls, 10),
        catches: parseInt(p.caught, 10),
        manOfMatches: parseInt(p.ManOfMatches, 10),
      }));

      const result = {
        mvpName: mvpList.length > 0 ? mvpList[0].name : '',
        mvpList: mvpList.slice(0, 10), // top 10 for display
        lastUpdated: parsed.dateModifiedOn?.[0] || '',
      };

      data = JSON.stringify(result);
      console.log(`[ipl-mvp] ✓ Fetched MVP for ${season}: ${result.mvpName}`);
    }
  } catch (err) {
    console.error('[ipl-mvp] Fetch error:', err);
  }

  // Stale cache fallback
  if (!data && cached && Date.now() - cached.timestamp < STALE_CACHE_TTL) {
    return new Response(cached.data, {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'STALE' },
    });
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Unable to fetch MVP data. Please try again later.' },
      { status: 502 }
    );
  }

  // Cache successful response
  cache.set(season, { data, timestamp: Date.now() });

  return new Response(data, {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
  });
}
