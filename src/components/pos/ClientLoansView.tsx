import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DepositRequest, LoanRepaymentRequest, WalletLoanRepaymentReceipt } from '../../types';
import {
  ClientLoanFilterStatus,
  filterClientLoans,
  getLoanPaidAmount,
  getLoanRemainingAmount,
  getLoanRepaymentState,
  getLoanRepaymentsList,
  isLoanDeposit,
  roundCurrency,
} from '../../utils/loanRepayments';
import {
  HandCoins,
  Search,
  Calendar,
  Wallet,
  Building2,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ArrowRight,
  Copy,
  Check,
  X,
  PlusCircle,
  Receipt,
  CreditCard,
  Eye,
  Landmark,
  Globe,
  ShieldCheck,
  Upload,
  Trash2,
  Image as ImageIcon,
  UserCheck,
} from 'lucide-react';
import { getActiveBankAccountsForDeposit } from '../../utils/bankAccounts';
import { getActiveDropdownOptions } from '../../utils/platformSettings';
import {
  compressReceiptImageFile,
  formatReceiptFileSize,
  validateReceiptImage,
} from '../../utils/receiptImage';
import { ReceiptImageModal } from '../common/ReceiptImageModal';

interface ClientLoansViewProps {
  onOpenNewLoan?: () => void;
  onOpenRechargeWallet?: () => void;
}

