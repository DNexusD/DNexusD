import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { DigitalService, DeliveryMethod, ServicePackage, AccountTier } from '../../types';
import { isCatalogFreeGifts, getEffectiveAppFeePercentage } from '../../utils/pricing';
import { getCatalogsForSupplierView } from '../../utils/platformSettings';
import { 
  X, 
  Upload, 
  Trash2, 
  Plus, 
  Image as ImageIcon, 
  Check, 
  Gamepad2, 
  CreditCard, 
  Tv, 
  Layers, 
  AlertCircle,
  Package,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Gift
} from 'lucide-react';

interface EditServiceModalProps {
  service: DigitalService;
  onClose: () => void;
}

export const EditServiceModal: React.FC<EditServiceModalProps> = ({ service, onClose }) => {
  const { catalogs, supplier, superAdmin, posClients, voucherWarehouses, updateService, deleteService, showToast } = useApp();
  const effectiveAppFeePct = getEffectiveAppFeePercentage(supplier, superAdmin);
  const supplierCatalogs = getCatalogsForSupplierView(catalogs, supplier.id);
  const supplierWarehouses = voucherWarehouses.filter(w => !w.supplierId || w.supplierId === supplier.id);

  const [catalogId, setCatalogId] = useState(service.catalogId || supplierCatalogs[0]?.id || '');
  const [nameAr, setNameAr] = useState(service.nameAr || '');
  const [descriptionAr, setDescriptionAr] = useState(service.descriptionAr || '');
  const [imageUrl, setImageUrl] = useState<string>(service.imageUrl || '');
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethod[]>(service.deliveryMethods || ['player_id']);
  const [isActive, setIsActive] = useState<boolean>(service.isActive !== false);

  // Gift targeting state
  const [giftTargetType, setGiftTargetType] = useState<'all_tiers' | 'specific_tiers' | 'specific_clients'>(
    service.giftTargetType || 'all_tiers'
  );
  const [giftTargetTiers, setGiftTargetTiers] = useState<AccountTier[]>(
    service.giftTargetTiers || ['regular', 'bronze', 'silver', 'gold', 'vip']
  );
  const [giftTargetPosIds, setGiftTargetPosIds] = useState<string[]>(
    service.giftTargetPosIds || []
  );

  // Packages list state
  const [packages, setPackages] = useState<ServicePackage[]>(
    service.packages && service.packages.length > 0 
      ? JSON.parse(JSON.stringify(service.packages))
      : [{
          id: `pkg-${Date.now()}`,
          name: 'باقة أساسية',
          tierPrices: { regular: 100, bronze: 90, silver: 80, gold: 70, vip: 60 }
        }]
  );

  // New package inline addition state
  const [showAddPackageForm, setShowAddPackageForm] = useState(false);
  const [newPkgName, setNewPkgName] = useState('');
  const [newPriceRegular, setNewPriceRegular] = useState<number>(100);
  const [newPriceBronze, setNewPriceBronze] = useState<number>(90);
  const [newPriceSilver, setNewPriceSilver] = useState<number>(80);
  const [newPriceGold, setNewPriceGold] = useState<number>(70);
  const [newPriceVip, setNewPriceVip] = useState<number>(60);

  // Delete service confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast({ 
          type: 'error', 
          title: 'حجم الملف كبير', 
          description: 'يرجى اختيار صورة بحجم أقل من 2 ميجابايت' 
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
        showToast({ 
          type: 'success', 
          title: 'تم تحديث الصورة', 
          description: 'تم تحميل الصورة بنجاح' 
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleMethod = (method: DeliveryMethod) => {
    if (deliveryMethods.includes(method)) {
      if (deliveryMethods.length === 1) {
        showToast({ type: 'error', title: 'تنبيه', description: 'يجب اختيار طريقة تسليم واحدة على الأقل' });
        return;
      }
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

  const handleUpdatePackageStock = (pkgId: string, stock: number) => {
    const safeStock = Math.max(0, Math.floor(Number.isFinite(stock) ? stock : 0));
    setPackages(prev => prev.map(p => (p.id === pkgId ? { ...p, availableStock: safeStock } : p)));
  };

  const handleLinkPackageWarehouse = (pkgId: string, warehouseId: string) => {
    if (!warehouseId) {
      setPackages(prev => prev.map(p => (p.id === pkgId ? { ...p, warehouseId: undefined } : p)));
      return;
    }
    const wh = supplierWarehouses.find(w => w.id === warehouseId);
    if (!wh) return;
    setPackages(prev =>
      prev.map(p =>
        p.id === pkgId
          ? {
              ...p,
              warehouseId: wh.id,
              vouchers: [...wh.codes],
              availableStock: wh.codes.length
            }
          : p
      )
    );
  };

  const handleAddNewPackage = () => {
    if (!newPkgName.trim()) {
      showToast({ type: 'error', title: 'تنبيه', description: 'يرجى إدخال اسم الباقة الجديدة' });
      return;
    }
    const parsePrice = (val: number, fallback: number) =>
      typeof val === 'number' && Number.isFinite(val) && val >= 0 ? val : fallback;

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
      availableStock: 50
    };
    setPackages(prev => [...prev, newPkg]);
    setNewPkgName('');
    setShowAddPackageForm(false);
    showToast({ type: 'success', title: 'تمت إضافة الباقة', description: `تمت إضافة "${newPkg.name}" بنجاح` });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) {
      showToast({ type: 'error', title: 'تنبيه', description: 'يرجى كتابة اسم الخدمة' });
      return;
    }
    if (packages.length === 0) {
      showToast({ type: 'error', title: 'تنبيه', description: 'يجب أن تحتوي الخدمة على باقة واحدة على الأقل' });
      return;
    }

    const isGiftCat = isCatalogFreeGifts(catalogs.find(c => c.id === catalogId));

    updateService(service.id, {
      catalogId,
      nameAr: nameAr.trim(),
      descriptionAr: descriptionAr.trim(),
      imageUrl: imageUrl.trim() || undefined,
      deliveryMethods,
      isActive,
      packages,
      giftTargetType: isGiftCat ? giftTargetType : undefined,
      giftTargetTiers: isGiftCat && giftTargetType === 'specific_tiers' ? giftTargetTiers : undefined,
      giftTargetPosIds: isGiftCat && giftTargetType === 'specific_clients' ? giftTargetPosIds : undefined
    });

    onClose();
  };

  const handleDeleteService = () => {
    deleteService(service.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 text-slate-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 overflow-hidden">
              {imageUrl ? (
                <img src={imageUrl} alt={service.nameAr} className="w-full h-full object-cover" />
              ) : (
                <Gamepad2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-base text-white">تعديل بيانات الخدمة الرقمية</h3>
              <p className="text-xs text-slate-400">
                معرف الخدمة: <span className="font-mono text-amber-400">{service.id}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 custom-scrollbar flex-1">
          {/* Service Image Section */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>صورة أو غلاف الخدمة:</span>
              </label>
              <span className="text-[10px] text-slate-400">JPG, PNG, WebP (بحد أقصى 2MB)</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative w-20 h-20 rounded-2xl bg-slate-900 border-2 border-amber-500/40 overflow-hidden shrink-0 flex items-center justify-center shadow-lg group">
                {imageUrl ? (
                  <img src={imageUrl} alt="معاينة الخدمة" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-600" />
                )}
                {imageUrl && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[10px] text-white">
                    معاينة
                  </div>
                )}
              </div>

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
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>تغيير صورة الخدمة</span>
                  </button>

                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
                      title="إزالة الصورة واستخدام الأيقونة الافتراضية"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div>
                  <input
                    type="url"
                    value={imageUrl.startsWith('data:') ? '' : imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    placeholder="أو ضع رابط URL مباشر للصورة (اختياري)..."
                    className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Basic Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                الكتالوج التابع له: <span className="text-rose-400">*</span>
              </label>
              <select
                value={catalogId}
                onChange={e => setCatalogId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white outline-none transition-colors"
              >
                {supplierCatalogs.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nameAr}{cat.isFixedByAdmin || cat.supplierId === 'all' ? ' (ثابت من الإدارة)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                اسم الخدمة الرقمية: <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={nameAr}
                onChange={e => setNameAr(e.target.value)}
                placeholder="مثال: شحن شدات ببجي موبايل (PUBG Mobile)"
                className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              وصف الخدمة وملاحظات التسليم:
            </label>
            <textarea
              rows={2}
              value={descriptionAr}
              onChange={e => setDescriptionAr(e.target.value)}
              placeholder="مثال: شحن فوري مباشر معتمد عبر الأيدي أو كود قسيمة أكتيفيجن"
              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white outline-none transition-colors resize-none"
            />
          </div>

          {/* Delivery Methods & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                طرق التسليم المتاحة للعميل:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => toggleMethod('player_id')}
                  className={`p-2 rounded-xl border text-xs font-medium text-center flex flex-col items-center justify-center gap-1 transition-all ${
                    deliveryMethods.includes('player_id')
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <Gamepad2 className="w-3.5 h-3.5" />
                  <span className="text-[11px]">فوري عبر الأيدي</span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleMethod('account_login')}
                  className={`p-2 rounded-xl border text-xs font-medium text-center flex flex-col items-center justify-center gap-1 transition-all ${
                    deliveryMethods.includes('account_login')
                      ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span className="text-[11px]">عبر الحساب 2FA</span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleMethod('voucher_code')}
                  className={`p-2 rounded-xl border text-xs font-medium text-center flex flex-col items-center justify-center gap-1 transition-all ${
                    deliveryMethods.includes('voucher_code')
                      ? 'bg-purple-500/15 border-purple-500 text-purple-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span className="text-[11px]">كود قسيمة</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                حالة الخدمة:
              </label>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`w-full p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                  isActive
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <span>{isActive ? 'الخدمة نشطة ومتاحة' : 'متوقفة مؤقتاً'}</span>
                {isActive ? (
                  <ToggleRight className="w-5 h-5 text-emerald-400" />
                ) : (
                  <ToggleLeft className="w-5 h-5 text-slate-500" />
                )}
              </button>
            </div>
          </div>

          {/* Packages and 5-Tier Pricing Matrix */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-amber-400" />
                  <span>باقات الخدمة وتسعيرات الرتب الـ 5:</span>
                </h4>
                <p className="text-[10px] text-slate-400">
                  يمكنك تعديل أسعار كل باقة حسب الرتب: عادي، نحاسي، فضي، ذهبي، ومميز VIP.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPackageForm(!showAddPackageForm)}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة باقة جديدة</span>
              </button>
            </div>

            {/* Inline Add Package Form */}
            {showAddPackageForm && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-amber-300">إضافة باقة جديدة للخدمة</span>
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

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div>
                    <span className="block text-[10px] text-slate-400 mb-0.5">عادي (الأساسي)</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={newPriceRegular}
                      onChange={e => setNewPriceRegular(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-1 text-xs text-center text-white"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-amber-400 mb-0.5">نحاسي</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={newPriceBronze}
                      onChange={e => setNewPriceBronze(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-2 py-1 text-xs text-center text-amber-300 font-bold"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-200 mb-0.5">فضي</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={newPriceSilver}
                      onChange={e => setNewPriceSilver(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-slate-400/40 rounded-xl px-2 py-1 text-xs text-center text-slate-200 font-bold"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-yellow-400 mb-0.5">ذهبي</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={newPriceGold}
                      onChange={e => setNewPriceGold(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-yellow-500/40 rounded-xl px-2 py-1 text-xs text-center text-yellow-300 font-bold"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-purple-400 mb-0.5 font-bold">مميز VIP</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={newPriceVip}
                      onChange={e => setNewPriceVip(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-purple-500/40 rounded-xl px-2 py-1 text-xs text-center text-purple-300 font-bold"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleAddNewPackage}
                    className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors"
                  >
                    إدراج الباقة
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddPackageForm(false)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}

            {/* Existing Packages Cards */}
            <div className="space-y-3">
              {packages.map((pkg, idx) => (
                <div key={pkg.id || idx} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-400 block mb-0.5">اسم الباقة:</label>
                      <input
                        type="text"
                        value={pkg.name}
                        onChange={e => handleUpdatePackageName(pkg.id, e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-1.5 text-xs text-white font-medium outline-none"
                      />
                    </div>
                    {packages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeletePackage(pkg.id)}
                        className="mt-4 p-2 rounded-xl bg-slate-900 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 border border-slate-800 transition-colors"
                        title="حذف هذه الباقة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* 5-tier price inputs */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    <div>
                      <span className="block text-[10px] text-slate-400 mb-0.5">عادي (الأساسي)</span>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={pkg.tierPrices?.regular ?? 100}
                          onChange={e => handleUpdatePackagePrice(pkg.id, 'regular', Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-1 text-center font-mono text-white text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <span className="block text-[10px] text-amber-400 mb-0.5">نحاسي</span>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={pkg.tierPrices?.bronze ?? 90}
                          onChange={e => handleUpdatePackagePrice(pkg.id, 'bronze', Number(e.target.value))}
                          className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-2 py-1 text-center font-mono text-amber-300 font-bold text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <span className="block text-[10px] text-slate-200 mb-0.5">فضي</span>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={pkg.tierPrices?.silver ?? 80}
                          onChange={e => handleUpdatePackagePrice(pkg.id, 'silver', Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-400/40 rounded-xl px-2 py-1 text-center font-mono text-slate-200 font-bold text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <span className="block text-[10px] text-yellow-400 mb-0.5">ذهبي</span>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={pkg.tierPrices?.gold ?? 70}
                          onChange={e => handleUpdatePackagePrice(pkg.id, 'gold', Number(e.target.value))}
                          className="w-full bg-slate-900 border border-yellow-500/40 rounded-xl px-2 py-1 text-center font-mono text-yellow-300 font-bold text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <span className="block text-[10px] text-purple-400 mb-0.5 font-bold">مميز VIP</span>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={pkg.tierPrices?.vip ?? 60}
                          onChange={e => handleUpdatePackagePrice(pkg.id, 'vip', Number(e.target.value))}
                          className="w-full bg-purple-950/40 border border-purple-500/50 rounded-xl px-2 py-1 text-center font-mono text-purple-300 font-bold text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Warehouse Link & Stock Control */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800/70 text-[11px]">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">ربط بمخزن أكواد:</label>
                      <select
                        value={pkg.warehouseId || ''}
                        onChange={e => handleLinkPackageWarehouse(pkg.id, e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                      >
                        <option value="">-- بدون ربط بمخزن --</option>
                        {supplierWarehouses.map(wh => (
                          <option key={wh.id} value={wh.id}>
                            {wh.categoryName} - {wh.nameAr} ({wh.codes.length} كود)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">
                        {pkg.warehouseId || Array.isArray(pkg.vouchers)
                          ? 'الأكواد المتوفرة حالياً:'
                          : 'كمية المخزون المتوفرة:'}
                      </label>
                      <input
                        type="number"
                        min={0}
                        disabled={Boolean(pkg.warehouseId) || Array.isArray(pkg.vouchers)}
                        value={
                          pkg.warehouseId
                            ? supplierWarehouses.find(w => w.id === pkg.warehouseId)?.codes.length ?? pkg.vouchers?.length ?? 0
                            : Array.isArray(pkg.vouchers)
                            ? pkg.vouchers.length
                            : pkg.availableStock ?? 50
                        }
                        onChange={e => handleUpdatePackageStock(pkg.id, Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white disabled:opacity-60"
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
            ) : packages.some(p => Object.values(p.tierPrices || {}).some(v => Number(v) === 0)) ? (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
                ملاحظة: أي باقة أو رتبة سعرها <strong>0 ر.س</strong> ستظهر للعميل وتُحتسب بقيمة <strong>0.50 ر.س</strong>.
              </div>
            ) : null}
          </div>

          {/* Delete service section */}
          {showDeleteConfirm ? (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-2">
              <p className="text-xs text-rose-300 font-medium">
                هل أنت متأكد من حذف خدمة "{service.nameAr}" نهائياً من المتجر؟
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDeleteService}
                  className="flex-1 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  تأكيد الحذف نهائياً
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
                >
                  تراجع
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-xs text-rose-400/80 hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف هذه الخدمة بالكامل</span>
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>حفظ تعديلات الخدمة والأسعار</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
