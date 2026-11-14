import test from 'node:test';
import assert from 'node:assert/strict';
import { DepositRequest } from '../types';
import {
  getLoanPaidAmount,
  getLoanRemainingAmount,
  getLoanRepaymentState,
  filterClientLoans,
  validateWalletRepayment,
  validateBankTransferRepayment,
  applyLoanPaymentToLoan,
  buildWalletLoanRepaymentReceipt,
} from './loanRepayments';

const baseLoan: DepositRequest = {
  id: 'dep-loan-104',
  posId: 'pos-1',
  posName: 'مركز الأمل',
  posCode: 'RYD-10492',
  supplierId: 'sup-jamal-01',
  amount: 2000,
  transferNumber: 'LOAN-ADVANCE-8812',
  transferSenderName: 'طلب سلفة',
  bankName: 'سلفة / رصيد آجل',
  date: '2026-11-08 16:20',
  status: 'approved',
  requestType: 'loan',
  loanReason: 'تغطية مبيعات عاجلة',
  loanRepaidStatus: 'unpaid',
};

test('tracks unpaid, partial, and full repayment states accurately', () => {
  assert.equal(getLoanPaidAmount(baseLoan), 0);
  assert.equal(getLoanRemainingAmount(baseLoan), 2000);
  assert.equal(getLoanRepaymentState(baseLoan), 'unpaid');

  const first = applyLoanPaymentToLoan(
    baseLoan,
    {
      id: 'lpay-1',
      amount: 750.25,
      date: '2026-11-10 12:00',
      method: 'wallet',
    },
    'جمال الصالحي'
  );

  assert.equal(first.appliedAmount, 750.25);
  assert.equal(first.newPaidAmount, 750.25);
  assert.equal(first.newRemainingAmount, 1249.75);
  assert.equal(first.newState, 'partial');
  assert.equal(getLoanRepaymentState(first.updatedLoan), 'partial');
  assert.equal(first.updatedLoan.repaidPayments?.length, 1);

  const second = applyLoanPaymentToLoan(
    first.updatedLoan,
    {
      id: 'lpay-2',
      amount: 1249.75,
      date: '2026-11-11 09:30',
      method: 'bank_transfer',
      transferNumber: 'TRX-550192',
    },
    'جمال الصالحي'
  );

  assert.equal(second.appliedAmount, 1249.75);
  assert.equal(second.newPaidAmount, 2000);
  assert.equal(second.newRemainingAmount, 0);
  assert.equal(second.newState, 'repaid');
  assert.equal(second.updatedLoan.repaidAt, '2026-11-11 09:30');
  assert.equal(second.updatedLoan.repaidPayments?.length, 2);
});

test('handles legacy repaid loan without paidAmount field', () => {
  const legacyRepaid: DepositRequest = {
    ...baseLoan,
    id: 'dep-loan-legacy',
    loanRepaidStatus: 'repaid',
    repaidAt: '2026-11-01 10:00',
  };
  assert.equal(getLoanPaidAmount(legacyRepaid), 2000);
  assert.equal(getLoanRemainingAmount(legacyRepaid), 0);
  assert.equal(getLoanRepaymentState(legacyRepaid), 'repaid');
});

test('validates wallet balance and remaining bounds', () => {
  const insufficient = validateWalletRepayment(baseLoan, 500, 300);
  assert.equal(insufficient.valid, false);
  assert.equal(insufficient.code, 'insufficient_balance');

  const exceeds = validateWalletRepayment(baseLoan, 2500, 5000);
  assert.equal(exceeds.valid, false);
  assert.equal(exceeds.code, 'exceeds_remaining');

  const ok = validateWalletRepayment(baseLoan, 500, 1000);
  assert.equal(ok.valid, true);
  assert.equal(ok.amount, 500);
});

