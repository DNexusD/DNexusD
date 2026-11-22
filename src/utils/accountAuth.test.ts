import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAuthUserFromIdentity,
  canSwitchRole,
  canSwitchToPosClient,
  canSwitchToSupplier,
  checkEmailRegistrationConflict,
  isMasterAdminEmail,
  resolveAccountIdentityByEmail,
  resolveScopedCurrentPos,
  resolveScopedSupplier,
  filterOrdersForPosClient,
  isNotificationForPosClient,
  filterNotificationsForPosClient,
} from './accountAuth';
import { AuthUser, OfficeEmployee, POSClient, SuperAdmin, Supplier } from '../types';

function makeSupplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: 'sup-1',
    name: 'تاجر النخبة',
    storeName: 'متجر النخبة',
    phone: '0500000001',
    email: 'owner1@store.sa',
    feePercentage: 1,
    fixedFeeAmount: 0,
    feeType: 'percentage',
    walletBalance: 1000,
    bankAccountDetails: {
      bankName: 'الراجحي',
      accountHolder: 'تاجر النخبة',
      iban: 'SA111',
      accountNumber: '111',
    },
    createdAt: '2026-01-01',
    employees: [],
    ...overrides,
  };
}

function makeEmployee(overrides: Partial<OfficeEmployee> = {}): OfficeEmployee {
  return {
    id: 'emp-1',
    supplierId: 'sup-2',
    name: 'موظف المتجر الثاني',
    email: 'staff@store2.sa',
    password: 'EmpPassword2',
    phone: '0550000002',
    roleTitle: 'مسؤول الشحن',
    permissions: {
      canManagePlayerIdOrders: true,
      canAddServices: false,
      canViewClients: false,
    },
    createdAt: '2026-01-02',
    ...overrides,
  };
}

function makePosClient(overrides: Partial<POSClient> = {}): POSClient {
  return {
    id: 'pos-1',
    posCode: 'POS-10001',
    tradeName: 'مركز النور',
    ownerName: 'أحمد العميل',
    phone: '0550000011',
    email: 'client1@pos.sa',
    country: 'السعودية',
    city: 'الرياض',
    supplierId: 'sup-1',
    tier: 'regular',
    walletBalance: 500,
    totalSpent: 100,
    ordersCount: 2,
    createdAt: '2026-01-03',
    qrCodeValue: 'DIGIPOS:POS-10001',
    ...overrides,
  };
}

const sampleSuperAdmin: Pick<SuperAdmin, 'email' | 'adminAccounts'> = {
  email: 'admin@digipos-platform.com',
  adminAccounts: [
    {
      id: 'adm-1',
      name: 'مشرف مالي',
      email: 'finance@digipos.sa',
      password: 'FinPass123',
      phone: '0500000099',
      roleTitle: 'مدير مالي',
      permissions: { canViewStatement: true, canManageFees: true },
      isActive: true,
      createdAt: '2026-01-01',
    },
  ],
};

test('isMasterAdminEmail matches only exact configured/master admin emails and never substrings', () => {
  assert.equal(isMasterAdminEmail('jmiyemen66@gmail.com', 'admin@digipos-platform.com'), true);
  assert.equal(isMasterAdminEmail('ADMIN@digipos-platform.com', 'admin@digipos-platform.com'), true);
  assert.equal(isMasterAdminEmail('admin.shop@gmail.com', 'admin@digipos-platform.com'), false);
  assert.equal(isMasterAdminEmail('super.client@gmail.com', 'admin@digipos-platform.com'), false);
  assert.equal(isMasterAdminEmail('supplier.vip@gmail.com', 'admin@digipos-platform.com'), false);
});

