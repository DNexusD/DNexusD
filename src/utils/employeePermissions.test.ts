import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEmployeePermissionRecord,
  buildSeparatedEmployeeDoc,
  countActiveEmployeePermissions,
  extractUnmigratedEmployeesFromSuppliers,
  filterSupplierNotificationsForEmployee,
  getFirstAllowedSupplierTab,
  getSupplierIdsWithLegacyEmployeesField,
  hydrateEmployeeWithPermissionRecord,
  hydrateSuppliersWithEmployeesAndPermissions,
  isDepositVisibleToEmployee,
  isEmployeeActive,
  isEmployeeTabAllowed,
  isOrderVisibleToEmployee,
  resolveEffectiveEmployeePermissions,
  resolveStoreActorByEmail,
  sanitizeServiceUpdatesForEmployeePermissions,
  stripEmployeesFromSupplierForStorage,
  validateOfficeEmployeeInput,
  verifyEmployeeCredentials,
} from './employeePermissions';
import { filterNotificationsForPosClient } from './accountAuth';
import { AppNotification, AuthUser, DigitalService, OfficeEmployee, Supplier } from '../types';

function makeSupplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: 'sup-1',
    name: 'متجر النخبة',
    storeName: 'النخبة للخدمات',
    phone: '0500000001',
    email: 'owner@store.sa',
    feePercentage: 1,
    fixedFeeAmount: 0,
    feeType: 'percentage',
    walletBalance: 1500,
    bankAccountDetails: {
      bankName: 'الراجحي',
      accountHolder: 'مالك المتجر',
      iban: 'SA0000',
      accountNumber: '1234',
    },
    createdAt: '2026-01-01',
    employees: [],
    ...overrides,
  };
}

function makeEmployee(overrides: Partial<OfficeEmployee> = {}): OfficeEmployee {
  return {
    id: 'emp-1',
    supplierId: 'sup-1',
    name: 'سالم الموظف',
    email: 'salem@store.sa',
    password: 'EmpSecret99',
    phone: '0555555555',
    roleTitle: 'مسؤول الشحن',
    permissions: {
      canManagePlayerIdOrders: true,
      canManageAccountOrders: false,
      canManageVoucherOrders: false,
    },
    createdAt: '2026-01-02',
    ...overrides,
  };
}

test('resolveStoreActorByEmail always prioritizes store owner over employee if same email', () => {
  const sup = makeSupplier({
    email: 'owner@store.sa',
    employees: [makeEmployee({ email: 'OWNER@store.sa' })],
  });

  const actor = resolveStoreActorByEmail('  Owner@Store.SA ', [sup]);
  assert.ok(actor);
  assert.equal(actor.kind, 'owner');
  assert.equal(actor.supplier.id, 'sup-1');
});

test('resolveStoreActorByEmail matches employee with its exact supplier', () => {
  const sup1 = makeSupplier({ id: 'sup-1', email: 'owner1@store.sa' });
  const sup2 = makeSupplier({
    id: 'sup-2',
    email: 'owner2@store.sa',
    employees: [makeEmployee({ id: 'emp-22', supplierId: 'sup-2', email: 'staff@store2.sa' })],
  });

  const actor = resolveStoreActorByEmail('STAFF@store2.sa', [sup1, sup2]);
  assert.ok(actor);
  assert.equal(actor.kind, 'employee');
  if (actor.kind === 'employee') {
    assert.equal(actor.supplier.id, 'sup-2');
    assert.equal(actor.employee.id, 'emp-22');
  }
});

test('verifyEmployeeCredentials enforces exact trimmed password configured by supplier', () => {
  const emp = makeEmployee({ password: 'Secret123' });
  assert.equal(verifyEmployeeCredentials(emp, 'Secret123'), true);
  assert.equal(verifyEmployeeCredentials(emp, ' Secret123 '), true);
  assert.equal(verifyEmployeeCredentials(emp, 'wrong'), false);
  assert.equal(verifyEmployeeCredentials(emp, ''), false);

  const empNoPwd = makeEmployee({ password: '' });
  assert.equal(verifyEmployeeCredentials(empNoPwd, ''), false);
});

