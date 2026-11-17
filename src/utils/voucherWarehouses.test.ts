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
} from './voucherWarehouses.ts';
import type { DigitalService, VoucherWarehouse } from '../types/index.ts';

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

test('deductPackageStock decrements availableStock for non-voucher package purchases', () => {
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
  assert.equal(res.updatedService.packages[0].availableStock, 9);
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


