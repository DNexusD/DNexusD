import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { AccountTier, TIERS_CONFIG, DepositRequest, Catalog, DigitalService } from '../../types';
import {
  generateStatementPdf,
  triggerPdfFileDownload,
  computeLedgerTotals,
  formatCurrencySar,
  GeneratedPdfResult,
  PdfBadgeTone,
  PdfStatementRow,
} from '../../utils/pdfStatement';
import { PdfPreviewModal } from '../common/PdfPreviewModal';
import { ReceiptImageModal } from '../common/ReceiptImageModal';
import { SupplierContactLinks } from '../common/SupplierContactLinks';
import { 
  Building2, 
  FolderPlus, 
  PlusCircle, 
  Link2, 
  Image as ImageIcon,
  CheckCircle2, 
  XCircle, 
  Users, 
  Layers, 
  FileSpreadsheet, 
  Printer, 
  Gamepad2, 
  Lock, 
  Ticket, 
  Search, 
  Clock, 
  Check, 
  Plus, 
  AlertCircle,
  Copy,
  Database,
  HandCoins,
  Edit3,
  Mail,
  KeyRound,
  Send,
  QrCode,
  Share2,
  Download,
  UserCheck,
  Eye,
  Loader2,
  Landmark,
  ShieldCheck,
  Globe,
  Sparkles,
  Gift,
  Bell,
  AlertTriangle,
  Archive
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { AddServiceModal } from './AddServiceModal';
import { EditCatalogModal } from './EditCatalogModal';
import { EditServiceModal } from './EditServiceModal';
import { InviteLinkModal } from './InviteLinkModal';
import { EditSupplierProfileModal } from './EditSupplierProfileModal';
import { LoansRegistryView } from '../loans/LoansRegistryView';
import { OfficeEmployeesView } from './OfficeEmployeesView';
import { BankAccountsView } from './BankAccountsView';
import { SupplierNotificationsView } from './SupplierNotificationsView';
import { VoucherWarehousesView } from './VoucherWarehousesView';
import {
  getPackageAvailableStock,
  mergeWarehouseOptionsIntoPackage,
  resolvePackagePurchaseOptions,
  computeStockSummary,
  isWarehouseLowStock,
  serviceRequiresVoucherWarehouse,
  getDeliveryMethodLabelAr,
} from '../../utils/voucherWarehouses';
import { getSupplierBankAccounts } from '../../utils/bankAccounts';
import { isCatalogFreeGifts } from '../../utils/pricing';
import {
  getCatalogsForSupplierView,
  canSupplierModifyCatalog,
  getActiveDropdownOptions,
  matchesStatementTransactionType,
} from '../../utils/platformSettings';

export const SupplierDashboard: React.FC = () => {
  const { 
    role,
    currentUser,
    supplier, 
    catalogs, 
    services, 
    voucherWarehouses,
    posClients, 
    depositRequests, 
    loanRepaymentRequests,
    supplierBankAccounts,
    orders, 
    accountingEntries, 
    platformSettings,
    approveDepositRequest, 
    rejectDepositRequest, 
    confirmDepositReceiptByReceiver,
    completeSupplierOrder,
    rejectSupplierOrder,
    sendSupplierReplyToClient,
    updatePosTier,
    togglePosLoanPrivilege,
    togglePosReceiveTransfersPrivilege,
    togglePosBonusPrivilege,
    togglePosGiftsPrivilege,
    addCatalog,
    activeNavTab,
    setActiveNavTab,
    unreadSupplierNotificationsCount,
    showToast
  } = useApp();

  const supplierCatalogs = useMemo(
    () => getCatalogsForSupplierView(catalogs, supplier.id),
    [catalogs, supplier.id]
  );

  const statementTypeOptions = useMemo(
    () => getActiveDropdownOptions(platformSettings.statementTransactionTypes),
    [platformSettings.statementTransactionTypes]
  );

  const [showAddService, setShowAddService] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editProfileSection, setEditProfileSection] = useState<'profile' | 'social'>('profile');
  const [showAddCatalog, setShowAddCatalog] = useState(false);
  const [editingCatalog, setEditingCatalog] = useState<Catalog | null>(null);
  const [editingService, setEditingService] = useState<DigitalService | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatIsFreeGift, setNewCatIsFreeGift] = useState(false);

  // Selected subtab inside supplier portal
  const [subTab, setSubTab] = useState<'catalogs' | 'pending_orders' | 'account_orders' | 'deposits' | 'loans' | 'bank_accounts' | 'clients' | 'vouchers' | 'client_statements' | 'employees' | 'notifications'>('catalogs');
  const [depositFilter, setDepositFilter] = useState<'all' | 'pending' | 'delegated'>('all');
  const [viewingReceiptDeposit, setViewingReceiptDeposit] = useState<DepositRequest | null>(null);

  // Filter client statements
  const [selectedPosForStatement, setSelectedPosForStatement] = useState<string>('all');
  const [selectedServiceForStatement, setSelectedServiceForStatement] = useState<string>('all');
  const [selectedTypeForStatement, setSelectedTypeForStatement] = useState<string>('all');
  const [startDateForStatement, setStartDateForStatement] = useState<string>('');
  const [endDateForStatement, setEndDateForStatement] = useState<string>('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<GeneratedPdfResult | null>(null);

  useEffect(() => {
    return () => {
      if (pdfPreview?.blobUrl) {
        URL.revokeObjectURL(pdfPreview.blobUrl);
      }
    };
  }, [pdfPreview]);

  const supplierFilteredEntries = useMemo(() => {
    const matchedOpt = statementTypeOptions.find((o) => o.value === selectedTypeForStatement);
    return accountingEntries.filter(e => {
      const dateOnly = (e.date || '').substring(0, 10);
      if (selectedPosForStatement !== 'all' && e.posId !== selectedPosForStatement) return false;
      if (selectedServiceForStatement !== 'all' && e.serviceName !== selectedServiceForStatement) return false;
      if (
        selectedTypeForStatement !== 'all' &&
        !matchesStatementTransactionType(e, selectedTypeForStatement, depositRequests, matchedOpt?.labelAr)
      ) {
        return false;
      }
      if (startDateForStatement && dateOnly < startDateForStatement) return false;
      if (endDateForStatement && dateOnly > endDateForStatement) return false;
      return true;
    });
  }, [
    accountingEntries,
    depositRequests,
    statementTypeOptions,
    selectedPosForStatement,
    selectedServiceForStatement,
    selectedTypeForStatement,
    startDateForStatement,
    endDateForStatement,
  ]);

  const supplierStatementTotals = useMemo(
    () => computeLedgerTotals(supplierFilteredEntries),
    [supplierFilteredEntries]
  );

  const supplierAccountsCount = useMemo(
    () => getSupplierBankAccounts(supplierBankAccounts, supplier).length,
    [supplierBankAccounts, supplier]
  );

  const supplierDepositRequests = useMemo(
    () => depositRequests.filter(d => !d.supplierId || d.supplierId === supplier.id),
    [depositRequests, supplier.id]
  );

  const pendingDeposits = supplierDepositRequests.filter(d => d.status === 'pending');
  const delegatedDepositsCount = supplierDepositRequests.filter(
    d => Boolean(d.receiverPosId || d.receiverEmployeeId || d.receiverConfirmationStatus)
  ).length;
  const filteredSupplierDeposits = useMemo(() => {
    if (depositFilter === 'pending') return supplierDepositRequests.filter(d => d.status === 'pending');
    if (depositFilter === 'delegated') return supplierDepositRequests.filter(d => Boolean(d.receiverPosId || d.receiverEmployeeId || d.receiverConfirmationStatus));
    return supplierDepositRequests;
  }, [supplierDepositRequests, depositFilter]);

  const pendingLoansCount = depositRequests.filter(d => d.supplierId === supplier.id && d.status === 'pending' && (d.requestType === 'loan' || !!d.loanReason)).length;
  const pendingLoanRepaymentsCount = loanRepaymentRequests.filter(r => r.supplierId === supplier.id && r.status === 'pending').length;
  const totalLoansActionBadge = pendingLoansCount + pendingLoanRepaymentsCount;
  const supplierOrders = useMemo(() => orders.filter(o => !o.supplierId || o.supplierId === supplier.id), [orders, supplier.id]);
  const supplierServices = useMemo(() => services.filter(s => !s.supplierId || s.supplierId === supplier.id), [services, supplier.id]);
  const pendingOrders = supplierOrders.filter(o => o.status === 'pending_supplier' || o.status === 'in_progress');
  const pendingIdOrders = supplierOrders.filter(o => (o.status === 'pending_supplier' || o.status === 'in_progress') && o.deliveryMethod === 'player_id');
  const pendingAccountOrders = supplierOrders.filter(o => (o.status === 'pending_supplier' || o.status === 'in_progress') && o.deliveryMethod === 'account_login');

  const supplierWarehouses = useMemo(
    () => voucherWarehouses.filter(w => !w.supplierId || w.supplierId === supplier.id),
    [voucherWarehouses, supplier.id]
  );
  const stockSummary = useMemo(
    () => computeStockSummary(supplierWarehouses),
    [supplierWarehouses]
  );
  const lowStockCount = stockSummary.lowStockCount;

  // Active employee info for display in header
  const activeEmployee = role === 'employee' 
    ? {
        name: currentUser?.name || 'أحمد السعيد',
        roleTitle: currentUser?.roleTitle || 'مسؤول شحن الأيدي والدعم',
        permissions: currentUser?.permissions || {
          canManageOrders: true,
          canManageCatalogs: false,
          canManageClients: true,
          canReviewDeposits: false
        }
      }
    : (supplier.employees && supplier.employees.length > 0)
    ? supplier.employees[0]
    : null;

  const [copiedIdOrderId, setCopiedIdOrderId] = useState<string | null>(null);
  const [copiedDetailsOrderId, setCopiedDetailsOrderId] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState<Record<string, string>>({});
  const [orderFilterTab, setOrderFilterTab] = useState<'pending_id' | 'all_pending' | 'completed'>('pending_id');

  const handleCopyPlayerId = (orderId: string, id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedIdOrderId(orderId);
    showToast({
      type: 'success',
      title: 'تم نسخ الأيدي بنجاح',
      description: `تم نسخ معرّف اللاعب (${id}) للحافظة لشحن اللعبة.`
    });
    setTimeout(() => setCopiedIdOrderId(null), 2500);
  };

  const handleCopyFullDetails = (order: typeof orders[0]) => {
    const text = `اللعبة: ${order.serviceName} | الباقة: ${order.packageName} | الأيدي (Player ID): ${order.deliveryDetails.playerId || ''} ${order.deliveryDetails.playerNickname ? `(${order.deliveryDetails.playerNickname})` : ''} | نقطة البيع: ${order.posName} | رقم الطلب: #${order.id}`;
    navigator.clipboard.writeText(text);
    setCopiedDetailsOrderId(order.id);
    showToast({
      type: 'success',
      title: 'تم نسخ كامل تفاصيل الشحن',
      description: 'تم نسخ بيانات اللعبة والباقة والأيدي للحافظة.'
    });
    setTimeout(() => setCopiedDetailsOrderId(null), 2500);
  };

  const [copiedFields, setCopiedFields] = useState<Record<string, boolean>>({});

  const handleCopyField = (text: string, key: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedFields(prev => ({ ...prev, [key]: true }));
    showToast({
      type: 'success',
      title: 'تم النسخ للحافظة بنجاح',
      description: `تم نسخ ${label} (${text}) للحافظة.`
    });
    setTimeout(() => {
      setCopiedFields(prev => ({ ...prev, [key]: false }));
    }, 2500);
  };

  const handleDownloadQrImage = () => {
    try {
      const svgElement = document.getElementById('supplier-qr-code-svg') as SVGElement | null;
      if (!svgElement) return;

      const xml = new XMLSerializer().serializeToString(svgElement);
      const svg64 = btoa(unescape(encodeURIComponent(xml)));
      const image64 = 'data:image/svg+xml;base64,' + svg64;

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, 300, 300);
          ctx.drawImage(img, 20, 20, 260, 260);

          const a = document.createElement('a');
          a.href = canvas.toDataURL('image/png');
          a.download = `QR-${supplier.id}.png`;
          a.click();

          showToast({
            type: 'success',
            title: 'تم تنزيل صورة الكيو أر إلى الجهاز',
            description: `تم حفظ الصورة بنجاح بملف (QR-${supplier.id}.png).`
          });
        }
      };
      img.src = image64;
    } catch (err) {
      console.error('Failed to download QR image:', err);
    }
  };

  const handleShareSupplierInfo = async () => {
    const shareText = `المتجر: ${supplier.storeName}\nالمعرف: ${supplier.id}\nرابط المتجر: ${supplier.qrCodeValue || `https://dnexusd.example.com/join/${supplier.id}`}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `المتجر ${supplier.storeName}`,
          text: shareText
        });
        showToast({
          type: 'success',
          title: 'تمت المشاركة بنجاح',
          description: 'تم مشاركة المعرف وبيانات المتجر.'
        });
      } catch (err) {
        // User closed share modal
      }
    } else {
      navigator.clipboard.writeText(shareText);
      showToast({
        type: 'success',
        title: 'تم نسخ بيانات المشاركة للحافظة',
        description: `تم نسخ المعرف (${supplier.id}) وبيانات المتجر للحافظة.`
      });
    }
  };

  const handleCopyQrImage = async () => {
    try {
      const svgElement = document.getElementById('supplier-qr-code-svg') as SVGElement | null;
      if (!svgElement) {
        navigator.clipboard.writeText(supplier.qrCodeValue || supplier.id);
        showToast({
          type: 'success',
          title: 'تم نسخ معرف المتجر',
          description: `تم نسخ المعرف (${supplier.id}) للحافظة.`
        });
        return;
      }

      const xml = new XMLSerializer().serializeToString(svgElement);
      const svg64 = btoa(unescape(encodeURIComponent(xml)));
      const image64 = 'data:image/svg+xml;base64,' + svg64;

      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, 256, 256);
          ctx.drawImage(img, 16, 16, 224, 224);

          canvas.toBlob(async (blob) => {
            if (blob && navigator.clipboard && navigator.clipboard.write) {
              try {
                await navigator.clipboard.write([
                  new ClipboardItem({ 'image/png': blob })
                ]);
                showToast({
                  type: 'success',
                  title: 'تم نسخ صورة الكيو أر بنجاح!',
                  description: 'تم نسخ صورة الرمز QR إلى الحافظة، يمكنك لصقها الآن في أي تطبيق أو محادثة.'
                });
                return;
              } catch {
                // Fallback to download
              }
            }
            handleDownloadQrImage();
          }, 'image/png');
        }
      };
      img.src = image64;
    } catch (err) {
      console.error('Failed to copy QR image:', err);
      navigator.clipboard.writeText(supplier.qrCodeValue || supplier.id);
      showToast({
        type: 'success',
        title: 'تم نسخ معرف المتجر',
        description: `تم نسخ المعرف (${supplier.id}) إلى الحافظة.`
      });
    }
  };

  const handleCreateCatalog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    addCatalog(
      newCatName.trim(),
      newCatDesc.trim() || 'كتالوج خدمات رقمية',
      newCatIsFreeGift ? 'Gift' : 'Folder',
      newCatIsFreeGift
    );
    setNewCatName('');
    setNewCatDesc('');
    setNewCatIsFreeGift(false);
    setShowAddCatalog(false);
  };

  const getSupplierFilterSummary = () => {
    const parts: string[] = [];
    if (selectedPosForStatement !== 'all') {
      const cli = posClients.find(c => c.id === selectedPosForStatement);
      parts.push(`العميل: ${cli ? cli.tradeName : selectedPosForStatement}`);
    } else {
      parts.push('جميع العملاء');
    }

    if (selectedServiceForStatement !== 'all') {
      parts.push(`الخدمة: ${selectedServiceForStatement}`);
    } else {
      parts.push('جميع الخدمات');
    }

    const matchedOpt = statementTypeOptions.find(o => o.value === selectedTypeForStatement);
    const typeLabel = selectedTypeForStatement === 'all'
      ? 'جميع الحركات'
      : (matchedOpt?.labelAr || selectedTypeForStatement);
    parts.push(`النوع: ${typeLabel}`);

    if (startDateForStatement || endDateForStatement) {
      parts.push(`الفترة: ${startDateForStatement || '...'} إلى ${endDateForStatement || '...'}`);
    }
    return parts.join(' · ');
  };

  const handleExportPDF = async (mode: 'preview' | 'download' = 'preview') => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
      const rows: PdfStatementRow[] = supplierFilteredEntries.map((entry) => {
        const client = posClients.find(p => p.id === entry.posId);
        let badge = 'حركة';
        let badgeTone: PdfBadgeTone = 'slate';
        if (entry.type === 'deposit') {
          badge = 'إيداع رصيد';
          badgeTone = 'emerald';
        } else if (entry.type === 'purchase') {
          badge = 'شراء خدمة';
          badgeTone = 'amber';
        } else if (entry.type === 'sale') {
          badge = 'بيع لزبون';
          badgeTone = 'purple';
        } else if (entry.type === 'fee') {
          badge = 'رسوم منصة';
          badgeTone = 'slate';
        } else if (entry.type === 'transfer_in' || entry.type === 'transfer_out') {
          badge = 'تحويل رصيد';
          badgeTone = 'cyan';
        }

        const subParts: string[] = [];
        if (entry.serviceName) subParts.push(`الخدمة: ${entry.serviceName}`);
        if (entry.referenceId) subParts.push(`مرجع: #${entry.referenceId}`);

        return {
          id: entry.id,
          cells: {
            date: { text: entry.date },
            client: {
              text: client?.tradeName || 'عميل',
              subtext: client?.posCode || undefined,
            },
            type: { text: badge, badge, badgeTone },
            description: {
              text: entry.description,
              subtext: subParts.join(' · ') || undefined,
            },
            debit: {
              text: entry.debit > 0 ? formatCurrencySar(entry.debit, 'debit') : '-',
              tone: entry.debit > 0 ? 'debit' : 'neutral',
            },
            credit: {
              text: entry.credit > 0 ? formatCurrencySar(entry.credit, 'credit') : '-',
              tone: entry.credit > 0 ? 'credit' : 'neutral',
            },
            balanceAfter: {
              text: formatCurrencySar(entry.balanceAfter),
              tone: 'bold',
            },
          },
        };
      });

      const result = await generateStatementPdf({
        title: 'كشف حساب العملاء والمشتريات والإيداعات',
        subtitle: 'تقرير محاسبي تفصيلي لحركات العملاء ونقاط البيع لدى المتجر',
        portalLabel: 'بوابة المتجر',
        entityName: supplier.storeName,
        entityCode: supplier.id,
        generatedAt: nowStr,
        filterSummary: getSupplierFilterSummary(),
        kpis: [
          { label: 'عدد القيود', value: `${supplierStatementTotals.count} قيد`, tone: 'neutral' },
          { label: 'إجمالي المدين', value: formatCurrencySar(supplierStatementTotals.totalDebit, 'debit'), tone: 'debit' },
          { label: 'إجمالي الدائن', value: formatCurrencySar(supplierStatementTotals.totalCredit, 'credit'), tone: 'credit' },
          { label: 'رصيد المتجر الحالي', value: formatCurrencySar(supplier.walletBalance), tone: 'accent' },
        ],
        columns: [
          { key: 'date', label: 'التاريخ', width: '14%', mono: true },
          { key: 'client', label: 'العميل', width: '14%' },
          { key: 'type', label: 'النوع', width: '11%' },
          { key: 'description', label: 'البيان والتفاصيل', width: '25%' },
          { key: 'debit', label: 'مدين', align: 'left', width: '12%', mono: true, nowrap: true },
          { key: 'credit', label: 'دائن', align: 'left', width: '12%', mono: true, nowrap: true },
          { key: 'balanceAfter', label: 'الرصيد', align: 'left', width: '12%', mono: true, nowrap: true },
        ],
        rows,
        pagination: {
          firstPage: 9,
          otherPages: 13,
        },
        footerSummary: {
          rowCountLabel: `إجمالي القيود المعروضة: ${supplierStatementTotals.count} قيد`,
          totalDebit: formatCurrencySar(supplierStatementTotals.totalDebit, 'debit'),
          totalCredit: formatCurrencySar(supplierStatementTotals.totalCredit, 'credit'),
          finalBalance: formatCurrencySar(supplier.walletBalance),
        },
        filename: `كشف_حساب_المتجر_${supplier.storeName}_${nowStr.slice(0, 10)}.pdf`,
      });

      if (mode === 'download') {
        triggerPdfFileDownload(result.blobUrl, result.filename);
        setTimeout(() => URL.revokeObjectURL(result.blobUrl), 60_000);
        showToast({
          type: 'success',
          title: 'تم تصدير وتحميل كشف الحساب PDF',
          description: `تم إنشاء الملف (${result.filename}) بنجاح.`,
        });
      } else {
        setPdfPreview(result);
      }
    } catch (err) {
      console.error('Supplier PDF generation error:', err);
      showToast({
        type: 'error',
        title: 'تعذر إنشاء ملف PDF',
        description: err instanceof Error ? err.message : 'حدث خطأ أثناء تجهيز كشف الحساب.',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Admin Global Interface Notice for Suppliers */}
      {platformSettings.showSupplierInterfaceNotice && platformSettings.supplierInterfaceNotice.trim() && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/60 via-slate-900 to-slate-900 border border-purple-500/40 flex items-start gap-3 text-xs shadow-lg">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
            <Bell className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <div className="font-bold text-purple-200">تعميم من إدارة التطبيق للمتاجر:</div>
            <p className="text-slate-200 leading-relaxed">{platformSettings.supplierInterfaceNotice}</p>
          </div>
        </div>
      )}

      {/* Supplier Top Header Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 overflow-hidden">
                {supplier.logoUrl ? (
                  <img src={supplier.logoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-7 h-7" />
                )}
              </div>
              <div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap">
                      <h1 className="text-base sm:text-lg lg:text-xl font-bold text-white tracking-tight flex items-center gap-2 flex-nowrap whitespace-nowrap">
                        <span className="text-white font-bold whitespace-nowrap">{supplier.storeName}</span>
                        <span className="text-slate-600 font-normal select-none">·</span>
                        <span className="text-amber-400 font-semibold text-sm sm:text-base whitespace-nowrap">
                          {supplier.name}
                        </span>
                      </h1>
                      <button
                        type="button"
                        onClick={() => {
                          setEditProfileSection('profile');
                          setShowEditProfileModal(true);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition-colors shrink-0 whitespace-nowrap inline-flex items-center justify-center"
                        title="تعديل بيانات المتجر والشعار وروابط التواصل"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditProfileSection('social');
                          setShowEditProfileModal(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-amber-300 border border-slate-700 text-[11px] font-medium transition-colors shrink-0 whitespace-nowrap inline-flex items-center gap-1.5"
                        title="إضافة أو تعديل روابط التواصل الاجتماعي (اتصل بالمتجر)"
                      >
                        <Share2 className="w-3 h-3 text-amber-400" />
                        <span>روابط التواصل (اتصل بالمتجر)</span>
                      </button>
                  </div>
                  </div>
                  {/* Single line showing Employee Name, Role/Title */}
                  <div className="text-xs text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                    {activeEmployee ? (
                      <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-xs shrink-0">
                        <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-slate-400">اسم الموظف:</span>
                        <strong className="text-white font-bold">{activeEmployee.name}</strong>
                        <span className="text-slate-600 mx-0.5">·</span>
                        <span className="text-slate-400">الصفة:</span>
                        <span className="text-amber-300 font-semibold">{activeEmployee.roleTitle || 'موظف مكتب'}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                        <span>لا يوجد موظف مكتب مسجل حالياً · يمكن لمالك المتجر إضافة موظفين وتحديد صلاحياتهم من قسم الموظفين</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Supplier QR & ID - placed under logo, trade name, and name */}
            <div className="flex items-center gap-2 bg-slate-950/70 px-2.5 py-1.5 rounded-xl border border-slate-800/80 w-fit shrink-0">
              <button
                type="button"
                onClick={handleDownloadQrImage}
                className="p-0.5 bg-white rounded shrink-0 shadow-sm hover:scale-105 hover:ring-2 hover:ring-amber-400 transition-all cursor-pointer group relative"
                title="اضغط لتحميل صورة الكيو أر إلى جهازك"
              >
                <QRCodeSVG id="supplier-qr-code-svg" value={supplier.qrCodeValue || supplier.id} size={20} />
              </button>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[11px] font-semibold text-slate-400">المعرف:</span>
                <span className="font-mono text-amber-400 font-bold tracking-wider select-all text-xs">{supplier.id}</span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleCopyField(supplier.id, 'supplier_id', 'المعرف')}
                  className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-400 border border-slate-800 transition-colors flex items-center justify-center shrink-0"
                  title="نسخ المعرف"
                >
                  {copiedFields['supplier_id'] ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleShareSupplierInfo}
                  className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-400 border border-slate-800 transition-colors flex items-center justify-center shrink-0"
                  title="مشاركة الكيو أر والمعرف"
                >
                  <Share2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {supplier.socialLinks && (
              <SupplierContactLinks socialLinks={supplier.socialLinks} className="pt-0.5" />
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                if (!platformSettings.allowSuppliersCreateCustomCatalogs) {
                  showToast({
                    type: 'error',
                    title: 'ميزة معطّلة من الإدارة',
                    description: 'تم تقييد إضافة كتالوجات خاصة حالياً والالتزام بالكتالوجات الثابتة المعتمدة.',
                  });
                  return;
                }
                setShowAddCatalog(true);
              }}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md ${
                platformSettings.allowSuppliersCreateCustomCatalogs
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
              }`}
              title={platformSettings.allowSuppliersCreateCustomCatalogs ? 'إضافة كاتالوج جديد' : 'تم تعطيل إنشاء كتالوجات مخصصة من مدير التطبيق'}
            >
              {platformSettings.allowSuppliersCreateCustomCatalogs ? (
                <FolderPlus className="w-4 h-4 text-slate-600" />
              ) : (
                <Lock className="w-4 h-4 text-slate-400" />
              )}
              <span>إضافة كاتالوج</span>
            </button>

            <button
              onClick={() => setShowAddService(true)}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md"
            >
              <PlusCircle className="w-4 h-4" />
              <span>إضافة خدمة وتسعيرة الرتب</span>
            </button>
 
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md"
            >
              <Link2 className="w-4 h-4" />
              <span>رابط دعوة برتبة مسبقة</span>
            </button>

            <button
              onClick={() => setSubTab('notifications')}
              className={`flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md relative cursor-pointer ${
                subTab === 'notifications'
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700 hover:border-slate-600'
              }`}
              title="مركز إشعارات المتجر وتنبيهات العمليات"
            >
              <Bell className={`w-4 h-4 ${subTab === 'notifications' ? 'text-slate-950' : 'text-amber-400'}`} />
              <span>الإشعارات</span>
              {unreadSupplierNotificationsCount > 0 && (
                <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center shadow-sm ${
                  subTab === 'notifications' ? 'bg-slate-950 text-amber-400' : 'bg-rose-500 text-white animate-pulse'
                }`}>
                  {unreadSupplierNotificationsCount > 99 ? '99+' : unreadSupplierNotificationsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Supplier KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800/80 text-xs">
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">طلبات شحن الأيدي باللعبة (للمتجر)</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-lg font-bold font-mono text-amber-400 tabular-nums">
                {pendingIdOrders.length}
              </span>
              {pendingIdOrders.length > 0 ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 animate-pulse">
                  بانتظار الشحن باللعبة
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[10px] text-slate-500">
                  لا توجد طلبات معلقة
                </span>
              )}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">طلبات شحن رصيد المحافظ</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-lg font-bold font-mono text-cyan-400 tabular-nums">
                {pendingDeposits.length}
              </span>
              {pendingDeposits.length > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300">
                  مراجعة الحوالة
                </span>
              )}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">رصيد مبيعات المتجر الإجمالي</span>
            <span className="text-lg font-bold font-mono text-white tabular-nums">
              {supplier.walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">نقاط البيع والوكلاء</span>
            <span className="text-lg font-bold font-mono text-purple-400 tabular-nums">
              {posClients.length} عميل
            </span>
          </div>
        </div>
      </div>

      {/* Low-stock warning alert banner */}
      {lowStockCount > 0 && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-rose-950/60 via-amber-950/30 to-slate-900 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-lg animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />
            </div>
            <div>
              <div className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                <span>تنبيه نظام إدارة مخزون الأكواد</span>
                <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-mono text-[10px] font-bold">
                  {lowStockCount} فئات وباقات تحت الحد الأدنى
                </span>
              </div>
              <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">
                وصل مخزون بعض فئات الأكواد إلى الحد الأدنى المعين للتنبيه أو نفد تماماً. يرجى مراجعة المخزون وتعبئته لضمان التسليم الفوري دون انقطاع.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSubTab('vouchers')}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-colors shrink-0 cursor-pointer"
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>إدارة مخزون الأكواد وتعبئتها</span>
          </button>
        </div>
      )}

      {/* Supplier Navigation Subtabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2 text-xs font-medium">
        {(!currentUser?.permissions || currentUser.permissions.canManageCatalogs) && (
          <button
            onClick={() => setSubTab('catalogs')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
              subTab === 'catalogs'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span>الكاتالوجات والخدمات ({services.length})</span>
          </button>
        )}

        {(!currentUser?.permissions || currentUser.permissions.canManageOrders) && (
          <>
            <button
              onClick={() => setSubTab('pending_orders')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all relative ${
                subTab === 'pending_orders'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
              }`}
            >
              <Gamepad2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>طلبات شحن عبر الايدي ({pendingIdOrders.length})</span>
              {pendingIdOrders.length > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0"></span>
              )}
            </button>

            <button
              onClick={() => setSubTab('account_orders')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all relative ${
                subTab === 'account_orders'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-cyan-400 hover:text-white bg-slate-900 border border-cyan-500/30'
              }`}
            >
              <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>طلبات شحن عبر الحساب ({pendingAccountOrders.length})</span>
              {pendingAccountOrders.length > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shrink-0"></span>
              )}
            </button>
          </>
        )}

        {(!currentUser?.permissions || currentUser.permissions.canReviewDeposits) && (
          <>
            <button
              onClick={() => setSubTab('deposits')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all relative ${
                subTab === 'deposits'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>مراجعة الإيداعات ({pendingDeposits.length})</span>
              {pendingDeposits.length > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0"></span>
              )}
            </button>

            <button
              onClick={() => setSubTab('loans')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all relative ${
                subTab === 'loans'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-cyan-400 hover:text-white bg-slate-900 border border-cyan-500/30'
              }`}
            >
              <HandCoins className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>سجل السُّلَف والسداد ({totalLoansActionBadge})</span>
              {totalLoansActionBadge > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shrink-0"></span>
              )}
            </button>
          </>
        )}

        {(!currentUser?.permissions || currentUser.permissions.canManageCatalogs || currentUser.permissions.canManageVoucherStock) && (
          <button
            onClick={() => setSubTab('vouchers')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all relative ${
              subTab === 'vouchers'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <Ticket className="w-4 h-4 shrink-0" />
            <span>إدارة مخزون الأكواد ({supplierWarehouses.length})</span>
            {lowStockCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-mono text-[9px] font-bold animate-pulse">
                {lowStockCount} تنبيه
              </span>
            )}
          </button>
        )}

        {(!currentUser?.permissions || currentUser.permissions.canManageClients) && (
          <>
            <button
              onClick={() => setSubTab('clients')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                subTab === 'clients'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>إدارة العملاء</span>
            </button>

            <button
              onClick={() => setSubTab('client_statements')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                subTab === 'client_statements'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>كشف الحسابات</span>
            </button>
          </>
        )}

        {(!currentUser?.permissions ||
          currentUser.permissions.canManageBankAccounts ||
          currentUser.permissions.canReviewDeposits ||
          currentUser.permissions.canReviewCashDeposits) && (
          <button
            onClick={() => setSubTab('bank_accounts')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'bank_accounts'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-300 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <Landmark className="w-4 h-4 shrink-0" />
            <span>إدارة الحسابات البنكية ({supplierAccountsCount})</span>
          </button>
        )}

        {role !== 'employee' && (
          <button
            onClick={() => setSubTab('employees')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 ${
              subTab === 'employees'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span>موظفو المكتب والصلاحيات ({supplier.employees?.length || 0})</span>
          </button>
        )}

        <button
          onClick={() => setSubTab('notifications')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 relative ${
            subTab === 'notifications'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
              : 'text-amber-400 hover:text-white bg-slate-900 border border-amber-500/30 hover:border-amber-500/50'
          }`}
        >
          <Bell className="w-4 h-4 shrink-0" />
          <span>مركز الإشعارات</span>
          {unreadSupplierNotificationsCount > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full font-mono text-[10px] font-bold ${
              subTab === 'notifications' ? 'bg-slate-950 text-amber-400' : 'bg-rose-500 text-white animate-pulse'
            }`}>
              {unreadSupplierNotificationsCount > 99 ? '99+' : unreadSupplierNotificationsCount}
            </span>
          )}
        </button>
      </div>

      {/* SUBTAB 1: CATALOGS & MULTI-TIER SERVICES */}
      {subTab === 'catalogs' && (
        <div className="space-y-6">
          {/* Executive Summary Card of Code Stock for Packages & Categories */}
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3.5 text-xs shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <Archive className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">ملخص مخزون الأكواد لباقات وفئات الخدمات</h3>
                  <p className="text-[11px] text-slate-400">
                    رصد إجمالي المتوفر والمباع والمتبقي لكافة فئات الأكواد الرقمية مع تنبيهات النقص الفورية.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSubTab('vouchers')}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <Ticket className="w-3.5 h-3.5" />
                <span>إدارة مخزون الأكواد وتعديل الحدود</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">إجمالي المتوفر الأصلي</span>
                <span className="text-lg font-bold font-mono text-white tabular-nums">
                  {stockSummary.totalStocked} كود
                </span>
                <span className="text-[9.5px] text-slate-500 block">مجموع المودع بالمخزن</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">إجمالي المباع</span>
                <span className="text-lg font-bold font-mono text-cyan-400 tabular-nums">
                  {stockSummary.totalSold} كود
                </span>
                <span className="text-[9.5px] text-slate-500 block">مصروف للعملاء</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">إجمالي المتبقي حالياً</span>
                <span className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                  {stockSummary.totalRemaining} كود
                </span>
                <span className="text-[9.5px] text-slate-500 block">جاهز للتسليم الفوري</span>
              </div>
              <div className={`p-3 rounded-2xl bg-slate-950 border ${lowStockCount > 0 ? 'border-rose-500/40 bg-rose-950/10' : 'border-slate-800'}`}>
                <span className="text-[10px] text-slate-400 block">تنبيهات نقص المخزون</span>
                <span className={`text-lg font-bold font-mono tabular-nums ${lowStockCount > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                  {lowStockCount} فئات
                </span>
                <span className="text-[9.5px] text-slate-500 block">
                  {lowStockCount > 0 ? 'تحتاج تعبئة فورية' : 'المخزون بمستوى آمن'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">الكاتالوجات والخدمات والتسعير الطبقي</h2>
              <p className="text-xs text-slate-400">
                تسعير الخدمات لكل رتبة: مميز ٦٠ ر.س · ذهبي ٧٠ ر.س · فضي ٨٠ ر.س · نحاسي ٩٠ ر.س · عادي ١٠٠ ر.س
              </p>
            </div>
            <button
              onClick={() => setShowAddService(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>إضافة خدمة جديدة</span>
            </button>
          </div>

          {/* Catalogs Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {supplierCatalogs.map(cat => {
              const catServices = services.filter(s => s.catalogId === cat.id);
              const isGiftCat = isCatalogFreeGifts(cat);
              const isFixedAdminCat = Boolean(cat.isFixedByAdmin || cat.supplierId === 'all');
              const canModify = canSupplierModifyCatalog(cat, role);
              return (
                <div key={cat.id} className={`p-3.5 rounded-2xl bg-slate-900 border text-xs space-y-2 transition-colors ${isGiftCat ? 'border-purple-500/40 bg-purple-950/10' : isFixedAdminCat ? 'border-cyan-500/30 bg-cyan-950/10' : 'border-slate-800 hover:border-slate-700'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      {isGiftCat ? (
                        <Gift className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      ) : (
                        <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                      {cat.nameAr}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-950 text-slate-400 font-mono text-[10px] shrink-0">
                      {catServices.length} خدمات
                    </span>
                  </div>
                  {isFixedAdminCat && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-[10px] text-cyan-300 font-semibold">
                      <Lock className="w-3 h-3" />
                      <span>ثابت من الإدارة · غير قابل للتعديل</span>
                    </div>
                  )}
                  {isGiftCat && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-[10px] text-purple-300 font-semibold">
                      <Gift className="w-3 h-3" />
                      <span>هدايا مجانية (0.00 ر.س)</span>
                    </div>
                  )}
                  <div className="text-[11px] text-slate-400 line-clamp-1">{cat.descriptionAr}</div>
                  {(!currentUser?.permissions || currentUser.permissions.canManageCatalogs) && (
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end">
                      {canModify ? (
                        <button
                          type="button"
                          onClick={() => setEditingCatalog(cat)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-400 border border-slate-700 hover:border-amber-500/40 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          title="تعديل بيانات الكاتالوج"
                        >
                          <Edit3 className="w-3 h-3 text-amber-400" />
                          <span>تعديل الكاتالوج</span>
                        </button>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-cyan-300/90 border border-cyan-500/30 text-[10px] font-semibold flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          <span>مقفول من مدير التطبيق</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Services with 5-tier table representation */}
          <div className="space-y-4">
            {supplierServices.map(srv => {
              const cat = catalogs.find(c => c.id === srv.catalogId);
              const isVoucherService = serviceRequiresVoucherWarehouse(srv.deliveryMethods);
              return (
                <div key={srv.id} className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 overflow-hidden">
                        {srv.imageUrl ? (
                          <img src={srv.imageUrl} alt={srv.nameAr} className="w-full h-full object-cover" />
                        ) : (
                          <Gamepad2 className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center flex-wrap gap-2">
                          <h3 className="font-bold text-base text-white">{srv.nameAr}</h3>
                          <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-400 text-[10px]">
                            {cat?.nameAr}
                          </span>
                          {!isVoucherService && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>متوفرة دائماً (بدون عدد)</span>
                            </span>
                          )}
                          {isCatalogFreeGifts(cat) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-semibold">
                              <Gift className="w-3 h-3" />
                              <span>هدية مجانية (0.00 ر.س)</span>
                            </span>
                          )}
                          {!srv.isActive && (
                            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px]">
                              متوقفة مؤقتاً
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{srv.descriptionAr}</p>
                      </div>
                    </div>

                    {(!currentUser?.permissions || currentUser.permissions.canManageCatalogs) && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingService(srv)}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-amber-500/20 text-slate-200 hover:text-amber-400 border border-slate-700 hover:border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                          title="تعديل بيانات الخدمة والأسعار والباقات"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                          <span>تعديل الخدمة والأسعار</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Packages Table with 5 Tier Pricing */}
                  <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-950 text-slate-400 font-medium border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">اسم الباقة</th>
                          <th className="py-2.5 px-3 text-center">عادي (الأساسي)</th>
                          <th className="py-2.5 px-3 text-center text-amber-400">نحاسي</th>
                          <th className="py-2.5 px-3 text-center text-slate-200">فضي</th>
                          <th className="py-2.5 px-3 text-center text-yellow-400">ذهبي</th>
                          <th className="py-2.5 px-3 text-center text-purple-400 font-bold">مميز VIP</th>
                          <th className="py-2.5 px-3 text-left">{isVoucherService ? 'المخزون/الأكواد' : 'التوفر'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {srv.packages.map(rawPkg => {
                          const pkgIsVoucher = rawPkg.deliveryMethod
                            ? rawPkg.deliveryMethod === 'voucher_code'
                            : isVoucherService;
                          const pkg = pkgIsVoucher
                            ? mergeWarehouseOptionsIntoPackage(rawPkg, voucherWarehouses)
                            : rawPkg;
                          const opts = pkgIsVoucher
                            ? resolvePackagePurchaseOptions(pkg, voucherWarehouses)
                            : null;
                          const stock = pkgIsVoucher ? getPackageAvailableStock(pkg, voucherWarehouses) : undefined;
                          const hasVouchers = pkgIsVoucher && (Array.isArray(pkg.vouchers) || Boolean(pkg.warehouseId));
                          const displayedPrices = pkgIsVoucher && opts
                            ? (opts.allowSingleCode ? pkg.tierPrices : opts.packageTierPrices)
                            : pkg.tierPrices;

                          return (
                            <React.Fragment key={pkg.id}>
                              <tr className="hover:bg-slate-950/40">
                                <td className="py-2.5 px-3 font-sans font-medium text-white">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span>{pkg.name}</span>
                                    {rawPkg.deliveryMethod && (
                                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[9px] font-semibold">
                                        {getDeliveryMethodLabelAr(rawPkg.deliveryMethod)}
                                      </span>
                                    )}
                                    {pkgIsVoucher && opts?.allowSingleCode && (
                                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[9px] font-bold">
                                        {opts.allowPackage ? 'كود واحد' : 'بالكود'}
                                      </span>
                                    )}
                                    {pkgIsVoucher && opts && !opts.allowSingleCode && opts.allowPackage && (
                                      <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[9px] font-bold">
                                        باقة فقط ({opts.packageCodesCount} أكواد)
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-center text-slate-300">
                                  {isCatalogFreeGifts(cat) ? <span className="text-purple-300 font-bold">0.00 ر.س</span> : `${displayedPrices.regular} ر.س`}
                                </td>
                                <td className="py-2.5 px-3 text-center text-amber-400 font-semibold">
                                  {isCatalogFreeGifts(cat) ? <span className="text-purple-300 font-bold">0.00 ر.س</span> : `${displayedPrices.bronze} ر.س`}
                                </td>
                                <td className="py-2.5 px-3 text-center text-slate-200 font-semibold">
                                  {isCatalogFreeGifts(cat) ? <span className="text-purple-300 font-bold">0.00 ر.س</span> : `${displayedPrices.silver} ر.س`}
                                </td>
                                <td className="py-2.5 px-3 text-center text-yellow-400 font-semibold">
                                  {isCatalogFreeGifts(cat) ? <span className="text-purple-300 font-bold">0.00 ر.س</span> : `${displayedPrices.gold} ر.س`}
                                </td>
                                <td className="py-2.5 px-3 text-center text-purple-300 font-bold bg-purple-950/20">
                                  {isCatalogFreeGifts(cat) ? '0.00 ر.س' : `${displayedPrices.vip} ر.س`}
                                </td>
                                <td className="py-2.5 px-3 text-left font-sans text-[11px]">
                                  {(() => {
                                    if (!pkgIsVoucher) {
                                      return (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                          <span>متوفرة دائماً</span>
                                        </span>
                                      );
                                    }
                                    if (hasVouchers) {
                                      return stock && stock > 0 ? (
                                        <span className="text-amber-400 font-semibold">
                                          {stock} كود{opts?.allowPackage ? ` · ${opts.availablePackagesCount ?? 0} باقة` : ''}
                                        </span>
                                      ) : (
                                        <span className="text-rose-400 font-semibold">نفد المخزون (0 كود)</span>
                                      );
                                    }
                                    if (typeof stock === 'number') {
                                      return stock > 0 ? (
                                        <span className="text-slate-300">المخزون: {stock}</span>
                                      ) : (
                                        <span className="text-rose-400 font-semibold">نفد المخزون</span>
                                      );
                                    }
                                    return <span className="text-slate-400">شحن مباشر</span>;
                                  })()}
                                </td>
                              </tr>

                              {pkgIsVoucher && opts?.allowSingleCode && opts?.allowPackage && (
                                <tr className="bg-cyan-950/15 hover:bg-cyan-950/25">
                                  <td className="py-2 px-3 font-sans text-[11px] text-cyan-300">
                                    ↳ {opts.packageNameAr} ({opts.packageCodesCount} أكواد)
                                  </td>
                                  <td className="py-2 px-3 text-center text-cyan-200">
                                    {isCatalogFreeGifts(cat) ? <span className="text-purple-300 font-bold">0.00 ر.س</span> : `${opts.packageTierPrices.regular} ر.س`}
                                  </td>
                                  <td className="py-2 px-3 text-center text-cyan-200">
                                    {isCatalogFreeGifts(cat) ? <span className="text-purple-300 font-bold">0.00 ر.س</span> : `${opts.packageTierPrices.bronze} ر.س`}
                                  </td>
                                  <td className="py-2 px-3 text-center text-cyan-200">
                                    {isCatalogFreeGifts(cat) ? <span className="text-purple-300 font-bold">0.00 ر.س</span> : `${opts.packageTierPrices.silver} ر.س`}
                                  </td>
                                  <td className="py-2 px-3 text-center text-cyan-200">
                                    {isCatalogFreeGifts(cat) ? <span className="text-purple-300 font-bold">0.00 ر.س</span> : `${opts.packageTierPrices.gold} ر.س`}
                                  </td>
                                  <td className="py-2 px-3 text-center text-cyan-200 font-bold">
                                    {isCatalogFreeGifts(cat) ? <span className="text-purple-300 font-bold">0.00 ر.س</span> : `${opts.packageTierPrices.vip} ر.س`}
                                  </td>
                                  <td className="py-2 px-3 text-left font-sans text-[10px] text-cyan-300">
                                    {opts.availablePackagesCount ?? 0} باقة متاحة
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB 2: IN-GAME PLAYER ID FULFILLMENT CENTER FOR THE المتجر / SUPPLIER */}
      {subTab === 'pending_orders' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Gamepad2 className="w-5 h-5 text-amber-400" />
                <span>طلبات شحن الأيدي الواردة للمتجر (الشحن المباشر من اللعبة)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                يقوم العميل بإرسال الطلب مع الأيدي (Player ID)، وهنا يستلم المتجر الأيدي ليكمل شحن الحساب مباشرة من داخل اللعبة وإشعار العميل باكتمال العملية.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-2xl text-xs shrink-0">
              <button
                type="button"
                onClick={() => setOrderFilterTab('pending_id')}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                  orderFilterTab === 'pending_id'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                شحن الأيدي المعلقة ({pendingIdOrders.length})
              </button>

              <button
                type="button"
                onClick={() => setOrderFilterTab('all_pending')}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                  orderFilterTab === 'all_pending'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                جميع المعلقة ({pendingOrders.length})
              </button>

              <button
                type="button"
                onClick={() => setOrderFilterTab('completed')}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                  orderFilterTab === 'completed'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                المنفذة مكتملة
              </button>
            </div>
          </div>

          {/* Orders List */}
          <div className="space-y-4">
            {orders
              .filter(order => {
                if (orderFilterTab === 'pending_id') {
                  return (order.status === 'pending_supplier' || order.status === 'in_progress') && order.deliveryMethod === 'player_id';
                }
                if (orderFilterTab === 'all_pending') {
                  return order.status === 'pending_supplier' || order.status === 'in_progress';
                }
                if (orderFilterTab === 'completed') {
                  return order.status === 'completed';
                }
                return true;
              })
              .map(order => {
                const isPending = order.status === 'pending_supplier' || order.status === 'in_progress';
                const isPlayerId = order.deliveryMethod === 'player_id';
                const pId = order.deliveryDetails.playerId || '';
                const currentNoteInput = orderNotes[order.id] ?? (isPlayerId ? `تم الشحن بنجاح من داخل اللعبة عبر الأيدي (${pId})` : 'تم الشحن بنجاح عبر بوابة المتجر');

                return (
                  <div
                    key={order.id}
                    className={`p-4 sm:p-5 rounded-3xl border transition-all text-xs space-y-4 ${
                      isPending && isPlayerId
                        ? 'bg-slate-900 border-amber-500/50 shadow-xl ring-1 ring-amber-500/20'
                        : isPending
                        ? 'bg-slate-900 border-cyan-500/40 shadow-lg'
                        : 'bg-slate-950/70 border-slate-800'
                    }`}
                  >
                    {/* Order Header bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-amber-400">#{order.id}</span>
                        <span className="text-slate-500">·</span>
                        <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                          {isPlayerId && <Gamepad2 className="w-4 h-4 text-amber-400" />}
                          <span>{order.serviceName}</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-slate-950 border border-slate-800 text-amber-300">
                          {order.packageName}
                        </span>

                        {isPending ? (
                          <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span>بانتظار شحن المتجر من اللعبة</span>
                          </span>
                        ) : order.status === 'completed' ? (
                          <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>تم الشحن من اللعبة بنجاح ✓</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            ملغي
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                        <span>تاريخ الطلب: <strong className="text-slate-200 font-mono">{order.date}</strong></span>
                        <span>·</span>
                        <span>السعر: <strong className="text-white font-mono text-sm">{order.totalDeducted.toFixed(2)} ر.س</strong></span>
                      </div>
                    </div>

                    {/* HERO PLAYER ID BOX (When order is Player ID) */}
                    {isPlayerId && (
                      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-950 to-slate-950 border border-amber-500/40 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
                              <Gamepad2 className="w-4 h-4 text-amber-400" />
                              <span>معرف اللاعب المطلوب شحنه في اللعبة (الأيدي / Player ID):</span>
                            </div>
                            <div className="flex items-baseline gap-3">
                              <span className="text-2xl font-black font-mono text-white tracking-widest select-all bg-slate-900 px-3 py-1 rounded-xl border border-slate-700">
                                {pId}
                              </span>
                              {order.deliveryDetails.playerNickname && (
                                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>اسم اللاعب: {order.deliveryDetails.playerNickname}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quick Copy Buttons for the المتجر */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopyPlayerId(order.id, pId)}
                              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md"
                              title="نسخ رقم الأيدي فقط لاستخدامه في شحن اللعبة"
                            >
                              {copiedIdOrderId === order.id ? (
                                <>
                                  <Check className="w-4 h-4 text-slate-950" />
                                  <span>تم نسخ الأيدي!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4" />
                                  <span>نسخ الأيدي للشحن</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopyFullDetails(order)}
                              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-colors"
                              title="نسخ اسم اللعبة والباقة والأيدي معاً"
                            >
                              {copiedDetailsOrderId === order.id ? (
                                <Check className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Copy className="w-4 h-4 text-slate-400" />
                              )}
                              <span>نسخ التفاصيل</span>
                            </button>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-4 pt-1 border-t border-slate-800/80">
                          <span>نقطة البيع الطالبة: <strong className="text-slate-200">{order.posName} ({order.posCode})</strong></span>
                          <span>·</span>
                          <span>الزبون النهائي: <strong className="text-slate-200">{order.customerName || 'مباشر'}</strong></span>
                          {order.customerPhone && (
                            <>
                              <span>·</span>
                              <span dir="ltr">هاتف: <strong className="text-slate-200">{order.customerPhone}</strong></span>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Account Login Box (if delivery method is account login) */}
                    {order.deliveryMethod === 'account_login' && (
                      <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/40 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <KeyRound className="w-4 h-4 text-cyan-400" />
                            <span>بيانات الحساب وتوثيق الدخول:</span>
                          </span>
                          <span className="text-[10px] text-cyan-300">انسخ البيانات لتسجيل الدخول وشحن الحساب</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {/* Email */}
                          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                            <div className="truncate flex-1">
                              <span className="text-[10px] text-slate-400 block">البريد:</span>
                              <span className="font-mono text-xs text-cyan-200 font-bold select-all truncate block">
                                {order.deliveryDetails.accountEmail || 'لا يوجد بريد'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyField(order.deliveryDetails.accountEmail || '', `${order.id}_email`, 'البريد')}
                              className="px-2.5 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-1 shrink-0"
                            >
                              {copiedFields[`${order.id}_email`] ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedFields[`${order.id}_email`] ? 'تم' : 'نسخ'}</span>
                            </button>
                          </div>

                          {/* Password */}
                          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                            <div className="truncate flex-1">
                              <span className="text-[10px] text-slate-400 block">كلمة المرور:</span>
                              <span className="font-mono text-xs text-amber-300 font-bold select-all truncate block">
                                {order.deliveryDetails.accountPassword || 'غير مدخلة'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyField(order.deliveryDetails.accountPassword || '', `${order.id}_pwd`, 'كلمة المرور')}
                              disabled={!order.deliveryDetails.accountPassword}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-950 hover:bg-amber-900 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1 shrink-0 disabled:opacity-40"
                            >
                              {copiedFields[`${order.id}_pwd`] ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedFields[`${order.id}_pwd`] ? 'تم' : 'نسخ'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Supplier Interactive Reply & OTP Sender */}
                        {isPending && (
                          <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-500/40 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                                <Send className="w-3.5 h-3.5" />
                                <span>إرسال رمز التحقق (OTP) إلى العميل:</span>
                              </span>
                              <span className="text-[10px] text-slate-400">يصل فوراً كإشعار في شاشة العميل</span>
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="أدخل رمز التحقق (OTP) أو الرسالة..."
                                value={orderNotes[order.id + '_otp'] || ''}
                                onChange={e => setOrderNotes({ ...orderNotes, [order.id + '_otp']: e.target.value })}
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const code = orderNotes[order.id + '_otp']?.trim();
                                  if (!code) {
                                    showToast({ type: 'error', title: 'تنبيه', description: 'يرجى كتابة رمز التحقق أولاً' });
                                    return;
                                  }
                                  sendSupplierReplyToClient(order.id, code);
                                }}
                                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow shrink-0"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>إرسال رمز التحقق</span>
                              </button>
                            </div>
                            {order.deliveryDetails.supplierReplyMessage && (
                              <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 pt-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>تم إرسال الرمز للعميل بنجاح: <strong className="font-mono text-white bg-slate-900 px-2 py-0.5 rounded border border-emerald-500/30">{order.deliveryDetails.supplierReplyMessage}</strong></span>
                              </div>
                            )}

                            {/* Client OTP Read Confirmation Alert Banner (Requested by User) */}
                            {order.deliveryDetails.clientOtpReadConfirmation && (
                              <div className="p-3 rounded-xl bg-emerald-950/80 border-2 border-emerald-500 text-xs text-emerald-200 flex items-center justify-between gap-2 shadow-lg animate-in fade-in duration-300 mt-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-sm shrink-0 shadow">
                                    ✓
                                  </div>
                                  <div>
                                    <div className="font-bold text-emerald-300">تنبيه فوري للمتجر: العميل قام بقراءة والاطلاع على رمز التحقق!</div>
                                    <div className="text-[10px] text-emerald-400/90">
                                      وافق العميل على رمز التحقق ونسخه. يمكنك الآن استكمال وإتمام عملية الشحن للطلب.
                                    </div>
                                  </div>
                                </div>
                                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-900/60 px-2 py-1 rounded-lg border border-emerald-500/30 shrink-0">
                                  {order.deliveryDetails.clientOtpReadAt || 'تمت القراءة'}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Supplier note display if completed */}
                    {order.supplierNotes && (
                      <div className="text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-start gap-2">
                        <span className="text-amber-400 font-semibold shrink-0">ملاحظة المتجر:</span>
                        <span className="text-slate-200">{order.supplierNotes}</span>
                        {order.completedAt && (
                          <span className="text-slate-500 mr-auto font-mono">تاريخ الشحن: {order.completedAt}</span>
                        )}
                      </div>
                    )}

                    {/* IN-GAME FULFILLMENT ACTIONS FOR THE المتجر */}
                    {isPending && (
                      <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1">
                          <label className="block text-[10px] text-slate-400 mb-1">
                            ملاحظة المتجر أو رقم مرجع الشحن من اللعبة (تظهر للعميل في الإيصال):
                          </label>
                          <input
                            type="text"
                            value={currentNoteInput}
                            onChange={e => setOrderNotes({ ...orderNotes, [order.id]: e.target.value })}
                            placeholder="مثال: تم الشحن بنجاح من داخل اللعبة عبر الأيدي 5129480192"
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="flex items-center gap-2 shrink-0 sm:pt-4">
                          <button
                            type="button"
                            onClick={() => completeSupplierOrder(order.id, currentNoteInput)}
                            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>تأكيد إتمام الشحن من اللعبة بالأيدي</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => rejectSupplierOrder(order.id, 'تعذر شحن الأيدي من داخل اللعبة وتمت إعادة الرصيد للمحفظة')}
                            className="px-3 py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs font-semibold transition-colors"
                          >
                            تعذر الشحن (استرداد)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

            {orders.filter(order => {
              if (orderFilterTab === 'pending_id') {
                return (order.status === 'pending_supplier' || order.status === 'in_progress') && order.deliveryMethod === 'player_id';
              }
              if (orderFilterTab === 'all_pending') {
                return order.status === 'pending_supplier' || order.status === 'in_progress';
              }
              if (orderFilterTab === 'completed') {
                return order.status === 'completed';
              }
              return true;
            }).length === 0 && (
              <div className="py-12 text-center rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
                <Gamepad2 className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="font-bold text-white text-sm">لا توجد طلبات في هذا القسم حالياً</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {orderFilterTab === 'pending_id' 
                    ? 'لا توجد طلبات شحن أيدي معلقة حالياً. عند قيام أي نقطة بيع بالشحن عبر الأيدي ستصل تفاصيل الأيدي هنا مباشرة للشحن من اللعبة.'
                    : 'لا توجد طلبات مطابقة للفلتر المحدد.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB: ACCOUNT LOGIN ORDERS FULFILLMENT & OTP SENDER */}
      {subTab === 'account_orders' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-cyan-400" />
                <span>طلبات شحن عبر الحساب المباشر والتسليم بالتوثيق (2FA)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                تظهر هنا طلبات الشحن التي تتطلب دخول الحساب (الإيميل، الباسورد، ورمز التحقق)، حيث يمكنك كتابة الرمز وإرساله فوراً لشاشة العميل.
              </p>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold">
              {pendingAccountOrders.length} طلبات حساب بانتظار الشحن/الرمز
            </div>
          </div>

          <div className="space-y-4">
            {orders
              .filter(o => o.deliveryMethod === 'account_login')
              .map(order => {
                const isPending = order.status === 'pending_supplier' || order.status === 'in_progress';
                const currentNoteInput = orderNotes[order.id] ?? 'تم شحن الحساب بنجاح وتأكيد الدخول';

                return (
                  <div
                    key={order.id}
                    className={`p-4 sm:p-5 rounded-3xl border transition-all text-xs space-y-4 ${
                      isPending
                        ? 'bg-slate-900 border-cyan-500/50 shadow-xl ring-1 ring-cyan-500/20'
                        : 'bg-slate-950/70 border-slate-800'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-cyan-400">#{order.id}</span>
                        <span className="text-slate-500">·</span>
                        <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                          <Lock className="w-4 h-4 text-cyan-400" />
                          <span>{order.serviceName}</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-slate-950 border border-slate-800 text-cyan-300">
                          {order.packageName}
                        </span>

                        {isPending ? (
                          <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 animate-pulse">
                            <Clock className="w-3 h-3 text-cyan-400" />
                            <span>بانتظار توثيق الحساب والدخول</span>
                          </span>
                        ) : order.status === 'completed' ? (
                          <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>تم الشحن واكتمال الدخول ✓</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            ملغي
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                        <span>تاريخ الطلب: <strong className="text-slate-200 font-mono">{order.date}</strong></span>
                        <span>·</span>
                        <span>السعر: <strong className="text-white font-mono text-sm">{order.totalDeducted.toFixed(2)} ر.س</strong></span>
                      </div>
                    </div>

                    {/* Account Login Details Card */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-cyan-950/20 border border-cyan-500/40 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cyan-500/20 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0">
                            <KeyRound className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-white block">بيانات الحساب وتوثيق الدخول المرسلة من العميل:</span>
                            <span className="text-[10px] text-cyan-300">انسخ البريد وكلمة المرور لتسجيل الدخول إلى حساب العميل وشحن الخدمة</span>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-400">
                          نقطة البيع: <strong className="text-white">{order.posName} ({order.posCode})</strong>
                        </div>
                      </div>

                      {/* Two Dedicated Copyable Fields: Email & Password */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Email Field */}
                        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 shadow-sm">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-cyan-400" />
                              <span>البريد الإلكتروني للعميل:</span>
                            </label>
                            <span className="text-[10px] text-cyan-400 font-mono">حقل قابل للنسخ</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div 
                              onClick={() => handleCopyField(order.deliveryDetails.accountEmail || '', `${order.id}_email`, 'البريد الإلكتروني')}
                              className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 font-mono text-xs text-cyan-200 font-bold truncate select-all cursor-pointer hover:border-cyan-500 transition-colors"
                              title="اضغط للنسخ السريع"
                            >
                              {order.deliveryDetails.accountEmail || 'لا يوجد بريد إلكتروني'}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyField(order.deliveryDetails.accountEmail || '', `${order.id}_email`, 'البريد الإلكتروني')}
                              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                                copiedFields[`${order.id}_email`]
                                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                                  : 'bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300'
                              }`}
                            >
                              {copiedFields[`${order.id}_email`] ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-slate-950" />
                                  <span>تم النسخ ✓</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>نسخ البريد</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Password Field */}
                        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 shadow-sm">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                              <span>كلمة مرور الحساب:</span>
                            </label>
                            <span className="text-[10px] text-amber-400 font-mono">حقل قابل للنسخ</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div 
                              onClick={() => order.deliveryDetails.accountPassword && handleCopyField(order.deliveryDetails.accountPassword, `${order.id}_pwd`, 'كلمة المرور')}
                              className={`flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 font-mono text-xs font-bold truncate select-all ${
                                order.deliveryDetails.accountPassword 
                                  ? 'text-amber-300 cursor-pointer hover:border-amber-500 transition-colors' 
                                  : 'text-slate-500'
                              }`}
                              title={order.deliveryDetails.accountPassword ? 'اضغط للنسخ السريع' : ''}
                            >
                              {order.deliveryDetails.accountPassword || 'غير مدخلة من العميل'}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyField(order.deliveryDetails.accountPassword || '', `${order.id}_pwd`, 'كلمة المرور')}
                              disabled={!order.deliveryDetails.accountPassword}
                              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                                !order.deliveryDetails.accountPassword
                                  ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                                  : copiedFields[`${order.id}_pwd`]
                                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                                  : 'bg-amber-950 hover:bg-amber-900 border border-amber-500/40 text-amber-300 cursor-pointer'
                              }`}
                            >
                              {copiedFields[`${order.id}_pwd`] ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-slate-950" />
                                  <span>تم النسخ ✓</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>نسخ كلمة المرور</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* اسفلهم: إرسال رمز التحقق */}
                      {isPending && (
                        <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/50 space-y-3 shadow-inner">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0"></span>
                              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                                <Send className="w-3.5 h-3.5 text-amber-400" />
                                <span>إرسال رمز التحقق (OTP) إلى العميل:</span>
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400">
                              يصل هذا الرمز فوراً كإشعار ينبثق في واجهة العميل وشاشة الشراء مباشرة
                            </span>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              placeholder="أدخل رمز التحقق (OTP) أو كود التفعيل هنا..."
                              value={orderNotes[order.id + '_account_otp'] || ''}
                              onChange={e => setOrderNotes({ ...orderNotes, [order.id + '_account_otp']: e.target.value })}
                              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const code = orderNotes[order.id + '_account_otp']?.trim();
                                if (!code) {
                                  showToast({ type: 'error', title: 'تنبيه', description: 'يرجى كتابة رمز التحقق أولاً' });
                                  return;
                                }
                                sendSupplierReplyToClient(order.id, code);
                              }}
                              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shrink-0 cursor-pointer"
                            >
                              <Send className="w-4 h-4" />
                              <span>إرسال رمز التحقق</span>
                            </button>
                          </div>

                          {order.deliveryDetails.supplierReplyMessage && (
                            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-400">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                <span>آخر رمز تحقق تم إرساله للعميل:</span>
                                <strong className="font-mono text-white text-sm bg-slate-900 px-3 py-1 rounded-lg border border-emerald-500/50 select-all tracking-wider">
                                  {order.deliveryDetails.supplierReplyMessage}
                                </strong>
                              </div>
                              <span className="text-[11px] text-emerald-300/90 font-medium">
                                تم إرساله ويظهر في شاشة العميل كإشعار الآن ✓
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Completion actions */}
                    {isPending && (
                      <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={currentNoteInput}
                            onChange={e => setOrderNotes({ ...orderNotes, [order.id]: e.target.value })}
                            placeholder="ملاحظة إتمام شحن الحساب للعميل..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                          />
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => completeSupplierOrder(order.id, currentNoteInput)}
                            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>تأكيد اكتمال شحن الحساب</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => rejectSupplierOrder(order.id, 'تعذر شحن الحساب وتمت استعادة الرصيد للمحفظة')}
                            className="px-3 py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs font-semibold transition-colors"
                          >
                            تعذر الشحن (استرداد)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

            {orders.filter(o => o.deliveryMethod === 'account_login').length === 0 && (
              <div className="py-12 text-center rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
                <Lock className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="font-bold text-white text-sm">لا توجد طلبات شحن عبر الحساب حالياً</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  عند قيام أي نقطة بيع بطلب خدمة بطريقة التسليم عبر الحساب ستظهر بيانات الدخول هنا لتسجيل الدخول وإرسال الرمز للعميل.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: DEPOSIT REQUESTS REVIEW (User's requirement) */}
      {subTab === 'deposits' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">
                مراجعة طلبات شحن الرصيد المسبق (مراجعة طلبات الإيداع)
              </h2>
              <p className="text-xs text-slate-400">
                قم بمطابقة رقم الحوالة واسم المحول والحساب المحوّل إليه، ومتابعة تأكيد استلام الحوالة من نقطة البيع المخوّلة إن وُجدت، ثم اعتمد شحن المحفظة.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setDepositFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                  depositFilter === 'all'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                الكل ({supplierDepositRequests.length})
              </button>
              <button
                type="button"
                onClick={() => setDepositFilter('pending')}
                className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                  depositFilter === 'pending'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                بانتظار المراجعة ({pendingDeposits.length})
              </button>
              <button
                type="button"
                onClick={() => setDepositFilter('delegated')}
                className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                  depositFilter === 'delegated'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                حوالات عبر نقاط البيع ({delegatedDepositsCount})
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {filteredSupplierDeposits.length === 0 ? (
              <div className="p-8 text-center rounded-3xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
                لا توجد طلبات شحن أو إيداع مطابقة للفلتر المحدد حالياً.
              </div>
            ) : (
              filteredSupplierDeposits.map(dep => {
                const isPending = dep.status === 'pending';
                const isRejected = dep.status === 'rejected';
                const hasTargetBank = Boolean(dep.targetBankName || dep.targetAccountHolderName);
                const hasReceiverRouting = Boolean(dep.receiverConfirmationStatus || dep.receiverPosId || dep.receiverEmployeeId);
                const isEmployeeReceiver = Boolean(dep.receiverEmployeeId);
                const receiverRoleLabel = isEmployeeReceiver ? 'موظف استلام الحوالات المخوّل' : 'نقطة البيع المخوّلة';
                const canConfirmAsEmployee =
                  isPending &&
                  isEmployeeReceiver &&
                  dep.receiverConfirmationStatus === 'pending' &&
                  role === 'employee' &&
                  (!dep.receiverEmployeeId || !currentUser?.employeeId || dep.receiverEmployeeId === currentUser.employeeId);

                return (
                  <div
                    key={dep.id}
                    className={`p-4 sm:p-5 rounded-3xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs ${
                      isPending
                        ? 'bg-slate-900 border-amber-500/40 shadow-lg'
                        : 'bg-slate-950/70 border-slate-800'
                    }`}
                  >
                    <div className="space-y-2.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-amber-400">#{dep.id}</span>
                        <span className="text-slate-400">·</span>
                        <span className="font-bold text-white text-sm">{dep.posName}</span>
                        <span className="font-mono text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          {dep.posCode}
                        </span>
                        {dep.requestType === 'loan' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                            طلب سلفة رصيد آجل (بدون إيصال)
                          </span>
                        )}
                        {isPending ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            {dep.requestType === 'loan' ? 'بانتظار موافقة السلفة' : 'بانتظار مطابقة الحوالة'}
                          </span>
                        ) : isRejected ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            مرفوض
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            {dep.requestType === 'loan' ? 'سلفة معتمدة ✓' : 'معتمد ومودع ✓'}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-300 pt-1">
                        <div>
                          <span className="text-[10px] text-slate-500 block">رقم الحوالة البنكية:</span>
                          <strong className="font-mono text-white text-xs">
                            <bdi dir="ltr">{dep.transferNumber}</bdi>
                          </strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">اسم المحول:</span>
                          <strong className="text-white text-xs">{dep.transferSenderName}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">البنك المحول منه:</span>
                          <span className="text-slate-300 text-xs">{dep.bankName}</span>
                        </div>
                      </div>

                      {/* Attached Receipt Image Preview if present */}
                      {dep.transferReceiptImage && (
                        <div className="flex items-center gap-3 p-2.5 px-3 rounded-2xl bg-slate-950 border border-amber-500/30">
                          <button
                            type="button"
                            onClick={() => setViewingReceiptDeposit(dep)}
                            className="relative group shrink-0 cursor-pointer"
                            title="انقر لتكبير صورة الإيصال"
                          >
                            <img
                              src={dep.transferReceiptImage}
                              alt="إيصال الحوالة"
                              className="w-11 h-11 rounded-xl object-cover border border-slate-700 group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Eye className="w-4 h-4 text-white" />
                            </div>
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                              <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                              <span>صورة إيصال الحوالة المرفقة</span>
                            </div>
                            <p className="text-[10.5px] text-slate-400 truncate">
                              {dep.transferReceiptFileName || 'receipt.jpg'} · انقر على الصورة أو زر العرض للتحقق والتكبير
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setViewingReceiptDeposit(dep)}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>عرض الإيصال</span>
                          </button>
                        </div>
                      )}

                      {/* Destination Bank Account Details */}
                      {hasTargetBank && (
                        <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <Landmark className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="text-slate-400">الحساب البنكي المحوّل إليه:</span>
                            <strong className="text-amber-300">{dep.targetBankName}</strong>
                            {dep.targetBankAccountCountry && (
                              <>
                                <span className="text-slate-600">·</span>
                                <span className="text-slate-300 flex items-center gap-1">
                                  <Globe className="w-3 h-3 text-slate-500" />
                                  <span>{dep.targetBankAccountCountry}</span>
                                </span>
                              </>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-300">
                            {dep.targetAccountHolderName && (
                              <span>
                                صاحب الحساب: <strong className="text-white">{dep.targetAccountHolderName}</strong>
                              </span>
                            )}
                            {dep.targetAccountHolderEmail && (
                              <span className="font-mono text-slate-400">
                                <bdi dir="ltr">{dep.targetAccountHolderEmail}</bdi>
                              </span>
                            )}
                            {(dep.targetBankAccountNumber || dep.targetIban) && (
                              <span className="font-mono text-cyan-300">
                                <bdi dir="ltr">{dep.targetBankAccountNumber || dep.targetIban}</bdi>
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Authorized Receiver Confirmation Status */}
                      {hasReceiverRouting && (
                        <div
                          className={`p-3 rounded-2xl border space-y-2 ${
                            dep.receiverConfirmationStatus === 'confirmed'
                              ? 'bg-emerald-950/30 border-emerald-500/40'
                              : dep.receiverConfirmationStatus === 'rejected'
                              ? 'bg-rose-950/30 border-rose-500/40'
                              : 'bg-amber-950/20 border-amber-500/30'
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2 font-bold">
                            {dep.receiverConfirmationStatus === 'confirmed' ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                <span className="text-emerald-300">
                                  تم تأكيد استلام الحوالة من {receiverRoleLabel} ({dep.receiverConfirmedByName || dep.receiverPosName})
                                </span>
                                {dep.receiverConfirmedAt && (
                                  <span className="font-mono text-[10px] text-emerald-200/80">
                                    · {dep.receiverConfirmedAt}
                                  </span>
                                )}
                              </>
                            ) : dep.receiverConfirmationStatus === 'rejected' ? (
                              <>
                                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                                <span className="text-rose-300">
                                  تنبيه: أفاد {receiverRoleLabel} ({dep.receiverConfirmedByName || dep.receiverPosName}) بعدم استلام الحوالة
                                </span>
                                {dep.receiverConfirmedAt && (
                                  <span className="font-mono text-[10px] text-rose-200/80">
                                    · {dep.receiverConfirmedAt}
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                                <span className="text-amber-300">
                                  بانتظار تأكيد استلام الحوالة من {receiverRoleLabel} ({dep.receiverPosName || dep.targetAccountHolderName})
                                </span>
                              </>
                            )}
                          </div>

                          {dep.receiverConfirmationNote && (
                            <div className="text-[11px] text-slate-200 pr-6">
                              ملاحظة المستلم: <span className="font-semibold">{dep.receiverConfirmationNote}</span>
                            </div>
                          )}

                          {canConfirmAsEmployee && (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => confirmDepositReceiptByReceiver(dep.id, 'confirmed')}
                                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>تأكيد استلام الحوالة (كـ مستلم)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => confirmDepositReceiptByReceiver(dep.id, 'rejected')}
                                className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>لم يتم استلام الحوالة</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                      <div className="text-right lg:text-left">
                        <span className="text-[10px] text-slate-400 block">المبلغ المطلوب:</span>
                        <span className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                          {dep.amount.toFixed(2)} ر.س
                        </span>
                      </div>

                      {isPending && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => approveDepositRequest(dep.id)}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>تأكيد الحوالة وإيداع</span>
                          </button>

                          <button
                            onClick={() => rejectDepositRequest(dep.id)}
                            className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>رفض</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SUBTAB FOR LOANS & CREDIT REGISTRY */}
      {subTab === 'loans' && (
        <LoansRegistryView filterSupplierId={supplier.id} />
      )}

      {/* SUBTAB FOR BANK ACCOUNTS & TRANSFER DELEGATION */}
      {subTab === 'bank_accounts' && (
        <BankAccountsView />
      )}

      {/* SUBTAB 4: VOUCHER WAREHOUSES BY CATEGORY */}
      {subTab === 'vouchers' && (
        <VoucherWarehousesView />
      )}

      {/* SUBTAB 5: POS CLIENTS & TIER UPGRADE (User's requirement) */}
      {subTab === 'clients' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">إدارة العملاء والوكلاء وترقية الرتب</h2>
              <p className="text-xs text-slate-400">
                يمكن للمتجر ترقية رتبة العميل فوراً إلى (نحاسي أو فضي أو ذهبي أو مميز) لتغيير أسعار المتجر لديه فورياً.
              </p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-3 py-1.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 text-xs font-bold flex items-center gap-1"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>إرسال رابط تسجيل برتبة محددة</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {posClients.map(client => {
              const currentTier = TIERS_CONFIG[client.tier];

              return (
                <div key={client.id} className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-base text-white">{client.tradeName}</h3>
                      <div className="text-slate-400 mt-0.5">
                        المالك: <strong className="text-slate-200">{client.ownerName}</strong> · {client.phone}
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5">
                        {client.country} · {client.city}
                      </div>
                    </div>

                    <div className="text-left font-mono">
                      <span className="text-[10px] text-slate-500 block">المعرّف الرسمي</span>
                      <strong className="text-amber-300 font-bold text-xs">{client.posCode}</strong>
                    </div>
                  </div>

                  {/* Financial stats */}
                  <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-slate-950 border border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400 block">رصيد محفظة العميل</span>
                      <strong className="text-white font-mono tabular-nums text-sm">
                        {client.walletBalance.toFixed(2)} ر.س
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">إجمالي مشتريات العميل</span>
                      <strong className="text-amber-400 font-mono tabular-nums text-sm">
                        {client.totalSpent.toFixed(2)} ر.س
                      </strong>
                    </div>
                  </div>

                  {/* Tier selector & Account Features (Tier + Features co-located) */}
                  <div className="space-y-3 pt-1">
                    {/* Tier selector */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-semibold text-slate-300">
                        رتبة الحساب (تعديل الرتبة وتأثيرها على الأسعار):
                      </label>
                      <div className="grid grid-cols-5 gap-1 text-center">
                        {(Object.keys(TIERS_CONFIG) as AccountTier[]).map(tKey => {
                          const t = TIERS_CONFIG[tKey];
                          const isSelected = client.tier === tKey;

                          return (
                            <button
                              key={tKey}
                              type="button"
                              onClick={() => updatePosTier(client.id, tKey)}
                              className={`py-1.5 px-1 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              {t.nameAr}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Account Features section */}
                    <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 border-b border-slate-800/80 pb-1.5">
                        <Check className="w-3.5 h-3.5 text-amber-400" />
                        <span>ميزات الحساب المخصصة:</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Loan Request Privilege */}
                        <button
                          type="button"
                          onClick={() => togglePosLoanPrivilege(client.id)}
                          className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                            client.canRequestLoans
                              ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/25'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <HandCoins className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span className="truncate text-[11px]">ميزة طلب السلفة</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] shrink-0 font-mono ${
                            client.canRequestLoans ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-500'
                          }`}>
                            {client.canRequestLoans ? 'مفعلة ✓' : 'مقفلة'}
                          </span>
                        </button>

                        {/* Receive Supplier Transfers Privilege */}
                        <button
                          type="button"
                          onClick={() => togglePosReceiveTransfersPrivilege(client.id)}
                          className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                            client.canReceiveSupplierTransfers
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Landmark className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate text-[11px]">استلام حوالات المتجر</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] shrink-0 font-mono ${
                            client.canReceiveSupplierTransfers ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-500'
                          }`}>
                            {client.canReceiveSupplierTransfers ? 'مفعلة ✓' : 'مقفلة'}
                          </span>
                        </button>

                        {/* Bonus Privilege */}
                        <button
                          type="button"
                          onClick={() => togglePosBonusPrivilege(client.id)}
                          className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                            client.canGetBonus
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="truncate text-[11px]">ميزة الحصول على بونص</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] shrink-0 font-mono ${
                            client.canGetBonus ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-500'
                          }`}>
                            {client.canGetBonus ? 'مفعلة ✓' : 'مقفلة'}
                          </span>
                        </button>

                        {/* Gifts & Free Offers Privilege */}
                        <button
                          type="button"
                          onClick={() => togglePosGiftsPrivilege(client.id)}
                          className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                            client.canViewGifts
                              ? 'bg-purple-500/15 text-purple-300 border-purple-500/40 hover:bg-purple-500/25'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Gift className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            <span className="truncate text-[11px]">الهدايا والعروض المجانية</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] shrink-0 font-mono ${
                            client.canViewGifts ? 'bg-purple-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-500'
                          }`}>
                            {client.canViewGifts ? 'مفعلة ✓' : 'مقفلة'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB: OFFICE EMPLOYEES & PERMISSIONS */}
      {subTab === 'employees' && (
        <OfficeEmployeesView employees={supplier.employees} />
      )}

      {/* SUBTAB 6: CLIENT STATEMENTS & DEPOSITS & PURCHASES (User's requirement: كشف حساب للعملاء ومشترياتهم وايداعاتهم) */}
      {subTab === 'client_statements' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">كشف حساب العملاء ومشترياتهم وإيداعاتهم</h2>
              <p className="text-xs text-slate-400">استعراض ومتابعة حركات كل نقطة بيع، المشتريات، الإيداعات، وطباعتها.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedPosForStatement}
                onChange={e => setSelectedPosForStatement(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
              >
                <option value="all">كل العملاء</option>
                {posClients.map(c => <option key={c.id} value={c.id}>{c.tradeName}</option>)}
              </select>

              <select
                value={selectedServiceForStatement}
                onChange={e => setSelectedServiceForStatement(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
              >
                <option value="all">كل الخدمات</option>
                {Array.from(new Set(accountingEntries.map(e => e.serviceName).filter(Boolean))).map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <select
                value={selectedTypeForStatement}
                onChange={e => setSelectedTypeForStatement(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
              >
                <option value="all">كل الحركات (نوع الحركة)</option>
                {statementTypeOptions.map(opt => (
                  <option key={opt.id} value={opt.value}>{opt.labelAr}</option>
                ))}
              </select>

              <input type="date" dir="ltr" value={startDateForStatement} onChange={e => setStartDateForStatement(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white" />
              <input type="date" dir="ltr" value={endDateForStatement} onChange={e => setEndDateForStatement(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white" />

              <button
                type="button"
                disabled={isExportingPdf}
                onClick={() => handleExportPDF('preview')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold disabled:opacity-60"
              >
                {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Eye className="w-4 h-4 text-amber-400" />}
                <span>عرض ومعاينة PDF</span>
              </button>

              <button
                type="button"
                disabled={isExportingPdf}
                onClick={() => handleExportPDF('download')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 text-xs font-bold disabled:opacity-60"
              >
                {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>تحميل PDF</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">عدد القيود المعروضة</span>
              <span className="text-base font-bold font-mono text-white tabular-nums">{supplierStatementTotals.count}</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">إجمالي المدين</span>
              <span className="text-base font-bold font-mono text-rose-400 tabular-nums">-{supplierStatementTotals.totalDebit.toFixed(2)} ر.س</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">إجمالي الدائن</span>
              <span className="text-base font-bold font-mono text-emerald-400 tabular-nums">+{supplierStatementTotals.totalCredit.toFixed(2)} ر.س</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-slate-400 block text-[10px]">رصيد المتجر</span>
              <span className="text-base font-bold font-mono text-amber-400 tabular-nums">{supplier.walletBalance.toFixed(2)} ر.س</span>
            </div>
          </div>

          <div id="supplier-statement-table-to-export" className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold">
                  <tr>
                    <th className="py-3 px-3">التاريخ</th>
                    <th className="py-3 px-3">العميل</th>
                    <th className="py-3 px-3">البيان</th>
                    <th className="py-3 px-3 text-left">مدين</th>
                    <th className="py-3 px-3 text-left">دائن</th>
                    <th className="py-3 px-3 text-left">الرصيد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium font-mono">
                  {supplierFilteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                        لا توجد قيود مطابقة للفلاتر المحددة حالياً.
                      </td>
                    </tr>
                  ) : (
                    supplierFilteredEntries.map(entry => {
                      const client = posClients.find(p => p.id === entry.posId);
                      return (
                        <tr key={entry.id} className="hover:bg-slate-950/40">
                          <td className="py-2.5 px-3 text-slate-400">{entry.date}</td>
                          <td className="py-2.5 px-3 text-amber-400 font-sans">{client?.tradeName || 'عميل'}</td>
                          <td className="py-2.5 px-3 text-white font-sans">{entry.description}</td>
                          <td className="py-2.5 px-3 text-left text-rose-400">{entry.debit > 0 ? `-${entry.debit.toFixed(2)}` : '-'}</td>
                          <td className="py-2.5 px-3 text-left text-emerald-400">{entry.credit > 0 ? `+${entry.credit.toFixed(2)}` : '-'}</td>
                          <td className="py-2.5 px-3 text-left text-white font-bold">{entry.balanceAfter.toFixed(2)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB: SUPPLIER NOTIFICATIONS */}
      {subTab === 'notifications' && (
        <SupplierNotificationsView onNavigateTab={(tab) => setSubTab(tab as any)} />
      )}

      {/* Add Service Modal */}
      {showAddService && (
        <AddServiceModal onClose={() => setShowAddService(false)} />
      )}

      {/* Invite Link Modal */}
      {showInviteModal && (
        <InviteLinkModal onClose={() => setShowInviteModal(false)} />
      )}

      {/* Add Catalog Modal */}
      {showAddCatalog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 text-slate-100">
            <h3 className="font-bold text-base text-white">إضافة كاتالوج جديد</h3>
            <form onSubmit={handleCreateCatalog} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">اسم الكاتالوج:</label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  placeholder="مثال: شحن تطبيقات الذكاء الاصطناعي والسوشيال"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">وصف الكاتالوج:</label>
                <input
                  type="text"
                  value={newCatDesc}
                  onChange={e => setNewCatDesc(e.target.value)}
                  placeholder="وصف مختصر للخدمات التابعة لهذا الكاتالوج"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <label className={`p-3 rounded-2xl border flex items-start gap-2.5 cursor-pointer transition-colors ${
                newCatIsFreeGift
                  ? 'bg-purple-500/15 border-purple-500/50 text-purple-200'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}>
                <input
                  type="checkbox"
                  checked={newCatIsFreeGift}
                  onChange={e => setNewCatIsFreeGift(e.target.checked)}
                  className="mt-1 rounded border-slate-600 bg-slate-900 text-purple-500 focus:ring-purple-500"
                />
                <div className="flex-1 text-xs space-y-0.5">
                  <div className="font-bold flex items-center gap-1.5 text-white">
                    <Gift className="w-3.5 h-3.5 text-purple-400" />
                    <span>تعيين ككتالوج الهدايا المجانية</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    الخدمات داخل هذا الكاتالوج تصبح بسعر 0.00 ر.س للعملاء أصحاب ميزة الهدايا المجانية.
                  </p>
                </div>
              </label>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
                >
                  إضافة الكاتالوج
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewCatIsFreeGift(false);
                    setShowAddCatalog(false);
                  }}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Supplier Profile Modal */}
      {showEditProfileModal && (
        <EditSupplierProfileModal
          initialSection={editProfileSection}
          onClose={() => setShowEditProfileModal(false)}
        />
      )}

      <PdfPreviewModal
        pdfResult={pdfPreview}
        onClose={() => setPdfPreview(null)}
      />

      {/* Transfer Receipt Image Viewer Modal */}
      <ReceiptImageModal
        isOpen={Boolean(viewingReceiptDeposit)}
        onClose={() => setViewingReceiptDeposit(null)}
        imageUrl={viewingReceiptDeposit?.transferReceiptImage}
        title={`معاينة إيصال الحوالة - طلب #${viewingReceiptDeposit?.id || ''}`}
        transferNumber={viewingReceiptDeposit?.transferNumber}
        amount={viewingReceiptDeposit?.amount}
        senderName={viewingReceiptDeposit?.transferSenderName}
        bankName={viewingReceiptDeposit?.bankName}
        date={viewingReceiptDeposit?.date}
        posName={viewingReceiptDeposit?.posName}
        posCode={viewingReceiptDeposit?.posCode}
      />

      {/* Edit Catalog Modal */}
      {editingCatalog && (
        <EditCatalogModal
          catalog={editingCatalog}
          onClose={() => setEditingCatalog(null)}
        />
      )}

      {/* Edit Service Modal */}
      {editingService && (
        <EditServiceModal
          service={editingService}
          onClose={() => setEditingService(null)}
        />
      )}

    </div>
  );
};
