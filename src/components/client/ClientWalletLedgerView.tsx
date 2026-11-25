import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { walletService } from '../../services/walletService';
import { ClientWallet, WalletTransaction } from '../../types/wallet';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Lock,
  Clock,
  RefreshCw,
  FileText,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  ShieldCheck,
  Calendar
} from 'lucide-react';

export const ClientWalletLedgerView: React.FC = () => {
  const { currentUser, posClients } = useApp();
  const [wallet, setWallet] = useState<ClientWallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const clientId = currentUser?.associatedId || currentUser?.id || '';

  const loadWalletData = async () => {
    if (!clientId) return;
    setIsLoading(true);
    try {
      const w = await walletService.getClientWallet(clientId);
      const txs = await walletService.getWalletTransactions(clientId);
      setWallet(w);
      setTransactions(txs);
    } catch (err) {
      console.warn('Error loading wallet ledger:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadWalletData();
  }, [clientId]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter(tx => {
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (!q) return true;
      return (
        tx.description.toLowerCase().includes(q) ||
        tx.referenceId.toLowerCase().includes(q) ||
        tx.id.toLowerCase().includes(q)
      );
    });
  }, [transactions, searchQuery, typeFilter]);

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case 'deposit':
        return { label: 'إيداع رصيد', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: ArrowDownLeft };
      case 'order_hold':
        return { label: 'حجز طلب', bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30', icon: Clock };
      case 'order_capture':
        return { label: 'تنفيذ طلب', bg: 'bg-purple-500/15 text-purple-300 border-purple-500/30', icon: CheckCircle };
      case 'order_release':
      case 'refund':
        return { label: 'استرجاع رصيد', bg: 'bg-blue-500/15 text-blue-300 border-blue-500/30', icon: RefreshCw };
      case 'manual_credit':
        return { label: 'إضافة يدوية', bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: ArrowDownLeft };
      case 'manual_debit':
        return { label: 'خصم يدوي', bg: 'bg-rose-500/15 text-rose-300 border-rose-500/30', icon: ArrowUpRight };
      default:
        return { label: type, bg: 'bg-slate-800 text-slate-300 border-slate-700', icon: FileText };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner & Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Available Balance */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 relative overflow-hidden flex flex-col justify-between shadow-sm">
          <div className="absolute -left-6 -bottom-6 w-28 h-28 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">الرصيد المتاح (للاستهلاك)</span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-white font-mono tracking-tight" dir="ltr">
              {wallet ? wallet.availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'} <span className="text-xs text-emerald-400 font-semibold">{wallet?.currency || 'SAR'}</span>
            </div>
          </div>
        </div>

        {/* Pending Balance */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 relative overflow-hidden flex flex-col justify-between shadow-sm">
          <div className="absolute -left-6 -bottom-6 w-28 h-28 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">الرصيد المعلق (طلبات قيد التنفيذ)</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300">
              <Lock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-white font-mono tracking-tight" dir="ltr">
              {wallet ? wallet.pendingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'} <span className="text-xs text-amber-300 font-semibold">{wallet?.currency || 'SAR'}</span>
            </div>
          </div>
        </div>

        {/* Total Spent / Deposited */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 relative overflow-hidden flex flex-col justify-between shadow-sm">
          <div className="absolute -left-6 -bottom-6 w-28 h-28 bg-purple-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">إجمالي المشتريات / الإيداعات</span>
            <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-mono" dir="ltr">
            <div>
              <span className="text-slate-500 block text-[10px]">المشتريات</span>
              <span className="font-bold text-white">{wallet ? wallet.totalSpent.toFixed(2) : '0.00'}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-[10px]">الإيداعات</span>
              <span className="font-bold text-emerald-400">{wallet ? wallet.totalDeposited.toFixed(2) : '0.00'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ledger Section Header & Filters */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h3 className="font-bold text-sm text-white">سجل حركات المحفظة وكشف الحساب المالي</h3>
              <span className="text-xs font-mono text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 rounded-lg">
                {filteredTransactions.length} حركة مسجلة
              </span>
            </div>
            <p className="text-xs text-slate-400">
              سجل تدقيقي ذو مرجعية ذرية (Atomic Ledger) يوضح كل حركة إيداع، حجز، أو خصم لحظياً مع رصيدك قبل وبعد الحركة.
            </p>
          </div>

          <button
            onClick={() => void loadWalletData()}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-semibold flex items-center gap-2 transition-colors border border-slate-700 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>تحديث السجل</span>
          </button>
        </div>

        {/* Search & Type Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث في الوصف، رقم المرجع، أو معرف الحركة..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl pr-10 pl-3 py-2 text-xs text-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'deposit', label: 'الإيداعات' },
              { id: 'order_hold', label: 'الحجوزات' },
              { id: 'order_capture', label: 'الخصومات' },
              { id: 'order_release', label: 'الاسترجاعات' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setTypeFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  typeFilter === f.id
                    ? 'bg-purple-500 text-slate-950 shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions Table / List */}
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12 px-4 bg-slate-950/60 rounded-2xl border border-slate-800/80 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-white text-xs">لا توجد حركات مالية مسجلة في السجل</h4>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              ستظهر هنا كافة حركات الإيداع، الشراء، الحجز، والاسترجاع بشكل فوري عند استخدام محفظتك الرقمية.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">نوع الحركة</th>
                  <th className="py-3 px-4 font-semibold">الوصف والمرجع</th>
                  <th className="py-3 px-4 font-semibold">المبلغ</th>
                  <th className="py-3 px-4 font-semibold">الرصيد المتاح (قبل / بعد)</th>
                  <th className="py-3 px-4 font-semibold">الرصيد المعلق (قبل / بعد)</th>
                  <th className="py-3 px-4 font-semibold">التاريخ والوقت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {filteredTransactions.map(tx => {
                  const badge = getTransactionBadge(tx.type);
                  const IconComp = badge.icon;
                  const isPositive = tx.direction === 'credit' || tx.direction === 'release';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium ${badge.bg}`}>
                          <IconComp className="w-3.5 h-3.5 shrink-0" />
                          <span>{badge.label}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-medium text-white truncate">{tx.description}</div>
                        <div className="text-[10px] text-slate-500 font-mono">مرجع: {tx.referenceId}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono font-bold" dir="ltr">
                        <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                          {isPositive ? '+' : '-'}{tx.amount.toFixed(2)} {wallet?.currency || 'SAR'}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-300" dir="ltr">
                        <span className="text-slate-500">{tx.availableBalanceBefore.toFixed(2)}</span>
                        <span className="mx-1 text-slate-600">→</span>
                        <span className="text-white font-bold">{tx.availableBalanceAfter.toFixed(2)}</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-300" dir="ltr">
                        <span className="text-slate-500">{tx.pendingBalanceBefore.toFixed(2)}</span>
                        <span className="mx-1 text-slate-600">→</span>
                        <span className="text-amber-300 font-bold">{tx.pendingBalanceAfter.toFixed(2)}</span>
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
    </div>
  );
};
