import {
  AccountingEntry,
  AdminAccount,
  AdminAccountingEntry,
  AppNotification,
  BalanceTransfer,
  Catalog,
  DepositRequest,
  DigitalService,
  EmployeePermissionRecord,
  InviteLink,
  LoanRepaymentRequest,
  OfficeEmployee,
  Order,
  POSClient,
  PlatformInterfaceSettings,
  SuperAdmin,
  Supplier,
  SupplierBankAccount,
  VoucherWarehouse,
} from '../types';
import { mergePlatformSettings } from './platformSettings';

export type SyncCollectionKey =
  | 'suppliers'
  | 'employees'
  | 'employeePermissions'
  | 'posClients'
  | 'catalogs'
  | 'services'
  | 'voucherWarehouses'
  | 'orders'
  | 'depositRequests'
  | 'loanRepaymentRequests'
  | 'supplierBankAccounts'
  | 'accountingEntries'
  | 'adminAccountingEntries'
  | 'inviteLinks'
  | 'notifications';

export const SYNC_COLLECTION_KEYS: SyncCollectionKey[] = [
  'suppliers',
  'employees',
  'employeePermissions',
  'posClients',
  'catalogs',
  'services',
  'voucherWarehouses',
  'orders',
  'depositRequests',
  'loanRepaymentRequests',
  'supplierBankAccounts',
  'accountingEntries',
  'adminAccountingEntries',
  'inviteLinks',
  'notifications',
];

export type PendingSyncMap = Partial<Record<SyncCollectionKey | 'superAdmin' | 'platformSettings', string[]>>;
export type SyncedIdsMap = Partial<Record<SyncCollectionKey, string[]>>;

export const PENDING_SYNC_STORAGE_KEY = 'digipos_pending_sync_v1';
export const SYNCED_IDS_STORAGE_KEY = 'digipos_synced_ids_v1';

export interface ReconcileResult<T extends { id: string }> {
  merged: T[];
  toPushToRemote: T[];
  nextSyncedIds: string[];
}

export function readPendingSyncMap(storage?: Pick<Storage, 'getItem'> | null): PendingSyncMap {
  const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!store) return {};
  try {
    const raw = store.getItem(PENDING_SYNC_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as PendingSyncMap) : {};
  } catch {
    return {};
  }
}

