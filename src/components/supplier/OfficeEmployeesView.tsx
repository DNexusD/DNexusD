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
  Ban,
  CheckCircle2,
  AlertCircle,
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
  isEmployeeActive,
  normalizeEmployeePermissions,
} from '../../utils/employeePermissions';

interface OfficeEmployeesViewProps {
  employees?: OfficeEmployee[];
}

type ViewMode = 'panel' | 'matrix' | 'cards';
type StatusFilter = 'all' | 'active' | 'suspended';

const HIGHLIGHT_CAPABILITIES: Array<{
  key: GranularEmployeePermissionKey;
  labelAr: string;
}> = [
  { key: 'canAddServices', labelAr: 'الخدمات' },
  { key: 'canEditServicePrices', labelAr: 'الأسعار' },
  { key: 'canViewReports', labelAr: 'التقارير' },
  { key: 'canManageEmployees', labelAr: 'الموظفون' },
];

export const OfficeEmployeesView: React.FC<OfficeEmployeesViewProps> = ({ employees = [] }) => {
  const { updateOfficeEmployee, removeOfficeEmployee, currentUser } = useApp();

  const [viewMode, setViewMode] = useState<ViewMode>('panel');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedEmpId, setSelectedEmpId] = useState<string>(() => employees[0]?.id || '');
  const [draftPerms, setDraftPerms] = useState<Required<EmployeePermissions>>(() =>
    normalizeEmployeePermissions(employees[0]?.permissions)
  );
  const [saveStatusMsg, setSaveStatusMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<OfficeEmployee | null>(null);

  const stats = useMemo(() => {
    let activeCount = 0;
    let suspendedCount = 0;
    let catalogOrPricingCount = 0;
    let reportsOrFinanceCount = 0;

    for (const emp of employees) {
      const active = isEmployeeActive(emp);
      if (active) activeCount += 1;
      else suspendedCount += 1;

      const norm = normalizeEmployeePermissions(emp.permissions);
      if (active && (norm.canAddServices || norm.canEditServicePrices || norm.canAddCatalogs)) {
        catalogOrPricingCount += 1;
      }
      if (active && (norm.canViewReports || norm.canReviewCashDeposits || norm.canReviewLoanDeposits)) {
        reportsOrFinanceCount += 1;
      }
    }

    return {
      total: employees.length,
      activeCount,
      suspendedCount,
      catalogOrPricingCount,
      reportsOrFinanceCount,
    };
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return employees.filter((emp) => {
      const active = isEmployeeActive(emp);
      if (statusFilter === 'active' && !active) return false;
      if (statusFilter === 'suspended' && active) return false;
      if (!q) return true;
      return (
        emp.name.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q) ||
        (emp.roleTitle || '').toLowerCase().includes(q) ||
        (emp.phone || '').toLowerCase().includes(q)
      );
    });
  }, [employees, searchQuery, statusFilter]);

  const selectedEmployee = useMemo(
    () =>
      filteredEmployees.find((e) => e.id === selectedEmpId) ||
      employees.find((e) => e.id === selectedEmpId) ||
      filteredEmployees[0] ||
      employees[0] ||
      null,
    [employees, filteredEmployees, selectedEmpId]
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

  const handleSelectEmployee = (empId: string) => {
    setSelectedEmpId(empId);
    setSaveStatusMsg(null);
  };

  const handleToggleDraftPerm = (key: GranularEmployeePermissionKey) => {
    setSaveStatusMsg(null);
    setDraftPerms((prev) =>
      normalizeEmployeePermissions({
        ...prev,
        [key]: !prev[key],
      })
    );
  };

  const handleApplyPreset = (presetPerms: Partial<EmployeePermissions>) => {
    setSaveStatusMsg(null);
    setDraftPerms(normalizeEmployeePermissions(presetPerms));
  };

  const handleSelectAllDraft = () => {
    setSaveStatusMsg(null);
    setDraftPerms({ ...FULL_OWNER_EMPLOYEE_PERMISSIONS });
  };

  const handleClearAllDraft = () => {
    setSaveStatusMsg(null);
    setDraftPerms({ ...EMPTY_EMPLOYEE_PERMISSIONS });
  };

  const handleResetDraft = () => {
    setSaveStatusMsg(null);
    setDraftPerms(savedSelectedPerms);
  };

  const handleSaveSelectedPermissions = async () => {
    if (!selectedEmployee) return;
    const res = await updateOfficeEmployee(selectedEmployee.id, { permissions: draftPerms });
    if (!res.success) {
      setSaveStatusMsg({
        type: 'error',
        text: res.error || 'تعذر حفظ صلاحيات الموظف.',
      });
      return;
    }
    setSaveStatusMsg({
      type: 'success',
      text: `تم حفظ وتطبيق الصلاحيات الجديدة على حساب (${selectedEmployee.name}) فوراً.`,
    });
  };

  const handleQuickMatrixToggle = async (emp: OfficeEmployee, key: GranularEmployeePermissionKey) => {
    const current = normalizeEmployeePermissions(emp.permissions);
    const next = normalizeEmployeePermissions({
      ...current,
      [key]: !current[key],
    });
    const res = await updateOfficeEmployee(emp.id, { permissions: next });
    if (!res.success) {
      setSaveStatusMsg({
        type: 'error',
        text: res.error || 'تعذر تعديل هذه الصلاحية.',
      });
    } else {
      setSaveStatusMsg(null);
    }
  };

  const handleToggleEmployeeActive = async (emp: OfficeEmployee) => {
    if (currentUser?.employeeId === emp.id) return;
    const currentlyActive = isEmployeeActive(emp);
    const res = await updateOfficeEmployee(emp.id, { isActive: !currentlyActive });
    if (!res.success) {
      setSaveStatusMsg({
        type: 'error',
        text: res.error || 'تعذر تحديث حالة حساب الموظف.',
      });
      return;
    }
    if (selectedEmployee?.id === emp.id) {
      setSaveStatusMsg({
        type: 'success',
        text: currentlyActive
          ? `تم إيقاف دخول الموظف (${emp.name}) مؤقتاً ومنعه من الوصول للوحة المتجر.`
          : `تم إعادة تفعيل حساب الموظف (${emp.name}) بالسماح له بالدخول حسب صلاحياته.`,
      });
    }
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
            <span>لوحة تحكم الموظفين والصلاحيات</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="tabular-nums">إجمالي الموظفين: {stats.total}</span>
            <span aria-hidden="true">·</span>
            <span>تحديد المسموح والممنوع بدقة (الخدمات، الأسعار، التقارير، الطلبات)</span>
            <span aria-hidden="true">·</span>
            <span>ينعكس مباشرة على دخول وصلاحيات الموظف</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
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

      {/* KPI Strip + Shared Search/Status Toolbar */}
      {employees.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] text-slate-400">إجمالي فريق المكتب</div>
              <div className="text-lg font-bold text-white font-mono tabular-nums mt-0.5">
                {stats.total} موظف
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] text-slate-400">حالة الدخول للمتجر</div>
              <div className="flex items-center gap-2 mt-0.5 font-mono tabular-nums text-sm font-bold">
                <span className="text-emerald-400">{stats.activeCount} نشط</span>
                <span className="text-slate-700">/</span>
                <span className={stats.suspendedCount > 0 ? 'text-rose-400' : 'text-slate-500'}>
                  {stats.suspendedCount} موقوف
                </span>
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] text-slate-400">مفوَّضو الخدمات والأسعار</div>
              <div className="text-lg font-bold text-purple-300 font-mono tabular-nums mt-0.5">
                {stats.catalogOrPricingCount} موظف
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] text-slate-400">مفوَّضو التقارير والمالية</div>
              <div className="text-lg font-bold text-cyan-300 font-mono tabular-nums mt-0.5">
                {stats.reportsOrFinanceCount} موظف
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم الموظف، البريد الإلكتروني، الهاتف، أو المسمى الوظيفي..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pr-8 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(
                [
                  { id: 'all', label: `الكل (${stats.total})` },
                  { id: 'active', label: `النشطون (${stats.activeCount})` },
                  { id: 'suspended', label: `الموقوفون (${stats.suspendedCount})` },
                ] as Array<{ id: StatusFilter; label: string }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                    statusFilter === tab.id
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {employees.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <UserCheck className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-white text-sm">لا يوجد موظفون مضافون حالياً</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            أضف موظفاً جديداً وحدد صلاحياته بدقة (مثل السماح أو المنع من إضافة الخدمات، تعديل الأسعار، عرض التقارير، أو تنفيذ الطلبات) ليتمكن من الدخول ببريده وكلمة مروره والعمل ضمن النطاق المفوَّض له فقط.
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
        <div className="grid grid-cols-1 lg:grid-cols-[310px_1fr] gap-5 items-stretch">
          {/* Employee Selector Sidebar */}
          <aside className="rounded-2xl bg-slate-900 border border-slate-800 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs">
              <span className="font-bold text-white">قائمة الموظفين</span>
              <span className="font-mono tabular-nums text-slate-400">
                {filteredEmployees.length} / {employees.length}
              </span>
            </div>

            <div className="divide-y divide-slate-800/80 overflow-y-auto max-h-[640px]">
              {filteredEmployees.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  لا يوجد موظف مطابق لخيارات البحث أو التصفية.
                </div>
              ) : (
                filteredEmployees.map((emp) => {
                  const norm = normalizeEmployeePermissions(emp.permissions);
                  const count = countActiveEmployeePermissions(norm);
                  const active = isEmployeeActive(emp);
                  const isSelected = selectedEmployee?.id === emp.id;

                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => handleSelectEmployee(emp.id)}
                      className={`w-full text-right p-3.5 transition-colors flex flex-col gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-slate-800/90 text-white'
                          : 'hover:bg-slate-950/60 text-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5 w-full">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                              !active
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : isSelected
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : 'bg-slate-950 text-amber-400 border-slate-800'
                            }`}
                          >
                            {emp.name.charAt(0)}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-white truncate">{emp.name}</span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold shrink-0 ${
                                  active
                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                }`}
                              >
                                {active ? 'نشط' : 'موقوف'}
                              </span>
                            </div>
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
                      </div>

                      <div className="flex flex-wrap items-center gap-1 pr-11">
                        {HIGHLIGHT_CAPABILITIES.map((cap) => (
                          <span
                            key={cap.key}
                            className={`px-1.5 py-0.5 rounded text-[9.5px] font-medium border ${
                              norm[cap.key]
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                                : 'bg-slate-950/60 text-slate-500 border-slate-800'
                            }`}
                          >
                            {cap.labelAr}: {norm[cap.key] ? 'مسموح' : 'ممنوع'}
                          </span>
                        ))}
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
                <div className="p-5 border-b border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-white">{selectedEmployee.name}</h3>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span className="text-xs font-medium text-amber-400">
                        {selectedEmployee.roleTitle}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold border ${
                          isEmployeeActive(selectedEmployee)
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {isEmployeeActive(selectedEmployee)
                          ? 'الحساب نشط (مسموح بالدخول)'
                          : 'الحساب موقوف (ممنوع من الدخول)'}
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

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleEmployeeActive(selectedEmployee)}
                      disabled={currentUser?.employeeId === selectedEmployee.id}
                      title={
                        currentUser?.employeeId === selectedEmployee.id
                          ? 'لا يمكنك إيقاف حسابك أثناء تسجيل الدخول'
                          : isEmployeeActive(selectedEmployee)
                          ? 'إيقاف دخول الموظف مؤقتاً دون حذفه'
                          : 'إعادة تفعيل دخول الموظف'
                      }
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        isEmployeeActive(selectedEmployee)
                          ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {isEmployeeActive(selectedEmployee) ? (
                        <>
                          <Ban className="w-3.5 h-3.5" />
                          <span>إيقاف الحساب</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>تفعيل الحساب</span>
                        </>
                      )}
                    </button>

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
                    <span>الأقسام التي سيراها الموظف عند الدخول:</span>
                  </span>
                  {!isEmployeeActive(selectedEmployee) ? (
                    <span className="text-[11px] font-semibold text-rose-400">
                      ممنوع من الدخول حالياً لأن الحساب موقوف.
                    </span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-200">
                      {allowedTabsPreview.map((item, idx) => (
                        <React.Fragment key={item.tab}>
                          {idx > 0 && <span className="text-slate-600" aria-hidden="true">·</span>}
                          <span className="font-medium text-cyan-300">{item.labelAr}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
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
                                    ? 'bg-slate-950 border-emerald-500/40'
                                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                                }`}
                              >
                                <div className="space-y-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-bold text-xs text-white">
                                      {item.labelAr}
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${
                                        checked
                                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                          : 'bg-rose-500/10 text-rose-300 border-rose-500/25'
                                      }`}
                                    >
                                      {checked ? 'مسموح' : 'ممنوع'}
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
                                    checked ? 'bg-emerald-500 justify-start' : 'bg-slate-800 justify-end'
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
              <div className="px-5 py-4 border-t border-slate-800 bg-slate-950/70 space-y-2.5 text-xs">
                {saveStatusMsg && (
                  <div
                    className={`px-3 py-2 rounded-xl border flex items-center gap-2 ${
                      saveStatusMsg.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {saveStatusMsg.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{saveStatusMsg.text}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-slate-400">
                    {activeDraftCount === 0 && !selectedEmployee.isTransferReceiverOnly ? (
                      <span className="text-rose-400 font-semibold">
                        يجب تفعيل صلاحية واحدة على الأقل قبل الحفظ (أو استخدام زر إيقاف الحساب أعلاه).
                      </span>
                    ) : hasUnsavedChanges ? (
                      <span className="text-amber-300 font-semibold">
                        توجد تعديلات غير محفوظة على صلاحيات {selectedEmployee.name}.
                      </span>
                    ) : (
                      <span>الصلاحيات الحالية متزامنة ومطبقة على حساب الموظف ونظام المصادقة.</span>
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
                انقر على أي خلية للسماح أو المنع فوراً لهذا الموظف، أو بدّل حالة الحساب بين نشط وموقوف.
              </p>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-slate-400">
              {filteredEmployees.length} موظف × {EMPLOYEE_PERMISSION_BADGES.length} صلاحية
            </span>
          </div>

          {filteredEmployees.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              لا يوجد موظف مطابق لخيارات البحث أو التصفية.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead className="bg-slate-950 border-b border-slate-800 text-slate-300">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap sticky right-0 bg-slate-950 z-10 border-l border-slate-800">
                      الموظف
                    </th>
                    <th className="py-2.5 px-2 text-center font-semibold whitespace-nowrap text-[11px]">
                      الحالة
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
                  {filteredEmployees.map((emp) => {
                    const norm = normalizeEmployeePermissions(emp.permissions);
                    const active = isEmployeeActive(emp);
                    return (
                      <tr key={emp.id} className="hover:bg-slate-950/50 transition-colors">
                        <td className="py-2.5 px-3 sticky right-0 bg-slate-900 border-l border-slate-800 z-10 whitespace-nowrap">
                          <div className="font-bold text-white text-xs">{emp.name}</div>
                          <div className="text-[10.5px] text-slate-400">{emp.roleTitle}</div>
                        </td>
                        <td className="py-2 px-2 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleToggleEmployeeActive(emp)}
                            disabled={currentUser?.employeeId === emp.id}
                            className={`px-2 py-1 rounded-lg text-[10.5px] font-bold border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              active
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                                : 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25'
                            }`}
                          >
                            {active ? 'نشط' : 'موقوف'}
                          </button>
                        </td>
                        {EMPLOYEE_PERMISSION_BADGES.map((perm) => {
                          const enabled = norm[perm.key];
                          return (
                            <td key={perm.key} className="py-2 px-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleQuickMatrixToggle(emp, perm.key)}
                                title={`${perm.labelAr}: ${enabled ? 'مسموح' : 'ممنوع'}`}
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
                              handleSelectEmployee(emp.id);
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
          )}
        </div>
      ) : (
        /* MODE 3: EMPLOYEES DIRECTORY CARDS */
        filteredEmployees.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-900 rounded-2xl border border-slate-800">
            لا يوجد موظف مطابق لخيارات البحث أو التصفية.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredEmployees.map((emp) => {
              const normalized = normalizeEmployeePermissions(emp.permissions);
              const granted = EMPLOYEE_PERMISSION_BADGES.filter((item) => normalized[item.key]);
              const active = isEmployeeActive(emp);

              return (
                <div
                  key={emp.id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl border flex items-center justify-center font-bold text-sm shrink-0 ${
                            active
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-white">{emp.name}</h3>
                            <span
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                                active
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              }`}
                            >
                              {active ? 'نشط' : 'موقوف'}
                            </span>
                          </div>
                          <span className="text-[11px] text-amber-300 font-medium">{emp.roleTitle}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectEmployee(emp.id);
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

                    <div className="flex flex-wrap items-center gap-1.5">
                      {HIGHLIGHT_CAPABILITIES.map((cap) => (
                        <span
                          key={cap.key}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${
                            normalized[cap.key]
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                              : 'bg-slate-950 text-slate-500 border-slate-800'
                          }`}
                        >
                          {cap.labelAr}: {normalized[cap.key] ? 'مسموح' : 'ممنوع'}
                        </span>
                      ))}
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

                  <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span className="font-mono tabular-nums">تاريخ التعيين: {emp.createdAt}</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggleEmployeeActive(emp)}
                        disabled={currentUser?.employeeId === emp.id}
                        className={`font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          active ? 'text-rose-400 hover:text-rose-300' : 'text-emerald-400 hover:text-emerald-300'
                        }`}
                      >
                        {active ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span>{active ? 'إيقاف الحساب' : 'تفعيل الحساب'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingEmployee(emp)}
                        className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>تعديل البيانات</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
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
