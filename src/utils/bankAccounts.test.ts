import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSupplierBankAccounts,
  getActiveBankAccountsForDeposit,
  resolveBankAccountReceiverPos,
  hasSupplierTransferPrivilege,
  getIncomingTransfersForPos,
  getIncomingLoanRepaymentsForPos,
  validateBankAccountInput,
} from './bankAccounts';
import { DepositRequest, LoanRepaymentRequest, POSClient, Supplier, SupplierBankAccount } from '../types';

const mockSupplier: Supplier = {
  id: 'sup-jamal-01',
  name: 'جمال الصالحي',
  storeName: 'مؤسسة جمال للحلول الرقمية',
  phone: '+966501234567',
  email: 'jamal@supplier.sa',
  feePercentage: 1,
  fixedFeeAmount: 0,
  feeType: 'percentage',
  walletBalance: 50000,
  country: 'المملكة العربية السعودية',
  bankAccountDetails: {
    bankName: 'مصرف الراجحي',
    accountHolder: 'مؤسسة جمال',
    iban: 'SA4480000123',
    accountNumber: '123456789',
  },
  createdAt: '2025-01-01',
};

const pos1: POSClient = {
  id: 'pos-1',
  posCode: 'RYD-10492',
  tradeName: 'مركز الأمل',
  ownerName: 'محمد العتيبي',
  phone: '+966550001111',
  email: 'pos1@digipos.sa',
  country: 'المملكة العربية السعودية',
  city: 'الرياض',
  supplierId: 'sup-jamal-01',
  tier: 'vip',
  walletBalance: 1000,
  totalSpent: 0,
  ordersCount: 0,
  createdAt: '2025-01-01',
  qrCodeValue: 'QR1',
};

const pos2: POSClient = {
  id: 'pos-2',
  posCode: 'JED-28314',
  tradeName: 'ديجيتال ستار',
  ownerName: 'أحمد العمودي',
  phone: '+966550002222',
  email: 'contact@digitalstar.com',
  country: 'المملكة العربية السعودية',
  city: 'جدة',
  supplierId: 'sup-jamal-01',
  tier: 'gold',
  walletBalance: 500,
  totalSpent: 0,
  ordersCount: 0,
  createdAt: '2025-01-01',
  qrCodeValue: 'QR2',
};

const pos3: POSClient = {
  id: 'pos-3',
  posCode: 'DAM-59123',
  tradeName: 'نقطة بيع الفرسان',
  ownerName: 'خالد الدوسري',
  phone: '+966550003333',
  email: 'pos3@digipos.sa',
  country: 'المملكة العربية السعودية',
  city: 'الدمام',
  supplierId: 'sup-jamal-01',
  tier: 'regular',
  walletBalance: 300,
  totalSpent: 0,
  ordersCount: 0,
  createdAt: '2025-01-01',
  qrCodeValue: 'QR3',
};

test('validateBankAccountInput validates required fields and email format', () => {
  const badEmail = validateBankAccountInput({
    bankName: 'مصرف الراجحي',
    accountNumber: '123456',
    country: 'اليمن',
    accountHolderName: 'أحمد العمودي',
    accountHolderEmail: 'invalid-email',
  });
  assert.equal(badEmail.valid, false);

  const missingNumber = validateBankAccountInput({
    bankName: 'بنك الكريمي',
    accountNumber: '',
    iban: '',
    country: 'اليمن',
    accountHolderName: 'أحمد العمودي',
    accountHolderEmail: 'contact@digitalstar.com',
  });
  assert.equal(missingNumber.valid, false);

  const valid = validateBankAccountInput({
    bankName: 'بنك الكريمي',
    accountNumber: '301928374',
    country: 'اليمن',
    accountHolderName: 'أحمد العمودي',
    accountHolderEmail: 'contact@digitalstar.com',
  });
  assert.equal(valid.valid, true);
});

