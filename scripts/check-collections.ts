/**
 * Quick script to check Firestore collections and count docs.
 * Run with: npx tsx scripts/check-collections.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!serviceAccount) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT_KEY');
  process.exit(1);
}

const app = initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
const db = getFirestore(app);

async function main() {
  // List all top-level collections
  const collections = await db.listCollections();
  console.log('\n=== Firestore Collections ===\n');

  for (const col of collections) {
    const snap = await col.limit(5).get();
    const countSnap = await col.count().get();
    const count = countSnap.data().count;
    console.log(`📁 ${col.id} — ${count} docs`);

    // Show first doc ID as sample
    if (snap.docs.length > 0) {
      console.log(`   Sample IDs: ${snap.docs.map(d => d.id).join(', ')}`);
    }
  }

  // Specifically check for old collections that should be cleaned up
  console.log('\n=== Cleanup Check ===\n');

  const oldCollections = ['playerMatchStats', 'fantasyUserScores'];
  for (const name of oldCollections) {
    const countSnap = await db.collection(name).count().get();
    const count = countSnap.data().count;
    if (count > 0) {
      console.log(`⚠️  ${name}: ${count} docs (can be deleted — no longer used)`);
    } else {
      console.log(`✅ ${name}: empty or doesn't exist`);
    }
  }

  // Check for tournament subcollection matches (old architecture)
  const tournamentsSnap = await db.collection('tournaments').get();
  for (const t of tournamentsSnap.docs) {
    const subMatchesCount = await t.ref.collection('matches').count().get();
    const count = subMatchesCount.data().count;
    if (count > 0) {
      console.log(`⚠️  tournaments/${t.id}/matches: ${count} docs (old subcollection — can be deleted)`);
    }
  }

  console.log('\n=== New Architecture Collections ===\n');
  const newCollections = ['matches', 'matchScorecards', 'players', 'tournamentStats'];
  for (const name of newCollections) {
    const countSnap = await db.collection(name).count().get();
    const count = countSnap.data().count;
    console.log(`${count > 0 ? '✅' : '⬜'} ${name}: ${count} docs`);
  }

  console.log('');
}

main().catch(console.error);
