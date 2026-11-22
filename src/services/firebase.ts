import { initializeApp } from 'firebase/app';
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
  doc,
  getDocFromServer,
  enableNetwork,
  disableNetwork,
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

// Initialize Firestore with auto-detect long-polling and ignoreUndefinedProperties
// so WebChannel uses optimal transport and gracefully adapts behind proxies without forcing legacy XHR polling.
function createFirestoreInstance() {
  try {
    return initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
        ignoreUndefinedProperties: true
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = createFirestoreInstance();
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

export async function enableFirestoreNetwork(force = false): Promise<void> {
  if (!force && !isNetworkExplicitlyDisabled) return;
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
  if (
    isTransientFirestoreError(error) ||
    isFirestoreInternalAssertionError(error) ||
    isNavigatorOffline()
  ) {
    console.warn(`Firestore snapshot paused due to transient network error (${path || 'unknown'}):`, error);
    onTransientOffline?.();
    return;
  }
  handleFirestoreError(error, operationType, path);
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

const probeFirestoreServerOnce = createCoalescedProbe(async () => {
  await getDocFromServer(doc(db, 'test', 'connection'));
});

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

    await Promise.race([probeFirestoreServerOnce(), timeoutPromise]);
    if (timerId) clearTimeout(timerId);
    const latencyMs = Date.now() - startTime;
    return {
      success: true,
      latencyMs,
      message: `تم الاتصال بقاعدة بيانات Firebase بنجاح (زمن الاستجابة: ${latencyMs}ms)`
    };
  } catch (error: unknown) {
    if (timerId) clearTimeout(timerId);
    console.warn("Database connection check:", error);
    const classified = classifyFirestoreConnectionError(error);
    return {
      success: false,
      message: classified.userMessageAr
    };
  }
}

/**
 * Explicitly re-enable Firestore network (if stalled/disconnected) and establish a live server connection.
 */
export async function reconnectFirestore(timeoutMs = 12000): Promise<ConnectionTestResult> {
  if (isNavigatorOffline()) {
    return {
      success: false,
      message: 'الجهاز غير متصل بشبكة الإنترنت حالياً. يرجى التحقق من الشبكة والمحاولة مجدداً.'
    };
  }

  await enableFirestoreNetwork(true);
  let res = await testConnection(timeoutMs);
  if (res.success || isNavigatorOffline()) {
    return res;
  }

  await new Promise((r) => setTimeout(r, 450));
  await enableFirestoreNetwork(true);
  res = await testConnection(timeoutMs);
  return res;
}
