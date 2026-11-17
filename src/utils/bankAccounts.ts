import { DepositRequest, LoanRepaymentRequest, OfficeEmployee, POSClient, Supplier, SupplierBankAccount } from '../types';
import { isLoanDeposit } from './loanRepayments';

export type IncomingTransferStatusFilter = 'all' | 'pending' | 'confirmed' | 'rejected';

export function normalizeEmail(email?: string): string {
  return (email || '').trim().toLowerCase();
}

export function buildFallbackSupplierBankAccount(supplier: Supplier): SupplierBankAccount {
  return {
    id: `default-${supplier.id}`,
    supplierId: supplier.id,
    bankName: supplier.bankAccountDetails?.bankName || 'الحساب البنكي للمتجر',
    accountNumber: supplier.bankAccountDetails?.accountNumber || '',
    iban: supplier.bankAccountDetails?.iban || '',
    country: supplier.country || 'المملكة العربية السعودية',
    accountHolderName: supplier.bankAccountDetails?.accountHolder || supplier.storeName || supplier.name,
    accountHolderEmail: supplier.email || '',
    accountHolderPhone: supplier.phone || '',
    canReceiveSupplierTransfers: false,
    isPrimary: true,
    isActive: true,
    createdAt: supplier.createdAt || new Date().toISOString().substring(0, 10),
  };
}

export function getSupplierBankAccounts(
  accounts: SupplierBankAccount[],
  supplier: Supplier
): SupplierBankAccount[] {
  const matched = accounts.filter((acc) => !acc.supplierId || acc.supplierId === supplier.id);
  if (matched.length > 0) {
    return [...matched].sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      if (a.canReceiveSupplierTransfers && !b.canReceiveSupplierTransfers) return -1;
      if (!a.canReceiveSupplierTransfers && b.canReceiveSupplierTransfers) return 1;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }
  return [buildFallbackSupplierBankAccount(supplier)];
}

export function getActiveBankAccountsForDeposit(
  accounts: SupplierBankAccount[],
  supplier: Supplier
): SupplierBankAccount[] {
  const list = getSupplierBankAccounts(accounts, supplier);
  const active = list.filter((acc) => acc.isActive !== false);
  return active.length > 0 ? active : list;
}

export function resolveBankAccountReceiverPos(
  account: Pick<
    SupplierBankAccount,
    'delegatedPosId' | 'accountHolderEmail' | 'canReceiveSupplierTransfers' | 'supplierId'
  >,
  posClients: POSClient[]
): POSClient | undefined {
  if (!account.canReceiveSupplierTransfers) return undefined;

  if (account.delegatedPosId) {
    const byId =
      posClients.find(
        (p) => p.id === account.delegatedPosId && p.supplierId === account.supplierId
      ) || posClients.find((p) => p.id === account.delegatedPosId);
    if (byId) return byId;
  }

  const targetEmail = normalizeEmail(account.accountHolderEmail);
  if (!targetEmail) return undefined;

  return (
    posClients.find(
      (p) => p.supplierId === account.supplierId && normalizeEmail(p.email) === targetEmail
    ) || posClients.find((p) => normalizeEmail(p.email) === targetEmail)
  );
}

export function resolveBankAccountReceiverEmployee(
  account: Pick<
    SupplierBankAccount,
    'delegatedEmployeeId' | 'accountHolderEmail' | 'canReceiveSupplierTransfers' | 'supplierId' | 'holderType'
  >,
  employees: OfficeEmployee[] = []
): OfficeEmployee | undefined {
  if (!account.canReceiveSupplierTransfers || employees.length === 0) return undefined;

  if (account.delegatedEmployeeId) {
    const byId =
      employees.find(
        (e) => e.id === account.delegatedEmployeeId && (!account.supplierId || e.supplierId === account.supplierId)
      ) || employees.find((e) => e.id === account.delegatedEmployeeId);
    if (byId) return byId;
  }

  if (account.holderType === 'employee' || !account.holderType) {
    const targetEmail = normalizeEmail(account.accountHolderEmail);
    if (!targetEmail) return undefined;
    return (
      employees.find(
        (e) => (!account.supplierId || e.supplierId === account.supplierId) && normalizeEmail(e.email) === targetEmail
      ) || employees.find((e) => normalizeEmail(e.email) === targetEmail)
    );
  }

  return undefined;
}