export const ClientLoansView: React.FC<ClientLoansViewProps> = ({
  onOpenNewLoan,
  onOpenRechargeWallet,
}) => {
  const {
    currentPos,
    depositRequests,
    loanRepaymentRequests,
    suppliers,
    supplier,
    supplierBankAccounts,
    platformSettings,
    payLoanFromWallet,
    submitLoanRepaymentRequest,
    activeCurrency,
    activeExchangeRate,
    currencyLabel,
    formatCurrency,
    convertFromSar,
    convertToSar,
  } = useApp();

  const approvedBankOptions = useMemo(
    () => getActiveDropdownOptions(platformSettings.approvedBankNames),
    [platformSettings.approvedBankNames]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientLoanFilterStatus>('all');
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);

  // Repayment Modal Form State
  const [repayMethod, setRepayMethod] = useState<'wallet' | 'bank_transfer'>('wallet');
  const [repayAmountInput, setRepayAmountInput] = useState<string>('');
  const [transferNumber, setTransferNumber] = useState('');
  const [senderName, setSenderName] = useState(currentPos.ownerName || '');
  const [bankName, setBankName] = useState('مصرف الراجحي');
  const [repayNotes, setRepayNotes] = useState('');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [transferReceiptImage, setTransferReceiptImage] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string>('');
  const [receiptFileSizeKb, setReceiptFileSizeKb] = useState<number>(0);
  const [receiptImageError, setReceiptImageError] = useState<string | null>(null);
  const [transferNumberError, setTransferNumberError] = useState<string | null>(null);
  const [isCompressingImage, setIsCompressingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [viewingReceiptInfo, setViewingReceiptInfo] = useState<{
    imageUrl: string;
    title: string;
    transferNumber?: string;
    amount?: number;
    senderName?: string;
    bankName?: string;
    date?: string;
    posName?: string;
    posCode?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [walletRepayReceipt, setWalletRepayReceipt] = useState<WalletLoanRepaymentReceipt | null>(null);
  const [bankTransferReceipt, setBankTransferReceipt] = useState<LoanRepaymentRequest | null>(null);
  const topBannerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setWalletRepayReceipt(null);
    setBankTransferReceipt(null);
  }, [currentPos.id]);

  const clientLoans = useMemo(() => {
    return depositRequests
      .filter((d) => isLoanDeposit(d) && d.posId === currentPos.id)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [depositRequests, currentPos.id]);

  const filteredLoans = useMemo(() => {
    return filterClientLoans(clientLoans, {
      posId: currentPos.id,
      query: searchQuery,
      dateQuery: dateFilter,
      statusFilter,
    });
  }, [clientLoans, currentPos.id, searchQuery, dateFilter, statusFilter]);

  const stats = useMemo(() => {
    const approvedLoans = clientLoans.filter((l) => l.status === 'approved');
    const totalApproved = roundCurrency(
      approvedLoans.reduce((sum, l) => sum + (l.amount || 0), 0)
    );
    const totalPaid = roundCurrency(
      approvedLoans.reduce((sum, l) => sum + getLoanPaidAmount(l), 0)
    );
    const totalRemaining = roundCurrency(
      approvedLoans.reduce((sum, l) => sum + getLoanRemainingAmount(l), 0)
    );
    const pendingRequestsCount = loanRepaymentRequests.filter(
      (r) => r.posId === currentPos.id && r.status === 'pending'
    ).length;

    const counts = {
      all: clientLoans.length,
      unpaid: approvedLoans.filter((l) => getLoanRepaymentState(l) === 'unpaid').length,
      partial: approvedLoans.filter((l) => getLoanRepaymentState(l) === 'partial').length,
      repaid: approvedLoans.filter((l) => getLoanRepaymentState(l) === 'repaid').length,
      pending: clientLoans.filter((l) => l.status === 'pending').length,
      rejected: clientLoans.filter((l) => l.status === 'rejected').length,
    };

    return { totalApproved, totalPaid, totalRemaining, pendingRequestsCount, counts };
  }, [clientLoans, loanRepaymentRequests, currentPos.id]);

  const selectedLoan = useMemo(
    () => clientLoans.find((l) => l.id === selectedLoanId) || null,
    [clientLoans, selectedLoanId]
  );

  const openLoanDetails = (loan: DepositRequest) => {
    const remaining = getLoanRemainingAmount(loan);
    const loanSup = suppliers.find((s) => s.id === loan.supplierId) || supplier;
    const accounts = getActiveBankAccountsForDeposit(supplierBankAccounts, loanSup);
    setSelectedLoanId(loan.id);
    setSelectedBankAccountId(accounts[0]?.id || '');
    setRepayAmountInput(remaining > 0 ? String(convertFromSar(remaining)) : '');
    setRepayMethod(currentPos.walletBalance >= remaining && remaining > 0 ? 'wallet' : 'wallet');
    setTransferNumber('');
    setTransferNumberError(null);
    setSenderName(currentPos.ownerName || '');
    setBankName('مصرف الراجحي');
    setRepayNotes('');
    setTransferReceiptImage(null);
    setReceiptFileName('');
    setReceiptFileSizeKb(0);
    setReceiptImageError(null);
  };

  useEffect(() => {
    if (!selectedLoan) return;
    const remaining = getLoanRemainingAmount(selectedLoan);
    setRepayAmountInput(remaining > 0 ? String(convertFromSar(remaining)) : '');
  }, [activeCurrency, activeExchangeRate]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeLoanDetails = () => {
    setSelectedLoanId(null);
  };

  const getLoanSupplier = (loan: DepositRequest) => {
    return suppliers.find((s) => s.id === loan.supplierId) || supplier;
  };

  const getLoanPendingRepaymentRequests = (loanId: string): LoanRepaymentRequest[] => {
    return loanRepaymentRequests.filter((r) => r.loanId === loanId);
  };

  const handleCopyValue = (value: string, key: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleProcessReceiptFile = async (file: File) => {
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
      handleProcessReceiptFile(file);
    }
  };

  const handleReceiptDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessReceiptFile(file);
    }
  };

  const handleRemoveReceipt = () => {
    setTransferReceiptImage(null);
    setReceiptFileName('');
    setReceiptFileSizeKb(0);
    setReceiptImageError(null);
  };

  const handleWalletRepaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const remaining = getLoanRemainingAmount(selectedLoan);
      const rawDisplayAmount = Number(repayAmountInput) || 0;
      const isFullRemaining =
        activeCurrency === 'USD' &&
        remaining > 0 &&
        Math.abs(rawDisplayAmount - convertFromSar(remaining)) < 0.005;
      const amount = isFullRemaining ? remaining : convertToSar(rawDisplayAmount);
      const res = await payLoanFromWallet(selectedLoan.id, amount);
      if (res.success && res.receipt) {
        setBankTransferReceipt(null);
        setWalletRepayReceipt(res.receipt);
        closeLoanDetails();
        requestAnimationFrame(() => {
          topBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBankTransferRepaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan || isSubmitting) return;

    let hasError = false;
    if (!transferNumber.trim()) {
      setTransferNumberError('رقم الحوالة البنكية إلزامي');
      hasError = true;
    } else {
      setTransferNumberError(null);
    }

    const receiptValidation = validateReceiptImage(transferReceiptImage);
    if (!receiptValidation.isValid) {
      setReceiptImageError(
        receiptValidation.error || 'صورة إيصال الحوالة إلزامية لتأكيد طلب سداد السلفة.'
      );
      hasError = true;
    } else {
      setReceiptImageError(null);
    }

    if (!senderName.trim()) {
      hasError = true;
    }

    if (hasError) return;

    const loanSup = getLoanSupplier(selectedLoan);
    const loanBankAccounts = getActiveBankAccountsForDeposit(supplierBankAccounts, loanSup);
    const chosenAccount =
      loanBankAccounts.find((a) => a.id === selectedBankAccountId) || loanBankAccounts[0];

    setIsSubmitting(true);
    try {
      const remaining = getLoanRemainingAmount(selectedLoan);
      const rawDisplayAmount = Number(repayAmountInput) || 0;
      const isFullRemaining =
        activeCurrency === 'USD' &&
        remaining > 0 &&
        Math.abs(rawDisplayAmount - convertFromSar(remaining)) < 0.005;
      const amount = isFullRemaining ? remaining : convertToSar(rawDisplayAmount);
      const res = await submitLoanRepaymentRequest({
        loanId: selectedLoan.id,
        amount,
        transferNumber: transferNumber.trim(),
        bankName,
        senderName: senderName.trim(),
        notes: repayNotes,
        targetBankAccountId: chosenAccount?.id,
        transferReceiptImage: transferReceiptImage || undefined,
        transferReceiptFileName: receiptFileName || 'repayment-receipt.jpg',
      });
      if (res.success) {
        setWalletRepayReceipt(null);
        if (res.request) {
          setBankTransferReceipt(res.request);
        }
        setTransferNumber('');
        setTransferNumberError(null);
        setRepayNotes('');
        handleRemoveReceipt();
        closeLoanDetails();
        requestAnimationFrame(() => {
          topBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStatusBadge = (loan: DepositRequest) => {
    if (loan.status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-lg">
          <Clock className="w-3 h-3" />
          <span>بانتظار موافقة المتجر</span>
        </span>
      );
    }
    if (loan.status === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-300 bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 rounded-lg">
          <XCircle className="w-3 h-3" />
          <span>طلب مرفوض</span>
        </span>
      );
    }
    const repayState = getLoanRepaymentState(loan);
    if (repayState === 'repaid') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg">
          <CheckCircle2 className="w-3 h-3" />
          <span>مسددة بالكامل</span>
        </span>
      );
    }
    if (repayState === 'partial') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-lg">
          <HandCoins className="w-3 h-3" />
          <span>مسددة جزئياً</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-2.5 py-0.5 rounded-lg">
        <AlertCircle className="w-3 h-3" />
        <span>غير مسددة</span>
      </span>
    );
  };

  return (
    <div ref={topBannerRef} className="space-y-5">
      {/* Detailed Confirmation Notice after Bank Transfer Loan Repayment Request */}
      {bankTransferReceipt && (() => {
        const expectedRemainingAfter = Math.max(
          0,
          roundCurrency(bankTransferReceipt.loanRemainingBefore - bankTransferReceipt.amount)
        );
        const isExpectedFull = expectedRemainingAfter <= 0;

        return (
          <div
            role="status"
            aria-live="polite"
            data-testid="bank-loan-repay-receipt"
            className="rounded-2xl bg-slate-900 border border-amber-500/40 p-5 space-y-4"
          >
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">
                    تم إرسال طلب سداد السلفة بالحوالة البنكية بنجاح
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    تم إرسال طلب سداد مبلغ{' '}
                    <strong className="font-mono tabular-nums text-amber-300">
                      {formatCurrency(bankTransferReceipt.amount)}
                    </strong>{' '}
                    عن السلفة{' '}
                    <strong className="font-mono text-white">#{bankTransferReceipt.loanId}</strong>{' '}
                    عبر الحوالة البنكية بنجاح، وهو الآن قيد المراجعة وبانتظار موافقة المتجر (
                    <strong className="text-white">{bankTransferReceipt.supplierName}</strong>
                    ) لاعتماد خصم المبلغ من السلفة.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const loan = clientLoans.find((l) => l.id === bankTransferReceipt.loanId);
                    if (loan) openLoanDetails(loan);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>عرض تفاصيل السلفة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBankTransferReceipt(null)}
                  className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-bold text-amber-300 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>إغلاق الرسالة</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 pt-4 border-t border-slate-800 text-xs">
              {/* 1. Request Metadata & Pending Status */}
              <div className="space-y-1.5 xl:pl-4 xl:border-l xl:border-slate-800">
                <div className="text-[11px] font-bold text-cyan-300">بيانات طلب السداد</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">رقم الطلب:</span>
                  <span className="font-mono tabular-nums font-bold text-white" dir="ltr">
                    #{bankTransferReceipt.id}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">تاريخ الإرسال:</span>
                  <span className="font-mono tabular-nums text-slate-300" dir="ltr">
                    {bankTransferReceipt.date}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">حالة الطلب:</span>
                  <span className="font-bold text-amber-300">بانتظار موافقة المتجر</span>
                </div>
              </div>

              {/* 2. Target Loan Details */}
              <div className="space-y-1.5 xl:pl-4 xl:border-l xl:border-slate-800">
                <div className="text-[11px] font-bold text-emerald-300">بيانات السلفة المطلوب سدادها</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">رقم السلفة:</span>
                  <span className="font-mono tabular-nums font-bold text-white">#{bankTransferReceipt.loanId}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">مرجع السلفة:</span>
                  <span className="font-mono text-slate-200">{bankTransferReceipt.loanTransferNumber}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">الإجمالي · المتبقي الحالي:</span>
                  <span className="font-mono tabular-nums text-slate-200">
                    {formatCurrency(bankTransferReceipt.loanTotalAmount, { includeSymbol: false })} ·{' '}
                    <strong className="text-amber-300">
                      {formatCurrency(bankTransferReceipt.loanRemainingBefore)}
                    </strong>
                  </span>
                </div>
              </div>

              {/* 3. Bank Transfer Info */}
              <div className="space-y-1.5 xl:pl-4 xl:border-l xl:border-slate-800">
                <div className="text-[11px] font-bold text-amber-300">بيانات الحوالة البنكية المرسلة</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">رقم الحوالة:</span>
                  <span className="font-mono tabular-nums font-bold text-white" dir="ltr">
                    {bankTransferReceipt.transferNumber}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">المبلغ المحوّل:</span>
                  <span className="font-mono tabular-nums font-bold text-amber-300">
                    {formatCurrency(bankTransferReceipt.amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">البنك · المحوّل:</span>
                  <span className="text-slate-200 truncate">
                    {bankTransferReceipt.bankName} · {bankTransferReceipt.senderName}
                  </span>
                </div>
              </div>

              {/* 4. Supplier Review & Expected Outcome */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-200">مراجعة المتجر والأثر المتوقع</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">المتجر المراجع:</span>
                  <span className="font-semibold text-white truncate">{bankTransferReceipt.supplierName}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">نوع السداد بعد الموافقة:</span>
                  <span className={`font-bold ${isExpectedFull ? 'text-emerald-400' : 'text-amber-300'}`}>
                    {isExpectedFull ? 'سداد كامل للسلفة' : 'سداد جزئي من السلفة'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">المتبقي المتوقع بعد الاعتماد:</span>
                  <span className="font-mono tabular-nums font-bold text-slate-200">
                    {formatCurrency(expectedRemainingAfter)}
                  </span>
                </div>
              </div>
            </div>

            {bankTransferReceipt.targetBankName && (
              <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                <div>
                  <span className="text-slate-400">الحساب المخوّل المحوّل إليه: </span>
                  <strong className="text-amber-300">{bankTransferReceipt.targetBankName}</strong>
                  {bankTransferReceipt.receiverPosName && (
                    <span className="text-emerald-300 mr-2">
                      · مخوّل الاستلام: <strong>{bankTransferReceipt.receiverPosName}</strong>
                    </span>
                  )}
                </div>
                {bankTransferReceipt.transferReceiptImage && (
                  <button
                    type="button"
                    onClick={() =>
                      setViewingReceiptInfo({
                        imageUrl: bankTransferReceipt.transferReceiptImage!,
                        title: `إيصال سداد السلفة - طلب #${bankTransferReceipt.id}`,
                        transferNumber: bankTransferReceipt.transferNumber,
                        amount: bankTransferReceipt.amount,
                        senderName: bankTransferReceipt.senderName,
                        bankName: bankTransferReceipt.bankName,
                        date: bankTransferReceipt.date,
                        posName: bankTransferReceipt.posName,
                        posCode: bankTransferReceipt.posCode,
                      })
                    }
                    className="px-3 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>عرض صورة الإيصال المرفقة</span>
                  </button>
                )}
              </div>
            )}

            {bankTransferReceipt.notes && (
              <div className="pt-2 border-t border-slate-800/80 text-xs text-slate-300">
                <span className="text-slate-400">ملاحظاتك المرفقة للمتجر: </span>
                <span className="text-white">{bankTransferReceipt.notes}</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Detailed Confirmation Notice after Wallet Loan Repayment */}
      {walletRepayReceipt && (
        <div
          role="status"
          aria-live="polite"
          data-testid="wallet-loan-repay-receipt"
          className="rounded-2xl bg-slate-900 border border-emerald-500/40 p-5 space-y-4"
        >
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  {walletRepayReceipt.newState === 'repaid'
                    ? 'تم سداد السلفة بالكامل بنجاح عن طريق المحفظة'
                    : 'تم سداد الدفعة من السلفة بنجاح عن طريق المحفظة'}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  تم سداد مبلغ{' '}
                  <strong className="font-mono tabular-nums text-emerald-300">
                    {formatCurrency(walletRepayReceipt.amountPaid)}
                  </strong>{' '}
                  بنجاح، وتم خصم المبلغ المحدد من محفظة العميل ({walletRepayReceipt.clientName}) وإضافته فوراً إلى محفظة المتجر ({walletRepayReceipt.supplierName}).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const loan = clientLoans.find((l) => l.id === walletRepayReceipt.loanId);
                  if (loan) openLoanDetails(loan);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>عرض تفاصيل السلفة</span>
              </button>
              <button
                type="button"
                onClick={() => setWalletRepayReceipt(null)}
                className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-bold text-emerald-300 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                <span>إغلاق الرسالة</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 pt-4 border-t border-slate-800 text-xs">
            {/* 1. Loan & Payment Metadata */}
            <div className="space-y-1.5 xl:pl-4 xl:border-l xl:border-slate-800">
              <div className="text-[11px] font-bold text-cyan-300">بيانات السلفة والدفعة</div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">رقم السلفة:</span>
                <span className="font-mono tabular-nums font-bold text-white">#{walletRepayReceipt.loanId}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">مرجع السلفة:</span>
                <span className="font-mono text-slate-200">{walletRepayReceipt.loanTransferNumber}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">رقم الدفعة:</span>
                <span className="font-mono tabular-nums text-slate-300" dir="ltr">
                  {walletRepayReceipt.paymentId}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">تاريخ السداد:</span>
                <span className="font-mono tabular-nums text-slate-300" dir="ltr">
                  {walletRepayReceipt.date}
                </span>
              </div>
            </div>

            {/* 2. Client Wallet Deduction */}
            <div className="space-y-1.5 xl:pl-4 xl:border-l xl:border-slate-800">
              <div className="text-[11px] font-bold text-rose-300">الخصم من محفظة العميل</div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">العميل:</span>
                <span className="font-semibold text-white truncate">
                  {walletRepayReceipt.clientName} ({walletRepayReceipt.clientPosCode})
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">المبلغ المخصوم:</span>
                <span className="font-mono tabular-nums font-bold text-rose-400">
                  {formatCurrency(walletRepayReceipt.amountPaid, { sign: 'debit' })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">رصيد المحفظة:</span>
                <span className="font-mono tabular-nums text-slate-200">
                  {formatCurrency(walletRepayReceipt.clientBalanceBefore, { includeSymbol: false })} ←{' '}
                  <strong className="text-white">{formatCurrency(walletRepayReceipt.clientBalanceAfter)}</strong>
                </span>
              </div>
            </div>

            {/* 3. Supplier Wallet Credit */}
            <div className="space-y-1.5 xl:pl-4 xl:border-l xl:border-slate-800">
              <div className="text-[11px] font-bold text-emerald-300">الإضافة إلى محفظة المتجر</div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">المتجر:</span>
                <span className="font-semibold text-white truncate">{walletRepayReceipt.supplierName}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">المبلغ المضاف:</span>
                <span className="font-mono tabular-nums font-bold text-emerald-400">
                  {formatCurrency(walletRepayReceipt.amountPaid, { sign: 'credit' })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">محفظة المتجر:</span>
                <span className="font-mono tabular-nums text-slate-200">
                  {formatCurrency(walletRepayReceipt.supplierBalanceBefore, { includeSymbol: false })} ←{' '}
                  <strong className="text-emerald-300">{formatCurrency(walletRepayReceipt.supplierBalanceAfter)}</strong>
                </span>
              </div>
            </div>

            {/* 4. Loan Settlement Summary */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-amber-300">ملخص السلفة بعد السداد</div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">إجمالي السلفة · المسدد:</span>
                <span className="font-mono tabular-nums text-slate-200">
                  {formatCurrency(walletRepayReceipt.totalLoanAmount, { includeSymbol: false })} ·{' '}
                  <strong className="text-emerald-400">{formatCurrency(walletRepayReceipt.paidAfter)}</strong>
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">المتبقي غير المسدد:</span>
                <span className="font-mono tabular-nums font-bold text-amber-300">
                  {formatCurrency(walletRepayReceipt.remainingAfter)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">حالة السلفة:</span>
                <span
                  className={`font-bold ${
                    walletRepayReceipt.newState === 'repaid' ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  {walletRepayReceipt.newState === 'repaid' ? 'مسددة بالكامل' : 'مسددة جزئياً'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header & KPI Strip */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <HandCoins className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">إدارة السلف وسداد المستحقات</h2>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                استعرض جميع السلف، وابحث برقم السلفة أو التاريخ، وتابع الدفعات المسددة والمتبقي مع إمكانية السداد المباشر من المحفظة أو عبر طلب حوالة بنكية.
              </p>
            </div>
          </div>

          {onOpenNewLoan && (
            <button
              type="button"
              onClick={onOpenNewLoan}
              className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>طلب سلفة جديدة</span>
            </button>
          )}
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-slate-800">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[11px] text-slate-400 block">إجمالي السلف المعتمدة</span>
            <div className="text-xl font-bold font-mono text-white tabular-nums mt-1">
              {formatCurrency(stats.totalApproved, { includeSymbol: false, withGrouping: true })}{' '}
              <span className="text-xs font-sans text-slate-400">{currencyLabel}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/25">
            <span className="text-[11px] text-emerald-300 block">إجمالي المبالغ المسددة</span>
            <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums mt-1">
              {formatCurrency(stats.totalPaid, { includeSymbol: false, withGrouping: true })}{' '}
              <span className="text-xs font-sans text-slate-400">{currencyLabel}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-500/25">
            <span className="text-[11px] text-amber-300 block">المتبقي غير المسدد</span>
            <div className="text-xl font-bold font-mono text-amber-400 tabular-nums mt-1">
              {formatCurrency(stats.totalRemaining, { includeSymbol: false, withGrouping: true })}{' '}
              <span className="text-xs font-sans text-slate-400">{currencyLabel}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-cyan-500/25">
            <span className="text-[11px] text-cyan-300 block">طلبات سداد قيد المراجعة</span>
            <div className="text-xl font-bold font-mono text-cyan-400 tabular-nums mt-1">
              {stats.pendingRequestsCount}{' '}
              <span className="text-xs font-sans text-slate-400">طلب حوالة</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="relative md:col-span-8">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم السلفة (مثال: dep-loan-104 أو LOAN-ADVANCE-8812) أو التاريخ أو السبب..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-10 pl-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="relative md:col-span-4 flex items-center gap-2">
            <div className="relative flex-1">
              <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                aria-label="بحث بالتاريخ"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
            {(dateFilter || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setDateFilter('');
                  setSearchQuery('');
                }}
                className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold whitespace-nowrap shrink-0"
              >
                مسح
              </button>
            )}
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1">
          {[
            { id: 'all' as const, label: `الكل (${stats.counts.all})` },
            { id: 'unpaid' as const, label: `غير مسددة (${stats.counts.unpaid})` },
            { id: 'partial' as const, label: `مسددة جزئياً (${stats.counts.partial})` },
            { id: 'repaid' as const, label: `مسددة بالكامل (${stats.counts.repaid})` },
            { id: 'pending' as const, label: `معلقة (${stats.counts.pending})` },
            { id: 'rejected' as const, label: `مرفوضة (${stats.counts.rejected})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-colors whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loans List */}
      {filteredLoans.length === 0 ? (
        <div className="p-10 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <HandCoins className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">لا توجد سلف مطابقة لبحثك</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {clientLoans.length === 0
              ? 'لم تقم بطلب أي سلفة حتى الآن. يمكنك طلب سلفة جديدة وسيتم عرض جميع تفاصيلها ودفعاتها هنا.'
              : 'جرب تعديل رقم السلفة أو تاريخ البحث أو تغيير فلتر الحالة.'}
          </p>
          {onOpenNewLoan && clientLoans.length === 0 && (
            <button
              type="button"
              onClick={onOpenNewLoan}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>طلب سلفة جديدة</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLoans.map((loan) => {
            const paid = getLoanPaidAmount(loan);
            const remaining = getLoanRemainingAmount(loan);
            const pct = loan.amount > 0 ? Math.min(100, Math.round((paid / loan.amount) * 100)) : 0;
            const loanSup = getLoanSupplier(loan);
            const pendingReqs = loanRepaymentRequests.filter(
              (r) => r.loanId === loan.id && r.status === 'pending'
            );
            const paymentsCount = getLoanRepaymentsList(loan).length;

            return (
              <div
                key={loan.id}
                className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors space-y-3.5"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-cyan-300 bg-slate-950 border border-slate-800 px-2.5 py-0.5 rounded-lg">
                        #{loan.id}
                      </span>
                      <span className="font-mono text-xs text-amber-300">
                        {loan.transferNumber}
                      </span>
                      {renderStatusBadge(loan)}
                      {pendingReqs.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-200 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-lg">
                          <Clock className="w-3 h-3" />
                          <span>{pendingReqs.length} طلب سداد بحوالة قيد المراجعة</span>
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-300 font-medium">
                      {loan.loanReason || loan.notes || 'سلفة رصيد آجل'}
                    </div>

                    <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-3">
                      <span>
                        التاريخ: <strong className="font-mono text-slate-200">{loan.date}</strong>
                      </span>
                      <span>·</span>
                      <span>
                        المتجر: <strong className="text-slate-200">{loanSup.name}</strong>
                      </span>
                      <span>·</span>
                      <span>
                        الدفعات المسددة: <strong className="font-mono text-emerald-400">{paymentsCount}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Amounts + Primary CTA */}
                  <div className="flex flex-wrap items-center justify-between md:justify-end gap-4 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                    <div className="grid grid-cols-3 gap-3 text-right">
                      <div>
                        <span className="text-[10px] text-slate-400 block">إجمالي السلفة</span>
                        <span className="font-mono text-sm font-bold text-white tabular-nums">
                          {formatCurrency(loan.amount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-400 block">المسدد</span>
                        <span className="font-mono text-sm font-bold text-emerald-400 tabular-nums">
                          {formatCurrency(paid)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-amber-400 block">المتبقي</span>
                        <span className="font-mono text-sm font-bold text-amber-400 tabular-nums">
                          {formatCurrency(remaining)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openLoanDetails(loan)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                        loan.status === 'approved' && remaining > 0
                          ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                          : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>
                        {loan.status === 'approved' && remaining > 0
                          ? 'التفاصيل وسداد السلفة'
                          : 'عرض التفاصيل والدفعات'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Repayment Progress Bar for approved loans */}
                {loan.status === 'approved' && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>نسبة السداد</span>
                      <span className="font-mono font-bold text-slate-200 tabular-nums">{pct}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-700'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Loan Detail & Repayment Modal */}
      {selectedLoan && (() => {
        const loanSup = getLoanSupplier(selectedLoan);
        const paid = getLoanPaidAmount(selectedLoan);
        const remaining = getLoanRemainingAmount(selectedLoan);
        const repayState = getLoanRepaymentState(selectedLoan);
        const payments = getLoanRepaymentsList(selectedLoan);
        const loanRequests = getLoanPendingRepaymentRequests(selectedLoan.id);
        const canRepay = selectedLoan.status === 'approved' && remaining > 0;
        const rawDisplayAmount = Number(repayAmountInput) || 0;
        const remainingInDisplay = convertFromSar(remaining);
        const isFullRemaining =
          activeCurrency === 'USD' &&
          remaining > 0 &&
          Math.abs(rawDisplayAmount - remainingInDisplay) < 0.005;
        const parsedAmount = isFullRemaining ? remaining : convertToSar(rawDisplayAmount);
        const walletInsufficient =
          repayMethod === 'wallet' && parsedAmount > 0 && currentPos.walletBalance < parsedAmount;
        const exceedsRemaining = !isFullRemaining && parsedAmount > remaining;
        const remainingAfterPreview = Math.max(0, roundCurrency(remaining - parsedAmount));

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 text-slate-100">
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <HandCoins className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base text-white">تفاصيل السلفة وسجل الدفعات</h3>
                      <span className="font-mono text-xs text-cyan-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        #{selectedLoan.id}
                      </span>
                      {renderStatusBadge(selectedLoan)}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      المرجع: <span className="font-mono text-amber-300">{selectedLoan.transferNumber}</span> · المتجر: <span className="text-slate-200">{loanSup.name} ({loanSup.storeName})</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeLoanDetails}
                  title="إغلاق"
                  aria-label="إغلاق تفاصيل السلفة"
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-5 max-h-[82vh] overflow-y-auto">
                {/* Full Loan Metadata */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">رقم السلفة</span>
                      <strong className="font-mono text-white">{selectedLoan.id}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">تاريخ السلفة</span>
                      <strong className="font-mono text-white">{selectedLoan.date}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">حالة السداد</span>
                      <strong className="text-white">
                        {selectedLoan.status === 'pending'
                          ? 'معلقة بانتظار الموافقة'
                          : selectedLoan.status === 'rejected'
                          ? 'مرفوضة'
                          : repayState === 'repaid'
                          ? 'مسددة بالكامل'
                          : repayState === 'partial'
                          ? 'مسددة جزئياً'
                          : 'غير مسددة'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">تاريخ الإغلاق</span>
                      <strong className="font-mono text-emerald-400">
                        {selectedLoan.repaidAt || '—'}
                      </strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">إجمالي مبلغ السلفة</span>
                      <div className="text-base font-bold font-mono text-white tabular-nums mt-0.5">
                        {formatCurrency(selectedLoan.amount)}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/25">
                      <span className="text-[10px] text-emerald-400 block">المبلغ المسدد</span>
                      <div className="text-base font-bold font-mono text-emerald-400 tabular-nums mt-0.5">
                        {formatCurrency(paid)}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/25">
                      <span className="text-[10px] text-amber-400 block">المتبقي لم يُسدد</span>
                      <div className="text-base font-bold font-mono text-amber-400 tabular-nums mt-0.5">
                        {formatCurrency(remaining)}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-300 pt-2 border-t border-slate-800/80 space-y-1">
                    <div>
                      <span className="text-slate-400">سبب السلفة: </span>
                      <strong className="text-white">{selectedLoan.loanReason || '—'}</strong>
                    </div>
                    {selectedLoan.notes && (
                      <div>
                        <span className="text-slate-400">ملاحظات: </span>
                        <span className="text-slate-300">{selectedLoan.notes}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Paid Installments / Repayments History */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-white flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-emerald-400" />
                      <span>الدفعات المسددة ({payments.length})</span>
                    </h4>
                    <span className="text-[11px] font-mono text-emerald-400">
                      إجمالي المسدد: {formatCurrency(paid)}
                    </span>
                  </div>

                  {payments.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
                      لم يتم سداد أي دفعات لهذه السلفة حتى الآن.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {payments.map((pay) => (
                        <div
                          key={pay.id}
                          className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-emerald-400 font-bold">
                                {formatCurrency(pay.amount, { sign: 'credit' })}
                              </span>
                              <span className="text-slate-300 font-semibold">
                                {pay.method === 'wallet'
                                  ? 'خصم مباشر من المحفظة'
                                  : `حوالة بنكية${pay.transferNumber ? ` (${pay.transferNumber})` : ''}`}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {pay.notes || 'دفعة مسددة ومعتمدة'}
                              {pay.bankName ? ` · ${pay.bankName}` : ''}
                            </div>
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 shrink-0">
                            {pay.date}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bank Transfer Repayment Requests linked to this Loan */}
                {loanRequests.length > 0 && (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <h4 className="font-bold text-sm text-white flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-amber-400" />
                      <span>طلبات سداد السلفة عبر الحوالة البنكية ({loanRequests.length})</span>
                    </h4>
                    <div className="space-y-2">
                      {loanRequests.map((req) => (
                        <div
                          key={req.id}
                          className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-amber-300">
                                حوالة: {req.transferNumber}
                              </span>
                              <span className="font-mono text-white font-bold">
                                {formatCurrency(req.amount)}
                              </span>
                              {req.status === 'pending' && (
                                <span className="text-[11px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded">
                                  بانتظار مراجعة المتجر
                                </span>
                              )}
                              {req.status === 'approved' && (
                                <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded">
                                  تمت الموافقة وخصم {formatCurrency(req.approvedAmount ?? req.amount)}
                                </span>
                              )}
                              {req.status === 'rejected' && (
                                <span className="text-[11px] font-bold text-rose-300 bg-rose-500/15 px-2 py-0.5 rounded">
                                  مرفوض
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span>
                                البنك المحول منه: {req.bankName} · المحول: {req.senderName}
                              </span>
                              {req.targetBankName && (
                                <span className="text-amber-300">
                                  · المحول إليه: {req.targetBankName}
                                  {req.receiverPosName ? ` (${req.receiverPosName})` : ''}
                                </span>
                              )}
                              {req.receiverConfirmationStatus === 'confirmed' && (
                                <span className="text-emerald-400 font-semibold">
                                  · أكد المخوّل استلام الحوالة ✓
                                </span>
                              )}
                              {req.receiverConfirmationStatus === 'rejected' && (
                                <span className="text-rose-400 font-semibold">
                                  · أفاد المخوّل بعدم الاستلام
                                </span>
                              )}
                              {req.rejectionReason ? ` · السبب: ${req.rejectionReason}` : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {req.transferReceiptImage && (
                              <button
                                type="button"
                                onClick={() =>
                                  setViewingReceiptInfo({
                                    imageUrl: req.transferReceiptImage!,
                                    title: `إيصال سداد السلفة - طلب #${req.id}`,
                                    transferNumber: req.transferNumber,
                                    amount: req.amount,
                                    senderName: req.senderName,
                                    bankName: req.bankName,
                                    date: req.date,
                                    posName: req.posName,
                                    posCode: req.posCode,
                                  })
                                }
                                className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>الإيصال</span>
                              </button>
                            )}
                            <div className="text-[11px] font-mono text-slate-400">
                              {req.date}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Repayment Section (Wallet Direct OR Bank Transfer Request) */}
                {canRepay && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-cyan-500/30 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-white">سداد السلفة (كاملة أو جزء منها)</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          اختر سداد المتبقي بالكامل أو إدخال مبلغ جزئي، ثم اختر طريقة السداد المناسبة.
                        </p>
                      </div>
                      <div className="text-xs font-mono text-amber-300 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
                        المتبقي للسداد: <strong>{formatCurrency(remaining)}</strong>
                      </div>
                    </div>

                    {/* Amount Picker (Full vs Partial) */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-6 space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-300">
                          المبلغ المراد سداده ({currencyLabel}):
                        </label>
                        <input
                          type="number"
                          min="0.01"
                          max={remainingInDisplay}
                          step="0.01"
                          value={repayAmountInput}
                          onChange={(e) => setRepayAmountInput(e.target.value)}
                          placeholder={remainingInDisplay.toFixed(2)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold font-mono text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div className="sm:col-span-6 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setRepayAmountInput(String(remainingInDisplay))}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-emerald-300 transition-colors whitespace-nowrap"
                        >
                          سداد كامل المتبقي ({formatCurrency(remaining)})
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setRepayAmountInput(String(roundCurrency(Math.max(0.01, remainingInDisplay / 2))))
                          }
                          className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-amber-300 transition-colors whitespace-nowrap"
                        >
                          سداد جزئي (50%)
                        </button>
                      </div>
                    </div>

                    {parsedAmount > 0 && !exceedsRemaining && (
                      <div className="text-[11px] text-slate-300 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl flex flex-wrap items-center justify-between gap-2">
                        <span>
                          نوع السداد:{' '}
                          <strong className={remainingAfterPreview === 0 ? 'text-emerald-400' : 'text-amber-400'}>
                            {remainingAfterPreview === 0 ? 'سداد كامل للسلفة' : 'سداد جزئي من السلفة'}
                          </strong>
                        </span>
                        <span className="font-mono">
                          المتبقي بعد السداد: <strong>{formatCurrency(remainingAfterPreview)}</strong>
                        </span>
                      </div>
                    )}

                    {exceedsRemaining && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>
                          المبلغ المدخل ({formatCurrency(parsedAmount)}) يتجاوز المتبقي من السلفة ({formatCurrency(remaining)}).
                        </span>
                      </div>
                    )}

                    {/* Payment Method Selector */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setRepayMethod('wallet')}
                        className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-colors border ${
                          repayMethod === 'wallet'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                        }`}
                      >
                        <Wallet className="w-4 h-4" />
                        <span>1. سداد مباشر من محفظة العميل</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRepayMethod('bank_transfer')}
                        className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-colors border ${
                          repayMethod === 'bank_transfer'
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                        }`}
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>2. طلب سداد سلفة عبر حوالة بنكية</span>
                      </button>
                    </div>

                    {/* Method 1 Form: Direct Wallet Deduction */}
                    {repayMethod === 'wallet' && (
                      <form onSubmit={handleWalletRepaySubmit} className="space-y-3 pt-1">
                        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[11px]">رصيد محفظتك المتاح حالياً:</span>
                            <strong
                              className={`text-base font-mono tabular-nums ${
                                walletInsufficient ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                            >
                              {formatCurrency(currentPos.walletBalance)}
                            </strong>
                          </div>
                          <div className="text-[11px] text-slate-300">
                            سيُخصم المبلغ مباشرة من محفظتك ويُضاف إلى حافظة المتجر{' '}
                            <strong className="text-white">{loanSup.name}</strong>
                          </div>
                        </div>

                        {walletInsufficient && (
                          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 space-y-2">
                            <div className="flex items-center gap-2 font-bold text-rose-300">
                              <AlertCircle className="w-4 h-4 shrink-0" />
                              <span>الرصيد غير كافٍ في المحفظة لإتمام هذا السداد!</span>
                            </div>
                            <p className="text-[11px] text-rose-200/90">
                              رصيدك الحالي ({formatCurrency(currentPos.walletBalance)}) أقل من المبلغ المطلوب ({formatCurrency(parsedAmount)}). يمكنك سداد مبلغ أقل يتوافق مع رصيدك أو إعادة شحن المحفظة أو إرسال طلب سداد عبر حوالة بنكية.
                            </p>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {onOpenRechargeWallet && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    closeLoanDetails();
                                    onOpenRechargeWallet();
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-rose-500 text-white text-[11px] font-bold hover:bg-rose-400"
                                >
                                  إعادة شحن المحفظة
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setRepayMethod('bank_transfer')}
                                className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-[11px] font-bold hover:bg-amber-400"
                              >
                                التحويل إلى طلب سداد بحوالة بنكية
                              </button>
                            </div>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={
                            isSubmitting ||
                            parsedAmount <= 0 ||
                            exceedsRemaining ||
                            walletInsufficient
                          }
                          className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                        >
                          <Wallet className="w-4 h-4" />
                          <span>
                            تأكيد الخصم المباشر من المحفظة ({parsedAmount > 0 ? formatCurrency(parsedAmount) : formatCurrency(0)})
                          </span>
                        </button>
                      </form>
                    )}

                    {/* Method 2 Form: Bank Transfer Repayment Request */}
                    {repayMethod === 'bank_transfer' && (() => {
                      const loanBankAccounts = getActiveBankAccountsForDeposit(supplierBankAccounts, loanSup);
                      const chosenAccount =
                        loanBankAccounts.find((a) => a.id === selectedBankAccountId) || loanBankAccounts[0];

                      return (
                        <form onSubmit={handleBankTransferRepaySubmit} className="space-y-3.5 pt-1">
                          {/* Target Authorized Bank Account Dropdown Selector + Horizontal Compact Card */}
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <label className="block font-bold text-xs sm:text-sm text-white flex items-center gap-1.5">
                                <Landmark className="w-4 h-4 text-amber-400" />
                                <span>اختر البنك والحساب المخوّل المحوّل إليه لسداد السلفة:</span>
                              </label>
                              <span className="text-[10px] text-amber-400/90 font-mono">
                                {loanBankAccounts.length} حسابات مخولة
                              </span>
                            </div>

                            <div>
                              <select
                                value={chosenAccount?.id || ''}
                                onChange={(e) => setSelectedBankAccountId(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
                              >
                                {loanBankAccounts.map((acc) => (
                                  <option key={acc.id} value={acc.id}>
                                    {acc.bankName} — رقم الحساب: {acc.accountNumber || acc.iban} — {acc.accountHolderName} ({acc.country}) {acc.canReceiveSupplierTransfers ? ' [مخوّل باستلام الحوالات]' : ' [معتمد]'}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Horizontal Compact Interactive Card for the Selected Bank */}
                            {chosenAccount && (
                              <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-900 border border-amber-500/40 shadow-sm space-y-2.5">
                                {/* Top Row */}
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                                      <Landmark className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="flex items-baseline gap-1.5 min-w-0 truncate">
                                      <span className="font-bold text-white text-xs sm:text-sm">
                                        {chosenAccount.bankName}
                                      </span>
                                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                        <Globe className="w-3 h-3 text-slate-500 shrink-0" />
                                        <span>{chosenAccount.country}</span>
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 text-[11px] shrink-0">
                                    <span className="text-slate-300">
                                      صاحب الحساب: <strong className="text-white font-medium">{chosenAccount.accountHolderName}</strong>
                                    </span>

                                    {chosenAccount.canReceiveSupplierTransfers ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] text-emerald-300 font-semibold">
                                        <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                                        <span>مخوّل لنقطة بيع ({chosenAccount.delegatedPosName || chosenAccount.accountHolderName})</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[10px] text-amber-300/90 font-medium">
                                        <Check className="w-3 h-3 text-amber-400 shrink-0" />
                                        <span>حساب معتمد للمتجر</span>
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Middle Row: Account Number & IBAN */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                  {chosenAccount.accountNumber && (
                                    <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800">
                                      <span className="text-[10px] text-slate-400 shrink-0">رقم الحساب:</span>
                                      <span className="font-mono text-xs sm:text-sm font-bold text-amber-300 tracking-wider select-all truncate" dir="ltr">
                                        {chosenAccount.accountNumber}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleCopyValue(chosenAccount.accountNumber, 'loanBankAcc')}
                                        className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                                      >
                                        {copiedKey === 'loanBankAcc' ? (
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

                                  {chosenAccount.iban && (
                                    <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800">
                                      <span className="text-[10px] text-slate-400 shrink-0">الآيبان:</span>
                                      <span className="font-mono text-[11px] sm:text-xs text-cyan-300 select-all truncate" dir="ltr">
                                        {chosenAccount.iban}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleCopyValue(chosenAccount.iban || '', 'loanBankIban')}
                                        className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                                      >
                                        {copiedKey === 'loanBankIban' ? (
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

                                {/* Bottom Line: Routing Info */}
                                <div className="text-[10.5px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                                  {chosenAccount.canReceiveSupplierTransfers ? (
                                    <>
                                      <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                      <span className="text-emerald-300/90 truncate">
                                        سيصل طلب سداد السلفة إلى المخوّل ({chosenAccount.delegatedPosName || chosenAccount.accountHolderName}) لمراجعة الإيصال وتأكيد الاستلام قبل اعتماد المتجر.
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                      <span className="text-slate-300 truncate">
                                        يُوجَّه طلب سداد السلفة مباشرة إلى المتجر ({loanSup.name}) لمطابقة الإيصال واعتماد السداد.
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Snapshot of Loan Details included in request */}
                          <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/25 text-[11px] text-slate-300 space-y-1">
                            <div className="font-bold text-cyan-300">
                              بيانات السلفة التي سيتم إرفاقها تلقائياً في طلب السداد للمتجر:
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                              <span>رقم السلفة: <strong className="font-mono text-white">{selectedLoan.id}</strong></span>
                              <span>التاريخ: <strong className="font-mono text-white">{selectedLoan.date}</strong></span>
                              <span>الإجمالي: <strong className="font-mono text-white">{formatCurrency(selectedLoan.amount)}</strong></span>
                              <span>المتبقي: <strong className="font-mono text-amber-300">{formatCurrency(remaining)}</strong></span>
                            </div>
                          </div>

                          {/* Row 1: Side-by-side Mandatory Transfer Number & Mandatory Receipt Image */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs items-start">
                            {/* Column 1: Mandatory Transfer Number */}
                            <div>
                              <label className="block font-semibold text-slate-300 mb-1">
                                رقم الحوالة البنكية <span className="text-amber-400">* (إلزامي)</span>:
                              </label>
                              <input
                                type="text"
                                required
                                value={transferNumber}
                                onChange={(e) => {
                                  setTransferNumber(e.target.value);
                                  if (transferNumberError) setTransferNumberError(null);
                                }}
                                placeholder="مثال: TRX-8820149"
                                className={`w-full bg-slate-900 border ${
                                  transferNumberError
                                    ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/30'
                                    : 'border-slate-700 focus:border-amber-500'
                                } rounded-xl px-3 py-2.5 font-mono text-white focus:outline-none transition-colors`}
                              />
                              {transferNumberError ? (
                                <span className="text-[10px] text-rose-400 mt-1 block font-medium">
                                  {transferNumberError}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 mt-1 block">
                                  رقم الإشعار أو المرجع البنكي للعملية
                                </span>
                              )}
                            </div>

                            {/* Column 2: Mandatory Transfer Receipt Image */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="block font-semibold text-slate-300">
                                  صورة الحوالة <span className="text-amber-400">* (إلزامية)</span>:
                                </label>
                                {transferReceiptImage && (
                                  <span className="text-[10px] text-emerald-400 font-medium">تم الإرفاق ✓</span>
                                )}
                              </div>

                              {!transferReceiptImage ? (
                                <div>
                                  <input
                                    type="file"
                                    id="loan-repay-receipt-input"
                                    accept="image/*"
                                    onChange={handleReceiptFileChange}
                                    className="hidden"
                                    disabled={isCompressingImage}
                                  />
                                  <label
                                    htmlFor="loan-repay-receipt-input"
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
                                        : 'border-slate-700 bg-slate-900 hover:border-amber-500/60 text-slate-300'
                                    }`}
                                  >
                                    {isCompressingImage ? (
                                      <div className="flex items-center gap-2 text-xs text-amber-300">
                                        <span className="animate-spin text-amber-400">⏳</span>
                                        <span>جاري معالجة الصورة...</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 text-xs truncate">
                                        <Upload className="w-4 h-4 text-amber-400 shrink-0" />
                                        <span className="truncate font-medium">إرفاق صورة الحوالة (إلزامي)</span>
                                      </div>
                                    )}
                                  </label>
                                  {receiptImageError ? (
                                    <span className="text-[10px] text-rose-400 mt-1 block font-medium">
                                      {receiptImageError}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 mt-1 block">
                                      صورة واضحة لإيصال التحويل البنكي
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <div className="flex items-center justify-between gap-2 p-1.5 px-2.5 rounded-xl bg-slate-900 border border-emerald-500/40">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setViewingReceiptInfo({
                                            imageUrl: transferReceiptImage,
                                            title: 'معاينة صورة إيصال سداد السلفة',
                                            transferNumber,
                                            amount: parsedAmount,
                                            senderName,
                                            bankName,
                                            posName: currentPos.tradeName,
                                            posCode: currentPos.posCode,
                                          })
                                        }
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
                                          <span>جاهز ({formatReceiptFileSize(receiptFileSizeKb)})</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setViewingReceiptInfo({
                                            imageUrl: transferReceiptImage,
                                            title: 'معاينة صورة إيصال سداد السلفة',
                                            transferNumber,
                                            amount: parsedAmount,
                                            senderName,
                                            bankName,
                                            posName: currentPos.tradeName,
                                            posCode: currentPos.posCode,
                                          })
                                        }
                                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                        title="معاينة الإيصال"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleRemoveReceipt}
                                        className="p-1 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                                        title="حذف الصورة"
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

                          {/* Row 2: Amount, Sender Name, Source Bank */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                            <div>
                              <label className="block font-semibold text-slate-300 mb-1">
                                المبلغ المحول ({currencyLabel}):
                              </label>
                              <input
                                type="number"
                                min="0.01"
                                max={remainingInDisplay}
                                step="0.01"
                                required
                                value={repayAmountInput}
                                onChange={(e) => setRepayAmountInput(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-slate-300 mb-1">
                                اسم المحوّل:
                              </label>
                              <input
                                type="text"
                                required
                                value={senderName}
                                onChange={(e) => setSenderName(e.target.value)}
                                placeholder="اسم صاحب الحساب المحول"
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-amber-500"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-slate-300 mb-1">
                                البنك المحوّل منه:
                              </label>
                              <select
                                value={bankName}
                                onChange={(e) => setBankName(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-amber-500"
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

                          <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                              ملاحظات للمتجر والمخوّل (اختياري):
                            </label>
                            <input
                              type="text"
                              value={repayNotes}
                              onChange={(e) => setRepayNotes(e.target.value)}
                              placeholder="أي تفاصيل إضافية حول الحوالة..."
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={
                              isSubmitting ||
                              isCompressingImage ||
                              parsedAmount <= 0 ||
                              exceedsRemaining
                            }
                            className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                          >
                            <span>
                              إرسال طلب سداد السلفة مع صورة الإيصال ({parsedAmount > 0 ? formatCurrency(parsedAmount) : formatCurrency(0)})
                            </span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </form>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Receipt Image Preview Modal */}
      <ReceiptImageModal
        isOpen={Boolean(viewingReceiptInfo)}
        onClose={() => setViewingReceiptInfo(null)}
        imageUrl={viewingReceiptInfo?.imageUrl}
        title={viewingReceiptInfo?.title}
        transferNumber={viewingReceiptInfo?.transferNumber}
        amount={viewingReceiptInfo?.amount}
        senderName={viewingReceiptInfo?.senderName}
        bankName={viewingReceiptInfo?.bankName}
        date={viewingReceiptInfo?.date}
        posName={viewingReceiptInfo?.posName}
        posCode={viewingReceiptInfo?.posCode}
      />
    </div>
  );
};
