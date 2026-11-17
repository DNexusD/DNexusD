export type UserRole = 'pos_client' | 'supplier' | 'super_admin' | 'employee';

export interface EmployeePermissions {
  // 1. الشحن مع تحديد النوع
  canManageOrders?: boolean;
  canManagePlayerIdOrders?: boolean;
  canManageAccountOrders?: boolean;
  canManageVoucherOrders?: boolean;

  // 2. طلبات الرصيد مع تحديد سلفة أو حوالة
  canReviewDeposits?: boolean;
  canReviewCashDeposits?: boolean;
  canReviewLoanDeposits?: boolean;

  // 3. إضافة الكتالوجات والخدمات
  canManageCatalogs?: boolean;
  canAddCatalogs?: boolean;
  canAddServices?: boolean;

  // 4. تحديد أسعار الخدمات
  canEditServicePrices?: boolean;

  // 5. تغذية الأكواد
  canManageVoucherStock?: boolean;

  // 6. الاطلاع على العملاء وترقيتهم
  canManageClients?: boolean;
  canViewClients?: boolean;
  canUpgradeClientTiers?: boolean;

  // 7. إضافة الموظفين
  canManageEmployees?: boolean;

  // 8. إدارة الحسابات البنكية وتفويض استلام الحوالات
  canManageBankAccounts?: boolean;
}

export interface AdminPermissions {
  canViewStatement?: boolean;
  canSettleAdminWallet?: boolean;
  canManageSuppliers?: boolean;
  canManageFees?: boolean;
  canManageInterfaceSettings?: boolean;
  canManageAdminAccounts?: boolean;
  canClearSystemData?: boolean;
}

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  password?: string;
  phone: string;
  roleTitle: string;
  permissions: AdminPermissions;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  associatedId?: string; // posId or supplierId
  supplierId?: string; // For employee: store ID they belong to
  employeeId?: string;
  adminAccountId?: string; // For sub-admin accounts created by Super Admin
  roleTitle?: string;
  permissions?: EmployeePermissions;
  adminPermissions?: AdminPermissions;
}

export type AccountTier = 'regular' | 'bronze' | 'silver' | 'gold' | 'vip';

export interface TierInfo {
  id: AccountTier;
  nameAr: string;
  badgeColor: string;
  borderColor: string;
  textColor: string;
  discountNote: string;
}

export const TIERS_CONFIG: Record<AccountTier, TierInfo> = {
  regular: {
    id: 'regular',
    nameAr: 'عادي',
    badgeColor: 'bg-slate-700/50',
    borderColor: 'border-slate-600',
    textColor: 'text-slate-300',
    discountNote: 'السعر الأساسي بدون خصم'
  },
  bronze: {
    id: 'bronze',
    nameAr: 'نحاسي',
    badgeColor: 'bg-amber-900/30',
    borderColor: 'border-amber-700/60',
    textColor: 'text-amber-500',
    discountNote: 'خصم البرونز 10%'
  },
  silver: {
    id: 'silver',
    nameAr: 'فضي',
    badgeColor: 'bg-slate-400/20',
    borderColor: 'border-slate-300/50',
    textColor: 'text-slate-200',
    discountNote: 'خصم الفضي 20%'
  },
  gold: {
    id: 'gold',
    nameAr: 'ذهبي',
    badgeColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/60',
    textColor: 'text-yellow-400',
    discountNote: 'خصم الذهبي 30%'
  },
  vip: {
    id: 'vip',
    nameAr: 'مميز VIP',
    badgeColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/60',
    textColor: 'text-purple-300',
    discountNote: 'أعلى نسبة خصم 40%'
  }
};

export type DeliveryMethod = 'player_id' | 'account_login' | 'voucher_code';

export interface DeliveryMethodInfo {
  id: DeliveryMethod;
  nameAr: string;
  descriptionAr: string;
  iconName: string;
}

export type TierPrices = {
  regular: number;
  bronze: number;
  silver: number;
  gold: number;
  vip: number;
};

export type WarehousePurchaseUnit = 'single_code' | 'package';

export interface ServicePackage {
  id: string;
  name: string;
  description?: string;
  tierPrices: TierPrices;
  availableStock?: number;
  vouchers?: string[];
  warehouseId?: string;
  allowSingleCodePurchase?: boolean;
  allowPackagePurchase?: boolean;
  packageCodesCount?: number;
  packageNameAr?: string;
  packageTierPrices?: TierPrices;
}

