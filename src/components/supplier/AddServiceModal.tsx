import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { DeliveryMethod } from '../../types';
import { isCatalogFreeGifts, getEffectiveAppFeePercentage } from '../../utils/pricing';
import { getCatalogsForSupplierView } from '../../utils/platformSettings';
import { X, Plus, Trash2, ArrowRight, Upload, Image as ImageIcon, Check, Sparkles, Gamepad2, CreditCard, Tv, Gift } from 'lucide-react';

interface AddServiceModalProps {
  onClose: () => void;
}

export const AddServiceModal: React.FC<AddServiceModalProps> = ({ onClose }) => {
  const { catalogs, supplier, superAdmin, addService, showToast } = useApp();
  const effectiveAppFeePct = getEffectiveAppFeePercentage(supplier, superAdmin);
  const supplierCatalogs = getCatalogsForSupplierView(catalogs, supplier.id);

  const [catalogId, setCatalogId] = useState(supplierCatalogs[0]?.id || '');
  const [nameAr, setNameAr] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethod[]>(['player_id', 'voucher_code']);

  // Service image state
  const [imageUrl, setImageUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Package builder state
  const [packageName, setPackageName] = useState('باقة الموسم 660 شدة');
  const [priceRegular, setPriceRegular] = useState<number>(100);
  const [priceBronze, setPriceBronze] = useState<number>(90);
  const [priceSilver, setPriceSilver] = useState<number>(80);
  const [priceGold, setPriceGold] = useState<number>(70);
  const [priceVip, setPriceVip] = useState<number>(60);
  const [vouchersInput, setVouchersInput] = useState('');

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim() || !packageName.trim()) {
      showToast({ type: 'error', title: 'تنبيه', description: 'يرجى إكمال بيانات الخدمة والباقة' });
      return;
    }

    const vouchers = vouchersInput
      .split('\n')
      .map(v => v.trim())
      .filter(Boolean);

    const parseTierPrice = (val: number, fallback: number) =>
      typeof val === 'number' && Number.isFinite(val) && val >= 0 ? val : fallback;

    addService({
      catalogId,
      nameAr: nameAr.trim(),
      descriptionAr: descriptionAr.trim() || 'خدمة رقمية شحن فوري معتمد',
      icon: 'Gamepad2',
      imageUrl: imageUrl.trim() || undefined,
      deliveryMethods,
      packages: [
        {
          id: `pkg-${Date.now()}`,
          name: packageName.trim(),
          description: 'باقة شحن رقمية معتمدة',
          tierPrices: {
            regular: parseTierPrice(priceRegular, 100),
            bronze: parseTierPrice(priceBronze, 90),
            silver: parseTierPrice(priceSilver, 80),
            gold: parseTierPrice(priceGold, 70),
            vip: parseTierPrice(priceVip, 60)
          },
          availableStock: vouchers.length > 0 ? vouchers.length : 50,
          vouchers: vouchers.length > 0 ? vouchers : undefined
        }
      ]
    });

    showToast({ type: 'success', title: 'تمت إضافة الخدمة', description: 'تم حفظ الخدمة مع الصورة والأسعار بنجاح' });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 text-slate-100 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div>
            <h3 className="font-bold text-base text-white">إضافة خدمة رقمية جديدة وتحديد تسعيرة الرتب</h3>
            <p className="text-xs text-slate-400">إدخال الخدمة والكتالوج وأسعار الباقات لكل رتبة (مميز، ذهبي، فضي، نحاسي، عادي)</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5">
          
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

          {/* Package & Tier Pricing Matrix (Matches user specification exact numbers) */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400">
                تسعير الباقة حسب رتب نقاط البيع (ر.س):
              </span>
              <span className="text-[10px] text-slate-400">
                مثال: عادي 100، نحاسي 90، فضي 80، ذهبي 70، مميز 60
              </span>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">اسم الباقة:</label>
              <input
                type="text"
                required
                value={packageName}
                onChange={e => setPackageName(e.target.value)}
                placeholder="مثال: باقة 660 شدة"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="block text-[10px] text-slate-400 mb-1">رتبة عادي</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={priceRegular}
                  onChange={e => setPriceRegular(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1 px-1 text-center font-mono font-bold text-white text-xs"
                />
                <span className="text-[9px] text-slate-500 block mt-1">100 ر.س</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-amber-900/30">
                <span className="block text-[10px] text-amber-500 mb-1">رتبة نحاسي</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={priceBronze}
                  onChange={e => setPriceBronze(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1 px-1 text-center font-mono font-bold text-amber-400 text-xs"
                />
                <span className="text-[9px] text-slate-500 block mt-1">90 ر.س</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700">
                <span className="block text-[10px] text-slate-300 mb-1">رتبة فضي</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={priceSilver}
                  onChange={e => setPriceSilver(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1 px-1 text-center font-mono font-bold text-slate-200 text-xs"
                />
                <span className="text-[9px] text-slate-500 block mt-1">80 ر.س</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-yellow-500/30">
                <span className="block text-[10px] text-yellow-400 mb-1">رتبة ذهبي</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={priceGold}
                  onChange={e => setPriceGold(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1 px-1 text-center font-mono font-bold text-yellow-300 text-xs"
                />
                <span className="text-[9px] text-slate-500 block mt-1">70 ر.س</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-purple-500/40 col-span-2 sm:col-span-1">
                <span className="block text-[10px] text-purple-400 mb-1 font-bold">رتبة مميز VIP</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={priceVip}
                  onChange={e => setPriceVip(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-slate-950 border border-purple-500/60 rounded-lg py-1 px-1 text-center font-mono font-bold text-purple-300 text-xs ring-1 ring-purple-500/30"
                />
                <span className="text-[9px] text-slate-500 block mt-1">60 ر.س</span>
              </div>
            </div>

            {isCatalogFreeGifts(catalogs.find(c => c.id === catalogId)) ? (
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-start gap-2 text-[11px] text-purple-200">
                <Gift className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-purple-300 block">هذه الخدمة ضمن كتالوج الهدايا المجانية:</span>
                  <span>
                    سيتم تنفيذها للعميل الذي يملك ميزة الهدايا المجانية بسعر <strong className="text-white">0 ر.س</strong>، وتُحتسب رسوم التطبيق بالنسبة المحددة من مدير التطبيق (<strong className="text-purple-300">{effectiveAppFeePct}%</strong>) من السعر الأصلي المدخل لرتبة العميل.
                  </span>
                </div>
              </div>
            ) : [priceRegular, priceBronze, priceSilver, priceGold, priceVip].some(p => Number(p) === 0) ? (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
                ملاحظة: أي سعر رتبة يُحدد بقيمة <strong>0 ر.س</strong> سيظهر للعميل وتُحتسب قيمته بمبلغ <strong>0.50 ر.س</strong>.
              </div>
            ) : null}

            {deliveryMethods.includes('voucher_code') && (
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  أكواد القسائم الرقمية المتاحة (كود في كل سطر):
                </label>
                <textarea
                  rows={2}
                  value={vouchersInput}
                  onChange={e => setVouchersInput(e.target.value)}
                  placeholder="PUBG-660-9941-AA22&#10;PUBG-660-8812-BB33"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                  dir="ltr"
                />
              </div>
            )}
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
