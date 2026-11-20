import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseVoucherCodesInput,
  mergeCodesIntoWarehouse,
  getPackageAvailableStock,
  isPackageOutOfStock,
  deductPackageStock,
  syncWarehouseIntoService,
  resolvePackagePurchaseOptions,
  mergeWarehouseOptionsIntoPackage,
  serviceRequiresVoucherWarehouse,
  sanitizePackagesForDeliveryMethods,
  getPackagesForDeliveryMethod,
  splitPackagesByDeliveryMethod,
  getServiceTotalStock,
} from './voucherWarehouses.ts';
import type { DigitalService, ServicePackage, VoucherWarehouse } from '../types/index.ts';

function makeWarehouse(overrides: Partial<VoucherWarehouse> = {}): VoucherWarehouse {
  return {
    id: 'wh-psn-20',
    supplierId: 'sup-1',
    nameAr: 'بطاقة 20$ سعودي',
    categoryName: 'بطاقات بلايستيشن',
    catalogId: 'cat-cards',
    codes: ['CODE-1', 'CODE-2', 'CODE-3'],
    usedCodesCount: 0,
    linkedServiceId: 'srv-psn',
    linkedPackageId: 'pkg-psn-20',
    isPublishedAsService: true,
    tierPrices: {
      regular: 80,
      bronze: 76,
      silver: 72,
      gold: 68,
      vip: 64,
    },
    createdAt: '2026-11-16',
    ...overrides,
  };
}

function makeService(overrides: Partial<DigitalService> = {}): DigitalService {
  return {
    id: 'srv-psn',
    catalogId: 'cat-cards',
    supplierId: 'sup-1',
    nameAr: 'بطاقات بلايستيشن ستور',
    descriptionAr: 'أكواد أصلية',
    icon: 'CreditCard',
    isActive: true,
    deliveryMethods: ['voucher_code'],
    packages: [
      {
        id: 'pkg-psn-20',
        name: 'بطاقة 20$ سعودي',
        tierPrices: { regular: 80, bronze: 76, silver: 72, gold: 68, vip: 64 },
        vouchers: ['CODE-1', 'CODE-2', 'CODE-3'],
        availableStock: 3,
        warehouseId: 'wh-psn-20',
      },
    ],
    ...overrides,
  };
}

test('parseVoucherCodesInput parses lines and commas and removes duplicates', () => {
  const res = parseVoucherCodesInput('  AAA-111 \n BBB-222, AAA-111 \n\n CCC-333 ');
  assert.deepEqual(res.codes, ['AAA-111', 'BBB-222', 'CCC-333']);
  assert.equal(res.duplicatesRemoved, 1);
});

test('mergeCodesIntoWarehouse appends only new unique codes', () => {
  const merged = mergeCodesIntoWarehouse(['CODE-1', 'CODE-2'], 'CODE-2\nCODE-3\nCODE-4');
  assert.deepEqual(merged.nextCodes, ['CODE-1', 'CODE-2', 'CODE-3', 'CODE-4']);
  assert.equal(merged.addedCount, 2);
  assert.equal(merged.skippedDuplicates, 1);
});

test('deductPackageStock pops first voucher code and updates both service and linked warehouse', () => {
  const wh = makeWarehouse();
  const srv = makeService();

  const res = deductPackageStock({
    service: srv,
    pkgId: 'pkg-psn-20',
    deliveryMethod: 'voucher_code',
    warehouses: [wh],
    nowIso: '2026-11-16T03:00:00Z',
  });

  assert.equal(res.outOfStock, false);
  assert.equal(res.assignedVoucher, 'CODE-1');
  assert.deepEqual(res.assignedVouchers, ['CODE-1']);
  assert.equal(res.deductedCount, 1);
  assert.deepEqual(res.updatedService.packages[0].vouchers, ['CODE-2', 'CODE-3']);
  assert.equal(res.updatedService.packages[0].availableStock, 2);
  assert.deepEqual(res.updatedWarehouse?.codes, ['CODE-2', 'CODE-3']);
  assert.equal(res.updatedWarehouse?.usedCodesCount, 1);
});

