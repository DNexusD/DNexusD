import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { EmployeePermissions, OfficeEmployee } from '../../types';
import {
  UserCheck,
  Mail,
  Phone,
  Trash2,
  PlusCircle,
  Edit3,
  KeyRound,
  Shield,
  Search,
  Check,
  RotateCcw,
  SlidersHorizontal,
  Table2,
  LayoutGrid,
  Eye,
  Gamepad2,
  HandCoins,
  Layers,
  Users,
} from 'lucide-react';
import { AddOfficeEmployeeModal } from './AddOfficeEmployeeModal';
import { EditOfficeEmployeeModal } from './EditOfficeEmployeeModal';
import {
  EMPLOYEE_PERMISSION_BADGES,
  EMPLOYEE_PERMISSION_CATEGORIES,
  EMPLOYEE_PERMISSION_PRESETS,
  FULL_OWNER_EMPLOYEE_PERMISSIONS,
  EMPTY_EMPLOYEE_PERMISSIONS,
  GranularEmployeePermissionKey,
  countActiveEmployeePermissions,
  getAllowedTabsSummaryForPermissions,
  normalizeEmployeePermissions,
} from '../../utils/employeePermissions';

interface OfficeEmployeesViewProps {
  employees?: OfficeEmployee[];
}

type ViewMode = 'panel' | 'matrix' | 'cards';

