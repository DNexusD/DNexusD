import { AdminAccount, AdminPermissions, AuthUser, UserRole } from '../types';

export type AdminDashboardTab =
  | 'statement'
  | 'overview'
  | 'fees'
  | 'interface_settings'
  | 'admin_accounts';

export const FULL_ADMIN_PERMISSIONS: Required<AdminPermissions> = {
  canViewStatement: true,
  canSettleAdminWallet: true,
  canManageSuppliers: true,
  canManageFees: true,
  canManageInterfaceSettings: true,
  canManageAdminAccounts: true,
  canClearSystemData: true,
};

export const ADMIN_PERMISSION_META: Array<{
  key: keyof AdminPermissions;
  labelAr: string;
  descriptionAr: string;
  category: 'financial' | 'operations' | 'system';
}> = [
  {
    key: 'canViewStatement',
    labelAr: 'كشف حساب مدير التطبيق والمحفظة',
    descriptionAr: 'الاطلاع على كشف حساب الرسوم، الإيرادات، والتقارير المالية للمنصة.',
    category: 'financial',
  },
  {
    key: 'canSettleAdminWallet',
    labelAr: 'تسوية المحفظة والتحويلات المالية',
    descriptionAr: 'سحب وتسوية رصيد محفظة الإدارة للبنك وتحويل الأرصدة لنقاط البيع.',
    category: 'financial',
  },
  {
    key: 'canManageSuppliers',
    labelAr: 'إشراف وإضافة المتاجر والممولين',
    descriptionAr: 'استعراض قائمة المتاجر، إضافة متاجرن جدد، وإرسال روابط التسجيل.',
    category: 'operations',
  },
  {
    key: 'canManageFees',
    labelAr: 'ضبط نسب ومبالغ الرسوم',
    descriptionAr: 'تعديل الرسوم العامة الافتراضية وتخصيص نسب أو مبالغ الرسوم لكل متجر.',
    category: 'financial',
  },
  {
    key: 'canManageInterfaceSettings',
    labelAr: 'إعدادات الواجهات والكتالوجات والقوائم',
    descriptionAr: 'إدارة الكتالوجات الثابتة، التنبيهات العامة، وخيارات القوائم المنسدلة.',
    category: 'operations',
  },
  {
    key: 'canManageAdminAccounts',
    labelAr: 'إدارة حسابات وصلاحيات الإدارة',
    descriptionAr: 'إنشاء وتعديل وإيقاف حسابات مشرفي التطبيق وتحديد صلاحياتهم.',
    category: 'system',
  },
  {
    key: 'canClearSystemData',
    labelAr: 'إفراغ وتنظيف بيانات التخزين',
    descriptionAr: 'صلاحية حساسة لمسح سجلات المستخدمين والمتاجر ونقاط البيع من التخزين.',
    category: 'system',
  },
];

export const ADMIN_ROLE_PRESETS: Array<{
  id: string;
  labelAr: string;
  roleTitle: string;
  permissions: AdminPermissions;
}> = [
  {
    id: 'full_admin',
    labelAr: 'مدير نظام كامل',
    roleTitle: 'مدير تشغيل عام',
    permissions: { ...FULL_ADMIN_PERMISSIONS },
  },
  {
    id: 'financial_admin',
    labelAr: 'مدير مالي',
    roleTitle: 'مدير مالي ومحاسبي',
    permissions: {
      canViewStatement: true,
      canSettleAdminWallet: true,
      canManageSuppliers: false,
      canManageFees: true,
      canManageInterfaceSettings: false,
      canManageAdminAccounts: false,
      canClearSystemData: false,
    },
  },
  {
    id: 'operations_admin',
    labelAr: 'مشرف المتاجر والواجهات',
    roleTitle: 'مشرف المتاجر والمنصة',
    permissions: {
      canViewStatement: false,
      canSettleAdminWallet: false,
      canManageSuppliers: true,
      canManageFees: false,
      canManageInterfaceSettings: true,
      canManageAdminAccounts: false,
      canClearSystemData: false,
    },
  },
];

