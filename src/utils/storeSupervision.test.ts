import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeStoreSupervisionMetrics,
  filterStoreClientsForAdmin,
  filterStoreOrdersForAdmin,
  filterSuppliersForAdmin,
  getClientLoanSummaryForStore,
  isEmailUsedByOtherAccount,
  isSupplierActive,
} from './storeSupervision';
import {
  AccountingEntry,
  AdminAccountingEntry,
  Catalog,
  DepositRequest,
  DigitalService,
  Order,
  POSClient,
  Supplier,
  VoucherWarehouse,
} from '../types';

const supA: Supplier = {
  id: 'sup-a',
  name: 'خالد التاجر',
  storeName: 'متجر النخبة',
  phone: '+966501111111',
  email: 'owner.a@store.sa',
  feePercentage: 1.5,
  fixedFeeAmount: 0,
  feeType: 'percentage',
  walletBalance: 4200,
  country: 'السعودية',
  city: 'الرياض',
  bankAccountDetails: {
    bankName: 'الراجحي',
    accountHolder: 'خالد التاجر',
    iban: 'SA1000',
    accountNumber: '1000',
  },
  createdAt: '2026-01-10',
  employees: [
    {
      id: 'emp-1',
      supplierId: 'sup-a',
      name: 'موظف الشحن',
      email: 'staff.a@store.sa',
      phone: '0552222222',
      roleTitle: 'مسؤول شحن',
      permissions: { canManagePlayerIdOrders: true },
      createdAt: '2026-01-12',
    },
  ],
};

const supB: Supplier = {
  ...supA,
  id: 'sup-b',
  name: 'سعيد الموقوف',
  storeName: 'متجر الأمل',
  email: 'owner.b@store.sa',
  isActive: false,
  employees: [],
};

const clientA1: POSClient = {
  id: 'pos-a1',
  posCode: 'RYD-10001',
  tradeName: 'محل الفجر',
  ownerName: 'أحمد علي',
  phone: '0550000001',
  email: 'pos.a1@client.sa',
  country: 'السعودية',
  city: 'الرياض',
  supplierId: 'sup-a',
  tier: 'gold',
  walletBalance: 750,
  totalSpent: 1500,
  ordersCount: 3,
  createdAt: '2026-01-15',
  qrCodeValue: 'DIGIPOS:RYD-10001',
  canRequestLoans: true,
};

const clientB1: POSClient = {
  ...clientA1,
  id: 'pos-b1',
  posCode: 'JED-20001',
  tradeName: 'نقطة جدة',
  ownerName: 'يوسف',
  email: 'pos.b1@client.sa',
  supplierId: 'sup-b',
  tier: 'regular',
  walletBalance: 9000,
};

test('isSupplierActive defaults undefined to true and detects explicit false suspension', () => {
  assert.equal(isSupplierActive(supA), true);
  assert.equal(isSupplierActive(supB), false);
  assert.equal(isSupplierActive(null), false);
});

