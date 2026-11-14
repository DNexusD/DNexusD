import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Building2, Search, QrCode, Hash, ChevronRight } from 'lucide-react';

export const SupplierSelector: React.FC = () => {
  const { 
    suppliers, 
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isListOpen, setIsListOpen] = useState(false);

  // Target registered suppliers list for this client
  const displaySuppliers = (availableClientSuppliers && availableClientSuppliers.length > 0)
    ? availableClientSuppliers
    : suppliers;

  const filteredSuppliers = displaySuppliers.filter(s => 
    s.name.includes(searchQuery) || 
    s.storeName.includes(searchQuery) ||
    s.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectSupplier = (id: string) => {
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
      title: 'تم تحديد المورد بنجاح',
      description: 'جاري التوجيه إلى واجهة المتجر والخدمات' 
    });
  };

  return (
    <div className="space-y-4 animate-in fade-in zoom-in duration-300">
      <div className="text-center space-y-1.5">
        <h2 className="text-base sm:text-lg font-bold text-white flex items-center justify-center gap-2">
          <Building2 className="w-5 h-5 text-amber-400" />
          <span>اختر المورد الخاص بحسابك</span>
        </h2>
        <p className="text-xs text-amber-300/90 font-medium">
          تم التعرف على الموردين المسجل لديهم بحسابك:
        </p>
      </div>

      {/* Direct Cards of Registered Suppliers */}
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {displaySuppliers.map(s => (
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
                  {s.name} · معرف المورد: <code className="font-mono text-amber-300">{s.id}</code>
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
          </button>
        ))}
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
              placeholder="أدخل معرف المورد (ID)..." 
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
                showToast({ type: 'error', title: 'المعرف غير مسجل لديك', description: 'يرجى اختيار مورد من الموردين المسجل لديهم بحسابك' });
              }
            }} 
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-md"
          >
            تأكيد الدخول لمتجر المورد
          </button>
        </div>
      )}

      {viewMode === 'scan' && (
        <div className="text-center p-5 border-2 border-dashed border-slate-800 rounded-2xl space-y-3 bg-slate-950">
          <QrCode className="w-12 h-12 text-amber-400 mx-auto" />
          <p className="text-xs text-slate-400">امسح رمز QR الخاص بالمورد المسجل لديه.</p>
          <label className="block cursor-pointer bg-slate-900 border border-slate-700 py-2 px-4 rounded-xl text-xs font-bold text-amber-400 hover:bg-slate-800 transition-colors">
            <span>اختيار صورة الكيو أر من الملفات</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  showToast({ type: 'info', title: 'جاري قراءة رمز الكيو أر...', description: 'سيتم توجيهك لمتجر المورد المسجل مباشرة.' });
                  if (displaySuppliers.length > 0) {
                    selectSupplier(displaySuppliers[0].id);
                  }
                }
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
};