test('resolveEffectiveEmployeePermissions grants full access to store owner and strictly scoped access to employee', () => {
  const emp = makeEmployee({
    permissions: {
      canManagePlayerIdOrders: true,
      canManageAccountOrders: false,
      canReviewCashDeposits: true,
      canManageBankAccounts: false,
    },
  });
  const sup = makeSupplier({ employees: [emp] });

  const ownerUser: AuthUser = {
    id: 'usr-owner',
    email: 'owner@store.sa',
    name: 'مالك المتجر',
    role: 'supplier',
    associatedId: 'sup-1',
  };
  const ownerPerms = resolveEffectiveEmployeePermissions(ownerUser, 'supplier', sup);
  assert.equal(ownerPerms.canManageEmployees, true);
  assert.equal(ownerPerms.canManageBankAccounts, true);
  assert.equal(ownerPerms.canEditServicePrices, true);

  const empUser: AuthUser = {
    id: 'emp-1',
    email: 'salem@store.sa',
    name: 'سالم',
    role: 'employee',
    supplierId: 'sup-1',
    employeeId: 'emp-1',
  };
  const empPerms = resolveEffectiveEmployeePermissions(empUser, 'employee', sup);
  assert.equal(empPerms.canManagePlayerIdOrders, true);
  assert.equal(empPerms.canManageAccountOrders, false);
  assert.equal(empPerms.canReviewCashDeposits, true);
  assert.equal(empPerms.canReviewLoanDeposits, false);
  assert.equal(empPerms.canManageBankAccounts, false);
  assert.equal(empPerms.canManageEmployees, false);
  assert.equal(empPerms.canAddServices, false);
  assert.equal(empPerms.canViewClients, false);
  assert.equal(countActiveEmployeePermissions(empPerms), 2);
});

test('empty permissions employee never receives fallback powers', () => {
  const empUser: AuthUser = {
    id: 'emp-empty',
    email: 'empty@store.sa',
    name: 'بدون صلاحيات',
    role: 'employee',
  };
  const perms = resolveEffectiveEmployeePermissions(empUser, 'employee');
  assert.equal(perms.canManageOrders, false);
  assert.equal(perms.canManageClients, false);
  assert.equal(isEmployeeTabAllowed('catalogs', perms, 'employee'), false);
  assert.equal(isEmployeeTabAllowed('pending_orders', perms, 'employee'), false);
  assert.equal(isEmployeeTabAllowed('clients', perms, 'employee'), false);
  assert.equal(getFirstAllowedSupplierTab(perms, 'employee'), 'notifications');
});

test('tab gating separates granular permissions cleanly without leakage', () => {
  const cashOnlyPerms = resolveEffectiveEmployeePermissions(
    {
      id: 'emp-cash',
      email: 'cash@store.sa',
      name: 'مراجع حوالات',
      role: 'employee',
      permissions: { canReviewCashDeposits: true },
    },
    'employee'
  );

  assert.equal(isEmployeeTabAllowed('deposits', cashOnlyPerms, 'employee'), true);
  assert.equal(isEmployeeTabAllowed('loans', cashOnlyPerms, 'employee'), false);
  assert.equal(isEmployeeTabAllowed('bank_accounts', cashOnlyPerms, 'employee'), false);
  assert.equal(isEmployeeTabAllowed('catalogs', cashOnlyPerms, 'employee'), false);
  assert.equal(isEmployeeTabAllowed('employees', cashOnlyPerms, 'employee'), false);
  assert.equal(getFirstAllowedSupplierTab(cashOnlyPerms, 'employee'), 'deposits');

  const stockOnlyPerms = resolveEffectiveEmployeePermissions(
    {
      id: 'emp-stock',
      email: 'stock@store.sa',
      name: 'أمين مخزن',
      role: 'employee',
      permissions: { canManageVoucherStock: true },
    },
    'employee'
  );
  assert.equal(isEmployeeTabAllowed('vouchers', stockOnlyPerms, 'employee'), true);
  assert.equal(isEmployeeTabAllowed('catalogs', stockOnlyPerms, 'employee'), false);
  assert.equal(getFirstAllowedSupplierTab(stockOnlyPerms, 'employee'), 'vouchers');
});

