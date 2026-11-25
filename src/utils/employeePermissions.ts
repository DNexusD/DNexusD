import {
  AppNotification,
  AuthUser,
  DepositRequest,
  DigitalService,
  EmployeePermissionRecord,
  EmployeePermissions,
  OfficeEmployee,
  Order,
  Supplier,
  UserRole,
} from '../types';

export type SupplierDashboardTab =
  | 'catalogs'
  | 'pending_orders'
  | 'account_orders'
  | 'deposits'
  | 'loans'
  | 'bank_accounts'
  | 'clients'
  | 'vouchers'
  | 'client_statements'
  | 'employees'
  | 'notifications';

export const FULL_OWNER_EMPLOYEE_PERMISSIONS: Required<EmployeePermissions> = {
  canManageOrders: true,
  canManagePlayerIdOrders: true,
  canManageAccountOrders: true,
  canManageVoucherOrders: true,
  canReviewDeposits: true,
  canReviewCashDeposits: true,
  canReviewLoanDeposits: true,
  canManageCatalogs: true,
  canAddCatalogs: true,
  canAddServices: true,
  canEditServicePrices: true,
  canManageVoucherStock: true,
  canManageClients: true,
  canViewClients: true,
  canUpgradeClientTiers: true,
  canViewReports: true,
  canManageEmployees: true,
  canManageBankAccounts: true,
};

export const EMPTY_EMPLOYEE_PERMISSIONS: Required<EmployeePermissions> = {
  canManageOrders: false,
  canManagePlayerIdOrders: false,
  canManageAccountOrders: false,
  canManageVoucherOrders: false,
  canReviewDeposits: false,
  canReviewCashDeposits: false,
  canReviewLoanDeposits: false,
  canManageCatalogs: false,
  canAddCatalogs: false,
  canAddServices: false,
  canEditServicePrices: false,
  canManageVoucherStock: false,
  canManageClients: false,
  canViewClients: false,
  canUpgradeClientTiers: false,
  canViewReports: false,
  canManageEmployees: false,
  canManageBankAccounts: false,
};

export type GranularEmployeePermissionKey =
  | 'canManagePlayerIdOrders'
  | 'canManageAccountOrders'
  | 'canManageVoucherOrders'
  | 'canReviewCashDeposits'
  | 'canReviewLoanDeposits'
  | 'canManageBankAccounts'
  | 'canAddCatalogs'
  | 'canAddServices'
  | 'canEditServicePrices'
  | 'canManageVoucherStock'
  | 'canViewClients'
  | 'canUpgradeClientTiers'
  | 'canViewReports'
  | 'canManageEmployees';

export const EMPLOYEE_PERMISSION_BADGES: Array<{
  key: GranularEmployeePermissionKey;
  labelAr: string;
  shortAr: string;
}> = [
  { key: 'canManagePlayerIdOrders', labelAr: 'شحن الأيدي', shortAr: 'الأيدي' },
  { key: 'canManageAccountOrders', labelAr: 'شحن الحساب 2FA', shortAr: 'الحساب' },
  { key: 'canManageVoucherOrders', labelAr: 'طلبات القسائم', shortAr: 'القسائم' },
  { key: 'canReviewCashDeposits', labelAr: 'مراجعة الحوالات', shortAr: 'الحوالات' },
  { key: 'canReviewLoanDeposits', labelAr: 'مراجعة السُّلَف', shortAr: 'السلف' },
  { key: 'canManageBankAccounts', labelAr: 'الحسابات البنكية', shortAr: 'البنوك' },
  { key: 'canAddCatalogs', labelAr: 'إضافة الكتالوجات', shortAr: 'كتالوجات' },
  { key: 'canAddServices', labelAr: 'إضافة الخدمات', shortAr: 'خدمات' },
  { key: 'canEditServicePrices', labelAr: 'تعديل الأسعار', shortAr: 'الأسعار' },
  { key: 'canManageVoucherStock', labelAr: 'مخزون الأكواد', shortAr: 'الأكواد' },
  { key: 'canViewClients', labelAr: 'عرض العملاء', shortAr: 'العملاء' },
  { key: 'canUpgradeClientTiers', labelAr: 'ترقية العملاء', shortAr: 'الترقية' },
  { key: 'canViewReports', labelAr: 'عرض التقارير', shortAr: 'التقارير' },
  { key: 'canManageEmployees', labelAr: 'إدارة الموظفين', shortAr: 'الموظفون' },
];