test('computeStoreSupervisionMetrics isolates clients, orders, loans, deposits, fees, and stock per store', () => {
  const orders: Order[] = [
    {
      id: 'ord-a1',
      date: '2026-03-01 10:00',
      posId: 'pos-a1',
      posCode: 'RYD-10001',
      posName: 'محل الفجر',
      supplierId: 'sup-a',
      serviceId: 'srv-a1',
      serviceName: 'ببجي',
      packageId: 'pkg-1',
      packageName: '60 شدة',
      deliveryMethod: 'player_id',
      deliveryDetails: { playerId: '5123456' },
      costPrice: 100,
      feeAmount: 5,
      totalDeducted: 105,
      paymentMethod: 'wallet',
      status: 'completed',
    },
    {
      id: 'ord-a2',
      date: '2026-03-02 12:00',
      posId: 'pos-a1',
      posCode: 'RYD-10001',
      posName: 'محل الفجر',
      supplierId: 'sup-a',
      serviceId: 'srv-a1',
      serviceName: 'هدية مجانية',
      packageId: 'pkg-2',
      packageName: 'حزمة هدية',
      deliveryMethod: 'voucher_code',
      deliveryDetails: {},
      costPrice: 0,
      feeAmount: 0,
      totalDeducted: 0,
      isFreeGiftOrder: true,
      paymentMethod: 'wallet',
      status: 'completed',
    },
    {
      id: 'ord-b1',
      date: '2026-03-02 14:00',
      posId: 'pos-b1',
      posCode: 'JED-20001',
      posName: 'نقطة جدة',
      supplierId: 'sup-b',
      serviceId: 'srv-b1',
      serviceName: 'خدمة متجر آخر',
      packageId: 'pkg-b',
      packageName: 'باقة',
      deliveryMethod: 'player_id',
      deliveryDetails: {},
      costPrice: 999,
      feeAmount: 99,
      totalDeducted: 1098,
      paymentMethod: 'wallet',
      status: 'completed',
    },
  ];

  const depositRequests: DepositRequest[] = [
    {
      id: 'dep-a1',
      posId: 'pos-a1',
      posName: 'محل الفجر',
      posCode: 'RYD-10001',
      supplierId: 'sup-a',
      amount: 500,
      transferNumber: 'TR-1',
      transferSenderName: 'أحمد',
      bankName: 'الراجحي',
      date: '2026-03-01',
      status: 'approved',
      requestType: 'cash',
    },
    {
      id: 'loan-a1',
      posId: 'pos-a1',
      posName: 'محل الفجر',
      posCode: 'RYD-10001',
      supplierId: 'sup-a',
      amount: 300,
      paidAmount: 100,
      transferNumber: 'LOAN-1',
      transferSenderName: 'أحمد',
      bankName: 'سلفة',
      date: '2026-03-02',
      status: 'approved',
      requestType: 'loan',
      loanReason: 'تغطية طلبات',
    },
  ];

  const adminEntries: AdminAccountingEntry[] = [
    {
      id: 'adm-e1',
      date: '2026-03-01',
      type: 'fee_collected',
      referenceId: 'ord-a1',
      supplierId: 'sup-a',
      description: 'رسوم',
      feeAmount: 5,
      debit: 0,
      credit: 5,
      balanceAfter: 5,
    },
  ];

  const accountingEntries: AccountingEntry[] = [
    {
      id: 'acc-a1',
      date: '2026-03-01',
      type: 'purchase',
      referenceId: 'ord-a1',
      posId: 'pos-a1',
      supplierId: 'sup-a',
      description: 'شراء',
      debit: 105,
      credit: 0,
      balanceAfter: 750,
    },
  ];

  const services: DigitalService[] = [
    {
      id: 'srv-a1',
      catalogId: 'cat-1',
      supplierId: 'sup-a',
      nameAr: 'ببجي',
      descriptionAr: 'شدات',
      icon: 'gamepad',
      deliveryMethods: ['player_id'],
      packages: [],
      isActive: true,
    },
  ];

  const warehouses: VoucherWarehouse[] = [
    {
      id: 'wh-1',
      supplierId: 'sup-a',
      nameAr: 'مخزن ستيم',
      categoryName: 'ألعاب',
      codes: ['CODE-1', 'CODE-2'],
      usedCodesCount: 4,
      isPublishedAsService: true,
      tierPrices: { regular: 10, bronze: 9, silver: 8, gold: 7, vip: 6 },
      createdAt: '2026-02-01',
    },
  ];

  const catalogs: Catalog[] = [
    { id: 'cat-1', supplierId: 'all', nameAr: 'ألعاب', descriptionAr: '', icon: 'gamepad', isFixedByAdmin: true },
  ];

  const metrics = computeStoreSupervisionMetrics({
    supplier: supA,
    posClients: [clientA1, clientB1],
    orders,
    depositRequests,
    loanRepaymentRequests: [],
    accountingEntries,
    adminAccountingEntries: adminEntries,
    services,
    voucherWarehouses: warehouses,
    catalogs,
  });

  assert.equal(metrics.clientsCount, 1);
  assert.equal(metrics.totalClientWalletsBalance, 750);
  assert.equal(metrics.employeesCount, 1);
  assert.equal(metrics.ordersCount, 2);
  assert.equal(metrics.completedOrdersCount, 2);
  assert.equal(metrics.totalCompletedSalesVolume, 100);
  assert.equal(metrics.totalPlatformFeesEarned, 5);
  assert.equal(metrics.approvedCashDepositsTotal, 500);
  assert.equal(metrics.totalLoansIssuedAmount, 300);
  assert.equal(metrics.totalLoansRepaidAmount, 100);
  assert.equal(metrics.totalLoansRemainingAmount, 200);
  assert.equal(metrics.availableVoucherCodesCount, 2);
  assert.equal(metrics.usedVoucherCodesCount, 4);
  assert.equal(metrics.storeAccountingEntries.length, 1);

  const loanSum = getClientLoanSummaryForStore(depositRequests, 'pos-a1', 'sup-a');
  assert.equal(loanSum.activeLoansCount, 1);
  assert.equal(loanSum.remainingDebt, 200);
});

test('filter helpers and email uniqueness checks work accurately for store supervision', () => {
  assert.equal(filterSuppliersForAdmin([supA, supB], '', 'active').length, 1);
  assert.equal(filterSuppliersForAdmin([supA, supB], '', 'suspended')[0].id, 'sup-b');
  assert.equal(filterSuppliersForAdmin([supA, supB], 'النخبة', 'all')[0].id, 'sup-a');

  assert.equal(filterStoreClientsForAdmin([clientA1, clientB1], 'RYD-10001', 'gold').length, 1);
  assert.equal(filterStoreClientsForAdmin([clientA1, clientB1], 'RYD-10001', 'regular').length, 0);

  const sampleOrders: Order[] = [
    {
      id: 'ord-1',
      date: '2026-04-01 09:00',
      posId: 'pos-a1',
      posCode: 'RYD-10001',
      posName: 'محل الفجر',
      supplierId: 'sup-a',
      serviceId: 's1',
      serviceName: 'شحن ببجي',
      packageId: 'p1',
      packageName: '60',
      deliveryMethod: 'player_id',
      deliveryDetails: { playerId: '998877' },
      costPrice: 10,
      feeAmount: 1,
      totalDeducted: 11,
      paymentMethod: 'wallet',
      status: 'pending_supplier',
    },
  ];
  assert.equal(
    filterStoreOrdersForAdmin(sampleOrders, {
      clientId: 'pos-a1',
      status: 'pending_supplier',
      deliveryMethod: 'player_id',
      query: '998877',
    }).length,
    1
  );

  // Email belonging to current supplier itself is allowed, while employee/client/other supplier emails conflict
  assert.equal(
    isEmailUsedByOtherAccount('owner.a@store.sa', {
      currentSupplierId: 'sup-a',
      suppliers: [supA, supB],
      posClients: [clientA1],
      superAdminEmail: 'admin@digipos-platform.com',
    }),
    false
  );
  assert.equal(
    isEmailUsedByOtherAccount('staff.a@store.sa', {
      currentSupplierId: 'sup-a',
      suppliers: [supA, supB],
      posClients: [clientA1],
    }),
    true
  );
  assert.equal(
    isEmailUsedByOtherAccount('pos.a1@client.sa', {
      currentSupplierId: 'sup-a',
      suppliers: [supA, supB],
      posClients: [clientA1],
    }),
    true
  );
});
