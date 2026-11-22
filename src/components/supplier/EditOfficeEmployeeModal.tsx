import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { OfficeEmployee } from '../../types';
import { UserCheck, Shield, Mail, Phone, X, Check, Lock, Gamepad2, HandCoins, Layers, Users, Eye, EyeOff, AlertCircle, Ban, CheckCircle2 } from 'lucide-react';
import {
  EMPLOYEE_PERMISSION_PRESETS,
  isEmployeeActive,
  normalizeEmployeePermissions,
} from '../../utils/employeePermissions';

interface EditOfficeEmployeeModalProps {
  employee: OfficeEmployee;
  onClose: () => void;
}

const PermStatusPill: React.FC<{ allowed: boolean }> = ({ allowed }) => (
  <span
    className={`mr-auto px-1.5 py-0.5 rounded text-[9.5px] font-bold border shrink-0 ${
      allowed
        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
        : 'bg-rose-500/10 text-rose-300 border-rose-500/25'
    }`}
  >
    {allowed ? 'مسموح' : 'ممنوع'}
  </span>
);

export const EditOfficeEmployeeModal: React.FC<EditOfficeEmployeeModalProps> = ({ employee, onClose }) => {
  const { updateOfficeEmployee, currentUser } = useApp();
  const initialPerms = normalizeEmployeePermissions(employee.permissions);
  const isSelf = currentUser?.employeeId === employee.id;

  const [name, setName] = useState(employee.name);
  const [email, setEmail] = useState(employee.email);
  const [password, setPassword] = useState(employee.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState(employee.phone || '');
  const [roleTitle, setRoleTitle] = useState(employee.roleTitle || 'موظف مكتب');
  const [isActive, setIsActive] = useState(isEmployeeActive(employee));
  const [formError, setFormError] = useState<string | null>(null);

  // 1. الشحن ونوعه
  const [canManagePlayerIdOrders, setCanManagePlayerIdOrders] = useState(initialPerms.canManagePlayerIdOrders);
  const [canManageAccountOrders, setCanManageAccountOrders] = useState(initialPerms.canManageAccountOrders);
  const [canManageVoucherOrders, setCanManageVoucherOrders] = useState(initialPerms.canManageVoucherOrders);

  // 2. طلبات الرصيد (حوالة كاش أو سلفة) والحسابات البنكية
  const [canReviewCashDeposits, setCanReviewCashDeposits] = useState(initialPerms.canReviewCashDeposits);
  const [canReviewLoanDeposits, setCanReviewLoanDeposits] = useState(initialPerms.canReviewLoanDeposits);
  const [canManageBankAccounts, setCanManageBankAccounts] = useState(initialPerms.canManageBankAccounts);

  // 3. الكتالوجات والخدمات
  const [canAddCatalogs, setCanAddCatalogs] = useState(initialPerms.canAddCatalogs);
  const [canAddServices, setCanAddServices] = useState(initialPerms.canAddServices);

  // 4. أسعار الخدمات
  const [canEditServicePrices, setCanEditServicePrices] = useState(initialPerms.canEditServicePrices);

  // 5. تغذية الأكواد
  const [canManageVoucherStock, setCanManageVoucherStock] = useState(initialPerms.canManageVoucherStock);

  // 6. الاطلاع على العملاء والتقارير وترقية العملاء
  const [canViewClients, setCanViewClients] = useState(initialPerms.canViewClients);
  const [canUpgradeClientTiers, setCanUpgradeClientTiers] = useState(initialPerms.canUpgradeClientTiers);
  const [canViewReports, setCanViewReports] = useState(initialPerms.canViewReports);

  // 7. إدارة الموظفين
  const [canManageEmployees, setCanManageEmployees] = useState(initialPerms.canManageEmployees);

  const applyPreset = (presetPerms: Parameters<typeof normalizeEmployeePermissions>[0]) => {
    const norm = normalizeEmployeePermissions(presetPerms);
    setCanManagePlayerIdOrders(norm.canManagePlayerIdOrders);
    setCanManageAccountOrders(norm.canManageAccountOrders);
    setCanManageVoucherOrders(norm.canManageVoucherOrders);
    setCanReviewCashDeposits(norm.canReviewCashDeposits);
    setCanReviewLoanDeposits(norm.canReviewLoanDeposits);
    setCanManageBankAccounts(norm.canManageBankAccounts);
    setCanAddCatalogs(norm.canAddCatalogs);
    setCanAddServices(norm.canAddServices);
    setCanEditServicePrices(norm.canEditServicePrices);
    setCanManageVoucherStock(norm.canManageVoucherStock);
    setCanViewClients(norm.canViewClients);
    setCanUpgradeClientTiers(norm.canUpgradeClientTiers);
    setCanViewReports(norm.canViewReports);
    setCanManageEmployees(norm.canManageEmployees);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim() || !email.trim()) {
      setFormError('يرجى إدخال اسم الموظف والبريد الإلكتروني.');
      return;
    }

    const res = updateOfficeEmployee(employee.id, {
      name: name.trim(),
      email: email.trim(),
      ...(password.trim() ? { password: password.trim() } : {}),
      phone: phone.trim(),
      roleTitle: roleTitle.trim() || 'موظف مكتب',
      isActive: isSelf ? true : isActive,
      permissions: {
        canManageOrders: canManagePlayerIdOrders || canManageAccountOrders || canManageVoucherOrders,
        canManagePlayerIdOrders,
        canManageAccountOrders,
        canManageVoucherOrders,

        canReviewDeposits: canReviewCashDeposits || canReviewLoanDeposits,
        canReviewCashDeposits,
        canReviewLoanDeposits,
        canManageBankAccounts,

        canManageCatalogs: canAddCatalogs || canAddServices || canEditServicePrices,
        canAddCatalogs,
        canAddServices,

        canEditServicePrices,
        canManageVoucherStock,

        canManageClients: canViewClients || canUpgradeClientTiers,
        canViewClients,
        canUpgradeClientTiers,
        canViewReports,

        canManageEmployees
      }
    });

    if (!res.success) {
      setFormError(res.error || 'تعذر حفظ التعديلات. تحقق من البيانات والصلاحيات.');
      return;
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 text-slate-100 shadow-2xl space-y-5 my-6 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">تعديل بيانات وصلاحيات الموظف</h3>
              <p className="text-xs text-slate-400">تحديث معلومات الحساب وحالة الدخول والتصاريح التفصيلية الممنوحة للموظف</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">اسم الموظف:</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="اسم الموظف"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">المسمى الوظيفي:</label>
              <input
                type="text"
                value={roleTitle}
                onChange={e => setRoleTitle(e.target.value)}
                placeholder="مثال: مسؤول الشحن والعملاء"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">البريد الإلكتروني:</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="employee@supplier.sa"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white pl-9 focus:outline-none font-mono text-[11px]"
                  dir="ltr"
                />
                <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">كلمة المرور للدخول:</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="اتركها كما هي أو أدخل كلمة جديدة"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white pl-16 focus:outline-none font-mono text-[11px]"
                  dir="ltr"
                />
                <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute left-8 top-2 text-slate-500 hover:text-slate-300 p-0.5"
                  title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">رقم الهاتف:</label>
              <div className="relative">
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+966 5x xxx"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white pl-9 focus:outline-none font-mono text-[11px]"
                  dir="ltr"
                />
                <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              </div>
            </div>
          </div>

          {/* Employee Account Status Toggle */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-bold text-white text-xs">حالة حساب الموظف في المتجر</div>
              <p className="text-[11px] text-slate-400">
                عند الإيقاف المؤقت يتم منع الموظف فوراً من تسجيل الدخول أو تنفيذ أي عمليات مع الاحتفاظ ببياناته.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsActive(true)}
                className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>نشط</span>
              </button>
              <button
                type="button"
                disabled={isSelf}
                onClick={() => setIsActive(false)}
                title={isSelf ? 'لا يمكنك إيقاف حسابك أثناء تسجيل الدخول' : 'إيقاف حساب الموظف مؤقتاً'}
                className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  !isActive
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                <span>موقوف</span>
              </button>
            </div>
          </div>

          {/* Granular Permissions Matrix */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2 font-bold text-amber-400">
                <Shield className="w-4 h-4 text-amber-400" />
                <span>تعديل صلاحيات الموظف الدقيقة (مسموح / ممنوع):</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {EMPLOYEE_PERMISSION_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.permissions)}
                    title={preset.descriptionAr}
                    className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 text-[10.5px] font-medium transition-colors cursor-pointer"
                  >
                    {preset.labelAr}
                  </button>
                ))}
              </div>
            </div>

            {/* 1. إدارة الشحن وأنواعه */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Gamepad2 className="w-3.5 h-3.5 text-amber-400" />
                <span>1. إدارة الشحن والطلبات (حسب نوع الشحن):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={canManagePlayerIdOrders}
                    onChange={e => setCanManagePlayerIdOrders(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-white block text-[11px]">شحن عبر الأيدي</span>
                    <span className="text-[9.5px] text-slate-400">تنفيذ طلبات الأيدي باللعبة</span>
                  </div>
                  <PermStatusPill allowed={canManagePlayerIdOrders} />
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={canManageAccountOrders}
                    onChange={e => setCanManageAccountOrders(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-white block text-[11px]">شحن عبر الحساب</span>
                    <span className="text-[9.5px] text-slate-400">استلام إيميل/رمز الحساب</span>
                  </div>
                  <PermStatusPill allowed={canManageAccountOrders} />
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={canManageVoucherOrders}
                    onChange={e => setCanManageVoucherOrders(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-white block text-[11px]">شحن كود قسيمة</span>
                    <span className="text-[9.5px] text-slate-400">متابعة تسليم كود الفوتشر</span>
                  </div>
                  <PermStatusPill allowed={canManageVoucherOrders} />
                </label>
              </div>
            </div>

            {/* 2. إدارة طلبات الرصيد (كاش / سلفة) */}
            <div className="space-y-2 pt-1 border-t border-slate-800/60">
              <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <HandCoins className="w-3.5 h-3.5 text-cyan-400" />
                <span>2. إدارة طلبات الرصيد والمحافظ (حسب نوع الطلب):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={canReviewCashDeposits}
                    onChange={e => setCanReviewCashDeposits(e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-500 bg-slate-950 border-slate-700 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-white block text-[11px]">طلبات الحوالات والكاش</span>
                    <span className="text-[9.5px] text-slate-400">اعتماد الإيداعات المباشرة</span>
                  </div>
                  <PermStatusPill allowed={canReviewCashDeposits} />
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={canReviewLoanDeposits}
                    onChange={e => setCanReviewLoanDeposits(e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-500 bg-slate-950 border-slate-700 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-white block text-[11px]">طلبات السُّلَف / الرصيد الآجل</span>
                    <span className="text-[9.5px] text-slate-400">مراجعة واعتماد السلفة</span>
                  </div>
                  <PermStatusPill allowed={canReviewLoanDeposits} />
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={canManageBankAccounts}
                    onChange={e => setCanManageBankAccounts(e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-500 bg-slate-950 border-slate-700 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-white block text-[11px]">إدارة الحسابات البنكية</span>
                    <span className="text-[9.5px] text-slate-400">إضافة الحسابات والاستلام</span>
                  </div>
                  <PermStatusPill allowed={canManageBankAccounts} />
                </label>
              </div>
            </div>

            {/* 3 & 4. الكتالوجات والخدمات وتحديد الأسعار وتغذية الأكواد */}
            <div className="space-y-2 pt-1 border-t border-slate-800/60">
              <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                <span>3. الكتالوجات والخدمات وتحديد الأسعار وتغذية الأكواد:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={canAddCatalogs}
                    onChange={e => setCanAddCatalogs(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-500 bg-slate-950 border-slate-700 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-white block text-[11px]">إضافة وتعديل الكتالوجات</span>
                    <span className="text-[9.5px] text-slate-400">إنشاء وتسمية الكتالوجات الجديدة</span>
                  </div>
                  <PermStatusPill allowed={canAddCatalogs} />
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={canAddServices}
                    onChange={e => setCanAddServices(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-500 bg-slate-950 border-slate-700 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-white block text-[11px]">إضافة وتعديل الخدمات والباقات</span>
                    <span className="text-[9.5px] text-slate-400">إضافة وتعديل وحذف الألعاب والخدمات</span>
                  </div>
                  <PermStatusPill allowed={canAddServices} />
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={canEditServicePrices}
                    onChange={e => setCanEditServicePrices(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-500 bg-slate-950 border-slate-700 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-white block text-[11px]">تحديد وتعديل أسعار الخدمات</span>
                    <span className="text-[9.5px] text-slate-400">ضبط أسعار الباقات والرتب الطبقية</span>
                  </div>
                  <PermStatusPill allowed={canEditServicePrices} />
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={canManageVoucherStock}
                    onChange={e => setCanManageVoucherStock(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-500 bg-slate-950 border-slate-700 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-white block text-[11px]">تغذية أكواد القسائم (الفوتشر)</span>
                    <span className="text-[9.5px] text-slate-400">إيداع أكواد جديدة بالمخزون</span>
                  </div>
                  <PermStatusPill allowed={canManageVoucherStock} />
                </label>
              </div>
            </div>

            {/* 6 & 7. العملاء والتقارير والترقية وإدارة الموظفين */}
            <div className="space-y-2 pt-1 border-t border-slate-800/60">
              <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>4. إدارة العملاء والتقارير وإدارة الموظفين:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={canViewClients}
                    onChange={e => setCanViewClients(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-700 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-white block text-[11px]">الاطلاع على العملاء</span>
                    <span className="text-[9.5px] text-slate-400">استعراض قائمة نقاط البيع</span>
                  </div>
                  <PermStatusPill allowed={canViewClients} />
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={canUpgradeClientTiers}
                    onChange={e => setCanUpgradeClientTiers(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-700 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-white block text-[11px]">ترقية رتب العملاء</span>
                    <span className="text-[9.5px] text-slate-400">تغيير رتبة العميل والميزات</span>
                  </div>
                  <PermStatusPill allowed={canUpgradeClientTiers} />
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={canViewReports}
                    onChange={e => setCanViewReports(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-700 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-white block text-[11px]">عرض التقارير وكشف الحسابات</span>
                    <span className="text-[9.5px] text-slate-400">عرض تقارير العمليات وتصدير PDF</span>
                  </div>
                  <PermStatusPill allowed={canViewReports} />
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={canManageEmployees}
                    onChange={e => setCanManageEmployees(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-700 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-white block text-[11px]">إدارة الموظفين والصلاحيات</span>
                    <span className="text-[9.5px] text-slate-400">إضافة وتعديل صلاحيات الموظفين</span>
                  </div>
                  <PermStatusPill allowed={canManageEmployees} />
                </label>
              </div>
            </div>

          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500 font-mono">
              معرّف الموظف: {employee.id}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-md shadow-amber-500/20 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>حفظ التعديلات</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