test('deductPackageStock blocks purchase when warehouse or voucher list is empty', () => {
  const wh = makeWarehouse({ codes: [] });
  const srv = makeService({
    packages: [
      {
        id: 'pkg-psn-20',
        name: 'بطاقة 20$ سعودي',
        tierPrices: { regular: 80, bronze: 76, silver: 72, gold: 68, vip: 64 },
        vouchers: [],
        availableStock: 0,
        warehouseId: 'wh-psn-20',
      },
    ],
  });

  const res = deductPackageStock({
    service: srv,
    pkgId: 'pkg-psn-20',
    deliveryMethod: 'voucher_code',
    warehouses: [wh],
  });

  assert.equal(res.outOfStock, true);
  assert.equal(isPackageOutOfStock(srv.packages[0], 'voucher_code', [wh]), true);
  assert.equal(getPackageAvailableStock(srv.packages[0], [wh]), 0);
});

test('deductPackageStock does not decrement stock for player_id or account_login delivery methods', () => {
  const srv = makeService({
    deliveryMethods: ['player_id'],
    packages: [
      {
        id: 'pkg-tg-3m',
        name: 'اشتراك 3 أشهر',
        tierPrices: { regular: 75, bronze: 70, silver: 65, gold: 60, vip: 52 },
        availableStock: 10,
      },
    ],
  });

  const res = deductPackageStock({
    service: srv,
    pkgId: 'pkg-tg-3m',
    deliveryMethod: 'player_id',
  });

  assert.equal(res.outOfStock, false);
  assert.equal(res.updatedService.packages[0].availableStock, 10);
});

test('syncWarehouseIntoService updates linked package codes, stock, purchase modes, and prices', () => {
  const wh = makeWarehouse({
    codes: ['X1', 'X2', 'X3', 'X4', 'X5', 'X6'],
    tierPrices: { regular: 95, bronze: 90, silver: 85, gold: 80, vip: 75 },
    allowSingleCodePurchase: true,
    allowPackagePurchase: true,
    packageCodesCount: 3,
    packageNameAr: 'باقة التوفير 3 أكواد',
    packageTierPrices: { regular: 270, bronze: 255, silver: 240, gold: 225, vip: 210 },
  });
  const srv = makeService();
  const synced = syncWarehouseIntoService(srv, wh);

  assert.deepEqual(synced.packages[0].vouchers, ['X1', 'X2', 'X3', 'X4', 'X5', 'X6']);
  assert.equal(synced.packages[0].availableStock, 6);
  assert.equal(synced.packages[0].tierPrices.vip, 75);
  assert.equal(synced.packages[0].allowSingleCodePurchase, true);
  assert.equal(synced.packages[0].allowPackagePurchase, true);
  assert.equal(synced.packages[0].packageCodesCount, 3);
  assert.equal(synced.packages[0].packageNameAr, 'باقة التوفير 3 أكواد');
  assert.equal(synced.packages[0].packageTierPrices?.vip, 210);
});

test('deductPackageStock deducts packageCodesCount codes when purchaseUnit is package', () => {
  const wh = makeWarehouse({
    codes: ['C1', 'C2', 'C3', 'C4', 'C5'],
    usedCodesCount: 2,
    allowSingleCodePurchase: true,
    allowPackagePurchase: true,
    packageCodesCount: 3,
    packageTierPrices: { regular: 220, bronze: 210, silver: 200, gold: 190, vip: 180 },
  });
  const srv = makeService();

  const res = deductPackageStock({
    service: srv,
    pkgId: 'pkg-psn-20',
    deliveryMethod: 'voucher_code',
    warehouses: [wh],
    purchaseUnit: 'package',
    nowIso: '2026-11-16T04:00:00Z',
  });

  assert.equal(res.outOfStock, false);
  assert.equal(res.deductedCount, 3);
  assert.deepEqual(res.assignedVouchers, ['C1', 'C2', 'C3']);
  assert.equal(res.assignedVoucher, 'C1\nC2\nC3');
  assert.deepEqual(res.updatedWarehouse?.codes, ['C4', 'C5']);
  assert.equal(res.updatedWarehouse?.usedCodesCount, 5);
  assert.deepEqual(res.updatedService.packages[0].vouchers, ['C4', 'C5']);
  assert.equal(res.updatedService.packages[0].availableStock, 2);
});

