import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { TIERS_CONFIG, DigitalService } from '../../types';
import { 
  Store, 
  Wallet, 
  QrCode, 
  Phone, 
  MapPin, 
  Copy, 
  Check, 
  Send, 
  PlusCircle, 
  Gamepad2, 
  CreditCard, 
  Tv, 
  Sparkles,
  Search,
  Receipt,
  History,
  Clock,
  CheckCircle2,
  X,
  Edit3,
  Headphones,
  Mail,
  Database,
  HandCoins,
  ShieldCheck,
  Gift,
  Bell,
  Package,
  FileDown,
  Loader2,
  LogOut,
  Trash2,
  Award
} from 'lucide-react';
import { PurchaseModal } from './PurchaseModal';
import { DepositModal } from './DepositModal';
import { TransferModal } from './TransferModal';
import { StatementView } from './StatementView';
import { EditPosProfileModal } from './EditPosProfileModal';
import { ClientLoansView } from './ClientLoansView';
import { IncomingTransfersReviewView } from './IncomingTransfersReviewView';
import { SupplierContactLinks } from '../common/SupplierContactLinks';
import { getLoanRemainingAmount, isLoanDeposit } from '../../utils/loanRepayments';
import { getIncomingLoanRepaymentsForPos, getIncomingTransfersForPos, hasSupplierTransferPrivilege } from '../../utils/bankAccounts';
import {
  calculateServicePurchasePricing,
  evaluateClientGiftServiceStatus,
  formatGiftRemainingTimeAr,
  isCatalogFreeGifts,
} from '../../utils/pricing';
import { getCatalogsForPosView } from '../../utils/platformSettings';
import {
  getPackageAvailableStock,
  getServiceTotalStock,
  mergeWarehouseOptionsIntoPackage,
  resolvePackagePurchaseOptions,
  serviceRequiresVoucherWarehouse,
  getPackagesForDeliveryMethod,
} from '../../utils/voucherWarehouses';
import { downloadVoucherCodesPdf } from '../../utils/voucherPdf';
import { getStoreCatalogEmptyMessage } from '../../utils/availabilityMessages';
import { filterOrdersForPosClient } from '../../utils/accountAuth';

