import {
  AdminAccount,
  AuthUser,
  OfficeEmployee,
  POSClient,
  SuperAdmin,
  Supplier,
  UserRole,
} from '../types';
import {
  normalizeEmployeePermissions,
  normalizeStoreEmail,
  resolveStoreActorByEmail,
} from './employeePermissions';
import {
  EMPTY_POS_FALLBACK,
  EMPTY_SUPPLIER_FALLBACK,
  MASTER_ADMIN_EMAILS,
} from './systemReset';

export type ResolvedAccountIdentity =
  | {
      kind: 'sub_admin';
      email: string;
      adminAccount: AdminAccount;
    }
  | {
      kind: 'supplier';
      email: string;
      supplier: Supplier;
    }
  | {
      kind: 'employee';
      email: string;
      supplier: Supplier;
      employee: OfficeEmployee;
    }
  | {
      kind: 'master_admin';
      email: string;
    }
  | {
      kind: 'pos_client';
      email: string;
      posRecords: POSClient[];
      suppliers: Supplier[];
    }
  | {
      kind: 'unregistered';
      email: string;
    };

/**
 * Strict exact-match check for platform master administrator emails.
 * Never infers admin privileges from email substrings like "admin" or "super".
 */
export function isMasterAdminEmail(
  email?: string | null,
  configuredSuperAdminEmail?: string | null
): boolean {
  const cleanEmail = normalizeStoreEmail(email);
  if (!cleanEmail) return false;

  if (MASTER_ADMIN_EMAILS.some((e) => normalizeStoreEmail(e) === cleanEmail)) {
    return true;
  }

  const cleanConfigured = normalizeStoreEmail(configuredSuperAdminEmail);
  return Boolean(cleanConfigured && cleanEmail === cleanConfigured);
}

export function findAdminAccountByEmail(
  email: string,
  adminAccounts: AdminAccount[] = []
): AdminAccount | undefined {
  const cleanEmail = normalizeStoreEmail(email);
  if (!cleanEmail) return undefined;
  return adminAccounts.find((acc) => normalizeStoreEmail(acc.email) === cleanEmail);
}

export function findPosClientsForEmail(
  email: string,
  posClients: POSClient[] = [],
  linkedAssociatedId?: string
): POSClient[] {
  const cleanEmail = normalizeStoreEmail(email);
  if (!cleanEmail) return [];

  const matchedByEmail = posClients.filter(
    (p) => normalizeStoreEmail(p.email) === cleanEmail
  );
  if (matchedByEmail.length > 0) {
    return matchedByEmail;
  }

  // Legacy record recovery: only match by linkedAssociatedId if that record has no conflicting email
  if (linkedAssociatedId) {
    const byId = posClients.find(
      (p) =>
        p.id === linkedAssociatedId &&
        (!p.email || normalizeStoreEmail(p.email) === cleanEmail)
    );
    if (byId) return [byId];
  }

  return [];
}

/**
 * Resolves the exact authenticated account identity for an email address.
 * Never falls back to another person's POS client or another merchant's store.
 */
export function resolveAccountIdentityByEmail(
  email: string,
  params: {
    superAdmin?: Pick<SuperAdmin, 'email' | 'adminAccounts'> | null;
    suppliers: Supplier[];
    posClients: POSClient[];
    linkedAssociatedId?: string;
  }
): ResolvedAccountIdentity {
  const cleanEmail = normalizeStoreEmail(email);
  if (!cleanEmail) {
    return { kind: 'unregistered', email: '' };
  }

  const adminAccounts = params.superAdmin?.adminAccounts || [];

  // 1. Sub-admin accounts explicitly defined by Super Admin
  const matchedAdminAcc = findAdminAccountByEmail(cleanEmail, adminAccounts);
  if (matchedAdminAcc) {
    return {
      kind: 'sub_admin',
      email: cleanEmail,
      adminAccount: matchedAdminAcc,
    };
  }

  // 2 & 3. Store owner (strict precedence) or store employee
  const storeActor = resolveStoreActorByEmail(cleanEmail, params.suppliers);
  if (storeActor?.kind === 'owner') {
    return {
      kind: 'supplier',
      email: cleanEmail,
      supplier: storeActor.supplier,
    };
  }
  if (storeActor?.kind === 'employee') {
    return {
      kind: 'employee',
      email: cleanEmail,
      supplier: storeActor.supplier,
      employee: storeActor.employee,
    };
  }

  // 4. Master Super Admin (exact email match only)
  if (isMasterAdminEmail(cleanEmail, params.superAdmin?.email)) {
    return {
      kind: 'master_admin',
      email: cleanEmail,
    };
  }

  // 5. POS Client records strictly owned by this email
  const posRecords = findPosClientsForEmail(
    cleanEmail,
    params.posClients,
    params.linkedAssociatedId
  );
  if (posRecords.length > 0) {
    const registeredSupplierIds = Array.from(
      new Set(posRecords.map((p) => p.supplierId).filter(Boolean))
    );
    const clientSuppliers = params.suppliers.filter((s) =>
      registeredSupplierIds.includes(s.id)
    );
    return {
      kind: 'pos_client',
      email: cleanEmail,
      posRecords,
      suppliers: clientSuppliers,
    };
  }

  return { kind: 'unregistered', email: cleanEmail };
}