test('order, deposit, and notification filters enforce employee scope', () => {
  const perms = resolveEffectiveEmployeePermissions(
    {
      id: 'emp-id',
      email: 'id@store.sa',
      name: 'شحن أيدي',
      role: 'employee',
      permissions: {
        canManagePlayerIdOrders: true,
        canReviewCashDeposits: true,
      },
    },
    'employee'
  );

  assert.equal(isOrderVisibleToEmployee({ deliveryMethod: 'player_id' }, perms, 'employee'), true);
  assert.equal(isOrderVisibleToEmployee({ deliveryMethod: 'account_login' }, perms, 'employee'), false);
  assert.equal(isOrderVisibleToEmployee({ deliveryMethod: 'voucher_code' }, perms, 'employee'), false);

  assert.equal(isDepositVisibleToEmployee({ requestType: 'cash' }, perms, 'employee'), true);
  assert.equal(isDepositVisibleToEmployee({ requestType: 'loan', loanReason: 'سلفة' }, perms, 'employee'), false);

  const notifs: AppNotification[] = [
    { id: '1', title: 'طلب أيدي', message: '', type: 'order_status', actionTab: 'pending_orders', isRead: false, createdAt: '' },
    { id: '2', title: 'طلب حساب', message: '', type: 'order_status', actionTab: 'account_orders', isRead: false, createdAt: '' },
    { id: '3', title: 'سلفة', message: '', type: 'loan', actionTab: 'loans', isRead: false, createdAt: '' },
    { id: '4', title: 'إيداع', message: '', type: 'deposit', actionTab: 'deposits', isRead: false, createdAt: '' },
  ];
  const visible = filterSupplierNotificationsForEmployee(notifs, perms, 'employee');
  assert.deepEqual(visible.map(n => n.id), ['1', '4']);
});

test('validateOfficeEmployeeInput blocks owner email collision, duplicates, missing password, and empty permissions', () => {
  const existing = [makeEmployee({ id: 'emp-1', email: 'salem@store.sa' })];

  const ownerRes = validateOfficeEmployeeInput(
    { name: 'موظف', email: 'owner@store.sa', password: '1234', permissions: { canViewClients: true } },
    existing,
    'owner@store.sa'
  );
  assert.equal(ownerRes.valid, false);

  const dupRes = validateOfficeEmployeeInput(
    { name: 'موظف 2', email: 'SALEM@store.sa', password: '1234', permissions: { canViewClients: true } },
    existing,
    'owner@store.sa'
  );
  assert.equal(dupRes.valid, false);

  const shortPwd = validateOfficeEmployeeInput(
    { name: 'موظف 3', email: 'new@store.sa', password: '12', permissions: { canViewClients: true } },
    existing,
    'owner@store.sa'
  );
  assert.equal(shortPwd.valid, false);

  const noPerm = validateOfficeEmployeeInput(
    { name: 'موظف 4', email: 'new@store.sa', password: '12345', permissions: {} },
    existing,
    'owner@store.sa'
  );
  assert.equal(noPerm.valid, false);

  const ok = validateOfficeEmployeeInput(
    { name: 'موظف 5', email: 'new@store.sa', password: '12345', permissions: { canAddServices: true } },
    existing,
    'owner@store.sa'
  );
  assert.equal(ok.valid, true);
});

test('suspended employee collapses to empty permissions in resolveEffectiveEmployeePermissions', () => {
  const suspendedEmp = makeEmployee({
    id: 'emp-susp',
    email: 'susp@store.sa',
    isActive: false,
    permissions: {
      canManagePlayerIdOrders: true,
      canAddServices: true,
      canEditServicePrices: true,
      canViewReports: true,
    },
  });
  const sup = makeSupplier({ employees: [suspendedEmp] });
  const empUser: AuthUser = {
    id: 'emp-susp',
    email: 'susp@store.sa',
    name: 'موقوف',
    role: 'employee',
    supplierId: 'sup-1',
    employeeId: 'emp-susp',
    permissions: suspendedEmp.permissions,
  };

  assert.equal(isEmployeeActive(suspendedEmp), false);
  assert.equal(isEmployeeActive(makeEmployee()), true);

  const effective = resolveEffectiveEmployeePermissions(empUser, 'employee', sup);
  assert.equal(countActiveEmployeePermissions(effective), 0);
  assert.equal(effective.canAddServices, false);
  assert.equal(effective.canEditServicePrices, false);
  assert.equal(effective.canViewReports, false);
});