export interface EmployeePermissionItemMeta {
  key: GranularEmployeePermissionKey;
  labelAr: string;
  descriptionAr: string;
  scopeNoteAr: string;
}

export interface EmployeePermissionCategoryMeta {
  id: 'orders' | 'finance' | 'catalogs' | 'clients_reports';
  titleAr: string;
  accent: 'amber' | 'cyan' | 'purple' | 'emerald';
  items: EmployeePermissionItemMeta[];
}

export const EMPLOYEE_PERMISSION_CATEGORIES: EmployeePermissionCategoryMeta[] = [
  {
    id: 'orders',
    titleAr: '1. إدارة الشحن والطلبات',
    accent: 'amber',
    items: [
      {
        key: 'canManagePlayerIdOrders',
        labelAr: 'شحن عبر الأيدي',
        descriptionAr: 'تنفيذ وإتمام أو رفض طلبات الشحن المباشر بمعرّف اللاعب.',
        scopeNoteAr: 'تبويب طلبات الشحن',
      },
      {
        key: 'canManageAccountOrders',
        labelAr: 'شحن عبر الحساب (2FA)',
        descriptionAr: 'عرض بيانات دخول الحساب وإرسال رمز التحقق للعميل.',
        scopeNoteAr: 'تبويب طلبات الحساب',
      },
      {
        key: 'canManageVoucherOrders',
        labelAr: 'متابعة طلبات القسائم',
        descriptionAr: 'استعراض ومراجعة طلبات تسليم الأكواد والقسائم.',
        scopeNoteAr: 'طلبات القسائم والأكواد',
      },
    ],
  },
  {
    id: 'finance',
    titleAr: '2. الرصيد والحوالات والحسابات البنكية',
    accent: 'cyan',
    items: [
      {
        key: 'canReviewCashDeposits',
        labelAr: 'مراجعة الحوالات والإيداعات',
        descriptionAr: 'مطابقة إيصالات التحويل البنكي واعتماد أو رفض الإيداع.',
        scopeNoteAr: 'تبويب مراجعة الإيداعات',
      },
      {
        key: 'canReviewLoanDeposits',
        labelAr: 'مراجعة السُّلَف والسداد',
        descriptionAr: 'اعتماد طلبات الرصيد الآجل ومراجعة طلبات سداد السلف.',
        scopeNoteAr: 'تبويب سجل السلف والسداد',
      },
      {
        key: 'canManageBankAccounts',
        labelAr: 'إدارة الحسابات البنكية',
        descriptionAr: 'إضافة وتعديل الحسابات البنكية وتفويض استلام الحوالات.',
        scopeNoteAr: 'تبويب الحسابات البنكية',
      },
    ],
  },
  {
    id: 'catalogs',
    titleAr: '3. الكتالوجات والخدمات والتسعير والمخزون',
    accent: 'purple',
    items: [
      {
        key: 'canAddCatalogs',
        labelAr: 'إضافة وتعديل الكتالوجات',
        descriptionAr: 'إنشاء وتسمية وتعديل التصنيفات المخصصة للمتجر.',
        scopeNoteAr: 'الكتالوجات والخدمات',
      },
      {
        key: 'canAddServices',
        labelAr: 'إضافة وتعديل الخدمات',
        descriptionAr: 'إضافة خدمات وباقات جديدة وتحديث تفاصيلها وحالتها.',
        scopeNoteAr: 'إضافة/حذف/تعديل الخدمات',
      },
      {
        key: 'canEditServicePrices',
        labelAr: 'تحديد وتعديل الأسعار',
        descriptionAr: 'ضبط وتغيير أسعار الباقات لكل رتب العملاء (عادي - VIP).',
        scopeNoteAr: 'جدول الأسعار والرتب',
      },
      {
        key: 'canManageVoucherStock',
        labelAr: 'تغذية وإدارة مخزون الأكواد',
        descriptionAr: 'إيداع أكواد جديدة وضبط تنبيهات النقص ونشرها كخدمات.',
        scopeNoteAr: 'تبويب مخزون الأكواد',
      },
    ],
  },
  {
    id: 'clients_reports',
    titleAr: '4. العملاء والتقارير وإدارة الفريق',
    accent: 'emerald',
    items: [
      {
        key: 'canViewClients',
        labelAr: 'الاطلاع على العملاء',
        descriptionAr: 'عرض قائمة نقاط البيع والوكلاء وأرصدتهم دون تعديل.',
        scopeNoteAr: 'تبويب العملاء (قراءة)',
      },
      {
        key: 'canUpgradeClientTiers',
        labelAr: 'ترقية رتب وميزات العملاء',
        descriptionAr: 'ترقية رتبة العميل وتفعيل ميزات السلفة والبونص والهدايا.',
        scopeNoteAr: 'تعديل الرتب وروابط الدعوة',
      },
      {
        key: 'canViewReports',
        labelAr: 'عرض التقارير وكشوف الحسابات',
        descriptionAr: 'استعراض تقارير الحركات المالية وكشوف العملاء وتصدير PDF.',
        scopeNoteAr: 'تبويب التقارير وكشف الحسابات',
      },
      {
        key: 'canManageEmployees',
        labelAr: 'إدارة الموظفين والصلاحيات',
        descriptionAr: 'إضافة موظفين جدد وتفويض أو تعديل صلاحياتهم في المتجر.',
        scopeNoteAr: 'لوحة تحكم الموظفين',
      },
    ],
  },
];

