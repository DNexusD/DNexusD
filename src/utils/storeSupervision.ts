import {
  AccountTier,
  AccountingEntry,
  AdminAccountingEntry,
  Catalog,
  DeliveryMethod,
  DepositRequest,
  DigitalService,
  LoanRepaymentRequest,
  Order,
  POSClient,
  Supplier,
  SupplierBankAccount,
  VoucherWarehouse,
} from '../types';
import {
  getLoanPaidAmount,
  getLoanRemainingAmount,
  isLoanDeposit,
  roundCurrency,
} from './loanRepayments';
import { normalizeStoreEmail } from './employeePermissions';

export function isSupplierActive(supplier?: Pick<Supplier, 'isActive'> | null): boolean {
  if (!supplier) return false;
  return supplier.isActive !== false;
}

export interface StoreSupervisionMetrics {
  storeClients: POSClient[];
  clientsCount: number;
  totalClientWalletsBalance: number;
  totalClientSpent: number;
  employeesCount: number;
  bankAccountsCount: number;
  storeOrders: Order[];
  ordersCount: number;
  completedOrdersCount: number;
  pendingOrdersCount: number;
  failedOrdersCount: number;
  totalCompletedSalesVolume: number;
  totalPlatformFeesFromOrders: number;
  totalPlatformFeesEarned: number;
  storeDeposits: DepositRequest[];
  approvedCashDepositsTotal: number;
  pendingCashDepositsCount: number;
  storeLoans: DepositRequest[];
  activeLoansCount: number;
  pendingLoansCount: number;
  totalLoansIssuedAmount: number;
  totalLoansRepaidAmount: number;
  totalLoansRemainingAmount: number;
  pendingLoanRepaymentsCount: number;
  storeServices: DigitalService[];
  servicesCount: number;
  activeServicesCount: number;
  storeCatalogsCount: number;
  storeWarehouses: VoucherWarehouse[];
  warehousesCount: number;
  availableVoucherCodesCount: number;
  usedVoucherCodesCount: number;
  storeAccountingEntries: AccountingEntry[];
  storeAdminAccountingEntries: AdminAccountingEntry[];
}

