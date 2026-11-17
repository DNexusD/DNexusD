import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLEAN_BOOT_STORAGE_FLAG,
  ensureCleanBootLocalStorageOnce,
  filterPreservedFixedCatalogs,
  isPreservedAdminAuthUser,
  mergeSuperAdminAccountsForPreservation,
  RESET_LOCAL_STORAGE_KEYS_TO_CLEAR,
  sanitizeLocalStorageForCleanReset,
  MinimalStorage,
} from './systemReset';
import { AuthUser, Catalog } from '../types';

function createMemoryStorage(initial: Record<string, string> = {}): MinimalStorage & { dump: () => Record<string, string> } {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    },
    dump() {
      return Object.fromEntries(store.entries());
    },
  };
}

describe('systemReset utilities', () => {
  it('preserves Super Admin and Admin staff users while rejecting suppliers, supplier employees, and POS clients', () => {
    const adminContext = {
      email: 'admin@digipos-platform.com',
      adminAccounts: [
        { id: 'adm-101', email: 'finance.staff@digipos.sa' },
        { id: 'adm-102', email: 'ops.staff@digipos.sa' },
      ],
    };

    const masterAdmin: Partial<AuthUser> = {
      id: 'usr-master',
      email: 'admin@digipos-platform.com',
      role: 'super_admin',
    };
    const googleAdmin: Partial<AuthUser> = {
      id: 'uid-google',
      email: 'jmiyemen66@gmail.com',
      role: 'pos_client',
    };
    const adminStaffByRole: Partial<AuthUser> = {
      id: 'adm-101',
      email: 'finance.staff@digipos.sa',
      role: 'super_admin',
      adminAccountId: 'adm-101',
    };
    const adminStaffByEmailOnly: Partial<AuthUser> = {
      id: 'uid-999',
      email: 'ops.staff@digipos.sa',
    };

    const seededSupplier: Partial<AuthUser> = {
      id: 'usr-sup-1',
      email: 'jamal.digital@supplier.sa',
      role: 'supplier',
    };
    const supplierEmployee: Partial<AuthUser> = {
      id: 'emp-jamal-01',
      email: 'ahmed.emp@supplier.sa',
      role: 'employee',
      supplierId: 'sup-jamal-01',
    };
    const posClient: Partial<AuthUser> = {
      id: 'usr-pos-1',
      email: 'pos.alamal@digipos.sa',
      role: 'pos_client',
    };
    const customRegisteredUser: Partial<AuthUser> = {
      id: 'uid-user-123',
      email: 'customer@example.com',
      role: 'pos_client',
    };

    assert.equal(isPreservedAdminAuthUser(masterAdmin, adminContext), true);
    assert.equal(isPreservedAdminAuthUser(googleAdmin, adminContext), true);
    assert.equal(isPreservedAdminAuthUser(adminStaffByRole, adminContext), true);
    assert.equal(isPreservedAdminAuthUser(adminStaffByEmailOnly, adminContext), true);

    assert.equal(isPreservedAdminAuthUser(seededSupplier, adminContext), false);
    assert.equal(isPreservedAdminAuthUser(supplierEmployee, adminContext), false);
    assert.equal(isPreservedAdminAuthUser(posClient, adminContext), false);
    assert.equal(isPreservedAdminAuthUser(customRegisteredUser, adminContext), false);
    assert.equal(isPreservedAdminAuthUser(null, adminContext), false);
  });

  it('keeps only fixed admin catalogs and removes supplier/auto-seeded catalogs', () => {
    const catalogs: Catalog[] = [
      { id: 'cat-games', supplierId: 'sup-jamal-01', nameAr: 'ألعاب', descriptionAr: '', icon: 'Gamepad2', serviceCount: 3 },
      { id: 'cat-free-gifts', supplierId: 'sup-jamal-01', nameAr: 'هدايا', descriptionAr: '', icon: 'Gift', serviceCount: 1, isFreeGiftsCatalog: true },
      { id: 'cat-fixed-1', supplierId: 'all', nameAr: 'كتالوج ثابت', descriptionAr: '', icon: 'Layers', serviceCount: 0, isFixedByAdmin: true },
      { id: 'cat-fixed-2', supplierId: 'all', nameAr: 'اتصالات رسمية', descriptionAr: '', icon: 'Globe', serviceCount: 0 },
    ];

    const kept = filterPreservedFixedCatalogs(catalogs);
    assert.deepEqual(
      kept.map((c) => c.id),
      ['cat-fixed-1', 'cat-fixed-2']
    );
  });

  it('sanitizes localStorage by removing non-admin keys while keeping admin, platform settings, fixed catalogs, and admin session', () => {
    const storage = createMemoryStorage({
      digipos_admin_v2: JSON.stringify({
        name: 'الإدارة العامة',
        email: 'admin@digipos-platform.com',
        adminAccounts: [{ id: 'adm-1', email: 'staff@digipos.sa' }],
      }),
      digipos_platform_settings_v1: JSON.stringify({ showPosInterfaceNotice: true }),
      digipos_catalogs_v2: JSON.stringify([
        { id: 'cat-games', supplierId: 'sup-jamal-01', nameAr: 'ألعاب', descriptionAr: '', icon: 'Gamepad2', serviceCount: 2 },
        { id: 'cat-fixed-1', supplierId: 'all', nameAr: 'ثابت', descriptionAr: '', icon: 'Layers', serviceCount: 0, isFixedByAdmin: true },
      ]),
      digipos_services_v2: JSON.stringify([{ id: 'srv-pubg' }]),
      digipos_suppliers_v2: JSON.stringify([{ id: 'sup-jamal-01' }]),
      digipos_clients_v2: JSON.stringify([{ id: 'pos-1' }]),
      digipos_voucher_warehouses_v1: JSON.stringify([{ id: 'wh-1' }]),
      digipos_supplier_bank_accounts_v1: JSON.stringify([{ id: 'bank-1' }]),
      digipos_orders_v2: JSON.stringify([{ id: 'ord-1' }]),
      digipos_auth_user: JSON.stringify({ id: 'adm-1', email: 'staff@digipos.sa', role: 'super_admin', adminAccountId: 'adm-1' }),
    });

    const res = sanitizeLocalStorageForCleanReset(storage);
    assert.equal(res.preservedAdminSession, true);
    assert.equal(res.preservedFixedCatalogsCount, 1);

    for (const key of RESET_LOCAL_STORAGE_KEYS_TO_CLEAR) {
      assert.equal(storage.getItem(key), null, `${key} should be cleared`);
    }
    assert.ok(storage.getItem('digipos_admin_v2'));
    assert.ok(storage.getItem('digipos_platform_settings_v1'));
    assert.ok(storage.getItem('digipos_auth_user'));
    const savedCatalogs = JSON.parse(storage.getItem('digipos_catalogs_v2') || '[]');
    assert.equal(savedCatalogs.length, 1);
    assert.equal(savedCatalogs[0].id, 'cat-fixed-1');
  });

  it('logs out non-admin users during clean boot migration and runs only once', () => {
    const storage = createMemoryStorage({
      digipos_services_v2: JSON.stringify([{ id: 'srv-pubg' }]),
      digipos_clients_v2: JSON.stringify([{ id: 'pos-1' }]),
      digipos_auth_user: JSON.stringify({ id: 'usr-1', email: 'pos.alamal@digipos.sa', role: 'pos_client' }),
    });

    const first = ensureCleanBootLocalStorageOnce(storage);
    assert.equal(first.didRun, true);
    assert.equal(first.preservedAdminSession, false);
    assert.equal(storage.getItem('digipos_auth_user'), null);
    assert.equal(storage.getItem('digipos_services_v2'), null);
    assert.equal(storage.getItem(CLEAN_BOOT_STORAGE_FLAG), '1');

    // Simulate newly created real user/service after clean boot
    storage.setItem('digipos_services_v2', JSON.stringify([{ id: 'srv-new-real' }]));
    const second = ensureCleanBootLocalStorageOnce(storage);
    assert.equal(second.didRun, false);
    assert.ok(storage.getItem('digipos_services_v2'));
  });

  it('merges local and remote adminAccounts without losing any admin staff email', () => {
    const merged = mergeSuperAdminAccountsForPreservation(
      { email: 'admin@digipos-platform.com', adminAccounts: [{ id: 'adm-1', email: 'a@digipos.sa' }] as never },
      { email: 'admin@digipos-platform.com', adminAccounts: [{ id: 'adm-2', email: 'b@digipos.sa' }] as never }
    );
    assert.equal(merged.adminAccounts?.length, 2);
  });
});
