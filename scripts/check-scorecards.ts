/**
 * Quick check: does matchScorecards have data? What does the dismissal field look like?
 * Run with: npx tsx scripts/check-scorecards.ts
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
  // Check matchScorecards
  const scSnap = await db.collection('matchScorecards').limit(1).get();
  if (scSnap.empty) {
    console.log('matchScorecards: EMPTY — refresh did not populate it');
  } else {
    const doc = scSnap.docs[0];
    const data = doc.data();
    console.log('matchScorecards/' + doc.id + ' exists');
    console.log('Innings count:', data.innings?.length);
    if (data.innings?.[0]?.batters) {
      console.log('\nFirst 3 batters (innings 1):');
      for (const b of data.innings[0].batters.slice(0, 3)) {
        console.log(`  ${b.name}: isOut=${b.isOut}, dismissal="${b.dismissal || '(missing)'}"`);
      }
    }
  }

  // Check tournamentStats
  const tsSnap = await db.collection('tournamentStats').limit(1).get();
  console.log('\ntournamentStats:', tsSnap.empty ? 'EMPTY' : `exists (${tsSnap.docs[0].data().stats?.length} player entries)`);

  // Check a match doc's scorecardFetched
  const mSnap = await db.collection('matches').where('status', '==', 'completed').limit(1).get();
  if (!mSnap.empty) {
    const m = mSnap.docs[0].data();
    console.log('\nSample match ' + mSnap.docs[0].id + ': scorecardFetched=' + m.scorecardFetched);
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
