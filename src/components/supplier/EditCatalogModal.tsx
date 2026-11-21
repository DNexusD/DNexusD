import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Catalog } from '../../types';
import { isCatalogFreeGifts } from '../../utils/pricing';
import { 
  X, 
  FolderEdit, 
  Trash2, 
  Check, 
  Gamepad2, 
  Smartphone, 
  Tv, 
  CreditCard, 
  Layers, 
  Globe, 
  Ticket, 
  Sparkles,
  ShoppingBag,
  ShieldCheck,
  Gift
} from 'lucide-react';

interface EditCatalogModalProps {
  catalog: Catalog;
  onClose: () => void;
}

const AVAILABLE_ICONS = [
  { id: 'Layers', label: 'طبقات عامة', Icon: Layers },
  { id: 'Gamepad2', label: 'ألعاب وبطاقات', Icon: Gamepad2 },
  { id: 'Smartphone', label: 'تطبيقات وسوشيال', Icon: Smartphone },
  { id: 'Tv', label: 'اشتراكات وبث', Icon: Tv },
  { id: 'CreditCard', label: 'بطاقات دفع وتسوق', Icon: CreditCard },
  { id: 'Globe', label: 'خدمات دولية وإنترنت', Icon: Globe },
  { id: 'Ticket', label: 'أكواد وقسائم', Icon: Ticket },
  { id: 'Sparkles', label: 'عروض حصرية', Icon: Sparkles },
  { id: 'ShoppingBag', label: 'متاجر رقمية', Icon: ShoppingBag },
  { id: 'ShieldCheck', label: 'حماية وتراخيص', Icon: ShieldCheck },
];

export const EditCatalogModal: React.FC<EditCatalogModalProps> = ({ catalog, onClose }) => {
  const { updateCatalog, deleteCatalog, services, showToast, formatCurrency } = useApp();

  const [nameAr, setNameAr] = useState(catalog.nameAr);
  const [descriptionAr, setDescriptionAr] = useState(catalog.descriptionAr);
  const [selectedIcon, setSelectedIcon] = useState(catalog.icon || 'Layers');
  const [isFreeGiftsCatalog, setIsFreeGiftsCatalog] = useState<boolean>(isCatalogFreeGifts(catalog));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const linkedServices = services.filter(s => s.catalogId === catalog.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) {
      showToast({ type: 'error', title: 'تنبيه', description: 'يرجى كتابة اسم الكاتالوج' });
      return;
    }

    updateCatalog(catalog.id, {
      nameAr: nameAr.trim(),
      descriptionAr: descriptionAr.trim(),
      icon: selectedIcon,
      isFreeGiftsCatalog
    });

    onClose();
  };

  const handleDelete = () => {
    if (linkedServices.length > 0) {
      showToast({
        type: 'error',
        title: 'لا يمكن حذف الكتالوج',
        description: `الكتالوج يحتوي على ${linkedServices.length} خدمة مرتبطة. قم بنقل الخدمات لكتالوج آخر أو حذفها أولاً.`
      });
      return;
    }

    const res = deleteCatalog(catalog.id);
    if (res.success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <FolderEdit className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">تعديل بيانات الكاتالوج</h3>
              <p className="text-xs text-slate-400">معرف: <span className="font-mono text-amber-400">{catalog.id}</span></p>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              اسم الكاتالوج: <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={nameAr}
              onChange={e => setNameAr(e.target.value)}
              placeholder="مثال: شحن تطبيقات الذكاء الاصطناعي والسوشيال"
              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              وصف الكاتالوج:
            </label>
            <textarea
              rows={2}
              value={descriptionAr}
              onChange={e => setDescriptionAr(e.target.value)}
              placeholder="وصف مختصر للخدمات التابعة لهذا الكاتالوج"
              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              أيقونة الكاتالوج:
            </label>
            <div className="grid grid-cols-5 gap-2">
              {AVAILABLE_ICONS.map(({ id, label, Icon }) => {
                const isSelected = selectedIcon === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedIcon(id)}
                    title={label}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400 font-bold shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[9px] truncate max-w-full">{label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Free Gifts Catalog Toggle */}
          <label className={`p-3 rounded-2xl border flex items-start gap-2.5 cursor-pointer transition-colors ${
            isFreeGiftsCatalog
              ? 'bg-purple-500/15 border-purple-500/50 text-purple-200'
              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}>
            <input
              type="checkbox"
              checked={isFreeGiftsCatalog}
              onChange={e => setIsFreeGiftsCatalog(e.target.checked)}
              className="mt-1 rounded border-slate-600 bg-slate-900 text-purple-500 focus:ring-purple-500"
            />
            <div className="flex-1 text-xs space-y-0.5">
              <div className="font-bold flex items-center gap-1.5 text-white">
                <Gift className="w-3.5 h-3.5 text-purple-400" />
                <span>تعيين ككتالوج الهدايا المجانية</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                الخدمات داخل هذا الكاتالوج تُنفذ للعملاء أصحاب ميزة الهدايا المجانية بسعر {formatCurrency(0)}.
              </p>
            </div>
          </label>

          {/* Linked services notice */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">الخدمات المرتبطة بهذا الكاتالوج:</span>
            <span className="font-mono font-bold text-amber-400">{linkedServices.length} خدمات</span>
          </div>

          {/* Delete confirmation section */}
          {showDeleteConfirm ? (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-2">
              <p className="text-xs text-rose-300 font-medium">
                هل أنت متأكد من حذف هذا الكاتالوج نهائياً؟
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex-1 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors"
                >
                  تأكيد الحذف
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
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
                className="text-xs text-rose-400/80 hover:text-rose-400 flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف الكاتالوج</span>
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md"
            >
              <Check className="w-4 h-4" />
              <span>حفظ تعديلات الكاتالوج</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