export interface VoucherWarehouse {
  id: string;
  supplierId: string;
  nameAr: string;
  categoryName: string;
  catalogId?: string;
  description?: string;
  codes: string[];
  usedCodesCount: number;
  lowStockThreshold?: number; // Minimum stock alert threshold for this category/warehouse (e.g. 5)
  linkedServiceId?: string;
  linkedPackageId?: string;
  isPublishedAsService: boolean;
  allowSingleCodePurchase?: boolean;
  allowPackagePurchase?: boolean;
  packageCodesCount?: number;
  packageNameAr?: string;
  tierPrices: TierPrices;
  packageTierPrices?: TierPrices;
  createdAt: string;
  updatedAt?: string;
}

export interface Catalog {
  id: string;
  supplierId: string;
  nameAr: string;
  descriptionAr: string;
  icon: string;
  serviceCount?: number;
  isFreeGiftsCatalog?: boolean;
  isFixedByAdmin?: boolean;
}

export interface DigitalService {
  id: string;
  catalogId: string;
  supplierId: string;
  nameAr: string;
  descriptionAr: string;
  icon: string;
  imageUrl?: string;
  deliveryMethods: DeliveryMethod[];
  packages: ServicePackage[];
  isActive: boolean;
  giftTargetType?: 'all_tiers' | 'specific_tiers' | 'specific_clients';
  giftTargetTiers?: AccountTier[];
  giftTargetPosIds?: string[];
}

export interface POSClient {
  id: string;
  posCode: string; // e.g. "RYD-84920" (3 letters - 5 digits)
  tradeName: string; // اسم المحل التجاري
  ownerName: string; // اسم العميل
  phone: string;
  servicePhone?: string; // رقم الهاتف للخدمات والدعم الفني
  email?: string; // البريد الإلكتروني لنقطة البيع
  logoUrl?: string; // رابط الشعار أو صورة المتجر
  country: string;
  city: string;
  supplierId: string;
  tier: AccountTier;
  walletBalance: number; // رصيد المحفظة المسبق
  totalSpent: number;
  ordersCount: number;
  createdAt: string;
  qrCodeValue: string;
  canReceiveSupplierTransfers?: boolean;
  canRequestLoans?: boolean; // هل يمتلك صلاحية طلب السلف والرصيد الآجل من المتجر
  canGetBonus?: boolean; // هل يمتلك ميزة الحصول على بونص
  canViewGifts?: boolean; // هل يمتلك ميزة ظهور الهدايا والعروض المجانية
  pendingGiftFees?: number; // رسوم تطبيق مؤجلة من هدايا مجانية لحين شحن المحفظة (لا تظهر للعميل كمديونية)
  usedGiftServiceIds?: string[]; // معرفات خدمات الهدايا المجانية المستخدمة والمكتملة لإخفائها من واجهة العميل
}

export interface FeeConfig {
  feeType: 'percentage' | 'fixed' | 'both';
  percentage: number; // e.g. 1.0%
  fixedAmount: number; // e.g. 1.00 SAR
}

export interface OfficeEmployee {
  id: string;
  supplierId: string;
  name: string;
  email: string;
  password?: string;
  phone: string;
  country?: string;
  roleTitle: string;
  isTransferReceiverOnly?: boolean;
  permissions: EmployeePermissions;
  createdAt: string;
}

export interface SupplierCustomSocialLink {
  id: string;
  label: string;
  url: string;
}

export interface SupplierSocialLinks {
  whatsapp?: string;
  telegram?: string;
  instagram?: string;
  facebook?: string;
  x?: string;
  tiktok?: string;
  youtube?: string;
  snapchat?: string;
  website?: string;
  customLinks?: SupplierCustomSocialLink[];
}

export interface Supplier {
  id: string;
  name: string;
  storeName: string;
  phone: string;
  email: string;
  feePercentage: number; // Backward compatibility / primary %
  fixedFeeAmount: number; // Primary fixed fee
  feeType: 'percentage' | 'fixed' | 'both';
  walletBalance: number;
  logoUrl?: string; // رابط شعار المتجر
  country?: string; // الدولة
  city?: string; // المدينة
  socialLinks?: SupplierSocialLinks;
  bankAccountDetails: {
    bankName: string;
    accountHolder: string;
    iban: string;
    accountNumber: string;
  };
  createdAt: string;
  qrCodeValue?: string;
  employees?: OfficeEmployee[];
}

