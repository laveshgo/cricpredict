import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { rateLimit } from '@/lib/rate-limit';
import { fetchMatchScorecard } from '@/lib/cricbuzz-scorecard';

/**
 * GET /api/fantasy/scorecard?matchId=115059
 *
 * Returns the full scorecard for a match.
 * Requires Firebase auth. Rate-limited to 10 req/min.
 */

// In-memory cache (10 min TTL for completed matches, 2 min for live)
const scorecardCache = new Map<number, { data: any; timestamp: number }>();
const CACHE_TTL_COMPLETED = 10 * 60 * 1000;
const CACHE_TTL_LIVE = 2 * 60 * 1000;

export async function GET(request: NextRequest) {
  const matchIdStr = request.nextUrl.searchParams.get('matchId');
  if (!matchIdStr || !/^\d{1,10}$/.test(matchIdStr)) {
    return NextResponse.json({ error: 'Invalid or missing matchId' }, { status: 400 });
  }
  const matchId = parseInt(matchIdStr, 10);

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
  const cached = scorecardCache.get(matchId);
  if (cached) {
    const ttl = cached.data?.statusText?.toLowerCase().includes('complete')
      ? CACHE_TTL_COMPLETED : CACHE_TTL_LIVE;
    if (Date.now() - cached.timestamp < ttl) {
      return NextResponse.json(cached.data, {
        headers: { 'X-Cache': 'HIT' },
      });
    }
  }

  // Fetch from Cricbuzz
  try {
    const scorecard = await fetchMatchScorecard(matchId);
    if (!scorecard) {
      return NextResponse.json({ error: 'Scorecard not found' }, { status: 404 });
    }

    scorecardCache.set(matchId, { data: scorecard, timestamp: Date.now() });

    // Keep cache size manageable
    if (scorecardCache.size > 100) {
      const oldest = Array.from(scorecardCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) scorecardCache.delete(oldest[0]);
    }

    return NextResponse.json(scorecard, {
      headers: { 'X-Cache': 'MISS' },
    });
  } catch (err) {
    console.error('[fantasy/scorecard] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch scorecard' }, { status: 502 });
  }
}
