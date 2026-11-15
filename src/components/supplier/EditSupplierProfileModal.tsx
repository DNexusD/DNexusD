import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SupplierCustomSocialLink, SupplierSocialLinks } from '../../types';
import {
  X,
  Building2,
  User,
  Upload,
  Check,
  Trash2,
  Globe,
  CreditCard,
  ChevronDown,
  Share2,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { ALL_WORLD_COUNTRIES } from '../../constants/countries';
import {
  normalizeSocialUrl,
  sanitizeSupplierSocialLinks,
  SOCIAL_PLATFORM_META,
  SocialPlatformKey,
} from '../../utils/socialLinks';
import { SocialPlatformIcon, SupplierContactLinks } from '../common/SupplierContactLinks';

interface EditSupplierProfileModalProps {
  onClose: () => void;
  initialSection?: 'profile' | 'social';
}

export const EditSupplierProfileModal: React.FC<EditSupplierProfileModalProps> = ({
  onClose,
  initialSection = 'profile',
}) => {
  const { supplier, updateSupplierProfile } = useApp();
  const socialSectionRef = useRef<HTMLDivElement | null>(null);

  const [name, setName] = useState(supplier.name || '');
  const [storeName, setStoreName] = useState(supplier.storeName || '');
  const [email, setEmail] = useState(supplier.email || '');
  const [phone, setPhone] = useState(supplier.phone || '');
  const [country, setCountry] = useState(supplier.country || 'المملكة العربية السعودية');
  const [city, setCity] = useState(supplier.city || '');
  const [logoUrl, setLogoUrl] = useState(supplier.logoUrl || '');
  const [logoError, setLogoError] = useState('');

  // Bank details
  const [bankName, setBankName] = useState(supplier.bankAccountDetails.bankName || '');
  const [accountHolder, setAccountHolder] = useState(supplier.bankAccountDetails.accountHolder || '');
  const [iban, setIban] = useState(supplier.bankAccountDetails.iban || '');
  const [accountNumber, setAccountNumber] = useState(supplier.bankAccountDetails.accountNumber || '');

  // Social / Contact Us links
  const [socialForm, setSocialForm] = useState<Record<SocialPlatformKey, string>>({
    whatsapp: supplier.socialLinks?.whatsapp || '',
    telegram: supplier.socialLinks?.telegram || '',
    instagram: supplier.socialLinks?.instagram || '',
    facebook: supplier.socialLinks?.facebook || '',
    x: supplier.socialLinks?.x || '',
    tiktok: supplier.socialLinks?.tiktok || '',
    youtube: supplier.socialLinks?.youtube || '',
    snapchat: supplier.socialLinks?.snapchat || '',
    website: supplier.socialLinks?.website || '',
  });
  const [customLinks, setCustomLinks] = useState<SupplierCustomSocialLink[]>(
    supplier.socialLinks?.customLinks || []
  );
  const [socialValidationError, setSocialValidationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialSection === 'social' && socialSectionRef.current) {
      const timer = setTimeout(() => {
        socialSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [initialSection]);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setLogoError('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 2 ميجابايت.');
      return;
    }

    setLogoError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setLogoUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSocialFieldChange = (key: SocialPlatformKey, value: string) => {
    setSocialForm((prev) => ({ ...prev, [key]: value }));
    if (socialValidationError) setSocialValidationError('');
  };

  const handleAddCustomLink = () => {
    setCustomLinks((prev) => [
      ...prev,
      { id: `custom-${Date.now()}-${prev.length + 1}`, label: '', url: '' },
    ]);
  };

  const handleCustomLinkChange = (id: string, field: 'label' | 'url', value: string) => {
    setCustomLinks((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
    if (socialValidationError) setSocialValidationError('');
  };

  const handleRemoveCustomLink = (id: string) => {
    setCustomLinks((prev) => prev.filter((item) => item.id !== id));
    if (socialValidationError) setSocialValidationError('');
  };

  const draftSocialLinks: SupplierSocialLinks = {
    ...socialForm,
    customLinks,
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !storeName.trim()) return;

    for (const meta of SOCIAL_PLATFORM_META) {
      const val = socialForm[meta.key]?.trim();
      if (val && !normalizeSocialUrl(meta.key, val)) {
        setSocialValidationError(`الرابط أو المعرّف المدخل لحقل (${meta.labelAr}) غير صالح.`);
        socialSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }

    for (const custom of customLinks) {
      const label = custom.label.trim();
      const url = custom.url.trim();
      if ((label && !url) || (!label && url)) {
        setSocialValidationError('يرجى إدخال اسم المنصة والرابط معاً للروابط الإضافية أو حذف الصف الفارغ.');
        socialSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (url && !normalizeSocialUrl('custom', url)) {
        setSocialValidationError(`الرابط المدخل لـ (${label || 'الرابط الإضافي'}) غير صالح.`);
        socialSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }

    setSocialValidationError('');
    setIsSubmitting(true);
    updateSupplierProfile(supplier.id, {
      name: name.trim(),
      storeName: storeName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      country: country.trim(),
      city: city.trim(),
      logoUrl: logoUrl.trim(),
      socialLinks: sanitizeSupplierSocialLinks(draftSocialLinks),
      bankAccountDetails: {
        bankName: bankName.trim(),
        accountHolder: accountHolder.trim(),
        iban: iban.trim().toUpperCase(),
        accountNumber: accountNumber.trim(),
      },
    });

    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 text-slate-100 shadow-2xl relative my-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">تعديل البيانات وروابط التواصل</h2>
              <p className="text-xs text-slate-400">
                تحديث الشعار، الاسم، البيانات البنكية، وروابط مواقع التواصل الاجتماعي (اتصل بالمتجر)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 pt-4">
          {/* Logo Section */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <label className="block text-xs font-semibold text-slate-300">
              شعار المؤسسة / المتجر:
            </label>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-900 border-2 border-amber-500/40 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                {logoUrl ? (
                  <img src={logoUrl} alt="الشعار" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-8 h-8 text-amber-400" />
                )}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-2 transition-colors">
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span>رفع شعار جديد</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                  </label>

                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-rose-400" />
                      <span>حذف الشعار</span>
                    </button>
                  )}
                </div>
                {logoError && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{logoError}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Personal & Store Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-amber-400 flex items-center gap-2 border-b border-slate-800 pb-2">
                <User className="w-3.5 h-3.5" />
                <span>البيانات الأساسية</span>
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">اسم المتجر الكامل:</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">اسم المتجر / المؤسسة:</label>
                  <input
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">رقم الهاتف:</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">البريد الإلكتروني:</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">دولة المتجر (اختر من القائمة):</label>
                    <div className="relative">
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 pl-8 appearance-none"
                      >
                        <option value="">اختر الدولة...</option>
                        {ALL_WORLD_COUNTRIES.map((c, i) => (
                          <option key={i} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <Globe className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
                      <div className="absolute right-2 top-2.5 pointer-events-none text-slate-500">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">المدينة:</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bank Details */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-cyan-400 flex items-center gap-2 border-b border-slate-800 pb-2">
                <CreditCard className="w-3.5 h-3.5" />
                <span>البيانات البنكية (لاستقبال التحويلات)</span>
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">اسم البنك:</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="مثال: مصرف الراجحي"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">اسم صاحب الحساب:</label>
                  <input
                    type="text"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">رقم الآيبان (IBAN):</label>
                  <input
                    type="text"
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    placeholder="SA0000..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">رقم الحساب:</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Social Media / Contact Us Links Section */}
          <div
            ref={socialSectionRef}
            className={`p-4 rounded-2xl bg-slate-950 border space-y-4 ${
              initialSection === 'social' ? 'border-amber-500/50' : 'border-slate-800'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-amber-400 flex items-center gap-2">
                  <Share2 className="w-4 h-4" />
                  <span>روابط مواقع التواصل الاجتماعي (اتصل بالمتجر)</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  تظهر هذه الروابط للعملاء ونقاط البيع التابعة لك مباشرة تحت قسم «اتصل بالمتجر» بعد اسم المتجر.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddCustomLink}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-auto transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة رابط آخر</span>
              </button>
            </div>

            {socialValidationError && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{socialValidationError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SOCIAL_PLATFORM_META.map((meta) => {
                const value = socialForm[meta.key];
                const isInvalid = Boolean(value.trim() && !normalizeSocialUrl(meta.key, value));
                return (
                  <div key={meta.key}>
                    <label
                      htmlFor={`social-input-${meta.key}`}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300 mb-1"
                    >
                      <SocialPlatformIcon platform={meta.key} className="w-3.5 h-3.5 shrink-0" />
                      <span>{meta.labelAr}:</span>
                    </label>
                    <input
                      id={`social-input-${meta.key}`}
                      type="text"
                      value={value}
                      onChange={(e) => handleSocialFieldChange(meta.key, e.target.value)}
                      placeholder={meta.placeholder}
                      dir="ltr"
                      className={`w-full bg-slate-900 border rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono placeholder:font-sans placeholder:text-slate-600 ${
                        isInvalid
                          ? 'border-rose-500 focus:border-rose-400'
                          : 'border-slate-800 focus:border-amber-500'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Custom links */}
            {customLinks.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
                <div className="text-[11px] font-semibold text-slate-300">روابط تواصل إضافية:</div>
                {customLinks.map((item, idx) => (
                  <div key={item.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => handleCustomLinkChange(item.id, 'label', e.target.value)}
                      placeholder={`اسم المنصة (مثال: قناة العروض ${idx + 1})`}
                      className="sm:col-span-4 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                    <input
                      type="text"
                      value={item.url}
                      onChange={(e) => handleCustomLinkChange(item.id, 'url', e.target.value)}
                      placeholder="https://..."
                      dir="ltr"
                      className="sm:col-span-7 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomLink(item.id)}
                      className="sm:col-span-1 h-8 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center transition-colors"
                      title="حذف الرابط"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Live Preview */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="text-[11px] text-slate-400 mb-1.5">معاينة ظهور الروابط للعملاء:</div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex flex-wrap items-center gap-2">
                <span>
                  المتجر التابع له:{' '}
                  <strong className="text-amber-400">
                    {name || supplier.name} ({storeName || supplier.storeName})
                  </strong>
                </span>
                <SupplierContactLinks socialLinks={draftSocialLinks} showPrefixDot />
                {Object.values(socialForm).every((v) => !v.trim()) && customLinks.length === 0 && (
                  <span className="text-slate-500 text-[11px]">· لم تتم إضافة روابط تواصل بعد</span>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/10 disabled:opacity-50"
            >
              <Check className="w-5 h-5" />
              <span>حفظ التعديلات وتحديث ملف المتجر</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors border border-slate-700"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