test('package-only mode enforces stock >= packageCodesCount and blocks single-code purchase', () => {
  const wh = makeWarehouse({
    codes: ['C1', 'C2'],
    allowSingleCodePurchase: false,
    allowPackagePurchase: true,
    packageCodesCount: 3,
    packageTierPrices: { regular: 220, bronze: 210, silver: 200, gold: 190, vip: 180 },
  });
  const srv = makeService();
  const mergedPkg = mergeWarehouseOptionsIntoPackage(srv.packages[0], [wh]);
  const opts = resolvePackagePurchaseOptions(mergedPkg, [wh]);

  assert.equal(opts.allowSingleCode, false);
  assert.equal(opts.allowPackage, true);
  assert.equal(opts.defaultPurchaseUnit, 'package');
  assert.equal(opts.availablePackagesCount, 0);
  assert.equal(isPackageOutOfStock(mergedPkg, 'voucher_code', [wh], 'package'), true);
  assert.equal(isPackageOutOfStock(mergedPkg, 'voucher_code', [wh]), true);

  const singleAttempt = deductPackageStock({
    service: srv,
    pkgId: 'pkg-psn-20',
    deliveryMethod: 'voucher_code',
    warehouses: [wh],
    purchaseUnit: 'single_code',
  });
  assert.equal(singleAttempt.outOfStock, true);

  const pkgAttempt = deductPackageStock({
    service: srv,
    pkgId: 'pkg-psn-20',
    deliveryMethod: 'voucher_code',
    warehouses: [wh],
    purchaseUnit: 'package',
  });
  assert.equal(pkgAttempt.outOfStock, true);
});

import {
  computeStockSummary,
  isWarehouseLowStock,
  DEFAULT_LOW_STOCK_THRESHOLD,
} from './voucherWarehouses.ts';

test('isWarehouseLowStock respects custom lowStockThreshold and default threshold', () => {
  const defaultOk = makeWarehouse({ codes: ['1', '2', '3', '4', '5', '6'] });
  assert.equal(isWarehouseLowStock(defaultOk), false);

  const defaultLow = makeWarehouse({ codes: ['1', '2', '3', '4', '5'] });
  assert.equal(isWarehouseLowStock(defaultLow), true);

  const customOk = makeWarehouse({ codes: ['1', '2', '3'], lowStockThreshold: 2 });
  assert.equal(isWarehouseLowStock(customOk), false);

  const customLow = makeWarehouse({ codes: ['1', '2'], lowStockThreshold: 2 });
  assert.equal(isWarehouseLowStock(customLow), true);

  const zeroThresholdOk = makeWarehouse({ codes: ['1'], lowStockThreshold: 0 });
  assert.equal(isWarehouseLowStock(zeroThresholdOk), false);

  const zeroThresholdOut = makeWarehouse({ codes: [], lowStockThreshold: 0 });
  assert.equal(isWarehouseLowStock(zeroThresholdOut), true);
  assert.equal(DEFAULT_LOW_STOCK_THRESHOLD, 5);
});

