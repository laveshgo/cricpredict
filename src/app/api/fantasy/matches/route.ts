import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { rateLimit } from '@/lib/rate-limit';
import { fetchSeriesMatches } from '@/lib/cricbuzz-scorecard';

/**
 * GET /api/fantasy/matches?seriesId=9241
 *
 * Returns the list of matches for a cricket series.
 * Requires Firebase auth. Rate-limited to 10 req/min.
 */

// In-memory cache (5 min TTL)
let matchCache: { data: any; timestamp: number; seriesId: string } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const seriesId = request.nextUrl.searchParams.get('seriesId');
  if (!seriesId || !/^\d{1,10}$/.test(seriesId)) {
    return NextResponse.json({ error: 'Invalid or missing seriesId' }, { status: 400 });
  }

  // Auth
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Rate limit
  const { limited } = rateLimit(uid, 10, 60_000);
  if (limited) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  // Check cache
  if (matchCache && matchCache.seriesId === seriesId && Date.now() - matchCache.timestamp < CACHE_TTL) {
    return NextResponse.json(matchCache.data, {
      headers: { 'X-Cache': 'HIT' },
    });
  }

  // Fetch from Cricbuzz
  try {
    const matches = await fetchSeriesMatches(seriesId);

    const response = {
      seriesId,
      matches: matches.map(m => ({
        matchId: m.matchId,
        matchDesc: m.matchDesc,
        status: m.status,
        statusText: m.statusText,
        team1: m.team1,
        team2: m.team2,
        startDate: m.startDate,
      })),
      fetchedAt: new Date().toISOString(),
    };

    matchCache = { data: response, timestamp: Date.now(), seriesId };

    return NextResponse.json(response, {
      headers: { 'X-Cache': 'MISS' },
    });
  } catch (err) {
    console.error('[fantasy/matches] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 502 });
  }
}
