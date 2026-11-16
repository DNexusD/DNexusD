import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseVoucherCodesInput,
  mergeCodesIntoWarehouse,
  getPackageAvailableStock,
  isPackageOutOfStock,
  deductPackageStock,
  syncWarehouseIntoService,
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

test('syncWarehouseIntoService updates linked package codes, stock, and prices', () => {
  const wh = makeWarehouse({
    codes: ['X1', 'X2', 'X3', 'X4'],
    tierPrices: { regular: 95, bronze: 90, silver: 85, gold: 80, vip: 75 },
  });
  const srv = makeService();
  const synced = syncWarehouseIntoService(srv, wh);

  assert.deepEqual(synced.packages[0].vouchers, ['X1', 'X2', 'X3', 'X4']);
  assert.equal(synced.packages[0].availableStock, 4);
  assert.equal(synced.packages[0].tierPrices.vip, 75);
});