test('resolveAccountIdentityByEmail routes each role exclusively to its own account even if email contains admin/super/supplier', () => {
  const sup1 = makeSupplier({ id: 'sup-1', email: 'owner1@store.sa' });
  const sup2 = makeSupplier({
    id: 'sup-2',
    email: 'admin.owner2@store.sa',
    employees: [makeEmployee({ id: 'emp-2', supplierId: 'sup-2', email: 'super.staff@store2.sa' })],
  });
  const client1 = makePosClient({ id: 'pos-1', email: 'client1@pos.sa', supplierId: 'sup-1' });
  const clientAdminNamed = makePosClient({
    id: 'pos-2',
    email: 'admin.client@shop.sa',
    supplierId: 'sup-2',
  });
  const clientSupplierNamed = makePosClient({
    id: 'pos-3',
    email: 'supplier.user@shop.sa',
    supplierId: 'sup-2',
  });

  const ctx = {
    superAdmin: sampleSuperAdmin,
    suppliers: [sup1, sup2],
    posClients: [client1, clientAdminNamed, clientSupplierNamed],
  };

  // Client whose email contains "admin" stays strictly a pos_client on pos-2
  const r1 = resolveAccountIdentityByEmail('admin.client@shop.sa', ctx);
  assert.equal(r1.kind, 'pos_client');
  if (r1.kind === 'pos_client') {
    assert.equal(r1.posRecords.length, 1);
    assert.equal(r1.posRecords[0].id, 'pos-2');
  }

  // Client whose email contains "supplier" stays strictly a pos_client on pos-3
  const r2 = resolveAccountIdentityByEmail('supplier.user@shop.sa', ctx);
  assert.equal(r2.kind, 'pos_client');
  if (r2.kind === 'pos_client') {
    assert.equal(r2.posRecords[0].id, 'pos-3');
  }

  // Employee goes strictly to their employer store (sup-2) with delegated permissions
  const r3 = resolveAccountIdentityByEmail('super.staff@store2.sa', ctx);
  assert.equal(r3.kind, 'employee');
  if (r3.kind === 'employee') {
    assert.equal(r3.supplier.id, 'sup-2');
    assert.equal(r3.employee.id, 'emp-2');
    const built = buildAuthUserFromIdentity(r3);
    assert.equal(built.role, 'employee');
    assert.equal(built.supplierId, 'sup-2');
    assert.equal(built.authUser.permissions?.canManagePlayerIdOrders, true);
    assert.equal(built.authUser.permissions?.canAddServices, false);
  }

  // Supplier owner goes strictly to their own store (sup-2)
  const r4 = resolveAccountIdentityByEmail('admin.owner2@store.sa', ctx);
  assert.equal(r4.kind, 'supplier');
  if (r4.kind === 'supplier') {
    assert.equal(r4.supplier.id, 'sup-2');
  }

  // Unregistered email NEVER falls back to posClients[0] or suppliers[0]
  const r5 = resolveAccountIdentityByEmail('stranger@unknown.sa', ctx);
  assert.equal(r5.kind, 'unregistered');
});

test('resolveScopedCurrentPos & resolveScopedSupplier never leak another user account on missing or mismatched ID', () => {
  const sup1 = makeSupplier({ id: 'sup-1', email: 'owner1@store.sa' });
  const sup2 = makeSupplier({ id: 'sup-2', email: 'owner2@store.sa' });
  const otherClient = makePosClient({ id: 'pos-other', email: 'other@pos.sa', supplierId: 'sup-1' });
  const myClient = makePosClient({ id: 'pos-me', email: 'me@pos.sa', supplierId: 'sup-2' });

  const myAuthUser: AuthUser = {
    id: 'u-me',
    email: 'me@pos.sa',
    name: 'أنا',
    role: 'pos_client',
    associatedId: 'pos-me',
  };

  // Even if currentPosId points to pos-other, authenticated client cannot resolve to pos-other
  const scopedPos = resolveScopedCurrentPos({
    isAuthenticated: true,
    role: 'pos_client',
    currentUser: myAuthUser,
    currentPosId: 'pos-other',
    posClients: [otherClient, myClient],
  });
  assert.equal(scopedPos.id, 'pos-me');

  // If my client record isn't present yet, NEVER fall back to otherClient (posClients[0])
  const missingPos = resolveScopedCurrentPos({
    isAuthenticated: true,
    role: 'pos_client',
    currentUser: myAuthUser,
    currentPosId: '',
    posClients: [otherClient],
  });
  assert.equal(missingPos.id, '');

  // Authenticated merchant #2 never falls back to merchant #1 (suppliers[0])
  const sup2User: AuthUser = {
    id: 'u-sup2',
    email: 'owner2@store.sa',
    name: 'تاجر 2',
    role: 'supplier',
    associatedId: 'sup-2',
  };
  const scopedSupMissing = resolveScopedSupplier({
    isAuthenticated: true,
    role: 'supplier',
    currentUser: sup2User,
    currentSupplierId: 'sup-1',
    currentPos: otherClient,
    suppliers: [sup1],
    posClients: [otherClient],
  });
  assert.equal(scopedSupMissing.id, '');

  const scopedSupExact = resolveScopedSupplier({
    isAuthenticated: true,
    role: 'supplier',
    currentUser: sup2User,
    currentSupplierId: 'sup-1',
    currentPos: otherClient,
    suppliers: [sup1, sup2],
    posClients: [otherClient],
  });
  assert.equal(scopedSupExact.id, 'sup-2');
});