test('hasSupplierTransferPrivilege grants access ONLY to delegated POS or matching email', () => {
  const accounts: SupplierBankAccount[] = [
    {
      id: 'bank-1',
      supplierId: 'sup-jamal-01',
      bankName: 'بنك الكريمي',
      accountNumber: '301928374',
      country: 'اليمن',
      accountHolderName: 'أحمد العمودي',
      accountHolderEmail: 'CONTACT@DIGITALSTAR.COM',
      canReceiveSupplierTransfers: true,
      isActive: true,
      createdAt: '2026-11-10',
    },
  ];

  assert.equal(hasSupplierTransferPrivilege(pos2, accounts), true);
  assert.equal(hasSupplierTransferPrivilege(pos1, accounts), false);
  assert.equal(hasSupplierTransferPrivilege(pos3, accounts), false);

  const resolved = resolveBankAccountReceiverPos(accounts[0], [pos1, pos2, pos3]);
  assert.equal(resolved?.id, 'pos-2');
});

test('getIncomingTransfersForPos routes only cash deposit requests targeting authorized POS receiver', () => {
  const accounts: SupplierBankAccount[] = [
    {
      id: 'bank-delegated-2',
      supplierId: 'sup-jamal-01',
      bankName: 'بنك الكريمي',
      accountNumber: '301928374',
      country: 'اليمن',
      accountHolderName: 'أحمد العمودي',
      accountHolderEmail: 'contact@digitalstar.com',
      delegatedPosId: 'pos-2',
      delegatedPosName: 'ديجيتال ستار',
      delegatedPosCode: 'JED-28314',
      canReceiveSupplierTransfers: true,
      isActive: true,
      createdAt: '2026-11-10',
    },
  ];

  const deposits: DepositRequest[] = [
    {
      id: 'dep-cash-1',
      posId: 'pos-1',
      posName: 'مركز الأمل',
      posCode: 'RYD-10492',
      supplierId: 'sup-jamal-01',
      amount: 1200,
      transferNumber: 'TRX-111',
      transferSenderName: 'محمد العتيبي',
      bankName: 'مصرف الراجحي',
      date: '2026-11-12 10:00',
      status: 'pending',
      requestType: 'cash',
      targetBankAccountId: 'bank-delegated-2',
      receiverPosId: 'pos-2',
      receiverConfirmationStatus: 'pending',
    },
    {
      id: 'dep-cash-other',
      posId: 'pos-3',
      posName: 'نقطة بيع الفرسان',
      posCode: 'DAM-59123',
      supplierId: 'sup-jamal-01',
      amount: 700,
      transferNumber: 'TRX-222',
      transferSenderName: 'خالد الدوسري',
      bankName: 'بنك الرياض',
      date: '2026-11-12 11:00',
      status: 'pending',
      requestType: 'cash',
      targetBankAccountId: 'bank-jamal-01',
    },
    {
      id: 'dep-loan-1',
      posId: 'pos-1',
      posName: 'مركز الأمل',
      posCode: 'RYD-10492',
      supplierId: 'sup-jamal-01',
      amount: 500,
      transferNumber: 'LOAN-999',
      transferSenderName: 'محمد العتيبي',
      bankName: 'سلفة',
      date: '2026-11-12 12:00',
      status: 'pending',
      requestType: 'loan',
      receiverPosId: 'pos-2',
    },
  ];

  const forPos2 = getIncomingTransfersForPos(deposits, pos2, accounts);
  assert.equal(forPos2.length, 1);
  assert.equal(forPos2[0].id, 'dep-cash-1');

  const forPos3 = getIncomingTransfersForPos(deposits, pos3, accounts);
  assert.equal(forPos3.length, 0);
});

test('getSupplierBankAccounts and getActiveBankAccountsForDeposit synthesize fallback primary account when empty', () => {
  const list = getSupplierBankAccounts([], mockSupplier);
  assert.equal(list.length, 1);
  assert.equal(list[0].bankName, 'مصرف الراجحي');

  const active = getActiveBankAccountsForDeposit(
    [
      { ...list[0], id: 'b-inactive', isActive: false },
      { ...list[0], id: 'b-active', isActive: true, bankName: 'بنك الإنماء' },
    ],
    mockSupplier
  );
  assert.equal(active.length, 1);
  assert.equal(active[0].id, 'b-active');
});

