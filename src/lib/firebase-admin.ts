/**
 * Firebase Admin SDK singleton for server-side use (API routes).
 * Uses Application Default Credentials in production (Vercel + Google Cloud)
 * or falls back to project ID from environment variables.
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function initAdmin() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // If a service account key JSON string is provided, use it
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccount) {
    try {
      const parsed = JSON.parse(serviceAccount);
      return initializeApp({ credential: cert(parsed) });
    } catch {
      // Fall through to other methods
    }
  }

  // If a file path to the service account key is provided (local dev), use it
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (serviceAccountPath) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    try {
      const parsed = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      return initializeApp({ credential: cert(parsed) });
    } catch {
      // Fall through to other methods
    }
  }

  // In Vercel/GCP, use application default credentials or just project ID
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (projectId) {
    return initializeApp({ projectId });
  }

  return initializeApp();
}

const adminApp = initAdmin();
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