export interface EmployeePermissionPreset {
  id: string;
  labelAr: string;
  descriptionAr: string;
  permissions: Partial<EmployeePermissions>;
}

export const EMPLOYEE_PERMISSION_PRESETS: EmployeePermissionPreset[] = [
  {
    id: 'orders_operator',
    labelAr: 'مسؤول تنفيذ الشحن',
    descriptionAr: 'شحن الأيدي والحسابات ومتابعة طلبات القسائم فقط',
    permissions: {
      canManagePlayerIdOrders: true,
      canManageAccountOrders: true,
      canManageVoucherOrders: true,
    },
  },
  {
    id: 'catalog_pricing',
    labelAr: 'منسق الخدمات والأسعار',
    descriptionAr: 'إضافة الكتالوجات والخدمات وتعديل الأسعار ومخزون الأكواد',
    permissions: {
      canAddCatalogs: true,
      canAddServices: true,
      canEditServicePrices: true,
      canManageVoucherStock: true,
    },
  },
  {
    id: 'finance_reports',
    labelAr: 'محاسب وتقارير',
    descriptionAr: 'مراجعة الحوالات والسلف والاطلاع على العملاء وعرض التقارير',
    permissions: {
      canReviewCashDeposits: true,
      canReviewLoanDeposits: true,
      canViewClients: true,
      canViewReports: true,
    },
  },
  {
    id: 'operations_lead',
    labelAr: 'مشرف عمليات المتجر',
    descriptionAr: 'جميع الصلاحيات التشغيلية والتقارير دون إدارة حسابات الموظفين',
    permissions: {
      canManagePlayerIdOrders: true,
      canManageAccountOrders: true,
      canManageVoucherOrders: true,
      canReviewCashDeposits: true,
      canReviewLoanDeposits: true,
      canManageBankAccounts: true,
      canAddCatalogs: true,
      canAddServices: true,
      canEditServicePrices: true,
      canManageVoucherStock: true,
      canViewClients: true,
      canUpgradeClientTiers: true,
      canViewReports: true,
      canManageEmployees: false,
    },
  },
];

export type StoreActorMatch =
  | { kind: 'owner'; supplier: Supplier }
  | { kind: 'employee'; supplier: Supplier; employee: OfficeEmployee };

export function normalizeStoreEmail(email?: string | null): string {
  return (email || '').trim().toLowerCase();
}

/**
 * Resolves whether an email belongs to a store owner OR a store employee.
 * Store owner email ALWAYS takes strict precedence over employee records.
 */
export function resolveStoreActorByEmail(
  email: string,
  suppliers: Supplier[]
): StoreActorMatch | null {
  const cleanEmail = normalizeStoreEmail(email);
  if (!cleanEmail) return null;

  // 1. Store owners ALWAYS checked first so the owner enters as owner
  const ownerSupplier = suppliers.find(
    (s) => normalizeStoreEmail(s.email) === cleanEmail
  );
  if (ownerSupplier) {
    return { kind: 'owner', supplier: ownerSupplier };
  }

  // 2. Store employees across all registered suppliers
  for (const sup of suppliers) {
    const emp = (sup.employees || []).find(
      (e) => normalizeStoreEmail(e.email) === cleanEmail
    );
    if (emp) {
      return { kind: 'employee', supplier: sup, employee: emp };
    }
  }

  return null;
}