export function computeStoreSupervisionMetrics(params: {
  supplier: Supplier;
  posClients: POSClient[];
  orders: Order[];
  depositRequests: DepositRequest[];
  loanRepaymentRequests: LoanRepaymentRequest[];
  accountingEntries: AccountingEntry[];
  adminAccountingEntries: AdminAccountingEntry[];
  services: DigitalService[];
  voucherWarehouses: VoucherWarehouse[];
  catalogs: Catalog[];
  supplierBankAccounts?: SupplierBankAccount[];
}): StoreSupervisionMetrics {
  const {
    supplier,
    posClients,
    orders,
    depositRequests,
    loanRepaymentRequests,
    accountingEntries,
    adminAccountingEntries,
    services,
    voucherWarehouses,
    catalogs,
    supplierBankAccounts = [],
  } = params;

  const storeId = supplier.id;
  const storeClients = posClients.filter((c) => c.supplierId === storeId);
  const storeClientIdSet = new Set(storeClients.map((c) => c.id));

  const totalClientWalletsBalance = roundCurrency(
    storeClients.reduce((sum, c) => sum + (Number(c.walletBalance) || 0), 0)
  );
  const totalClientSpent = roundCurrency(
    storeClients.reduce((sum, c) => sum + (Number(c.totalSpent) || 0), 0)
  );

  const storeOrders = orders.filter((o) => o.supplierId === storeId);
  const completedOrders = storeOrders.filter((o) => o.status === 'completed');
  const pendingOrdersCount = storeOrders.filter(
    (o) => o.status === 'pending_supplier' || o.status === 'in_progress'
  ).length;
  const failedOrdersCount = storeOrders.filter((o) => o.status === 'failed').length;

  const totalCompletedSalesVolume = roundCurrency(
    completedOrders.reduce(
      (sum, o) => sum + (o.isFreeGiftOrder ? 0 : Number(o.costPrice) || 0),
      0
    )
  );
  const totalPlatformFeesFromOrders = roundCurrency(
    completedOrders.reduce((sum, o) => sum + (Number(o.feeAmount) || 0), 0)
  );

  const storeAdminAccountingEntries = adminAccountingEntries.filter(
    (e) => e.supplierId === storeId
  );
  const adminEntriesFeesEarned = roundCurrency(
    storeAdminAccountingEntries
      .filter((e) => e.type === 'fee_collected')
      .reduce((sum, e) => sum + (Number(e.feeAmount ?? e.credit) || 0), 0)
  );
  const totalPlatformFeesEarned =
    adminEntriesFeesEarned > 0 ? adminEntriesFeesEarned : totalPlatformFeesFromOrders;

  const storeAllRequests = depositRequests.filter((d) => d.supplierId === storeId);
  const storeDeposits = storeAllRequests.filter((d) => !isLoanDeposit(d));
  const approvedCashDepositsTotal = roundCurrency(
    storeDeposits
      .filter((d) => d.status === 'approved')
      .reduce((sum, d) => sum + (Number(d.amount) || 0), 0)
  );
  const pendingCashDepositsCount = storeDeposits.filter((d) => d.status === 'pending').length;

  const storeLoans = storeAllRequests.filter((d) => isLoanDeposit(d));
  const approvedLoans = storeLoans.filter((d) => d.status === 'approved');
  const pendingLoansCount = storeLoans.filter((d) => d.status === 'pending').length;
  const activeLoansCount = approvedLoans.filter((l) => getLoanRemainingAmount(l) > 0).length;
  const totalLoansIssuedAmount = roundCurrency(
    approvedLoans.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
  );
  const totalLoansRepaidAmount = roundCurrency(
    approvedLoans.reduce((sum, l) => sum + getLoanPaidAmount(l), 0)
  );
  const totalLoansRemainingAmount = roundCurrency(
    approvedLoans.reduce((sum, l) => sum + getLoanRemainingAmount(l), 0)
  );

  const pendingLoanRepaymentsCount = loanRepaymentRequests.filter(
    (r) => r.supplierId === storeId && r.status === 'pending'
  ).length;

  const storeServices = services.filter((s) => s.supplierId === storeId);
  const activeServicesCount = storeServices.filter((s) => s.isActive !== false).length;
  const storeCatalogsCount = catalogs.filter(
    (c) => c.supplierId === storeId || c.supplierId === 'all' || c.isFixedByAdmin
  ).length;

  const storeWarehouses = voucherWarehouses.filter((w) => w.supplierId === storeId);
  const availableVoucherCodesCount = storeWarehouses.reduce(
    (sum, w) => sum + (Array.isArray(w.codes) ? w.codes.length : 0),
    0
  );
  const usedVoucherCodesCount = storeWarehouses.reduce(
    (sum, w) => sum + (Number(w.usedCodesCount) || 0),
    0
  );

  const storeAccountingEntries = accountingEntries.filter(
    (e) =>
      e.supplierId === storeId ||
      (!e.supplierId && Boolean(e.posId) && storeClientIdSet.has(e.posId))
  );

  const bankAccountsCount = supplierBankAccounts.filter((b) => b.supplierId === storeId).length;

  return {
    storeClients,
    clientsCount: storeClients.length,
    totalClientWalletsBalance,
    totalClientSpent,
    employeesCount: Array.isArray(supplier.employees) ? supplier.employees.length : 0,
    bankAccountsCount,
    storeOrders,
    ordersCount: storeOrders.length,
    completedOrdersCount: completedOrders.length,
    pendingOrdersCount,
    failedOrdersCount,
    totalCompletedSalesVolume,
    totalPlatformFeesFromOrders,
    totalPlatformFeesEarned,
    storeDeposits,
    approvedCashDepositsTotal,
    pendingCashDepositsCount,
    storeLoans,
    activeLoansCount,
    pendingLoansCount,
    totalLoansIssuedAmount,
    totalLoansRepaidAmount,
    totalLoansRemainingAmount,
    pendingLoanRepaymentsCount,
    storeServices,
    servicesCount: storeServices.length,
    activeServicesCount,
    storeCatalogsCount,
    storeWarehouses,
    warehousesCount: storeWarehouses.length,
    availableVoucherCodesCount,
    usedVoucherCodesCount,
    storeAccountingEntries,
    storeAdminAccountingEntries,
  };
}