export function isAccountAssignedToPos(
  account: SupplierBankAccount,
  pos: POSClient | undefined
): boolean {
  if (!pos || !account.canReceiveSupplierTransfers || account.isActive === false) {
    return false;
  }
  if (account.supplierId && pos.supplierId && account.supplierId !== pos.supplierId) {
    return false;
  }
  if (account.delegatedPosId && account.delegatedPosId === pos.id) {
    return true;
  }
  const accEmail = normalizeEmail(account.accountHolderEmail);
  const posEmail = normalizeEmail(pos.email);
  return Boolean(accEmail && posEmail && accEmail === posEmail);
}

export function getAuthorizedBankAccountsForPos(
  pos: POSClient | undefined,
  accounts: SupplierBankAccount[]
): SupplierBankAccount[] {
  if (!pos) return [];
  return accounts.filter((acc) => isAccountAssignedToPos(acc, pos));
}

export function hasSupplierTransferPrivilege(
  pos: POSClient | undefined,
  accounts: SupplierBankAccount[]
): boolean {
  if (!pos) return false;
  if (pos.canReceiveSupplierTransfers === true) return true;
  return getAuthorizedBankAccountsForPos(pos, accounts).length > 0;
}

export function isTransferDirectedToPosReceiver(
  dep: DepositRequest,
  pos: POSClient | undefined,
  accounts: SupplierBankAccount[]
): boolean {
  if (!pos || isLoanDeposit(dep)) return false;
  if (dep.supplierId && pos.supplierId && dep.supplierId !== pos.supplierId) {
    return false;
  }

  if (dep.receiverPosId && dep.receiverPosId === pos.id) {
    return true;
  }

  const posEmail = normalizeEmail(pos.email);
  if (posEmail) {
    if (dep.receiverPosEmail && normalizeEmail(dep.receiverPosEmail) === posEmail) {
      return true;
    }
    if (
      dep.targetAccountHolderEmail &&
      normalizeEmail(dep.targetAccountHolderEmail) === posEmail &&
      dep.receiverConfirmationStatus !== undefined
    ) {
      return true;
    }
  }

  if (dep.targetBankAccountId) {
    const authorizedIds = new Set(getAuthorizedBankAccountsForPos(pos, accounts).map((a) => a.id));
    if (authorizedIds.has(dep.targetBankAccountId)) {
      return true;
    }
  }

  return false;
}

export function getIncomingTransfersForPos(
  depositRequests: DepositRequest[],
  pos: POSClient | undefined,
  accounts: SupplierBankAccount[],
  options: {
    statusFilter?: IncomingTransferStatusFilter;
    query?: string;
  } = {}
): DepositRequest[] {
  if (!pos || !hasSupplierTransferPrivilege(pos, accounts)) {
    return [];
  }

  const { statusFilter = 'all', query = '' } = options;
  const q = query.trim().toLowerCase();

  return depositRequests.filter((dep) => {
    if (!isTransferDirectedToPosReceiver(dep, pos, accounts)) return false;

    const confirmationStatus = dep.receiverConfirmationStatus || 'pending';
    if (statusFilter !== 'all' && confirmationStatus !== statusFilter) {
      return false;
    }

    if (q) {
      const haystacks = [
        dep.id,
        dep.posName,
        dep.posCode,
        dep.transferNumber,
        dep.transferSenderName,
        dep.bankName,
        dep.targetBankName || '',
        dep.targetBankAccountNumber || '',
        dep.targetAccountHolderName || '',
      ];
      if (!haystacks.some((v) => v.toLowerCase().includes(q))) {
        return false;
      }
    }

    return true;
  });
}

