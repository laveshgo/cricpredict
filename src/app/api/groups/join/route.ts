import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/groups/join
 * Server-side group join. Validates auth and adds user to group.
 * Body: { groupId: string }
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
  let groupId: string;
  try {
    const body = await request.json();
    groupId = body.groupId;
    if (!groupId || typeof groupId !== 'string') {
      return NextResponse.json({ error: 'groupId is required' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const groupRef = adminDb.collection('groups').doc(groupId);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const groupData = groupSnap.data()!;

    // Check if group is closed to new members
    if (groupData.settings?.addLocked) {
      return NextResponse.json(
        { error: 'This group is closed to new members' },
        { status: 403 }
      );
    }

    // Check if already a member
    const memberUids: string[] = groupData.memberUids || [];
    if (memberUids.includes(uid)) {
      return NextResponse.json({ success: true, message: 'Already a member' });
    }

    // Check member limit
    const memberLimit = groupData.settings?.memberLimit;
    if (memberLimit && memberUids.length >= memberLimit) {
      return NextResponse.json(
        { error: `This group is full (${memberLimit} members max)` },
        { status: 403 }
      );
    }

    // Add user to group
    await groupRef.update({
      memberUids: FieldValue.arrayUnion(uid),
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Join group error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to join group' },
      { status: 500 }
    );
  }
}
