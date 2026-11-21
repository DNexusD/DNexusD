import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Send, ArrowRight, UserCheck, AlertCircle, QrCode, Scan } from 'lucide-react';

import { getBalanceRequestAvailability } from '../../utils/availabilityMessages';

interface TransferModalProps {
  onClose: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({ onClose }) => {
  const { currentPos, posClients, supplier, executeBalanceTransfer, showToast, calculateFee, activeCurrency, activeExchangeRate, currencyLabel, formatCurrency, convertToSar } = useApp();

  const [targetCode, setTargetCode] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  // Look up target POS client
  const targetPos = posClients.find(
    p => p.posCode.trim().toUpperCase() === targetCode.trim().toUpperCase()
  );

  const numAmountSar = convertToSar(Number(amount) || 0);
  const feeAmountSar = calculateFee(numAmountSar, supplier);
  const totalDeductedSar = numAmountSar + feeAmountSar;

  const balanceAvailability = getBalanceRequestAvailability({
    walletBalance: currentPos.walletBalance,
    requiredAmount: numAmountSar > 0 ? totalDeductedSar : 0,
    walletLabel: 'محفظتك',
    requestLabel: 'تحويل الرصيد',
    currency: activeCurrency,
    exchangeRateSarPerUsd: activeExchangeRate,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numAmountSar || numAmountSar <= 0) {
      showToast({ type: 'error', title: 'تنبيه', description: 'يرجى إدخال مبلغ تحويل صحيح' });
      return;
    }

    if (!targetPos) {
      showToast({ type: 'error', title: 'عدم توفر المطلوب', description: 'معرف نقطة البيع أو رمز QR غير موجود أو غير متاح' });
      return;
    }

    if (!balanceAvailability.available) {
      showToast({
        type: 'error',
        title: balanceAvailability.title,
        description: balanceAvailability.message
      });
      return;
    }

    setSubmitting(true);
    const res = await executeBalanceTransfer({
      targetPosCode: targetCode.trim(),
      amount: numAmountSar
    });
    setSubmitting(false);

    if (res.success) {
      onClose();
    }
  };

  const handleSelectScannedCode = (code: string) => {
    setTargetCode(code);
    setIsQrScannerOpen(false);
    showToast({
      type: 'info',
      title: 'تم مسح الكيو أر (QR)',
      description: `تم التعرف على المعرف: ${code}`
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 text-slate-100 flex flex-col">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">تحويل رصيد عبر المعرف أو الكيو أر</h3>
              <p className="text-xs text-slate-400">تحويل رصيد مباشر وفوري بين العملاء ونقاط البيع</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          
          {/* Sender Balance Info */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
            <span className="text-slate-400">رصيدك المتاح الحالي:</span>
            <span className="font-mono font-bold text-white text-sm">
              {formatCurrency(currentPos.walletBalance)}
            </span>
          </div>

          {/* Target POS Code + QR Scan Trigger */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300">
                معرّف المستلم (3 أحرف و5 أرقام تفصلهم شرطة):
              </label>
              <button
                type="button"
                onClick={() => setIsQrScannerOpen(true)}
                className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <Scan className="w-3.5 h-3.5" />
                <span>مسح كيو أر (QR Scanner)</span>
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                required
                value={targetCode}
                onChange={e => setTargetCode(e.target.value.toUpperCase())}
                placeholder="مثال: JED-28314"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-base font-mono text-center tracking-wider text-white focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={() => setIsQrScannerOpen(true)}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors shrink-0"
                title="فتح الماسح الضوئي للكيو آر"
              >
                <QrCode className="w-4 h-4 text-amber-400" />
                <span className="text-xs hidden sm:inline">مسح QR</span>
              </button>
            </div>

            {/* Target Found preview */}
            {targetPos && (
              <div className="mt-2 p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs flex items-center justify-between text-cyan-200">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-cyan-400" />
                  <div>
                    <div className="font-semibold text-white">{targetPos.tradeName}</div>
                    <div className="text-[10px] text-slate-400">{targetPos.ownerName} · {targetPos.city}</div>
                  </div>
                </div>
                <span className="font-mono text-cyan-400">{targetPos.posCode}</span>
              </div>
            )}

            {!targetPos && targetCode.length >= 6 && (
              <div className="mt-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-slate-500" />
                <span>أدخل المعرف الصحيح (مثال نقاط البيع: JED-28314, DAM-59123, MAK-48190)</span>
              </div>
            )}
          </div>

          {/* Transfer Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              المبلغ المراد تحويله ({currencyLabel}):
            </label>
            <input
              type="number"
              min="0.01"
              step="any"
              required
              value={amount}
              onChange={e => setAmount(e.target.value ? Number(e.target.value) : '')}
              placeholder={activeCurrency === 'USD' ? '50' : '100'}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-base font-bold font-mono text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Transfer Amount Summary */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
            <div className="flex justify-between text-slate-400">
              <span>المبلغ المحول للمستلم:</span>
              <span className="font-mono tabular-nums text-white">{formatCurrency(numAmountSar)}</span>
            </div>
            <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-sm text-white">
              <span>إجمالي الخصم من محفظتك:</span>
              <span className="text-cyan-400 font-mono tabular-nums">{formatCurrency(totalDeductedSar)}</span>
            </div>
          </div>

          {!balanceAvailability.available && (
            <div
              role="alert"
              className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 space-y-1"
            >
              <div className="font-bold text-rose-300 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{balanceAvailability.title}</span>
              </div>
              <p className="text-rose-200/90 leading-relaxed">{balanceAvailability.message}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !targetPos || !balanceAvailability.available}
            className="w-full py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-md cursor-pointer"
          >
            <span>
              {!balanceAvailability.available
                ? 'عدم توفر الرصيد المطلوب'
                : `تأكيد تحويل ${formatCurrency(totalDeductedSar)}`}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* QR Scanner Simulation Modal */}
        {isQrScannerOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 text-center">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-white flex items-center gap-1.5">
                  <Scan className="w-4 h-4 text-amber-400" />
                  ماسح رمز الكيو أر (QR Scanner)
                </span>
                <button
                  type="button"
                  onClick={() => setIsQrScannerOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Viewfinder Mockup */}
              <div className="relative w-56 h-56 mx-auto rounded-2xl border-2 border-dashed border-cyan-400/80 bg-slate-950 flex flex-col items-center justify-center p-4 overflow-hidden">
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse top-1/2"></div>
                <QrCode className="w-24 h-24 text-slate-700" />
                <span className="text-[11px] text-cyan-300 font-medium mt-2">وجّه الكاميرا لرمز QR الخاص بالعميل</span>
              </div>

              <div className="text-xs text-slate-400">
                أو انقر مباشرة على أحد العملاء المتاحين لمسح كوده فوراً:
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {posClients.filter(p => p.id !== currentPos.id).length === 0 ? (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 text-center">
                    لا تتوفر نقاط بيع أو وكلاء آخرين مسجلين حالياً.
                  </div>
                ) : (
                  posClients.filter(p => p.id !== currentPos.id).map(pos => (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() => handleSelectScannedCode(pos.posCode)}
                      className="w-full p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-right flex items-center justify-between text-xs transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-white">{pos.tradeName}</div>
                        <div className="text-[10px] text-slate-400">{pos.city}</div>
                      </div>
                      <span className="font-mono text-cyan-400 font-bold">{pos.posCode}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
