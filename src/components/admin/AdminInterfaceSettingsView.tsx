import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Catalog, PlatformDropdownListKey, PlatformInterfaceSettings } from '../../types';
import { getDropdownListTitle } from '../../utils/platformSettings';
import { isCatalogFreeGifts } from '../../utils/pricing';
import {
  Sliders,
  Layers,
  Lock,
  PlusCircle,
  Edit3,
  Trash2,
  Check,
  X,
  Gift,
  ListChecks,
  Bell,
  Store,
  Building2,
  ToggleLeft,
  ToggleRight,
  Save,
  Gamepad2,
  CreditCard,
  Tv,
  Sparkles,
  Smartphone,
  Globe,
  ShieldCheck,
  MessageCircle,
  Link2,
  Share2,
  ExternalLink,
} from 'lucide-react';
import { SOCIAL_PLATFORM_META, sanitizeSupplierSocialLinks } from '../../utils/socialLinks';
import { SupplierCustomSocialLink, SupplierSocialLinks } from '../../types';
import { SupplierContactLinks } from '../common/SupplierContactLinks';

const ICON_OPTIONS = [
  { value: 'Layers', label: 'كتالوج عام', Icon: Layers },
  { value: 'Gamepad2', label: 'ألعاب وشحن', Icon: Gamepad2 },
  { value: 'CreditCard', label: 'بطاقات رقمية', Icon: CreditCard },
  { value: 'Tv', label: 'اشتراكات وبث', Icon: Tv },
  { value: 'Sparkles', label: 'تطبيقات وذكاء', Icon: Sparkles },
  { value: 'Smartphone', label: 'اتصالات وبيانات', Icon: Smartphone },
  { value: 'Globe', label: 'خدمات دولية', Icon: Globe },
  { value: 'Gift', label: 'هدايا وعروض', Icon: Gift },
];