/**
 * Resolves the active POSClient strictly scoped to the logged-in user.
 * When authenticated as pos_client, NEVER falls back to posClients[0] (another user).
 */
export function resolveScopedCurrentPos(params: {
  isAuthenticated: boolean;
  role: UserRole;
  currentUser: AuthUser | null | undefined;
  currentPosId: string;
  posClients: POSClient[];
}): POSClient {
  const { isAuthenticated, role, currentUser, currentPosId, posClients } = params;

  if (isAuthenticated && role === 'pos_client') {
    if (!currentUser) return EMPTY_POS_FALLBACK;
    const ownRecords = findPosClientsForEmail(
      currentUser.email,
      posClients,
      currentUser.associatedId
    );
    if (ownRecords.length === 0) {
      return EMPTY_POS_FALLBACK;
    }
    return ownRecords.find((p) => p.id === currentPosId) || ownRecords[0];
  }

  return (
    posClients.find((p) => p.id === currentPosId) ||
    posClients[0] ||
    EMPTY_POS_FALLBACK
  );
}

/**
 * Resolves the active Supplier strictly scoped to the logged-in user.
 * For supplier owners and store employees, NEVER falls back to another merchant's store.
 */
export function resolveScopedSupplier(params: {
  isAuthenticated: boolean;
  role: UserRole;
  currentUser: AuthUser | null | undefined;
  currentSupplierId: string;
  currentPos: POSClient;
  suppliers: Supplier[];
  posClients: POSClient[];
}): Supplier {
  const {
    isAuthenticated,
    role,
    currentUser,
    currentSupplierId,
    currentPos,
    suppliers,
    posClients,
  } = params;

  if (isAuthenticated && (role === 'supplier' || role === 'employee')) {
    if (!currentUser) return EMPTY_SUPPLIER_FALLBACK;
    const targetSupplierId =
      role === 'employee'
        ? currentUser.supplierId || currentUser.associatedId || ''
        : currentUser.associatedId || '';

    if (targetSupplierId) {
      const exactById = suppliers.find((s) => s.id === targetSupplierId);
      if (exactById) return exactById;
    }

    if (role === 'supplier') {
      const cleanEmail = normalizeStoreEmail(currentUser.email);
      const exactByEmail = suppliers.find(
        (s) => normalizeStoreEmail(s.email) === cleanEmail
      );
      if (exactByEmail) return exactByEmail;
    }

    return EMPTY_SUPPLIER_FALLBACK;
  }

  if (isAuthenticated && role === 'pos_client') {
    const cleanEmail = normalizeStoreEmail(currentUser?.email);
    const ownRecords = findPosClientsForEmail(
      cleanEmail,
      posClients,
      currentUser?.associatedId
    );
    const allowedSupIds = new Set(
      ownRecords.map((p) => p.supplierId).filter(Boolean)
    );

    if (currentPos.supplierId && suppliers.some((s) => s.id === currentPos.supplierId)) {
      return suppliers.find((s) => s.id === currentPos.supplierId) || EMPTY_SUPPLIER_FALLBACK;
    }
    if (
      currentSupplierId &&
      (allowedSupIds.size === 0 || allowedSupIds.has(currentSupplierId))
    ) {
      const matched = suppliers.find((s) => s.id === currentSupplierId);
      if (matched) return matched;
    }
    const firstAllowed = suppliers.find((s) => allowedSupIds.has(s.id));
    if (firstAllowed) return firstAllowed;
    return EMPTY_SUPPLIER_FALLBACK;
  }

  return (
    suppliers.find((s) => s.id === currentSupplierId) ||
    suppliers[0] ||
    EMPTY_SUPPLIER_FALLBACK
  );
}

