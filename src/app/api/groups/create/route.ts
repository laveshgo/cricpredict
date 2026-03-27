import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

/**
 * POST /api/groups/create
 * Server-side group creation.
 * Body: { name, tournamentId, isPublic, memberLimit? }
 */
export async function POST(request: NextRequest) {
  // Verify authentication
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const idToken = authHeader.split('Bearer ')[1];
  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Parse body
  let name: string;
  let tournamentId: string;
  let isPublic: boolean;
  let memberLimit: number | null;
  try {
    const body = await request.json();
    name = body.name?.trim();
    tournamentId = body.tournamentId;
    isPublic = body.isPublic ?? false;

    // Parse memberLimit: blank/null/0 = unlimited, otherwise min 2
    const rawLimit = body.memberLimit;
    if (rawLimit != null && rawLimit !== '' && rawLimit !== 0) {
      const parsed = Number(rawLimit);
      if (isNaN(parsed) || parsed < 2) {
        return NextResponse.json({ error: 'Member limit must be at least 2' }, { status: 400 });
      }
      memberLimit = parsed;
    } else {
      memberLimit = null;
    }

    if (!name || !tournamentId) {
      return NextResponse.json({ error: 'name and tournamentId are required' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    // Verify tournament exists
    const tournamentSnap = await adminDb.collection('tournaments').doc(tournamentId).get();
    if (!tournamentSnap.exists) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);

    // Create group — creator is automatically a member
    const groupRef = adminDb.collection('groups').doc();
    await groupRef.set({
      name,
      tournamentId,
      createdBy: uid,
      createdAt: new Date().toISOString(),
      isPublic,
      memberUids: [uid],
      settings: {
        deadline: deadline.toISOString(),
        forceLocked: false,
        addLocked: false,
        ...(memberLimit ? { memberLimit } : {}),
      },
    });

    return NextResponse.json({ success: true, groupId: groupRef.id });
  } catch (err: any) {
    console.error('Create group error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create group' },
      { status: 500 }
    );
  }
}