export interface SuperAdmin {
  name: string;
  email: string;
  walletBalance: number; // Platform fees collected
  defaultFeePercentage: number; // default 1%
  defaultFixedFeeAmount: number; // default 0.00 or custom SAR
  defaultFeeType: 'percentage' | 'fixed' | 'both';
  bankAccounts: {
    bankName: string;
    iban: string;
    accountHolder: string;
  }[];
  adminAccounts?: AdminAccount[];
}

export interface DropdownOptionItem {
  id: string;
  value: string;
  labelAr: string;
  isSystem?: boolean;
  isActive: boolean;
}

export type PlatformDropdownListKey =
  | 'statementTransactionTypes'
  | 'adminStatementTransactionTypes'
  | 'approvedBankNames';

export interface PlatformInterfaceSettings {
  supplierInterfaceNotice: string;
  showSupplierInterfaceNotice: boolean;
  posInterfaceNotice: string;
  showPosInterfaceNotice: boolean;
  allowSuppliersCreateCustomCatalogs: boolean;
  showResaleMarginInPosPurchase: boolean;
  showTierComparisonInPosStore: boolean;
  statementTransactionTypes: DropdownOptionItem[];
  adminStatementTransactionTypes: DropdownOptionItem[];
  approvedBankNames: DropdownOptionItem[];
  updatedAt?: string;
}

export type LoanPaymentMethod = 'wallet' | 'bank_transfer';

export interface LoanPaymentRecord {
  id: string;
  amount: number;
  date: string;
  method: LoanPaymentMethod;
  transferNumber?: string;
  bankName?: string;
  senderName?: string;
  notes?: string;
  repaymentRequestId?: string;
  approvedBy?: string;
  transferReceiptImage?: string;
  targetBankName?: string;
}

export interface LoanRepaymentRequest {
  id: string;
  loanId: string;
  loanTransferNumber: string;
  loanDate: string;
  loanTotalAmount: number;
  loanPaidBefore: number;
  loanRemainingBefore: number;
  loanReason?: string;
  posId: string;
  posName: string;
  posCode: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  transferNumber: string;
  bankName: string;
  senderName: string;
  notes?: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt?: string;
  approvedAmount?: number;
  rejectionReason?: string;
  transferReceiptImage?: string;
  transferReceiptFileName?: string;
  targetBankAccountId?: string;
  targetBankName?: string;
  targetBankAccountNumber?: string;
  targetIban?: string;
  targetBankAccountCountry?: string;
  targetAccountHolderName?: string;
  targetAccountHolderEmail?: string;
  receiverPosId?: string;
  receiverPosName?: string;
  receiverPosCode?: string;
  receiverPosEmail?: string;
  receiverEmployeeId?: string;
  receiverConfirmationStatus?: ReceiverConfirmationStatus;
  receiverConfirmedAt?: string;
  receiverConfirmedByName?: string;
  receiverConfirmationNote?: string;
}

export interface WalletLoanRepaymentReceipt {
  loanId: string;
  loanTransferNumber: string;
  loanDate: string;
  paymentId: string;
  date: string;
  amountPaid: number;
  totalLoanAmount: number;
  paidBefore: number;
  paidAfter: number;
  remainingAfter: number;
  newState: 'unpaid' | 'partial' | 'repaid';
  clientId: string;
  clientName: string;
  clientPosCode: string;
  clientBalanceBefore: number;
  clientBalanceAfter: number;
  supplierId: string;
  supplierName: string;
  supplierStoreName: string;
  supplierBalanceBefore: number;
  supplierBalanceAfter: number;
}

export type ReceiverConfirmationStatus = 'pending' | 'confirmed' | 'rejected';