test('cross-account switching guards prevent jumping to another client, store, or role while authenticated', () => {
  const clientA = makePosClient({ id: 'pos-a', email: 'a@pos.sa', supplierId: 'sup-1' });
  const clientB = makePosClient({ id: 'pos-b', email: 'b@pos.sa', supplierId: 'sup-2' });

  const userA: AuthUser = {
    id: 'u-a',
    email: 'a@pos.sa',
    name: 'عميل أ',
    role: 'pos_client',
    associatedId: 'pos-a',
  };

  assert.equal(
    canSwitchToPosClient({
      isAuthenticated: true,
      currentUser: userA,
      targetPosId: 'pos-a',
      posClients: [clientA, clientB],
    }),
    true
  );
  assert.equal(
    canSwitchToPosClient({
      isAuthenticated: true,
      currentUser: userA,
      targetPosId: 'pos-b',
      posClients: [clientA, clientB],
    }),
    false
  );
  assert.equal(
    canSwitchToSupplier({
      isAuthenticated: true,
      currentUser: userA,
      targetSupplierId: 'sup-2',
      posClients: [clientA, clientB],
    }),
    false
  );
  assert.equal(
    canSwitchRole({
      isAuthenticated: true,
      currentUser: userA,
      nextRole: 'supplier',
    }),
    false
  );

  const empUser: AuthUser = {
    id: 'emp-1',
    email: 'staff@store2.sa',
    name: 'موظف',
    role: 'employee',
    associatedId: 'sup-2',
    supplierId: 'sup-2',
    employeeId: 'emp-1',
  };
  assert.equal(
    canSwitchToSupplier({
      isAuthenticated: true,
      currentUser: empUser,
      targetSupplierId: 'sup-1',
      posClients: [clientA, clientB],
    }),
    false
  );
  assert.equal(
    canSwitchToSupplier({
      isAuthenticated: true,
      currentUser: empUser,
      targetSupplierId: 'sup-2',
      posClients: [clientA, clientB],
    }),
    true
  );
});

test('checkEmailRegistrationConflict prevents cross-role email hijacking', () => {
  const sup1 = makeSupplier({
    id: 'sup-1',
    email: 'owner@store.sa',
    employees: [makeEmployee({ email: 'emp@store.sa' })],
  });
  const pos1 = makePosClient({ id: 'pos-1', email: 'client@pos.sa', supplierId: 'sup-1' });

  assert.equal(
    checkEmailRegistrationConflict({
      email: 'owner@store.sa',
      desiredRole: 'pos_client',
      superAdmin: sampleSuperAdmin,
      suppliers: [sup1],
      posClients: [pos1],
      targetSupplierId: 'sup-1',
    }).conflict,
    true
  );

  assert.equal(
    checkEmailRegistrationConflict({
      email: 'emp@store.sa',
      desiredRole: 'pos_client',
      superAdmin: sampleSuperAdmin,
      suppliers: [sup1],
      posClients: [pos1],
      targetSupplierId: 'sup-1',
    }).conflict,
    true
  );

  assert.equal(
    checkEmailRegistrationConflict({
      email: 'client@pos.sa',
      desiredRole: 'supplier',
      superAdmin: sampleSuperAdmin,
      suppliers: [sup1],
      posClients: [pos1],
    }).conflict,
    true
  );

  assert.equal(
    checkEmailRegistrationConflict({
      email: 'newclient@pos.sa',
      desiredRole: 'pos_client',
      superAdmin: sampleSuperAdmin,
      suppliers: [sup1],
      posClients: [pos1],
      targetSupplierId: 'sup-1',
    }).conflict,
    false
  );
});

test('filterOrdersForPosClient strictly isolates orders by posId and returns empty when posId is missing', () => {
  const orders = [
    { id: 'ord-1', posId: 'pos-1', serviceName: 'PUBG' },
    { id: 'ord-2', posId: 'pos-2', serviceName: 'FreeFire' },
    { id: 'ord-3', posId: '', serviceName: 'Orphan' },
  ];

  const pos1Orders = filterOrdersForPosClient(orders, 'pos-1');
  assert.equal(pos1Orders.length, 1);
  assert.equal(pos1Orders[0].id, 'ord-1');

  assert.equal(filterOrdersForPosClient(orders, '').length, 0);
  assert.equal(filterOrdersForPosClient(orders, undefined).length, 0);
});

test('filterNotificationsForPosClient never leaks notifications from other clients, stores, or supplier-only alerts', () => {
  const notifications = [
    { id: 'n-pos1', posId: 'pos-1', supplierId: 'sup-1', targetRole: 'pos' },
    { id: 'n-pos2', posId: 'pos-2', supplierId: 'sup-1', targetRole: 'pos' },
    { id: 'n-sup', posId: 'pos-1', supplierId: 'sup-1', targetRole: 'supplier' },
    { id: 'n-bcast-sup1', supplierId: 'sup-1', targetRole: 'pos' },
    { id: 'n-bcast-sup2', supplierId: 'sup-2', targetRole: 'pos' },
    { id: 'n-ambiguous', supplierId: 'sup-1' },
  ];

  const pos1Notifs = filterNotificationsForPosClient(notifications, 'pos-1', 'sup-1');
  assert.deepEqual(
    pos1Notifs.map((n) => n.id),
    ['n-pos1', 'n-bcast-sup1']
  );

  assert.equal(isNotificationForPosClient(notifications[1], 'pos-1', 'sup-1'), false);
  assert.equal(isNotificationForPosClient(notifications[2], 'pos-1', 'sup-1'), false);
  assert.equal(isNotificationForPosClient(notifications[4], 'pos-1', 'sup-1'), false);
  assert.equal(isNotificationForPosClient(notifications[5], 'pos-1', 'sup-1'), false);
  assert.equal(filterNotificationsForPosClient(notifications, '', 'sup-1').length, 0);
});

