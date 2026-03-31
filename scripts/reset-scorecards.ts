/**
 * Reset scorecardFetched on all matches + delete existing matchScorecards
 * so next "Refresh All Matches" re-fetches them with the fixed parser.
 *
 * Run with: npx tsx scripts/reset-scorecards.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'")) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
} catch {}

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')) });
const db = getFirestore(app);

async function main() {
  // 1. Delete all matchScorecards
  const scSnap = await db.collection('matchScorecards').get();
  if (scSnap.empty) {
    console.log('matchScorecards: already empty');
  } else {
    const batch = db.batch();
    scSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log(`Deleted ${scSnap.size} matchScorecards docs`);
  }

  // 2. Delete tournamentStats
  const tsSnap = await db.collection('tournamentStats').get();
  if (!tsSnap.empty) {
    const batch = db.batch();
    tsSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log(`Deleted ${tsSnap.size} tournamentStats docs`);
  }

  // 3. Reset scorecardFetched on all completed matches
  const matchesSnap = await db.collection('matches').where('scorecardFetched', '==', true).get();
  if (matchesSnap.empty) {
    console.log('No matches with scorecardFetched=true');
  } else {
    const batch = db.batch();
    matchesSnap.docs.forEach(d => batch.update(d.ref, { scorecardFetched: false, fetchedAt: null }));
    await batch.commit();
    console.log(`Reset scorecardFetched on ${matchesSnap.size} matches`);
  }

  console.log('\nDone. Now click "Refresh All Matches" in your app.');
}

main().catch(err => { console.error(err.message); process.exit(1); });
