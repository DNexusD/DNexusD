import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  escapeHtml,
  formatCurrencySar,
  paginateStatementRows,
  sanitizePdfFilename,
  triggerPdfFileDownload,
} from './pdfStatement';
import { WarehousePurchaseUnit } from '../types';

export interface VoucherPdfSupplierInfo {
  storeName: string;
  name: string;
  phone?: string;
  email?: string;
  country?: string;
  city?: string;
  logoUrl?: string;
}

export interface VoucherPdfClientInfo {
  tradeName: string;
  ownerName: string;
  posCode: string;
  phone?: string;
  email?: string;
  country?: string;
  city?: string;
  tierNameAr?: string;
  logoUrl?: string;
}

export interface VoucherPackagePdfInput {
  orderId: string;
  orderDate: string;
  serviceName: string;
  packageName: string;
  packageTitleAr?: string;
  packageDescription?: string;
  purchaseUnit: WarehousePurchaseUnit;
  codes: string[];
  unitPrice: number;
  feeAmount: number;
  totalAmount: number;
  paymentMethod: 'wallet' | 'visa';
  customerName?: string;
  customerPhone?: string;
  supplier: VoucherPdfSupplierInfo;
  client: VoucherPdfClientInfo;
}

export interface GeneratedVoucherPdfResult {
  blob: Blob;
  blobUrl: string;
  filename: string;
  pageCount: number;
  codesCount: number;
}

/**
 * Resolves a logo URL into a safe data URL for isolated html2canvas rendering.
 * Avoids broken images or CORS canvas tainting when external logos lack CORS headers.
 */
export async function resolveLogoForPdf(logoUrl?: string): Promise<string | undefined> {
  const trimmed = (logoUrl || '').trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return undefined;
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (val: string | undefined) => {
      if (!settled) {
        settled = true;
        resolve(val);
      }
    };

    const timer = setTimeout(() => finish(undefined), 1800);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        const width = Math.max(1, img.naturalWidth || img.width || 120);
        const height = Math.max(1, img.naturalHeight || img.height || 120);
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finish(undefined);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        finish(canvas.toDataURL('image/png'));
      } catch {
        finish(undefined);
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      finish(undefined);
    };
    img.src = trimmed;
  });
}

function renderLogoBox(logoSrc: string | undefined, fallbackLabel: string, accentBg: string, accentBorder: string, accentFg: string): string {
  if (logoSrc) {
    return `<div style="width:54px;height:54px;border-radius:12px;border:1.5px solid ${accentBorder};background-color:#ffffff;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
      <img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(fallbackLabel)}" style="width:100%;height:100%;object-fit:cover;display:block;" />
    </div>`;
  }
  const initial = escapeHtml((fallbackLabel || 'M').trim().slice(0, 2));
  return `<div style="width:54px;height:54px;border-radius:12px;border:1.5px solid ${accentBorder};background-color:${accentBg};color:${accentFg};font-weight:800;font-size:17px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
    ${initial}
  </div>`;
}

