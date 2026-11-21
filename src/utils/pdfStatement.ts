import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { CurrencyCode } from '../types';
import { formatCurrencyAmount } from './currency';

export type PdfBadgeTone = 'emerald' | 'rose' | 'amber' | 'purple' | 'cyan' | 'slate';
export type PdfCellTone = 'credit' | 'debit' | 'neutral' | 'bold';
export type PdfKpiTone = 'neutral' | 'credit' | 'debit' | 'accent';

export interface PdfStatementColumn {
  key: string;
  label: string;
  align?: 'right' | 'left' | 'center';
  width?: string;
  mono?: boolean;
  nowrap?: boolean;
}

export interface PdfStatementCell {
  text: string;
  subtext?: string;
  badge?: string;
  badgeTone?: PdfBadgeTone;
  tone?: PdfCellTone;
  mono?: boolean;
  ltr?: boolean;
}

export interface PdfStatementRow {
  id: string;
  cells: Record<string, PdfStatementCell>;
}

export interface PdfStatementKpi {
  label: string;
  value: string;
  tone?: PdfKpiTone;
}

export interface PdfStatementReportData {
  title: string;
  subtitle?: string;
  portalLabel: string;
  entityName: string;
  entityCode?: string;
  generatedAt: string;
  filterSummary: string;
  kpis: PdfStatementKpi[];
  columns: PdfStatementColumn[];
  rows: PdfStatementRow[];
  pagination?: {
    firstPage?: number;
    otherPages?: number;
  };
  footerSummary?: {
    rowCountLabel: string;
    totalDebit?: string;
    totalCredit?: string;
    finalBalance?: string;
  };
  filename: string;
}

export interface GeneratedPdfResult {
  blob: Blob;
  blobUrl: string;
  previewImages: string[];
  filename: string;
  pageCount: number;
  rowCount: number;
  generatedAt: string;
  title: string;
}

