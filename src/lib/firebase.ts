import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

// In AI Studio, the config is provided in the root.
// We use import.meta.glob to safely handle the optional config file without breaking the build.
const configFiles = import.meta.glob('../../firebase-applet-config.json', { eager: true });
const localConfig = (configFiles['../../firebase-applet-config.json'] as any)?.default || {};

/**
 * Firebase Config Strategy:
 * 1. Use VITE_ environment variables if available (for production/Vercel).
 * 2. Fallback to the local config file (for AI Studio/local dev).
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || localConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || localConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || localConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || localConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || localConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || localConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || localConfig.measurementId,
};

const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || localConfig.firestoreDatabaseId || "(default)";

const isConfigValid = !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.apiKey !== "missing");

if (import.meta.env.DEV) {
  console.log("Firebase Init:", {
    projectId: firebaseConfig.projectId,
    databaseId,
    isValid: isConfigValid
  });
}

const app = (getApps().length === 0) 
  ? initializeApp(firebaseConfig)
  : getApp();

export const db = getFirestore(app, databaseId);
export const auth = getAuth(app);

// Ensure authentication persists across page refreshes
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("Auth persistence setup failed:", err);
});

export async function testConnection() {
  try {
    // Use a path that is publicly readable according to firestore.rules
    await getDocFromServer(doc(db, 'usernames', 'connection_test'));
    console.log("Firestore connection verified.");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn("Firestore connection test result:", errorMessage);
    
    if (errorMessage.includes('the client is offline')) {
      console.error("CRITICAL: Firestore connection failed (client is offline).");
      console.error("This usually means CLOUD FIRESTORE is not enabled in your Firebase Project.");
      console.error("Please go to Firebase Console -> Build -> Firestore Database and click 'Create database'.");
      console.error("Make sure to pick 'Cloud Firestore', NOT 'Realtime Database'.");
    } else if (errorMessage.includes('permission-denied')) {
      // If we get permission denied on a public path, then connection is fine, rules might need adjustment
      console.log("Firestore is online (permission denied on test path).");
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
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
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

  // Check for common connection/setup issues
  if (errorMessage.includes('client is offline')) {
    const helpfulMessage = "Could not connect to database. Please ensure 'Cloud Firestore' is enabled in your Firebase Console (not Realtime Database).";
    console.error('Firestore Setup Error: ', helpfulMessage);
    throw new Error(helpfulMessage);
  }

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(`Firebase Error: ${errorMessage}`);
}
