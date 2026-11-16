import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { DeliveryMethod, AccountTier, ServicePackage } from '../../types';
import { isCatalogFreeGifts, getEffectiveAppFeePercentage } from '../../utils/pricing';
import { getCatalogsForSupplierView } from '../../utils/platformSettings';
import { X, Plus, Trash2, ArrowRight, Upload, Image as ImageIcon, Check, Sparkles, Gamepad2, CreditCard, Tv, Gift, Package } from 'lucide-react';

interface AddServiceModalProps {
  onClose: () => void;
}

export const AddServiceModal: React.FC<AddServiceModalProps> = ({ onClose }) => {
  const { catalogs, supplier, superAdmin, posClients, addService, showToast } = useApp();
  const effectiveAppFeePct = getEffectiveAppFeePercentage(supplier, superAdmin);
  const supplierCatalogs = getCatalogsForSupplierView(catalogs, supplier.id);

  const [catalogId, setCatalogId] = useState(supplierCatalogs[0]?.id || '');
  const [nameAr, setNameAr] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethod[]>(['player_id', 'voucher_code']);

  // Gift targeting state
  const [giftTargetType, setGiftTargetType] = useState<'all_tiers' | 'specific_tiers' | 'specific_clients'>('all_tiers');
  const [giftTargetTiers, setGiftTargetTiers] = useState<AccountTier[]>(['regular', 'bronze', 'silver', 'gold', 'vip']);
  const [giftTargetPosIds, setGiftTargetPosIds] = useState<string[]>([]);

  // Service image state
  const [imageUrl, setImageUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Packages list state (support multiple packages when adding a new service)
  const [packages, setPackages] = useState<ServicePackage[]>([
    {
      id: `pkg-${Date.now()}`,
      name: 'باقة أساسية 660 شدة',
      description: 'باقة شحن رقمية معتمدة',
      tierPrices: { regular: 100, bronze: 90, silver: 80, gold: 70, vip: 60 },
      availableStock: 50
    }
  ]);

  // New package inline addition state
  const [showAddPackageForm, setShowAddPackageForm] = useState(false);
  const [newPkgName, setNewPkgName] = useState('');
  const [newPriceRegular, setNewPriceRegular] = useState<number>(100);
  const [newPriceBronze, setNewPriceBronze] = useState<number>(90);
  const [newPriceSilver, setNewPriceSilver] = useState<number>(80);
  const [newPriceGold, setNewPriceGold] = useState<number>(70);
  const [newPriceVip, setNewPriceVip] = useState<number>(60);
  const [newVouchersInput, setNewVouchersInput] = useState('');

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
      setDeliveryMethods(deliveryMethods.filter(m => m !== method));
    } else {
      setDeliveryMethods([...deliveryMethods, method]);
    }
  };

  const handleUpdatePackagePrice = (pkgId: string, tier: 'regular' | 'bronze' | 'silver' | 'gold' | 'vip', val: number) => {
    const safeVal = Number.isFinite(val) && val >= 0 ? val : 0;
    setPackages(prev => prev.map(p => {
      if (p.id === pkgId) {
        return {
          ...p,
          tierPrices: {
            ...p.tierPrices,
            [tier]: safeVal
          }
        };
      }
      return p;
    }));
  };

  const handleUpdatePackageName = (pkgId: string, name: string) => {
    setPackages(prev => prev.map(p => p.id === pkgId ? { ...p, name } : p));
  };

  const handleDeletePackage = (pkgId: string) => {
    if (packages.length <= 1) {
      showToast({ type: 'error', title: 'تنبيه', description: 'يجب أن تحتوي الخدمة على باقة واحدة على الأقل' });
      return;
    }
    setPackages(prev => prev.filter(p => p.id !== pkgId));
  };

  const handleAddNewPackage = () => {
    if (!newPkgName.trim()) {
      showToast({ type: 'error', title: 'تنبيه', description: 'يرجى إدخال اسم الباقة الجديدة' });
      return;
    }
    const parsePrice = (val: number, fallback: number) =>
      typeof val === 'number' && Number.isFinite(val) && val >= 0 ? val : fallback;

    const vouchers = newVouchersInput
      .split('\n')
      .map(v => v.trim())
      .filter(Boolean);

    const newPkg: ServicePackage = {
      id: `pkg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: newPkgName.trim(),
      description: 'باقة شحن رقمية معتمدة',
      tierPrices: {
        regular: parsePrice(newPriceRegular, 100),
        bronze: parsePrice(newPriceBronze, 90),
        silver: parsePrice(newPriceSilver, 80),
        gold: parsePrice(newPriceGold, 70),
        vip: parsePrice(newPriceVip, 60)
      },
      availableStock: vouchers.length > 0 ? vouchers.length : 50,
      vouchers: vouchers.length > 0 ? vouchers : undefined
    };
    setPackages(prev => [...prev, newPkg]);
    setNewPkgName('');
    setNewVouchersInput('');
    setShowAddPackageForm(false);
    showToast({ type: 'success', title: 'تمت إضافة الباقة', description: `تمت إضافة "${newPkg.name}" بنجاح` });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) {
      showToast({ type: 'error', title: 'تنبيه', description: 'يرجى إكمال بيانات الخدمة' });
      return;
    }
    if (packages.length === 0) {
      showToast({ type: 'error', title: 'تنبيه', description: 'يجب أن تحتوي الخدمة على باقة واحدة على الأقل' });
      return;
    }

    const isGiftCat = isCatalogFreeGifts(catalogs.find(c => c.id === catalogId));

    addService({
      catalogId,
      nameAr: nameAr.trim(),
      descriptionAr: descriptionAr.trim() || 'خدمة رقمية شحن فوري معتمد',
      icon: 'Gamepad2',
      imageUrl: imageUrl.trim() || undefined,
      deliveryMethods,
      packages,
      giftTargetType: isGiftCat ? giftTargetType : undefined,
      giftTargetTiers: isGiftCat && giftTargetType === 'specific_tiers' ? giftTargetTiers : undefined,
      giftTargetPosIds: isGiftCat && giftTargetType === 'specific_clients' ? giftTargetPosIds : undefined
    });

    showToast({ type: 'success', title: 'تمت إضافة الخدمة', description: 'تم حفظ الخدمة مع الباقات والأسعار بنجاح' });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 text-slate-100 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div>
            <h3 className="font-bold text-base text-white">إضافة خدمة رقمية جديدة مع إمكانية إضافة عدة باقات وتحديد تسعيرة الرتب</h3>
            <p className="text-xs text-slate-400">إدخال الخدمة والكتالوج وباقات متعددة وأسعارها لكل رتبة (مميز، ذهبي، فضي، نحاسي، عادي)</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar flex-1">
          
          {/* Service Image Selection (File Upload + Curated Presets) */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-white flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>صورة أو غلاف الخدمة الرقمية:</span>
              </label>
              <span className="text-[10px] text-slate-400">يمكنك رفع صورة من ملفاتك أو اختيار غلاف جاهز</span>
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
                <span>فوري عبر الأيدي</span>
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
                <span>فوري عبر الحساب (2FA)</span>
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
                <span>عبر تسليم كود قسيمة</span>
                <span className="font-mono text-[10px]">{deliveryMethods.includes('voucher_code') ? '✓' : ''}</span>
              </button>
            </div>
          </div>

          {/* Packages & Tier Pricing Matrix (Multiple Packages Support) */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white">
                  باقات الخدمة وتسعيرات الرتب (يمكنك إضافة باقات متعددة):
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPackageForm(!showAddPackageForm)}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة باقة جديدة</span>
              </button>
            </div>

            {/* Inline Add Package Form */}
            {showAddPackageForm && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-amber-300">إضافة باقة جديدة لهذه الخدمة</span>
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
                    <span className="block text-[10px] text-slate-400 mb-1">رتبة عادي</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={newPriceRegular}
                      onChange={e => setNewPriceRegular(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1 px-1 text-center font-mono font-bold text-white text-xs"
                    />
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900 border border-amber-900/30">
                    <span className="block text-[10px] text-amber-500 mb-1">رتبة نحاسي</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={newPriceBronze}
                      onChange={e => setNewPriceBronze(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1 px-1 text-center font-mono font-bold text-amber-400 text-xs"
                    />
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700">
                    <span className="block text-[10px] text-slate-300 mb-1">رتبة فضي</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={newPriceSilver}
                      onChange={e => setNewPriceSilver(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1 px-1 text-center font-mono font-bold text-slate-200 text-xs"
                    />
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900 border border-yellow-500/30">
                    <span className="block text-[10px] text-yellow-400 mb-1">رتبة ذهبي</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={newPriceGold}
                      onChange={e => setNewPriceGold(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1 px-1 text-center font-mono font-bold text-yellow-300 text-xs"
                    />
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900 border border-purple-500/40 col-span-2 sm:col-span-1">
                    <span className="block text-[10px] text-purple-400 mb-1 font-bold">رتبة مميز VIP</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={newPriceVip}
                      onChange={e => setNewPriceVip(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-purple-500/60 rounded-lg py-1 px-1 text-center font-mono font-bold text-purple-300 text-xs"
                    />
                  </div>
                </div>

                {deliveryMethods.includes('voucher_code') && (
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

            {/* Existing Packages List */}
            <div className="space-y-4">
              {packages.map((pkg, idx) => (
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
                        placeholder="اسم الباقة"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-bold outline-none focus:border-amber-500"
                      />
                    </div>
                    {packages.length > 1 && (
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
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="block text-[10px] text-slate-400 mb-1">عادي</span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={pkg.tierPrices?.regular ?? 100}
                        onChange={e => handleUpdatePackagePrice(pkg.id, 'regular', Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1 px-1 text-center font-mono font-bold text-white text-xs"
                      />
                    </div>

                    <div className="p-2 rounded-xl bg-slate-950 border border-amber-900/30">
                      <span className="block text-[10px] text-amber-500 mb-1">نحاسي</span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={pkg.tierPrices?.bronze ?? 90}
                        onChange={e => handleUpdatePackagePrice(pkg.id, 'bronze', Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1 px-1 text-center font-mono font-bold text-amber-400 text-xs"
                      />
                    </div>

                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-700">
                      <span className="block text-[10px] text-slate-300 mb-1">فضي</span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={pkg.tierPrices?.silver ?? 80}
                        onChange={e => handleUpdatePackagePrice(pkg.id, 'silver', Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1 px-1 text-center font-mono font-bold text-slate-200 text-xs"
                      />
                    </div>

                    <div className="p-2 rounded-xl bg-slate-950 border border-yellow-500/30">
                      <span className="block text-[10px] text-yellow-400 mb-1">ذهبي</span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={pkg.tierPrices?.gold ?? 70}
                        onChange={e => handleUpdatePackagePrice(pkg.id, 'gold', Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1 px-1 text-center font-mono font-bold text-yellow-300 text-xs"
                      />
                    </div>

                    <div className="p-2 rounded-xl bg-slate-950 border border-purple-500/40 col-span-2 sm:col-span-1">
                      <span className="block text-[10px] text-purple-400 mb-1 font-bold">مميز VIP</span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={pkg.tierPrices?.vip ?? 60}
                        onChange={e => handleUpdatePackagePrice(pkg.id, 'vip', Number(e.target.value))}
                        className="w-full bg-slate-900 border border-purple-500/60 rounded-lg py-1 px-1 text-center font-mono font-bold text-purple-300 text-xs"
                      />
                    </div>
                  </div>
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
                      هذه الخدمة مجانية (0 ر.س للعميل)، وستُحتسب رسوم التطبيق بالنسبة المحددة (<strong className="text-purple-300">{effectiveAppFeePct}%</strong>) من السعر الأصلي. يحدد المتجر من يستهدف بالهدية:
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
                    <span className="block text-[11px] font-semibold text-slate-300">اختر العملاء / نقاط البيع المستهدفة بالهدية:</span>
                    {posClients.length === 0 ? (
                      <p className="text-[11px] text-slate-400">لا توجد نقاط بيع مسجلة حالياً.</p>
                    ) : (
                      <div className="max-h-36 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                        {posClients.map(client => {
                          const isSelected = giftTargetPosIds.includes(client.id);
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
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white">{client.tradeName}</span>
                                <span className="text-[10px] text-slate-400">({client.phone || client.ownerName})</span>
                              </div>
                              <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${isSelected ? 'bg-purple-500 border-purple-400 text-slate-950' : 'border-slate-700'}`}>
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
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
