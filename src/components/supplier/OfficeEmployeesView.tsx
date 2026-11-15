import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { OfficeEmployee } from '../../types';
import { UserCheck, Shield, Mail, Phone, X, Trash2, PlusCircle, CheckCircle2, Edit3, KeyRound } from 'lucide-react';
import { AddOfficeEmployeeModal } from './AddOfficeEmployeeModal';
import { EditOfficeEmployeeModal } from './EditOfficeEmployeeModal';

interface OfficeEmployeesViewProps {
  employees?: OfficeEmployee[];
}

export const OfficeEmployeesView: React.FC<OfficeEmployeesViewProps> = ({ employees = [] }) => {
  const { removeOfficeEmployee } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<OfficeEmployee | null>(null);

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">إدارة موظفي وصلاحيات مكتب المتجر</h2>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-mono font-bold">
              {employees.length} موظفين
            </span>
          </div>
          <p className="text-xs text-slate-400">
            يمكنك إضافة موظفين جدد للمكتب وتحديد صلاحياتهم بدقة (إدارة الشحن، الكاتالوجات، العملاء، واعتماد الرصيد).
          </p>
        </div>

          <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-2 transition-colors shadow-md shadow-amber-500/15 shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>إضافة موظف جديد للمتجر</span>
        </button>
      </div>

      {/* Employees Grid */}
      {employees.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-900/50 rounded-3xl border border-slate-800/80 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <UserCheck className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-white text-sm">لا يوجد موظفون مضافون حالياً</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            اضغط على زر "إضافة موظف مكتب جديد" لتفويض أعضاء فريقك بالصلاحيات والإشراف على العمليات.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold transition-colors border border-slate-700"
          >
            إضافة أول موظف الآن
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {employees.map(emp => (
            <div
              key={emp.id}
              className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 hover:border-slate-700 transition-all shadow-sm flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-sm shrink-0">
                      {emp.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white">{emp.name}</h3>
                      <span className="text-[11px] text-amber-300 font-medium">{emp.roleTitle}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setEditingEmployee(emp)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-400 transition-colors border border-slate-700 flex items-center gap-1"
                      title="تعديل بيانات وصلاحيات الموظف"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span className="text-[11px] hidden sm:inline">تعديل</span>
                    </button>

                    <button
                      onClick={() => removeOfficeEmployee(emp.id)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors border border-slate-700"
                      title="حذف الموظف والصلاحيات"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1 border-t border-slate-800/80">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-500" />
                    <span className="font-mono text-[11px]" dir="ltr">{emp.email}</span>
                  </span>
                  {emp.phone && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span className="font-mono text-[11px]" dir="ltr">{emp.phone}</span>
                      </span>
                    </>
                  )}
                </div>

                {/* Permissions Badges */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 font-semibold block">الصلاحيات الممنوحة:</span>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    {emp.permissions.canManageOrders && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>إدارة الشحن والطلبات</span>
                      </span>
                    )}
                    {emp.permissions.canManageCatalogs && (
                      <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>الكاتالوجات والأسعار</span>
                      </span>
                    )}
                    {emp.permissions.canManageClients && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>متابعة العملاء والرتب</span>
                      </span>
                    )}
                    {emp.permissions.canReviewDeposits && (
                      <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>مراجعة طلبات الرصيد</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>تاريخ التعيين: {emp.createdAt}</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setEditingEmployee(emp)}
                    className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>تعديل الصلاحيات والبيانات</span>
                  </button>
                  <span className="font-mono text-emerald-400 text-[10px]">حساب نشط ✓</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <AddOfficeEmployeeModal onClose={() => setShowAddModal(false)} />
      )}

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
