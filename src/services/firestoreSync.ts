import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch
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
  PlatformInterfaceSettings
} from '../types';

function sanitizeData<T>(obj: T): T {
  if (obj === undefined || obj === null) return obj;
  return JSON.parse(JSON.stringify(obj));
}

export const firestoreSync = {
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

  // Clear all users, suppliers, and posClients collections from Firestore
  async clearUsersSuppliersAndClients(): Promise<{ usersCleared: number; suppliersCleared: number; clientsCleared: number }> {
    let usersCleared = 0;
    let suppliersCleared = 0;
    let clientsCleared = 0;

    try {
      // 1. Delete all records in users collection
      const usersSnap = await getDocs(collection(db, 'users'));
      for (const docSnap of usersSnap.docs) {
        await deleteDoc(doc(db, 'users', docSnap.id));
        usersCleared++;
      }

      // 2. Delete all records in posClients collection
      const clientsSnap = await getDocs(collection(db, 'posClients'));
      for (const docSnap of clientsSnap.docs) {
        await deleteDoc(doc(db, 'posClients', docSnap.id));
        clientsCleared++;
      }

      // 3. Delete all records in suppliers collection
      const suppliersSnap = await getDocs(collection(db, 'suppliers'));
      for (const docSnap of suppliersSnap.docs) {
        await deleteDoc(doc(db, 'suppliers', docSnap.id));
        suppliersCleared++;
      }
    } catch (err) {
      console.error('Error clearing users, suppliers and posClients from Firestore:', err);
    }

    return { usersCleared, suppliersCleared, clientsCleared };
  }
};
