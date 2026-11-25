import {
  AuthUser,
  Catalog,
  POSClient,
  SuperAdmin,
  Supplier,
} from '../types';

export const CLEAN_BOOT_STORAGE_FLAG = 'digipos_clean_boot_v2';

export const MOCK_SUPER_ADMIN_IBAN = 'SA0310000001234567890123';

export const MASTER_ADMIN_EMAILS: readonly string[] = [
  'admin@digipos-platform.com',
  'jmiyemen66@gmail.com',
];

export const RESET_LOCAL_STORAGE_KEYS_TO_CLEAR: readonly string[] = [
  'digipos_clients_v2',
  'digipos_suppliers_v2',
  'digipos_services_v2',
  'digipos_voucher_warehouses_v1',
  'digipos_deposits_v2',
  'digipos_loan_repayments_v1',
  'digipos_supplier_bank_accounts_v1',
  'digipos_orders_v2',
  'digipos_accounting_v2',
  'digipos_admin_accounting_v2',
  'digipos_invites_v2',
  'digipos_notifications_v2',
  'digipos_notifications_v1',
  'digipos_gift_catalog_seeded_v1',
  'digipos_live_supplier_reply',
];

export const FIRESTORE_COLLECTIONS_TO_CLEAR: readonly string[] = [
  'services',
  'voucherWarehouses',
  'suppliers',
  'employees',
  'employeePermissions',
  'posClients',
  'supplierBankAccounts',
  'orders',
  'depositRequests',
  'loanRepaymentRequests',
  'accountingEntries',
  'adminAccountingEntries',
  'balanceTransfers',
  'inviteLinks',
  'notifications',
];

export const EMPTY_SUPPLIER_FALLBACK: Supplier = {
  id: '',
  name: 'لا يوجد متجر مسجل',
  storeName: 'لا يوجد متجر مسجل',
  phone: '',
  email: '',
  feePercentage: 0,
  fixedFeeAmount: 0,
  feeType: 'percentage',
  walletBalance: 0,
  bankAccountDetails: {
    bankName: '',
    accountHolder: '',
    iban: '',
    accountNumber: '',
  },
  createdAt: '',
  employees: [],
};

export const EMPTY_POS_FALLBACK: POSClient = {
  id: '',
  posCode: '',
  tradeName: 'لا يوجد عميل مسجل',
  ownerName: '',
  phone: '',
  country: '',
  city: '',
  supplierId: '',
  tier: 'regular',
  walletBalance: 0,
  totalSpent: 0,
  ordersCount: 0,
  createdAt: '',
  qrCodeValue: '',
};

export interface SuperAdminIdentityContext {
  email?: string;
  adminAccounts?: Array<{ id?: string; email?: string }>;
}

export function isPreservedAdminAuthUser(
  user: Partial<AuthUser> | null | undefined,
  superAdmin?: SuperAdminIdentityContext | null
): boolean {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  if (typeof user.adminAccountId === 'string' && user.adminAccountId.trim().length > 0) {
    return true;
  }
  if (typeof user.id === 'string' && user.id.startsWith('adm-')) {
    return true;
  }

  const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
  if (!email) return false;

  if (MASTER_ADMIN_EMAILS.includes(email)) {
    return true;
  }

  const superAdminEmail = superAdmin?.email?.trim().toLowerCase();
  if (superAdminEmail && email === superAdminEmail) {
    return true;
  }

  const staffAccounts = Array.isArray(superAdmin?.adminAccounts)
    ? superAdmin.adminAccounts
    : [];
  return staffAccounts.some(
    (acc) => acc?.email && acc.email.trim().toLowerCase() === email
  );
}

export function filterPreservedFixedCatalogs(catalogs: Catalog[]): Catalog[] {
  if (!Array.isArray(catalogs)) return [];
  return catalogs.filter((cat) =>
    Boolean(cat && (cat.isFixedByAdmin === true || cat.supplierId === 'all'))
  );
}

