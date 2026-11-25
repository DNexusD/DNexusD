import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AdminAccount, AdminPermissions } from '../../types';
import {
  ADMIN_PERMISSION_META,
  ADMIN_ROLE_PRESETS,
  FULL_ADMIN_PERMISSIONS,
  countActiveAdminPermissions,
  validateAdminAccountInput
} from '../../utils/adminAccounts';
import {
  ShieldCheck,
  Shield,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  X,
  Check,
  AlertTriangle,
  UserPlus,
  Edit3
} from 'lucide-react';

interface AdminAccountModalProps {
  editingAccount?: AdminAccount | null;
  onClose: () => void;
}

export const AdminAccountModal: React.FC<AdminAccountModalProps> = ({
  editingAccount,
  onClose
}) => {
  const { superAdmin, currentUser, addAdminAccount, updateAdminAccount } = useApp();
  const isEditing = Boolean(editingAccount);
  const isSelfAccount = Boolean(
    editingAccount && currentUser?.adminAccountId === editingAccount.id
  );

  const [name, setName] = useState(editingAccount?.name || '');
  const [roleTitle, setRoleTitle] = useState(editingAccount?.roleTitle || 'مشرف تشغيل ومنصة');
  const [email, setEmail] = useState(editingAccount?.email || '');
  const [phone, setPhone] = useState(editingAccount?.phone || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isActive, setIsActive] = useState(editingAccount ? editingAccount.isActive : true);
  const [permissions, setPermissions] = useState<AdminPermissions>(
    editingAccount
      ? { ...editingAccount.permissions }
      : { ...ADMIN_ROLE_PRESETS[2].permissions }
  );
  const [formError, setFormError] = useState<string | null>(null);

  const activeCount = countActiveAdminPermissions(permissions);
  const totalCount = ADMIN_PERMISSION_META.length;

  const togglePermission = (key: keyof AdminPermissions) => {
    if (isSelfAccount && key === 'canManageAdminAccounts' && permissions[key]) {
      setFormError('لا يمكنك سحب صلاحية إدارة الحسابات الإدارية من حسابك النشط حالياً.');
      return;
    }
    setFormError(null);
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const applyPreset = (preset: (typeof ADMIN_ROLE_PRESETS)[number]) => {
    setFormError(null);
    setRoleTitle(preset.roleTitle);
    const nextPermissions = { ...preset.permissions };
    if (isSelfAccount) {
      nextPermissions.canManageAdminAccounts = true;
    }
    setPermissions(nextPermissions);
  };

  const handleToggleAll = () => {
    setFormError(null);
    if (activeCount === totalCount) {
      setPermissions({
        canViewStatement: false,
        canSettleAdminWallet: false,
        canManageSuppliers: false,
        canManageFees: false,
        canManageInterfaceSettings: false,
        canManageAdminAccounts: isSelfAccount,
        canClearSystemData: false
      });
    } else {
      setPermissions({ ...FULL_ADMIN_PERMISSIONS });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validation = validateAdminAccountInput(
      {
        name,
        email,
        password,
        roleTitle,
        permissions
      },
      superAdmin.adminAccounts || [],
      superAdmin.email,
      editingAccount?.id
    );

    if (!validation.valid) {
      setFormError(validation.error || 'يرجى التحقق من البيانات المدخلة.');
      return;
    }

    if (isEditing && editingAccount) {
      const updates: Partial<AdminAccount> = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        roleTitle: roleTitle.trim() || 'مشرف تطبيق',
        permissions,
        isActive: isSelfAccount ? true : isActive
      };
      if (password.trim()) {
        updates.password = password.trim();
      }
      const res = await updateAdminAccount(editingAccount.id, updates);
      if (!res.success) {
        setFormError(res.error || 'تعذر حفظ التعديلات.');
        return;
      }
    } else {
      const res = await addAdminAccount({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
        phone: phone.trim(),
        roleTitle: roleTitle.trim() || 'مشرف تطبيق',
        permissions,
        isActive
      });
      if (!res.success) {
        setFormError(res.error || 'تعذر إنشاء الحساب الإداري.');
        return;
      }
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 text-slate-100 shadow-2xl space-y-5 my-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
              {isEditing ? <Edit3 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {isEditing
                  ? `تعديل حساب وصلاحيات: ${editingAccount?.name}`
                  : 'إنشاء حساب إدارة تطبيق جديد وتحديد الصلاحيات'}
              </h3>
              <p className="text-xs text-slate-400">
                تحديد بيانات الدخول والصلاحيات الدقيقة المسموح بها داخل لوحة مدير التطبيق
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">اسم المشرف الكامل:</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="مثال: خالد العتيبي"
                className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3 py-2.5 text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">المسمى الوظيفي / الإداري:</label>
              <input
                type="text"
                required
                value={roleTitle}
                onChange={e => setRoleTitle(e.target.value)}
                placeholder="مثال: مدير مالي ومحاسبي"
                className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3 py-2.5 text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">البريد الإلكتروني للدخول:</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="manager@digipos.sa"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3 py-2.5 text-white pl-9 focus:outline-none font-mono text-[11px]"
                  dir="ltr"
                />
                <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                {isEditing ? 'كلمة المرور الجديدة (اختياري):' : 'كلمة المرور:'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required={!isEditing}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={isEditing ? 'اتركه فارغاً للإبقاء' : '6 أحرف على الأقل'}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3 py-2.5 text-white pl-16 focus:outline-none font-mono text-[11px]"
                  dir="ltr"
                />
                <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute left-9 top-2.5 text-slate-400 hover:text-white transition-colors"
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
                  placeholder="+966 5x xxx xxxx"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3 py-2.5 text-white pl-9 focus:outline-none font-mono text-[11px]"
                  dir="ltr"
                />
                <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
              </div>
            </div>
          </div>

          {/* Account Status Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
            <div>
              <span className="font-bold text-white block">حالة الحساب الإداري</span>
              <span className="text-[11px] text-slate-400">
                {isSelfAccount
                  ? 'حسابك الحالي نشط ولا يمكن إيقافه من داخل نفس الجلسة'
                  : isActive
                  ? 'الحساب مفعل ويمكنه تسجيل الدخول حسب الصلاحيات الممنوحة'
                  : 'الحساب موقوف مؤقتاً ولا يمكنه تسجيل الدخول للوحة الإدارة'}
              </span>
            </div>
            <button
              type="button"
              disabled={isSelfAccount}
              onClick={() => setIsActive(prev => !prev)}
              className={`px-3.5 py-2 rounded-xl font-bold text-xs border transition-colors disabled:opacity-60 ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25'
              }`}
            >
              {isActive ? 'حساب نشط ✓' : 'حساب موقوف'}
            </button>
          </div>

          {/* Role Presets & Granular Permissions */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2 font-bold text-purple-300">
                <Shield className="w-4 h-4 text-purple-400" />
                <span>قوالب وصلاحيات إدارة التطبيق</span>
                <span className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 font-mono text-[11px] tabular-nums">
                  {activeCount} / {totalCount}
                </span>
              </div>

              <button
                type="button"
                onClick={handleToggleAll}
                className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 transition-colors"
              >
                {activeCount === totalCount ? 'إلغاء تحديد الكل' : 'تحديد كل الصلاحيات'}
              </button>
            </div>

            {/* Presets */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-400 font-semibold block">
                قوالب جاهزة سريعة:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {ADMIN_ROLE_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/40 text-right transition-colors"
                  >
                    <span className="font-bold text-white block text-[11px]">{preset.labelAr}</span>
                    <span className="text-[10px] text-slate-400">{preset.roleTitle}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Permission Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {ADMIN_PERMISSION_META.map(meta => {
                const checked = Boolean(permissions[meta.key]);
                const isSensitive = meta.key === 'canClearSystemData' || meta.key === 'canManageAdminAccounts';
                return (
                  <label
                    key={meta.key}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                      checked
                        ? isSensitive
                          ? 'bg-amber-500/10 border-amber-500/40'
                          : 'bg-purple-500/10 border-purple-500/40'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePermission(meta.key)}
                      className="w-4 h-4 mt-0.5 rounded text-purple-500 bg-slate-950 border-slate-700 shrink-0"
                    />
                    <div className="space-y-0.5">
                      <span className="font-bold text-white block text-[11px]">{meta.labelAr}</span>
                      <span className="text-[10px] text-slate-400 leading-relaxed block">
                        {meta.descriptionAr}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

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
              className="px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 text-xs font-bold transition-colors shadow-md shadow-purple-500/20 flex items-center gap-1.5"
            >
              {isEditing ? <Check className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
              <span>{isEditing ? 'حفظ تعديلات الحساب' : 'إنشاء وتفعيل الحساب الإداري'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