test('validates bank transfer repayment request requires transfer number, receipt image, and valid amount', () => {
  const sampleReceipt = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/';

  const missingRef = validateBankTransferRepayment(baseLoan, {
    amount: 500,
    transferNumber: '  ',
    senderName: 'محمد',
    bankName: 'مصرف الراجحي',
    transferReceiptImage: sampleReceipt,
  });
  assert.equal(missingRef.valid, false);

  const missingReceipt = validateBankTransferRepayment(baseLoan, {
    amount: 500,
    transferNumber: 'TRX-112233',
    senderName: 'محمد العتيبي',
    bankName: 'مصرف الراجحي',
    transferReceiptImage: '',
  });
  assert.equal(missingReceipt.valid, false);

  const invalidReceipt = validateBankTransferRepayment(baseLoan, {
    amount: 500,
    transferNumber: 'TRX-112233',
    senderName: 'محمد العتيبي',
    bankName: 'مصرف الراجحي',
    transferReceiptImage: 'https://example.com/not-data-url.png',
  });
  assert.equal(invalidReceipt.valid, false);

  const validReq = validateBankTransferRepayment(baseLoan, {
    amount: 500,
    transferNumber: 'TRX-112233',
    senderName: 'محمد العتيبي',
    bankName: 'مصرف الراجحي',
    transferReceiptImage: sampleReceipt,
    targetBankAccountId: 'bank-1',
  });
  assert.equal(validReq.valid, true);
  assert.equal(validReq.amount, 500);
});

test('filters client loans by loan number, reference, and date', () => {
  const otherLoan: DepositRequest = {
    ...baseLoan,
    id: 'dep-loan-999',
    posId: 'pos-2',
    transferNumber: 'LOAN-ADVANCE-0999',
    date: '2026-11-12 08:00',
  };
  const partialLoan: DepositRequest = {
    ...baseLoan,
    id: 'dep-loan-205',
    transferNumber: 'LOAN-ADVANCE-2050',
    date: '2026-11-10 14:00',
    paidAmount: 400,
    loanRepaidStatus: 'partial',
  };

  const list = [baseLoan, otherLoan, partialLoan];

  assert.equal(filterClientLoans(list, { posId: 'pos-1' }).length, 2);
  assert.equal(filterClientLoans(list, { posId: 'pos-1', query: '8812' }).length, 1);
  assert.equal(filterClientLoans(list, { posId: 'pos-1', query: 'dep-loan-205' }).length, 1);
  assert.equal(filterClientLoans(list, { posId: 'pos-1', dateQuery: '2026-11-10' }).length, 1);
  assert.equal(filterClientLoans(list, { posId: 'pos-1', statusFilter: 'partial' }).length, 1);
  assert.equal(filterClientLoans(list, { posId: 'pos-1', statusFilter: 'unpaid' }).length, 1);
});

test('builds detailed wallet loan repayment receipt with client deduction and supplier credit', () => {
  const receipt = buildWalletLoanRepaymentReceipt({
    loan: baseLoan,
    paymentId: 'lpay-901',
    date: '2026-11-13 10:15',
    appliedAmount: 650.5,
    paidBefore: 0,
    paidAfter: 650.5,
    remainingAfter: 1349.5,
    newState: 'partial',
    clientId: 'pos-1',
    clientName: 'مركز الأمل',
    clientPosCode: 'RYD-10492',
    clientBalanceBefore: 2400.75,
    supplierId: 'sup-jamal-01',
    supplierName: 'جمال الصالحي',
    supplierStoreName: 'متجر الصالحي الرقمي',
    supplierBalanceBefore: 12000.25,
  });

  assert.equal(receipt.amountPaid, 650.5);
  assert.equal(receipt.clientBalanceBefore, 2400.75);
  assert.equal(receipt.clientBalanceAfter, 1750.25);
  assert.equal(receipt.supplierBalanceBefore, 12000.25);
  assert.equal(receipt.supplierBalanceAfter, 12650.75);
  assert.equal(receipt.remainingAfter, 1349.5);
  assert.equal(receipt.newState, 'partial');
});
