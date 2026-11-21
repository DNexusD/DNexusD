import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  HandCoins,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Download,
  Zap,
  Check,
  CreditCard,
  Receipt,
  Calendar,
  Eye,
  Landmark,
  Globe,
  Image as ImageIcon,
} from 'lucide-react';
import { ReceiptImageModal } from '../common/ReceiptImageModal';
import { LoanRepaymentRequest } from '../../types';
import {
  getLoanPaidAmount,
  getLoanRemainingAmount,
  getLoanRepaymentState,
  getLoanRepaymentsList,
  isLoanDeposit,
  roundCurrency,
} from '../../utils/loanRepayments';
import { resolveEffectiveEmployeePermissions } from '../../utils/employeePermissions';

interface LoansRegistryViewProps {
  filterSupplierId?: string;
}

export const LoansRegistryView: React.FC<LoansRegistryViewProps> = ({ filterSupplierId }) => {
  const {
    depositRequests,
    loanRepaymentRequests,
    approveDepositRequest,
    rejectDepositRequest,
    markLoanAsRepaid,
    approveLoanRepaymentRequest,
    rejectLoanRepaymentRequest,
    posClients,
    suppliers,
    supplier,
    role,
    currentUser,
    showToast,
  } = useApp();

  const [viewSection, setViewSection] = useState<'repayments' | 'loans'>('loans');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending' | 'approved_unpaid' | 'partial' | 'repaid' | 'rejected'
  >('all');
  const [repaymentStatusFilter, setRepaymentStatusFilter] = useState<
    'all' | 'pending' | 'approved' | 'rejected'
  >('pending');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(filterSupplierId || 'all');
  const [customApproveAmounts, setCustomApproveAmounts] = useState<Record<string, string>>({});
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [viewingReceiptRequest, setViewingReceiptRequest] = useState<LoanRepaymentRequest | null>(null);

  const allLoans = useMemo(
    () => depositRequests.filter((d) => isLoanDeposit(d)),
    [depositRequests]
  );

  const supplierFilteredLoans = useMemo(() => {
    return allLoans.filter((l) => {
      if (selectedSupplierId !== 'all') {
        return l.supplierId === selectedSupplierId;
      }
      return true;
    });
  }, [allLoans, selectedSupplierId]);

  const supplierFilteredRepayments = useMemo(() => {
    return loanRepaymentRequests
      .filter((r) => {
        if (selectedSupplierId !== 'all') {
          return r.supplierId === selectedSupplierId;
        }
        return true;
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [loanRepaymentRequests, selectedSupplierId]);

  const pendingRepaymentsCount = supplierFilteredRepayments.filter(
    (r) => r.status === 'pending'
  ).length;

  const filteredRepayments = useMemo(() => {
    return supplierFilteredRepayments.filter((r) => {
      if (repaymentStatusFilter !== 'all' && r.status !== repaymentStatusFilter) return false;
      if (dateFilter && !(r.date || '').includes(dateFilter)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.loanId.toLowerCase().includes(q) ||
          r.loanTransferNumber.toLowerCase().includes(q) ||
          r.transferNumber.toLowerCase().includes(q) ||
          r.posName.toLowerCase().includes(q) ||
          r.posCode.toLowerCase().includes(q) ||
          r.senderName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [supplierFilteredRepayments, repaymentStatusFilter, dateFilter, searchQuery]);

  const filteredLoans = useMemo(() => {
    return supplierFilteredLoans.filter((l) => {
      const repayState = getLoanRepaymentState(l);
      if (statusFilter === 'pending' && l.status !== 'pending') return false;
      if (
        statusFilter === 'approved_unpaid' &&
        (l.status !== 'approved' || repayState === 'repaid')
      )
        return false;
      if (statusFilter === 'partial' && (l.status !== 'approved' || repayState !== 'partial'))
        return false;
      if (statusFilter === 'repaid' && (l.status !== 'approved' || repayState !== 'repaid'))
        return false;
      if (statusFilter === 'rejected' && l.status !== 'rejected') return false;

      if (dateFilter && !(l.date || '').includes(dateFilter)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const posMatch =
          l.posName.toLowerCase().includes(q) || l.posCode.toLowerCase().includes(q);
        const reasonMatch = l.loanReason ? l.loanReason.toLowerCase().includes(q) : false;
        const notesMatch = l.notes ? l.notes.toLowerCase().includes(q) : false;
        const idMatch =
          l.id.toLowerCase().includes(q) || l.transferNumber.toLowerCase().includes(q);
        return posMatch || reasonMatch || notesMatch || idMatch;
      }

      return true;
    });
  }, [supplierFilteredLoans, statusFilter, dateFilter, searchQuery]);

  // Statistics
  const pendingLoansCount = supplierFilteredLoans.filter((l) => l.status === 'pending').length;
  const approvedLoans = supplierFilteredLoans.filter((l) => l.status === 'approved');
  const totalOutstandingLoanAmount = roundCurrency(
    approvedLoans.reduce((sum, l) => sum + getLoanRemainingAmount(l), 0)
  );
  const totalRepaidAmount = roundCurrency(
    approvedLoans.reduce((sum, l) => sum + getLoanPaidAmount(l), 0)
  );
  const approvedUnpaidLoansCount = approvedLoans.filter(
    (l) => getLoanRepaymentState(l) !== 'repaid'
  ).length;
  const partialLoansCount = approvedLoans.filter(
    (l) => getLoanRepaymentState(l) === 'partial'
  ).length;
  const repaidLoansCount = approvedLoans.filter(
    (l) => getLoanRepaymentState(l) === 'repaid'
  ).length;

  const employeePerms = resolveEffectiveEmployeePermissions(currentUser, role, supplier);
  const canReviewActions =
    role === 'supplier' ||
    role === 'super_admin' ||
    (role === 'employee' && employeePerms.canReviewLoanDeposits);

  const handleExportLoansJson = () => {
    const payload = {
      loans: supplierFilteredLoans,
      repaymentRequests: supplierFilteredRepayments,
    };
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `loans_registry_${new Date().toISOString().substring(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast({
      type: 'success',
      title: 'تم تصدير سجل السُّلَف وطلبات السداد',
      description: 'تم تحميل النسخة الاحتياطية لسجل السُّلَف وطلبات السداد بصيغة JSON بنجاح.',
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-cyan-950/40 to-slate-950 border border-cyan-500/30 p-5 sm:p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
              <HandCoins className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  سجل السُّلَف ومراجعة طلبات السداد (Loans & Repayments)
                </h2>
                <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-cyan-400" />
                  <span>سداد كامل وجزئي · محفظة وحوالات بنكية</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                متابعة جميع طلبات السُّلَف والرصيد الآجل، واستعراض الدفعات المسددة والمتبقي، ومراجعة طلبات سداد السُّلَف بالحوالات البنكية للموافقة على خصم المبلغ المسدد (كاملة أو جزء منها).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportLoansJson}
              className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-cyan-600/20 whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>تصدير تقرير السُّلَف</span>
            </button>
          </div>
        </div>

        {/* KPI Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 pt-5 border-t border-slate-800/80">
          <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-500/30 space-y-1">
            <span className="text-[11px] text-cyan-300 font-semibold block">
              المتبقي غير المسدد من السلف
            </span>
            <div className="text-2xl font-bold font-mono text-cyan-400 tabular-nums">
              {totalOutstandingLoanAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
              <span className="text-xs text-slate-400 font-sans">ر.س</span>
            </div>
            <div className="text-[10px] text-slate-400 pt-0.5">
              عبر {approvedUnpaidLoansCount} سلفة قائمة أو مسددة جزئياً
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-1">
            <span className="text-[11px] text-amber-300 font-semibold block">
              طلبات سداد بالحوالة للمراجعة
            </span>
            <div className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
              {pendingRepaymentsCount}{' '}
              <span className="text-xs text-slate-400 font-sans">طلب حوالة</span>
            </div>
            <div className="text-[10px] text-slate-400 pt-0.5">
              بانتظار مطابقة الحوالة وخصمها من السلفة
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-1">
            <span className="text-[11px] text-emerald-300 font-semibold block">
              إجمالي المبالغ المحصّلة والمسددة
            </span>
            <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
              {totalRepaidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
              <span className="text-xs text-slate-400 font-sans">ر.س</span>
            </div>
            <div className="text-[10px] text-slate-400 pt-0.5">
              منها {repaidLoansCount} سلفة مغلقة و{partialLoansCount} مسددة جزئياً
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400 block">طلبات سلف جديدة معلقة</span>
            <div className="text-2xl font-bold font-mono text-purple-400 tabular-nums">
              {pendingLoansCount}{' '}
              <span className="text-xs text-slate-400 font-sans">طلب سلفة</span>
            </div>
            <div className="text-[10px] text-slate-400 pt-0.5">
              من إجمالي {posClients.length} نقطة بيع مسجلة
            </div>
          </div>
        </div>
      </div>

      {/* Section Switcher: Bank Transfer Repayment Requests vs Full Loans Registry */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setViewSection('repayments')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors border ${
            viewSection === 'repayments'
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-slate-900 text-amber-300 border-amber-500/30 hover:bg-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>طلبات سداد السلف (حوالات بنكية)</span>
          <span
            className={`px-2 py-0.5 rounded-md font-mono text-[11px] ${
              viewSection === 'repayments'
                ? 'bg-slate-950/20 text-slate-950'
                : 'bg-amber-500/20 text-amber-200'
            }`}
          >
            {pendingRepaymentsCount} معلقة
          </span>
        </button>

        <button
          type="button"
          onClick={() => setViewSection('loans')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors border ${
            viewSection === 'loans'
              ? 'bg-cyan-500 text-slate-950 border-cyan-400'
              : 'bg-slate-900 text-cyan-300 border-cyan-500/30 hover:bg-slate-800'
          }`}
        >
          <HandCoins className="w-4 h-4" />
          <span>سجل السُّلَف والدفعات ({supplierFilteredLoans.length})</span>
        </button>
      </div>

      {/* Shared Search + Date + Filter Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="relative md:col-span-6">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم السلفة، رقم الحوالة، اسم نقطة البيع، أو الكود..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="relative md:col-span-3">
            <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          {role === 'super_admin' && !filterSupplierId && (
            <div className="md:col-span-3 flex items-center gap-1.5 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full bg-transparent text-white focus:outline-none"
              >
                <option value="all">جميع المتاجر ({suppliers.length})</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.storeName})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Sub-filters per active section */}
        {viewSection === 'repayments' ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {[
              { id: 'pending' as const, label: `قيد المراجعة (${pendingRepaymentsCount})` },
              {
                id: 'approved' as const,
                label: `معتمدة (${supplierFilteredRepayments.filter((r) => r.status === 'approved').length})`,
              },
              {
                id: 'rejected' as const,
                label: `مرفوضة (${supplierFilteredRepayments.filter((r) => r.status === 'rejected').length})`,
              },
              { id: 'all' as const, label: `الكل (${supplierFilteredRepayments.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRepaymentStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                  repaymentStatusFilter === tab.id
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {[
              { id: 'all' as const, label: `الكل (${supplierFilteredLoans.length})` },
              { id: 'pending' as const, label: `معلقة (${pendingLoansCount})` },
              {
                id: 'approved_unpaid' as const,
                label: `قائمة غير مسددة بالكامل (${approvedUnpaidLoansCount})`,
              },
              { id: 'partial' as const, label: `مسددة جزئياً (${partialLoansCount})` },
              { id: 'repaid' as const, label: `مسددة بالكامل (${repaidLoansCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                  statusFilter === tab.id
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* SECTION A: BANK TRANSFER LOAN REPAYMENT REQUESTS */}
      {viewSection === 'repayments' && (
        <div className="space-y-3">
          {filteredRepayments.length === 0 ? (
            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-2">
              <CreditCard className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-300">
                لا توجد طلبات سداد سلف بالحوالات البنكية حالياً
              </h3>
              <p className="text-xs text-slate-500">
                عند إرسال العميل طلب سداد سلفة عبر حوالة بنكية سيظهر هنا بكامل بيانات السلفة والحوالة للمراجعة والموافقة.
              </p>
            </div>
          ) : (
            filteredRepayments.map((req) => {
              const targetLoan = depositRequests.find((d) => d.id === req.loanId);
              const currentRemaining = targetLoan
                ? getLoanRemainingAmount(targetLoan)
                : req.loanRemainingBefore;
              const currentPaid = targetLoan
                ? getLoanPaidAmount(targetLoan)
                : req.loanPaidBefore;

              const customStr = customApproveAmounts[req.id];
              const confirmedAmount =
                customStr !== undefined && customStr !== ''
                  ? roundCurrency(Number(customStr))
                  : req.amount;
              const effectiveDeduction = Math.min(
                currentRemaining,
                Math.max(0, confirmedAmount || 0)
              );
              const remainingAfterApproval = Math.max(
                0,
                roundCurrency(currentRemaining - effectiveDeduction)
              );

              return (
                <div
                  key={req.id}
                  className={`p-4 sm:p-5 rounded-2xl bg-slate-900 border space-y-4 ${
                    req.status === 'pending'
                      ? 'border-amber-500/40'
                      : req.status === 'approved'
                      ? 'border-emerald-500/30'
                      : 'border-rose-500/30'
                  }`}
                >
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-amber-300 bg-slate-950 border border-slate-800 px-2.5 py-0.5 rounded">
                          #{req.id}
                        </span>
                        <strong className="text-white text-sm">{req.posName}</strong>
                        <span className="font-mono text-xs text-amber-400">{req.posCode}</span>

                        {req.status === 'pending' && (
                          <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            بانتظار مراجعة الحوالة البنكية
                          </span>
                        )}
                        {req.status === 'approved' && (
                          <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            تمت الموافقة وخصم {(req.approvedAmount ?? req.amount).toFixed(2)} ر.س
                          </span>
                        )}
                        {req.status === 'rejected' && (
                          <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                            طلب مرفوض
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        تاريخ طلب السداد: <span className="font-mono text-slate-300">{req.date}</span>
                        {req.reviewedAt ? ` · تمت المراجعة: ${req.reviewedAt}` : ''}
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 px-3.5 py-2 rounded-xl text-left">
                      <span className="text-[10px] text-slate-400 block">المبلغ المحول بالطلب</span>
                      <span className="text-lg font-bold font-mono text-amber-400 tabular-nums">
                        {req.amount.toFixed(2)} ر.س
                      </span>
                    </div>
                  </div>

                  {/* Two Columns: Bank Transfer Details + Full Target Loan Snapshot */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="font-bold text-amber-300">بيانات الحوالة البنكية المرسلة</div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-400 block">رقم الحوالة البنكية:</span>
                          <strong className="font-mono text-white text-xs select-all">
                            {req.transferNumber}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">المبلغ المحول:</span>
                          <strong className="font-mono text-emerald-400 text-xs">
                            {req.amount.toFixed(2)} ر.س
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">البنك المحول منه:</span>
                          <strong className="text-slate-200">{req.bankName}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">اسم المحوّل:</span>
                          <strong className="text-slate-200">{req.senderName}</strong>
                        </div>
                      </div>
                      {req.notes && (
                        <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                          ملاحظات العميل: <span className="text-slate-200">{req.notes}</span>
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950 border border-cyan-500/25 space-y-2">
                      <div className="font-bold text-cyan-300">بيانات السلفة المطلوب سدادها</div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-400 block">رقم السلفة / المرجع:</span>
                          <strong className="font-mono text-white">
                            #{req.loanId} ({req.loanTransferNumber})
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">تاريخ السلفة:</span>
                          <strong className="font-mono text-slate-200">{req.loanDate}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">إجمالي السلفة / المسدد:</span>
                          <strong className="font-mono text-white">
                            {req.loanTotalAmount.toFixed(2)} / {currentPaid.toFixed(2)} ر.س
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">المتبقي الحالي قبل الخصم:</span>
                          <strong className="font-mono text-amber-300">
                            {currentRemaining.toFixed(2)} ر.س
                          </strong>
                        </div>
                      </div>
                      {req.loanReason && (
                        <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                          سبب السلفة: <span className="text-slate-200">{req.loanReason}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Destination Bank Account Details */}
                  {(req.targetBankName || req.targetAccountHolderName) && (
                    <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <Landmark className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-slate-400">الحساب البنكي المحوّل إليه:</span>
                        <strong className="text-amber-300">{req.targetBankName}</strong>
                        {req.targetBankAccountCountry && (
                          <>
                            <span className="text-slate-600">·</span>
                            <span className="text-slate-300 flex items-center gap-1">
                              <Globe className="w-3 h-3 text-slate-500" />
                              <span>{req.targetBankAccountCountry}</span>
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-300">
                        {req.targetAccountHolderName && (
                          <span>
                            صاحب الحساب: <strong className="text-white">{req.targetAccountHolderName}</strong>
                          </span>
                        )}
                        {req.targetAccountHolderEmail && (
                          <span className="font-mono text-slate-400">
                            <bdi dir="ltr">{req.targetAccountHolderEmail}</bdi>
                          </span>
                        )}
                        {(req.targetBankAccountNumber || req.targetIban) && (
                          <span className="font-mono text-cyan-300">
                            <bdi dir="ltr">{req.targetBankAccountNumber || req.targetIban}</bdi>
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Authorized Receiver POS Confirmation Status */}
                  {(req.receiverConfirmationStatus || req.receiverPosId) && (
                    <div
                      className={`p-3 rounded-2xl border space-y-1 text-xs ${
                        req.receiverConfirmationStatus === 'confirmed'
                          ? 'bg-emerald-950/30 border-emerald-500/40'
                          : req.receiverConfirmationStatus === 'rejected'
                          ? 'bg-rose-950/30 border-rose-500/40'
                          : 'bg-amber-950/20 border-amber-500/30'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2 font-bold">
                        {req.receiverConfirmationStatus === 'confirmed' ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="text-emerald-300">
                              تم تأكيد استلام الحوالة من نقطة البيع المخوّلة ({req.receiverConfirmedByName || req.receiverPosName})
                            </span>
                            {req.receiverConfirmedAt && (
                              <span className="font-mono text-[10px] text-emerald-200/80">
                                · {req.receiverConfirmedAt}
                              </span>
                            )}
                          </>
                        ) : req.receiverConfirmationStatus === 'rejected' ? (
                          <>
                            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            <span className="text-rose-300">
                              تنبيه: أفادت نقطة البيع المخوّلة ({req.receiverConfirmedByName || req.receiverPosName}) بعدم استلام الحوالة
                            </span>
                            {req.receiverConfirmedAt && (
                              <span className="font-mono text-[10px] text-rose-200/80">
                                · {req.receiverConfirmedAt}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                            <span className="text-amber-300">
                              بانتظار تأكيد استلام الحوالة من نقطة البيع المخوّلة ({req.receiverPosName || req.targetAccountHolderName})
                            </span>
                          </>
                        )}
                      </div>

                      {req.receiverConfirmationNote && (
                        <div className="text-[11px] text-slate-200 pr-6">
                          ملاحظة المستلم: <span className="font-semibold">{req.receiverConfirmationNote}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Attached Transfer Receipt Image Preview */}
                  {req.transferReceiptImage && (
                    <div className="flex items-center gap-3 p-2.5 px-3 rounded-2xl bg-slate-950 border border-amber-500/30 text-xs">
                      <button
                        type="button"
                        onClick={() => setViewingReceiptRequest(req)}
                        className="relative group shrink-0 cursor-pointer"
                        title="انقر لتكبير صورة الإيصال"
                      >
                        <img
                          src={req.transferReceiptImage}
                          alt="إيصال الحوالة"
                          className="w-11 h-11 rounded-xl object-cover border border-slate-700 group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="w-4 h-4 text-white" />
                        </div>
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                          <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                          <span>صورة إيصال حوالة سداد السلفة المرفقة</span>
                        </div>
                        <p className="text-[10.5px] text-slate-400 truncate">
                          {req.transferReceiptFileName || 'repayment-receipt.jpg'} · انقر على الصورة أو زر العرض للتحقق والتكبير
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setViewingReceiptRequest(req)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>عرض الإيصال</span>
                      </button>
                    </div>
                  )}

                  {/* Review & Approval Controls */}
                  {req.status === 'pending' && canReviewActions && (
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            تأكيد المبلغ المراد خصمه من السلفة (ر.س):
                          </label>
                          <input
                            type="number"
                            min="0.01"
                            max={currentRemaining}
                            step="0.01"
                            value={customStr !== undefined ? customStr : String(req.amount)}
                            onChange={(e) =>
                              setCustomApproveAmounts((prev) => ({
                                ...prev,
                                [req.id]: e.target.value,
                              }))
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-emerald-300 focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            سبب الرفض (في حال عدم مطابقة الحوالة):
                          </label>
                          <input
                            type="text"
                            value={rejectionReasons[req.id] || ''}
                            onChange={(e) =>
                              setRejectionReasons((prev) => ({
                                ...prev,
                                [req.id]: e.target.value,
                              }))
                            }
                            placeholder="اختياري: مثال لم تصل الحوالة للحساب..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
                        <div className="text-[11px] text-slate-300">
                          بعد الاعتماد: سيُخصم{' '}
                          <strong className="font-mono text-emerald-400">
                            {effectiveDeduction.toFixed(2)} ر.س
                          </strong>{' '}
                          وتصبح السلفة{' '}
                          <strong
                            className={
                              remainingAfterApproval === 0 ? 'text-emerald-400' : 'text-amber-300'
                            }
                          >
                            {remainingAfterApproval === 0
                              ? 'مسددة بالكامل'
                              : `مسددة جزئياً (المتبقي ${remainingAfterApproval.toFixed(2)} ر.س)`}
                          </strong>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              rejectLoanRepaymentRequest(req.id, rejectionReasons[req.id])
                            }
                            className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold flex items-center gap-1.5"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>رفض الطلب</span>
                          </button>

                          <button
                            type="button"
                            disabled={effectiveDeduction <= 0}
                            onClick={() =>
                              approveLoanRepaymentRequest(req.id, effectiveDeduction)
                            }
                            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold flex items-center gap-1.5 transition-colors"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>
                              موافقة وخصم {effectiveDeduction.toFixed(2)} ر.س من السلفة
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {req.status === 'rejected' && req.rejectionReason && (
                    <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 px-3 py-2 rounded-xl">
                      سبب الرفض: {req.rejectionReason}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SECTION B: ALL LOANS REGISTRY */}
      {viewSection === 'loans' && (
        <div className="space-y-3">
          {filteredLoans.length === 0 ? (
            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
              <HandCoins className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-300">
                لم يتم العثور على سجلات سُّلَف مطابقة
              </h3>
              <p className="text-xs text-slate-500">
                لا توجد طلبات سُّلَف أو رصيد آجل تطابق خيارات البحث المحددة.
              </p>
            </div>
          ) : (
            filteredLoans.map((loan) => {
              const loanSupplier = suppliers.find((s) => s.id === loan.supplierId);
              const isPending = loan.status === 'pending';
              const isApproved = loan.status === 'approved';
              const isRejected = loan.status === 'rejected';
              const repayState = getLoanRepaymentState(loan);
              const isRepaid = repayState === 'repaid';
              const isPartial = repayState === 'partial';
              const paid = getLoanPaidAmount(loan);
              const remaining = getLoanRemainingAmount(loan);
              const payments = getLoanRepaymentsList(loan);
              const pendingReqsForLoan = loanRepaymentRequests.filter(
                (r) => r.loanId === loan.id && r.status === 'pending'
              );

              return (
                <div
                  key={loan.id}
                  className={`p-4 sm:p-5 rounded-2xl bg-slate-900 border transition-all space-y-4 ${
                    isPending
                      ? 'border-amber-500/40'
                      : isRepaid
                      ? 'border-emerald-500/30'
                      : isRejected
                      ? 'border-rose-500/30'
                      : isPartial
                      ? 'border-amber-500/30'
                      : 'border-cyan-500/30'
                  }`}
                >
                  {/* Entry Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isPending
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : isRepaid
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                        }`}
                      >
                        <HandCoins className="w-5 h-5" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-sm">{loan.posName}</span>
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-amber-300 font-bold">
                            {loan.posCode}
                          </span>
                          <span className="font-mono text-xs text-cyan-300">#{loan.id}</span>

                          {isPending && (
                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>طلب سلفة معلق</span>
                            </span>
                          )}

                          {isApproved && repayState === 'unpaid' && (
                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                              <Zap className="w-3 h-3 text-cyan-400" />
                              <span>سلفة معتمدة (غير مسددة)</span>
                            </span>
                          )}

                          {isApproved && isPartial && (
                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                              <HandCoins className="w-3 h-3 text-amber-400" />
                              <span>مسددة جزئياً</span>
                            </span>
                          )}

                          {isApproved && isRepaid && (
                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>مسددة بالكامل ✓</span>
                            </span>
                          )}

                          {isRejected && (
                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                              <XCircle className="w-3 h-3 text-rose-400" />
                              <span>طلب سلفة مرفوض</span>
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                          <span>
                            المتجر:{' '}
                            <strong className="text-slate-200">
                              {loanSupplier?.name || 'جمال الصالحي'}
                            </strong>
                          </span>
                          <span>·</span>
                          <span>
                            التاريخ:{' '}
                            <strong className="font-mono text-slate-300">{loan.date}</strong>
                          </span>
                          {loan.repaidAt && (
                            <>
                              <span>·</span>
                              <span>
                                تاريخ الإغلاق:{' '}
                                <strong className="font-mono text-emerald-400">
                                  {loan.repaidAt}
                                </strong>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Loan Amounts Breakdown */}
                    <div className="grid grid-cols-3 gap-3 shrink-0 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-right">
                      <div>
                        <span className="text-[10px] text-slate-400 block">إجمالي السلفة</span>
                        <div className="text-sm font-bold font-mono text-white tabular-nums">
                          {loan.amount.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-400 block">المسدد</span>
                        <div className="text-sm font-bold font-mono text-emerald-400 tabular-nums">
                          {paid.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-amber-400 block">المتبقي</span>
                        <div className="text-sm font-bold font-mono text-amber-400 tabular-nums">
                          {remaining.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Reason & Details */}
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-2">
                    <div className="text-slate-400 font-medium flex items-center gap-1.5 flex-wrap">
                      <span className="text-cyan-400 font-bold">سبب طلب السلفة:</span>
                      <span className="text-white font-medium">
                        {loan.loanReason || loan.notes || 'طلب سلفة رصيد آجل عاجل'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-amber-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          {loan.transferNumber}
                        </span>
                        {pendingReqsForLoan.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setViewSection('repayments');
                              setRepaymentStatusFilter('pending');
                            }}
                            className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold hover:bg-amber-500/30"
                          >
                            يوجد {pendingReqsForLoan.length} طلب سداد بحوالة قيد المراجعة — اضغط للمراجعة
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Paid Installments List */}
                    {payments.length > 0 && (
                      <div className="pt-2 border-t border-slate-800 space-y-1.5">
                        <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                          <Receipt className="w-3.5 h-3.5" />
                          <span>سجل الدفعات المسددة ({payments.length}):</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {payments.map((p) => (
                            <div
                              key={p.id}
                              className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-[11px]"
                            >
                              <div>
                                <span className="font-mono font-bold text-emerald-400">
                                  +{p.amount.toFixed(2)} ر.س
                                </span>{' '}
                                <span className="text-slate-300">
                                  ({p.method === 'wallet'
                                    ? 'محفظة'
                                    : p.transferNumber
                                    ? `حوالة ${p.transferNumber}`
                                    : 'حوالة بنكية'})
                                </span>
                              </div>
                              <span className="font-mono text-slate-400">{p.date}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Bar for Supplier & Admin */}
                  {canReviewActions && (
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-800/60 text-xs">
                      {isPending && (
                        <>
                          <button
                            onClick={() => rejectDepositRequest(loan.id, 'تم رفض طلب السلفة')}
                            className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold transition-colors flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                            <span>رفض طلب السلفة</span>
                          </button>

                          <button
                            onClick={() => approveDepositRequest(loan.id)}
                            className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-colors shadow-md shadow-cyan-500/20 flex items-center gap-1.5"
                          >
                            <Check className="w-4 h-4" />
                            <span>موافقة وإصدار رصيد السلفة للمحفظة</span>
                          </button>
                        </>
                      )}

                      {isApproved && !isRepaid && (
                        <button
                          onClick={() => markLoanAsRepaid(loan.id)}
                          className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-colors shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            تسجيل سداد المتبقي بالكامل ({remaining.toFixed(2)} ر.س)
                          </span>
                        </button>
                      )}

                      {isRepaid && (
                        <span className="text-emerald-400 font-mono text-xs flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>تم تسديد السلفة بالكامل وإغلاق ملف الدين</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
      {/* Transfer Receipt Image Viewer Modal */}
      <ReceiptImageModal
        isOpen={Boolean(viewingReceiptRequest)}
        onClose={() => setViewingReceiptRequest(null)}
        imageUrl={viewingReceiptRequest?.transferReceiptImage}
        title={`إيصال حوالة سداد السلفة - طلب #${viewingReceiptRequest?.id || ''}`}
        transferNumber={viewingReceiptRequest?.transferNumber}
        amount={viewingReceiptRequest?.amount}
        senderName={viewingReceiptRequest?.senderName}
        bankName={viewingReceiptRequest?.bankName}
        date={viewingReceiptRequest?.date}
        posName={viewingReceiptRequest?.posName}
        posCode={viewingReceiptRequest?.posCode}
      />
    </div>
  );
};
