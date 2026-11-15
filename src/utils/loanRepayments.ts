import { DepositRequest, LoanPaymentRecord } from '../types';
import { validateReceiptImage } from './receiptImage';

export type LoanRepaymentState = 'unpaid' | 'partial' | 'repaid';
export type ClientLoanFilterStatus = 'all' | 'pending' | 'unpaid' | 'partial' | 'repaid' | 'rejected';

export function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isLoanDeposit(dep: Pick<DepositRequest, 'requestType' | 'loanReason' | 'transferNumber'>): boolean {
  return (
    dep.requestType === 'loan' ||
    Boolean(dep.loanReason) ||
    Boolean(dep.transferNumber && dep.transferNumber.startsWith('LOAN'))
  );
}

export function getLoanPaidAmount(loan: DepositRequest): number {
  const total = Math.max(0, roundCurrency(loan.amount || 0));
  if (typeof loan.paidAmount === 'number' && Number.isFinite(loan.paidAmount)) {
    return Math.min(total, Math.max(0, roundCurrency(loan.paidAmount)));
  }
  if (Array.isArray(loan.repaidPayments) && loan.repaidPayments.length > 0) {
    const sum = loan.repaidPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    return Math.min(total, Math.max(0, roundCurrency(sum)));
  }
  if (loan.loanRepaidStatus === 'repaid') {
    return total;
  }
  return 0;
}

export function getLoanRemainingAmount(loan: DepositRequest): number {
  const total = Math.max(0, roundCurrency(loan.amount || 0));
  const paid = getLoanPaidAmount(loan);
  return Math.max(0, roundCurrency(total - paid));
}

export function getLoanRepaymentState(loan: DepositRequest): LoanRepaymentState {
  const total = Math.max(0, roundCurrency(loan.amount || 0));
  const paid = getLoanPaidAmount(loan);
  const remaining = getLoanRemainingAmount(loan);
  if (total > 0 && remaining <= 0) return 'repaid';
  if (paid > 0 && remaining > 0) return 'partial';
  return 'unpaid';
}

export function getLoanRepaymentsList(loan: DepositRequest): LoanPaymentRecord[] {
  if (Array.isArray(loan.repaidPayments) && loan.repaidPayments.length > 0) {
    return [...loan.repaidPayments].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }
  if (loan.loanRepaidStatus === 'repaid' && loan.amount > 0) {
    return [
      {
        id: `legacy-pay-${loan.id}`,
        amount: roundCurrency(loan.amount),
        date: loan.repaidAt || loan.date,
        method: 'bank_transfer',
        notes: loan.notes || 'تسديد كامل موثق من المتجر',
      },
    ];
  }
  return [];
}

export function filterClientLoans(
  loans: DepositRequest[],
  options: {
    posId?: string;
    query?: string;
    dateQuery?: string;
    statusFilter?: ClientLoanFilterStatus;
  }
): DepositRequest[] {
  const { posId, query = '', dateQuery = '', statusFilter = 'all' } = options;
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedDate = dateQuery.trim();

  return loans.filter((loan) => {
    if (!isLoanDeposit(loan)) return false;
    if (posId && loan.posId !== posId) return false;

    const repayState = getLoanRepaymentState(loan);

    if (statusFilter === 'pending' && loan.status !== 'pending') return false;
    if (statusFilter === 'rejected' && loan.status !== 'rejected') return false;
    if (statusFilter === 'unpaid' && (loan.status !== 'approved' || repayState !== 'unpaid')) return false;
    if (statusFilter === 'partial' && (loan.status !== 'approved' || repayState !== 'partial')) return false;
    if (statusFilter === 'repaid' && (loan.status !== 'approved' || repayState !== 'repaid')) return false;

    if (normalizedDate) {
      const loanDateOnly = (loan.date || '').substring(0, 10);
      if (!loanDateOnly.includes(normalizedDate)) return false;
    }

    if (normalizedQuery) {
      const haystacks = [
        loan.id,
        loan.transferNumber,
        loan.date,
        loan.loanReason || '',
        loan.notes || '',
        loan.posName || '',
        loan.posCode || '',
      ];
      const matched = haystacks.some((val) => val.toLowerCase().includes(normalizedQuery));
      if (!matched) return false;
    }

    return true;
  });
}