export function countActiveAdminPermissions(permissions?: AdminPermissions): number {
  if (!permissions) return 0;
  return ADMIN_PERMISSION_META.reduce(
    (count, item) => (permissions[item.key] ? count + 1 : count),
    0
  );
}

export function resolveEffectiveAdminPermissions(
  currentUser: AuthUser | null | undefined,
  role: UserRole
): Required<AdminPermissions> {
  // Primary super admin (or unauthenticated demo view before sign-in) has unrestricted access
  if (role !== 'super_admin' || !currentUser || !currentUser.adminPermissions) {
    return { ...FULL_ADMIN_PERMISSIONS };
  }

  const p = currentUser.adminPermissions;
  return {
    canViewStatement: Boolean(p.canViewStatement),
    canSettleAdminWallet: Boolean(p.canSettleAdminWallet),
    canManageSuppliers: Boolean(p.canManageSuppliers),
    canManageFees: Boolean(p.canManageFees),
    canManageInterfaceSettings: Boolean(p.canManageInterfaceSettings),
    canManageAdminAccounts: Boolean(p.canManageAdminAccounts),
    canClearSystemData: Boolean(p.canClearSystemData),
  };
}

export function isAdminTabAllowed(
  tab: AdminDashboardTab,
  perms: Required<AdminPermissions>
): boolean {
  switch (tab) {
    case 'statement':
      return perms.canViewStatement;
    case 'overview':
      return perms.canManageSuppliers || perms.canSettleAdminWallet;
    case 'fees':
      return perms.canManageFees;
    case 'interface_settings':
      return perms.canManageInterfaceSettings;
    case 'admin_accounts':
      return perms.canManageAdminAccounts;
    default:
      return false;
  }
}

export function getFirstAllowedAdminTab(perms: Required<AdminPermissions>): AdminDashboardTab {
  if (perms.canViewStatement) return 'statement';
  if (perms.canManageSuppliers || perms.canSettleAdminWallet) return 'overview';
  if (perms.canManageFees) return 'fees';
  if (perms.canManageInterfaceSettings) return 'interface_settings';
  if (perms.canManageAdminAccounts) return 'admin_accounts';
  return 'statement';
}

export function validateAdminAccountInput(
  input: {
    name: string;
    email: string;
    password?: string;
    roleTitle?: string;
    permissions: AdminPermissions;
  },
  existingAccounts: AdminAccount[],
  masterAdminEmail: string,
  editingAccountId?: string
): { valid: boolean; error?: string } {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = (input.password || '').trim();

  if (!name) {
    return { valid: false, error: 'يرجى إدخال اسم المشرف الإداري.' };
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, error: 'يرجى إدخال بريد إلكتروني صحيح.' };
  }

  if (
    email === masterAdminEmail.trim().toLowerCase() ||
    email === 'jmiyemen66@gmail.com'
  ) {
    return {
      valid: false,
      error: 'لا يمكن استخدام البريد الإلكتروني الخاص بالمدير العام الرئيسي.'
    };
  }

  const duplicate = existingAccounts.find(
    (acc) =>
      acc.email.trim().toLowerCase() === email &&
      acc.id !== editingAccountId
  );
  if (duplicate) {
    return {
      valid: false,
      error: 'يوجد حساب إداري مسجل مسبقاً بهذا البريد الإلكتروني.'
    };
  }

  if (!editingAccountId && password.length < 6) {
    return {
      valid: false,
      error: 'يجب أن تتكون كلمة المرور من 6 أحرف أو أرقام على الأقل.'
    };
  }

  if (editingAccountId && password.length > 0 && password.length < 6) {
    return {
      valid: false,
      error: 'في حال تغيير كلمة المرور، يجب أن لا تقل عن 6 أحرف أو أرقام.'
    };
  }

  if (countActiveAdminPermissions(input.permissions) === 0) {
    return {
      valid: false,
      error: 'يرجى منح صلاحية واحدة على الأقل لهذا الحساب الإداري.'
    };
  }

  return { valid: true };
}