export const PosDashboard: React.FC = () => {
  const {
    currentPos,
    currentPosSupplier,
    superAdmin,
    catalogs,
    services,
    voucherWarehouses,
    orders,
    depositRequests,
    loanRepaymentRequests,
    supplierBankAccounts,
    platformSettings,
    activeNavTab,
    setActiveNavTab,
    supplier,
    showToast,
    confirmClientOtpRead,
    activeCurrency,
    activeExchangeRate,
    currencyLabel,
    formatCurrency,
    clientNotifications,
    unreadPosNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearAllNotifications,
    logout,
  } = useApp();

  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('all');
  const [searchService, setSearchService] = useState('');
  const [showNotificationsPopover, setShowNotificationsPopover] = useState(false);

  const clientOrders = useMemo(
    () => filterOrdersForPosClient(orders, currentPos.id),
    [orders, currentPos.id]
  );

  // Modals
  const [activePurchaseService, setActivePurchaseService] = useState<DigitalService | null>(null);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [copiedPosCode, setCopiedPosCode] = useState(false);
  const [exportingOrderPdfId, setExportingOrderPdfId] = useState<string | null>(null);

  const tier = TIERS_CONFIG[currentPos.tier];
  const canReceiveSupplierTransfers = hasSupplierTransferPrivilege(currentPos, supplierBankAccounts);
  const pendingIncomingTransfersCount = canReceiveSupplierTransfers
    ? getIncomingTransfersForPos(depositRequests, currentPos, supplierBankAccounts, {
        statusFilter: 'pending',
      }).length +
      getIncomingLoanRepaymentsForPos(loanRepaymentRequests, currentPos, supplierBankAccounts, {
        statusFilter: 'pending',
      }).length
    : 0;

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const activePosSupplierId = (currentPosSupplier || supplier).id;
  const targetedGiftStatuses = services
    .filter(srv => {
      if (!srv.isActive) return false;
      if (srv.supplierId && srv.supplierId !== activePosSupplierId) return false;
      const srvCat = catalogs.find(c => c.id === srv.catalogId);
      return isCatalogFreeGifts(srvCat);
    })
    .map(srv => {
      const srvCat = catalogs.find(c => c.id === srv.catalogId);
      return evaluateClientGiftServiceStatus({
        service: srv,
        catalog: srvCat,
        clientPosId: currentPos.id,
        clientTier: currentPos.tier,
        clientCanViewGifts: Boolean(currentPos.canViewGifts),
        usedGiftServiceIds: currentPos.usedGiftServiceIds,
        orders: clientOrders,
        nowMs,
      });
    })
    .filter(st => st.isTargeted);

  const freeGiftsCount = targetedGiftStatuses.filter(st => st.isActive).length;
  const canSeeGiftsInStore = Boolean(currentPos.canViewGifts) || targetedGiftStatuses.length > 0;
  const visibleCatalogs = getCatalogsForPosView(catalogs, activePosSupplierId, canSeeGiftsInStore);
  const giftCatalogs = visibleCatalogs.filter(c => isCatalogFreeGifts(c));
  const freeGiftsCatalog = giftCatalogs[0];
  const freeGiftsTargetId = freeGiftsCatalog?.id || 'free_gifts';
  const isFreeGiftsSelected =
    selectedCatalogId === 'free_gifts' ||
    giftCatalogs.some(c => c.id === selectedCatalogId);

  useEffect(() => {
    if (activeNavTab === 'incoming_transfers' && !canReceiveSupplierTransfers) {
      setActiveNavTab('store');
    }
  }, [activeNavTab, canReceiveSupplierTransfers, setActiveNavTab]);

  useEffect(() => {
    if (activeNavTab === 'loans' && !currentPos.canRequestLoans) {
      setActiveNavTab('store');
    }
  }, [activeNavTab, currentPos.canRequestLoans, setActiveNavTab]);

  useEffect(() => {
    if (!canSeeGiftsInStore && selectedCatalogId !== 'all') {
      const selCat = catalogs.find(c => c.id === selectedCatalogId);
      if (selectedCatalogId === 'free_gifts' || isCatalogFreeGifts(selCat)) {
        setSelectedCatalogId('all');
      }
    }
  }, [canSeeGiftsInStore, selectedCatalogId, catalogs]);

  // Live Supplier OTP Notification for the client
  const [supplierOtpNotification, setSupplierOtpNotification] = useState<{
    orderId: string;
    message: string;
    timestamp: number;
  } | null>(null);
  const [copiedNotificationCode, setCopiedNotificationCode] = useState(false);

  useEffect(() => {
    setSupplierOtpNotification(null);
    setSelectedCatalogId('all');
    setSearchService('');
    setShowNotificationsPopover(false);
  }, [currentPos.id]);

  useEffect(() => {
    const handleLiveReply = (e: any) => {
      const { orderId, message, posId } = e.detail || {};
      if (posId && posId !== currentPos.id) return;
      if (message) {
        setSupplierOtpNotification({ orderId: orderId || '', message, timestamp: Date.now() });
        showToast({
          type: 'info',
          title: '🔔 إشعار فوري: وصلك رمز التحقق من المتجر',
          description: `رمز التحقق المستلم: ${message}`
        });
      }
    };

    window.addEventListener('digipos_supplier_reply', handleLiveReply);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'digipos_live_supplier_reply' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data?.posId && data.posId !== currentPos.id) return;
          if (data?.message) {
            setSupplierOtpNotification({
              orderId: data.orderId || '',
              message: data.message,
              timestamp: data.timestamp || Date.now()
            });
          }
        } catch (err) {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('digipos_supplier_reply', handleLiveReply);
      window.removeEventListener('storage', handleStorage);
    };
  }, [currentPos.id, showToast]);

  const handleCopyPosCode = () => {
    navigator.clipboard.writeText(currentPos.posCode);
    setCopiedPosCode(true);
    setTimeout(() => setCopiedPosCode(false), 2500);
  };

  const handleDownloadOrderVoucherPdf = async (
    order: typeof orders[0],
    codesList: string[]
  ) => {
    if (exportingOrderPdfId || codesList.length === 0) return;
    setExportingOrderPdfId(order.id);
    try {
      const orderSup = currentPosSupplier || supplier;
      const srv = services.find((s) => s.id === order.serviceId);
      const srvCat = srv ? catalogs.find((c) => c.id === srv.catalogId) : undefined;
      const isFreeGiftOrder = Boolean(order.isFreeGiftOrder || (srvCat && isCatalogFreeGifts(srvCat) && order.costPrice === 0));
      const rawPkg = srv?.packages.find((p) => p.id === order.packageId);
      const pkg = rawPkg ? mergeWarehouseOptionsIntoPackage(rawPkg, voucherWarehouses) : undefined;
      const pkgOpts = pkg ? resolvePackagePurchaseOptions(pkg, voucherWarehouses) : undefined;
      const clientOrderTotal = isFreeGiftOrder ? 0 : order.totalDeducted;

      const result = await downloadVoucherCodesPdf({
        orderId: order.id,
        orderDate: order.date,
        serviceName: order.serviceName,
        packageName: order.packageName,
        packageTitleAr: pkgOpts?.packageNameAr,
        packageDescription: pkg?.description,
        purchaseUnit: order.purchaseUnit || (codesList.length > 1 ? 'package' : 'single_code'),
        codes: codesList,
        unitPrice: clientOrderTotal,
        feeAmount: 0,
        totalAmount: clientOrderTotal,
        paymentMethod: order.paymentMethod,
        currency: activeCurrency,
        exchangeRateSarPerUsd: activeExchangeRate,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        supplier: {
          storeName: orderSup.storeName || orderSup.name,
          name: orderSup.name,
          phone: orderSup.phone,
          email: orderSup.email,
          country: orderSup.country,
          city: orderSup.city,
          logoUrl: orderSup.logoUrl,
        },
        client: {
          tradeName: currentPos.tradeName,
          ownerName: currentPos.ownerName,
          posCode: currentPos.posCode,
          phone: currentPos.phone,
          email: currentPos.email,
          country: currentPos.country,
          city: currentPos.city,
          tierNameAr: tier.nameAr,
          logoUrl: currentPos.logoUrl,
        },
      });
      showToast({
        type: 'success',
        title: 'تم حفظ ملف الأكواد PDF',
        description: `تم تنزيل الملف (${result.filename}) متضمناً ${result.codesCount} ${result.codesCount === 1 ? 'كود' : 'أكواد'}.`,
      });
    } catch {
      showToast({
        type: 'error',
        title: 'تعذر حفظ ملف PDF',
        description: 'حدث خطأ أثناء تجهيز ملف PDF، يرجى المحاولة مرة أخرى.',
      });
    } finally {
      setExportingOrderPdfId(null);
    }
  };

  // Filter services strictly by active POS supplier ID and merchant gift targeting
  // Targeted gift services remain visible even if deactivated by expiry or usage exhaustion so client sees "غير مفعلة".
  const supplierBaseServices = services.filter(srv => {
    if (!srv.isActive) return false;
    if (srv.supplierId && srv.supplierId !== activePosSupplierId) return false;
    const srvCat = catalogs.find(c => c.id === srv.catalogId);
    const isGiftCat = isCatalogFreeGifts(srvCat);
    if (isGiftCat) {
      const giftStatus = evaluateClientGiftServiceStatus({
        service: srv,
        catalog: srvCat,
        clientPosId: currentPos.id,
        clientTier: currentPos.tier,
        clientCanViewGifts: Boolean(currentPos.canViewGifts),
        usedGiftServiceIds: currentPos.usedGiftServiceIds,
        orders: clientOrders,
        nowMs,
      });
      return giftStatus.isTargeted;
    }
    return true;
  });

  const filteredServices = supplierBaseServices.filter(srv => {
    const srvCat = catalogs.find(c => c.id === srv.catalogId);
    const isGift = isCatalogFreeGifts(srvCat);
    if (isFreeGiftsSelected) {
      if (!canSeeGiftsInStore || !isGift) return false;
    } else if (selectedCatalogId !== 'all' && srv.catalogId !== selectedCatalogId) {
      return false;
    }
    if (searchService.trim()) {
      const q = searchService.toLowerCase();
      const matchName = srv.nameAr.toLowerCase().includes(q);
      const matchDesc = srv.descriptionAr.toLowerCase().includes(q);
      if (!matchName && !matchDesc) return false;
    }
    return true;
  });

  const emptyStoreState = getStoreCatalogEmptyMessage({
    totalStoreServices: supplierBaseServices.length,
    isFreeGiftsSelected,
  });

  return (
    <div className="space-y-6">

      {/* Admin Global Interface Notice for POS & Clients */}
      {platformSettings.showPosInterfaceNotice && platformSettings.posInterfaceNotice.trim() && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/60 via-slate-900 to-slate-900 border border-cyan-500/40 flex items-start gap-3 text-xs shadow-lg">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0">
            <Bell className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <div className="font-bold text-cyan-200">تنبيه عام من إدارة التطبيق:</div>
            <p className="text-slate-200 leading-relaxed">{platformSettings.posInterfaceNotice}</p>
          </div>
        </div>
      )}
      
      {/* Live Supplier OTP Notification in Client Interface */}
      {supplierOtpNotification && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/20 via-slate-900 to-amber-950/40 border-2 border-amber-500/80 shadow-2xl space-y-3 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xl shadow-lg animate-bounce shrink-0">
                🔔
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-amber-300 text-sm">إشعار جديد: وصلك رمز التحقق من المتجر!</h3>
                  <span className="text-[10px] bg-amber-500/20 text-amber-200 px-2.5 py-0.5 rounded-full border border-amber-500/40 font-semibold animate-pulse">
                    إشعار فوري
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  قام المتجر بإرسال رمز التحقق (OTP) أو كود التفعيل للطلب الخاص بك:
                </p>
              </div>
            </div>
            <button
              onClick={() => setSupplierOtpNotification(null)}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors shrink-0 cursor-pointer"
              title="إغلاق الإشعار"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-950/90 border border-amber-500/30">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">رمز التحقق المستلم:</span>
              <span className="font-mono text-lg sm:text-xl font-black text-amber-300 bg-slate-900 px-4 py-1.5 rounded-xl border border-amber-500/50 tracking-widest select-all shadow-inner">
                {supplierOtpNotification.message}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(supplierOtpNotification.message);
                  setCopiedNotificationCode(true);
                  if (supplierOtpNotification.orderId) {
                    confirmClientOtpRead(supplierOtpNotification.orderId);
                  }
                  showToast({ type: 'success', title: 'تم النسخ وقراءة الرمز', description: 'تم نسخ رمز التحقق وإشعار المتجر بأنك اطلعت على الرمز بنجاح.' });
                  setTimeout(() => setCopiedNotificationCode(false), 2500);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow cursor-pointer ${
                  copiedNotificationCode
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                }`}
              >
                {copiedNotificationCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-slate-950" />
                    <span>تم نسخ الرمز ✓</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-950" />
                    <span>نسخ رمز التحقق</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Special Client Features Banner (Gifts, Free Offers, Loans & Bonus Privileges) */}
      {(canSeeGiftsInStore || currentPos.canGetBonus || currentPos.canRequestLoans) && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-purple-950/40 via-amber-950/30 to-slate-900 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>الميزات الخاصة الحصرية الممنوحة لك من المتجر:</span>
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {currentPos.canRequestLoans && (
                  <span className="px-2.5 py-1 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold flex items-center gap-1 text-[11px]">
                    <HandCoins className="w-3.5 h-3.5 text-cyan-400" />
                    <span>ميزة طلب وإدارة السلف</span>
                  </span>
                )}
                {currentPos.canGetBonus && (
                  <span className="px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1 text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>ميزة الحصول على بونص إضافي</span>
                  </span>
                )}
                {canSeeGiftsInStore && (
                  <span className="px-2.5 py-1 rounded-xl bg-purple-500/15 text-purple-300 border border-purple-500/30 font-bold flex items-center gap-1 text-[11px]">
                    <Gift className="w-3.5 h-3.5 text-purple-400" />
                    <span>هدايا وعروض مجانية مخصصة لك ({formatCurrency(0)})</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {canSeeGiftsInStore && (
            <button
              type="button"
              onClick={() => {
                setActiveNavTab('store');
                setSelectedCatalogId(freeGiftsTargetId);
              }}
              className="px-3.5 py-2 rounded-2xl bg-purple-900/40 hover:bg-purple-800/50 border border-purple-500/30 text-purple-200 text-center sm:text-right shrink-0 transition-colors cursor-pointer"
            >
              <div className="font-bold text-xs text-purple-300 flex items-center gap-1.5 justify-center sm:justify-start">
                <Gift className="w-4 h-4 text-purple-300" />
                <span>🎁 هدايا وعروض مجانية متاحة (السعر: {formatCurrency(0)} - مجاني)</span>
              </div>
              <div className="text-[10px] text-purple-200/80 mt-0.5">
                {freeGiftsCatalog ? 'اضغط هنا لفتح كتالوج الهدايا المجانية الحصري.' : 'توجه للمتجر لاستعراض الهدايا المجانية المخصصة لك.'}
              </div>
            </button>
          )}
        </div>
      )}

      {/* Reseller Identity Card (Required specifications) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Identity details */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              {/* POS Logo or Icon */}
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 overflow-hidden shadow-inner">
                {currentPos.logoUrl ? (
                  <img src={currentPos.logoUrl} alt={currentPos.tradeName} className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-6 h-6 sm:w-7 sm:h-7" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-base sm:text-lg lg:text-xl font-bold text-white tracking-tight leading-tight flex items-center gap-2 flex-wrap">
                    <span className="text-white font-bold">{currentPos.tradeName}</span>
                    <span className="text-slate-600 font-normal">·</span>
                    <span className="text-amber-400 font-semibold text-sm sm:text-base">
                      {currentPos.ownerName}
                    </span>
                  </h1>
                  
                  {/* Edit profile button */}
                  <button
                    onClick={() => setShowEditProfileModal(true)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1 transition-all shrink-0"
                    title="تعديل الشعار، الاسم التجاري، البريد، هاتف الخدمات والمدينة"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                    <span>تعديل البيانات</span>
                  </button>
                </div>

                <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap mt-1">
                  {currentPos.email && (
                    <span className="flex items-center gap-1 text-slate-300">
                      <Mail className="w-3 h-3 text-slate-500" />
                      <span className="font-mono text-[11px]" dir="ltr">{currentPos.email}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs text-slate-400 pt-1">
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                <span dir="ltr">{currentPos.phone}</span>
              </span>

              {currentPos.servicePhone && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1 text-amber-300/90 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                    <Headphones className="w-3.5 h-3.5 text-amber-400" />
                    <span>هاتف الخدمات: <span dir="ltr" className="font-mono font-medium">{currentPos.servicePhone}</span></span>
                  </span>
                </>
              )}

              <span>·</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>{currentPos.country} · {currentPos.city}</span>
              </span>
              <span>·</span>
              <span className="text-slate-400">
                المتجر التابع له: <strong className="text-amber-400">{currentPosSupplier.name} ({currentPosSupplier.storeName})</strong>
              </span>
              <SupplierContactLinks socialLinks={currentPosSupplier.socialLinks} showPrefixDot />
            </div>
          </div>

          {/* POS Code & QR Action + Tier Badge + Client Notifications & Logout */}
          <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${tier.badgeColor} ${tier.borderColor} ${tier.textColor}`}>
                رتبة الحساب: {tier.nameAr}
              </span>

              {/* Client Notifications Bell + Popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowNotificationsPopover(!showNotificationsPopover)}
                  className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  title="الإشعارات والتنبيهات الخاصة بحسابك"
                >
                  <Bell className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">الإشعارات</span>
                  {unreadPosNotificationsCount > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white font-black text-[10px] flex items-center justify-center shadow-sm animate-pulse">
                      {unreadPosNotificationsCount > 99 ? '99+' : unreadPosNotificationsCount}
                    </span>
                  )}
                </button>

                {showNotificationsPopover && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowNotificationsPopover(false)}
                    />
                    <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl z-50 overflow-hidden text-right animate-in fade-in zoom-in-95 duration-150">
                      <div className="p-3.5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-amber-400" />
                          <h3 className="font-bold text-white text-sm">إشعارات العميل</h3>
                          {unreadPosNotificationsCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-semibold border border-amber-500/30">
                              {unreadPosNotificationsCount} جديد
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {clientNotifications.length > 0 && (
                            <>
                              <button
                                type="button"
                                onClick={markAllNotificationsAsRead}
                                className="px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1 cursor-pointer"
                                title="تحديد الكل كقراءة"
                              >
                                <Check className="w-3 h-3" />
                                <span>قراءة الكل</span>
                              </button>
                              <button
                                type="button"
                                onClick={clearAllNotifications}
                                className="px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
                                title="مسح الإشعارات"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>مسح</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60 custom-scrollbar">
                        {clientNotifications.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 space-y-2">
                            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center mx-auto text-slate-500">
                              <Bell className="w-6 h-6" />
                            </div>
                            <p className="text-xs font-medium text-slate-300">لا توجد إشعارات حالياً</p>
                            <p className="text-[11px] text-slate-500">
                              ستصلك هنا التنبيهات وإشعارات الشحن والرصيد المجاني والسلف والطلبات من المتجر
                            </p>
                          </div>
                        ) : (
                          clientNotifications.map((notif) => {
                            const isUnread = !notif.isRead;
                            return (
                              <div
                                key={notif.id}
                                onClick={() => markNotificationAsRead(notif.id)}
                                className={`p-3.5 transition-colors cursor-pointer flex items-start gap-3 ${
                                  isUnread ? 'bg-amber-500/10 hover:bg-amber-500/15' : 'hover:bg-slate-800/50'
                                }`}
                              >
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                                  notif.type === 'deposit'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : notif.type === 'loan'
                                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                    : notif.type === 'loan_repayment'
                                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                    : notif.type === 'receiver_confirmation'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : notif.type === 'tier_upgrade'
                                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                }`}>
                                  {notif.type === 'deposit' ? <Wallet className="w-4 h-4" /> :
                                   notif.type === 'loan' ? <HandCoins className="w-4 h-4" /> :
                                   notif.type === 'loan_repayment' ? <CreditCard className="w-4 h-4" /> :
                                   notif.type === 'receiver_confirmation' ? <ShieldCheck className="w-4 h-4" /> :
                                   notif.type === 'tier_upgrade' ? <Award className="w-4 h-4" /> :
                                   notif.type === 'order_status' ? <CheckCircle2 className="w-4 h-4" /> :
                                   <Bell className="w-4 h-4" />}
                                </div>
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-xs text-white truncate">{notif.title}</span>
                                    {isUnread && (
                                      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-300 leading-normal">{notif.message}</p>
                                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                                    <span className="text-amber-400/80 font-medium">
                                      المتجر: {notif.supplierName || currentPosSupplier.storeName || currentPosSupplier.name || ''}
                                    </span>
                                    <span className="flex items-center gap-1 dir-ltr">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      {notif.createdAt}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={() => setShowQrModal(true)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                title="عرض رمز QR الخاص بنقطة البيع"
              >
                <QrCode className="w-4 h-4 text-amber-400" />
              </button>

              <button
                onClick={() => setShowEditProfileModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors"
                title="تعديل كافة بيانات نقطة البيع (الشعار، الاسم، الاسم التجاري، الإيميل، رقم الهاتف، الدولة، المدينة)"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                <span>تعديل البيانات</span>
              </button>

              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
                title="تسجيل الخروج والعودة لشاشة الدخول"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span>تسجيل الخروج</span>
              </button>
            </div>

            {/* POS Code: 3 letters - 5 digits */}
            <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-400 text-[10px]">المعرّف:</span>
              <span className="font-mono font-bold text-amber-300 tracking-wider">
                {currentPos.posCode}
              </span>
              <button
                onClick={handleCopyPosCode}
                className="p-1 text-slate-400 hover:text-white transition-colors"
                title="نسخ المعرف"
              >
                {copiedPosCode ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Wallet Balance Strip & Action Buttons */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">رصيد محفظتي المسبق لدى المتجر</span>
              <div className="text-2xl font-bold font-mono text-white tabular-nums">
                {formatCurrency(currentPos.walletBalance, { includeSymbol: false, withGrouping: true })}{' '}
                <span className="text-xs text-amber-400 font-sans font-medium">{currencyLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDepositModal(true)}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-amber-500/10"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{currentPos.canRequestLoans ? 'شحن رصيد كاش أو سلفة' : 'شحن رصيد المحفظة'}</span>
            </button>

            <button
              onClick={() => setShowTransferModal(true)}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Send className="w-4 h-4 text-cyan-400" />
              <span>تحويل رصيد لوكيل آخر</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation inside POS view */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2 text-xs font-medium">
        <button
          onClick={() => setActiveNavTab('store')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
            activeNavTab === 'store'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Store className="w-4 h-4 shrink-0" />
          <span>متجر الخدمات الرقمية</span>
        </button>

        <button
          onClick={() => setActiveNavTab('statement')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
            activeNavTab === 'statement'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4 shrink-0" />
          <span>كشف الحساب والقيود</span>
        </button>

        <button
          onClick={() => setActiveNavTab('orders')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
            activeNavTab === 'orders'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <History className="w-4 h-4 shrink-0" />
          <span>سجل العمليات السابقة ({clientOrders.length})</span>
        </button>

        {currentPos.canRequestLoans && (
          <button
            onClick={() => setActiveNavTab('loans')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 ${
              activeNavTab === 'loans'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                : 'text-cyan-300 hover:text-white bg-slate-900 border border-cyan-500/30'
            }`}
          >
            <HandCoins className="w-4 h-4 shrink-0" />
            <span>
              إدارة السلف ({depositRequests.filter(d => isLoanDeposit(d) && d.posId === currentPos.id && d.status === 'approved' && getLoanRemainingAmount(d) > 0).length})
            </span>
          </button>
        )}

        {canReceiveSupplierTransfers && (
          <button
            onClick={() => setActiveNavTab('incoming_transfers')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeNavTab === 'incoming_transfers'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                : 'text-emerald-300 hover:text-white bg-slate-900 border border-emerald-500/30'
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>
              استلام ومراجعة حوالات المتجر ({pendingIncomingTransfersCount})
            </span>
          </button>
        )}
      </div>

      {/* TAB 1: STORE VIEW */}
      {activeNavTab === 'store' && (
        <div className="space-y-6">
          {/* Catalogs Horizontal Selector, Free Gifts & Search */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-sm">
            {/* Search Input Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchService}
                  onChange={e => setSearchService(e.target.value)}
                  placeholder="ابحث عن لعبة أو بطاقة أو هدية مجانية..."
                  className="w-full bg-slate-950/90 border border-slate-800 rounded-xl pr-10 pl-9 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
                {searchService.trim() && (
                  <button
                    type="button"
                    onClick={() => setSearchService('')}
                    title="مسح البحث"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="text-[11px] text-slate-400 px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between sm:justify-center gap-2 shrink-0">
                <span>النتائج المتاحة:</span>
                <span className="font-mono font-bold text-amber-400">{filteredServices.length}</span>
              </div>
            </div>

            {/* Catalogs & Free Gifts Row */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs pt-0.5">
              <button
                type="button"
                onClick={() => setSelectedCatalogId('all')}
                className={`px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer ${
                  selectedCatalogId === 'all'
                    ? 'bg-slate-200 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-950/80 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                جميع الكتالوجات
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!canSeeGiftsInStore) {
                    showToast({
                      type: 'info',
                      title: 'الهدايا المجانية',
                      description: 'لا توجد هدايا مجانية مخصصة لحسابك حالياً؛ تواصل مع المتجر لتفعيلها لك.',
                    });
                    return;
                  }
                  setSelectedCatalogId(freeGiftsTargetId);
                }}
                className={`px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  isFreeGiftsSelected
                    ? 'bg-purple-600 text-white font-bold shadow-sm'
                    : canSeeGiftsInStore
                      ? 'bg-purple-950/50 text-purple-300 border border-purple-500/40 hover:bg-purple-900/60'
                      : 'bg-slate-950/80 text-purple-300/80 border border-purple-500/25 hover:border-purple-500/40 hover:text-purple-200'
                }`}
              >
                <Gift className="w-3.5 h-3.5 shrink-0" />
                <span>الهدايا المجانية</span>
                {canSeeGiftsInStore && freeGiftsCount > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                      isFreeGiftsSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-purple-500/25 text-purple-200'
                    }`}
                  >
                    {freeGiftsCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Tier Pricing Explainer Card */}
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tier.badgeColor} ${tier.textColor}`}>
                رتبتك: {tier.nameAr}
              </span>
              <span className="text-slate-300">
                تظهر لك أسعار الخدمات الخاصة برتبة حسابك فقط ({tier.nameAr}).
              </span>
            </div>
          </div>

          {/* Services Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredServices.map(srv => {
              // Get primary package price for this tier including platform fee / free gift / 0.5 SAR floor rules
              const rawPrimaryPkg = srv.packages[0];
              const primaryPkg = rawPrimaryPkg
                ? mergeWarehouseOptionsIntoPackage(rawPrimaryPkg, voucherWarehouses)
                : rawPrimaryPkg;
              const primaryOpts = primaryPkg
                ? resolvePackagePurchaseOptions(primaryPkg, voucherWarehouses)
                : null;
              const srvCatalog = catalogs.find(c => c.id === srv.catalogId);
              const activeSup = currentPosSupplier || supplier;
              const defaultUnit = primaryOpts?.defaultPurchaseUnit || 'single_code';
              const pricing = calculateServicePurchasePricing({
                pkg: primaryPkg,
                clientTier: currentPos.tier,
                purchaseUnit: defaultUnit,
                clientCanViewGifts: Boolean(currentPos.canViewGifts),
                clientPosId: currentPos.id,
                service: srv,
                catalog: srvCatalog,
                supplier: activeSup,
                superAdmin
              });
              const packagePricing =
                primaryOpts?.allowPackage && primaryOpts?.allowSingleCode
                  ? calculateServicePurchasePricing({
                      pkg: primaryPkg,
                      clientTier: currentPos.tier,
                      purchaseUnit: 'package',
                      clientCanViewGifts: Boolean(currentPos.canViewGifts),
                      clientPosId: currentPos.id,
                      service: srv,
                      catalog: srvCatalog,
                      supplier: activeSup,
                      superAdmin
                    })
                  : null;

              const isGiftService = pricing.isFreeGiftApplied;
              const giftStatus = isGiftService
                ? evaluateClientGiftServiceStatus({
                    service: srv,
                    catalog: srvCatalog,
                    clientPosId: currentPos.id,
                    clientTier: currentPos.tier,
                    clientCanViewGifts: Boolean(currentPos.canViewGifts),
                    usedGiftServiceIds: currentPos.usedGiftServiceIds,
                    orders,
                    nowMs,
                  })
                : null;
              const isGiftDeactivated = Boolean(giftStatus && !giftStatus.isActive);
              const tierPriceWithFee = formatCurrency(isGiftService ? 0 : pricing.totalAmount, { includeSymbol: false });

              return (
                <div
                  key={srv.id}
                  className={`p-5 rounded-3xl border transition-all flex flex-col justify-between gap-4 shadow-sm ${
                    isGiftDeactivated
                      ? 'bg-slate-900/60 border-slate-700/80 opacity-80'
                      : isGiftService
                      ? 'bg-gradient-to-br from-purple-950/25 via-slate-900 to-slate-900 border-purple-500/50 hover:border-purple-400/80 shadow-purple-500/10'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 overflow-hidden shadow-inner ${
                            isGiftDeactivated
                              ? 'bg-slate-800/80 border-slate-700 text-purple-400/60'
                              : isGiftService
                              ? 'bg-gradient-to-br from-purple-500/25 to-purple-700/15 border-purple-500/40 text-purple-300'
                              : 'bg-gradient-to-br from-amber-500/20 to-amber-700/10 border-amber-500/30 text-amber-400'
                          }`}
                        >
                          {srv.imageUrl ? (
                            <img src={srv.imageUrl} alt={srv.nameAr} className="w-full h-full object-cover" />
                          ) : (
                            <>
                              {isGiftService && <Gift className="w-6 h-6 text-purple-300" />}
                              {!isGiftService && srv.catalogId === 'cat-games' && <Gamepad2 className="w-6 h-6" />}
                              {!isGiftService && srv.catalogId === 'cat-cards' && <CreditCard className="w-6 h-6" />}
                              {!isGiftService && srv.catalogId === 'cat-stream' && <Tv className="w-6 h-6" />}
                              {!isGiftService && srv.catalogId === 'cat-apps' && <Sparkles className="w-6 h-6" />}
                              {!isGiftService && srv.catalogId === 'cat-free-gifts' && <Gift className="w-6 h-6 text-purple-400" />}
                              {!['cat-games', 'cat-cards', 'cat-stream', 'cat-apps', 'cat-free-gifts'].includes(srv.catalogId) && !isGiftService && (
                                <Gamepad2 className="w-6 h-6" />
                              )}
                            </>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className={`font-bold text-base ${isGiftDeactivated ? 'text-purple-300/70' : isGiftService ? 'text-purple-400' : 'text-white'}`}>
                              {srv.nameAr}
                            </h3>
                            {isGiftService && (
                              <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold">
                                🎁 هدية مجانية · {formatCurrency(0)}
                              </span>
                            )}
                            {isGiftDeactivated && giftStatus && (
                              <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                                {giftStatus.isExpired
                                  ? 'غير مفعلة · انتهت فترة الهدية'
                                  : `غير مفعلة · تم استنفاد الاستخدام (${giftStatus.usedCount}/${giftStatus.maxUses})`}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                            <span>{srv.packages.length} باقات متوفرة</span>
                            <span>·</span>
                            <span className={`${isGiftService ? 'text-purple-300' : 'text-amber-400'} font-medium`}>تسليم فوري</span>
                            {isGiftService && giftStatus && (
                              <>
                                <span>·</span>
                                <span className={isGiftDeactivated ? 'text-rose-300 font-semibold' : 'text-purple-300 font-semibold'}>
                                  {isGiftDeactivated
                                    ? giftStatus.isExpired
                                      ? 'انتهت الفترة المحددة للهدية'
                                      : `استخدمت ${giftStatus.usedCount} من ${giftStatus.maxUses}`
                                    : `متاح ${giftStatus.remainingUses} من ${giftStatus.maxUses} ${giftStatus.maxUses === 1 ? 'مرة' : 'مرات'}`}
                                </span>
                                {giftStatus.isActive && giftStatus.remainingMs !== null && (
                                  <>
                                    <span>·</span>
                                    <span className="text-purple-200 font-semibold flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-purple-300" />
                                      <span>تبقى {formatGiftRemainingTimeAr(giftStatus.remainingMs)}</span>
                                    </span>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                      {srv.descriptionAr}
                    </p>

                    {/* Categories / Packages Stock Preview */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
                      {srv.deliveryMethods.map(m => (
                        <span key={m} className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300">
                          {m === 'player_id' && 'فوري عبر الأيدي'}
                          {m === 'account_login' && 'فوري عبر الحساب'}
                          {m === 'voucher_code' && 'تسليم كود قسيمة'}
                        </span>
                      ))}
                      {(() => {
                        const hasVoucherCodes = serviceRequiresVoucherWarehouse(srv.deliveryMethods);
                        if (hasVoucherCodes) {
                          const totalStock = getServiceTotalStock(srv, voucherWarehouses);
                          return totalStock > 0 ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold font-mono">
                              {totalStock} كود متوفر
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold">
                              نفد المخزون
                            </span>
                          );
                        }
                        return (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold">
                            متوفرة دائماً
                          </span>
                        );
                      })()}
                    </div>

                    {serviceRequiresVoucherWarehouse(srv.deliveryMethods) &&
                      getPackagesForDeliveryMethod(srv, 'voucher_code').some(
                        p => Array.isArray(p.vouchers) || Boolean(p.warehouseId) || typeof p.availableStock === 'number'
                      ) && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {getPackagesForDeliveryMethod(srv, 'voucher_code').slice(0, 4).map(rawPkg => {
                          const pkg = mergeWarehouseOptionsIntoPackage(rawPkg, voucherWarehouses);
                          const pkgOpts = resolvePackagePurchaseOptions(pkg, voucherWarehouses);
                          const stock = getPackageAvailableStock(pkg, voucherWarehouses);
                          const isVouch = Array.isArray(pkg.vouchers) || Boolean(pkg.warehouseId);
                          if (typeof stock !== 'number') return null;
                          return (
                            <span
                              key={pkg.id}
                              className={`text-[10px] px-2 py-0.5 rounded-lg border flex items-center gap-1 ${
                                stock > 0
                                  ? 'bg-slate-950/80 border-slate-800 text-slate-300'
                                  : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                              }`}
                            >
                              <span className="truncate max-w-[140px]">{pkg.name}</span>
                              <span className="font-mono font-bold text-amber-400">
                                {stock > 0
                                  ? isVouch
                                    ? pkgOpts.allowPackage
                                      ? `(${stock} كود · ${pkgOpts.availablePackagesCount ?? 0} باقة)`
                                      : `(${stock} كود)`
                                    : `(${stock})`
                                  : '(نفد)'}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Pricing footer & CTA */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
                    {isGiftService && srv.packages.length > 1 ? (
                      <div>
                        <span className="text-[10px] text-purple-300 block">سعر الهدية لك:</span>
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-xl font-bold font-mono tabular-nums text-purple-300">
                            {formatCurrency(0, { includeSymbol: false })} <span className="text-xs font-normal">{currencyLabel}</span>
                          </span>
                          <span className="text-[11px] font-bold text-emerald-400">(مجاني)</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          اضغط شحن وشراء فوري لاختيار الباقة
                        </span>
                      </div>
                    ) : srv.packages.length > 1 ? (
                      <div>
                        <span className="text-[11px] font-medium text-slate-300 leading-relaxed block">
                          اضغط شحن وشراء فوري لإستعراض الباقات والاسعار
                        </span>
                      </div>
                    ) : primaryOpts?.allowSingleCode && primaryOpts?.allowPackage && packagePricing ? (
                      <div className="flex flex-wrap items-center gap-4">
                        <div>
                          <span className="text-[10px] text-slate-400 block">
                            {isGiftService ? 'السعر:' : 'سعر الكود الواحد:'}
                          </span>
                          {isGiftService ? (
                            <span className="text-lg font-bold font-mono tabular-nums text-purple-300">
                              {formatCurrency(0, { includeSymbol: false })} <span className="text-[11px] font-normal">{currencyLabel}</span>{' '}
                              <span className="text-xs font-sans text-emerald-400">(مجاني)</span>
                            </span>
                          ) : (
                            <span className="text-lg font-bold font-mono tabular-nums text-amber-400">
                              {tierPriceWithFee} <span className="text-[11px] font-normal">{currencyLabel}</span>
                            </span>
                          )}
                        </div>
                        <div className="pr-3 border-r border-slate-800">
                          <span className="text-[10px] text-cyan-300 flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            <span>{isGiftService ? 'السعر (باقة):' : `سعر الباقة (${primaryOpts.packageCodesCount} أكواد):`}</span>
                          </span>
                          {isGiftService || packagePricing.isFreeGiftApplied ? (
                            <span className="text-lg font-bold font-mono tabular-nums text-purple-300">
                              {formatCurrency(0, { includeSymbol: false })} <span className="text-[11px] font-normal">{currencyLabel}</span>{' '}
                              <span className="text-xs font-sans text-emerald-400">(مجاني)</span>
                            </span>
                          ) : (
                            <span className="text-lg font-bold font-mono tabular-nums text-cyan-300">
                              {formatCurrency(packagePricing.totalAmount, { includeSymbol: false })} <span className="text-[11px] font-normal">{currencyLabel}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="text-[10px] text-slate-400 block">
                          {isGiftService
                            ? 'السعر:'
                            : primaryOpts && !primaryOpts.allowSingleCode && primaryOpts.allowPackage
                            ? `سعر الباقة (${primaryOpts.packageCodesCount} أكواد) لرتبتك:`
                            : pricing.isZeroPriceFloorApplied
                            ? 'سعر باقة الأساس (الحد الأدنى):'
                            : 'سعر باقة الأساس لرتبتك:'}
                        </span>
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          {isGiftService ? (
                            <>
                              <span className="text-xl font-bold font-mono tabular-nums text-purple-300">
                                {formatCurrency(0, { includeSymbol: false })} <span className="text-xs font-normal">{currencyLabel}</span>
                              </span>
                              <span className="text-xs font-bold text-emerald-400">(مجاني)</span>
                            </>
                          ) : (
                            <span className="text-xl font-bold font-mono tabular-nums text-amber-400">
                              {tierPriceWithFee} <span className="text-xs font-normal">{currencyLabel}</span>
                            </span>
                          )}
                          {isGiftService && pricing.originalTierPrice > 0 && (
                            <span className="text-xs text-slate-500 line-through font-mono">
                              {formatCurrency(pricing.originalTierPrice)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={isGiftDeactivated}
                      onClick={() => {
                        if (isGiftDeactivated) return;
                        setActivePurchaseService(srv);
                      }}
                      className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-md shrink-0 whitespace-nowrap ${
                        isGiftDeactivated
                          ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed shadow-none'
                          : isGiftService
                          ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-500/25 cursor-pointer'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                      }`}
                    >
                      {isGiftService && <Gift className="w-3.5 h-3.5" />}
                      <span>{isGiftDeactivated ? 'غير مفعلة' : 'شحن وشراء فوري'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredServices.length === 0 && (
            <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2.5">
              <div className="text-sm font-bold text-slate-200">
                {emptyStoreState.title}
              </div>
              <p className="text-xs text-slate-400">
                {emptyStoreState.description}
              </p>
              {emptyStoreState.showResetFilterButton && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCatalogId('all');
                    setSearchService('');
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  عرض جميع الكتالوجات
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STATEMENT VIEW */}
      {activeNavTab === 'statement' && <StatementView />}

      {/* TAB 2B: LOANS MANAGEMENT VIEW (Only when authorized) */}
      {activeNavTab === 'loans' && currentPos.canRequestLoans && (
        <ClientLoansView
          onOpenNewLoan={() => setShowDepositModal(true)}
          onOpenRechargeWallet={() => setShowDepositModal(true)}
        />
      )}

      {/* TAB 2C: INCOMING SUPPLIER TRANSFERS REVIEW (Only when authorized) */}
      {activeNavTab === 'incoming_transfers' && canReceiveSupplierTransfers && (
        <IncomingTransfersReviewView />
      )}

      {/* TAB 3: ORDERS HISTORY */}
      {activeNavTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">سجل العمليات والشحنات السابقة</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                متابعة حالة شحن الأيدي من اللعبة لدى المتجر، والأكواد المستلمة، وتفاصيل العمليات.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">إجمالي الطلبات: {clientOrders.length}</span>
          </div>

          <div className="space-y-3">
            {clientOrders.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-xs">
                لا توجد طلبات أو عمليات شحن مسجلة لهذا الحساب حتى الآن.
              </div>
            ) : (
            clientOrders.map(order => {
              const isPending = order.status === 'pending_supplier' || order.status === 'in_progress';
              const isPlayerId = order.deliveryMethod === 'player_id';

              return (
                <div
                  key={order.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs ${
                    isPending && isPlayerId
                      ? 'bg-slate-900 border-amber-500/50 shadow-md ring-1 ring-amber-500/20'
                      : isPending
                      ? 'bg-slate-900 border-cyan-500/40'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-amber-400">#{order.id}</span>
                      <span className="text-slate-500">·</span>
                      <div className="flex items-center gap-1 font-bold text-white text-sm">
                        {isPlayerId && <Gamepad2 className="w-4 h-4 text-amber-400" />}
                        <span>{order.serviceName}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-950 border border-slate-800 text-slate-300">
                        {order.packageName}
                      </span>

                      {/* Status Badges */}
                      {isPending && isPlayerId ? (
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>بانتظار شحن المتجر من اللعبة</span>
                        </span>
                      ) : isPending ? (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>قيد المعالجة لدى المتجر</span>
                        </span>
                      ) : order.status === 'completed' ? (
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{isPlayerId ? 'تم الشحن من اللعبة بواسطة المتجر ✓' : 'مكتمل بنجاح ✓'}</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          ملغي ومسترد
                        </span>
                      )}
                    </div>

                    {/* Specific ID Delivery Details Highlight */}
                    {isPlayerId && (
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 font-semibold text-[11px]">معرف اللاعب (الأيدي):</span>
                          <span className="font-mono text-white font-bold select-all tracking-wider text-xs bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                            {order.deliveryDetails.playerId}
                          </span>
                          {order.deliveryDetails.playerNickname && (
                            <span className="text-slate-400 text-[11px]">({order.deliveryDetails.playerNickname})</span>
                          )}
                        </div>

                        {isPending ? (
                          <span className="text-[10px] text-amber-300">
                            أُرسل للمتجر للشحن من اللعبة
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-400">
                            تم الشحن من اللعبة بنجاح
                          </span>
                        )}
                      </div>
                    )}

                    {/* Account Login Delivery Details Highlight */}
                    {order.deliveryMethod === 'account_login' && (
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {order.deliveryDetails.accountType && (
                            <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-bold text-[11px]">
                              {order.deliveryDetails.accountType}
                            </span>
                          )}
                          <span className="text-cyan-400 font-semibold text-[11px]">الحساب:</span>
                          <span className="font-mono text-white font-bold select-all text-xs bg-slate-900 px-2 py-0.5 rounded border border-slate-700" dir="ltr">
                            {order.deliveryDetails.accountEmail || 'غير محدد'}
                          </span>
                        </div>
                        <span className={`text-[10px] ${isPending ? 'text-cyan-300' : 'text-emerald-400'}`}>
                          {isPending ? 'أُرسل للمتجر لتنفيذ الشحن عبر الحساب' : 'تم التنفيذ عبر الحساب بنجاح'}
                        </span>
                      </div>
                    )}

                    {/* Voucher Code delivery highlight */}
                    {order.deliveryMethod === 'voucher_code' && (order.deliveryDetails.voucherCodes?.length || order.deliveryDetails.voucherCode) && (() => {
                      const codesList =
                        order.deliveryDetails.voucherCodes && order.deliveryDetails.voucherCodes.length > 0
                          ? order.deliveryDetails.voucherCodes
                          : (order.deliveryDetails.voucherCode || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);

                      return (
                        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="text-amber-400 font-semibold text-[11px]">
                                {codesList.length > 1 ? `أكواد الباقة (${codesList.length} أكواد):` : 'كود القسيمة:'}
                              </span>
                              {order.purchaseUnit === 'package' && (
                                <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
                                  شراء بالباقة
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(codesList.join('\n'));
                                  showToast({
                                    type: 'success',
                                    title: codesList.length > 1 ? `تم نسخ جميع الأكواد (${codesList.length})` : 'تم نسخ الكود',
                                    description: `تم نسخ ${codesList.length} ${codesList.length === 1 ? 'كود' : 'أكواد'} للحافظة.`,
                                  });
                                }}
                                className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-[10px] font-bold text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Copy className="w-3 h-3" />
                                <span>
                                  {codesList.length > 1 || order.purchaseUnit === 'package'
                                    ? `نسخ جميع الأكواد (${codesList.length})`
                                    : 'نسخ الكود (1)'}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDownloadOrderVoucherPdf(order, codesList)}
                                disabled={exportingOrderPdfId === order.id}
                                className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 disabled:opacity-60 border border-cyan-500/30 text-[10px] font-bold text-cyan-300 flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                {exportingOrderPdfId === order.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <FileDown className="w-3 h-3" />
                                )}
                                <span>
                                  {exportingOrderPdfId === order.id ? 'جاري التجهيز...' : 'حفظ الأكواد PDF'}
                                </span>
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {codesList.map((code, idx) => (
                              <span
                                key={`${order.id}-code-${idx}`}
                                className="font-mono text-amber-300 font-bold select-all text-xs bg-slate-900 px-2.5 py-1 rounded border border-slate-700"
                              >
                                {code}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="text-slate-400 text-[11px] flex flex-wrap items-center gap-3">
                      {order.customerName && (
                        <span>الزبون: <strong className="text-slate-200">{order.customerName}</strong></span>
                      )}
                      <span>·</span>
                      <span className="font-mono text-slate-500">
                        {order.date} · طريقة الدفع: {order.paymentMethod === 'wallet' ? 'رصيد المحفظة' : 'فيزا كارد'}
                      </span>
                    </div>

                    {order.supplierNotes && (
                      <div className="text-[11px] text-slate-300 bg-slate-950/70 p-2 rounded-xl border border-slate-800/80">
                        ملاحظة المتجر: <span className="text-slate-200 font-medium">{order.supplierNotes}</span>
                      </div>
                    )}
                  </div>

                  <div className="text-left sm:text-left shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                    <div className="text-base font-bold font-mono text-white tabular-nums">
                      {(() => {
                        const orderSrv = services.find(s => s.id === order.serviceId);
                        const orderCat = orderSrv ? catalogs.find(c => c.id === orderSrv.catalogId) : undefined;
                        const isFreeGiftOrder = Boolean(order.isFreeGiftOrder || (orderCat && isCatalogFreeGifts(orderCat) && order.costPrice === 0));
                        if (isFreeGiftOrder) {
                          return <span className="text-purple-300 font-bold">{formatCurrency(0)} <span className="text-xs font-sans text-emerald-400">(مجاني)</span></span>;
                        }
                        return formatCurrency(order.totalDeducted);
                      })()}
                    </div>
                  </div>
                </div>
              );
            })
            )}
          </div>
        </div>
      )}

      {/* QR Code Modal for Reseller Identifier */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-4 text-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-white">رمز QR الخاص بنقطة البيع</h3>
              <button
                onClick={() => setShowQrModal(false)}
                className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Generated SVG QR Code representation */}
            <div className="p-6 bg-white rounded-2xl mx-auto w-56 h-56 flex flex-col items-center justify-center shadow-lg">
              <QrCode className="w-40 h-40 text-slate-950" />
              <div className="text-[10px] font-mono font-bold text-slate-900 mt-1">
                {currentPos.posCode}
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-bold text-base text-white">{currentPos.tradeName}</div>
              <div className="text-xs text-slate-400">{currentPos.ownerName} · {currentPos.city}</div>
              <div className="text-xs font-mono font-bold text-amber-400 pt-1">
                المعرف: {currentPos.posCode}
              </div>
            </div>

            <button
              onClick={handleCopyPosCode}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
            >
              {copiedPosCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedPosCode ? 'تم نسخ المعرف' : 'نسخ المعرف الرسمي'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Purchase Modal */}
      {activePurchaseService && (
        <PurchaseModal
          service={services.find(s => s.id === activePurchaseService.id) || activePurchaseService}
          onClose={() => setActivePurchaseService(null)}
        />
      )}

      {/* Deposit Modal */}
      {showDepositModal && (
        <DepositModal onClose={() => setShowDepositModal(false)} />
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <TransferModal onClose={() => setShowTransferModal(false)} />
      )}

      {/* Edit POS Profile Modal */}
      {showEditProfileModal && (
        <EditPosProfileModal onClose={() => setShowEditProfileModal(false)} />
      )}

    </div>
  );
};