test('computeStockSummary aggregates stocked, sold, remaining, and low stock counts by category', () => {
  const wh1 = makeWarehouse({
    id: 'wh-1',
    categoryName: 'بطاقات بلايستيشن',
    codes: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'], // 6 remaining
    usedCodesCount: 4, // 10 original stocked
    lowStockThreshold: 5, // NOT low
  });
  const wh2 = makeWarehouse({
    id: 'wh-2',
    categoryName: 'بطاقات بلايستيشن',
    codes: ['B1', 'B2'], // 2 remaining
    usedCodesCount: 8, // 10 original stocked
    lowStockThreshold: 3, // LOW
  });
  const wh3 = makeWarehouse({
    id: 'wh-3',
    categoryName: 'أكواد آيتونز',
    codes: [], // 0 remaining
    usedCodesCount: 5, // 5 original stocked
    lowStockThreshold: 2, // LOW + OUT
  });

  const summary = computeStockSummary([wh1, wh2, wh3]);
  assert.equal(summary.totalWarehouses, 3);
  assert.equal(summary.totalCategories, 2);
  assert.equal(summary.totalStocked, 25);
  assert.equal(summary.totalSold, 17);
  assert.equal(summary.totalRemaining, 8);
  assert.equal(summary.lowStockCount, 2);
  assert.equal(summary.outOfStockCount, 1);

  const psnCat = summary.categories.find((c) => c.categoryName === 'بطاقات بلايستيشن');
  assert.ok(psnCat);
  assert.equal(psnCat.warehousesCount, 2);
  assert.equal(psnCat.totalStocked, 20);
  assert.equal(psnCat.totalSold, 12);
  assert.equal(psnCat.totalRemaining, 8);
  assert.equal(psnCat.lowStockCount, 1);
  assert.equal(psnCat.outOfStockCount, 0);

  const itunesCat = summary.categories.find((c) => c.categoryName === 'أكواد آيتونز');
  assert.ok(itunesCat);
  assert.equal(itunesCat.warehousesCount, 1);
  assert.equal(itunesCat.totalStocked, 5);
  assert.equal(itunesCat.totalSold, 5);
  assert.equal(itunesCat.totalRemaining, 0);
  assert.equal(itunesCat.lowStockCount, 1);
  assert.equal(itunesCat.outOfStockCount, 1);
});

test('deductPackageStock and isPackageOutOfStock never fabricate fake voucher codes when no real codes exist', () => {
  const stockOnlyService = makeService({
    deliveryMethods: ['voucher_code'],
    packages: [
      {
        id: 'pkg-no-codes',
        name: 'باقة بدون أكواد',
        tierPrices: { regular: 100, bronze: 90, silver: 80, gold: 70, vip: 60 },
        availableStock: 50,
      },
    ],
  });

  assert.equal(
    isPackageOutOfStock(stockOnlyService.packages[0], 'voucher_code', []),
    true
  );

  const stockOnlyAttempt = deductPackageStock({
    service: stockOnlyService,
    pkgId: 'pkg-no-codes',
    deliveryMethod: 'voucher_code',
    warehouses: [],
  });

  assert.equal(stockOnlyAttempt.outOfStock, true);
  assert.equal(stockOnlyAttempt.assignedVoucher, undefined);
  assert.equal(stockOnlyAttempt.assignedVouchers, undefined);
  assert.equal(stockOnlyAttempt.deductedCount, 0);

  const untrackedService = makeService({
    deliveryMethods: ['voucher_code'],
    packages: [
      {
        id: 'pkg-untracked',
        name: 'باقة غير مهيأة',
        tierPrices: { regular: 100, bronze: 90, silver: 80, gold: 70, vip: 60 },
      },
    ],
  });

  assert.equal(
    isPackageOutOfStock(untrackedService.packages[0], 'voucher_code', []),
    true
  );

  const untrackedAttempt = deductPackageStock({
    service: untrackedService,
    pkgId: 'pkg-untracked',
    deliveryMethod: 'voucher_code',
    warehouses: [],
  });

  assert.equal(untrackedAttempt.outOfStock, true);
  assert.equal(untrackedAttempt.assignedVoucher, undefined);
  assert.equal(untrackedAttempt.deductedCount, 0);
});