export function isLoanRepaymentDirectedToPosReceiver(
  req: LoanRepaymentRequest,
  pos: POSClient | undefined,
  accounts: SupplierBankAccount[]
): boolean {
  if (!pos) return false;
  if (req.supplierId && pos.supplierId && req.supplierId !== pos.supplierId) {
    return false;
  }

  if (req.receiverPosId && req.receiverPosId === pos.id) {
    return true;
  }

  const posEmail = normalizeEmail(pos.email);
  if (posEmail) {
    if (req.receiverPosEmail && normalizeEmail(req.receiverPosEmail) === posEmail) {
      return true;
    }
    if (
      req.targetAccountHolderEmail &&
      normalizeEmail(req.targetAccountHolderEmail) === posEmail &&
      req.receiverConfirmationStatus !== undefined
    ) {
      return true;
    }
  }

  if (req.targetBankAccountId) {
    const authorizedIds = new Set(getAuthorizedBankAccountsForPos(pos, accounts).map((a) => a.id));
    if (authorizedIds.has(req.targetBankAccountId)) {
      return true;
    }
  }

  return false;
}

export function getIncomingLoanRepaymentsForPos(
  repaymentRequests: LoanRepaymentRequest[],
  pos: POSClient | undefined,
  accounts: SupplierBankAccount[],
  options: {
    statusFilter?: IncomingTransferStatusFilter;
    query?: string;
  } = {}
): LoanRepaymentRequest[] {
  if (!pos || !hasSupplierTransferPrivilege(pos, accounts)) {
    return [];
  }

  const { statusFilter = 'all', query = '' } = options;
  const q = query.trim().toLowerCase();

  return repaymentRequests.filter((req) => {
    if (!isLoanRepaymentDirectedToPosReceiver(req, pos, accounts)) return false;

    const confirmationStatus = req.receiverConfirmationStatus || 'pending';
    if (statusFilter !== 'all' && confirmationStatus !== statusFilter) {
      return false;
    }

    if (q) {
      const haystacks = [
        req.id,
        req.loanId,
        req.loanTransferNumber,
        req.posName,
        req.posCode,
        req.transferNumber,
        req.senderName,
        req.bankName,
        req.targetBankName || '',
        req.targetBankAccountNumber || '',
        req.targetAccountHolderName || '',
      ];
      if (!haystacks.some((v) => v.toLowerCase().includes(q))) {
        return false;
      }
    }

    return true;
  });
}

export function validateBankAccountInput(input: {
  bankName: string;
  accountNumber: string;
  iban?: string;
  country: string;
  accountHolderName: string;
  accountHolderEmail: string;
  canReceiveSupplierTransfers?: boolean;
  delegatedPosId?: string;
}): { valid: boolean; error?: string } {
  if (!input.bankName.trim()) {
    return { valid: false, error: 'يرجى إدخال اسم البنك.' };
  }
  if (!input.country.trim()) {
    return { valid: false, error: 'يرجى تحديد الدولة التي يقع فيها الحساب البنكي.' };
  }
  if (!input.accountHolderName.trim()) {
    return { valid: false, error: 'يرجى إدخال اسم صاحب الحساب البنكي.' };
  }
  const cleanEmail = normalizeEmail(input.accountHolderEmail);
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { valid: false, error: 'يرجى إدخال بريد إلكتروني صحيح لصاحب الحساب.' };
  }
  if (!input.accountNumber.trim() && !(input.iban || '').trim()) {
    return { valid: false, error: 'يرجى إدخال رقم الحساب البنكي أو رقم الآيبان (IBAN).' };
  }
  return { valid: true };
}

export interface BankEntryDraft {
  bankName: string;
  accountNumber: string;
  iban?: string;
  notes?: string;
}

export interface BatchBankAccountsInput {
  mode: 'employee' | 'client';
  country: string;
  accountHolderName: string;
  accountHolderEmail: string;
  accountHolderPhone?: string;
  employeePassword?: string;
  delegatedPosId?: string;
  isActive?: boolean;
  notes?: string;
  banks: BankEntryDraft[];
}

