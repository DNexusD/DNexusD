import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAuthUserFromIdentity,
  canSwitchRole,
  canSwitchToPosClient,
  canSwitchToSupplier,
  checkEmailRegistrationConflict,
  evaluateEmployeeLoginEligibility,
  evaluatePosClientLoginEligibility,
  isMasterAdminEmail,
  isPosClientActive,
  resolveAccountIdentityByEmail,
  resolveAuthoritativeIdentityFromFirestore,
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

test('evaluateEmployeeLoginEligibility blocks suspended stores and suspended employees while allowing active accounts', () => {
  const activeSup = makeSupplier({ id: 'sup-2', isActive: true });
  const suspendedSup = makeSupplier({ id: 'sup-2', isActive: false });
  const activeEmp = makeEmployee({ id: 'emp-1', isActive: true });
  const suspendedEmp = makeEmployee({
    id: 'emp-2',
    isActive: false,
    permissions: { canAddServices: true, canEditServicePrices: true, canViewReports: true },
  });

  assert.equal(evaluateEmployeeLoginEligibility(activeSup, activeEmp).allowed, true);
  assert.equal(evaluateEmployeeLoginEligibility(suspendedSup, activeEmp).allowed, false);

  const empBlocked = evaluateEmployeeLoginEligibility(activeSup, suspendedEmp);
  assert.equal(empBlocked.allowed, false);
  assert.equal(empBlocked.title, 'حساب الموظف موقوف');

  // Suspended employee identity builds with all permissions stripped
  const builtSuspended = buildAuthUserFromIdentity({
    kind: 'employee',
    email: suspendedEmp.email,
    supplier: activeSup,
    employee: suspendedEmp,
  });
  assert.equal(builtSuspended.authUser.permissions?.canAddServices, false);
  assert.equal(builtSuspended.authUser.permissions?.canEditServicePrices, false);
  assert.equal(builtSuspended.authUser.permissions?.canViewReports, false);
});

test('resolveAuthoritativeIdentityFromFirestore resolves authoritative roles and rejects email-mismatched userDoc hijacking', () => {
  const sup1 = makeSupplier({ id: 'sup-1', email: 'merchant1@store.sa' });
  const sup2 = makeSupplier({
    id: 'sup-2',
    email: 'merchant2@store.sa',
    employees: [makeEmployee({ id: 'emp-9', supplierId: 'sup-2', email: 'worker@store2.sa' })],
  });
  const posOlder = makePosClient({
    id: 'pos-old',
    email: 'multi@pos.sa',
    supplierId: 'sup-1',
    createdAt: '2026-01-01',
  });
  const posNewer = makePosClient({
    id: 'pos-new',
    email: 'multi@pos.sa',
    supplierId: 'sup-2',
    createdAt: '2026-02-01',
  });

  // 1. Multi-store POS client sorts deterministically and honors matching userDoc.associatedId
  const multiIdentity = resolveAuthoritativeIdentityFromFirestore({
    email: 'multi@pos.sa',
    superAdmin: sampleSuperAdmin,
    suppliers: [sup1, sup2],
    posClients: [posOlder, posNewer],
    userDoc: {
      id: 'uid-multi',
      email: 'multi@pos.sa',
      name: 'عميل متعدد المتاجر',
      role: 'pos_client',
      associatedId: 'pos-old',
    },
  });
  assert.equal(multiIdentity.kind, 'pos_client');
  if (multiIdentity.kind === 'pos_client') {
    assert.equal(multiIdentity.posRecords[0].id, 'pos-old');
    assert.equal(multiIdentity.suppliers.length, 2);
  }

  // 2. Stale/mismatched userDoc cannot hijack an employee or client into super_admin or another store
  const mismatchedRole = resolveAuthoritativeIdentityFromFirestore({
    email: 'worker@store2.sa',
    superAdmin: sampleSuperAdmin,
    suppliers: [sup1, sup2],
    posClients: [posOlder],
    userDoc: {
      id: 'uid-spoof',
      email: 'worker@store2.sa',
      name: 'Spoof',
      role: 'super_admin',
      associatedId: 'sup-1',
    },
  });
  assert.equal(mismatchedRole.kind, 'employee');
  if (mismatchedRole.kind === 'employee') {
    assert.equal(mismatchedRole.supplier.id, 'sup-2');
    assert.equal(mismatchedRole.employee.id, 'emp-9');
  }

  // 3. Supplier switching guard blocks selecting a POS client belonging to another merchant's store
  const sup1User: AuthUser = {
    id: 'sup-usr-sup-1',
    email: 'merchant1@store.sa',
    name: 'تاجر 1',
    role: 'supplier',
    associatedId: 'sup-1',
  };
  assert.equal(
    canSwitchToPosClient({
      isAuthenticated: true,
      currentUser: sup1User,
      targetPosId: 'pos-old',
      posClients: [posOlder, posNewer],
    }),
    true
  );
  assert.equal(
    canSwitchToPosClient({
      isAuthenticated: true,
      currentUser: sup1User,
      targetPosId: 'pos-new',
      posClients: [posOlder, posNewer],
    }),
    false
  );
});

