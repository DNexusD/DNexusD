import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DeliveryMethod, AccountTier, ServicePackage, TIERS_CONFIG } from '../../types';
import { isCatalogFreeGifts, computeGiftExpiresAt, GiftDurationUnit } from '../../utils/pricing';
import { getCatalogsForSupplierView } from '../../utils/platformSettings';
import {
  sanitizePackagesForDeliveryMethods,
  createEmptyPackageForMethod,
  getDeliveryMethodLabelAr,
} from '../../utils/voucherWarehouses';
import { X, Plus, Trash2, ArrowRight, Upload, Image as ImageIcon, Check, CheckCircle2, Gamepad2, Lock, Ticket, Gift, Package, Clock } from 'lucide-react';

interface AddServiceModalProps {
  onClose: () => void;
}

export const AddServiceModal: React.FC<AddServiceModalProps> = ({ onClose }) => {
  const { catalogs, supplier, posClients, voucherWarehouses, addService, showToast, activeCurrency, activeExchangeRate, currencyLabel, convertFromSar, convertToSar, formatCurrency } = useApp();
  const supplierCatalogs = getCatalogsForSupplierView(catalogs, supplier.id);
  const supplierWarehouses = voucherWarehouses.filter(w => !w.supplierId || w.supplierId === supplier.id);
  const supplierClients = posClients.filter(c => c.supplierId === supplier.id);
  const targetableClients = supplierClients;

  const [catalogId, setCatalogId] = useState(supplierCatalogs[0]?.id || '');
  const [nameAr, setNameAr] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethod[]>(['player_id', 'voucher_code']);
  const [activePackageMethod, setActivePackageMethod] = useState<DeliveryMethod>('player_id');

  // Gift targeting, usage limit & visibility period state
  const [giftTargetType, setGiftTargetType] = useState<'all_tiers' | 'specific_tiers' | 'specific_clients'>('all_tiers');
  const [giftTargetTiers, setGiftTargetTiers] = useState<AccountTier[]>(['regular', 'bronze', 'silver', 'gold', 'vip']);
  const [giftTargetPosIds, setGiftTargetPosIds] = useState<string[]>([]);
  const [giftMaxUsesPerClient, setGiftMaxUsesPerClient] = useState<number>(1);
  const [giftPeriodMode, setGiftPeriodMode] = useState<'unlimited' | 'duration' | 'custom_date'>('unlimited');
  const [giftDurationValue, setGiftDurationValue] = useState<number>(7);
  const [giftDurationUnit, setGiftDurationUnit] = useState<GiftDurationUnit>('days');
  const [giftCustomExpiryLocal, setGiftCustomExpiryLocal] = useState<string>('');

  // Service image state
  const [imageUrl, setImageUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Independent packages list per delivery method
  const [packagesByMethod, setPackagesByMethod] = useState<Record<DeliveryMethod, ServicePackage[]>>(() => ({
    player_id: [createEmptyPackageForMethod('player_id', `${Date.now()}-1`)],
    account_login: [],
    voucher_code: [createEmptyPackageForMethod('voucher_code', `${Date.now()}-2`)],
  }));

  const activePackages = packagesByMethod[activePackageMethod] || [];
  const activeMethodIsVoucher = activePackageMethod === 'voucher_code';

  // New package inline addition state (values entered in activeCurrency)
  const [showAddPackageForm, setShowAddPackageForm] = useState(false);
  const [newPkgName, setNewPkgName] = useState('');
  const [newPriceRegular, setNewPriceRegular] = useState<string>('0');
  const [newPriceBronze, setNewPriceBronze] = useState<string>('0');
  const [newPriceSilver, setNewPriceSilver] = useState<string>('0');
  const [newPriceGold, setNewPriceGold] = useState<string>('0');
  const [newPriceVip, setNewPriceVip] = useState<string>('0');
  const [newVouchersInput, setNewVouchersInput] = useState('');
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setPriceDrafts({});
  }, [activeCurrency, activeExchangeRate]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast({ type: 'error', title: 'حجم الملف كبير', description: 'يرجى اختيار صورة بحجم أقل من 2 ميجابايت' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
        showToast({ type: 'success', title: 'تم تحميل الصورة', description: 'تم تعيين الصورة من ملفاتك بنجاح' });
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleMethod = (method: DeliveryMethod) => {
    if (deliveryMethods.includes(method)) {
      if (deliveryMethods.length === 1) return; // keep at least one
      const next = deliveryMethods.filter(m => m !== method);
      setDeliveryMethods(next);
      if (activePackageMethod === method) {
        setActivePackageMethod(next[0]);
        setShowAddPackageForm(false);
      }
    } else {
      const next = [...deliveryMethods, method];
      setDeliveryMethods(next);
      setPackagesByMethod(prev => {
        if (prev[method] && prev[method].length > 0) return prev;
        return {
          ...prev,
          [method]: [createEmptyPackageForMethod(method)],
        };
      });
      setActivePackageMethod(method);
      setShowAddPackageForm(false);
    }
  };

  const handleUpdatePackagePrice = (pkgId: string, tier: 'regular' | 'bronze' | 'silver' | 'gold' | 'vip', val: number) => {
    const safeVal = Number.isFinite(val) && val >= 0 ? val : 0;
    setPackagesByMethod(prev => ({
      ...prev,
      [activePackageMethod]: prev[activePackageMethod].map(p =>
        p.id === pkgId
          ? {
              ...p,
              tierPrices: {
                ...p.tierPrices,
                [tier]: safeVal,
              },
            }
          : p
      ),
    }));
  };

  const handleUpdatePackageName = (pkgId: string, name: string) => {
    setPackagesByMethod(prev => ({
      ...prev,
      [activePackageMethod]: prev[activePackageMethod].map(p => (p.id === pkgId ? { ...p, name } : p)),
    }));
  };

  const handleDeletePackage = (pkgId: string) => {
    if (activePackages.length <= 1) {
      showToast({
        type: 'error',
        title: 'تنبيه',
        description: `يجب أن تحتوي طريقة "${getDeliveryMethodLabelAr(activePackageMethod)}" على باقة واحدة على الأقل`,
      });
      return;
    }
    setPackagesByMethod(prev => ({
      ...prev,
      [activePackageMethod]: prev[activePackageMethod].filter(p => p.id !== pkgId),
    }));
  };

  const handleUpdatePackageStock = (pkgId: string, stock: number) => {
    const safeStock = Math.max(0, Math.floor(Number.isFinite(stock) ? stock : 0));
    setPackagesByMethod(prev => ({
      ...prev,
      [activePackageMethod]: prev[activePackageMethod].map(p =>
        p.id === pkgId ? { ...p, availableStock: safeStock } : p
      ),
    }));
  };

  const handleUpdatePackageVouchers = (pkgId: string, raw: string) => {
    const codes = raw.split(/[\r\n,]+/).map(v => v.trim()).filter(Boolean);
    setPackagesByMethod(prev => ({
      ...prev,
      [activePackageMethod]: prev[activePackageMethod].map(p =>
        p.id === pkgId
          ? {
              ...p,
              warehouseId: undefined,
              vouchers: codes.length > 0 ? codes : undefined,
              availableStock: codes.length > 0 ? codes.length : 0,
            }
          : p
      ),
    }));
  };

  const handleLinkPackageWarehouse = (pkgId: string, warehouseId: string) => {
    if (!warehouseId) {
      setPackagesByMethod(prev => ({
        ...prev,
        [activePackageMethod]: prev[activePackageMethod].map(p =>
          p.id === pkgId ? { ...p, warehouseId: undefined } : p
        ),
      }));
      return;
    }
    const wh = supplierWarehouses.find(w => w.id === warehouseId);
    if (!wh) return;
    setPriceDrafts(prev => {
      const next = { ...prev };
      for (const t of ['regular', 'bronze', 'silver', 'gold', 'vip'] as const) {
        delete next[`${pkgId}:${t}`];
      }
      return next;
    });
    setPackagesByMethod(prev => ({
      ...prev,
      [activePackageMethod]: prev[activePackageMethod].map(p =>
        p.id === pkgId
          ? {
              ...p,
              warehouseId: wh.id,
              name: wh.nameAr,
              tierPrices: { ...wh.tierPrices },
              vouchers: [...wh.codes],
              availableStock: wh.codes.length,
            }
          : p
      ),
    }));
  };

  const handleAddNewPackage = () => {
    if (!newPkgName.trim()) {
      showToast({ type: 'error', title: 'تنبيه', description: 'يرجى إدخال اسم الباقة الجديدة' });
      return;
    }
    const parsePriceSar = (raw: string) => {
      const val = Number(raw);
      return Number.isFinite(val) && val >= 0 ? convertToSar(val) : 0;
    };

    const vouchers = activeMethodIsVoucher
      ? newVouchersInput
          .split('\n')
          .map(v => v.trim())
          .filter(Boolean)
      : [];

    const newPkg: ServicePackage = {
      id: `pkg-${activePackageMethod}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: newPkgName.trim(),
      description: '',
      deliveryMethod: activePackageMethod,
      tierPrices: {
        regular: parsePriceSar(newPriceRegular),
        bronze: parsePriceSar(newPriceBronze),
        silver: parsePriceSar(newPriceSilver),
        gold: parsePriceSar(newPriceGold),
        vip: parsePriceSar(newPriceVip),
      },
      ...(activeMethodIsVoucher
        ? {
            availableStock: vouchers.length > 0 ? vouchers.length : 0,
            vouchers: vouchers.length > 0 ? vouchers : undefined,
          }
        : {}),
    };

    setPackagesByMethod(prev => ({
      ...prev,
      [activePackageMethod]: [...(prev[activePackageMethod] || []), newPkg],
    }));
    setNewPkgName('');
    setNewPriceRegular('0');
    setNewPriceBronze('0');
    setNewPriceSilver('0');
    setNewPriceGold('0');
    setNewPriceVip('0');
    setNewVouchersInput('');
    setShowAddPackageForm(false);
    showToast({
      type: 'success',
      title: 'تمت إضافة الباقة',
      description: `تمت إضافة "${newPkg.name}" إلى طريقة ${getDeliveryMethodLabelAr(activePackageMethod)}`,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) {
      showToast({ type: 'error', title: 'تنبيه', description: 'يرجى إكمال بيانات الخدمة' });
      return;
    }

    for (const method of deliveryMethods) {
      const methodPkgs = packagesByMethod[method] || [];
      if (methodPkgs.length === 0 || methodPkgs.some(p => !p.name.trim())) {
        setActivePackageMethod(method);
        showToast({
          type: 'error',
          title: 'تنبيه',
          description: `يرجى إدخال اسم كل باقة ضمن طريقة "${getDeliveryMethodLabelAr(method)}".`,
        });
        return;
      }
    }

    const combinedPackages = deliveryMethods.flatMap(method =>
      (packagesByMethod[method] || []).map(p => ({
        ...p,
        deliveryMethod: method,
      }))
    );

    const isGiftCat = isCatalogFreeGifts(catalogs.find(c => c.id === catalogId));
    if (isGiftCat && giftTargetType === 'specific_tiers' && giftTargetTiers.length === 0) {
      showToast({ type: 'error', title: 'تنبيه', description: 'يرجى تحديد رتبة واحدة على الأقل لمن ستظهر لهم الهدية المجانية.' });
      return;
    }
    if (isGiftCat && giftTargetType === 'specific_clients' && giftTargetPosIds.length === 0) {
      showToast({ type: 'error', title: 'تنبيه', description: 'يرجى اختيار عميل واحد على الأقل لمن ستظهر لهم الهدية المجانية.' });
      return;
    }

    let resolvedGiftExpiresAt: string | undefined;
    if (isGiftCat) {
      if (!Number.isFinite(giftMaxUsesPerClient) || giftMaxUsesPerClient < 1) {
        showToast({ type: 'error', title: 'تنبيه', description: 'يرجى تحديد عدد مرات استخدام صحيح (مرة واحدة على الأقل).' });
        return;
      }
      if (giftPeriodMode === 'duration') {
        if (!Number.isFinite(giftDurationValue) || giftDurationValue <= 0) {
          showToast({ type: 'error', title: 'تنبيه', description: 'يرجى إدخال مدة صلاحية صحيحة للهدية أكبر من صفر.' });
          return;
        }
        resolvedGiftExpiresAt = computeGiftExpiresAt({
          durationValue: giftDurationValue,
          durationUnit: giftDurationUnit,
        });
      } else if (giftPeriodMode === 'custom_date') {
        const parsedCustom = giftCustomExpiryLocal ? Date.parse(giftCustomExpiryLocal) : NaN;
        if (!Number.isFinite(parsedCustom) || parsedCustom <= Date.now()) {
          showToast({ type: 'error', title: 'تنبيه', description: 'يرجى تحديد تاريخ ووقت انتهاء مستقبلي صحيح للهدية.' });
          return;
        }
        resolvedGiftExpiresAt = new Date(parsedCustom).toISOString();
      }
    }

    const finalPackages = sanitizePackagesForDeliveryMethods(combinedPackages, deliveryMethods);

    addService({
      catalogId,
      nameAr: nameAr.trim(),
      descriptionAr: descriptionAr.trim() || 'خدمة رقمية شحن فوري معتمد',
      icon: 'Gamepad2',
      imageUrl: imageUrl.trim() || undefined,
      deliveryMethods,
      packages: finalPackages,
      giftTargetType: isGiftCat ? giftTargetType : undefined,
      giftTargetTiers: isGiftCat && giftTargetType === 'specific_tiers' ? giftTargetTiers : undefined,
      giftTargetPosIds: isGiftCat && giftTargetType === 'specific_clients' ? giftTargetPosIds : undefined,
      giftMaxUsesPerClient: isGiftCat ? Math.max(1, Math.floor(giftMaxUsesPerClient)) : undefined,
      giftDurationValue: isGiftCat && giftPeriodMode === 'duration' ? giftDurationValue : undefined,
      giftDurationUnit: isGiftCat && giftPeriodMode === 'duration' ? giftDurationUnit : undefined,
      giftExpiresAt: isGiftCat ? resolvedGiftExpiresAt : undefined,
      giftActivatedAt: isGiftCat ? new Date().toISOString() : undefined,
    });

    showToast({ type: 'success', title: 'تمت إضافة الخدمة', description: 'تم حفظ الخدمة مع الباقات المستقلة لكل طريقة تسليم بنجاح' });
    onClose();
  };

  const renderMethodIcon = (method: DeliveryMethod) => {
    if (method === 'player_id') return <Gamepad2 className="w-3.5 h-3.5" />;
    if (method === 'account_login') return <Lock className="w-3.5 h-3.5" />;
    return <Ticket className="w-3.5 h-3.5" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 text-slate-100 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div>
            <h3 className="font-bold text-base text-white">إضافة خدمة رقمية جديدة بباقات مستقلة لكل طريقة تسليم</h3>
            <p className="text-xs text-slate-400">يمكنك اختيار أكثر من طريقة تسليم وتحديد باقات وأسعار مستقلة تماماً لكل طريقة في نفس الخدمة</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar flex-1">
          
          {/* Service Image Selection (File Upload) */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-white flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>صورة أو غلاف الخدمة الرقمية:</span>
              </label>
              <span className="text-[10px] text-slate-400">يمكنك رفع صورة من ملفاتك</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Preview */}
              <div className="relative w-20 h-20 rounded-2xl bg-slate-900 border-2 border-amber-500/40 overflow-hidden shrink-0 flex items-center justify-center shadow-lg group">
                {imageUrl ? (
                  <img src={imageUrl} alt="معاينة الخدمة" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-600" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[10px] text-white">
                  معاينة
                </div>
              </div>

              {/* Upload from device */}
              <div className="flex-1 w-full space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-md"
                  >
                    <Upload className="w-4 h-4 text-slate-950" />
                    <span>إضافة صورة للخدمة</span>
                  </button>

                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
                      title="إزالة الصورة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">الكتالوج التابع له:</label>
              <select
                value={catalogId}
                onChange={e => setCatalogId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                {supplierCatalogs.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nameAr}{cat.isFixedByAdmin || cat.supplierId === 'all' ? ' (ثابت من الإدارة)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">اسم الخدمة الرقمية:</label>
              <input
                type="text"
                required
                value={nameAr}
                onChange={e => setNameAr(e.target.value)}
                placeholder="مثال: شحن كول أوف ديوتي موبايل (CP)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">وصف الخدمة وملاحظات التسليم:</label>
            <input
              type="text"
              value={descriptionAr}
              onChange={e => setDescriptionAr(e.target.value)}
              placeholder="مثال: شحن فوري مباشر معتمد عبر الأيدي أو كود قسيمة أكتيفيجن"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Delivery Methods Checkboxes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              طرق تسليم الخدمة المتاحة للعميل:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => toggleMethod('player_id')}
                className={`p-3 rounded-xl border text-xs font-medium text-right flex items-center justify-between transition-colors ${
                  deliveryMethods.includes('player_id')
                    ? 'bg-amber-500/15 border-amber-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Gamepad2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>فوري عبر الأيدي</span>
                </span>
                <span className="font-mono text-[10px]">{deliveryMethods.includes('player_id') ? '✓' : ''}</span>
              </button>

              <button
                type="button"
                onClick={() => toggleMethod('account_login')}
                className={`p-3 rounded-xl border text-xs font-medium text-right flex items-center justify-between transition-colors ${
                  deliveryMethods.includes('account_login')
                    ? 'bg-amber-500/15 border-amber-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>فوري عبر الحساب (2FA)</span>
                </span>
                <span className="font-mono text-[10px]">{deliveryMethods.includes('account_login') ? '✓' : ''}</span>
              </button>

              <button
                type="button"
                onClick={() => toggleMethod('voucher_code')}
                className={`p-3 rounded-xl border text-xs font-medium text-right flex items-center justify-between transition-colors ${
                  deliveryMethods.includes('voucher_code')
                    ? 'bg-amber-500/15 border-amber-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Ticket className="w-3.5 h-3.5 text-purple-400" />
                  <span>عبر تسليم كود قسيمة</span>
                </span>
                <span className="font-mono text-[10px]">{deliveryMethods.includes('voucher_code') ? '✓' : ''}</span>
              </button>
            </div>
          </div>

          {/* Packages & Tier Pricing Matrix (Independent Per Delivery Method) */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white">
                    باقات الخدمة وتسعيرات الرتب ({currencyLabel}) — مستقلة لكل طريقة تسليم:
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  اختر طريقة التسليم أدناه لإضافة وتعديل باقاتها الخاصة بعملة العرض الحالية ({currencyLabel}).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPackageForm(!showAddPackageForm)}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة باقة لـ ({getDeliveryMethodLabelAr(activePackageMethod)})</span>
              </button>
            </div>

            {/* Segmented Tabs for Each Active Delivery Method */}
            <div className="flex flex-wrap gap-2 p-1.5 rounded-xl bg-slate-900 border border-slate-800">
              {deliveryMethods.map(method => {
                const isActiveTab = activePackageMethod === method;
                const count = (packagesByMethod[method] || []).length;
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => {
                      setActivePackageMethod(method);
                      setShowAddPackageForm(false);
                    }}
                    className={`flex-1 min-w-[150px] px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                      isActiveTab
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-transparent text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      {renderMethodIcon(method)}
                      <span className="truncate">{getDeliveryMethodLabelAr(method)}</span>
                    </span>
                    <span
                      className={`font-mono tabular-nums text-[11px] px-1.5 py-0.5 rounded ${
                        isActiveTab
                          ? 'bg-slate-950/20 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Inline Add Package Form (scoped to activePackageMethod) */}
            {showAddPackageForm && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-amber-300">
                    إضافة باقة جديدة لطريقة: {getDeliveryMethodLabelAr(activePackageMethod)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddPackageForm(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">اسم الباقة الجديدة:</label>
                  <input
                    type="text"
                    value={newPkgName}
                    onChange={e => setNewPkgName(e.target.value)}
                    placeholder="مثال: باقة 300 شدة + 25 مجاناً"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="block text-[10px] text-slate-400 mb-1">رتبة عادي ({currencyLabel})</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={newPriceRegular}
                      onChange={e => setNewPriceRegular(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1 px-1 text-center font-mono font-bold text-white text-xs"
                    />
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900 border border-amber-900/30">
                    <span className="block text-[10px] text-amber-500 mb-1">رتبة نحاسي ({currencyLabel})</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={newPriceBronze}
                      onChange={e => setNewPriceBronze(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1 px-1 text-center font-mono font-bold text-amber-400 text-xs"
                    />
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700">
                    <span className="block text-[10px] text-slate-300 mb-1">رتبة فضي ({currencyLabel})</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={newPriceSilver}
                      onChange={e => setNewPriceSilver(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1 px-1 text-center font-mono font-bold text-slate-200 text-xs"
                    />
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900 border border-yellow-500/30">
                    <span className="block text-[10px] text-yellow-400 mb-1">رتبة ذهبي ({currencyLabel})</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={newPriceGold}
                      onChange={e => setNewPriceGold(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1 px-1 text-center font-mono font-bold text-yellow-300 text-xs"
                    />
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900 border border-purple-500/40 col-span-2 sm:col-span-1">
                    <span className="block text-[10px] text-purple-400 mb-1 font-bold">رتبة مميز VIP ({currencyLabel})</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={newPriceVip}
                      onChange={e => setNewPriceVip(e.target.value)}
                      className="w-full bg-slate-950 border border-purple-500/60 rounded-lg py-1 px-1 text-center font-mono font-bold text-purple-300 text-xs"
                    />
                  </div>
                </div>

                {activeMethodIsVoucher ? (
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">أكواد القسائم الخاصة بهذه الباقة (اختياري، كود بكل سطر):</label>
                    <textarea
                      rows={2}
                      value={newVouchersInput}
                      onChange={e => setNewVouchersInput(e.target.value)}
                      placeholder="PUBG-VOUCHER-111&#10;PUBG-VOUCHER-222"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs font-mono text-amber-300 outline-none"
                      dir="ltr"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-[11px] text-emerald-300 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>الخدمة متوفرة دائماً بدون عدد ولا تحتاج إلى ربط بمخزن أكواد</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddPackageForm(false)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleAddNewPackage}
                    className="px-4 py-1.5 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 text-xs font-bold"
                  >
                    إضافة الباقة للقائمة
                  </button>
                </div>
              </div>
            )}

            {/* Existing Packages List for activePackageMethod */}
            <div className="space-y-4">
              {activePackages.map((pkg, idx) => (
                <div key={pkg.id || idx} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-mono text-xs flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={pkg.name}
                        onChange={e => handleUpdatePackageName(pkg.id, e.target.value)}
                        placeholder={`اسم الباقة (${getDeliveryMethodLabelAr(activePackageMethod)})`}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-bold outline-none focus:border-amber-500"
                      />
                    </div>
                    {activePackages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeletePackage(pkg.id)}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
                        title="حذف الباقة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Pricing per 5 tiers */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                    {([
                      { tier: 'regular' as const, label: `عادي (${currencyLabel})`, cardCls: 'bg-slate-950 border-slate-800', lblCls: 'text-slate-400', inputCls: 'bg-slate-900 border-slate-700 text-white' },
                      { tier: 'bronze' as const, label: `نحاسي (${currencyLabel})`, cardCls: 'bg-slate-950 border-amber-900/30', lblCls: 'text-amber-500', inputCls: 'bg-slate-900 border-slate-700 text-amber-400' },
                      { tier: 'silver' as const, label: `فضي (${currencyLabel})`, cardCls: 'bg-slate-950 border-slate-700', lblCls: 'text-slate-300', inputCls: 'bg-slate-900 border-slate-700 text-slate-200' },
                      { tier: 'gold' as const, label: `ذهبي (${currencyLabel})`, cardCls: 'bg-slate-950 border-yellow-500/30', lblCls: 'text-yellow-400', inputCls: 'bg-slate-900 border-slate-700 text-yellow-300' },
                      { tier: 'vip' as const, label: `مميز VIP (${currencyLabel})`, cardCls: 'bg-slate-950 border-purple-500/40 col-span-2 sm:col-span-1', lblCls: 'text-purple-400 font-bold', inputCls: 'bg-slate-900 border-purple-500/60 text-purple-300' },
                    ]).map(({ tier, label, cardCls, lblCls, inputCls }) => {
                      const draftKey = `${pkg.id}:${tier}`;
                      const displayVal = draftKey in priceDrafts
                        ? priceDrafts[draftKey]
                        : String(Number(convertFromSar(pkg.tierPrices?.[tier] ?? 0).toFixed(2)));
                      return (
                        <div key={tier} className={`p-2 rounded-xl border ${cardCls}`}>
                          <span className={`block text-[10px] mb-1 ${lblCls}`}>{label}</span>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={displayVal}
                            onChange={e => {
                              const raw = e.target.value;
                              setPriceDrafts(prev => ({ ...prev, [draftKey]: raw }));
                              const parsed = Number(raw);
                              if (raw !== '' && Number.isFinite(parsed) && parsed >= 0) {
                                handleUpdatePackagePrice(pkg.id, tier, convertToSar(parsed));
                              }
                            }}
                            onBlur={() => {
                              setPriceDrafts(prev => {
                                if (!(draftKey in prev)) return prev;
                                const next = { ...prev };
                                delete next[draftKey];
                                return next;
                              });
                            }}
                            className={`w-full border rounded-lg py-1 px-1 text-center font-mono font-bold text-xs ${inputCls}`}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Stock / Warehouse Linking / Always-Available Status per package */}
                  {activeMethodIsVoucher ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/70 text-[11px]">
                      <div>
                        <label className="block text-slate-400 mb-1">ربط بمخزن أكواد جاهز (اختياري):</label>
                        <select
                          value={pkg.warehouseId || ''}
                          onChange={e => handleLinkPackageWarehouse(pkg.id, e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                        >
                          <option value="">-- بدون ربط بمخزن خارجي --</option>
                          {supplierWarehouses.map(wh => (
                            <option key={wh.id} value={wh.id}>
                              {wh.categoryName} - {wh.nameAr} ({wh.codes.length} كود)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1">كمية المخزون المتوفرة:</label>
                        <input
                          type="number"
                          min={0}
                          disabled={Boolean(pkg.warehouseId) || Array.isArray(pkg.vouchers)}
                          value={pkg.availableStock ?? 0}
                          onChange={e => handleUpdatePackageStock(pkg.id, Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white disabled:opacity-60"
                        />
                      </div>

                      {!pkg.warehouseId && (
                        <div className="sm:col-span-2">
                          <label className="block text-slate-400 mb-1">
                            أكواد القسائم لهذه الباقة (أدخل الأكواد الحقيقية، كود في كل سطر):
                          </label>
                          <textarea
                            rows={2}
                            value={(pkg.vouchers || []).join('\n')}
                            onChange={e => handleUpdatePackageVouchers(pkg.id, e.target.value)}
                            placeholder="أدخل أكواد القسائم الحقيقية أو اربط الباقة بمخزن أكواد"
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs font-mono text-amber-300"
                            dir="ltr"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-slate-800/70">
                      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px]">
                        <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>متوفرة دائماً (بدون عدد)</span>
                        </span>
                        <span className="text-emerald-200/80 text-[10px]">
                          التسليم عبر الحساب أو الأيدي لا يحتاج إلى ربط بمخزن أكواد أو تحديد كمية توفر
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {isCatalogFreeGifts(catalogs.find(c => c.id === catalogId)) ? (
              <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 space-y-3">
                <div className="flex items-start gap-2">
                  <Gift className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-purple-300 block text-xs">إعدادات استهداف الهدايا المجانية:</span>
                    <p className="text-[11px] text-purple-200 mt-0.5">
                      هذه الخدمة مجانية (السعر: {formatCurrency(0)}). يحدد المتجر من يستهدف بالهدية:
                    </p>
                  </div>
                </div>

                {/* Targeting Type Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setGiftTargetType('all_tiers')}
                    className={`p-2.5 rounded-xl border text-xs font-medium text-center transition-all ${
                      giftTargetType === 'all_tiers'
                        ? 'bg-purple-600/30 border-purple-500 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    جميع الرتب (كل العملاء)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGiftTargetType('specific_tiers')}
                    className={`p-2.5 rounded-xl border text-xs font-medium text-center transition-all ${
                      giftTargetType === 'specific_tiers'
                        ? 'bg-purple-600/30 border-purple-500 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    رتب حسابات محددة
                  </button>
                  <button
                    type="button"
                    onClick={() => setGiftTargetType('specific_clients')}
                    className={`p-2.5 rounded-xl border text-xs font-medium text-center transition-all ${
                      giftTargetType === 'specific_clients'
                        ? 'bg-purple-600/30 border-purple-500 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    عملاء / نقاط بيع محددة
                  </button>
                </div>

                {/* If specific_tiers */}
                {giftTargetType === 'specific_tiers' && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <span className="block text-[11px] font-semibold text-slate-300">اختر الرتب المؤهلة للحصول على الهدية:</span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'regular', label: 'عادي' },
                        { id: 'bronze', label: 'نحاسي' },
                        { id: 'silver', label: 'فضي' },
                        { id: 'gold', label: 'ذهبي' },
                        { id: 'vip', label: 'مميز VIP' }
                      ].map(tier => {
                        const isSelected = giftTargetTiers.includes(tier.id as AccountTier);
                        return (
                          <button
                            key={tier.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                if (giftTargetTiers.length > 1) {
                                  setGiftTargetTiers(giftTargetTiers.filter(t => t !== tier.id));
                                }
                              } else {
                                setGiftTargetTiers([...giftTargetTiers, tier.id as AccountTier]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                              isSelected
                                ? 'bg-purple-500 text-slate-950 font-bold border-purple-400'
                                : 'bg-slate-900 border-slate-700 text-slate-300'
                            }`}
                          >
                            <span>{tier.label}</span>
                            {isSelected && <Check className="w-3 h-3" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* If specific_clients */}
                {giftTargetType === 'specific_clients' && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="block text-[11px] font-semibold text-slate-300">اختر العملاء / نقاط البيع المستهدفة بالهدية:</span>
                      <span className="text-[10px] font-mono text-purple-300 font-bold">
                        المحدد: {giftTargetPosIds.length} عميل
                      </span>
                    </div>
                    {targetableClients.length === 0 ? (
                      <p className="text-[11px] text-slate-400">لا توجد نقاط بيع مسجلة حالياً.</p>
                    ) : (
                      <div className="max-h-40 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                        {targetableClients.map(client => {
                          const isSelected = giftTargetPosIds.includes(client.id);
                          const clientTierInfo = TIERS_CONFIG[client.tier];
                          return (
                            <div
                              key={client.id}
                              onClick={() => {
                                if (isSelected) {
                                  setGiftTargetPosIds(giftTargetPosIds.filter(id => id !== client.id));
                                } else {
                                  setGiftTargetPosIds([...giftTargetPosIds, client.id]);
                                }
                              }}
                              className={`p-2 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-purple-500/20 border-purple-500 text-purple-200'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                              }`}
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-white">{client.tradeName}</span>
                                <span className="font-mono text-[10px] text-amber-300">{client.posCode}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${clientTierInfo.badgeColor} ${clientTierInfo.textColor}`}>
                                  {clientTierInfo.nameAr}
                                </span>
                                <span className="text-[10px] text-slate-400">({client.phone || client.ownerName})</span>
                              </div>
                              <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${isSelected ? 'bg-purple-500 border-purple-400 text-slate-950' : 'border-slate-700'}`}>
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Gift Usage Limit Per Client & Visibility Duration */}
                <div className="pt-2 border-t border-purple-500/20 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Usage Limit Per Client */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <label className="block text-[11px] font-bold text-purple-300">
                      عدد مرات الاستخدام المسموحة لكل عميل (غالباً مرة واحدة):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={giftMaxUsesPerClient}
                        onChange={e => setGiftMaxUsesPerClient(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                        className="w-24 bg-slate-900 border border-purple-500/40 rounded-lg px-2.5 py-1.5 text-center font-mono font-bold text-xs text-white outline-none focus:border-purple-400"
                      />
                      <span className="text-[11px] text-slate-400">
                        {giftMaxUsesPerClient === 1 ? 'مرة واحدة لكل عميل' : `${giftMaxUsesPerClient} مرات لكل عميل`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[1, 2, 3, 5].map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setGiftMaxUsesPerClient(preset)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                            giftMaxUsesPerClient === preset
                              ? 'bg-purple-600 text-white border-purple-400'
                              : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-purple-500/40'
                          }`}
                        >
                          {preset === 1 ? 'مرة واحدة (1)' : preset === 2 ? 'مرتين (2)' : `${preset} مرات`}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      بمجرد أن يستخدم العميل الهدية بهذا العدد، تصبح غير مفعلة لديه تلقائياً.
                    </p>
                  </div>

                  {/* Gift Visibility / Active Period */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <label className="block text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-purple-400" />
                      <span>فترة بقاء الهدية مفعلة للعملاء:</span>
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setGiftPeriodMode('unlimited')}
                        className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                          giftPeriodMode === 'unlimited'
                            ? 'bg-purple-600 text-white border-purple-400'
                            : 'bg-slate-900 text-slate-300 border-slate-700'
                        }`}
                      >
                        مفتوحة دائماً
                      </button>
                      <button
                        type="button"
                        onClick={() => setGiftPeriodMode('duration')}
                        className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                          giftPeriodMode === 'duration'
                            ? 'bg-purple-600 text-white border-purple-400'
                            : 'bg-slate-900 text-slate-300 border-slate-700'
                        }`}
                      >
                        مدة محددة
                      </button>
                      <button
                        type="button"
                        onClick={() => setGiftPeriodMode('custom_date')}
                        className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                          giftPeriodMode === 'custom_date'
                            ? 'bg-purple-600 text-white border-purple-400'
                            : 'bg-slate-900 text-slate-300 border-slate-700'
                        }`}
                      >
                        تاريخ محدد
                      </button>
                    </div>

                    {giftPeriodMode === 'duration' && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={giftDurationValue}
                            onChange={e => setGiftDurationValue(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                            className="w-20 bg-slate-900 border border-purple-500/40 rounded-lg px-2 py-1 text-center font-mono font-bold text-xs text-white outline-none focus:border-purple-400"
                          />
                          <select
                            value={giftDurationUnit}
                            onChange={e => setGiftDurationUnit(e.target.value as GiftDurationUnit)}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-purple-400"
                          >
                            <option value="hours">ساعة / ساعات</option>
                            <option value="days">يوم / أيام</option>
                          </select>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { v: 24, u: 'hours' as GiftDurationUnit, label: '24 ساعة' },
                            { v: 3, u: 'days' as GiftDurationUnit, label: '3 أيام' },
                            { v: 7, u: 'days' as GiftDurationUnit, label: '7 أيام' },
                            { v: 30, u: 'days' as GiftDurationUnit, label: '30 يوماً' },
                          ].map(item => (
                            <button
                              key={item.label}
                              type="button"
                              onClick={() => {
                                setGiftDurationValue(item.v);
                                setGiftDurationUnit(item.u);
                              }}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                                giftDurationValue === item.v && giftDurationUnit === item.u
                                  ? 'bg-purple-500/30 text-purple-200 border-purple-400'
                                  : 'bg-slate-900 text-slate-400 border-slate-700'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {giftPeriodMode === 'custom_date' && (
                      <div className="pt-1">
                        <input
                          type="datetime-local"
                          value={giftCustomExpiryLocal}
                          onChange={e => setGiftCustomExpiryLocal(e.target.value)}
                          dir="ltr"
                          className="w-full bg-slate-900 border border-purple-500/40 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white outline-none focus:border-purple-400"
                        />
                      </div>
                    )}

                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      {giftPeriodMode === 'unlimited'
                        ? 'تبقى الهدية متاحة حتى يستخدم العميل المرات المحددة له.'
                        : 'إذا انتهت الفترة المحددة ولم يستخدم العميل الهدية، تصبح غير مفعلة عنده تلقائياً.'}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-md"
          >
            <span>حفظ الخدمة وإضافتها للكتالوج</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

