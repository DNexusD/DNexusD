import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getActiveBankAccountsForDeposit } from '../../utils/bankAccounts';
import { getActiveDropdownOptions } from '../../utils/platformSettings';
import {
  compressReceiptImageFile,
  formatReceiptFileSize,
  validateReceiptImage,
} from '../../utils/receiptImage';
import { ReceiptImageModal } from '../common/ReceiptImageModal';
import {
  X,
  Building2,
  Copy,
  Check,
  ArrowRight,
  HandCoins,
  ShieldCheck,
  Zap,
  Globe,
  UserCheck,
  Landmark,
  Upload,
  Eye,
  Trash2,
  Sparkles,
} from 'lucide-react';

interface DepositModalProps {
  onClose: () => void;
}

export const DepositModal: React.FC<DepositModalProps> = ({ onClose }) => {
  const { currentPosSupplier, supplierBankAccounts, platformSettings, submitDepositRequest, currentPos } = useApp();

  const approvedBankOptions = useMemo(
    () => getActiveDropdownOptions(platformSettings.approvedBankNames),
    [platformSettings.approvedBankNames]
  );

  const [requestType, setRequestType] = useState<'cash' | 'loan'>('cash');

  const activeBankAccounts = useMemo(
    () => getActiveBankAccountsForDeposit(supplierBankAccounts, currentPosSupplier),
    [supplierBankAccounts, currentPosSupplier]
  );

  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>(
    activeBankAccounts[0]?.id || ''
  );

  const selectedAccount = useMemo(
    () =>
      activeBankAccounts.find((a) => a.id === selectedBankAccountId) || activeBankAccounts[0],
    [activeBankAccounts, selectedBankAccountId]
  );

  // Common & Cash state
  const [amount, setAmount] = useState<number | ''>(500);
  const [transferNumber, setTransferNumber] = useState('');
  const [transferSenderName, setTransferSenderName] = useState(currentPos.ownerName);
  const [bankName, setBankName] = useState('مصرف الراجحي');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Receipt image state (Mandatory for Cash deposit)
  const [transferReceiptImage, setTransferReceiptImage] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string>('');
  const [receiptFileSizeKb, setReceiptFileSizeKb] = useState<number>(0);
  const [receiptImageError, setReceiptImageError] = useState<string | null>(null);
  const [transferNumberError, setTransferNumberError] = useState<string | null>(null);
  const [isCompressingImage, setIsCompressingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Loan state
  const [loanReason, setLoanReason] = useState('تغطية مبيعات عاجلة لشحن الألعاب والخدمات');

  const handleCopyValue = (value: string, key: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleProcessFile = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setReceiptImageError('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP).');
      return;
    }
    try {
      setIsCompressingImage(true);
      setReceiptImageError(null);
      const processed = await compressReceiptImageFile(file);
      setTransferReceiptImage(processed.dataUrl);
      setReceiptFileName(processed.fileName);
      setReceiptFileSizeKb(processed.sizeKb);
    } catch (err: any) {
      console.error('Image compression error', err);
      setReceiptImageError(err?.message || 'تعذر معالجة الصورة، يرجى تجربة صورة أخرى.');
    } finally {
      setIsCompressingImage(false);
    }
  };

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleReceiptDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleRemoveReceipt = () => {
    setTransferReceiptImage(null);
    setReceiptFileName('');
    setReceiptFileSizeKb(0);
    setReceiptImageError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) return;

    if (requestType === 'cash') {
      let hasError = false;
      if (!transferNumber.trim()) {
        setTransferNumberError('رقم الحوالة البنكية مطلوب');
        hasError = true;
      } else {
        setTransferNumberError(null);
      }

      const receiptValidation = validateReceiptImage(transferReceiptImage);
      if (!receiptValidation.isValid) {
        setReceiptImageError(receiptValidation.error || 'صورة إيصال الحوالة إلزامية لتأكيد الطلب.');
        hasError = true;
      } else {
        setReceiptImageError(null);
      }

      if (!transferSenderName.trim()) {
        hasError = true;
      }

      if (hasError) return;

      submitDepositRequest({
        amount: Number(amount),
        requestType: 'cash',
        transferNumber: transferNumber.trim(),
        transferSenderName: transferSenderName.trim(),
        bankName,
        targetBankAccountId: selectedAccount?.id,
        transferReceiptImage: transferReceiptImage || undefined,
        transferReceiptFileName: receiptFileName || 'receipt.jpg',
      });
    } else {
      // Loan / Advance Credit Request
      submitDepositRequest({
        amount: Number(amount),
        requestType: 'loan',
        loanReason: loanReason.trim() || 'طلب سلفة رصيد آجل عاجل',
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 text-slate-100 flex flex-col">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                requestType === 'cash'
                  ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                  : 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400'
              }`}
            >
              {requestType === 'cash' ? (
                <Building2 className="w-5 h-5" />
              ) : (
                <HandCoins className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {currentPos.canRequestLoans ? 'طلب شحن رصيد المحفظة أو سلفة' : 'طلب شحن رصيد المحفظة'}
              </h3>
              <p className="text-xs text-slate-400">
                {currentPos.canRequestLoans
                  ? 'إيداع رصيد مسبق أو طلب سلفة لدى المتجر: '
                  : 'إيداع وشحن رصيد مسبق لدى المتجر: '}
                <span className="text-amber-400 font-semibold">{currentPosSupplier.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Request Type Selector Tabs (Only shown if client has been granted loan privilege by supplier) */}
        {currentPos.canRequestLoans && (
          <div className="p-3 bg-slate-950/60 border-b border-slate-800 grid grid-cols-2 gap-2 text-xs font-bold">
            <button
              type="button"
              onClick={() => setRequestType('cash')}
              className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                requestType === 'cash'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>خيار 1: إيداع كاش / تحويل بنكي</span>
            </button>

            <button
              type="button"
              onClick={() => setRequestType('loan')}
              className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                requestType === 'loan'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-900 text-cyan-400 hover:text-white border border-cyan-500/30'
              }`}
            >
              <HandCoins className="w-4 h-4" />
              <span>خيار 2: طلب سلفة / رصيد آجل</span>
            </button>
          </div>
        )}

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 max-h-[78vh] overflow-y-auto">
          {/* OPTION 1: CASH / BANK DEPOSIT DETAILS */}
          {requestType === 'cash' && (
            <>
              {/* Target Bank Account Selector */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <label className="block font-bold text-xs sm:text-sm text-white flex items-center gap-1.5">
                    <Landmark className="w-4 h-4 text-amber-400" />
                    <span>اختر البنك والحساب المحوّل إليه للإيداع:</span>
                  </label>
                  <span className="text-[10px] text-amber-400/90 font-mono">
                    {activeBankAccounts.length} حسابات مخولة
                  </span>
                </div>

                {/* Dropdown Selector for Authorized Banks */}
                <div>
                  <select
                    value={selectedAccount?.id || ''}
                    onChange={(e) => setSelectedBankAccountId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
                  >
                    {activeBankAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.bankName} — رقم الحساب: {acc.accountNumber || acc.iban} — {acc.accountHolderName} ({acc.country}) {acc.canReceiveSupplierTransfers ? ' [مخوّل باستلام الحوالات]' : ' [معتمد]'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Horizontal Compact Interactive Card for the Selected Bank */}
                {selectedAccount && (
                  <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-950 border border-amber-500/40 shadow-sm space-y-2.5 animate-in fade-in duration-200">
                    {/* Top Row: Bank Name, Country, Holder, and Badge in one horizontal bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                          <Landmark className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex items-baseline gap-1.5 min-w-0 truncate">
                          <span className="font-bold text-white text-xs sm:text-sm">
                            {selectedAccount.bankName}
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Globe className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>{selectedAccount.country}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] shrink-0">
                        <span className="text-slate-300">
                          صاحب الحساب: <strong className="text-white font-medium">{selectedAccount.accountHolderName}</strong>
                        </span>

                        {selectedAccount.canReceiveSupplierTransfers ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] text-emerald-300 font-semibold">
                            <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>مخوّل لنقطة بيع ({selectedAccount.delegatedPosName || selectedAccount.accountHolderName})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] text-amber-300/90 font-medium">
                            <Check className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>حساب معتمد للمتجر</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle Row: Horizontal side-by-side Account Number and IBAN */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {selectedAccount.accountNumber && (
                        <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-400 shrink-0">رقم الحساب:</span>
                          <span className="font-mono text-xs sm:text-sm font-bold text-amber-300 tracking-wider select-all truncate" dir="ltr">
                            {selectedAccount.accountNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyValue(selectedAccount.accountNumber, 'selectedAccNum')}
                            className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                            title="نسخ رقم الحساب"
                          >
                            {copiedKey === 'selectedAccNum' ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">تم النسخ</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>نسخ</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {selectedAccount.iban && (
                        <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-900/70 border border-slate-800">
                          <span className="text-[10px] text-slate-400 shrink-0">الآيبان:</span>
                          <span className="font-mono text-[11px] sm:text-xs text-cyan-300 select-all truncate" dir="ltr">
                            {selectedAccount.iban}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyValue(selectedAccount.iban || '', 'selectedIban')}
                            className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                            title="نسخ الآيبان"
                          >
                            {copiedKey === 'selectedIban' ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">تم النسخ</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>نسخ</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Bottom Line: Compact Single-Line Routing Note */}
                    <div className="text-[10.5px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                      {selectedAccount.canReceiveSupplierTransfers ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-emerald-300/90 truncate">
                            يُوجَّه الطلب إلى نقطة البيع المخوّلة ({selectedAccount.delegatedPosName || selectedAccount.accountHolderName}) لمطابقة الحوالة وتأكيدها للمتجر فورياً.
                          </span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-slate-300 truncate">
                            يُوجَّه الطلب مباشرة إلى المتجر ({currentPosSupplier.name}) لمطابقة الحوالة واعتماد الرصيد بمحفظتك.
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Form Fields for Cash */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    مبلغ الإيداع المراد شحنه (ر.س):
                  </label>
                  <input
                    type="number"
                    min="10"
                    step="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
                    placeholder="500"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-base font-bold font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                  {currentPos.canGetBonus && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-amber-300 text-[11px] font-medium bg-amber-500/10 p-2 rounded-xl border border-amber-500/30">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>✨ حسابك حاصل على (ميزة الحصول على بونص إضافي) على إيداعاتك ورصيدك!</span>
                    </div>
                  )}
                </div>

                {/* Two-Column Grid: Transfer Number & Mandatory Receipt Image side-by-side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                  {/* Column 1: Transfer Number */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      رقم الحوالة البنكية (المرجع) <span className="text-amber-400">*</span>:
                    </label>
                    <input
                      type="text"
                      required
                      value={transferNumber}
                      onChange={(e) => {
                        setTransferNumber(e.target.value);
                        if (transferNumberError) setTransferNumberError(null);
                      }}
                      placeholder="مثال: TRX-99281740 أو رقم العملية"
                      className={`w-full bg-slate-950 border ${
                        transferNumberError
                          ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/30'
                          : 'border-slate-700 focus:border-amber-500'
                      } rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none transition-colors`}
                    />
                    {transferNumberError ? (
                      <span className="text-[10px] text-rose-400 mt-1 block">{transferNumberError}</span>
                    ) : (
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        رقم الإشعار أو المرجع البنكي للعملية
                      </span>
                    )}
                  </div>

                  {/* Column 2: Mandatory Transfer Receipt Image */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-300">
                        صورة إيصال الحوالة <span className="text-amber-400">* (إلزامية)</span>:
                      </label>
                      {transferReceiptImage && (
                        <span className="text-[10px] text-emerald-400 font-medium">تم الإرفاق ✓</span>
                      )}
                    </div>

                    {!transferReceiptImage ? (
                      <div>
                        <input
                          type="file"
                          id="receipt-file-input"
                          accept="image/*"
                          onChange={handleReceiptFileChange}
                          className="hidden"
                          disabled={isCompressingImage}
                        />
                        <label
                          htmlFor="receipt-file-input"
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDragging(true);
                          }}
                          onDragLeave={() => setIsDragging(false)}
                          onDrop={handleReceiptDrop}
                          className={`w-full min-h-[42px] px-3 py-2 border border-dashed rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all ${
                            receiptImageError
                              ? 'border-rose-500/90 bg-rose-950/20 text-rose-300 ring-1 ring-rose-500/30'
                              : isDragging
                              ? 'border-amber-400 bg-amber-500/10 text-amber-300'
                              : 'border-slate-700 bg-slate-950/70 hover:border-amber-500/60 hover:bg-slate-950 text-slate-300'
                          }`}
                        >
                          {isCompressingImage ? (
                            <div className="flex items-center gap-2 text-xs text-amber-300">
                              <span className="animate-spin text-amber-400">⏳</span>
                              <span>جاري معالجة وضغط الصورة...</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-xs truncate">
                              <Upload className="w-4 h-4 text-amber-400 shrink-0" />
                              <span className="truncate font-medium">إرفاق صورة الإيصال (إلزامي)</span>
                              <span className="text-[10px] text-slate-500 shrink-0 hidden sm:inline">JPG/PNG</span>
                            </div>
                          )}
                        </label>
                        {receiptImageError ? (
                          <span className="text-[10px] text-rose-400 mt-1 block font-medium">
                            {receiptImageError}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            صورة واضحة لإشعار التحويل البنكي
                          </span>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between gap-2 p-1.5 px-2.5 rounded-xl bg-slate-950 border border-emerald-500/40">
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              type="button"
                              onClick={() => setShowPreviewModal(true)}
                              className="relative group shrink-0 cursor-pointer"
                              title="انقر لمعاينة وتكبير الصورة"
                            >
                              <img
                                src={transferReceiptImage}
                                alt="إيصال الحوالة"
                                className="w-8 h-8 rounded-lg object-cover border border-slate-700 group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Eye className="w-3.5 h-3.5 text-white" />
                              </div>
                            </button>
                            <div className="min-w-0">
                              <div className="text-[11px] font-semibold text-white truncate">
                                {receiptFileName || 'صورة الإيصال'}
                              </div>
                              <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                <span>جاهز للإرسال ({formatReceiptFileSize(receiptFileSizeKb)})</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setShowPreviewModal(true)}
                              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                              title="معاينة الإيصال"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={handleRemoveReceipt}
                              className="p-1 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                              title="حذف الصورة واختيار صورة أخرى"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          انقر على الصورة أو زر المعاينة للتكبير
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    اسم المحوّل (كما هو في حسابك البنكي):
                  </label>
                  <input
                    type="text"
                    required
                    value={transferSenderName}
                    onChange={(e) => setTransferSenderName(e.target.value)}
                    placeholder="مثال: محمد مبارك العتيبي"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    البنك أو التطبيق الذي قمت بالتحويل منه (حسابك الشخصي):
                  </label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    {approvedBankOptions.map((bank) => (
                      <option key={bank.id} value={bank.labelAr}>
                        {bank.labelAr}
                      </option>
                    ))}
                    <option value="بنك آخر">بنك آخر</option>
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200 leading-relaxed">
                * سيتم إرسال طلب الشحن إلى المتجر {currentPosSupplier.name}
                {selectedAccount?.canReceiveSupplierTransfers
                  ? ` وإلى نقطة البيع المخوّلة (${selectedAccount.delegatedPosName || selectedAccount.accountHolderName}) لتأكيد استلام الحوالة`
                  : ''}
                {' '}لمطابقة رقم الحوالة واعتماد إيداع الرصيد في محفظتك مباشرة.
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-md cursor-pointer"
              >
                <span>إرسال طلب الإيداع للمراجعة</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {/* OPTION 2: LOAN / ADVANCE CREDIT DETAILS */}
          {requestType === 'loan' && (
            <>
              <div className="p-4 rounded-2xl bg-cyan-950/50 border border-cyan-500/30 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <span>طلب سلفة رصيد آجل (بدون مرفقات أو بيانات بنكية)</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  يتيح لك هذا الخيار طلب <strong className="text-white">سلفة رصيد آجل</strong> عاجلة مباشرة من المتجر (<strong className="text-white">{currentPosSupplier.name}</strong>) دون الحاجة لإرفاق صورة إيصال أو إدخال رقم حوالة بنكية.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    مبلغ السلفة المطلوبة (ر.س):
                  </label>
                  <input
                    type="number"
                    min="10"
                    step="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
                    placeholder="1000"
                    className="w-full bg-slate-950 border border-cyan-500/40 rounded-xl px-3.5 py-2.5 text-base font-bold font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    سيتم قيد هذا المبلغ في محفظتك فور اعتماد المتجر لطلب السلفة.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    سبب طلب السلفة / ملاحظات للمتجر:
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={loanReason}
                    onChange={(e) => setLoanReason(e.target.value)}
                    placeholder="وضح للمتجر سبب طلب السلفة (مثال: تغطية مبيعات مسائية عاجلة، أو طلب شحن زبون مباشر)..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>تأكيد تسجيل السلفة في القيود وقاعدة البيانات:</span>
                </div>
                <p className="text-slate-400 text-[10px] leading-relaxed">
                  عند اعتماد المتجر للسلفة، سيتم تسجيل دين السلفة في القيود المالية لمسير حسابك، وتوثيق الحركة في قاعدة بيانات العميل والمتجر مع إمكانية متابعة الاستعلام وتسديد السلفة لاحقاً.
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-md shadow-cyan-500/20 cursor-pointer"
              >
                <HandCoins className="w-4 h-4" />
                <span>إرسال طلب السلفة للمتجر (بدون بيانات بنكية)</span>
              </button>
            </>
          )}
        </form>
      </div>

      {/* Full Preview Modal for attached receipt */}
      <ReceiptImageModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        imageUrl={transferReceiptImage}
        title="معاينة إيصال الحوالة المرفق"
        transferNumber={transferNumber}
        amount={typeof amount === 'number' ? amount : undefined}
        senderName={transferSenderName}
        bankName={bankName}
        posName={currentPos.tradeName}
        posCode={currentPos.posCode}
      />
    </div>
  );
};
