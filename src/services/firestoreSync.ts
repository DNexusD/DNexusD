import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
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

function sanitizeData<T>(obj: T): T {
  if (obj === undefined || obj === null) return obj;
  return JSON.parse(JSON.stringify(obj));
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
      getDoc(doc(db, 'system', 'superAdmin')),
      getDoc(doc(db, 'system', 'platformSettings')),
      getDocs(collection(db, 'suppliers')),
      getDocs(collection(db, 'posClients')),
    ]);

    if (adminRes.status === 'fulfilled' && adminRes.value.exists()) {
      result.superAdmin = adminRes.value.data() as Partial<SuperAdmin>;
    }
    if (settingsRes.status === 'fulfilled' && settingsRes.value.exists()) {
      result.platformSettings = settingsRes.value.data() as Partial<PlatformInterfaceSettings>;
    }
    if (suppliersRes.status === 'fulfilled') {
      const supMap = new Map<string, Supplier>();
      suppliersRes.value.forEach(docSnap => {
        const sup = docSnap.data() as Supplier;
        if (sup && sup.id) supMap.set(sup.id, sup);
      });
      result.suppliers = Array.from(supMap.values());
    }
    if (clientsRes.status === 'fulfilled') {
      const clientMap = new Map<string, POSClient>();
      clientsRes.value.forEach(docSnap => {
        const client = docSnap.data() as POSClient;
        if (client && client.id) clientMap.set(client.id, client);
      });
      result.posClients = Array.from(clientMap.values());
    }

    return result;
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
      const snap = await getDoc(doc(db, 'users', userId));
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
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Supplier operations
  async saveSupplier(supplier: Supplier): Promise<void> {
    const path = `suppliers/${supplier.id}`;
    try {
      await setDoc(doc(db, 'suppliers', supplier.id), sanitizeData(supplier), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Super Admin operations
  async saveSuperAdmin(admin: SuperAdmin): Promise<void> {
    const path = 'system/superAdmin';
    try {
      await setDoc(doc(db, 'system', 'superAdmin'), sanitizeData(admin), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Platform Interface Settings (Fixed Catalogs, Dropdown Lists, Portal Settings)
  async savePlatformSettings(settings: PlatformInterfaceSettings): Promise<void> {
    const path = 'system/platformSettings';
    try {
      await setDoc(doc(db, 'system', 'platformSettings'), sanitizeData(settings), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Order operations
  async saveOrder(order: Order): Promise<void> {
    const path = `orders/${order.id}`;
    try {
      await setDoc(doc(db, 'orders', order.id), sanitizeData(order), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Deposit Request and Loans
  async saveDepositRequest(req: DepositRequest): Promise<void> {
    const path = `depositRequests/${req.id}`;
    try {
      await setDoc(doc(db, 'depositRequests', req.id), sanitizeData(req), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Loan Repayment Requests
  async saveLoanRepaymentRequest(req: LoanRepaymentRequest): Promise<void> {
    const path = `loanRepaymentRequests/${req.id}`;
    try {
      await setDoc(doc(db, 'loanRepaymentRequests', req.id), sanitizeData(req), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Accounting entries
  async saveAccountingEntry(entry: AccountingEntry): Promise<void> {
    const path = `accountingEntries/${entry.id}`;
    try {
      await setDoc(doc(db, 'accountingEntries', entry.id), sanitizeData(entry), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Admin accounting entries
  async saveAdminAccountingEntry(entry: AdminAccountingEntry): Promise<void> {
    const path = `adminAccountingEntries/${entry.id}`;
    try {
      await setDoc(doc(db, 'adminAccountingEntries', entry.id), sanitizeData(entry), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Catalogs & Services
  async saveCatalog(cat: Catalog): Promise<void> {
    const path = `catalogs/${cat.id}`;
    try {
      await setDoc(doc(db, 'catalogs', cat.id), sanitizeData(cat), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async deleteCatalog(catalogId: string): Promise<void> {
    const path = `catalogs/${catalogId}`;
    try {
      await deleteDoc(doc(db, 'catalogs', catalogId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async saveService(service: DigitalService): Promise<void> {
    const path = `services/${service.id}`;
    try {
      await setDoc(doc(db, 'services', service.id), sanitizeData(service), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async deleteService(serviceId: string): Promise<void> {
    const path = `services/${serviceId}`;
    try {
      await deleteDoc(doc(db, 'services', serviceId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Voucher Warehouses
  async saveVoucherWarehouse(warehouse: VoucherWarehouse): Promise<void> {
    const path = `voucherWarehouses/${warehouse.id}`;
    try {
      await setDoc(doc(db, 'voucherWarehouses', warehouse.id), sanitizeData(warehouse), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async deleteVoucherWarehouse(warehouseId: string): Promise<void> {
    const path = `voucherWarehouses/${warehouseId}`;
    try {
      await deleteDoc(doc(db, 'voucherWarehouses', warehouseId));
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
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Supplier Bank Accounts
  async saveSupplierBankAccount(account: SupplierBankAccount): Promise<void> {
    const path = `supplierBankAccounts/${account.id}`;
    try {
      await setDoc(doc(db, 'supplierBankAccounts', account.id), sanitizeData(account), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async deleteSupplierBankAccount(accountId: string): Promise<void> {
    const path = `supplierBankAccounts/${accountId}`;
    try {
      await deleteDoc(doc(db, 'supplierBankAccounts', accountId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Seed all initial data to Firestore in a batch
  async seedInitialDataToFirestore(data: {
    posClients: POSClient[];
    suppliers: Supplier[];
    superAdmin: SuperAdmin;
    catalogs: Catalog[];
    services: DigitalService[];
    orders: Order[];
    depositRequests: DepositRequest[];
    loanRepaymentRequests?: LoanRepaymentRequest[];
    supplierBankAccounts?: SupplierBankAccount[];
    accountingEntries: AccountingEntry[];
    adminAccountingEntries: AdminAccountingEntry[];
    inviteLinks: InviteLink[];
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const batch = writeBatch(db);

      // Seed SuperAdmin
      batch.set(doc(db, 'system', 'superAdmin'), sanitizeData(data.superAdmin));

      // Seed POS Clients
      for (const client of data.posClients) {
        batch.set(doc(db, 'posClients', client.id), sanitizeData(client));
      }

      // Seed Suppliers
      for (const sup of data.suppliers) {
        batch.set(doc(db, 'suppliers', sup.id), sanitizeData(sup));
      }

      // Seed Catalogs
      for (const cat of data.catalogs) {
        batch.set(doc(db, 'catalogs', cat.id), sanitizeData(cat));
      }

      // Seed Services
      for (const srv of data.services) {
        batch.set(doc(db, 'services', srv.id), sanitizeData(srv));
      }

      // Seed Orders
      for (const ord of data.orders) {
        batch.set(doc(db, 'orders', ord.id), sanitizeData(ord));
      }

      // Seed Deposits & Loans
      for (const dep of data.depositRequests) {
        batch.set(doc(db, 'depositRequests', dep.id), sanitizeData(dep));
      }

      // Seed Loan Repayment Requests
      if (data.loanRepaymentRequests) {
        for (const req of data.loanRepaymentRequests) {
          batch.set(doc(db, 'loanRepaymentRequests', req.id), sanitizeData(req));
        }
      }

      // Seed Supplier Bank Accounts
      if (data.supplierBankAccounts) {
        for (const acc of data.supplierBankAccounts) {
          batch.set(doc(db, 'supplierBankAccounts', acc.id), sanitizeData(acc));
        }
      }

      // Seed Accounting
      for (const acc of data.accountingEntries) {
        batch.set(doc(db, 'accountingEntries', acc.id), sanitizeData(acc));
      }

      // Seed Admin Accounting
      for (const admAcc of data.adminAccountingEntries) {
        batch.set(doc(db, 'adminAccountingEntries', admAcc.id), sanitizeData(admAcc));
      }

      // Seed Invites
      for (const inv of data.inviteLinks) {
        batch.set(doc(db, 'inviteLinks', inv.id), sanitizeData(inv));
      }

      await batch.commit();
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
      const markerSnap = await getDoc(markerRef);
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
