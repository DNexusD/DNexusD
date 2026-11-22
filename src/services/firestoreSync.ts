import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  query,
  where,
  setDoc,
  deleteDoc,
  writeBatch,
  DocumentReference
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
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

async function getDocPreferServer(ref: DocumentReference) {
  try {
    return await getDocFromServer(ref);
  } catch {
    return await getDoc(ref);
  }
}

async function getDocsPreferServer(colName: string) {
  const colRef = collection(db, colName);
  try {
    return await getDocsFromServer(colRef);
  } catch {
    return await getDocs(colRef);
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
  // Lightweight one-time bootstrap for login / registration screens without opening Watch streams
  async fetchAuthBootstrapData(): Promise<{
    superAdmin?: Partial<SuperAdmin>;
    platformSettings?: Partial<PlatformInterfaceSettings>;
    suppliers?: Supplier[];
    posClients?: POSClient[];
  }> {
    const result: {
      superAdmin?: Partial<SuperAdmin>;
      platformSettings?: Partial<PlatformInterfaceSettings>;
      suppliers?: Supplier[];
      posClients?: POSClient[];
    } = {};

    const [adminRes, settingsRes, suppliersRes, clientsRes] = await Promise.allSettled([
      getDocPreferServer(doc(db, 'system', 'superAdmin')),
      getDocPreferServer(doc(db, 'system', 'platformSettings')),
      getDocsPreferServer('suppliers'),
      getDocsPreferServer('posClients'),
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

    return result;
  },

  // Fetch all remote databases directly from Firestore server for full local <-> remote reconciliation
  async fetchAllDatabasesFromServer(): Promise<FullDatabaseSnapshot> {
    const [
      adminSnap,
      settingsSnap,
      suppliersSnap,
      posClientsSnap,
      catalogsSnap,
      servicesSnap,
      voucherWarehousesSnap,
      ordersSnap,
      depositRequestsSnap,
      loanRepaymentRequestsSnap,
      supplierBankAccountsSnap,
      accountingEntriesSnap,
      adminAccountingEntriesSnap,
      inviteLinksSnap,
    ] = await Promise.all([
      getDocFromServer(doc(db, 'system', 'superAdmin')),
      getDocFromServer(doc(db, 'system', 'platformSettings')),
      getDocsFromServer(collection(db, 'suppliers')),
      getDocsFromServer(collection(db, 'posClients')),
      getDocsFromServer(collection(db, 'catalogs')),
      getDocsFromServer(collection(db, 'services')),
      getDocsFromServer(collection(db, 'voucherWarehouses')),
      getDocsFromServer(collection(db, 'orders')),
      getDocsFromServer(collection(db, 'depositRequests')),
      getDocsFromServer(collection(db, 'loanRepaymentRequests')),
      getDocsFromServer(collection(db, 'supplierBankAccounts')),
      getDocsFromServer(collection(db, 'accountingEntries')),
      getDocsFromServer(collection(db, 'adminAccountingEntries')),
      getDocsFromServer(collection(db, 'inviteLinks')),
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
    const clientsQuery = query(
      collection(db, 'posClients'),
      where('supplierId', '==', supplierId)
    );
    const usersQuery = query(
      collection(db, 'users'),
      where('role', '==', 'pos_client')
    );

    const [clientsSnap, usersSnap] = await Promise.all([
      getDocsFromServer(clientsQuery),
      getDocsFromServer(usersQuery).catch(() => null),
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
      const batch = writeBatch(db);
      for (const entry of chunk) {
        batch.set(
          doc(db, entry.path[0], entry.path[1]),
          sanitizeData(entry.data) as Record<string, unknown>,
          { merge: true }
        );
      }
      await batch.commit();
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
      await setDoc(doc(db, 'users', user.id), cleanUser, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async getUser(userId: string): Promise<AuthUser | null> {
    const path = `users/${userId}`;
    try {
      const snap = await getDocPreferServer(doc(db, 'users', userId));
      return snap.exists() ? (snap.data() as AuthUser) : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  async deleteUser(userId: string): Promise<void> {
    const path = `users/${userId}`;
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // POS Client operations
  async savePosClient(client: POSClient): Promise<void> {
    const path = `posClients/${client.id}`;
    try {
      await setDoc(doc(db, 'posClients', client.id), sanitizeData(client), { merge: true });
      clearEntityPendingSync('posClients', client.id);
    } catch (error) {
      markEntityPendingSync('posClients', client.id);
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Supplier operations
  async saveSupplier(supplier: Supplier): Promise<void> {
    const path = `suppliers/${supplier.id}`;
    try {
      await setDoc(doc(db, 'suppliers', supplier.id), sanitizeData(supplier), { merge: true });
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
      await setDoc(doc(db, 'system', 'superAdmin'), sanitizeData(admin), { merge: true });
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
      await setDoc(doc(db, 'system', 'platformSettings'), sanitizeData(settings), { merge: true });
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
      await setDoc(doc(db, 'orders', order.id), sanitizeData(order), { merge: true });
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
      await setDoc(doc(db, 'depositRequests', req.id), sanitizeData(req), { merge: true });
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
      await setDoc(doc(db, 'loanRepaymentRequests', req.id), sanitizeData(req), { merge: true });
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
      await setDoc(doc(db, 'accountingEntries', entry.id), sanitizeData(entry), { merge: true });
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
      await setDoc(doc(db, 'adminAccountingEntries', entry.id), sanitizeData(entry), { merge: true });
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
      await setDoc(doc(db, 'catalogs', cat.id), sanitizeData(cat), { merge: true });
      clearEntityPendingSync('catalogs', cat.id);
    } catch (error) {
      markEntityPendingSync('catalogs', cat.id);
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async deleteCatalog(catalogId: string): Promise<void> {
    const path = `catalogs/${catalogId}`;
    try {
      await deleteDoc(doc(db, 'catalogs', catalogId));
      clearEntityPendingSync('catalogs', catalogId);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async saveService(service: DigitalService): Promise<void> {
    const path = `services/${service.id}`;
    try {
      await setDoc(doc(db, 'services', service.id), sanitizeData(service), { merge: true });
      clearEntityPendingSync('services', service.id);
    } catch (error) {
      markEntityPendingSync('services', service.id);
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async deleteService(serviceId: string): Promise<void> {
    const path = `services/${serviceId}`;
    try {
      await deleteDoc(doc(db, 'services', serviceId));
      clearEntityPendingSync('services', serviceId);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Voucher Warehouses
  async saveVoucherWarehouse(warehouse: VoucherWarehouse): Promise<void> {
    const path = `voucherWarehouses/${warehouse.id}`;
    try {
      await setDoc(doc(db, 'voucherWarehouses', warehouse.id), sanitizeData(warehouse), { merge: true });
      clearEntityPendingSync('voucherWarehouses', warehouse.id);
    } catch (error) {
      markEntityPendingSync('voucherWarehouses', warehouse.id);
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async deleteVoucherWarehouse(warehouseId: string): Promise<void> {
    const path = `voucherWarehouses/${warehouseId}`;
    try {
      await deleteDoc(doc(db, 'voucherWarehouses', warehouseId));
      clearEntityPendingSync('voucherWarehouses', warehouseId);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Balance Transfers
  async saveTransfer(transfer: BalanceTransfer): Promise<void> {
    const path = `balanceTransfers/${transfer.id}`;
    try {
      await setDoc(doc(db, 'balanceTransfers', transfer.id), sanitizeData(transfer), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Invite links
  async saveInviteLink(link: InviteLink): Promise<void> {
    const path = `inviteLinks/${link.id}`;
    try {
      await setDoc(doc(db, 'inviteLinks', link.id), sanitizeData(link), { merge: true });
      clearEntityPendingSync('inviteLinks', link.id);
    } catch (error) {
      markEntityPendingSync('inviteLinks', link.id);
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Supplier Bank Accounts
  async saveSupplierBankAccount(account: SupplierBankAccount): Promise<void> {
    const path = `supplierBankAccounts/${account.id}`;
    try {
      await setDoc(doc(db, 'supplierBankAccounts', account.id), sanitizeData(account), { merge: true });
      clearEntityPendingSync('supplierBankAccounts', account.id);
    } catch (error) {
      markEntityPendingSync('supplierBankAccounts', account.id);
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async deleteSupplierBankAccount(accountId: string): Promise<void> {
    const path = `supplierBankAccounts/${accountId}`;
    try {
      await deleteDoc(doc(db, 'supplierBankAccounts', accountId));
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
      const batch = writeBatch(db);
      for (const ref of chunk) {
        batch.delete(ref);
      }
      await batch.commit();
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
        const adminSnap = await getDoc(doc(db, 'system', 'superAdmin'));
        if (adminSnap.exists()) {
          remoteAdmin = adminSnap.data() as Partial<SuperAdmin>;
        }
      } catch (err) {
        console.warn('Could not read system/superAdmin before reset:', err);
      }

      const mergedAdmin = mergeSuperAdminAccountsForPreservation(localSuperAdmin, remoteAdmin);

      // 1. Delete all docs in non-admin collections
      for (const colName of FIRESTORE_COLLECTIONS_TO_CLEAR) {
        const snap = await getDocs(collection(db, colName));
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
      const catalogsSnap = await getDocs(collection(db, 'catalogs'));
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
      const usersSnap = await getDocs(collection(db, 'users'));
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
      await setDoc(doc(db, 'system', 'superAdmin'), sanitizeData(sanitizedAdmin), { merge: true });
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
      const markerRef = doc(db, 'system', 'cleanStateMigrationV2');
      const markerSnap = await getDocPreferServer(markerRef);
      if (markerSnap.exists()) {
        return { migrated: false };
      }

      const summary = await this.resetServicesAndNonAdminData(localSuperAdmin);
      await setDoc(markerRef, {
        completedAt: new Date().toISOString(),
        preserved: 'super_admin_and_staff',
        summary,
      });
      return { migrated: true, summary };
    } catch (err) {
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