test('sanitizeServiceUpdatesForEmployeePermissions enforces field-level restrictions for price-only and detail-only employees', () => {
  const existingService: DigitalService = {
    id: 'srv-1',
    supplierId: 'sup-1',
    catalogId: 'cat-1',
    nameAr: 'ببجي موبايل',
    descriptionAr: 'شحن شدات',
    icon: '🎮',
    deliveryMethods: ['player_id'],
    isActive: true,
    packages: [
      {
        id: 'pkg-1',
        name: '60 شدة',
        deliveryMethod: 'player_id',
        tierPrices: { regular: 1, bronze: 0.95, silver: 0.9, gold: 0.85, vip: 0.8 },
      },
    ],
  };

  const priceOnlyPerms = resolveEffectiveEmployeePermissions(
    {
      id: 'emp-p',
      email: 'p@store.sa',
      name: 'مسعر',
      role: 'employee',
      permissions: { canEditServicePrices: true, canAddServices: false },
    },
    'employee'
  );

  const sanitizedPriceOnly = sanitizeServiceUpdatesForEmployeePermissions(
    existingService,
    {
      nameAr: 'اسم مخترق',
      catalogId: 'cat-hacked',
      isActive: false,
      packages: [
        {
          id: 'pkg-1',
          name: 'باقة معدلة',
          deliveryMethod: 'voucher_code',
          tierPrices: { regular: 1.5, bronze: 1.4, silver: 1.3, gold: 1.2, vip: 1.1 },
        },
        {
          id: 'pkg-injected',
          name: 'باقة جديدة',
          tierPrices: { regular: 5, bronze: 5, silver: 5, gold: 5, vip: 5 },
        },
      ],
    },
    priceOnlyPerms,
    'employee'
  );

  assert.equal(sanitizedPriceOnly.nameAr, undefined);
  assert.equal(sanitizedPriceOnly.catalogId, undefined);
  assert.equal(sanitizedPriceOnly.isActive, undefined);
  assert.equal(sanitizedPriceOnly.packages?.length, 1);
  assert.equal(sanitizedPriceOnly.packages?.[0].name, '60 شدة');
  assert.equal(sanitizedPriceOnly.packages?.[0].deliveryMethod, 'player_id');
  assert.equal(sanitizedPriceOnly.packages?.[0].tierPrices.regular, 1.5);

  const detailOnlyPerms = resolveEffectiveEmployeePermissions(
    {
      id: 'emp-d',
      email: 'd@store.sa',
      name: 'منسق',
      role: 'employee',
      permissions: { canAddServices: true, canEditServicePrices: false },
    },
    'employee'
  );

  const sanitizedDetailOnly = sanitizeServiceUpdatesForEmployeePermissions(
    existingService,
    {
      nameAr: 'ببجي العالمية',
      packages: [
        {
          id: 'pkg-1',
          name: '60 UC',
          tierPrices: { regular: 99, bronze: 99, silver: 99, gold: 99, vip: 99 },
        },
      ],
    },
    detailOnlyPerms,
    'employee'
  );

  assert.equal(sanitizedDetailOnly.nameAr, 'ببجي العالمية');
  assert.equal(sanitizedDetailOnly.packages?.[0].name, '60 UC');
  assert.equal(sanitizedDetailOnly.packages?.[0].tierPrices.regular, 1);
});