export interface SupplierBankAccount {
  id: string;
  supplierId: string;
  bankName: string;
  accountNumber: string;
  iban?: string;
  country: string;
  accountHolderName: string;
  accountHolderEmail: string;
  accountHolderPhone?: string;
  holderType?: 'employee' | 'client' | 'supplier';
  delegatedPosId?: string;
  delegatedPosName?: string;
  delegatedPosCode?: string;
  delegatedEmployeeId?: string;
  canReceiveSupplierTransfers: boolean;
  isPrimary?: boolean;
  isActive: boolean;
  currency?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DepositRequest {
  id: string;
  posId: string;
  posName: string;
  posCode: string;
  supplierId: string;
  amount: number;
  transferNumber: string; // رقم الحوالة أو مرجع السلفة
  transferSenderName: string; // اسم المحول أو طالب السلفة
  bankName: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  requestType?: 'cash' | 'loan'; // 'cash': إيداع بنكي/كاش، 'loan': طلب سلفة / رصيد آجل
  loanReason?: string; // سبب طلب السلفة
  loanRepaidStatus?: 'unpaid' | 'partial' | 'repaid'; // حالة تسديد السلفة للمتجر
  paidAmount?: number; // إجمالي المبلغ المسدد من السلفة
  repaidPayments?: LoanPaymentRecord[]; // سجل الدفعات المسددة من السلفة
  repaidAt?: string; // تاريخ إتمام تسديد السلفة بالكامل
  // الوجهة البنكية المختارة وتأكيد نقطة البيع المخوّلة باستلام الحوالة
  targetBankAccountId?: string;
  targetBankName?: string;
  targetBankAccountNumber?: string;
  targetIban?: string;
  targetBankAccountCountry?: string;
  targetAccountHolderName?: string;
  targetAccountHolderEmail?: string;
  receiverPosId?: string;
  receiverPosName?: string;
  receiverPosCode?: string;
  receiverPosEmail?: string;
  receiverEmployeeId?: string;
  receiverConfirmationStatus?: ReceiverConfirmationStatus;
  receiverConfirmedAt?: string;
  receiverConfirmedByName?: string;
  receiverConfirmationNote?: string;
  transferReceiptImage?: string; // صورة إيصال الحوالة البنكية بصيغة Base64 Data URL (إلزامية للإيداع)
  transferReceiptFileName?: string; // اسم ملف الصورة المرفق
}

export interface Order {
  id: string;
  date: string;
  posId: string;
  posCode: string;
  posName: string;
  supplierId: string;
  serviceId: string;
  serviceName: string;
  packageId: string;
  packageName: string;
  purchaseUnit?: WarehousePurchaseUnit;
  quantityCodes?: number;
  deliveryMethod: DeliveryMethod;
  deliveryDetails: {
    playerId?: string;
    playerNickname?: string;
    accountEmail?: string;
    accountPassword?: string;
    verificationCodeEntered?: string;
    supplierReplyMessage?: string;
    voucherCode?: string;
    voucherCodes?: string[];
    gameTransactionRef?: string;
    inGameChargeStatus?: 'waiting_charge' | 'charging_in_game' | 'completed_in_game';
    clientOtpReadConfirmation?: boolean;
    clientOtpReadAt?: string;
  };
  costPrice: number; // Reseller price from tier
  salePriceToCustomer?: number; // Optional resale price
  feeAmount: number; // Platform fee
  totalDeducted: number; // costPrice + feeAmount
  isFreeGiftOrder?: boolean;
  deferredFeeAmount?: number;
  deferredFeeSettled?: boolean;
  paymentMethod: 'wallet' | 'visa';
  status: 'completed' | 'in_progress' | 'pending_supplier' | 'failed';
  supplierNotes?: string;
  completedAt?: string;
  customerName?: string;
  customerPhone?: string;
}

export interface BalanceTransfer {
  id: string;
  date: string;
  fromPosId: string;
  fromPosName: string;
  fromPosCode: string;
  toPosCode: string;
  toPosName: string;
  amount: number;
  feeAmount: number;
  totalDeducted: number;
  status: 'completed' | 'failed';
}

export type StatementFilter = 'all' | 'sales' | 'purchases' | 'deposits' | 'transfers' | 'loans' | 'by_customer' | 'by_service';

export type AdminStatementFilter = 'all' | 'deposits' | 'fees' | 'settlements' | 'transfers' | 'by_supplier' | 'by_service';

export interface AccountingEntry {
  id: string;
  date: string;
  type: 'purchase' | 'sale' | 'deposit' | 'transfer_out' | 'transfer_in' | 'fee';
  referenceId: string;
  posId: string;
  supplierId?: string;
  description: string;
  debit: number; // مدين (خصم)
  credit: number; // دائن (إيداع)
  balanceAfter: number;
  customerName?: string;
  serviceName?: string;
}

export interface AdminAccountingEntry {
  id: string;
  date: string;
  type: 'fee_collected' | 'deposit_received' | 'bank_settlement' | 'agent_transfer';
  referenceId: string;
  supplierId?: string;
  supplierName?: string;
  serviceId?: string;
  serviceName?: string;
  posId?: string;
  posCode?: string;
  posName?: string;
  description: string;
  feeAmount: number; // مبلغ الرسوم المكتسبة
  grossAmount?: number; // قيمة العملية الأصلية
  debit: number; // مدين (خصم من محفظة المدير، مثل التسوية البنكية أو التحويل للوكيل)
  credit: number; // دائن (إيداع/رسوم مكتسبة تضاف لمحفظة المدير)
  balanceAfter: number; // رصيد محفظة المدير بعد العملية
  notes?: string;
}

export interface InviteLink {
  id: string;
  code: string;
  supplierId: string;
  supplierName: string;
  targetTier: AccountTier;
  createdAt: string;
  usedCount: number;
  url: string;
}

export type NotificationType =
  | 'order_status'
  | 'deposit'
  | 'loan'
  | 'loan_repayment'
  | 'tier_upgrade'
  | 'announcement'
  | 'transfer'
  | 'receiver_confirmation'
  | 'low_stock';

export interface AppNotification {
  id: string;
  posId?: string;
  posName?: string;
  posCode?: string;
  supplierId?: string;
  supplierName?: string;
  targetRole?: 'pos' | 'supplier' | 'all';
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  orderId?: string;
  depositId?: string;
  loanId?: string;
  repaymentRequestId?: string;
  warehouseId?: string;
  categoryName?: string;
  remainingStock?: number;
  lowStockThreshold?: number;
  amount?: number;
  actionTab?:
    | 'catalogs'
    | 'pending_orders'
    | 'account_orders'
    | 'deposits'
    | 'loans'
    | 'bank_accounts'
    | 'clients'
    | 'vouchers'
    | 'client_statements'
    | 'employees'
    | 'notifications';
}

// ==================== 3-TIER HIERARCHICAL DATABASE TYPES ====================

export interface CrossTierSyncAudit {
  syncId: string;
  timestamp: string;
  action: 'profile_updated' | 'purchase_completed' | 'balance_transfer' | 'deposit_request' | 'deposit_approved' | 'tier_promoted' | 'service_created';
  title: string;
  posId?: string;
  posCode?: string;
  posTradeName?: string;
  supplierId?: string;
  supplierName?: string;
  adminRefId: string;
  amount?: number;
  syncState: 'synced_across_all_3_tiers';
  details: string;
}

export interface ClientDatabasePartition {
  partitionKey: string; // "client_db_{posId}"
  posId: string;
  clientInfo: POSClient;
  walletBalance: number;
  transactionsCount: number;
  orders: Order[];
  transfers: BalanceTransfer[];
  deposits: DepositRequest[];
  lastSyncedAt: string;
}

export interface SupplierDatabasePartition {
  partitionKey: string; // "supplier_db_{supplierId}"
  supplierId: string;
  supplierInfo: Supplier;
  walletBalance: number;
  assignedClients: POSClient[];
  catalogs: Catalog[];
  services: DigitalService[];
  pendingOrders: Order[];
  completedOrders: Order[];
  depositRequests: DepositRequest[];
  salesLedger: AccountingEntry[];
  lastSyncedAt: string;
}

export interface AdminMasterDatabase {
  partitionKey: string; // "admin_master_db"
  systemName: string;
  superAdmin: SuperAdmin;
  totalSuppliersCount: number;
  totalPosClientsCount: number;
  totalOrdersCount: number;
  totalPlatformFeesCollected: number;
  suppliersRegistry: Supplier[];
  clientsMasterRegistry: POSClient[];
  globalOrdersRegistry: Order[];
  globalAuditLedger: CrossTierSyncAudit[];
  adminAccounting: AdminAccountingEntry[];
  lastSyncedAt: string;
}
