import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Cloud,
  Copy,
  Database,
  HardDrive,
  KeyRound,
  Mail,
  RefreshCw,
  Search,
  Users,
  X,
  AlertCircle,
  Ban,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AuthUser, POSClient, TIERS_CONFIG } from '../../types';
import { isPosClientActive } from '../../utils/accountAuth';
import { firestoreSync } from '../../services/firestoreSync';
import {
  buildSupplierClientsComparison,
  ClientDirectorySyncStatus,
  readLocalClientsForSupplier,
} from '../../utils/supplierClientsDirectory';

interface SupplierClientsDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: string;
  supplierStoreName: string;
}

type DirectoryTab = 'comparison' | 'local' | 'firebase';

export const SupplierClientsDirectoryModal: React.FC<SupplierClientsDirectoryModalProps> = ({
  isOpen,
  onClose,
  supplierId,
  supplierStoreName,
}) => {
  const {
    posClients,
    formatCurrency,
    showToast,
    ensureDatabaseConnectedAndSynced,
    isSyncingWithFirestore,
  } = useApp();

  const [activeTab, setActiveTab] = useState<DirectoryTab>('comparison');
  const [searchQuery, setSearchQuery] = useState('');
  const [localClients, setLocalClients] = useState<POSClient[]>([]);
  const [firebaseClients, setFirebaseClients] = useState<POSClient[]>([]);
  const [firebaseUsers, setFirebaseUsers] = useState<AuthUser[]>([]);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadClientsFromBothSources = async () => {
    // 1. Always load the supplier's local browser database immediately
    const localSnapshot = readLocalClientsForSupplier(supplierId, posClients);
    setLocalClients(localSnapshot);

    // 2. Fetch live Firebase Firestore clients + user login emails from server
    setIsLoadingRemote(true);
    setRemoteError(null);
    try {
      const remote = await firestoreSync.fetchSupplierClientsDirectoryFromServer(supplierId);
      setFirebaseClients(remote.clients);
      setFirebaseUsers(remote.users);
      setLastFetchedAt(new Date().toLocaleTimeString('ar-EG', { hour12: true }));
    } catch (err: unknown) {
      console.warn('Failed to fetch supplier clients from Firebase:', err);
      const msg =
        err instanceof Error && err.message.toLowerCase().includes('offline')
          ? 'الجهاز غير متصل بقاعدة بيانات Firebase حالياً؛ يتم عرض القاعدة المحلية فقط.'
          : 'تعذر جلب عملاء فايربيس من الخادم حالياً. تأكد من الاتصال بالإنترنت ثم أعد المحاولة.';
      setRemoteError(msg);
    } finally {
      setIsLoadingRemote(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void loadClientsFromBothSources();
  }, [isOpen, supplierId]);

  useEffect(() => {
    if (!isOpen) return;
    setLocalClients(readLocalClientsForSupplier(supplierId, posClients));
  }, [isOpen, supplierId, posClients]);

  const comparison = useMemo(
    () =>
      buildSupplierClientsComparison({
        supplierId,
        localClients,
        firebaseClients,
        firebaseUsers,
      }),
    [supplierId, localClients, firebaseClients, firebaseUsers]
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const matchesSearch = (item: {
    tradeName: string;
    ownerName: string;
    loginEmail: string;
    posCode: string;
    id: string;
    phone: string;
  }) => {
    if (!normalizedQuery) return true;
    return (
      item.tradeName.toLowerCase().includes(normalizedQuery) ||
      item.ownerName.toLowerCase().includes(normalizedQuery) ||
      item.loginEmail.toLowerCase().includes(normalizedQuery) ||
      item.posCode.toLowerCase().includes(normalizedQuery) ||
      item.id.toLowerCase().includes(normalizedQuery) ||
      item.phone.toLowerCase().includes(normalizedQuery)
    );
  };

  const filteredComparisonRows = useMemo(
    () => comparison.comparisonRows.filter(matchesSearch),
    [comparison.comparisonRows, normalizedQuery]
  );
  const filteredLocalEntries = useMemo(
    () => comparison.localEntries.filter(matchesSearch),
    [comparison.localEntries, normalizedQuery]
  );
  const filteredFirebaseEntries = useMemo(
    () => comparison.firebaseEntries.filter(matchesSearch),
    [comparison.firebaseEntries, normalizedQuery]
  );

  const handleCopy = (value: string, key: string, label: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    showToast({
      type: 'success',
      title: 'تم النسخ',
      description: `تم نسخ ${label} (${value}) للحافظة.`,
    });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSyncAndRefresh = async () => {
    const res = await ensureDatabaseConnectedAndSynced({ forceSync: true, silent: true });
    await loadClientsFromBothSources();
    if (res.connected && res.synced) {
      showToast({
        type: 'success',
        title: 'تمت مزامنة العملاء مع فايربيس',
        description: res.message,
      });
    } else {
      showToast({
        type: 'error',
        title: 'تعذرت المزامنة الكاملة',
        description: res.message,
      });
    }
  };

  const renderSyncBadge = (status: ClientDirectorySyncStatus) => {
    switch (status) {
      case 'synced':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
            <CheckCircle2 className="w-3 h-3" />
            <span>متطابق (محلي + فايربيس)</span>
          </span>
        );
      case 'local_only':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
            <HardDrive className="w-3 h-3" />
            <span>في القاعدة المحلية فقط</span>
          </span>
        );
      case 'firebase_only':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
            <Cloud className="w-3 h-3" />
            <span>في فايربيس فقط</span>
          </span>
        );
      case 'different':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
            <RefreshCw className="w-3 h-3" />
            <span>يوجد اختلاف (يحتاج مزامنة)</span>
          </span>
        );
    }
  };

  if (!isOpen) return null;

  const displayedList =
    activeTab === 'comparison'
      ? filteredComparisonRows
      : activeTab === 'local'
      ? filteredLocalEntries
      : filteredFirebaseEntries;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4"
      dir="rtl"
    >
      <div className="w-full max-w-4xl max-h-[92vh] rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 flex-wrap">
                <span>دليل عملاء المتجر (المحلي وفايربيس)</span>
                <span className="text-[11px] font-normal text-amber-400">· {supplierStoreName}</span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                عرض العملاء من قاعدة البيانات المحلية وقاعدة بيانات Firebase مع إيميل تسجيل الدخول والمعرّف.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleSyncAndRefresh}
              disabled={isLoadingRemote || isSyncingWithFirestore}
              className="px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncingWithFirestore ? 'animate-spin' : ''}`}
              />
              <span>مزامنة القواعد</span>
            </button>

            <button
              type="button"
              onClick={() => void loadClientsFromBothSources()}
              disabled={isLoadingRemote}
              className="px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRemote ? 'animate-spin' : ''}`} />
              <span>تحديث من فايربيس</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="إغلاق النافذة"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Summary KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-semibold">
                <HardDrive className="w-3.5 h-3.5" />
                <span>القاعدة المحلية</span>
              </div>
              <div className="text-lg font-bold font-mono text-white mt-0.5 tabular-nums">
                {comparison.summary.localCount} عميل
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-1.5 text-[11px] text-cyan-400 font-semibold">
                <Cloud className="w-3.5 h-3.5" />
                <span>قاعدة فايربيس</span>
              </div>
              <div className="text-lg font-bold font-mono text-white mt-0.5 tabular-nums">
                {isLoadingRemote ? '...' : `${comparison.summary.firebaseCount} عميل`}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>متطابقون</span>
              </div>
              <div className="text-lg font-bold font-mono text-emerald-300 mt-0.5 tabular-nums">
                {comparison.summary.syncedCount}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-1.5 text-[11px] text-purple-400 font-semibold">
                <Users className="w-3.5 h-3.5" />
                <span>فروقات / غير متزامن</span>
              </div>
              <div className="text-lg font-bold font-mono text-purple-300 mt-0.5 tabular-nums">
                {comparison.summary.localOnlyCount +
                  comparison.summary.firebaseOnlyCount +
                  comparison.summary.differentCount}
              </div>
            </div>
          </div>

          {/* Remote fetch error warning if any */}
          {remoteError && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 flex items-start gap-2 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">{remoteError}</div>
            </div>
          )}

          {/* Filter Tabs + Search Input */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('comparison')}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'comparison'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-950 text-slate-300 border border-slate-800 hover:text-white'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>الكل ومقارنة القاعدتين ({comparison.comparisonRows.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('local')}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'local'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-950 text-slate-300 border border-slate-800 hover:text-white'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>القاعدة المحلية ({comparison.summary.localCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('firebase')}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'firebase'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'bg-slate-950 text-slate-300 border border-slate-800 hover:text-white'
                }`}
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>قاعدة فايربيس ({comparison.summary.firebaseCount})</span>
              </button>
            </div>

            <div className="relative flex-1 md:max-w-xs">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالاسم، إيميل الدخول، أو المعرّف..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 pr-9 text-xs text-white focus:outline-none"
              />
              <Search className="w-4 h-4 text-slate-500 absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          {lastFetchedAt && (
            <div className="text-[11px] text-slate-400">
              آخر تحديث من خادم Firebase: <span className="font-mono text-cyan-300">{lastFetchedAt}</span>
            </div>
          )}

          {/* Client Cards List */}
          {isLoadingRemote && displayedList.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-950 border border-slate-800 text-center text-slate-400 flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
              <span>جاري جلب عملاء المتجر من قاعدة بيانات Firebase...</span>
            </div>
          ) : displayedList.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-950 border border-slate-800 text-center text-slate-400">
              لا يوجد عملاء مطابقون في هذا العرض حالياً.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {displayedList.map((entry, idx) => {
                const tierInfo = TIERS_CONFIG[entry.tier] || TIERS_CONFIG.regular;
                const isComparison = 'inLocal' in entry;
                const inLocal = isComparison ? entry.inLocal : entry.source === 'local';
                const inFirebase = isComparison ? entry.inFirebase : entry.source === 'firebase';
                const primaryRec = entry.firebaseRecord || entry.localRecord;
                const isSuspended = Boolean(primaryRec && !isPosClientActive(primaryRec));
                const emailKey = `${activeTab}-${entry.id}-email-${idx}`;
                const posCodeKey = `${activeTab}-${entry.id}-posCode-${idx}`;
                const idKey = `${activeTab}-${entry.id}-id-${idx}`;

                return (
                  <div
                    key={`${activeTab}-${entry.id}-${idx}`}
                    className={`p-4 rounded-2xl bg-slate-950 border space-y-3 transition-colors ${
                      isSuspended ? 'border-rose-500/40' : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Top row: name + sync badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-sm text-white truncate">
                            {entry.tradeName || 'نقطة بيع بدون اسم تجاري'}
                          </h3>
                          {isSuspended && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[10px] font-bold shrink-0">
                              <Ban className="w-2.5 h-2.5" />
                              <span>موقوف</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                          العميل: <strong className="text-slate-200">{entry.ownerName || '—'}</strong>
                          {entry.phone ? ` · ${entry.phone}` : ''}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0 ${tierInfo.badgeColor} ${tierInfo.textColor}`}
                      >
                        {tierInfo.nameAr}
                      </span>
                    </div>

                    {/* Source presence & sync badge */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {renderSyncBadge(entry.syncStatus)}
                      {inLocal && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900 border border-amber-500/30 text-amber-300 text-[10px]">
                          <HardDrive className="w-3 h-3" />
                          <span>محلي</span>
                        </span>
                      )}
                      {inFirebase && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900 border border-cyan-500/30 text-cyan-300 text-[10px]">
                          <Cloud className="w-3 h-3" />
                          <span>فايربيس</span>
                        </span>
                      )}
                    </div>

                    {/* Login Email & IDs Box */}
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/90 space-y-2">
                      {/* Login Email */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="text-[11px] text-slate-400 shrink-0">إيميل الدخول:</span>
                          <span
                            className="font-mono text-xs text-white font-semibold truncate select-all"
                            dir="ltr"
                          >
                            {entry.loginEmail || 'غير مسجل بإيميل'}
                          </span>
                        </div>
                        {entry.loginEmail && (
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(entry.loginEmail, emailKey, 'إيميل تسجيل الدخول')
                            }
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 transition-colors shrink-0 cursor-pointer"
                            title="نسخ إيميل تسجيل الدخول"
                          >
                            {copiedKey === emailKey ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Official POS Code */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-[11px] text-slate-400 shrink-0">المعرّف:</span>
                          <span
                            className="font-mono text-xs text-amber-300 font-bold truncate select-all"
                            dir="ltr"
                          >
                            {entry.posCode || '—'}
                          </span>
                        </div>
                        {entry.posCode && (
                          <button
                            type="button"
                            onClick={() => handleCopy(entry.posCode, posCodeKey, 'المعرّف')}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 transition-colors shrink-0 cursor-pointer"
                            title="نسخ المعرّف الرسمي"
                          >
                            {copiedKey === posCodeKey ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Record Document ID */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Database className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-[11px] text-slate-400 shrink-0">معرّف السجل (ID):</span>
                          <span
                            className="font-mono text-[11px] text-slate-300 truncate select-all"
                            dir="ltr"
                          >
                            {entry.id}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(entry.id, idKey, 'معرف السجل (ID)')}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 transition-colors shrink-0 cursor-pointer"
                          title="نسخ معرف السجل (ID)"
                        >
                          {copiedKey === idKey ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Footer Wallet */}
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/70">
                      <span className="text-slate-400">رصيد المحفظة:</span>
                      <span className="font-mono font-bold text-emerald-300 tabular-nums">
                        {formatCurrency(entry.walletBalance)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