export function isEmployeeActive(
  employee?: Pick<OfficeEmployee, 'isActive'> | null
): boolean {
  return employee?.isActive !== false;
}

export function verifyEmployeeCredentials(
  employee: OfficeEmployee | null | undefined,
  enteredPassword: string
): boolean {
  if (!employee) return false;
  const configuredPassword = (employee.password || '').trim();
  const providedPassword = (enteredPassword || '').trim();
  return configuredPassword.length > 0 && configuredPassword === providedPassword;
}

export function findEmployeeRecordForUser(
  currentUser: AuthUser | null | undefined,
  activeSupplier?: Supplier | null
): OfficeEmployee | undefined {
  if (!currentUser || !activeSupplier?.employees?.length) return undefined;
  const cleanUserEmail = normalizeStoreEmail(currentUser.email);
  return activeSupplier.employees.find(
    (e) =>
      (currentUser.employeeId && e.id === currentUser.employeeId) ||
      (cleanUserEmail && normalizeStoreEmail(e.email) === cleanUserEmail)
  );
}

export function normalizeEmployeePermissions(
  raw?: EmployeePermissions | null
): Required<EmployeePermissions> {
  if (!raw) {
    return { ...EMPTY_EMPLOYEE_PERMISSIONS };
  }

  const canManagePlayerIdOrders = Boolean(
    raw.canManagePlayerIdOrders ?? raw.canManageOrders ?? false
  );
  const canManageAccountOrders = Boolean(
    raw.canManageAccountOrders ?? raw.canManageOrders ?? false
  );
  const canManageVoucherOrders = Boolean(
    raw.canManageVoucherOrders ?? raw.canManageOrders ?? false
  );

  const canReviewCashDeposits = Boolean(
    raw.canReviewCashDeposits ?? raw.canReviewDeposits ?? false
  );
  const canReviewLoanDeposits = Boolean(
    raw.canReviewLoanDeposits ?? raw.canReviewDeposits ?? false
  );
  const canManageBankAccounts = Boolean(raw.canManageBankAccounts);

  const canAddCatalogs = Boolean(raw.canAddCatalogs ?? raw.canManageCatalogs ?? false);
  const canAddServices = Boolean(raw.canAddServices ?? raw.canManageCatalogs ?? false);
  const canEditServicePrices = Boolean(
    raw.canEditServicePrices ?? raw.canManageCatalogs ?? false
  );
  const canManageVoucherStock = Boolean(
    raw.canManageVoucherStock ?? raw.canManageCatalogs ?? false
  );

  const canViewClients = Boolean(raw.canViewClients ?? raw.canManageClients ?? false);
  const canUpgradeClientTiers = Boolean(
    raw.canUpgradeClientTiers ?? raw.canManageClients ?? false
  );
  const canViewReports = Boolean(raw.canViewReports);
  const canManageEmployees = Boolean(raw.canManageEmployees);

  return {
    canManageOrders:
      canManagePlayerIdOrders || canManageAccountOrders || canManageVoucherOrders,
    canManagePlayerIdOrders,
    canManageAccountOrders,
    canManageVoucherOrders,

    canReviewDeposits: canReviewCashDeposits || canReviewLoanDeposits,
    canReviewCashDeposits,
    canReviewLoanDeposits,
    canManageBankAccounts,

    canManageCatalogs:
      canAddCatalogs || canAddServices || canEditServicePrices,
    canAddCatalogs,
    canAddServices,
    canEditServicePrices,
    canManageVoucherStock,

    canManageClients: canViewClients || canUpgradeClientTiers,
    canViewClients,
    canUpgradeClientTiers,
    canViewReports,
    canManageEmployees,
  };
}

export function resolveEffectiveEmployeePermissions(
  currentUser: AuthUser | null | undefined,
  role: UserRole,
  activeSupplier?: Supplier | null
): Required<EmployeePermissions> {
  if (role === 'supplier' || role === 'super_admin') {
    return { ...FULL_OWNER_EMPLOYEE_PERMISSIONS };
  }
  if (role !== 'employee') {
    return { ...EMPTY_EMPLOYEE_PERMISSIONS };
  }

  const liveEmployee = findEmployeeRecordForUser(currentUser, activeSupplier);
  if (liveEmployee && !isEmployeeActive(liveEmployee)) {
    return { ...EMPTY_EMPLOYEE_PERMISSIONS };
  }
  const raw = liveEmployee?.permissions ?? currentUser?.permissions;
  return normalizeEmployeePermissions(raw);
}

