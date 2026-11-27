import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  setDoc,
  QueryConstraint
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { ClientWallet, WalletTransaction, WalletTransactionType, WalletReferenceType } from '../types/wallet';
import { executeIndexedQueryWithFallback, sortRecordsByDateDesc } from '../utils/firestoreIndexQueries';

export const walletService = {
  getWalletDocId(clientId: string): string {
    const clean = (clientId || '').trim();
    return clean.startsWith('wallet-') ? clean : `wallet-${clean}`;
  },

  async ensureWalletExists(clientId: string, supplierId: string = 'platform', currency: 'SAR' | 'USD' = 'SAR'): Promise<ClientWallet> {
    const cleanClientId = (clientId || '').trim();
    if (!cleanClientId) {
      throw new Error('Invalid client ID for wallet initialization.');
    }
    const walletId = this.getWalletDocId(cleanClientId);
    const walletRef = doc(db, 'wallets', walletId);

    try {
      const snap = await getDoc(walletRef);
      if (snap.exists()) {
        return snap.data() as ClientWallet;
      }

      const nowIso = new Date().toISOString();
      const newWallet: ClientWallet = {
        id: walletId,
        clientId: cleanClientId,
        supplierId: supplierId || 'platform',
        currency: currency || 'SAR',
        availableBalance: 0,
        pendingBalance: 0,
        totalDeposited: 0,
        totalSpent: 0,
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso
      };

      await setDoc(walletRef, newWallet, { merge: true });
      return newWallet;
    } catch (err) {
      console.warn('Error ensuring wallet exists:', err);
      const nowIso = new Date().toISOString();
      return {
        id: walletId,
        clientId: cleanClientId,
        supplierId: supplierId || 'platform',
        currency: currency || 'SAR',
        availableBalance: 0,
        pendingBalance: 0,
        totalDeposited: 0,
        totalSpent: 0,
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso
      };
    }
  },

  async getClientWallet(clientId: string): Promise<ClientWallet | null> {
    const cleanClientId = (clientId || '').trim();
    if (!cleanClientId) return null;
    try {
      const walletRef = doc(db, 'wallets', this.getWalletDocId(cleanClientId));
      const snap = await getDoc(walletRef);
      if (snap.exists()) {
        return snap.data() as ClientWallet;
      }
      return await this.ensureWalletExists(cleanClientId);
    } catch (err) {
      console.warn('Error fetching client wallet:', err);
      return null;
    }
  },

  async getWalletTransactions(
    clientId: string,
    options?: { type?: WalletTransactionType; limitCount?: number }
  ): Promise<WalletTransaction[]> {
    const cleanClientId = (clientId || '').trim();
    if (!cleanClientId) return [];
    const safeLimit =
      options?.limitCount && options.limitCount > 0 ? Math.floor(options.limitCount) : undefined;
    try {
      const walletId = this.getWalletDocId(cleanClientId);
      const indexedConstraints: QueryConstraint[] = [where('walletId', '==', walletId)];
      if (options?.type) {
        indexedConstraints.push(where('type', '==', options.type));
      }
      indexedConstraints.push(orderBy('createdAt', 'desc'));
      if (safeLimit) {
        indexedConstraints.push(limit(safeLimit));
      }

      return await executeIndexedQueryWithFallback(
        async () => {
          const snap = await getDocs(query(collection(db, 'walletTransactions'), ...indexedConstraints));
          const list: WalletTransaction[] = [];
          snap.forEach((d) => {
            list.push({ id: d.id, ...(d.data() as Omit<WalletTransaction, 'id'>) });
          });
          return list;
        },
        async () => {
          const snap = await getDocs(
            query(collection(db, 'walletTransactions'), where('walletId', '==', walletId))
          );
          const list: WalletTransaction[] = [];
          snap.forEach((d) => {
            const item = { id: d.id, ...(d.data() as Omit<WalletTransaction, 'id'>) };
            if (!options?.type || item.type === options.type) {
              list.push(item);
            }
          });
          const sorted = sortRecordsByDateDesc(list, (tx) => tx.createdAt);
          return safeLimit ? sorted.slice(0, safeLimit) : sorted;
        }
      );
    } catch (err) {
      console.warn('Error fetching wallet transactions:', err);
      return [];
    }
  },

  async getSupplierWallets(
    supplierId: string,
    statusFilter?: 'active' | 'frozen'
  ): Promise<ClientWallet[]> {
    const cleanSupId = (supplierId || '').trim();
    if (!cleanSupId) return [];
    try {
      const indexedConstraints: QueryConstraint[] = [where('supplierId', '==', cleanSupId)];
      if (statusFilter) {
        indexedConstraints.push(where('status', '==', statusFilter));
      } else {
        indexedConstraints.push(orderBy('updatedAt', 'desc'));
      }

      return await executeIndexedQueryWithFallback(
        async () => {
          const snap = await getDocs(query(collection(db, 'wallets'), ...indexedConstraints));
          const list: ClientWallet[] = [];
          snap.forEach((d) => {
            list.push({ id: d.id, ...(d.data() as Omit<ClientWallet, 'id'>) });
          });
          return statusFilter ? sortRecordsByDateDesc(list, (w) => w.updatedAt) : list;
        },
        async () => {
          const snap = await getDocs(query(collection(db, 'wallets'), where('supplierId', '==', cleanSupId)));
          const list: ClientWallet[] = [];
          snap.forEach((d) => {
            const wallet = { id: d.id, ...(d.data() as Omit<ClientWallet, 'id'>) };
            if (!statusFilter || wallet.status === statusFilter) {
              list.push(wallet);
            }
          });
          return sortRecordsByDateDesc(list, (w) => w.updatedAt);
        }
      );
    } catch (err) {
      console.warn('Error fetching supplier wallets:', err);
      return [];
    }
  },

  async getSupplierWalletTransactions(
    supplierId: string,
    options?: { type?: WalletTransactionType; limitCount?: number }
  ): Promise<WalletTransaction[]> {
    const cleanSupId = (supplierId || '').trim();
    if (!cleanSupId) return [];
    const safeLimit =
      options?.limitCount && options.limitCount > 0 ? Math.floor(options.limitCount) : 250;
    try {
      const indexedConstraints: QueryConstraint[] = [where('supplierId', '==', cleanSupId)];
      if (options?.type) {
        indexedConstraints.push(where('type', '==', options.type));
      }
      indexedConstraints.push(orderBy('createdAt', 'desc'), limit(safeLimit));

      return await executeIndexedQueryWithFallback(
        async () => {
          const snap = await getDocs(query(collection(db, 'walletTransactions'), ...indexedConstraints));
          const list: WalletTransaction[] = [];
          snap.forEach((d) => {
            list.push({ id: d.id, ...(d.data() as Omit<WalletTransaction, 'id'>) });
          });
          return list;
        },
        async () => {
          const snap = await getDocs(
            query(collection(db, 'walletTransactions'), where('supplierId', '==', cleanSupId))
          );
          const list: WalletTransaction[] = [];
          snap.forEach((d) => {
            const item = { id: d.id, ...(d.data() as Omit<WalletTransaction, 'id'>) };
            if (!options?.type || item.type === options.type) {
              list.push(item);
            }
          });
          return sortRecordsByDateDesc(list, (tx) => tx.createdAt).slice(0, safeLimit);
        }
      );
    } catch (err) {
      console.warn('Error fetching supplier wallet transactions:', err);
      return [];
    }
  },

  async recordTransactionAtomic(params: {
    clientId: string;
    supplierId?: string;
    type: WalletTransactionType;
    direction: 'credit' | 'debit' | 'hold' | 'release';
    amount: number;
    referenceType: WalletReferenceType;
    referenceId: string;
    description: string;
    availableDelta?: number; // positive to add, negative to subtract
    pendingDelta?: number; // positive to add, negative to subtract
    depositedDelta?: number;
    spentDelta?: number;
  }): Promise<{ success: boolean; error?: string; wallet?: ClientWallet }> {
    const cleanClientId = (params.clientId || '').trim();
    if (!cleanClientId) {
      return { success: false, error: 'معرف العميل غير صالح للمعاملة المالية.' };
    }
    const amount = Number(params.amount) || 0;
    if (amount <= 0 && params.type !== 'order_release') {
      return { success: false, error: 'قيمة المعاملة المالية يجب أن تكون أكبر من الصفر.' };
    }

    const walletId = this.getWalletDocId(cleanClientId);
    const walletRef = doc(db, 'wallets', walletId);
    const txRef = doc(collection(db, 'walletTransactions'));
    const nowIso = new Date().toISOString();
    const userId = auth.currentUser?.uid || 'system';

    try {
      let updatedWallet: ClientWallet | null = null;

      await runTransaction(db, async (transaction) => {
        let walletSnap = await transaction.get(walletRef);
        let walletData: ClientWallet;

        if (!walletSnap.exists()) {
          walletData = {
            id: walletId,
            clientId: cleanClientId,
            supplierId: params.supplierId || 'platform',
            currency: 'SAR',
            availableBalance: 0,
            pendingBalance: 0,
            totalDeposited: 0,
            totalSpent: 0,
            status: 'active',
            createdAt: nowIso,
            updatedAt: nowIso
          };
        } else {
          walletData = walletSnap.data() as ClientWallet;
        }

        if (walletData.status === 'frozen') {
          throw new Error('محفظة العميل مجمدة ولا يمكن إجراء معاملات عليها.');
        }

        const avBefore = Number(walletData.availableBalance) || 0;
        const pendBefore = Number(walletData.pendingBalance) || 0;
        const depBefore = Number(walletData.totalDeposited) || 0;
        const spentBefore = Number(walletData.totalSpent) || 0;

        let avAfter = avBefore;
        let pendAfter = pendBefore;
        let depAfter = depBefore;
        let spentAfter = spentBefore;

        if (params.availableDelta !== undefined) {
          avAfter = avBefore + params.availableDelta;
        }
        if (params.pendingDelta !== undefined) {
          pendAfter = pendBefore + params.pendingDelta;
        }
        if (params.depositedDelta !== undefined) {
          depAfter = depBefore + params.depositedDelta;
        }
        if (params.spentDelta !== undefined) {
          spentAfter = spentBefore + params.spentDelta;
        }

        if (avAfter < 0) {
          throw new Error('الرصيد المتاح غير كافٍ لإتمام هذه العملية.');
        }
        if (pendAfter < 0) {
          throw new Error('الرصيد المعلق لا يمكن أن يكون سالباً.');
        }

        updatedWallet = {
          ...walletData,
          availableBalance: Number(avAfter.toFixed(2)),
          pendingBalance: Number(pendAfter.toFixed(2)),
          totalDeposited: Number(depAfter.toFixed(2)),
          totalSpent: Number(spentAfter.toFixed(2)),
          updatedAt: nowIso
        };

        const txRecord: WalletTransaction = {
          id: txRef.id,
          walletId,
          clientId: cleanClientId,
          supplierId: params.supplierId || walletData.supplierId || 'platform',
          type: params.type,
          direction: params.direction,
          amount,
          availableBalanceBefore: avBefore,
          availableBalanceAfter: avAfter,
          pendingBalanceBefore: pendBefore,
          pendingBalanceAfter: pendAfter,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          description: params.description,
          createdBy: userId,
          createdAt: nowIso
        };

        transaction.set(walletRef, updatedWallet, { merge: true });
        transaction.set(txRef, txRecord);
      });

      return { success: true, wallet: updatedWallet || undefined };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تنفيذ المعاملة المالية في المحفظة.';
      console.warn('Wallet transaction error:', err);
      return { success: false, error: msg };
    }
  },

  async creditDeposit(params: {
    clientId: string;
    supplierId?: string;
    amount: number;
    referenceId: string;
    description: string;
  }) {
    return this.recordTransactionAtomic({
      clientId: params.clientId,
      supplierId: params.supplierId,
      type: 'deposit',
      direction: 'credit',
      amount: params.amount,
      referenceType: 'depositRequest',
      referenceId: params.referenceId,
      description: params.description || 'إيداع رصيد في المحفظة',
      availableDelta: params.amount,
      depositedDelta: params.amount
    });
  },

  async holdForOrder(params: {
    clientId: string;
    supplierId?: string;
    amount: number;
    referenceId: string;
    description: string;
  }) {
    return this.recordTransactionAtomic({
      clientId: params.clientId,
      supplierId: params.supplierId,
      type: 'order_hold',
      direction: 'hold',
      amount: params.amount,
      referenceType: 'order',
      referenceId: params.referenceId,
      description: params.description || 'حجز رصيد لقاء طلب خدمة رقمي',
      availableDelta: -params.amount,
      pendingDelta: params.amount
    });
  },

  async captureOrder(params: {
    clientId: string;
    supplierId?: string;
    amount: number;
    referenceId: string;
    description: string;
  }) {
    return this.recordTransactionAtomic({
      clientId: params.clientId,
      supplierId: params.supplierId,
      type: 'order_capture',
      direction: 'debit',
      amount: params.amount,
      referenceType: 'order',
      referenceId: params.referenceId,
      description: params.description || 'خصم الرصيد المعلق إثر اكتمال تنفيذ الطلب',
      pendingDelta: -params.amount,
      spentDelta: params.amount
    });
  },

  async releaseOrder(params: {
    clientId: string;
    supplierId?: string;
    amount: number;
    referenceId: string;
    description: string;
  }) {
    return this.recordTransactionAtomic({
      clientId: params.clientId,
      supplierId: params.supplierId,
      type: 'order_release',
      direction: 'release',
      amount: params.amount,
      referenceType: 'order',
      referenceId: params.referenceId,
      description: params.description || 'إلغاء حجز وإعادة الرصيد المتاح للعميل',
      availableDelta: params.amount,
      pendingDelta: -params.amount
    });
  },

  async manualAdjustment(params: {
    clientId: string;
    supplierId?: string;
    amount: number;
    isCredit: boolean;
    referenceId: string;
    description: string;
  }) {
    return this.recordTransactionAtomic({
      clientId: params.clientId,
      supplierId: params.supplierId,
      type: params.isCredit ? 'manual_credit' : 'manual_debit',
      direction: params.isCredit ? 'credit' : 'debit',
      amount: params.amount,
      referenceType: 'manual',
      referenceId: params.referenceId || 'admin-manual',
      description: params.description || (params.isCredit ? 'إضافة رصيد يدوي' : 'خصم رصيد يدوي'),
      availableDelta: params.isCredit ? params.amount : -params.amount,
      ...(params.isCredit ? { depositedDelta: params.amount } : { spentDelta: params.amount })
    });
  }
};