test('getActiveBankAccountsForDeposit returns all authorized accounts with bank names and account numbers', () => {
  const accounts: SupplierBankAccount[] = [
    {
      id: 'b-1',
      supplierId: 'sup-jamal-01',
      bankName: 'مصرف الراجحي',
      accountNumber: '123608010123456',
      iban: 'SA4480000123608010123456',
      country: 'المملكة العربية السعودية',
      accountHolderName: 'مؤسسة جمال للحلول الرقمية',
      accountHolderEmail: 'jamal@supplier.sa',
      canReceiveSupplierTransfers: false,
      isPrimary: true,
      isActive: true,
      createdAt: '2026-11-10',
    },
    {
      id: 'b-2',
      supplierId: 'sup-jamal-01',
      bankName: 'بنك الكريمي الدولي',
      accountNumber: '30099112233',
      country: 'اليمن',
      accountHolderName: 'ديجيتال ستار',
      accountHolderEmail: 'contact@digitalstar.com',
      canReceiveSupplierTransfers: true,
      delegatedPosId: 'pos-2',
      isActive: true,
      createdAt: '2026-11-10',
    },
  ];

  const active = getActiveBankAccountsForDeposit(accounts, mockSupplier);
  assert.equal(active.length, 2);
  assert.equal(active[0].accountNumber, '123608010123456');
  assert.equal(active[1].accountNumber, '30099112233');
  assert.equal(active[1].canReceiveSupplierTransfers, true);
});

test('getIncomingLoanRepaymentsForPos routes loan repayment bank transfers to authorized POS receiver', () => {
  const accounts: SupplierBankAccount[] = [
    {
      id: 'bank-delegated-2',
      supplierId: 'sup-jamal-01',
      bankName: 'بنك الكريمي',
      accountNumber: '301928374',
      country: 'اليمن',
      accountHolderName: 'أحمد العمودي',
      accountHolderEmail: 'contact@digitalstar.com',
      delegatedPosId: 'pos-2',
      delegatedPosName: 'ديجيتال ستار',
      delegatedPosCode: 'JED-28314',
      canReceiveSupplierTransfers: true,
      isActive: true,
      createdAt: '2026-11-10',
    },
  ];

  const repayments: LoanRepaymentRequest[] = [
    {
      id: 'lrep-101',
      loanId: 'dep-loan-104',
      loanTransferNumber: 'LOAN-8812',
      loanDate: '2026-11-08 16:20',
      loanTotalAmount: 2000,
      loanPaidBefore: 0,
      loanRemainingBefore: 2000,
      posId: 'pos-1',
      posName: 'مركز الأمل',
      posCode: 'RYD-10492',
      supplierId: 'sup-jamal-01',
      supplierName: 'جمال الصالحي',
      amount: 1000,
      transferNumber: 'TRX-778899',
      bankName: 'مصرف الراجحي',
      senderName: 'محمد العتيبي',
      date: '2026-11-14 10:00',
      status: 'pending',
      targetBankAccountId: 'bank-delegated-2',
      targetBankName: 'بنك الكريمي',
      receiverPosId: 'pos-2',
      receiverConfirmationStatus: 'pending',
    },
    {
      id: 'lrep-102',
      loanId: 'dep-loan-105',
      loanTransferNumber: 'LOAN-9901',
      loanDate: '2026-11-09 10:00',
      loanTotalAmount: 1000,
      loanPaidBefore: 0,
      loanRemainingBefore: 1000,
      posId: 'pos-3',
      posName: 'نقطة بيع الفرسان',
      posCode: 'DAM-59123',
      supplierId: 'sup-jamal-01',
      supplierName: 'جمال الصالحي',
      amount: 500,
      transferNumber: 'TRX-445566',
      bankName: 'بنك الرياض',
      senderName: 'خالد الدوسري',
      date: '2026-11-14 11:00',
      status: 'pending',
      targetBankAccountId: 'bank-primary-supplier',
    },
  ];

  const forPos2 = getIncomingLoanRepaymentsForPos(repayments, pos2, accounts);
  assert.equal(forPos2.length, 1);
  assert.equal(forPos2[0].id, 'lrep-101');

  const forPos3 = getIncomingLoanRepaymentsForPos(repayments, pos3, accounts);
  assert.equal(forPos3.length, 0);
});

