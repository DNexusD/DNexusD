import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PLATFORM_INTERFACE_SETTINGS,
  canSupplierModifyCatalog,
  getActiveDropdownOptions,
  getCatalogsForPosView,
  getCatalogsForSupplierView,
  matchesAdminStatementTransactionType,
  matchesStatementTransactionType,
  mergePlatformSettings,
  normalizeDropdownValue,
} from './platformSettings.ts';
import type { AccountingEntry, AdminAccountingEntry, Catalog, DepositRequest } from '../types/index.ts';

test('mergePlatformSettings falls back to defaults cleanly when partial or empty', () => {
  const full = mergePlatformSettings(undefined);
  assert.equal(full.allowSuppliersCreateCustomCatalogs, true);
  assert.equal(full.showSupplierInterfaceNotice, false);
  assert.ok(full.statementTransactionTypes.length >= 5);
  assert.ok(full.adminStatementTransactionTypes.length >= 4);
  assert.ok(full.approvedBankNames.length >= 5);

  const custom = mergePlatformSettings({
    showSupplierInterfaceNotice: true,
    supplierInterfaceNotice: 'تعميم مهم لجميع المتاجر',
    allowSuppliersCreateCustomCatalogs: false,
  });
  assert.equal(custom.showSupplierInterfaceNotice, true);
  assert.equal(custom.supplierInterfaceNotice, 'تعميم مهم لجميع المتاجر');
  assert.equal(custom.allowSuppliersCreateCustomCatalogs, false);
  assert.equal(
    custom.statementTransactionTypes.length,
    DEFAULT_PLATFORM_INTERFACE_SETTINGS.statementTransactionTypes.length
  );
});

test('getCatalogsForSupplierView shows fixed admin catalogs to all suppliers and prevents modification by suppliers', () => {
  const catalogs: Catalog[] = [
    {
      id: 'cat-fixed-1',
      supplierId: 'all',
      nameAr: 'كتالوج الاتصالات المعتمد',
      descriptionAr: 'ثابت لجميع المتاجر',
      icon: 'Smartphone',
      isFixedByAdmin: true,
    },
    {
      id: 'cat-sup-1',
      supplierId: 'sup-1',
      nameAr: 'كتالوج خاص بالمتجر الأول',
      descriptionAr: 'خاص',
      icon: 'Layers',
    },
    {
      id: 'cat-sup-2',
      supplierId: 'sup-2',
      nameAr: 'كتالوج خاص بالمتجر الثاني',
      descriptionAr: 'خاص',
      icon: 'Layers',
    },
    {
      id: 'cat-fixed-gift',
      supplierId: 'all',
      nameAr: 'الهدايا المجانية الإدارية',
      descriptionAr: 'هدايا ثابتة',
      icon: 'Gift',
      isFixedByAdmin: true,
      isFreeGiftsCatalog: true,
    },
  ];

  const sup1Cats = getCatalogsForSupplierView(catalogs, 'sup-1');
  assert.deepEqual(
    sup1Cats.map((c) => c.id),
    ['cat-fixed-1', 'cat-sup-1', 'cat-fixed-gift']
  );

  const sup2Cats = getCatalogsForSupplierView(catalogs, 'sup-2');
  assert.deepEqual(
    sup2Cats.map((c) => c.id),
    ['cat-fixed-1', 'cat-sup-2', 'cat-fixed-gift']
  );

  assert.equal(canSupplierModifyCatalog(catalogs[0], 'supplier'), false);
  assert.equal(canSupplierModifyCatalog(catalogs[0], 'employee'), false);
  assert.equal(canSupplierModifyCatalog(catalogs[0], 'super_admin'), true);
  assert.equal(canSupplierModifyCatalog(catalogs[1], 'supplier'), true);

  const posNoGifts = getCatalogsForPosView(catalogs, 'sup-1', false);
  assert.deepEqual(
    posNoGifts.map((c) => c.id),
    ['cat-fixed-1', 'cat-sup-1']
  );

  const posWithGifts = getCatalogsForPosView(catalogs, 'sup-1', true);
  assert.deepEqual(
    posWithGifts.map((c) => c.id),
    ['cat-fixed-1', 'cat-sup-1', 'cat-fixed-gift']
  );
});

test('getActiveDropdownOptions filters out inactive options', () => {
  const opts = getActiveDropdownOptions([
    { id: '1', value: 'a', labelAr: 'خيار نشط', isActive: true },
    { id: '2', value: 'b', labelAr: 'خيار مخفي', isActive: false },
    { id: '3', value: 'c', labelAr: '   ', isActive: true },
  ]);
  assert.equal(opts.length, 1);
  assert.equal(opts[0].id, '1');
});

test('matchesStatementTransactionType handles standard types, loans, transfers, and custom admin labels', () => {
  const entries: AccountingEntry[] = [
    {
      id: 'e1',
      posId: 'pos-1',
      date: '2026-11-14 10:00',
      type: 'purchase',
      description: 'شراء شحن شدات ببجي',
      debit: 50,
      credit: 0,
      balanceAfter: 100,
      referenceId: 'ORD-1',
    },
    {
      id: 'e2',
      posId: 'pos-1',
      date: '2026-11-14 10:05',
      type: 'deposit',
      description: 'اعتماد سلفة رصيد آجل للمتجر',
      debit: 0,
      credit: 200,
      balanceAfter: 300,
      referenceId: 'DEP-LOAN-1',
    },
    {
      id: 'e3',
      posId: 'pos-1',
      date: '2026-11-14 10:10',
      type: 'transfer_out',
      description: 'تسوية ضريبية معتمدة عبر كشف البنك',
      debit: 15,
      credit: 0,
      balanceAfter: 285,
      referenceId: 'TX-9',
    },
  ];
  const deposits: DepositRequest[] = [];

  assert.equal(matchesStatementTransactionType(entries[0], 'purchase', deposits), true);
  assert.equal(matchesStatementTransactionType(entries[0], 'deposit', deposits), false);
  assert.equal(matchesStatementTransactionType(entries[1], 'loan', deposits), true);
  assert.equal(matchesStatementTransactionType(entries[2], 'transfers', deposits), true);
  assert.equal(
    matchesStatementTransactionType(entries[2], 'tax_settlement', deposits, 'تسوية ضريبية'),
    true
  );
});

test('matchesAdminStatementTransactionType supports built-in aliases and custom admin dropdown options', () => {
  const entry: AdminAccountingEntry = {
    id: 'ae-1',
    date: '2026-11-14 12:00',
    type: 'bank_settlement',
    description: 'حجز مبلغ احترازي وتسوية بنكية للمتجر',
    debit: 100,
    credit: 0,
    feeAmount: 0,
    balanceAfter: 900,
    referenceId: 'SET-1',
  };

  assert.equal(matchesAdminStatementTransactionType(entry, 'settlements'), true);
  assert.equal(matchesAdminStatementTransactionType(entry, 'bank_settlement'), true);
  assert.equal(matchesAdminStatementTransactionType(entry, 'fee_collected'), false);
  assert.equal(
    matchesAdminStatementTransactionType(entry, 'custom_hold', 'حجز مبلغ احترازي'),
    true
  );

  const val = normalizeDropdownValue('حركة جديدة');
  assert.ok(val.startsWith('opt_'));
  assert.equal(normalizeDropdownValue('بنك جديد', 'custom_bank'), 'custom_bank');
});
