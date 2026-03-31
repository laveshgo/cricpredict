/**
 * Dump all Firestore collections with doc counts + sample docs.
 * Run with: npx tsx scripts/dump-firestore.ts
 *
 * Paste the full output back so we can identify stale data.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Parse .env.local manually (no dotenv dependency needed)
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
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env.local not found, rely on existing env vars
}

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!serviceAccount) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT_KEY in .env.local');
  process.exit(1);
}

const app = initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
const db = getFirestore(app);

/** Truncate long strings/arrays for readability */
function summarize(val: any, depth = 0): any {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    return val.length > 120 ? val.slice(0, 120) + '...' : val;
  }
  if (Array.isArray(val)) {
    if (val.length <= 3) return val.map(v => summarize(v, depth + 1));
    return [
      ...val.slice(0, 2).map(v => summarize(v, depth + 1)),
      `... +${val.length - 2} more`
    ];
  }
  if (typeof val === 'object') {
    if (depth > 2) return '{...}';
    const out: Record<string, any> = {};
    const keys = Object.keys(val);
    for (const k of keys) {
      out[k] = summarize(val[k], depth + 1);
    }
    return out;
  }
  return val;
}

async function main() {
  console.log('='.repeat(80));
  console.log('FIRESTORE DATA DUMP');
  console.log('='.repeat(80));

  // 1. List all top-level collections
  const collections = await db.listCollections();
  const collNames = collections.map(c => c.id);
  console.log(`\nTop-level collections: ${collNames.join(', ')}\n`);

  for (const col of collections) {
    const countSnap = await col.count().get();
    const count = countSnap.data().count;

    console.log('─'.repeat(80));
    console.log(`📁 ${col.id}  (${count} docs)`);
    console.log('─'.repeat(80));

    if (count === 0) {
      console.log('  (empty)\n');
      continue;
    }

    // Get up to 3 sample docs
    const sampleSnap = await col.limit(3).get();
    for (const docSnap of sampleSnap.docs) {
      const data = docSnap.data();
      const fields = Object.keys(data);
      console.log(`\n  📄 ${docSnap.id}`);
      console.log(`     Fields: [${fields.join(', ')}]`);
      console.log(`     Data: ${JSON.stringify(summarize(data), null, 2).split('\n').join('\n     ')}`);
    }

    // Check for subcollections on the first doc
    if (sampleSnap.docs.length > 0) {
      const firstDoc = sampleSnap.docs[0];
      const subCols = await firstDoc.ref.listCollections();
      if (subCols.length > 0) {
        console.log(`\n  ⤷ Subcollections on ${firstDoc.id}:`);
        for (const sub of subCols) {
          const subCount = await sub.count().get();
          console.log(`     📁 ${sub.id}  (${subCount.data().count} docs)`);

          // Sample 1 doc from subcollection
          const subSample = await sub.limit(1).get();
          if (!subSample.empty) {
            const subData = subSample.docs[0].data();
            const subFields = Object.keys(subData);
            console.log(`        📄 ${subSample.docs[0].id}`);
            console.log(`           Fields: [${subFields.join(', ')}]`);
            console.log(`           Data: ${JSON.stringify(summarize(subData), null, 2).split('\n').join('\n           ')}`);
          }
        }
      }
    }

    console.log('');
  }

  console.log('='.repeat(80));
  console.log('END OF DUMP');
  console.log('='.repeat(80));
}

main().catch(err => {
  console.error('Script failed:', err.message);
  process.exit(1);
});