export const AdminInterfaceSettingsView: React.FC = () => {
  const {
    platformSettings,
    catalogs,
    services,
    updatePlatformInterfaceSettings,
    addFixedCatalogByAdmin,
    updateFixedCatalogByAdmin,
    deleteFixedCatalogByAdmin,
    addDropdownOption,
    updateDropdownOption,
    deleteDropdownOption,
    showToast,
    formatCurrency,
  } = useApp();

  // Fixed Catalog Create Form
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('Layers');
  const [newCatIsGift, setNewCatIsGift] = useState(false);

  // Fixed Catalog Inline Edit
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatDesc, setEditCatDesc] = useState('');
  const [editCatIcon, setEditCatIcon] = useState('Layers');
  const [editCatIsGift, setEditCatIsGift] = useState(false);

  // Dropdown List Management
  const [activeDropdownKey, setActiveDropdownKey] = useState<PlatformDropdownListKey>('statementTransactionTypes');
  const [newOptionLabel, setNewOptionLabel] = useState('');
  const [newOptionValue, setNewOptionValue] = useState('');
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingOptionLabel, setEditingOptionLabel] = useState('');

  // Local state for interface settings
  const [localSettings, setLocalSettings] = useState<PlatformInterfaceSettings>(platformSettings);

  const [socialLinksDraft, setSocialLinksDraft] = useState<SupplierSocialLinks>(() => ({
    whatsapp: platformSettings.socialLinks?.whatsapp || '',
    telegram: platformSettings.socialLinks?.telegram || '',
    instagram: platformSettings.socialLinks?.instagram || '',
    facebook: platformSettings.socialLinks?.facebook || '',
    x: platformSettings.socialLinks?.x || '',
    tiktok: platformSettings.socialLinks?.tiktok || '',
    youtube: platformSettings.socialLinks?.youtube || '',
    snapchat: platformSettings.socialLinks?.snapchat || '',
    website: platformSettings.socialLinks?.website || '',
    customLinks: platformSettings.socialLinks?.customLinks ? [...platformSettings.socialLinks.customLinks] : [],
  }));

  const [newCustomTitle, setNewCustomTitle] = useState('');
  const [newCustomUrl, setNewCustomUrl] = useState('');

  useEffect(() => {
    setLocalSettings(platformSettings);
    setSocialLinksDraft({
      whatsapp: platformSettings.socialLinks?.whatsapp || '',
      telegram: platformSettings.socialLinks?.telegram || '',
      instagram: platformSettings.socialLinks?.instagram || '',
      facebook: platformSettings.socialLinks?.facebook || '',
      x: platformSettings.socialLinks?.x || '',
      tiktok: platformSettings.socialLinks?.tiktok || '',
      youtube: platformSettings.socialLinks?.youtube || '',
      snapchat: platformSettings.socialLinks?.snapchat || '',
      website: platformSettings.socialLinks?.website || '',
      customLinks: platformSettings.socialLinks?.customLinks ? [...platformSettings.socialLinks.customLinks] : [],
    });
  }, [platformSettings]);

  const handleAddCustomSocialLink = () => {
    if (!newCustomTitle.trim() || !newCustomUrl.trim()) {
      showToast({ type: 'error', title: 'بيانات غير مكتملة', description: 'يرجى إدخال مسمى الرابط والرابط الإلكتروني.' });
      return;
    }
    const newLink: SupplierCustomSocialLink = {
      id: `custom-${Date.now()}`,
      label: newCustomTitle.trim(),
      url: newCustomUrl.trim(),
    };
    setSocialLinksDraft(prev => ({
      ...prev,
      customLinks: [...(prev.customLinks || []), newLink],
    }));
    setNewCustomTitle('');
    setNewCustomUrl('');
  };

  const handleRemoveCustomSocialLink = (linkId: string) => {
    setSocialLinksDraft(prev => ({
      ...prev,
      customLinks: (prev.customLinks || []).filter(l => l.id !== linkId),
    }));
  };

  const fixedCatalogs = useMemo(
    () => catalogs.filter((c) => Boolean(c.isFixedByAdmin || c.supplierId === 'all')),
    [catalogs]
  );

  const activeDropdownItems = platformSettings[activeDropdownKey] || [];

  const handleAddFixedCatalog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      showToast({ type: 'error', title: 'تنبيه', description: 'يرجى إدخال اسم الكتالوج الثابت.' });
      return;
    }
    addFixedCatalogByAdmin({
      nameAr: newCatName.trim(),
      descriptionAr: newCatDesc.trim() || 'كتالوج رسمي ثابت من إدارة التطبيق لجميع المتاجر',
      icon: newCatIsGift ? 'Gift' : newCatIcon,
      isFreeGiftsCatalog: newCatIsGift,
    });
    setNewCatName('');
    setNewCatDesc('');
    setNewCatIcon('Layers');
    setNewCatIsGift(false);
  };

  const startEditFixedCatalog = (cat: Catalog) => {
    setEditingCatId(cat.id);
    setEditCatName(cat.nameAr);
    setEditCatDesc(cat.descriptionAr || '');
    setEditCatIcon(cat.icon || 'Layers');
    setEditCatIsGift(isCatalogFreeGifts(cat));
  };

  const handleSaveFixedCatalogEdit = (catId: string) => {
    if (!editCatName.trim()) {
      showToast({ type: 'error', title: 'تنبيه', description: 'اسم الكتالوج مطلوب.' });
      return;
    }
    updateFixedCatalogByAdmin(catId, {
      nameAr: editCatName.trim(),
      descriptionAr: editCatDesc.trim(),
      icon: editCatIsGift ? 'Gift' : editCatIcon,
      isFreeGiftsCatalog: editCatIsGift,
    });
    setEditingCatId(null);
  };

  const handleAddDropdownItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOptionLabel.trim()) {
      showToast({ type: 'error', title: 'تنبيه', description: 'يرجى إدخال مسمى الخيار.' });
      return;
    }
    addDropdownOption(activeDropdownKey, {
      labelAr: newOptionLabel.trim(),
      value: newOptionValue.trim() || undefined,
    });
    setNewOptionLabel('');
    setNewOptionValue('');
  };

  const handleSaveOptionLabel = (optionId: string) => {
    if (!editingOptionLabel.trim()) return;
    updateDropdownOption(activeDropdownKey, optionId, { labelAr: editingOptionLabel.trim() });
    setEditingOptionId(null);
    setEditingOptionLabel('');
  };

  const handleSaveInterfaceSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updatePlatformInterfaceSettings({
      supplierInterfaceNotice: localSettings.supplierInterfaceNotice,
      showSupplierInterfaceNotice: localSettings.showSupplierInterfaceNotice,
      posInterfaceNotice: localSettings.posInterfaceNotice,
      showPosInterfaceNotice: localSettings.showPosInterfaceNotice,
      allowSuppliersCreateCustomCatalogs: localSettings.allowSuppliersCreateCustomCatalogs,
      showResaleMarginInPosPurchase: localSettings.showResaleMarginInPosPurchase,
      showTierComparisonInPosStore: localSettings.showTierComparisonInPosStore,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-purple-950/60 via-slate-900 to-slate-900 border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-purple-500/15 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              إدارة إعدادات الواجهات والكتالوجات الثابتة والقوائم المنسدلة
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              إضافة كتالوجات ثابتة تظهر لجميع المتاجر ولا يمكنهم تعديلها أو حذفها، وتحديث خيارات القوائم المنسدلة (مثل نوع الحركة في كشف الحساب/البنك والبنوك المعتمدة) وإعدادات واجهات المتاجر ونقاط البيع.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] bg-slate-950/80 border border-slate-800 px-3 py-2 rounded-2xl shrink-0">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-300">مزامنة فورية لجميع البوابات</span>
        </div>
      </div>

      {/* SECTION A: Fixed Admin Catalogs */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400" />
              <span>الكتالوجات الثابتة من مدير التطبيق ({fixedCatalogs.length})</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              تظهر هذه الكتالوجات تلقائياً لجميع المتاجر ونقاط البيع والعملاء، ويمكن للمتجر إضافة خدمات داخلها دون تعديل الكتالوج أو حذفه.
            </p>
          </div>
        </div>

        {/* Add New Fixed Catalog Form */}
        <form onSubmit={handleAddFixedCatalog} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
          <div className="font-bold text-cyan-300 flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4" />
            <span>إضافة كتالوج ثابت جديد لجميع المتاجر:</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">اسم الكتالوج الثابت:</label>
              <input
                type="text"
                required
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="مثال: شحن الاتصالات والباقات الرسمية"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">الأيقونة:</label>
              <select
                value={newCatIcon}
                onChange={(e) => setNewCatIcon(e.target.value)}
                disabled={newCatIsGift}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
              >
                {ICON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} ({opt.value})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">وصف مختصر:</label>
              <input
                type="text"
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                placeholder="يظهر هذا الوصف لجميع المتاجر ونقاط البيع"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <label className="inline-flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={newCatIsGift}
                onChange={(e) => setNewCatIsGift(e.target.checked)}
                className="rounded border-slate-600 bg-slate-900 text-purple-500 focus:ring-purple-500"
              />
              <Gift className="w-3.5 h-3.5 text-purple-400" />
              <span>تعيين ككتالوج هدايا مجانية ثابت (سعر {formatCurrency(0)} + نسبة رسوم الإدارة)</span>
            </label>

            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>اعتماد وإضافة الكتالوج الثابت</span>
            </button>
          </div>
        </form>

        {/* Fixed Catalogs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {fixedCatalogs.map((cat) => {
            const linkedCount = services.filter((s) => s.catalogId === cat.id).length;
            const isGift = isCatalogFreeGifts(cat);
            const isEditing = editingCatId === cat.id;

            return (
              <div
                key={cat.id}
                className={`p-4 rounded-2xl border space-y-3 transition-colors ${
                  isGift
                    ? 'bg-purple-950/15 border-purple-500/40'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={editCatName}
                        onChange={(e) => setEditCatName(e.target.value)}
                        placeholder="اسم الكتالوج"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs"
                      />
                      <select
                        value={editCatIcon}
                        onChange={(e) => setEditCatIcon(e.target.value)}
                        disabled={editCatIsGift}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs"
                      >
                        {ICON_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="text"
                      value={editCatDesc}
                      onChange={(e) => setEditCatDesc(e.target.value)}
                      placeholder="وصف الكتالوج"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs"
                    />
                    <label className="inline-flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={editCatIsGift}
                        onChange={(e) => setEditCatIsGift(e.target.checked)}
                        className="rounded border-slate-600 bg-slate-900 text-purple-500"
                      />
                      <span>كتالوج هدايا مجانية</span>
                    </label>
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => handleSaveFixedCatalogEdit(cat.id)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>حفظ التعديل</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCatId(null)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>إلغاء</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="font-bold text-sm text-white flex items-center gap-1.5">
                            {isGift ? (
                              <Gift className="w-4 h-4 text-purple-400" />
                            ) : (
                              <Layers className="w-4 h-4 text-cyan-400" />
                            )}
                            <span>{cat.nameAr}</span>
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-semibold inline-flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            <span>ثابت لجميع المتاجر · غير قابل للتعديل من المتجر</span>
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">{cat.descriptionAr}</p>
                      </div>

                      <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-300 shrink-0">
                        {linkedCount} خدمات
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono text-slate-500">ID: {cat.id}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEditFixedCatalog(cat)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-purple-500/20 text-slate-300 hover:text-purple-300 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>تعديل</span>
                        </button>
                        <button
                          type="button"
                          disabled={linkedCount > 0}
                          onClick={() => deleteFixedCatalogByAdmin(cat.id)}
                          title={linkedCount > 0 ? 'لا يمكن حذف كتالوج يحتوي على خدمات مرتبطة' : 'حذف الكتالوج الثابت'}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-rose-300 border border-rose-500/30 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION B: Dynamic Admin-Managed Dropdown Lists */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-5">
        <div className="border-b border-slate-800 pb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-purple-400" />
            <span>إدارة القوائم المنسدلة التفاعلية (تحديث مستمر للمنصة)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            أضف أو حدّث خيارات القوائم المنسدلة بما يواكب التحديثات الجديدة مثل أنواع الحركات في كشف الحساب وكشف البنك وقائمة البنوك المعتمدة.
          </p>
        </div>

        {/* List Selector Tabs */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {(
            [
              'statementTransactionTypes',
              'adminStatementTransactionTypes',
              'approvedBankNames',
            ] as PlatformDropdownListKey[]
          ).map((key) => {
            const count = (platformSettings[key] || []).filter((o) => o.isActive).length;
            const isSelected = activeDropdownKey === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setActiveDropdownKey(key);
                  setEditingOptionId(null);
                }}
                className={`px-3.5 py-2 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-purple-500 text-slate-950 shadow-md'
                    : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700'
                }`}
              >
                <span>{getDropdownListTitle(key)}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] ${
                    isSelected ? 'bg-slate-950 text-purple-300' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Add Option Form */}
        <form onSubmit={handleAddDropdownItem} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end text-xs">
          <div className="sm:col-span-6">
            <label className="block text-slate-300 font-semibold mb-1">المسمى الظاهر للمستخدم في القائمة:</label>
            <input
              type="text"
              required
              value={newOptionLabel}
              onChange={(e) => setNewOptionLabel(e.target.value)}
              placeholder={
                activeDropdownKey === 'approvedBankNames'
                  ? 'مثال: بنك الاستثمار / محفظة STC Pay'
                  : 'مثال: تسوية ضريبية / حجز مبلغ معلق / استرداد بنكي'
              }
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-slate-300 font-semibold mb-1">القيمة البرمجية (اختياري):</label>
            <input
              type="text"
              value={newOptionValue}
              onChange={(e) => setNewOptionValue(e.target.value)}
              placeholder="تلقائي عند الترك فارغاً"
              dir="ltr"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              className="w-full py-2 px-3 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>إضافة للقائمة</span>
            </button>
          </div>
        </form>

        {/* Options Table/List */}
        <div className="space-y-2 text-xs">
          {activeDropdownItems.map((item) => {
            const isEditingOpt = editingOptionId === item.id;
            return (
              <div
                key={item.id}
                className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  item.isActive
                    ? 'bg-slate-950 border-slate-800'
                    : 'bg-slate-950/40 border-slate-800/50 opacity-70'
                }`}
              >
                <div className="flex items-center flex-wrap gap-2 flex-1">
                  {isEditingOpt ? (
                    <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                      <input
                        type="text"
                        value={editingOptionLabel}
                        onChange={(e) => setEditingOptionLabel(e.target.value)}
                        className="flex-1 bg-slate-900 border border-purple-500/60 rounded-xl px-3 py-1.5 text-white text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveOptionLabel(item.id)}
                        className="p-1.5 rounded-lg bg-emerald-500 text-slate-950 cursor-pointer"
                        title="حفظ"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingOptionId(null)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 cursor-pointer"
                        title="إلغاء"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="font-bold text-white">{item.labelAr}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-400">
                        {item.value}
                      </span>
                      {item.isSystem && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-semibold">
                          أساسي
                        </span>
                      )}
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      updateDropdownOption(activeDropdownKey, item.id, { isActive: !item.isActive })
                    }
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                      item.isActive
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {item.isActive ? (
                      <ToggleRight className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-4 h-4 text-slate-500" />
                    )}
                    <span>{item.isActive ? 'مفعّل' : 'مخفي'}</span>
                  </button>

                  {!isEditingOpt && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingOptionId(item.id);
                        setEditingOptionLabel(item.labelAr);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>تعديل</span>
                    </button>
                  )}

                  {!item.isSystem && (
                    <button
                      type="button"
                      onClick={() => deleteDropdownOption(activeDropdownKey, item.id)}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>حذف</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION C: Supplier & POS Interface Settings */}
      <form onSubmit={handleSaveInterfaceSettings} className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-5 text-xs">
        <div className="border-b border-slate-800 pb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <span>إعدادات واجهات المتاجر ونقاط البيع والعملاء</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            التحكم في التنبيهات العامة المعروضة في البوابات وصلاحيات إنشاء الكتالوجات وخيارات العرض للمتجر ونقاط البيع.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Supplier Interface Banner */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <Building2 className="w-4 h-4" />
                <span>تنبيه إداري في واجهة المتاجر</span>
              </div>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.showSupplierInterfaceNotice}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      showSupplierInterfaceNotice: e.target.checked,
                    }))
                  }
                  className="rounded border-slate-600 bg-slate-900 text-amber-500"
                />
                <span className="text-slate-300 font-semibold">تفعيل العرض</span>
              </label>
            </div>
            <textarea
              rows={2}
              value={localSettings.supplierInterfaceNotice}
              onChange={(e) =>
                setLocalSettings((prev) => ({
                  ...prev,
                  supplierInterfaceNotice: e.target.value,
                }))
              }
              placeholder="مثال: تم تحديث الكتالوجات الثابتة وقائمة البنوك المعتمدة — يرجى مراجعة الحسابات قبل التحويل."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          {/* POS/Client Interface Banner */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                <Store className="w-4 h-4" />
                <span>تنبيه إداري في واجهة نقاط البيع والعملاء</span>
              </div>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.showPosInterfaceNotice}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      showPosInterfaceNotice: e.target.checked,
                    }))
                  }
                  className="rounded border-slate-600 bg-slate-900 text-cyan-500"
                />
                <span className="text-slate-300 font-semibold">تفعيل العرض</span>
              </label>
            </div>
            <textarea
              rows={2}
              value={localSettings.posInterfaceNotice}
              onChange={(e) =>
                setLocalSettings((prev) => ({
                  ...prev,
                  posInterfaceNotice: e.target.value,
                }))
              }
              placeholder="مثال: عروض وخدمات جديدة متاحة الآن في الكتالوجات المعتمدة عبر متجرك."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 resize-none"
            />
          </div>
        </div>

        {/* Behavioral Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-2.5 cursor-pointer hover:border-slate-700">
            <input
              type="checkbox"
              checked={localSettings.allowSuppliersCreateCustomCatalogs}
              onChange={(e) =>
                setLocalSettings((prev) => ({
                  ...prev,
                  allowSuppliersCreateCustomCatalogs: e.target.checked,
                }))
              }
              className="mt-1 rounded border-slate-600 bg-slate-900 text-purple-500"
            />
            <div>
              <div className="font-bold text-white">السماح للمتاجر بإضافة كتالوجات خاصة</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                عند التعطيل، يلتزم المتاجر بالكتالوجات الثابتة المعتمدة من مدير التطبيق فقط.
              </div>
            </div>
          </label>

          <label className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-2.5 cursor-pointer hover:border-slate-700">
            <input
              type="checkbox"
              checked={localSettings.showTierComparisonInPosStore}
              onChange={(e) =>
                setLocalSettings((prev) => ({
                  ...prev,
                  showTierComparisonInPosStore: e.target.checked,
                }))
              }
              className="mt-1 rounded border-slate-600 bg-slate-900 text-purple-500"
            />
            <div>
              <div className="font-bold text-white">إظهار مقارنة أسعار الرتب في المتجر</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                عرض السعر العادي المشطوب وتوفير الرتبة في واجهة العميل ونافذة الشراء.
              </div>
            </div>
          </label>

          <label className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-2.5 cursor-pointer hover:border-slate-700">
            <input
              type="checkbox"
              checked={localSettings.showResaleMarginInPosPurchase}
              onChange={(e) =>
                setLocalSettings((prev) => ({
                  ...prev,
                  showResaleMarginInPosPurchase: e.target.checked,
                }))
              }
              className="mt-1 rounded border-slate-600 bg-slate-900 text-purple-500"
            />
            <div>
              <div className="font-bold text-white">حقل سعر البيع للزبون وحساب هامش الربح</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                إتاحة إدخال سعر البيع النهائي للزبون داخل نافذة شراء نقطة البيع.
              </div>
            </div>
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-colors shadow-lg cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>حفظ وتعميم إعدادات الواجهات</span>
          </button>
        </div>
      </form>
    </div>
  );
};