test('separated employee and permission records strip store arrays and hydrate cleanly by store and employeeId', () => {
  const emp = makeEmployee({
    id: 'emp-sep-1',
    supplierId: 'sup-1',
    email: 'Staff.One@Store.sa',
    permissions: {
      canManagePlayerIdOrders: true,
      canReviewCashDeposits: true,
    },
  });

  const separatedEmp = buildSeparatedEmployeeDoc(emp, '2026-06-01T00:00:00.000Z');
  assert.equal('permissions' in separatedEmp, false);
  assert.equal(separatedEmp.supplierId, 'sup-1');
  assert.equal(separatedEmp.permissionId, 'emp-sep-1');
  assert.equal(separatedEmp.email, 'staff.one@store.sa');

  const permRec = buildEmployeePermissionRecord(emp, '2026-06-01T00:00:00.000Z');
  assert.equal(permRec.id, 'emp-sep-1');
  assert.equal(permRec.employeeId, 'emp-sep-1');
  assert.equal(permRec.supplierId, 'sup-1');
  assert.equal(permRec.permissions.canManagePlayerIdOrders, true);
  assert.equal(permRec.permissions.canReviewCashDeposits, true);
  assert.equal(permRec.permissions.canManageEmployees, false);

  const hydratedEmp = hydrateEmployeeWithPermissionRecord(separatedEmp, [permRec]);
  assert.equal(hydratedEmp.permissions.canManagePlayerIdOrders, true);
  assert.equal(hydratedEmp.permissions.canReviewCashDeposits, true);
  assert.equal(hydratedEmp.permissions.canManageAccountOrders, false);

  const rawSupWithLegacy = makeSupplier({
    id: 'sup-1',
    employees: [makeEmployee({ id: 'emp-legacy', supplierId: 'sup-1', email: 'legacy@store.sa' })],
  });
  const compactSup = stripEmployeesFromSupplierForStorage(rawSupWithLegacy);
  assert.equal('employees' in compactSup, false);

  const sup2 = makeSupplier({ id: 'sup-2', email: 'other@store.sa', employees: [] });
  const joined = hydrateSuppliersWithEmployeesAndPermissions([compactSup as Supplier, sup2], [separatedEmp], [permRec]);
  assert.equal(joined[0].employees?.length, 1);
  assert.equal(joined[0].employees?.[0].id, 'emp-sep-1');
  assert.equal(joined[0].employees?.[0].permissions.canManagePlayerIdOrders, true);
  assert.equal(joined[1].employees?.length, 0);

  const unmigrated = extractUnmigratedEmployeesFromSuppliers([rawSupWithLegacy], [hydratedEmp]);
  assert.equal(unmigrated.length, 1);
  assert.equal(unmigrated[0].id, 'emp-legacy');
  assert.equal(unmigrated[0].supplierId, 'sup-1');
});

test('filterNotificationsForPosClient strictly scopes notifications to the active POS client and store', () => {
  const notifs: AppNotification[] = [
    { id: 'n1', posId: 'pos-1', supplierId: 'sup-1', targetRole: 'pos', title: 'direct', message: '', type: 'order_status', isRead: false, createdAt: '' },
    { id: 'n2', posId: 'pos-2', supplierId: 'sup-1', targetRole: 'pos', title: 'other client', message: '', type: 'order_status', isRead: false, createdAt: '' },
    { id: 'n3', supplierId: 'sup-1', targetRole: 'pos', title: 'store broadcast', message: '', type: 'order_status', isRead: false, createdAt: '' },
    { id: 'n4', supplierId: 'sup-2', targetRole: 'pos', title: 'other store', message: '', type: 'order_status', isRead: false, createdAt: '' },
    { id: 'n5', posId: 'pos-1', supplierId: 'sup-1', targetRole: 'supplier', title: 'supplier alert', message: '', type: 'deposit', isRead: false, createdAt: '' },
  ];

  const scoped = filterNotificationsForPosClient(notifs, 'pos-1', 'sup-1');
  assert.deepEqual(scoped.map(n => n.id), ['n1', 'n3']);
});

test('getSupplierIdsWithLegacyEmployeesField detects legacy embedded arrays and extractUnmigratedEmployeesFromSuppliers catches missing permissions', () => {
  const legacySup = makeSupplier({
    id: 'sup-legacy',
    employees: [makeEmployee({ id: 'emp-1', supplierId: 'sup-legacy', email: 'e1@store.sa' })],
  });
  const emptyArraySup = makeSupplier({ id: 'sup-empty-arr', employees: [] });
  const normalizedSup = stripEmployeesFromSupplierForStorage(makeSupplier({ id: 'sup-clean' })) as Supplier;

  assert.deepEqual(
    getSupplierIdsWithLegacyEmployeesField([legacySup, emptyArraySup, normalizedSup]),
    ['sup-legacy', 'sup-empty-arr']
  );

  // When employee exists in `employees` collection, missing permission record still flags it when `existingPermissions` is passed
  const alreadyInEmp = makeEmployee({ id: 'emp-1', supplierId: 'sup-legacy', email: 'e1@store.sa' });
  assert.equal(
    extractUnmigratedEmployeesFromSuppliers([legacySup], [alreadyInEmp], []).length,
    1
  );
  assert.equal(
    extractUnmigratedEmployeesFromSuppliers(
      [legacySup],
      [alreadyInEmp],
      [buildEmployeePermissionRecord(alreadyInEmp)]
    ).length,
    0
  );
});

