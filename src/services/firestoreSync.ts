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
  setDoc,
  deleteDoc,
  writeBatch,
  DocumentReference,
  Query
} from 'firebase/firestore';
import {
  db,
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
  VoucherWarehouse
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
import { normalizeEmployeePermissions, normalizeStoreEmail } from '../utils/employeePermissions';

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
  // Authoritative server-only identity fetch for post-login & session restoration.
  // Never relies on local memory cache so role & store routing strictly reflect Firestore state.
  async fetchAuthoritativeIdentityDataFromFirestore(
    email: string,
    uid?: string
  ): Promise<{
    connected: boolean;
    superAdmin: Partial<SuperAdmin> | null;
    suppliers: Supplier[] | null;
    posClients: POSClient[] | null;
    userDoc: AuthUser | null;
    error?: unknown;
  }> {
    const cleanEmail = normalizeStoreEmail(email);
    try {
      const [adminSnap, suppliersSnap, clientsSnap, uidUserSnap, emailUsersSnap] = await Promise.all([
        safeGetDocFromServer(['system', 'superAdmin']),
        safeGetDocsFromServer('suppliers'),
        safeGetDocsFromServer('posClients'),
        uid ? safeGetDocFromServer(['users', uid]).catch(() => null) : Promise.resolve(null),
        cleanEmail
          ? withFirestoreRecovery(() =>
              getDocsFromServer(query(collection(db, 'users'), where('email', '==', cleanEmail)))
            ).catch(() => null)
          : Promise.resolve(null),
      ]);

      let userDoc: AuthUser | null = null;
      if (uidUserSnap && uidUserSnap.exists()) {
        userDoc = {
          ...(uidUserSnap.data() as AuthUser),
          id: uidUserSnap.id,
        };
      } else if (emailUsersSnap && !emailUsersSnap.empty) {
        const firstDoc = emailUsersSnap.docs[0];
        userDoc = {
          ...(firstDoc.data() as AuthUser),
          id: firstDoc.id,
        };
      }

      return {
        connected: true,
        superAdmin: adminSnap.exists() ? (adminSnap.data() as Partial<SuperAdmin>) : null,
        suppliers: mapDocsById<Supplier>(suppliersSnap.docs),
        posClients: mapDocsById<POSClient>(clientsSnap.docs),
        userDoc,
      };
    } catch (error) {
      return {
        connected: false,
        superAdmin: null,
        suppliers: null,
        posClients: null,
        userDoc: null,
        error,
      };
    }
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
    const [adminSnap, settingsSnap, suppliersSnap, posClientsSnap] = await Promise.all([
      safeGetDocFromServer(['system', 'superAdmin']),
      safeGetDocFromServer(['system', 'platformSettings']),
      safeGetDocsFromServer('suppliers'),
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

    const [accountingEntriesSnap, adminAccountingEntriesSnap, inviteLinksSnap] = await Promise.all([
      safeGetDocsFromServer('accountingEntries'),
      safeGetDocsFromServer('adminAccountingEntries'),
      safeGetDocsFromServer('inviteLinks'),
    ]);

    return {
      superAdmin: adminSnap.exists() ? (adminSnap.data() as Partial<SuperAdmin>) : null,
      platformSettings: settingsSnap.exists()
        ? (settingsSnap.data() as Partial<PlatformInterfaceSettings>)
        : null,
      suppliers: mapDocsById<Supplier>(suppliersSnap.docs),
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

  async syncUsersForAccounts(suppliers: Supplier[], posClients: POSClient[]): Promise<number> {
    const userEntries: Array<{ path: [string, string]; data: unknown }> = [];
    const nowIso = new Date().toISOString();

    for (const sup of suppliers) {
      if (!sup?.id) continue;
      if (sup.email) {
        const cleanSupEmail = normalizeStoreEmail(sup.email);
        const supUser: AuthUser & { updatedAt: string } = {
          id: sup.id,
          email: cleanSupEmail,
          name: sup.name,
          role: 'supplier',
          phone: sup.phone,
          associatedId: sup.id,
          updatedAt: nowIso,
        };
        userEntries.push({ path: ['users', sup.id], data: supUser });
      }
      for (const emp of sup.employees || []) {
        if (!emp?.id || !emp.email) continue;
        const empUser: AuthUser & { updatedAt: string } = {
          id: emp.id,
          email: normalizeStoreEmail(emp.email),
          name: emp.name,
          role: 'employee',
          phone: emp.phone,
          associatedId: sup.id,
          supplierId: sup.id,
          employeeId: emp.id,
          roleTitle: emp.roleTitle,
          permissions: normalizeEmployeePermissions(emp.permissions),
          updatedAt: nowIso,
        };
        userEntries.push({ path: ['users', emp.id], data: empUser });
      }
    }

    for (const client of posClients) {
      if (!client?.id || !client.email) continue;
      const clientUser: AuthUser & { updatedAt: string } = {
        id: client.id,
        email: normalizeStoreEmail(client.email),
        name: client.ownerName || client.tradeName,
        role: 'pos_client',
        phone: client.phone,
        associatedId: client.id,
        updatedAt: nowIso,
      };
      userEntries.push({ path: ['users', client.id], data: clientUser });
    }

    return this.commitBatchSets(userEntries);
  },

  // Sync User profile
  async saveUser(user: AuthUser): Promise<void> {
    const path = `users/${user.id}`;
    try {
      const cleanUser = sanitizeData({
        ...user,
        updatedAt: new Date().toISOString()
      });
      await withFirestoreRecovery(() =>
        setDoc(doc(db, 'users', user.id), cleanUser, { merge: true })
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
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
    const cleanEmail = normalizeStoreEmail(email);
    if (!cleanEmail) return null;
    try {
      let snap = await getDocsQueryPreferServer(() =>
        query(collection(db, 'users'), where('email', '==', cleanEmail))
      );
      if (snap.empty && email.trim() !== cleanEmail) {
        snap = await getDocsQueryPreferServer(() =>
          query(collection(db, 'users'), where('email', '==', email.trim()))
        );
      }
      if (snap.empty) return null;
      const firstDoc = snap.docs[0];
      return {
        ...(firstDoc.data() as AuthUser),
        id: firstDoc.id,
      };
    } catch {
      return null;
    }
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

  // POS Client operations
  async savePosClient(client: POSClient): Promise<void> {
    const path = `posClients/${client.id}`;
    try {
      const cleanClient = sanitizeData(client);
      await withFirestoreRecovery(() =>
        setDoc(doc(db, 'posClients', client.id), cleanClient, { merge: true })
      );
      clearEntityPendingSync('posClients', client.id);
    } catch (error) {
      markEntityPendingSync('posClients', client.id);
      handleFirestoreError(error, OperationType.WRITE, path);
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
    await this.deletePosClient(posId);

    // Clean up associated user profile docs so deleted client accounts cannot restore cleanly
    try {
      await withFirestoreRecovery(() => deleteDoc(doc(db, 'users', posId))).catch(() => {});

      const assocSnap = await withFirestoreRecovery(() =>
        getDocs(query(collection(db, 'users'), where('associatedId', '==', posId)))
      ).catch(() => null);
      if (assocSnap && !assocSnap.empty) {
        await this.commitBatchDeletes(
          assocSnap.docs.map((d) => doc(db, 'users', d.id))
        );
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
            await this.commitBatchDeletes(refsToDelete);
          }
        }
      }
    } catch (err) {
      console.warn('Partial cleanup while deleting POS client user docs:', err);
    }
  },

  // Supplier operations
  async saveSupplier(supplier: Supplier): Promise<void> {
    const path = `suppliers/${supplier.id}`;
    try {
      const cleanSupplier = sanitizeData(supplier);
      await withFirestoreRecovery(() =>
        setDoc(doc(db, 'suppliers', supplier.id), cleanSupplier, { merge: true })
      );
      clearEntityPendingSync('suppliers', supplier.id);
    } catch (error) {
      markEntityPendingSync('suppliers', supplier.id);
      handleFirestoreError(error, OperationType.WRITE, path);
    }
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
  }): Promise<{ success: boolean; error?: string }> {
    try {
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
        entries.push({ path: ['suppliers', sup.id], data: sup });
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

      await this.commitBatchSets(entries);
      await this.syncUsersForAccounts(data.suppliers, data.posClients);
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

      // 2. Delete matching posClients
      const posSnap = await getDocs(collection(db, 'posClients'));
      for (const docSnap of posSnap.docs) {
        const data = docSnap.data();
        if (data.email && String(data.email).trim().toLowerCase() === targetEmail) {
          await deleteDoc(doc(db, 'posClients', docSnap.id));
          deletedCount++;
        }
      }

      // 3. Delete matching suppliers or remove matching employee
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