export function validateWalletRepayment(
  loan: DepositRequest,
  rawAmount: number,
  walletBalance: number
): {
  valid: boolean;
  amount: number;
  code?: 'invalid_loan' | 'invalid_amount' | 'exceeds_remaining' | 'insufficient_balance';
  error?: string;
} {
  if (!isLoanDeposit(loan) || loan.status !== 'approved') {
    return {
      valid: false,
      amount: 0,
      code: 'invalid_loan',
      error: 'يمكن سداد السلف المعتمدة القائمة فقط.',
    };
  }

  const remaining = getLoanRemainingAmount(loan);
  if (remaining <= 0) {
    return {
      valid: false,
      amount: 0,
      code: 'invalid_loan',
      error: 'هذه السلفة مسددة بالكامل بالفعل.',
    };
  }

  const amount = roundCurrency(Number(rawAmount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      valid: false,
      amount: 0,
      code: 'invalid_amount',
      error: 'يرجى إدخال مبلغ سداد صحيح أكبر من صفر.',
    };
  }

  if (amount > remaining) {
    return {
      valid: false,
      amount,
      code: 'exceeds_remaining',
      error: `مبلغ السداد (${amount.toFixed(2)} ر.س) يتجاوز المبلغ المتبقي من السلفة (${remaining.toFixed(2)} ر.س).`,
    };
  }

  const cleanWallet = roundCurrency(walletBalance);
  if (cleanWallet < amount) {
    return {
      valid: false,
      amount,
      code: 'insufficient_balance',
      error: `الرصيد غير كافٍ في محفظتك! رصيدك الحالي (${cleanWallet.toFixed(2)} ر.س) أقل من مبلغ السداد المطلوب (${amount.toFixed(2)} ر.س). يرجى إعادة شحن المحفظة أو السداد عبر طلب حوالة بنكية.`,
    };
  }

  return { valid: true, amount };
}

export function validateBankTransferRepayment(
  loan: DepositRequest,
  params: {
    amount: number;
    transferNumber: string;
    senderName: string;
    bankName: string;
    transferReceiptImage?: string | null;
    targetBankAccountId?: string;
  }
): {
  valid: boolean;
  amount: number;
  error?: string;
} {
  if (!isLoanDeposit(loan) || loan.status !== 'approved') {
    return {
      valid: false,
      amount: 0,
      error: 'يمكن تقديم طلب سداد للسلف المعتمدة القائمة فقط.',
    };
  }

  const remaining = getLoanRemainingAmount(loan);
  if (remaining <= 0) {
    return {
      valid: false,
      amount: 0,
      error: 'هذه السلفة مسددة بالكامل ولا يوجد متبقي للسداد.',
    };
  }

  const amount = roundCurrency(Number(params.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      valid: false,
      amount: 0,
      error: 'يرجى إدخال المبلغ المحول بشكل صحيح.',
    };
  }

  if (amount > remaining) {
    return {
      valid: false,
      amount,
      error: `المبلغ المحول (${amount.toFixed(2)} ر.س) يتجاوز المتبقي من السلفة (${remaining.toFixed(2)} ر.س).`,
    };
  }

  if (!params.transferNumber.trim()) {
    return {
      valid: false,
      amount,
      error: 'يرجى إدخال رقم الحوالة البنكية المرجعي.',
    };
  }

  const receiptValidation = validateReceiptImage(params.transferReceiptImage);
  if (!receiptValidation.isValid) {
    return {
      valid: false,
      amount,
      error: receiptValidation.error || 'صورة إيصال الحوالة إلزامية لتأكيد طلب سداد السلفة.',
    };
  }

  if (!params.senderName.trim()) {
    return {
      valid: false,
      amount,
      error: 'يرجى إدخال اسم المحوّل كما هو في الحوالة البنكية.',
    };
  }

  return { valid: true, amount };
}