/**
 * Enforces field-level service edit restrictions for employees at the state/mutation boundary:
 * - Employees with ONLY `canEditServicePrices` can modify `tierPrices` / `packageTierPrices` on existing packages
 *   without altering service metadata, catalog, delivery methods, or package structure.
 * - Employees with ONLY `canAddServices` can modify service details and package structure without altering
 *   existing package prices.
 */
export function sanitizeServiceUpdatesForEmployeePermissions(
  existingService: DigitalService,
  updates: Partial<Omit<DigitalService, 'id' | 'supplierId'>>,
  perms: Required<EmployeePermissions>,
  role: UserRole
): Partial<Omit<DigitalService, 'id' | 'supplierId'>> {
  if (role !== 'employee') {
    return updates;
  }

  const canEditDetails = Boolean(perms.canAddServices);
  const canEditPrices = Boolean(perms.canEditServicePrices);

  if (!canEditDetails && !canEditPrices) {
    return {};
  }

  if (canEditDetails && canEditPrices) {
    return updates;
  }

  const origPkgMap = new Map((existingService.packages || []).map((p) => [p.id, p]));

  if (!canEditDetails && canEditPrices) {
    // Only allow updating tierPrices & packageTierPrices on existing packages
    const incomingPkgMap = new Map((updates.packages || []).map((p) => [p.id, p]));
    return {
      packages: (existingService.packages || []).map((orig) => {
        const inc = incomingPkgMap.get(orig.id);
        if (!inc) return orig;
        return {
          ...orig,
          tierPrices: inc.tierPrices ?? orig.tierPrices,
          ...(inc.packageTierPrices || orig.packageTierPrices
            ? { packageTierPrices: inc.packageTierPrices ?? orig.packageTierPrices }
            : {}),
        };
      }),
    };
  }

  // canEditDetails && !canEditPrices: allow metadata & structure changes, preserve existing prices
  const sanitizedPackages = updates.packages
    ? updates.packages.map((pkg) => {
        const orig = origPkgMap.get(pkg.id);
        if (!orig) return pkg;
        return {
          ...pkg,
          tierPrices: orig.tierPrices,
          ...(orig.packageTierPrices ? { packageTierPrices: orig.packageTierPrices } : {}),
        };
      })
    : undefined;

  return {
    ...updates,
    ...(sanitizedPackages ? { packages: sanitizedPackages } : {}),
  };
}

export function countActiveEmployeePermissions(
  perms: Required<EmployeePermissions>
): number {
  return EMPLOYEE_PERMISSION_BADGES.reduce(
    (sum, item) => (perms[item.key] ? sum + 1 : sum),
    0
  );
}

export function isEmployeeTabAllowed(
  tab: SupplierDashboardTab,
  perms: Required<EmployeePermissions>,
  role: UserRole
): boolean {
  if (role === 'supplier' || role === 'super_admin') {
    return true;
  }
  if (role !== 'employee') {
    return false;
  }

  switch (tab) {
    case 'catalogs':
      return (
        perms.canAddCatalogs ||
        perms.canAddServices ||
        perms.canEditServicePrices
      );
    case 'pending_orders':
      return perms.canManagePlayerIdOrders || perms.canManageVoucherOrders;
    case 'account_orders':
      return perms.canManageAccountOrders;
    case 'deposits':
      return perms.canReviewCashDeposits;
    case 'loans':
      return perms.canReviewLoanDeposits;
    case 'vouchers':
      return perms.canManageVoucherStock;
    case 'clients':
      return perms.canViewClients || perms.canUpgradeClientTiers;
    case 'client_statements':
      return perms.canViewReports;
    case 'bank_accounts':
      return perms.canManageBankAccounts;
    case 'employees':
      return perms.canManageEmployees;
    case 'notifications':
      return true;
    default:
      return false;
  }
}

