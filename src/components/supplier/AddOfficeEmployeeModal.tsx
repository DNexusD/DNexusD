import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  EMPLOYEE_PERMISSION_PRESETS,
  normalizeEmployeePermissions,
} from '../../utils/employeePermissions';
import { UserCheck, Shield, Mail, Phone, X, Check, Lock, Gamepad2, HandCoins, Layers, Users, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface AddOfficeEmployeeModalProps {
  onClose: () => void;
}

export const AddOfficeEmployeeModal: React.FC<AddOfficeEmployeeModalProps> = ({ onClose }) => {
  const { addOfficeEmployee } = useApp();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [roleTitle, setRoleTitle] = useState('مدير العمليات والشحن');
  const [formError, setFormError] = useState<string | null>(null);

  // 1. الشحن ونوعه
  const [canManagePlayerIdOrders, setCanManagePlayerIdOrders] = useState(true);
  const [canManageAccountOrders, setCanManageAccountOrders] = useState(true);
  const [canManageVoucherOrders, setCanManageVoucherOrders] = useState(true);

  // 2. طلبات الرصيد (حوالة كاش أو سلفة) والحسابات البنكية
  const [canReviewCashDeposits, setCanReviewCashDeposits] = useState(false);
  const [canReviewLoanDeposits, setCanReviewLoanDeposits] = useState(false);
  const [canManageBankAccounts, setCanManageBankAccounts] = useState(false);

  // 3. الكتالوجات والخدمات
  const [canAddCatalogs, setCanAddCatalogs] = useState(false);
  const [canAddServices, setCanAddServices] = useState(false);

  // 4. أسعار الخدمات
  const [canEditServicePrices, setCanEditServicePrices] = useState(false);

  // 5. تغذية الأكواد
  const [canManageVoucherStock, setCanManageVoucherStock] = useState(false);

  // 6. الاطلاع على العملاء والتقارير والترقية
  const [canViewClients, setCanViewClients] = useState(true);
  const [canUpgradeClientTiers, setCanUpgradeClientTiers] = useState(false);
  const [canViewReports, setCanViewReports] = useState(false);

  // 7. إضافة الموظفين
  const [canManageEmployees, setCanManageEmployees] = useState(false);

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

    if (password.trim().length < 4) {
      setFormError('يرجى تعيين كلمة مرور خاصة بالموظف لا تقل عن 4 أحرف أو أرقام.');
      return;
    }

    const res = addOfficeEmployee({
      name: name.trim(),
      email: email.trim(),
      password: password.trim(),
      phone: phone.trim(),
      roleTitle: roleTitle.trim() || 'موظف مكتب',
      permissions: {
        // Aggregates for backward compatibility
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
      setFormError(res.error || 'تعذر إضافة الموظف. تحقق من البيانات والصلاحيات.');
      return;
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 text-slate-100 shadow-2xl space-y-5 my-6 max-h-[90vh] overflow-y-auto">
        
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">إضافة موظف جديد للمكتب وتحديد الصلاحيات</h3>
              <p className="text-xs text-slate-400">تخصيص الصلاحيات التفصيلية الممنوحة للموظف في إدارة المتجر</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">اسم الموظف الثلاثي:</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="مثال: صالح الجهني"
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
                  required
                  minLength={4}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="4 أحرف/أرقام فأكثر"
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
              <label className="block font-semibold text-slate-300 mb-1">رقم الهاتف الجوال:</label>
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

          {/* Granular Permissions Matrix */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2 font-bold text-amber-400">
                <Shield className="w-4 h-4 text-amber-400" />
                <span>تحديد صلاحيات الموظف الدقيقة:</span>
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
                    className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700"
                  />
                  <div>
                    <span className="font-bold text-white block text-[11px]">شحن عبر الأيدي</span>
                    <span className="text-[9.5px] text-slate-400">تنفيذ طلبات الأيدي باللعبة</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={canManageAccountOrders}
                    onChange={e => setCanManageAccountOrders(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700"
                  />
                  <div>
                    <span className="font-bold text-white block text-[11px]">شحن عبر الحساب</span>
                    <span className="text-[9.5px] text-slate-400">استلام إيميل/رمز الحساب</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={canManageVoucherOrders}
                    onChange={e => setCanManageVoucherOrders(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700"
                  />
                  <div>
                    <span className="font-bold text-white block text-[11px]">شحن كود قسيمة</span>
                    <span className="text-[9.5px] text-slate-400">متابعة تسليم كود الفوتشر</span>
                  </div>
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
                    className="w-4 h-4 rounded text-cyan-500 bg-slate-950 border-slate-700"
                  />
                  <div>
                    <span className="font-bold text-white block text-[11px]">طلبات الحوالات والكاش</span>
                    <span className="text-[9.5px] text-slate-400">اعتماد الإيداعات البنكية المباشرة</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={canReviewLoanDeposits}
                    onChange={e => setCanReviewLoanDeposits(e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-500 bg-slate-950 border-slate-700"
                  />
                  <div>
                    <span className="font-bold text-white block text-[11px]">طلبات السُّلَف / الرصيد الآجل</span>
                    <span className="text-[9.5px] text-slate-400">مراجعة واعتماد طلبات السلفة</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={canManageBankAccounts}
                    onChange={e => setCanManageBankAccounts(e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-500 bg-slate-950 border-slate-700"
                  />
                  <div>
                    <span className="font-bold text-white block text-[11px]">إدارة الحسابات البنكية</span>
                    <span className="text-[9.5px] text-slate-400">إضافة الحسابات ومنح ميزة الاستلام</span>
                  </div>
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
                    className="w-4 h-4 rounded text-purple-500 bg-slate-950 border-slate-700"
                  />
                  <div>
                    <span className="font-bold text-white block text-[11px]">إضافة الكتالوجات</span>
                    <span className="text-[9.5px] text-slate-400">إنشاء وتسمية الكتالوجات الجديدة</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={canAddServices}
                    onChange={e => setCanAddServices(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-500 bg-slate-950 border-slate-700"
                  />
                  <div>
                    <span className="font-bold text-white block text-[11px]">إضافة الخدمات والباقات</span>
                    <span className="text-[9.5px] text-slate-400">إضافة ألعاب وخدمات باقات جديدة</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={canEditServicePrices}
                    onChange={e => setCanEditServicePrices(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-500 bg-slate-950 border-slate-700"
                  />
                  <div>
                    <span className="font-bold text-white block text-[11px]">تحديد وتعديل أسعار الخدمات</span>
                    <span className="text-[9.5px] text-slate-400">ضبط أسعار الباقات والرتب الطبقية</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={canManageVoucherStock}
                    onChange={e => setCanManageVoucherStock(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-500 bg-slate-950 border-slate-700"
                  />
                  <div>
                    <span className="font-bold text-white block text-[11px]">تغذية أكواد القسائم (الفوتشر)</span>
                    <span className="text-[9.5px] text-slate-400">إيداع أكواد جديدة بالمخزون</span>
                  </div>
                </label>
              </div>
            </div>

            {/* 6 & 7. العملاء والتقارير والترقية وإضافة موظفين */}
            <div className="space-y-2 pt-1 border-t border-slate-800/60">
              <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>4. إدارة العملاء والتقارير وإضافة الموظفين:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={canViewClients}
                    onChange={e => setCanViewClients(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-700"
                  />
                  <div>
                    <span className="font-bold text-white block text-[11px]">الاطلاع على العملاء</span>
                    <span className="text-[9.5px] text-slate-400">استعراض قائمة نقاط البيع</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={canUpgradeClientTiers}
                    onChange={e => setCanUpgradeClientTiers(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-700"
                  />
                  <div>
                    <span className="font-bold text-white block text-[11px]">ترقية رتب العملاء</span>
                    <span className="text-[9.5px] text-slate-400">تغيير رتبة العميل والميزات</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={canViewReports}
                    onChange={e => setCanViewReports(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-700"
                  />
                  <div>
                    <span className="font-bold text-white block text-[11px]">عرض التقارير وكشف الحسابات</span>
                    <span className="text-[9.5px] text-slate-400">عرض تقارير العمليات وتصدير PDF</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={canManageEmployees}
                    onChange={e => setCanManageEmployees(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-700"
                  />
                  <div>
                    <span className="font-bold text-white block text-[11px]">إدارة الموظفين والصلاحيات</span>
                    <span className="text-[9.5px] text-slate-400">إضافة وتعديل صلاحيات الموظفين</span>
                  </div>
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

          <div className="flex items-center justify-end gap-2 pt-2">
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
              <span>حفظ وإضافة الموظف</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

