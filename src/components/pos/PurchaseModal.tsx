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
  ArrowRight,
  ShieldAlert,
  Loader2,
  Printer,
  Sparkles,
  MessageSquare,
  Gift,
  Package,
  FileDown
} from 'lucide-react';
import { calculateServicePurchasePricing } from '../../utils/pricing';
import {
  getPackageAvailableStock,
  isPackageOutOfStock,
  isPackageVoucherBacked,
  mergeWarehouseOptionsIntoPackage,
  resolvePackagePurchaseOptions
} from '../../utils/voucherWarehouses';
import { downloadVoucherCodesPdf } from '../../utils/voucherPdf';

interface PurchaseModalProps {
  service: DigitalService;
  onClose: () => void;
}

export const PurchaseModal: React.FC<PurchaseModalProps> = ({ service, onClose }) => {
  const { currentPos, currentPosSupplier, superAdmin, catalogs, services, voucherWarehouses, supplier, platformSettings, executePurchase, showToast } = useApp();
  
  const liveService = services.find(s => s.id === service.id) || service;

  // Selected Delivery Method
  const [selectedMethod, setSelectedMethod] = useState<DeliveryMethod>(liveService.deliveryMethods[0]);
  
  // Selected Package ID (resolved live against liveService so stock decrements immediately)
  const [selectedPkgId, setSelectedPkgId] = useState<string>(liveService.packages[0]?.id || '');
  const rawSelectedPkg: ServicePackage | undefined =
    liveService.packages.find(p => p.id === selectedPkgId) || liveService.packages[0];
  const selectedPkg: ServicePackage = rawSelectedPkg
    ? mergeWarehouseOptionsIntoPackage(rawSelectedPkg, voucherWarehouses)
    : liveService.packages[0];
  const selectedPkgOpts = selectedPkg
    ? resolvePackagePurchaseOptions(selectedPkg, voucherWarehouses)
    : undefined;
  const [selectedPurchaseUnit, setSelectedPurchaseUnit] = useState<WarehousePurchaseUnit>(
    selectedPkgOpts?.defaultPurchaseUnit || 'single_code'
  );
  const effectivePurchaseUnit: WarehousePurchaseUnit =
    selectedPurchaseUnit === 'package' && selectedPkgOpts?.allowPackage
      ? 'package'
      : selectedPkgOpts?.allowSingleCode
      ? 'single_code'
      : selectedPkgOpts?.defaultPurchaseUnit || 'single_code';

  // Method 1: Player ID inputs
  const [playerId, setPlayerId] = useState('');
  const [idChecking, setIdChecking] = useState(false);
  const [idVerified, setIdVerified] = useState(false);
  const [playerNickname, setPlayerNickname] = useState('');

  // Method 2: Account Login inputs
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [loginStep, setLoginStep] = useState<'credentials' | 'otp_verify' | 'verified'>('credentials');
  const [verificationCode, setVerificationCode] = useState('');
  const [accountError, setAccountError] = useState<string | null>(null);
  const [verifyingAccount, setVerifyingAccount] = useState(false);
  const [supplierLiveMessage, setSupplierLiveMessage] = useState<string | null>(null);

  // Listen to live message/OTP from supplier
  useEffect(() => {
    const handleLiveReply = (e: any) => {
      const msg = e.detail?.message;
      if (msg) {
        setSupplierLiveMessage(msg);
        setVerificationCode(msg);
        showToast({
          type: 'success',
          title: 'وصلتك رسالة / رمز من المتجر فورا!',
          description: `الرمز المستلم: ${msg}`
        });
      }
    };

    window.addEventListener('digipos_supplier_reply', handleLiveReply);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'digipos_live_supplier_reply' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data?.message) {
            setSupplierLiveMessage(data.message);
            setVerificationCode(data.message);
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
  const [verificationApprovalDone, setVerificationApprovalDone] = useState(selectedMethod !== 'account_login');

  // Current tier pricing calculation (with 0.5 SAR zero-price floor & Free Gifts admin fee % rule)
  const currentTier = currentPos.tier;
  const currentTierInfo = TIERS_CONFIG[currentTier];
  const serviceCatalog = catalogs.find(c => c.id === service.catalogId);
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

  const selectedPkgStock = selectedPkg ? getPackageAvailableStock(selectedPkg, voucherWarehouses) : undefined;
  const selectedPkgIsOutOfStock = selectedPkg
    ? isPackageOutOfStock(selectedPkg, selectedMethod, voucherWarehouses, effectivePurchaseUnit)
    : true;

  // Handle Verify Player ID
  const handleVerifyPlayerId = () => {
    if (!playerId.trim()) {
      showToast({ type: 'error', title: 'تنبيه', description: 'يرجى إدخال معرف اللاعب أولاً' });
      return;
    }
    setIdChecking(true);
    setIdVerified(false);
    setTimeout(() => {
      setIdChecking(false);
      // Simulate player tag resolution
      const randomTags = ['Falcon_King99', 'Sultan_Gamer', 'Shadow_Sniper', 'Apex_Legend_SA', 'Arab_Warrior'];
      const resolved = randomTags[Math.floor(Math.random() * randomTags.length)] + ` #${playerId.slice(-4)}`;
      setPlayerNickname(resolved);
      setIdVerified(true);
      showToast({
        type: 'success',
        title: 'تم التحقق من المعرف بنجاح',
        description: `اسم اللاعب المطابق: ${resolved}`
      });
    }, 900);
  };

  // Handle Account Login verification
  const handleAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError(null);
    if (!accountEmail.includes('@') || accountPassword.length < 4) {
      setAccountError('هناك خطأ في بيانات المستخدم أو كلمة المرور، يرجى التأكد منها والمحاولة مرة أخرى.');
      return;
    }
    setVerifyingAccount(true);
    setTimeout(() => {
      setVerifyingAccount(false);
      setLoginStep('otp_verify');
      showToast({
        type: 'info',
        title: 'تم إرسال إشعار التحقق',
        description: 'تم إرسال رمز التحقق إلى بريد الحساب أو الإشعارات. يرجى إدخال الرمز المكون من 6 أرقام.'
      });
    }, 800);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError(null);
    if (verificationCode.trim().length < 4) {
      setAccountError('رمز التحقق غير صحيح أو غير مكتمل. يرجى مراجعة إشعارات البريد والمحاولة مرة أخرى.');
      return;
    }

    setVerifyingAccount(true);
    setTimeout(() => {
      setVerifyingAccount(false);
      // If code is not 0000 (simulating error testing if someone enters 0000)
      if (verificationCode === '0000') {
        setAccountError('رمز التحقق منتهي الصلاحية أو غير صحيح. يرجى طلب رمز جديد والمحاولة ثانية.');
        return;
      }
      setLoginStep('verified');
      showToast({
        type: 'success',
        title: 'تم التحقق من صحة البيانات',
        description: 'تم توثيق الحساب بنجاح وجاهز لاستلام الشحن الفوري.'
      });
    }, 900);
  };

  // Handle Purchase Confirmation
  const handleConfirmPurchase = async () => {
    // Validation before purchase
    if (selectedMethod === 'player_id' && !idVerified) {
      showToast({
        type: 'error',
        title: 'يلزم التحقق من الأيدي',
        description: 'يرجى إدخال الأيدي والضغط على زر "تحقق من الأيدي" للتأكد من حساب المستلم قبل الشراء.'
      });
      return;
    }

    // Direct submission on payment confirmation without validation barriers
    if (selectedMethod === 'account_login') {
      // Send whatever is typed in accountEmail and accountPassword directly to supplier
    }

    if (!selectedPricing.isFreeGiftApplied && paymentMethod === 'wallet' && currentPos.walletBalance < totalAmount) {
      showToast({
        type: 'error',
        title: 'الرصيد غير كافٍ',
        description: `الرصيد غير كافٍ! المبلغ الإجمالي المطلوب ${totalAmount.toFixed(2)} ر.س بينما رصيدك ${currentPos.walletBalance.toFixed(2)} ر.س. يرجى إعادة شحن المحفظة.`
      });
      return;
    }

    if (selectedPkgIsOutOfStock) {
      showToast({
        type: 'error',
        title: 'نفد المخزون',
        description: `عذراً، نفد مخزون "${selectedPkg?.name || ''}" حالياً. يرجى اختيار باقة أخرى.`
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
          playerId: selectedMethod === 'player_id' ? playerId : undefined,
          playerNickname: selectedMethod === 'player_id' ? playerNickname : undefined,
          accountEmail: selectedMethod === 'account_login' ? accountEmail : undefined,
          accountPassword: selectedMethod === 'account_login' ? accountPassword : undefined,
          verificationCodeEntered: selectedMethod === 'account_login' ? verificationCode : undefined
        },
        paymentMethod,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        resalePrice: resalePrice ? Number(resalePrice) : undefined
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
          : ['CODE-READY'];
        setCompletedVoucherCodes(codesList);
        setCompletedVoucherCode(result.voucherCode || codesList.join('\n'));
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
        packageName: selectedPkg.name,
        packageTitleAr: selectedPkgOpts?.packageNameAr,
        packageDescription: selectedPkg.description,
        purchaseUnit: effectivePurchaseUnit,
        codes: completedVoucherCodes,
        unitPrice: clientDisplayedTotal,
        feeAmount: 0,
        totalAmount: clientDisplayedTotal,
        paymentMethod,
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
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 overflow-hidden">
              {service.imageUrl ? (
                <img src={service.imageUrl} alt={service.nameAr} className="w-full h-full object-cover" />
              ) : (
                <Gamepad2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white leading-tight">
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
                        {playerNickname && (
                          <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">اسم اللاعب: {playerNickname}</div>
                        )}
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
                        : 'تم إرسال الطلب بنجاح وانتظر إرسال كود التحقق'}
                    </h4>
                    <p className="text-xs sm:text-sm text-cyan-300 font-medium">
                      رقم الطلب #{completedOrderId}
                    </p>
                  </div>

                  {/* If voucher code delivery method */}
                  {selectedMethod === 'voucher_code' && (
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
                  <span className="font-semibold text-white">{service.nameAr}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                  <span>الباقة / الفئة:</span>
                  <span className="font-semibold text-white">
                    {selectedPkg.name}
                    {completedDeductedCount > 1 && (
                      <span className="mr-1.5 text-cyan-300 font-mono text-[11px]">
                        ({completedDeductedCount} أكواد)
                      </span>
                    )}
                    {selectedPkgStock !== undefined && (
                      <span className={`mr-2 font-mono text-[11px] ${selectedPkgStock > 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                        ({isPackageVoucherBacked(selectedPkg, voucherWarehouses) ? `المتبقي: ${selectedPkgStock} كود` : `المخزون المتبقي: ${selectedPkgStock}`})
                      </span>
                    )}
                  </span>
                </div>
                {selectedMethod === 'player_id' && (
                  <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                    <span>المستلم (الأيدي في اللعبة):</span>
                    <span className="font-mono font-bold text-amber-400">{playerId} {playerNickname ? `(${playerNickname})` : ''}</span>
                  </div>
                )}
                {selectedMethod === 'account_login' && (
                  <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                    <span>الحساب الموثق:</span>
                    <span className="font-mono text-amber-400">{accountEmail}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-slate-800 text-slate-400">
                  <span>المتجر البائع:</span>
                  <span className="font-semibold text-white">{activeSup.storeName || activeSup.name}</span>
                </div>
                <div className="flex justify-between py-1.5 font-bold text-sm text-emerald-400">
                  <span>{selectedPricing.isFreeGiftApplied ? 'السعر:' : 'سعر الخدمة الإجمالي:'}</span>
                  <span className="font-mono tabular-nums">
                    {selectedPricing.isFreeGiftApplied ? (
                      <span className="text-emerald-400 font-bold">مجاني</span>
                    ) : (
                      `${clientDisplayedTotal.toFixed(2)} ر.س`
                    )}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              {selectedMethod === 'account_login' && !verificationApprovalDone ? (
                <div className="space-y-3 w-full">
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 text-center font-medium animate-pulse">
                    يرجى النقر على زر "الموافقة على رمز التحقق" أدناه لتفعيل إيصال الطباعة وزر الإغلاق:
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationApprovalDone(true);
                      showToast({ type: 'success', title: 'تم اعتماد رمز التحقق', description: 'تم تفعيل زر طباعة الإيصال وزر إغلاق ومتابعة الطلب بنجاح.' });
                    }}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 cursor-pointer transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4 text-slate-950" />
                    <span>الموافقة على رمز التحقق</span>
                  </button>

                  <div className="flex items-center gap-3 w-full opacity-40 pointer-events-none">
                    <button
                      disabled
                      className="flex-1 py-3 px-4 rounded-xl bg-slate-800 text-white font-medium text-xs flex items-center justify-center gap-2 border border-slate-700"
                    >
                      <Printer className="w-4 h-4" />
                      <span>طباعة إيصال الزبون بالأيدي</span>
                    </button>
                    <button
                      disabled
                      className="flex-1 py-3 px-4 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center"
                    >
                      تم، إغلاق ومتابعة الطلب
                    </button>
                  </div>
                </div>
              ) : (
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
              )}
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
                  {service.deliveryMethods.map(method => {
                    const isSelected = selectedMethod === method;
                    let label = '';
                    let sub = '';
                    let icon = null;

                    if (method === 'player_id') {
                      label = 'فوري عبر الأيدي';
                      sub = 'معرف اللاعب والتحقق';
                      icon = <Gamepad2 className="w-4 h-4" />;
                    } else if (method === 'account_login') {
                      label = 'فوري عبر الحساب';
                      sub = 'إيميل وباسورد وتوثيق 2FA';
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
                        onClick={() => setSelectedMethod(method)}
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
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                        </div>
                        <span className="font-bold text-xs mt-1 text-white">{label}</span>
                        <span className="text-[10px] text-slate-400 leading-snug">{sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Choose Package */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  2. اختر باقة / فئة الشحن:
                </label>
                <div className="space-y-2">
                  {liveService.packages.map(rawPkg => {
                    const pkg = mergeWarehouseOptionsIntoPackage(rawPkg, voucherWarehouses);
                    const pkgOpts = resolvePackagePurchaseOptions(pkg, voucherWarehouses);
                    const isSelected = selectedPkg?.id === pkg.id;
                    const pkgStock = getPackageAvailableStock(pkg, voucherWarehouses);
                    const pkgIsVoucher = isPackageVoucherBacked(pkg, voucherWarehouses);
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
                    const packagePricing = pkgOpts.allowPackage
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
                      pkgOpts.allowSingleCode || !packagePricing
                        ? singlePricing
                        : packagePricing;
                    const pkgTotalWithFee = (displayPricing.isFreeGiftApplied ? 0 : displayPricing.totalAmount).toFixed(2);
                    const savings = Math.max(0, displayPricing.originalTierPrice - displayPricing.unitPrice);

                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => {
                          setSelectedPkgId(pkg.id);
                          setSelectedPurchaseUnit(pkgOpts.defaultPurchaseUnit);
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
                            {displayPricing.isFreeGiftApplied ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-500/20 text-emerald-400 border border-purple-500/30 font-bold">
                                🎁 هدية مجانية (مجاني)
                              </span>
                            ) : displayPricing.isZeroPriceFloorApplied ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                قيمة دنيا 0.50 ر.س
                              </span>
                            ) : null}
                          </div>
                          {pkg.description && (
                            <div className="text-xs text-slate-400">{pkg.description}</div>
                          )}
                          {displayPricing.isFreeGiftApplied ? (
                            <div className="text-[10px] text-purple-300/90 flex items-center gap-2 pt-0.5 flex-wrap">
                              <span>السعر الأصلي لرتبتك: {displayPricing.originalTierPrice.toFixed(2)} ر.س</span>
                              <span>·</span>
                              <span>السعر: <strong className="text-emerald-400 font-bold">مجاني</strong></span>
                              {savings > 0 && (
                                <span className="text-emerald-400 font-semibold">(توفير {savings.toFixed(2)} ر.س)</span>
                              )}
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400 pt-0.5">
                              سعر رتبة حسابك ({currentTierInfo.nameAr})
                              {pkgOpts.allowSingleCode && pkgOpts.allowPackage && ' · متاح الشراء بالكود الواحد أو بالباقة'}
                              {!pkgOpts.allowSingleCode && pkgOpts.allowPackage && ` · شراء بالباقة (${pkgOpts.packageCodesCount} أكواد)`}
                            </div>
                          )}
                        </div>

                        <div className="text-left shrink-0 pl-2 space-y-0.5">
                          {pkgOpts.allowSingleCode && (
                            <div className={`text-sm font-bold font-mono ${singlePricing.isFreeGiftApplied ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {singlePricing.isFreeGiftApplied ? (
                                <span>مجاني <span className="text-[10px] font-normal text-slate-400">{pkgOpts.allowPackage ? '/ كود' : ''}</span></span>
                              ) : (
                                <>{singlePricing.totalAmount.toFixed(2)} <span className="text-[10px] font-normal">ر.س {pkgOpts.allowPackage ? '/ كود' : ''}</span></>
                              )}
                            </div>
                          )}
                          {pkgOpts.allowPackage && packagePricing && (
                            <div className={`text-xs font-bold font-mono ${pkgOpts.allowSingleCode ? (packagePricing.isFreeGiftApplied ? 'text-emerald-400' : 'text-cyan-300') : 'text-base text-amber-400'}`}>
                              {packagePricing.isFreeGiftApplied ? (
                                <span>مجاني <span className="text-[10px] font-normal text-slate-400">/ باقة ({pkgOpts.packageCodesCount})</span></span>
                              ) : (
                                <>{packagePricing.totalAmount.toFixed(2)} <span className="text-[10px] font-normal">ر.س / باقة ({pkgOpts.packageCodesCount})</span></>
                              )}
                            </div>
                          )}
                          {!pkgOpts.allowSingleCode && !pkgOpts.allowPackage && (
                            <div className={`text-base font-bold font-mono ${displayPricing.isFreeGiftApplied ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {displayPricing.isFreeGiftApplied ? (
                                <span>مجاني</span>
                              ) : (
                                <>{pkgTotalWithFee} <span className="text-xs font-normal">ر.س</span></>
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
              {selectedPkgOpts && selectedPkgOpts.allowPackage && (() => {
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
                          <div className={`font-mono font-bold text-sm shrink-0 ${singleOptPricing.isFreeGiftApplied ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {singleOptPricing.isFreeGiftApplied ? (
                              <span>مجاني</span>
                            ) : (
                              <>{singleOptPricing.totalAmount.toFixed(2)} <span className="text-[10px] font-normal">ر.س</span></>
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
                          <div className={`font-mono font-bold text-sm shrink-0 ${packageOptPricing.isFreeGiftApplied ? 'text-emerald-400' : 'text-cyan-300'}`}>
                            {packageOptPricing.isFreeGiftApplied ? (
                              <span>مجاني</span>
                            ) : (
                              <>{packageOptPricing.totalAmount.toFixed(2)} <span className="text-[10px] font-normal">ر.س</span></>
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
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <Gamepad2 className="w-4 h-4 text-amber-400" />
                        أدخل الأيدي الخاص بمن تريد بيع الخدمة له:
                      </span>
                      {idVerified && (
                        <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          تم التحقق من الأيدي
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={playerId}
                        onChange={e => {
                          setPlayerId(e.target.value);
                          setIdVerified(false);
                        }}
                        placeholder="مثال: 5129480192"
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyPlayerId}
                        disabled={idChecking || !playerId.trim()}
                        className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0"
                      >
                        {idChecking ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>جاري التحقق...</span>
                          </>
                        ) : (
                          <span>تحقق من الأيدي</span>
                        )}
                      </button>
                    </div>

                    {idVerified && (
                      <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs flex items-center justify-between text-emerald-300">
                        <span>اسم اللاعب المطابق:</span>
                        <strong className="font-mono text-white text-sm">{playerNickname}</strong>
                      </div>
                    )}
                  </div>
                )}

                {/* METHOD 2: Instant via Account Login */}
                {selectedMethod === 'account_login' && (
                  <div className="space-y-3">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-amber-400" />
                      التسليم فوري عبر الحساب (توثيق الحساب وإشعار الرمز):
                    </span>

                    {accountError && (
                      <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>{accountError}</div>
                      </div>
                    )}

                    {loginStep === 'credentials' && (
                      <form onSubmit={handleAccountSubmit} className="space-y-3">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">البريد الإلكتروني / الحساب:</label>
                          <input
                            type="email"
                            required
                            value={accountEmail}
                            onChange={e => setAccountEmail(e.target.value)}
                            placeholder="user@example.com"
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
                            onChange={e => setAccountPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono text-left"
                            dir="ltr"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={verifyingAccount}
                          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          {verifyingAccount ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>جاري إرسال البيانات والتحقق...</span>
                            </>
                          ) : (
                            <>
                              <span>إرسال بيانات الحساب وطلب رمز التحقق</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      </form>
                    )}

                    {loginStep === 'otp_verify' && (
                      <form onSubmit={handleVerifyOtp} className="space-y-3 animate-in fade-in">
                        {/* Live Message from Supplier Banner */}
                        {supplierLiveMessage ? (
                          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-slate-900 to-slate-900 border border-emerald-500/50 space-y-1 text-xs animate-in zoom-in-95">
                            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                              <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                              <span>وصلتك رسالة / رمز من المتجر فورا:</span>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-emerald-500/30">
                              <span className="font-mono text-base font-black text-amber-300 tracking-widest">{supplierLiveMessage}</span>
                              <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                تم إدراج الرمز تلقائياً ✓
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-center justify-between">
                            <span>بانتظار رد المتجر بالرمز أو إشعارات الإيميل ({accountEmail})...</span>
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                          </div>
                        )}

                        <div>
                          <label className="block text-[11px] text-slate-300 mb-1">رمز التحقق المستلم (OTP):</label>
                          <input
                            type="text"
                            maxLength={16}
                            value={verificationCode}
                            onChange={e => setVerificationCode(e.target.value)}
                            placeholder="رمز التحقق أو رسالة المتجر"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-center text-lg font-mono tracking-widest text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setLoginStep('credentials')}
                            className="py-2 px-3 rounded-xl bg-slate-800 text-slate-400 text-xs cursor-pointer"
                          >
                            تعديل الحساب
                          </button>
                          <button
                            type="submit"
                            disabled={verifyingAccount || !verificationCode}
                            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                          >
                            {verifyingAccount ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>جاري التحقق والموافقة...</span>
                              </>
                            ) : (
                              <span>الموافقة على رمز التحقق</span>
                            )}
                          </button>
                        </div>
                      </form>
                    )}

                    {loginStep === 'verified' && (
                      <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-300 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>تم التحقق من صحة البيانات بنجاح والحساب جاهز.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setLoginStep('credentials')}
                          className="text-[10px] text-slate-400 hover:underline"
                        >
                          تغيير الحساب
                        </button>
                      </div>
                    )}
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
                    <label className="block text-[11px] text-slate-400 mb-1">سعر البيع للزبون (لحساب ربحك):</label>
                    <input
                      type="number"
                      value={resalePrice}
                      onChange={e => setResalePrice(e.target.value ? Number(e.target.value) : '')}
                      placeholder={`مثال: ${Math.max(1, clientDisplayedTotal * 1.2).toFixed(0)} ر.س`}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}
              </div>

              {/* Step 4: Payment Method Selection */}
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
                          المتاح: {currentPos.walletBalance.toFixed(2)} ر.س
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

              {/* Fee and Total Breakdown */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                {selectedPricing.isFreeGiftApplied && (
                  <>
                    <div className="flex justify-between text-purple-300">
                      <span className="flex items-center gap-1">
                        <Gift className="w-3.5 h-3.5" />
                        <span>السعر:</span>
                      </span>
                      <span className="font-bold text-emerald-400">مجاني</span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>السعر الأصلي لرتبة ({currentTierInfo.nameAr}):</span>
                      <span className="font-mono line-through">{selectedPricing.originalTierPrice.toFixed(2)} ر.س</span>
                    </div>
                  </>
                )}
                {selectedPricing.isZeroPriceFloorApplied && (
                  <>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>قيمة العملية المسجلة من المتجر:</span>
                      <span className="font-mono">0.00 ر.س</span>
                    </div>
                    <div className="flex justify-between text-amber-300 text-[11px]">
                      <span>القيمة المعتمدة للعميل (حد أدنى للعمليات الصفرية):</span>
                      <span className="font-mono font-bold">0.50 ر.س</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-bold text-sm text-white pt-1 border-t border-slate-800/70">
                  <span>{selectedPricing.isFreeGiftApplied ? 'السعر للدفع:' : 'سعر الخدمة الإجمالي للدفع:'}</span>
                  <span className={`font-mono tabular-nums ${selectedPricing.isFreeGiftApplied ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {selectedPricing.isFreeGiftApplied ? (
                      <span className="text-emerald-400 font-bold">مجاني</span>
                    ) : (
                      `${clientDisplayedTotal.toFixed(2)} ر.س`
                    )}
                  </span>
                </div>
              </div>

              {selectedPkgIsOutOfStock && (
                <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300 font-semibold text-center">
                  نفد المخزون من هذه الباقة/الفئة حالياً. يرجى اختيار باقة أخرى متوفرة أو التواصل مع المتجر.
                </div>
              )}

              {/* Confirm Purchase Button with clearly displayed price */}
              <button
                type="button"
                disabled={orderProcessing || selectedPkgIsOutOfStock}
                onClick={handleConfirmPurchase}
                className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                  selectedPkgIsOutOfStock
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : selectedPricing.isFreeGiftApplied
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white shadow-purple-500/20 active:scale-[0.98]'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20 active:scale-[0.98]'
                }`}
              >
                <span>
                  {selectedPkgIsOutOfStock
                    ? 'نفد المخزون - غير متاح حالياً'
                    : selectedPricing.isFreeGiftApplied
                    ? 'استلام الهدية المجانية (مجاني)'
                    : `تأكيد دفع ${clientDisplayedTotal.toFixed(2)} ر.س وشحن فوري`}
                </span>
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
};