/**
 * Guard against switching to another person's POS client record while authenticated.
 */
export function canSwitchToPosClient(params: {
  isAuthenticated: boolean;
  currentUser: AuthUser | null | undefined;
  targetPosId: string;
  posClients: POSClient[];
}): boolean {
  const { isAuthenticated, currentUser, targetPosId, posClients } = params;
  if (!isAuthenticated || !currentUser) return true;
  if (currentUser.role === 'super_admin' || currentUser.role === 'supplier' || currentUser.role === 'employee') {
    return true;
  }
  if (currentUser.role === 'pos_client') {
    const ownRecords = findPosClientsForEmail(
      currentUser.email,
      posClients,
      currentUser.associatedId
    );
    return ownRecords.some((p) => p.id === targetPosId);
  }
  return false;
}

/**
 * Guard against switching to another merchant's store while authenticated.
 */
export function canSwitchToSupplier(params: {
  isAuthenticated: boolean;
  currentUser: AuthUser | null | undefined;
  targetSupplierId: string;
  posClients: POSClient[];
}): boolean {
  const { isAuthenticated, currentUser, targetSupplierId, posClients } = params;
  if (!isAuthenticated || !currentUser) return true;

  if (currentUser.role === 'super_admin') {
    return true;
  }

  if (currentUser.role === 'supplier') {
    return Boolean(currentUser.associatedId && currentUser.associatedId === targetSupplierId);
  }

  if (currentUser.role === 'employee') {
    const lockedId = currentUser.supplierId || currentUser.associatedId;
    return Boolean(lockedId && lockedId === targetSupplierId);
  }

  if (currentUser.role === 'pos_client') {
    const ownRecords = findPosClientsForEmail(
      currentUser.email,
      posClients,
      currentUser.associatedId
    );
    return ownRecords.some((p) => p.supplierId === targetSupplierId);
  }

  return false;
}

/**
 * Guard against changing the active role while authenticated.
 */
export function canSwitchRole(params: {
  isAuthenticated: boolean;
  currentUser: AuthUser | null | undefined;
  nextRole: UserRole;
}): boolean {
  const { isAuthenticated, currentUser, nextRole } = params;
  if (!isAuthenticated || !currentUser) return true;
  return currentUser.role === nextRole;
}

/**
 * Checks if an email is available for creating a new POS client or Supplier account
 * without colliding with an existing account of a different role.
 */
export function checkEmailRegistrationConflict(params: {
  email: string;
  desiredRole: 'pos_client' | 'supplier';
  superAdmin?: Pick<SuperAdmin, 'email' | 'adminAccounts'> | null;
  suppliers: Supplier[];
  posClients: POSClient[];
  targetSupplierId?: string;
}): { conflict: boolean; error?: string } {
  const cleanEmail = normalizeStoreEmail(params.email);
  if (!cleanEmail) {
    return { conflict: true, error: 'يرجى إدخال بريد إلكتروني صحيح.' };
  }

  if (isMasterAdminEmail(cleanEmail, params.superAdmin?.email)) {
    return {
      conflict: true,
      error: 'هذا البريد الإلكتروني مخصص للإدارة ولا يمكن التسجيل به.',
    };
  }

  if (findAdminAccountByEmail(cleanEmail, params.superAdmin?.adminAccounts || [])) {
    return {
      conflict: true,
      error: 'هذا البريد الإلكتروني مسجل مسبقاً كحساب إداري. يرجى تسجيل الدخول مباشرة.',
    };
  }

  const storeActor = resolveStoreActorByEmail(cleanEmail, params.suppliers);
  if (storeActor?.kind === 'owner') {
    return {
      conflict: true,
      error: 'هذا البريد الإلكتروني مسجل بالفعل لحساب متجر. يرجى تسجيل الدخول به.',
    };
  }
  if (storeActor?.kind === 'employee') {
    return {
      conflict: true,
      error: 'هذا البريد الإلكتروني مسجل بالفعل لحساب موظف متجر. يرجى تسجيل الدخول به.',
    };
  }

  const existingPos = findPosClientsForEmail(cleanEmail, params.posClients);
  if (existingPos.length > 0) {
    if (params.desiredRole === 'supplier') {
      return {
        conflict: true,
        error: 'هذا البريد الإلكتروني مسجل مسبقاً كحساب عميل نقطة بيع. يرجى استخدام بريد آخر لإنشاء متجر.',
      };
    }
    const cleanTargetSupId = (params.targetSupplierId || '').trim();
    if (!cleanTargetSupId || existingPos.some((p) => p.supplierId === cleanTargetSupId)) {
      return {
        conflict: true,
        error: 'هذا البريد الإلكتروني مسجل بالفعل لدى هذا المتجر. يرجى تسجيل الدخول مباشرة.',
      };
    }
  }

  return { conflict: false };
}