export function applyLoanPaymentToLoan(
  loan: DepositRequest,
  payment: LoanPaymentRecord,
  supplierName?: string
): {
  updatedLoan: DepositRequest;
  appliedAmount: number;
  newPaidAmount: number;
  newRemainingAmount: number;
  newState: LoanRepaymentState;
} {
  const total = Math.max(0, roundCurrency(loan.amount));
  const currentPaid = getLoanPaidAmount(loan);
  const currentRemaining = Math.max(0, roundCurrency(total - currentPaid));
  const appliedAmount = Math.min(currentRemaining, Math.max(0, roundCurrency(payment.amount)));

  const existingPayments = getLoanRepaymentsList(loan);
  const paymentWithAppliedAmount: LoanPaymentRecord = {
    ...payment,
    amount: appliedAmount,
  };

  const newPaidAmount = Math.min(total, roundCurrency(currentPaid + appliedAmount));
  const newRemainingAmount = Math.max(0, roundCurrency(total - newPaidAmount));
  const newState: LoanRepaymentState =
    newRemainingAmount <= 0 ? 'repaid' : newPaidAmount > 0 ? 'partial' : 'unpaid';

  const statusNote =
    newState === 'repaid'
      ? `تم تسديد السلفة بالكامل (${total.toFixed(2)} ر.س)${supplierName ? ` للمتجر (${supplierName})` : ''} بتاريخ ${payment.date}`
      : `سداد جزئي بمبلغ ${appliedAmount.toFixed(2)} ر.س (المسدد: ${newPaidAmount.toFixed(2)} ر.س · المتبقي: ${newRemainingAmount.toFixed(2)} ر.س)`;

  const updatedLoan: DepositRequest = {
    ...loan,
    paidAmount: newPaidAmount,
    loanRepaidStatus: newState,
    repaidPayments: [paymentWithAppliedAmount, ...existingPayments],
    repaidAt: newState === 'repaid' ? payment.date : loan.repaidAt,
    notes: statusNote,
  };

  return {
    updatedLoan,
    appliedAmount,
    newPaidAmount,
    newRemainingAmount,
    newState,
  };
}

export function buildWalletLoanRepaymentReceipt(params: {
  loan: DepositRequest;
  paymentId: string;
  date: string;
  appliedAmount: number;
  paidBefore: number;
  paidAfter: number;
  remainingAfter: number;
  newState: LoanRepaymentState;
  clientId: string;
  clientName: string;
  clientPosCode: string;
  clientBalanceBefore: number;
  supplierId: string;
  supplierName: string;
  supplierStoreName: string;
  supplierBalanceBefore: number;
}): import('../types').WalletLoanRepaymentReceipt {
  const cleanAmount = roundCurrency(params.appliedAmount);
  const cleanClientBefore = roundCurrency(params.clientBalanceBefore);
  const cleanSupplierBefore = roundCurrency(params.supplierBalanceBefore);

  return {
    loanId: params.loan.id,
    loanTransferNumber: params.loan.transferNumber,
    loanDate: params.loan.date,
    paymentId: params.paymentId,
    date: params.date,
    amountPaid: cleanAmount,
    totalLoanAmount: roundCurrency(params.loan.amount || 0),
    paidBefore: roundCurrency(params.paidBefore),
    paidAfter: roundCurrency(params.paidAfter),
    remainingAfter: roundCurrency(params.remainingAfter),
    newState: params.newState,
    clientId: params.clientId,
    clientName: params.clientName,
    clientPosCode: params.clientPosCode,
    clientBalanceBefore: cleanClientBefore,
    clientBalanceAfter: roundCurrency(cleanClientBefore - cleanAmount),
    supplierId: params.supplierId,
    supplierName: params.supplierName,
    supplierStoreName: params.supplierStoreName,
    supplierBalanceBefore: cleanSupplierBefore,
    supplierBalanceAfter: roundCurrency(cleanSupplierBefore + cleanAmount),
  };
}
