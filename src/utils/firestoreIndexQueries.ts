import { extractErrorMessage, extractFirestoreErrorCode } from './firestoreConnectivity';

const MISSING_INDEX_SNIPPETS = [
  'requires an index',
  'requires a composite index',
  'index is currently building',
  'no matching index found',
  'create_composite=',
];

/**
 * Detects Firestore missing/building composite index errors (`failed-precondition`)
 * so queries can transparently fall back to single-field indexed queries without downtime.
 */
export function isMissingFirestoreIndexError(error: unknown): boolean {
  const code = extractFirestoreErrorCode(error);
  const msg = extractErrorMessage(error).toLowerCase();

  if (MISSING_INDEX_SNIPPETS.some((snippet) => msg.includes(snippet))) {
    return true;
  }

  return code === 'failed-precondition' && (msg.includes('index') || msg === '');
}

/**
 * Executes an optimized composite-indexed query and transparently falls back
 * to a single-field query if the composite index is not yet deployed or still building.
 */
export async function executeIndexedQueryWithFallback<T>(
  indexedOp: () => Promise<T>,
  fallbackOp: () => Promise<T>,
  onFallback?: (error: unknown) => void
): Promise<T> {
  try {
    return await indexedOp();
  } catch (err) {
    if (isMissingFirestoreIndexError(err)) {
      onFallback?.(err);
      return await fallbackOp();
    }
    throw err;
  }
}

/**
 * Splits a list into bounded chunks (e.g., 30 for Firestore `in` operator limits).
 */
export function chunkArray<T>(items: readonly T[], chunkSize = 30): T[][] {
  const safeSize = Math.max(1, Math.floor(chunkSize));
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += safeSize) {
    chunks.push(items.slice(i, i + safeSize));
  }
  return chunks;
}

/**
 * Deterministic newest-first sorter for ISO date strings (`date`, `createdAt`, `updatedAt`).
 */
export function sortRecordsByDateDesc<T>(
  items: readonly T[],
  getDate: (item: T) => string | undefined | null
): T[] {
  return [...items].sort((a, b) => {
    const tA = new Date(getDate(a) || 0).getTime() || 0;
    const tB = new Date(getDate(b) || 0).getTime() || 0;
    return tB - tA;
  });
}