export function writePendingSyncMap(
  map: PendingSyncMap,
  storage?: Pick<Storage, 'setItem'> | null
): void {
  const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!store) return;
  try {
    store.setItem(PENDING_SYNC_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

export function markEntityPendingSync(
  collectionKey: SyncCollectionKey | 'superAdmin' | 'platformSettings',
  docId: string,
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
): void {
  if (!docId) return;
  const current = readPendingSyncMap(storage);
  const existing = Array.isArray(current[collectionKey]) ? current[collectionKey]! : [];
  if (existing.includes(docId)) return;
  current[collectionKey] = [...existing, docId];
  writePendingSyncMap(current, storage);
}

export function clearEntityPendingSync(
  collectionKey: SyncCollectionKey | 'superAdmin' | 'platformSettings',
  docId: string,
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
): void {
  if (!docId) return;
  const current = readPendingSyncMap(storage);
  const existing = current[collectionKey];
  if (!Array.isArray(existing) || existing.length === 0) return;
  const next = existing.filter((id) => id !== docId);
  if (next.length === 0) {
    delete current[collectionKey];
  } else {
    current[collectionKey] = next;
  }
  writePendingSyncMap(current, storage);
}

export function readSyncedIdsMap(storage?: Pick<Storage, 'getItem'> | null): SyncedIdsMap {
  const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!store) return {};
  try {
    const raw = store.getItem(SYNCED_IDS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as SyncedIdsMap) : {};
  } catch {
    return {};
  }
}

export function writeSyncedIdsMap(
  map: SyncedIdsMap,
  storage?: Pick<Storage, 'setItem'> | null
): void {
  const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!store) return;
  try {
    store.setItem(SYNCED_IDS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Reconciles a local collection with its remote Firestore counterpart:
 * - Remote items are authoritative unless marked pending locally (offline mutations).
 * - Local items never synced before OR marked pending locally are queued to push to Firestore.
 * - Items previously synced from Firestore that no longer exist remotely (and aren't pending)
 *   are treated as remotely deleted and are not resurrected.
 */
export function reconcileCollectionWithRemote<T extends { id: string }>(
  localItems: T[],
  remoteItems: T[],
  previouslySyncedIds: Iterable<string> = [],
  pendingIds: Iterable<string> = []
): ReconcileResult<T> {
  const syncedSet = new Set(previouslySyncedIds);
  const pendingSet = new Set(pendingIds);

  const localMap = new Map<string, T>();
  for (const item of localItems) {
    if (item && typeof item.id === 'string' && item.id.trim()) {
      localMap.set(item.id, item);
    }
  }

  const remoteMap = new Map<string, T>();
  for (const item of remoteItems) {
    if (item && typeof item.id === 'string' && item.id.trim()) {
      remoteMap.set(item.id, item);
    }
  }

  const mergedMap = new Map<string, T>();
  const toPushToRemote: T[] = [];

  // 1. Process remote items
  for (const [id, remoteItem] of remoteMap.entries()) {
    const localItem = localMap.get(id);
    if (localItem && pendingSet.has(id)) {
      mergedMap.set(id, localItem);
      toPushToRemote.push(localItem);
    } else {
      mergedMap.set(id, remoteItem);
    }
  }

  // 2. Process local-only items
  for (const [id, localItem] of localMap.entries()) {
    if (remoteMap.has(id)) continue;
    if (pendingSet.has(id) || !syncedSet.has(id)) {
      mergedMap.set(id, localItem);
      toPushToRemote.push(localItem);
    }
  }

  const merged = Array.from(mergedMap.values());
  const nextSyncedIds = merged.map((item) => item.id);

  return {
    merged,
    toPushToRemote,
    nextSyncedIds,
  };
}

/**
 * Reconciles SuperAdmin config (including adminAccounts) between local and remote Firestore.
 */
export function reconcileSuperAdminWithRemote(
  localAdmin: SuperAdmin,
  remoteAdmin?: Partial<SuperAdmin> | null,
  isPendingLocal: boolean = false
): {
  merged: SuperAdmin;
  shouldPushToRemote: boolean;
} {
  if (!remoteAdmin) {
    return {
      merged: localAdmin,
      shouldPushToRemote: true,
    };
  }

  const localAccounts = Array.isArray(localAdmin.adminAccounts) ? localAdmin.adminAccounts : [];
  const remoteAccounts = Array.isArray(remoteAdmin.adminAccounts) ? remoteAdmin.adminAccounts : [];
  const accountMap = new Map<string, AdminAccount>();

  const firstPass = isPendingLocal ? remoteAccounts : localAccounts;
  const secondPass = isPendingLocal ? localAccounts : remoteAccounts;

  for (const acc of firstPass) {
    if (!acc) continue;
    const key = acc.id || acc.email?.trim().toLowerCase();
    if (key) accountMap.set(key, acc);
  }
  for (const acc of secondPass) {
    if (!acc) continue;
    const key = acc.id || acc.email?.trim().toLowerCase();
    if (key) accountMap.set(key, acc);
  }

  const mergedAccounts = Array.from(accountMap.values());
  const base = isPendingLocal
    ? { ...remoteAdmin, ...localAdmin }
    : { ...localAdmin, ...remoteAdmin };

  const merged: SuperAdmin = {
    ...localAdmin,
    ...base,
    email: remoteAdmin.email || localAdmin.email,
    adminAccounts: mergedAccounts,
  };

  const shouldPushToRemote =
    isPendingLocal || mergedAccounts.length > remoteAccounts.length;

  return {
    merged,
    shouldPushToRemote,
  };
}

/**
 * Reconciles PlatformInterfaceSettings between local and remote Firestore.
 */
export function reconcilePlatformSettingsWithRemote(
  localSettings: PlatformInterfaceSettings,
  remoteSettings?: Partial<PlatformInterfaceSettings> | null,
  isPendingLocal: boolean = false
): {
  merged: PlatformInterfaceSettings;
  shouldPushToRemote: boolean;
} {
  if (!remoteSettings) {
    return {
      merged: mergePlatformSettings(localSettings),
      shouldPushToRemote: true,
    };
  }

  if (isPendingLocal) {
    return {
      merged: mergePlatformSettings(localSettings),
      shouldPushToRemote: true,
    };
  }

  return {
    merged: mergePlatformSettings(remoteSettings),
    shouldPushToRemote: false,
  };
}

export interface FullDatabaseSnapshot {
  superAdmin?: Partial<SuperAdmin> | null;
  platformSettings?: Partial<PlatformInterfaceSettings> | null;
  suppliers: Supplier[];
  employees?: OfficeEmployee[];
  employeePermissions?: EmployeePermissionRecord[];
  posClients: POSClient[];
  catalogs: Catalog[];
  services: DigitalService[];
  voucherWarehouses: VoucherWarehouse[];
  orders: Order[];
  depositRequests: DepositRequest[];
  loanRepaymentRequests: LoanRepaymentRequest[];
  supplierBankAccounts: SupplierBankAccount[];
  accountingEntries: AccountingEntry[];
  adminAccountingEntries: AdminAccountingEntry[];
  inviteLinks: InviteLink[];
  balanceTransfers?: BalanceTransfer[];
  notifications?: AppNotification[];
}