export const SUPPLIER_TAB_LABELS: Array<{
  tab: SupplierDashboardTab;
  labelAr: string;
}> = [
  { tab: 'catalogs', labelAr: 'الكاتالوجات والخدمات' },
  { tab: 'pending_orders', labelAr: 'طلبات الشحن والأيدي' },
  { tab: 'account_orders', labelAr: 'طلبات شحن الحساب' },
  { tab: 'deposits', labelAr: 'مراجعة الإيداعات' },
  { tab: 'loans', labelAr: 'سجل السُّلَف والسداد' },
  { tab: 'vouchers', labelAr: 'مخزون الأكواد' },
  { tab: 'clients', labelAr: 'العملاء والرتب' },
  { tab: 'client_statements', labelAr: 'التقارير وكشف الحسابات' },
  { tab: 'bank_accounts', labelAr: 'الحسابات البنكية' },
  { tab: 'employees', labelAr: 'إدارة الموظفين' },
  { tab: 'notifications', labelAr: 'الإشعارات' },
];

export function getAllowedTabsSummaryForPermissions(
  perms: Required<EmployeePermissions>
): Array<{ tab: SupplierDashboardTab; labelAr: string }> {
  return SUPPLIER_TAB_LABELS.filter((item) =>
    isEmployeeTabAllowed(item.tab, perms, 'employee')
  );
}

const TAB_PRIORITY: SupplierDashboardTab[] = [
  'pending_orders',
  'account_orders',
  'catalogs',
  'deposits',
  'loans',
  'vouchers',
  'clients',
  'client_statements',
  'bank_accounts',
  'employees',
  'notifications',
];

export function getFirstAllowedSupplierTab(
  perms: Required<EmployeePermissions>,
  role: UserRole
): SupplierDashboardTab {
  if (role === 'supplier' || role === 'super_admin') {
    return 'catalogs';
  }
  for (const tab of TAB_PRIORITY) {
    if (isEmployeeTabAllowed(tab, perms, role)) {
      return tab;
    }
  }
  return 'notifications';
}

export function isOrderVisibleToEmployee(
  order: Pick<Order, 'deliveryMethod'>,
  perms: Required<EmployeePermissions>,
  role: UserRole
): boolean {
  if (role === 'supplier' || role === 'super_admin') return true;
  if (role !== 'employee') return false;

  if (order.deliveryMethod === 'player_id') {
    return perms.canManagePlayerIdOrders;
  }
  if (order.deliveryMethod === 'account_login') {
    return perms.canManageAccountOrders;
  }
  if (order.deliveryMethod === 'voucher_code') {
    return perms.canManageVoucherOrders;
  }
  return false;
}

export function isDepositVisibleToEmployee(
  deposit: Pick<DepositRequest, 'requestType' | 'loanReason' | 'receiverEmployeeId'>,
  perms: Required<EmployeePermissions>,
  role: UserRole,
  employeeId?: string
): boolean {
  if (role === 'supplier' || role === 'super_admin') return true;
  if (role !== 'employee') return false;

  const isLoan = deposit.requestType === 'loan' || Boolean(deposit.loanReason);
  if (isLoan) {
    return perms.canReviewLoanDeposits;
  }
  return (
    perms.canReviewCashDeposits ||
    (Boolean(employeeId) && deposit.receiverEmployeeId === employeeId)
  );
}

export function filterSupplierNotificationsForEmployee(
  notifications: AppNotification[],
  perms: Required<EmployeePermissions>,
  role: UserRole
): AppNotification[] {
  if (role === 'supplier' || role === 'super_admin') return notifications;
  if (role !== 'employee') return [];

  return notifications.filter((notif) => {
    if (notif.actionTab === 'account_orders') {
      return perms.canManageAccountOrders;
    }
    if (notif.actionTab === 'pending_orders') {
      return perms.canManagePlayerIdOrders || perms.canManageVoucherOrders;
    }
    if (notif.type === 'order_status') {
      return (
        perms.canManagePlayerIdOrders ||
        perms.canManageVoucherOrders ||
        perms.canManageAccountOrders
      );
    }
    if (notif.type === 'low_stock' || notif.actionTab === 'vouchers') {
      return perms.canManageVoucherStock;
    }
    if (notif.type === 'deposit' || notif.actionTab === 'deposits') {
      return perms.canReviewCashDeposits;
    }
    if (
      notif.type === 'loan' ||
      notif.type === 'loan_repayment' ||
      notif.actionTab === 'loans'
    ) {
      return perms.canReviewLoanDeposits;
    }
    if (notif.type === 'receiver_confirmation' || notif.actionTab === 'bank_accounts') {
      return perms.canReviewCashDeposits || perms.canManageBankAccounts;
    }
    if (notif.actionTab === 'clients') {
      return perms.canViewClients || perms.canUpgradeClientTiers;
    }
    if (notif.actionTab === 'client_statements') {
      return perms.canViewReports;
    }
    if (notif.actionTab === 'employees') {
      return perms.canManageEmployees;
    }
    return true;
  });
}

