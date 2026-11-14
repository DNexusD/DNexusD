import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { OfficeEmployee } from '../../types';
import { UserCheck, Shield, Mail, Phone, X, Check, Lock, Gamepad2, HandCoins, Layers, Tag, Ticket, Users, UserPlus } from 'lucide-react';

interface EditOfficeEmployeeModalProps {
  employee: OfficeEmployee;
  onClose: () => void;
}

export const EditOfficeEmployeeModal: React.FC<EditOfficeEmployeeModalProps> = ({ employee, onClose }) => {
  const { updateOfficeEmployee } = useApp();

  const [name, setName] = useState(employee.name);
  const [email, setEmail] = useState(employee.email);
  const [password, setPassword] = useState(employee.password || '');
  const [phone, setPhone] = useState(employee.phone || '');
  const [roleTitle, setRoleTitle] = useState(employee.roleTitle || 'موظف مكتب');

  // 1. الشحن ونوعه
  const [canManagePlayerIdOrders, setCanManagePlayerIdOrders] = useState(
    employee.permissions.canManagePlayerIdOrders ?? employee.permissions.canManageOrders ?? true
  );
  const [canManageAccountOrders, setCanManageAccountOrders] = useState(
    employee.permissions.canManageAccountOrders ?? employee.permissions.canManageOrders ?? true
  );
  const [canManageVoucherOrders, setCanManageVoucherOrders] = useState(
    employee.permissions.canManageVoucherOrders ?? employee.permissions.canManageOrders ?? true
  );

  // 2. طلبات الرصيد (حوالة كاش أو سلفة) والحسابات البنكية
  const [canReviewCashDeposits, setCanReviewCashDeposits] = useState(
    employee.permissions.canReviewCashDeposits ?? employee.permissions.canReviewDeposits ?? false
  );
  const [canReviewLoanDeposits, setCanReviewLoanDeposits] = useState(
    employee.permissions.canReviewLoanDeposits ?? employee.permissions.canReviewDeposits ?? false
  );
  const [canManageBankAccounts, setCanManageBankAccounts] = useState(
    employee.permissions.canManageBankAccounts ?? employee.permissions.canReviewDeposits ?? false
  );

  // 3. الكتالوجات والخدمات
  const [canAddCatalogs, setCanAddCatalogs] = useState(
    employee.permissions.canAddCatalogs ?? employee.permissions.canManageCatalogs ?? false
  );
  const [canAddServices, setCanAddServices] = useState(
    employee.permissions.canAddServices ?? employee.permissions.canManageCatalogs ?? false
  );

  // 4. أسعار الخدمات
  const [canEditServicePrices, setCanEditServicePrices] = useState(
    employee.permissions.canEditServicePrices ?? employee.permissions.canManageCatalogs ?? false
  );

  // 5. تغذية الأكواد
  const [canManageVoucherStock, setCanManageVoucherStock] = useState(
    employee.permissions.canManageVoucherStock ?? employee.permissions.canManageCatalogs ?? false
  );

  // 6. الاطلاع على العملاء وترقيتهم
  const [canViewClients, setCanViewClients] = useState(
    employee.permissions.canViewClients ?? employee.permissions.canManageClients ?? true
  );
  const [canUpgradeClientTiers, setCanUpgradeClientTiers] = useState(
    employee.permissions.canUpgradeClientTiers ?? employee.permissions.canManageClients ?? false
  );

  // 7. إضافة الموظفين
  const [canManageEmployees, setCanManageEmployees] = useState(
    employee.permissions.canManageEmployees ?? false
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    updateOfficeEmployee(employee.id, {
      name: name.trim(),
      email: email.trim(),
      ...(password.trim() ? { password: password.trim() } : {}),
      phone: phone.trim(),
      roleTitle: roleTitle.trim() || 'موظف مكتب',
      permissions: {
        canManageOrders: canManagePlayerIdOrders || canManageAccountOrders || canManageVoucherOrders,
        canManagePlayerIdOrders,
        canManageAccountOrders,
        canManageVoucherOrders,

        canReviewDeposits: canReviewCashDeposits || canReviewLoanDeposits,
        canReviewCashDeposits,
        canReviewLoanDeposits,
        canManageBankAccounts,

        canManageCatalogs: canAddCatalogs || canAddServices || canEditServicePrices || canManageVoucherStock,
        canAddCatalogs,
        canAddServices,

        canEditServicePrices,
        canManageVoucherStock,

        canManageClients: canViewClients || canUpgradeClientTiers,
        canViewClients,
        canUpgradeClientTiers,

        canManageEmployees
      }
    });

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
              <p className="text-xs text-slate-400">تحديث معلومات الحساب والتصاريح التفصيلية الممنوحة للموظف</p>
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
              <label className="block font-semibold text-slate-300 mb-1">كلمة المرور:</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="اترك فارغاً للإبقاء"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white pl-9 focus:outline-none font-mono text-[11px]"
                  dir="ltr"
                />
                <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
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

          {/* Granular Permissions Matrix */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 font-bold text-amber-400 border-b border-slate-800/80 pb-2">
              <Shield className="w-4 h-4 text-amber-400" />
              <span>تعديل صلاحيات الموظف الدقيقة:</span>
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

            {/* 6 & 7. العملاء وترقيتهم وإضافة موظفين */}
            <div className="space-y-2 pt-1 border-t border-slate-800/60">
              <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>4. إدارة العملاء وترقية الرتب وإضافة الموظفين:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                    <span className="text-[9.5px] text-slate-400">تغيير رتبة العميل فورياً</span>
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
                    <span className="font-bold text-white block text-[11px]">إضافة موظفين جديد</span>
                    <span className="text-[9.5px] text-slate-400">إضافة وإدارة صلاحيات الموظفين</span>
                  </div>
                </label>
              </div>
            </div>

          </div>

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

