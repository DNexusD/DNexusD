import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { walletService } from '../../services/walletService';
import { ClientWallet, WalletTransaction } from '../../types/wallet';
import { POSClient } from '../../types';
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
  X
} from 'lucide-react';

interface SupplierClientWalletModalProps {
  client: POSClient;
  onClose: () => void;
}

export const SupplierClientWalletModal: React.FC<SupplierClientWalletModalProps> = ({ client, onClose }) => {
  const { showToast } = useApp();
  const [wallet, setWallet] = useState<ClientWallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Manual adjustment form
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustType, setAdjustType] = useState<'credit' | 'debit'>('credit');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clientId = client.id;

  const loadData = async () => {
    setIsLoading(true);
    try {
      const w = await walletService.getClientWallet(clientId);
      const txs = await walletService.getWalletTransactions(clientId);
      setWallet(w);
      setTransactions(txs);
    } catch (err) {
      console.warn('Error loading client wallet for supplier:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [clientId]);

  const handleManualAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(adjustAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast({ type: 'error', title: 'مبلغ غير صحيح', description: 'يرجى إدخال مبلغ صحيح أكبر من الصفر.' });
      return;
    }
    if (!adjustReason.trim()) {
      showToast({ type: 'error', title: 'سبب مطلوب', description: 'يرجى كتابة سبب أو ملاحظة للتعديل اليدوي.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await walletService.manualAdjustment({
        clientId,
        supplierId: client.supplierId,
        amount: amountNum,
        isCredit: adjustType === 'credit',
        referenceId: `manual-admin-${Date.now()}`,
        description: adjustReason.trim()
      });

      if (res.success) {
        showToast({
          type: 'success',
          title: adjustType === 'credit' ? 'تم إضافة الرصيد بنجاح' : 'تم خصم الرصيد بنجاح',
          description: `تم تحديث محفظة العميل (${client.tradeName}) بمبلغ ${amountNum.toFixed(2)} ${client.preferredCurrency || 'SAR'}.`
        });
        setAdjustAmount('');
        setAdjustReason('');
        setShowAdjustModal(false);
        await loadData();
      } else {
        showToast({ type: 'error', title: 'خطأ في العملية', description: res.error || 'تعذر إتمام التعديل اليدوي.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطأ غير متوقع.';
      showToast({ type: 'error', title: 'خطأ', description: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-white">محفظة العميل وكشف الحساب المالي</h2>
              <p className="text-xs text-slate-400">
                {client.tradeName} ({client.ownerName}) - كود: <span className="font-mono text-purple-300">{client.posCode}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdjustModal(true)}
              className="px-3.5 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md"
            >
              <PlusCircle className="w-4 h-4" />
              <span>تسوية يدوية للرصيد</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-[11px] font-semibold text-slate-400">الرصيد المتاح</span>
              <div className="text-xl font-black text-emerald-400 font-mono" dir="ltr">
                {wallet ? wallet.availableBalance.toFixed(2) : '0.00'} <span className="text-xs">{wallet?.currency || client.preferredCurrency || 'SAR'}</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-[11px] font-semibold text-slate-400">الرصيد المعلق (طلبات نشطة)</span>
              <div className="text-xl font-black text-amber-300 font-mono" dir="ltr">
                {wallet ? wallet.pendingBalance.toFixed(2) : '0.00'} <span className="text-xs">{wallet?.currency || client.preferredCurrency || 'SAR'}</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-[11px] font-semibold text-slate-400">إجمالي المشتريات المسجلة</span>
              <div className="text-xl font-black text-purple-300 font-mono" dir="ltr">
                {wallet ? wallet.totalSpent.toFixed(2) : '0.00'} <span className="text-xs">{wallet?.currency || client.preferredCurrency || 'SAR'}</span>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">سجل العمليات المالية (Ledger History)</h3>
              <button
                onClick={() => void loadData()}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>تحديث</span>
              </button>
            </div>

            {transactions.length === 0 ? (
              <div className="text-center py-10 bg-slate-950/40 rounded-2xl border border-slate-800 text-slate-400 text-xs">
                لا توجد حركات مالية مسجلة بعد لهذا العميل.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-semibold">نوع الحركة</th>
                      <th className="py-3 px-4 font-semibold">الوصف والمرجع</th>
                      <th className="py-3 px-4 font-semibold">المبلغ</th>
                      <th className="py-3 px-4 font-semibold">المتاح (قبل / بعد)</th>
                      <th className="py-3 px-4 font-semibold">المعلق (قبل / بعد)</th>
                      <th className="py-3 px-4 font-semibold">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                    {transactions.map(tx => {
                      const isPositive = tx.direction === 'credit' || tx.direction === 'release';
                      return (
                        <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap font-medium text-white">
                            <span className={`px-2 py-1 rounded-lg text-[10px] ${
                              tx.type === 'deposit' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                              tx.type.includes('hold') ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' :
                              'bg-purple-500/15 text-purple-300 border border-purple-500/30'
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
        </div>

        {/* Manual Adjustment Modal */}
        {showAdjustModal && (
          <div className="absolute inset-0 z-20 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-white">تسوية يدوية لمحفظة العميل</h3>
                <button onClick={() => setShowAdjustModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleManualAdjustment} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1.5">نوع العملية</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjustType('credit')}
                      className={`py-2 rounded-xl font-semibold border transition-colors ${
                        adjustType === 'credit'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      إضافة رصيد (Credit)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustType('debit')}
                      className={`py-2 rounded-xl font-semibold border transition-colors ${
                        adjustType === 'debit'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      خصم رصيد (Debit)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1.5">المبلغ ({client.preferredCurrency || 'SAR'})</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustAmount}
                    onChange={e => setAdjustAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1.5">سبب أو ملاحظة التسوية</label>
                  <textarea
                    value={adjustReason}
                    onChange={e => setAdjustReason(e.target.value)}
                    placeholder="مثال: تسوية إيداع نقدي مباشر أو تعويض..."
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 resize-none"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdjustModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold shadow-md disabled:opacity-50"
                  >
                    {isSubmitting ? 'جاري التنفيذ...' : 'تأكيد التسوية'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
