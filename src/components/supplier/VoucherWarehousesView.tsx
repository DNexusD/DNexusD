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
  X
} from 'lucide-react';

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
  const [editPrices, setEditPrices] = useState({
    regular: 100,
    bronze: 90,
    silver: 80,
    gold: 70,
    vip: 60
  });

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

  const totalAvailableCodes = useMemo(
    () => supplierWarehouses.reduce((sum, w) => sum + w.codes.length, 0),
    [supplierWarehouses]
  );
  const totalUsedCodes = useMemo(
    () => supplierWarehouses.reduce((sum, w) => sum + (w.usedCodesCount || 0), 0),
    [supplierWarehouses]
  );
  const publishedCount = useMemo(
    () => supplierWarehouses.filter((w) => w.isPublishedAsService).length,
    [supplierWarehouses]
  );

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

    createVoucherWarehouse({
      nameAr: newName,
      categoryName: newCategory,
      catalogId: publishCatalogId || supplierCatalogs[0]?.id,
      description: newDescription,
      rawCodes: newRawCodes,
      tierPrices: {
        regular: priceRegular,
        bronze: priceBronze,
        silver: priceSilver,
        gold: priceGold,
        vip: priceVip
      },
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
    setEditPrices({ ...wh.tierPrices });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWarehouse || !editName.trim() || !editCategory.trim()) return;
    updateVoucherWarehouse(editingWarehouse.id, {
      nameAr: editName.trim(),
      categoryName: editCategory.trim(),
      tierPrices: editPrices
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
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Archive className="w-5 h-5 text-amber-400" />
            <span>مخازن الأكواد والقسائم بحسب الفئة</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            أنشئ مخازن للأكواد مصنفة بالفئات، قم بتعبئتها بالأكواد، واعرضها كخدمات للعملاء مع خصم تلقائي من المخزون عند الشراء.
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-slate-400 block text-[11px]">مخازن الأكواد</span>
          <div className="text-xl font-bold font-mono text-white">
            {supplierWarehouses.length}
          </div>
          <span className="text-[10px] text-slate-500">{categories.length} فئات</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-amber-500/30 space-y-1">
          <span className="text-amber-300 block text-[11px]">إجمالي الأكواد المتاحة</span>
          <div className="text-xl font-bold font-mono text-amber-400">
            {totalAvailableCodes}
          </div>
          <span className="text-[10px] text-slate-500">جاهزة للتسليم الفوري</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-emerald-500/30 space-y-1">
          <span className="text-emerald-300 block text-[11px]">مخازن معروضة كخدمات</span>
          <div className="text-xl font-bold font-mono text-emerald-400">
            {publishedCount}
          </div>
          <span className="text-[10px] text-slate-500">ظاهرة بمتجر العملاء</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-slate-400 block text-[11px]">أكواد تم بيعها/صرفها</span>
          <div className="text-xl font-bold font-mono text-cyan-400">
            {totalUsedCodes}
          </div>
          <span className="text-[10px] text-slate-500">مخصومة من المخزون</span>
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

          {/* 5-tier pricing */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
            <span className="block text-[11px] font-bold text-amber-400">
              تسعير فئة المخزن حسب رتب العملاء (ر.س):
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
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 text-center font-mono font-bold text-white text-xs"
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
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 text-center font-mono font-bold text-amber-400 text-xs"
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
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 text-center font-mono font-bold text-slate-200 text-xs"
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
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 text-center font-mono font-bold text-yellow-300 text-xs"
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
                  className="w-full bg-slate-900 border border-purple-500/50 rounded-lg py-1.5 text-center font-mono font-bold text-purple-300 text-xs"
                />
              </div>
            </div>
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
            const isRefilling = refillingWarehouseId === wh.id;
            const isExpanded = expandedWarehouseId === wh.id;

            return (
              <div
                key={wh.id}
                className={`p-4 sm:p-5 rounded-3xl bg-slate-900 border space-y-3.5 text-xs transition-colors ${
                  isOutOfStock
                    ? 'border-rose-500/40'
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
                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                        : 'bg-slate-950 border-amber-500/30 text-amber-400'
                    }`}
                  >
                    <div className="text-lg font-black font-mono leading-none">
                      {wh.codes.length}
                    </div>
                    <div className="text-[10px] mt-1 font-semibold">
                      {isOutOfStock ? 'نفد المخزون' : 'كود متاح'}
                    </div>
                  </div>
                </div>

                {/* Pricing strip */}
                <div className="grid grid-cols-5 gap-1.5 text-center p-2 rounded-xl bg-slate-950 border border-slate-800/80 text-[10px]">
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 text-center font-mono font-bold text-white text-xs"
                  />
                </div>
              ))}
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
