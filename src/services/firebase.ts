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
  collection,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// CRITICAL: Initialize Firestore with firestoreDatabaseId and forced long polling
// to prevent WebChannel stream hangs in proxied/sandboxed iframe environments (Cloud Run).
function createFirestoreInstance() {
  try {
    return initializeFirestore(
      app,
      { experimentalForceLongPolling: true },
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
  confirmPasswordReset
};

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

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

/**
 * Validate Connection to Firestore on boot and before any login attempt
 */
export async function testConnection(timeoutMs = 15000): Promise<ConnectionTestResult> {
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

    const checkPromise = getDocFromServer(doc(db, 'test', 'connection'));
    await Promise.race([checkPromise, timeoutPromise]);
    if (timerId) clearTimeout(timerId);
    const latencyMs = Date.now() - startTime;
    return {
      success: true,
      latencyMs,
      message: `تم الاتصال بقاعدة بيانات Firebase بنجاح (زمن الاستجابة: ${latencyMs}ms)`
    };
  } catch (error: unknown) {
    if (timerId) clearTimeout(timerId);
    const err = error as { message?: string };
    console.warn("Database connection check:", error);
    let errMsg = 'تعذر الوصول إلى خادم قاعدة بيانات Firebase Firestore.';
    if (err?.message) {
      if (err.message.includes('مهلة')) {
        errMsg = err.message;
      } else if (err.message.includes('offline') || err.message.includes('client is offline')) {
        errMsg = 'العميل غير متصل بقاعدة البيانات (وضع غير متصل Offline).';
      } else if (err.message.includes('permission-denied')) {
        errMsg = 'تم رفض الاتصال بقاعدة البيانات بسبب قواعد الأمان.';
      } else if (err.message.includes('unavailable')) {
        errMsg = 'خدمة قاعدة بيانات Firestore غير متاحة حالياً أو انقطع الاتصال بالشبكة.';
      }
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      errMsg = 'الجهاز غير متصل بشبكة الإنترنت حالياً. يرجى التحقق من الشبكة والمحاولة مجدداً.';
    }
    return {
      success: false,
      message: errMsg
    };
  }
}

