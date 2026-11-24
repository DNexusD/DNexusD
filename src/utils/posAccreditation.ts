import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { POSClient, PosUpgradeStatus, Supplier, UserRole } from '../types';
import { escapeHtml, sanitizePdfFilename, triggerPdfFileDownload } from './pdfStatement';
import { resolveLogoForPdf } from './voucherPdf';
import { isPosClientActive } from './accountAuth';

export type ClientAccreditationFilter = 'all' | 'accredited' | 'unaccredited' | 'active' | 'suspended';

export function isPosClientAccredited(client?: Pick<POSClient, 'isAccreditedPos'> | null): boolean {
  return Boolean(client?.isAccreditedPos);
}

export function getPosUpgradeStatus(
  client?: Pick<POSClient, 'isAccreditedPos' | 'posUpgradeStatus'> | null
): PosUpgradeStatus {
  if (!client) return 'none';
  if (
    client.posUpgradeStatus === 'pending_client_approval' ||
    client.posUpgradeStatus === 'approved' ||
    client.posUpgradeStatus === 'declined' ||
    client.posUpgradeStatus === 'none'
  ) {
    return client.posUpgradeStatus;
  }
  if (client.isAccreditedPos) {
    return 'pending_client_approval';
  }
  return 'none';
}

export function needsPosUpgradeApproval(
  client?: Pick<POSClient, 'isAccreditedPos' | 'posUpgradeStatus'> | null
): boolean {
  return getPosUpgradeStatus(client) === 'pending_client_approval';
}

export function hasClientApprovedPosUpgrade(
  client?: Pick<POSClient, 'isAccreditedPos' | 'posUpgradeStatus'> | null
): boolean {
  return Boolean(client?.isAccreditedPos) && getPosUpgradeStatus(client) === 'approved';
}

export function canSupplierInspectPosInterface(params: {
  client?: POSClient | null;
  supplierId: string;
  role: UserRole;
  canViewClients?: boolean;
  canUpgradeClientTiers?: boolean;
}): boolean {
  const { client, supplierId, role, canViewClients, canUpgradeClientTiers } = params;
  if (!client) return false;
  if (!hasClientApprovedPosUpgrade(client)) return false;

  if (role === 'super_admin') return true;
  if (role !== 'supplier' && role !== 'employee') return false;
  if (!supplierId || client.supplierId !== supplierId) return false;

  if (role === 'employee' && !canViewClients && !canUpgradeClientTiers) {
    return false;
  }
  return true;
}

export function filterStoreClients(
  clients: POSClient[],
  options: {
    searchQuery?: string;
    filter?: ClientAccreditationFilter;
  } = {}
): POSClient[] {
  const query = (options.searchQuery || '').trim().toLowerCase();
  const filter = options.filter || 'all';

  return clients.filter((client) => {
    if (filter === 'accredited' && !isPosClientAccredited(client)) return false;
    if (filter === 'unaccredited' && isPosClientAccredited(client)) return false;
    if (filter === 'active' && !isPosClientActive(client)) return false;
    if (filter === 'suspended' && isPosClientActive(client)) return false;

    if (!query) return true;
    return (
      (client.tradeName || '').toLowerCase().includes(query) ||
      (client.ownerName || '').toLowerCase().includes(query) ||
      (client.posCode || '').toLowerCase().includes(query) ||
      (client.phone || '').toLowerCase().includes(query) ||
      (client.city || '').toLowerCase().includes(query) ||
      (client.email || '').toLowerCase().includes(query)
    );
  });
}