test('account_login and player_id services do not require voucher warehouse or numeric stock and sanitize packages cleanly', () => {
  assert.equal(serviceRequiresVoucherWarehouse(['player_id']), false);
  assert.equal(serviceRequiresVoucherWarehouse(['account_login']), false);
  assert.equal(serviceRequiresVoucherWarehouse(['player_id', 'account_login']), false);
  assert.equal(serviceRequiresVoucherWarehouse(['player_id', 'voucher_code']), true);
  assert.equal(serviceRequiresVoucherWarehouse(['voucher_code']), true);

  const rawPackages = [
    {
      id: 'pkg-1',
      name: 'باقة شحن عبر الأيدي',
      tierPrices: { regular: 50, bronze: 45, silver: 40, gold: 35, vip: 30 },
      warehouseId: 'wh-123',
      vouchers: ['OLD-1', 'OLD-2'],
      availableStock: 0,
      allowSingleCodePurchase: true,
      allowPackagePurchase: true,
      packageCodesCount: 5,
    },
  ];

  const sanitizedDirect = sanitizePackagesForDeliveryMethods(rawPackages, ['player_id', 'account_login']);
  assert.equal(sanitizedDirect.length, 1);
  assert.equal('warehouseId' in sanitizedDirect[0], false);
  assert.equal('vouchers' in sanitizedDirect[0], false);
  assert.equal('availableStock' in sanitizedDirect[0], false);
  assert.equal(sanitizedDirect[0].name, 'باقة شحن عبر الأيدي');
  assert.equal(sanitizedDirect[0].tierPrices.vip, 30);

  assert.equal(isPackageOutOfStock(sanitizedDirect[0], 'player_id', []), false);
  assert.equal(isPackageOutOfStock(sanitizedDirect[0], 'account_login', []), false);

  const keptForVoucher = sanitizePackagesForDeliveryMethods(rawPackages, ['player_id', 'voucher_code']);
  assert.equal(keptForVoucher[0].warehouseId, 'wh-123');
  assert.deepEqual(keptForVoucher[0].vouchers, ['OLD-1', 'OLD-2']);
  assert.equal(keptForVoucher[0].availableStock, 0);
});

test('getPackagesForDeliveryMethod isolates independent per-method packages and keeps legacy untagged fallback', () => {
  const multiMethodService = makeService({
    deliveryMethods: ['player_id', 'account_login', 'voucher_code'],
    packages: [
      {
        id: 'pkg-id-60',
        name: '60 شدة عبر الأيدي',
        deliveryMethod: 'player_id',
        tierPrices: { regular: 5, bronze: 4.5, silver: 4, gold: 3.5, vip: 3 },
      },
      {
        id: 'pkg-acc-325',
        name: '325 شدة عبر الحساب',
        deliveryMethod: 'account_login',
        tierPrices: { regular: 20, bronze: 19, silver: 18, gold: 17, vip: 16 },
      },
      {
        id: 'pkg-vch-660',
        name: 'كود 660 شدة',
        deliveryMethod: 'voucher_code',
        tierPrices: { regular: 40, bronze: 38, silver: 36, gold: 34, vip: 32 },
        vouchers: ['CODE-A', 'CODE-B'],
        availableStock: 2,
      },
    ],
  });

  const idPkgs = getPackagesForDeliveryMethod(multiMethodService, 'player_id');
  const accPkgs = getPackagesForDeliveryMethod(multiMethodService, 'account_login');
  const vchPkgs = getPackagesForDeliveryMethod(multiMethodService, 'voucher_code');

  assert.deepEqual(idPkgs.map((p) => p.id), ['pkg-id-60']);
  assert.deepEqual(accPkgs.map((p) => p.id), ['pkg-acc-325']);
  assert.deepEqual(vchPkgs.map((p) => p.id), ['pkg-vch-660']);
  assert.equal(getServiceTotalStock(multiMethodService), 2);

  const legacyService = makeService({
    deliveryMethods: ['player_id', 'voucher_code'],
    packages: [
      {
        id: 'pkg-legacy',
        name: 'باقة قديمة مشتركة',
        tierPrices: { regular: 10, bronze: 9, silver: 8, gold: 7, vip: 6 },
      },
    ],
  });
  assert.deepEqual(getPackagesForDeliveryMethod(legacyService, 'player_id').map((p) => p.id), ['pkg-legacy']);
  assert.deepEqual(getPackagesForDeliveryMethod(legacyService, 'voucher_code').map((p) => p.id), ['pkg-legacy']);
});

