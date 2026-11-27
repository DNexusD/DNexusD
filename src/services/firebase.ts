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
  confirmPasswordReset,
  updatePassword
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
import { isMissingFirestoreIndexError } from '../utils/firestoreIndexQueries';

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

let secondaryAuthApp: FirebaseApp | null = null;
function getSecondaryAuth() {
  if (!secondaryAuthApp) {
    secondaryAuthApp = initializeApp(firebaseConfig, 'secondary-auth-worker');
  }
  return getAuth(secondaryAuthApp);
}

/**
 * Creates or updates a Firebase Authentication user (e.g., for an office employee or
 * admin-created supplier) on a secondary Auth instance so the active store owner / admin
 * session is never signed out.
 */
export async function provisionSecondaryAuthAccount(params: {
  email: string;
  password?: string;
  previousEmail?: string;
  previousPassword?: string;
}): Promise<{ ok: boolean; uid?: string; reason?: string }> {
  const cleanEmail = (params.email || '').trim().toLowerCase();
  const cleanPassword = (params.password || '').trim();
  if (!cleanEmail || cleanPassword.length < 6) {
    return { ok: false, reason: 'invalid_input_or_short_password' };
  }

  const secAuth = getSecondaryAuth();
  try {
    try {
      const cred = await createUserWithEmailAndPassword(secAuth, cleanEmail, cleanPassword);
      return { ok: true, uid: cred.user.uid };
    } catch (err: unknown) {
      const fbErr = err as { code?: string };
      if (fbErr?.code === 'auth/email-already-in-use') {
        try {
          const samePwdCred = await signInWithEmailAndPassword(secAuth, cleanEmail, cleanPassword);
          return { ok: true, uid: samePwdCred.user.uid, reason: 'already_exists' };
        } catch {
          const oldPwd = (params.previousPassword || '').trim();
          const oldEmail = (params.previousEmail || cleanEmail).trim().toLowerCase();
          if (oldEmail === cleanEmail && oldPwd && oldPwd !== cleanPassword) {
            try {
              const signInCred = await signInWithEmailAndPassword(secAuth, cleanEmail, oldPwd);
              await updatePassword(signInCred.user, cleanPassword);
              return { ok: true, uid: signInCred.user.uid, reason: 'already_exists_updated' };
            } catch {
              return { ok: true, reason: 'already_exists' };
            }
          }
          return { ok: true, reason: 'already_exists' };
        }
      }
      return { ok: false, reason: fbErr?.code || 'auth_provision_failed' };
    }
  } finally {
    await signOut(secAuth).catch(() => {});
  }
}

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

/**
 * Subscribes to an indexed query (e.g. `where` + `orderBy` + optional `limit`) and
 * transparently falls back to an unindexed query if the composite index is not yet built/deployed.
 */
export function safeIndexedOnSnapshot<T = DocumentData>(
  indexedTarget: Query<T>,
  fallbackTarget: Query<T>,
  onNext: (snapshot: QuerySnapshot<T>) => void,
  onError?: (error: unknown) => void
): () => void {
  let isDisposed = false;
  let usingFallback = false;
  let activeUnsub: (() => void) | null = null;

  activeUnsub = safeOnSnapshot(
    indexedTarget,
    onNext,
    (err) => {
      if (isDisposed) return;
      if (!usingFallback && isMissingFirestoreIndexError(err)) {
        usingFallback = true;
        const staleUnsub = activeUnsub;
        activeUnsub = null;
        try {
          staleUnsub?.();
        } catch {
          // ignore stale cleanup errors
        }
        activeUnsub = safeOnSnapshot(fallbackTarget, onNext, onError);
        return;
      }
      onError?.(err);
    }
  );

  return () => {
    isDisposed = true;
    const currentUnsub = activeUnsub;
    activeUnsub = null;
    try {
      currentUnsub?.();
    } catch {
      // ignore cleanup error
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
