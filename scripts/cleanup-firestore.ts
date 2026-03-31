/**
 * Firestore Cleanup & Migration Script
 *
 * What this does:
 *   1. Deletes all docs in `playerMatchStats` (70 docs — old architecture)
 *   2. Deletes all docs in `tournaments/{id}/matches` subcollection (70 docs — old subcollection)
 *   3. Deletes all docs in `fantasyUserScores` (10 docs — written but never read by UI)
 *   4. Resets `scorecardFetched` to false on all completed matches in `matches`
 *      so next refresh will populate `matchScorecards` and `tournamentStats`
 *   5. Fixes 2 fantasy leagues with stale `auctionStatus: "live"` → "completed"
 *
 * Run with: npx tsx scripts/cleanup-firestore.ts
 *
 * Add --dry-run to preview without making changes:
 *   npx tsx scripts/cleanup-firestore.ts --dry-run
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Parse .env.local manually
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!serviceAccount) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT_KEY in .env.local');
  process.exit(1);
}

const app = initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
const db = getFirestore(app);

const DRY_RUN = process.argv.includes('--dry-run');

async function deleteDocs(collectionRef: FirebaseFirestore.CollectionReference, label: string) {
  const snap = await collectionRef.get();
  if (snap.empty) {
    console.log(`  ✅ ${label}: already empty`);
    return 0;
  }

  if (DRY_RUN) {
    console.log(`  🔍 ${label}: would delete ${snap.size} docs`);
    return snap.size;
  }

  // Batch delete (max 500 per batch)
  let deleted = 0;
  const batches: FirebaseFirestore.WriteBatch[] = [];
  let batch = db.batch();
  let count = 0;

  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    count++;
    if (count === 500) {
      batches.push(batch);
      batch = db.batch();
      count = 0;
    }
  }
  if (count > 0) batches.push(batch);

  for (const b of batches) {
    await b.commit();
  }
  deleted = snap.size;
  console.log(`  🗑️  ${label}: deleted ${deleted} docs`);
  return deleted;
}

async function main() {
  console.log('');
  console.log(DRY_RUN ? '🔍 DRY RUN — no changes will be made\n' : '🚀 LIVE RUN — making changes\n');

  let totalDeleted = 0;
  let totalFixed = 0;

  // ─── 1. Delete playerMatchStats ───
  console.log('Step 1: Delete playerMatchStats (old architecture)');
  totalDeleted += await deleteDocs(db.collection('playerMatchStats'), 'playerMatchStats');

  // ─── 2. Delete tournaments/{id}/matches subcollection ───
  console.log('\nStep 2: Delete old tournament match subcollections');
  const tournamentsSnap = await db.collection('tournaments').get();
  for (const t of tournamentsSnap.docs) {
    const subRef = t.ref.collection('matches');
    totalDeleted += await deleteDocs(subRef, `tournaments/${t.id}/matches`);
  }

  // ─── 3. Delete fantasyUserScores ───
  console.log('\nStep 3: Delete fantasyUserScores (written but never displayed)');
  totalDeleted += await deleteDocs(db.collection('fantasyUserScores'), 'fantasyUserScores');

  // ─── 4. Reset scorecardFetched on completed matches ───
  console.log('\nStep 4: Reset scorecardFetched on completed matches');
  const matchesSnap = await db.collection('matches')
    .where('scorecardFetched', '==', true)
    .get();

  if (matchesSnap.empty) {
    console.log('  ✅ No matches with scorecardFetched=true');
  } else {
    if (DRY_RUN) {
      console.log(`  🔍 Would reset scorecardFetched on ${matchesSnap.size} matches`);
    } else {
      const batches: FirebaseFirestore.WriteBatch[] = [];
      let batch = db.batch();
      let count = 0;

      for (const doc of matchesSnap.docs) {
        batch.update(doc.ref, { scorecardFetched: false, fetchedAt: null });
        count++;
        if (count === 500) {
          batches.push(batch);
          batch = db.batch();
          count = 0;
        }
      }
      if (count > 0) batches.push(batch);

      for (const b of batches) {
        await b.commit();
      }
      console.log(`  🔄 Reset scorecardFetched on ${matchesSnap.size} matches`);
    }
    totalFixed += matchesSnap.size;
  }

  // ─── 5. Fix stale auctionStatus on fantasy leagues ───
  console.log('\nStep 5: Fix fantasy leagues with stale auctionStatus');
  const leaguesSnap = await db.collection('fantasyLeagues')
    .where('auctionStatus', '==', 'live')
    .get();

  let fixedLeagues = 0;
  for (const leagueDoc of leaguesSnap.docs) {
    // Check if the corresponding auction is actually completed
    const auctionSnap = await db.collection('fantasyAuctions').doc(leagueDoc.id).get();
    if (auctionSnap.exists && auctionSnap.data()?.status === 'completed') {
      if (DRY_RUN) {
        console.log(`  🔍 Would fix league ${leagueDoc.id} ("${leagueDoc.data().name}"): auctionStatus "live" → "completed"`);
      } else {
        await leagueDoc.ref.update({ auctionStatus: 'completed' });
        console.log(`  🔧 Fixed league ${leagueDoc.id} ("${leagueDoc.data().name}"): auctionStatus → "completed"`);
      }
      fixedLeagues++;
    }
  }
  if (fixedLeagues === 0) {
    console.log('  ✅ No leagues with stale auctionStatus');
  }
  totalFixed += fixedLeagues;

  // ─── Summary ───
  console.log('\n' + '═'.repeat(60));
  console.log(DRY_RUN ? 'DRY RUN SUMMARY' : 'CLEANUP COMPLETE');
  console.log('═'.repeat(60));
  console.log(`  Docs ${DRY_RUN ? 'to delete' : 'deleted'}:  ${totalDeleted}`);
  console.log(`  Docs ${DRY_RUN ? 'to fix' : 'fixed'}:     ${totalFixed}`);

  if (DRY_RUN) {
    console.log('\nRe-run without --dry-run to apply changes.');
  } else {
    console.log('\nNext steps:');
    console.log('  1. Deploy Firestore rules:  firebase deploy --only firestore:rules --project ipl-prediction-450fb');
    console.log('  2. Open your app and click "Refresh All Matches" to populate matchScorecards + tournamentStats');
  }
  console.log('');
}

main().catch(err => {
  console.error('Script failed:', err.message);
  process.exit(1);
});