test('sanitizePackagesForDeliveryMethods strips voucher fields per-package for player_id/account_login while keeping voucher_code stock', () => {
  const mixedPackages: ServicePackage[] = [
    {
      id: 'pkg-id',
      name: 'باقة أيدي',
      deliveryMethod: 'player_id',
      tierPrices: { regular: 10, bronze: 9, silver: 8, gold: 7, vip: 6 },
      warehouseId: 'wh-should-strip',
      vouchers: ['SHOULD-STRIP'],
      availableStock: 99,
    },
    {
      id: 'pkg-acc',
      name: 'باقة حساب',
      deliveryMethod: 'account_login',
      tierPrices: { regular: 15, bronze: 14, silver: 13, gold: 12, vip: 11 },
      availableStock: 5,
    },
    {
      id: 'pkg-vch',
      name: 'باقة قسيمة',
      deliveryMethod: 'voucher_code',
      tierPrices: { regular: 25, bronze: 24, silver: 23, gold: 22, vip: 21 },
      warehouseId: 'wh-psn-20',
      vouchers: ['K1', 'K2'],
      availableStock: 2,
    },
  ];

  // When only player_id and voucher_code are enabled, account_login package is excluded,
  // player_id is stripped of voucher/stock fields, and voucher_code keeps them.
  const sanitized = sanitizePackagesForDeliveryMethods(mixedPackages, ['player_id', 'voucher_code']);
  assert.equal(sanitized.length, 2);

  const savedIdPkg = sanitized.find((p) => p.id === 'pkg-id')!;
  assert.equal(savedIdPkg.deliveryMethod, 'player_id');
  assert.equal('warehouseId' in savedIdPkg, false);
  assert.equal('vouchers' in savedIdPkg, false);
  assert.equal('availableStock' in savedIdPkg, false);

  const savedVchPkg = sanitized.find((p) => p.id === 'pkg-vch')!;
  assert.equal(savedVchPkg.deliveryMethod, 'voucher_code');
  assert.equal(savedVchPkg.warehouseId, 'wh-psn-20');
  assert.deepEqual(savedVchPkg.vouchers, ['K1', 'K2']);
  assert.equal(savedVchPkg.availableStock, 2);
});

test('splitPackagesByDeliveryMethod migrates legacy shared packages cleanly across active delivery methods', () => {
  const legacyPackages: ServicePackage[] = [
    {
      id: 'pkg-shared',
      name: 'باقة عامة',
      tierPrices: { regular: 50, bronze: 45, silver: 40, gold: 35, vip: 30 },
      warehouseId: 'wh-1',
      vouchers: ['V1', 'V2'],
      availableStock: 2,
    },
  ];

  const split = splitPackagesByDeliveryMethod(legacyPackages, ['player_id', 'voucher_code']);
  assert.equal(split.voucher_code.length, 1);
  assert.equal(split.player_id.length, 1);
  assert.equal(split.account_login.length, 0);

  // Voucher copy preserves original id and warehouse link
  assert.equal(split.voucher_code[0].id, 'pkg-shared');
  assert.equal(split.voucher_code[0].warehouseId, 'wh-1');
  assert.equal(split.voucher_code[0].deliveryMethod, 'voucher_code');

  // Player ID copy has distinct id, deliveryMethod='player_id', and no warehouse/stock fields
  assert.notEqual(split.player_id[0].id, 'pkg-shared');
  assert.equal(split.player_id[0].deliveryMethod, 'player_id');
  assert.equal('warehouseId' in split.player_id[0], false);
  assert.equal('availableStock' in split.player_id[0], false);
});



