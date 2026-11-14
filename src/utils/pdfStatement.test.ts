import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  sanitizePdfFilename,
  formatCurrencySar,
  computeLedgerTotals,
  paginateStatementRows,
  buildStatementPageHtml,
  renderBidiTextHtml,
  PdfStatementReportData,
} from './pdfStatement.ts';

describe('pdfStatement pure helpers', () => {
  it('escapes HTML special characters safely', () => {
    assert.equal(escapeHtml('<script>"test" & \'x\'</script>'), '&lt;script&gt;&quot;test&quot; &amp; &#39;x&#39;&lt;/script&gt;');
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
  });

  it('sanitizes filenames while preserving Arabic and enforcing .pdf extension', () => {
    assert.equal(sanitizePdfFilename('كشف حساب: الأمل / 2026'), 'كشف_حساب_الأمل_2026.pdf');
    assert.equal(sanitizePdfFilename('report.PDF'), 'report.PDF');
    assert.match(sanitizePdfFilename('   ///   '), /^statement_\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('formats SAR currency values with optional credit/debit signs', () => {
    assert.equal(formatCurrencySar(1250.5), '1,250.50 ر.س');
    assert.equal(formatCurrencySar(300, 'credit'), '+300.00 ر.س');
    assert.equal(formatCurrencySar(75.25, 'debit'), '-75.25 ر.س');
    assert.equal(formatCurrencySar(0, 'credit'), '0.00 ر.س');
  });

  it('computes accurate ledger totals with rounding', () => {
    const totals = computeLedgerTotals([
      { debit: 10.1, credit: 0 },
      { debit: 20.2, credit: 100.55 },
      { debit: undefined, credit: 49.45 },
    ]);
    assert.deepEqual(totals, {
      count: 3,
      totalDebit: 30.3,
      totalCredit: 150,
      netDelta: 119.7,
    });
  });

  it('paginates statement rows across first and subsequent pages without dropping items', () => {
    assert.deepEqual(paginateStatementRows([], 13, 18), [[]]);

    const rows = Array.from({ length: 35 }, (_, idx) => idx + 1);
    const pages = paginateStatementRows(rows, 13, 18);
    assert.equal(pages.length, 3);
    assert.equal(pages[0].length, 13);
    assert.equal(pages[1].length, 18);
    assert.equal(pages[2].length, 4);
    assert.deepEqual(pages.flat(), rows);
  });

  it('builds RTL light-mode HTML without oklch or tailwind color functions', () => {
    const report: PdfStatementReportData = {
      title: 'كشف حساب نقطة البيع',
      subtitle: 'تقرير مفصل للعمليات',
      portalLabel: 'بوابة نقطة البيع',
      entityName: 'مركز الأمل <اختبار>',
      entityCode: 'POS-101',
      generatedAt: '2026-11-13 10:00',
      filterSummary: 'كشف حساب عام',
      kpis: [
        { label: 'عدد القيود', value: '1', tone: 'neutral' },
        { label: 'الرصيد', value: '500.00 ر.س', tone: 'credit' },
      ],
      columns: [
        { key: 'date', label: 'التاريخ', mono: true },
        { key: 'type', label: 'النوع' },
        { key: 'desc', label: 'البيان' },
        { key: 'amount', label: 'المبلغ', align: 'left', mono: true },
      ],
      rows: [
        {
          id: 'r1',
          cells: {
            date: { text: '2026-11-13' },
            type: { text: 'إيداع', badge: 'إيداع شحن', badgeTone: 'emerald' },
            desc: { text: 'شحن رصيد & تأكيد', subtext: 'حوالة بنكية' },
            amount: { text: '+500.00 ر.س', tone: 'credit' },
          },
        },
      ],
      footerSummary: {
        rowCountLabel: 'إجمالي القيود: 1',
        totalDebit: '0.00 ر.س',
        totalCredit: '+500.00 ر.س',
        finalBalance: '500.00 ر.س',
      },
      filename: 'statement.pdf',
    };

    const html = buildStatementPageHtml(report, report.rows, 0, 1);
    assert.match(html, /direction:rtl/);
    assert.match(html, /كشف حساب نقطة البيع/);
    assert.match(html, /مركز الأمل &lt;اختبار&gt;/);
    assert.match(html, /شحن رصيد &amp; تأكيد/);
    assert.match(html, /صفحة 1 من 1/);
    assert.doesNotMatch(html, /oklch\(/i);
    assert.doesNotMatch(html, /oklab\(/i);
  });

  it('isolates signed currency numbers and LTR codes in RTL context', () => {
    const debitHtml = renderBidiTextHtml('-60.60 ر.س');
    assert.match(debitHtml, /dir="ltr"/);
    assert.match(debitHtml, /-60\.60/);
    assert.match(debitHtml, /ر\.س/);

    const refHtml = renderBidiTextHtml('#ord-8790', true);
    assert.match(refHtml, /dir="ltr"/);
    assert.match(refHtml, /#ord-8790/);
  });
});
