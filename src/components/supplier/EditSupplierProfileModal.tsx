import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Supplier } from '../../types';
import { 
  X, 
  Building2, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Upload, 
  Check, 
  Trash2,
  Globe,
  CreditCard,
  ChevronDown
} from 'lucide-react';

interface EditSupplierProfileModalProps {
  onClose: () => void;
}


import { ALL_WORLD_COUNTRIES } from '../../constants/countries';

export const EditSupplierProfileModal: React.FC<EditSupplierProfileModalProps> = ({ onClose }) => {
  const { supplier, updateSupplierProfile } = useApp();

  const [name, setName] = useState(supplier.name || '');
  const [storeName, setStoreName] = useState(supplier.storeName || '');
  const [email, setEmail] = useState(supplier.email || '');
  const [phone, setPhone] = useState(supplier.phone || '');
  const [country, setCountry] = useState(supplier.country || 'المملكة العربية السعودية');
  const [city, setCity] = useState(supplier.city || '');
  const [logoUrl, setLogoUrl] = useState(supplier.logoUrl || '');
  
  // Bank details
  const [bankName, setBankName] = useState(supplier.bankAccountDetails.bankName || '');
  const [accountHolder, setAccountHolder] = useState(supplier.bankAccountDetails.accountHolder || '');
  const [iban, setIban] = useState(supplier.bankAccountDetails.iban || '');
  const [accountNumber, setAccountNumber] = useState(supplier.bankAccountDetails.accountNumber || '');

  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (!name.trim() || !storeName.trim()) return;

    setIsSubmitting(true);
    updateSupplierProfile(supplier.id, {
      name: name.trim(),
      storeName: storeName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      country: country.trim(),
      city: city.trim(),
      logoUrl: logoUrl.trim(),
      bankAccountDetails: {
        bankName: bankName.trim(),
        accountHolder: accountHolder.trim(),
        iban: iban.trim().toUpperCase(),
        accountNumber: accountNumber.trim()
      }
    });

    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 text-slate-100 shadow-2xl relative my-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">تعديل البيانات الشخصية</h2>
              <p className="text-xs text-slate-400">
                تحديث الشعار، الاسم الشخصي، اسم المؤسسة، البيانات البنكية، والموقع الجغرافي
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 pt-4">
          
          {/* Logo Section */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <label className="block text-xs font-semibold text-slate-300">
              شعار المؤسسة / المورد:
            </label>

            <div className="flex items-center gap-4">
              {/* Preview */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-900 border-2 border-amber-500/40 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                {logoUrl ? (
                  <img src={logoUrl} alt="الشعار" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-8 h-8 text-amber-400" />
                )}
              </div>

              <div className="flex-1 space-y-2.5">
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
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">اسم المورد الكامل:</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">اسم المتجر / المؤسسة:</label>
                  <input
                    type="text"
                    required
                    value={storeName}
                    onChange={e => setStoreName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">رقم الهاتف:</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">البريد الإلكتروني:</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">دولة المورد (اختر من القائمة):</label>
                    <div className="relative">
                      <select
                        value={country}
                        onChange={e => setCountry(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 pl-8 appearance-none"
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
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">المدينة:</label>
                    <input
                      type="text"
                      value={city}
                      onChange={e => setCity(e.target.value)}
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
                    onChange={e => setBankName(e.target.value)}
                    placeholder="مثال: مصرف الراجحي"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">اسم صاحب الحساب:</label>
                  <input
                    type="text"
                    value={accountHolder}
                    onChange={e => setAccountHolder(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">رقم الآيبان (IBAN):</label>
                  <input
                    type="text"
                    value={iban}
                    onChange={e => setIban(e.target.value)}
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
                    onChange={e => setAccountNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    dir="ltr"
                  />
                </div>
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
              <span>حفظ التعديلات وتحديث ملف المورد</span>
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
