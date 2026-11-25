import {
  collection,
  doc,
  getDoc,
  getDocFromCache,
  getDocFromServer,
  getDocs,
  getDocsFromCache,
  getDocsFromServer,
  query,
  where,
  limit,
  setDoc,
  updateDoc,
  deleteField,
  deleteDoc,
  writeBatch,
  DocumentReference,
  Query
} from 'firebase/firestore';
import {
  db,
  auth,
  handleFirestoreError,
  OperationType,
  isTransientFirestoreError,
  recoverFirestoreInstance
} from './firebase';
import {
  isFirestoreCacheMissError,
  isFirestoreInternalAssertionError,
  isNavigatorOffline,
} from '../utils/firestoreConnectivity';
import {
  POSClient,
  Supplier,
  SuperAdmin,
  Catalog,
  DigitalService,
  DepositRequest,
  LoanRepaymentRequest,
  Order,
  AccountingEntry,
  AdminAccountingEntry,
  BalanceTransfer,
  InviteLink,
  AuthUser,
  SupplierBankAccount,
  PlatformInterfaceSettings,
  VoucherWarehouse,
  OfficeEmployee,
  EmployeePermissionRecord,
  AppNotification
} from '../types';
import {
  FIRESTORE_COLLECTIONS_TO_CLEAR,
  isPreservedAdminAuthUser,
  mergeSuperAdminAccountsForPreservation,
  sanitizeSuperAdminForCleanReset
} from '../utils/systemReset';
import {
  clearEntityPendingSync,
  FullDatabaseSnapshot,
  markEntityPendingSync
} from '../utils/localFirestoreSync';
import {
  buildEmployeePermissionRecord,
  buildSeparatedEmployeeDoc,
  extractUnmigratedEmployeesFromSuppliers,
  getSupplierIdsWithLegacyEmployeesField,
  hydrateEmployeeWithPermissionRecord,
  hydrateSuppliersWithEmployeesAndPermissions,
  normalizeEmployeePermissions,
  normalizeStoreEmail,
  resolveStoreActorByEmail,
  stripEmployeesFromSupplierForStorage
} from '../utils/employeePermissions';
import {
  filterNotificationsForPosClient,
  findAdminAccountByEmail,
  findMatchingPosClientRecord,
  isLegacyPrefixedUserId,
  isMasterAdminEmail,
  normalizePhoneForMatch,
  resolveAuthoritativeIdentityFromFirestore
} from '../utils/accountAuth';

export interface ScopedLoginData {
  platformSettings: Partial<PlatformInterfaceSettings> | null;
  storePosClients?: POSClient[];
  catalogs: Catalog[];
  services: DigitalService[];
  voucherWarehouses: VoucherWarehouse[];
  supplierBankAccounts: SupplierBankAccount[];
  orders: Order[];
  depositRequests: DepositRequest[];
  loanRepaymentRequests: LoanRepaymentRequest[];
  accountingEntries: AccountingEntry[];
  inviteLinks: InviteLink[];
  notifications: AppNotification[];
}

function sanitizeData<T>(obj: T): T {
  if (obj === undefined || obj === null) return obj;
  return JSON.parse(JSON.stringify(obj));
}

async function getDocPreferServer(buildRef: () => DocumentReference) {
  try {
    return await getDocFromServer(buildRef());
  } catch (err) {
    if (isFirestoreInternalAssertionError(err)) {
      await recoverFirestoreInstance();
      return await getDocFromServer(buildRef());
    }
    try {
      return await getDocFromCache(buildRef());
    } catch (cacheErr) {
      if (isFirestoreCacheMissError(cacheErr)) {
        throw err;
      }
      throw cacheErr;
    }
  }
}

async function getDocsPreferServer(colName: string) {
  try {
    return await getDocsFromServer(collection(db, colName));
  } catch (err) {
    if (isFirestoreInternalAssertionError(err)) {
      await recoverFirestoreInstance();
      return await getDocsFromServer(collection(db, colName));
    }
    try {
      return await getDocsFromCache(collection(db, colName));
    } catch (cacheErr) {
      if (isFirestoreCacheMissError(cacheErr)) {
        throw err;
      }
      throw cacheErr;
    }
  }
}

async function getDocsQueryPreferServer(buildQuery: () => Query) {
  try {
    return await getDocsFromServer(buildQuery());
  } catch (err) {
    if (isFirestoreInternalAssertionError(err)) {
      await recoverFirestoreInstance();
      return await getDocsFromServer(buildQuery());
    }
    try {
      return await getDocsFromCache(buildQuery());
    } catch (cacheErr) {
      if (isFirestoreCacheMissError(cacheErr)) {
        throw err;
      }
      throw cacheErr;
    }
  }
}

async function safeGetDocFromServer(pathSegments: [string, string]) {
  try {
    return await getDocFromServer(doc(db, pathSegments[0], pathSegments[1]));
  } catch (err) {
    if (isFirestoreInternalAssertionError(err)) {
      await recoverFirestoreInstance();
      return await getDocFromServer(doc(db, pathSegments[0], pathSegments[1]));
    }
    throw err;
  }
}

async function safeGetDocsFromServer(colName: string) {
  try {
    return await getDocsFromServer(collection(db, colName));
  } catch (err) {
    if (isFirestoreInternalAssertionError(err)) {
      await recoverFirestoreInstance();
      return await getDocsFromServer(collection(db, colName));
    }
    throw err;
  }
}

async function withFirestoreRecovery<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (err) {
    if (isFirestoreInternalAssertionError(err)) {
      await recoverFirestoreInstance();
      return await op();
    }
    throw err;
  }
}

function mapDocsById<T extends { id?: string }>(
  docs: Array<{ id: string; data: () => unknown }>
): T[] {
  const map = new Map<string, T>();
  for (const docSnap of docs) {
    const raw = docSnap.data() as T;
    if (!raw || typeof raw !== 'object') continue;
    const resolvedId = raw.id || docSnap.id;
    if (!resolvedId) continue;
    map.set(resolvedId, { ...raw, id: resolvedId });
  }
  return Array.from(map.values());
}

