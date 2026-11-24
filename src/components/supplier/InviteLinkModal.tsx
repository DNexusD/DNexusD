import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AccountTier, InviteLink, InviteLinkFeatures, TIERS_CONFIG } from '../../types';
import {
  getEnabledInviteFeatureLabels,
  INVITE_FEATURE_OPTIONS,
  isInviteLinkActive,
  normalizeInviteFeatures,
} from '../../utils/inviteLinks';
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  Check,
  CheckCircle2,
  Copy,
  Gift,
  HandCoins,
  Landmark,
  Link2,
  ListChecks,
  Plus,
  Power,
  QrCode,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface InviteLinkModalProps {
  onClose: () => void;
}

const FEATURE_ICON_MAP: Record<keyof Required<InviteLinkFeatures>, React.ReactNode> = {
  canRequestLoans: <HandCoins className="w-4 h-4 text-cyan-400 shrink-0" />,
  canReceiveSupplierTransfers: <Landmark className="w-4 h-4 text-emerald-400 shrink-0" />,
  canGetBonus: <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />,
  canViewGifts: <Gift className="w-4 h-4 text-purple-400 shrink-0" />,
  isAccreditedPos: <BadgeCheck className="w-4 h-4 text-amber-300 shrink-0" />,
};

export const InviteLinkModal: React.FC<InviteLinkModalProps> = ({ onClose }) => {
  const {
    createInviteLink,
    toggleInviteLinkActiveStatus,
    deleteInviteLink,
    inviteLinks,
    supplier,
    showToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [selectedTier, setSelectedTier] = useState<AccountTier>('vip');
  const [label, setLabel] = useState('');
  const [features, setFeatures] = useState<Required<InviteLinkFeatures>>({
    canRequestLoans: false,
    canReceiveSupplierTransfers: false,
    canGetBonus: false,
    canViewGifts: false,
    isAccreditedPos: false,
  });
  const [generatedLink, setGeneratedLink] = useState<InviteLink | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const storeInviteLinks = useMemo(
    () => inviteLinks.filter((l) => l.supplierId === supplier.id),
    [inviteLinks, supplier.id]
  );

  const toggleFeature = (key: keyof Required<InviteLinkFeatures>) => {
    setFeatures((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const setAllFeatures = (enabled: boolean) => {
    setFeatures({
      canRequestLoans: enabled,
      canReceiveSupplierTransfers: enabled,
      canGetBonus: enabled,
      canViewGifts: enabled,
      isAccreditedPos: enabled,
    });
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const link = createInviteLink({
      targetTier: selectedTier,
      features: normalizeInviteFeatures(features),
      label: label.trim() || undefined,
    });
    setGeneratedLink(link);
  };

  const handleCopyText = (value: string, key: string, labelAr: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    showToast({
      type: 'success',
      title: 'تم النسخ للحافظة',
      description: `تم نسخ ${labelAr} بنجاح.`,
    });
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleResetCreator = () => {
    setGeneratedLink(null);
    setLabel('');
  };

  const selectedEnabledFeatures = getEnabledInviteFeatureLabels(features);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto"
      dir="rtl"
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-4 text-slate-100 flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">
                إنشاء رابط تسجيل برتبة وميزات محددة
              </h3>
              <p className="text-[11px] text-slate-400">
                المتجر: <strong className="text-amber-300">{supplier.storeName || supplier.name}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-tabs: Create vs History */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-950 border-b border-slate-800 text-xs shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'create'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إنشاء رابط جديد</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-purple-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" />
            <span>الروابط المُنشأة ({storeInviteLinks.length})</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          {activeTab === 'create' ? (
            !generatedLink ? (
              <form onSubmit={handleGenerate} className="space-y-5">
                {/* Optional friendly label */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    تسمية توضيحية للرابط (اختياري):
                  </label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="مثال: رابط وكلاء المنطقة الوسطى VIP"
                    maxLength={60}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none"
                  />
                </div>

                {/* Tier Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    1. اختر الرتبة الممنوحة تلقائياً عند التسجيل:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(Object.keys(TIERS_CONFIG) as AccountTier[]).map((tKey) => {
                      const t = TIERS_CONFIG[tKey];
                      const isSelected = selectedTier === tKey;

                      return (
                        <button
                          key={tKey}
                          type="button"
                          onClick={() => setSelectedTier(tKey)}
                          className={`p-3 rounded-2xl border text-right transition-all flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500/15 border-amber-500 text-white ring-1 ring-amber-500/30'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold shrink-0 ${t.badgeColor} ${t.textColor}`}
                            >
                              {t.nameAr}
                            </span>
                            <span className="text-[11px] text-slate-400 truncate">
                              {t.discountNote}
                            </span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pre-assigned Features Selection */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="text-xs font-semibold text-slate-300">
                      2. حدد الميزات المفعّلة تلقائياً لحساب العميل:
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAllFeatures(true)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[10px] font-bold transition-colors cursor-pointer"
                      >
                        تحديد الكل
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllFeatures(false)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold transition-colors cursor-pointer"
                      >
                        إلغاء الكل
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {INVITE_FEATURE_OPTIONS.map((opt) => {
                      const isOn = features[opt.key];
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => toggleFeature(opt.key)}
                          className={`p-3 rounded-2xl border text-right transition-all flex items-start justify-between gap-2 cursor-pointer ${
                            isOn
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="mt-0.5">{FEATURE_ICON_MAP[opt.key]}</div>
                            <div className="min-w-0">
                              <div className="font-bold text-xs text-white">{opt.labelAr}</div>
                              <div className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
                                {opt.descriptionAr}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                              isOn
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {isOn ? 'مفعّلة ✓' : 'مقفلة'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Live summary before creation */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-[11px] font-bold text-slate-300">
                    ملخص الصلاحيات التي سيحصل عليها العميل عند التسجيل بهذا الرابط:
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${TIERS_CONFIG[selectedTier].badgeColor} ${TIERS_CONFIG[selectedTier].textColor}`}
                    >
                      الرتبة: {TIERS_CONFIG[selectedTier].nameAr}
                    </span>
                    {selectedEnabledFeatures.length === 0 ? (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-[11px]">
                        الميزات الإضافية: بدون ميزات إضافية
                      </span>
                    ) : (
                      selectedEnabledFeatures.map((f) => (
                        <span
                          key={f.key}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold"
                        >
                          ✓ {f.labelAr}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-md cursor-pointer"
                >
                  <span>إنشاء رابط الدعوة بالرتبة والميزات المحددة</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <div className="space-y-4 text-center py-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-white">تم إنشاء رابط الدعوة بنجاح!</h4>
                  {generatedLink.label && (
                    <div className="text-xs text-purple-300 font-semibold mt-0.5">
                      {generatedLink.label}
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    الرتبة الممنوحة:{' '}
                    <strong className="text-amber-400">
                      {TIERS_CONFIG[generatedLink.targetTier]?.nameAr}
                    </strong>
                  </p>
                </div>

                {/* Features summary badges */}
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {getEnabledInviteFeatureLabels(generatedLink.features).length === 0 ? (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 text-[11px]">
                      بدون ميزات إضافية مفعّلة
                    </span>
                  ) : (
                    getEnabledInviteFeatureLabels(generatedLink.features).map((f) => (
                      <span
                        key={f.key}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold"
                      >
                        ✓ {f.labelAr}
                      </span>
                    ))
                  )}
                </div>

                {/* QR + Link */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex justify-center">
                    <div className="p-2.5 rounded-2xl bg-white shadow-md">
                      <QRCodeSVG value={generatedLink.url} size={130} />
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-amber-400" />
                    <span>يمكن للعميل فتح الرابط مباشرة أو استخدام كود الدعوة التالي:</span>
                  </div>
                  <div
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-amber-300 text-left select-all break-all"
                    dir="ltr"
                  >
                    {generatedLink.url}
                  </div>
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[11px] text-slate-400">كود الدعوة المختصر:</span>
                    <strong className="font-mono text-cyan-300 text-xs select-all" dir="ltr">
                      {generatedLink.code}
                    </strong>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyText(generatedLink.code, 'gen-code', 'كود الدعوة المختصر')
                      }
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'gen-code' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>نسخ الكود</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(generatedLink.url, 'gen-url', 'رابط الدعوة المباشر')
                    }
                    className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-md cursor-pointer"
                  >
                    {copiedKey === 'gen-url' ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    <span>{copiedKey === 'gen-url' ? 'تم النسخ للحافظة' : 'نسخ الرابط المباشر'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetCreator}
                    className="py-3 px-4 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-xs font-bold cursor-pointer"
                  >
                    إنشاء رابط آخر
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            )
          ) : (
            /* History Tab */
            <div className="space-y-3">
              {storeInviteLinks.length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-950 border border-slate-800 text-center text-slate-400 space-y-2">
                  <Link2 className="w-7 h-7 text-slate-600 mx-auto" />
                  <p>لم يتم إنشاء أي روابط دعوة لهذا المتجر بعد.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('create')}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    إنشاء أول رابط دعوة الآن
                  </button>
                </div>
              ) : (
                storeInviteLinks.map((link) => {
                  const tierInfo = TIERS_CONFIG[link.targetTier] || TIERS_CONFIG.regular;
                  const linkActive = isInviteLinkActive(link);
                  const enabledFeatures = getEnabledInviteFeatureLabels(link.features);
                  const isConfirmingDelete = confirmDeleteId === link.id;

                  return (
                    <div
                      key={link.id}
                      className={`p-4 rounded-2xl border space-y-3 transition-colors ${
                        linkActive
                          ? 'bg-slate-950 border-slate-800'
                          : 'bg-slate-950/60 border-rose-500/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="font-mono font-bold text-cyan-300 text-xs select-all"
                              dir="ltr"
                            >
                              {link.code}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${tierInfo.badgeColor} ${tierInfo.textColor}`}
                            >
                              {tierInfo.nameAr}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                                linkActive
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              }`}
                            >
                              {linkActive ? 'نشط' : 'موقوف'}
                            </span>
                          </div>
                          {link.label && (
                            <div className="text-xs font-semibold text-white">{link.label}</div>
                          )}
                          <div className="text-[10px] text-slate-400">
                            تاريخ الإنشاء: {link.createdAt} · مرات التسجيل:{' '}
                            <strong className="font-mono text-amber-300">{link.usedCount || 0}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Features chips */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {enabledFeatures.length === 0 ? (
                          <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] text-slate-500">
                            بدون ميزات إضافية
                          </span>
                        ) : (
                          enabledFeatures.map((f) => (
                            <span
                              key={f.key}
                              className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[10px] font-semibold"
                            >
                              ✓ {f.labelAr}
                            </span>
                          ))
                        )}
                      </div>

                      {/* URL preview */}
                      <div
                        className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-amber-300 truncate select-all"
                        dir="ltr"
                        title={link.url}
                      >
                        {link.url}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleCopyText(link.url, `url-${link.id}`, 'رابط الدعوة')}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKey === `url-${link.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>نسخ الرابط</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleInviteLinkActiveStatus(link.id)}
                          className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                            linkActive
                              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                              : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                          }`}
                        >
                          {linkActive ? (
                            <>
                              <Ban className="w-3.5 h-3.5 text-amber-400" />
                              <span>إيقاف</span>
                            </>
                          ) : (
                            <>
                              <Power className="w-3.5 h-3.5" />
                              <span>تفعيل</span>
                            </>
                          )}
                        </button>

                        {!isConfirmingDelete ? (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(link.id)}
                            className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer mr-auto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5 mr-auto">
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteInviteLink(link.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
                            >
                              تأكيد الحذف
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] cursor-pointer"
                            >
                              إلغاء
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
