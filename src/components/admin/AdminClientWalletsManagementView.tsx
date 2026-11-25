import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { walletService } from '../../services/walletService';
import { ClientWallet, WalletTransaction } from '../../types/wallet';
import { POSClient } from '../../types';
import { SupplierClientWalletModal } from '../supplier/SupplierClientWalletModal';
import {
  Wallet,
  ShieldCheck,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  Lock,
  PlusCircle,
  MinusCircle,
  RefreshCw,
  X,
  Building2,
  User,
  Phone,
  Database
} from 'lucide-react';

export const AdminClientWalletsManagementView: React.FC = () => {
  const { posClients, showToast } = useApp();
  const [walletsMap, setWalletsMap] = useState<Record<string, ClientWallet>>({});
  const [allTransactions, setAllTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientForModal, setSelectedClientForModal] = useState<POSClient | null>(null);

  const loadAllWalletsAndTxs = async () => {
    setIsLoading(true);
    try {
      const map: Record<string, ClientWallet> = {};
      const txList: WalletTransaction[] = [];

      for (const client of posClients) {
        if (!client?.id) continue;
        const w = await walletService.getClientWallet(client.id);
        if (w) {
          map[client.id] = w;
        }
        const txs = await walletService.getWalletTransactions(client.id);
        txList.push(...txs);
      }

      setWalletsMap(map);
      setAllTransactions(txList.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    } catch (err) {
      console.warn('Error loading admin client wallets and transactions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (posClients.length > 0) {
      void loadAllWalletsAndTxs();
    } else {
      setIsLoading(false);
    }
  }, [posClients]);

  const filteredClients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return posClients.filter(c => {
      if (!q) return true;
      return (
        c.tradeName?.toLowerCase().includes(q) ||
        c.ownerName?.toLowerCase().includes(q) ||
        c.posCode?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
      );
    });
  }, [posClients, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-lg font-bold text-white">إدارة محافظ العملاء والحركات المالية</h2>
            <span className="text-xs font-mono text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 rounded-lg">
              {posClients.length} عميل نشط في المنصة
            </span>
          </div>
          <p className="text-xs text-slate-400">
            جدول شامل يوضح الرصيد المتاح والرصيد المعلق لكل عميل، مع جدول تفصيلي لحركة المحافظ ودفتر الحسابات اللحظي.
          </p>
        </div>

        <button
          onClick={() => void loadAllWalletsAndTxs()}
          disabled={isLoading}
          className="px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 text-xs font-bold flex items-center gap-2 transition-colors shadow-md shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>تحديث أرصدة وحركات المحافظ</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
        <Search className="w-4 h-4 text-slate-500 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="بحث بالاسم التجاري، اسم المالك، المعرف (POS Code)، أو الهاتف..."
          className="w-full bg-transparent text-xs text-white focus:outline-none"
        />
      </div>

      {/* 1. Table of Client Wallets (الرصيد المتاح والرصيد المعلق) */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Wallet className="w-4 h-4 text-purple-400" />
            <span>جدول محافظ العملاء (الرصيد المتاح والرصيد المعلق)</span>
          </h3>
        </div>

        {filteredClients.length === 0 ? (
          <div className="text-center py-12 bg-slate-950/60 rounded-2xl border border-slate-800 text-slate-400 text-xs">
            لا توجد حسابات عملاء مطابقة للبحث.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">العميل / المعرف</th>
                  <th className="py-3 px-4 font-semibold">الرصيد المتاح</th>
                  <th className="py-3 px-4 font-semibold">الرصيد المعلق</th>
                  <th className="py-3 px-4 font-semibold">إجمالي الإيداعات</th>
                  <th className="py-3 px-4 font-semibold">إجمالي المشتريات</th>
                  <th className="py-3 px-4 font-semibold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {filteredClients.map(client => {
                  const w = walletsMap[client.id];
                  const available = w ? w.availableBalance : (client.walletBalance || 0);
                  const pending = w ? w.pendingBalance : 0;
                  const totalDep = w ? w.totalDeposited : 0;
                  const totalSp = w ? w.totalSpent : (client.totalSpent || 0);

                  return (
                    <tr key={client.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{client.tradeName}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>المالك: {client.ownerName}</span>
                          <span className="font-mono text-purple-300">({client.posCode})</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-emerald-400 text-sm" dir="ltr">
                        {available.toFixed(2)} <span className="text-[10px]">{client.preferredCurrency || 'SAR'}</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-amber-300 text-sm" dir="ltr">
                        {pending.toFixed(2)} <span className="text-[10px]">{client.preferredCurrency || 'SAR'}</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-300" dir="ltr">
                        {totalDep.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-purple-300" dir="ltr">
                        {totalSp.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => setSelectedClientForModal(client)}
                          className="px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 font-semibold border border-purple-500/30 transition-colors"
                        >
                          إدارة المحفظة
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2. Table of All Wallet Transactions (جدول حركة المحافظ) */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400" />
            <span>جدول حركة المحافظ (دفتر الحسابات والعمليات الماليّة)</span>
          </h3>
          <span className="text-xs font-mono text-slate-400">
            {allTransactions.length} حركة إجمالية
          </span>
        </div>

        {allTransactions.length === 0 ? (
          <div className="text-center py-12 bg-slate-950/60 rounded-2xl border border-slate-800 text-slate-400 text-xs">
            لا توجد أي حركات مالية مسجلة في دفاتر المحافظ حتى الآن.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">معرف العميل</th>
                  <th className="py-3 px-4 font-semibold">نوع الحركة</th>
                  <th className="py-3 px-4 font-semibold">الوصف والمرجع</th>
                  <th className="py-3 px-4 font-semibold">المبلغ</th>
                  <th className="py-3 px-4 font-semibold">المتاح (قبل / بعد)</th>
                  <th className="py-3 px-4 font-semibold">المعلق (قبل / بعد)</th>
                  <th className="py-3 px-4 font-semibold">التاريخ والوقت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {allTransactions.map(tx => {
                  const clientObj = posClients.find(c => c.id === tx.clientId);
                  const isPositive = tx.direction === 'credit' || tx.direction === 'release';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-purple-300 whitespace-nowrap">
                        {clientObj ? clientObj.tradeName : tx.clientId.substring(0, 10) + '...'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border ${
                          tx.type === 'deposit' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                          tx.type.includes('hold') ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' :
                          'bg-purple-500/15 text-purple-300 border-purple-500/30'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-medium text-white">{tx.description}</div>
                        <div className="text-[10px] text-slate-500 font-mono">مرجع: {tx.referenceId}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono font-bold" dir="ltr">
                        <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                          {isPositive ? '+' : '-'}{tx.amount.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-300" dir="ltr">
                        {tx.availableBalanceBefore.toFixed(2)} → <span className="text-white font-bold">{tx.availableBalanceAfter.toFixed(2)}</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-300" dir="ltr">
                        {tx.pendingBalanceBefore.toFixed(2)} → <span className="text-amber-300 font-bold">{tx.pendingBalanceAfter.toFixed(2)}</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-400">
                        {tx.createdAt ? new Date(tx.createdAt).toLocaleString('ar-SA') : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for Client Wallet Management */}
      {selectedClientForModal && (
        <SupplierClientWalletModal
          client={selectedClientForModal}
          onClose={() => {
            setSelectedClientForModal(null);
            void loadAllWalletsAndTxs();
          }}
        />
      )}
    </div>
  );
};