export const firestoreSync = {
  /**
   * Fast, targeted user-scoped login lookup:
   * 1. Searches Firestore specifically for the entered user's email/UID across `users`,
   *    `employees`, `employeePermissions`, `suppliers`, `posClients`, `system/superAdmin`,
   *    and `system/platformSettings`.
   * 2. Fetches ONLY the linked store document(s) and separated permissions.
   * 3. Fetches strictly the store/client-scoped collections displayed to this user
   *    (catalogs, services, warehouses, banks, orders, deposits, repayments, accounting,
   *    invites, and notifications) in parallel via fast indexed `where(...)` queries.
   */
  async fetchUserLoginContextFromFirestore(
    email: string,
    uid?: string
  ): Promise<{
    connected: boolean;
    superAdmin: Partial<SuperAdmin> | null;
    suppliers: Supplier[] | null;
    employees: OfficeEmployee[];
    employeePermissions: EmployeePermissionRecord[];
    posClients: POSClient[] | null;
    userDoc: AuthUser | null;
    scopedData?: ScopedLoginData;
    error?: unknown;
  }> {
    const cleanEmail = normalizeStoreEmail(email);
    try {
      const [
        adminSnap,
        settingsSnap,
        uidUserSnap,
        emailUsersSnap,
        employeesSnap,
        empPermsSnap,
        ownerSuppliersSnap,
        posClientsSnap,
      ] = await Promise.all([
        safeGetDocFromServer(['system', 'superAdmin']).catch(() => null),
        safeGetDocFromServer(['system', 'platformSettings']).catch(() => null),
        uid ? safeGetDocFromServer(['users', uid]).catch(() => null) : Promise.resolve(null),
        cleanEmail
          ? withFirestoreRecovery(() =>
              getDocsFromServer(query(collection(db, 'users'), where('email', '==', cleanEmail)))
            ).catch(() => null)
          : Promise.resolve(null),
        cleanEmail
          ? withFirestoreRecovery(() =>
              getDocsFromServer(query(collection(db, 'employees'), where('email', '==', cleanEmail)))
            ).catch(() => null)
          : Promise.resolve(null),
        cleanEmail
          ? withFirestoreRecovery(() =>
              getDocsFromServer(
                query(collection(db, 'employeePermissions'), where('email', '==', cleanEmail))
              )
            ).catch(() => null)
          : Promise.resolve(null),
        cleanEmail
          ? withFirestoreRecovery(() =>
              getDocsFromServer(query(collection(db, 'suppliers'), where('email', '==', cleanEmail)))
            ).catch(() => null)
          : Promise.resolve(null),
        cleanEmail
          ? withFirestoreRecovery(() =>
              getDocsFromServer(query(collection(db, 'posClients'), where('email', '==', cleanEmail)))
            ).catch(() => null)
          : Promise.resolve(null),
      ]);

      const superAdminData =
        adminSnap && adminSnap.exists() ? (adminSnap.data() as Partial<SuperAdmin>) : null;
      const platformSettingsData =
        settingsSnap && settingsSnap.exists()
          ? (settingsSnap.data() as Partial<PlatformInterfaceSettings>)
          : null;

      let userDoc: AuthUser | null = null;
      if (uidUserSnap && uidUserSnap.exists()) {
        userDoc = {
          ...(uidUserSnap.data() as AuthUser),
          id: uidUserSnap.id,
          uid: uidUserSnap.id,
        };
      } else if (emailUsersSnap && !emailUsersSnap.empty) {
        const preferredDoc =
          emailUsersSnap.docs.find((d) => !isLegacyPrefixedUserId(d.id)) ||
          emailUsersSnap.docs[0];
        userDoc = {
          ...(preferredDoc.data() as AuthUser),
          id: preferredDoc.id,
        };
      }

      // Self-heal any duplicate `users` documents sharing this normalized email when authenticated
      if (
        uid &&
        auth.currentUser?.uid === uid &&
        emailUsersSnap &&
        !emailUsersSnap.empty
      ) {
        const duplicateUserRefs = emailUsersSnap.docs
          .filter((d) => d.id !== uid)
          .map((d) => doc(db, 'users', d.id));
        if (duplicateUserRefs.length > 0) {
          void this.commitBatchDeletes(duplicateUserRefs).catch(() => {});
        }
      }

      const rawEmployees = employeesSnap ? mapDocsById<OfficeEmployee>(employeesSnap.docs) : [];
      const permRecords = empPermsSnap
        ? mapDocsById<EmployeePermissionRecord>(empPermsSnap.docs)
        : [];
      const matchedSuppliers = ownerSuppliersSnap
        ? mapDocsById<Supplier>(ownerSuppliersSnap.docs)
        : [];
      const matchedPosClients = posClientsSnap
        ? mapDocsById<POSClient>(posClientsSnap.docs)
        : [];

      // Fetch any missing permission records directly by employeeId (O(1) doc get)
      const missingPermEmpIds = rawEmployees
        .map((e) => e.id)
        .filter((id) => !permRecords.some((p) => p.employeeId === id || p.id === id));

      if (missingPermEmpIds.length > 0) {
        const extraPermSnaps = await Promise.all(
          missingPermEmpIds.map((empId) =>
            safeGetDocFromServer(['employeePermissions', empId]).catch(() => null)
          )
        );
        for (const snap of extraPermSnaps) {
          if (snap && snap.exists()) {
            permRecords.push({
              ...(snap.data() as EmployeePermissionRecord),
              id: snap.id,
            });
          }
        }
      }

      const isAdminEmail =
        isMasterAdminEmail(cleanEmail, superAdminData?.email) ||
        Boolean(findAdminAccountByEmail(cleanEmail, superAdminData?.adminAccounts || []));

      // Edge-case fallback ONLY if fast indexed queries returned nothing for a non-admin account:
      // check legacy unmigrated embedded employees on suppliers so they still authenticate and auto-migrate.
      if (
        !isAdminEmail &&
        matchedSuppliers.length === 0 &&
        matchedPosClients.length === 0 &&
        rawEmployees.length === 0 &&
        !userDoc &&
        cleanEmail
      ) {
        const legacySupsSnap = await safeGetDocsFromServer('suppliers').catch(() => null);
        if (legacySupsSnap && !legacySupsSnap.empty) {
          const allSups = mapDocsById<Supplier>(legacySupsSnap.docs);
          const actor = resolveStoreActorByEmail(cleanEmail, allSups);
          if (actor?.kind === 'owner') {
            matchedSuppliers.push(actor.supplier);
          } else if (actor?.kind === 'employee') {
            matchedSuppliers.push(actor.supplier);
            const scopedEmp: OfficeEmployee = {
              ...actor.employee,
              supplierId: actor.employee.supplierId || actor.supplier.id,
              email: cleanEmail,
            };
            rawEmployees.push(scopedEmp);
            permRecords.push(buildEmployeePermissionRecord(scopedEmp));
            if (auth.currentUser) {
              void this.migrateLegacyStoreEmployees([actor.supplier], [], []).catch(() => {});
            }
          }
        }
      }

      // Collect ONLY the specific store ID(s) linked to this user
      const knownSupIds = new Set(matchedSuppliers.map((s) => s.id));
      const neededSupIds = new Set<string>();

      for (const emp of rawEmployees) {
        if (emp.supplierId && !knownSupIds.has(emp.supplierId)) {
          neededSupIds.add(emp.supplierId);
        }
      }
      for (const perm of permRecords) {
        if (perm.supplierId && !knownSupIds.has(perm.supplierId)) {
          neededSupIds.add(perm.supplierId);
        }
      }
      for (const pos of matchedPosClients) {
        if (pos.supplierId && !knownSupIds.has(pos.supplierId)) {
          neededSupIds.add(pos.supplierId);
        }
      }
      if (userDoc?.supplierId && !knownSupIds.has(userDoc.supplierId)) {
        neededSupIds.add(userDoc.supplierId);
      }
      if (
        userDoc?.associatedId &&
        (userDoc.role === 'supplier' || userDoc.role === 'employee') &&
        !knownSupIds.has(userDoc.associatedId)
      ) {
        neededSupIds.add(userDoc.associatedId);
      }

      if (neededSupIds.size > 0) {
        const storeSnaps = await Promise.all(
          Array.from(neededSupIds).map((supId) =>
            safeGetDocFromServer(['suppliers', supId]).catch(() => null)
          )
        );
        for (const snap of storeSnaps) {
          if (snap && snap.exists()) {
            matchedSuppliers.push({
              ...(snap.data() as Supplier),
              id: snap.id,
            });
          }
        }
      }

      // If this user is a store owner OR an employee with staff management permissions,
      // fetch ONLY their own store's separated employees & permissions in parallel
      const ownerSupIds = matchedSuppliers
        .filter((s) => normalizeStoreEmail(s.email) === cleanEmail)
        .map((s) => s.id);
      const hrEmpSupIds = permRecords
        .filter((p) => p.permissions?.canManageEmployees && p.isActive !== false && p.supplierId)
        .map((p) => p.supplierId);
      const staffSupIdsToFetch = Array.from(new Set([...ownerSupIds, ...hrEmpSupIds]));

      if (staffSupIdsToFetch.length > 0) {
        const [storeEmpsList, storePermsList] = await Promise.all([
          Promise.all(
            staffSupIdsToFetch.map((supId) =>
              withFirestoreRecovery(() =>
                getDocsFromServer(
                  query(collection(db, 'employees'), where('supplierId', '==', supId))
                )
              ).catch(() => null)
            )
          ),
          Promise.all(
            staffSupIdsToFetch.map((supId) =>
              withFirestoreRecovery(() =>
                getDocsFromServer(
                  query(collection(db, 'employeePermissions'), where('supplierId', '==', supId))
                )
              ).catch(() => null)
            )
          ),
        ]);
        for (const s of storeEmpsList) {
          if (s) {
            for (const emp of mapDocsById<OfficeEmployee>(s.docs)) {
              if (!rawEmployees.some((existing) => existing.id === emp.id)) {
                rawEmployees.push(emp);
              }
            }
          }
        }
        for (const p of storePermsList) {
          if (p) {
            for (const perm of mapDocsById<EmployeePermissionRecord>(p.docs)) {
              if (!permRecords.some((existing) => existing.id === perm.id)) {
                permRecords.push(perm);
              }
            }
          }
        }
      }

      // If still unregistered (e.g. first-time Google Sign-In), fetch a minimal list of stores
      // to select a default active supplier without downloading the whole collection
      if (
        !isAdminEmail &&
        matchedSuppliers.length === 0 &&
        matchedPosClients.length === 0 &&
        rawEmployees.length === 0
      ) {
        const defaultSupSnap = await withFirestoreRecovery(() =>
          getDocsFromServer(query(collection(db, 'suppliers'), limit(5)))
        ).catch(() => null);
        if (defaultSupSnap && !defaultSupSnap.empty) {
          matchedSuppliers.push(...mapDocsById<Supplier>(defaultSupSnap.docs));
        }
      }

      const hydratedEmployees = rawEmployees.map((emp) =>
        hydrateEmployeeWithPermissionRecord(emp, permRecords)
      );
      const hydratedSuppliers = hydrateSuppliersWithEmployeesAndPermissions(
        matchedSuppliers,
        hydratedEmployees,
        permRecords
      );

      // Resolve exact identity so we can preload strictly what belongs to this user
      // and what their linked store displays to them via fast indexed queries.
      const identity = resolveAuthoritativeIdentityFromFirestore({
        email: cleanEmail,
        superAdmin: superAdminData
          ? {
              email: superAdminData.email || '',
              adminAccounts: superAdminData.adminAccounts || [],
            }
          : null,
        suppliers: hydratedSuppliers,
        posClients: matchedPosClients,
        userDoc,
      });

      const scopedData: ScopedLoginData = {
        platformSettings: platformSettingsData,
        catalogs: [],
        services: [],
        voucherWarehouses: [],
        supplierBankAccounts: [],
        orders: [],
        depositRequests: [],
        loanRepaymentRequests: [],
        accountingEntries: [],
        inviteLinks: [],
        notifications: [],
      };

      const mergeSnapList = <T extends { id?: string }>(
        snaps: Array<{ docs: Array<{ id: string; data: () => unknown }> } | null>
      ): T[] => {
        const map = new Map<string, T>();
        for (const s of snaps) {
          if (!s) continue;
          for (const item of mapDocsById<T>(s.docs)) {
            if (item.id) map.set(item.id, item);
          }
        }
        return Array.from(map.values());
      };

      const queryCol = (colName: string, field: string, value: string | boolean) =>
        withFirestoreRecovery(() =>
          getDocsFromServer(query(collection(db, colName), where(field, '==', value)))
        ).catch(() => null);

      const sortByDateDesc = <T extends { date?: string }>(items: T[]): T[] =>
        [...items].sort(
          (a, b) => (new Date(b.date || 0).getTime() || 0) - (new Date(a.date || 0).getTime() || 0)
        );

      if (identity.kind === 'supplier' || identity.kind === 'employee') {
        const supId = identity.supplier.id;
        if (supId) {
          const [
            storeClientsSnap,
            supCatalogsSnap,
            allCatalogsSnap,
            fixedCatalogsSnap,
            servicesSnap,
            warehousesSnap,
            banksSnap,
            ordersSnap,
            depositsSnap,
            repaymentsSnap,
            accountingSnap,
            invitesSnap,
            notifsSnap,
          ] = await Promise.all([
            queryCol('posClients', 'supplierId', supId),
            queryCol('catalogs', 'supplierId', supId),
            queryCol('catalogs', 'supplierId', 'all'),
            queryCol('catalogs', 'isFixedByAdmin', true),
            queryCol('services', 'supplierId', supId),
            queryCol('voucherWarehouses', 'supplierId', supId),
            queryCol('supplierBankAccounts', 'supplierId', supId),
            queryCol('orders', 'supplierId', supId),
            queryCol('depositRequests', 'supplierId', supId),
            queryCol('loanRepaymentRequests', 'supplierId', supId),
            queryCol('accountingEntries', 'supplierId', supId),
            queryCol('inviteLinks', 'supplierId', supId),
            queryCol('notifications', 'supplierId', supId),
          ]);

          scopedData.storePosClients = mergeSnapList<POSClient>([storeClientsSnap]);
          scopedData.catalogs = mergeSnapList<Catalog>([
            supCatalogsSnap,
            allCatalogsSnap,
            fixedCatalogsSnap,
          ]);
          scopedData.services = mergeSnapList<DigitalService>([servicesSnap]);
          scopedData.voucherWarehouses = mergeSnapList<VoucherWarehouse>([warehousesSnap]);
          scopedData.supplierBankAccounts = mergeSnapList<SupplierBankAccount>([banksSnap]);
          scopedData.orders = sortByDateDesc(mergeSnapList<Order>([ordersSnap]));
          scopedData.depositRequests = sortByDateDesc(mergeSnapList<DepositRequest>([depositsSnap]));
          scopedData.loanRepaymentRequests = sortByDateDesc(
            mergeSnapList<LoanRepaymentRequest>([repaymentsSnap])
          );
          scopedData.accountingEntries = sortByDateDesc(
            mergeSnapList<AccountingEntry>([accountingSnap])
          );
          scopedData.inviteLinks = mergeSnapList<InviteLink>([invitesSnap]);
          scopedData.notifications = mergeSnapList<AppNotification>([notifsSnap]).sort((a, b) =>
            (b.createdAt || '').localeCompare(a.createdAt || '')
          );
        }
      } else if (identity.kind === 'pos_client') {
        const scopedPosIds = Array.from(
          new Set(identity.posRecords.map((p) => p.id).filter(Boolean))
        );
        const scopedSupIds = Array.from(
          new Set(identity.posRecords.map((p) => p.supplierId).filter(Boolean))
        );
        const needsPeerClients = identity.posRecords.some((p) => p.canReceiveSupplierTransfers);

        const [
          allCatalogsSnap,
          fixedCatalogsSnap,
          supCatalogSnaps,
          servicesSnaps,
          warehousesSnaps,
          banksSnaps,
          ordersSnaps,
          depositsSnaps,
          repaymentsSnaps,
          accountingSnaps,
          posNotifSnaps,
          supNotifSnaps,
          peerClientSnaps,
        ] = await Promise.all([
          queryCol('catalogs', 'supplierId', 'all'),
          queryCol('catalogs', 'isFixedByAdmin', true),
          Promise.all(scopedSupIds.map((supId) => queryCol('catalogs', 'supplierId', supId))),
          Promise.all(scopedSupIds.map((supId) => queryCol('services', 'supplierId', supId))),
          Promise.all(scopedSupIds.map((supId) => queryCol('voucherWarehouses', 'supplierId', supId))),
          Promise.all(
            scopedSupIds.map((supId) => queryCol('supplierBankAccounts', 'supplierId', supId))
          ),
          Promise.all(scopedPosIds.map((posId) => queryCol('orders', 'posId', posId))),
          Promise.all(
            scopedSupIds.map((supId) => queryCol('depositRequests', 'supplierId', supId))
          ),
          Promise.all(
            scopedSupIds.map((supId) => queryCol('loanRepaymentRequests', 'supplierId', supId))
          ),
          Promise.all(scopedPosIds.map((posId) => queryCol('accountingEntries', 'posId', posId))),
          Promise.all(scopedPosIds.map((posId) => queryCol('notifications', 'posId', posId))),
          Promise.all(scopedSupIds.map((supId) => queryCol('notifications', 'supplierId', supId))),
          needsPeerClients
            ? Promise.all(scopedSupIds.map((supId) => queryCol('posClients', 'supplierId', supId)))
            : Promise.resolve([]),
        ]);

        scopedData.catalogs = mergeSnapList<Catalog>([
          allCatalogsSnap,
          fixedCatalogsSnap,
          ...supCatalogSnaps,
        ]);
        scopedData.services = mergeSnapList<DigitalService>(servicesSnaps);
        scopedData.voucherWarehouses = mergeSnapList<VoucherWarehouse>(warehousesSnaps);
        scopedData.supplierBankAccounts = mergeSnapList<SupplierBankAccount>(banksSnaps);
        scopedData.orders = sortByDateDesc(mergeSnapList<Order>(ordersSnaps));
        scopedData.depositRequests = sortByDateDesc(mergeSnapList<DepositRequest>(depositsSnaps));
        scopedData.loanRepaymentRequests = sortByDateDesc(
          mergeSnapList<LoanRepaymentRequest>(repaymentsSnaps)
        );
        scopedData.accountingEntries = sortByDateDesc(
          mergeSnapList<AccountingEntry>(accountingSnaps)
        );

        const rawNotifs = mergeSnapList<AppNotification>([...posNotifSnaps, ...supNotifSnaps]);
        const allowedNotifsMap = new Map<string, AppNotification>();
        for (const rec of identity.posRecords) {
          for (const n of filterNotificationsForPosClient(rawNotifs, rec.id, rec.supplierId)) {
            allowedNotifsMap.set(n.id, n);
          }
        }
        scopedData.notifications = Array.from(allowedNotifsMap.values()).sort((a, b) =>
          (b.createdAt || '').localeCompare(a.createdAt || '')
        );

        if (needsPeerClients && peerClientSnaps.length > 0) {
          const mergedPeerMap = new Map<string, POSClient>();
          for (const own of matchedPosClients) {
            if (own.id) mergedPeerMap.set(own.id, own);
          }
          for (const peer of mergeSnapList<POSClient>(peerClientSnaps)) {
            if (peer.id && !mergedPeerMap.has(peer.id)) {
              mergedPeerMap.set(peer.id, peer);
            }
          }
          scopedData.storePosClients = Array.from(mergedPeerMap.values());
        }
      }

      return {
        connected: true,
        superAdmin: superAdminData,
        suppliers: hydratedSuppliers,
        employees: hydratedEmployees,
        employeePermissions: permRecords,
        posClients: matchedPosClients,
        userDoc,
        scopedData,
      };
    } catch (error) {
      return {
        connected: false,
        superAdmin: null,
        suppliers: null,
        employees: [],
        employeePermissions: [],
        posClients: null,
        userDoc: null,
        error,
      };
    }
  },

  // Authoritative server-only identity fetch (delegates to user-scoped lookup)
  async fetchAuthoritativeIdentityDataFromFirestore(
    email: string,
    uid?: string
  ): Promise<{
    connected: boolean;
    superAdmin: Partial<SuperAdmin> | null;
    suppliers: Supplier[] | null;
    employees: OfficeEmployee[];
    employeePermissions: EmployeePermissionRecord[];
    posClients: POSClient[] | null;
    userDoc: AuthUser | null;
    scopedData?: ScopedLoginData;
    error?: unknown;
  }> {
    return this.fetchUserLoginContextFromFirestore(email, uid);
  },

  // Lightweight one-time bootstrap for login / registration screens without opening Watch streams
  async fetchAuthBootstrapData(): Promise<{
    superAdmin?: Partial<SuperAdmin>;
    platformSettings?: Partial<PlatformInterfaceSettings>;
    suppliers?: Supplier[];
    posClients?: POSClient[];
    inviteLinks?: InviteLink[];
  }> {
    const result: {
      superAdmin?: Partial<SuperAdmin>;
      platformSettings?: Partial<PlatformInterfaceSettings>;
      suppliers?: Supplier[];
      posClients?: POSClient[];
      inviteLinks?: InviteLink[];
    } = {};

    const [adminRes, settingsRes, suppliersRes, clientsRes, invitesRes] = await Promise.allSettled([
      getDocPreferServer(() => doc(db, 'system', 'superAdmin')),
      getDocPreferServer(() => doc(db, 'system', 'platformSettings')),
      getDocsPreferServer('suppliers'),
      getDocsPreferServer('posClients'),
      getDocsPreferServer('inviteLinks'),
    ]);

    if (adminRes.status === 'fulfilled' && adminRes.value.exists()) {
      result.superAdmin = adminRes.value.data() as Partial<SuperAdmin>;
    }
    if (settingsRes.status === 'fulfilled' && settingsRes.value.exists()) {
      result.platformSettings = settingsRes.value.data() as Partial<PlatformInterfaceSettings>;
    }
    if (suppliersRes.status === 'fulfilled') {
      result.suppliers = mapDocsById<Supplier>(suppliersRes.value.docs);
    }
    if (clientsRes.status === 'fulfilled') {
      result.posClients = mapDocsById<POSClient>(clientsRes.value.docs);
    }
    if (invitesRes.status === 'fulfilled') {
      result.inviteLinks = mapDocsById<InviteLink>(invitesRes.value.docs);
    }

    return result;
  },

  // Fetch all remote databases directly from Firestore server in staggered batches
  // to avoid opening 14 concurrent Watch targets on PersistentListenStream at once.
  async fetchAllDatabasesFromServer(): Promise<FullDatabaseSnapshot> {
    const [adminSnap, settingsSnap, suppliersSnap, employeesSnap, empPermsSnap, posClientsSnap] =
      await Promise.all([
        safeGetDocFromServer(['system', 'superAdmin']),
        safeGetDocFromServer(['system', 'platformSettings']),
        safeGetDocsFromServer('suppliers'),
        safeGetDocsFromServer('employees').catch(() => null),
        safeGetDocsFromServer('employeePermissions').catch(() => null),
        safeGetDocsFromServer('posClients'),
      ]);

    const [catalogsSnap, servicesSnap, voucherWarehousesSnap, supplierBankAccountsSnap] =
      await Promise.all([
        safeGetDocsFromServer('catalogs'),
        safeGetDocsFromServer('services'),
        safeGetDocsFromServer('voucherWarehouses'),
        safeGetDocsFromServer('supplierBankAccounts'),
      ]);

    const [ordersSnap, depositRequestsSnap, loanRepaymentRequestsSnap] = await Promise.all([
      safeGetDocsFromServer('orders'),
      safeGetDocsFromServer('depositRequests'),
      safeGetDocsFromServer('loanRepaymentRequests'),
    ]);

    const [accountingEntriesSnap, adminAccountingEntriesSnap, inviteLinksSnap, notificationsSnap] =
      await Promise.all([
        safeGetDocsFromServer('accountingEntries'),
        safeGetDocsFromServer('adminAccountingEntries'),
        safeGetDocsFromServer('inviteLinks'),
        safeGetDocsFromServer('notifications').catch(() => null),
      ]);

    const rawPerms = empPermsSnap
      ? mapDocsById<EmployeePermissionRecord>(empPermsSnap.docs)
      : [];
    const rawEmployees = employeesSnap ? mapDocsById<OfficeEmployee>(employeesSnap.docs) : [];
    const hydratedEmployees = rawEmployees.map((emp) =>
      hydrateEmployeeWithPermissionRecord(emp, rawPerms)
    );
    const rawSuppliers = mapDocsById<Supplier>(suppliersSnap.docs);

    return {
      superAdmin: adminSnap.exists() ? (adminSnap.data() as Partial<SuperAdmin>) : null,
      platformSettings: settingsSnap.exists()
        ? (settingsSnap.data() as Partial<PlatformInterfaceSettings>)
        : null,
      suppliers: hydrateSuppliersWithEmployeesAndPermissions(
        rawSuppliers,
        hydratedEmployees,
        rawPerms
      ),
      employees: hydratedEmployees,
      employeePermissions: rawPerms,
      posClients: mapDocsById<POSClient>(posClientsSnap.docs),
      catalogs: mapDocsById<Catalog>(catalogsSnap.docs),
      services: mapDocsById<DigitalService>(servicesSnap.docs),
      voucherWarehouses: mapDocsById<VoucherWarehouse>(voucherWarehousesSnap.docs),
      orders: mapDocsById<Order>(ordersSnap.docs),
      depositRequests: mapDocsById<DepositRequest>(depositRequestsSnap.docs),
      loanRepaymentRequests: mapDocsById<LoanRepaymentRequest>(loanRepaymentRequestsSnap.docs),
      supplierBankAccounts: mapDocsById<SupplierBankAccount>(supplierBankAccountsSnap.docs),
      accountingEntries: mapDocsById<AccountingEntry>(accountingEntriesSnap.docs),
      adminAccountingEntries: mapDocsById<AdminAccountingEntry>(adminAccountingEntriesSnap.docs),
      inviteLinks: mapDocsById<InviteLink>(inviteLinksSnap.docs),
      notifications: notificationsSnap ? mapDocsById<AppNotification>(notificationsSnap.docs) : [],
    };
  },

  async fetchSupplierClientsDirectoryFromServer(supplierId: string): Promise<{
    clients: POSClient[];
    users: AuthUser[];
  }> {
    if (!supplierId) {
      return { clients: [], users: [] };
    }

    const [clientsSnap, usersSnap] = await Promise.all([
      withFirestoreRecovery(() =>
        getDocsFromServer(
          query(collection(db, 'posClients'), where('supplierId', '==', supplierId))
        )
      ),
      withFirestoreRecovery(() =>
        getDocsFromServer(query(collection(db, 'users'), where('role', '==', 'pos_client')))
      ).catch(() => null),
    ]);

    return {
      clients: mapDocsById<POSClient>(clientsSnap.docs),
      users: usersSnap ? mapDocsById<AuthUser>(usersSnap.docs) : [],
    };
  },

  async commitBatchSets(
    entries: Array<{ path: [string, string]; data: unknown }>
  ): Promise<number> {
    if (entries.length === 0) return 0;
    const CHUNK_SIZE = 400;
    let written = 0;
    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
      const chunk = entries.slice(i, i + CHUNK_SIZE);
      await withFirestoreRecovery(async () => {
        const batch = writeBatch(db);
        for (const entry of chunk) {
          batch.set(
            doc(db, entry.path[0], entry.path[1]),
            sanitizeData(entry.data) as Record<string, unknown>,
            { merge: true }
          );
        }
        await batch.commit();
      });
      written += chunk.length;
    }
    return written;
  },

  async syncUsersForAccounts(
    suppliers: Supplier[],
    posClients: POSClient[],
    separatedEmployees: OfficeEmployee[] = []
  ): Promise<number> {
    // Only update/deduplicate existing UID-keyed `users` documents (never create custom-ID `emp-`, `sup-`, `pos-`, `usr-` docs).
    try {
      const usersSnap = await withFirestoreRecovery(() =>
        getDocsFromServer(collection(db, 'users'))
      ).catch(() => null);
      if (!usersSnap) return 0;

      const docsByEmail = new Map<string, Array<{ id: string; data: Partial<AuthUser> }>>();
      for (const docSnap of usersSnap.docs) {
        const data = docSnap.data() as Partial<AuthUser>;
        const cleanEmail = normalizeStoreEmail(data?.email);
        if (!cleanEmail) continue;
        const list = docsByEmail.get(cleanEmail) || [];
        list.push({ id: docSnap.id, data });
        docsByEmail.set(cleanEmail, list);
      }

      const nowIso = new Date().toISOString();
      const userEntries: Array<{ path: [string, string]; data: unknown }> = [];
      const duplicateRefsToDelete: DocumentReference[] = [];
      const accountByEmail = new Map<string, AuthUser & { updatedAt: string }>();

      const registerEmployee = (emp: OfficeEmployee, fallbackSupId?: string) => {
        const cleanEmail = normalizeStoreEmail(emp?.email);
        const scopedSupId = emp?.supplierId || fallbackSupId || '';
        if (!emp?.id || !cleanEmail || !scopedSupId || accountByEmail.has(cleanEmail)) return;
        accountByEmail.set(cleanEmail, {
          id: emp.uid || emp.id,
          ...(emp.uid ? { uid: emp.uid } : {}),
          email: cleanEmail,
          name: emp.name,
          role: 'employee',
          phone: emp.phone,
          associatedId: scopedSupId,
          supplierId: scopedSupId,
          employeeId: emp.id,
          roleTitle: emp.roleTitle,
          permissions: normalizeEmployeePermissions(emp.permissions),
          updatedAt: nowIso,
        });
      };

      for (const sup of suppliers) {
        if (!sup?.id) continue;
        const cleanSupEmail = normalizeStoreEmail(sup.email);
        if (cleanSupEmail && !accountByEmail.has(cleanSupEmail)) {
          accountByEmail.set(cleanSupEmail, {
            id: sup.uid || sup.id,
            ...(sup.uid ? { uid: sup.uid } : {}),
            email: cleanSupEmail,
            name: sup.name,
            role: 'supplier',
            phone: sup.phone,
            associatedId: sup.id,
            updatedAt: nowIso,
          });
        }
        for (const emp of sup.employees || []) {
          registerEmployee(emp, sup.id);
        }
      }

      for (const emp of separatedEmployees) {
        registerEmployee(emp);
      }

      for (const client of posClients) {
        const cleanClientEmail = normalizeStoreEmail(client?.email);
        if (!client?.id || !cleanClientEmail || accountByEmail.has(cleanClientEmail)) continue;
        const clientUid = (client.uid || client.userId || '').trim() || undefined;
        accountByEmail.set(cleanClientEmail, {
          id: clientUid || client.id,
          ...(clientUid ? { uid: clientUid } : {}),
          email: cleanClientEmail,
          name: client.ownerName || client.tradeName,
          role: 'pos_client',
          phone: client.phone,
          associatedId: client.id,
          updatedAt: nowIso,
        });
      }

      for (const [cleanEmail, docList] of docsByEmail.entries()) {
        const canonicalExisting =
          docList.find((d) => !isLegacyPrefixedUserId(d.id)) ||
          docList.find((d) => typeof d.data?.uid === 'string' && d.data.uid === d.id);

        if (!canonicalExisting) {
          continue;
        }

        for (const d of docList) {
          if (d.id !== canonicalExisting.id) {
            duplicateRefsToDelete.push(doc(db, 'users', d.id));
          }
        }

        const matchedAccount = accountByEmail.get(cleanEmail);
        if (matchedAccount) {
          userEntries.push({
            path: ['users', canonicalExisting.id],
            data: {
              ...matchedAccount,
              id: canonicalExisting.id,
              uid: canonicalExisting.id,
              email: cleanEmail,
            },
          });
        }
      }

      // Also upsert accounts that explicitly carry a real Firebase Auth UID even if no `users/{uid}` doc existed yet
      for (const [cleanEmail, acc] of accountByEmail.entries()) {
        const explicitUid = (acc.uid || '').trim();
        if (!explicitUid || isLegacyPrefixedUserId(explicitUid)) continue;
        if (userEntries.some((entry) => entry.path[1] === explicitUid)) continue;
        userEntries.push({
          path: ['users', explicitUid],
          data: {
            ...acc,
            id: explicitUid,
            uid: explicitUid,
            email: cleanEmail,
          },
        });
      }

      if (duplicateRefsToDelete.length > 0) {
        await this.commitBatchDeletes(duplicateRefsToDelete).catch(() => {});
      }

      return this.commitBatchSets(userEntries);
    } catch {
      return 0;
    }
  },

  async findExistingUsersByEmail(email: string): Promise<AuthUser[]> {
    const cleanEmail = normalizeStoreEmail(email);
    if (!cleanEmail) return [];
    try {
      const queries = [
        getDocsQueryPreferServer(() =>
          query(collection(db, 'users'), where('email', '==', cleanEmail))
        ),
      ];
      if (email.trim() && email.trim() !== cleanEmail) {
        queries.push(
          getDocsQueryPreferServer(() =>
            query(collection(db, 'users'), where('email', '==', email.trim()))
          )
        );
      }
      const snaps = await Promise.all(queries);
      const map = new Map<string, AuthUser>();
      for (const snap of snaps) {
        for (const d of snap.docs) {
          map.set(d.id, { ...(d.data() as AuthUser), id: d.id });
        }
      }
      return Array.from(map.values());
    } catch {
      return [];
    }
  },

  async findDuplicatePosClientForSupplier(params: {
    supplierId: string;
    email?: string;
    phone?: string;
    uid?: string;
    userId?: string;
    excludePosId?: string;
  }): Promise<POSClient | null> {
    const cleanSupId = (params.supplierId || '').trim();
    if (!cleanSupId) return null;
    try {
      const snap = await getDocsQueryPreferServer(() =>
        query(collection(db, 'posClients'), where('supplierId', '==', cleanSupId))
      );
      const storeClients = mapDocsById<POSClient>(snap.docs);
      const match = findMatchingPosClientRecord(storeClients, params);
      return match || null;
    } catch {
      return null;
    }
  },

  async checkEmailExistsAcrossCollections(
    email: string,
    options?: {
      excludeUserId?: string;
      excludeEmployeeId?: string;
      excludeSupplierId?: string;
      excludePosId?: string;
      excludeAdminAccountId?: string;
      allowExistingPosClientForDifferentSupplierId?: string;
    }
  ): Promise<{
    exists: boolean;
    source?: 'super_admin' | 'admin_account' | 'supplier' | 'employee' | 'pos_client' | 'users';
    error?: string;
    existingUsers: AuthUser[];
    existingPosClients: POSClient[];
  }> {
    const cleanEmail = normalizeStoreEmail(email);
    if (!cleanEmail) {
      return {
        exists: true,
        error: 'يرجى إدخال بريد إلكتروني صحيح.',
        existingUsers: [],
        existingPosClients: [],
      };
    }

    try {
      const [users, empSnap, supSnap, posSnap, adminSnap] = await Promise.all([
        this.findExistingUsersByEmail(cleanEmail),
        getDocsQueryPreferServer(() =>
          query(collection(db, 'employees'), where('email', '==', cleanEmail))
        ).catch(() => null),
        getDocsQueryPreferServer(() =>
          query(collection(db, 'suppliers'), where('email', '==', cleanEmail))
        ).catch(() => null),
        getDocsQueryPreferServer(() =>
          query(collection(db, 'posClients'), where('email', '==', cleanEmail))
        ).catch(() => null),
        getDocPreferServer(() => doc(db, 'system', 'superAdmin')).catch(() => null),
      ]);

      const superAdminData =
        adminSnap && adminSnap.exists() ? (adminSnap.data() as Partial<SuperAdmin>) : null;
      if (isMasterAdminEmail(cleanEmail, superAdminData?.email)) {
        return {
          exists: true,
          source: 'super_admin',
          error: 'هذا البريد الإلكتروني مخصص للإدارة العامة ولا يمكن استخدامه.',
          existingUsers: users,
          existingPosClients: [],
        };
      }

      const matchedAdminAcc = findAdminAccountByEmail(
        cleanEmail,
        superAdminData?.adminAccounts || []
      );
      if (matchedAdminAcc && matchedAdminAcc.id !== options?.excludeAdminAccountId) {
        return {
          exists: true,
          source: 'admin_account',
          error: 'هذا البريد الإلكتروني مسجل مسبقاً كحساب إداري.',
          existingUsers: users,
          existingPosClients: [],
        };
      }

      const matchedSuppliers = supSnap
        ? mapDocsById<Supplier>(supSnap.docs).filter((s) => s.id !== options?.excludeSupplierId)
        : [];
      if (matchedSuppliers.length > 0) {
        return {
          exists: true,
          source: 'supplier',
          error: 'هذا البريد الإلكتروني مسجل بالفعل لحساب متجر.',
          existingUsers: users,
          existingPosClients: [],
        };
      }

      const matchedEmployees = empSnap
        ? mapDocsById<OfficeEmployee>(empSnap.docs).filter(
            (e) => e.id !== options?.excludeEmployeeId
          )
        : [];
      if (matchedEmployees.length > 0) {
        return {
          exists: true,
          source: 'employee',
          error: 'هذا البريد الإلكتروني مسجل بالفعل لحساب موظف متجر.',
          existingUsers: users,
          existingPosClients: [],
        };
      }

      const matchedPosClients = posSnap
        ? mapDocsById<POSClient>(posSnap.docs).filter((p) => p.id !== options?.excludePosId)
        : [];
      const targetSupForMultiStore = (
        options?.allowExistingPosClientForDifferentSupplierId || ''
      ).trim();

      if (matchedPosClients.length > 0) {
        if (!targetSupForMultiStore) {
          return {
            exists: true,
            source: 'pos_client',
            error: 'هذا البريد الإلكتروني مسجل مسبقاً لحساب عميل نقطة بيع.',
            existingUsers: users,
            existingPosClients: matchedPosClients,
          };
        }
        if (matchedPosClients.some((p) => p.supplierId === targetSupForMultiStore)) {
          return {
            exists: true,
            source: 'pos_client',
            error: 'هذا البريد الإلكتروني مسجل بالفعل لدى هذا المتجر.',
            existingUsers: users,
            existingPosClients: matchedPosClients,
          };
        }
      }

      const blockingUsers = users.filter((u) => {
        if (options?.excludeUserId && (u.id === options.excludeUserId || u.uid === options.excludeUserId)) {
          return false;
        }
        if (
          options?.excludeEmployeeId &&
          (u.employeeId === options.excludeEmployeeId || u.id === options.excludeEmployeeId)
        ) {
          return false;
        }
        if (
          options?.excludeSupplierId &&
          u.role === 'supplier' &&
          u.associatedId === options.excludeSupplierId
        ) {
          return false;
        }
        if (options?.excludePosId && u.role === 'pos_client' && u.associatedId === options.excludePosId) {
          return false;
        }
        if (
          options?.excludeAdminAccountId &&
          u.adminAccountId === options.excludeAdminAccountId
        ) {
          return false;
        }
        if (targetSupForMultiStore && u.role === 'pos_client') {
          return false;
        }
        return true;
      });

      if (blockingUsers.length > 0) {
        return {
          exists: true,
          source: 'users',
          error: 'هذا البريد الإلكتروني مسجل مسبقاً في قاعدة بيانات المستخدمين.',
          existingUsers: users,
          existingPosClients: matchedPosClients,
        };
      }

      return {
        exists: false,
        existingUsers: users,
        existingPosClients: matchedPosClients,
      };
    } catch {
      return {
        exists: false,
        existingUsers: [],
        existingPosClients: [],
      };
    }
  },

  // Sync User profile (Always uses Firebase Auth UID as single source of truth)
  async saveUser(user: AuthUser, uidOverride?: string): Promise<AuthUser> {
    const cleanEmail = normalizeStoreEmail(user.email);
    const currentAuthEmail = normalizeStoreEmail(auth.currentUser?.email);
    const resolvedUid =
      (uidOverride || '').trim() ||
      (user.uid || '').trim() ||
      (!isLegacyPrefixedUserId(user.id) ? user.id.trim() : '') ||
      (auth.currentUser && (!cleanEmail || currentAuthEmail === cleanEmail)
        ? auth.currentUser.uid
        : '');

    const nowIso = new Date().toISOString();

    try {
      const existingByEmail = cleanEmail ? await this.findExistingUsersByEmail(cleanEmail) : [];

      if (resolvedUid) {
        const canonicalUser: AuthUser = {
          ...user,
          id: resolvedUid,
          uid: resolvedUid,
          email: cleanEmail || user.email,
          updatedAt: nowIso,
        };
        const cleanUser = sanitizeData(canonicalUser);
        await withFirestoreRecovery(() =>
          setDoc(doc(db, 'users', resolvedUid), cleanUser, { merge: true })
        );

        const duplicateRefs = existingByEmail
          .filter((d) => d.id && d.id !== resolvedUid)
          .map((d) => doc(db, 'users', d.id));
        if (duplicateRefs.length > 0) {
          await this.commitBatchDeletes(duplicateRefs).catch(() => {});
        }
        return canonicalUser;
      }

      // If no Firebase Auth UID is available yet, only update a single already-existing `users` doc
      // matching this email (never create a new custom-ID document like usr-/emp-/sup-/pos-/adm-).
      if (existingByEmail.length > 0) {
        const canonicalExisting =
          existingByEmail.find((d) => !isLegacyPrefixedUserId(d.id)) || existingByEmail[0];
        const targetId = canonicalExisting.id;
        const mergedUser: AuthUser = {
          ...user,
          id: targetId,
          ...(canonicalExisting.uid ? { uid: canonicalExisting.uid } : {}),
          email: cleanEmail || user.email,
          updatedAt: nowIso,
        };
        const cleanUser = sanitizeData(mergedUser);
        await withFirestoreRecovery(() =>
          setDoc(doc(db, 'users', targetId), cleanUser, { merge: true })
        );
        return mergedUser;
      }

      return {
        ...user,
        email: cleanEmail || user.email,
        updatedAt: nowIso,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${resolvedUid || user.id}`);
      return user;
    }
  },

  async getUser(userId: string): Promise<AuthUser | null> {
    const path = `users/${userId}`;
    try {
      const snap = await getDocPreferServer(() => doc(db, 'users', userId));
      return snap.exists() ? (snap.data() as AuthUser) : null;
    } catch (error) {
      if (
        isTransientFirestoreError(error) ||
        isFirestoreCacheMissError(error) ||
        isFirestoreInternalAssertionError(error) ||
        isNavigatorOffline()
      ) {
        console.warn(`Transient offline/cache/assertion error fetching user ${userId}, returning null gracefully:`, error);
        return null;
      }
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    const matches = await this.findExistingUsersByEmail(email);
    if (matches.length === 0) return null;
    return matches.find((d) => !isLegacyPrefixedUserId(d.id)) || matches[0];
  },

  async findPosClientsByEmail(email: string): Promise<POSClient[]> {
    const cleanEmail = normalizeStoreEmail(email);
    if (!cleanEmail) return [];
    try {
      const snap = await getDocsQueryPreferServer(() =>
        query(collection(db, 'posClients'), where('email', '==', cleanEmail))
      );
      return mapDocsById<POSClient>(snap.docs);
    } catch {
      return [];
    }
  },

  async deleteUser(userId: string): Promise<void> {
    const path = `users/${userId}`;
    try {
      await withFirestoreRecovery(() => deleteDoc(doc(db, 'users', userId)));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // POS Client operations (deduplicates by uid/userId, email, or non-placeholder phone within the same store)
  async savePosClient(
    client: POSClient,
    options?: { skipDuplicateCheck?: boolean }
  ): Promise<POSClient> {
    const cleanEmail = normalizeStoreEmail(client.email);
    const normalizedInput: POSClient = {
      ...client,
      ...(cleanEmail ? { email: cleanEmail } : {}),
    };

    let targetClient = normalizedInput;
    if (!options?.skipDuplicateCheck && normalizedInput.supplierId) {
      const duplicate = await this.findDuplicatePosClientForSupplier({
        supplierId: normalizedInput.supplierId,
        email: cleanEmail,
        phone: normalizedInput.phone,
        uid: normalizedInput.uid || normalizedInput.userId,
        excludePosId: normalizedInput.id,
      });

      if (duplicate) {
        const resolvedPhone = normalizePhoneForMatch(normalizedInput.phone)
          ? normalizedInput.phone
          : duplicate.phone || normalizedInput.phone;
        const mergedUid = normalizedInput.uid || duplicate.uid || normalizedInput.userId || duplicate.userId;
        targetClient = {
          ...duplicate,
          ...normalizedInput,
          id: duplicate.id,
          posCode: duplicate.posCode || normalizedInput.posCode,
          qrCodeValue: duplicate.qrCodeValue || normalizedInput.qrCodeValue,
          walletBalance: Math.max(duplicate.walletBalance || 0, normalizedInput.walletBalance || 0),
          totalSpent: Math.max(duplicate.totalSpent || 0, normalizedInput.totalSpent || 0),
          ordersCount: Math.max(duplicate.ordersCount || 0, normalizedInput.ordersCount || 0),
          phone: resolvedPhone,
          ...(cleanEmail ? { email: cleanEmail } : duplicate.email ? { email: normalizeStoreEmail(duplicate.email) } : {}),
          ...(mergedUid ? { uid: mergedUid, userId: mergedUid } : {}),
        };
      }
    }

    const path = `posClients/${targetClient.id}`;
    try {
      const cleanClient = sanitizeData(targetClient);
      await withFirestoreRecovery(() =>
        setDoc(doc(db, 'posClients', targetClient.id), cleanClient, { merge: true })
      );
      clearEntityPendingSync('posClients', targetClient.id);
      return targetClient;
    } catch (error) {
      markEntityPendingSync('posClients', targetClient.id);
      handleFirestoreError(error, OperationType.WRITE, path);
      return targetClient;
    }
  },

  async deletePosClient(posId: string): Promise<void> {
    const path = `posClients/${posId}`;
    try {
      await withFirestoreRecovery(() => deleteDoc(doc(db, 'posClients', posId)));
      clearEntityPendingSync('posClients', posId);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async deletePosClientAccountFromFirestore(
    posId: string,
    clientEmail?: string,
    keepEmailUserDocs: boolean = false
  ): Promise<void> {
    // Clean up associated user profile docs BEFORE deleting posClients/{posId} so rule ownership checks succeed
    try {
      const assocSnap = await withFirestoreRecovery(() =>
        getDocs(query(collection(db, 'users'), where('associatedId', '==', posId)))
      ).catch(() => null);
      if (assocSnap && !assocSnap.empty) {
        await this.commitBatchDeletes(
          assocSnap.docs.map((d) => doc(db, 'users', d.id))
        ).catch(() => {});
      }

      const cleanEmail = normalizeStoreEmail(clientEmail);
      if (cleanEmail && !keepEmailUserDocs) {
        const emailSnap = await withFirestoreRecovery(() =>
          getDocs(query(collection(db, 'users'), where('email', '==', cleanEmail)))
        ).catch(() => null);
        if (emailSnap && !emailSnap.empty) {
          const refsToDelete = emailSnap.docs
            .filter((d) => {
              const data = d.data() as Partial<AuthUser>;
              return !data.role || data.role === 'pos_client';
            })
            .map((d) => doc(db, 'users', d.id));
          if (refsToDelete.length > 0) {
            await this.commitBatchDeletes(refsToDelete).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.warn('Partial cleanup while deleting POS client user docs:', err);
    }

    await this.deletePosClient(posId);
  },

  async fetchSupplierByIdFromServer(supplierId: string): Promise<Supplier | null> {
    const cleanId = (supplierId || '').trim();
    if (!cleanId) return null;
    try {
      const snap = await safeGetDocFromServer(['suppliers', cleanId]);
      if (!snap.exists()) return null;
      return { ...(snap.data() as Supplier), id: snap.id };
    } catch {
      return null;
    }
  },

  async stripLegacyEmployeesFieldFromSuppliers(supplierIds: string[]): Promise<number> {
    const uniqueIds = Array.from(new Set(supplierIds.map((id) => (id || '').trim()).filter(Boolean)));
    if (uniqueIds.length === 0) return 0;
    const CHUNK_SIZE = 400;
    let cleaned = 0;
    for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
      const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
      await withFirestoreRecovery(async () => {
        const batch = writeBatch(db);
        for (const supId of chunk) {
          batch.update(doc(db, 'suppliers', supId), { employees: deleteField() });
        }
        await batch.commit();
      }).catch(async () => {
        await Promise.all(
          chunk.map((supId) =>
            withFirestoreRecovery(() =>
              updateDoc(doc(db, 'suppliers', supId), { employees: deleteField() })
            ).catch(() => {})
          )
        );
      });
      cleaned += chunk.length;
    }
    return cleaned;
  },

  // Supplier operations (stores remain compact in Firestore without embedded employee arrays)
  async saveSupplier(supplier: Supplier): Promise<void> {
    const path = `suppliers/${supplier.id}`;
    try {
      const compactSupplier = sanitizeData(
        stripEmployeesFromSupplierForStorage({
          ...supplier,
          email: normalizeStoreEmail(supplier.email),
        })
      ) as Record<string, unknown>;
      compactSupplier.employees = deleteField();
      await withFirestoreRecovery(() =>
        setDoc(doc(db, 'suppliers', supplier.id), compactSupplier, { merge: true })
      );
      clearEntityPendingSync('suppliers', supplier.id);
    } catch (error) {
      markEntityPendingSync('suppliers', supplier.id);
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Separated Store Employee & Employee Permissions operations (never creates duplicate `users/emp-...` docs)
  async saveEmployeeWithPermissions(employee: OfficeEmployee): Promise<void> {
    const nowIso = new Date().toISOString();
    const cleanEmail = normalizeStoreEmail(employee.email);
    const employeeDoc = sanitizeData(
      buildSeparatedEmployeeDoc({ ...employee, email: cleanEmail }, nowIso)
    );
    const permissionDoc = sanitizeData(
      buildEmployeePermissionRecord({ ...employee, email: cleanEmail }, nowIso)
    );

    try {
      await withFirestoreRecovery(async () => {
        const batch = writeBatch(db);
        batch.set(doc(db, 'employees', employee.id), employeeDoc, { merge: true });
        batch.set(doc(db, 'employeePermissions', employee.id), permissionDoc, { merge: true });
        await batch.commit();
      });
      clearEntityPendingSync('employees', employee.id);
      clearEntityPendingSync('employeePermissions', employee.id);

      // Update the single canonical `users/{uid}` doc if UID is known (or an existing `users` doc exists by email)
      await this.saveUser(
        {
          id: employee.uid || employee.id,
          ...(employee.uid ? { uid: employee.uid } : {}),
          email: cleanEmail,
          name: employee.name,
          role: 'employee',
          phone: employee.phone,
          associatedId: employee.supplierId,
          supplierId: employee.supplierId,
          employeeId: employee.id,
          roleTitle: employee.roleTitle,
          permissions: permissionDoc.permissions,
        },
        employee.uid
      ).catch(() => {});

      if (employee.uid && employee.uid !== employee.id) {
        await withFirestoreRecovery(() => deleteDoc(doc(db, 'users', employee.id))).catch(() => {});
      }
    } catch (error) {
      markEntityPendingSync('employees', employee.id);
      markEntityPendingSync('employeePermissions', employee.id);
      handleFirestoreError(error, OperationType.WRITE, `employees/${employee.id}`);
    }
  },

  async deleteEmployeeAndPermissions(employeeId: string): Promise<void> {
    try {
      const empUsersSnap = await withFirestoreRecovery(() =>
        getDocs(query(collection(db, 'users'), where('employeeId', '==', employeeId)))
      ).catch(() => null);

      await withFirestoreRecovery(async () => {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'employees', employeeId));
        batch.delete(doc(db, 'employeePermissions', employeeId));
        batch.delete(doc(db, 'users', employeeId));
        if (empUsersSnap && !empUsersSnap.empty) {
          for (const uDoc of empUsersSnap.docs) {
            if (uDoc.id !== employeeId) {
              batch.delete(doc(db, 'users', uDoc.id));
            }
          }
        }
        await batch.commit();
      });
      clearEntityPendingSync('employees', employeeId);
      clearEntityPendingSync('employeePermissions', employeeId);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `employees/${employeeId}`);
    }
  },

  async migrateLegacyStoreEmployees(
    suppliers: Supplier[],
    existingEmployees: OfficeEmployee[] = [],
    existingPermissions?: EmployeePermissionRecord[]
  ): Promise<{
    migratedEmployeesCount: number;
    cleanedStoresCount: number;
    migratedEmployees: OfficeEmployee[];
    migratedPermissions: EmployeePermissionRecord[];
  }> {
    const unmigratedFromStores = extractUnmigratedEmployeesFromSuppliers(
      suppliers,
      existingEmployees,
      existingPermissions
    );

    // Also ensure any existing separated employee missing an `employeePermissions` doc gets backfilled
    const permByEmpKey = new Set(
      (existingPermissions || []).map((p) => `${p.supplierId}::${p.employeeId || p.id}`)
    );
    const missingPermEmployees = Array.isArray(existingPermissions)
      ? existingEmployees.filter(
          (emp) => emp?.id && emp.supplierId && !permByEmpKey.has(`${emp.supplierId}::${emp.id}`)
        )
      : [];

    const mergedToMigrateMap = new Map<string, OfficeEmployee>();
    for (const emp of [...unmigratedFromStores, ...missingPermEmployees]) {
      if (emp?.id) mergedToMigrateMap.set(emp.id, emp);
    }
    const toMigrate = Array.from(mergedToMigrateMap.values());

    const nowIso = new Date().toISOString();
    const entries: Array<{ path: [string, string]; data: unknown }> = [];
    const migratedPermissions: EmployeePermissionRecord[] = [];
    for (const emp of toMigrate) {
      const sepEmp = buildSeparatedEmployeeDoc(emp, nowIso);
      const permRec = buildEmployeePermissionRecord(emp, nowIso);
      migratedPermissions.push(permRec);
      entries.push({ path: ['employees', emp.id], data: sepEmp });
      entries.push({ path: ['employeePermissions', emp.id], data: permRec });
    }
    if (entries.length > 0) {
      await this.commitBatchSets(entries);
    }

    // Clean legacy embedded `employees` field from any store document carrying it
    const storeIdsToStrip = Array.from(
      new Set([
        ...getSupplierIdsWithLegacyEmployeesField(suppliers),
        ...unmigratedFromStores.map((e) => e.supplierId).filter(Boolean),
      ])
    );
    const cleanedStoresCount = await this.stripLegacyEmployeesFieldFromSuppliers(storeIdsToStrip);

    return {
      migratedEmployeesCount: toMigrate.length,
      cleanedStoresCount,
      migratedEmployees: toMigrate,
      migratedPermissions,
    };
  },

  // Notifications operations (real-time cross-device client <-> supplier alerts)
  async saveNotification(notif: AppNotification): Promise<void> {
    const path = `notifications/${notif.id}`;
    try {
      const cleanNotif = sanitizeData(notif);
      await withFirestoreRecovery(() =>
        setDoc(doc(db, 'notifications', notif.id), cleanNotif, { merge: true })
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async markNotificationsReadBatch(ids: string[]): Promise<void> {
    if (!ids.length) return;
    await this.commitBatchSets(
      ids.map((id) => ({
        path: ['notifications', id] as [string, string],
        data: { isRead: true },
      }))
    );
  },

  async deleteNotificationsBatch(ids: string[]): Promise<void> {
    if (!ids.length) return;
    await this.commitBatchDeletes(ids.map((id) => doc(db, 'notifications', id)));
  },

  // Super Admin operations
  async saveSuperAdmin(admin: SuperAdmin): Promise<void> {
    const path = 'system/superAdmin';
    try {
      const cleanAdmin = sanitizeData(admin);
      await withFirestoreRecovery(() =>
        setDoc(doc(db, 'system', 'superAdmin'), cleanAdmin, { merge: true })
      );
      clearEntityPendingSync('superAdmin', 'superAdmin');
    } catch (error) {
      markEntityPendingSync('superAdmin', 'superAdmin');
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Platform Interface Settings (Fixed Catalogs, Dropdown Lists, Portal Settings)
  async savePlatformSettings(settings: PlatformInterfaceSettings): Promise<void> {
    const path = 'system/platformSettings';
    try {
      const cleanSettings = sanitizeData(settings);
      await withFirestoreRecovery(() =>
        setDoc(doc(db, 'system', 'platformSettings'), cleanSettings, { merge: true })
      );
      clearEntityPendingSync('platformSettings', 'platformSettings');
    } catch (error) {
      markEntityPendingSync('platformSettings', 'platformSettings');
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Order operations
  async saveOrder(order: Order): Promise<void> {
    const path = `orders/${order.id}`;
    try {
      const cleanOrder = sanitizeData(order);
      await withFirestoreRecovery(() =>
        setDoc(doc(db, 'orders', order.id), cleanOrder, { merge: true })
      );
      clearEntityPendingSync('orders', order.id);
    } catch (error) {
      markEntityPendingSync('orders', order.id);
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Deposit Request and Loans
  async saveDepositRequest(req: DepositRequest): Promise<void> {
    const path = `depositRequests/${req.id}`;
    try {
      const cleanReq = sanitizeData(req);
      await withFirestoreRecovery(() =>
        setDoc(doc(db, 'depositRequests', req.id), cleanReq, { merge: true })
      );
      clearEntityPendingSync('depositRequests', req.id);
    } catch (error) {
      markEntityPendingSync('depositRequests', req.id);
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Loan Repayment Requests
  async saveLoanRepaymentRequest(req: LoanRepaymentRequest): Promise<void> {
    const path = `loanRepaymentRequests/${req.id}`;
    try {
      const cleanReq = sanitizeData(req);
      await withFirestoreRecovery(() =>
        setDoc(doc(db, 'loanRepaymentRequests', req.id), cleanReq, { merge: true })
      );
      clearEntityPendingSync('loanRepaymentRequests', req.id);
    } catch (error) {
      markEntityPendingSync('loanRepaymentRequests', req.id);
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Accounting entries
  async saveAccountingEntry(entry: AccountingEntry): Promise<void> {
    const path = `accountingEntries/${entry.id}`;
    try {
      const cleanEntry = sanitizeData(entry);
      await withFirestoreRecovery(() =>
        setDoc(doc(db, 'accountingEntries', entry.id), cleanEntry, { merge: true })
      );
      clearEntityPendingSync('accountingEntries', entry.id);
    } catch (error) {
      markEntityPendingSync('accountingEntries', entry.id);
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Admin accounting entries
  async saveAdminAccountingEntry(entry: AdminAccountingEntry): Promise<void> {
    const path = `adminAccountingEntries/${entry.id}`;
    try {
      const cleanEntry = sanitizeData(entry);
      await withFirestoreRecovery(() =>
        setDoc(doc(db, 'adminAccountingEntries', entry.id), cleanEntry, { merge: true })
      );
      clearEntityPendingSync('adminAccountingEntries', entry.id);
    } catch (error) {
      markEntityPendingSync('adminAccountingEntries', entry.id);
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Catalogs & Services
  async saveCatalog(cat: Catalog): Promise<void> {
    const path = `catalogs/${cat.id}`;
    try {
      const cleanCat = sanitizeData(cat);
      await withFirestoreRecovery(() =>
        setDoc(doc(db, 'catalogs', cat.id), cleanCat, { merge: true })
      );
      clearEntityPendingSync('catalogs', cat.id);
    } catch (error) {
      markEntityPendingSync('catalogs', cat.id);
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async deleteCatalog(catalogId: string): Promise<void> {
    const path = `catalogs/${catalogId}`;
    try {
      await withFirestoreRecovery(() => deleteDoc(doc(db, 'catalogs', catalogId)));
      clearEntityPendingSync('catalogs', catalogId);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async saveService(service: DigitalService): Promise<void> {
    const path = `services/${service.id}`;
    try {
      const cleanService = sanitizeData(service);
      await withFirestoreRecovery(() =>
        setDoc(doc(db, 'services', service.id), cleanService, { merge: true })
      );
      clearEntityPendingSync('services', service.id);
    } catch (error) {
      markEntityPendingSync('services', service.id);
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async deleteService(serviceId: string): Promise<void> {
    const path = `services/${serviceId}`;
    try {
      await withFirestoreRecovery(() => deleteDoc(doc(db, 'services', serviceId)));
      clearEntityPendingSync('services', serviceId);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Voucher Warehouses
  async saveVoucherWarehouse(warehouse: VoucherWarehouse): Promise<void> {
    const path = `voucherWarehouses/${warehouse.id}`;
    try {
      const cleanWarehouse = sanitizeData(warehouse);
      await withFirestoreRecovery(() =>
        setDoc(doc(db, 'voucherWarehouses', warehouse.id), cleanWarehouse, { merge: true })
      );
      clearEntityPendingSync('voucherWarehouses', warehouse.id);
    } catch (error) {
      markEntityPendingSync('voucherWarehouses', warehouse.id);
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async deleteVoucherWarehouse(warehouseId: string): Promise<void> {
    const path = `voucherWarehouses/${warehouseId}`;
    try {
      await withFirestoreRecovery(() => deleteDoc(doc(db, 'voucherWarehouses', warehouseId)));
      clearEntityPendingSync('voucherWarehouses', warehouseId);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Balance Transfers
  async saveTransfer(transfer: BalanceTransfer): Promise<void> {
    const path = `balanceTransfers/${transfer.id}`;
    try {
      const cleanTransfer = sanitizeData(transfer);
      await withFirestoreRecovery(() =>
        setDoc(doc(db, 'balanceTransfers', transfer.id), cleanTransfer, { merge: true })
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Invite links
  async saveInviteLink(link: InviteLink): Promise<void> {
    const path = `inviteLinks/${link.id}`;
    try {
      const cleanLink = sanitizeData(link);
      await withFirestoreRecovery(() =>
        setDoc(doc(db, 'inviteLinks', link.id), cleanLink, { merge: true })
      );
      clearEntityPendingSync('inviteLinks', link.id);
    } catch (error) {
      markEntityPendingSync('inviteLinks', link.id);
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async deleteInviteLink(inviteId: string): Promise<void> {
    const path = `inviteLinks/${inviteId}`;
    try {
      await withFirestoreRecovery(() =>
        deleteDoc(doc(db, 'inviteLinks', inviteId))
      );
      clearEntityPendingSync('inviteLinks', inviteId);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async fetchInviteLinkByCodeFromServer(code: string): Promise<InviteLink | null> {
    const normalized = (code || '').trim();
    if (!normalized) return null;
    try {
      const snap = await withFirestoreRecovery(() =>
        getDocsFromServer(
          query(collection(db, 'inviteLinks'), where('code', '==', normalized))
        )
      );
      if (!snap.empty) {
        const first = snap.docs[0];
        return { ...(first.data() as InviteLink), id: first.id };
      }
      const upper = normalized.toUpperCase();
      if (upper !== normalized) {
        const upperSnap = await withFirestoreRecovery(() =>
          getDocsFromServer(
            query(collection(db, 'inviteLinks'), where('code', '==', upper))
          )
        );
        if (!upperSnap.empty) {
          const first = upperSnap.docs[0];
          return { ...(first.data() as InviteLink), id: first.id };
        }
      }
      return null;
    } catch {
      return null;
    }
  },

  // Supplier Bank Accounts
  async saveSupplierBankAccount(account: SupplierBankAccount): Promise<void> {
    const path = `supplierBankAccounts/${account.id}`;
    try {
      const cleanAccount = sanitizeData(account);
      await withFirestoreRecovery(() =>
        setDoc(doc(db, 'supplierBankAccounts', account.id), cleanAccount, { merge: true })
      );
      clearEntityPendingSync('supplierBankAccounts', account.id);
    } catch (error) {
      markEntityPendingSync('supplierBankAccounts', account.id);
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async deleteSupplierBankAccount(accountId: string): Promise<void> {
    const path = `supplierBankAccounts/${accountId}`;
    try {
      await withFirestoreRecovery(() =>
        deleteDoc(doc(db, 'supplierBankAccounts', accountId))
      );
      clearEntityPendingSync('supplierBankAccounts', accountId);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Seed all initial data to Firestore in chunked batches (safe above 500 operations)
  async seedInitialDataToFirestore(data: {
    posClients: POSClient[];
    suppliers: Supplier[];
    employees?: OfficeEmployee[];
    employeePermissions?: EmployeePermissionRecord[];
    superAdmin: SuperAdmin;
    platformSettings?: PlatformInterfaceSettings;
    catalogs: Catalog[];
    services: DigitalService[];
    voucherWarehouses?: VoucherWarehouse[];
    orders: Order[];
    depositRequests: DepositRequest[];
    loanRepaymentRequests?: LoanRepaymentRequest[];
    supplierBankAccounts?: SupplierBankAccount[];
    accountingEntries: AccountingEntry[];
    adminAccountingEntries: AdminAccountingEntry[];
    inviteLinks: InviteLink[];
    notifications?: AppNotification[];
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const nowIso = new Date().toISOString();
      const entries: Array<{ path: [string, string]; data: unknown }> = [
        { path: ['system', 'superAdmin'], data: data.superAdmin },
      ];

      if (data.platformSettings) {
        entries.push({ path: ['system', 'platformSettings'], data: data.platformSettings });
      }

      for (const client of data.posClients) {
        entries.push({ path: ['posClients', client.id], data: client });
      }
      for (const sup of data.suppliers) {
        entries.push({ path: ['suppliers', sup.id], data: stripEmployeesFromSupplierForStorage(sup) });
        for (const emp of sup.employees || []) {
          if (!emp?.id) continue;
          entries.push({
            path: ['employees', emp.id],
            data: buildSeparatedEmployeeDoc({ ...emp, supplierId: emp.supplierId || sup.id }, nowIso),
          });
          entries.push({
            path: ['employeePermissions', emp.id],
            data: buildEmployeePermissionRecord({ ...emp, supplierId: emp.supplierId || sup.id }, nowIso),
          });
        }
      }
      for (const emp of data.employees || []) {
        if (!emp?.id) continue;
        entries.push({ path: ['employees', emp.id], data: buildSeparatedEmployeeDoc(emp, nowIso) });
        entries.push({
          path: ['employeePermissions', emp.id],
          data: buildEmployeePermissionRecord(emp, nowIso),
        });
      }
      for (const perm of data.employeePermissions || []) {
        if (!perm?.id) continue;
        entries.push({ path: ['employeePermissions', perm.id], data: perm });
      }
      for (const cat of data.catalogs) {
        entries.push({ path: ['catalogs', cat.id], data: cat });
      }
      for (const srv of data.services) {
        entries.push({ path: ['services', srv.id], data: srv });
      }
      for (const wh of data.voucherWarehouses || []) {
        entries.push({ path: ['voucherWarehouses', wh.id], data: wh });
      }
      for (const ord of data.orders) {
        entries.push({ path: ['orders', ord.id], data: ord });
      }
      for (const dep of data.depositRequests) {
        entries.push({ path: ['depositRequests', dep.id], data: dep });
      }
      for (const req of data.loanRepaymentRequests || []) {
        entries.push({ path: ['loanRepaymentRequests', req.id], data: req });
      }
      for (const acc of data.supplierBankAccounts || []) {
        entries.push({ path: ['supplierBankAccounts', acc.id], data: acc });
      }
      for (const acc of data.accountingEntries) {
        entries.push({ path: ['accountingEntries', acc.id], data: acc });
      }
      for (const admAcc of data.adminAccountingEntries) {
        entries.push({ path: ['adminAccountingEntries', admAcc.id], data: admAcc });
      }
      for (const inv of data.inviteLinks) {
        entries.push({ path: ['inviteLinks', inv.id], data: inv });
      }
      for (const notif of data.notifications || []) {
        entries.push({ path: ['notifications', notif.id], data: notif });
      }

      await this.commitBatchSets(entries);
      await this.stripLegacyEmployeesFieldFromSuppliers(
        data.suppliers.map((s) => s.id).filter(Boolean)
      );
      await this.syncUsersForAccounts(data.suppliers, data.posClients, data.employees || []);
      return { success: true };
    } catch (err: unknown) {
      console.error('Error seeding data to Firestore:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  // Delete any account associated with a specific email from all collections
  async deleteAccountByEmail(email: string): Promise<{ deletedCount: number }> {
    const targetEmail = email.trim().toLowerCase();
    let deletedCount = 0;
    try {
      // 1. Delete matching users
      const usersSnap = await getDocs(collection(db, 'users'));
      for (const docSnap of usersSnap.docs) {
        const data = docSnap.data();
        if (data.email && String(data.email).trim().toLowerCase() === targetEmail) {
          await deleteDoc(doc(db, 'users', docSnap.id));
          deletedCount++;
        }
      }

      // 2. Delete matching employees & their separated permissions
      const empsSnap = await getDocs(collection(db, 'employees'));
      for (const docSnap of empsSnap.docs) {
        const data = docSnap.data();
        if (data.email && String(data.email).trim().toLowerCase() === targetEmail) {
          await deleteDoc(doc(db, 'employees', docSnap.id));
          await deleteDoc(doc(db, 'employeePermissions', docSnap.id)).catch(() => {});
          deletedCount++;
        }
      }

      // 3. Delete matching posClients
      const posSnap = await getDocs(collection(db, 'posClients'));
      for (const docSnap of posSnap.docs) {
        const data = docSnap.data();
        if (data.email && String(data.email).trim().toLowerCase() === targetEmail) {
          await deleteDoc(doc(db, 'posClients', docSnap.id));
          deletedCount++;
        }
      }

      // 4. Delete matching suppliers or remove matching legacy embedded employee
      const supSnap = await getDocs(collection(db, 'suppliers'));
      for (const docSnap of supSnap.docs) {
        const data = docSnap.data() as Supplier;
        if (data.email && String(data.email).trim().toLowerCase() === targetEmail) {
          await deleteDoc(doc(db, 'suppliers', docSnap.id));
          deletedCount++;
        } else if (data.employees && Array.isArray(data.employees)) {
          const filteredEmps = data.employees.filter(e => e.email?.trim().toLowerCase() !== targetEmail);
          if (filteredEmps.length !== data.employees.length) {
            await setDoc(doc(db, 'suppliers', docSnap.id), { ...data, employees: filteredEmps }, { merge: true });
            deletedCount++;
          }
        }
      }
    } catch (err) {
      console.error('Error deleting account by email from Firestore:', err);
    }
    return { deletedCount };
  },

  async commitBatchDeletes(refs: DocumentReference[]): Promise<number> {
    if (refs.length === 0) return 0;
    const CHUNK_SIZE = 400;
    let deleted = 0;
    for (let i = 0; i < refs.length; i += CHUNK_SIZE) {
      const chunk = refs.slice(i, i + CHUNK_SIZE);
      await withFirestoreRecovery(async () => {
        const batch = writeBatch(db);
        for (const ref of chunk) {
          batch.delete(doc(db, ref.path));
        }
        await batch.commit();
      });
      deleted += chunk.length;
    }
    return deleted;
  },

  // Reset all services, warehouses, non-fixed catalogs, operational data, and ALL users EXCEPT Super Admin & Admin staff
  async resetServicesAndNonAdminData(
    localSuperAdmin?: Partial<SuperAdmin> | null
  ): Promise<{
    usersCleared: number;
    usersPreserved: number;
    suppliersCleared: number;
    clientsCleared: number;
    servicesCleared: number;
    warehousesCleared: number;
    totalCleared: number;
  }> {
    let usersCleared = 0;
    let usersPreserved = 0;
    let suppliersCleared = 0;
    let clientsCleared = 0;
    let servicesCleared = 0;
    let warehousesCleared = 0;
    let totalCleared = 0;

    try {
      let remoteAdmin: Partial<SuperAdmin> | null = null;
      try {
        const adminSnap = await withFirestoreRecovery(() =>
          getDoc(doc(db, 'system', 'superAdmin'))
        );
        if (adminSnap.exists()) {
          remoteAdmin = adminSnap.data() as Partial<SuperAdmin>;
        }
      } catch (err) {
        console.warn('Could not read system/superAdmin before reset:', err);
      }

      const mergedAdmin = mergeSuperAdminAccountsForPreservation(localSuperAdmin, remoteAdmin);

      // 1. Delete all docs in non-admin collections
      for (const colName of FIRESTORE_COLLECTIONS_TO_CLEAR) {
        const snap = await withFirestoreRecovery(() => getDocs(collection(db, colName)));
        if (snap.empty) continue;
        const refs = snap.docs.map(d => doc(db, colName, d.id));
        const deletedCount = await this.commitBatchDeletes(refs);
        totalCleared += deletedCount;
        if (colName === 'suppliers') suppliersCleared = deletedCount;
        if (colName === 'posClients') clientsCleared = deletedCount;
        if (colName === 'services') servicesCleared = deletedCount;
        if (colName === 'voucherWarehouses') warehousesCleared = deletedCount;
      }

      // 2. Delete non-fixed catalogs (preserve admin-fixed catalogs only)
      const catalogsSnap = await withFirestoreRecovery(() => getDocs(collection(db, 'catalogs')));
      if (!catalogsSnap.empty) {
        const catalogRefsToDelete: DocumentReference[] = [];
        catalogsSnap.docs.forEach(docSnap => {
          const catData = docSnap.data() as Partial<Catalog>;
          const isFixed = Boolean(catData?.isFixedByAdmin === true || catData?.supplierId === 'all');
          if (!isFixed) {
            catalogRefsToDelete.push(doc(db, 'catalogs', docSnap.id));
          }
        });
        totalCleared += await this.commitBatchDeletes(catalogRefsToDelete);
      }

      // 3. Delete all non-admin users while preserving Super Admin and Admin staff
      const usersSnap = await withFirestoreRecovery(() => getDocs(collection(db, 'users')));
      if (!usersSnap.empty) {
        const userRefsToDelete: DocumentReference[] = [];
        usersSnap.docs.forEach(docSnap => {
          const userData = { id: docSnap.id, ...(docSnap.data() as Partial<AuthUser>) };
          if (isPreservedAdminAuthUser(userData, mergedAdmin)) {
            usersPreserved++;
          } else {
            userRefsToDelete.push(doc(db, 'users', docSnap.id));
          }
        });
        usersCleared = await this.commitBatchDeletes(userRefsToDelete);
        totalCleared += usersCleared;
      }

      // 4. Zero Super Admin mock walletBalance & strip mock IBAN while preserving adminAccounts & real banks
      const baseAdmin: Partial<SuperAdmin> = remoteAdmin || localSuperAdmin || {};
      const sanitizedAdmin = sanitizeSuperAdminForCleanReset({
        ...baseAdmin,
        email: mergedAdmin.email,
        adminAccounts: (remoteAdmin?.adminAccounts || localSuperAdmin?.adminAccounts || []) as SuperAdmin['adminAccounts'],
      });
      await withFirestoreRecovery(() =>
        setDoc(doc(db, 'system', 'superAdmin'), sanitizeData(sanitizedAdmin), { merge: true })
      );
    } catch (err) {
      console.error('Error resetting services and non-admin data in Firestore:', err);
    }

    return {
      usersCleared,
      usersPreserved,
      suppliersCleared,
      clientsCleared,
      servicesCleared,
      warehousesCleared,
      totalCleared,
    };
  },

  async ensureCleanStateMigrationOnce(
    localSuperAdmin?: Partial<SuperAdmin> | null
  ): Promise<{
    migrated: boolean;
    summary?: {
      usersCleared: number;
      usersPreserved: number;
      suppliersCleared: number;
      clientsCleared: number;
      servicesCleared: number;
      warehousesCleared: number;
      totalCleared: number;
    };
  }> {
    try {
      const markerSnap = await getDocPreferServer(() => doc(db, 'system', 'cleanStateMigrationV2'));
      if (markerSnap.exists()) {
        return { migrated: false };
      }

      const summary = await this.resetServicesAndNonAdminData(localSuperAdmin);
      await withFirestoreRecovery(() =>
        setDoc(doc(db, 'system', 'cleanStateMigrationV2'), {
          completedAt: new Date().toISOString(),
          preserved: 'super_admin_and_staff',
          summary,
        })
      );
      return { migrated: true, summary };
    } catch (err) {
      if (
        isTransientFirestoreError(err) ||
        isFirestoreCacheMissError(err) ||
        isFirestoreInternalAssertionError(err) ||
        isNavigatorOffline()
      ) {
        console.warn('Clean state migration check deferred (offline/transient):', err);
        return { migrated: false };
      }
      console.error('Error running one-time clean state migration:', err);
      return { migrated: false };
    }
  },

  // Clear all services, operational data, and non-admin users from Firestore (preserving Super Admin & staff)
  async clearUsersSuppliersAndClients(
    localSuperAdmin?: Partial<SuperAdmin> | null
  ): Promise<{
    usersCleared: number;
    usersPreserved: number;
    suppliersCleared: number;
    clientsCleared: number;
    servicesCleared: number;
    warehousesCleared: number;
    totalCleared: number;
  }> {
    return this.resetServicesAndNonAdminData(localSuperAdmin);
  }
};
