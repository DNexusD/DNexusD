import { AccountTier, AuthUser, POSClient } from '../types';
import { normalizeStoreEmail } from './employeePermissions';

export type ClientDirectorySyncStatus = 'synced' | 'local_only' | 'firebase_only' | 'different';

export interface SupplierClientDirectoryEntry {
  id: string;
  posCode: string;
  tradeName: string;
  ownerName: string;
  loginEmail: string;
  phone: string;
  tier: AccountTier;
  walletBalance: number;
  source: 'local' | 'firebase';
  syncStatus: ClientDirectorySyncStatus;
  localRecord?: POSClient;
  firebaseRecord?: POSClient;
}

export interface SupplierClientComparisonRow {
  id: string;
  posCode: string;
  tradeName: string;
  ownerName: string;
  loginEmail: string;
  phone: string;
  tier: AccountTier;
  walletBalance: number;
  inLocal: boolean;
  inFirebase: boolean;
  syncStatus: ClientDirectorySyncStatus;
  localRecord?: POSClient;
  firebaseRecord?: POSClient;
}

export interface SupplierClientsDirectoryComparison {
  localEntries: SupplierClientDirectoryEntry[];
  firebaseEntries: SupplierClientDirectoryEntry[];
  comparisonRows: SupplierClientComparisonRow[];
  summary: {
    localCount: number;
    firebaseCount: number;
    syncedCount: number;
    localOnlyCount: number;
    firebaseOnlyCount: number;
    differentCount: number;
  };
}

export function readLocalClientsForSupplier(
  supplierId: string,
  fallbackClients: POSClient[] = [],
  storage?: Pick<Storage, 'getItem'> | null
): POSClient[] {
  const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  let rawList: POSClient[] = fallbackClients;

  if (store) {
    try {
      const saved = store.getItem('digipos_clients_v2');
      if (saved) {
        const parsed = JSON.parse(saved) as unknown;
        if (Array.isArray(parsed)) {
          rawList = parsed as POSClient[];
        }
      }
    } catch {
      rawList = fallbackClients;
    }
  }

  const map = new Map<string, POSClient>();
  for (const client of rawList) {
    if (!client || typeof client.id !== 'string' || !client.id) continue;
    if (client.supplierId !== supplierId) continue;
    map.set(client.id, client);
  }
  return Array.from(map.values());
}

function buildLoginEmailLookup(users: AuthUser[]): Map<string, string> {
  const emailByClientId = new Map<string, string>();
  for (const user of users) {
    if (!user || !user.email) continue;
    if (user.role && user.role !== 'pos_client') continue;
    const cleanEmail = normalizeStoreEmail(user.email);
    if (!cleanEmail) continue;
    if (user.associatedId && !emailByClientId.has(user.associatedId)) {
      emailByClientId.set(user.associatedId, cleanEmail);
    }
    if (user.id && !emailByClientId.has(user.id)) {
      emailByClientId.set(user.id, cleanEmail);
    }
  }
  return emailByClientId;
}

function resolveClientLoginEmail(
  client: POSClient | undefined,
  emailByClientId: Map<string, string>
): string {
  if (!client) return '';
  const directEmail = normalizeStoreEmail(client.email);
  if (directEmail) return directEmail;
  return emailByClientId.get(client.id) || '';
}

function hasMaterialDifference(
  localClient: POSClient,
  firebaseClient: POSClient,
  emailByClientId: Map<string, string>
): boolean {
  const localEmail = resolveClientLoginEmail(localClient, emailByClientId);
  const remoteEmail = resolveClientLoginEmail(firebaseClient, emailByClientId);
  return (
    localEmail !== remoteEmail ||
    localClient.posCode !== firebaseClient.posCode ||
    localClient.tradeName !== firebaseClient.tradeName ||
    localClient.ownerName !== firebaseClient.ownerName ||
    localClient.tier !== firebaseClient.tier ||
    Number(localClient.walletBalance || 0) !== Number(firebaseClient.walletBalance || 0)
  );
}