export function formatAccreditationCertificateNumber(posCode: string, supplierId?: string): string {
  const cleanPos = (posCode || 'POS').replace(/[^A-Za-z0-9-]/g, '').toUpperCase() || 'POS';
  const cleanSup = (supplierId || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(-4)
    .toUpperCase();
  return cleanSup ? `CERT-${cleanPos}-${cleanSup}` : `CERT-${cleanPos}`;
}

export function formatAccreditationDateAr(isoDate?: string): string {
  if (!isoDate) return 'معتمد من المتجر';
  try {
    const dt = new Date(isoDate);
    if (Number.isNaN(dt.getTime())) return isoDate;
    return dt.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

export interface PosAccreditationCertificateInput {
  client: POSClient;
  supplier: Supplier;
  tierNameAr: string;
  supplierLogoDataUrl?: string;
  clientLogoDataUrl?: string;
}

export function buildPosAccreditationCertificateHtml(
  input: PosAccreditationCertificateInput
): string {
  const { client, supplier, tierNameAr, supplierLogoDataUrl, clientLogoDataUrl } = input;
  const certNo = formatAccreditationCertificateNumber(client.posCode, supplier.id);
  const accreditedDate = formatAccreditationDateAr(client.accreditedAt);
  const storeName = supplier.storeName || supplier.name || 'المتجر المعتمد';
  const certifierName = client.accreditedByName || storeName;

  const supplierLogoBlock = supplierLogoDataUrl
    ? `<img src="${escapeHtml(supplierLogoDataUrl)}" alt="${escapeHtml(storeName)}" style="width:64px;height:64px;border-radius:16px;object-fit:cover;border:2px solid #f59e0b;background:#ffffff;" />`
    : `<div style="width:64px;height:64px;border-radius:16px;border:2px solid #f59e0b;background:#fef3c7;color:#92400e;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:24px;">${escapeHtml(storeName.slice(0, 1))}</div>`;

  const clientLogoBlock = clientLogoDataUrl
    ? `<img src="${escapeHtml(clientLogoDataUrl)}" alt="${escapeHtml(client.tradeName)}" style="width:64px;height:64px;border-radius:16px;object-fit:cover;border:2px solid #10b981;background:#ffffff;" />`
    : `<div style="width:64px;height:64px;border-radius:16px;border:2px solid #10b981;background:#d1fae5;color:#065f46;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:24px;">${escapeHtml((client.tradeName || 'P').slice(0, 1))}</div>`;

  return `
    <div dir="rtl" style="width:794px;min-height:560px;padding:32px;box-sizing:border-box;background-color:#ffffff;color:#0f172a;font-family:'Tajawal','Cairo','Segoe UI',Tahoma,sans-serif;">
      <div style="border:3px solid #f59e0b;border-radius:24px;padding:28px;background:linear-gradient(135deg,#fffbeb 0%,#ffffff 45%,#ecfdf5 100%);box-sizing:border-box;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:2px solid #fde68a;padding-bottom:18px;margin-bottom:20px;">
          <div style="display:flex;align-items:center;gap:14px;">
            ${supplierLogoBlock}
            <div>
              <div style="font-size:12px;color:#b45309;font-weight:700;">المتجر المانح للاعتماد</div>
              <div style="font-size:20px;font-weight:800;color:#0f172a;">${escapeHtml(storeName)}</div>
              <div style="font-size:12px;color:#475569;">${escapeHtml(supplier.name)} ${supplier.city ? `· ${escapeHtml(supplier.city)}` : ''}</div>
            </div>
          </div>
          <div style="text-align:left;">
            <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:#059669;color:#ffffff;font-size:12px;font-weight:800;">
              ✓ نقطة بيع رسمية معتمدة
            </div>
            <div style="font-size:11px;color:#475569;margin-top:6px;font-family:monospace;">
              رقم الشهادة: ${escapeHtml(certNo)}
            </div>
          </div>
        </div>

        <div style="text-align:center;margin:16px 0 22px 0;">
          <div style="font-size:13px;font-weight:700;color:#047857;letter-spacing:0.5px;">شهادة اعتماد رسمية</div>
          <h1 style="margin:6px 0 8px 0;font-size:26px;font-weight:900;color:#0f172a;">اعتماد عميل كنقطة بيع رسمية للمتجر</h1>
          <p style="margin:0;font-size:13px;color:#334155;line-height:1.7;">
            يشهد متجر <strong style="color:#b45309;">${escapeHtml(storeName)}</strong> بأن نقطة البيع المذكورة أدناه معتمدة رسمياً لتقديم خدمات ومنتجات المتجر الرقمية.
          </p>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px;border-radius:18px;background:#ffffff;border:1.5px solid #e2e8f0;margin-bottom:20px;">
          <div style="display:flex;align-items:center;gap:14px;">
            ${clientLogoBlock}
            <div>
              <div style="font-size:11px;color:#059669;font-weight:700;">اسم نقطة البيع المعتمدة</div>
              <div style="font-size:20px;font-weight:800;color:#0f172a;">${escapeHtml(client.tradeName)}</div>
              <div style="font-size:12px;color:#475569;">المالك / المسؤول: <strong style="color:#0f172a;">${escapeHtml(client.ownerName)}</strong></div>
              <div style="font-size:12px;color:#475569;">الموقع: ${escapeHtml(client.country || '')} · ${escapeHtml(client.city || '')}</div>
            </div>
          </div>
          <div style="text-align:left;background:#f8fafc;border:1px solid #cbd5e1;border-radius:14px;padding:12px 16px;">
            <div style="font-size:10px;color:#64748b;font-weight:700;">المعرّف الرسمي لنقطة البيع</div>
            <div style="font-size:18px;font-weight:900;color:#d97706;font-family:monospace;margin-top:2px;">${escapeHtml(client.posCode)}</div>
            <div style="font-size:11px;color:#475569;margin-top:4px;">الرتبة: <strong>${escapeHtml(tierNameAr)}</strong></div>
          </div>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px;color:#334155;border-top:1.5px dashed #cbd5e1;padding-top:16px;">
          <div>تاريخ الاعتماد: <strong style="color:#0f172a;">${escapeHtml(accreditedDate)}</strong></div>
          <div>اعتماد بواسطة: <strong style="color:#0f172a;">${escapeHtml(certifierName)}</strong></div>
          <div>حالة الحساب: <strong style="color:#059669;">معتمد ونشط</strong></div>
        </div>
      </div>
    </div>
  `;
}

export async function downloadPosAccreditationCertificatePdf(params: {
  client: POSClient;
  supplier: Supplier;
  tierNameAr: string;
}): Promise<{ filename: string }> {
  const [supplierLogoDataUrl, clientLogoDataUrl] = await Promise.all([
    resolveLogoForPdf(params.supplier.logoUrl),
    resolveLogoForPdf(params.client.logoUrl),
  ]);

  const html = buildPosAccreditationCertificateHtml({
    client: params.client,
    supplier: params.supplier,
    tierNameAr: params.tierNameAr,
    supplierLogoDataUrl,
    clientLogoDataUrl,
  });

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '794px';
  iframe.style.height = '600px';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      throw new Error('تعذر إنشاء سياق الطباعة في المتصفح.');
    }
    iframeDoc.open();
    iframeDoc.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8" /></head><body style="margin:0;padding:0;background:#ffffff;">${html}</body></html>`);
    iframeDoc.close();

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const targetEl = (iframeDoc.body.firstElementChild as HTMLElement) || iframeDoc.body;
    const canvas = await html2canvas(targetEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: 794,
      windowWidth: 794,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a5',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
    const renderWidth = canvas.width * ratio;
    const renderHeight = canvas.height * ratio;
    const offsetX = (pageWidth - renderWidth) / 2;
    const offsetY = (pageHeight - renderHeight) / 2;

    pdf.addImage(imgData, 'PNG', offsetX, offsetY, renderWidth, renderHeight, undefined, 'FAST');

    const blob = pdf.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    const filename = sanitizePdfFilename(
      `accreditation-${params.client.posCode || 'pos'}.pdf`
    );
    triggerPdfFileDownload(blobUrl, filename);
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 10000);
    return { filename };
  } finally {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }
}
