/**
 * Cleanup script: Deletes all users from Firebase Auth AND
 * clears users, usernames, emails collections in Firestore.
 *
 * Usage:
 *   1. Download your Firebase service account key from:
 *      Firebase Console → Project Settings → Service Accounts → Generate New Private Key
 *   2. Save it as `serviceAccountKey.json` in this scripts/ folder
 *   3. Run: node scripts/cleanup-users.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

async function deleteCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  if (snapshot.empty) {
    console.log(`  ${collectionName}: already empty`);
    return 0;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  console.log(`  ${collectionName}: deleted ${snapshot.size} documents`);
  return snapshot.size;
}

async function deleteAllAuthUsers() {
  let totalDeleted = 0;
  let nextPageToken;

  do {
    const listResult = await auth.listUsers(1000, nextPageToken);
    if (listResult.users.length === 0) break;

    const uids = listResult.users.map((u) => u.uid);
    const result = await auth.deleteUsers(uids);
    totalDeleted += result.successCount;

    if (result.failureCount > 0) {
      console.warn(`  Failed to delete ${result.failureCount} users`);
      result.errors.forEach((e) => console.warn(`    ${e.error.message}`));
    }

    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  console.log(`  Firebase Auth: deleted ${totalDeleted} users`);
  return totalDeleted;
}

async function main() {
  console.log('🧹 Cleaning up all users...\n');

  console.log('Firestore collections:');
  await deleteCollection('users');
  await deleteCollection('usernames');
  await deleteCollection('emails');

  console.log('\nFirebase Auth:');
  await deleteAllAuthUsers();

  console.log('\n✅ Done! All users removed.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