export function validateOfficeEmployeeInput(
  input: {
    name: string;
    email: string;
    password?: string;
    permissions: EmployeePermissions;
    isTransferReceiverOnly?: boolean;
  },
  existingEmployees: OfficeEmployee[],
  storeOwnerEmail: string,
  restrictedEmails: string[] = [],
  editingEmpId?: string
): { valid: boolean; error?: string } {
  const name = input.name.trim();
  const email = normalizeStoreEmail(input.email);
  const password = (input.password || '').trim();
  const cleanOwnerEmail = normalizeStoreEmail(storeOwnerEmail);

  if (!name) {
    return { valid: false, error: 'يرجى إدخال اسم الموظف.' };
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, error: 'يرجى إدخال بريد إلكتروني صحيح للموظف.' };
  }

  if (cleanOwnerEmail && email === cleanOwnerEmail) {
    return {
      valid: false,
      error: 'لا يمكن استخدام البريد الإلكتروني الخاص بمالك المتجر كحساب موظف.',
    };
  }

  if (restrictedEmails.some((re) => normalizeStoreEmail(re) === email)) {
    return {
      valid: false,
      error: 'هذا البريد الإلكتروني مرتبط بحساب مالك متجر أو حساب إداري آخر.',
    };
  }

  const duplicate = existingEmployees.find(
    (e) => normalizeStoreEmail(e.email) === email && e.id !== editingEmpId
  );
  if (duplicate) {
    return {
      valid: false,
      error: 'يوجد موظف آخر مسجل مسبقاً بنفس هذا البريد الإلكتروني في المتجر.',
    };
  }

  if (!editingEmpId && password.length < 4) {
    return {
      valid: false,
      error: 'يرجى تحديد كلمة مرور للموظف (4 أحرف أو أرقام على الأقل).',
    };
  }

  if (editingEmpId && password.length > 0 && password.length < 4) {
    return {
      valid: false,
      error: 'في حال تعديل كلمة المرور، يجب أن لا تقل عن 4 أحرف أو أرقام.',
    };
  }

  const normalizedPerms = normalizeEmployeePermissions(input.permissions);
  if (
    !input.isTransferReceiverOnly &&
    countActiveEmployeePermissions(normalizedPerms) === 0
  ) {
    return {
      valid: false,
      error: 'يرجى منح صلاحية واحدة على الأقل لهذا الموظف.',
    };
  }

  return { valid: true };
}

export type SeparatedEmployeeDoc = Omit<OfficeEmployee, 'permissions'> & {
  permissionId: string;
};

/**
 * Produces a lightweight employee document for the `employees/{employeeId}` collection
 * linked to its store (`supplierId`) and detached permissions record (`permissionId`).
 */
export function buildSeparatedEmployeeDoc(
  emp: OfficeEmployee,
  nowIso: string = new Date().toISOString()
): SeparatedEmployeeDoc {
  const { permissions: _detachedPermissions, ...rest } = emp;
  return {
    ...rest,
    email: normalizeStoreEmail(emp.email),
    permissionId: emp.id,
    isActive: emp.isActive !== false,
    updatedAt: emp.updatedAt || nowIso,
  };
}

/**
 * Produces a dedicated permission record for the `employeePermissions/{employeeId}` collection
 * linked to both the employee (`employeeId`) and their store (`supplierId`).
 */
export function buildEmployeePermissionRecord(
  emp: Pick<OfficeEmployee, 'id' | 'supplierId' | 'email' | 'permissions' | 'isActive'>,
  nowIso: string = new Date().toISOString()
): EmployeePermissionRecord {
  return {
    id: emp.id,
    employeeId: emp.id,
    supplierId: emp.supplierId,
    email: normalizeStoreEmail(emp.email),
    permissions: normalizeEmployeePermissions(emp.permissions),
    isActive: emp.isActive !== false,
    updatedAt: nowIso,
  };
}

