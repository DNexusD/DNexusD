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
  isEmployeeActive,
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

export function isPosClientActive(
  client?: Pick<POSClient, 'isActive'> | null
): boolean {
  return client?.isActive !== false;
}

export function evaluatePosClientLoginEligibility(
  posRecords: POSClient[]
): {
  allowed: boolean;
  activeRecords: POSClient[];
  title?: string;
  error?: string;
} {
  if (!Array.isArray(posRecords) || posRecords.length === 0) {
    return { allowed: false, activeRecords: [] };
  }
  const activeRecords = posRecords.filter(isPosClientActive);
  if (activeRecords.length === 0) {
    return {
      allowed: false,
      activeRecords: [],
      title: 'حساب العميل موقوف',
      error:
        'تم إيقاف تفعيل حسابك لدى المتجر مؤقتاً. يرجى التواصل مع مالك المتجر لإعادة التفعيل.',
    };
  }
  return {
    allowed: true,
    activeRecords,
  };
}

export function findAdminAccountByEmail(
  email: string,
  adminAccounts: AdminAccount[] = []
): AdminAccount | undefined {
  const cleanEmail = normalizeStoreEmail(email);
  if (!cleanEmail) return undefined;
  return adminAccounts.find((acc) => normalizeStoreEmail(acc.email) === cleanEmail);
}

