import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyFirestoreConnectionError,
  createCoalescedProbe,
  extractFirestoreErrorCode,
  isFirestoreInternalAssertionError,
  isNavigatorOffline,
  isTransientFirestoreError,
} from './firestoreConnectivity';

test('isNavigatorOffline detects navigator.onLine === false safely', () => {
  assert.equal(isNavigatorOffline({ onLine: false }), true);
  assert.equal(isNavigatorOffline({ onLine: true }), false);
  assert.equal(isNavigatorOffline({}), false);
  assert.equal(isNavigatorOffline(null), false);
});

test('extractFirestoreErrorCode normalizes firestore prefixed and plain codes', () => {
  assert.equal(extractFirestoreErrorCode({ code: 'unavailable' }), 'unavailable');
  assert.equal(extractFirestoreErrorCode({ code: 'firestore/deadline-exceeded' }), 'deadline-exceeded');
  assert.equal(extractFirestoreErrorCode(new Error('plain')), '');
});

test('isTransientFirestoreError identifies unavailable and WebChannel offline errors', () => {
  assert.equal(
    isTransientFirestoreError({
      code: 'unavailable',
      message: 'The operation could not be completed',
    }),
    true
  );
  assert.equal(
    isTransientFirestoreError(
      new Error('Failed to get document because the client is offline.')
    ),
    true
  );
  assert.equal(
    isTransientFirestoreError(
      new Error('Could not reach Cloud Firestore backend. Connection failed 1 times.')
    ),
    true
  );
  assert.equal(
    isTransientFirestoreError({
      code: 'permission-denied',
      message: 'Missing or insufficient permissions.',
    }),
    false
  );
});

test('classifyFirestoreConnectionError separates offline/unavailable from permission-denied', () => {
  const offlineRes = classifyFirestoreConnectionError(new Error('any'), { onLine: false });
  assert.equal(offlineRes.isTransient, true);
  assert.match(offlineRes.userMessageAr, /غير متصل/);

  const unavailableRes = classifyFirestoreConnectionError(
    { code: 'unavailable', message: 'The operation could not be completed' },
    { onLine: true }
  );
  assert.equal(unavailableRes.isTransient, true);
  assert.equal(unavailableRes.code, 'unavailable');

  const permRes = classifyFirestoreConnectionError(
    { code: 'permission-denied', message: 'Missing or insufficient permissions.' },
    { onLine: true }
  );
  assert.equal(permRes.isTransient, false);
  assert.equal(permRes.code, 'permission-denied');

  const assertionRes = classifyFirestoreConnectionError(
    new Error('FIRESTORE (13.2.0) INTERNAL ASSERTION FAILED: Unexpected state (ID: ca9)'),
    { onLine: true }
  );
  assert.equal(assertionRes.isTransient, true);
  assert.equal(assertionRes.code, 'internal-assertion');
});

test('isFirestoreInternalAssertionError detects ca9 and b815 assertion errors', () => {
  assert.equal(
    isFirestoreInternalAssertionError(
      new Error('FIRESTORE (13.2.0) INTERNAL ASSERTION FAILED: Unexpected state (ID: ca9)')
    ),
    true
  );
  assert.equal(
    isFirestoreInternalAssertionError(
      new Error('Unexpected state (ID: b815)')
    ),
    true
  );
  assert.equal(
    isFirestoreInternalAssertionError(new Error('Missing or insufficient permissions')),
    false
  );
});

test('createCoalescedProbe shares in-flight promises and resets after settlement', async () => {
  let invocations = 0;
  const runProbe = createCoalescedProbe(async () => {
    invocations += 1;
    await new Promise((resolve) => setTimeout(resolve, 15));
    return invocations;
  });

  const [r1, r2, r3] = await Promise.all([runProbe(), runProbe(), runProbe()]);
  assert.equal(invocations, 1);
  assert.deepEqual([r1, r2, r3], [1, 1, 1]);

  const r4 = await runProbe();
  assert.equal(invocations, 2);
  assert.equal(r4, 2);
});

