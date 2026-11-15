import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FULL_ADMIN_PERMISSIONS,
  countActiveAdminPermissions,
  resolveEffectiveAdminPermissions,
  isAdminTabAllowed,
  getFirstAllowedAdminTab,
  validateAdminAccountInput
} from './adminAccounts';
import { AdminAccount, AuthUser } from '../types';

test('resolveEffectiveAdminPermissions returns full access for master super_admin without adminPermissions', () => {
  const masterUser: AuthUser = {
    id: 'master-1',
    email: 'admin@digipos-platform.com',
    name: 'الإدارة العامة',
    role: 'super_admin'
  };

  const perms = resolveEffectiveAdminPermissions(masterUser, 'super_admin');
  assert.deepEqual(perms, FULL_ADMIN_PERMISSIONS);
});

test('resolveEffectiveAdminPermissions strictly enforces restricted sub-admin permissions', () => {
  const financeAdmin: AuthUser = {
    id: 'adm-1',
    email: 'finance@digipos.sa',
    name: 'أحمد المالي',
    role: 'super_admin',
    adminAccountId: 'adm-1',
    adminPermissions: {
      canViewStatement: true,
      canSettleAdminWallet: false,
      canManageSuppliers: false,
      canManageFees: true,
      canManageInterfaceSettings: false,
      canManageAdminAccounts: false,
      canClearSystemData: false
    }
  };

  const perms = resolveEffectiveAdminPermissions(financeAdmin, 'super_admin');
  assert.equal(perms.canViewStatement, true);
  assert.equal(perms.canManageFees, true);
  assert.equal(perms.canManageSuppliers, false);
  assert.equal(perms.canManageAdminAccounts, false);
  assert.equal(perms.canClearSystemData, false);

  assert.equal(isAdminTabAllowed('statement', perms), true);
  assert.equal(isAdminTabAllowed('fees', perms), true);
  assert.equal(isAdminTabAllowed('overview', perms), false);
  assert.equal(isAdminTabAllowed('admin_accounts', perms), false);
  assert.equal(getFirstAllowedAdminTab(perms), 'statement');
});

test('getFirstAllowedAdminTab routes operations-only admin to overview or interface_settings', () => {
  const opsOnly = resolveEffectiveAdminPermissions(
    {
      id: 'adm-2',
      email: 'ops@digipos.sa',
      name: 'سالم المشرف',
      role: 'super_admin',
      adminAccountId: 'adm-2',
      adminPermissions: {
        canManageSuppliers: true,
        canManageInterfaceSettings: true
      }
    },
    'super_admin'
  );

  assert.equal(getFirstAllowedAdminTab(opsOnly), 'overview');
  assert.equal(isAdminTabAllowed('statement', opsOnly), false);
  assert.equal(isAdminTabAllowed('interface_settings', opsOnly), true);
});

test('validateAdminAccountInput validates email, duplicates, password, and required permissions', () => {
  const existing: AdminAccount[] = [
    {
      id: 'adm-10',
      name: 'خالد الإداري',
      email: 'khaled@digipos.sa',
      password: 'Password123',
      phone: '+966500000001',
      roleTitle: 'مشرف مالي',
      permissions: { canViewStatement: true },
      isActive: true,
      createdAt: '2026-11-01'
    }
  ];

  // Duplicate email rejected
  const dupRes = validateAdminAccountInput(
    {
      name: 'مستخدم جديد',
      email: 'khaled@digipos.sa',
      password: 'Password123',
      permissions: { canViewStatement: true }
    },
    existing,
    'admin@digipos-platform.com'
  );
  assert.equal(dupRes.valid, false);

  // Master email rejected
  const masterRes = validateAdminAccountInput(
    {
      name: 'مستخدم جديد',
      email: 'jmiyemen66@gmail.com',
      password: 'Password123',
      permissions: { canViewStatement: true }
    },
    existing,
    'admin@digipos-platform.com'
  );
  assert.equal(masterRes.valid, false);

  // Zero permissions rejected
  const noPermRes = validateAdminAccountInput(
    {
      name: 'مستخدم جديد',
      email: 'newadmin@digipos.sa',
      password: 'Password123',
      permissions: {}
    },
    existing,
    'admin@digipos-platform.com'
  );
  assert.equal(noPermRes.valid, false);

  // Valid new account accepted
  const okRes = validateAdminAccountInput(
    {
      name: 'مستخدم جديد',
      email: 'newadmin@digipos.sa',
      password: 'Password123',
      permissions: { canManageSuppliers: true, canManageFees: true }
    },
    existing,
    'admin@digipos-platform.com'
  );
  assert.equal(okRes.valid, true);
  assert.equal(countActiveAdminPermissions({ canManageSuppliers: true, canManageFees: true }), 2);

  // Editing existing account without changing password succeeds
  const editOkRes = validateAdminAccountInput(
    {
      name: 'خالد الإداري',
      email: 'khaled@digipos.sa',
      password: '',
      permissions: { canViewStatement: true, canManageFees: true }
    },
    existing,
    'admin@digipos-platform.com',
    'adm-10'
  );
  assert.equal(editOkRes.valid, true);
});