/**
 * Strips the embedded `employees` array from a Supplier document before writing to
 * `suppliers/{supplierId}` so store records remain compact and normalized.
 */
export function stripEmployeesFromSupplierForStorage(
  supplier: Supplier
): Omit<Supplier, 'employees'> {
  const { employees: _legacyEmployees, ...cleanSupplier } = supplier;
  return cleanSupplier;
}

/**
 * Hydrates an employee record by merging its separated EmployeePermissionRecord
 * (strictly matching both `employeeId` and `supplierId`).
 */
export function hydrateEmployeeWithPermissionRecord(
  employee: OfficeEmployee | SeparatedEmployeeDoc,
  permissionRecords: EmployeePermissionRecord[] = []
): OfficeEmployee {
  const matchedPerm = permissionRecords.find(
    (rec) =>
      rec &&
      (rec.employeeId === employee.id || rec.id === employee.id) &&
      (!rec.supplierId || rec.supplierId === employee.supplierId)
  );
  const rawPerms =
    matchedPerm?.permissions ??
    ('permissions' in employee ? employee.permissions : undefined);

  return {
    ...employee,
    email: normalizeStoreEmail(employee.email),
    permissionId: employee.permissionId || employee.id,
    isActive:
      matchedPerm?.isActive !== undefined
        ? matchedPerm.isActive && employee.isActive !== false
        : employee.isActive !== false,
    permissions: normalizeEmployeePermissions(rawPerms),
  };
}

/**
 * Joins normalized `suppliers`, `employees`, and `employeePermissions` collections in memory
 * so all UI views receive each store's up-to-date `employees` list without duplicating
 * employee arrays inside `suppliers/{supplierId}` in Firestore.
 * Falls back cleanly to any unmigrated legacy `supplier.employees` records.
 */
export function hydrateSuppliersWithEmployeesAndPermissions(
  rawSuppliers: Supplier[],
  employees: Array<OfficeEmployee | SeparatedEmployeeDoc> = [],
  permissionRecords: EmployeePermissionRecord[] = []
): Supplier[] {
  if (!Array.isArray(rawSuppliers)) return [];

  return rawSuppliers.map((sup) => {
    const dedicatedEmployees = employees
      .filter((e) => e && e.supplierId === sup.id)
      .map((e) => hydrateEmployeeWithPermissionRecord(e, permissionRecords));

    const legacyEmployees = Array.isArray(sup.employees)
      ? sup.employees
          .filter((e) => e && (!e.supplierId || e.supplierId === sup.id))
          .map((e) =>
            hydrateEmployeeWithPermissionRecord(
              { ...e, supplierId: sup.id },
              permissionRecords
            )
          )
      : [];

    const mergedById = new Map<string, OfficeEmployee>();
    for (const legacyEmp of legacyEmployees) {
      if (legacyEmp.id) mergedById.set(legacyEmp.id, legacyEmp);
    }
    for (const dedicatedEmp of dedicatedEmployees) {
      if (dedicatedEmp.id) mergedById.set(dedicatedEmp.id, dedicatedEmp);
    }

    return {
      ...sup,
      employees: Array.from(mergedById.values()),
    };
  });
}

/**
 * Extracts legacy embedded `supplier.employees` entries that have not yet been
 * persisted into the separated `employees` and `employeePermissions` collections.
 */
export function extractUnmigratedEmployeesFromSuppliers(
  suppliers: Supplier[],
  existingEmployees: Array<Pick<OfficeEmployee, 'id' | 'supplierId'>> = []
): OfficeEmployee[] {
  const knownKeys = new Set(
    existingEmployees.map((e) => `${e.supplierId}::${e.id}`)
  );
  const unmigrated: OfficeEmployee[] = [];

  for (const sup of suppliers || []) {
    for (const emp of sup.employees || []) {
      if (!emp?.id || !emp.email) continue;
      const scopedSupId = emp.supplierId || sup.id;
      if (!scopedSupId) continue;
      if (knownKeys.has(`${scopedSupId}::${emp.id}`)) continue;
      unmigrated.push({
        ...emp,
        supplierId: scopedSupId,
        email: normalizeStoreEmail(emp.email),
        permissions: normalizeEmployeePermissions(emp.permissions),
      });
    }
  }

  return unmigrated;
}

