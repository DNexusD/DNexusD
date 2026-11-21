import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { HandCoins, Gift, X, Check, QrCode, AlertCircle } from 'lucide-react';

interface GrantBalanceOrLoanModalProps {
  initialPosId?: string;
  onClose: () => void;
}

export const GrantBalanceOrLoanModal: React.FC<GrantBalanceOrLoanModalProps> = ({ initialPosId, onClose }) => {
  const { posClients, grantSupplierBalanceOrLoan, showToast } = useApp();

  const initialClient = posClients.find(p => p.id === initialPosId) || posClients[0];
  const isLockedClient = Boolean(initialPosId);

  const [supportType, setSupportType] = useState<'cash' | 'loan'>('cash');
  const [selectedPosId, setSelectedPosId] = useState<string>(initialPosId || initialClient?.id || '');
  const [manualPosCode, setManualPosCode] = useState(initialClient?.posCode || '');
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleQrImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toUpperCase();
    const matchedClient = posClients.find(c => 
      fileName.includes(c.posCode.toUpperCase()) || 
      fileName.includes(c.id.toUpperCase()) ||
      fileName.includes(c.tradeName.toUpperCase())
    );

    if (matchedClient) {
      setSelectedPosId(matchedClient.id);
      setManualPosCode(matchedClient.posCode);
      showToast({
        type: 'success',
        title: 'تم قراءة رمز الكيو آر بنجاح',
        description: `تم التعرف على نقطة البيع: ${matchedClient.tradeName} (${matchedClient.posCode})`
      });
    } else {
      showToast({
        type: 'info',
        title: 'تم تحليل صورة الكيو آر',
        description: 'يرجى التأكد من اختيار العميل أو إدخال معرف نقطة البيع بدقة.'
      });
    }
  };

  const handleSelectByCode = (code: string) => {
    const clean = code.trim().toUpperCase();
    setManualPosCode(code);
    const found = posClients.find(p => p.posCode.toUpperCase() === clean || p.id.toUpperCase() === clean);
    if (found) {
      setSelectedPosId(found.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const numericAmount = parseFloat(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFormError('يرجى إدخال مبلغ صحيح أكبر من الصفر.');
      return;
    }

    let targetId = initialPosId || selectedPosId;
    if (!isLockedClient && manualPosCode.trim()) {
      const found = posClients.find(p => p.posCode.toUpperCase() === manualPosCode.trim().toUpperCase() || p.id === manualPosCode.trim());
      if (found) {
        targetId = found.id;
      }
    }

    if (!targetId) {
      setFormError('يرجى اختيار العميل أو إدخال معرف نقطة البيع (POS ID).');
      return;
    }

    const res = grantSupplierBalanceOrLoan({
      posId: targetId,
      amount: numericAmount,
      supportType,
      reason: reason.trim() || (supportType === 'loan' ? 'منح سلفة رصيد آجل من المتجر' : 'دعم رصيد مجاني وهدية من المتجر'),
    });

    if (!res.success) {
      setFormError(res.error || 'تعذر منح الدعم. تحقق من البيانات.');
      return;
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 text-slate-100 shadow-2xl space-y-5 my-6 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <HandCoins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">منح دعم رصيد مجاني أو سلفة لنقطة بيع</h3>
              <p className="text-xs text-slate-400">تخصيص رصيد هدية مجاني أو سلفة آجل لعميل أو وكيل المتجر</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Support Type Selection */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-300">حدد نوع الدعم المقدم للعميل:</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSupportType('cash')}
                className={`p-3 rounded-2xl border text-right transition-all flex items-center gap-3 cursor-pointer ${
                  supportType === 'cash'
                    ? 'bg-amber-500/15 border-amber-500 text-white shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  supportType === 'cash' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-amber-400'
                }`}>
                  <Gift className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold block text-xs">رصيد مجاني (هدية)</span>
                  <span className="text-[10px] text-slate-400">دعم مالي غير مدفوع السداد</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSupportType('loan')}
                className={`p-3 rounded-2xl border text-right transition-all flex items-center gap-3 cursor-pointer ${
                  supportType === 'loan'
                    ? 'bg-cyan-500/15 border-cyan-500 text-white shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  supportType === 'loan' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-900 text-cyan-400'
                }`}>
                  <HandCoins className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold block text-xs">سلفة (رصيد آجل)</span>
                  <span className="text-[10px] text-slate-400">رصيد ذو مطالبات سداد لاحقاً</span>
                </div>
              </button>
            </div>
          </div>

          {/* Client Selection */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-300">
                {isLockedClient ? 'العميل المستهدف (محدد مسبقاً):' : 'اختر العميل أو نقطة البيع المستفيدة:'}
              </label>
              
              {!isLockedClient && (
                <label className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-700 font-semibold text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors">
                  <QrCode className="w-3.5 h-3.5" />
                  <span>قراءة صورة الكيو آر (QR)</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleQrImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {isLockedClient ? (
              <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/40 flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-white text-sm">{initialClient?.tradeName}</div>
                  <div className="text-slate-400 text-[11px]">
                    المالك: {initialClient?.ownerName} · هاتف: {initialClient?.phone} · رصيد المحفظة: <strong className="text-emerald-400 font-mono">{initialClient?.walletBalance.toFixed(2)} ر.س</strong>
                  </div>
                </div>
                <div className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-bold text-xs shrink-0">
                  {initialClient?.posCode}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-[10.5px] text-slate-400 block mb-1">بحث في قائمة العملاء:</span>
                  <select
                    value={selectedPosId}
                    onChange={e => {
                      setSelectedPosId(e.target.value);
                      const found = posClients.find(p => p.id === e.target.value);
                      if (found) setManualPosCode(found.posCode);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white focus:outline-none"
                  >
                    {posClients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.tradeName} ({client.posCode}) - رصيد: {client.walletBalance.toFixed(2)} ر.س
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-[10.5px] text-slate-400 block mb-1">أو إدخال معرف نقطة البيع (POS ID):</span>
                  <input
                    type="text"
                    value={manualPosCode}
                    onChange={e => handleSelectByCode(e.target.value)}
                    placeholder="مثال: RYD-84920"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none"
                    dir="ltr"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Amount Input */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              مبلغ {supportType === 'cash' ? 'الدعم المجاني (ر.س):' : 'السلفة (ر.س):'}
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-white font-mono text-sm font-bold pl-12 focus:outline-none"
                dir="ltr"
              />
              <span className="absolute left-3 top-2 text-slate-400 text-xs font-semibold">ر.س</span>
            </div>
          </div>

          {/* Reason Input */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              {supportType === 'cash' ? 'سبب الدعم المجاني / ملاحظات الهدية:' : 'سبب السلفة / تفاصيل الرصيد الآجل:'}
            </label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={supportType === 'cash' ? 'مثال: دعم تحفيزي لزيادة المبيعات وتفعيل العضوية...' : 'مثال: سلفة تشغيلية مؤقتة لشحن الحسابات لحين سداد الحوالة...'}
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none resize-none"
            />
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className={`px-5 py-2.5 rounded-xl text-slate-950 text-xs font-bold transition-colors shadow-md flex items-center gap-1.5 cursor-pointer ${
                supportType === 'cash'
                  ? 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/20'
                  : 'bg-cyan-500 hover:bg-cyan-400 shadow-cyan-500/20'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{supportType === 'cash' ? 'منح الدعم المجاني للعميل' : 'اعتماد ومنح السلفة للعميل'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
