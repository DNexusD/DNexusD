import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset
} from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  terminate,
  Firestore,
  doc,
  getDocFromServer,
  enableNetwork,
  disableNetwork,
  onSnapshot,
  DocumentReference,
  DocumentSnapshot,
  Query,
  QuerySnapshot,
  DocumentData,
  setLogLevel
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  classifyFirestoreConnectionError,
  createCoalescedProbe,
  isFirestoreInternalAssertionError,
  isNavigatorOffline,
  isTransientFirestoreError
} from '../utils/firestoreConnectivity';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Suppress internal SDK OnlineStateTracker console.error noise during transient WebChannel reconnects;
// real permission/operation errors and connection status are still surfaced via handleFirestoreError and testConnection.
setLogLevel('silent');

// Initialize Firestore with forced long-polling, clean in-memory cache, and ignoreUndefinedProperties
// to prevent proxy WebChannel Watch stream desyncs and stale persistent target state assertions (ca9 / b815).
function createFirestoreInstance(targetApp: FirebaseApp = app): Firestore {
  try {
    return initializeFirestore(
      targetApp,
      {
        experimentalForceLongPolling: true,
        localCache: memoryLocalCache(),
        ignoreUndefinedProperties: true
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(targetApp, firebaseConfig.firestoreDatabaseId);
  }
}

export let db: Firestore = createFirestoreInstance(app);
export const auth = getAuth(app);
auth.languageCode = 'ar';
export const functions = getFunctions(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export {
  httpsCallable,
  signInWithCustomToken,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  isTransientFirestoreError
};

let isNetworkExplicitlyDisabled = false;
let recoveryGeneration = 0;
let recoveryInFlight: Promise<Firestore> | null = null;

type RecoveryListener = () => void;
const recoveryListeners = new Set<RecoveryListener>();

export function subscribeFirestoreRecovery(listener: RecoveryListener): () => void {
  recoveryListeners.add(listener);
  return () => {
    recoveryListeners.delete(listener);
  };
}

/**
 * Recovers from a fatal Firestore AsyncQueue assertion (e.g., ca9 / b815) by spinning up
 * a fresh Firestore instance on a clean secondary app handle and notifying active subscribers.
 */
export async function recoverFirestoreInstance(): Promise<Firestore> {
  if (recoveryInFlight) return recoveryInFlight;
  recoveryInFlight = (async () => {
    const staleDb = db;
    recoveryGeneration += 1;
    const recoveryApp = initializeApp(firebaseConfig, `firestore-recovery-${recoveryGeneration}`);
    const freshDb = createFirestoreInstance(recoveryApp);
    db = freshDb;
    isNetworkExplicitlyDisabled = false;
    probeFirestoreServerOnce.reset();
    try {
      await terminate(staleDb);
    } catch {
      // Ignore termination errors on an already-failed AsyncQueue
    }
    recoveryListeners.forEach((listener) => {
      try {
        listener();
      } catch {
        // Ignore subscriber callback errors
      }
    });
    return freshDb;
  })().finally(() => {
    recoveryInFlight = null;
  });
  return recoveryInFlight;
}

export async function enableFirestoreNetwork(): Promise<void> {
  if (!isNetworkExplicitlyDisabled) return;
  isNetworkExplicitlyDisabled = false;
  try {
    await enableNetwork(db);
  } catch {
    // ignore transient network toggle failure
  }
}

export async function disableFirestoreNetwork(): Promise<void> {
  if (isNetworkExplicitlyDisabled) return;
  isNetworkExplicitlyDisabled = true;
  try {
    await disableNetwork(db);
  } catch {
    // ignore transient network toggle failure
  }
}

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
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  if (isFirestoreInternalAssertionError(error)) {
    void recoverFirestoreInstance();
  }
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
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  if (operationType !== OperationType.LIST) {
    throw new Error(JSON.stringify(errInfo));
  }
}

export function handleSnapshotError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
  onTransientOffline?: () => void
) {
  if (isFirestoreInternalAssertionError(error)) {
    console.warn(`Firestore snapshot encountered internal assertion (${path || 'unknown'}), recovering instance:`, error);
    void recoverFirestoreInstance();
    onTransientOffline?.();
    return;
  }
  if (isTransientFirestoreError(error) || isNavigatorOffline()) {
    console.warn(`Firestore snapshot paused due to transient network error (${path || 'unknown'}):`, error);
    onTransientOffline?.();
    return;
  }
  handleFirestoreError(error, operationType, path);
}

export function safeOnSnapshot<T = DocumentData>(
  target: DocumentReference<T>,
  onNext: (snapshot: DocumentSnapshot<T>) => void,
  onError?: (error: unknown) => void
): () => void;
export function safeOnSnapshot<T = DocumentData>(
  target: Query<T>,
  onNext: (snapshot: QuerySnapshot<T>) => void,
  onError?: (error: unknown) => void
): () => void;
export function safeOnSnapshot<T = DocumentData>(
  target: DocumentReference<T> | Query<T>,
  onNext: ((snapshot: DocumentSnapshot<T>) => void) | ((snapshot: QuerySnapshot<T>) => void),
  onError?: (error: unknown) => void
): () => void {
  let unsub: (() => void) | null = null;
  try {
    unsub =
      target instanceof DocumentReference
        ? onSnapshot(
            target,
            onNext as (snapshot: DocumentSnapshot<T>) => void,
            (err) => {
              if (isFirestoreInternalAssertionError(err)) {
                void recoverFirestoreInstance();
              }
              onError?.(err);
            }
          )
        : onSnapshot(
            target,
            onNext as (snapshot: QuerySnapshot<T>) => void,
            (err) => {
              if (isFirestoreInternalAssertionError(err)) {
                void recoverFirestoreInstance();
              }
              onError?.(err);
            }
          );
  } catch (err) {
    if (isFirestoreInternalAssertionError(err)) {
      void recoverFirestoreInstance();
      return () => {};
    }
    throw err;
  }

  return () => {
    if (!unsub) return;
    try {
      unsub();
    } catch (err) {
      if (isFirestoreInternalAssertionError(err)) {
        void recoverFirestoreInstance();
        return;
      }
      throw err;
    }
  };
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

const probeFirestoreServerOnce = createCoalescedProbe(async () => {
  await getDocFromServer(doc(db, 'test', 'connection'));
});

async function runBoundedServerProbe(timeoutMs: number, forceFresh = false): Promise<number> {
  const startTime = Date.now();
  const timeoutSec = Math.max(1, Math.round(timeoutMs / 1000));
  let timerId: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = setTimeout(
        () => reject(new Error(`انتهت مهلة انتظار الاتصال بقاعدة البيانات (أكثر من ${timeoutSec} ثوانٍ).`)),
        timeoutMs
      );
    });

    await Promise.race([probeFirestoreServerOnce({ forceFresh }), timeoutPromise]);
    return Date.now() - startTime;
  } finally {
    if (timerId) clearTimeout(timerId);
  }
}

