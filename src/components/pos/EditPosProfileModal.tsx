import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { POSClient } from '../../types';
import { 
  X, 
  Store, 
  User, 
  Mail, 
  Phone, 
  Headphones, 
  MapPin, 
  Upload, 
  Check, 
  Sparkles, 
  Image as ImageIcon,
  Trash2,
  Building2,
  Globe,
  ChevronDown
} from 'lucide-react';

interface EditPosProfileModalProps {
  onClose: () => void;
}

import { ALL_WORLD_COUNTRIES } from '../../constants/countries';

export const EditPosProfileModal: React.FC<EditPosProfileModalProps> = ({ onClose }) => {
  const { currentPos, updatePosProfile } = useApp();

  const [tradeName, setTradeName] = useState(currentPos.tradeName || '');
  const [ownerName, setOwnerName] = useState(currentPos.ownerName || '');
  const [email, setEmail] = useState(currentPos.email || '');
  const [phone, setPhone] = useState(currentPos.phone || '');
  const [servicePhone, setServicePhone] = useState(currentPos.servicePhone || '');
  const [country, setCountry] = useState(currentPos.country || 'المملكة العربية السعودية');
  const [city, setCity] = useState(currentPos.city || '');
  const [logoUrl, setLogoUrl] = useState(currentPos.logoUrl || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File upload handler
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 2 ميجابايت.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setLogoUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tradeName.trim()) return;

    setIsSubmitting(true);
    updatePosProfile(currentPos.id, {
      tradeName: tradeName.trim(),
      ownerName: ownerName.trim() || currentPos.ownerName,
      email: email.trim(),
      phone: phone.trim(),
      servicePhone: servicePhone.trim(),
      country: country.trim(),
      city: city.trim(),
      logoUrl: logoUrl.trim()
    });

    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 text-slate-100 shadow-2xl relative my-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">تعديل بيانات نقطة البيع</h2>
              <p className="text-xs text-slate-400">
                تحديث الشعار، الاسم التجاري، البريد، هاتف الخدمات، والدولة والمدينة
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          
          {/* Logo Section */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-3">
            <label className="block text-xs font-semibold text-slate-300">
              شعار المتجر / الصورة الرمزية:
            </label>

            <div className="flex items-center gap-3">
              {/* Preview */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-900 border-2 border-amber-500/40 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                {logoUrl ? (
                  <img src={logoUrl} alt="الشعار" className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-7 h-7 text-amber-400" />
                )}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors">
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                    <span>رفع صورة من الجهاز</span>
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
                      className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>حذف</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Trade Name & Owner Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                الاسم التجاري للمتجر: <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={tradeName}
                  onChange={e => setTradeName(e.target.value)}
                  placeholder="مثال: مركز الأمل الرقمي"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white pl-8 focus:outline-none"
                />
                <Store className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                اسم المالك / المدير المسؤول:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={ownerName}
                  onChange={e => setOwnerName(e.target.value)}
                  placeholder="مثال: محمد العتيبي"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white pl-8 focus:outline-none"
                />
                <User className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Email & Service Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                البريد الإلكتروني:
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@store.com"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white pl-8 focus:outline-none font-mono"
                  dir="ltr"
                />
                <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                رقم هاتف الخدمات والدعم (واتساب):
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={servicePhone}
                  onChange={e => setServicePhone(e.target.value)}
                  placeholder="+966 55 987 6544"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white pl-8 focus:outline-none font-mono"
                  dir="ltr"
                />
                <Headphones className="w-3.5 h-3.5 text-amber-400 absolute left-2.5 top-2.5 pointer-events-none" />
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                مخصص لخدمة العملاء والدعم الفني
              </span>
            </div>
          </div>

          {/* Primary Phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              رقم الهاتف الأساسي:
            </label>
            <div className="relative">
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+966 55 987 6543"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white pl-8 focus:outline-none font-mono"
                dir="ltr"
              />
              <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Country & City */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                الدولة (اختر من القائمة):
              </label>
              <div className="relative">
                <select
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white pl-8 focus:outline-none appearance-none"
                >
                  <option value="">اختر الدولة...</option>
                  {ALL_WORLD_COUNTRIES.map((c, i) => (
                    <option key={i} value={c}>{c}</option>
                  ))}
                </select>
                <Globe className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
                <div className="absolute right-2 top-2.5 pointer-events-none text-slate-500">
                  <ChevronDown className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                المدينة:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="مثال: الرياض، صنعاء، جدة..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white pl-8 focus:outline-none"
                />
                <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* POS Code Info (Read-only) */}
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">معرف نقطة البيع الثابت (POS Code):</span>
            <span className="font-mono font-bold text-amber-400">{currentPos.posCode}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/10 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>حفظ وتحديث البيانات</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors border border-slate-700"
            >
              إلغاء
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
