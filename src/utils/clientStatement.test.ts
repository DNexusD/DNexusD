import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildClientStatementEntries,
  filterClientStatementDropdownOptions,
} from './clientStatement.ts';
import { AccountingEntry, DropdownOptionItem, Order } from '../types/index.ts';

test('filterClientStatementDropdownOptions hides application fee option from client dropdown', () => {
  const options: DropdownOptionItem[] = [
    { id: 'st-purchase', value: 'purchase', labelAr: 'مشتريات خدمات', isSystem: true, isActive: true },
    { id: 'st-fee', value: 'fee', labelAr: 'رسوم التطبيق', isSystem: true, isActive: true },
    { id: 'st-deposit', value: 'deposit', labelAr: 'إيداعات وشحن رصيد', isSystem: true, isActive: true },
  ];

  const filtered = filterClientStatementDropdownOptions(options);
  assert.equal(filtered.length, 2);
  assert.equal(filtered.some((o) => o.value === 'fee' || o.labelAr.includes('رسوم')), false);
});

test('buildClientStatementEntries hides fee rows for free gifts while displaying 0.00 price', () => {
  const orders = [
    {
      id: 'ord-gift-1',
      isFreeGiftOrder: true,
    } as Order,
  ];
  const entries: AccountingEntry[] = [
    {
      id: 'acc-1',
      date: '2026-11-16 10:00',
      type: 'purchase',
      referenceId: 'ord-gift-1',
      posId: 'pos-1',
      description: 'شراء خدمة: هدية شدات - باقة 60 [هدية مجانية من كتالوج الهدايا المجانية]',
      debit: 0,
      credit: 0,
      balanceAfter: 100,
      serviceName: 'هدية شدات',
    },
    {
      id: 'acc-2',
      date: '2026-11-16 10:00',
      type: 'fee',
      referenceId: 'ord-gift-1',
      posId: 'pos-1',
      description: 'رسوم تطبيق على عملية (هدية شدات)',
      debit: 1.5,
      credit: 0,
      balanceAfter: 98.5,
    },
  ];

  const clientEntries = buildClientStatementEntries(entries, orders);
  assert.equal(clientEntries.length, 1);
  assert.equal(clientEntries[0].type, 'purchase');
  assert.equal(clientEntries[0].debit, 0);
  assert.equal(clientEntries.some((e) => e.type === 'fee' || e.description.includes('رسوم')), false);
});

test('buildClientStatementEntries folds fee into standard purchase and transfer_out rows without exposing fee rows', () => {
  const entries: AccountingEntry[] = [
    {
      id: 'acc-p1',
      date: '2026-11-16 11:00',
      type: 'purchase',
      referenceId: 'ord-std-1',
      posId: 'pos-1',
      description: 'شراء خدمة: ببجي',
      debit: 60,
      credit: 0,
      balanceAfter: 440,
    },
    {
      id: 'acc-f1',
      date: '2026-11-16 11:00',
      type: 'fee',
      referenceId: 'ord-std-1',
      posId: 'pos-1',
      description: 'رسوم منصة تطبيق على عملية الشراء (0.60 ر.س)',
      debit: 0.6,
      credit: 0,
      balanceAfter: 439.4,
    },
    {
      id: 'acc-t1',
      date: '2026-11-16 12:00',
      type: 'transfer_out',
      referenceId: 'trf-1',
      posId: 'pos-1',
      description: 'تحويل رصيد إلى نقطة البيع',
      debit: 100,
      credit: 0,
      balanceAfter: 339.4,
    },
    {
      id: 'acc-tf1',
      date: '2026-11-16 12:00',
      type: 'fee',
      referenceId: 'trf-1',
      posId: 'pos-1',
      description: 'رسوم منصة تطبيق (1.00 ر.س) على تحويل الرصيد',
      debit: 1,
      credit: 0,
      balanceAfter: 338.4,
    },
    {
      id: 'acc-standalone-fee',
      date: '2026-11-16 12:05',
      type: 'fee',
      referenceId: 'ord-missing',
      posId: 'pos-1',
      description: 'رسوم تطبيق',
      debit: 0.5,
      credit: 0,
      balanceAfter: 337.9,
    },
  ];

  const clientEntries = buildClientStatementEntries(entries, []);
  assert.equal(clientEntries.length, 2);

  assert.equal(clientEntries[0].type, 'purchase');
  assert.equal(clientEntries[0].debit, 60.6);
  assert.equal(clientEntries[0].balanceAfter, 439.4);

  assert.equal(clientEntries[1].type, 'transfer_out');
  assert.equal(clientEntries[1].debit, 101);
  assert.equal(clientEntries[1].balanceAfter, 338.4);

  assert.equal(clientEntries.some((e) => e.type === 'fee'), false);
});