/**
 * Builds an AuthUser strictly from a resolved account identity.
 */
export function buildAuthUserFromIdentity(
  identity: Exclude<ResolvedAccountIdentity, { kind: 'unregistered' }>,
  options?: { uid?: string; phone?: string; masterAdminName?: string; preferredPosId?: string }
): {
  authUser: AuthUser;
  role: UserRole;
  supplierId: string;
  posId: string;
  requiresSupplierSelection: boolean;
} {
  if (identity.kind === 'sub_admin') {
    const acc = identity.adminAccount;
    return {
      role: 'super_admin',
      supplierId: '',
      posId: '',
      requiresSupplierSelection: false,
      authUser: {
        id: options?.uid || acc.id,
        email: identity.email,
        name: acc.name,
        role: 'super_admin',
        phone: acc.phone || options?.phone,
        associatedId: 'admin',
        adminAccountId: acc.id,
        roleTitle: acc.roleTitle,
        adminPermissions: acc.permissions,
      },
    };
  }

  if (identity.kind === 'supplier') {
    return {
      role: 'supplier',
      supplierId: identity.supplier.id,
      posId: '',
      requiresSupplierSelection: false,
      authUser: {
        id: options?.uid || `sup-usr-${identity.supplier.id}`,
        email: identity.email,
        name: identity.supplier.name,
        role: 'supplier',
        phone: identity.supplier.phone || options?.phone,
        associatedId: identity.supplier.id,
      },
    };
  }

  if (identity.kind === 'employee') {
    const perms = normalizeEmployeePermissions(identity.employee.permissions);
    return {
      role: 'employee',
      supplierId: identity.supplier.id,
      posId: '',
      requiresSupplierSelection: false,
      authUser: {
        id: identity.employee.id,
        email: identity.email,
        name: identity.employee.name,
        role: 'employee',
        phone: identity.employee.phone || options?.phone,
        associatedId: identity.supplier.id,
        supplierId: identity.supplier.id,
        employeeId: identity.employee.id,
        roleTitle: identity.employee.roleTitle,
        permissions: perms,
      },
    };
  }

  if (identity.kind === 'master_admin') {
    return {
      role: 'super_admin',
      supplierId: '',
      posId: '',
      requiresSupplierSelection: false,
      authUser: {
        id: options?.uid || 'usr-master-admin',
        email: identity.email,
        name: options?.masterAdminName || 'الإدارة العامة للمنصة',
        role: 'super_admin',
        phone: options?.phone,
        associatedId: 'admin',
      },
    };
  }

  // pos_client
  const preferred =
    (options?.preferredPosId &&
      identity.posRecords.find((p) => p.id === options.preferredPosId)) ||
    identity.posRecords[0];
  const requiresSupplierSelection = identity.suppliers.length > 1;
  return {
    role: 'pos_client',
    supplierId: preferred.supplierId || identity.suppliers[0]?.id || '',
    posId: preferred.id,
    requiresSupplierSelection,
    authUser: {
      id: options?.uid || `pos-usr-${preferred.id}`,
      email: identity.email,
      name: preferred.ownerName || preferred.tradeName,
      role: 'pos_client',
      phone: preferred.phone || options?.phone,
      associatedId: preferred.id,
    },
  };
}
