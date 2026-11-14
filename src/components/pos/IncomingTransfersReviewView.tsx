import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  getAuthorizedBankAccountsForPos,
  getIncomingLoanRepaymentsForPos,
  getIncomingTransfersForPos,
  IncomingTransferStatusFilter,
} from '../../utils/bankAccounts';
import { DepositRequest, LoanRepaymentRequest } from '../../types';
import { ReceiptImageModal } from '../common/ReceiptImageModal';
import {
  CheckCircle2,
  Clock,
  Eye,
  Globe,
  HandCoins,
  Image as ImageIcon,
  Landmark,
  Search,
  ShieldCheck,
  Store,
  XCircle,
} from 'lucide-react';

type UnifiedIncomingTransfer =
  | { kind: 'deposit'; data: DepositRequest }
  | { kind: 'loan_repayment'; data: LoanRepaymentRequest };

export const IncomingTransfersReviewView: React.FC = () => {
  const {
    currentPos,
    currentPosSupplier,
    depositRequests,
    loanRepaymentRequests,
    supplierBankAccounts,
    confirmDepositReceiptByReceiver,
    confirmLoanRepaymentReceiptByReceiver,
  } = useApp();

  const [statusFilter, setStatusFilter] = useState<IncomingTransferStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [viewingReceiptInfo, setViewingReceiptInfo] = useState<{
    imageUrl?: string;
    title: string;
    transferNumber?: string;
    amount?: number;
    senderName?: string;
    bankName?: string;
    date?: string;
    posName?: string;
    posCode?: string;
  } | null>(null);

  const authorizedAccounts = useMemo(
    () => getAuthorizedBankAccountsForPos(currentPos, supplierBankAccounts),
    [currentPos, supplierBankAccounts]
  );

  const allIncomingDeposits = useMemo(
    () => getIncomingTransfersForPos(depositRequests, currentPos, supplierBankAccounts),
    [depositRequests, currentPos, supplierBankAccounts]
  );

  const allIncomingLoanRepayments = useMemo(
    () => getIncomingLoanRepaymentsForPos(loanRepaymentRequests, currentPos, supplierBankAccounts),
    [loanRepaymentRequests, currentPos, supplierBankAccounts]
  );

  const filteredUnifiedTransfers = useMemo<UnifiedIncomingTransfer[]>(() => {
    const deposits = getIncomingTransfersForPos(depositRequests, currentPos, supplierBankAccounts, {
      statusFilter,
      query: searchQuery,
    }).map((data) => ({ kind: 'deposit' as const, data }));

    const repayments = getIncomingLoanRepaymentsForPos(
      loanRepaymentRequests,
      currentPos,
      supplierBankAccounts,
      {
        statusFilter,
        query: searchQuery,
      }
    ).map((data) => ({ kind: 'loan_repayment' as const, data }));

    return [...deposits, ...repayments].sort((a, b) =>
      (b.data.date || '').localeCompare(a.data.date || '')
    );
  }, [
    depositRequests,
    loanRepaymentRequests,
    currentPos,
    supplierBankAccounts,
    statusFilter,
    searchQuery,
  ]);

  const counts = useMemo(() => {
    const allItems = [...allIncomingDeposits, ...allIncomingLoanRepayments];
    const pending = allItems.filter(
      (item) => (item.receiverConfirmationStatus || 'pending') === 'pending'
    ).length;
    const confirmed = allItems.filter(
      (item) => item.receiverConfirmationStatus === 'confirmed'
    ).length;
    const rejected = allItems.filter(
      (item) => item.receiverConfirmationStatus === 'rejected'
    ).length;
    return {
      all: allItems.length,
      pending,
      confirmed,
      rejected,
    };
  }, [allIncomingDeposits, allIncomingLoanRepayments]);

  return (
    <div className="space-y-5">
      {/* Header Summary */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>استلام ومراجعة حوالات المورد</span>
            </h2>
            <p className="text-xs text-slate-400">
              أنت مخوّل من المورد <strong className="text-amber-400">{currentPosSupplier.storeName}</strong> باستلام ومراجعة حوالات شحن الأرصدة وطلبات سداد السلف التي يحدد العملاء أن الإيداع تم إلى حسابك.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono tabular-nums shrink-0">
            <div className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">بانتظار التأكيد</span>
              <span className="text-base font-bold text-amber-400">{counts.pending}</span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">تم الاستلام</span>
              <span className="text-base font-bold text-emerald-400">{counts.confirmed}</span>
            </div>
          </div>
        </div>

        {/* Authorized Accounts Summary */}
        {authorizedAccounts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/80 text-xs">
            {authorizedAccounts.map((acc) => (
              <div
                key={acc.id}
                className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Landmark className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate">
                      {acc.bankName} · <span className="text-slate-300 font-normal">{acc.accountHolderName}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 truncate">
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3 text-slate-500" />
                        <span>{acc.country}</span>
                      </span>
                      <span>·</span>
                      <span className="font-mono text-amber-300">
                        <bdi dir="ltr">{acc.accountNumber || acc.iban}</bdi>
                      </span>
                    </div>
                  </div>
                </div>
                <span className="text-[11px] text-emerald-400 font-semibold whitespace-nowrap shrink-0">
                  حساب مخوّل
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {(
            [
              { id: 'all', label: `الكل (${counts.all})` },
              { id: 'pending', label: `بانتظار التأكيد (${counts.pending})` },
              { id: 'confirmed', label: `تم استلام الحوالة (${counts.confirmed})` },
              { id: 'rejected', label: `لم يتم الاستلام (${counts.rejected})` },
            ] as { id: IncomingTransferStatusFilter; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث برقم الحوالة أو السلفة أو اسم العميل..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Transfers List */}
      <div className="space-y-3">
        {filteredUnifiedTransfers.length === 0 ? (
          <div className="p-10 text-center rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
            <Landmark className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="font-bold text-sm text-white">لا توجد حوالات مطابقة حالياً</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              عندما يقوم أي عميل بإرسال طلب شحن رصيد محفظة أو طلب سداد سلفة وتحديد حسابك البنكي كوجهة للإيداع، سيصل الطلب هنا فوراً لمراجعته وتأكيد الاستلام.
            </p>
          </div>
        ) : (
          filteredUnifiedTransfers.map((entry) => {
            const isLoanRepayment = entry.kind === 'loan_repayment';
            const item = entry.data;
            const receiverStatus = item.receiverConfirmationStatus || 'pending';
            const noteKey = `${entry.kind}:${item.id}`;
            const noteValue = notesMap[noteKey] ?? '';
            const senderName =
              entry.kind === 'deposit' ? entry.data.transferSenderName : entry.data.senderName;

            return (
              <div
                key={noteKey}
                className={`p-5 rounded-3xl bg-slate-900 border space-y-4 text-xs ${
                  isLoanRepayment ? 'border-cyan-500/30' : 'border-slate-800'
                }`}
              >
                {/* Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-amber-400">#{item.id}</span>
                      {isLoanRepayment ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-[11px] font-bold text-cyan-300">
                          <HandCoins className="w-3.5 h-3.5" />
                          <span>طلب سداد سلفة #{entry.data.loanId}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px] font-bold text-amber-300">
                          <span>طلب شحن رصيد</span>
                        </span>
                      )}
                      <span className="text-slate-600">·</span>
                      <span className="font-bold text-white text-sm flex items-center gap-1.5">
                        <Store className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>{item.posName}</span>
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">({item.posCode})</span>
                      <span className="text-slate-600">·</span>
                      <span className="font-mono text-[11px] text-slate-400">{item.date}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      {receiverStatus === 'pending' && (
                        <span className="text-amber-300 font-semibold flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>بانتظار تأكيدك لاستلام الحوالة</span>
                        </span>
                      )}
                      {receiverStatus === 'confirmed' && (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>تم تأكيد استلام الحوالة وإبلاغ المورد ({item.receiverConfirmedAt})</span>
                        </span>
                      )}
                      {receiverStatus === 'rejected' && (
                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>تم الإبلاغ عن عدم استلام الحوالة ({item.receiverConfirmedAt})</span>
                        </span>
                      )}

                      <span className="text-slate-600">·</span>
                      <span className="text-slate-400">
                        حالة اعتماد المورد:{' '}
                        <strong
                          className={
                            item.status === 'approved'
                              ? 'text-emerald-400'
                              : item.status === 'rejected'
                              ? 'text-rose-400'
                              : 'text-amber-300'
                          }
                        >
                          {item.status === 'approved'
                            ? isLoanRepayment
                              ? 'تم اعتماد سداد السلفة'
                              : 'تم الاعتماد وإضافة الرصيد'
                            : item.status === 'rejected'
                            ? 'مرفوض من المورد'
                            : 'قيد مراجعة المورد'}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="text-right sm:text-left shrink-0">
                    <span className="text-[10px] text-slate-400 block">
                      {isLoanRepayment ? 'مبلغ سداد السلفة' : 'مبلغ الحوالة'}
                    </span>
                    <span className="text-xl font-bold font-mono tabular-nums text-emerald-400">
                      {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س
                    </span>
                  </div>
                </div>

                {/* Loan Context Snapshot for Loan Repayments */}
                {isLoanRepayment && (
                  <div className="p-3 rounded-2xl bg-cyan-950/30 border border-cyan-500/25 flex flex-wrap items-center justify-between gap-2 text-[11px] text-cyan-200">
                    <span>
                      سداد عن السلفة: <strong className="font-mono text-white">#{entry.data.loanId}</strong> ({entry.data.loanTransferNumber})
                    </span>
                    <span>
                      إجمالي السلفة: <strong className="font-mono text-white">{entry.data.loanTotalAmount.toFixed(2)} ر.س</strong> · المتبقي قبل الطلب: <strong className="font-mono text-amber-300">{entry.data.loanRemainingBefore.toFixed(2)} ر.س</strong>
                    </span>
                  </div>
                )}

                {/* Transfer Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-500 block">رقم الحوالة المرجعي</span>
                    <strong className="font-mono text-white">
                      <bdi dir="ltr">{item.transferNumber}</bdi>
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">اسم المحوّل</span>
                    <strong className="text-white">{senderName}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">البنك المحوّل منه</span>
                    <span className="text-slate-200">{item.bankName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">الحساب المحوّل إليه</span>
                    <span className="text-amber-300 font-semibold">
                      {item.targetBankName || item.bankName}
                      {item.targetBankAccountCountry ? ` · ${item.targetBankAccountCountry}` : ''}
                    </span>
                  </div>
                </div>

                {/* Attached Receipt Image */}
                {item.transferReceiptImage && (
                  <div className="flex items-center gap-3 p-2.5 px-3 rounded-2xl bg-slate-950 border border-amber-500/30">
                    <button
                      type="button"
                      onClick={() =>
                        setViewingReceiptInfo({
                          imageUrl: item.transferReceiptImage,
                          title: isLoanRepayment
                            ? `معاينة إيصال سداد سلفة - طلب #${item.id}`
                            : `معاينة إيصال الحوالة - طلب #${item.id}`,
                          transferNumber: item.transferNumber,
                          amount: item.amount,
                          senderName,
                          bankName: item.bankName,
                          date: item.date,
                          posName: item.posName,
                          posCode: item.posCode,
                        })
                      }
                      className="relative group shrink-0 cursor-pointer"
                      title="انقر لتكبير صورة الإيصال"
                    >
                      <img
                        src={item.transferReceiptImage}
                        alt="إيصال الحوالة"
                        className="w-10 h-10 rounded-xl object-cover border border-slate-700 group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye className="w-4 h-4 text-white" />
                      </div>
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                        <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                        <span>صورة إيصال الحوالة البنكية المرفقة من العميل</span>
                      </div>
                      <p className="text-[10.5px] text-slate-400 truncate">
                        تحقق من مطابقة المبلغ ورقم الحوالة البنكية في صورة الإيصال قبل التأكيد
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setViewingReceiptInfo({
                          imageUrl: item.transferReceiptImage,
                          title: isLoanRepayment
                            ? `معاينة إيصال سداد سلفة - طلب #${item.id}`
                            : `معاينة إيصال الحوالة - طلب #${item.id}`,
                          transferNumber: item.transferNumber,
                          amount: item.amount,
                          senderName,
                          bankName: item.bankName,
                          date: item.date,
                          posName: item.posName,
                          posCode: item.posCode,
                        })
                      }
                      className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>معاينة الإيصال</span>
                    </button>
                  </div>
                )}

                {/* Existing Receiver Note */}
                {item.receiverConfirmationNote && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
                    <span className="text-slate-400 font-semibold">ملاحظتك المرسلة للمورد: </span>
                    <span>{item.receiverConfirmationNote}</span>
                  </div>
                )}

                {/* Action Bar */}
                {item.status === 'pending' && (
                  <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center gap-3">
                    <input
                      type="text"
                      value={noteValue}
                      onChange={(e) => setNotesMap((prev) => ({ ...prev, [noteKey]: e.target.value }))}
                      placeholder="أضف ملاحظة أو سبب عدم الاستلام للمورد (اختياري)..."
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          isLoanRepayment
                            ? confirmLoanRepaymentReceiptByReceiver(item.id, 'confirmed', noteValue)
                            : confirmDepositReceiptByReceiver(item.id, 'confirmed', noteValue)
                        }
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>تأكيد استلام الحوالة</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          isLoanRepayment
                            ? confirmLoanRepaymentReceiptByReceiver(item.id, 'rejected', noteValue)
                            : confirmDepositReceiptByReceiver(item.id, 'rejected', noteValue)
                        }
                        className="px-4 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-500/40 font-bold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4 shrink-0" />
                        <span>عدم استلام الحوالة</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Transfer Receipt Image Viewer Modal */}
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
