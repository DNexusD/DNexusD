import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSupplierClientsComparison,
  readLocalClientsForSupplier,
} from './supplierClientsDirectory';
import { AuthUser, POSClient } from '../types';

function makeClient(overrides: Partial<POSClient> & { id: string; supplierId: string }): POSClient {
  return {
    id: overrides.id,
    posCode: overrides.posCode ?? `POS-${overrides.id}`,
    tradeName: overrides.tradeName ?? 'متجر تجريبي',
    ownerName: overrides.ownerName ?? 'مالك تجريبي',
    phone: overrides.phone ?? '0500000000',
    email: overrides.email ?? '',
    country: overrides.country ?? 'السعودية',
    city: overrides.city ?? 'الرياض',
    supplierId: overrides.supplierId,
    tier: overrides.tier ?? 'regular',
    walletBalance: overrides.walletBalance ?? 100,
    totalSpent: overrides.totalSpent ?? 0,
    ordersCount: overrides.ordersCount ?? 0,
    qrCodeValue: overrides.qrCodeValue ?? `POS:${overrides.id}`,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
  };
}

describe('supplierClientsDirectory', () => {
  it('reads local clients for the target supplier from storage and falls back cleanly on malformed JSON', () => {
    const sup1Client = makeClient({ id: 'c-1', supplierId: 'sup-1', email: 'c1@example.com' });
    const sup2Client = makeClient({ id: 'c-2', supplierId: 'sup-2', email: 'c2@example.com' });

    const validStorage = {
      getItem: (key: string) =>
        key === 'digipos_clients_v2' ? JSON.stringify([sup1Client, sup2Client]) : null,
    };
    const result = readLocalClientsForSupplier('sup-1', [], validStorage);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'c-1');

    const badStorage = {
      getItem: () => '{invalid-json',
    };
    const fallbackResult = readLocalClientsForSupplier('sup-1', [sup1Client, sup2Client], badStorage);
    assert.equal(fallbackResult.length, 1);
    assert.equal(fallbackResult[0].id, 'c-1');
  });

  it('compares local and Firebase clients accurately (synced, local_only, firebase_only, different)', () => {
    const localClients: POSClient[] = [
      makeClient({
        id: 'c-synced',
        supplierId: 'sup-1',
        posCode: 'POS-100',
        email: 'synced@pos.sa',
        walletBalance: 250,
      }),
      makeClient({
        id: 'c-local-only',
        supplierId: 'sup-1',
        posCode: 'POS-200',
        email: 'localonly@pos.sa',
        walletBalance: 50,
      }),
      makeClient({
        id: 'c-diff',
        supplierId: 'sup-1',
        posCode: 'POS-300',
        email: 'diff@pos.sa',
        walletBalance: 100,
      }),
      makeClient({
        id: 'c-other-sup',
        supplierId: 'sup-2',
        posCode: 'POS-999',
        email: 'other@pos.sa',
      }),
    ];

    const firebaseClients: POSClient[] = [
      makeClient({
        id: 'c-synced',
        supplierId: 'sup-1',
        posCode: 'POS-100',
        email: 'synced@pos.sa',
        walletBalance: 250,
      }),
      makeClient({
        id: 'c-diff',
        supplierId: 'sup-1',
        posCode: 'POS-300',
        email: 'diff@pos.sa',
        walletBalance: 450,
      }),
      makeClient({
        id: 'c-remote-only',
        supplierId: 'sup-1',
        posCode: 'POS-400',
        email: '',
        walletBalance: 90,
      }),
      makeClient({
        id: 'c-other-sup-remote',
        supplierId: 'sup-2',
        posCode: 'POS-888',
        email: 'other2@pos.sa',
      }),
    ];

    const firebaseUsers: AuthUser[] = [
      {
        id: 'c-remote-only',
        email: 'REMOTE-USER@POS.SA',
        name: 'عميل فايربيس',
        role: 'pos_client',
        associatedId: 'c-remote-only',
      },
    ];

    const comparison = buildSupplierClientsComparison({
      supplierId: 'sup-1',
      localClients,
      firebaseClients,
      firebaseUsers,
    });

    assert.deepEqual(comparison.summary, {
      localCount: 3,
      firebaseCount: 3,
      syncedCount: 1,
      localOnlyCount: 1,
      firebaseOnlyCount: 1,
      differentCount: 1,
    });

    const byId = new Map(comparison.comparisonRows.map((row) => [row.id, row]));
    assert.equal(byId.get('c-synced')?.syncStatus, 'synced');
    assert.equal(byId.get('c-local-only')?.syncStatus, 'local_only');
    assert.equal(byId.get('c-remote-only')?.syncStatus, 'firebase_only');
    assert.equal(byId.get('c-remote-only')?.loginEmail, 'remote-user@pos.sa');
    assert.equal(byId.get('c-diff')?.syncStatus, 'different');
    assert.equal(byId.has('c-other-sup'), false);
    assert.equal(byId.has('c-other-sup-remote'), false);
  });
});
