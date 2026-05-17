import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

// Firebase configuration using environment variables for maximum compatibility.
// When deploying to Vercel or other platforms, you must set these variables in your project settings.
// Variables MUST be prefixed with VITE_ to be accessible in the browser.

// Safe check for local config (ignored by git) to support local preview without leaking keys.
const configFiles = import.meta.glob('../../firebase-applet-config.json', { eager: true });
const localConfig = (configFiles['../../firebase-applet-config.json'] as any)?.default;

/**
 * Firebase Config Strategy:
 * 1. Try VITE_ prefixed environment variables (best for Vercel/CI).
 * 2. Fallback to localConfig (only exists in AI Studio / Local Dev).
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || localConfig?.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || localConfig?.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || localConfig?.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || localConfig?.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || localConfig?.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || localConfig?.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || localConfig?.measurementId,
};

const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || localConfig?.firestoreDatabaseId || "(default)";

if (import.meta.env.PROD) {
  console.log("DEBUG - Database ID:", databaseId);
}

// Validation helper for production
const isConfigValid = !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.apiKey !== "missing");

if (!isConfigValid && import.meta.env.PROD) {
  console.error("DEBUG - Current Config:", {
    hasApiKey: !!firebaseConfig.apiKey,
    hasProjectId: !!firebaseConfig.projectId,
    apiKeyStart: firebaseConfig.apiKey?.substring(0, 5) + "..."
  });
}

// Only initialize if we have at least an API key to avoid immediate crash during build or boot
const app = (getApps().length === 0) 
  ? (isConfigValid 
      ? initializeApp(firebaseConfig) 
      : initializeApp({ apiKey: "missing", authDomain: "missing", projectId: "missing" }, "placeholder"))
  : getApp();

if (!isConfigValid && import.meta.env.PROD) {
  console.error("CRITICAL: Firebase configuration is missing in production! You must set VITE_FIREBASE_API_KEY and other environment variables in Vercel.");
}

export const db = getFirestore(app, databaseId);
export const auth = getAuth(app);

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
