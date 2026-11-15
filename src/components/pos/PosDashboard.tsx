import React, { useState, useEffect } from 'react';
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
  Bell
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
import { calculateServicePurchasePricing, getEffectiveAppFeePercentage, isCatalogFreeGifts } from '../../utils/pricing';
import { getCatalogsForPosView } from '../../utils/platformSettings';

export const PosDashboard: React.FC = () => {
  const { currentPos, currentPosSupplier, superAdmin, catalogs, services, orders, depositRequests, loanRepaymentRequests, supplierBankAccounts, platformSettings, activeNavTab, setActiveNavTab, supplier, calculateFee, showToast, confirmClientOtpRead } = useApp();
  const giftAppFeePct = getEffectiveAppFeePercentage(currentPosSupplier || supplier, superAdmin);

  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('all');
  const [searchService, setSearchService] = useState('');
  
  // Modals
  const [activePurchaseService, setActivePurchaseService] = useState<DigitalService | null>(null);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [copiedPosCode, setCopiedPosCode] = useState(false);

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

  const activePosSupplierId = (currentPosSupplier || supplier).id;
  const visibleCatalogs = getCatalogsForPosView(catalogs, activePosSupplierId, Boolean(currentPos.canViewGifts));
  const freeGiftsCatalog = visibleCatalogs.find(c => isCatalogFreeGifts(c));

  useEffect(() => {
    if (activeNavTab === 'incoming_transfers' && !canReceiveSupplierTransfers) {
      setActiveNavTab('store');
    }
  }, [activeNavTab, canReceiveSupplierTransfers, setActiveNavTab]);

  useEffect(() => {
    if (!currentPos.canViewGifts && selectedCatalogId !== 'all') {
      const selCat = catalogs.find(c => c.id === selectedCatalogId);
      if (isCatalogFreeGifts(selCat)) {
        setSelectedCatalogId('all');
      }
    }
  }, [currentPos.canViewGifts, selectedCatalogId, catalogs]);

  // Live Supplier OTP Notification for the client
  const [supplierOtpNotification, setSupplierOtpNotification] = useState<{
    orderId: string;
    message: string;
    timestamp: number;
  } | null>(null);
  const [copiedNotificationCode, setCopiedNotificationCode] = useState(false);

  useEffect(() => {
    const handleLiveReply = (e: any) => {
      const { orderId, message } = e.detail || {};
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
  }, []);

  const handleCopyPosCode = () => {
    navigator.clipboard.writeText(currentPos.posCode);
    setCopiedPosCode(true);
    setTimeout(() => setCopiedPosCode(false), 2500);
  };

  // Filter services strictly by active POS supplier ID
  const filteredServices = services.filter(srv => {
    if (!srv.isActive) return false;
    if (srv.supplierId && srv.supplierId !== activePosSupplierId) return false;
    const srvCat = catalogs.find(c => c.id === srv.catalogId);
    if (isCatalogFreeGifts(srvCat) && !currentPos.canViewGifts) return false;
    if (selectedCatalogId !== 'all' && srv.catalogId !== selectedCatalogId) return false;
    if (searchService.trim()) {
      const q = searchService.toLowerCase();
      const matchName = srv.nameAr.toLowerCase().includes(q);
      const matchDesc = srv.descriptionAr.toLowerCase().includes(q);
      if (!matchName && !matchDesc) return false;
    }
    return true;
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

      {/* Active Special Client Features Banner (Gifts, Free Offers & Bonus Privileges) */}
      {(currentPos.canViewGifts || currentPos.canGetBonus) && (
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
                {currentPos.canGetBonus && (
                  <span className="px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1 text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>ميزة الحصول على بونص إضافي</span>
                  </span>
                )}
                {currentPos.canViewGifts && (
                  <span className="px-2.5 py-1 rounded-xl bg-purple-500/15 text-purple-300 border border-purple-500/30 font-bold flex items-center gap-1 text-[11px]">
                    <Gift className="w-3.5 h-3.5 text-purple-400" />
                    <span>ميزة ظهور الهدايا والعروض المجانية الحصرية</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {currentPos.canViewGifts && (
            <button
              type="button"
              onClick={() => {
                setActiveNavTab('store');
                if (freeGiftsCatalog) {
                  setSelectedCatalogId(freeGiftsCatalog.id);
                }
              }}
              className="px-3.5 py-2 rounded-2xl bg-purple-900/40 hover:bg-purple-800/50 border border-purple-500/30 text-purple-200 text-center sm:text-right shrink-0 transition-colors cursor-pointer"
            >
              <div className="font-bold text-xs text-purple-300 flex items-center gap-1.5 justify-center sm:justify-start">
                <Gift className="w-4 h-4 text-purple-300" />
                <span>🎁 هدايا وعروض مجانية متاحة (سعر 0 ر.س + {giftAppFeePct}% رسوم)</span>
              </div>
              <div className="text-[10px] text-purple-200/80 mt-0.5">
                {freeGiftsCatalog ? 'اضغط هنا لفتح كتالوج الهدايا المجانية الحصري.' : 'توجه للمتجر أو تواصل معه لتفعيل هديتك والعرض المجاني المخصص لك.'}
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

          {/* POS Code & QR Action + Tier Badge */}
          <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${tier.badgeColor} ${tier.borderColor} ${tier.textColor}`}>
                رتبة الحساب: {tier.nameAr}
              </span>

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
                {currentPos.walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                <span className="text-xs text-amber-400 font-sans font-medium">ر.س</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDepositModal(true)}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-amber-500/10"
            >
              <PlusCircle className="w-4 h-4" />
              <span>شحن رصيد كاش أو سلفة</span>
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
          <span>سجل العمليات السابقة ({orders.length})</span>
        </button>

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
          {/* Catalogs Horizontal Selector & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 pb-1 text-xs">
              <button
                onClick={() => setSelectedCatalogId('all')}
                className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
                  selectedCatalogId === 'all'
                    ? 'bg-slate-200 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                جميع الكتالوجات
              </button>

              {visibleCatalogs.map(cat => {
                const isSelected = selectedCatalogId === cat.id;
                const isGift = isCatalogFreeGifts(cat);
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCatalogId(cat.id)}
                    className={`px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
                      isSelected
                        ? isGift
                          ? 'bg-purple-500 text-white font-bold shadow-sm'
                          : 'bg-slate-200 text-slate-950 font-bold'
                        : isGift
                          ? 'bg-purple-950/50 text-purple-300 border border-purple-500/40 hover:bg-purple-900/60'
                          : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                    }`}
                  >
                    {isGift && <Gift className="w-3.5 h-3.5 shrink-0" />}
                    <span>{cat.nameAr}</span>
                  </button>
                );
              })}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchService}
                onChange={e => setSearchService(e.target.value)}
                placeholder="ابحث عن لعبة أو بطاقة..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-10 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Tier Pricing Explainer Card */}
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tier.badgeColor} ${tier.textColor}`}>
                رتبتك: {tier.nameAr}
              </span>
              <span className="text-slate-300">
                تظهر لك أسعار الخدمات الخاصة برتبتك مباشرة بتخفيض خاص لنقطة بيعك!
              </span>
            </div>
          </div>

          {/* Services Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredServices.map(srv => {
              // Get primary package price for this tier including platform fee / free gift / 0.5 SAR floor rules
              const primaryPkg = srv.packages[0];
              const srvCatalog = catalogs.find(c => c.id === srv.catalogId);
              const activeSup = currentPosSupplier || supplier;
              const pricing = calculateServicePurchasePricing({
                pkg: primaryPkg,
                clientTier: currentPos.tier,
                clientCanViewGifts: Boolean(currentPos.canViewGifts),
                catalog: srvCatalog,
                supplier: activeSup,
                superAdmin
              });
              const regularPricing = calculateServicePurchasePricing({
                pkg: primaryPkg,
                clientTier: 'regular',
                clientCanViewGifts: false,
                catalog: srvCatalog,
                supplier: activeSup,
                superAdmin
              });

              const tierPriceWithFee = pricing.totalAmount.toFixed(2);
              const regularPriceWithFee = regularPricing.totalAmount.toFixed(2);
              const isGiftService = pricing.isFreeGiftApplied;

              return (
                <div
                  key={srv.id}
                  className={`p-5 rounded-3xl bg-slate-900 border transition-all flex flex-col justify-between gap-4 shadow-sm ${
                    isGiftService
                      ? 'border-purple-500/40 hover:border-purple-400/70'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-700/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 overflow-hidden shadow-inner">
                          {srv.imageUrl ? (
                            <img src={srv.imageUrl} alt={srv.nameAr} className="w-full h-full object-cover" />
                          ) : (
                            <>
                              {srv.catalogId === 'cat-games' && <Gamepad2 className="w-6 h-6" />}
                              {srv.catalogId === 'cat-cards' && <CreditCard className="w-6 h-6" />}
                              {srv.catalogId === 'cat-stream' && <Tv className="w-6 h-6" />}
                              {srv.catalogId === 'cat-apps' && <Sparkles className="w-6 h-6" />}
                              {(isGiftService || srv.catalogId === 'cat-free-gifts') && <Gift className="w-6 h-6 text-purple-400" />}
                              {!['cat-games', 'cat-cards', 'cat-stream', 'cat-apps', 'cat-free-gifts'].includes(srv.catalogId) && !isGiftService && (
                                <Gamepad2 className="w-6 h-6" />
                              )}
                            </>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-base text-white">{srv.nameAr}</h3>
                            {isGiftService && (
                              <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold">
                                🎁 هدية مجانية (0 ر.س)
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span>{srv.packages.length} باقات متوفرة</span>
                            <span>·</span>
                            <span className="text-amber-400 font-medium">تسليم فوري</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                      {srv.descriptionAr}
                    </p>

                    {/* Delivery Methods Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
                      {srv.deliveryMethods.map(m => (
                        <span key={m} className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300">
                          {m === 'player_id' && 'فوري عبر الأيدي'}
                          {m === 'account_login' && 'فوري عبر الحساب'}
                          {m === 'voucher_code' && 'تسليم كود قسيمة'}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Pricing footer & CTA */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
                    {srv.packages.length > 1 ? (
                      <div>
                        <span className="text-[11px] font-medium text-slate-300 leading-relaxed block">
                          اضغط شراء لاستعراض الباقات والأسعار
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-[10px] text-slate-400 block">
                          {isGiftService
                            ? `سعر الخدمة 0 ر.س + رسوم التطبيق ${pricing.appFeePercentageApplied}%:`
                            : pricing.isZeroPriceFloorApplied
                            ? 'سعر باقة الأساس (الحد الأدنى):'
                            : 'سعر باقة الأساس لرتبتك:'}
                        </span>
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className={`text-xl font-bold font-mono tabular-nums ${isGiftService ? 'text-purple-300' : 'text-amber-400'}`}>
                            {tierPriceWithFee} <span className="text-xs font-normal">ر.س</span>
                          </span>
                          {isGiftService && pricing.originalTierPrice > 0 ? (
                            <span className="text-xs text-slate-500 line-through font-mono">
                              {pricing.originalTierPrice.toFixed(2)} ر.س
                            </span>
                          ) : (
                            platformSettings.showTierComparisonInPosStore && currentPos.tier !== 'regular' && regularPricing.totalAmount > pricing.totalAmount && (
                              <span className="text-xs text-slate-500 line-through font-mono">
                                {regularPriceWithFee} ر.س
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => setActivePurchaseService(srv)}
                      className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-md cursor-pointer shrink-0 whitespace-nowrap ${
                        isGiftService
                          ? 'bg-purple-500 hover:bg-purple-400 text-white'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      }`}
                    >
                      <span>{isGiftService ? 'استلام الهدية المجانية' : 'شحن وشراء فوري'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: STATEMENT VIEW */}
      {activeNavTab === 'statement' && <StatementView />}

      {/* TAB 2B: LOANS MANAGEMENT VIEW */}
      {activeNavTab === 'loans' && (
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
            <span className="text-xs text-slate-400 font-mono">إجمالي الطلبات: {orders.length}</span>
          </div>

          <div className="space-y-3">
            {orders.map(order => {
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

                    {/* Voucher Code delivery highlight */}
                    {order.deliveryMethod === 'voucher_code' && order.deliveryDetails.voucherCode && (
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 font-semibold text-[11px]">كود القسيمة:</span>
                          <span className="font-mono text-amber-300 font-bold select-all text-xs bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                            {order.deliveryDetails.voucherCode}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">كود فوري جاهز للنسخ</span>
                      </div>
                    )}

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
                      {order.totalDeducted.toFixed(2)} ر.س
                    </div>
                  </div>
                </div>
              );
            })}
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
          service={activePurchaseService}
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
