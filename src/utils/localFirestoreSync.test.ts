import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearEntityPendingSync,
  markEntityPendingSync,
  readPendingSyncMap,
  readSyncedIdsMap,
  reconcileCollectionWithRemote,
  reconcilePlatformSettingsWithRemote,
  reconcileSuperAdminWithRemote,
  writeSyncedIdsMap,
} from './localFirestoreSync';
import { DEFAULT_PLATFORM_INTERFACE_SETTINGS } from './platformSettings';
import { SuperAdmin } from '../types';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe('localFirestoreSync pending & synced storage helpers', () => {
  it('marks, deduplicates, and clears pending entity IDs cleanly', () => {
    const storage = createMemoryStorage();

    markEntityPendingSync('suppliers', 'sup-1', storage);
    markEntityPendingSync('suppliers', 'sup-1', storage);
    markEntityPendingSync('suppliers', 'sup-2', storage);
    markEntityPendingSync('orders', 'ord-9', storage);

    assert.deepEqual(readPendingSyncMap(storage), {
      suppliers: ['sup-1', 'sup-2'],
      orders: ['ord-9'],
    });

    clearEntityPendingSync('suppliers', 'sup-1', storage);
    assert.deepEqual(readPendingSyncMap(storage), {
      suppliers: ['sup-2'],
      orders: ['ord-9'],
    });

    clearEntityPendingSync('suppliers', 'sup-2', storage);
    assert.deepEqual(readPendingSyncMap(storage), {
      orders: ['ord-9'],
    });
  });

  it('persists and reads synced IDs map', () => {
    const storage = createMemoryStorage();
    writeSyncedIdsMap({ suppliers: ['sup-1'], catalogs: ['cat-1', 'cat-2'] }, storage);
    assert.deepEqual(readSyncedIdsMap(storage), {
      suppliers: ['sup-1'],
      catalogs: ['cat-1', 'cat-2'],
    });
  });
});

describe('reconcileCollectionWithRemote', () => {
  it('pushes new unsynced local records while keeping remote records', () => {
    const local = [
      { id: 'sup-local-new', name: 'متجر محلي جديد' },
      { id: 'sup-shared', name: 'نسخة محلية قديمة' },
    ];
    const remote = [
      { id: 'sup-shared', name: 'نسخة سحابية محدثة' },
      { id: 'sup-remote-only', name: 'متجر سحابي' },
    ];

    const res = reconcileCollectionWithRemote(local, remote, ['sup-shared'], []);

    assert.equal(res.toPushToRemote.length, 1);
    assert.equal(res.toPushToRemote[0].id, 'sup-local-new');
    assert.equal(res.merged.find((x) => x.id === 'sup-shared')?.name, 'نسخة سحابية محدثة');
    assert.equal(res.merged.find((x) => x.id === 'sup-remote-only')?.name, 'متجر سحابي');
    assert.equal(res.merged.find((x) => x.id === 'sup-local-new')?.name, 'متجر محلي جديد');
    assert.deepEqual(new Set(res.nextSyncedIds), new Set(['sup-shared', 'sup-remote-only', 'sup-local-new']));
  });

  it('prefers local version over remote when entity ID is marked pending locally', () => {
    const local = [{ id: 'srv-1', name: 'خدمة محدثة أوفلاين' }];
    const remote = [{ id: 'srv-1', name: 'خدمة قديمة على الخادم' }];

    const res = reconcileCollectionWithRemote(local, remote, ['srv-1'], ['srv-1']);

    assert.equal(res.merged.length, 1);
    assert.equal(res.merged[0].name, 'خدمة محدثة أوفلاين');
    assert.equal(res.toPushToRemote.length, 1);
    assert.equal(res.toPushToRemote[0].name, 'خدمة محدثة أوفلاين');
  });

  it('does not resurrect items previously synced that were deleted on Firestore', () => {
    const local = [
      { id: 'ord-deleted-remotely', name: 'طلب محذوف سحابياً' },
      { id: 'ord-kept', name: 'طلب باقٍ' },
    ];
    const remote = [{ id: 'ord-kept', name: 'طلب باقٍ' }];

    const res = reconcileCollectionWithRemote(
      local,
      remote,
      ['ord-deleted-remotely', 'ord-kept'],
      []
    );

    assert.equal(res.merged.length, 1);
    assert.equal(res.merged[0].id, 'ord-kept');
    assert.equal(res.toPushToRemote.length, 0);
  });

  it('preserves a locally deleted-on-remote item if it has a pending local mutation', () => {
    const local = [{ id: 'ord-pending-offline', name: 'طلب معدل أوفلاين' }];
    const remote: Array<{ id: string; name: string }> = [];

    const res = reconcileCollectionWithRemote(
      local,
      remote,
      ['ord-pending-offline'],
      ['ord-pending-offline']
    );

    assert.equal(res.merged.length, 1);
    assert.equal(res.toPushToRemote.length, 1);
    assert.equal(res.toPushToRemote[0].id, 'ord-pending-offline');
  });
});

describe('reconcileSuperAdminWithRemote & reconcilePlatformSettingsWithRemote', () => {
  const baseAdmin: SuperAdmin = {
    name: 'المدير العام',
    email: 'admin@digipos-platform.com',
    walletBalance: 0,
    defaultFeePercentage: 1.5,
    defaultFixedFeeAmount: 1,
    defaultFeeType: 'percentage',
    bankAccounts: [],
    adminAccounts: [
      {
        id: 'adm-1',
        name: 'مشرف محلي',
        email: 'staff1@digipos-platform.com',
        phone: '+966500000001',
        roleTitle: 'مشرف مالي',
        password: 'pass',
        isActive: true,
        permissions: {
          canViewStatement: true,
          canSettleAdminWallet: false,
          canManageSuppliers: true,
          canManageFees: true,
          canManageInterfaceSettings: false,
          canManageAdminAccounts: false,
          canClearSystemData: false,
        },
        createdAt: '2026-01-01',
      },
    ],
  };

  it('pushes local superAdmin if remote is missing or has fewer staff accounts', () => {
    const missingRemote = reconcileSuperAdminWithRemote(baseAdmin, null, false);
    assert.equal(missingRemote.shouldPushToRemote, true);
    assert.equal(missingRemote.merged.adminAccounts?.length, 1);

    const fewerRemote = reconcileSuperAdminWithRemote(
      baseAdmin,
      { email: 'admin@digipos-platform.com', adminAccounts: [] },
      false
    );
    assert.equal(fewerRemote.shouldPushToRemote, true);
    assert.equal(fewerRemote.merged.adminAccounts?.length, 1);
  });

  it('reconciles platformSettings honoring local pending overrides', () => {
    const localSettings = {
      ...DEFAULT_PLATFORM_INTERFACE_SETTINGS,
      supplierInterfaceNotice: 'إشعار محلي معدل',
    };
    const remoteSettings = {
      ...DEFAULT_PLATFORM_INTERFACE_SETTINGS,
      supplierInterfaceNotice: 'إشعار سحابي',
    };

    const nonPending = reconcilePlatformSettingsWithRemote(localSettings, remoteSettings, false);
    assert.equal(nonPending.shouldPushToRemote, false);
    assert.equal(nonPending.merged.supplierInterfaceNotice, 'إشعار سحابي');

    const pending = reconcilePlatformSettingsWithRemote(localSettings, remoteSettings, true);
    assert.equal(pending.shouldPushToRemote, true);
    assert.equal(pending.merged.supplierInterfaceNotice, 'إشعار محلي معدل');
  });
});