export function buildSupplierClientsComparison(params: {
  supplierId: string;
  localClients: POSClient[];
  firebaseClients: POSClient[];
  firebaseUsers?: AuthUser[];
}): SupplierClientsDirectoryComparison {
  const { supplierId, localClients, firebaseClients, firebaseUsers = [] } = params;
  const emailByClientId = buildLoginEmailLookup(firebaseUsers);

  const localMap = new Map<string, POSClient>();
  for (const c of localClients) {
    if (c && c.id && c.supplierId === supplierId) {
      localMap.set(c.id, c);
    }
  }

  const firebaseMap = new Map<string, POSClient>();
  for (const c of firebaseClients) {
    if (c && c.id && c.supplierId === supplierId) {
      firebaseMap.set(c.id, c);
    }
  }

  const allIds = Array.from(new Set([...localMap.keys(), ...firebaseMap.keys()]));
  const localEntries: SupplierClientDirectoryEntry[] = [];
  const firebaseEntries: SupplierClientDirectoryEntry[] = [];
  const comparisonRows: SupplierClientComparisonRow[] = [];

  let syncedCount = 0;
  let localOnlyCount = 0;
  let firebaseOnlyCount = 0;
  let differentCount = 0;

  for (const id of allIds) {
    const localRec = localMap.get(id);
    const firebaseRec = firebaseMap.get(id);

    let syncStatus: ClientDirectorySyncStatus;
    if (localRec && firebaseRec) {
      if (hasMaterialDifference(localRec, firebaseRec, emailByClientId)) {
        syncStatus = 'different';
        differentCount++;
      } else {
        syncStatus = 'synced';
        syncedCount++;
      }
    } else if (localRec) {
      syncStatus = 'local_only';
      localOnlyCount++;
    } else {
      syncStatus = 'firebase_only';
      firebaseOnlyCount++;
    }

    if (localRec) {
      localEntries.push({
        id: localRec.id,
        posCode: localRec.posCode || '',
        tradeName: localRec.tradeName || '',
        ownerName: localRec.ownerName || '',
        loginEmail: resolveClientLoginEmail(localRec, emailByClientId),
        phone: localRec.phone || '',
        tier: localRec.tier,
        walletBalance: Number(localRec.walletBalance || 0),
        source: 'local',
        syncStatus,
        localRecord: localRec,
        firebaseRecord: firebaseRec,
      });
    }

    if (firebaseRec) {
      firebaseEntries.push({
        id: firebaseRec.id,
        posCode: firebaseRec.posCode || '',
        tradeName: firebaseRec.tradeName || '',
        ownerName: firebaseRec.ownerName || '',
        loginEmail: resolveClientLoginEmail(firebaseRec, emailByClientId),
        phone: firebaseRec.phone || '',
        tier: firebaseRec.tier,
        walletBalance: Number(firebaseRec.walletBalance || 0),
        source: 'firebase',
        syncStatus,
        localRecord: localRec,
        firebaseRecord: firebaseRec,
      });
    }

    const primary = firebaseRec || localRec!;
    comparisonRows.push({
      id: primary.id,
      posCode: primary.posCode || localRec?.posCode || '',
      tradeName: primary.tradeName || localRec?.tradeName || '',
      ownerName: primary.ownerName || localRec?.ownerName || '',
      loginEmail:
        resolveClientLoginEmail(firebaseRec, emailByClientId) ||
        resolveClientLoginEmail(localRec, emailByClientId),
      phone: primary.phone || localRec?.phone || '',
      tier: primary.tier,
      walletBalance: Number(primary.walletBalance || 0),
      inLocal: Boolean(localRec),
      inFirebase: Boolean(firebaseRec),
      syncStatus,
      localRecord: localRec,
      firebaseRecord: firebaseRec,
    });
  }

  return {
    localEntries,
    firebaseEntries,
    comparisonRows,
    summary: {
      localCount: localEntries.length,
      firebaseCount: firebaseEntries.length,
      syncedCount,
      localOnlyCount,
      firebaseOnlyCount,
      differentCount,
    },
  };
}
