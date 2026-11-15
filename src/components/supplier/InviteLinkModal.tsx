import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AccountTier, TIERS_CONFIG } from '../../types';
import { X, Link2, Copy, Check, ArrowRight } from 'lucide-react';

interface InviteLinkModalProps {
  onClose: () => void;
}

export const InviteLinkModal: React.FC<InviteLinkModalProps> = ({ onClose }) => {
  const { createInviteLink, supplier } = useApp();

  const [selectedTier, setSelectedTier] = useState<AccountTier>('vip');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const link = createInviteLink(selectedTier);
    setGeneratedLink(link.url);
  };

  const handleCopy = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 text-slate-100 flex flex-col">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">توليد رابط إنشاء حساب مع رتبة مسبقة</h3>
              <p className="text-xs text-slate-400">المتجر: {supplier.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-5">
          {!generatedLink ? (
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  اختر الرتبة المحددة مسبقاً للعميل عند التسجيل عبر هذا الرابط:
                </label>
                <div className="space-y-2">
                  {(Object.keys(TIERS_CONFIG) as AccountTier[]).map(tKey => {
                    const t = TIERS_CONFIG[tKey];
                    const isSelected = selectedTier === tKey;

                    return (
                      <button
                        key={tKey}
                        type="button"
                        onClick={() => setSelectedTier(tKey)}
                        className={`w-full p-3 rounded-2xl border text-right transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500 text-white ring-1 ring-amber-500/30'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${t.badgeColor} ${t.textColor}`}>
                            {t.nameAr}
                          </span>
                          <span className="text-xs text-slate-400">{t.discountNote}</span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                * عند مشاركة هذا الرابط مع عميلك أو نقطة البيع الجديدة، سيتم إنشاء حسابه التابع لك تلقائياً برتبة <strong className="text-white">({TIERS_CONFIG[selectedTier].nameAr})</strong> فور إتمام تسجيله.
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-md"
              >
                <span>إنشاء رابط الدعوة الذكي</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <div className="space-y-4 text-center py-2 animate-in fade-in">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <Check className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-white">تم توليد الرابط بنجاح!</h4>
                <p className="text-xs text-slate-400">
                  الرتبة الممنوحة: <strong className="text-amber-400">{TIERS_CONFIG[selectedTier].nameAr}</strong>
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-amber-300 text-left select-all break-all" dir="ltr">
                {generatedLink}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'تم النسخ للحافظة' : 'نسخ الرابط'}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                >
                  إغلاق
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