test('isPosClientActive and evaluatePosClientLoginEligibility block suspended clients and isolate suspended stores', () => {
  const sup1 = makeSupplier({ id: 'sup-1', email: 'm1@store.sa' });
  const sup2 = makeSupplier({ id: 'sup-2', email: 'm2@store.sa' });
  const activePos = makePosClient({ id: 'pos-active', email: 'c@pos.sa', supplierId: 'sup-1', isActive: true });
  const defaultActivePos = makePosClient({ id: 'pos-default', email: 'd@pos.sa', supplierId: 'sup-1' });
  const suspendedPos = makePosClient({ id: 'pos-susp', email: 'c@pos.sa', supplierId: 'sup-2', isActive: false });

  assert.equal(isPosClientActive(activePos), true);
  assert.equal(isPosClientActive(defaultActivePos), true);
  assert.equal(isPosClientActive(suspendedPos), false);

  // Single suspended client is blocked
  const blocked = evaluatePosClientLoginEligibility([suspendedPos]);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.activeRecords.length, 0);
  assert.equal(blocked.title, 'حساب العميل موقوف');

  // Multi-store client with one active and one suspended store is allowed and routes only to active store
  const partial = evaluatePosClientLoginEligibility([suspendedPos, activePos]);
  assert.equal(partial.allowed, true);
  assert.deepEqual(partial.activeRecords.map((p) => p.id), ['pos-active']);

  const built = buildAuthUserFromIdentity(
    {
      kind: 'pos_client',
      email: 'c@pos.sa',
      posRecords: [suspendedPos, activePos],
      suppliers: [sup2, sup1],
    },
    { preferredPosId: 'pos-susp' }
  );
  assert.equal(built.posId, 'pos-active');
  assert.equal(built.supplierId, 'sup-1');
  assert.equal(built.requiresSupplierSelection, false);

  const clientUser: AuthUser = {
    id: 'u-c',
    email: 'c@pos.sa',
    name: 'عميل',
    role: 'pos_client',
    associatedId: 'pos-active',
  };
  assert.equal(
    canSwitchToPosClient({
      isAuthenticated: true,
      currentUser: clientUser,
      targetPosId: 'pos-susp',
      posClients: [suspendedPos, activePos],
    }),
    false
  );
  assert.equal(
    canSwitchToSupplier({
      isAuthenticated: true,
      currentUser: clientUser,
      targetSupplierId: 'sup-2',
      posClients: [suspendedPos, activePos],
    }),
    false
  );
  assert.equal(
    resolveScopedCurrentPos({
      isAuthenticated: true,
      role: 'pos_client',
      currentUser: clientUser,
      currentPosId: 'pos-susp',
      posClients: [suspendedPos, activePos],
    }).id,
    'pos-active'
  );
});



