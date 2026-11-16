import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildVoucherPackagePdfPageHtml,
  resolveLogoForPdf,
  type VoucherPackagePdfInput,
} from './voucherPdf.ts';

function makeSampleInput(overrides: Partial<VoucherPackagePdfInput> = {}): VoucherPackagePdfInput {
  return {
    orderId: 'ORD-PKG-991',
    orderDate: '2026-11-16 04:30',
    serviceName: 'بطاقات بلايستيشن ستور',
    packageName: 'بطاقة 20$ سعودي',
    packageTitleAr: 'باقة التوفير 5 أكواد',
    packageDescription: 'أكواد رقمية أصلية للمتجر السعودي',
    purchaseUnit: 'package',
    codes: ['PSN-1111-AAA', 'PSN-2222-BBB', 'PSN-3333-CCC', 'PSN-4444-DDD', 'PSN-5555-EEE'],
    unitPrice: 320,
    feeAmount: 3.2,
    totalAmount: 323.2,
    paymentMethod: 'wallet',
    customerName: 'خالد الحربي',
    customerPhone: '0501234567',
    supplier: {
      storeName: 'متجر النخبة للبطاقات',
      name: 'شركة النخبة الرقمية',
      phone: '+966550001122',
      email: 'sales@elite-cards.sa',
      country: 'السعودية',
      city: 'الرياض',
      logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    },
    client: {
      tradeName: 'بقالة الأمل السريعة',
      ownerName: 'أحمد العتيبي',
      posCode: 'RYD-84920',
      phone: '0559988776',
      email: 'amal@pos.sa',
      country: 'السعودية',
      city: 'جدة',
      tierNameAr: 'ذهبي',
      logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    },
    ...overrides,
  };
}

test('buildVoucherPackagePdfPageHtml places supplier (with logo) at top-right and client (with logo) at top-left in RTL', () => {
  const input = makeSampleInput();
  const html = buildVoucherPackagePdfPageHtml({
    data: input,
    pageCodes: input.codes.map((code, i) => ({ index: i + 1, code })),
    pageIndex: 0,
    totalPages: 1,
    supplierLogoDataUrl: input.supplier.logoUrl,
    clientLogoDataUrl: input.client.logoUrl,
  });

  // Top-level RTL direction ensures 1st flex child is top-right and 2nd is top-left
  assert.match(html, /direction:rtl/);

  const supplierRegionIdx = html.indexOf('data-pdf-region="supplier-top-right"');
  const clientRegionIdx = html.indexOf('data-pdf-region="client-top-left"');
  const packageDetailsIdx = html.indexOf('data-pdf-region="package-details"');

  assert.ok(supplierRegionIdx > -1, 'supplier region present');
  assert.ok(clientRegionIdx > -1, 'client region present');
  assert.ok(packageDetailsIdx > -1, 'package details region present');
  assert.ok(supplierRegionIdx < clientRegionIdx, 'in RTL flex row, supplier block precedes client block so supplier is top-right and client is top-left');

  // Verify supplier basic info & logo
  assert.match(html, /متجر النخبة للبطاقات/);
  assert.match(html, /\+966550001122/);
  assert.match(html, /sales@elite-cards\.sa/);
  assert.match(html, /السعودية · الرياض/);
  assert.ok(html.includes(input.supplier.logoUrl!));

  // Verify client basic info & logo
  assert.match(html, /بقالة الأمل السريعة/);
  assert.match(html, /أحمد العتيبي/);
  assert.match(html, /RYD-84920/);
  assert.match(html, /0559988776/);
  assert.match(html, /amal@pos\.sa/);
  assert.match(html, /رتبة ذهبي/);
  assert.ok(html.includes(input.client.logoUrl!));

  // Verify full package details and every code
  assert.match(html, /بطاقات بلايستيشن ستور/);
  assert.match(html, /بطاقة 20\$ سعودي/);
  assert.match(html, /باقة التوفير 5 أكواد/);
  assert.match(html, /شراء بالباقة \(5 أكواد\)/);
  assert.match(html, /323\.20 ر\.س/);
  assert.match(html, /خالد الحربي/);

  for (const code of input.codes) {
    assert.ok(html.includes(code), `expected voucher code ${code} in PDF HTML`);
  }
  assert.equal(html.includes('رسوم المنصة'), false);
  assert.equal(html.includes('رسوم التطبيق'), false);
});

test('buildVoucherPackagePdfPageHtml renders 0.00 SAR for free gifts without displaying fees', () => {
  const input = makeSampleInput({
    unitPrice: 0,
    feeAmount: 0,
    totalAmount: 0,
  });
  const html = buildVoucherPackagePdfPageHtml({
    data: input,
    pageCodes: [{ index: 1, code: 'GIFT-123' }],
    pageIndex: 0,
    totalPages: 1,
  });
  assert.match(html, /0\.00 ر\.س/);
  assert.equal(html.includes('رسوم المنصة'), false);
  assert.equal(html.includes('رسوم التطبيق'), false);
});

test('buildVoucherPackagePdfPageHtml renders safe monogram fallback when logos are missing and formats continuation pages', () => {
  const input = makeSampleInput({
    supplier: {
      storeName: 'متجر السلام',
      name: 'سالم',
      logoUrl: undefined,
    },
    client: {
      tradeName: 'مركز النور',
      ownerName: 'فهد',
      posCode: 'JED-10020',
      logoUrl: undefined,
    },
  });

  const page1 = buildVoucherPackagePdfPageHtml({
    data: input,
    pageCodes: [{ index: 1, code: 'CODE-A1' }],
    pageIndex: 0,
    totalPages: 2,
  });
  assert.equal(page1.includes('<img '), false, 'no broken <img> tags when logo is missing');
  assert.match(page1, /صفحة 1 من 2/);

  const page2 = buildVoucherPackagePdfPageHtml({
    data: input,
    pageCodes: [{ index: 12, code: 'CODE-L12' }],
    pageIndex: 1,
    totalPages: 2,
  });
  assert.equal(page2.includes('data-pdf-region="supplier-top-right"'), false);
  assert.match(page2, /CODE-L12/);
  assert.match(page2, /صفحة 2 من 2/);
});

test('resolveLogoForPdf accepts data URLs directly and safely ignores empty inputs', async () => {
  const sampleData = 'data:image/png;base64,AAA=';
  assert.equal(await resolveLogoForPdf(sampleData), sampleData);
  assert.equal(await resolveLogoForPdf(''), undefined);
  assert.equal(await resolveLogoForPdf(undefined), undefined);
});