export const OfficeEmployeesView: React.FC<OfficeEmployeesViewProps> = ({ employees = [] }) => {
  const { updateOfficeEmployee, removeOfficeEmployee, currentUser } = useApp();

  const [viewMode, setViewMode] = useState<ViewMode>('panel');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState<string>(() => employees[0]?.id || '');
  const [draftPerms, setDraftPerms] = useState<Required<EmployeePermissions>>(() =>
    normalizeEmployeePermissions(employees[0]?.permissions)
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<OfficeEmployee | null>(null);

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q) ||
        (emp.roleTitle || '').toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmpId) || employees[0] || null,
    [employees, selectedEmpId]
  );

  useEffect(() => {
    if (!selectedEmployee) {
      setSelectedEmpId('');
      setDraftPerms({ ...EMPTY_EMPLOYEE_PERMISSIONS });
      return;
    }
    if (selectedEmployee.id !== selectedEmpId) {
      setSelectedEmpId(selectedEmployee.id);
    }
    setDraftPerms(normalizeEmployeePermissions(selectedEmployee.permissions));
  }, [selectedEmployee, selectedEmpId]);

  const savedSelectedPerms = useMemo(
    () => normalizeEmployeePermissions(selectedEmployee?.permissions),
    [selectedEmployee]
  );

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedEmployee) return false;
    return EMPLOYEE_PERMISSION_BADGES.some(
      (item) => draftPerms[item.key] !== savedSelectedPerms[item.key]
    );
  }, [selectedEmployee, draftPerms, savedSelectedPerms]);

  const activeDraftCount = useMemo(
    () => countActiveEmployeePermissions(draftPerms),
    [draftPerms]
  );

  const allowedTabsPreview = useMemo(
    () => getAllowedTabsSummaryForPermissions(draftPerms),
    [draftPerms]
  );

  const handleToggleDraftPerm = (key: GranularEmployeePermissionKey) => {
    setDraftPerms((prev) =>
      normalizeEmployeePermissions({
        ...prev,
        [key]: !prev[key],
      })
    );
  };

  const handleApplyPreset = (presetPerms: Partial<EmployeePermissions>) => {
    setDraftPerms(normalizeEmployeePermissions(presetPerms));
  };

  const handleSelectAllDraft = () => {
    setDraftPerms({ ...FULL_OWNER_EMPLOYEE_PERMISSIONS });
  };

  const handleClearAllDraft = () => {
    setDraftPerms({ ...EMPTY_EMPLOYEE_PERMISSIONS });
  };

  const handleResetDraft = () => {
    setDraftPerms(savedSelectedPerms);
  };

  const handleSaveSelectedPermissions = () => {
    if (!selectedEmployee) return;
    updateOfficeEmployee(selectedEmployee.id, { permissions: draftPerms });
  };

  const handleQuickMatrixToggle = (emp: OfficeEmployee, key: GranularEmployeePermissionKey) => {
    const current = normalizeEmployeePermissions(emp.permissions);
    const next = normalizeEmployeePermissions({
      ...current,
      [key]: !current[key],
    });
    updateOfficeEmployee(emp.id, { permissions: next });
  };

  const getCategoryIcon = (id: string) => {
    if (id === 'orders') return <Gamepad2 className="w-4 h-4 text-amber-400 shrink-0" />;
    if (id === 'finance') return <HandCoins className="w-4 h-4 text-cyan-400 shrink-0" />;
    if (id === 'catalogs') return <Layers className="w-4 h-4 text-purple-400 shrink-0" />;
    return <Users className="w-4 h-4 text-emerald-400 shrink-0" />;
  };

  return (
    <div className="space-y-5">
      {/* Control Panel Header */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400 shrink-0" />
            <span>لوحة تحكم صلاحيات الموظفين</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="tabular-nums">إجمالي الموظفين: {employees.length}</span>
            <span aria-hidden="true">·</span>
            <span>تحكم دقيق بصلاحيات الخدمات والأسعار والتقارير والطلبات</span>
            <span aria-hidden="true">·</span>
            <span>تطبيق فوري على واجهة الموظف</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Mode Switcher */}
          {employees.length > 0 && (
            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setViewMode('panel')}
                className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'panel'
                    ? 'bg-slate-800 text-amber-400 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                <span>لوحة الصلاحيات</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('matrix')}
                className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'matrix'
                    ? 'bg-slate-800 text-amber-400 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Table2 className="w-3.5 h-3.5 shrink-0" />
                <span>مصفوفة شاملة</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-slate-800 text-amber-400 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                <span>البطاقات</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span>إضافة موظف جديد</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {employees.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <UserCheck className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-white text-sm">لا يوجد موظفون مضافون حالياً</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            أضف موظفاً جديداً وحدد صلاحياته بدقة (مثل إضافة خدمة، تعديل الأسعار، عرض التقارير، أو تنفيذ الطلبات) ليتمكن من الدخول ببريده وكلمة مروره والعمل ضمن النطاق المفوَّض له فقط.
          </p>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="mt-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
          >
            إضافة أول موظف وتعيين صلاحياته
          </button>
        </div>
      ) : viewMode === 'panel' ? (
        /* MODE 1: INTERACTIVE GRANULAR PERMISSIONS CONTROL PANEL */
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-stretch">
          {/* Employee Selector Sidebar */}
          <aside className="rounded-2xl bg-slate-900 border border-slate-800 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">اختر الموظف</span>
                <span className="font-mono tabular-nums text-slate-400">
                  {filteredEmployees.length} / {employees.length}
                </span>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم أو البريد..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pr-8 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="divide-y divide-slate-800/80 overflow-y-auto max-h-[580px]">
              {filteredEmployees.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  لا يوجد موظف مطابق لبحثك.
                </div>
              ) : (
                filteredEmployees.map((emp) => {
                  const norm = normalizeEmployeePermissions(emp.permissions);
                  const count = countActiveEmployeePermissions(norm);
                  const isSelected = selectedEmployee?.id === emp.id;

                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => setSelectedEmpId(emp.id)}
                      className={`w-full text-right p-3.5 transition-colors flex items-start justify-between gap-2.5 cursor-pointer ${
                        isSelected
                          ? 'bg-slate-800/90 text-white'
                          : 'hover:bg-slate-950/60 text-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-slate-950 text-amber-400 border-slate-800'
                          }`}
                        >
                          {emp.name.charAt(0)}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="font-bold text-xs text-white truncate">{emp.name}</div>
                          <div className="text-[11px] text-slate-400 truncate">{emp.roleTitle}</div>
                          <div className="text-[10.5px] font-mono text-slate-500 truncate" dir="ltr">
                            {emp.email}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-left">
                        <span
                          className={`font-mono tabular-nums text-[11px] font-semibold ${
                            isSelected ? 'text-amber-400' : 'text-slate-400'
                          }`}
                        >
                          {count}/{EMPLOYEE_PERMISSION_BADGES.length}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Main Permission Configuration Workspace */}
          {selectedEmployee && (
            <div className="rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between overflow-hidden">
              <div>
                {/* Selected Employee Top Summary Bar */}
                <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-white">{selectedEmployee.name}</h3>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span className="text-xs font-medium text-amber-400">
                        {selectedEmployee.roleTitle}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="font-mono text-[11px]" dir="ltr">{selectedEmployee.email}</span>
                      {selectedEmployee.phone && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-[11px]" dir="ltr">{selectedEmployee.phone}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums text-slate-300">
                        الصلاحيات المفعلة: {activeDraftCount} من {EMPLOYEE_PERMISSION_BADGES.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingEmployee(selectedEmployee)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                      <span>بيانات الدخول وكلمة المرور</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => removeOfficeEmployee(selectedEmployee.id)}
                      disabled={currentUser?.employeeId === selectedEmployee.id}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      title={
                        currentUser?.employeeId === selectedEmployee.id
                          ? 'لا يمكنك حذف حسابك أثناء تسجيل الدخول'
                          : 'حذف الموظف'
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Quick Role Presets & Bulk Actions */}
                <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/50 flex flex-col xl:flex-row xl:items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-400 ml-1">
                      قوالب التفويض السريعة:
                    </span>
                    {EMPLOYEE_PERMISSION_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleApplyPreset(preset.permissions)}
                        title={preset.descriptionAr}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-amber-300 border border-slate-800 hover:border-amber-500/40 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {preset.labelAr}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-[11px]">
                    <button
                      type="button"
                      onClick={handleSelectAllDraft}
                      className="text-emerald-400 hover:text-emerald-300 font-semibold whitespace-nowrap cursor-pointer"
                    >
                      تحديد الكل
                    </button>
                    <span className="text-slate-700">|</span>
                    <button
                      type="button"
                      onClick={handleClearAllDraft}
                      className="text-slate-400 hover:text-rose-400 font-semibold whitespace-nowrap cursor-pointer"
                    >
                      إلغاء الكل
                    </button>
                  </div>
                </div>

                {/* Delegated Access Visibility Preview */}
                <div className="px-5 py-3 border-b border-slate-800 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1.5 shrink-0">
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    <span>الأقسام التي سيراها الموظف في واجهته:</span>
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-200">
                    {allowedTabsPreview.map((item, idx) => (
                      <React.Fragment key={item.tab}>
                        {idx > 0 && <span className="text-slate-600" aria-hidden="true">·</span>}
                        <span className="font-medium text-cyan-300">{item.labelAr}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Granular Permission Categories */}
                <div className="p-5 space-y-6">
                  {EMPLOYEE_PERMISSION_CATEGORIES.map((category) => {
                    const enabledInCat = category.items.filter((i) => draftPerms[i.key]).length;
                    return (
                      <section key={category.id} className="space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-white">
                            {getCategoryIcon(category.id)}
                            <span>{category.titleAr}</span>
                          </div>
                          <span className="text-[11px] font-mono tabular-nums text-slate-400">
                            {enabledInCat} / {category.items.length}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {category.items.map((item) => {
                            const checked = draftPerms[item.key];
                            return (
                              <button
                                key={item.key}
                                type="button"
                                role="switch"
                                aria-checked={checked}
                                onClick={() => handleToggleDraftPerm(item.key)}
                                className={`text-right p-3 rounded-xl border transition-colors flex items-start justify-between gap-3 cursor-pointer ${
                                  checked
                                    ? 'bg-slate-950 border-amber-500/40'
                                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                                }`}
                              >
                                <div className="space-y-0.5 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs text-white">
                                      {item.labelAr}
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                      {item.scopeNoteAr}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 leading-relaxed">
                                    {item.descriptionAr}
                                  </p>
                                </div>

                                <div
                                  className={`w-10 h-5.5 rounded-full p-0.5 transition-colors shrink-0 mt-0.5 flex items-center ${
                                    checked ? 'bg-amber-500 justify-start' : 'bg-slate-800 justify-end'
                                  }`}
                                >
                                  <span className="w-4.5 h-4.5 rounded-full bg-white shadow-sm block" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>

              {/* Action Footer */}
              <div className="px-5 py-4 border-t border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="text-slate-400">
                  {activeDraftCount === 0 && !selectedEmployee.isTransferReceiverOnly ? (
                    <span className="text-rose-400 font-semibold">
                      يجب تفعيل صلاحية واحدة على الأقل قبل الحفظ.
                    </span>
                  ) : hasUnsavedChanges ? (
                    <span className="text-amber-300 font-semibold">
                      توجد تعديلات غير محفوظة على صلاحيات {selectedEmployee.name}.
                    </span>
                  ) : (
                    <span>الصلاحيات الحالية متزامنة ومطبقة على حساب الموظف.</span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {hasUnsavedChanges && (
                    <button
                      type="button"
                      onClick={handleResetDraft}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>تراجع</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={
                      !hasUnsavedChanges ||
                      (activeDraftCount === 0 && !selectedEmployee.isTransferReceiverOnly)
                    }
                    onClick={handleSaveSelectedPermissions}
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Check className="w-4 h-4" />
                    <span>حفظ وتطبيق الصلاحيات</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : viewMode === 'matrix' ? (
        /* MODE 2: HIGH-DENSITY PERMISSIONS MATRIX TABLE */
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <h3 className="font-bold text-white text-sm">مصفوفة الصلاحيات التفصيلية لكل الموظفين</h3>
              <p className="text-slate-400 text-[11px]">
                انقر على أي خلية لتفعيل أو إلغاء الصلاحية فوراً لهذا الموظف.
              </p>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-slate-400">
              {employees.length} موظف × {EMPLOYEE_PERMISSION_BADGES.length} صلاحية
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-300">
                <tr>
                  <th className="py-2.5 px-3 font-semibold whitespace-nowrap sticky right-0 bg-slate-950 z-10 border-l border-slate-800">
                    الموظف
                  </th>
                  {EMPLOYEE_PERMISSION_BADGES.map((perm) => (
                    <th
                      key={perm.key}
                      className="py-2.5 px-2 text-center font-semibold whitespace-nowrap text-[11px]"
                      title={perm.labelAr}
                    >
                      {perm.shortAr}
                    </th>
                  ))}
                  <th className="py-2.5 px-3 text-center font-semibold whitespace-nowrap">إعداد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {employees.map((emp) => {
                  const norm = normalizeEmployeePermissions(emp.permissions);
                  return (
                    <tr key={emp.id} className="hover:bg-slate-950/50 transition-colors">
                      <td className="py-2.5 px-3 sticky right-0 bg-slate-900 border-l border-slate-800 z-10 whitespace-nowrap">
                        <div className="font-bold text-white text-xs">{emp.name}</div>
                        <div className="text-[10.5px] text-slate-400">{emp.roleTitle}</div>
                      </td>
                      {EMPLOYEE_PERMISSION_BADGES.map((perm) => {
                        const enabled = norm[perm.key];
                        return (
                          <td key={perm.key} className="py-2 px-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleQuickMatrixToggle(emp, perm.key)}
                              title={`${perm.labelAr}: ${enabled ? 'مفعلة' : 'معطلة'}`}
                              className={`w-7 h-7 rounded-lg inline-flex items-center justify-center border transition-colors cursor-pointer ${
                                enabled
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                                  : 'bg-slate-950 text-slate-600 border-slate-800 hover:text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              {enabled ? <Check className="w-3.5 h-3.5" /> : <span className="text-[10px]">—</span>}
                            </button>
                          </td>
                        );
                      })}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEmpId(emp.id);
                            setViewMode('panel');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-[11px] font-semibold cursor-pointer"
                        >
                          تفصيل
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* MODE 3: EMPLOYEES DIRECTORY CARDS */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {employees.map((emp) => {
            const normalized = normalizeEmployeePermissions(emp.permissions);
            const granted = EMPLOYEE_PERMISSION_BADGES.filter((item) => normalized[item.key]);

            return (
              <div
                key={emp.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-sm shrink-0">
                        {emp.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-white">{emp.name}</h3>
                        <span className="text-[11px] text-amber-300 font-medium">{emp.roleTitle}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEmpId(emp.id);
                          setViewMode('panel');
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>الصلاحيات</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingEmployee(emp)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-400 transition-colors border border-slate-700 cursor-pointer"
                        title="تعديل بيانات وكلمة مرور الموظف"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => removeOfficeEmployee(emp.id)}
                        disabled={currentUser?.employeeId === emp.id}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        title={
                          currentUser?.employeeId === emp.id
                            ? 'لا يمكنك حذف حسابك أثناء تسجيل الدخول'
                            : 'حذف الموظف والصلاحيات'
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3 text-slate-500" />
                      <span className="font-mono text-[11px]" dir="ltr">{emp.email}</span>
                    </span>
                    {emp.phone && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span className="font-mono text-[11px]" dir="ltr">{emp.phone}</span>
                        </span>
                      </>
                    )}
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-semibold">الصلاحيات المفوَّضة:</span>
                      <span className="font-mono tabular-nums text-emerald-400">
                        {granted.length} / {EMPLOYEE_PERMISSION_BADGES.length}
                      </span>
                    </div>
                    {granted.length === 0 ? (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <KeyRound className="w-3 h-3" />
                        <span>
                          {emp.isTransferReceiverOnly ? 'استلام الحوالات البنكية فقط' : 'بدون صلاحيات مفعلة'}
                        </span>
                      </div>
                    ) : (
                      <p className="text-[11px] text-emerald-300 leading-relaxed">
                        {granted.map((item) => item.labelAr).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-mono tabular-nums">تاريخ التعيين: {emp.createdAt}</span>
                  <button
                    type="button"
                    onClick={() => setEditingEmployee(emp)}
                    className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>تعديل البيانات وكلمة المرور</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddModal && <AddOfficeEmployeeModal onClose={() => setShowAddModal(false)} />}

      {/* Edit Employee Modal */}
      {editingEmployee && (
        <EditOfficeEmployeeModal
          employee={editingEmployee}
          onClose={() => setEditingEmployee(null)}
        />
      )}
    </div>
  );
};