export function escapeHtml(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizePdfFilename(rawName: string): string {
  const cleaned = rawName
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  const base = cleaned || `statement_${new Date().toISOString().slice(0, 10)}`;
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

export function formatCurrencySar(
  amount: number,
  sign?: 'credit' | 'debit' | 'neutral',
  currency: CurrencyCode = 'SAR',
  exchangeRateSarPerUsd?: number
): string {
  return formatCurrencyAmount(amount, currency, exchangeRateSarPerUsd, {
    decimals: 2,
    includeSymbol: true,
    withGrouping: true,
    sign: sign === 'credit' || sign === 'debit' ? sign : undefined,
  });
}

export function formatPdfCurrency(
  amount: number,
  currency: CurrencyCode = 'SAR',
  exchangeRateSarPerUsd?: number,
  sign?: 'credit' | 'debit' | 'neutral'
): string {
  return formatCurrencySar(amount, sign, currency, exchangeRateSarPerUsd);
}

export function computeLedgerTotals(
  entries: ReadonlyArray<{ debit?: number; credit?: number }>
): { count: number; totalDebit: number; totalCredit: number; netDelta: number } {
  let totalDebit = 0;
  let totalCredit = 0;
  for (const entry of entries) {
    totalDebit += Number(entry.debit) || 0;
    totalCredit += Number(entry.credit) || 0;
  }
  return {
    count: entries.length,
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    netDelta: Math.round((totalCredit - totalDebit) * 100) / 100,
  };
}

export function paginateStatementRows<T>(
  rows: ReadonlyArray<T>,
  firstPageLimit = 13,
  otherPageLimit = 18
): T[][] {
  if (rows.length === 0) {
    return [[]];
  }
  const safeFirst = Math.max(1, firstPageLimit);
  const safeOther = Math.max(1, otherPageLimit);
  const pages: T[][] = [];
  pages.push(rows.slice(0, safeFirst));
  let offset = safeFirst;
  while (offset < rows.length) {
    pages.push(rows.slice(offset, offset + safeOther));
    offset += safeOther;
  }
  return pages;
}

const BADGE_PALETTE: Record<PdfBadgeTone, { bg: string; fg: string; border: string }> = {
  emerald: { bg: '#ecfdf5', fg: '#047857', border: '#a7f3d0' },
  rose: { bg: '#fff1f2', fg: '#be123c', border: '#fecdd3' },
  amber: { bg: '#fffbeb', fg: '#b45309', border: '#fde68a' },
  purple: { bg: '#f5f3ff', fg: '#6d28d9', border: '#ddd6fe' },
  cyan: { bg: '#ecfeff', fg: '#0e7490', border: '#a5f3fc' },
  slate: { bg: '#f1f5f9', fg: '#334155', border: '#cbd5e1' },
};

const KPI_PALETTE: Record<PdfKpiTone, { bg: string; border: string; value: string }> = {
  neutral: { bg: '#f8fafc', border: '#e2e8f0', value: '#0f172a' },
  credit: { bg: '#f0fdf4', border: '#bbf7d0', value: '#047857' },
  debit: { bg: '#fff1f2', border: '#fecdd3', value: '#be123c' },
  accent: { bg: '#fffbeb', border: '#fde68a', value: '#b45309' },
};

function getCellTextColor(tone?: PdfCellTone): string {
  if (tone === 'credit') return '#047857';
  if (tone === 'debit') return '#be123c';
  if (tone === 'bold') return '#0f172a';
  return '#1e293b';
}

export function renderBidiTextHtml(rawText: string, forceLtr = false): string {
  const sarMatch = rawText.match(/^([+-]?[\d,]+\.\d{2})\s+(ر\.س|\$)$/);
  if (sarMatch) {
    return `<span dir="ltr" style="display:inline-block;unicode-bidi:isolate;">${escapeHtml(sarMatch[1])}</span> <span>${escapeHtml(sarMatch[2])}</span>`;
  }
  if (forceLtr) {
    return `<span dir="ltr" style="display:inline-block;unicode-bidi:isolate;">${escapeHtml(rawText)}</span>`;
  }
  return escapeHtml(rawText);
}

export function buildStatementPageHtml(
  report: PdfStatementReportData,
  pageRows: ReadonlyArray<PdfStatementRow>,
  pageIndex: number,
  totalPages: number
): string {
  const isFirstPage = pageIndex === 0;
  const isLastPage = pageIndex === totalPages - 1;

  const headerHtml = isFirstPage
    ? `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:14px;margin-bottom:14px;">
        <div style="max-width:65%;">
          <div style="display:inline-block;background-color:#0f172a;color:#fbbf24;font-size:10px;font-weight:700;padding:3px 10px;border-radius:6px;margin-bottom:6px;">
            ${escapeHtml(report.portalLabel)}
          </div>
          <h1 style="margin:0;font-size:20px;font-weight:800;color:#0f172a;line-height:1.3;">
            ${escapeHtml(report.title)}
          </h1>
          ${
            report.subtitle
              ? `<p style="margin:4px 0 0 0;font-size:11px;color:#475569;line-height:1.5;">${escapeHtml(report.subtitle)}</p>`
              : ''
          }
        </div>
        <div style="text-align:left;background-color:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:10px 12px;min-width:210px;">
          <div style="font-size:12px;font-weight:800;color:#0f172a;margin-bottom:4px;">${escapeHtml(report.entityName)}</div>
          ${
            report.entityCode
              ? `<div style="font-size:10px;color:#475569;margin-bottom:3px;">المعرف / الكود: <span style="font-family:monospace;font-weight:700;color:#0f172a;">${escapeHtml(report.entityCode)}</span></div>`
              : ''
          }
          <div style="font-size:10px;color:#475569;">تاريخ الإصدار: <span style="font-family:monospace;color:#0f172a;" dir="ltr">${escapeHtml(report.generatedAt)}</span></div>
        </div>
      </div>

      <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-right:4px solid #d97706;border-radius:6px;padding:8px 12px;margin-bottom:14px;font-size:11px;color:#334155;">
        <strong style="color:#0f172a;">نطاق التقرير والفلاتر:</strong>
        <span>${escapeHtml(report.filterSummary)}</span>
      </div>

      ${
        report.kpis.length > 0
          ? `<div style="display:flex;gap:10px;margin-bottom:16px;">
              ${report.kpis
                .map((kpi) => {
                  const palette = KPI_PALETTE[kpi.tone || 'neutral'];
                  return `
                    <div style="flex:1;background-color:${palette.bg};border:1px solid ${palette.border};border-radius:8px;padding:10px 12px;">
                      <div style="font-size:10px;color:#475569;font-weight:600;margin-bottom:4px;">${escapeHtml(kpi.label)}</div>
                      <div style="font-size:14px;font-weight:800;color:${palette.value};font-family:'Cairo',sans-serif;">${renderBidiTextHtml(kpi.value)}</div>
                    </div>
                  `;
                })
                .join('')}
            </div>`
          : ''
      }
    `
    : `
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #cbd5e1;padding-bottom:8px;margin-bottom:14px;">
        <div style="font-size:13px;font-weight:800;color:#0f172a;">${escapeHtml(report.title)} — ${escapeHtml(report.entityName)}</div>
        <div style="font-size:10px;color:#64748b;" dir="ltr">${escapeHtml(report.generatedAt)}</div>
      </div>
    `;

  const thHtml = report.columns
    .map((col) => {
      const align = col.align || 'right';
      const widthStyle = col.width ? `width:${col.width};` : '';
      return `<th style="padding:8px 8px;text-align:${align};font-size:10.5px;font-weight:800;color:#ffffff;border-left:1px solid #334155;white-space:nowrap;${widthStyle}">${escapeHtml(col.label)}</th>`;
    })
    .join('');

  const bodyHtml =
    pageRows.length === 0
      ? `<tr>
          <td colspan="${report.columns.length}" style="padding:28px 12px;text-align:center;color:#64748b;font-size:12px;background-color:#f8fafc;">
            لا توجد قيود محاسبية مطابقة للفلاتر المحددة في هذا الكشف.
          </td>
        </tr>`
      : pageRows
          .map((row, idx) => {
            const bgColor = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
            const tds = report.columns
              .map((col) => {
                const cell = row.cells[col.key] || { text: '-' };
                const align = col.align || 'right';
                const color = getCellTextColor(cell.tone);
                const weight = cell.tone === 'credit' || cell.tone === 'debit' || cell.tone === 'bold' ? '700' : '500';
                const fontFam = (col.mono || cell.mono)
                  ? "'Cairo','JetBrains Mono',sans-serif"
                  : "'Cairo','Segoe UI',Tahoma,sans-serif";
                const nowrapStyle = col.nowrap ? 'white-space:nowrap;' : '';

                let inner = '';
                if (cell.badge) {
                  const bp = BADGE_PALETTE[cell.badgeTone || 'slate'];
                  inner += `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:9.5px;font-weight:700;background-color:${bp.bg};color:${bp.fg};border:1px solid ${bp.border};white-space:nowrap;">${escapeHtml(cell.badge)}</span>`;
                } else {
                  inner += `<div style="color:${color};font-weight:${weight};font-family:${fontFam};line-height:1.45;${nowrapStyle}">${renderBidiTextHtml(cell.text, Boolean(cell.ltr || col.mono))}</div>`;
                }

                if (cell.subtext) {
                  inner += `<div style="font-size:9px;color:#64748b;margin-top:2px;line-height:1.35;">${escapeHtml(cell.subtext)}</div>`;
                }

                return `<td style="padding:7px 8px;text-align:${align};font-size:10.5px;border-bottom:1px solid #e2e8f0;border-left:1px solid #f1f5f9;vertical-align:top;${nowrapStyle}">${inner}</td>`;
              })
              .join('');

            return `<tr style="background-color:${bgColor};">${tds}</tr>`;
          })
          .join('');

  const footerTotalsHtml =
    isLastPage && report.footerSummary
      ? `
        <div style="margin-top:14px;background-color:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;font-size:11px;">
          <div style="font-weight:800;color:#0f172a;">${escapeHtml(report.footerSummary.rowCountLabel)}</div>
          <div style="display:flex;gap:18px;align-items:center;">
            ${
              report.footerSummary.totalDebit
                ? `<div><span style="color:#475569;">إجمالي المدين: </span><strong style="color:#be123c;font-family:'Cairo','JetBrains Mono',sans-serif;">${renderBidiTextHtml(report.footerSummary.totalDebit)}</strong></div>`
                : ''
            }
            ${
              report.footerSummary.totalCredit
                ? `<div><span style="color:#475569;">إجمالي الدائن: </span><strong style="color:#047857;font-family:'Cairo','JetBrains Mono',sans-serif;">${renderBidiTextHtml(report.footerSummary.totalCredit)}</strong></div>`
                : ''
            }
            ${
              report.footerSummary.finalBalance
                ? `<div><span style="color:#475569;">الرصيد الحالي: </span><strong style="color:#0f172a;font-family:'Cairo','JetBrains Mono',sans-serif;">${renderBidiTextHtml(report.footerSummary.finalBalance)}</strong></div>`
                : ''
            }
          </div>
        </div>
      `
      : '';

  return `
    <div class="pdf-a4-page" style="box-sizing:border-box;width:794px;height:1123px;padding:30px 34px;background-color:#ffffff;color:#0f172a;font-family:'Cairo','Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;display:flex;flex-direction:column;justify-content:space-between;">
      <div>
        ${headerHtml}
        <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;border-radius:6px;overflow:hidden;">
          <thead>
            <tr style="background-color:#0f172a;">
              ${thHtml}
            </tr>
          </thead>
          <tbody>
            ${bodyHtml}
          </tbody>
        </table>
        ${footerTotalsHtml}
      </div>

      <div style="border-top:1px solid #e2e8f0;padding-top:8px;display:flex;justify-content:space-between;align-items:center;font-size:9.5px;color:#64748b;">
        <span>منصة DNexusD المالية — مستند كشف حساب إلكتروني معتمد</span>
        <span style="font-weight:700;color:#334155;">صفحة ${pageIndex + 1} من ${totalPages}</span>
      </div>
    </div>
  `;
}

export async function generateStatementPdf(report: PdfStatementReportData): Promise<GeneratedPdfResult> {
  const filename = sanitizePdfFilename(report.filename);
  const firstLimit = report.pagination?.firstPage ?? 10;
  const otherLimit = report.pagination?.otherPages ?? 14;
  const pages = paginateStatementRows(report.rows, firstLimit, otherLimit);
  const totalPages = pages.length;

  // Create an isolated iframe with ZERO Tailwind/oklch styles so html2canvas never encounters oklch()
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.left = '-99999px';
  iframe.style.top = '0';
  iframe.style.width = '820px';
  iframe.style.height = '1200px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      throw new Error('تعذر تهيئة مستند الطباعة المعزول');
    }

    iframeDoc.open();
    iframeDoc.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
    }
  </style>
</head>
<body></body>
</html>`);
    iframeDoc.close();

    // Wait briefly for web fonts (cached in browser) without blocking if offline
    if (iframeDoc.fonts && typeof iframeDoc.fonts.ready?.then === 'function') {
      await Promise.race([
        iframeDoc.fonts.ready.catch(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, 1200)),
      ]);
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidthMm = 210;
    const pageHeightMm = 297;
    const previewImages: string[] = [];

    for (let i = 0; i < totalPages; i++) {
      const container = iframeDoc.createElement('div');
      container.innerHTML = buildStatementPageHtml(report, pages[i], i, totalPages);
      iframeDoc.body.innerHTML = '';
      const pageEl = container.firstElementChild as HTMLElement;
      iframeDoc.body.appendChild(pageEl);

      // Give layout a micro-tick inside iframe
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 794,
        height: 1123,
        windowWidth: 794,
        windowHeight: 1123,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.94);
      previewImages.push(imgData);
      if (i > 0) {
        doc.addPage();
      }
      doc.addImage(imgData, 'JPEG', 0, 0, pageWidthMm, pageHeightMm, undefined, 'FAST');
    }

    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);

    return {
      blob,
      blobUrl,
      previewImages,
      filename,
      pageCount: totalPages,
      rowCount: report.rows.length,
      generatedAt: report.generatedAt,
      title: report.title,
    };
  } finally {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }
}

export function triggerPdfFileDownload(blobUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = sanitizePdfFilename(filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
