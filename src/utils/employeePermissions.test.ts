import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countActiveEmployeePermissions,
  filterSupplierNotificationsForEmployee,
  getFirstAllowedSupplierTab,
  isDepositVisibleToEmployee,
  isEmployeeTabAllowed,
  isOrderVisibleToEmployee,
  resolveEffectiveEmployeePermissions,
  resolveStoreActorByEmail,
  validateOfficeEmployeeInput,
  verifyEmployeeCredentials,
} from './employeePermissions';
import { AppNotification, AuthUser, OfficeEmployee, Supplier } from '../types';

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