export function mergeSuperAdminAccountsForPreservation(
  localAdmin?: Partial<SuperAdmin> | null,
  remoteAdmin?: Partial<SuperAdmin> | null
): SuperAdminIdentityContext {
  const email = remoteAdmin?.email || localAdmin?.email || MASTER_ADMIN_EMAILS[0];
  const mergedAccounts = [
    ...(Array.isArray(localAdmin?.adminAccounts) ? localAdmin.adminAccounts : []),
    ...(Array.isArray(remoteAdmin?.adminAccounts) ? remoteAdmin.adminAccounts : []),
  ];
  return {
    email,
    adminAccounts: mergedAccounts,
  };
}

export function sanitizeSuperAdminForCleanReset<T extends Partial<SuperAdmin>>(
  admin: T
): T {
  const existingBanks = Array.isArray(admin.bankAccounts) ? admin.bankAccounts : [];
  const realBanks = existingBanks.filter(
    (b) => b && b.iban?.trim() !== MOCK_SUPER_ADMIN_IBAN
  );
  return {
    ...admin,
    walletBalance: 0,
    bankAccounts: realBanks,
  };
}

export interface MinimalStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function sanitizeLocalStorageForCleanReset(
  storage: MinimalStorage,
  superAdminOverride?: SuperAdminIdentityContext | null
): {
  preservedAdminSession: boolean;
  preservedFixedCatalogsCount: number;
} {
  let effectiveAdmin = superAdminOverride;
  try {
    const rawAdmin = storage.getItem('digipos_admin_v2');
    if (rawAdmin) {
      const parsedAdmin = JSON.parse(rawAdmin) as Partial<SuperAdmin>;
      const sanitizedAdmin = sanitizeSuperAdminForCleanReset(parsedAdmin);
      storage.setItem('digipos_admin_v2', JSON.stringify(sanitizedAdmin));
      if (!effectiveAdmin) {
        effectiveAdmin = sanitizedAdmin;
      }
    }
  } catch {
    if (!effectiveAdmin) {
      effectiveAdmin = null;
    }
  }

  for (const key of RESET_LOCAL_STORAGE_KEYS_TO_CLEAR) {
    storage.removeItem(key);
  }
  storage.removeItem('digipos_clean_boot_v1');

  // Keep only fixed catalogs created by Super Admin
  let preservedFixedCatalogsCount = 0;
  try {
    const rawCatalogs = storage.getItem('digipos_catalogs_v2');
    if (rawCatalogs) {
      const parsed = JSON.parse(rawCatalogs) as Catalog[];
      const fixedOnly = filterPreservedFixedCatalogs(parsed);
      preservedFixedCatalogsCount = fixedOnly.length;
      if (fixedOnly.length > 0) {
        storage.setItem('digipos_catalogs_v2', JSON.stringify(fixedOnly));
      } else {
        storage.removeItem('digipos_catalogs_v2');
      }
    }
  } catch {
    storage.removeItem('digipos_catalogs_v2');
  }

  // Preserve authenticated session only if user is Super Admin or Super Admin staff
  let preservedAdminSession = false;
  try {
    const rawUser = storage.getItem('digipos_auth_user');
    if (rawUser) {
      const parsedUser = JSON.parse(rawUser) as Partial<AuthUser>;
      if (isPreservedAdminAuthUser(parsedUser, effectiveAdmin)) {
        preservedAdminSession = true;
      } else {
        storage.removeItem('digipos_auth_user');
      }
    }
  } catch {
    storage.removeItem('digipos_auth_user');
  }

  return {
    preservedAdminSession,
    preservedFixedCatalogsCount,
  };
}

export function ensureCleanBootLocalStorageOnce(
  storage: MinimalStorage
): { didRun: boolean; preservedAdminSession: boolean } {
  if (storage.getItem(CLEAN_BOOT_STORAGE_FLAG) === '1') {
    return { didRun: false, preservedAdminSession: false };
  }
  const result = sanitizeLocalStorageForCleanReset(storage);
  storage.setItem(CLEAN_BOOT_STORAGE_FLAG, '1');
  return {
    didRun: true,
    preservedAdminSession: result.preservedAdminSession,
  };
}