export function filterSuppliersForAdmin(
  suppliers: Supplier[],
  query: string,
  statusFilter: 'all' | 'active' | 'suspended' = 'all'
): Supplier[] {
  const q = query.trim().toLowerCase();
  return suppliers.filter((s) => {
    const active = isSupplierActive(s);
    if (statusFilter === 'active' && !active) return false;
    if (statusFilter === 'suspended' && active) return false;
    if (!q) return true;
    const haystack = [
      s.name,
      s.storeName,
      s.email,
      s.phone,
      s.country,
      s.city,
      s.bankAccountDetails?.bankName,
      s.bankAccountDetails?.iban,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function filterStoreClientsForAdmin(
  clients: POSClient[],
  query: string,
  tierFilter: AccountTier | 'all' = 'all'
): POSClient[] {
  const q = query.trim().toLowerCase();
  return clients.filter((c) => {
    if (tierFilter !== 'all' && c.tier !== tierFilter) return false;
    if (!q) return true;
    const haystack = [
      c.tradeName,
      c.ownerName,
      c.posCode,
      c.phone,
      c.servicePhone,
      c.email,
      c.country,
      c.city,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function filterStoreOrdersForAdmin(
  orders: Order[],
  filters: {
    clientId?: string;
    status?: 'all' | Order['status'];
    deliveryMethod?: 'all' | DeliveryMethod;
    dateFrom?: string;
    dateTo?: string;
    query?: string;
  }
): Order[] {
  const q = (filters.query || '').trim().toLowerCase();
  return orders.filter((o) => {
    if (filters.clientId && filters.clientId !== 'all' && o.posId !== filters.clientId) {
      return false;
    }
    if (filters.status && filters.status !== 'all' && o.status !== filters.status) {
      return false;
    }
    if (
      filters.deliveryMethod &&
      filters.deliveryMethod !== 'all' &&
      o.deliveryMethod !== filters.deliveryMethod
    ) {
      return false;
    }
    const orderDate = (o.date || '').substring(0, 10);
    if (filters.dateFrom && orderDate < filters.dateFrom) return false;
    if (filters.dateTo && orderDate > filters.dateTo) return false;
    if (!q) return true;
    const haystack = [
      o.id,
      o.serviceName,
      o.packageName,
      o.posName,
      o.posCode,
      o.customerName,
      o.customerPhone,
      o.deliveryDetails?.playerId,
      o.deliveryDetails?.accountEmail,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function filterStoreAccountingEntriesForAdmin(
  entries: AccountingEntry[],
  filters: {
    clientId?: string;
    dateFrom?: string;
    dateTo?: string;
    query?: string;
  }
): AccountingEntry[] {
  const q = (filters.query || '').trim().toLowerCase();
  return entries.filter((e) => {
    if (filters.clientId && filters.clientId !== 'all' && e.posId !== filters.clientId) {
      return false;
    }
    const entryDate = (e.date || '').substring(0, 10);
    if (filters.dateFrom && entryDate < filters.dateFrom) return false;
    if (filters.dateTo && entryDate > filters.dateTo) return false;
    if (!q) return true;
    const haystack = [
      e.id,
      e.referenceId,
      e.description,
      e.customerName,
      e.serviceName,
      e.type,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function getClientLoanSummaryForStore(
  depositRequests: DepositRequest[],
  posId: string,
  supplierId: string
): { activeLoansCount: number; remainingDebt: number } {
  const clientLoans = depositRequests.filter(
    (d) =>
      d.posId === posId &&
      d.supplierId === supplierId &&
      d.status === 'approved' &&
      isLoanDeposit(d)
  );
  const remainingDebt = roundCurrency(
    clientLoans.reduce((sum, l) => sum + getLoanRemainingAmount(l), 0)
  );
  const activeLoansCount = clientLoans.filter((l) => getLoanRemainingAmount(l) > 0).length;
  return { activeLoansCount, remainingDebt };
}

export function isEmailUsedByOtherAccount(
  candidateEmail: string,
  params: {
    currentSupplierId: string;
    suppliers: Supplier[];
    posClients: POSClient[];
    superAdminEmail?: string;
    adminAccounts?: Array<{ email: string }>;
  }
): boolean {
  const clean = normalizeStoreEmail(candidateEmail);
  if (!clean) return false;

  if (params.superAdminEmail && normalizeStoreEmail(params.superAdminEmail) === clean) {
    return true;
  }
  if ((params.adminAccounts || []).some((a) => normalizeStoreEmail(a.email) === clean)) {
    return true;
  }
  for (const sup of params.suppliers) {
    if (sup.id !== params.currentSupplierId && normalizeStoreEmail(sup.email) === clean) {
      return true;
    }
    if ((sup.employees || []).some((emp) => normalizeStoreEmail(emp.email) === clean)) {
      return true;
    }
  }
  if (params.posClients.some((c) => normalizeStoreEmail(c.email) === clean)) {
    return true;
  }
  return false;
}