export function sortPosRecordsDeterministically(
  records: POSClient[],
  preferredPosId?: string
): POSClient[] {
  if (!Array.isArray(records) || records.length <= 1) return [...(records || [])];
  const cleanPreferred = (preferredPosId || '').trim();
  return [...records].sort((a, b) => {
    if (cleanPreferred) {
      if (a.id === cleanPreferred && b.id !== cleanPreferred) return -1;
      if (b.id === cleanPreferred && a.id !== cleanPreferred) return 1;
    }
    const dateDiff =
      (new Date(b.createdAt || 0).getTime() || 0) -
      (new Date(a.createdAt || 0).getTime() || 0);
    if (dateDiff !== 0) return dateDiff;
    return (a.id || '').localeCompare(b.id || '');
  });
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
    return sortPosRecordsDeterministically(matchedByEmail, linkedAssociatedId);
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
 * Resolves the authoritative identity strictly from fresh Firestore collections
 * and optional Firestore `users/{uid}` document — never trusting stale local role cache.
 */
export function resolveAuthoritativeIdentityFromFirestore(params: {
  email: string;
  superAdmin?: Pick<SuperAdmin, 'email' | 'adminAccounts'> | null;
  suppliers: Supplier[];
  posClients: POSClient[];
  userDoc?: AuthUser | null;
}): ResolvedAccountIdentity {
  const cleanEmail = normalizeStoreEmail(params.email);
  if (!cleanEmail) {
    return { kind: 'unregistered', email: '' };
  }

  const userDoc = params.userDoc;
  const userDocEmail = normalizeStoreEmail(userDoc?.email);
  const userDocMatchesEmail = Boolean(userDoc && (!userDocEmail || userDocEmail === cleanEmail));
  const safeLinkedAssociatedId = userDocMatchesEmail ? userDoc?.associatedId : undefined;

  const primary = resolveAccountIdentityByEmail(cleanEmail, {
    superAdmin: params.superAdmin,
    suppliers: params.suppliers,
    posClients: params.posClients,
    linkedAssociatedId: safeLinkedAssociatedId,
  });

  if (primary.kind !== 'unregistered' || !userDocMatchesEmail || !userDoc) {
    return primary;
  }

  // Fallback for legacy/UID-linked supplier or employee records whose email was blank on the sub-entity
  if (userDoc.role === 'supplier' && userDoc.associatedId) {
    const linkedSup = params.suppliers.find(
      (s) =>
        s.id === userDoc.associatedId &&
        (!s.email || normalizeStoreEmail(s.email) === cleanEmail)
    );
    if (linkedSup) {
      return {
        kind: 'supplier',
        email: cleanEmail,
        supplier: linkedSup,
      };
    }
  }

  if (userDoc.role === 'employee') {
    const targetSupId = userDoc.supplierId || userDoc.associatedId;
    const targetEmpId = userDoc.employeeId || userDoc.id;
    const linkedSup = targetSupId
      ? params.suppliers.find((s) => s.id === targetSupId)
      : undefined;
    const linkedEmp = linkedSup?.employees?.find(
      (e) =>
        e.id === targetEmpId &&
        (!e.email || normalizeStoreEmail(e.email) === cleanEmail)
    );
    if (linkedSup && linkedEmp) {
      return {
        kind: 'employee',
        email: cleanEmail,
        supplier: linkedSup,
        employee: linkedEmp,
      };
    }
  }

  return primary;
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
    const activeRecords = ownRecords.filter(isPosClientActive);
    const pool = activeRecords.length > 0 ? activeRecords : ownRecords;
    return pool.find((p) => p.id === currentPosId) || pool[0];
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
    ).filter(isPosClientActive);
    const allowedSupIds = new Set(
      ownRecords.map((p) => p.supplierId).filter(Boolean)
    );

    if (currentPos.supplierId && suppliers.some((s) => s.id === currentPos.supplierId)) {
      return suppliers.find((s) => s.id === currentPos.supplierId) || EMPTY_SUPPLIER_FALLBACK;
    }
    if (
      currentSupplierId &&
      allowedSupIds.has(currentSupplierId)
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
  if (currentUser.role === 'super_admin') {
    return true;
  }
  if (currentUser.role === 'supplier' || currentUser.role === 'employee') {
    if (!targetPosId) return true;
    const lockedSupplierId =
      currentUser.role === 'employee'
        ? currentUser.supplierId || currentUser.associatedId
        : currentUser.associatedId;
    if (!lockedSupplierId) return false;
    const targetClient = posClients.find((p) => p.id === targetPosId);
    return Boolean(targetClient && targetClient.supplierId === lockedSupplierId);
  }
  if (currentUser.role === 'pos_client') {
    const ownRecords = findPosClientsForEmail(
      currentUser.email,
      posClients,
      currentUser.associatedId
    );
    return ownRecords.some((p) => p.id === targetPosId && isPosClientActive(p));
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
    return ownRecords.some(
      (p) => p.supplierId === targetSupplierId && isPosClientActive(p)
    );
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
    const perms = isEmployeeActive(identity.employee)
      ? normalizeEmployeePermissions(identity.employee.permissions)
      : normalizeEmployeePermissions(null);
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

  // pos_client: prioritize active records so suspended stores are excluded from routing
  const activeRecords = identity.posRecords.filter(isPosClientActive);
  const candidateRecords = activeRecords.length > 0 ? activeRecords : identity.posRecords;
  const preferred =
    (options?.preferredPosId &&
      candidateRecords.find((p) => p.id === options.preferredPosId)) ||
    candidateRecords[0];
  const activeSupplierIds = Array.from(
    new Set(candidateRecords.map((p) => p.supplierId).filter(Boolean))
  );
  const activeSuppliersCount = identity.suppliers.filter((s) =>
    activeSupplierIds.includes(s.id)
  ).length;
  const requiresSupplierSelection = activeSuppliersCount > 1;
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

/**
 * Strictly filters orders belonging to a specific POS client ID.
 * Returns an empty array if posId is empty so unauthenticated/unresolved sessions never see other clients' orders.
 */
export function filterOrdersForPosClient<T extends { posId?: string }>(
  orders: T[],
  posId?: string | null
): T[] {
  const cleanPosId = typeof posId === 'string' ? posId.trim() : '';
  if (!cleanPosId || !Array.isArray(orders)) return [];
  return orders.filter((o) => o && o.posId === cleanPosId);
}

/**
 * Strictly determines whether a notification belongs to a given POS client.
 * Never returns notifications belonging to another POS client or another store.
 */
export function isNotificationForPosClient(
  notif: { posId?: string; supplierId?: string; targetRole?: string } | null | undefined,
  posId?: string | null,
  supplierId?: string | null
): boolean {
  const cleanPosId = typeof posId === 'string' ? posId.trim() : '';
  if (!notif || !cleanPosId) return false;
  if (notif.targetRole === 'supplier') return false;

  if (notif.posId) {
    return notif.posId === cleanPosId;
  }

  // Broadcast POS notifications without a specific posId must explicitly target POS clients and match the client's supplier if specified
  if (notif.targetRole !== 'pos') return false;
  const cleanSupId = typeof supplierId === 'string' ? supplierId.trim() : '';
  if (notif.supplierId && cleanSupId && notif.supplierId !== cleanSupId) {
    return false;
  }
  return true;
}

export function filterNotificationsForPosClient<
  T extends { posId?: string; supplierId?: string; targetRole?: string }
>(notifications: T[], posId?: string | null, supplierId?: string | null): T[] {
  if (!Array.isArray(notifications)) return [];
  return notifications.filter((n) => isNotificationForPosClient(n, posId, supplierId));
}

export function evaluateEmployeeLoginEligibility(
  supplier: Pick<Supplier, 'isActive'>,
  employee: Pick<OfficeEmployee, 'isActive'>
): { allowed: boolean; title?: string; error?: string } {
  if (supplier?.isActive === false) {
    return {
      allowed: false,
      title: 'المتجر موقوف من الإدارة',
      error: 'تم إيقاف المتجر التابع له هذا الحساب من قِبل مدير التطبيق. يرجى التواصل مع إدارة المنصة.',
    };
  }
  if (!isEmployeeActive(employee)) {
    return {
      allowed: false,
      title: 'حساب الموظف موقوف',
      error: 'تم إيقاف صلاحية دخول هذا الموظف مؤقتاً من قِبل مالك المتجر. يرجى مراجعة مالك المتجر لإعادة التفعيل.',
    };
  }
  return { allowed: true };
}

export type OrphanedAuthRecoveryDecision =
  | { action: 'reject_admin' }
  | { action: 'restore_supplier'; supplier: Supplier }
  | { action: 'restore_pos_client'; posClient: POSClient }
  | { action: 'needs_profile_completion'; email: string };

/**
 * Safely decides how to handle a user who passed Firebase Authentication
 * (`signInWithEmailAndPassword`) while having no matching Supplier/POSClient
 * document in Firestore (e.g., after a database reset or incomplete registration).
 * Never promotes anyone to super_admin or employee.
 */
export function resolveOrphanedAuthRecovery(params: {
  email: string;
  uid: string;
  displayName?: string | null;
  phone?: string | null;
  userDoc?: AuthUser | null;
  existingClients?: POSClient[];
  suppliers: Supplier[];
  superAdmin?: Pick<SuperAdmin, 'email' | 'adminAccounts'> | null;
}): OrphanedAuthRecoveryDecision {
  const cleanEmail = normalizeStoreEmail(params.email);
  if (!cleanEmail) {
    return { action: 'needs_profile_completion', email: '' };
  }

  if (
    isMasterAdminEmail(cleanEmail, params.superAdmin?.email) ||
    params.userDoc?.role === 'super_admin' ||
    findAdminAccountByEmail(cleanEmail, params.superAdmin?.adminAccounts || [])
  ) {
    return { action: 'reject_admin' };
  }

  const matchedClients = (params.existingClients || []).filter(
    (p) => normalizeStoreEmail(p.email) === cleanEmail
  );
  if (matchedClients.length > 0) {
    return { action: 'restore_pos_client', posClient: matchedClients[0] };
  }

  const userDoc = params.userDoc;
  const userDocEmail = normalizeStoreEmail(userDoc?.email);
  const userDocMatchesEmail = Boolean(userDoc && (!userDocEmail || userDocEmail === cleanEmail));

  if (userDocMatchesEmail && userDoc?.role === 'supplier') {
    const preferredSupId = userDoc.associatedId || `sup-${params.uid}`;
    const conflictingSupplier = params.suppliers.find(
      (s) =>
        s.id === preferredSupId &&
        Boolean(s.email) &&
        normalizeStoreEmail(s.email) !== cleanEmail
    );
    if (!conflictingSupplier) {
      const displayName =
        (userDoc.name || params.displayName || '').trim() || cleanEmail.split('@')[0] || 'متجر جديد';
      const restoredSupplier: Supplier = {
        id: preferredSupId,
        name: displayName,
        storeName: `متجر ${displayName}`,
        phone: (userDoc.phone || params.phone || '').trim() || '+966 50 000 0000',
        email: cleanEmail,
        feePercentage: 1.0,
        fixedFeeAmount: 0,
        feeType: 'percentage',
        walletBalance: 0,
        bankAccountDetails: {
          bankName: 'مصرف الراجحي',
          accountHolder: displayName,
          iban: 'SA4480000123608010123456',
          accountNumber: '123608010123456',
        },
        createdAt: new Date().toISOString().substring(0, 10),
      };
      return { action: 'restore_supplier', supplier: restoredSupplier };
    }
  }

  if (userDocMatchesEmail && userDoc?.role === 'pos_client') {
    const preferredSupId =
      userDoc.supplierId && params.suppliers.some((s) => s.id === userDoc.supplierId)
        ? userDoc.supplierId
        : '';

    if (preferredSupId) {
      const displayName =
        (userDoc.name || params.displayName || '').trim() || cleanEmail.split('@')[0] || 'عميل';
      const numericSuffix = Math.floor(10000 + Math.random() * 90000);
      const newPosCode = `POS-${numericSuffix}`;
      const restoredClient: POSClient = {
        id: userDoc.associatedId || `pos-${params.uid}`,
        posCode: newPosCode,
        tradeName: `متجر ${displayName}`,
        ownerName: displayName,
        phone: (userDoc.phone || params.phone || '').trim() || '+966 55 000 0000',
        email: cleanEmail,
        country: 'المملكة العربية السعودية',
        city: 'الرياض',
        supplierId: preferredSupId,
        tier: 'regular',
        walletBalance: 0,
        totalSpent: 0,
        ordersCount: 0,
        createdAt: new Date().toISOString().substring(0, 10),
        qrCodeValue: `DIGIPOS:${newPosCode}`,
      };
      return { action: 'restore_pos_client', posClient: restoredClient };
    }
  }

  return { action: 'needs_profile_completion', email: cleanEmail };
}

export function mapUnregisteredFirebaseAuthLoginErrorAr(errorCode?: string): {
  title: string;
  error: string;
} {
  switch (errorCode) {
    case 'auth/wrong-password':
      return {
        title: 'كلمة المرور غير صحيحة',
        error:
          'هذا البريد الإلكتروني مسجل في نظام التوثيق، لكن كلمة المرور المدخلة غير صحيحة. يمكنك استخدام «نسيت كلمة المرور» لإعادة تعيينها.',
      };
    case 'auth/user-not-found':
      return {
        title: 'الحساب غير مسجل',
        error:
          'هذا البريد الإلكتروني غير مسجل في المنصة. يرجى التحقق من البريد أو إنشاء حساب جديد.',
      };
    case 'auth/too-many-requests':
      return {
        title: 'محاولات دخول متكررة',
        error:
          'تم إيقاف محاولات الدخول مؤقتاً لكثرة المحاولات الخاطئة. يرجى الانتظار قليلاً أو استخدام «نسيت كلمة المرور».',
      };
    case 'auth/invalid-credential':
    default:
      return {
        title: 'تعذر التحقق من الحساب',
        error:
          'البريد الإلكتروني غير مسجل في قاعدة بيانات المتاجر/العملاء أو كلمة المرور غير صحيحة. إذا سبق لك التسجيل بهذا البريد وتظهر لك رسالة أنه مسجل عند إنشاء حساب جديد، استخدم «نسيت كلمة المرور» أو أكمل التسجيل بنفس كلمة المرور من تبويب «إنشاء حساب جديد».',
      };
  }
}
