import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Building2, QrCode, Hash, ChevronRight } from 'lucide-react';
import jsQR from 'jsqr';

export const SupplierSelector: React.FC = () => {
  const { 
    availableClientSuppliers, 
    setCurrentSupplierId, 
    setIsSupplierSelectionRequired, 
    showToast,
    currentUser,
    posClients,
    setCurrentPosId
  } = useApp();

  const [viewMode, setViewMode] = useState<'list' | 'code' | 'scan'>('list');
  const [supplierCode, setSupplierCode] = useState('');

  // Target registered suppliers list strictly belonging to this client (never fall back to all platform stores)
  const displaySuppliers = availableClientSuppliers || [];

  const selectSupplier = (id: string) => {
    const allowed = displaySuppliers.some(s => s.id === id);
    if (!allowed) {
      showToast({
        type: 'error',
        title: 'المتجر غير مسجل بحسابك',
        description: 'لا يمكنك الانتقال إلى متجر غير مرتبط بحسابك.'
      });
      return;
    }

    setCurrentSupplierId(id);

    // Sync POS Client account record matching this supplier
    if (currentUser?.email) {
      const cleanEmail = currentUser.email.toLowerCase();
      const match = posClients.find(p => p.email?.toLowerCase() === cleanEmail && p.supplierId === id);
      if (match) {
        setCurrentPosId(match.id);
      }
    }

    setIsSupplierSelectionRequired(false);
    showToast({ 
      type: 'success', 
      title: 'تم تحديد المتجر بنجاح',
      description: 'جاري التوجيه إلى واجهة المتجر والخدمات' 
    });
  };

  const handleQrFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          showToast({ type: 'error', title: 'خطأ في معالجة الصورة', description: 'تعذر قراءة بيانات الصورة.' });
          return;
        }
        ctx.drawImage(img, 0, 0, img.width, img.height);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code && code.data) {
          let decoded = code.data.trim();
          if (decoded.includes(':')) {
            const parts = decoded.split(':');
            decoded = parts[parts.length - 1].trim();
          }
          const matched = displaySuppliers.find(s => s.id === decoded);
          if (matched) {
            selectSupplier(matched.id);
          } else {
            showToast({
              type: 'error',
              title: 'رمز QR غير مرتبط بحسابك',
              description: 'المتجر الموجود في رمز الكيو آر غير مسجل ضمن متاجر هذا الحساب.'
            });
          }
        } else {
          showToast({
            type: 'error',
            title: 'تعذر قراءة رمز QR',
            description: 'لم يتم العثور على رمز QR صالح في الصورة المرفوعة.'
          });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4 animate-in fade-in zoom-in duration-300">
      <div className="text-center space-y-1.5">
        <h2 className="text-base sm:text-lg font-bold text-white flex items-center justify-center gap-2">
          <Building2 className="w-5 h-5 text-amber-400" />
          <span>اختر المتجر الخاص بحسابك</span>
        </h2>
        <p className="text-xs text-amber-300/90 font-medium">
          تم التعرف على المتاجر المسجل لديهم بحسابك:
        </p>
      </div>

      {/* Direct Cards of Registered Suppliers */}
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {displaySuppliers.length === 0 ? (
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
            لا توجد متاجر مرتبطة بهذا الحساب حالياً.
          </div>
        ) : (
          displaySuppliers.map(s => (
            <button 
              key={s.id} 
              onClick={() => selectSupplier(s.id)} 
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-amber-500/60 hover:bg-slate-900 transition-all text-right group shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 overflow-hidden">
                  {s.logoUrl ? (
                    <img src={s.logoUrl} alt={s.name} className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-xs text-white group-hover:text-amber-400 transition-colors">
                    {s.storeName}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {s.name} · معرف المتجر: <code className="font-mono text-amber-300">{s.id}</code>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
            </button>
          ))
        )}
      </div>

      <div className="space-y-2 pt-2 border-t border-slate-800/80">
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => setViewMode('code')} 
            className={`py-2 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'code' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            إدخال المعرف يدوياً
          </button>
          <button 
            onClick={() => setViewMode('scan')} 
            className={`py-2 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'scan' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            مسح رمز QR
          </button>
        </div>
      </div>

      {viewMode === 'code' && (
        <div className="space-y-3 p-3 rounded-2xl bg-slate-950 border border-slate-800">
          <div className="relative">
            <Hash className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
            <input 
              type="text" 
              placeholder="أدخل معرف المتجر (ID)..." 
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-3 pr-9 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              value={supplierCode}
              onChange={e => setSupplierCode(e.target.value)}
            />
          </div>
          <button 
            onClick={() => {
              const matched = displaySuppliers.find(s => s.id === supplierCode.trim());
              if (matched) {
                selectSupplier(matched.id);
              } else {
                showToast({ type: 'error', title: 'المعرف غير مسجل لديك', description: 'يرجى اختيار متجر من المتاجر المسجل لديهم بحسابك' });
              }
            }} 
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-md"
          >
            تأكيد الدخول للمتجر
          </button>
        </div>
      )}

      {viewMode === 'scan' && (
        <div className="text-center p-5 border-2 border-dashed border-slate-800 rounded-2xl space-y-3 bg-slate-950">
          <QrCode className="w-12 h-12 text-amber-400 mx-auto" />
          <p className="text-xs text-slate-400">امسح رمز QR الخاص بالمتجر المسجل لديه.</p>
          <label className="block cursor-pointer bg-slate-900 border border-slate-700 py-2 px-4 rounded-xl text-xs font-bold text-amber-400 hover:bg-slate-800 transition-colors">
            <span>اختيار صورة الكيو أر من الملفات</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleQrFileChange}
            />
          </label>
        </div>
      )}
    </div>
  );
};
