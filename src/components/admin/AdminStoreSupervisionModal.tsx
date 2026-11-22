import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  AccountTier,
  DeliveryMethod,
  DepositRequest,
  Order,
  Supplier,
  TIERS_CONFIG,
} from '../../types';
import {
  computeStoreSupervisionMetrics,
  filterStoreAccountingEntriesForAdmin,
  filterStoreClientsForAdmin,
  filterStoreOrdersForAdmin,
  getClientLoanSummaryForStore,
  isSupplierActive,
} from '../../utils/storeSupervision';
import {
  EMPLOYEE_PERMISSION_BADGES,
  normalizeEmployeePermissions,
} from '../../utils/employeePermissions';
import {
  getLoanPaidAmount,
  getLoanRemainingAmount,
  isLoanDeposit,
} from '../../utils/loanRepayments';
import {
  computeLedgerTotals,
  formatCurrencySar,
  GeneratedPdfResult,
  generateStatementPdf,
  PdfBadgeTone,
  PdfStatementRow,
} from '../../utils/pdfStatement';
import { PdfPreviewModal } from '../common/PdfPreviewModal';
import { ReceiptImageModal } from '../common/ReceiptImageModal';
import { SupplierContactLinks } from '../common/SupplierContactLinks';
import {
  Activity,
  Archive,
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Download,
  Edit3,
  Eye,
  FileText,
  Gamepad2,
  Gift,
  HandCoins,
  Headphones,
  Image as ImageIcon,
  Landmark,
  Layers,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Package,
  Percent,
  Phone,
  Power,
  Receipt,
  Save,
  Search,
  ShieldCheck,
  Store,
  Ticket,
  UserCheck,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';

export type StoreSupervisionTab =
  | 'overview'
  | 'profile'
  | 'clients'
  | 'activity'
  | 'services';

interface AdminStoreSupervisionModalProps {
  supplier: Supplier;
  initialTab?: StoreSupervisionTab;
  onClose: () => void;
}

export const AdminStoreSupervisionModal: React.FC<AdminStoreSupervisionModalProps> = ({
  supplier: propSupplier,
  initialTab = 'overview',
  onClose,
}) => {
  const {
    suppliers,
    posClients,
    orders,
    depositRequests,
    loanRepaymentRequests,
    accountingEntries,
    adminAccountingEntries,
    services,
    voucherWarehouses,
    catalogs,
    supplierBankAccounts,
    adminUpdateSupplier,
    toggleSupplierActiveStatus,
    activeCurrency,
    activeExchangeRate,
    currencyLabel,
    convertFromSar,
    convertToSar,
    formatCurrency,
    showToast,
  } = useApp();

  // Always resolve the freshest store record from context
  const store = useMemo(
    () => suppliers.find((s) => s.id === propSupplier.id) || propSupplier,
    [suppliers, propSupplier]
  );

  const isActive = isSupplierActive(store);

  const [activeTab, setActiveTab] = useState<StoreSupervisionTab>(initialTab);
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, store.id]);

  // Metrics & scoped store data
  const metrics = useMemo(
    () =>
      computeStoreSupervisionMetrics({
        supplier: store,
        posClients,
        orders,
        depositRequests,
        loanRepaymentRequests,
        accountingEntries,
        adminAccountingEntries,
        services,
        voucherWarehouses,
        catalogs,
        supplierBankAccounts,
      }),
    [
      store,
      posClients,
      orders,
      depositRequests,
      loanRepaymentRequests,
      accountingEntries,
      adminAccountingEntries,
      services,
      voucherWarehouses,
      catalogs,
      supplierBankAccounts,
    ]
  );

  const storeBankAccounts = useMemo(
    () => supplierBankAccounts.filter((b) => b.supplierId === store.id),
    [supplierBankAccounts, store.id]
  );

  const storeRepayments = useMemo(
    () =>
      loanRepaymentRequests
        .filter((r) => r.supplierId === store.id)
        .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [loanRepaymentRequests, store.id]
  );

  // ==================== Profile Edit Form State ====================
  const [editName, setEditName] = useState(store.name || '');
  const [editStoreName, setEditStoreName] = useState(store.storeName || '');
  const [editEmail, setEditEmail] = useState(store.email || '');
  const [editPhone, setEditPhone] = useState(store.phone || '');
  const [editCountry, setEditCountry] = useState(store.country || '');
  const [editCity, setEditCity] = useState(store.city || '');
  const [editLogoUrl, setEditLogoUrl] = useState(store.logoUrl || '');
  const [editExchangeRate, setEditExchangeRate] = useState<string>(
    String(store.exchangeRateSarPerUsd ?? 3.75)
  );
  const [editBankName, setEditBankName] = useState(store.bankAccountDetails?.bankName || '');
  const [editAccountHolder, setEditAccountHolder] = useState(
    store.bankAccountDetails?.accountHolder || ''
  );
  const [editIban, setEditIban] = useState(store.bankAccountDetails?.iban || '');
  const [editAccountNumber, setEditAccountNumber] = useState(
    store.bankAccountDetails?.accountNumber || ''
  );
  const [editFeeType, setEditFeeType] = useState<'percentage' | 'fixed' | 'both'>(
    store.feeType || 'percentage'
  );
  const [editFeePercentage, setEditFeePercentage] = useState<number>(store.feePercentage ?? 1);
  const [editFixedFeeDisplay, setEditFixedFeeDisplay] = useState<string>(() =>
    String(Number(convertFromSar(store.fixedFeeAmount ?? 0).toFixed(2)))
  );
  const [isEditFixedFeeDirty, setIsEditFixedFeeDirty] = useState(false);
  const [editWhatsapp, setEditWhatsapp] = useState(store.socialLinks?.whatsapp || '');
  const [editTelegram, setEditTelegram] = useState(store.socialLinks?.telegram || '');
  const [editInstagram, setEditInstagram] = useState(store.socialLinks?.instagram || '');
  const [editWebsite, setEditWebsite] = useState(store.socialLinks?.website || '');
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    setEditName(store.name || '');
    setEditStoreName(store.storeName || '');
    setEditEmail(store.email || '');
    setEditPhone(store.phone || '');
    setEditCountry(store.country || '');
    setEditCity(store.city || '');
    setEditLogoUrl(store.logoUrl || '');
    setEditExchangeRate(String(store.exchangeRateSarPerUsd ?? 3.75));
    setEditBankName(store.bankAccountDetails?.bankName || '');
    setEditAccountHolder(store.bankAccountDetails?.accountHolder || '');
    setEditIban(store.bankAccountDetails?.iban || '');
    setEditAccountNumber(store.bankAccountDetails?.accountNumber || '');
    setEditFeeType(store.feeType || 'percentage');
    setEditFeePercentage(store.feePercentage ?? 1);
    setEditFixedFeeDisplay(String(Number(convertFromSar(store.fixedFeeAmount ?? 0).toFixed(2))));
    setIsEditFixedFeeDirty(false);
    setEditWhatsapp(store.socialLinks?.whatsapp || '');
    setEditTelegram(store.socialLinks?.telegram || '');
    setEditInstagram(store.socialLinks?.instagram || '');
    setEditWebsite(store.socialLinks?.website || '');
    setProfileError(null);
  }, [store, activeCurrency, activeExchangeRate]);

  const handleSaveStoreProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);

    const fixedFeeSar = isEditFixedFeeDirty
      ? convertToSar(Math.max(0, Number(editFixedFeeDisplay) || 0))
      : store.fixedFeeAmount ?? 0;

    const result = adminUpdateSupplier(store.id, {
      name: editName,
      storeName: editStoreName,
      email: editEmail,
      phone: editPhone,
      country: editCountry,
      city: editCity,
      logoUrl: editLogoUrl.trim() || undefined,
      exchangeRateSarPerUsd: Number(editExchangeRate) || 3.75,
      feeType: editFeeType,
      feePercentage: Number(editFeePercentage) || 0,
      fixedFeeAmount: fixedFeeSar,
      bankAccountDetails: {
        bankName: editBankName.trim(),
        accountHolder: editAccountHolder.trim(),
        iban: editIban.trim(),
        accountNumber: editAccountNumber.trim(),
      },
      socialLinks: {
        ...store.socialLinks,
        whatsapp: editWhatsapp.trim(),
        telegram: editTelegram.trim(),
        instagram: editInstagram.trim(),
        website: editWebsite.trim(),
      },
    });

    if (!result.success) {
      setProfileError(result.error || 'تعذر حفظ بيانات المتجر.');
    } else {
      setIsEditFixedFeeDirty(false);
    }
  };

  // ==================== Clients Tab State ====================
  const [clientSearch, setClientSearch] = useState('');
  const [clientTierFilter, setClientTierFilter] = useState<AccountTier | 'all'>('all');

  const filteredClients = useMemo(
    () => filterStoreClientsForAdmin(metrics.storeClients, clientSearch, clientTierFilter),
    [metrics.storeClients, clientSearch, clientTierFilter]
  );

  // ==================== Activity Tab State ====================
  const [activitySubTab, setActivitySubTab] = useState<'orders' | 'deposits_loans' | 'ledger'>(
    'orders'
  );
  const [activityClientId, setActivityClientId] = useState<string>('all');
  const [activityQuery, setActivityQuery] = useState('');
  const [activityDateFrom, setActivityDateFrom] = useState('');
  const [activityDateTo, setActivityDateTo] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | Order['status']>('all');
  const [orderMethodFilter, setOrderMethodFilter] = useState<'all' | DeliveryMethod>('all');
  const [depositKindFilter, setDepositKindFilter] = useState<'all' | 'cash' | 'loan'>('all');
  const [viewingReceiptDeposit, setViewingReceiptDeposit] = useState<{
    imageUrl: string;
    title: string;
    transferNumber?: string;
    amount?: number;
    senderName?: string;
    bankName?: string;
    date?: string;
    posName?: string;
    posCode?: string;
  } | null>(null);

  // Reset activity filters when store changes
  useEffect(() => {
    setActivityClientId('all');
    setActivityQuery('');
    setActivityDateFrom('');
    setActivityDateTo('');
    setOrderStatusFilter('all');
    setOrderMethodFilter('all');
    setDepositKindFilter('all');
  }, [store.id]);

  const filteredOrders = useMemo(
    () =>
      filterStoreOrdersForAdmin(metrics.storeOrders, {
        clientId: activityClientId,
        status: orderStatusFilter,
        deliveryMethod: orderMethodFilter,
        dateFrom: activityDateFrom,
        dateTo: activityDateTo,
        query: activityQuery,
      }),
    [
      metrics.storeOrders,
      activityClientId,
      orderStatusFilter,
      orderMethodFilter,
      activityDateFrom,
      activityDateTo,
      activityQuery,
    ]
  );

  const filteredDepositsAndLoans = useMemo(() => {
    const q = activityQuery.trim().toLowerCase();
    return [...metrics.storeDeposits, ...metrics.storeLoans]
      .filter((d) => {
        if (activityClientId !== 'all' && d.posId !== activityClientId) return false;
        const isLoan = isLoanDeposit(d);
        if (depositKindFilter === 'cash' && isLoan) return false;
        if (depositKindFilter === 'loan' && !isLoan) return false;
        const dDate = (d.date || '').substring(0, 10);
        if (activityDateFrom && dDate < activityDateFrom) return false;
        if (activityDateTo && dDate > activityDateTo) return false;
        if (!q) return true;
        return [
          d.id,
          d.posName,
          d.posCode,
          d.transferNumber,
          d.transferSenderName,
          d.bankName,
          d.loanReason,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [
    metrics.storeDeposits,
    metrics.storeLoans,
    activityClientId,
    depositKindFilter,
    activityDateFrom,
    activityDateTo,
    activityQuery,
  ]);

  const filteredAccountingEntries = useMemo(
    () =>
      filterStoreAccountingEntriesForAdmin(metrics.storeAccountingEntries, {
        clientId: activityClientId,
        dateFrom: activityDateFrom,
        dateTo: activityDateTo,
        query: activityQuery,
      }).sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [
      metrics.storeAccountingEntries,
      activityClientId,
      activityDateFrom,
      activityDateTo,
      activityQuery,
    ]
  );

  // ==================== PDF Export for Store Activity ====================
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<GeneratedPdfResult | null>(null);

  useEffect(() => {
    return () => {
      if (pdfPreview?.blobUrl) {
        URL.revokeObjectURL(pdfPreview.blobUrl);
      }
    };
  }, [pdfPreview]);

  const handleExportStoreActivityPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
      const { totalDebit, totalCredit } = computeLedgerTotals(filteredAccountingEntries);

      const rows: PdfStatementRow[] = filteredAccountingEntries.map((entry) => {
        const badgeMap: Record<string, { label: string; tone: PdfBadgeTone }> = {
          purchase: { label: 'شراء خدمة', tone: 'rose' },
          sale: { label: 'مبيعات', tone: 'emerald' },
          deposit: { label: 'إيداع / سلفة', tone: 'cyan' },
          transfer_out: { label: 'تحويل صادر', tone: 'amber' },
          transfer_in: { label: 'تحويل وارد', tone: 'purple' },
          fee: { label: 'رسوم منصة', tone: 'slate' },
        };
        const badgeInfo = badgeMap[entry.type] || { label: entry.type, tone: 'slate' as PdfBadgeTone };
        const matchedClient = metrics.storeClients.find((c) => c.id === entry.posId);

        return {
          id: entry.id,
          cells: {
            date: { text: entry.date, ltr: true },
            type: { text: badgeInfo.label, badge: badgeInfo.label, badgeTone: badgeInfo.tone },
            ref: { text: `#${entry.referenceId}`, mono: true },
            client: {
              text: matchedClient ? matchedClient.tradeName : entry.customerName || 'المتجر',
              subtext: matchedClient?.posCode,
            },
            description: {
              text: entry.description,
              subtext: entry.serviceName || undefined,
            },
            debit: {
              text:
                entry.debit > 0
                  ? formatCurrencySar(entry.debit, 'debit', activeCurrency, activeExchangeRate)
                  : '-',
              tone: entry.debit > 0 ? 'debit' : 'neutral',
            },
            credit: {
              text:
                entry.credit > 0
                  ? formatCurrencySar(entry.credit, 'credit', activeCurrency, activeExchangeRate)
                  : '-',
              tone: entry.credit > 0 ? 'credit' : 'neutral',
            },
            balance: {
              text: formatCurrencySar(entry.balanceAfter, 'neutral', activeCurrency, activeExchangeRate),
              tone: 'bold',
            },
          },
        };
      });

      const result = await generateStatementPdf({
        title: `تقرير إشراف وحركة متجر: ${store.storeName}`,
        subtitle: `مالك المتجر: ${store.name} · ${store.email} · ${store.phone}`,
        portalLabel: 'إشراف مدير التطبيق على المتاجر',
        entityName: store.storeName,
        entityCode: store.id,
        generatedAt: nowStr,
        filterSummary: `عدد العملاء: ${metrics.clientsCount} · الطلبات: ${metrics.ordersCount} · القيود المعروضة: ${filteredAccountingEntries.length}`,
        kpis: [
          {
            label: 'رصيد محفظة المتجر',
            value: formatCurrency(store.walletBalance, { withGrouping: true }),
            tone: 'credit',
          },
          {
            label: 'مبيعات الطلبات المكتملة',
            value: formatCurrency(metrics.totalCompletedSalesVolume, { withGrouping: true }),
            tone: 'accent',
          },
          {
            label: 'رسوم المنصة من المتجر',
            value: formatCurrency(metrics.totalPlatformFeesEarned, { withGrouping: true }),
            tone: 'credit',
          },
          {
            label: 'السلف المتبقية على العملاء',
            value: formatCurrency(metrics.totalLoansRemainingAmount, { withGrouping: true }),
            tone: 'debit',
          },
        ],
        columns: [
          { key: 'date', label: 'التاريخ', width: '13%', mono: true, nowrap: true },
          { key: 'type', label: 'النوع', width: '11%' },
          { key: 'ref', label: 'المرجع', width: '11%', mono: true },
          { key: 'client', label: 'العميل / الطرف', width: '15%' },
          { key: 'description', label: 'البيان', width: '24%' },
          { key: 'debit', label: 'مدين', width: '9%', align: 'left', mono: true },
          { key: 'credit', label: 'دائن', width: '9%', align: 'left', mono: true },
          { key: 'balance', label: 'الرصيد', width: '8%', align: 'left', mono: true },
        ],
        rows,
        footerSummary: {
          rowCountLabel: `${filteredAccountingEntries.length} قيد`,
          totalDebit: formatCurrencySar(totalDebit, 'debit', activeCurrency, activeExchangeRate),
          totalCredit: formatCurrencySar(totalCredit, 'credit', activeCurrency, activeExchangeRate),
          finalBalance: formatCurrency(store.walletBalance, { withGrouping: true }),
        },
        filename: `store-supervision-${store.id}-${nowStr.slice(0, 10)}.pdf`,
      });

      setPdfPreview(result);
    } catch (err) {
      console.error('Failed to generate store PDF:', err);
      showToast({
        type: 'error',
        title: 'تعذر إنشاء تقرير PDF',
        description: 'حدث خطأ أثناء تجهيز ملف التقرير، يرجى المحاولة مجدداً.',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleJumpToClientActivity = (posId: string) => {
    setActivityClientId(posId);
    setActivitySubTab('orders');
    setActiveTab('activity');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`إشراف وإدارة متجر ${store.storeName}`}
    >
      <div className="w-full max-w-6xl max-h-[94vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100 text-xs">
        {/* Modal Top Store Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center overflow-hidden shrink-0">
              {store.logoUrl ? (
                <img
                  src={store.logoUrl}
                  alt={store.storeName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Building2 className="w-7 h-7 text-purple-400" />
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white truncate">
                  {store.storeName}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {isActive ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>متجر نشط</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3" />
                      <span>موقوف من الإدارة</span>
                    </>
                  )}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 font-mono text-[10px]">
                  رسوم المنصة: {store.feePercentage}%{' '}
                  {store.fixedFeeAmount > 0 ? `+ ${formatCurrency(store.fixedFeeAmount)}` : ''}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                <span className="text-slate-200 font-semibold">المالك: {store.name}</span>
                <span>·</span>
                <span className="flex items-center gap-1 font-mono" dir="ltr">
                  <Mail className="w-3 h-3 text-slate-500" />
                  {store.email}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1 font-mono" dir="ltr">
                  <Phone className="w-3 h-3 text-slate-500" />
                  {store.phone || 'غير مسجل'}
                </span>
                {(store.country || store.city) && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      {[store.country, store.city].filter(Boolean).join(' · ')}
                    </span>
                  </>
                )}
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  انضم: {store.createdAt}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportStoreActivityPdf}
              disabled={isExportingPdf}
              className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              {isExportingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>تصدير تقرير الحركة PDF</span>
            </button>

            <button
              type="button"
              onClick={() => toggleSupplierActiveStatus(store.id)}
              className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition-colors cursor-pointer ${
                isActive
                  ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/30'
                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
              }`}
            >
              <Power className="w-4 h-4" />
              <span>{isActive ? 'إيقاف المتجر مؤقتاً' : 'إعادة تفعيل المتجر'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
              aria-label="إغلاق نافذة الإشراف"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Tab Bar */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-purple-500 text-slate-950 shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>نظرة عامة وملخص المتجر</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-purple-500 text-slate-950 shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>البيانات الشخصية والبنوك والموظفين</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('clients')}
            className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'clients'
                ? 'bg-purple-500 text-slate-950 shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>عملاء المتجر ({metrics.clientsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'activity'
                ? 'bg-purple-500 text-slate-950 shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>حركة المتجر ({metrics.ordersCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('services')}
            className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'services'
                ? 'bg-purple-500 text-slate-950 shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>الخدمات ومخازن الأكواد ({metrics.servicesCount})</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* 6 Financial & Operational KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-1">
                  <span className="text-[11px] text-emerald-300 font-semibold flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5" />
                    رصيد محفظة مبيعات المتجر
                  </span>
                  <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                    {formatCurrency(store.walletBalance, { withGrouping: true })}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    سعر الصرف بالمتجر: 1$ = {store.exchangeRateSarPerUsd ?? 3.75} ر.س
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-1">
                  <span className="text-[11px] text-amber-300 font-semibold flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5" />
                    إجمالي مبيعات الطلبات المكتملة
                  </span>
                  <div className="text-xl font-bold font-mono text-white tabular-nums">
                    {formatCurrency(metrics.totalCompletedSalesVolume, { withGrouping: true })}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    مكتمل: {metrics.completedOrdersCount} · قيد التنفيذ: {metrics.pendingOrdersCount} · ملغي: {metrics.failedOrdersCount}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-purple-500/30 space-y-1">
                  <span className="text-[11px] text-purple-300 font-semibold flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5" />
                    رسوم المنصة المحصّلة من المتجر
                  </span>
                  <div className="text-xl font-bold font-mono text-purple-300 tabular-nums">
                    {formatCurrency(metrics.totalPlatformFeesEarned, { withGrouping: true })}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    نسبة المتجر: {store.feePercentage}%{' '}
                    {store.fixedFeeAmount > 0 ? `+ ${formatCurrency(store.fixedFeeAmount)}` : ''}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-500/30 space-y-1">
                  <span className="text-[11px] text-cyan-300 font-semibold flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    عملاء المتجر وأرصدة محافظهم
                  </span>
                  <div className="text-xl font-bold font-mono text-cyan-300 tabular-nums">
                    {metrics.clientsCount} عميل
                  </div>
                  <p className="text-[10px] text-slate-400">
                    إجمالي أرصدة محافظ العملاء: {formatCurrency(metrics.totalClientWalletsBalance, { withGrouping: true })}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-300 font-semibold flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-emerald-400" />
                    الإيداعات النقدية المعتمدة بالمتجر
                  </span>
                  <div className="text-xl font-bold font-mono text-white tabular-nums">
                    {formatCurrency(metrics.approvedCashDepositsTotal, { withGrouping: true })}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    إجمالي الحوالات: {metrics.storeDeposits.length} · معلقة: {metrics.pendingCashDepositsCount}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-rose-500/20 space-y-1">
                  <span className="text-[11px] text-rose-300 font-semibold flex items-center gap-1.5">
                    <HandCoins className="w-3.5 h-3.5" />
                    السلف القائمة بالمتجر والمتبقي للتحصيل
                  </span>
                  <div className="text-xl font-bold font-mono text-rose-300 tabular-nums">
                    {formatCurrency(metrics.totalLoansRemainingAmount, { withGrouping: true })}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    سلف نشطة: {metrics.activeLoansCount} · الممنوح: {formatCurrency(metrics.totalLoansIssuedAmount)} · المسدد: {formatCurrency(metrics.totalLoansRepaidAmount)}
                  </p>
                </div>
              </div>

              {/* Structural Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <Store className="w-4 h-4 text-purple-400" />
                      <span>ملخص الهوية والحساب البنكي الأساسي</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('profile')}
                      className="text-[11px] text-purple-300 hover:text-purple-200 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>تعديل البيانات</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
                      <span className="text-slate-500 block">البنك الأساسي</span>
                      <strong className="text-slate-200">
                        {store.bankAccountDetails?.bankName || 'غير محدد'}
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
                      <span className="text-slate-500 block">صاحب الحساب</span>
                      <strong className="text-slate-200">
                        {store.bankAccountDetails?.accountHolder || store.storeName}
                      </strong>
                    </div>
                    <div className="col-span-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
                      <span className="text-slate-500 block">رقم الآيبان (IBAN)</span>
                      <strong className="text-amber-300 font-mono" dir="ltr">
                        {store.bankAccountDetails?.iban || 'غير محدد'}
                      </strong>
                    </div>
                  </div>
                  {store.socialLinks && (
                    <div className="pt-1 flex flex-wrap items-center gap-2">
                      <span className="text-slate-400 text-[11px]">روابط التواصل:</span>
                      <SupplierContactLinks socialLinks={store.socialLinks} />
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-amber-400" />
                      <span>ملخص الموظفين والخدمات والمخازن</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('services')}
                      className="text-[11px] text-amber-300 hover:text-amber-200 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>عرض التفاصيل</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
                      <span className="text-slate-500 block">موظفو المكتب</span>
                      <strong className="text-cyan-300 font-mono text-sm">
                        {metrics.employeesCount} موظف
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
                      <span className="text-slate-500 block">الحسابات البنكية المسجلة</span>
                      <strong className="text-emerald-300 font-mono text-sm">
                        {metrics.bankAccountsCount} حساب
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
                      <span className="text-slate-500 block">الخدمات النشطة بالمتجر</span>
                      <strong className="text-amber-300 font-mono text-sm">
                        {metrics.activeServicesCount} / {metrics.servicesCount} خدمة
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
                      <span className="text-slate-500 block">مخزون الأكواد المتوفر</span>
                      <strong className="text-purple-300 font-mono text-sm">
                        {metrics.availableVoucherCodesCount} متاح ({metrics.usedVoucherCodesCount} مستخدم)
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PERSONAL DATA, BANK ACCOUNTS & EMPLOYEES */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Editable Personal & Business & Fees Form */}
              <form
                onSubmit={handleSaveStoreProfile}
                className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <Edit3 className="w-4 h-4 text-purple-400" />
                      <span>البيانات الشخصية والتجارية والبنكية للمتجر</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      يمكن لمدير التطبيق الاطلاع على جميع بيانات التاجر الشخصية وتعديلها وحفظها مباشرة في قاعدة البيانات.
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>حفظ التعديلات</span>
                  </button>
                </div>

                {profileError && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs">
                    {profileError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">اسم مالك المتجر الكامل:</label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">الاسم التجاري للمتجر:</label>
                    <input
                      type="text"
                      required
                      value={editStoreName}
                      onChange={(e) => setEditStoreName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">البريد الإلكتروني:</label>
                    <input
                      type="email"
                      required
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">رقم الهاتف:</label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">الدولة:</label>
                    <input
                      type="text"
                      value={editCountry}
                      onChange={(e) => setEditCountry(e.target.value)}
                      placeholder="المملكة العربية السعودية"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">المدينة:</label>
                    <input
                      type="text"
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      placeholder="الرياض"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">رابط الشعار (اختياري):</label>
                    <input
                      type="text"
                      value={editLogoUrl}
                      onChange={(e) => setEditLogoUrl(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">سعر الصرف (1$ = ؟ ر.س):</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      value={editExchangeRate}
                      onChange={(e) => setEditExchangeRate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">تاريخ الانضمام (للقراءة فقط):</label>
                    <input
                      type="text"
                      disabled
                      value={store.createdAt}
                      className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-3 py-2 text-slate-400 font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Bank & Fee Settings Row */}
                <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2.5">
                    <h4 className="font-bold text-slate-200 flex items-center gap-1.5">
                      <Landmark className="w-4 h-4 text-emerald-400" />
                      <span>بيانات الحساب البنكي الأساسي</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-400 mb-1">اسم البنك:</label>
                        <input
                          type="text"
                          value={editBankName}
                          onChange={(e) => setEditBankName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">صاحب الحساب:</label>
                        <input
                          type="text"
                          value={editAccountHolder}
                          onChange={(e) => setEditAccountHolder(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">رقم الآيبان (IBAN):</label>
                        <input
                          type="text"
                          value={editIban}
                          onChange={(e) => setEditIban(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">رقم الحساب:</label>
                        <input
                          type="text"
                          value={editAccountNumber}
                          onChange={(e) => setEditAccountNumber(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <h4 className="font-bold text-slate-200 flex items-center gap-1.5">
                      <Percent className="w-4 h-4 text-purple-400" />
                      <span>إعدادات رسوم المنصة للمتجر</span>
                    </h4>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['percentage', 'fixed', 'both'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setEditFeeType(t)}
                          className={`py-2 px-2 rounded-xl border text-center font-bold transition-colors cursor-pointer ${
                            editFeeType === t
                              ? 'bg-purple-500 text-slate-950 border-purple-500'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          {t === 'percentage' ? 'نسبة %' : t === 'fixed' ? 'مبلغ ثابت' : 'نسبة + مبلغ'}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-400 mb-1">النسبة المئوية (%):</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="25"
                          value={editFeePercentage}
                          onChange={(e) => setEditFeePercentage(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">المبلغ المقطوع ({currencyLabel}):</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={editFixedFeeDisplay}
                          onChange={(e) => {
                            setEditFixedFeeDisplay(e.target.value);
                            setIsEditFixedFeeDirty(true);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-center"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Social Links Row */}
                <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">واتساب المتجر:</label>
                    <input
                      type="text"
                      value={editWhatsapp}
                      onChange={(e) => setEditWhatsapp(e.target.value)}
                      placeholder="+9665..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">تليجرام:</label>
                    <input
                      type="text"
                      value={editTelegram}
                      onChange={(e) => setEditTelegram(e.target.value)}
                      placeholder="@store"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">إنستغرام:</label>
                    <input
                      type="text"
                      value={editInstagram}
                      onChange={(e) => setEditInstagram(e.target.value)}
                      placeholder="@store"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">الموقع الإلكتروني:</label>
                    <input
                      type="text"
                      value={editWebsite}
                      onChange={(e) => setEditWebsite(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>
              </form>

              {/* Store Employees List */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-cyan-400" />
                    <span>موظفو المكتب المسجلون بالمتجر ({metrics.employeesCount})</span>
                  </h3>
                </div>
                {(!store.employees || store.employees.length === 0) ? (
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-center">
                    لا يوجد موظفون مسجلون تحت هذا المتجر حالياً.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {store.employees.map((emp) => {
                      const empPerms = normalizeEmployeePermissions(emp.permissions);
                      const grantedBadges = EMPLOYEE_PERMISSION_BADGES.filter(
                        (b) => empPerms[b.key]
                      );
                      return (
                        <div
                          key={emp.id}
                          className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="font-bold text-white">{emp.name}</div>
                              <div className="text-[11px] text-cyan-300">{emp.roleTitle}</div>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {emp.createdAt}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3 text-[11px] text-slate-400 font-mono" dir="ltr">
                            <span>{emp.email}</span>
                            <span>·</span>
                            <span>{emp.phone}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 pt-1">
                            {grantedBadges.length === 0 ? (
                              <span className="text-[10px] text-slate-500">بدون صلاحيات مفعلة</span>
                            ) : (
                              grantedBadges.map((b) => (
                                <span
                                  key={b.key}
                                  className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px]"
                                >
                                  {b.shortAr}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Store Registered Bank Accounts */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-emerald-400" />
                  <span>الحسابات البنكية ومفوضو استلام الحوالات ({storeBankAccounts.length})</span>
                </h3>
                {storeBankAccounts.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-center">
                    لم يقم المتجر بإضافة حسابات بنكية إضافية أو تفويض وكلاء بعد.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {storeBankAccounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white">{acc.bankName}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              acc.isActive
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {acc.isActive ? 'مفعّل' : 'معطّل'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300">
                          صاحب الحساب: {acc.accountHolderName} ({acc.country})
                        </div>
                        <div className="text-[11px] text-amber-300 font-mono" dir="ltr">
                          {acc.iban || acc.accountNumber}
                        </div>
                        {acc.canReceiveSupplierTransfers && (
                          <div className="text-[10px] text-cyan-300 pt-1">
                            مفوض باستلام الحوالات:{' '}
                            {acc.delegatedPosName || acc.accountHolderName}{' '}
                            {acc.delegatedPosCode ? `(${acc.delegatedPosCode})` : ''}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: STORE CLIENTS */}
          {activeTab === 'clients' && (
            <div className="space-y-4">
              {/* Filter Bar */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="ابحث باسم المحل، اسم العميل، كود نقطة البيع، الهاتف أو البريد..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-white text-xs"
                  />
                </div>
                <select
                  value={clientTierFilter}
                  onChange={(e) => setClientTierFilter(e.target.value as AccountTier | 'all')}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                >
                  <option value="all">كل الرتب ({metrics.clientsCount})</option>
                  {Object.values(TIERS_CONFIG).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clients Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">عدد العملاء المعروضين</span>
                  <strong className="text-base font-mono text-white">{filteredClients.length}</strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">مجموع أرصدة المحافظ</span>
                  <strong className="text-base font-mono text-emerald-400">
                    {formatCurrency(metrics.totalClientWalletsBalance, { withGrouping: true })}
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">إجمالي مشتريات العملاء</span>
                  <strong className="text-base font-mono text-amber-400">
                    {formatCurrency(metrics.totalClientSpent, { withGrouping: true })}
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">السلف المتبقية على العملاء</span>
                  <strong className="text-base font-mono text-rose-400">
                    {formatCurrency(metrics.totalLoansRemainingAmount, { withGrouping: true })}
                  </strong>
                </div>
              </div>

              {filteredClients.length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-950 border border-slate-800 text-center text-slate-400">
                  لا يوجد عملاء مطابقون لمعايير البحث داخل هذا المتجر.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredClients.map((client) => {
                    const tier = TIERS_CONFIG[client.tier] || TIERS_CONFIG.regular;
                    const loanSummary = getClientLoanSummaryForStore(
                      depositRequests,
                      client.id,
                      store.id
                    );
                    const clientOrdersCount = metrics.storeOrders.filter(
                      (o) => o.posId === client.id
                    ).length;

                    return (
                      <div
                        key={client.id}
                        className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                              {client.logoUrl ? (
                                <img
                                  src={client.logoUrl}
                                  alt={client.tradeName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Store className="w-5 h-5 text-amber-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-white truncate">
                                {client.tradeName}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate">
                                العميل: {client.ownerName} ·{' '}
                                <span className="font-mono text-amber-300">{client.posCode}</span>
                              </div>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border shrink-0 ${tier.badgeColor} ${tier.borderColor} ${tier.textColor}`}
                          >
                            {tier.nameAr}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                          <div className="flex items-center gap-1 font-mono" dir="ltr">
                            <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="truncate">{client.phone || '-'}</span>
                          </div>
                          <div className="flex items-center gap-1 font-mono" dir="ltr">
                            <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="truncate">{client.email || '-'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="truncate">
                              {[client.country, client.city].filter(Boolean).join(' · ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>التسجيل: {client.createdAt}</span>
                          </div>
                        </div>

                        {client.servicePhone && (
                          <div className="text-[10px] text-amber-300 flex items-center gap-1">
                            <Headphones className="w-3 h-3" />
                            <span>هاتف الخدمات: {client.servicePhone}</span>
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-center">
                          <div className="p-2 rounded-xl bg-slate-900">
                            <span className="text-[10px] text-slate-400 block">المحفظة</span>
                            <strong className="font-mono text-emerald-400">
                              {formatCurrency(client.walletBalance)}
                            </strong>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-900">
                            <span className="text-[10px] text-slate-400 block">الطلبات</span>
                            <strong className="font-mono text-white">
                              {clientOrdersCount || client.ordersCount || 0}
                            </strong>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-900">
                            <span className="text-[10px] text-slate-400 block">مديونية سلف</span>
                            <strong
                              className={`font-mono ${
                                loanSummary.remainingDebt > 0 ? 'text-rose-400' : 'text-slate-400'
                              }`}
                            >
                              {formatCurrency(loanSummary.remainingDebt)}
                            </strong>
                          </div>
                        </div>

                        {/* Privileges & Jump to Activity */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="flex flex-wrap items-center gap-1">
                            {client.canRequestLoans && (
                              <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px]">
                                طلب سلف
                              </span>
                            )}
                            {client.canReceiveSupplierTransfers && (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px]">
                                استلام حوالات
                              </span>
                            )}
                            {client.canGetBonus && (
                              <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px]">
                                بونص
                              </span>
                            )}
                            {client.canViewGifts && (
                              <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px]">
                                هدايا مجانية
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleJumpToClientActivity(client.id)}
                            className="px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Activity className="w-3 h-3" />
                            <span>حركة العميل</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: STORE ACTIVITY (ORDERS, DEPOSITS/LOANS, LEDGER) */}
          {activeTab === 'activity' && (
            <div className="space-y-4">
              {/* Sub-tab Switcher */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActivitySubTab('orders')}
                  className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                    activitySubTab === 'orders'
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <Gamepad2 className="w-4 h-4" />
                  <span>حركة الطلبات والمبيعات ({filteredOrders.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActivitySubTab('deposits_loans')}
                  className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                    activitySubTab === 'deposits_loans'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <HandCoins className="w-4 h-4" />
                  <span>الإيداعات والسلف والسداد ({filteredDepositsAndLoans.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActivitySubTab('ledger')}
                  className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                    activitySubTab === 'ledger'
                      ? 'bg-purple-500 text-slate-950 border-purple-400'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <Receipt className="w-4 h-4" />
                  <span>القيود المحاسبية وحركة الأرصدة ({filteredAccountingEntries.length})</span>
                </button>
              </div>

              {/* Shared Filter Strip */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                <div className="relative lg:col-span-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={activityQuery}
                    onChange={(e) => setActivityQuery(e.target.value)}
                    placeholder="ابحث بالرقم المرجعي، الخدمة، العميل أو البيان..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pr-8 pl-3 py-2 text-white text-xs"
                  />
                </div>

                <select
                  value={activityClientId}
                  onChange={(e) => setActivityClientId(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                >
                  <option value="all">جميع عملاء المتجر ({metrics.clientsCount})</option>
                  {metrics.storeClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.tradeName} ({c.posCode})
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  value={activityDateFrom}
                  onChange={(e) => setActivityDateFrom(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                  title="من تاريخ"
                />

                <input
                  type="date"
                  value={activityDateTo}
                  onChange={(e) => setActivityDateTo(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                  title="إلى تاريخ"
                />
              </div>

              {/* Sub-view A: Orders */}
              {activitySubTab === 'orders' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={orderStatusFilter}
                      onChange={(e) =>
                        setOrderStatusFilter(e.target.value as 'all' | Order['status'])
                      }
                      className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs"
                    >
                      <option value="all">كل حالات الطلب</option>
                      <option value="completed">مكتمل</option>
                      <option value="pending_supplier">بانتظار المتجر</option>
                      <option value="in_progress">قيد التنفيذ</option>
                      <option value="failed">ملغي ومسترد</option>
                    </select>

                    <select
                      value={orderMethodFilter}
                      onChange={(e) =>
                        setOrderMethodFilter(e.target.value as 'all' | DeliveryMethod)
                      }
                      className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs"
                    >
                      <option value="all">كل طرق التسليم</option>
                      <option value="player_id">شحن عبر الأيدي (Player ID)</option>
                      <option value="account_login">تسليم عبر الحساب</option>
                      <option value="voucher_code">كود قسيمة</option>
                    </select>
                  </div>

                  {filteredOrders.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-slate-950 border border-slate-800 text-center text-slate-400">
                      لا توجد طلبات مطابقة للفلاتر المحددة لهذا المتجر.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredOrders.map((ord) => (
                        <div
                          key={ord.id}
                          className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-bold text-amber-400">#{ord.id}</span>
                              <span className="font-bold text-white">{ord.serviceName}</span>
                              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 text-[10px]">
                                {ord.packageName}
                              </span>
                              {ord.isFreeGiftOrder && (
                                <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                                  هدية مجانية
                                </span>
                              )}
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  ord.status === 'completed'
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : ord.status === 'failed'
                                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                }`}
                              >
                                {ord.status === 'completed'
                                  ? 'مكتمل'
                                  : ord.status === 'failed'
                                  ? 'ملغي'
                                  : 'قيد التنفيذ'}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                              <span>
                                العميل: <strong className="text-slate-200">{ord.posName}</strong> (
                                <span className="font-mono">{ord.posCode}</span>)
                              </span>
                              <span>·</span>
                              <span className="font-mono">{ord.date}</span>
                              {ord.deliveryDetails?.playerId && (
                                <>
                                  <span>·</span>
                                  <span className="text-amber-300 font-mono">
                                    ID: {ord.deliveryDetails.playerId}
                                  </span>
                                </>
                              )}
                              {ord.deliveryDetails?.accountEmail && (
                                <>
                                  <span>·</span>
                                  <span className="text-cyan-300 font-mono" dir="ltr">
                                    {ord.deliveryDetails.accountType ? `${ord.deliveryDetails.accountType}: ` : ''}
                                    {ord.deliveryDetails.accountEmail}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0">
                            <div className="font-bold font-mono text-white">
                              {ord.isFreeGiftOrder
                                ? formatCurrency(0)
                                : formatCurrency(ord.totalDeducted)}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              رسوم المنصة: {formatCurrency(ord.feeAmount)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-view B: Deposits, Loans & Repayments */}
              {activitySubTab === 'deposits_loans' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {(['all', 'cash', 'loan'] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setDepositKindFilter(k)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer ${
                          depositKindFilter === k
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                            : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        {k === 'all' ? 'الكل (حوالات وسلف)' : k === 'cash' ? 'الإيداعات النقدية' : 'السلف فقط'}
                      </button>
                    ))}
                  </div>

                  {filteredDepositsAndLoans.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-slate-950 border border-slate-800 text-center text-slate-400">
                      لا توجد إيداعات أو سلف مطابقة للفلاتر المحددة.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredDepositsAndLoans.map((dep: DepositRequest) => {
                        const isLoan = isLoanDeposit(dep);
                        const paid = isLoan ? getLoanPaidAmount(dep) : 0;
                        const remaining = isLoan ? getLoanRemainingAmount(dep) : 0;
                        return (
                          <div
                            key={dep.id}
                            className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                    isLoan
                                      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  }`}
                                >
                                  {isLoan ? 'سلفة / رصيد آجل' : 'إيداع بنكي / كاش'}
                                </span>
                                <span className="font-bold text-white">{dep.posName}</span>
                                <span className="font-mono text-amber-300 text-[11px]">
                                  {dep.posCode}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    dep.status === 'approved'
                                      ? 'bg-emerald-500/15 text-emerald-300'
                                      : dep.status === 'rejected'
                                      ? 'bg-rose-500/15 text-rose-300'
                                      : 'bg-amber-500/15 text-amber-300'
                                  }`}
                                >
                                  {dep.status === 'approved'
                                    ? 'معتمد'
                                    : dep.status === 'rejected'
                                    ? 'مرفوض'
                                    : 'قيد المراجعة'}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
                                <span className="font-mono">{dep.date}</span>
                                <span>·</span>
                                <span>المرجع: {dep.transferNumber}</span>
                                <span>·</span>
                                <span>البنك/المصدر: {dep.bankName}</span>
                              </div>
                              {dep.loanReason && (
                                <div className="text-[11px] text-cyan-200 bg-cyan-950/30 px-2.5 py-1 rounded-lg border border-cyan-500/20">
                                  السبب/البيان: {dep.loanReason}
                                </div>
                              )}
                              {isLoan && dep.status === 'approved' && (
                                <div className="text-[11px] text-slate-300 font-mono">
                                  المسدد: {formatCurrency(paid)} · المتبقي: {formatCurrency(remaining)}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {dep.transferReceiptImage && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setViewingReceiptDeposit({
                                      imageUrl: dep.transferReceiptImage!,
                                      title: 'معاينة إيصال الإيداع / الحوالة',
                                      transferNumber: dep.transferNumber,
                                      amount: dep.amount,
                                      senderName: dep.transferSenderName,
                                      bankName: dep.bankName,
                                      date: dep.date,
                                      posName: dep.posName,
                                      posCode: dep.posCode,
                                    })
                                  }
                                  className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <ImageIcon className="w-3.5 h-3.5" />
                                  <span>الإيصال</span>
                                </button>
                              )}
                              <div className="text-left font-bold font-mono text-base text-white">
                                {formatCurrency(dep.amount)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {storeRepayments.length > 0 && (
                    <div className="pt-2 space-y-2">
                      <h4 className="font-bold text-slate-300 text-xs">
                        طلبات سداد السلف المسجلة بالمتجر ({storeRepayments.length})
                      </h4>
                      <div className="space-y-2">
                        {storeRepayments.slice(0, 15).map((rep) => (
                          <div
                            key={rep.id}
                            className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]"
                          >
                            <div>
                              <span className="font-bold text-white">{rep.posName}</span> (
                              <span className="font-mono text-amber-300">{rep.posCode}</span>) · سلفة{' '}
                              <span className="font-mono">#{rep.loanTransferNumber}</span> ·{' '}
                              <span className="text-slate-400">{rep.date}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-emerald-400">
                                {formatCurrency(rep.amount)}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  rep.status === 'approved'
                                    ? 'bg-emerald-500/15 text-emerald-300'
                                    : rep.status === 'rejected'
                                    ? 'bg-rose-500/15 text-rose-300'
                                    : 'bg-amber-500/15 text-amber-300'
                                }`}
                              >
                                {rep.status === 'approved'
                                  ? 'معتمد'
                                  : rep.status === 'rejected'
                                  ? 'مرفوض'
                                  : 'معلق'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-view C: Accounting Entries Ledger */}
              {activitySubTab === 'ledger' && (
                <div className="space-y-3">
                  {filteredAccountingEntries.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-slate-950 border border-slate-800 text-center text-slate-400">
                      لا توجد قيود محاسبية مسجلة لهذا المتجر وفق الفلاتر المحددة.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="p-3 font-semibold">التاريخ</th>
                            <th className="p-3 font-semibold">المرجع</th>
                            <th className="p-3 font-semibold">العميل / الطرف</th>
                            <th className="p-3 font-semibold">البيان</th>
                            <th className="p-3 font-semibold text-left">مدين</th>
                            <th className="p-3 font-semibold text-left">دائن</th>
                            <th className="p-3 font-semibold text-left">الرصيد بعد القيد</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70">
                          {filteredAccountingEntries.map((entry) => {
                            const matchedClient = metrics.storeClients.find(
                              (c) => c.id === entry.posId
                            );
                            return (
                              <tr key={entry.id} className="hover:bg-slate-900/50">
                                <td className="p-3 font-mono text-slate-400 whitespace-nowrap">
                                  {entry.date}
                                </td>
                                <td className="p-3 font-mono text-amber-300 whitespace-nowrap">
                                  #{entry.referenceId}
                                </td>
                                <td className="p-3 text-slate-200">
                                  {matchedClient ? (
                                    <div>
                                      <div className="font-semibold">{matchedClient.tradeName}</div>
                                      <div className="text-[10px] font-mono text-slate-400">
                                        {matchedClient.posCode}
                                      </div>
                                    </div>
                                  ) : (
                                    entry.customerName || 'المتجر'
                                  )}
                                </td>
                                <td className="p-3 text-slate-300">
                                  <div>{entry.description}</div>
                                  {entry.serviceName && (
                                    <div className="text-[10px] text-slate-500">
                                      {entry.serviceName}
                                    </div>
                                  )}
                                </td>
                                <td className="p-3 text-left font-mono text-rose-400 whitespace-nowrap">
                                  {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                                </td>
                                <td className="p-3 text-left font-mono text-emerald-400 whitespace-nowrap">
                                  {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                                </td>
                                <td className="p-3 text-left font-mono font-bold text-white whitespace-nowrap">
                                  {formatCurrency(entry.balanceAfter)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: STORE SERVICES & VOUCHER WAREHOUSES */}
          {activeTab === 'services' && (
            <div className="space-y-5">
              {/* Services List */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-400" />
                  <span>الخدمات المعروضة بالمتجر ({metrics.servicesCount})</span>
                </h3>
                {metrics.storeServices.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center text-slate-400">
                    لا توجد خدمات مضافة لهذا المتجر حالياً.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {metrics.storeServices.map((srv) => {
                      const cat = catalogs.find((c) => c.id === srv.catalogId);
                      return (
                        <div
                          key={srv.id}
                          className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-bold text-white flex items-center gap-1.5">
                                {cat?.isFreeGiftsCatalog && (
                                  <Gift className="w-3.5 h-3.5 text-purple-400" />
                                )}
                                <span>{srv.nameAr}</span>
                              </div>
                              <div className="text-[11px] text-slate-400">
                                الكتالوج: {cat?.nameAr || srv.catalogId}
                              </div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                srv.isActive !== false
                                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {srv.isActive !== false ? 'مفعلة' : 'معطلة'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {(srv.deliveryMethods || []).map((m) => (
                              <span
                                key={m}
                                className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300"
                              >
                                {m === 'player_id'
                                  ? 'شحن أيدي'
                                  : m === 'account_login'
                                  ? 'عبر الحساب'
                                  : 'كود قسيمة'}
                              </span>
                            ))}
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-mono">
                              {srv.packages?.length || 0} باقة
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Voucher Warehouses List */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Archive className="w-4 h-4 text-cyan-400" />
                  <span>مخازن الأكواد والقسائم ({metrics.warehousesCount})</span>
                </h3>
                {metrics.storeWarehouses.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center text-slate-400">
                    لا توجد مخازن أكواد مسجلة لهذا المتجر حالياً.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {metrics.storeWarehouses.map((wh) => (
                      <div
                        key={wh.id}
                        className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <Ticket className="w-3.5 h-3.5 text-cyan-400" />
                            <span>{wh.nameAr}</span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            التصنيف: {wh.categoryName} · {wh.isPublishedAsService ? 'منشور كخدمة' : 'غير منشور'}
                          </div>
                        </div>
                        <div className="text-left font-mono">
                          <div className="text-emerald-400 font-bold">
                            {wh.codes?.length || 0} متوفر
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {wh.usedCodesCount || 0} مباع
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Receipt Preview Modal */}
      <ReceiptImageModal
        isOpen={Boolean(viewingReceiptDeposit)}
        onClose={() => setViewingReceiptDeposit(null)}
        imageUrl={viewingReceiptDeposit?.imageUrl}
        title={viewingReceiptDeposit?.title}
        transferNumber={viewingReceiptDeposit?.transferNumber}
        amount={viewingReceiptDeposit?.amount}
        senderName={viewingReceiptDeposit?.senderName}
        bankName={viewingReceiptDeposit?.bankName}
        date={viewingReceiptDeposit?.date}
        posName={viewingReceiptDeposit?.posName}
        posCode={viewingReceiptDeposit?.posCode}
      />

      {/* PDF Export Preview Modal */}
      <PdfPreviewModal pdfResult={pdfPreview} onClose={() => setPdfPreview(null)} />
    </div>
  );
};
