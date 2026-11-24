export interface ClassifiedFirestoreError {
  isTransient: boolean;
  code: string;
  userMessageAr: string;
}

const TRANSIENT_CODES = new Set([
  'unavailable',
  'deadline-exceeded',
  'cancelled',
  'aborted',
]);

const CACHE_MISS_MESSAGE_SNIPPETS = [
  'failed to get document from cache',
  'failed to get documents from cache',
  'unable to get document from cache',
  'document was not found in the cache',
];

const TRANSIENT_MESSAGE_SNIPPETS = [
  'unavailable',
  'client is offline',
  'offline',
  'could not reach cloud firestore backend',
  'backend didn\'t respond',
  'the operation could not be completed',
  'network-request-failed',
  'failed to fetch',
  'networkerror',
  'load failed',
  'timeout',
  'مهلة',
  ...CACHE_MISS_MESSAGE_SNIPPETS,
];

export function isNavigatorOffline(nav?: { onLine?: boolean } | null): boolean {
  const targetNav =
    nav !== undefined ? nav : typeof navigator !== 'undefined' ? navigator : null;
  return Boolean(targetNav && targetNav.onLine === false);
}

export function extractFirestoreErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const code = (error as { code?: unknown }).code;
  if (typeof code !== 'string') return '';
  return code.trim().toLowerCase().replace(/^firestore\//, '');
}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || '';
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message?: unknown }).message;
    return typeof msg === 'string' ? msg : '';
  }
  return typeof error === 'string' ? error : '';
}

export function isTransientFirestoreError(error: unknown): boolean {
  const code = extractFirestoreErrorCode(error);
  if (code && TRANSIENT_CODES.has(code)) {
    return true;
  }

  const msg = extractErrorMessage(error).toLowerCase();
  if (!msg) return false;

  return TRANSIENT_MESSAGE_SNIPPETS.some((snippet) => msg.includes(snippet));
}

export function classifyFirestoreConnectionError(
  error: unknown,
  nav?: { onLine?: boolean } | null
): ClassifiedFirestoreError {
  const code = extractFirestoreErrorCode(error);
  const rawMessage = extractErrorMessage(error);
  const lowerMsg = rawMessage.toLowerCase();

  if (isNavigatorOffline(nav)) {
    return {
      isTransient: true,
      code: code || 'offline',
      userMessageAr: 'الجهاز غير متصل بشبكة الإنترنت حالياً. يرجى التحقق من الشبكة والمحاولة مجدداً.',
    };
  }

  if (code === 'permission-denied' || lowerMsg.includes('permission-denied') || lowerMsg.includes('insufficient permissions')) {
    return {
      isTransient: false,
      code: 'permission-denied',
      userMessageAr: 'تم رفض الاتصال بقاعدة البيانات بسبب قواعد الأمان.',
    };
  }

  if (rawMessage.includes('مهلة') || code === 'deadline-exceeded') {
    return {
      isTransient: true,
      code: code || 'deadline-exceeded',
      userMessageAr: rawMessage.includes('مهلة')
        ? rawMessage
        : 'انتهت مهلة انتظار الاتصال بقاعدة البيانات. يرجى المحاولة مرة أخرى.',
    };
  }

  if (lowerMsg.includes('offline') || lowerMsg.includes('client is offline')) {
    return {
      isTransient: true,
      code: code || 'unavailable',
      userMessageAr: 'العميل غير متصل بقاعدة البيانات (وضع غير متصل Offline).',
    };
  }

  if (isTransientFirestoreError(error)) {
    return {
      isTransient: true,
      code: code || 'unavailable',
      userMessageAr: 'خدمة قاعدة بيانات Firestore غير متاحة حالياً أو انقطع الاتصال بالشبكة.',
    };
  }

  if (isFirestoreInternalAssertionError(error)) {
    return {
      isTransient: true,
      code: code || 'internal-assertion',
      userMessageAr: 'حدث تعارض مؤقت في مزامنة اتصال قاعدة البيانات. يرجى المحاولة مرة أخرى.',
    };
  }

  return {
    isTransient: false,
    code,
    userMessageAr: 'تعذر الوصول إلى خادم قاعدة بيانات Firebase Firestore.',
  };
}

export function isFirestoreCacheMissError(error: unknown): boolean {
  const msg = extractErrorMessage(error).toLowerCase();
  if (!msg) return false;
  return CACHE_MISS_MESSAGE_SNIPPETS.some((snippet) => msg.includes(snippet));
}

export function isFirestoreInternalAssertionError(error: unknown): boolean {
  const msg = extractErrorMessage(error).toLowerCase();
  if (!msg) return false;
  return (
    msg.includes('internal assertion failed') ||
    (msg.includes('unexpected state') && (msg.includes('ca9') || msg.includes('b815')))
  );
}

/**
 * Coalesces concurrent async probe calls (e.g. boot / login / retry checks)
 * so only a single server request is in-flight at a time, while expiring
 * stale hung promises or allowing forced fresh probes after DB recovery.
 */
export function createCoalescedProbe<T>(
  probeFn: () => Promise<T>,
  maxWaitMs = 15000
): ((options?: { forceFresh?: boolean }) => Promise<T>) & { reset: () => void } {
  let inFlight: Promise<T> | null = null;
  let startedAt = 0;

  const runner = (options?: { forceFresh?: boolean }) => {
    const now = Date.now();
    const expired = inFlight !== null && now - startedAt > maxWaitMs;
    if (!inFlight || expired || options?.forceFresh) {
      startedAt = now;
      const current = probeFn().finally(() => {
        if (inFlight === current) {
          inFlight = null;
        }
      });
      inFlight = current;
    }
    return inFlight;
  };

  runner.reset = () => {
    inFlight = null;
    startedAt = 0;
  };

  return runner;
}

