import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { VoucherWarehouse } from '../../types';
import { getCatalogsForSupplierView } from '../../utils/platformSettings';
import {
  Ticket,
  Plus,
  Trash2,
  Package,
  Layers,
  CheckCircle2,
  Eye,
  EyeOff,
  Edit3,
  Search,
  Copy,
  Check,
  Store,
  AlertTriangle,
  Archive,
  X,
  Bell,
  BarChart3,
  Sliders,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  TrendingDown
} from 'lucide-react';
import {
  computeStockSummary,
  isWarehouseLowStock,
  DEFAULT_LOW_STOCK_THRESHOLD
} from '../../utils/voucherWarehouses';

export const VoucherWarehousesView: React.FC = () => {
  const {
    supplier,
    catalogs,
    services,
    voucherWarehouses,
    createVoucherWarehouse,
    addCodesToWarehouse,
    removeCodeFromWarehouse,
    updateVoucherWarehouse,
    setWarehouseLowStockThreshold,
    publishWarehouseAsService,
    unpublishWarehouseFromService,
    deleteVoucherWarehouse,
    showToast
  } = useApp();

  const supplierCatalogs = useMemo(
    () => getCatalogsForSupplierView(catalogs, supplier.id),
    [catalogs, supplier.id]
  );

  const supplierServices = useMemo(
    () => services.filter((s) => !s.supplierId || s.supplierId === supplier.id),
    [services, supplier.id]
  );

  const supplierWarehouses = useMemo(
    () =>
      voucherWarehouses.filter(
        (w) => !w.supplierId || w.supplierId === supplier.id
      ),
    [voucherWarehouses, supplier.id]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const w of supplierWarehouses) {
      if (w.categoryName?.trim()) set.add(w.categoryName.trim());
    }
    return Array.from(set);
  }, [supplierWarehouses]);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Create warehouse form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newRawCodes, setNewRawCodes] = useState('');
  const [priceRegular, setPriceRegular] = useState(100);
  const [priceBronze, setPriceBronze] = useState(90);
  const [priceSilver, setPriceSilver] = useState(80);
  const [priceGold, setPriceGold] = useState(70);
  const [priceVip, setPriceVip] = useState(60);
  const [allowSingleCode, setAllowSingleCode] = useState(true);
  const [allowPackage, setAllowPackage] = useState(false);
  const [newPackageCodesCount, setNewPackageCodesCount] = useState(5);
  const [newPackageNameAr, setNewPackageNameAr] = useState('');
  const [pkgPriceRegular, setPkgPriceRegular] = useState(450);
  const [pkgPriceBronze, setPkgPriceBronze] = useState(410);
  const [pkgPriceSilver, setPkgPriceSilver] = useState(370);
  const [pkgPriceGold, setPkgPriceGold] = useState(330);
  const [pkgPriceVip, setPkgPriceVip] = useState(280);
  const [publishImmediately, setPublishImmediately] = useState(true);
  const [publishCatalogId, setPublishCatalogId] = useState(
    supplierCatalogs[0]?.id || ''
  );
  const [publishMode, setPublishMode] = useState<'new_service' | 'existing_service'>(
    'new_service'
  );
  const [publishTargetServiceId, setPublishTargetServiceId] = useState(
    supplierServices[0]?.id || ''
  );
  const [publishNewServiceName, setPublishNewServiceName] = useState('');
  const [newLowStockThreshold, setNewLowStockThreshold] = useState<number>(DEFAULT_LOW_STOCK_THRESHOLD);

  // Refill codes modal/inline state
  const [refillingWarehouseId, setRefillingWarehouseId] = useState<string | null>(null);
  const [refillCodesInput, setRefillCodesInput] = useState('');

  // Expanded codes inspector state
  const [expandedWarehouseId, setExpandedWarehouseId] = useState<string | null>(null);
  const [copiedCodeKey, setCopiedCodeKey] = useState<string | null>(null);

  // Publish modal state for unpublished warehouses
  const [publishingWarehouse, setPublishingWarehouse] = useState<VoucherWarehouse | null>(null);
  const [modalCatalogId, setModalCatalogId] = useState(supplierCatalogs[0]?.id || '');
  const [modalPublishMode, setModalPublishMode] = useState<'new_service' | 'existing_service'>(
    'new_service'
  );
  const [modalTargetServiceId, setModalTargetServiceId] = useState(
    supplierServices[0]?.id || ''
  );
  const [modalServiceName, setModalServiceName] = useState('');

  // Edit warehouse state
  const [editingWarehouse, setEditingWarehouse] = useState<VoucherWarehouse | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editAllowSingle, setEditAllowSingle] = useState(true);
  const [editAllowPackage, setEditAllowPackage] = useState(false);
  const [editPackageCodesCount, setEditPackageCodesCount] = useState(5);
  const [editPackageNameAr, setEditPackageNameAr] = useState('');
  const [editLowStockThreshold, setEditLowStockThreshold] = useState<number>(DEFAULT_LOW_STOCK_THRESHOLD);
  const [editPrices, setEditPrices] = useState({
    regular: 100,
    bronze: 90,
    silver: 80,
    gold: 70,
    vip: 60
  });
  const [editPackagePrices, setEditPackagePrices] = useState({
    regular: 450,
    bronze: 410,
    silver: 370,
    gold: 330,
    vip: 280
  });

  // Inline and category threshold states
  const [inlineThresholds, setInlineThresholds] = useState<Record<string, number>>({});
  const [savingThresholdId, setSavingThresholdId] = useState<string | null>(null);
  const [categoryThresholdInputs, setCategoryThresholdInputs] = useState<Record<string, number>>({});

  const filteredWarehouses = useMemo(() => {
    return supplierWarehouses.filter((w) => {
      if (selectedCategory !== 'all' && w.categoryName !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = w.nameAr.toLowerCase().includes(q);
        const matchCat = w.categoryName.toLowerCase().includes(q);
        const matchCode = w.codes.some((c) => c.toLowerCase().includes(q));
        if (!matchName && !matchCat && !matchCode) return false;
      }
      return true;
    });
  }, [supplierWarehouses, selectedCategory, searchQuery]);

  const stockSummary = useMemo(
    () => computeStockSummary(supplierWarehouses),
    [supplierWarehouses]
  );

  const totalAvailableCodes = stockSummary.totalRemaining;
  const totalUsedCodes = stockSummary.totalSold;
  const publishedCount = useMemo(
    () => supplierWarehouses.filter((w) => w.isPublishedAsService).length,
    [supplierWarehouses]
  );

  const handleUpdateInlineThreshold = (warehouseId: string, currentThreshold: number) => {
    const target = inlineThresholds[warehouseId] ?? currentThreshold;
    if (target < 0) return;
    setSavingThresholdId(warehouseId);
    setWarehouseLowStockThreshold(warehouseId, target);
    setTimeout(() => setSavingThresholdId(null), 600);
  };

  const handleApplyCategoryThreshold = (categoryName: string, categoryWarehouses: VoucherWarehouse[]) => {
    const target = categoryThresholdInputs[categoryName] ?? DEFAULT_LOW_STOCK_THRESHOLD;
    if (target < 0) return;
    for (const wh of categoryWarehouses) {
      setWarehouseLowStockThreshold(wh.id, target);
    }
    showToast({
      type: 'success',
      title: 'تم تحديث حد التنبيه',
      description: `تم تعيين الحد الأدنى (${target} أكواد) لجميع باقات فئة "${categoryName}".`
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newCategory.trim()) {
      showToast({
        type: 'error',
        title: 'بيانات ناقصة',
        description: 'يرجى كتابة اسم المخزن واسم الفئة.'
      });
      return;
    }

    if (!allowSingleCode && !allowPackage) {
      showToast({
        type: 'error',
        title: 'اختر طريقة شراء',
        description: 'يرجى تفعيل الشراء بالكود الواحد أو بالباقة (أو كليهما).'
      });
      return;
    }

    createVoucherWarehouse({
      nameAr: newName,
      categoryName: newCategory,
      catalogId: publishCatalogId || supplierCatalogs[0]?.id,
      description: newDescription,
      rawCodes: newRawCodes,
      lowStockThreshold: Math.max(0, Number(newLowStockThreshold) || DEFAULT_LOW_STOCK_THRESHOLD),
      allowSingleCodePurchase: allowSingleCode,
      allowPackagePurchase: allowPackage,
      packageCodesCount: allowPackage ? Math.max(1, Math.floor(newPackageCodesCount || 5)) : undefined,
      packageNameAr: allowPackage ? newPackageNameAr.trim() || undefined : undefined,
      tierPrices: {
        regular: priceRegular,
        bronze: priceBronze,
        silver: priceSilver,
        gold: priceGold,
        vip: priceVip
      },
      packageTierPrices: allowPackage
        ? {
            regular: pkgPriceRegular,
            bronze: pkgPriceBronze,
            silver: pkgPriceSilver,
            gold: pkgPriceGold,
            vip: pkgPriceVip
          }
        : undefined,
      publishImmediately,
      targetServiceId:
        publishImmediately && publishMode === 'existing_service'
          ? publishTargetServiceId
          : undefined,
      newServiceNameAr:
        publishImmediately && publishMode === 'new_service'
          ? publishNewServiceName.trim() || newCategory.trim()
          : undefined
    });

    setNewName('');
    setNewCategory('');
    setNewDescription('');
    setNewRawCodes('');
    setNewPackageNameAr('');
    setNewLowStockThreshold(DEFAULT_LOW_STOCK_THRESHOLD);
    setPublishNewServiceName('');
    setShowCreateForm(false);
  };

  const handleRefillSubmit = (e: React.FormEvent, warehouseId: string) => {
    e.preventDefault();
    if (!refillCodesInput.trim()) return;
    const res = addCodesToWarehouse(warehouseId, refillCodesInput);
    if (res.addedCount > 0) {
      setRefillCodesInput('');
      setRefillingWarehouseId(null);
    }
  };

  const openPublishModal = (wh: VoucherWarehouse) => {
    setPublishingWarehouse(wh);
    setModalCatalogId(wh.catalogId || supplierCatalogs[0]?.id || '');
    setModalServiceName(wh.categoryName || wh.nameAr);
    setModalTargetServiceId(wh.linkedServiceId || supplierServices[0]?.id || '');
    setModalPublishMode(wh.linkedServiceId ? 'existing_service' : 'new_service');
  };

  const handleConfirmPublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!publishingWarehouse) return;
    publishWarehouseAsService(publishingWarehouse.id, {
      catalogId: modalCatalogId || supplierCatalogs[0]?.id || 'cat-cards',
      serviceId: modalPublishMode === 'existing_service' ? modalTargetServiceId : undefined,
      serviceNameAr: modalPublishMode === 'new_service' ? modalServiceName : undefined
    });
    setPublishingWarehouse(null);
  };

  const openEditModal = (wh: VoucherWarehouse) => {
    setEditingWarehouse(wh);
    setEditName(wh.nameAr);
    setEditCategory(wh.categoryName);
    setEditLowStockThreshold(wh.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD);
    const pkgOn = Boolean(wh.allowPackagePurchase);
    const singleOn = wh.allowSingleCodePurchase === false && pkgOn ? false : wh.allowSingleCodePurchase !== false;
    setEditAllowSingle(singleOn);
    setEditAllowPackage(pkgOn);
    setEditPackageCodesCount(wh.packageCodesCount || 5);
    setEditPackageNameAr(wh.packageNameAr || '');
    setEditPrices({ ...wh.tierPrices });
    setEditPackagePrices(
      wh.packageTierPrices
        ? { ...wh.packageTierPrices }
        : {
            regular: wh.tierPrices.regular * (wh.packageCodesCount || 5),
            bronze: wh.tierPrices.bronze * (wh.packageCodesCount || 5),
            silver: wh.tierPrices.silver * (wh.packageCodesCount || 5),
            gold: wh.tierPrices.gold * (wh.packageCodesCount || 5),
            vip: wh.tierPrices.vip * (wh.packageCodesCount || 5)
          }
    );
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWarehouse || !editName.trim() || !editCategory.trim()) return;
    if (!editAllowSingle && !editAllowPackage) {
      showToast({
        type: 'error',
        title: 'اختر طريقة شراء',
        description: 'يرجى تفعيل الشراء بالكود الواحد أو بالباقة (أو كليهما).'
      });
      return;
    }
    updateVoucherWarehouse(editingWarehouse.id, {
      nameAr: editName.trim(),
      categoryName: editCategory.trim(),
      lowStockThreshold: Math.max(0, Number(editLowStockThreshold) || DEFAULT_LOW_STOCK_THRESHOLD),
      allowSingleCodePurchase: editAllowSingle,
      allowPackagePurchase: editAllowPackage,
      packageCodesCount: editAllowPackage ? Math.max(1, Math.floor(editPackageCodesCount || 5)) : undefined,
      packageNameAr: editAllowPackage ? (editPackageNameAr.trim() || undefined) : undefined,
      tierPrices: editPrices,
      packageTierPrices: editAllowPackage ? editPackagePrices : undefined
    });
    setEditingWarehouse(null);
  };

  const handleCopyCode = (code: string, key: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeKey(key);
    setTimeout(() => setCopiedCodeKey(null), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Header & CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Archive className="w-5 h-5 text-amber-400" />
              <span>إدارة مخزون الأكواد</span>
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
              {supplierWarehouses.length} فئات وباقات
            </span>
            {stockSummary.lowStockCount > 0 ? (
              <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[10px] font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-400 animate-pulse" />
                <span>{stockSummary.lowStockCount} فئات تحتاج تعبئة مخزون</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>حالة المخزون مستقرة</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            لوحة موحدة لإدارة أنواع وفئات وباقات الأكواد الرقمية، متابعة المتوفر والمباع والمتبقي، وضبط حدود تنبيهات نقص المخزون التلقائية لكل فئة وباقة.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-colors shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء مخزن أكواد جديد لفئة</span>
        </button>
      </div>

      {/* Low Stock Alert Warning Banner */}
      {stockSummary.lowStockCount > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/40 via-amber-950/30 to-slate-900 border border-rose-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-rose-400 animate-pulse" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs font-bold text-rose-200 flex items-center gap-2">
                <span>تنبيه فوري بنقص المخزون في بعض الفئات</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono">
                  {stockSummary.lowStockCount} فئات تحت الحد الأدنى
                </span>
              </h3>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                وصل مخزون بعض الفئات أو الباقات إلى الحد الأدنى المحدد لها ({stockSummary.outOfStockCount > 0 ? `${stockSummary.outOfStockCount} فئات نفدت بالكامل` : 'أوشكت على النفاد'}). بادر بتعبئة الأكواد أو تعديل حد التنبيه لضمان استمرار تسليم الطلبات الفورية للعملاء دون انقطاع.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 mr-auto sm:mr-0">
            <button
              type="button"
              onClick={() => {
                const firstLow = supplierWarehouses.find((w) => isWarehouseLowStock(w));
                if (firstLow) {
                  setSelectedCategory(firstLow.categoryName);
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-[11px] transition-colors cursor-pointer"
            >
              تصفية الفئات المنخفضة
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards: المتوفر الأصلي · المباع · المتبقي · تنبيهات النقص */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-slate-400 block text-[11px]">كم المتوفر الأصلي (المودع)</span>
          <div className="text-xl font-bold font-mono text-white">
            {stockSummary.totalStocked} <span className="text-xs font-normal text-slate-400">كود</span>
          </div>
          <span className="text-[10px] text-slate-500">
            متبقي ({stockSummary.totalRemaining}) + مباع ({stockSummary.totalSold})
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-cyan-500/30 space-y-1">
          <span className="text-cyan-300 block text-[11px]">كم المباع (المصروف للعملاء)</span>
          <div className="text-xl font-bold font-mono text-cyan-400">
            {stockSummary.totalSold} <span className="text-xs font-normal text-cyan-300/70">كود</span>
          </div>
          <span className="text-[10px] text-slate-500">
            {stockSummary.totalStocked > 0
              ? `${Math.round((stockSummary.totalSold / stockSummary.totalStocked) * 100)}% مبيعات من الإجمالي`
              : 'مخصومة من المخزون'}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-amber-500/30 space-y-1">
          <span className="text-amber-300 block text-[11px]">كم المتبقي (رصيد جاهز)</span>
          <div className="text-xl font-bold font-mono text-amber-400">
            {stockSummary.totalRemaining} <span className="text-xs font-normal text-amber-300/70">كود</span>
          </div>
          <span className="text-[10px] text-slate-500">جاهزة للتسليم الفوري للعملاء</span>
        </div>

        <div
          className={`p-3.5 rounded-2xl bg-slate-900 border space-y-1 ${
            stockSummary.lowStockCount > 0
              ? 'border-rose-500/50 bg-rose-950/20'
              : 'border-emerald-500/30'
          }`}
        >
          <span
            className={`block text-[11px] ${
              stockSummary.lowStockCount > 0 ? 'text-rose-300 font-bold' : 'text-emerald-300'
            }`}
          >
            تنبيهات نقص المخزون
          </span>
          <div
            className={`text-xl font-bold font-mono ${
              stockSummary.lowStockCount > 0 ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {stockSummary.lowStockCount} <span className="text-xs font-normal text-slate-400">فئات</span>
          </div>
          <span className="text-[10px] text-slate-500">
            {stockSummary.lowStockCount > 0
              ? `${stockSummary.outOfStockCount} نفدت بالكامل`
              : 'جميع الفئات فوق الحد الأدنى'}
          </span>
        </div>
      </div>

      {/* Create New Warehouse Form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateSubmit}
          className="p-5 rounded-3xl bg-slate-900 border border-amber-500/40 space-y-4 text-xs shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-sm text-amber-300 flex items-center gap-2">
              <Ticket className="w-4 h-4" />
              <span>إنشاء وتعبئة مخزن أكواد جديد</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                الفئة الرئيسية للمخزن: <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                list="existing-warehouse-categories"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="مثال: بطاقات بلايستيشن ستور أو أكواد آيتونز"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
              <datalist id="existing-warehouse-categories">
                {categories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                اسم المخزن / الفئة الفرعية (الباقة): <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="مثال: بطاقة 50$ ستور سعودي"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                وصف مختصر (اختياري):
              </label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="مثال: كود رسمي أصلي للحسابات السعودية - تسليم فوري"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-amber-300 font-semibold mb-1 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-amber-400" />
                <span>الحد الأدنى لتنبيه نقص المخزون:</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={newLowStockThreshold}
                  onChange={(e) =>
                    setNewLowStockThreshold(Math.max(0, parseInt(e.target.value, 10) || 0))
                  }
                  className="w-24 bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                />
                <span className="text-[11px] text-slate-400">
                  كود (إشعار تلقائي عند وصول الرصيد المتبقي له أو أقل)
                </span>
              </div>
            </div>
          </div>

          {/* Purchase Modes & Dual Pricing (Single Code vs Package) */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-amber-400">
                تحديد إمكانية الشراء والتسعير (بالكود الواحد أو بالباقة أو كليهما):
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-white font-semibold">
                  <input
                    type="checkbox"
                    checked={allowSingleCode}
                    onChange={(e) => setAllowSingleCode(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                  <span>إتاحة الشراء بالكود الواحد</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-cyan-300 font-semibold">
                  <input
                    type="checkbox"
                    checked={allowPackage}
                    onChange={(e) => setAllowPackage(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500 rounded"
                  />
                  <span>إتاحة الشراء بالباقة</span>
                </label>
              </div>
            </div>

            {allowSingleCode && (
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                <span className="block text-[11px] font-bold text-amber-300">
                  أسعار الكود الواحد حسب رتب العملاء (ر.س):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                  <div>
                    <span className="block text-[10px] text-slate-400 mb-1">عادي</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={priceRegular}
                      onChange={(e) => setPriceRegular(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 text-center font-mono font-bold text-white text-xs"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-amber-500 mb-1">نحاسي</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={priceBronze}
                      onChange={(e) => setPriceBronze(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 text-center font-mono font-bold text-amber-400 text-xs"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-300 mb-1">فضي</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={priceSilver}
                      onChange={(e) => setPriceSilver(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 text-center font-mono font-bold text-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-yellow-400 mb-1">ذهبي</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={priceGold}
                      onChange={(e) => setPriceGold(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 text-center font-mono font-bold text-yellow-300 text-xs"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="block text-[10px] text-purple-400 font-bold mb-1">مميز VIP</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={priceVip}
                      onChange={(e) => setPriceVip(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-purple-500/50 rounded-lg py-1.5 text-center font-mono font-bold text-purple-300 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {allowPackage && (
              <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-cyan-300 mb-1">
                      عدد الأكواد في الباقة الواحدة:
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={newPackageCodesCount}
                      onChange={(e) => setNewPackageCodesCount(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-cyan-500/40 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-cyan-300 mb-1">
                      مسمى الباقة (اختياري):
                    </label>
                    <input
                      type="text"
                      value={newPackageNameAr}
                      onChange={(e) => setNewPackageNameAr(e.target.value)}
                      placeholder={`مثال: باقة (${newPackageCodesCount} أكواد)`}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>

                <span className="block text-[11px] font-bold text-cyan-300">
                  أسعار الباقة ({newPackageCodesCount} أكواد) حسب رتب العملاء (ر.س):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                  <div>
                    <span className="block text-[10px] text-slate-400 mb-1">عادي</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={pkgPriceRegular}
                      onChange={(e) => setPkgPriceRegular(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 text-center font-mono font-bold text-white text-xs"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-amber-500 mb-1">نحاسي</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={pkgPriceBronze}
                      onChange={(e) => setPkgPriceBronze(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 text-center font-mono font-bold text-amber-400 text-xs"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-300 mb-1">فضي</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={pkgPriceSilver}
                      onChange={(e) => setPkgPriceSilver(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 text-center font-mono font-bold text-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-yellow-400 mb-1">ذهبي</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={pkgPriceGold}
                      onChange={(e) => setPkgPriceGold(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 text-center font-mono font-bold text-yellow-300 text-xs"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="block text-[10px] text-purple-400 font-bold mb-1">مميز VIP</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={pkgPriceVip}
                      onChange={(e) => setPkgPriceVip(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-purple-500/50 rounded-lg py-1.5 text-center font-mono font-bold text-purple-300 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Initial Codes */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              تعبئة الأكواد الرقمية الأولية (كود في كل سطر):
            </label>
            <textarea
              rows={4}
              value={newRawCodes}
              onChange={(e) => setNewRawCodes(e.target.value)}
              placeholder="PSN-50SA-8849-2210&#10;PSN-50SA-9931-5541&#10;PSN-50SA-1102-7744"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500"
              dir="ltr"
            />
          </div>

          {/* Publish as service option */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-white">
              <input
                type="checkbox"
                checked={publishImmediately}
                onChange={(e) => setPublishImmediately(e.target.checked)}
                className="w-4 h-4 accent-amber-500 rounded"
              />
              <span>عرض هذا المخزن مباشرة كخدمة للعملاء وفق الفئة والأكواد</span>
            </label>

            {publishImmediately && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">الكتالوج:</label>
                  <select
                    value={publishCatalogId}
                    onChange={(e) => setPublishCatalogId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {supplierCatalogs.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">طريقة العرض في المتجر:</label>
                  <select
                    value={publishMode}
                    onChange={(e) =>
                      setPublishMode(e.target.value as 'new_service' | 'existing_service')
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="new_service">إنشاء خدمة جديدة باسم الفئة</option>
                    {supplierServices.length > 0 && (
                      <option value="existing_service">إضافة كباقة/فئة داخل خدمة موجودة</option>
                    )}
                  </select>
                </div>

                {publishMode === 'new_service' ? (
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">
                      اسم الخدمة المعروضة للعملاء (يترك فارغاً لاستخدام اسم الفئة):
                    </label>
                    <input
                      type="text"
                      value={publishNewServiceName}
                      onChange={(e) => setPublishNewServiceName(e.target.value)}
                      placeholder={newCategory || 'مثال: بطاقات بلايستيشن ستور السعودي'}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                ) : (
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">
                      اختر الخدمة الحالية لإضافة هذه الفئة إليها:
                    </label>
                    <select
                      value={publishTargetServiceId}
                      onChange={(e) => setPublishTargetServiceId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      {supplierServices.map((srv) => (
                        <option key={srv.id} value={srv.id}>
                          {srv.nameAr}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>حفظ المخزن والأكواد</span>
            </button>
          </div>
        </form>
      )}

      {/* ملخص أنواع وفئات الأكواد في المخزن (في بداية العروض لباقات وفئات الأكواد) */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-400" />
              <span>ملخص أنواع وفئات الأكواد في المخزن</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              عرض تحليلي موحد لكل فئة ونوع كود يوضح: كم المتوفر الأصلي، كم المباع، كم المتبقي، مع إمكانية ضبط حد التنبيه الأدنى لكل فئة.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 font-medium">
              الفئات المسجلة: <strong className="text-amber-400 font-mono">{stockSummary.totalCategories}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 font-medium">
              الباقات النشطة: <strong className="text-white font-mono">{stockSummary.totalWarehouses}</strong>
            </span>
          </div>
        </div>

        {stockSummary.categories.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs space-y-1">
            <Archive className="w-8 h-8 mx-auto text-slate-600 mb-1" />
            <p className="font-bold text-slate-400">لا توجد أكواد أو فئات مسجلة بالمخزن بعد</p>
            <p>اضغط على "إنشاء مخزن أكواد جديد لفئة" لإضافة فئات وأكواد رقمية والبدء ببيعها.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {stockSummary.categories.map((cat) => {
              const isOut = cat.totalRemaining === 0;
              const isLow = cat.lowStockCount > 0;
              const soldPercentage =
                cat.totalStocked > 0
                  ? Math.round((cat.totalSold / cat.totalStocked) * 100)
                  : 0;
              const currentCatThreshold =
                categoryThresholdInputs[cat.categoryName] ??
                (cat.warehouses[0]?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD);

              return (
                <div
                  key={cat.categoryName}
                  className={`p-4 rounded-2xl bg-slate-950 border flex flex-col justify-between gap-3 transition-colors ${
                    isOut
                      ? 'border-rose-500/50 bg-rose-950/10'
                      : isLow
                      ? 'border-amber-500/50 bg-amber-950/10'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Category Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                          نوع الكود
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                          {cat.warehousesCount} {cat.warehousesCount === 1 ? 'باقة' : 'باقات'}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-white mt-1">
                        {cat.categoryName}
                      </h4>
                    </div>

                    {/* Status Badge */}
                    {isOut ? (
                      <span className="px-2 py-1 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold shrink-0 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                        <span>نفد المخزون</span>
                      </span>
                    ) : isLow ? (
                      <span className="px-2 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold shrink-0 flex items-center gap-1 animate-pulse">
                        <TrendingDown className="w-3 h-3 text-amber-400" />
                        <span>تحت حد التنبيه ({cat.lowStockCount})</span>
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold shrink-0 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>مخزون وفير</span>
                      </span>
                    )}
                  </div>

                  {/* Core Metrics: المتوفر · المباع · المتبقي */}
                  <div className="grid grid-cols-3 gap-2 py-2 px-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 text-center">
                    <div>
                      <span className="block text-[10px] text-slate-400">كم المتوفر</span>
                      <span className="text-sm font-black font-mono text-white">
                        {cat.totalStocked}
                      </span>
                      <span className="block text-[9px] text-slate-500">أصلي وارد</span>
                    </div>

                    <div className="border-x border-slate-800">
                      <span className="block text-[10px] text-cyan-300">كم المباع</span>
                      <span className="text-sm font-black font-mono text-cyan-400">
                        {cat.totalSold}
                      </span>
                      <span className="block text-[9px] text-cyan-400/60 font-mono">
                        {soldPercentage}%
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] text-amber-300">كم المتبقي</span>
                      <span
                        className={`text-sm font-black font-mono ${
                          isOut ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-emerald-400'
                        }`}
                      >
                        {cat.totalRemaining}
                      </span>
                      <span className="block text-[9px] text-slate-500">جاهز للبيع</span>
                    </div>
                  </div>

                  {/* Progress Bar of Stock Consumption */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>نسبة الاستهلاك / المبيعات:</span>
                      <span className="font-mono text-slate-300">{cat.totalSold} من {cat.totalStocked} كود</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isOut
                            ? 'bg-rose-500'
                            : isLow
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, soldPercentage)}%` }}
                      />
                    </div>
                  </div>

                  {/* Configurable Alert Threshold per Category */}
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-300 font-semibold flex items-center gap-1">
                        <Bell className="w-3 h-3 text-amber-400" />
                        <span>ضبط حد التنبيه للفئة:</span>
                      </span>
                      <span className="text-[10px] text-slate-400">
                        (إشعار تلقائي عند المتبقي ≤ الحد)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        value={currentCatThreshold}
                        onChange={(e) =>
                          setCategoryThresholdInputs((prev) => ({
                            ...prev,
                            [cat.categoryName]: Math.max(0, parseInt(e.target.value, 10) || 0)
                          }))
                        }
                        className="w-16 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-lg py-1 px-1.5 text-center font-mono font-bold text-amber-400 text-xs focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleApplyCategoryThreshold(cat.categoryName, cat.warehouses)
                        }
                        className="flex-1 py-1 px-2 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 text-[10px] font-bold transition-colors cursor-pointer text-center"
                      >
                        حفظ الحد للباقات
                      </button>
                    </div>
                  </div>

                  {/* Filter / Focus Action */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory(cat.categoryName)}
                      className={`text-[11px] font-bold transition-colors cursor-pointer ${
                        selectedCategory === cat.categoryName
                          ? 'text-amber-400'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {selectedCategory === cat.categoryName
                        ? '← يتم استعراض باقاتها حالياً'
                        : 'استعراض باقات هذه الفئة ↓'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const targetWh = cat.warehouses[0];
                        if (targetWh) {
                          setRefillingWarehouseId(targetWh.id);
                          setRefillCodesInput('');
                          setSelectedCategory(cat.categoryName);
                        }
                      }}
                      className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>تعبئة أكواد</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Category Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
            }`}
          >
            جميع الفئات ({supplierWarehouses.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
              }`}
            >
              {cat} ({supplierWarehouses.filter((w) => w.categoryName === cat).length})
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم الفئة أو الكود..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Warehouses List */}
      {filteredWarehouses.length === 0 ? (
        <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-2">
          <Archive className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-300">لا توجد مخازن أكواد مطابقة حالياً</p>
          <p className="text-xs text-slate-500">
            اضغط على "إنشاء مخزن أكواد جديد لفئة" لإضافة وتعبئة أكواد رقمية وعرضها كخدمات.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredWarehouses.map((wh) => {
            const linkedService = wh.linkedServiceId
              ? services.find((s) => s.id === wh.linkedServiceId)
              : undefined;
            const linkedCat = linkedService
              ? catalogs.find((c) => c.id === linkedService.catalogId)
              : wh.catalogId
              ? catalogs.find((c) => c.id === wh.catalogId)
              : undefined;
            const isOutOfStock = wh.codes.length === 0;
            const isLowStock = isWarehouseLowStock(wh);
            const whThreshold = wh.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
            const totalWhStocked = wh.codes.length + (wh.usedCodesCount || 0);
            const whSold = wh.usedCodesCount || 0;
            const whRemaining = wh.codes.length;
            const isRefilling = refillingWarehouseId === wh.id;
            const isExpanded = expandedWarehouseId === wh.id;

            return (
              <div
                key={wh.id}
                className={`p-4 sm:p-5 rounded-3xl bg-slate-900 border space-y-3.5 text-xs transition-colors ${
                  isOutOfStock
                    ? 'border-rose-500/50 bg-rose-950/5'
                    : isLowStock
                    ? 'border-amber-500/50 bg-amber-950/5'
                    : wh.isPublishedAsService
                    ? 'border-emerald-500/30'
                    : 'border-slate-800'
                }`}
              >
                {/* Top header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                        فئة: {wh.categoryName}
                      </span>
                      {wh.isPublishedAsService ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                          <Store className="w-3 h-3" />
                          <span>معروضة كخدمة</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 text-[10px]">
                          مخزن داخلي فقط
                        </span>
                      )}
                      {(wh.allowSingleCodePurchase !== false || !wh.allowPackagePurchase) && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 border border-slate-700 text-[10px] font-semibold">
                          شراء بالكود
                        </span>
                      )}
                      {wh.allowPackagePurchase && (
                        <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-semibold flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          <span>
                            شراء بالباقة ({wh.packageCodesCount || 5} أكواد · {Math.floor(wh.codes.length / (wh.packageCodesCount || 5))} باقة متاحة)
                          </span>
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-sm text-white">{wh.nameAr}</h3>
                    {linkedService && (
                      <p className="text-[11px] text-slate-400">
                        الخدمة المرتبطة: <strong className="text-slate-200">{linkedService.nameAr}</strong>
                        {linkedCat && <span> ({linkedCat.nameAr})</span>}
                      </p>
                    )}
                  </div>

                  {/* Stock counter badge */}
                  <div
                    className={`px-3 py-2 rounded-2xl border text-center shrink-0 ${
                      isOutOfStock
                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                        : isLowStock
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                        : 'bg-slate-950 border-emerald-500/30 text-emerald-400'
                    }`}
                  >
                    <div className="text-lg font-black font-mono leading-none">
                      {wh.codes.length}
                    </div>
                    <div className="text-[10px] mt-1 font-semibold">
                      {isOutOfStock ? 'نفد المخزون' : isLowStock ? 'مخزون منخفض' : 'كود متاح'}
                    </div>
                  </div>
                </div>

                {/* Stock Breakdown: المتوفر · المباع · المتبقي */}
                <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                  <div>
                    <span className="block text-[10px] text-slate-400">كم المتوفر</span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-white">{totalWhStocked}</span>
                    <span className="block text-[9px] text-slate-500">أصلي وارد</span>
                  </div>
                  <div className="border-x border-slate-800">
                    <span className="block text-[10px] text-cyan-300">كم المباع</span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-cyan-400">{whSold}</span>
                    <span className="block text-[9px] text-slate-500">مصروف للعملاء</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-amber-300">كم المتبقي</span>
                    <span
                      className={`text-xs sm:text-sm font-bold font-mono ${
                        isOutOfStock ? 'text-rose-400' : isLowStock ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {whRemaining}
                    </span>
                    <span className="block text-[9px] text-slate-500">جاهز للتسليم</span>
                  </div>
                </div>

                {/* Low stock alert badge if below threshold */}
                {isLowStock && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-[11px] text-amber-300">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        {isOutOfStock
                          ? 'تنبيه: نفد مخزون هذه الباقة بالكامل!'
                          : `تنبيه نقص مخزون: المتبقي (${whRemaining}) وصل لحد التنبيه الأدنى (${whThreshold}) أو أقل`}
                      </span>
                    </div>
                    <span className="text-[10px] text-amber-400 font-mono font-bold shrink-0">
                      تعبئة مطلوبة
                    </span>
                  </div>
                )}

                {/* Inline Threshold Setting Row */}
                <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-amber-400" />
                    <span>حد التنبيه الأدنى للباقة:</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      value={inlineThresholds[wh.id] ?? whThreshold}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                        setInlineThresholds((prev) => ({ ...prev, [wh.id]: val }));
                      }}
                      className="w-14 bg-slate-900 border border-slate-700 rounded-lg py-0.5 px-1.5 text-center font-mono font-bold text-amber-400 text-xs focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateInlineThreshold(wh.id, whThreshold)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      {savingThresholdId === wh.id ? 'تم الحفظ' : 'تحديث الحد'}
                    </button>
                  </div>
                </div>

                {/* Pricing strips */}
                <div className="space-y-2">
                  {(wh.allowSingleCodePurchase !== false || !wh.allowPackagePurchase) && (
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
                      <div className="text-[10px] font-bold text-amber-400">أسعار الكود الواحد (ر.س):</div>
                      <div className="grid grid-cols-5 gap-1.5 text-center text-[10px]">
                        <div>
                          <span className="text-slate-500 block">عادي</span>
                          <span className="font-mono font-bold text-white">{wh.tierPrices.regular}</span>
                        </div>
                        <div>
                          <span className="text-amber-500 block">نحاسي</span>
                          <span className="font-mono font-bold text-amber-400">{wh.tierPrices.bronze}</span>
                        </div>
                        <div>
                          <span className="text-slate-300 block">فضي</span>
                          <span className="font-mono font-bold text-slate-200">{wh.tierPrices.silver}</span>
                        </div>
                        <div>
                          <span className="text-yellow-400 block">ذهبي</span>
                          <span className="font-mono font-bold text-yellow-300">{wh.tierPrices.gold}</span>
                        </div>
                        <div>
                          <span className="text-purple-400 block">VIP</span>
                          <span className="font-mono font-bold text-purple-300">{wh.tierPrices.vip}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {wh.allowPackagePurchase && wh.packageTierPrices && (
                    <div className="p-2 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-1">
                      <div className="text-[10px] font-bold text-cyan-300">
                        أسعار {wh.packageNameAr?.trim() || `الباقة (${wh.packageCodesCount || 5} أكواد)`} (ر.س):
                      </div>
                      <div className="grid grid-cols-5 gap-1.5 text-center text-[10px]">
                        <div>
                          <span className="text-slate-500 block">عادي</span>
                          <span className="font-mono font-bold text-white">{wh.packageTierPrices.regular}</span>
                        </div>
                        <div>
                          <span className="text-amber-500 block">نحاسي</span>
                          <span className="font-mono font-bold text-amber-400">{wh.packageTierPrices.bronze}</span>
                        </div>
                        <div>
                          <span className="text-slate-300 block">فضي</span>
                          <span className="font-mono font-bold text-slate-200">{wh.packageTierPrices.silver}</span>
                        </div>
                        <div>
                          <span className="text-yellow-400 block">ذهبي</span>
                          <span className="font-mono font-bold text-yellow-300">{wh.packageTierPrices.gold}</span>
                        </div>
                        <div>
                          <span className="text-purple-400 block">VIP</span>
                          <span className="font-mono font-bold text-purple-300">{wh.packageTierPrices.vip}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions row */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRefillingWarehouseId(isRefilling ? null : wh.id);
                      setRefillCodesInput('');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>تعبئة أكواد</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExpandedWarehouseId(isExpanded ? null : wh.id)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {isExpanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>عرض الأكواد ({wh.codes.length})</span>
                  </button>

                  {wh.isPublishedAsService ? (
                    <button
                      type="button"
                      onClick={() => unpublishWarehouseFromService(wh.id)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>إخفاء من المتجر</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openPublishModal(wh)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>عرض كخدمة للعملاء</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => openEditModal(wh)}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                    title="تعديل الفئة والأسعار"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteVoucherWarehouse(wh.id)}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 cursor-pointer mr-auto"
                    title="حذف المخزن"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Inline Refill Form */}
                {isRefilling && (
                  <form
                    onSubmit={(e) => handleRefillSubmit(e, wh.id)}
                    className="p-3.5 rounded-2xl bg-slate-950 border border-amber-500/40 space-y-2.5"
                  >
                    <label className="block text-[11px] font-bold text-amber-300">
                      أدخل الأكواد الجديدة لتعبئة "{wh.nameAr}" (كود في كل سطر):
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={refillCodesInput}
                      onChange={(e) => setRefillCodesInput(e.target.value)}
                      placeholder="CODE-AAAA-1111&#10;CODE-BBBB-2222"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                      dir="ltr"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setRefillingWarehouseId(null)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-[11px]"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px]"
                      >
                        إيداع الأكواد الآن
                      </button>
                    </div>
                  </form>
                )}

                {/* Expanded Codes List */}
                {isExpanded && (
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>الأكواد المتبقية في المخزن (مصروف: {wh.usedCodesCount || 0}):</span>
                      <span className="font-mono text-amber-400">{wh.codes.length} كود</span>
                    </div>
                    {wh.codes.length === 0 ? (
                      <div className="py-3 text-center text-[11px] text-rose-400 flex items-center justify-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>المخزن فارغ حالياً — قم بتعبئته بالأكواد</span>
                      </div>
                    ) : (
                      <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                        {wh.codes.map((code, idx) => {
                          const key = `${wh.id}-${idx}`;
                          return (
                            <div
                              key={key}
                              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-amber-300"
                            >
                              <span className="truncate" dir="ltr">
                                {code}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleCopyCode(code, key)}
                                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                                  title="نسخ"
                                >
                                  {copiedCodeKey === key ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeCodeFromWarehouse(wh.id, idx)}
                                  className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400"
                                  title="حذف الكود"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Publish as Service Modal */}
      {publishingWarehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <form
            onSubmit={handleConfirmPublish}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 text-xs text-slate-100 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white">
                عرض مخزن "{publishingWarehouse.nameAr}" كخدمة للعملاء
              </h3>
              <button
                type="button"
                onClick={() => setPublishingWarehouse(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-slate-300 mb-1">اختر الكتالوج:</label>
              <select
                value={modalCatalogId}
                onChange={(e) => setModalCatalogId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                {supplierCatalogs.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nameAr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 mb-1">طريقة العرض:</label>
              <select
                value={modalPublishMode}
                onChange={(e) =>
                  setModalPublishMode(e.target.value as 'new_service' | 'existing_service')
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="new_service">إنشاء خدمة جديدة وفق الفئة</option>
                {supplierServices.length > 0 && (
                  <option value="existing_service">ربط كباقة داخل خدمة موجودة</option>
                )}
              </select>
            </div>

            {modalPublishMode === 'new_service' ? (
              <div>
                <label className="block text-slate-300 mb-1">اسم الخدمة للعملاء:</label>
                <input
                  type="text"
                  required
                  value={modalServiceName}
                  onChange={(e) => setModalServiceName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            ) : (
              <div>
                <label className="block text-slate-300 mb-1">الخدمة المستهدفة:</label>
                <select
                  value={modalTargetServiceId}
                  onChange={(e) => setModalTargetServiceId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  {supplierServices.map((srv) => (
                    <option key={srv.id} value={srv.id}>
                      {srv.nameAr}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPublishingWarehouse(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
              >
                نشر وعرض للعملاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Warehouse Modal */}
      {editingWarehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 text-xs text-slate-100 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white">تعديل مخزن الأكواد</h3>
              <button
                type="button"
                onClick={() => setEditingWarehouse(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 mb-1">الفئة:</label>
                <input
                  type="text"
                  required
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">اسم المخزن / الباقة:</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label htmlFor="edit-low-stock-threshold" className="text-amber-300 font-semibold flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-amber-400" />
                <span>الحد الأدنى لتنبيه نقص المخزون:</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="edit-low-stock-threshold"
                  type="number"
                  min={0}
                  value={editLowStockThreshold}
                  onChange={(e) =>
                    setEditLowStockThreshold(Math.max(0, parseInt(e.target.value, 10) || 0))
                  }
                  className="w-24 bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-1.5 text-center text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                />
                <span className="text-[11px] text-slate-400">كود</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-white font-semibold">
                  <input
                    type="checkbox"
                    checked={editAllowSingle}
                    onChange={(e) => setEditAllowSingle(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                  <span>إتاحة الشراء بالكود الواحد</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-cyan-300 font-semibold">
                  <input
                    type="checkbox"
                    checked={editAllowPackage}
                    onChange={(e) => setEditAllowPackage(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500 rounded"
                  />
                  <span>إتاحة الشراء بالباقة</span>
                </label>
              </div>

              {editAllowSingle && (
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-bold text-amber-300">
                    أسعار الكود الواحد (ر.س):
                  </span>
                  <div className="grid grid-cols-5 gap-2 text-center">
                    {(['regular', 'bronze', 'silver', 'gold', 'vip'] as const).map((tierKey) => (
                      <div key={tierKey}>
                        <span className="block text-[10px] text-slate-400 mb-1">
                          {tierKey === 'regular'
                            ? 'عادي'
                            : tierKey === 'bronze'
                            ? 'نحاسي'
                            : tierKey === 'silver'
                            ? 'فضي'
                            : tierKey === 'gold'
                            ? 'ذهبي'
                            : 'VIP'}
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={editPrices[tierKey]}
                          onChange={(e) =>
                            setEditPrices((prev) => ({
                              ...prev,
                              [tierKey]: Math.max(0, Number(e.target.value))
                            }))
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 text-center font-mono font-bold text-white text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {editAllowPackage && (
                <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-cyan-300 mb-1">
                        عدد الأكواد في الباقة الواحدة:
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={editPackageCodesCount}
                        onChange={(e) => setEditPackageCodesCount(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-slate-950 border border-cyan-500/40 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-cyan-300 mb-1">
                        مسمى الباقة (اختياري):
                      </label>
                      <input
                        type="text"
                        value={editPackageNameAr}
                        onChange={(e) => setEditPackageNameAr(e.target.value)}
                        placeholder={`مثال: باقة (${editPackageCodesCount} أكواد)`}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>

                  <span className="block text-[11px] font-bold text-cyan-300">
                    أسعار الباقة ({editPackageCodesCount} أكواد) (ر.س):
                  </span>
                  <div className="grid grid-cols-5 gap-2 text-center">
                    {(['regular', 'bronze', 'silver', 'gold', 'vip'] as const).map((tierKey) => (
                      <div key={tierKey}>
                        <span className="block text-[10px] text-slate-400 mb-1">
                          {tierKey === 'regular'
                            ? 'عادي'
                            : tierKey === 'bronze'
                            ? 'نحاسي'
                            : tierKey === 'silver'
                            ? 'فضي'
                            : tierKey === 'gold'
                            ? 'ذهبي'
                            : 'VIP'}
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={editPackagePrices[tierKey]}
                          onChange={(e) =>
                            setEditPackagePrices((prev) => ({
                              ...prev,
                              [tierKey]: Math.max(0, Number(e.target.value))
                            }))
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 text-center font-mono font-bold text-cyan-300 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingWarehouse(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
              >
                حفظ التعديلات
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