export function buildVoucherPackagePdfPageHtml(params: {
  data: VoucherPackagePdfInput;
  pageCodes: ReadonlyArray<{ index: number; code: string }>;
  pageIndex: number;
  totalPages: number;
  supplierLogoDataUrl?: string;
  clientLogoDataUrl?: string;
}): string {
  const { data, pageCodes, pageIndex, totalPages, supplierLogoDataUrl, clientLogoDataUrl } = params;
  const isFirstPage = pageIndex === 0;
  const isPackagePurchase = data.purchaseUnit === 'package' || data.codes.length > 1;
  const supplierLocation = [data.supplier.country, data.supplier.city].filter(Boolean).join(' · ');
  const clientLocation = [data.client.country, data.client.city].filter(Boolean).join(' · ');
  const paymentLabel = data.paymentMethod === 'wallet' ? 'رصيد المحفظة' : 'فيزا كارد';
  const purchaseModeLabel = isPackagePurchase
    ? `شراء بالباقة (${data.codes.length} ${data.codes.length === 1 ? 'كود' : 'أكواد'})`
    : 'شراء كود واحد (1 كود)';

  // Note: In RTL flex container, 1st child is TOP-RIGHT (المتجر) and 2nd child is TOP-LEFT (العميل).
  const headerHtml = isFirstPage
    ? `
      <div style="display:flex;justify-content:space-between;align-items:stretch;gap:12px;border-bottom:2px solid #0f172a;padding-bottom:14px;margin-bottom:14px;">
        <!-- Top Right: Store Basic Info & Logo -->
        <div data-pdf-region="supplier-top-right" style="flex:1;background-color:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:10px 12px;display:flex;align-items:flex-start;gap:10px;">
          ${renderLogoBox(
            supplierLogoDataUrl,
            data.supplier.storeName || data.supplier.name,
            '#fef3c7',
            '#f59e0b',
            '#b45309'
          )}
          <div style="min-width:0;flex:1;">
            <div style="display:inline-block;background-color:#0f172a;color:#fbbf24;font-size:9px;font-weight:700;padding:2px 8px;border-radius:4px;margin-bottom:4px;">
              بيانات المتجر (البائع)
            </div>
            <div style="font-size:13px;font-weight:800;color:#0f172a;line-height:1.35;">
              ${escapeHtml(data.supplier.storeName || data.supplier.name)}
            </div>
            ${
              data.supplier.name && data.supplier.storeName && data.supplier.name !== data.supplier.storeName
                ? `<div style="font-size:10px;color:#475569;margin-top:1px;">الإدارة: <strong style="color:#0f172a;">${escapeHtml(data.supplier.name)}</strong></div>`
                : ''
            }
            ${
              data.supplier.phone
                ? `<div style="font-size:10px;color:#334155;margin-top:2px;">الهاتف: <span dir="ltr" style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#0f172a;unicode-bidi:isolate;">${escapeHtml(data.supplier.phone)}</span></div>`
                : ''
            }
            ${
              data.supplier.email
                ? `<div style="font-size:9.5px;color:#475569;margin-top:1px;">البريد: <span dir="ltr" style="font-family:'JetBrains Mono',monospace;unicode-bidi:isolate;">${escapeHtml(data.supplier.email)}</span></div>`
                : ''
            }
            ${
              supplierLocation
                ? `<div style="font-size:9.5px;color:#64748b;margin-top:1px;">الموقع: ${escapeHtml(supplierLocation)}</div>`
                : ''
            }
          </div>
        </div>

        <!-- Top Left: Client Basic Info & Logo -->
        <div data-pdf-region="client-top-left" style="flex:1;background-color:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:10px 12px;display:flex;align-items:flex-start;gap:10px;">
          ${renderLogoBox(
            clientLogoDataUrl,
            data.client.tradeName || data.client.ownerName,
            '#e0f2fe',
            '#0284c7',
            '#0369a1'
          )}
          <div style="min-width:0;flex:1;">
            <div style="display:inline-block;background-color:#0369a1;color:#ffffff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:4px;margin-bottom:4px;">
              بيانات العميل (المشتري)
            </div>
            <div style="font-size:13px;font-weight:800;color:#0f172a;line-height:1.35;">
              ${escapeHtml(data.client.tradeName)}
            </div>
            <div style="font-size:10px;color:#334155;margin-top:1px;">
              العميل: <strong style="color:#0f172a;">${escapeHtml(data.client.ownerName)}</strong>
              ${data.client.tierNameAr ? ` · <span style="color:#0369a1;font-weight:700;">رتبة ${escapeHtml(data.client.tierNameAr)}</span>` : ''}
            </div>
            <div style="font-size:10px;color:#334155;margin-top:2px;">
              المعرف: <span dir="ltr" style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#0f172a;unicode-bidi:isolate;">${escapeHtml(data.client.posCode)}</span>
              ${
                data.client.phone
                  ? ` · الهاتف: <span dir="ltr" style="font-family:'JetBrains Mono',monospace;unicode-bidi:isolate;">${escapeHtml(data.client.phone)}</span>`
                  : ''
              }
            </div>
            ${
              data.client.email
                ? `<div style="font-size:9.5px;color:#475569;margin-top:1px;">البريد: <span dir="ltr" style="font-family:'JetBrains Mono',monospace;unicode-bidi:isolate;">${escapeHtml(data.client.email)}</span></div>`
                : ''
            }
            ${
              clientLocation
                ? `<div style="font-size:9.5px;color:#64748b;margin-top:1px;">الموقع: ${escapeHtml(clientLocation)}</div>`
                : ''
            }
          </div>
        </div>
      </div>

      <!-- Document Title Bar -->
      <div style="display:flex;justify-content:space-between;align-items:center;background-color:#0f172a;color:#ffffff;border-radius:10px;padding:10px 14px;margin-bottom:12px;">
        <div>
          <h1 style="margin:0;font-size:16px;font-weight:800;color:#fbbf24;">
            ${isPackagePurchase ? 'سند تسليم أكواد الباقة الرقمية' : 'سند تسليم كود الشحن الرقمي'}
          </h1>
          <div style="font-size:10px;color:#cbd5e1;margin-top:2px;">
            رقم الطلب: <span dir="ltr" style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#ffffff;">#${escapeHtml(data.orderId)}</span>
            · التاريخ: <span dir="ltr" style="font-family:'JetBrains Mono',monospace;color:#e2e8f0;">${escapeHtml(data.orderDate)}</span>
          </div>
        </div>
        <div style="text-align:left;">
          <div style="font-size:10px;color:#94a3b8;">إجمالي الأكواد المستلمة</div>
          <div style="font-size:16px;font-weight:800;color:#34d399;font-family:'JetBrains Mono',monospace;">
            ${data.codes.length} ${data.codes.length === 1 ? 'كود' : 'أكواد'}
          </div>
        </div>
      </div>

      <!-- Full Package Details Card -->
      <div data-pdf-region="package-details" style="background-color:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:12px 14px;margin-bottom:14px;">
        <div style="font-size:11.5px;font-weight:800;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:8px;">
          تفاصيل الباقة والعملية كاملة
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:10.5px;">
          <tbody>
            <tr>
              <td style="padding:4px 6px;color:#475569;width:18%;">الخدمة:</td>
              <td style="padding:4px 6px;color:#0f172a;font-weight:700;width:32%;">${escapeHtml(data.serviceName)}</td>
              <td style="padding:4px 6px;color:#475569;width:18%;">الفئة / الباقة:</td>
              <td style="padding:4px 6px;color:#0f172a;font-weight:700;width:32%;">
                ${escapeHtml(data.packageName)}${data.packageTitleAr && data.packageTitleAr !== data.packageName ? ` (${escapeHtml(data.packageTitleAr)})` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding:4px 6px;color:#475569;">نظام الشراء:</td>
              <td style="padding:4px 6px;color:#0369a1;font-weight:700;">${escapeHtml(purchaseModeLabel)}</td>
              <td style="padding:4px 6px;color:#475569;">طريقة الدفع:</td>
              <td style="padding:4px 6px;color:#0f172a;font-weight:700;">${escapeHtml(paymentLabel)}</td>
            </tr>
            <tr>
              <td style="padding:4px 6px;color:#475569;">الإجمالي المدفوع:</td>
              <td style="padding:4px 6px;color:#047857;font-weight:800;font-size:12px;font-family:'Cairo','JetBrains Mono',sans-serif;">${escapeHtml(formatCurrencySar(data.totalAmount))}</td>
              <td style="padding:4px 6px;color:#475569;">${data.customerName || data.customerPhone ? 'بيانات الزبون:' : 'الحالة:'}</td>
              <td style="padding:4px 6px;color:#0f172a;font-weight:600;">
                ${
                  data.customerName || data.customerPhone
                    ? escapeHtml([data.customerName, data.customerPhone].filter(Boolean).join(' · '))
                    : '<span style="color:#047857;font-weight:700;">مكتمل وجاهز للاستخدام ✓</span>'
                }
              </td>
            </tr>
            ${
              data.packageDescription
                ? `<tr>
                    <td style="padding:4px 6px;color:#475569;">الوصف:</td>
                    <td colspan="3" style="padding:4px 6px;color:#334155;">${escapeHtml(data.packageDescription)}</td>
                  </tr>`
                : ''
            }
          </tbody>
        </table>
      </div>
    `
    : `
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:14px;">
        <div style="font-size:12px;font-weight:800;color:#0f172a;">
          ${escapeHtml(data.supplier.storeName || data.supplier.name)} ← ${escapeHtml(data.client.tradeName)} · ${escapeHtml(data.serviceName)} (${escapeHtml(data.packageName)})
        </div>
        <div style="font-size:10px;color:#475569;font-family:'JetBrains Mono',monospace;" dir="ltr">
          #${escapeHtml(data.orderId)} · ${escapeHtml(data.orderDate)}
        </div>
      </div>
    `;

  const codeRowsHtml = pageCodes
    .map((item, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      return `
        <tr style="background-color:${bg};">
          <td style="padding:8px 10px;text-align:center;font-size:11px;font-weight:700;color:#475569;border-bottom:1px solid #e2e8f0;width:54px;font-family:'JetBrains Mono',monospace;">
            ${item.index}
          </td>
          <td style="padding:8px 12px;text-align:left;font-size:13px;font-weight:800;color:#0f172a;border-bottom:1px solid #e2e8f0;border-right:1px solid #f1f5f9;font-family:'JetBrains Mono',monospace;letter-spacing:0.6px;" dir="ltr">
            ${escapeHtml(item.code)}
          </td>
          <td style="padding:8px 10px;text-align:center;font-size:10px;font-weight:700;color:#047857;border-bottom:1px solid #e2e8f0;border-right:1px solid #f1f5f9;width:120px;">
            <span style="display:inline-block;padding:2px 8px;border-radius:4px;background-color:#ecfdf5;border:1px solid #a7f3d0;">
              جاهز للاستخدام ✓
            </span>
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <div class="voucher-pdf-a4-page" style="box-sizing:border-box;width:794px;height:1123px;padding:28px 32px;background-color:#ffffff;color:#0f172a;font-family:'Cairo','Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;display:flex;flex-direction:column;justify-content:space-between;">
      <div>
        ${headerHtml}

        <div style="font-size:12px;font-weight:800;color:#0f172a;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
          <span>الأكواد الرقمية المستلمة (${data.codes.length} ${data.codes.length === 1 ? 'كود' : 'أكواد'})</span>
          <span style="font-size:10px;color:#64748b;font-weight:600;">يرجى الاحتفاظ بهذه الأكواد في مكان آمن</span>
        </div>

        <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background-color:#0f172a;">
              <th style="padding:8px 10px;text-align:center;font-size:10.5px;font-weight:800;color:#fbbf24;width:54px;">#</th>
              <th style="padding:8px 12px;text-align:right;font-size:10.5px;font-weight:800;color:#ffffff;border-right:1px solid #334155;">الكود / القسيمة الرقمية</th>
              <th style="padding:8px 10px;text-align:center;font-size:10.5px;font-weight:800;color:#ffffff;border-right:1px solid #334155;width:120px;">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${codeRowsHtml}
          </tbody>
        </table>
      </div>

      <div style="border-top:1px solid #e2e8f0;padding-top:8px;display:flex;justify-content:space-between;align-items:center;font-size:9.5px;color:#64748b;">
        <span>سند إلكتروني صادر من ${escapeHtml(data.supplier.storeName || data.supplier.name)} إلى ${escapeHtml(data.client.tradeName)} (${escapeHtml(data.client.posCode)})</span>
        <span style="font-weight:700;color:#334155;">صفحة ${pageIndex + 1} من ${totalPages}</span>
      </div>
    </div>
  `;
}

export async function generateVoucherCodesPdf(
  input: VoucherPackagePdfInput
): Promise<GeneratedVoucherPdfResult> {
  const indexedCodes = input.codes.map((code, idx) => ({
    index: idx + 1,
    code,
  }));
  const pages = paginateStatementRows(indexedCodes, 11, 21);
  const totalPages = pages.length;
  const filename = sanitizePdfFilename(
    `اكواد_${input.packageName}_${input.orderId}`
  );

  const [supplierLogoDataUrl, clientLogoDataUrl] = await Promise.all([
    resolveLogoForPdf(input.supplier.logoUrl),
    resolveLogoForPdf(input.client.logoUrl),
  ]);

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
      throw new Error('تعذر تهيئة مستند PDF في المتصفح');
    }

    iframeDoc.open();
    iframeDoc.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700;800&display=swap" rel="stylesheet" />
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

    for (let i = 0; i < totalPages; i++) {
      const container = iframeDoc.createElement('div');
      container.innerHTML = buildVoucherPackagePdfPageHtml({
        data: input,
        pageCodes: pages[i],
        pageIndex: i,
        totalPages,
        supplierLogoDataUrl,
        clientLogoDataUrl,
      });
      iframeDoc.body.innerHTML = '';
      const pageEl = container.firstElementChild as HTMLElement;
      iframeDoc.body.appendChild(pageEl);

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
      filename,
      pageCount: totalPages,
      codesCount: input.codes.length,
    };
  } finally {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }
}

export async function downloadVoucherCodesPdf(
  input: VoucherPackagePdfInput
): Promise<GeneratedVoucherPdfResult> {
  const result = await generateVoucherCodesPdf(input);
  triggerPdfFileDownload(result.blobUrl, result.filename);
  setTimeout(() => {
    URL.revokeObjectURL(result.blobUrl);
  }, 10000);
  return result;
}