export function validateBatchBankAccountsInput(
  input: BatchBankAccountsInput
): { valid: boolean; error?: string } {
  if (!input.country.trim()) {
    return { valid: false, error: 'يرجى اختيار الدولة التي تقع فيها الحسابات البنكية أولاً.' };
  }
  if (input.mode === 'client' && !input.delegatedPosId?.trim()) {
    return { valid: false, error: 'يرجى اختيار العميل من قائمة عملاء المتجر أولاً.' };
  }
  if (!input.accountHolderName.trim()) {
    return {
      valid: false,
      error: input.mode === 'employee' ? 'يرجى إدخال الاسم الكامل للموظف.' : 'يرجى إدخال اسم صاحب الحساب البنكي.',
    };
  }
  const cleanEmail = normalizeEmail(input.accountHolderEmail);
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return {
      valid: false,
      error:
        input.mode === 'employee'
          ? 'يرجى إدخال بريد إلكتروني صحيح للموظف لتفعيل دخوله واستلام إشعارات الحوالات.'
          : 'يرجى إدخال بريد إلكتروني صحيح للعميل صاحب الحساب.',
    };
  }
  if (!input.banks || input.banks.length === 0) {
    return { valid: false, error: 'يرجى إضافة حساب بنكي واحد على الأقل.' };
  }
  for (let i = 0; i < input.banks.length; i += 1) {
    const bank = input.banks[i];
    if (!bank.bankName.trim()) {
      return { valid: false, error: `يرجى اختيار أو إدخال اسم البنك للحساب رقم ${i + 1}.` };
    }
    if (!bank.accountNumber.trim() && !(bank.iban || '').trim()) {
      return {
        valid: false,
        error: `يرجى إدخال رقم الحساب البنكي أو الآيبان (IBAN) لبنك (${bank.bankName.trim()}).`,
      };
    }
  }
  return { valid: true };
}

export function normalizeSearchText(value?: string): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

export function filterSupplierBankAccounts(
  accounts: SupplierBankAccount[],
  query: string,
  options: {
    posClients?: POSClient[];
    employees?: OfficeEmployee[];
  } = {}
): SupplierBankAccount[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return accounts;

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return accounts;

  const posClients = options.posClients || [];
  const employees = options.employees || [];

  return accounts.filter((acc) => {
    const matchedPos = resolveBankAccountReceiverPos(
      { ...acc, canReceiveSupplierTransfers: true },
      posClients
    );
    const matchedEmp = resolveBankAccountReceiverEmployee(
      { ...acc, canReceiveSupplierTransfers: true },
      employees
    );

    const isEmployeeHolder =
      acc.holderType === 'employee' || Boolean(acc.delegatedEmployeeId) || Boolean(matchedEmp);

    const fields = [
      acc.id,
      acc.bankName,
      acc.country,
      acc.accountHolderName,
      acc.accountHolderEmail,
      acc.accountHolderPhone || '',
      acc.accountNumber,
      acc.iban || '',
      acc.notes || '',
      acc.delegatedPosName || '',
      acc.delegatedPosCode || '',
      matchedPos?.tradeName || '',
      matchedPos?.ownerName || '',
      matchedPos?.posCode || '',
      matchedPos?.email || '',
      matchedPos?.phone || '',
      matchedEmployeeText(matchedEmp),
      acc.isPrimary ? 'حساب رئيسي اساسي' : '',
      acc.isActive !== false ? 'نشط مفعل متاح' : 'موقوف معطل',
      acc.canReceiveSupplierTransfers ? 'مخول مفوض استلام حوالات' : 'حساب متجر مباشر',
      isEmployeeHolder ? 'موظف استلام حوالات' : matchedPos ? 'عميل نقطه بيع' : 'متجر',
    ];

    const haystack = normalizeSearchText(fields.join(' '));
    return tokens.every((token) => haystack.includes(token));
  });
}

function matchedEmployeeText(emp?: OfficeEmployee): string {
  if (!emp) return '';
  return [emp.name, emp.email, emp.phone, emp.country || '', emp.roleTitle || ''].join(' ');
}


