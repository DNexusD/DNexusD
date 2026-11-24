import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  DigitalService, 
  ServicePackage, 
  DeliveryMethod, 
  TIERS_CONFIG,
  WarehousePurchaseUnit
} from '../../types';
import { 
  X, 
  Gamepad2, 
  Lock, 
  Ticket, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Wallet, 
  CreditCard, 
  Loader2, 
  Printer, 
  Gift,
  Package,
  FileDown
} from 'lucide-react';
import {
  ZERO_PRICE_CLIENT_FLOOR_SAR,
  calculateServicePurchasePricing,
  evaluateClientGiftServiceStatus,
  formatGiftRemainingTimeAr,
} from '../../utils/pricing';
import {
  getPackageAvailableStock,
  isPackageOutOfStock,
  isPackageVoucherBacked,
  mergeWarehouseOptionsIntoPackage,
  resolvePackagePurchaseOptions,
  getPackagesForDeliveryMethod,
  getDeliveryMethodLabelAr,
} from '../../utils/voucherWarehouses';
import { downloadVoucherCodesPdf } from '../../utils/voucherPdf';
import { getServiceOrCodeAvailability } from '../../utils/availabilityMessages';
import {
  resolveGameProfileFromPackage,
  validatePlayerIdFormat,
} from '../../utils/gamePackageResolver';
import {
  GAME_LOGIN_ACCOUNT_TYPES,
  resolveGameAccountTypeLabel,
  validateAccountLoginCredentials,
} from '../../utils/gameAccountTypes';

interface PurchaseModalProps {
  service: DigitalService;
  onClose: () => void;
}