/**
 * Validate Connection to Firestore on boot and before any login attempt
 */
export async function testConnection(timeoutMs = 15000): Promise<ConnectionTestResult> {
  if (isNavigatorOffline()) {
    return {
      success: false,
      message: 'الجهاز غير متصل بشبكة الإنترنت حالياً. يرجى التحقق من الشبكة والمحاولة مجدداً.'
    };
  }

  try {
    const latencyMs = await runBoundedServerProbe(timeoutMs, false);
    return {
      success: true,
      latencyMs,
      message: `تم الاتصال بقاعدة بيانات Firebase بنجاح (زمن الاستجابة: ${latencyMs}ms)`
    };
  } catch (error: unknown) {
    if (isFirestoreInternalAssertionError(error)) {
      try {
        await recoverFirestoreInstance();
        const retryLatencyMs = await runBoundedServerProbe(Math.min(timeoutMs, 10000), true);
        return {
          success: true,
          latencyMs: retryLatencyMs,
          message: `تمت استعادة الاتصال بقاعدة بيانات Firebase بنجاح (زمن الاستجابة: ${retryLatencyMs}ms)`
        };
      } catch (retryError: unknown) {
        console.warn("Database connection check after recovery:", retryError);
        const retryClassified = classifyFirestoreConnectionError(retryError);
        return {
          success: false,
          message: retryClassified.userMessageAr
        };
      }
    }
    console.warn("Database connection check:", error);
    const classified = classifyFirestoreConnectionError(error);
    return {
      success: false,
      message: classified.userMessageAr
    };
  }
}

/**
 * Explicitly re-enable Firestore network (only if disabled) and verify a live server connection.
 */
export async function reconnectFirestore(timeoutMs = 12000): Promise<ConnectionTestResult> {
  if (isNavigatorOffline()) {
    return {
      success: false,
      message: 'الجهاز غير متصل بشبكة الإنترنت حالياً. يرجى التحقق من الشبكة والمحاولة مجدداً.'
    };
  }

  await enableFirestoreNetwork();
  const res = await testConnection(timeoutMs);
  if (res.success || isNavigatorOffline()) {
    return res;
  }

  await new Promise((r) => setTimeout(r, 450));
  return testConnection(timeoutMs);
}
