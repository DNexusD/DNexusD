import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chunkArray,
  executeIndexedQueryWithFallback,
  isMissingFirestoreIndexError,
  sortRecordsByDateDesc,
} from './firestoreIndexQueries';

test('isMissingFirestoreIndexError recognizes Firestore composite index errors only', () => {
  assert.equal(
    isMissingFirestoreIndexError({
      code: 'failed-precondition',
      message: 'The query requires an index. You can create it here: https://console.firebase.google.com/...create_composite=abc',
    }),
    true
  );
  assert.equal(
    isMissingFirestoreIndexError({
      code: 'firestore/failed-precondition',
      message: 'The index is currently building and cannot be used yet.',
    }),
    true
  );
  assert.equal(
    isMissingFirestoreIndexError(new Error('Query requires an index')),
    true
  );
  assert.equal(
    isMissingFirestoreIndexError({
      code: 'permission-denied',
      message: 'Missing or insufficient permissions.',
    }),
    false
  );
  assert.equal(
    isMissingFirestoreIndexError({
      code: 'unavailable',
      message: 'The operation could not be completed',
    }),
    false
  );
});

test('executeIndexedQueryWithFallback uses indexed query when available and falls back on missing index', async () => {
  const fastResult = await executeIndexedQueryWithFallback(
    async () => ['indexed-row'],
    async () => ['fallback-row']
  );
  assert.deepEqual(fastResult, ['indexed-row']);

  let fallbackTriggered = false;
  const fallbackResult = await executeIndexedQueryWithFallback(
    async () => {
      throw { code: 'failed-precondition', message: 'The query requires an index.' };
    },
    async () => ['fallback-row'],
    () => {
      fallbackTriggered = true;
    }
  );
  assert.equal(fallbackTriggered, true);
  assert.deepEqual(fallbackResult, ['fallback-row']);

  await assert.rejects(
    () =>
      executeIndexedQueryWithFallback(
        async () => {
          throw { code: 'permission-denied', message: 'Denied' };
        },
        async () => ['fallback-row']
      ),
    (err: { code?: string }) => err?.code === 'permission-denied'
  );
});

test('chunkArray respects Firestore IN query batch limits', () => {
  assert.deepEqual(chunkArray([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunkArray([], 30), []);
});

test('sortRecordsByDateDesc orders newest records first and handles missing dates safely', () => {
  const sorted = sortRecordsByDateDesc(
    [
      { id: 'old', date: '2026-01-01T10:00:00.000Z' },
      { id: 'missing' },
      { id: 'new', date: '2026-11-27T12:00:00.000Z' },
    ],
    (x) => x.date
  );
  assert.deepEqual(
    sorted.map((x) => x.id),
    ['new', 'old', 'missing']
  );
});