export const PurchaseModal: React.FC<PurchaseModalProps> = ({ service, onClose }) => {
  const { currentPos, currentPosSupplier, superAdmin, catalogs, services, orders, voucherWarehouses, supplier, platformSettings, executePurchase, showToast, activeCurrency, activeExchangeRate, currencyLabel, formatCurrency, convertToSar } = useApp();
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const liveService = services.find(s => s.id === service.id) || service;

  // Selected Delivery Method
  const [selectedMethod, setSelectedMethod] = useState<DeliveryMethod>(liveService.deliveryMethods[0]);
  const methodPackages = getPackagesForDeliveryMethod(liveService, selectedMethod);
  
  // Selected Package ID (resolved live against methodPackages so switching delivery methods shows its own packages)
  const [selectedPkgId, setSelectedPkgId] = useState<string>(
    () => getPackagesForDeliveryMethod(liveService, liveService.deliveryMethods[0])[0]?.id || ''
  );

  useEffect(() => {
    if (methodPackages.length === 0) {
      if (selectedPkgId !== '') setSelectedPkgId('');
      return;
    }
    if (!methodPackages.some(p => p.id === selectedPkgId)) {
      setSelectedPkgId(methodPackages[0].id);
    }
  }, [selectedMethod, methodPackages, selectedPkgId]);

  const rawSelectedPkg: ServicePackage | undefined =
    methodPackages.find(p => p.id === selectedPkgId) || methodPackages[0];
  const selectedPkg: ServicePackage | undefined = rawSelectedPkg
    ? mergeWarehouseOptionsIntoPackage(rawSelectedPkg, voucherWarehouses)
    : undefined;
  const selectedPkgOpts = selectedPkg
    ? resolvePackagePurchaseOptions(selectedPkg, voucherWarehouses)
    : undefined;
  const [selectedPurchaseUnit, setSelectedPurchaseUnit] = useState<WarehousePurchaseUnit>(
    selectedPkgOpts?.defaultPurchaseUnit || 'single_code'
  );
  const isVoucherDelivery = selectedMethod === 'voucher_code';
  const effectivePurchaseUnit: WarehousePurchaseUnit = !isVoucherDelivery
    ? 'single_code'
    : selectedPurchaseUnit === 'package' && selectedPkgOpts?.allowPackage
    ? 'package'
    : selectedPkgOpts?.allowSingleCode
    ? 'single_code'
    : selectedPkgOpts?.defaultPurchaseUnit || 'single_code';

  // Method 1: Player ID inputs
  const [playerId, setPlayerId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [idVerified, setIdVerified] = useState(false);
  const [idVerificationError, setIdVerificationError] = useState<string | null>(null);

  // Method 2: Account Login inputs (submitted directly via Confirm Payment button)
  const [accountType, setAccountType] = useState('');
  const [customAccountType, setCustomAccountType] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountError, setAccountError] = useState<string | null>(null);

  // Optional customer resale details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [resalePrice, setResalePrice] = useState<number | ''>('');

  // Payment Method
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'visa'>('wallet');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Order process state
  const [orderProcessing, setOrderProcessing] = useState(false);
  const [orderStage, setOrderStage] = useState<'in_progress' | 'completed' | null>(null);
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);
  const [completedOrderDate, setCompletedOrderDate] = useState<string>('');
  const [completedVoucherCode, setCompletedVoucherCode] = useState<string | null>(null);
  const [completedVoucherCodes, setCompletedVoucherCodes] = useState<string[]>([]);
  const [completedDeductedCount, setCompletedDeductedCount] = useState<number>(1);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [isExportingVoucherPdf, setIsExportingVoucherPdf] = useState(false);

  // Current tier pricing calculation (with 0.5 SAR zero-price floor & Free Gifts admin fee % rule)
  const currentTier = currentPos.tier;
  const currentTierInfo = TIERS_CONFIG[currentTier] || TIERS_CONFIG.regular;
  const serviceCatalog = catalogs.find(c => c.id === liveService.catalogId);
  const resolvedGameProfile = resolveGameProfileFromPackage({
    packageName: selectedPkg?.name || '',
    packageDescription: selectedPkg?.description || '',
    serviceName: liveService.nameAr,
    serviceDescription: liveService.descriptionAr,
    catalogName: serviceCatalog?.nameAr || '',
  });

  useEffect(() => {
    setIdVerified(false);
    setIdVerificationError(null);
    setZoneId('');
  }, [selectedPkgId, selectedMethod]);
  const giftStatus = evaluateClientGiftServiceStatus({
    service: liveService,
    catalog: serviceCatalog,
    clientPosId: currentPos.id,
    clientTier: currentTier,
    clientCanViewGifts: Boolean(currentPos.canViewGifts),
    usedGiftServiceIds: currentPos.usedGiftServiceIds,
    orders,
    nowMs,
  });
  const isGiftBlocked = giftStatus.isGiftCatalog && !giftStatus.isActive;
  const activeSup = currentPosSupplier || supplier;
  const selectedPricing = calculateServicePurchasePricing({
    pkg: selectedPkg,
    clientTier: currentTier,
    purchaseUnit: effectivePurchaseUnit,
    clientCanViewGifts: Boolean(currentPos.canViewGifts),
    clientPosId: currentPos.id,
    service: liveService,
    catalog: serviceCatalog,
    supplier: activeSup,
    superAdmin
  });
  const unitPrice = selectedPricing.unitPrice;
  const feeAmount = selectedPricing.feeAmount;
  const totalAmount = selectedPricing.totalAmount;
  const clientDisplayedTotal = selectedPricing.isFreeGiftApplied ? 0 : totalAmount;

  const selectedPkgStock = isVoucherDelivery && selectedPkg
    ? getPackageAvailableStock(selectedPkg, voucherWarehouses)
    : undefined;
  const selectedPkgIsOutOfStock = selectedPkg
    ? isPackageOutOfStock(selectedPkg, selectedMethod, voucherWarehouses, effectivePurchaseUnit)
    : true;
  const serviceAvailability = getServiceOrCodeAvailability({
    hasPackages: methodPackages.length > 0 && Boolean(selectedPkg),
    isOutOfStock: selectedPkgIsOutOfStock,
    deliveryMethod: selectedMethod,
    purchaseUnit: effectivePurchaseUnit,
    packageCodesCount: selectedPkgOpts?.packageCodesCount || 1,
    packageName: selectedPkg?.name || '',
    paymentMethod,
    walletBalance: currentPos.walletBalance,
    totalAmount,
    isFreeGiftApplied: selectedPricing.isFreeGiftApplied,
    currency: activeCurrency,
    exchangeRateSarPerUsd: activeExchangeRate,
  });

  // Handle local Player ID format check (without external lookup or fetching player name)
  const handleVerifyPlayerId = () => {
    const validation = validatePlayerIdFormat(
      playerId,
      resolvedGameProfile,
      resolvedGameProfile.requiresZoneId ? zoneId : undefined
    );

    if (!validation.valid) {
      const errorMsg = validation.error || 'يرجى التحقق من صحة معرف اللاعب المدخل.';
      setIdVerified(false);
      setIdVerificationError(errorMsg);
      showToast({
        type: 'error',
        title: 'تنبيه في صيغة الأيدي',
        description: errorMsg
      });
      return;
    }

    setIdVerified(true);
    setIdVerificationError(null);
    showToast({
      type: 'success',
      title: 'تم فحص الأيدي بنجاح',
      description: 'صيغة الأيدي صحيحة وجاهزة للإرسال إلى المتجر عند الدفع.'
    });
  };

  // Handle Purchase Confirmation
  const handleConfirmPurchase = async () => {
    setAccountError(null);

    if (isGiftBlocked) {
      showToast({
        type: 'error',
        title: 'الهدية غير مفعلة حالياً',
        description: giftStatus.isExpired
          ? 'انتهت الفترة المحددة لهذه الهدية وأصبحت غير مفعلة لديك.'
          : giftStatus.isUsageExhausted
          ? `لقد استخدمت هذه الهدية الحد الأقصى المسموح (${giftStatus.usedCount}/${giftStatus.maxUses}) وأصبحت غير مفعلة لديك.`
          : 'هذه الهدية غير متاحة لحسابك حالياً.',
      });
      return;
    }

    // Validation before purchase
    if (selectedMethod === 'player_id') {
      const idCheck = validatePlayerIdFormat(
        playerId,
        resolvedGameProfile,
        resolvedGameProfile.requiresZoneId ? zoneId : undefined
      );
      if (!idCheck.valid) {
        const msg = idCheck.error || 'يرجى إدخال معرف اللاعب (الأيدي) بشكل صحيح قبل الشراء.';
        setIdVerified(false);
        setIdVerificationError(msg);
        showToast({
          type: 'error',
          title: 'معرف اللاعب مطلوب',
          description: msg
        });
        return;
      }
      setIdVerificationError(null);
    }

    if (selectedMethod === 'account_login') {
      const accCheck = validateAccountLoginCredentials({
        accountType,
        customAccountType,
        accountEmail,
        accountPassword,
      });
      if (!accCheck.valid) {
        const msg = accCheck.error || 'يرجى إكمال بيانات الحساب قبل تأكيد الدفع.';
        setAccountError(msg);
        showToast({
          type: 'error',
          title: 'بيانات الحساب مطلوبة',
          description: msg
        });
        return;
      }
    }

    if (!selectedPricing.isFreeGiftApplied && paymentMethod === 'wallet' && currentPos.walletBalance < totalAmount) {
      const balanceCheck = getServiceOrCodeAvailability({
        hasPackages: methodPackages.length > 0 && Boolean(selectedPkg),
        isOutOfStock: false,
        deliveryMethod: selectedMethod,
        purchaseUnit: effectivePurchaseUnit,
        packageCodesCount: selectedPkgOpts?.packageCodesCount || 1,
        packageName: selectedPkg?.name || '',
        paymentMethod,
        walletBalance: currentPos.walletBalance,
        totalAmount,
        isFreeGiftApplied: selectedPricing.isFreeGiftApplied,
        currency: activeCurrency,
        exchangeRateSarPerUsd: activeExchangeRate,
      });
      showToast({
        type: 'error',
        title: balanceCheck.title || 'عدم توفر الرصيد المطلوب',
        description: balanceCheck.message
      });
      return;
    }

    if (methodPackages.length === 0 || !selectedPkg || selectedPkgIsOutOfStock) {
      const stockCheck = getServiceOrCodeAvailability({
        hasPackages: methodPackages.length > 0 && Boolean(selectedPkg),
        isOutOfStock: true,
        deliveryMethod: selectedMethod,
        purchaseUnit: effectivePurchaseUnit,
        packageCodesCount: selectedPkgOpts?.packageCodesCount || 1,
        packageName: selectedPkg?.name || '',
        paymentMethod,
        walletBalance: currentPos.walletBalance,
        totalAmount,
        isFreeGiftApplied: selectedPricing.isFreeGiftApplied,
        currency: activeCurrency,
        exchangeRateSarPerUsd: activeExchangeRate,
      });
      showToast({
        type: 'error',
        title: stockCheck.title,
        description: stockCheck.message
      });
      return;
    }

    setOrderProcessing(true);
    // Step 1: Notify user order is "قيد الإنجاز"
    setOrderStage('in_progress');
    showToast({
      type: 'info',
      title: 'العملية قيد الإنجاز...',
      description: 'جاري إرسال بيانات الشراء إلى المتجر ومعالجة التسليم الفوري.'
    });

    // Simulate supplier fulfillment turnaround
    setTimeout(async () => {
      const result = await executePurchase({
        service: liveService,
        pkg: selectedPkg,
        purchaseUnit: effectivePurchaseUnit,
        deliveryMethod: selectedMethod,
        deliveryDetails: {
          playerId:
            selectedMethod === 'player_id'
              ? resolvedGameProfile.requiresZoneId && zoneId.trim()
                ? `${playerId.trim()} (${zoneId.trim()})`
                : playerId.trim()
              : undefined,
          accountType: selectedMethod === 'account_login' ? resolveGameAccountTypeLabel(accountType, customAccountType) : undefined,
          accountEmail: selectedMethod === 'account_login' ? accountEmail.trim() : undefined,
          accountPassword: selectedMethod === 'account_login' ? accountPassword : undefined
        },
        paymentMethod,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        resalePrice: resalePrice ? convertToSar(Number(resalePrice)) : undefined
      });

      setOrderProcessing(false);

      if (result.success) {
        setOrderStage('completed');
        setCompletedOrderId(result.orderId || 'ORD-DONE');
        setCompletedOrderDate(new Date().toISOString().replace('T', ' ').substring(0, 16));
        const codesList = result.voucherCodes && result.voucherCodes.length > 0
          ? result.voucherCodes
          : result.voucherCode
          ? [result.voucherCode]
          : [];
        setCompletedVoucherCodes(codesList);
        setCompletedVoucherCode(result.voucherCode || (codesList.length > 0 ? codesList.join('\n') : null));
        setCompletedDeductedCount(result.deductedCount || codesList.length || 1);
      } else {
        setOrderStage(null);
      }
    }, 1800);
  };

  const copyVoucherToClipboard = () => {
    const textToCopy =
      completedVoucherCodes.length > 0
        ? completedVoucherCodes.join('\n')
        : completedVoucherCode || '';
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedCode(true);
      showToast({
        type: 'success',
        title: 'تم النسخ',
        description:
          completedVoucherCodes.length > 1
            ? `تم نسخ جميع الأكواد (${completedVoucherCodes.length}) للحافظة`
            : 'تم نسخ كود القسيمة للحافظة'
      });
      setTimeout(() => setCopiedCode(false), 3000);
    }
  };

  const handleSaveVoucherPdf = async () => {
    if (isExportingVoucherPdf || completedVoucherCodes.length === 0) return;
    setIsExportingVoucherPdf(true);
    try {
      const result = await downloadVoucherCodesPdf({
        orderId: completedOrderId || 'ORD-DONE',
        orderDate: completedOrderDate || new Date().toISOString().replace('T', ' ').substring(0, 16),
        serviceName: liveService.nameAr,
        packageName: selectedPkg?.name || '',
        packageTitleAr: selectedPkgOpts?.packageNameAr,
        packageDescription: selectedPkg?.description,
        purchaseUnit: effectivePurchaseUnit,
        codes: completedVoucherCodes,
        unitPrice: clientDisplayedTotal,
        feeAmount: 0,
        totalAmount: clientDisplayedTotal,
        paymentMethod,
        currency: activeCurrency,
        exchangeRateSarPerUsd: activeExchangeRate,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        supplier: {
          storeName: activeSup.storeName || activeSup.name,
          name: activeSup.name,
          phone: activeSup.phone,
          email: activeSup.email,
          country: activeSup.country,
          city: activeSup.city,
          logoUrl: activeSup.logoUrl,
        },
        client: {
          tradeName: currentPos.tradeName,
          ownerName: currentPos.ownerName,
          posCode: currentPos.posCode,
          phone: currentPos.phone,
          email: currentPos.email,
          country: currentPos.country,
          city: currentPos.city,
          tierNameAr: currentTierInfo.nameAr,
          logoUrl: currentPos.logoUrl,
        },
      });
      showToast({
        type: 'success',
        title: 'تم حفظ ملف الأكواد PDF',
        description: `تم حفظ الملف (${result.filename}) متضمناً ${result.codesCount} ${result.codesCount === 1 ? 'كود' : 'أكواد'}.`,
      });
    } catch {
      showToast({
        type: 'error',
        title: 'تعذر حفظ ملف PDF',
        description: 'حدث خطأ أثناء تجهيز ملف PDF، يرجى المحاولة مرة أخرى.',
      });
    } finally {
      setIsExportingVoucherPdf(false);
    }
  };

  const copyIdToClipboard = () => {
    if (playerId) {
      navigator.clipboard.writeText(playerId);
      setCopiedId(true);
      showToast({ type: 'success', title: 'تم النسخ', description: `تم نسخ الأيدي (${playerId}) للحافظة` });
      setTimeout(() => setCopiedId(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 text-slate-100 flex flex-col max-h-[92vh]">
        
        {/* Modal Top Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 overflow-hidden ${
                selectedPricing.isFreeGiftApplied
                  ? 'bg-purple-500/15 border-purple-500/40 text-purple-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              {service.imageUrl ? (
                <img src={service.imageUrl} alt={service.nameAr} className="w-full h-full object-cover" />
              ) : selectedPricing.isFreeGiftApplied ? (
                <Gift className="w-5 h-5 text-purple-400" />
              ) : (
                <Gamepad2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3
                className={`font-bold text-base sm:text-lg leading-tight ${
                  selectedPricing.isFreeGiftApplied ? 'text-purple-400' : 'text-white'
                }`}
              >
                {service.nameAr}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span>المتجر: {activeSup.storeName || activeSup.name}</span>
                <span>·</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${currentTierInfo.badgeColor} ${currentTierInfo.textColor}`}>
                  رتبتك: {currentTierInfo.nameAr}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">

          {/* If Order is in progress */}
          {orderStage === 'in_progress' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 animate-spin">
                <Loader2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xl font-bold text-white">العملية قيد الإرسال...</h4>
                <p className="text-sm text-slate-400 max-w-sm">
                  {selectedMethod === 'player_id' 
                    ? `جاري خصم المبلغ وإرسال طلب الشحن مع الأيدي إلى المتجر (${activeSup.storeName || activeSup.name}) للشحن من اللعبة.`
                    : 'يتم الآن إرسال بيانات الشراء والتحقق من حساب المستلم وخصم المبلغ.'}
                </p>
              </div>
            </div>
          )}

          {/* If Order completed / dispatched */}
          {orderStage === 'completed' && (
            <div className="py-6 flex flex-col items-center text-center space-y-5 animate-in fade-in zoom-in-95">
              
              {/* Distinct icon & header for Player ID dispatched to the المتجر */}
              {selectedMethod === 'player_id' ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 animate-pulse">
                    <Gamepad2 className="w-9 h-9" />
                  </div>

                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>أُرسل للمتجر · بانتظار الشحن من داخل اللعبة</span>
                    </div>
                    <h4 className="text-xl sm:text-2xl font-bold text-white">
                      تم إرسال الطلب مع الأيدي إلى المتجر بنجاح!
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                      تم استلام طلب الشحن وإرفاق معرّف اللاعب (الأيدي) وإرساله مباشرة إلى المتجر <strong className="text-amber-400">({activeSup.storeName || activeSup.name})</strong> ليكمل شحن الحساب من داخل اللعبة.
                    </p>
                  </div>

                  {/* Visual 3-Step Live Progress Tracker */}
                  <div className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-right text-xs">
                    <span className="font-bold text-slate-300 block text-[11px]">مراحل تنفيذ شحن الأيدي:</span>
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                      <div className="p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 flex flex-col items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold">1. خصم الرصيد</span>
                        <span className="text-[9px] text-slate-400">تم حجز المبلغ</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 flex flex-col items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold">2. إرسال الأيدي للمتجر</span>
                        <span className="text-[9px] text-slate-400">تم التوصيل للوحة</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 flex flex-col items-center gap-1 animate-pulse">
                        <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                        <span className="font-bold">3. الشحن باللعبة</span>
                        <span className="text-[9px] text-amber-400 font-semibold">يقوم المتجر بالشحن الآن</span>
                      </div>
                    </div>
                  </div>

                  {/* Player ID Prominent Card with Instant Copy Button */}
                  <div className="w-full p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-950 to-slate-950 border border-amber-500/40 text-right space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">بيانات الأيدي المرسلة للمتجر:</span>
                      <span className="text-amber-400 font-bold text-xs">شحن عبر الأيدي</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div>
                        <div className="text-[10px] text-slate-400">معرف اللاعب (Player ID):</div>
                        <div className="font-mono text-lg font-black text-amber-300 tracking-wider select-all">{playerId}</div>
                      </div>
                      <button
                        onClick={copyIdToClipboard}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
                      >
                        {copiedId ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-400" />}
                        <span>{copiedId ? 'تم النسخ!' : 'نسخ الأيدي'}</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-[20px] font-bold text-white">
                      {selectedMethod === 'voucher_code'
                        ? completedVoucherCodes.length > 1 || effectivePurchaseUnit === 'package'
                          ? `تم شراء باقة الأكواد (${completedVoucherCodes.length} أكواد) بنجاح`
                          : 'تم شراء كود الشحن وتسليمه بنجاح'
                        : 'تم إرسال الطلب وبيانات الحساب بنجاح'}
                    </h4>
                    <p className="text-xs sm:text-sm text-cyan-300 font-medium">
                      رقم الطلب #{completedOrderId}
                    </p>
                  </div>

                  {/* If voucher code delivery method */}
                  {selectedMethod === 'voucher_code' && (completedVoucherCodes.length > 0 || completedVoucherCode) && (
                    <div className="w-full p-4 rounded-2xl bg-slate-950 border border-amber-500/40 space-y-3">
                      <div className="text-xs text-slate-400 flex items-center justify-between">
                        <span>
                          {completedVoucherCodes.length > 1 || effectivePurchaseUnit === 'package'
                            ? `أكواد الباقة المستلمة (${completedVoucherCodes.length} ${completedVoucherCodes.length === 1 ? 'كود' : 'أكواد'}):`
                            : 'كود القسيمة الرقمية الجاهز للنسخ:'}
                        </span>
                        <span className="text-amber-400 font-bold">
                          {completedVoucherCodes.length > 1 || effectivePurchaseUnit === 'package'
                            ? 'تسليم فوري باقة'
                            : 'تسليم فوري كود'}
                        </span>
                      </div>

                      {completedVoucherCodes.length > 1 ? (
                        <div className="space-y-2.5">
                          <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                            {completedVoucherCodes.map((codeItem, idx) => (
                              <div
                                key={`${codeItem}-${idx}`}
                                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs font-bold text-amber-300 select-all"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-slate-500">#{idx + 1}</span>
                                  <span dir="ltr">{codeItem}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(codeItem);
                                    showToast({ type: 'success', title: 'تم النسخ', description: `تم نسخ الكود #${idx + 1}` });
                                  }}
                                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                                >
                                  <Copy className="w-3 h-3" />
                                  <span>نسخ</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-base font-bold text-amber-300 select-all">
                          <span dir="ltr">{completedVoucherCode}</span>
                          <button
                            type="button"
                            onClick={copyVoucherToClipboard}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5 text-amber-400" />
                            <span>{copiedCode ? 'تم النسخ!' : 'نسخ'}</span>
                          </button>
                        </div>
                      )}

                      {/* Primary Voucher Package Actions: Copy All (count) + Save PDF */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={copyVoucherToClipboard}
                          className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>
                            {copiedCode
                              ? `تم نسخ جميع الأكواد (${completedVoucherCodes.length})!`
                              : `نسخ جميع الأكواد (${completedVoucherCodes.length})`}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSaveVoucherPdf}
                          disabled={isExportingVoucherPdf}
                          className="w-full py-2.5 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                        >
                          {isExportingVoucherPdf ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FileDown className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {isExportingVoucherPdf ? 'جاري تجهيز PDF...' : 'حفظ الأكواد كملف PDF'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Summary Receipt Card */}
              <div className="w-full p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-right space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                  <span>الخدمة المطلوبة:</span>
                  <span className={`font-semibold ${selectedPricing.isFreeGiftApplied ? 'text-purple-400' : 'text-white'}`}>
                    {service.nameAr}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                  <span>الباقة / الفئة:</span>
                  <span className="font-semibold text-white">
                    {selectedPkg?.name || ''}
                    {isVoucherDelivery && completedDeductedCount > 1 && (
                      <span className="mr-1.5 text-cyan-300 font-mono text-[11px]">
                        ({completedDeductedCount} أكواد)
                      </span>
                    )}
                    {isVoucherDelivery && selectedPkg && selectedPkgStock !== undefined && (
                      <span className={`mr-2 font-mono text-[11px] ${selectedPkgStock > 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                        ({isPackageVoucherBacked(selectedPkg, voucherWarehouses) ? `المتبقي: ${selectedPkgStock} كود` : `المخزون المتبقي: ${selectedPkgStock}`})
                      </span>
                    )}
                  </span>
                </div>
                {selectedMethod === 'player_id' && (
                  <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                    <span>المستلم (الأيدي في اللعبة):</span>
                    <span className="font-mono font-bold text-amber-400">{playerId}</span>
                  </div>
                )}
                {selectedMethod === 'account_login' && (
                  <>
                    <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                      <span>نوع الحساب:</span>
                      <span className="font-semibold text-cyan-300">
                        {resolveGameAccountTypeLabel(accountType, customAccountType)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                      <span>الحساب الموثق:</span>
                      <span className="font-mono text-amber-400">{accountEmail}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                  <span>المتجر البائع:</span>
                  <span className="font-semibold text-white">{activeSup.storeName || activeSup.name}</span>
                </div>
                <div className={`flex justify-between py-1.5 font-bold text-sm ${selectedPricing.isFreeGiftApplied ? 'text-purple-300' : 'text-emerald-400'}`}>
                  <span>{selectedPricing.isFreeGiftApplied ? 'السعر:' : 'سعر الخدمة الإجمالي:'}</span>
                  <span className="font-mono tabular-nums">
                    {selectedPricing.isFreeGiftApplied ? (
                      <span className="text-purple-300 font-bold">
                        {formatCurrency(0)} <span className="text-emerald-400 font-sans">(مجاني)</span>
                      </span>
                    ) : (
                      formatCurrency(clientDisplayedTotal)
                    )}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center justify-center gap-2 border border-slate-700 transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة إيصال الزبون بالأيدي</span>
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center transition-colors cursor-pointer"
                >
                  تم، إغلاق ومتابعة الطلب
                </button>
              </div>
            </div>
          )}

          {/* Form Wizard when not yet submitted */}
          {!orderStage && (
            <>
              {/* Step 1: Choose Delivery Method */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  1. اختر طريقة تسليم الخدمة:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {liveService.deliveryMethods.map(method => {
                    const isSelected = selectedMethod === method;
                    const countForMethod = getPackagesForDeliveryMethod(liveService, method).length;
                    let label = '';
                    let sub = '';
                    let icon = null;

                    if (method === 'player_id') {
                      label = 'فوري عبر الأيدي';
                      sub = 'معرف اللاعب والتحقق';
                      icon = <Gamepad2 className="w-4 h-4" />;
                    } else if (method === 'account_login') {
                      label = 'فوري عبر الحساب';
                      sub = 'إيميل وكلمة مرور الحساب';
                      icon = <Lock className="w-4 h-4" />;
                    } else {
                      label = 'عبر تسليم الكود';
                      sub = 'قسيمة رقمية جاهزة للنسخ';
                      icon = <Ticket className="w-4 h-4" />;
                    }

                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => {
                          setSelectedMethod(method);
                          const nextPkgs = getPackagesForDeliveryMethod(liveService, method);
                          const nextFirst = nextPkgs[0];
                          setSelectedPkgId(nextFirst?.id || '');
                          if (nextFirst) {
                            const mergedFirst = method === 'voucher_code'
                              ? mergeWarehouseOptionsIntoPackage(nextFirst, voucherWarehouses)
                              : nextFirst;
                            const firstOpts = resolvePackagePurchaseOptions(mergedFirst, voucherWarehouses);
                            setSelectedPurchaseUnit(method === 'voucher_code' ? firstOpts.defaultPurchaseUnit : 'single_code');
                          }
                        }}
                        className={`p-3 rounded-2xl border text-right transition-all flex flex-col gap-1.5 ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500 text-white shadow-sm ring-1 ring-amber-500/30'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`p-1.5 rounded-lg ${isSelected ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                            {icon}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono tabular-nums text-slate-400">
                              {countForMethod} باقة
                            </span>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                          </div>
                        </div>
                        <span className="font-bold text-xs mt-1 text-white">{label}</span>
                        <span className="text-[10px] text-slate-400 leading-snug">{sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Choose Package (filtered for selectedMethod) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    2. اختر باقة / فئة الشحن ({getDeliveryMethodLabelAr(selectedMethod)}):
                  </label>
                  <span className="text-[10px] font-mono tabular-nums text-slate-400">
                    {methodPackages.length} باقات
                  </span>
                </div>
                <div className="space-y-2">
                  {methodPackages.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
                      لا توجد باقات متاحة لطريقة "{getDeliveryMethodLabelAr(selectedMethod)}" حالياً.
                    </div>
                  ) : methodPackages.map(rawPkg => {
                    const pkg = isVoucherDelivery
                      ? mergeWarehouseOptionsIntoPackage(rawPkg, voucherWarehouses)
                      : rawPkg;
                    const pkgOpts = resolvePackagePurchaseOptions(pkg, voucherWarehouses);
                    const isSelected = selectedPkg?.id === pkg.id;
                    const pkgStock = isVoucherDelivery ? getPackageAvailableStock(pkg, voucherWarehouses) : undefined;
                    const pkgIsVoucher = isVoucherDelivery && isPackageVoucherBacked(pkg, voucherWarehouses);
                    const pkgOutOfStock = isPackageOutOfStock(pkg, selectedMethod, voucherWarehouses);

                    const singlePricing = calculateServicePurchasePricing({
                      pkg,
                      clientTier: currentTier,
                      purchaseUnit: 'single_code',
                      clientCanViewGifts: Boolean(currentPos.canViewGifts),
                      clientPosId: currentPos.id,
                      service: liveService,
                      catalog: serviceCatalog,
                      supplier: activeSup,
                      superAdmin
                    });
                    const packagePricing = isVoucherDelivery && pkgOpts.allowPackage
                      ? calculateServicePurchasePricing({
                          pkg,
                          clientTier: currentTier,
                          purchaseUnit: 'package',
                          clientCanViewGifts: Boolean(currentPos.canViewGifts),
                          clientPosId: currentPos.id,
                          service: liveService,
                          catalog: serviceCatalog,
                          supplier: activeSup,
                          superAdmin
                        })
                      : null;

                    const displayPricing =
                      !isVoucherDelivery || pkgOpts.allowSingleCode || !packagePricing
                        ? singlePricing
                        : packagePricing;
                    const pkgTotalWithFee = formatCurrency(displayPricing.isFreeGiftApplied ? 0 : displayPricing.totalAmount, { includeSymbol: false });
                    const savings = Math.max(0, displayPricing.originalTierPrice - displayPricing.unitPrice);

                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => {
                          setSelectedPkgId(pkg.id);
                          setSelectedPurchaseUnit(isVoucherDelivery ? pkgOpts.defaultPurchaseUnit : 'single_code');
                        }}
                        className={`w-full p-3.5 rounded-2xl border text-right transition-all flex items-center justify-between gap-3 ${
                          pkgOutOfStock
                            ? 'bg-rose-950/20 border-rose-500/40 text-slate-400 opacity-85'
                            : isSelected
                            ? displayPricing.isFreeGiftApplied
                              ? 'bg-purple-500/15 border-purple-500 ring-1 ring-purple-500/30 text-white'
                              : 'bg-amber-500/15 border-amber-500 ring-1 ring-amber-500/30 text-white'
                            : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold text-sm text-white flex items-center gap-2 flex-wrap">
                            <span>{pkg.name}</span>
                            {!isVoucherDelivery ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>متوفرة دائماً</span>
                              </span>
                            ) : (
                              <>
                                {pkgStock !== undefined && (
                                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                                    pkgStock > 0
                                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  }`}>
                                    <Ticket className="w-3 h-3" />
                                    <span>
                                      {pkgStock > 0
                                        ? pkgIsVoucher
                                          ? `${pkgStock} كود متوفر`
                                          : `المخزون: ${pkgStock}`
                                        : 'نفد المخزون'}
                                    </span>
                                  </span>
                                )}
                                {pkgOpts.allowPackage && typeof pkgOpts.availablePackagesCount === 'number' && (
                                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                                    pkgOpts.availablePackagesCount > 0
                                      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                                      : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                  }`}>
                                    <Package className="w-3 h-3" />
                                    <span>
                                      {pkgOpts.availablePackagesCount > 0
                                        ? `${pkgOpts.availablePackagesCount} باقة (${pkgOpts.packageCodesCount} أكواد/باقة)`
                                        : `أقل من باقة (${pkgOpts.packageCodesCount} أكواد)`}
                                    </span>
                                  </span>
                                )}
                              </>
                            )}
                            {displayPricing.isFreeGiftApplied ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                🎁 هدية مجانية · {formatCurrency(0)}
                              </span>
                            ) : displayPricing.isZeroPriceFloorApplied ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                قيمة دنيا {formatCurrency(ZERO_PRICE_CLIENT_FLOOR_SAR)}
                              </span>
                            ) : null}
                          </div>
                          {pkg.description && (
                            <div className="text-xs text-slate-400">{pkg.description}</div>
                          )}
                          {displayPricing.isFreeGiftApplied ? (
                            <div className="text-[10px] text-purple-300/90 flex items-center gap-2 pt-0.5 flex-wrap">
                              <span>السعر الأصلي لرتبتك: {formatCurrency(displayPricing.originalTierPrice)}</span>
                              <span>·</span>
                              <span>السعر: <strong className="text-purple-200 font-bold font-mono">{formatCurrency(0)}</strong> <strong className="text-emerald-400 font-bold">(مجاني)</strong></span>
                              {savings > 0 && (
                                <span className="text-emerald-400 font-semibold">(توفير {formatCurrency(savings)})</span>
                              )}
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400 pt-0.5">
                              سعر رتبة حسابك ({currentTierInfo.nameAr})
                              {isVoucherDelivery && pkgOpts.allowSingleCode && pkgOpts.allowPackage && ' · متاح الشراء بالكود الواحد أو بالباقة'}
                              {isVoucherDelivery && !pkgOpts.allowSingleCode && pkgOpts.allowPackage && ` · شراء بالباقة (${pkgOpts.packageCodesCount} أكواد)`}
                            </div>
                          )}
                        </div>

                        <div className="text-left shrink-0 pl-2 space-y-0.5">
                          {(!isVoucherDelivery || pkgOpts.allowSingleCode) && (
                            <div className={`text-sm font-bold font-mono ${singlePricing.isFreeGiftApplied ? 'text-purple-300' : 'text-amber-400'}`}>
                              {singlePricing.isFreeGiftApplied ? (
                                <span>{formatCurrency(0)} <span className="text-[10px] font-sans text-emerald-400">(مجاني)</span> <span className="text-[10px] font-normal text-slate-400">{isVoucherDelivery && pkgOpts.allowPackage ? '/ كود' : ''}</span></span>
                              ) : (
                                <>{formatCurrency(singlePricing.totalAmount, { includeSymbol: false })} <span className="text-[10px] font-normal">{currencyLabel} {isVoucherDelivery && pkgOpts.allowPackage ? '/ كود' : ''}</span></>
                              )}
                            </div>
                          )}
                          {isVoucherDelivery && pkgOpts.allowPackage && packagePricing && (
                            <div className={`text-xs font-bold font-mono ${pkgOpts.allowSingleCode ? (packagePricing.isFreeGiftApplied ? 'text-purple-300' : 'text-cyan-300') : 'text-base text-amber-400'}`}>
                              {packagePricing.isFreeGiftApplied ? (
                                <span>{formatCurrency(0)} <span className="text-[10px] font-sans text-emerald-400">(مجاني)</span> <span className="text-[10px] font-normal text-slate-400">/ باقة ({pkgOpts.packageCodesCount})</span></span>
                              ) : (
                                <>{formatCurrency(packagePricing.totalAmount, { includeSymbol: false })} <span className="text-[10px] font-normal">{currencyLabel} / باقة ({pkgOpts.packageCodesCount})</span></>
                              )}
                            </div>
                          )}
                          {isVoucherDelivery && !pkgOpts.allowSingleCode && !pkgOpts.allowPackage && (
                            <div className={`text-base font-bold font-mono ${displayPricing.isFreeGiftApplied ? 'text-purple-300' : 'text-amber-400'}`}>
                              {displayPricing.isFreeGiftApplied ? (
                                <span>{formatCurrency(0)} <span className="text-xs font-sans text-emerald-400">(مجاني)</span></span>
                              ) : (
                                <>{pkgTotalWithFee} <span className="text-xs font-normal">{currencyLabel}</span></>
                              )}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2B: Purchase Unit Selector (Single Code vs Package) when package mode is enabled */}
              {isVoucherDelivery && selectedPkg && selectedPkgOpts && selectedPkgOpts.allowPackage && (() => {
                const singleOptPricing = calculateServicePurchasePricing({
                  pkg: selectedPkg,
                  clientTier: currentTier,
                  purchaseUnit: 'single_code',
                  clientCanViewGifts: Boolean(currentPos.canViewGifts),
                  clientPosId: currentPos.id,
                  service: liveService,
                  catalog: serviceCatalog,
                  supplier: activeSup,
                  superAdmin
                });
                const packageOptPricing = calculateServicePurchasePricing({
                  pkg: selectedPkg,
                  clientTier: currentTier,
                  purchaseUnit: 'package',
                  clientCanViewGifts: Boolean(currentPos.canViewGifts),
                  clientPosId: currentPos.id,
                  service: liveService,
                  catalog: serviceCatalog,
                  supplier: activeSup,
                  superAdmin
                });
                const codesAvailable = selectedPkgOpts.availableCodesCount;
                const pkgsAvailable = selectedPkgOpts.availablePackagesCount;
                const singleBlocked = isPackageOutOfStock(selectedPkg, selectedMethod, voucherWarehouses, 'single_code');
                const pkgBlocked = isPackageOutOfStock(selectedPkg, selectedMethod, voucherWarehouses, 'package');

                return (
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-cyan-500/30 space-y-2.5">
                    <label className="block text-xs font-bold text-cyan-300">
                      اختر وحدة الشراء من المخزن:
                    </label>
                    <div className={`grid grid-cols-1 ${selectedPkgOpts.allowSingleCode ? 'sm:grid-cols-2' : ''} gap-2`}>
                      {selectedPkgOpts.allowSingleCode && (
                        <button
                          type="button"
                          onClick={() => setSelectedPurchaseUnit('single_code')}
                          className={`p-3 rounded-xl border text-right transition-all flex items-center justify-between gap-2 cursor-pointer ${
                            effectivePurchaseUnit === 'single_code'
                              ? 'bg-amber-500/15 border-amber-500 ring-1 ring-amber-500/40 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="font-bold text-xs flex items-center gap-1.5 text-white">
                              <Ticket className="w-3.5 h-3.5 text-amber-400" />
                              <span>شراء كود واحد (1 كود)</span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {typeof codesAvailable === 'number'
                                ? singleBlocked
                                  ? 'نفد المخزون'
                                  : `متوفر ${codesAvailable} كود`
                                : 'تسليم كود فوري'}
                            </div>
                          </div>
                          <div className={`font-mono font-bold text-sm shrink-0 ${singleOptPricing.isFreeGiftApplied ? 'text-purple-300' : 'text-amber-400'}`}>
                            {singleOptPricing.isFreeGiftApplied ? (
                              <span>{formatCurrency(0)} <span className="text-[10px] font-sans text-emerald-400">(مجاني)</span></span>
                            ) : (
                              <>{formatCurrency(singleOptPricing.totalAmount, { includeSymbol: false })} <span className="text-[10px] font-normal">{currencyLabel}</span></>
                            )}
                          </div>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedPurchaseUnit('package')}
                        className={`p-3 rounded-xl border text-right transition-all flex items-center justify-between gap-2 cursor-pointer ${
                          effectivePurchaseUnit === 'package'
                            ? 'bg-cyan-500/15 border-cyan-500 ring-1 ring-cyan-500/40 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                          <div className="space-y-0.5">
                            <div className="font-bold text-xs flex items-center gap-1.5 text-white">
                              <Package className="w-3.5 h-3.5 text-cyan-400" />
                              <span>{selectedPkgOpts.packageNameAr}</span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              <span>{selectedPkgOpts.packageCodesCount} أكواد دفعة واحدة</span>
                              {typeof pkgsAvailable === 'number' && (
                                <span className={`mr-1 font-mono ${pkgBlocked ? 'text-rose-400' : 'text-cyan-300'}`}>
                                  · {pkgBlocked ? 'غير كافٍ لباقة' : `${pkgsAvailable} باقة متاحة`}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className={`font-mono font-bold text-sm shrink-0 ${packageOptPricing.isFreeGiftApplied ? 'text-purple-300' : 'text-cyan-300'}`}>
                            {packageOptPricing.isFreeGiftApplied ? (
                              <span>{formatCurrency(0)} <span className="text-[10px] font-sans text-emerald-400">(مجاني)</span></span>
                            ) : (
                              <>{formatCurrency(packageOptPricing.totalAmount, { includeSymbol: false })} <span className="text-[10px] font-normal">{currencyLabel}</span></>
                            )}
                          </div>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Step 3: Input Delivery Specific Fields */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                
                {/* METHOD 1: Instant via Player ID */}
                {selectedMethod === 'player_id' && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <Gamepad2 className="w-4 h-4 text-amber-400" />
                        أدخل الأيدي الخاص بمن تريد بيع الخدمة له:
                      </span>
                      {idVerified && (
                        <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          تم فحص صيغة الأيدي بنجاح
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px]">
                      <span className="text-slate-400">
                        نوع اللعبة من الباقة:{' '}
                        <strong className="text-amber-300 font-semibold">{resolvedGameProfile.gameLabelAr}</strong>
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={playerId}
                        onChange={e => {
                          setPlayerId(e.target.value);
                          setIdVerified(false);
                          setIdVerificationError(null);
                        }}
                        placeholder={resolvedGameProfile.idPlaceholder}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                      />
                      {resolvedGameProfile.requiresZoneId && (
                        <input
                          type="text"
                          value={zoneId}
                          onChange={e => {
                            setZoneId(e.target.value);
                            setIdVerified(false);
                            setIdVerificationError(null);
                          }}
                          placeholder={resolvedGameProfile.zonePlaceholder || 'Zone ID'}
                          className="sm:w-36 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                        />
                      )}
                      <button
                        type="button"
                        onClick={handleVerifyPlayerId}
                        disabled={!playerId.trim()}
                        className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                      >
                        <span>فحص الأيدي</span>
                      </button>
                    </div>

                    {idVerificationError && (
                      <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/35 text-xs text-rose-200 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <span>{idVerificationError}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* METHOD 2: Instant via Account Login */}
                {selectedMethod === 'account_login' && (
                  <div className="space-y-3">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-amber-400" />
                      التسليم عبر الحساب (سيتم إرسال نوع الحساب والإيميل وكلمة المرور عند تأكيد الدفع):
                    </span>

                    {accountError && (
                      <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>{accountError}</div>
                      </div>
                    )}

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">نوع الحساب المرتبط باللعبة:</label>
                        <select
                          required
                          value={accountType}
                          onChange={e => {
                            setAccountType(e.target.value);
                            if (e.target.value !== 'other') {
                              setCustomAccountType('');
                            }
                            if (accountError) setAccountError(null);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                        >
                          <option value="">-- اختر نوع الحساب (جوجل، فيسبوك، تويتر...) --</option>
                          {GAME_LOGIN_ACCOUNT_TYPES.map(opt => (
                            <option key={opt.id} value={opt.id}>
                              {opt.labelAr}
                            </option>
                          ))}
                        </select>
                      </div>

                      {accountType === 'other' && (
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">اسم / نوع الحساب الآخر:</label>
                          <input
                            type="text"
                            required
                            value={customAccountType}
                            onChange={e => {
                              setCustomAccountType(e.target.value);
                              if (accountError) setAccountError(null);
                            }}
                            placeholder="مثال: حساب تويتش أو منصة أخرى..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">البريد الإلكتروني / الحساب:</label>
                        <input
                          type="text"
                          required
                          value={accountEmail}
                          onChange={e => {
                            setAccountEmail(e.target.value);
                            if (accountError) setAccountError(null);
                          }}
                          placeholder="user@example.com أو اسم الحساب"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono text-left"
                          dir="ltr"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">كلمة المرور:</label>
                        <input
                          type="password"
                          required
                          value={accountPassword}
                          onChange={e => {
                            setAccountPassword(e.target.value);
                            if (accountError) setAccountError(null);
                          }}
                          placeholder="••••••••"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono text-left"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* METHOD 3: Voucher Code */}
                {selectedMethod === 'voucher_code' && (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-amber-400 font-semibold">
                      <Ticket className="w-4 h-4" />
                      <span>تسليم كود قسيمة رقمي فوري:</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      عند الضغط على تأكيد الدفع، سيظهر لك كود القسيمة الرقمية مباشرة في رسالة واضحة وجاهزة للنسخ بنقرة واحدة، كما سيتم إدراجه في كشف حسابك وسجل مبيعاتك.
                    </p>
                  </div>
                )}
              </div>

              {/* Optional Resale info (to record sale to customer) */}
              <div className={`grid grid-cols-1 ${platformSettings.showResaleMarginInPosPurchase ? 'sm:grid-cols-2' : ''} gap-3 text-xs`}>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">اسم الزبون (اختياري للإيصال):</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="مثال: فهد الشمري"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                {platformSettings.showResaleMarginInPosPurchase && (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">سعر البيع للزبون ({currencyLabel}) (لحساب ربحك):</label>
                    <input
                      type="number"
                      step="any"
                      value={resalePrice}
                      onChange={e => setResalePrice(e.target.value ? Number(e.target.value) : '')}
                      placeholder={`مثال: ${formatCurrency(Math.max(1, clientDisplayedTotal * 1.2))}`}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}
              </div>

              {/* Step 4: Payment Method Selection (or Free Gift Zero-Cost Banner) */}
              {selectedPricing.isFreeGiftApplied ? (
                <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${isGiftBlocked ? 'bg-rose-500/15 border-rose-500/40' : 'bg-purple-500/15 border-purple-500/40'}`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl shrink-0 ${isGiftBlocked ? 'bg-rose-500/20 text-rose-300' : 'bg-purple-500/20 text-purple-300'}`}>
                      <Gift className="w-4 h-4" />
                    </div>
                    <div>
                      <div className={`text-xs font-bold ${isGiftBlocked ? 'text-rose-200' : 'text-purple-200'}`}>
                        {isGiftBlocked
                          ? giftStatus.isExpired
                            ? 'انتهت فترة الهدية وأصبحت غير مفعلة'
                            : 'تم استنفاد مرات استخدام الهدية وأصبحت غير مفعلة'
                          : 'هدية مجانية مخصصة لك من المتجر'}
                      </div>
                      <div className={`text-[10px] ${isGiftBlocked ? 'text-rose-200/90' : 'text-purple-300/85'}`}>
                        {isGiftBlocked
                          ? giftStatus.isExpired
                            ? 'انتهت المدة المحددة لاستلام هذه الهدية ولم تعد مفعلة لحسابك.'
                            : `تم استخدام ${giftStatus.usedCount} من أصل ${giftStatus.maxUses} ${giftStatus.maxUses === 1 ? 'مرة مسموحة' : 'مرات مسموحة'}.`
                          : (
                            <>
                              يتم تنفيذ الشحن والتسليم مباشرة بسعر {formatCurrency(0)} · متاح لك {giftStatus.remainingUses} من {giftStatus.maxUses} {giftStatus.maxUses === 1 ? 'مرة' : 'مرات'}
                              {giftStatus.remainingMs !== null ? ` · تنتهي خلال ${formatGiftRemainingTimeAr(giftStatus.remainingMs)}` : ''}
                            </>
                          )}
                      </div>
                    </div>
                  </div>
                  <span className={`font-mono font-bold text-sm shrink-0 ${isGiftBlocked ? 'text-rose-200' : 'text-purple-200'}`}>
                    {formatCurrency(0)}
                  </span>
                </div>
              ) : (
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-semibold text-slate-300">
                  3. اختر طريقة الدفع:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('wallet')}
                    className={`p-3 rounded-2xl border text-right transition-all flex items-center justify-between ${
                      paymentMethod === 'wallet'
                        ? 'bg-amber-500/15 border-amber-500 text-white ring-1 ring-amber-500/30'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-slate-800 text-amber-400">
                        <Wallet className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">عبر محفظتي</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          المتاح: {formatCurrency(currentPos.walletBalance)}
                        </div>
                      </div>
                    </div>
                    {paymentMethod === 'wallet' && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('visa')}
                    className={`p-3 rounded-2xl border text-right transition-all flex items-center justify-between ${
                      paymentMethod === 'visa'
                        ? 'bg-amber-500/15 border-amber-500 text-white ring-1 ring-amber-500/30'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-slate-800 text-cyan-400">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">بطاقة فيزا كارد</div>
                        <div className="text-[10px] text-slate-400">دفع إلكتروني مباشر</div>
                      </div>
                    </div>
                    {paymentMethod === 'visa' && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                  </button>
                </div>

                {paymentMethod === 'visa' && (
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">رقم بطاقة الفيزا:</label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={e => setCardNumber(e.target.value)}
                        placeholder="4111 2222 3333 4444"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">تاريخ الانتهاء:</label>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={e => setCardExpiry(e.target.value)}
                          placeholder="MM/YY"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono text-white text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">رمز الأمان CVV:</label>
                        <input
                          type="password"
                          maxLength={4}
                          value={cardCvv}
                          onChange={e => setCardCvv(e.target.value)}
                          placeholder="•••"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono text-white text-center"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              )}

              {/* Price and Total Breakdown */}
              <div className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${selectedPricing.isFreeGiftApplied ? 'bg-purple-950/20 border-purple-500/40' : 'bg-slate-950 border-slate-800'}`}>
                {selectedPricing.isFreeGiftApplied && (
                  <>
                    <div className="flex justify-between text-purple-300">
                      <span className="flex items-center gap-1">
                        <Gift className="w-3.5 h-3.5" />
                        <span>السعر:</span>
                      </span>
                      <span className="font-bold font-mono text-purple-200">
                        {formatCurrency(0)} <span className="text-emerald-400 font-sans">(مجاني)</span>
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>السعر الأصلي لرتبة ({currentTierInfo.nameAr}):</span>
                      <span className="font-mono line-through">{formatCurrency(selectedPricing.originalTierPrice)}</span>
                    </div>
                  </>
                )}
                {selectedPricing.isZeroPriceFloorApplied && (
                  <>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>قيمة العملية المسجلة من المتجر:</span>
                      <span className="font-mono">{formatCurrency(0)}</span>
                    </div>
                    <div className="flex justify-between text-amber-300 text-[11px]">
                      <span>القيمة المعتمدة للعميل (حد أدنى للعمليات الصفرية):</span>
                      <span className="font-mono font-bold">{formatCurrency(ZERO_PRICE_CLIENT_FLOOR_SAR)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-bold text-sm text-white pt-1 border-t border-slate-800/70">
                  <span>{selectedPricing.isFreeGiftApplied ? 'السعر الإجمالي للدفع:' : 'سعر الخدمة الإجمالي للدفع:'}</span>
                  <span className={`font-mono tabular-nums ${selectedPricing.isFreeGiftApplied ? 'text-purple-300' : 'text-amber-400'}`}>
                    {selectedPricing.isFreeGiftApplied ? (
                      <span className="text-purple-300 font-bold">
                        {formatCurrency(0)} <span className="text-emerald-400 font-sans">(مجاني)</span>
                      </span>
                    ) : (
                      formatCurrency(clientDisplayedTotal)
                    )}
                  </span>
                </div>
              </div>

              {!serviceAvailability.available && (
                <div
                  role="alert"
                  className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 space-y-1 text-right"
                >
                  <div className="font-bold text-rose-300 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{serviceAvailability.title}</span>
                  </div>
                  <p className="text-rose-200/90 leading-relaxed">
                    {serviceAvailability.message}
                  </p>
                </div>
              )}

              {/* Confirm Purchase Button with clearly displayed price */}
              <button
                type="button"
                disabled={orderProcessing || isGiftBlocked || selectedPkgIsOutOfStock || methodPackages.length === 0 || !selectedPkg}
                onClick={handleConfirmPurchase}
                className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                  isGiftBlocked || selectedPkgIsOutOfStock || methodPackages.length === 0 || !selectedPkg
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : !serviceAvailability.available
                    ? 'bg-rose-500/20 border border-rose-500/40 text-rose-200 hover:bg-rose-500/30'
                    : selectedPricing.isFreeGiftApplied
                    ? 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white shadow-purple-500/25 active:scale-[0.98]'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20 active:scale-[0.98]'
                }`}
              >
                {selectedPricing.isFreeGiftApplied &&
                  !(isGiftBlocked || selectedPkgIsOutOfStock || methodPackages.length === 0 || !selectedPkg || !serviceAvailability.available) && (
                    <Gift className="w-4 h-4" />
                  )}
                <span>
                  {isGiftBlocked
                    ? giftStatus.isExpired
                      ? 'الهدية غير مفعلة · انتهت الفترة المحددة'
                      : 'الهدية غير مفعلة · تم استنفاد مرات الاستخدام'
                    : methodPackages.length === 0 || !selectedPkg
                    ? 'عدم توفر الخدمة المطلوبة'
                    : selectedPkgIsOutOfStock
                    ? selectedMethod === 'voucher_code'
                      ? 'عدم توفر الأكواد المطلوبة - غير متاح حالياً'
                      : 'عدم توفر الخدمة المطلوبة - غير متاح حالياً'
                    : !serviceAvailability.available
                    ? 'عدم توفر الرصيد الكافي في المحفظة'
                    : selectedPricing.isFreeGiftApplied
                    ? `شحن وشراء فوري (${formatCurrency(0)} - مجاني)`
                    : `تأكيد دفع ${formatCurrency(clientDisplayedTotal)} وشحن فوري`}
                </span>
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
};
