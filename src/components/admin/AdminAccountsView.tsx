import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AdminAccount } from '../../types';
import {
  ADMIN_PERMISSION_META,
  countActiveAdminPermissions
} from '../../utils/adminAccounts';
import { AdminAccountModal } from './AdminAccountModal';
import {
  ShieldCheck,
  UserPlus,
  Search,
  Mail,
  Phone,
  Edit3,
  Trash2,
  Power,
  CheckCircle2,
  Lock
} from 'lucide-react';

export const AdminAccountsView: React.FC = () => {
  const { superAdmin, currentUser, updateAdminAccount, removeAdminAccount } = useApp();
  const accounts = superAdmin.adminAccounts || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AdminAccount | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const activeCount = useMemo(
    () => accounts.filter(acc => acc.isActive).length,
    [accounts]
  );

  const filteredAccounts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return accounts.filter(acc => {
      if (statusFilter === 'active' && !acc.isActive) return false;
      if (statusFilter === 'inactive' && acc.isActive) return false;
      if (!query) return true;
      return (
        acc.name.toLowerCase().includes(query) ||
        acc.email.toLowerCase().includes(query) ||
        acc.roleTitle.toLowerCase().includes(query) ||
        acc.phone.toLowerCase().includes(query)
      );
    });
  }, [accounts, searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-lg font-bold text-white">إدارة حسابات وصلاحيات فريق التطبيق</h2>
            <span className="text-xs font-mono text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 rounded-lg tabular-nums">
              {accounts.length} حساب ({activeCount} نشط)
            </span>
          </div>
          <p className="text-xs text-slate-400">
            أنشئ حسابات فرعية لإدارة التطبيق وخصص بدقة صلاحيات كل حساب (كشف الحساب، تسوية المحفظة، المتاجر، الرسوم، إعدادات الواجهة).
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 text-xs font-bold flex items-center gap-2 transition-colors shadow-md shadow-purple-500/15 shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>إنشاء حساب إدارة جديد</span>
        </button>
      </div>

      {/* Master Admin Read-only Reference Card */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-white">{superAdmin.name}</h3>
              <span className="text-[11px] font-semibold text-purple-300">المدير العام الرئيسي (المالك)</span>
            </div>
            <div className="text-xs text-slate-400 font-mono" dir="ltr">
              {superAdmin.email}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800">
          <Lock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span>صلاحيات كاملة دائمة (محمي من التعديل أو الحذف)</span>
        </div>
      </div>

      {/* Search and Status Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم، البريد الإلكتروني، أو المسمى الإداري..."
            className="w-full bg-slate-900 border border-slate-800 focus:border-purple-500 rounded-xl pr-10 pl-3 py-2.5 text-xs text-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          {(
            [
              { id: 'all', label: 'الكل' },
              { id: 'active', label: 'النشطة' },
              { id: 'inactive', label: 'الموقوفة' }
            ] as const
          ).map(filter => (
            <button
              key={filter.id}
              onClick={() => setStatusFilter(filter.id)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                statusFilter === filter.id
                  ? 'bg-purple-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Accounts List */}
      {filteredAccounts.length === 0 ? (
        <div className="text-center py-14 px-4 bg-slate-900/50 rounded-3xl border border-slate-800/80 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-white text-sm">
            {accounts.length === 0
              ? 'لا توجد حسابات إدارية فرعية حالياً'
              : 'لا توجد حسابات مطابقة لنتائج البحث'}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {accounts.length === 0
              ? 'يمكنك إنشاء حسابات إدارية مساعدة (مثل مدير مالي أو مشرف متاجرن) ومنح كل حساب الصلاحيات التي يحتاجها فقط.'
              : 'جرّب تغيير كلمات البحث أو إزالة فلتر الحالة لعرض الحسابات.'}
          </p>
          {accounts.length === 0 && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-semibold transition-colors border border-slate-700"
            >
              إنشاء أول حساب إداري
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAccounts.map(acc => {
            const grantedMeta = ADMIN_PERMISSION_META.filter(m => Boolean(acc.permissions[m.key]));
            const grantedCount = countActiveAdminPermissions(acc.permissions);
            const isSelf = currentUser?.adminAccountId === acc.id;
            const isConfirmingDelete = confirmDeleteId === acc.id;

            return (
              <div
                key={acc.id}
                className={`p-5 rounded-3xl bg-slate-900 border transition-all shadow-sm flex flex-col justify-between gap-4 ${
                  acc.isActive
                    ? 'border-slate-800 hover:border-slate-700'
                    : 'border-rose-500/30 opacity-85'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-2xl border flex items-center justify-center font-bold text-sm shrink-0 ${
                          acc.isActive
                            ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {acc.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-sm text-white">{acc.name}</h3>
                          {isSelf && (
                            <span className="text-[10px] font-semibold text-amber-300">
                              (حسابك الحالي)
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-purple-300 font-medium block">
                          {acc.roleTitle}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={isSelf}
                        onClick={() => updateAdminAccount(acc.id, { isActive: !acc.isActive })}
                        className={`p-2 rounded-xl border transition-colors disabled:opacity-40 ${
                          acc.isActive
                            ? 'bg-slate-800 hover:bg-amber-500/20 text-emerald-400 hover:text-amber-300 border-slate-700'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}
                        title={acc.isActive ? 'إيقاف الحساب مؤقتاً' : 'إعادة تفعيل الحساب'}
                      >
                        <Power className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingAccount(acc)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-purple-500/20 text-slate-300 hover:text-purple-300 transition-colors border border-slate-700"
                        title="تعديل بيانات وصلاحيات الحساب"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        disabled={isSelf}
                        onClick={() => setConfirmDeleteId(isConfirmingDelete ? null : acc.id)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors border border-slate-700 disabled:opacity-40"
                        title="حذف الحساب الإداري"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-mono text-[11px]" dir="ltr">
                        {acc.email}
                      </span>
                    </span>
                    {acc.phone && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-500" />
                          <span className="font-mono text-[11px]" dir="ltr">
                            {acc.phone}
                          </span>
                        </span>
                      </>
                    )}
                  </div>

                  {/* Granted Permissions */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-semibold">الصلاحيات الممنوحة:</span>
                      <span className="font-mono text-purple-300 tabular-nums">
                        {grantedCount} من {ADMIN_PERMISSION_META.length}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      {grantedMeta.map(meta => (
                        <span
                          key={meta.key}
                          className="px-2 py-0.5 rounded-md bg-slate-950 text-slate-200 border border-slate-800 flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{meta.labelAr}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Inline Delete Confirmation */}
                  {isConfirmingDelete && (
                    <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-2 text-xs">
                      <span className="text-rose-200 font-semibold">
                        تأكيد حذف حساب ({acc.name}) نهائياً؟
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            removeAdminAccount(acc.id);
                            setConfirmDeleteId(null);
                          }}
                          className="px-3 py-1 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-bold transition-colors"
                        >
                          تأكيد الحذف
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="tabular-nums">تاريخ الإنشاء: {acc.createdAt}</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingAccount(acc)}
                      className="text-purple-400 hover:text-purple-300 font-semibold transition-colors"
                    >
                      تعديل الصلاحيات
                    </button>
                    <span
                      className={`font-semibold ${
                        acc.isActive ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {acc.isActive ? 'نشط ✓' : 'موقوف'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <AdminAccountModal onClose={() => setShowCreateModal(false)} />
      )}

      {editingAccount && (
        <AdminAccountModal
          editingAccount={editingAccount}
          onClose={() => setEditingAccount(null)}
        />
      )}
    </div>
  );
};
