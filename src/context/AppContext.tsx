import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  UserRole, 
  AccountTier, 
  POSClient, 
  Supplier, 
  SuperAdmin, 
  Catalog, 
  DigitalService, 
  DepositRequest, 
  LoanRepaymentRequest,
  LoanPaymentRecord,
  Order, 
  AccountingEntry, 
  AdminAccountingEntry,
  InviteLink,
  InviteLinkFeatures,
  TIERS_CONFIG,
  DeliveryMethod,
  ServicePackage,
  AuthUser,
  OfficeEmployee,
  EmployeePermissions,
  AppNotification,
  WalletLoanRepaymentReceipt,
  SupplierBankAccount,
  ReceiverConfirmationStatus,
  DropdownOptionItem,
  PlatformDropdownListKey,
  PlatformInterfaceSettings,
  AdminAccount,
  AdminPermissions,
  VoucherWarehouse,
  TierPrices,
  WarehousePurchaseUnit,
  CurrencyCode,
  PlatformFeesConfig
} from '../types';
import {
  convertCurrencyToSar,
  convertSarToCurrency,
  formatCurrencyAmount,
  getCurrencyShortLabel,
  normalizeCurrencyCode,
  normalizeExchangeRateSarPerUsd
} from '../utils/currency';
import {
  deductPackageStock,
  getPackagesForDeliveryMethod,
  mergeCodesIntoWarehouse,
  mergeWarehouseOptionsIntoPackage,
  parseVoucherCodesInput,
  resolvePackagePurchaseOptions,
  syncWarehouseIntoService
} from '../utils/voucherWarehouses';
import {
  getFirstAllowedAdminTab,
  resolveEffectiveAdminPermissions,
  validateAdminAccountInput
} from '../utils/adminAccounts';
import {
  filterSupplierNotificationsForEmployee,
  getFirstAllowedSupplierTab,
  isEmployeeActive,
  isOrderVisibleToEmployee,
  normalizeEmployeePermissions,
  normalizeStoreEmail,
  resolveEffectiveEmployeePermissions,
  resolveStoreActorByEmail,
  sanitizeServiceUpdatesForEmployeePermissions,
  validateOfficeEmployeeInput,
  verifyEmployeeCredentials
} from '../utils/employeePermissions';
import {
  DEFAULT_PLATFORM_INTERFACE_SETTINGS,
  mergePlatformSettings,
  normalizeDropdownValue
} from '../utils/platformSettings';
import {
  getLoanPaidAmount,
  getLoanRemainingAmount,
  validateWalletRepayment,
  validateBankTransferRepayment,
  applyLoanPaymentToLoan,
  buildWalletLoanRepaymentReceipt,
  roundCurrency
} from '../utils/loanRepayments';
import {
  BatchBankAccountsInput,
  getActiveBankAccountsForDeposit,
  resolveBankAccountReceiverEmployee,
  resolveBankAccountReceiverPos,
  validateBankAccountInput,
  validateBatchBankAccountsInput,
  normalizeEmail,
  isAccountAssignedToPos
} from '../utils/bankAccounts';
import {
  appendUsedGiftServiceId,
  calculateFeeFromRule,
  calculateServicePurchasePricing,
  createDefaultPlatformFeesConfig,
  evaluateClientGiftServiceStatus,
  getEffectivePlatformFeesConfig,
  isCatalogFreeGifts,
  normalizePlatformFeesConfig,
  resolveGiftClaimFeePayment,
  resolveSpecificServiceFeeRule,
  settlePendingGiftFeesOnRecharge,
  sumPendingUnsettledClientFees,
} from '../utils/pricing';
import { sanitizeSupplierSocialLinks } from '../utils/socialLinks';
import {
  mapPasswordResetErrorAr,
  validateResetPasswordInput
} from '../utils/passwordReset';
import {
  initialSuperAdmin
} from '../data/mockData';
import {
  CLEAN_BOOT_STORAGE_FLAG,
  EMPTY_POS_FALLBACK,
  EMPTY_SUPPLIER_FALLBACK,
  MASTER_ADMIN_EMAILS,
  ensureCleanBootLocalStorageOnce,
  filterPreservedFixedCatalogs,
  isPreservedAdminAuthUser,
  sanitizeLocalStorageForCleanReset
} from '../utils/systemReset';
import {
  buildAuthUserFromIdentity,
  canSwitchRole,
  canSwitchToPosClient,
  canSwitchToSupplier,
  checkEmailRegistrationConflict,
  evaluateEmployeeLoginEligibility,
  evaluatePosClientLoginEligibility,
  filterNotificationsForPosClient,
  findPosClientsForEmail,
  isNotificationForPosClient,
  isPosClientActive,
  mapUnregisteredFirebaseAuthLoginErrorAr,
  resolveAccountIdentityByEmail,
  resolveAuthoritativeIdentityFromFirestore,
  resolveOrphanedAuthRecovery,
  resolveScopedCurrentPos,
  resolveScopedSupplier
} from '../utils/accountAuth';
import {
  isEmailUsedByOtherAccount,
  isSupplierActive
} from '../utils/storeSupervision';
import confetti from 'canvas-confetti';
import {
  testConnection,
  reconnectFirestore,
  subscribeFirestoreRecovery,
  safeOnSnapshot,
  auth,
  googleProvider,
  db,
  handleSnapshotError,
  OperationType,
  ConnectionTestResult,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset
} from '../services/firebase';
import { isNavigatorOffline } from '../utils/firestoreConnectivity';
import {
  clearEntityPendingSync,
  readPendingSyncMap,
  readSyncedIdsMap,
  reconcileCollectionWithRemote,
  reconcilePlatformSettingsWithRemote,
  reconcileSuperAdminWithRemote,
  SyncedIdsMap,
  writeSyncedIdsMap
} from '../utils/localFirestoreSync';
import {
  buildInviteUrl,
  buildPosClientInviteDefaults,
  getEnabledInviteFeatureLabels,
  isInviteLinkActive,
  normalizeInviteFeatures,
  parseInviteCodeFromInput,
  resolveValidInviteLink,
} from '../utils/inviteLinks';
import {
  canSupplierInspectPosInterface,
  getPosUpgradeStatus,
  hasClientApprovedPosUpgrade,
} from '../utils/posAccreditation';
import { signInWithPopup, signOut as fbSignOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, doc } from 'firebase/firestore';
import { firestoreSync } from '../services/firestoreSync';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

interface AppContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  viewMode: 'mobile_frame' | 'responsive';
  setViewMode: (mode: 'mobile_frame' | 'responsive') => void;
  activeNavTab: string;
  setActiveNavTab: (tab: string) => void;

  // Multi-Currency & Merchant Exchange Rate
  activeCurrency: CurrencyCode;
  activeExchangeRate: number;
  currencyLabel: string;
  setActiveCurrency: (currency: CurrencyCode) => void;
  updateSupplierExchangeRate: (rateSarPerUsd: number) => boolean;
  formatCurrency: (
    amountSar: number,
    opts?: { decimals?: number; includeSymbol?: boolean; withGrouping?: boolean; sign?: 'credit' | 'debit' }
  ) => string;
  convertFromSar: (amountSar: number) => number;
  convertToSar: (amountInActiveCurrency: number) => number;

  // Firebase Firestore Status & Sync
  isFirestoreConnected: boolean;
  isSyncingWithFirestore: boolean;
  lastFirestoreSyncAt: string | null;
  databaseSyncMessage: string | null;
  isSupplierSelectionRequired: boolean;
  setIsSupplierSelectionRequired: (required: boolean) => void;
  syncAllToFirestore: () => Promise<void>;
  clearUsersSuppliersAndClientsData: () => Promise<void>;
  checkDatabaseConnection: () => Promise<ConnectionTestResult>;
  ensureDatabaseConnectedAndSynced: (options?: {
    forceSync?: boolean;
    silent?: boolean;
  }) => Promise<{
    connected: boolean;
    synced: boolean;
    pushedCount: number;
    message: string;
    error?: string;
  }>;

  // Authentication State & Actions
  isAuthenticated: boolean;
  currentUser: AuthUser | null;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  sendLoginOtp: (email: string) => Promise<{ success: boolean; code?: string; error?: string; remainingSeconds?: number; email?: string; cooldownSeconds?: number }>;
  verifyLoginOtpAndLogin: (email: string, password: string, otpCode?: string) => Promise<{ success: boolean; error?: string }>;
  registerAccount: (params: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    phone?: string;
    tradeName?: string;
    supplierId?: string;
    inviteCode?: string;
  }) => Promise<{ success: boolean; error?: string; code?: string }>;
  requestPasswordReset: (email: string) => Promise<{
    success: boolean;
    message: string;
  }>;
  verifyResetCode: (oobCode: string) => Promise<{
    valid: boolean;
    email?: string;
    error?: string;
  }>;
  completePasswordReset: (
    oobCode: string,
    newPassword: string,
    confirmPassword: string
  ) => Promise<{
    success: boolean;
    error?: string;
    isExpiredOrInvalidCode?: boolean;
  }>;
  logout: () => void;
  
  // Data entities
  currentPos: POSClient;
  setCurrentPosId: (id: string) => void;
  isSupplierPosPreviewMode: boolean;
  openSupplierPosPreview: (posId: string) => boolean;
  closeSupplierPosPreview: () => void;
  respondToPosUpgrade: (decision: 'approved' | 'declined') => void;
  posClients: POSClient[];
  suppliers: Supplier[];
  availableClientSuppliers: Supplier[];
  supplier: Supplier;
  currentPosSupplier: Supplier;
  setCurrentSupplierId: (id: string) => void;
  superAdmin: SuperAdmin;
  catalogs: Catalog[];
  services: DigitalService[];
  voucherWarehouses: VoucherWarehouse[];
  depositRequests: DepositRequest[];
  loanRepaymentRequests: LoanRepaymentRequest[];
  supplierBankAccounts: SupplierBankAccount[];
  orders: Order[];
  accountingEntries: AccountingEntry[];
  adminAccountingEntries: AdminAccountingEntry[];
  inviteLinks: InviteLink[];
  notifications: AppNotification[];
  supplierNotifications: AppNotification[];
  clientNotifications: AppNotification[];
  unreadNotificationsCount: number;
  unreadSupplierNotificationsCount: number;
  unreadPosNotificationsCount: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearAllNotifications: () => void;
  markAllSupplierNotificationsAsRead: () => void;
  clearSupplierNotifications: () => void;
  addNotification: (notif: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>) => void;
  
  // Actions
  triggerConfetti: () => void;
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
  
  // Fee calculation helper
  calculateFee: (amount: number, sup?: Supplier) => number;

  // Purchase & Transactions
  executePurchase: (params: {
    service: DigitalService;
    pkg: ServicePackage;
    purchaseUnit?: WarehousePurchaseUnit;
    deliveryMethod: DeliveryMethod;
    deliveryDetails: {
      playerId?: string;
      playerNickname?: string;
      accountType?: string;
      accountEmail?: string;
      accountPassword?: string;
      verificationCodeEntered?: string;
      voucherCode?: string;
    };
    paymentMethod: 'wallet' | 'visa';
    customerName?: string;
    customerPhone?: string;
    resalePrice?: number;
  }) => Promise<{ success: boolean; orderId?: string; error?: string; voucherCode?: string; voucherCodes?: string[]; deductedCount?: number; isPendingSupplier?: boolean }>;
  
  executeBalanceTransfer: (params: {
    targetPosCode: string;
    amount: number;
  }) => Promise<{ success: boolean; error?: string }>;
  
  submitDepositRequest: (params: {
    amount: number;
    requestType?: 'cash' | 'loan';
    transferNumber?: string;
    transferSenderName?: string;
    bankName?: string;
    targetBankAccountId?: string;
    loanReason?: string;
    transferReceiptImage?: string;
    transferReceiptFileName?: string;
  }) => void;

  saveSupplierBankAccount: (input: {
    id?: string;
    bankName: string;
    accountNumber: string;
    iban?: string;
    country: string;
    accountHolderName: string;
    accountHolderEmail: string;
    accountHolderPhone?: string;
    holderType?: 'employee' | 'client' | 'supplier';
    delegatedPosId?: string;
    delegatedEmployeeId?: string;
    canReceiveSupplierTransfers: boolean;
    isPrimary?: boolean;
    isActive?: boolean;
    currency?: string;
    notes?: string;
  }) => { success: boolean; error?: string; account?: SupplierBankAccount };
  saveBatchBankAccounts: (
    input: BatchBankAccountsInput
  ) => { success: boolean; error?: string; accounts?: SupplierBankAccount[]; employee?: OfficeEmployee };
  toggleBankAccountTransferPrivilege: (accountId: string, enabled: boolean) => void;
  deleteSupplierBankAccount: (accountId: string) => void;
  confirmDepositReceiptByReceiver: (depositId: string, decision: 'confirmed' | 'rejected', note?: string) => void;
  confirmLoanRepaymentReceiptByReceiver: (requestId: string, decision: 'confirmed' | 'rejected', note?: string) => void;
  
  approveDepositRequest: (depositId: string) => void;
  rejectDepositRequest: (depositId: string, reason?: string) => void;
  markLoanAsRepaid: (depositId: string) => void;
  payLoanFromWallet: (loanId: string, amount: number) => Promise<{ success: boolean; error?: string; receipt?: WalletLoanRepaymentReceipt }>;
  submitLoanRepaymentRequest: (params: {
    loanId: string;
    amount: number;
    transferNumber: string;
    bankName: string;
    senderName: string;
    notes?: string;
    targetBankAccountId?: string;
    transferReceiptImage?: string;
    transferReceiptFileName?: string;
  }) => Promise<{ success: boolean; requestId?: string; request?: LoanRepaymentRequest; error?: string }>;
  approveLoanRepaymentRequest: (requestId: string, overrideAmount?: number) => void;
  rejectLoanRepaymentRequest: (requestId: string, reason?: string) => void;
  grantSupplierBalanceOrLoan: (params: {
    posId: string;
    amount: number;
    supportType: 'cash' | 'loan';
    reason: string;
  }) => { success: boolean; error?: string };
  
  completeSupplierOrder: (orderId: string, notes?: string) => void;
  rejectSupplierOrder: (orderId: string, reason?: string) => void;
  sendSupplierReplyToClient: (orderId: string, message: string) => void;
  confirmClientOtpRead: (orderId: string) => void;

  updatePosTier: (posId: string, newTier: AccountTier) => void;
  togglePosLoanPrivilege: (posId: string) => void;
  togglePosReceiveTransfersPrivilege: (posId: string) => void;
  togglePosBonusPrivilege: (posId: string) => void;
  togglePosGiftsPrivilege: (posId: string) => void;
  togglePosAccreditedPrivilege: (posId: string) => void;
  togglePosClientActiveStatus: (posId: string) => void;
  deletePosClient: (posId: string) => Promise<{ success: boolean; error?: string }>;
  updatePosProfile: (posId: string, updates: Partial<POSClient>) => void;
  updateSupplierProfile: (supplierId: string, updates: Partial<Supplier>) => void;
  createInviteLink: (
    params: { targetTier: AccountTier; features?: InviteLinkFeatures; label?: string } | AccountTier
  ) => InviteLink;
  toggleInviteLinkActiveStatus: (inviteId: string) => void;
  deleteInviteLink: (inviteId: string) => Promise<{ success: boolean; error?: string }>;
  
  addCatalog: (nameAr: string, descriptionAr: string, icon: string, isFreeGiftsCatalog?: boolean) => void;
  updateCatalog: (id: string, updates: Partial<Pick<Catalog, 'nameAr' | 'descriptionAr' | 'icon' | 'isFreeGiftsCatalog'>>) => void;
  deleteCatalog: (id: string) => { success: boolean; error?: string };
  addService: (service: Omit<DigitalService, 'id' | 'supplierId' | 'isActive'>) => void;
  updateService: (id: string, updates: Partial<Omit<DigitalService, 'id' | 'supplierId'>>) => void;
  deleteService: (id: string) => void;

  // Voucher Warehouses (مخازن الأكواد حسب الفئة)
  createVoucherWarehouse: (input: {
    nameAr: string;
    categoryName: string;
    catalogId?: string;
    description?: string;
    rawCodes?: string;
    allowSingleCodePurchase?: boolean;
    allowPackagePurchase?: boolean;
    packageCodesCount?: number;
    packageNameAr?: string;
    tierPrices: TierPrices;
    packageTierPrices?: TierPrices;
    lowStockThreshold?: number;
    publishImmediately?: boolean;
    targetServiceId?: string;
    newServiceNameAr?: string;
  }) => { warehouse: VoucherWarehouse; addedCount: number };
  addCodesToWarehouse: (warehouseId: string, rawCodes: string) => { addedCount: number; skippedDuplicates: number };
  removeCodeFromWarehouse: (warehouseId: string, codeIndex: number) => void;
  updateVoucherWarehouse: (warehouseId: string, updates: Partial<Pick<VoucherWarehouse, 'nameAr' | 'categoryName' | 'catalogId' | 'description' | 'allowSingleCodePurchase' | 'allowPackagePurchase' | 'packageCodesCount' | 'packageNameAr' | 'tierPrices' | 'packageTierPrices' | 'lowStockThreshold'>>) => void;
  setWarehouseLowStockThreshold: (warehouseId: string, threshold: number) => void;
  publishWarehouseAsService: (warehouseId: string, options: { catalogId: string; serviceId?: string; serviceNameAr?: string }) => void;
  unpublishWarehouseFromService: (warehouseId: string) => void;
  deleteVoucherWarehouse: (warehouseId: string) => void;

  // Platform Interface Settings, Fixed Admin Catalogs & Dynamic Dropdowns
  platformSettings: PlatformInterfaceSettings;
  updatePlatformInterfaceSettings: (updates: Partial<PlatformInterfaceSettings>) => void;
  addFixedCatalogByAdmin: (input: { nameAr: string; descriptionAr: string; icon: string; isFreeGiftsCatalog?: boolean }) => void;
  updateFixedCatalogByAdmin: (id: string, updates: Partial<Pick<Catalog, 'nameAr' | 'descriptionAr' | 'icon' | 'isFreeGiftsCatalog'>>) => void;
  deleteFixedCatalogByAdmin: (id: string) => { success: boolean; error?: string };
  addDropdownOption: (listKey: PlatformDropdownListKey, input: { labelAr: string; value?: string }) => { success: boolean; error?: string };
  updateDropdownOption: (listKey: PlatformDropdownListKey, optionId: string, updates: Partial<Pick<DropdownOptionItem, 'labelAr' | 'value' | 'isActive'>>) => void;
  deleteDropdownOption: (listKey: PlatformDropdownListKey, optionId: string) => void;
  
  addSupplier: (newSup: Omit<Supplier, 'id' | 'walletBalance' | 'createdAt'>) => void;
  updateSupplierFeeConfig: (supplierId: string, config: { feeType: 'percentage' | 'fixed' | 'both'; percentage: number; fixedAmount: number; feesConfig?: PlatformFeesConfig }) => void;
  adminUpdateSupplier: (supplierId: string, updates: Partial<Supplier>) => { success: boolean; error?: string };
  toggleSupplierActiveStatus: (supplierId: string) => void;
  updateGlobalFeeConfig: (config: { feeType: 'percentage' | 'fixed' | 'both'; percentage: number; fixedAmount: number; defaultFeesConfig?: PlatformFeesConfig }) => void;
  adminSettleBank: (amount: number, bankIban: string) => void;
  adminTransferToAgent: (targetPosCode: string, amount: number) => void;
  addOfficeEmployee: (employeeData: {
    name: string;
    email: string;
    password?: string;
    phone: string;
    country?: string;
    isTransferReceiverOnly?: boolean;
    roleTitle: string;
    permissions: EmployeePermissions;
  }) => { success: boolean; error?: string; employee?: OfficeEmployee };
  updateOfficeEmployee: (empId: string, updates: Partial<OfficeEmployee>) => { success: boolean; error?: string };
  removeOfficeEmployee: (empId: string) => void;
  addAdminAccount: (accountData: {
    name: string;
    email: string;
    password: string;
    phone: string;
    roleTitle: string;
    permissions: AdminPermissions;
    isActive?: boolean;
  }) => { success: boolean; error?: string };
  updateAdminAccount: (accountId: string, updates: Partial<AdminAccount>) => { success: boolean; error?: string };
  removeAdminAccount: (accountId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Authentication state (initialized purely via Firebase Auth onAuthStateChanged)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const isAuthenticated = currentUser !== null;

  const [role, setRole] = useState<UserRole>('pos_client');
  const [viewMode, setViewMode] = useState<'mobile_frame' | 'responsive'>('mobile_frame');
  const [activeNavTab, setActiveNavTab] = useState<string>('store');
  
  const [posClients, setPosClients] = useState<POSClient[]>([]);
  const [currentPosId, setCurrentPosId] = useState<string>('');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [currentSupplierId, setCurrentSupplierId] = useState<string>('');

  const currentPos = React.useMemo(
    () =>
      resolveScopedCurrentPos({
        isAuthenticated,
        role,
        currentUser,
        currentPosId,
        posClients,
      }),
    [isAuthenticated, role, currentUser, currentPosId, posClients]
  );

  const supplier = React.useMemo(
    () =>
      resolveScopedSupplier({
        isAuthenticated,
        role,
        currentUser,
        currentSupplierId,
        currentPos,
        suppliers,
        posClients,
      }),
    [isAuthenticated, role, currentUser, currentSupplierId, currentPos, suppliers, posClients]
  );

  const effectiveEmployeePerms = React.useMemo(
    () => resolveEffectiveEmployeePermissions(currentUser, role, supplier),
    [currentUser, role, supplier]
  );

  const [inspectedPosId, setInspectedPosId] = useState<string | null>(null);

  const inspectedPosClient = React.useMemo(() => {
    if (!inspectedPosId || !isAuthenticated) return null;
    const candidate = posClients.find((p) => p.id === inspectedPosId);
    if (!candidate) return null;
    const allowed = canSupplierInspectPosInterface({
      client: candidate,
      supplierId: supplier?.id || '',
      role,
      canViewClients: effectiveEmployeePerms.canViewClients,
      canUpgradeClientTiers: effectiveEmployeePerms.canUpgradeClientTiers,
    });
    return allowed ? candidate : null;
  }, [
    inspectedPosId,
    isAuthenticated,
    posClients,
    supplier?.id,
    role,
    effectiveEmployeePerms.canViewClients,
    effectiveEmployeePerms.canUpgradeClientTiers,
  ]);

  const isSupplierPosPreviewMode = inspectedPosClient !== null;
  const exposedCurrentPos = inspectedPosClient || currentPos;

  useEffect(() => {
    if (inspectedPosId && !inspectedPosClient) {
      setInspectedPosId(null);
    }
  }, [inspectedPosId, inspectedPosClient]);
  
  const [superAdmin, setSuperAdmin] = useState<SuperAdmin>(initialSuperAdmin);

  const [platformSettings, setPlatformSettings] = useState<PlatformInterfaceSettings>(
    DEFAULT_PLATFORM_INTERFACE_SETTINGS
  );
  
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [services, setServices] = useState<DigitalService[]>([]);
  const [voucherWarehouses, setVoucherWarehouses] = useState<VoucherWarehouse[]>([]);
  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>([]);
  const [loanRepaymentRequests, setLoanRepaymentRequests] = useState<LoanRepaymentRequest[]>([]);
  const [supplierBankAccounts, setSupplierBankAccounts] = useState<SupplierBankAccount[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [accountingEntries, setAccountingEntries] = useState<AccountingEntry[]>([]);
  const [adminAccountingEntries, setAdminAccountingEntries] = useState<AdminAccountingEntry[]>([]);
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    localStorage.setItem('digipos_notifications_v2', JSON.stringify(notifications));
  }, [notifications]);

  const markNotificationAsRead = (id: string) => {
    if (isSupplierPosPreviewMode) return;
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const markAllNotificationsAsRead = () => {
    if (isSupplierPosPreviewMode) return;
    setNotifications(prev =>
      prev.map(n =>
        isNotificationForPosClient(n, currentPos?.id, currentPos?.supplierId)
          ? { ...n, isRead: true }
          : n
      )
    );
  };

  const clearAllNotifications = () => {
    if (isSupplierPosPreviewMode) return;
    setNotifications(prev =>
      prev.filter(n => !isNotificationForPosClient(n, currentPos?.id, currentPos?.supplierId))
    );
  };

  const markAllSupplierNotificationsAsRead = () => {
    setNotifications(prev =>
      prev.map(n =>
        (n.targetRole === 'supplier' || (!n.targetRole && !n.posId)) &&
        (!n.supplierId || n.supplierId === supplier?.id)
          ? { ...n, isRead: true }
          : n
      )
    );
  };

  const clearSupplierNotifications = () => {
    setNotifications(prev =>
      prev.filter(
        n =>
          !(
            (n.targetRole === 'supplier' || (!n.targetRole && !n.posId)) &&
            (!n.supplierId || n.supplierId === supplier?.id)
          )
      )
    );
  };

  const addNotification = (notif: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>) => {
    const newNotif: AppNotification = {
      ...notif,
      id: `notif-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`,
      isRead: false,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  // Track active OTP per email with 2-minute duration
  const [activeOtps, setActiveOtps] = useState<Record<string, { code: string; expiresAt: number }>>({});

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Firebase Firestore connection & sync state
  const [isFirestoreConnected, setIsFirestoreConnected] = useState<boolean>(false);
  const [isSyncingWithFirestore, setIsSyncingWithFirestore] = useState<boolean>(false);
  const [lastFirestoreSyncAt, setLastFirestoreSyncAt] = useState<string | null>(null);
  const [databaseSyncMessage, setDatabaseSyncMessage] = useState<string | null>(null);
  const [isSupplierSelectionRequired, setIsSupplierSelectionRequired] = useState<boolean>(false);
  const [firestoreRecoveryEpoch, setFirestoreRecoveryEpoch] = useState<number>(0);

  useEffect(() => {
    return subscribeFirestoreRecovery(() => {
      setFirestoreRecoveryEpoch((epoch) => epoch + 1);
    });
  }, []);

  // Compute registered suppliers strictly belonging to the currently logged in POS client
  const availableClientSuppliers = React.useMemo(() => {
    if (!currentUser || currentUser.role !== 'pos_client') {
      return suppliers;
    }
    const matchingPosRecords = findPosClientsForEmail(
      currentUser.email,
      posClients,
      currentUser.associatedId
    ).filter(isPosClientActive);
    if (matchingPosRecords.length === 0) {
      return [];
    }
    const registeredSupIds = Array.from(new Set(matchingPosRecords.map(p => p.supplierId).filter(Boolean)));
    return suppliers.filter(s => registeredSupIds.includes(s.id));
  }, [currentUser, posClients, suppliers]);

  // Validate & restore connection to Firestore on boot and on-demand
  const checkDatabaseConnection = async (retries = 1): Promise<ConnectionTestResult> => {
    if (isNavigatorOffline()) {
      setIsFirestoreConnected(false);
      return {
        success: false,
        message: 'الجهاز غير متصل بشبكة الإنترنت حالياً. يرجى التحقق من الشبكة والمحاولة مجدداً.'
      };
    }
    let res = await reconnectFirestore(12000);
    if (!res.success && retries > 0 && !isNavigatorOffline()) {
      await new Promise(r => setTimeout(r, 800));
      res = await reconnectFirestore(15000);
    }
    setIsFirestoreConnected(res.success);
    return res;
  };

  const bootstrapAuthDataFromFirestore = async () => {
    try {
      const bootData = await firestoreSync.fetchAuthBootstrapData();
      const pendingMap = readPendingSyncMap();
      const syncedMap = readSyncedIdsMap();

      if (bootData.platformSettings) {
        const settingsRec = reconcilePlatformSettingsWithRemote(
          platformSettingsRef.current,
          bootData.platformSettings,
          (pendingMap.platformSettings?.length ?? 0) > 0
        );
        platformSettingsRef.current = settingsRec.merged;
        setPlatformSettings(settingsRec.merged);
      }
      if (bootData.superAdmin) {
        const adminRec = reconcileSuperAdminWithRemote(
          superAdminRef.current,
          bootData.superAdmin,
          (pendingMap.superAdmin?.length ?? 0) > 0
        );
        superAdminRef.current = adminRec.merged;
        setSuperAdmin(adminRec.merged);
      }
      if (Array.isArray(bootData.suppliers)) {
        const supRec = reconcileCollectionWithRemote(
          suppliersRef.current,
          bootData.suppliers,
          syncedMap.suppliers,
          pendingMap.suppliers
        );
        suppliersRef.current = supRec.merged;
        setSuppliers(supRec.merged);
      }
      if (Array.isArray(bootData.posClients)) {
        const posRec = reconcileCollectionWithRemote(
          posClientsRef.current,
          bootData.posClients,
          syncedMap.posClients,
          pendingMap.posClients
        );
        posClientsRef.current = posRec.merged;
        setPosClients(posRec.merged);
      }
      if (Array.isArray(bootData.inviteLinks)) {
        const invRec = reconcileCollectionWithRemote(
          inviteLinksRef.current,
          bootData.inviteLinks,
          syncedMap.inviteLinks,
          pendingMap.inviteLinks
        );
        inviteLinksRef.current = invRec.merged;
        setInviteLinks(invRec.merged);
      }
      return {
        superAdmin: superAdminRef.current,
        platformSettings: platformSettingsRef.current,
        suppliers: suppliersRef.current,
        posClients: posClientsRef.current,
        inviteLinks: inviteLinksRef.current,
      };
    } catch (err) {
      console.warn('Auth bootstrap fetch skipped:', err);
      return {};
    }
  };

  const clearTransientSessionCaches = () => {
    ordersRef.current = [];
    depositRequestsRef.current = [];
    loanRepaymentRequestsRef.current = [];
    accountingEntriesRef.current = [];
    adminAccountingEntriesRef.current = [];
    supplierBankAccountsRef.current = [];
    voucherWarehousesRef.current = [];
    inviteLinksRef.current = [];
    catalogsRef.current = [];
    servicesRef.current = [];
    currentPosIdRef.current = '';
    currentSupplierIdRef.current = '';

    setOrders([]);
    setDepositRequests([]);
    setLoanRepaymentRequests([]);
    setAccountingEntries([]);
    setAdminAccountingEntries([]);
    setSupplierBankAccounts([]);
    setVoucherWarehouses([]);
    setInviteLinks([]);
    setCatalogs([]);
    setServices([]);
    setNotifications([]);
    setActiveOtps({});
    setCurrentPosId('');
    setCurrentSupplierId('');
    setInspectedPosId(null);
    setIsSupplierSelectionRequired(false);
    setRole('pos_client');
    setActiveNavTab('store');
    setEmployeePreferredCurrency(null);

    try {
      localStorage.removeItem('digipos_auth_user');
      localStorage.removeItem('digipos_orders_v2');
      localStorage.removeItem('digipos_deposits_v2');
      localStorage.removeItem('digipos_loan_repayments_v1');
      localStorage.removeItem('digipos_accounting_v2');
      localStorage.removeItem('digipos_admin_accounting_v2');
      localStorage.removeItem('digipos_supplier_bank_accounts_v1');
      localStorage.removeItem('digipos_voucher_warehouses_v1');
      localStorage.removeItem('digipos_invites_v2');
      localStorage.removeItem('digipos_live_supplier_reply');
      localStorage.removeItem('digipos_employee_currency_v1');
      localStorage.removeItem('digipos_admin_currency_v1');
      localStorage.removeItem('digipos_notifications_v2');
    } catch {
      // ignore
    }
  };

  const authSessionEpochRef = React.useRef(0);
  const isRegisteringRef = React.useRef(false);
  const isManualAuthInProgressRef = React.useRef(false);
  const currentUserRef = React.useRef(currentUser);
  currentUserRef.current = currentUser;
  const suppliersRef = React.useRef(suppliers);
  suppliersRef.current = suppliers;
  const posClientsRef = React.useRef(posClients);
  posClientsRef.current = posClients;
  const catalogsRef = React.useRef(catalogs);
  catalogsRef.current = catalogs;
  const servicesRef = React.useRef(services);
  servicesRef.current = services;
  const voucherWarehousesRef = React.useRef(voucherWarehouses);
  voucherWarehousesRef.current = voucherWarehouses;
  const ordersRef = React.useRef(orders);
  ordersRef.current = orders;
  const depositRequestsRef = React.useRef(depositRequests);
  depositRequestsRef.current = depositRequests;
  const loanRepaymentRequestsRef = React.useRef(loanRepaymentRequests);
  loanRepaymentRequestsRef.current = loanRepaymentRequests;
  const supplierBankAccountsRef = React.useRef(supplierBankAccounts);
  supplierBankAccountsRef.current = supplierBankAccounts;
  const accountingEntriesRef = React.useRef(accountingEntries);
  accountingEntriesRef.current = accountingEntries;
  const adminAccountingEntriesRef = React.useRef(adminAccountingEntries);
  adminAccountingEntriesRef.current = adminAccountingEntries;
  const inviteLinksRef = React.useRef(inviteLinks);
  inviteLinksRef.current = inviteLinks;
  const currentPosIdRef = React.useRef(currentPosId);
  currentPosIdRef.current = currentPosId;
  const currentSupplierIdRef = React.useRef(supplier?.id);
  currentSupplierIdRef.current = supplier?.id;
  const superAdminRef = React.useRef(superAdmin);
  superAdminRef.current = superAdmin;
  const platformSettingsRef = React.useRef(platformSettings);
  platformSettingsRef.current = platformSettings;
  const lastFirestoreSyncAtRef = React.useRef(lastFirestoreSyncAt);
  lastFirestoreSyncAtRef.current = lastFirestoreSyncAt;
  const syncInFlightRef = React.useRef<Promise<{
    connected: boolean;
    synced: boolean;
    pushedCount: number;
    message: string;
    error?: string;
  }> | null>(null);

  const applyLocalNonAdminStateReset = (preservedAdmin: SuperAdmin) => {
    sanitizeLocalStorageForCleanReset(localStorage, preservedAdmin);
    localStorage.setItem(CLEAN_BOOT_STORAGE_FLAG, '1');
    const preservedCatalogs = filterPreservedFixedCatalogs(catalogsRef.current);
    posClientsRef.current = [];
    suppliersRef.current = [];
    servicesRef.current = [];
    voucherWarehousesRef.current = [];
    supplierBankAccountsRef.current = [];
    ordersRef.current = [];
    depositRequestsRef.current = [];
    loanRepaymentRequestsRef.current = [];
    accountingEntriesRef.current = [];
    adminAccountingEntriesRef.current = [];
    inviteLinksRef.current = [];
    catalogsRef.current = preservedCatalogs;

    setPosClients([]);
    setSuppliers([]);
    setServices([]);
    setVoucherWarehouses([]);
    setSupplierBankAccounts([]);
    setOrders([]);
    setDepositRequests([]);
    setLoanRepaymentRequests([]);
    setAccountingEntries([]);
    setAdminAccountingEntries([]);
    setInviteLinks([]);
    setNotifications([]);
    setCatalogs(preservedCatalogs);
    setCurrentPosId('');
    setCurrentSupplierId('');
    setIsSupplierSelectionRequired(false);
    setCurrentUser(prev =>
      isPreservedAdminAuthUser(prev, preservedAdmin) ? prev : null
    );
  };

  const ensureDatabaseConnectedAndSynced = async (options?: {
    forceSync?: boolean;
    silent?: boolean;
  }): Promise<{
    connected: boolean;
    synced: boolean;
    pushedCount: number;
    message: string;
    error?: string;
  }> => {
    if (syncInFlightRef.current) {
      return syncInFlightRef.current;
    }

    const runSync = async () => {
      setIsSyncingWithFirestore(true);
      try {
        if (isNavigatorOffline()) {
          setIsFirestoreConnected(false);
          const msg = 'الجهاز غير متصل بشبكة الإنترنت حالياً. يرجى التحقق من الشبكة والمحاولة مجدداً.';
          setDatabaseSyncMessage(msg);
          return { connected: false, synced: false, pushedCount: 0, message: msg, error: msg };
        }

        const conn = await reconnectFirestore(12000);
        setIsFirestoreConnected(conn.success);
        if (!conn.success) {
          setDatabaseSyncMessage(conn.message);
          return {
            connected: false,
            synced: false,
            pushedCount: 0,
            message: conn.message,
            error: conn.message,
          };
        }

        const mig = await firestoreSync.ensureCleanStateMigrationOnce(superAdminRef.current);
        if (mig.migrated) {
          applyLocalNonAdminStateReset(superAdminRef.current);
        }

        // Skip heavy full pull/push if already synced recently and no local pending items unless forced
        const pendingMap = readPendingSyncMap();
        const hasPending = Object.values(pendingMap).some(
          (ids) => Array.isArray(ids) && ids.length > 0
        );
        if (!options?.forceSync && lastFirestoreSyncAtRef.current && !hasPending) {
          const msg = 'تم الاتصال بقاعدة بيانات Firebase ومزامنة القواعد المحلية بنجاح.';
          setDatabaseSyncMessage(msg);
          return { connected: true, synced: true, pushedCount: 0, message: msg };
        }

        const remote = await firestoreSync.fetchAllDatabasesFromServer();
        const syncedMap = readSyncedIdsMap();

        const adminRec = reconcileSuperAdminWithRemote(
          superAdminRef.current,
          remote.superAdmin,
          (pendingMap.superAdmin?.length ?? 0) > 0
        );
        const settingsRec = reconcilePlatformSettingsWithRemote(
          platformSettingsRef.current,
          remote.platformSettings,
          (pendingMap.platformSettings?.length ?? 0) > 0
        );

        const suppliersRec = reconcileCollectionWithRemote(
          suppliersRef.current,
          remote.suppliers,
          syncedMap.suppliers,
          pendingMap.suppliers
        );
        const posClientsRec = reconcileCollectionWithRemote(
          posClientsRef.current,
          remote.posClients,
          syncedMap.posClients,
          pendingMap.posClients
        );
        const catalogsRec = reconcileCollectionWithRemote(
          catalogsRef.current,
          remote.catalogs,
          syncedMap.catalogs,
          pendingMap.catalogs
        );
        const servicesRec = reconcileCollectionWithRemote(
          servicesRef.current,
          remote.services,
          syncedMap.services,
          pendingMap.services
        );
        const warehousesRec = reconcileCollectionWithRemote(
          voucherWarehousesRef.current,
          remote.voucherWarehouses,
          syncedMap.voucherWarehouses,
          pendingMap.voucherWarehouses
        );
        const ordersRec = reconcileCollectionWithRemote(
          ordersRef.current,
          remote.orders,
          syncedMap.orders,
          pendingMap.orders
        );
        const depositsRec = reconcileCollectionWithRemote(
          depositRequestsRef.current,
          remote.depositRequests,
          syncedMap.depositRequests,
          pendingMap.depositRequests
        );
        const loanRepaymentsRec = reconcileCollectionWithRemote(
          loanRepaymentRequestsRef.current,
          remote.loanRepaymentRequests,
          syncedMap.loanRepaymentRequests,
          pendingMap.loanRepaymentRequests
        );
        const bankAccountsRec = reconcileCollectionWithRemote(
          supplierBankAccountsRef.current,
          remote.supplierBankAccounts,
          syncedMap.supplierBankAccounts,
          pendingMap.supplierBankAccounts
        );
        const accountingRec = reconcileCollectionWithRemote(
          accountingEntriesRef.current,
          remote.accountingEntries,
          syncedMap.accountingEntries,
          pendingMap.accountingEntries
        );
        const adminAccountingRec = reconcileCollectionWithRemote(
          adminAccountingEntriesRef.current,
          remote.adminAccountingEntries,
          syncedMap.adminAccountingEntries,
          pendingMap.adminAccountingEntries
        );
        const invitesRec = reconcileCollectionWithRemote(
          inviteLinksRef.current,
          remote.inviteLinks,
          syncedMap.inviteLinks,
          pendingMap.inviteLinks
        );

        const pushEntries: Array<{ path: [string, string]; data: unknown }> = [];
        const pushedMarkers: Array<[keyof typeof pendingMap, string]> = [];

        if (adminRec.shouldPushToRemote) {
          pushEntries.push({ path: ['system', 'superAdmin'], data: adminRec.merged });
          pushedMarkers.push(['superAdmin', 'superAdmin']);
        }
        if (settingsRec.shouldPushToRemote) {
          pushEntries.push({ path: ['system', 'platformSettings'], data: settingsRec.merged });
          pushedMarkers.push(['platformSettings', 'platformSettings']);
        }

        const addColPush = <T extends { id: string }>(
          colKey: Exclude<keyof SyncedIdsMap, never>,
          items: T[]
        ) => {
          for (const item of items) {
            pushEntries.push({ path: [colKey, item.id], data: item });
            pushedMarkers.push([colKey, item.id]);
          }
        };

        addColPush('suppliers', suppliersRec.toPushToRemote);
        addColPush('posClients', posClientsRec.toPushToRemote);
        addColPush('catalogs', catalogsRec.toPushToRemote);
        addColPush('services', servicesRec.toPushToRemote);
        addColPush('voucherWarehouses', warehousesRec.toPushToRemote);
        addColPush('orders', ordersRec.toPushToRemote);
        addColPush('depositRequests', depositsRec.toPushToRemote);
        addColPush('loanRepaymentRequests', loanRepaymentsRec.toPushToRemote);
        addColPush('supplierBankAccounts', bankAccountsRec.toPushToRemote);
        addColPush('accountingEntries', accountingRec.toPushToRemote);
        addColPush('adminAccountingEntries', adminAccountingRec.toPushToRemote);
        addColPush('inviteLinks', invitesRec.toPushToRemote);

        const pushedCount = await firestoreSync.commitBatchSets(pushEntries);

        if (suppliersRec.toPushToRemote.length > 0 || posClientsRec.toPushToRemote.length > 0) {
          await firestoreSync.syncUsersForAccounts(
            suppliersRec.toPushToRemote,
            posClientsRec.toPushToRemote
          );
        }

        for (const [colKey, docId] of pushedMarkers) {
          clearEntityPendingSync(colKey, docId);
        }

        const sortByDateDesc = <T extends { date?: string }>(items: T[]) =>
          [...items].sort(
            (a, b) => (new Date(b.date || 0).getTime() || 0) - (new Date(a.date || 0).getTime() || 0)
          );

        const sortedOrders = sortByDateDesc(ordersRec.merged);
        const sortedDeposits = sortByDateDesc(depositsRec.merged);
        const sortedLoanRepayments = sortByDateDesc(loanRepaymentsRec.merged);
        const sortedAccounting = sortByDateDesc(accountingRec.merged);
        const sortedAdminAccounting = sortByDateDesc(adminAccountingRec.merged);

        superAdminRef.current = adminRec.merged;
        platformSettingsRef.current = settingsRec.merged;
        suppliersRef.current = suppliersRec.merged;
        posClientsRef.current = posClientsRec.merged;
        catalogsRef.current = catalogsRec.merged;
        servicesRef.current = servicesRec.merged;
        voucherWarehousesRef.current = warehousesRec.merged;
        ordersRef.current = sortedOrders;
        depositRequestsRef.current = sortedDeposits;
        loanRepaymentRequestsRef.current = sortedLoanRepayments;
        supplierBankAccountsRef.current = bankAccountsRec.merged;
        accountingEntriesRef.current = sortedAccounting;
        adminAccountingEntriesRef.current = sortedAdminAccounting;
        inviteLinksRef.current = invitesRec.merged;

        setSuperAdmin(adminRec.merged);
        setPlatformSettings(settingsRec.merged);
        setSuppliers(suppliersRec.merged);
        setPosClients(posClientsRec.merged);
        setCatalogs(catalogsRec.merged);
        setServices(servicesRec.merged);
        setVoucherWarehouses(warehousesRec.merged);
        setOrders(sortedOrders);
        setDepositRequests(sortedDeposits);
        setLoanRepaymentRequests(sortedLoanRepayments);
        setSupplierBankAccounts(bankAccountsRec.merged);
        setAccountingEntries(sortedAccounting);
        setAdminAccountingEntries(sortedAdminAccounting);
        setInviteLinks(invitesRec.merged);

        const nextSyncedIds: SyncedIdsMap = {
          suppliers: suppliersRec.nextSyncedIds,
          posClients: posClientsRec.nextSyncedIds,
          catalogs: catalogsRec.nextSyncedIds,
          services: servicesRec.nextSyncedIds,
          voucherWarehouses: warehousesRec.nextSyncedIds,
          orders: ordersRec.nextSyncedIds,
          depositRequests: depositsRec.nextSyncedIds,
          loanRepaymentRequests: loanRepaymentsRec.nextSyncedIds,
          supplierBankAccounts: bankAccountsRec.nextSyncedIds,
          accountingEntries: accountingRec.nextSyncedIds,
          adminAccountingEntries: adminAccountingRec.nextSyncedIds,
          inviteLinks: invitesRec.nextSyncedIds,
        };
        writeSyncedIdsMap(nextSyncedIds);

        const nowIso = new Date().toISOString();
        lastFirestoreSyncAtRef.current = nowIso;
        setLastFirestoreSyncAt(nowIso);

        const msg =
          pushedCount > 0
            ? `تم الاتصال بقاعدة البيانات ومزامنة ${pushedCount} سجل محلي مع فايربيس بنجاح.`
            : 'تم الاتصال بقاعدة بيانات Firebase ومزامنة القواعد والبيانات بنجاح.';
        setDatabaseSyncMessage(msg);

        if (!options?.silent) {
          showToast({
            type: 'success',
            title: 'تمت المزامنة مع قاعدة البيانات',
            description: msg,
          });
        }

        return {
          connected: true,
          synced: true,
          pushedCount,
          message: msg,
        };
      } catch (err: unknown) {
        console.warn('Database connect & sync error:', err);
        const errorMsg = err instanceof Error ? err.message : 'تعذر إتمام مزامنة البيانات مع فايربيس.';
        if (isNavigatorOffline()) {
          setIsFirestoreConnected(false);
        }
        const userMsg = 'تم الاتصال جزئياً أو تعذر إتمام مزامنة بعض السجلات مع فايربيس.';
        setDatabaseSyncMessage(userMsg);
        if (!options?.silent) {
          showToast({
            type: 'error',
            title: 'تنبيه مزامنة قاعدة البيانات',
            description: userMsg,
          });
        }
        return {
          connected: !isNavigatorOffline(),
          synced: false,
          pushedCount: 0,
          message: userMsg,
          error: errorMsg,
        };
      } finally {
        setIsSyncingWithFirestore(false);
      }
    };

    syncInFlightRef.current = runSync().finally(() => {
      syncInFlightRef.current = null;
    });
    return syncInFlightRef.current;
  };

  useEffect(() => {
    let isMounted = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const runBootSync = async () => {
      try {
        if (isNavigatorOffline()) {
          if (isMounted) {
            setIsFirestoreConnected(false);
            setDatabaseSyncMessage('الجهاز غير متصل بشبكة الإنترنت حالياً. يرجى التحقق من الشبكة والمحاولة مجدداً.');
          }
          return;
        }
        const res = await ensureDatabaseConnectedAndSynced({ forceSync: true, silent: true });
        if (!isMounted) return;
        if (res.connected) {
          console.log('Firebase Firestore connection & sync verified:', res.message);
        } else {
          console.warn('Firebase Firestore initial connection test:', res.message);
          retryTimer = setTimeout(async () => {
            if (!isMounted || isNavigatorOffline()) return;
            try {
              const retryRes = await ensureDatabaseConnectedAndSynced({ forceSync: true, silent: true });
              if (retryRes.connected && isMounted) {
                console.log('Firebase Firestore connection & sync verified on retry:', retryRes.message);
              }
            } catch (e) {
              console.warn(e);
            }
          }, 2000);
        }
      } catch (err) {
        console.warn('Firestore connection check error:', err);
        if (isMounted) setIsFirestoreConnected(false);
      }
    };

    const handleOffline = () => {
      if (!isMounted) return;
      setIsFirestoreConnected(false);
      setDatabaseSyncMessage('انقطع الاتصال بشبكة الإنترنت حالياً.');
    };

    const handleOnline = () => {
      if (!isMounted) return;
      const lastSyncMs = lastFirestoreSyncAtRef.current
        ? new Date(lastFirestoreSyncAtRef.current).getTime()
        : 0;
      const shouldForce = !lastSyncMs || Date.now() - lastSyncMs > 15000;
      void ensureDatabaseConnectedAndSynced({ forceSync: shouldForce, silent: true });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('offline', handleOffline);
      window.addEventListener('online', handleOnline);
    }

    void runBootSync();

    return () => {
      isMounted = false;
      if (retryTimer) clearTimeout(retryTimer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('online', handleOnline);
      }
    };
  }, []);

  const getDefaultNavTabForSession = (authUser: AuthUser, resolvedRole: UserRole): string => {
    if (resolvedRole === 'super_admin') {
      return getFirstAllowedAdminTab(resolveEffectiveAdminPermissions(authUser, 'super_admin'));
    }
    if (resolvedRole === 'supplier') {
      return 'catalogs';
    }
    if (resolvedRole === 'employee') {
      return getFirstAllowedSupplierTab(
        normalizeEmployeePermissions(authUser.permissions),
        'employee'
      );
    }
    return 'store';
  };

  const reconcileIdentityCollectionsFromServer = (serverData: {
    superAdmin: Partial<SuperAdmin> | null;
    suppliers: Supplier[] | null;
    posClients: POSClient[] | null;
  }) => {
    const pendingMap = readPendingSyncMap();
    const syncedMap = readSyncedIdsMap();

    let nextSuperAdmin = superAdminRef.current;
    if (serverData.superAdmin) {
      const adminRec = reconcileSuperAdminWithRemote(
        superAdminRef.current,
        serverData.superAdmin,
        (pendingMap.superAdmin?.length ?? 0) > 0
      );
      nextSuperAdmin = adminRec.merged;
      superAdminRef.current = adminRec.merged;
      setSuperAdmin(adminRec.merged);
    }

    let nextSuppliers = suppliersRef.current;
    if (Array.isArray(serverData.suppliers)) {
      const supRec = reconcileCollectionWithRemote(
        suppliersRef.current,
        serverData.suppliers,
        syncedMap.suppliers,
        pendingMap.suppliers
      );
      nextSuppliers = supRec.merged;
      suppliersRef.current = supRec.merged;
      setSuppliers(supRec.merged);
    }

    let nextPosClients = posClientsRef.current;
    if (Array.isArray(serverData.posClients)) {
      const posRec = reconcileCollectionWithRemote(
        posClientsRef.current,
        serverData.posClients,
        syncedMap.posClients,
        pendingMap.posClients
      );
      nextPosClients = posRec.merged;
      posClientsRef.current = posRec.merged;
      setPosClients(posRec.merged);
    }

    return {
      superAdmin: nextSuperAdmin,
      suppliers: nextSuppliers,
      posClients: nextPosClients,
    };
  };

  const applyResolvedAuthenticatedSession = (params: {
    built: ReturnType<typeof buildAuthUserFromIdentity>;
    epoch: number;
    clearCachesFirst?: boolean;
  }): boolean => {
    if (authSessionEpochRef.current !== params.epoch) {
      return false;
    }

    const { built } = params;
    const prevUser = currentUserRef.current;
    const isSameAccount =
      Boolean(prevUser?.email) &&
      normalizeStoreEmail(prevUser?.email) === normalizeStoreEmail(built.authUser.email) &&
      prevUser?.role === built.role &&
      prevUser?.associatedId === built.authUser.associatedId;

    if (params.clearCachesFirst || !isSameAccount) {
      clearTransientSessionCaches();
    }

    currentPosIdRef.current = built.posId;
    currentSupplierIdRef.current = built.supplierId;
    setCurrentPosId(built.posId);
    setCurrentSupplierId(built.supplierId);
    setIsSupplierSelectionRequired(built.requiresSupplierSelection);
    setActiveNavTab(getDefaultNavTabForSession(built.authUser, built.role));
    setCurrentUser(built.authUser);
    setRole(built.role);
    return true;
  };

  // Listen to Firebase Auth state (registered once on mount)
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      // Prevent auto-authenticating during registration or while manual login is finishing
      if (isRegisteringRef.current || isManualAuthInProgressRef.current) {
        return;
      }

      authSessionEpochRef.current += 1;
      const myEpoch = authSessionEpochRef.current;

      if (fbUser) {
        void (async () => {
          const cleanEmail = normalizeStoreEmail(fbUser.email);
          if (!cleanEmail || cleanEmail === 'almekhlafiraghad2@gmail.com') {
            fbSignOut(auth).catch(console.error);
            clearTransientSessionCaches();
            setCurrentUser(null);
            return;
          }

          // Always resolve post-reload / auth-state identity from authoritative Firestore records
          const authData = await firestoreSync.fetchAuthoritativeIdentityDataFromFirestore(
            cleanEmail,
            fbUser.uid
          );

          if (
            authSessionEpochRef.current !== myEpoch ||
            isRegisteringRef.current ||
            isManualAuthInProgressRef.current
          ) {
            return;
          }

          const activeExistingEmail = normalizeStoreEmail(currentUserRef.current?.email);
          const isSameActiveAccount = Boolean(activeExistingEmail && activeExistingEmail === cleanEmail);

          if (!authData.connected || authData.suppliers === null || authData.posClients === null) {
            // If offline/unreachable during cold start, never fabricate a session from stale local state
            if (!isSameActiveAccount) {
              clearTransientSessionCaches();
              setCurrentUser(null);
            }
            return;
          }

          setIsFirestoreConnected(true);
          const reconciled = reconcileIdentityCollectionsFromServer(authData);

          // Identity resolution strictly uses live Firestore truth (`authData` + `reconciled.superAdmin`)
          const identity = resolveAuthoritativeIdentityFromFirestore({
            email: cleanEmail,
            superAdmin: authData.superAdmin
              ? {
                  ...reconciled.superAdmin,
                  ...authData.superAdmin,
                  adminAccounts: Array.isArray(authData.superAdmin.adminAccounts)
                    ? authData.superAdmin.adminAccounts
                    : reconciled.superAdmin.adminAccounts || [],
                }
              : reconciled.superAdmin,
            suppliers: authData.suppliers,
            posClients: authData.posClients,
            userDoc: authData.userDoc,
          });

          if (identity.kind === 'sub_admin' && !identity.adminAccount.isActive) {
            fbSignOut(auth).catch(console.error);
            clearTransientSessionCaches();
            setCurrentUser(null);
            return;
          }

          if (identity.kind === 'supplier' && !isSupplierActive(identity.supplier)) {
            fbSignOut(auth).catch(console.error);
            clearTransientSessionCaches();
            setCurrentUser(null);
            return;
          }

          if (identity.kind === 'employee') {
            const eligibility = evaluateEmployeeLoginEligibility(identity.supplier, identity.employee);
            if (!eligibility.allowed) {
              fbSignOut(auth).catch(console.error);
              clearTransientSessionCaches();
              setCurrentUser(null);
              return;
            }
          }

          if (identity.kind === 'pos_client') {
            const clientEligibility = evaluatePosClientLoginEligibility(identity.posRecords);
            if (!clientEligibility.allowed) {
              fbSignOut(auth).catch(console.error);
              clearTransientSessionCaches();
              setCurrentUser(null);
              return;
            }
          }

          if (identity.kind === 'unregistered') {
            // Never log an unrecognized Firebase session into someone else's client or supplier account
            clearTransientSessionCaches();
            setCurrentUser(null);
            return;
          }

          const safePreferredPosId = isSameActiveAccount
            ? (currentPosIdRef.current || authData.userDoc?.associatedId)
            : authData.userDoc?.associatedId;

          const built = buildAuthUserFromIdentity(identity, {
            uid: fbUser.uid,
            phone: fbUser.phoneNumber || undefined,
            masterAdminName:
              authData.superAdmin?.name ||
              reconciled.superAdmin.name ||
              fbUser.displayName ||
              'الإدارة العامة للمنصة',
            preferredPosId: safePreferredPosId,
          });

          applyResolvedAuthenticatedSession({
            built,
            epoch: myEpoch,
            clearCachesFirst: !isSameActiveAccount,
          });
        })();
      } else {
        // Preserve active synthetic non-Firebase-Auth sessions (sub-admins, employees, admin-created suppliers)
        setCurrentUser(prev => {
          if (
            prev &&
            (prev.id === 'usr-master-admin' ||
              prev.id.startsWith('emp-') ||
              prev.id.startsWith('adm-') ||
              prev.id.startsWith('sup-usr-'))
          ) {
            return prev;
          }
          if (prev) {
            clearTransientSessionCaches();
          }
          return null;
        });
      }
    });
    return () => unsubAuth();
  }, []);

  // Lightweight one-time metadata bootstrap while unauthenticated (skips if boot sync already ran)
  useEffect(() => {
    if (!isFirestoreConnected || isAuthenticated || lastFirestoreSyncAtRef.current) return;
    void bootstrapAuthDataFromFirestore();
  }, [isFirestoreConnected, isAuthenticated]);

  // Real-time synchronization from Firestore (role-scoped and staggered to prevent Watch target churn)
  useEffect(() => {
    if (!isAuthenticated) return;

    let isEffectActive = true;
    const secondaryUnsubs: Array<() => void> = [];

    const handleTransientOffline = () => {
      if (!isEffectActive) return;
      setIsFirestoreConnected(false);
    };

    const markConnectedIfLive = (fromCache: boolean) => {
      if (!isEffectActive || fromCache) return;
      setIsFirestoreConnected(prev => (prev ? prev : true));
    };

    // 1. Orders live sync
    const unsubOrders = safeOnSnapshot(collection(db, 'orders'), (snapshot) => {
      if (!isEffectActive) return;
      markConnectedIfLive(snapshot.metadata.fromCache);
      const remoteOrders: Order[] = [];
      snapshot.forEach(docSnap => {
        remoteOrders.push(docSnap.data() as Order);
      });
      remoteOrders.sort(
        (a, b) => (new Date(b.date || 0).getTime() || 0) - (new Date(a.date || 0).getTime() || 0)
      );
      setOrders(remoteOrders);
    }, (err) => {
      handleSnapshotError(err, OperationType.LIST, 'orders', handleTransientOffline);
    });

    // 2. Deposit Requests & Loans live sync
    const unsubDeposits = safeOnSnapshot(collection(db, 'depositRequests'), (snapshot) => {
      if (!isEffectActive) return;
      const remoteDeps: DepositRequest[] = [];
      snapshot.forEach(docSnap => {
        remoteDeps.push(docSnap.data() as DepositRequest);
      });
      remoteDeps.sort(
        (a, b) => (new Date(b.date || 0).getTime() || 0) - (new Date(a.date || 0).getTime() || 0)
      );
      setDepositRequests(remoteDeps);
    }, (err) => {
      handleSnapshotError(err, OperationType.LIST, 'depositRequests', handleTransientOffline);
    });

    // 3. POS Clients live sync (Deduplicated by ID)
    const unsubClients = safeOnSnapshot(collection(db, 'posClients'), (snapshot) => {
      if (!isEffectActive) return;
      const clientMap = new Map<string, POSClient>();
      snapshot.forEach(docSnap => {
        const client = docSnap.data() as POSClient;
        if (client && client.id) {
          clientMap.set(client.id, client);
        }
      });
      const syncedClients = Array.from(clientMap.values());
      setPosClients(syncedClients);

      const activeUser = currentUserRef.current;
      if (activeUser?.role === 'pos_client') {
        const ownRecords = findPosClientsForEmail(
          activeUser.email,
          syncedClients,
          activeUser.associatedId
        );
        const activeOwnRecords = ownRecords.filter(isPosClientActive);
        if (activeOwnRecords.length === 0) {
          if (!snapshot.metadata.fromCache) {
            authSessionEpochRef.current += 1;
            fbSignOut(auth).catch(console.error);
            clearTransientSessionCaches();
            setCurrentUser(null);
            showToast({
              type: 'error',
              title: ownRecords.length === 0 ? 'تم حذف حساب العميل' : 'تم إيقاف تفعيل الحساب',
              description:
                ownRecords.length === 0
                  ? 'تم حذف حسابك من قِبل المتجر ولم يعد متاحاً للوصول.'
                  : 'تم إيقاف تفعيل حسابك لدى المتجر مؤقتاً. يرجى التواصل مع مالك المتجر لإعادة التفعيل.',
            });
          }
        } else {
          const matchedRecord = activeOwnRecords.find(p => p.id === currentPosIdRef.current);
          const targetRecord = matchedRecord || activeOwnRecords[0];
          if (currentPosIdRef.current !== targetRecord.id) {
            currentPosIdRef.current = targetRecord.id;
            setCurrentPosId(targetRecord.id);
          }
          if (targetRecord.supplierId && currentSupplierIdRef.current !== targetRecord.supplierId) {
            currentSupplierIdRef.current = targetRecord.supplierId;
            setCurrentSupplierId(targetRecord.supplierId);
          }
        }
      }
    }, (err) => {
      handleSnapshotError(err, OperationType.LIST, 'posClients', handleTransientOffline);
    });

    // 4. Suppliers live sync (Deduplicated by ID) + Live Employee Permission Sync
    const unsubSuppliers = safeOnSnapshot(collection(db, 'suppliers'), (snapshot) => {
      if (!isEffectActive) return;
      const supMap = new Map<string, Supplier>();
      snapshot.forEach(docSnap => {
        const sup = docSnap.data() as Supplier;
        if (sup && sup.id) {
          supMap.set(sup.id, sup);
        }
      });
      const syncedSuppliers = Array.from(supMap.values());
      setSuppliers(syncedSuppliers);

      if (syncedSuppliers.length > 0 && !snapshot.metadata.fromCache) {
        const prevUser = currentUserRef.current;
        if (prevUser) {
          const cleanPrevEmail = normalizeStoreEmail(prevUser.email);
          if (prevUser.role === 'supplier') {
            const ownerSup = syncedSuppliers.find(
              s =>
                normalizeStoreEmail(s.email) === cleanPrevEmail ||
                (s.id === prevUser.associatedId &&
                  (!s.email || normalizeStoreEmail(s.email) === cleanPrevEmail))
            );
            if (ownerSup && isSupplierActive(ownerSup)) {
              if (currentSupplierIdRef.current !== ownerSup.id) {
                currentSupplierIdRef.current = ownerSup.id;
                setCurrentSupplierId(ownerSup.id);
              }
              if (currentPosIdRef.current) {
                currentPosIdRef.current = '';
                setCurrentPosId('');
              }
              setCurrentUser(curr => {
                if (!curr) return curr;
                if (curr.name === ownerSup.name && curr.associatedId === ownerSup.id) {
                  return curr;
                }
                return {
                  ...curr,
                  name: ownerSup.name,
                  associatedId: ownerSup.id,
                };
              });
            } else {
              // Store removed, suspended, or email reassigned -> revoke stale store session
              authSessionEpochRef.current += 1;
              fbSignOut(auth).catch(console.error);
              clearTransientSessionCaches();
              setCurrentUser(null);
            }
          } else if (prevUser.role === 'employee') {
            const targetSup = syncedSuppliers.find(
              s => s.id === (prevUser.supplierId || prevUser.associatedId)
            );
            if (!targetSup || !isSupplierActive(targetSup)) {
              authSessionEpochRef.current += 1;
              fbSignOut(auth).catch(console.error);
              clearTransientSessionCaches();
              setCurrentUser(null);
            } else if (normalizeStoreEmail(targetSup.email) === cleanPrevEmail) {
              // If email now belongs to store owner, upgrade to store owner
              currentPosIdRef.current = '';
              currentSupplierIdRef.current = targetSup.id;
              setCurrentPosId('');
              setRole('supplier');
              setActiveNavTab('catalogs');
              setCurrentSupplierId(targetSup.id);
              setCurrentUser(curr =>
                curr
                  ? {
                      ...curr,
                      role: 'supplier',
                      name: targetSup.name,
                      associatedId: targetSup.id,
                      supplierId: undefined,
                      employeeId: undefined,
                      roleTitle: undefined,
                      permissions: undefined,
                    }
                  : curr
              );
            } else {
              const syncedEmp = (targetSup.employees || []).find(
                e =>
                  (prevUser.employeeId && e.id === prevUser.employeeId) ||
                  normalizeStoreEmail(e.email) === cleanPrevEmail
              );
              if (!syncedEmp || !isEmployeeActive(syncedEmp)) {
                // Employee removed or suspended by store owner -> revoke session immediately
                authSessionEpochRef.current += 1;
                fbSignOut(auth).catch(console.error);
                clearTransientSessionCaches();
                setCurrentUser(null);
              } else {
                if (currentSupplierIdRef.current !== targetSup.id) {
                  currentSupplierIdRef.current = targetSup.id;
                  setCurrentSupplierId(targetSup.id);
                }
                if (currentPosIdRef.current) {
                  currentPosIdRef.current = '';
                  setCurrentPosId('');
                }
                const nextPerms = normalizeEmployeePermissions(syncedEmp.permissions);
                const nextEmail = normalizeStoreEmail(syncedEmp.email);
                setCurrentUser(curr => {
                  if (!curr) return curr;
                  if (
                    curr.name === syncedEmp.name &&
                    curr.email === nextEmail &&
                    curr.phone === syncedEmp.phone &&
                    curr.associatedId === targetSup.id &&
                    curr.supplierId === targetSup.id &&
                    curr.employeeId === syncedEmp.id &&
                    curr.roleTitle === syncedEmp.roleTitle &&
                    JSON.stringify(curr.permissions) === JSON.stringify(nextPerms)
                  ) {
                    return curr;
                  }
                  return {
                    ...curr,
                    name: syncedEmp.name,
                    email: nextEmail,
                    phone: syncedEmp.phone,
                    associatedId: targetSup.id,
                    supplierId: targetSup.id,
                    employeeId: syncedEmp.id,
                    roleTitle: syncedEmp.roleTitle,
                    permissions: nextPerms,
                  };
                });
              }
            }
          }
        }
      }
    }, (err) => {
      handleSnapshotError(err, OperationType.LIST, 'suppliers', handleTransientOffline);
    });

    // 5. Catalogs live sync
    const unsubCatalogs = safeOnSnapshot(collection(db, 'catalogs'), (snapshot) => {
      if (!isEffectActive) return;
      const catMap = new Map<string, Catalog>();
      snapshot.forEach(docSnap => {
        const cat = docSnap.data() as Catalog;
        if (cat && cat.id) {
          catMap.set(cat.id, cat);
        }
      });
      setCatalogs(Array.from(catMap.values()));
    }, (err) => {
      handleSnapshotError(err, OperationType.LIST, 'catalogs', handleTransientOffline);
    });

    // 6. Services live sync
    const unsubServices = safeOnSnapshot(collection(db, 'services'), (snapshot) => {
      if (!isEffectActive) return;
      markConnectedIfLive(snapshot.metadata.fromCache);
      const srvMap = new Map<string, DigitalService>();
      snapshot.forEach(docSnap => {
        const srv = docSnap.data() as DigitalService;
        if (srv && srv.id) {
          srvMap.set(srv.id, srv);
        }
      });
      setServices(Array.from(srvMap.values()));
    }, (err) => {
      handleSnapshotError(err, OperationType.LIST, 'services', handleTransientOffline);
    });

    // 7. Platform Interface Settings live sync
    const unsubPlatformSettings = safeOnSnapshot(doc(db, 'system', 'platformSettings'), (docSnap) => {
      if (!isEffectActive) return;
      if (docSnap.exists()) {
        setPlatformSettings(mergePlatformSettings(docSnap.data() as Partial<PlatformInterfaceSettings>));
      }
    }, (err) => {
      handleSnapshotError(err, OperationType.GET, 'system/platformSettings', handleTransientOffline);
    });

    // 8. Super Admin & Admin Accounts live sync
    const unsubSuperAdmin = safeOnSnapshot(doc(db, 'system', 'superAdmin'), (docSnap) => {
      if (!isEffectActive) return;
      markConnectedIfLive(docSnap.metadata.fromCache);
      if (docSnap.exists()) {
        const remoteAdmin = docSnap.data() as Partial<SuperAdmin>;
        setSuperAdmin(prev => ({
          ...prev,
          ...remoteAdmin,
          adminAccounts: Array.isArray(remoteAdmin.adminAccounts)
            ? remoteAdmin.adminAccounts
            : (prev.adminAccounts || [])
        }));

        if (!docSnap.metadata.fromCache && Array.isArray(remoteAdmin.adminAccounts)) {
          const activeUser = currentUserRef.current;
          if (activeUser?.adminAccountId) {
            const syncedAcc = remoteAdmin.adminAccounts?.find(a => a.id === activeUser.adminAccountId);
            if (!syncedAcc || !syncedAcc.isActive) {
              authSessionEpochRef.current += 1;
              fbSignOut(auth).catch(console.error);
              clearTransientSessionCaches();
              setCurrentUser(null);
            } else {
              setCurrentUser(prevUser => {
                if (!prevUser?.adminAccountId) return prevUser;
                if (
                  prevUser.name === syncedAcc.name &&
                  prevUser.email === syncedAcc.email &&
                  prevUser.phone === syncedAcc.phone &&
                  prevUser.roleTitle === syncedAcc.roleTitle &&
                  JSON.stringify(prevUser.adminPermissions) === JSON.stringify(syncedAcc.permissions)
                ) {
                  return prevUser;
                }
                return {
                  ...prevUser,
                  name: syncedAcc.name,
                  email: syncedAcc.email,
                  phone: syncedAcc.phone,
                  roleTitle: syncedAcc.roleTitle,
                  adminPermissions: syncedAcc.permissions
                };
              });
            }
          }
        }
      }
    }, (err) => {
      handleSnapshotError(err, OperationType.GET, 'system/superAdmin', handleTransientOffline);
    });

    // Stagger secondary & role-scoped listeners slightly so Watch target registrations never burst simultaneously
    const secondaryTimer = setTimeout(() => {
      if (!isEffectActive) return;

      // 9. Loan Repayment Requests live sync (all roles)
      secondaryUnsubs.push(
        safeOnSnapshot(collection(db, 'loanRepaymentRequests'), (snapshot) => {
          if (!isEffectActive) return;
          const remoteReqs: LoanRepaymentRequest[] = [];
          snapshot.forEach(docSnap => {
            remoteReqs.push(docSnap.data() as LoanRepaymentRequest);
          });
          remoteReqs.sort(
            (a, b) => (new Date(b.date || 0).getTime() || 0) - (new Date(a.date || 0).getTime() || 0)
          );
          setLoanRepaymentRequests(remoteReqs);
        }, (err) => {
          handleSnapshotError(err, OperationType.LIST, 'loanRepaymentRequests', handleTransientOffline);
        })
      );

      // 10. Supplier Bank Accounts live sync (all roles)
      secondaryUnsubs.push(
        safeOnSnapshot(collection(db, 'supplierBankAccounts'), (snapshot) => {
          if (!isEffectActive) return;
          const accMap = new Map<string, SupplierBankAccount>();
          snapshot.forEach(docSnap => {
            const acc = docSnap.data() as SupplierBankAccount;
            if (acc && acc.id) {
              accMap.set(acc.id, acc);
            }
          });
          setSupplierBankAccounts(Array.from(accMap.values()));
        }, (err) => {
          handleSnapshotError(err, OperationType.LIST, 'supplierBankAccounts', handleTransientOffline);
        })
      );

      if (role === 'supplier' || role === 'employee' || role === 'super_admin') {
        // 11. Voucher Warehouses live sync (supplier / employee / super_admin only)
        secondaryUnsubs.push(
          safeOnSnapshot(collection(db, 'voucherWarehouses'), (snapshot) => {
            if (!isEffectActive) return;
            const whMap = new Map<string, VoucherWarehouse>();
            snapshot.forEach(docSnap => {
              const wh = docSnap.data() as VoucherWarehouse;
              if (wh && wh.id) {
                whMap.set(wh.id, wh);
              }
            });
            setVoucherWarehouses(Array.from(whMap.values()));
          }, (err) => {
            handleSnapshotError(err, OperationType.LIST, 'voucherWarehouses', handleTransientOffline);
          })
        );

        // 12. Accounting Entries live sync (supplier / employee / super_admin only)
        secondaryUnsubs.push(
          safeOnSnapshot(collection(db, 'accountingEntries'), (snapshot) => {
            if (!isEffectActive) return;
            const entryMap = new Map<string, AccountingEntry>();
            snapshot.forEach(docSnap => {
              const entry = docSnap.data() as AccountingEntry;
              if (entry && entry.id) {
                entryMap.set(entry.id, entry);
              }
            });
            const syncedEntries = Array.from(entryMap.values()).sort(
              (a, b) => (new Date(b.date || 0).getTime() || 0) - (new Date(a.date || 0).getTime() || 0)
            );
            setAccountingEntries(syncedEntries);
          }, (err) => {
            handleSnapshotError(err, OperationType.LIST, 'accountingEntries', handleTransientOffline);
          })
        );

        // 13. Invite Links live sync (supplier / employee / super_admin only)
        secondaryUnsubs.push(
          safeOnSnapshot(collection(db, 'inviteLinks'), (snapshot) => {
            if (!isEffectActive) return;
            const invMap = new Map<string, InviteLink>();
            snapshot.forEach(docSnap => {
              const inv = docSnap.data() as InviteLink;
              if (inv && inv.id) {
                invMap.set(inv.id, inv);
              }
            });
            const syncedInvites = Array.from(invMap.values());
            inviteLinksRef.current = syncedInvites;
            setInviteLinks(syncedInvites);
          }, (err) => {
            handleSnapshotError(err, OperationType.LIST, 'inviteLinks', handleTransientOffline);
          })
        );
      }

      if (role === 'super_admin') {
        // 14. Admin Accounting Entries live sync (super_admin only)
        secondaryUnsubs.push(
          safeOnSnapshot(collection(db, 'adminAccountingEntries'), (snapshot) => {
            if (!isEffectActive) return;
            const admMap = new Map<string, AdminAccountingEntry>();
            snapshot.forEach(docSnap => {
              const entry = docSnap.data() as AdminAccountingEntry;
              if (entry && entry.id) {
                admMap.set(entry.id, entry);
              }
            });
            const syncedAdmEntries = Array.from(admMap.values()).sort(
              (a, b) => (new Date(b.date || 0).getTime() || 0) - (new Date(a.date || 0).getTime() || 0)
            );
            setAdminAccountingEntries(syncedAdmEntries);
          }, (err) => {
            handleSnapshotError(err, OperationType.LIST, 'adminAccountingEntries', handleTransientOffline);
          })
        );
      }
    }, 150);

    return () => {
      isEffectActive = false;
      clearTimeout(secondaryTimer);
      unsubOrders();
      unsubDeposits();
      unsubClients();
      unsubSuppliers();
      unsubCatalogs();
      unsubServices();
      unsubPlatformSettings();
      unsubSuperAdmin();
      secondaryUnsubs.forEach(unsub => unsub());
    };
  }, [isAuthenticated, role, firestoreRecoveryEpoch]);

  // Never rely on localStorage temporary auth snapshot to restore or determine role/store identity
  useEffect(() => {
    try {
      localStorage.removeItem('digipos_auth_user');
    } catch {
      // ignore
    }
  }, [currentUser]);

  // Google Login via Firebase Popup
  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    authSessionEpochRef.current += 1;
    const myEpoch = authSessionEpochRef.current;
    isManualAuthInProgressRef.current = true;
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const fbUser = res.user;
      const cleanEmail = normalizeStoreEmail(fbUser.email);
      const displayName = fbUser.displayName || 'مستخدم Google';

      if (!cleanEmail) {
        await fbSignOut(auth).catch(() => {});
        showToast({
          type: 'error',
          title: 'تعذر التحقق من البريد الإلكتروني',
          description: 'لم يُرجع حساب جوجل بريداً إلكترونياً صالحاً.'
        });
        return { success: false, error: 'تعذر الحصول على البريد الإلكتروني من حساب جوجل.' };
      }

      const conn = await reconnectFirestore(12000);
      setIsFirestoreConnected(conn.success);
      if (!conn.success) {
        await fbSignOut(auth).catch(() => {});
        const errMsg = conn.message || 'تعذر الاتصال بقاعدة بيانات Firestore للتحقق من هوية الحساب.';
        showToast({
          type: 'error',
          title: 'تعذر التحقق من قاعدة البيانات',
          description: errMsg,
        });
        return { success: false, error: errMsg };
      }

      const authData = await firestoreSync.fetchAuthoritativeIdentityDataFromFirestore(
        cleanEmail,
        fbUser.uid
      );
      if (!authData.connected || authData.suppliers === null || authData.posClients === null) {
        await fbSignOut(auth).catch(() => {});
        const errMsg = 'تعذر جلب بيانات الحساب الموثقة من قاعدة بيانات Firestore. يرجى المحاولة مجدداً.';
        showToast({
          type: 'error',
          title: 'تعذر قراءة بيانات الحساب',
          description: errMsg,
        });
        return { success: false, error: errMsg };
      }

      if (authSessionEpochRef.current !== myEpoch) {
        return { success: false, error: 'تم إلغاء جلسة تسجيل الدخول.' };
      }

      const reconciled = reconcileIdentityCollectionsFromServer(authData);
      const authoritativeSuperAdmin = authData.superAdmin
        ? {
            ...reconciled.superAdmin,
            ...authData.superAdmin,
            adminAccounts: Array.isArray(authData.superAdmin.adminAccounts)
              ? authData.superAdmin.adminAccounts
              : reconciled.superAdmin.adminAccounts || [],
          }
        : reconciled.superAdmin;

      let identity = resolveAuthoritativeIdentityFromFirestore({
        email: cleanEmail,
        superAdmin: authoritativeSuperAdmin,
        suppliers: authData.suppliers,
        posClients: authData.posClients,
        userDoc: authData.userDoc,
      });

      if (identity.kind === 'sub_admin' && !identity.adminAccount.isActive) {
        await fbSignOut(auth).catch(() => {});
        showToast({
          type: 'error',
          title: 'الحساب الإداري موقوف',
          description: 'تم إيقاف هذا الحساب الإداري من قبل المدير العام للتطبيق.'
        });
        return { success: false, error: 'تم إيقاف هذا الحساب الإداري من قبل المدير العام للتطبيق.' };
      }

      if (identity.kind === 'supplier' && !isSupplierActive(identity.supplier)) {
        await fbSignOut(auth).catch(() => {});
        showToast({
          type: 'error',
          title: 'المتجر موقوف من الإدارة',
          description: 'تم إيقاف هذا المتجر مؤقتاً من قِبل مدير التطبيق. يرجى التواصل مع إدارة المنصة.'
        });
        return { success: false, error: 'تم إيقاف هذا المتجر من قِبل مدير التطبيق.' };
      }

      if (identity.kind === 'employee') {
        const eligibility = evaluateEmployeeLoginEligibility(identity.supplier, identity.employee);
        if (!eligibility.allowed) {
          await fbSignOut(auth).catch(() => {});
          showToast({
            type: 'error',
            title: eligibility.title || 'تعذر تسجيل الدخول',
            description: eligibility.error
          });
          return { success: false, error: eligibility.error };
        }
      }

      if (identity.kind === 'pos_client') {
        const clientEligibility = evaluatePosClientLoginEligibility(identity.posRecords);
        if (!clientEligibility.allowed) {
          await fbSignOut(auth).catch(() => {});
          showToast({
            type: 'error',
            title: clientEligibility.title || 'حساب العميل موقوف',
            description: clientEligibility.error
          });
          return { success: false, error: clientEligibility.error };
        }
      }

      if (identity.kind === 'unregistered') {
        const activeSupList = authData.suppliers.filter(s => isSupplierActive(s));
        const defaultSupId = activeSupList[0]?.id || authData.suppliers[0]?.id || '';
        const newPosCode = `POS-${Math.floor(10000 + Math.random() * 90000)}`;
        const newPos: POSClient = {
          id: `pos-fb-${fbUser.uid.slice(0, 8)}`,
          posCode: newPosCode,
          tradeName: `متجر ${displayName}`,
          ownerName: displayName,
          phone: fbUser.phoneNumber || '+966 55 000 0000',
          email: cleanEmail,
          country: 'المملكة العربية السعودية',
          city: 'الرياض',
          supplierId: defaultSupId,
          tier: 'regular',
          walletBalance: 0,
          totalSpent: 0,
          ordersCount: 0,
          createdAt: new Date().toISOString().substring(0, 10),
          qrCodeValue: `DIGIPOS:${newPosCode}`,
          logoUrl: fbUser.photoURL || undefined
        };
        setPosClients(prev => [newPos, ...prev.filter(p => p.id !== newPos.id)]);
        firestoreSync.savePosClient(newPos).catch(console.error);
        identity = {
          kind: 'pos_client',
          email: cleanEmail,
          posRecords: [newPos],
          suppliers: authData.suppliers.filter(s => s.id === defaultSupId),
        };
      }

      const built = buildAuthUserFromIdentity(identity, {
        uid: fbUser.uid,
        phone: fbUser.phoneNumber || undefined,
        masterAdminName: authoritativeSuperAdmin.name || displayName,
        preferredPosId: authData.userDoc?.associatedId,
      });

      const applied = applyResolvedAuthenticatedSession({
        built,
        epoch: myEpoch,
        clearCachesFirst: true,
      });
      if (!applied) {
        return { success: false, error: 'تم إلغاء جلسة تسجيل الدخول.' };
      }

      firestoreSync.saveUser(built.authUser).catch(console.error);

      if (built.role !== 'pos_client') {
        triggerConfetti();
      }
      showToast({
        type: 'success',
        title: 'تم تسجيل الدخول عبر Google بنجاح',
        description: `مرحباً بك ${built.authUser.name}. تم توجيهك مباشرة إلى حسابك الخاص.`
      });

      return { success: true };
    } catch (err: unknown) {
      console.error('Google Sign-in failed:', err);
      const fbErr = err as { code?: string; message?: string };
      let msg = fbErr?.message || 'تعذر تسجيل الدخول عبر حساب جوجل';
      if (fbErr?.code === 'auth/popup-closed-by-user') {
        msg = 'تم إغلاق نافذة تسجيل الدخول بحساب جوجل قبل إتمام العملية.';
      } else if (fbErr?.code === 'auth/cancelled-popup-request') {
        msg = 'تم إلغاء طلب تسجيل الدخول السابق، يرجى المحاولة مرة أخرى.';
      } else if (fbErr?.code === 'auth/popup-blocked') {
        msg = 'قام المتصفح بحظر نافذة تسجيل الدخول المنبثقة (auth/popup-blocked). يرجى السماح بالنوافذ المنبثقة في متصفحك أو استخدام تسجيل الدخول بالبريد الإلكتروني وكلمة المرور.';
      } else if (fbErr?.code === 'auth/unauthorized-domain') {
        msg = 'نطاق الموقع الحالي غير مضاف في النطاقات المصرح بها داخل إعدادات Firebase Auth.';
      } else if (fbErr?.code === 'auth/network-request-failed') {
        msg = 'تعذر الاتصال بخدمات جوجل بسبب قيود الشبكة أو المتصفح (network-request-failed). يرجى استخدام تسجيل الدخول بالبريد الإلكتروني وكلمة المرور.';
      }
      showToast({
        type: 'error',
        title: 'فشل تسجيل الدخول بحساب جوجل',
        description: msg
      });
      return { success: false, error: msg };
    } finally {
      isManualAuthInProgressRef.current = false;
    }
  };

  // Sync / Seed all local & remote state with Firebase Firestore
  const syncAllToFirestore = async (): Promise<void> => {
    setIsSyncingWithFirestore(true);
    try {
      const syncRes = await ensureDatabaseConnectedAndSynced({ forceSync: true, silent: true });
      if (!syncRes.connected) {
        showToast({
          type: 'error',
          title: 'تعذر الاتصال بقاعدة البيانات',
          description: syncRes.message || 'تعذر الاتصال بقاعدة بيانات Firestore.'
        });
        return;
      }

      const res = await firestoreSync.seedInitialDataToFirestore({
        posClients: posClientsRef.current,
        suppliers: suppliersRef.current,
        superAdmin: superAdminRef.current,
        platformSettings: platformSettingsRef.current,
        catalogs: catalogsRef.current,
        services: servicesRef.current,
        voucherWarehouses: voucherWarehousesRef.current,
        orders: ordersRef.current,
        depositRequests: depositRequestsRef.current,
        loanRepaymentRequests: loanRepaymentRequestsRef.current,
        supplierBankAccounts: supplierBankAccountsRef.current,
        accountingEntries: accountingEntriesRef.current,
        adminAccountingEntries: adminAccountingEntriesRef.current,
        inviteLinks: inviteLinksRef.current,
      });

      if (res.success) {
        setIsFirestoreConnected(true);
        const nowIso = new Date().toISOString();
        lastFirestoreSyncAtRef.current = nowIso;
        setLastFirestoreSyncAt(nowIso);
        setDatabaseSyncMessage('تمت مزامنة كافة القواعد المحلية وقاعدة بيانات فايربيس بنجاح.');
        triggerConfetti();
        showToast({
          type: 'success',
          title: 'تمت مزامنة كافة البيانات مع فايربيس بنجاح!',
          description: 'تم قيد وتوثيق الطلبات، والمحافظ، والعملاء، والسلف، والعمليات المالية في قاعدة بيانات Firestore السحابية.'
        });
      } else {
        showToast({
          type: 'error',
          title: 'تعذرت المزامنة مع فايربيس',
          description: res.error || 'حدث خطأ أثناء كتابة البيانات إلى Firestore'
        });
      }
    } finally {
      setIsSyncingWithFirestore(false);
    }
  };

  // Reset all services, operational data, and all non-admin users while keeping Super Admin & Admin staff
  const clearUsersSuppliersAndClientsData = async (): Promise<void> => {
    setIsSyncingWithFirestore(true);
    try {
      // 1. Purge LocalStorage and reset state (preserving superAdmin, platformSettings, fixed catalogs, and admin session)
      applyLocalNonAdminStateReset(superAdmin);

      // 2. Clear Firestore collections if connected (preserving Super Admin & Admin staff)
      const conn = await testConnection();
      if (conn.success) {
        const res = await firestoreSync.resetServicesAndNonAdminData(superAdmin);
        triggerConfetti();
        showToast({
          type: 'success',
          title: 'تم تصفير الخدمات والمستخدمين بنجاح!',
          description: `تم حذف ${res.servicesCleared} خدمة، ${res.warehousesCleared} مخزن، ${res.suppliersCleared} متجر، ${res.clientsCleared} نقطة بيع، و${res.usersCleared} مستخدم مع الإبقاء على مدير التطبيق وموظفيه (${res.usersPreserved} حساب إداري).`
        });
      } else {
        showToast({
          type: 'success',
          title: 'تم تصفير البيانات المحلية بنجاح',
          description: 'تم تصفير الخدمات والمستخدمين والعمليات محلياً مع الإبقاء على مدير التطبيق وموظفيه.'
        });
      }
    } catch (err: unknown) {
      console.error('Failed to clear data:', err);
      showToast({
        type: 'error',
        title: 'تعذر تصفير البيانات',
        description: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setIsSyncingWithFirestore(false);
    }
  };

  // Auth Operations
  const sendLoginOtp = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, error: 'يرجى إدخال البريد الإلكتروني أولاً' };
    }

    // Ensure database connection is active and synced if needed
    if (!isFirestoreConnected || !lastFirestoreSyncAtRef.current) {
      await ensureDatabaseConnectedAndSynced({
        forceSync: !isFirestoreConnected,
        silent: true,
      }).catch(() => {});
    }

    // Check if there is an unexpired OTP
    const existing = activeOtps[cleanEmail];
    const now = Date.now();
    if (existing && existing.expiresAt > now) {
      const remainingSec = Math.ceil((existing.expiresAt - now) / 1000);
      return { 
        success: true, 
        code: existing.code, 
        email: cleanEmail,
        cooldownSeconds: 0,
        remainingSeconds: remainingSec 
      };
    }

    // Generate 6-digit random code
    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = now + (2 * 60 * 1000); // 2 minutes exact validity

    setActiveOtps(prev => ({
      ...prev,
      [cleanEmail]: {
        code: generatedCode,
        expiresAt
      }
    }));

    showToast({
      type: 'success',
      title: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني',
      description: `تم إرسال رمز التحقق (OTP) بنجاح إلى البريد الإلكتروني (${cleanEmail}): ${generatedCode} (صالح لمدة دقيقتين فقط)`
    });

    return { 
      success: true, 
      code: generatedCode, 
      email: cleanEmail,
      cooldownSeconds: 15,
      remainingSeconds: 120 
    };
  };

  const verifyLoginOtpAndLogin = async (email: string, password: string, otpCode: string = '') => {
    const cleanEmail = normalizeStoreEmail(email);
    const cleanOtp = (otpCode || '').trim();
    const enteredPassword = password.trim();

    if (!cleanEmail || !enteredPassword) {
      showToast({ type: 'error', title: 'بيانات غير مكتملة', description: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' });
      return { success: false, error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' };
    }

    // 1. Verify and restore database connectivity before reading authoritative identity from Firestore
    if (isNavigatorOffline()) {
      setIsFirestoreConnected(false);
      const offlineErr = 'الجهاز غير متصل بشبكة الإنترنت حالياً. يرجى التحقق من الشبكة والمحاولة مجدداً.';
      showToast({
        type: 'error',
        title: 'لا يوجد اتصال بالإنترنت',
        description: offlineErr,
      });
      return { success: false, error: offlineErr };
    }

    const conn = await reconnectFirestore(12000);
    setIsFirestoreConnected(conn.success);
    if (!conn.success) {
      const connErr = conn.message || 'تعذر إتمام الاتصال بقاعدة بيانات Firebase. يرجى التحقق من الشبكة والمحاولة مجدداً.';
      showToast({
        type: 'error',
        title: 'تعذر الاتصال بقاعدة البيانات',
        description: connErr,
      });
      return { success: false, error: connErr };
    }

    // 2. Verify OTP only if an OTP was requested for this email or an OTP code was entered
    const storedOtp = activeOtps[cleanEmail];
    const shouldVerifyOtp = Boolean(storedOtp) || cleanOtp.length > 0;
    if (shouldVerifyOtp) {
      const now = Date.now();
      if (!storedOtp) {
        showToast({ type: 'error', title: 'رمز غير موجود', description: 'يرجى طلب رمز تحقق أولاً عبر زر "إرسال الرمز"' });
        return { success: false, error: 'يرجى طلب رمز تحقق أولاً عبر زر "إرسال الرمز"' };
      }

      if (now > storedOtp.expiresAt) {
        showToast({ type: 'error', title: 'انتهت صلاحية الرمز', description: 'انتهت صلاحية رمز التحقق (مدة الصلاحية دقيقتين فقط). يرجى طلب رمز جديد.' });
        return { success: false, error: 'انتهت صلاحية رمز التحقق (مدة الصلاحية دقيقتين فقط). يرجى طلب رمز جديد.' };
      }

      if (storedOtp.code !== cleanOtp) {
        showToast({ type: 'error', title: 'رمز غير صحيح', description: 'رمز التحقق المدخل غير متطابق. تأكد من الرمز المرسل.' });
        return { success: false, error: 'رمز التحقق المدخل غير متطابق. تأكد من الرمز المرسل.' };
      }
    }

    authSessionEpochRef.current += 1;
    const myEpoch = authSessionEpochRef.current;
    isManualAuthInProgressRef.current = true;
    try {
      // 3. Always fetch fresh authoritative identity records directly from Firestore server
      const authData = await firestoreSync.fetchAuthoritativeIdentityDataFromFirestore(cleanEmail);
      if (!authData.connected || authData.suppliers === null || authData.posClients === null) {
        const fetchErr = 'تعذر جلب بيانات الحساب الموثقة من قاعدة بيانات Firestore. يرجى المحاولة مجدداً.';
        showToast({
          type: 'error',
          title: 'تعذر التحقق من قاعدة البيانات',
          description: fetchErr,
        });
        return { success: false, error: fetchErr };
      }

      if (authSessionEpochRef.current !== myEpoch) {
        return { success: false, error: 'تم إلغاء جلسة تسجيل الدخول.' };
      }

      const reconciled = reconcileIdentityCollectionsFromServer(authData);
      const activeSuppliers = authData.suppliers;
      const activePosClients = authData.posClients;
      const activeSuperAdmin = authData.superAdmin
        ? {
            ...reconciled.superAdmin,
            ...authData.superAdmin,
            adminAccounts: Array.isArray(authData.superAdmin.adminAccounts)
              ? authData.superAdmin.adminAccounts
              : reconciled.superAdmin.adminAccounts || [],
          }
        : reconciled.superAdmin;

      // 4. Resolve exact account identity from Firestore records (never stale cache/state)
      let resolvedUserDoc = authData.userDoc;
      let identity = resolveAuthoritativeIdentityFromFirestore({
        email: cleanEmail,
        superAdmin: activeSuperAdmin,
        suppliers: activeSuppliers,
        posClients: activePosClients,
        userDoc: resolvedUserDoc,
      });

      let verifiedUid: string | undefined;

      if (identity.kind === 'unregistered') {
        let authFallbackCred = null;
        let authFallbackError: any = null;
        try {
          authFallbackCred = await signInWithEmailAndPassword(auth, cleanEmail, enteredPassword);
        } catch (err: any) {
          authFallbackError = err;
        }

        if (authFallbackCred) {
          verifiedUid = authFallbackCred.user.uid;
          const [uidUserDoc, emailUserDoc, existingClients] = await Promise.all([
            firestoreSync.getUser(verifiedUid).catch(() => null),
            firestoreSync.findUserByEmail(cleanEmail).catch(() => null),
            firestoreSync.findPosClientsByEmail(cleanEmail).catch(() => []),
          ]);
          resolvedUserDoc = uidUserDoc || emailUserDoc || resolvedUserDoc;
          const allKnownClients = [...existingClients, ...activePosClients];

          const recovery = resolveOrphanedAuthRecovery({
            email: cleanEmail,
            uid: verifiedUid,
            displayName: authFallbackCred.user.displayName,
            phone: authFallbackCred.user.phoneNumber,
            userDoc: resolvedUserDoc,
            existingClients: allKnownClients,
            suppliers: activeSuppliers,
            superAdmin: activeSuperAdmin,
          });

          if (recovery.action === 'reject_admin') {
            await fbSignOut(auth).catch(() => {});
            showToast({
              type: 'error',
              title: 'صلاحية مرفوضة',
              description: 'لا يمكن استعادة حساب مشرف بهذه الطرق. يرجى مراجعة إعدادات الإدارة العامة.',
            });
            return { success: false, error: 'صلاحية مرفوضة لحساب مشرف.' };
          } else if (recovery.action === 'restore_supplier') {
            await firestoreSync.saveSupplier(recovery.supplier);
            setSuppliers(prev => [recovery.supplier, ...prev.filter(s => s.id !== recovery.supplier.id)]);
            identity = { kind: 'supplier', email: cleanEmail, supplier: recovery.supplier };
          } else if (recovery.action === 'restore_pos_client') {
            if (!isPosClientActive(recovery.posClient)) {
              await fbSignOut(auth).catch(() => {});
              showToast({
                type: 'error',
                title: 'حساب العميل موقوف',
                description:
                  'تم إيقاف تفعيل حسابك لدى المتجر مؤقتاً. يرجى التواصل مع مالك المتجر لإعادة التفعيل.',
              });
              return {
                success: false,
                error:
                  'تم إيقاف تفعيل حسابك لدى المتجر مؤقتاً. يرجى التواصل مع مالك المتجر لإعادة التفعيل.',
              };
            }
            await firestoreSync.savePosClient(recovery.posClient);
            setPosClients(prev => [recovery.posClient, ...prev.filter(p => p.id !== recovery.posClient.id)]);
            identity = {
              kind: 'pos_client',
              email: cleanEmail,
              posRecords: [recovery.posClient],
              suppliers: activeSuppliers.filter(s => s.id === recovery.posClient.supplierId),
            };
          } else {
            await fbSignOut(auth).catch(() => {});
            showToast({
              type: 'error',
              title: 'الحساب غير مرتبط بمتجر',
              description: 'تم التحقق من بياناتك في نظام المصادقة، ولكن لم يتم العثور على متجر مرتبط بهذا الحساب. يرجى إنشاء حساب جديد عبر اختيار المتجر الصحيح.',
            });
            return {
              success: false,
              error: 'الحساب غير مرتبط بمتجر محدد. يرجى التأكد من البريد أو التسجيل برابط المتجر.',
            };
          }
        } else {
          const mapped = mapUnregisteredFirebaseAuthLoginErrorAr(authFallbackError?.code);
          showToast({
            type: 'error',
            title: mapped.title,
            description: mapped.error,
          });
          return {
            success: false,
            error: mapped.error,
          };
        }
      }

      if (identity.kind === 'sub_admin') {
        if (!identity.adminAccount.isActive) {
          showToast({
            type: 'error',
            title: 'الحساب الإداري موقوف',
            description: 'تم إيقاف هذا الحساب الإداري من قبل المدير العام. يرجى مراجعة إدارة المنصة.'
          });
          return {
            success: false,
            error: 'تم إيقاف هذا الحساب الإداري من قبل المدير العام.'
          };
        }
        const configuredPassword = (identity.adminAccount.password || '').trim();
        if (!configuredPassword || configuredPassword !== enteredPassword) {
          showToast({
            type: 'error',
            title: 'كلمة المرور غير صحيحة',
            description: 'كلمة المرور المدخلة غير صحيحة ولا تتطابق مع كلمة المرور المحددة لهذا الحساب الإداري.'
          });
          return {
            success: false,
            error: 'كلمة المرور المدخلة غير صحيحة لهذا الحساب الإداري.'
          };
        }
        // Clear any prior Firebase Auth session so it cannot override this sub-admin session
        await fbSignOut(auth).catch(() => {});
      } else if (identity.kind === 'employee') {
        const eligibility = evaluateEmployeeLoginEligibility(identity.supplier, identity.employee);
        if (!eligibility.allowed) {
          showToast({
            type: 'error',
            title: eligibility.title || 'تعذر تسجيل الدخول',
            description: eligibility.error
          });
          return {
            success: false,
            error: eligibility.error
          };
        }
        if (!verifyEmployeeCredentials(identity.employee, enteredPassword)) {
          showToast({
            type: 'error',
            title: 'كلمة المرور غير صحيحة',
            description: 'كلمة المرور المدخلة غير صحيحة! لا تتطابق مع كلمة المرور التي حددها مالك المتجر لحساب هذا الموظف.'
          });
          return {
            success: false,
            error: 'كلمة المرور غير صحيحة. يرجى إدخال كلمة المرور التي أعدها مالك المتجر للموظف.'
          };
        }
        // Clear any prior Firebase Auth session so it cannot override this employee session
        await fbSignOut(auth).catch(() => {});
      } else if (identity.kind === 'master_admin') {
        const masterDemoPasswords: Record<string, string> = {
          'admin@digipos-platform.com': 'SuperAdminPass2026!',
        };
        if (masterDemoPasswords[cleanEmail]) {
          if (masterDemoPasswords[cleanEmail] !== enteredPassword) {
            showToast({
              type: 'error',
              title: 'كلمة المرور غير صحيحة',
              description: 'كلمة المرور المدخلة غير صحيحة. يرجى التأكد من صحة البيانات والمحاولة مجدداً.'
            });
            return { success: false, error: 'كلمة المرور المدخلة غير صحيحة.' };
          }
          await fbSignOut(auth).catch(() => {});
        } else {
          try {
            const cred = await signInWithEmailAndPassword(auth, cleanEmail, enteredPassword);
            verifiedUid = cred.user.uid;
          } catch {
            showToast({
              type: 'error',
              title: 'كلمة المرور غير صحيحة',
              description: 'كلمة المرور المدخلة غير صحيحة لحساب الإدارة العامة.'
            });
            return { success: false, error: 'كلمة المرور المدخلة غير صحيحة.' };
          }
        }
      } else if (identity.kind === 'supplier') {
        if (!isSupplierActive(identity.supplier)) {
          showToast({
            type: 'error',
            title: 'المتجر موقوف من الإدارة',
            description: 'تم إيقاف هذا المتجر مؤقتاً من قِبل مدير التطبيق. يرجى التواصل مع إدارة المنصة.'
          });
          return {
            success: false,
            error: 'تم إيقاف هذا المتجر من قِبل مدير التطبيق.'
          };
        }
        let isSupplierAuthed = false;
        try {
          const cred = await signInWithEmailAndPassword(auth, cleanEmail, enteredPassword);
          verifiedUid = cred.user.uid;
          isSupplierAuthed = true;
        } catch (authErr: unknown) {
          const fbErr = authErr as { code?: string };
          const adminSetPassword = (identity.supplier.password || '').trim();
          // Support suppliers created directly by Super Admin (stored on supplier record without Firebase Auth user)
          if (
            adminSetPassword &&
            adminSetPassword === enteredPassword &&
            (fbErr?.code === 'auth/user-not-found' || fbErr?.code === 'auth/invalid-credential')
          ) {
            await fbSignOut(auth).catch(() => {});
            isSupplierAuthed = true;
          }
        }
        if (!isSupplierAuthed) {
          showToast({
            type: 'error',
            title: 'كلمة المرور غير صحيحة',
            description: 'كلمة المرور المدخلة غير صحيحة لحساب المتجر. يرجى التأكد والمحاولة مجدداً.'
          });
          return {
            success: false,
            error: 'كلمة المرور المدخلة غير صحيحة لحساب المتجر.'
          };
        }
      } else {
        // pos_client: strictly verify password via Firebase Auth before checking suspension
        try {
          const cred = await signInWithEmailAndPassword(auth, cleanEmail, enteredPassword);
          verifiedUid = cred.user.uid;
        } catch {
          showToast({
            type: 'error',
            title: 'كلمة المرور غير صحيحة',
            description: 'كلمة المرور المدخلة غير صحيحة لحساب العميل. يرجى التأكد والمحاولة مجدداً.'
          });
          return {
            success: false,
            error: 'كلمة المرور المدخلة غير صحيحة. يرجى إعادة إدخالها والمحاولة مجدداً.'
          };
        }

        const clientEligibility = evaluatePosClientLoginEligibility(
          identity.kind === 'pos_client' ? identity.posRecords : []
        );
        if (!clientEligibility.allowed) {
          await fbSignOut(auth).catch(() => {});
          showToast({
            type: 'error',
            title: clientEligibility.title || 'حساب العميل موقوف',
            description: clientEligibility.error
          });
          return {
            success: false,
            error: clientEligibility.error
          };
        }
      }

      if (verifiedUid && resolvedUserDoc?.id !== verifiedUid) {
        const uidUserDoc = await firestoreSync.getUser(verifiedUid).catch(() => null);
        if (uidUserDoc) {
          resolvedUserDoc = uidUserDoc;
        }
      }

      // 5. Build scoped session exclusively from the Firestore-resolved account
      const built = buildAuthUserFromIdentity(identity, {
        uid: verifiedUid,
        masterAdminName: activeSuperAdmin.name,
        preferredPosId: resolvedUserDoc?.associatedId,
      });

      const applied = applyResolvedAuthenticatedSession({
        built,
        epoch: myEpoch,
        clearCachesFirst: true,
      });
      if (!applied) {
        return { success: false, error: 'تم إلغاء جلسة تسجيل الدخول.' };
      }

      // Clear used OTP (single-use constraint)
      if (storedOtp) {
        setActiveOtps(prev => {
          const copy = { ...prev };
          delete copy[cleanEmail];
          return copy;
        });
      }

      firestoreSync.saveUser(built.authUser).catch(console.error);

      if (built.role !== 'pos_client') {
        triggerConfetti();
      }

      const roleLabelAr =
        built.role === 'employee'
          ? `موظف في متجر ${identity.kind === 'employee' ? identity.supplier.name : 'المتجر'}`
          : built.role === 'supplier'
          ? 'المتجر'
          : built.role === 'super_admin'
          ? built.authUser.adminAccountId
            ? `إدارة التطبيق (${built.authUser.roleTitle})`
            : 'مدير التطبيق'
          : 'العميل (نقطة البيع)';

      showToast({
        type: 'success',
        title: 'تم التحقق وتسجيل الدخول بنجاح!',
        description:
          built.role === 'employee' && identity.kind === 'employee'
            ? `مرحباً بك يا ${built.authUser.name} (موظف في متجر ${identity.supplier.name}). تم نقلك لواجهة المتجر وفق صلاحياتك.`
            : built.authUser.adminAccountId
            ? `مرحباً بك يا ${built.authUser.name} (${built.authUser.roleTitle})، تم تفعيل صلاحياتك الإدارية المحددة.`
            : `مرحباً بك يا ${built.authUser.name}، تم الدخول إلى واجهة ${roleLabelAr} الخاصة بك.`
      });

      return { success: true };
    } finally {
      isManualAuthInProgressRef.current = false;
    }
  };

  const registerAccount = async (params: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    phone?: string;
    tradeName?: string;
    supplierId?: string;
    inviteCode?: string;
  }): Promise<{ success: boolean; error?: string; code?: string }> => {
    const syncRes = await ensureDatabaseConnectedAndSynced({
      forceSync: !isFirestoreConnected || !lastFirestoreSyncAtRef.current,
      silent: true,
    });
    if (!syncRes.connected) {
      const connErr = syncRes.message || 'تعذر إتمام الاتصال بقاعدة بيانات Firebase. يرجى المحاولة مجدداً.';
      showToast({
        type: 'error',
        title: 'تعذر الاتصال بقاعدة البيانات',
        description: connErr,
      });
      return { success: false, error: connErr };
    }
    const { name, email, role: chosenRole, phone, tradeName, supplierId, inviteCode } = params;
    const cleanEmail = normalizeStoreEmail(email);

    if (chosenRole !== 'pos_client' && chosenRole !== 'supplier') {
      return { success: false, error: 'نوع الحساب غير مدعوم للتسجيل المباشر.' };
    }

    isRegisteringRef.current = true;
    try {
      let activeSuppliers = suppliersRef.current;
      let activePosClients = posClientsRef.current;
      let activeSuperAdmin = superAdminRef.current;
      let activeInviteLinks = inviteLinksRef.current;

      const bootData = await bootstrapAuthDataFromFirestore();
      if (bootData.suppliers && bootData.suppliers.length > 0) {
        activeSuppliers = bootData.suppliers;
      }
      if (bootData.posClients && bootData.posClients.length > 0) {
        activePosClients = bootData.posClients;
      }
      if (bootData.inviteLinks && bootData.inviteLinks.length > 0) {
        activeInviteLinks = bootData.inviteLinks;
      }
      if (bootData.superAdmin) {
        activeSuperAdmin = {
          ...activeSuperAdmin,
          ...bootData.superAdmin,
          adminAccounts: Array.isArray(bootData.superAdmin.adminAccounts)
            ? bootData.superAdmin.adminAccounts
            : activeSuperAdmin.adminAccounts || [],
        };
      }

      const parsedInviteInput = chosenRole === 'pos_client' ? parseInviteCodeFromInput(inviteCode || '') : '';
      let matchedInviteLink: InviteLink | undefined;
      let targetSupplierId = supplierId?.trim() || '';
      let posInviteDefaults: ReturnType<typeof buildPosClientInviteDefaults> | undefined;

      if (chosenRole === 'pos_client' && parsedInviteInput) {
        let candidateInvites = activeInviteLinks;
        if (
          !candidateInvites.some(
            (l) => (l.code || '').trim().toUpperCase() === parsedInviteInput.toUpperCase()
          )
        ) {
          const remoteInvite = await firestoreSync.fetchInviteLinkByCodeFromServer(parsedInviteInput);
          if (remoteInvite) {
            candidateInvites = [remoteInvite, ...candidateInvites.filter((l) => l.id !== remoteInvite.id)];
          }
        }

        const resolvedInvite = resolveValidInviteLink({
          codeOrUrl: parsedInviteInput,
          inviteLinks: candidateInvites,
          suppliers: activeSuppliers,
        });
        if (!resolvedInvite.valid) {
          showToast({
            type: 'error',
            title: 'رابط الدعوة غير صالح',
            description: resolvedInvite.error,
          });
          return { success: false, error: resolvedInvite.error };
        }
        matchedInviteLink = resolvedInvite.inviteLink;
        targetSupplierId = resolvedInvite.supplier.id;
        posInviteDefaults = buildPosClientInviteDefaults(resolvedInvite);
      }

      if (chosenRole === 'pos_client') {
        if (!targetSupplierId || !activeSuppliers.some(s => s.id === targetSupplierId)) {
          const msg = 'معرف المتجر المدخل غير صحيح أو غير موجود. يرجى اختيار متجر صالح من القائمة أو عبر QR.';
          showToast({
            type: 'error',
            title: 'معرف المتجر غير صالح',
            description: msg
          });
          return { success: false, error: msg };
        }
      }

      const conflictCheck = checkEmailRegistrationConflict({
        email: cleanEmail,
        desiredRole: chosenRole,
        superAdmin: activeSuperAdmin,
        suppliers: activeSuppliers,
        posClients: activePosClients,
        targetSupplierId,
      });
      if (conflictCheck.conflict) {
        showToast({
          type: 'error',
          title: 'تعذر إنشاء الحساب',
          description: conflictCheck.error
        });
        return { success: false, error: conflictCheck.error };
      }

      // 1. Create User in Firebase Auth (reject if email already exists)
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);
      const fbUser = userCredential.user;

      let associatedId = '';
      let newPos: POSClient | undefined;
      let newSup: Supplier | undefined;

      // 2. Prepare entity and save to Firestore (strictly including email on POSClient)
      if (chosenRole === 'pos_client') {
        const newPosCode = `POS-${Math.floor(10000 + Math.random() * 90000)}`;
        newPos = {
          id: `pos-${fbUser.uid}`,
          posCode: newPosCode,
          tradeName: tradeName || `متجر ${name}`,
          ownerName: name,
          phone: phone || '+966 55 000 0000',
          email: cleanEmail,
          country: 'المملكة العربية السعودية',
          city: 'الرياض',
          supplierId: targetSupplierId,
          tier: posInviteDefaults ? posInviteDefaults.tier : 'regular',
          ...(posInviteDefaults
            ? {
                canRequestLoans: posInviteDefaults.canRequestLoans,
                canReceiveSupplierTransfers: posInviteDefaults.canReceiveSupplierTransfers,
                canGetBonus: posInviteDefaults.canGetBonus,
                canViewGifts: posInviteDefaults.canViewGifts,
                isAccreditedPos: posInviteDefaults.isAccreditedPos,
                posUpgradeStatus: posInviteDefaults.isAccreditedPos ? 'approved' : 'none',
                ...(posInviteDefaults.isAccreditedPos
                  ? {
                      accreditedAt: new Date().toISOString(),
                      posUpgradeRequestedAt: new Date().toISOString(),
                      posUpgradeRespondedAt: new Date().toISOString(),
                      accreditedByName:
                        matchedInviteLink?.supplierName ||
                        activeSuppliers.find((s) => s.id === targetSupplierId)?.storeName ||
                        'المتجر',
                    }
                  : {}),
              }
            : { posUpgradeStatus: 'none' }),
          walletBalance: 0,
          totalSpent: 0,
          ordersCount: 0,
          createdAt: new Date().toISOString().substring(0, 10),
          qrCodeValue: `DIGIPOS:${newPosCode}`
        };
        associatedId = newPos.id;
        await firestoreSync.savePosClient(newPos);
        setPosClients(prev => [newPos!, ...prev.filter(p => p.id !== newPos!.id)]);
      } else {
        newSup = {
          id: `sup-${fbUser.uid}`,
          name,
          storeName: tradeName || `مؤسسة ${name} للخدمات`,
          phone: phone || '+966 50 000 0000',
          email: cleanEmail,
          feePercentage: 1.0,
          fixedFeeAmount: 0,
          feeType: 'percentage',
          walletBalance: 0,
          bankAccountDetails: {
            bankName: 'مصرف الراجحي',
            accountHolder: name,
            iban: 'SA4480000123608010123456',
            accountNumber: '123608010123456'
          },
          createdAt: new Date().toISOString().substring(0, 10)
        };
        associatedId = newSup.id;
        await firestoreSync.saveSupplier(newSup);
        setSuppliers(prev => [newSup!, ...prev.filter(s => s.id !== newSup!.id)]);
      }

      // 3. Save User record
      const authUser: AuthUser = {
        id: fbUser.uid,
        email: cleanEmail,
        name,
        role: chosenRole,
        phone,
        associatedId
      };
      await firestoreSync.saveUser(authUser);

      // 4. Record invite usage & notify supplier if registered via an invite link
      if (matchedInviteLink && newPos) {
        const updatedInvite: InviteLink = {
          ...matchedInviteLink,
          usedCount: (matchedInviteLink.usedCount || 0) + 1,
        };
        const nextInvites = inviteLinksRef.current.some(l => l.id === updatedInvite.id)
          ? inviteLinksRef.current.map(l => (l.id === updatedInvite.id ? updatedInvite : l))
          : [updatedInvite, ...inviteLinksRef.current];
        inviteLinksRef.current = nextInvites;
        setInviteLinks(nextInvites);
        firestoreSync.saveInviteLink(updatedInvite).catch(console.error);

        const enabledLabels = getEnabledInviteFeatureLabels(matchedInviteLink.features).map(f => f.labelAr);
        addNotification({
          posId: newPos.id,
          posName: newPos.tradeName,
          posCode: newPos.posCode,
          supplierId: matchedInviteLink.supplierId,
          supplierName: matchedInviteLink.supplierName,
          targetRole: 'supplier',
          title: 'انضمام عميل جديد عبر رابط الدعوة',
          message:
            enabledLabels.length > 0
              ? `سجل العميل (${newPos.tradeName}) عبر الرابط (${matchedInviteLink.code}) برتبة ${TIERS_CONFIG[newPos.tier]?.nameAr || newPos.tier} مع الميزات: ${enabledLabels.join('، ')}.`
              : `سجل العميل (${newPos.tradeName}) عبر الرابط (${matchedInviteLink.code}) برتبة ${TIERS_CONFIG[newPos.tier]?.nameAr || newPos.tier}.`,
          type: 'tier_upgrade',
          actionTab: 'clients',
        });
      }

      // Force sign-out and clear state so the user MUST log in manually
      await fbSignOut(auth);
      setCurrentUser(null);
      setCurrentPosId('');
      setCurrentSupplierId('');
      localStorage.removeItem('digipos_auth_user');

      showToast({
        type: 'success',
        title: 'تم إنشاء وتوثيق الحساب بنجاح!',
        description: posInviteDefaults
          ? `أهلاً بك يا ${name}، تم إنشاء حسابك برتبة (${TIERS_CONFIG[posInviteDefaults.tier]?.nameAr || posInviteDefaults.tier}) وتفعيل ميزات الرابط المحددة بنجاح. يمكنك الآن تسجيل الدخول.`
          : `أهلاً بك يا ${name}، تم إنشاء حسابك وحفظه في قاعدة البيانات. يمكنك الآن تسجيل الدخول بالبريد الإلكتروني وكلمة المرور.`
      });

      return { success: true };
    } catch (err: any) {
      console.error('Registration failed:', err);
      let userFriendlyMsg = err?.message || 'حدث خطأ أثناء إنشاء الحساب';
      if (err?.code === 'auth/email-already-in-use' || userFriendlyMsg.includes('email-already-in-use')) {
        userFriendlyMsg = 'هذا البريد الإلكتروني مسجل بالفعل لدى المنصة! يمكنك تسجيل الدخول بدلاً من إنشاء حساب جديد.';
        showToast({
          type: 'error',
          title: 'البريد الإلكتروني مسجل بالفعل',
          description: 'هذا البريد الإلكتروني لديه حساب مفعل في المنصة، يرجى الانتقال لواجهة تسجيل الدخول.'
        });
      } else {
        showToast({
          type: 'error',
          title: 'فشل إنشاء الحساب',
          description: userFriendlyMsg
        });
      }
      return { success: false, error: userFriendlyMsg, code: err?.code };
    } finally {
      isRegisteringRef.current = false;
    }
  };

  // Built-in Firebase Auth Password Reset Flow
  const requestPasswordReset = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return {
        success: false,
        message: 'يرجى إدخال البريد الإلكتروني أولاً.'
      };
    }

    const redirectUrl =
      typeof window !== 'undefined' ? `${window.location.origin}/?mode=resetPassword` : undefined;

    try {
      if (redirectUrl) {
        await sendPasswordResetEmail(auth, cleanEmail, {
          url: redirectUrl,
          handleCodeInApp: true
        });
      } else {
        await sendPasswordResetEmail(auth, cleanEmail);
      }

      const successMsg =
        'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح. يرجى فحص صندوق الوارد أو الرسائل غير المرغوب فيها.';
      showToast({
        type: 'success',
        title: 'تم إرسال رابط إعادة التعيين',
        description: successMsg
      });
      return {
        success: true,
        message: successMsg
      };
    } catch (error: unknown) {
      const mapped = mapPasswordResetErrorAr(error, 'send');
      showToast({
        type: 'error',
        title: 'تعذر إرسال رابط إعادة التعيين',
        description: mapped.message
      });
      return {
        success: false,
        message: mapped.message
      };
    }
  };

  const verifyResetCode = async (oobCode: string) => {
    const cleanCode = oobCode.trim();
    if (!cleanCode) {
      return {
        valid: false,
        error: 'رابط إعادة تعيين كلمة المرور غير صالح أو منتهي الصلاحية.'
      };
    }
    try {
      const email = await verifyPasswordResetCode(auth, cleanCode);
      return { valid: true, email };
    } catch (error: unknown) {
      const mapped = mapPasswordResetErrorAr(error, 'verify_code');
      return { valid: false, error: mapped.message };
    }
  };

  const completePasswordReset = async (
    oobCode: string,
    newPassword: string,
    confirmPassword: string
  ) => {
    const validation = validateResetPasswordInput(newPassword, confirmPassword);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      await confirmPasswordReset(auth, oobCode.trim(), newPassword);
      showToast({
        type: 'success',
        title: 'تم تغيير كلمة المرور بنجاح',
        description: 'يمكنك الآن تسجيل الدخول باستخدام كلمة المرور الجديدة.'
      });
      return { success: true };
    } catch (error: unknown) {
      const mapped = mapPasswordResetErrorAr(error, 'confirm');
      return {
        success: false,
        error: mapped.message,
        isExpiredOrInvalidCode: mapped.isExpiredOrInvalidCode
      };
    }
  };

  const logout = () => {
    authSessionEpochRef.current += 1;
    fbSignOut(auth).catch(console.error);
    clearTransientSessionCaches();
    setCurrentUser(null);
    showToast({
      type: 'info',
      title: 'تم تسجيل الخروج',
      description: 'نراك قريباً في منصة DNexusD'
    });
  };

  const currentPosSupplier = React.useMemo(() => {
    return suppliers.find(s => s.id === exposedCurrentPos?.supplierId) || supplier;
  }, [suppliers, exposedCurrentPos?.supplierId, supplier]);

  const [adminPreferredCurrency, setAdminPreferredCurrency] = useState<CurrencyCode>(() => {
    try {
      return normalizeCurrencyCode(localStorage.getItem('digipos_admin_currency_v1'));
    } catch {
      return 'SAR';
    }
  });
  const [employeePreferredCurrency, setEmployeePreferredCurrency] = useState<CurrencyCode | null>(() => {
    try {
      const saved = localStorage.getItem('digipos_employee_currency_v1');
      return saved ? normalizeCurrencyCode(saved) : null;
    } catch {
      return null;
    }
  });

  const activeCurrency: CurrencyCode = React.useMemo(() => {
    if (isSupplierPosPreviewMode) {
      return normalizeCurrencyCode(exposedCurrentPos?.preferredCurrency ?? supplier?.preferredCurrency);
    }
    if (role === 'pos_client') {
      return normalizeCurrencyCode(currentPos?.preferredCurrency);
    }
    if (role === 'supplier') {
      return normalizeCurrencyCode(supplier?.preferredCurrency);
    }
    if (role === 'employee') {
      return normalizeCurrencyCode(employeePreferredCurrency ?? supplier?.preferredCurrency);
    }
    return normalizeCurrencyCode(adminPreferredCurrency);
  }, [isSupplierPosPreviewMode, exposedCurrentPos?.preferredCurrency, role, currentPos?.preferredCurrency, supplier?.preferredCurrency, employeePreferredCurrency, adminPreferredCurrency]);

  const activeExchangeRate: number = React.useMemo(() => {
    if (role === 'pos_client' || isSupplierPosPreviewMode) {
      return normalizeExchangeRateSarPerUsd((currentPosSupplier || supplier)?.exchangeRateSarPerUsd);
    }
    return normalizeExchangeRateSarPerUsd(supplier?.exchangeRateSarPerUsd);
  }, [role, isSupplierPosPreviewMode, currentPosSupplier, supplier]);

  const currencyLabel = getCurrencyShortLabel(activeCurrency);

  const convertFromSar = React.useCallback(
    (amountSar: number) => convertSarToCurrency(amountSar, activeCurrency, activeExchangeRate),
    [activeCurrency, activeExchangeRate]
  );

  const convertToSar = React.useCallback(
    (amountInActiveCurrency: number) => convertCurrencyToSar(amountInActiveCurrency, activeCurrency, activeExchangeRate),
    [activeCurrency, activeExchangeRate]
  );

  const formatCurrency = React.useCallback(
    (
      amountSar: number,
      opts?: { decimals?: number; includeSymbol?: boolean; withGrouping?: boolean; sign?: 'credit' | 'debit' }
    ) => formatCurrencyAmount(amountSar, activeCurrency, activeExchangeRate, opts),
    [activeCurrency, activeExchangeRate]
  );

  const setActiveCurrency = (currency: CurrencyCode) => {
    const normalized = normalizeCurrencyCode(currency);
    if (role === 'pos_client') {
      if (!currentPos?.id) return;
      const updatedClient: POSClient = { ...currentPos, preferredCurrency: normalized };
      setPosClients(prev => prev.map(p => (p.id === currentPos.id ? updatedClient : p)));
      firestoreSync.savePosClient(updatedClient).catch(console.error);
    } else if (role === 'supplier') {
      if (!supplier?.id) return;
      const updatedSup: Supplier = { ...supplier, preferredCurrency: normalized };
      setSuppliers(prev => prev.map(s => (s.id === supplier.id ? updatedSup : s)));
      firestoreSync.saveSupplier(updatedSup).catch(console.error);
    } else if (role === 'employee') {
      setEmployeePreferredCurrency(normalized);
      try {
        localStorage.setItem('digipos_employee_currency_v1', normalized);
      } catch {
        // ignore
      }
    } else {
      setAdminPreferredCurrency(normalized);
      try {
        localStorage.setItem('digipos_admin_currency_v1', normalized);
      } catch {
        // ignore
      }
    }
  };

  const updateSupplierExchangeRate = (rateSarPerUsd: number): boolean => {
    if (!assertEmployeePermission(false, 'تحديد سعر الصرف محصور لمالك المتجر فقط.')) {
      return false;
    }
    if (!supplier?.id) return false;
    if (!Number.isFinite(rateSarPerUsd) || rateSarPerUsd <= 0) {
      showToast({
        type: 'error',
        title: 'سعر صرف غير صالح',
        description: 'يرجى إدخال سعر صرف صحيح أكبر من الصفر (مثال: 3.75).'
      });
      return false;
    }
    const normalizedRate = normalizeExchangeRateSarPerUsd(rateSarPerUsd);
    const updatedSup: Supplier = { ...supplier, exchangeRateSarPerUsd: normalizedRate };
    setSuppliers(prev => prev.map(s => (s.id === supplier.id ? updatedSup : s)));
    firestoreSync.saveSupplier(updatedSup).catch(console.error);
    showToast({
      type: 'success',
      title: 'تم تحديث سعر الصرف بنجاح',
      description: `تم اعتماد سعر الصرف: 1 دولار ($) = ${normalizedRate} ريال سعودي (ر.س) لجميع الأسعار والمحافظ.`
    });
    return true;
  };

  const assertEmployeePermission = (
    allowed: boolean,
    errorDesc = 'ليس لديك صلاحية تنفيذ هذا الإجراء من مالك المتجر.'
  ): boolean => {
    if (role !== 'employee') return true;
    if (!allowed) {
      showToast({
        type: 'error',
        title: 'صلاحية غير ممنوحة',
        description: errorDesc
      });
      return false;
    }
    return true;
  };

  const supplierNotifications = React.useMemo(() => {
    const storeNotifs = notifications.filter(
      n =>
        (n.targetRole === 'supplier' || (!n.targetRole && !n.posId)) &&
        (!n.supplierId || n.supplierId === supplier?.id)
    );
    return filterSupplierNotificationsForEmployee(storeNotifs, effectiveEmployeePerms, role);
  }, [notifications, supplier?.id, effectiveEmployeePerms, role]);

  const clientNotifications = React.useMemo(() => {
    if (isSupplierPosPreviewMode) return [];
    return filterNotificationsForPosClient(notifications, currentPos?.id, currentPos?.supplierId);
  }, [isSupplierPosPreviewMode, notifications, currentPos?.id, currentPos?.supplierId]);

  const unreadSupplierNotificationsCount = React.useMemo(() => {
    return supplierNotifications.filter(n => !n.isRead).length;
  }, [supplierNotifications]);

  const unreadPosNotificationsCount = React.useMemo(() => {
    return clientNotifications.filter(n => !n.isRead).length;
  }, [clientNotifications]);

  const unreadNotificationsCount = React.useMemo(() => {
    return role === 'supplier' || role === 'employee'
      ? unreadSupplierNotificationsCount
      : unreadPosNotificationsCount;
  }, [role, unreadSupplierNotificationsCount, unreadPosNotificationsCount]);

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 75,
        spread: 60,
        origin: { y: 0.7 }
      });
    } catch {
      // safe fallback
    }
  };

  const showToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Fee calculation supporting percentage, fixed amount, or both (defaults to client balanceTransfer rule)
  const calculateFee = (amount: number, targetSup?: Supplier) => {
    const activeSup = targetSup || currentPosSupplier || supplier;
    const transferRule = resolveSpecificServiceFeeRule({
      section: 'client',
      serviceKey: 'balanceTransfer',
      supplier: activeSup,
      superAdmin,
    });
    return calculateFeeFromRule(amount, transferRule);
  };

  // Execute purchase
  const executePurchase = async (params: {
    service: DigitalService;
    pkg: ServicePackage;
    purchaseUnit?: WarehousePurchaseUnit;
    deliveryMethod: DeliveryMethod;
    deliveryDetails: {
      playerId?: string;
      playerNickname?: string;
      accountType?: string;
      accountEmail?: string;
      accountPassword?: string;
      verificationCodeEntered?: string;
      voucherCode?: string;
    };
    paymentMethod: 'wallet' | 'visa';
    customerName?: string;
    customerPhone?: string;
    resalePrice?: number;
  }) => {
    if (isSupplierPosPreviewMode) {
      showToast({
        type: 'info',
        title: 'وضع الاطلاع فقط',
        description: 'أنت تتصفح واجهة نقطة البيع المعتمدة للعميل في وضع القراءة فقط ولا يمكن تنفيذ عمليات شراء.'
      });
      return { success: false, error: 'read_only_preview' };
    }
    const { service, pkg, purchaseUnit, deliveryMethod, deliveryDetails, paymentMethod, customerName, customerPhone, resalePrice } = params;
    
    // 1. Resolve live service/package + linked warehouse purchase options & pricing
    const liveService = services.find(s => s.id === service.id) || service;
    const methodPackages = getPackagesForDeliveryMethod(liveService, deliveryMethod);
    const rawLivePkg = methodPackages.find(p => p.id === pkg.id);
    const effectivePkg = rawLivePkg
      ? mergeWarehouseOptionsIntoPackage(rawLivePkg, voucherWarehouses)
      : undefined;
    const purchaseOpts = effectivePkg
      ? resolvePackagePurchaseOptions(effectivePkg, voucherWarehouses)
      : undefined;
    const effectiveUnit: WarehousePurchaseUnit = purchaseUnit || purchaseOpts?.defaultPurchaseUnit || 'single_code';

    if (!liveService || methodPackages.length === 0 || !effectivePkg || !purchaseOpts) {
      const msg = `عذراً، الخدمة المطلوبة أو الباقة غير متوفرة حالياً لدى المتجر.`;
      showToast({
        type: 'error',
        title: 'عدم توفر الخدمة المطلوبة',
        description: msg
      });
      return { success: false, error: 'service_unavailable' };
    }

    const serviceCatalog = catalogs.find(c => c.id === liveService.catalogId);
    const activeOrderSupplier = suppliers.find(s => s.id === liveService.supplierId) || currentPosSupplier || supplier;
    const pricing = calculateServicePurchasePricing({
      pkg: effectivePkg,
      clientTier: currentPos.tier,
      purchaseUnit: effectiveUnit,
      clientCanViewGifts: Boolean(currentPos.canViewGifts),
      clientPosId: currentPos.id,
      service: liveService,
      catalog: serviceCatalog,
      supplier: activeOrderSupplier,
      superAdmin
    });

    const unitPrice = pricing.unitPrice;
    const feeAmount = pricing.feeAmount;
    const totalDeduction = pricing.totalAmount;

    const supplierSaleRule = resolveSpecificServiceFeeRule({
      section: 'supplier',
      serviceKey: 'saleToClient',
      supplier: activeOrderSupplier,
      superAdmin,
    });
    const supplierFeeAmount = unitPrice > 0
      ? calculateFeeFromRule(unitPrice, supplierSaleRule, { capAtAmount: true })
      : 0;

    // 2.5 If this is a Free Gift catalog service, enforce targeting, expiration period, and merchant max uses per client
    const giftStatus = evaluateClientGiftServiceStatus({
      service: liveService,
      catalog: serviceCatalog,
      clientPosId: currentPos.id,
      clientTier: currentPos.tier,
      clientCanViewGifts: Boolean(currentPos.canViewGifts),
      usedGiftServiceIds: currentPos.usedGiftServiceIds,
      orders,
    });
    if (giftStatus.isGiftCatalog) {
      if (!giftStatus.isTargeted) {
        showToast({
          type: 'error',
          title: 'غير متاح لحسابك',
          description: 'هذه الهدية المجانية غير مخصصة لحسابك.',
        });
        return { success: false, error: 'gift_not_targeted' };
      }
      if (giftStatus.isExpired) {
        showToast({
          type: 'error',
          title: 'انتهت صلاحية الهدية',
          description: 'انتهت الفترة المحددة لهذه الهدية وأصبحت غير مفعلة لحسابك.',
        });
        return { success: false, error: 'gift_expired' };
      }
      if (giftStatus.isUsageExhausted) {
        showToast({
          type: 'info',
          title: 'تم استنفاد مرات الاستخدام',
          description: `لقد استخدمت هذه الهدية الحد الأقصى المحدد من المتجر (${giftStatus.usedCount}/${giftStatus.maxUses}) وأصبحت غير مفعلة لديك.`,
        });
        return { success: false, error: 'gift_usage_limit_reached' };
      }
    }

    // Determine whether fulfillment completes immediately (voucher_code) or waits for supplier fulfillment (player_id / account_login)
    const initialStatus: Order['status'] = deliveryMethod === 'player_id'
      ? 'pending_supplier'
      : (deliveryMethod === 'account_login' ? 'pending_supplier' : 'completed');
    const isCompletedImmediately = initialStatus === 'completed';

    // 3. Balance verification for non-gift wallet purchases (includes pending unsettled order fees so client cannot overcommit)
    const pendingUnsettledFees = sumPendingUnsettledClientFees(orders, currentPos.id);
    const availablePosBalance = parseFloat((currentPos.walletBalance - pendingUnsettledFees).toFixed(2));
    if (!pricing.isFreeGiftApplied && paymentMethod === 'wallet') {
      if (availablePosBalance < totalDeduction) {
        showToast({
          type: 'error',
          title: 'الرصيد غير كافٍ',
          description: `الرصيد المتاح (${formatCurrency(Math.max(0, availablePosBalance))}) لا يكفي لإتمام العملية (${formatCurrency(totalDeduction)}). يرجى إعادة شحن المحفظة.`
        });
        return { success: false, error: 'insufficient_balance' };
      }
    }

    // Completion-only settlement:
    // - If completed immediately (voucher_code): deduct client price + fee (or resolve gift fee) AND settle admin/supplier wallets now.
    // - If pending_supplier (player_id / account_login): reserve ONLY unitPrice (heldFromClient) until supplier completes the charge;
    //   NO fee deduction from client/supplier and NO deposit into SuperAdmin wallet until completeSupplierOrder().
    const heldFromClientAtRequest = !pricing.isFreeGiftApplied && paymentMethod === 'wallet' ? unitPrice : 0;

    const giftFeeResolution = isCompletedImmediately && pricing.isFreeGiftApplied
      ? resolveGiftClaimFeePayment({
          isFreeGiftApplied: true,
          walletBalance: currentPos.walletBalance,
          feeAmount,
          existingPendingFees: currentPos.pendingGiftFees,
        })
      : null;

    const clientFeeCollectedNow = isCompletedImmediately
      ? (pricing.isFreeGiftApplied
          ? giftFeeResolution!.walletDeductionNow
          : feeAmount)
      : 0;

    const actualWalletDeduction = isCompletedImmediately
      ? (pricing.isFreeGiftApplied
          ? giftFeeResolution!.walletDeductionNow
          : (paymentMethod === 'wallet' ? totalDeduction : 0))
      : heldFromClientAtRequest;

    const deferredFeeAdded = isCompletedImmediately && pricing.isFreeGiftApplied
      ? giftFeeResolution!.deferredFeeAdded
      : 0;
    const nextPendingGiftFees = isCompletedImmediately && pricing.isFreeGiftApplied
      ? giftFeeResolution!.newPendingGiftFees
      : (currentPos.pendingGiftFees || 0);

    const supplierFeeCollectedNow = isCompletedImmediately ? supplierFeeAmount : 0;
    const adminTotalFeeCollectedNow = isCompletedImmediately
      ? parseFloat((clientFeeCollectedNow + supplierFeeCollectedNow).toFixed(2))
      : 0;
    const supplierNetCreditNow = isCompletedImmediately
      ? parseFloat(Math.max(0, unitPrice - supplierFeeCollectedNow).toFixed(2))
      : 0;

    // 4. Handle stock & voucher code assignment/deduction atomically
    const stockDeduction = deductPackageStock({
      service: liveService,
      pkgId: effectivePkg.id,
      deliveryMethod,
      warehouses: voucherWarehouses,
      purchaseUnit: effectiveUnit
    });

    if (stockDeduction.outOfStock) {
      const isVoucher = deliveryMethod === 'voucher_code';
      const msg = isVoucher
        ? (effectiveUnit === 'package'
            ? `عذراً، الأكواد المتوفرة في المخزن غير كافية لتسليم باقة كاملة (${purchaseOpts.packageCodesCount} أكواد) لخدمة "${effectivePkg.name}". عذراً هذه الأكواد غير متوفرة حالياً.`
            : `عذراً، لا تتوفر أكواد شحن متاحة لهذه الفئة (${effectivePkg.name}) حالياً في مخزن المتجر. هذه الأكواد غير متوفرة حالياً.`)
        : `عذراً، الخدمة أو الباقة المطلوبة (${effectivePkg.name}) غير متوفرة حالياً لدى المتجر (نفد المخزون).`;

      showToast({
        type: 'error',
        title: isVoucher ? 'عدم توفر الأكواد المطلوبة' : 'عدم توفر الخدمة المطلوبة',
        description: msg
      });
      return { success: false, error: 'out_of_stock' };
    }

    const assignedVouchers =
      stockDeduction.assignedVouchers && stockDeduction.assignedVouchers.length > 0
        ? stockDeduction.assignedVouchers
        : deliveryDetails.voucherCode
        ? [deliveryDetails.voucherCode]
        : undefined;
    const assignedVoucher =
      stockDeduction.assignedVoucher ||
      (assignedVouchers ? assignedVouchers.join('\n') : undefined) ||
      deliveryDetails.voucherCode;

    if (stockDeduction.updatedService !== liveService) {
      setServices(prev => prev.map(s => s.id === liveService.id ? stockDeduction.updatedService : s));
      firestoreSync.saveService(stockDeduction.updatedService).catch(console.error);
    }

    if (stockDeduction.updatedWarehouse) {
      const nextWh = stockDeduction.updatedWarehouse;
      setVoucherWarehouses(prev => prev.map(w => w.id === nextWh.id ? nextWh : w));
      firestoreSync.saveVoucherWarehouse(nextWh).catch(console.error);

      // Check for low-stock threshold alert
      const threshold = typeof nextWh.lowStockThreshold === 'number' ? nextWh.lowStockThreshold : 5;
      const remainingCount = nextWh.codes.length;
      if (remainingCount <= threshold) {
        addNotification({
          supplierId: activeOrderSupplier.id,
          supplierName: activeOrderSupplier.name,
          targetRole: 'supplier',
          title: remainingCount === 0
            ? `نفد مخزون فئة ${nextWh.categoryName} (${nextWh.nameAr}) ⚠️`
            : `تنبيه مخزون منخفض: ${nextWh.categoryName} (${nextWh.nameAr}) ⚠️`,
          message: remainingCount === 0
            ? `نفد مخزون فئة "${nextWh.categoryName}" - ${nextWh.nameAr} بالكامل (0 كود متبقي). يرجى تعبئة الأكواد فوراً.`
            : `وصل مخزون فئة "${nextWh.categoryName}" - ${nextWh.nameAr} إلى ${remainingCount} كود فقط (الحد الأدنى المعين: ${threshold} كود). يرجى تعبئة المخزون.`,
          type: 'low_stock',
          warehouseId: nextWh.id,
          categoryName: nextWh.categoryName,
          remainingStock: remainingCount,
          lowStockThreshold: threshold,
          actionTab: 'vouchers'
        });
      }
    }

    const orderId = `ord-${Date.now().toString().slice(-6)}`;
    const now = new Date();
    const formattedDate = now.toISOString().replace('T', ' ').substring(0, 16);

    const nextUsedGiftServiceIds =
      isCompletedImmediately && pricing.isFreeGiftApplied && giftStatus.usedCount + 1 >= giftStatus.maxUses
        ? appendUsedGiftServiceId(currentPos.usedGiftServiceIds, liveService.id)
        : currentPos.usedGiftServiceIds;

    const unitSuffix =
      purchaseOpts.allowPackage && effectiveUnit === 'package'
        ? ` - ${purchaseOpts.packageNameAr}`
        : purchaseOpts.allowPackage && effectiveUnit === 'single_code'
        ? ' (كود واحد)'
        : '';

    const newOrder: Order = {
      id: orderId,
      date: formattedDate,
      posId: currentPos.id,
      posCode: currentPos.posCode,
      posName: currentPos.tradeName,
      supplierId: activeOrderSupplier.id,
      serviceId: liveService.id,
      serviceName: liveService.nameAr,
      packageId: effectivePkg.id,
      packageName: `${effectivePkg.name}${unitSuffix}`,
      purchaseUnit: effectiveUnit,
      quantityCodes: stockDeduction.deductedCount,
      deliveryMethod,
      deliveryDetails: {
        ...deliveryDetails,
        voucherCode: assignedVoucher,
        voucherCodes: assignedVouchers,
        inGameChargeStatus: deliveryMethod === 'player_id' ? 'waiting_charge' : undefined
      },
      costPrice: unitPrice,
      salePriceToCustomer: resalePrice || totalDeduction * 1.15,
      feeAmount,
      supplierFeeAmount: supplierFeeAmount > 0 ? supplierFeeAmount : undefined,
      feeSettledToAdmin: isCompletedImmediately,
      heldFromClientAtRequest: heldFromClientAtRequest > 0 ? heldFromClientAtRequest : undefined,
      totalDeducted: actualWalletDeduction,
      isFreeGiftOrder: pricing.isFreeGiftApplied || undefined,
      deferredFeeAmount: deferredFeeAdded > 0 ? deferredFeeAdded : undefined,
      deferredFeeSettled: deferredFeeAdded > 0 ? false : undefined,
      paymentMethod,
      status: initialStatus,
      completedAt: isCompletedImmediately ? formattedDate : undefined,
      customerName: customerName || 'عميل مباشر',
      customerPhone: customerPhone || '',
      supplierNotes: deliveryMethod === 'player_id' 
        ? `طلب شحن عبر الأيدي (${deliveryDetails.playerId || ''}) مرسل للمتجر للشحن من داخل اللعبة`
        : undefined
    };

    const nextPosWalletBalance = parseFloat((currentPos.walletBalance - actualWalletDeduction).toFixed(2));
    const nextPosTotalSpent = isCompletedImmediately
      ? parseFloat((currentPos.totalSpent + unitPrice).toFixed(2))
      : currentPos.totalSpent;
    const nextPosOrdersCount = currentPos.ordersCount + 1;

    // Update client balances, pending gift fees, and completed gift visibility
    setPosClients(prev => prev.map(p => {
      if (p.id !== currentPos.id) return p;
      return {
        ...p,
        walletBalance: nextPosWalletBalance,
        totalSpent: nextPosTotalSpent,
        ordersCount: nextPosOrdersCount,
        pendingGiftFees: nextPendingGiftFees,
        usedGiftServiceIds: nextUsedGiftServiceIds,
      };
    }));

    // Add collected fee to Super Admin's wallet ONLY when order completes immediately
    if (adminTotalFeeCollectedNow > 0) {
      setSuperAdmin(prev => ({
        ...prev,
        walletBalance: parseFloat((prev.walletBalance + adminTotalFeeCollectedNow).toFixed(2))
      }));
    }

    // Update Supplier revenue/balance ONLY when order completes immediately
    if (supplierNetCreditNow > 0) {
      setSuppliers(prev => prev.map(s => {
        if (s.id !== activeOrderSupplier.id) return s;
        return {
          ...s,
          walletBalance: parseFloat((s.walletBalance + supplierNetCreditNow).toFixed(2))
        };
      }));
    }

    // Add to Orders
    setOrders(prev => [newOrder, ...prev]);

    // Record Accounting Entries for POS client
    const newAccountingEntries: AccountingEntry[] = [];
    const balanceAfterPurchase = !pricing.isFreeGiftApplied && paymentMethod === 'wallet'
      ? parseFloat((currentPos.walletBalance - heldFromClientAtRequest).toFixed(2))
      : currentPos.walletBalance;

    const purchaseTag = pricing.isFreeGiftApplied
      ? ` [هدية مجانية من كتالوج الهدايا المجانية]`
      : pricing.isZeroPriceFloorApplied
      ? ` [قيمة صفرية من المتجر - حد أدنى للعميل 0.50 ر.س]`
      : '';

    newAccountingEntries.push({
      id: `acc-${Date.now()}-1`,
      date: formattedDate,
      type: 'purchase',
      referenceId: orderId,
      posId: currentPos.id,
      supplierId: activeOrderSupplier.id,
      description: (!isCompletedImmediately
        ? `حجز قيمة طلب (${deliveryMethod === 'player_id' ? `شحن أيدي: ${deliveryDetails.playerId}` : 'شحن حساب'}): ${service.nameAr} - ${pkg.name} (${currentPos.tier}) لحين اكتمال التنفيذ`
        : `شراء خدمة: ${service.nameAr} - ${pkg.name} (${currentPos.tier}) من المتجر ${activeOrderSupplier.name}`) + purchaseTag,
      debit: heldFromClientAtRequest,
      credit: 0,
      balanceAfter: balanceAfterPurchase,
      serviceName: service.nameAr,
      customerName: customerName || 'عميل مباشر'
    });

    if (isCompletedImmediately) {
      if (!pricing.isFreeGiftApplied && paymentMethod === 'wallet' && feeAmount > 0) {
        const balanceAfterFee = parseFloat((balanceAfterPurchase - feeAmount).toFixed(2));
        newAccountingEntries.push({
          id: `acc-${Date.now()}-2`,
          date: formattedDate,
          type: 'fee',
          referenceId: orderId,
          posId: currentPos.id,
          supplierId: activeOrderSupplier.id,
          description: pricing.isZeroPriceFloorApplied
            ? `رسوم الحد الأدنى للعملية الصفرية (${feeAmount.toFixed(2)} ر.س)`
            : `رسوم خدمة شراء خدمة (${feeAmount.toFixed(2)} ر.س)`,
          debit: feeAmount,
          credit: 0,
          balanceAfter: balanceAfterFee
        });
      } else if (pricing.isFreeGiftApplied && clientFeeCollectedNow > 0) {
        const balanceAfterFee = parseFloat((balanceAfterPurchase - clientFeeCollectedNow).toFixed(2));
        newAccountingEntries.push({
          id: `acc-${Date.now()}-2`,
          date: formattedDate,
          type: 'fee',
          referenceId: orderId,
          posId: currentPos.id,
          supplierId: activeOrderSupplier.id,
          description: `رسوم تطبيق على عملية (${service.nameAr})`,
          debit: clientFeeCollectedNow,
          credit: 0,
          balanceAfter: balanceAfterFee
        });
      }

      if (resalePrice && resalePrice > unitPrice) {
        newAccountingEntries.push({
          id: `acc-${Date.now()}-3`,
          date: formattedDate,
          type: 'sale',
          referenceId: orderId,
          posId: currentPos.id,
          supplierId: activeOrderSupplier.id,
          description: `بيع للزبون (${customerName || 'مباشر'}) بقيمة ${resalePrice.toFixed(2)} ر.س (هامش ربح: ${(resalePrice - unitPrice).toFixed(2)} ر.س)`,
          debit: 0,
          credit: resalePrice,
          balanceAfter: nextPosWalletBalance,
          serviceName: service.nameAr,
          customerName: customerName || 'عميل مباشر'
        });
      }
    }

    setAccountingEntries(prev => [...newAccountingEntries, ...prev]);

    // Record entry in Admin Accounting Statement ONLY when completed & fee collected now
    const newAdminAccEntries: AdminAccountingEntry[] = [];
    if (isCompletedImmediately && adminTotalFeeCollectedNow > 0) {
      let runningAdminBal = superAdmin.walletBalance;
      if (clientFeeCollectedNow > 0) {
        runningAdminBal = parseFloat((runningAdminBal + clientFeeCollectedNow).toFixed(2));
        newAdminAccEntries.push({
          id: `adm-acc-${Date.now()}-fee`,
          date: formattedDate,
          type: 'fee_collected',
          referenceId: orderId,
          supplierId: activeOrderSupplier.id,
          supplierName: `${activeOrderSupplier.name} (${activeOrderSupplier.storeName})`,
          serviceId: service.id,
          serviceName: service.nameAr,
          posId: currentPos.id,
          posCode: currentPos.posCode,
          posName: currentPos.tradeName,
          description: pricing.isFreeGiftApplied
            ? `تحصيل رسوم هدية مجانية (${pricing.appFeePercentageApplied}% من ${pricing.originalTierPrice.toFixed(2)} ر.س = ${clientFeeCollectedNow.toFixed(2)} ر.س): ${service.nameAr} - ${pkg.name}`
            : pricing.isZeroPriceFloorApplied
            ? `تحصيل الحد الأدنى للعملية الصفرية (${clientFeeCollectedNow.toFixed(2)} ر.س): ${service.nameAr} - ${pkg.name}`
            : `تحصيل رسوم خدمة شراء خدمة من العميل (${clientFeeCollectedNow.toFixed(2)} ر.س): ${service.nameAr} - ${pkg.name}`,
          grossAmount: pricing.isFreeGiftApplied ? pricing.originalTierPrice : unitPrice,
          feeAmount: clientFeeCollectedNow,
          debit: 0,
          credit: clientFeeCollectedNow,
          balanceAfter: runningAdminBal,
          notes: `تم الخصم من محفظة العميل (${currentPos.tradeName}) بعد اكتمال الخدمة`
        });
      }
      if (supplierFeeCollectedNow > 0) {
        runningAdminBal = parseFloat((runningAdminBal + supplierFeeCollectedNow).toFixed(2));
        newAdminAccEntries.push({
          id: `adm-acc-${Date.now()}-supfee`,
          date: formattedDate,
          type: 'fee_collected',
          referenceId: orderId,
          supplierId: activeOrderSupplier.id,
          supplierName: `${activeOrderSupplier.name} (${activeOrderSupplier.storeName})`,
          serviceId: service.id,
          serviceName: service.nameAr,
          posId: currentPos.id,
          posCode: currentPos.posCode,
          posName: currentPos.tradeName,
          description: `تحصيل رسوم خدمة بيع للعميل على المورد (${supplierFeeCollectedNow.toFixed(2)} ر.س): ${service.nameAr} - ${pkg.name}`,
          grossAmount: unitPrice,
          feeAmount: supplierFeeCollectedNow,
          debit: 0,
          credit: supplierFeeCollectedNow,
          balanceAfter: runningAdminBal,
          notes: `تم الخصم من استحقاق المورد (${activeOrderSupplier.storeName}) بعد اكتمال الخدمة`
        });
      }
      setAdminAccountingEntries(prev => [...newAdminAccEntries, ...prev]);
    }

    // Persist to Firebase Firestore
    firestoreSync.saveOrder(newOrder).catch(console.error);
    firestoreSync.savePosClient({
      ...currentPos,
      walletBalance: nextPosWalletBalance,
      totalSpent: nextPosTotalSpent,
      ordersCount: nextPosOrdersCount,
      pendingGiftFees: nextPendingGiftFees,
      usedGiftServiceIds: nextUsedGiftServiceIds,
    }).catch(console.error);
    if (supplierNetCreditNow > 0) {
      firestoreSync.saveSupplier({
        ...activeOrderSupplier,
        walletBalance: parseFloat((activeOrderSupplier.walletBalance + supplierNetCreditNow).toFixed(2))
      }).catch(console.error);
    }
    if (adminTotalFeeCollectedNow > 0) {
      firestoreSync.saveSuperAdmin({
        ...superAdmin,
        walletBalance: parseFloat((superAdmin.walletBalance + adminTotalFeeCollectedNow).toFixed(2))
      }).catch(console.error);
      for (const admEnt of newAdminAccEntries) {
        firestoreSync.saveAdminAccountingEntry(admEnt).catch(console.error);
      }
    }
    for (const ent of newAccountingEntries) {
      firestoreSync.saveAccountingEntry(ent).catch(console.error);
    }

    triggerConfetti();

    // Notify the supplier of the new purchase / game top-up order
    const supOrderCurrency = normalizeCurrencyCode(activeOrderSupplier?.preferredCurrency);
    const supOrderAmountText = formatCurrencyAmount(unitPrice, supOrderCurrency, activeExchangeRate);
    addNotification({
      supplierId: activeOrderSupplier.id,
      supplierName: activeOrderSupplier.name,
      posId: currentPos.id,
      posName: currentPos.tradeName,
      posCode: currentPos.posCode,
      targetRole: 'supplier',
      title:
        deliveryMethod === 'player_id'
          ? `طلب شحن أيدي جديد باللعبة (${service.nameAr}) 🎮`
          : deliveryMethod === 'account_login'
          ? `طلب شحن عبر الحساب (${service.nameAr}) 🔐`
          : `طلب شراء كود قسيمة جديد (${service.nameAr}) ⚡`,
      message:
        deliveryMethod === 'player_id'
          ? `أرسل العميل ${currentPos.tradeName} (${currentPos.posCode}) طلب شحن للأيدي (${deliveryDetails.playerId}) لباقة ${pkg.name} بمبلغ ${supOrderAmountText}.`
          : deliveryMethod === 'account_login'
          ? `أرسل العميل ${currentPos.tradeName} (${currentPos.posCode}) طلب شحن حساب (${deliveryDetails.accountType ? `${deliveryDetails.accountType} · ` : ''}${deliveryDetails.accountEmail || 'حساب العميل'}) لباقة ${pkg.name} بمبلغ ${supOrderAmountText}.`
          : `قام العميل ${currentPos.tradeName} (${currentPos.posCode}) بشراء ${pkg.name} بمبلغ ${supOrderAmountText}.`,
      type: 'order_status',
      orderId,
      amount: unitPrice,
      actionTab:
        deliveryMethod === 'player_id'
          ? 'pending_orders'
          : deliveryMethod === 'account_login'
          ? 'account_orders'
          : 'catalogs'
    });

    if (!isCompletedImmediately) {
      showToast({
        type: 'info',
        title: deliveryMethod === 'player_id' ? 'تم إرسال الطلب مع الأيدي إلى المتجر' : 'تم إرسال طلب شحن الحساب إلى المتجر',
        description: deliveryMethod === 'player_id'
          ? `تم إرسال الأيدي (${deliveryDetails.playerId}) للمتجر للشحن من داخل اللعبة. لا تُخصم رسوم التطبيق حتى اكتمال الشحن.`
          : `تم إرسال بيانات الحساب للمتجر للتنفيذ. لا تُخصم رسوم التطبيق حتى اكتمال الشحن.`
      });
    } else if (pricing.isFreeGiftApplied) {
      showToast({
        type: 'success',
        title: 'تم استلام الهدية المجانية بنجاح!',
        description: `تم استلام وتنفيذ ${service.nameAr} بقيمة ${formatCurrency(0)}.`
      });
    } else {
      showToast({
        type: 'success',
        title: 'تمت العملية بنجاح!',
        description: `تم شحن وتسليم ${service.nameAr} وخصم ${formatCurrency(totalDeduction)}.`
      });
    }

    return { 
      success: true, 
      orderId, 
      voucherCode: assignedVoucher,
      voucherCodes: assignedVouchers,
      deductedCount: stockDeduction.deductedCount,
      isPendingSupplier: initialStatus === 'pending_supplier' 
    };
  };

  // Transfer balance between POS clients via Code or QR
  const executeBalanceTransfer = async (params: { targetPosCode: string; amount: number }) => {
    if (isSupplierPosPreviewMode) {
      showToast({
        type: 'info',
        title: 'وضع الاطلاع فقط',
        description: 'لا يمكن إجراء تحويلات مالية أثناء وضع معاينة واجهة نقطة البيع.'
      });
      return { success: false, error: 'read_only_preview' };
    }
    if (!isPosClientActive(currentPos)) {
      showToast({
        type: 'error',
        title: 'حسابك موقوف مؤقتاً',
        description: 'تم إيقاف تفعيل حسابك لدى المتجر ولا يمكنك إجراء تحويلات مالية حالياً.'
      });
      return { success: false, error: 'sender_suspended' };
    }

    const { targetPosCode, amount } = params;
    const target = posClients.find(p => p.posCode.trim().toUpperCase() === targetPosCode.trim().toUpperCase());
    
    if (!target) {
      showToast({
        type: 'error',
        title: 'المعرف أو رمز QR غير مسجل',
        description: `لم يتم العثور على نقطة بيع بهذا المعرف (${targetPosCode}). تأكد من صيغة المعرف (مثال: RYD-10492).`
      });
      return { success: false, error: 'target_not_found' };
    }

    if (!isPosClientActive(target)) {
      showToast({
        type: 'error',
        title: 'حساب المستلم موقوف',
        description: `حساب نقطة البيع (${target.tradeName}) موقوف مؤقتاً من قِبل المتجر ولا يمكن التحويل إليه حالياً.`
      });
      return { success: false, error: 'target_suspended' };
    }

    if (target.id === currentPos.id) {
      showToast({
        type: 'error',
        title: 'عملية غير صالحة',
        description: 'لا يمكنك تحويل رصيد إلى محفظتك الخاصة.'
      });
      return { success: false, error: 'self_transfer' };
    }

    const feeAmount = calculateFee(amount, currentPosSupplier || supplier);
    const totalDeducted = amount + feeAmount;

    if (currentPos.walletBalance < totalDeducted) {
      showToast({
        type: 'error',
        title: 'الرصيد غير كافٍ',
        description: `الرصيد غير كافٍ! رصيدك الحالي (${formatCurrency(currentPos.walletBalance)}) لا يكفي لإتمام التحويل (${formatCurrency(totalDeducted)}). يرجى إعادة شحن المحفظة.`
      });
      return { success: false, error: 'insufficient_balance' };
    }

    const now = new Date();
    const formattedDate = now.toISOString().replace('T', ' ').substring(0, 16);
    const transferId = `trf-${Date.now().toString().slice(-6)}`;

    const targetSettlement = settlePendingGiftFeesOnRecharge({
      currentWalletBalance: target.walletBalance,
      rechargeAmount: amount,
      pendingGiftFees: target.pendingGiftFees,
    });
    const totalFeeToAdmin = parseFloat((feeAmount + targetSettlement.settledFeeAmount).toFixed(2));

    // Deduct from sender, add to target (and settle any pending deferred gift fees)
    setPosClients(prev => prev.map(p => {
      if (p.id === currentPos.id) {
        return {
          ...p,
          walletBalance: parseFloat((p.walletBalance - totalDeducted).toFixed(2))
        };
      }
      if (p.id === target.id) {
        return {
          ...p,
          walletBalance: targetSettlement.finalWalletBalance,
          pendingGiftFees: targetSettlement.remainingPendingGiftFees,
        };
      }
      return p;
    }));

    // Add fee + any settled pending gift fees to admin
    setSuperAdmin(prev => ({
      ...prev,
      walletBalance: parseFloat((prev.walletBalance + totalFeeToAdmin).toFixed(2))
    }));

    // Accounting entries for sender & receiver
    const transferAccountingEntries: AccountingEntry[] = [
      {
        id: `acc-${Date.now()}-trf-out`,
        date: formattedDate,
        type: 'transfer_out',
        referenceId: transferId,
        posId: currentPos.id,
        supplierId: supplier.id,
        description: `تحويل رصيد إلى نقطة البيع (${target.tradeName} - ${target.posCode}) عبر المعرف/QR`,
        debit: amount,
        credit: 0,
        balanceAfter: parseFloat((currentPos.walletBalance - amount).toFixed(2))
      },
      {
        id: `acc-${Date.now()}-trf-fee`,
        date: formattedDate,
        type: 'fee',
        referenceId: transferId,
        posId: currentPos.id,
        supplierId: supplier.id,
        description: `رسوم منصة تطبيق (${feeAmount.toFixed(2)} ر.س) على تحويل الرصيد`,
        debit: feeAmount,
        credit: 0,
        balanceAfter: parseFloat((currentPos.walletBalance - totalDeducted).toFixed(2))
      },
      {
        id: `acc-${Date.now()}-trf-in`,
        date: formattedDate,
        type: 'transfer_in',
        referenceId: transferId,
        posId: target.id,
        supplierId: target.supplierId || supplier.id,
        description: `استلام تحويل رصيد من (${currentPos.tradeName} - ${currentPos.posCode})`,
        debit: 0,
        credit: amount,
        balanceAfter: targetSettlement.finalWalletBalance
      },
    ];
    setAccountingEntries(prev => [...transferAccountingEntries, ...prev]);
    for (const trfAcc of transferAccountingEntries) {
      firestoreSync.saveAccountingEntry(trfAcc).catch(console.error);
    }

    if (feeAmount > 0 || targetSettlement.settledFeeAmount > 0) {
      const nextAdminEntries: AdminAccountingEntry[] = [];
      let runningAdminBal = superAdmin.walletBalance;
      if (feeAmount > 0) {
        runningAdminBal = parseFloat((runningAdminBal + feeAmount).toFixed(2));
        const feeAdmEntry: AdminAccountingEntry = {
          id: `adm-acc-${Date.now()}-trf`,
          date: formattedDate,
          type: 'fee_collected',
          referenceId: transferId,
          supplierId: supplier.id,
          supplierName: `${supplier.name} (${supplier.storeName})`,
          posId: currentPos.id,
          posCode: currentPos.posCode,
          posName: currentPos.tradeName,
          description: `تحصيل رسوم تحويل رصيد بين الوكلاء (${feeAmount.toFixed(2)} ر.س) من ${currentPos.posCode} إلى ${target.posCode}`,
          grossAmount: amount,
          feeAmount: feeAmount,
          debit: 0,
          credit: feeAmount,
          balanceAfter: runningAdminBal,
          notes: `تحويل بقيمة ${amount.toFixed(2)} ر.س بين الوكيلين`
        };
        nextAdminEntries.push(feeAdmEntry);
        firestoreSync.saveAdminAccountingEntry(feeAdmEntry).catch(console.error);
      }
      if (targetSettlement.settledFeeAmount > 0) {
        runningAdminBal = parseFloat((runningAdminBal + targetSettlement.settledFeeAmount).toFixed(2));
        const settledAdminEntry: AdminAccountingEntry = {
          id: `adm-acc-${Date.now()}-gift-trf`,
          date: formattedDate,
          type: 'fee_collected',
          referenceId: transferId,
          supplierId: target.supplierId,
          supplierName: supplier.name,
          posId: target.id,
          posCode: target.posCode,
          posName: target.tradeName,
          description: `تحصيل رسوم تطبيق مؤجلة (${targetSettlement.settledFeeAmount.toFixed(2)} ر.س) بعد شحن محفظة ${target.tradeName}`,
          grossAmount: targetSettlement.settledFeeAmount,
          feeAmount: targetSettlement.settledFeeAmount,
          debit: 0,
          credit: targetSettlement.settledFeeAmount,
          balanceAfter: runningAdminBal,
          notes: `خصم تلقائي عند استلام تحويل رصيد للمحفظة`
        };
        nextAdminEntries.push(settledAdminEntry);
        firestoreSync.saveAdminAccountingEntry(settledAdminEntry).catch(console.error);
      }
      setAdminAccountingEntries(prev => [...nextAdminEntries, ...prev]);
    }

    // Save balance transfer and updated balances in Firestore
    firestoreSync.saveTransfer({
      id: transferId,
      date: formattedDate,
      fromPosId: currentPos.id,
      fromPosName: currentPos.tradeName,
      fromPosCode: currentPos.posCode,
      toPosCode: target.posCode,
      toPosName: target.tradeName,
      amount,
      feeAmount,
      totalDeducted,
      status: 'completed'
    }).catch(console.error);

    firestoreSync.savePosClient({
      ...currentPos,
      walletBalance: parseFloat((currentPos.walletBalance - totalDeducted).toFixed(2))
    }).catch(console.error);

    firestoreSync.savePosClient({
      ...target,
      walletBalance: targetSettlement.finalWalletBalance,
      pendingGiftFees: targetSettlement.remainingPendingGiftFees,
    }).catch(console.error);

    if (totalFeeToAdmin > 0) {
      firestoreSync.saveSuperAdmin({
        ...superAdmin,
        walletBalance: parseFloat((superAdmin.walletBalance + totalFeeToAdmin).toFixed(2))
      }).catch(console.error);
    }

    triggerConfetti();
    const targetTrfCurrency = normalizeCurrencyCode(target.preferredCurrency);
    addNotification({
      posId: target.id,
      supplierId: supplier.id,
      supplierName: currentPos.tradeName,
      title: 'تحويل رصيد وارد',
      message: `استلمت تحويل رصيد بقيمة ${formatCurrencyAmount(amount, targetTrfCurrency, activeExchangeRate)} من (${currentPos.tradeName} - ${currentPos.posCode}).`,
      type: 'transfer'
    });
    showToast({
      type: 'success',
      title: 'تم تحويل الرصيد وحفظه في القواعد الثلاث',
      description: `تم إرسال ${formatCurrency(amount)} إلى ${target.tradeName} (${target.posCode}) وحفظ العملية في كافة القواعد المرتبطة.`
    });

    return { success: true };
  };

  // Manage supplier bank accounts & POS client transfer-receiving delegations
  const syncPosTransferPrivilegesFromAccounts = (
    nextAccounts: SupplierBankAccount[],
    affectedPosIds: string[]
  ) => {
    if (affectedPosIds.length === 0) return;
    const uniqueIds = Array.from(new Set(affectedPosIds));
    setPosClients(prev =>
      prev.map(pos => {
        if (!uniqueIds.includes(pos.id)) return pos;
        const hasPrivilege = nextAccounts.some(acc => isAccountAssignedToPos(acc, pos));
        const updatedPos = { ...pos, canReceiveSupplierTransfers: hasPrivilege };
        firestoreSync.savePosClient(updatedPos).catch(console.error);
        return updatedPos;
      })
    );
  };

  const saveSupplierBankAccount = (input: {
    id?: string;
    bankName: string;
    accountNumber: string;
    iban?: string;
    country: string;
    accountHolderName: string;
    accountHolderEmail: string;
    accountHolderPhone?: string;
    holderType?: 'employee' | 'client' | 'supplier';
    delegatedPosId?: string;
    delegatedEmployeeId?: string;
    canReceiveSupplierTransfers: boolean;
    isPrimary?: boolean;
    isActive?: boolean;
    currency?: string;
    notes?: string;
  }): { success: boolean; error?: string; account?: SupplierBankAccount } => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canManageBankAccounts, 'ليس لديك صلاحية إضافة أو تعديل الحسابات البنكية.')) {
      return { success: false, error: 'ليس لديك صلاحية إدارة الحسابات البنكية.' };
    }
    const validation = validateBankAccountInput(input);
    if (!validation.valid) {
      showToast({
        type: 'error',
        title: 'بيانات الحساب البنكي غير مكتملة',
        description: validation.error || 'يرجى التحقق من الحقول المطلوبة.'
      });
      return { success: false, error: validation.error };
    }

    const nowDate = new Date().toISOString().substring(0, 10);
    const nowTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const existing = input.id ? supplierBankAccounts.find(a => a.id === input.id) : undefined;
    const targetSupplierId = existing?.supplierId || supplier.id;
    const accountId = existing?.id || `bank-${Date.now().toString().slice(-6)}`;

    const cleanEmail = normalizeEmail(input.accountHolderEmail);
    const resolvedPos = resolveBankAccountReceiverPos(
      {
        delegatedPosId: input.delegatedPosId,
        accountHolderEmail: cleanEmail,
        canReceiveSupplierTransfers: input.canReceiveSupplierTransfers,
        supplierId: targetSupplierId
      },
      posClients
    );

    const resolvedHolderType: 'employee' | 'client' | 'supplier' =
      input.holderType ??
      existing?.holderType ??
      (resolvedPos || input.delegatedPosId ? 'client' : existing?.delegatedEmployeeId || input.delegatedEmployeeId ? 'employee' : 'supplier');

    const savedAccount: SupplierBankAccount = {
      id: accountId,
      supplierId: targetSupplierId,
      bankName: input.bankName.trim(),
      accountNumber: input.accountNumber.trim(),
      iban: input.iban?.trim().toUpperCase() || undefined,
      country: input.country.trim(),
      accountHolderName: input.accountHolderName.trim(),
      accountHolderEmail: cleanEmail,
      accountHolderPhone: input.accountHolderPhone?.trim() || undefined,
      holderType: resolvedHolderType,
      delegatedPosId: resolvedPos?.id || (input.delegatedPosId || undefined),
      delegatedPosName: resolvedPos?.tradeName || undefined,
      delegatedPosCode: resolvedPos?.posCode || undefined,
      delegatedEmployeeId: input.delegatedEmployeeId ?? existing?.delegatedEmployeeId,
      canReceiveSupplierTransfers: input.canReceiveSupplierTransfers,
      isPrimary: input.isPrimary ?? existing?.isPrimary ?? false,
      isActive: input.isActive ?? existing?.isActive ?? true,
      currency: input.currency?.trim() || existing?.currency || 'ر.س',
      notes: input.notes?.trim() || undefined,
      createdAt: existing?.createdAt || nowDate,
      updatedAt: nowTimestamp
    };

    const nextAccounts = existing
      ? supplierBankAccounts.map(a => (a.id === accountId ? savedAccount : a))
      : [savedAccount, ...supplierBankAccounts];

    setSupplierBankAccounts(nextAccounts);
    firestoreSync.saveSupplierBankAccount(savedAccount).catch(console.error);

    if (savedAccount.isPrimary) {
      const targetSup = suppliers.find(s => s.id === targetSupplierId);
      if (targetSup) {
        const updatedSup: Supplier = {
          ...targetSup,
          bankAccountDetails: {
            bankName: savedAccount.bankName,
            accountHolder: savedAccount.accountHolderName,
            iban: savedAccount.iban || targetSup.bankAccountDetails.iban,
            accountNumber: savedAccount.accountNumber
          }
        };
        setSuppliers(prev => prev.map(s => (s.id === targetSup.id ? updatedSup : s)));
        firestoreSync.saveSupplier(updatedSup).catch(console.error);
      }
    }

    const affectedIds: string[] = [];
    if (existing?.delegatedPosId) affectedIds.push(existing.delegatedPosId);
    if (resolvedPos?.id) affectedIds.push(resolvedPos.id);
    if (existing?.accountHolderEmail) {
      const prevEmailMatch = posClients.find(
        p => p.supplierId === targetSupplierId && normalizeEmail(p.email) === normalizeEmail(existing.accountHolderEmail)
      );
      if (prevEmailMatch) affectedIds.push(prevEmailMatch.id);
    }
    const newEmailMatch = posClients.find(
      p => p.supplierId === targetSupplierId && normalizeEmail(p.email) === cleanEmail
    );
    if (newEmailMatch) affectedIds.push(newEmailMatch.id);

    syncPosTransferPrivilegesFromAccounts(nextAccounts, affectedIds);

    if (savedAccount.canReceiveSupplierTransfers && resolvedPos) {
      addNotification({
        posId: resolvedPos.id,
        supplierId: targetSupplierId,
        supplierName: supplier.name,
        title: 'تم منحك ميزة استلام ومراجعة حوالات المتجر',
        message: `منحك المتجر ${supplier.storeName} صلاحية استلام ومراجعة حوالات الشحن الواردة لحساب (${savedAccount.bankName} - ${savedAccount.country}). ظهرت الآن واجهة "استلام ومراجعة حوالات المتجر" في لوحتك.`,
        type: 'announcement'
      });
    }

    showToast({
      type: 'success',
      title: existing ? 'تم تحديث بيانات الحساب البنكي بنجاح' : 'تمت إضافة الحساب البنكي بنجاح',
      description: savedAccount.canReceiveSupplierTransfers && resolvedPos
        ? `تم ربط الحساب بنقطة البيع (${resolvedPos.tradeName}) ومنحها ميزة استلام ومراجعة حوالات المتجر.`
        : `تم حفظ حساب (${savedAccount.bankName} · ${savedAccount.country}) باسم ${savedAccount.accountHolderName}.`
    });

    return { success: true, account: savedAccount };
  };

  const saveBatchBankAccounts = (
    input: BatchBankAccountsInput
  ): { success: boolean; error?: string; accounts?: SupplierBankAccount[]; employee?: OfficeEmployee } => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canManageBankAccounts, 'ليس لديك صلاحية إدارة الحسابات البنكية وتفويض الاستلام.')) {
      return { success: false, error: 'ليس لديك صلاحية إدارة الحسابات البنكية.' };
    }
    const validation = validateBatchBankAccountsInput(input);
    if (!validation.valid) {
      showToast({
        type: 'error',
        title: 'بيانات الحسابات البنكية غير مكتملة',
        description: validation.error || 'يرجى التحقق من الحقول المطلوبة.'
      });
      return { success: false, error: validation.error };
    }

    const nowDate = new Date().toISOString().substring(0, 10);
    const nowTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const cleanEmail = normalizeEmail(input.accountHolderEmail);
    const baseStamp = Date.now().toString().slice(-6);
    const targetSupplierId = supplier.id;

    if (input.mode === 'employee') {
      const existingEmp = (supplier.employees || []).find(
        e => normalizeEmail(e.email) === cleanEmail
      );
      let targetEmp: OfficeEmployee;
      if (existingEmp) {
        const mergedPermissions: EmployeePermissions = {
          ...existingEmp.permissions,
          canReviewDeposits: true,
          canReviewCashDeposits: true,
          canReviewLoanDeposits: true
        };
        const updRes = updateOfficeEmployee(existingEmp.id, {
          name: input.accountHolderName.trim(),
          phone: input.accountHolderPhone?.trim() || existingEmp.phone,
          country: input.country.trim(),
          isTransferReceiverOnly: existingEmp.isTransferReceiverOnly ?? true,
          password: input.employeePassword?.trim() || existingEmp.password,
          roleTitle: existingEmp.roleTitle || `موظف استلام ومراجعة حوالات (${input.country.trim()})`,
          permissions: mergedPermissions
        });
        if (!updRes.success) {
          return { success: false, error: updRes.error };
        }
        targetEmp = {
          ...existingEmp,
          name: input.accountHolderName.trim(),
          phone: input.accountHolderPhone?.trim() || existingEmp.phone,
          country: input.country.trim(),
          isTransferReceiverOnly: existingEmp.isTransferReceiverOnly ?? true,
          password: input.employeePassword?.trim() || existingEmp.password,
          roleTitle: existingEmp.roleTitle || `موظف استلام ومراجعة حوالات (${input.country.trim()})`,
          permissions: mergedPermissions
        };
      } else {
        const addRes = addOfficeEmployee({
          name: input.accountHolderName.trim(),
          email: cleanEmail,
          password: input.employeePassword?.trim() || '123456',
          phone: input.accountHolderPhone?.trim() || '',
          country: input.country.trim(),
          isTransferReceiverOnly: true,
          roleTitle: `موظف استلام ومراجعة حوالات (${input.country.trim()})`,
          permissions: {
            canReviewDeposits: true,
            canReviewCashDeposits: true,
            canReviewLoanDeposits: true
          }
        });
        if (!addRes.success || !addRes.employee) {
          return { success: false, error: addRes.error };
        }
        targetEmp = addRes.employee;
      }

      const createdAccounts: SupplierBankAccount[] = input.banks.map((bank, idx) => ({
        id: `bank-${baseStamp}-${idx + 1}`,
        supplierId: targetSupplierId,
        bankName: bank.bankName.trim(),
        accountNumber: bank.accountNumber.trim(),
        iban: bank.iban?.trim().toUpperCase() || undefined,
        country: input.country.trim(),
        accountHolderName: input.accountHolderName.trim(),
        accountHolderEmail: cleanEmail,
        accountHolderPhone: input.accountHolderPhone?.trim() || undefined,
        holderType: 'employee',
        delegatedEmployeeId: targetEmp.id,
        canReceiveSupplierTransfers: true,
        isPrimary: false,
        isActive: input.isActive ?? true,
        currency: bank.currency?.trim() || 'ر.س',
        notes: bank.notes?.trim() || input.notes?.trim() || undefined,
        createdAt: nowDate,
        updatedAt: nowTimestamp
      }));

      const nextAccounts = [...createdAccounts, ...supplierBankAccounts];
      setSupplierBankAccounts(nextAccounts);
      createdAccounts.forEach(acc => {
        firestoreSync.saveSupplierBankAccount(acc).catch(console.error);
      });

      showToast({
        type: 'success',
        title: 'تمت إضافة الموظف وحساباته البنكية بنجاح',
        description: `تم إضافة (${targetEmp.name}) كموظف استلام ومراجعة حوالات في (${input.country.trim()}) وربط ${createdAccounts.length} حساب/حسابات بنكية له.`
      });

      return { success: true, accounts: createdAccounts, employee: targetEmp };
    }

    // Client mode ('client')
    const chosenClient = posClients.find(p => p.id === input.delegatedPosId);
    if (!chosenClient) {
      const errorMsg = 'لم يتم العثور على العميل المختار ضمن قائمة عملاء المتجر.';
      showToast({
        type: 'error',
        title: 'تعذر إتمام الربط',
        description: errorMsg
      });
      return { success: false, error: errorMsg };
    }

    const createdAccounts: SupplierBankAccount[] = input.banks.map((bank, idx) => ({
      id: `bank-${baseStamp}-${idx + 1}`,
      supplierId: targetSupplierId,
      bankName: bank.bankName.trim(),
      accountNumber: bank.accountNumber.trim(),
      iban: bank.iban?.trim().toUpperCase() || undefined,
      country: input.country.trim(),
      accountHolderName: input.accountHolderName.trim(),
      accountHolderEmail: cleanEmail,
      accountHolderPhone: input.accountHolderPhone?.trim() || chosenClient.phone || undefined,
      holderType: 'client',
      delegatedPosId: chosenClient.id,
      delegatedPosName: chosenClient.tradeName,
      delegatedPosCode: chosenClient.posCode,
      canReceiveSupplierTransfers: true,
      isPrimary: false,
      isActive: input.isActive ?? true,
      notes: bank.notes?.trim() || input.notes?.trim() || undefined,
      createdAt: nowDate,
      updatedAt: nowTimestamp
    }));

    const nextAccounts = [...createdAccounts, ...supplierBankAccounts];
    setSupplierBankAccounts(nextAccounts);
    createdAccounts.forEach(acc => {
      firestoreSync.saveSupplierBankAccount(acc).catch(console.error);
    });

    syncPosTransferPrivilegesFromAccounts(nextAccounts, [chosenClient.id]);

    addNotification({
      posId: chosenClient.id,
      supplierId: targetSupplierId,
      supplierName: supplier.name,
      title: 'تم منحك ميزة استلام ومراجعة حوالات المتجر',
      message: `منحك المتجر ${supplier.storeName} صلاحية استلام ومراجعة وتأكيد حوالات المتجر عبر ${createdAccounts.length} حساب/حسابات بنكية (${createdAccounts.map(a => a.bankName).join('، ')}).`,
      type: 'announcement'
    });

    showToast({
      type: 'success',
      title: 'تمت إضافة الحسابات البنكية للعميل بنجاح',
      description: `تم ربط ${createdAccounts.length} حساب/حسابات بنكية بالعميل (${chosenClient.tradeName}) ومنحه صلاحية استلام ومراجعة وتأكيد الحوالات.`
    });

    return { success: true, accounts: createdAccounts };
  };

  const toggleBankAccountTransferPrivilege = (accountId: string, enabled: boolean) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canManageBankAccounts, 'ليس لديك صلاحية تعديل صلاحيات الحسابات البنكية.')) return;
    const targetAcc = supplierBankAccounts.find(a => a.id === accountId);
    if (!targetAcc) return;

    const resolvedPos = resolveBankAccountReceiverPos(
      { ...targetAcc, canReceiveSupplierTransfers: true },
      posClients
    );

    const updatedAcc: SupplierBankAccount = {
      ...targetAcc,
      canReceiveSupplierTransfers: enabled,
      delegatedPosId: enabled ? (resolvedPos?.id || targetAcc.delegatedPosId) : targetAcc.delegatedPosId,
      delegatedPosName: enabled ? (resolvedPos?.tradeName || targetAcc.delegatedPosName) : targetAcc.delegatedPosName,
      delegatedPosCode: enabled ? (resolvedPos?.posCode || targetAcc.delegatedPosCode) : targetAcc.delegatedPosCode,
      updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    const nextAccounts = supplierBankAccounts.map(a => (a.id === accountId ? updatedAcc : a));
    setSupplierBankAccounts(nextAccounts);
    firestoreSync.saveSupplierBankAccount(updatedAcc).catch(console.error);

    const affectedIds: string[] = [];
    if (updatedAcc.delegatedPosId) affectedIds.push(updatedAcc.delegatedPosId);
    if (resolvedPos?.id) affectedIds.push(resolvedPos.id);
    syncPosTransferPrivilegesFromAccounts(nextAccounts, affectedIds);

    if (enabled && resolvedPos) {
      addNotification({
        posId: resolvedPos.id,
        supplierId: targetAcc.supplierId,
        supplierName: supplier.name,
        title: 'تفعيل ميزة استلام حوالات المتجر',
        message: `تم تفعيل صلاحية "استلام ومراجعة حوالات المتجر" لحسابك (${updatedAcc.bankName}) لدى ${supplier.storeName}.`,
        type: 'announcement'
      });
    }

    showToast({
      type: enabled ? 'success' : 'info',
      title: enabled ? 'تم منح ميزة استلام الحوالات بنجاح' : 'تم إيقاف ميزة استلام الحوالات لهذا الحساب',
      description: resolvedPos
        ? `${enabled ? 'تظهر الآن' : 'تم إخفاء'} واجهة "استلام ومراجعة حوالات المتجر" لدى نقطة البيع (${resolvedPos.tradeName}).`
        : `تم تحديث صلاحية الحساب البنكي (${updatedAcc.bankName}).`
    });
  };

  const deleteSupplierBankAccount = (accountId: string) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canManageBankAccounts, 'ليس لديك صلاحية حذف الحسابات البنكية.')) return;
    const targetAcc = supplierBankAccounts.find(a => a.id === accountId);
    if (!targetAcc) return;

    const nextAccounts = supplierBankAccounts.filter(a => a.id !== accountId);
    setSupplierBankAccounts(nextAccounts);
    firestoreSync.deleteSupplierBankAccount(accountId).catch(console.error);

    const affectedIds: string[] = [];
    if (targetAcc.delegatedPosId) affectedIds.push(targetAcc.delegatedPosId);
    const emailMatch = posClients.find(
      p => p.supplierId === targetAcc.supplierId && normalizeEmail(p.email) === normalizeEmail(targetAcc.accountHolderEmail)
    );
    if (emailMatch) affectedIds.push(emailMatch.id);
    syncPosTransferPrivilegesFromAccounts(nextAccounts, affectedIds);

    showToast({
      type: 'info',
      title: 'تم حذف الحساب البنكي',
      description: `تم حذف حساب (${targetAcc.bankName} - ${targetAcc.accountHolderName}) من قائمة الحسابات.`
    });
  };

  const confirmDepositReceiptByReceiver = (
    depositId: string,
    decision: 'confirmed' | 'rejected',
    note?: string
  ) => {
    if (isSupplierPosPreviewMode) {
      showToast({
        type: 'info',
        title: 'وضع الاطلاع فقط',
        description: 'لا يمكن تأكيد أو رفض الحوالات أثناء وضع معاينة واجهة نقطة البيع.'
      });
      return;
    }
    const dep = depositRequests.find(d => d.id === depositId);
    if (!dep) return;

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const receiverName =
      role === 'employee' || role === 'supplier'
        ? (currentUser?.name || supplier.name || dep.targetAccountHolderName || 'موظف استلام الحوالات')
        : (currentPos.tradeName || dep.receiverPosName || dep.targetAccountHolderName || 'نقطة البيع المخوّلة');
    const defaultNote =
      decision === 'confirmed'
        ? `تم تأكيد استلام الحوالة رقم (${dep.transferNumber}) في الحساب البنكي (${dep.targetBankName || dep.bankName})`
        : `لم يتم استلام الحوالة رقم (${dep.transferNumber}) في الحساب البنكي (${dep.targetBankName || dep.bankName})`;

    const updatedDep: DepositRequest = {
      ...dep,
      receiverConfirmationStatus: decision as ReceiverConfirmationStatus,
      receiverConfirmedAt: nowStr,
      receiverConfirmedByName: receiverName,
      receiverConfirmationNote: note?.trim() || defaultNote
    };

    setDepositRequests(prev => prev.map(d => (d.id === depositId ? updatedDep : d)));
    firestoreSync.saveDepositRequest(updatedDep).catch(console.error);

    const targetSup = suppliers.find(s => s.id === dep.supplierId) || supplier;
    const targetDepPos = posClients.find(p => p.id === dep.posId);
    const depPosCurrency = normalizeCurrencyCode(targetDepPos?.preferredCurrency);
    const depSupCurrency = normalizeCurrencyCode(targetSup.preferredCurrency);
    const depSupRate = normalizeExchangeRateSarPerUsd(targetSup.exchangeRateSarPerUsd);
    const depPosFormatted = formatCurrencyAmount(dep.amount, depPosCurrency, depSupRate);
    const depSupFormatted = formatCurrencyAmount(dep.amount, depSupCurrency, depSupRate);

    addNotification({
      posId: dep.posId,
      posName: dep.posName,
      posCode: dep.posCode,
      supplierId: targetSup.id,
      supplierName: receiverName,
      targetRole: 'pos',
      title: decision === 'confirmed' ? 'تم تأكيد استلام الحوالة من مستلم المتجر' : 'تنبيه: أفاد مستلم الحوالة بعدم استلامها',
      message:
        decision === 'confirmed'
          ? `أكدت نقطة البيع المخوّلة (${receiverName}) استلام الحوالة #${dep.transferNumber} بمبلغ ${depPosFormatted}، وأصبح الإشعار ظاهراً لدى المتجر في نفس طلب الشحن.`
          : `أفادت نقطة البيع المخوّلة (${receiverName}) بعدم استلام الحوالة #${dep.transferNumber} بمبلغ ${depPosFormatted}. السبب: ${updatedDep.receiverConfirmationNote}`,
      type: 'deposit'
    });

    // Also notify the supplier directly
    addNotification({
      supplierId: targetSup.id,
      supplierName: receiverName,
      posId: dep.posId,
      posName: dep.posName,
      posCode: dep.posCode,
      targetRole: 'supplier',
      title: decision === 'confirmed' ? 'تأكيد استلام حوالة من المخوّل ✅' : 'تنبيه: عدم استلام حوالة من المخوّل ❌',
      message:
        decision === 'confirmed'
          ? `أكدت نقطة البيع المخوّلة (${receiverName}) استلام الحوالة #${dep.transferNumber} بمبلغ ${depSupFormatted} للعميل ${dep.posName} في الحساب (${dep.targetBankName || dep.bankName}).`
          : `أفادت نقطة البيع المخوّلة (${receiverName}) بعدم استلام الحوالة #${dep.transferNumber} بمبلغ ${depSupFormatted} للعميل ${dep.posName}. الملاحظة: ${updatedDep.receiverConfirmationNote}`,
      type: 'receiver_confirmation',
      depositId: dep.id,
      amount: dep.amount,
      actionTab: 'deposits'
    });

    showToast({
      type: decision === 'confirmed' ? 'success' : 'error',
      title: decision === 'confirmed' ? 'تم تأكيد استلام الحوالة وإشعار المتجر' : 'تم تسجيل عدم استلام الحوالة وإشعار المتجر',
      description: `سيظهر ردك (${decision === 'confirmed' ? 'تم تأكيد الاستلام' : 'لم يتم الاستلام'}) فوراً للتاجر المتجر (${targetSup.name}) داخل نفس طلب الشحن #${dep.id}.`
    });
  };

  // Submit deposit request (supports Cash/Bank Deposit AND Loan/Advance Credit Request)
  const submitDepositRequest = (params: {
    amount: number;
    requestType?: 'cash' | 'loan';
    transferNumber?: string;
    transferSenderName?: string;
    bankName?: string;
    targetBankAccountId?: string;
    loanReason?: string;
    transferReceiptImage?: string;
    transferReceiptFileName?: string;
  }) => {
    if (isSupplierPosPreviewMode) {
      showToast({
        type: 'info',
        title: 'وضع الاطلاع فقط',
        description: 'لا يمكن إرسال طلبات شحن أو سلفة أثناء وضع معاينة واجهة نقطة البيع.'
      });
      return;
    }
    const isLoan = params.requestType === 'loan';
    const depositId = isLoan ? `dep-loan-${Date.now().toString().slice(-6)}` : `dep-${Date.now().toString().slice(-6)}`;
    const now = new Date();
    const formattedDate = now.toISOString().replace('T', ' ').substring(0, 16);
    const targetSupplier = suppliers.find(s => s.id === currentPos?.supplierId) || supplier;

    const availableAccounts = getActiveBankAccountsForDeposit(supplierBankAccounts, targetSupplier);
    const selectedAccount = !isLoan
      ? (params.targetBankAccountId
          ? availableAccounts.find(a => a.id === params.targetBankAccountId) || availableAccounts[0]
          : availableAccounts[0])
      : undefined;

    const resolvedReceiverPos =
      selectedAccount && selectedAccount.canReceiveSupplierTransfers
        ? resolveBankAccountReceiverPos(selectedAccount, posClients)
        : undefined;
    const resolvedReceiverEmployee =
      selectedAccount && selectedAccount.canReceiveSupplierTransfers
        ? resolveBankAccountReceiverEmployee(selectedAccount, targetSupplier.employees || [])
        : undefined;

    const isEmployeeDelegated = Boolean(
      selectedAccount?.canReceiveSupplierTransfers &&
        (selectedAccount.holderType === 'employee' || selectedAccount.delegatedEmployeeId || resolvedReceiverEmployee)
    );
    const isPosDelegated = Boolean(
      selectedAccount?.canReceiveSupplierTransfers && !isEmployeeDelegated && (resolvedReceiverPos || selectedAccount?.delegatedPosId)
    );
    const isDelegatedTransfer = isPosDelegated || isEmployeeDelegated;

    const newDep: DepositRequest = {
      id: depositId,
      posId: currentPos.id,
      posName: currentPos.tradeName,
      posCode: currentPos.posCode,
      supplierId: targetSupplier.id,
      amount: params.amount,
      requestType: params.requestType || 'cash',
      transferNumber: isLoan
        ? `LOAN-ADVANCE-${Date.now().toString().slice(-4)}`
        : (params.transferNumber || `TRX-${Date.now().toString().slice(-6)}`),
      transferSenderName: isLoan
        ? `طلب سلفة من العميل (${currentPos.ownerName})`
        : (params.transferSenderName || currentPos.ownerName),
      bankName: isLoan
        ? 'سلفة / رصيد آجل (بدون تحويل بنكي)'
        : (params.bankName || selectedAccount?.bankName || 'مصرف الراجحي'),
      date: formattedDate,
      status: 'pending',
      loanReason: params.loanReason || (isLoan ? 'طلب سلفة رصيد آجل عاجل' : undefined),
      loanRepaidStatus: isLoan ? 'unpaid' : undefined,
      transferReceiptImage: !isLoan ? params.transferReceiptImage : undefined,
      transferReceiptFileName: !isLoan ? params.transferReceiptFileName : undefined,
      targetBankAccountId: selectedAccount?.id,
      targetBankName: selectedAccount?.bankName,
      targetBankAccountNumber: selectedAccount?.accountNumber,
      targetIban: selectedAccount?.iban,
      targetBankAccountCountry: selectedAccount?.country,
      targetAccountHolderName: selectedAccount?.accountHolderName,
      targetAccountHolderEmail: selectedAccount?.accountHolderEmail,
      receiverPosId: isPosDelegated ? (resolvedReceiverPos?.id || selectedAccount?.delegatedPosId) : undefined,
      receiverPosName: isDelegatedTransfer
        ? (isEmployeeDelegated
            ? (resolvedReceiverEmployee?.name || selectedAccount?.accountHolderName)
            : (resolvedReceiverPos?.tradeName || selectedAccount?.delegatedPosName || selectedAccount?.accountHolderName))
        : undefined,
      receiverPosCode: isPosDelegated ? (resolvedReceiverPos?.posCode || selectedAccount?.delegatedPosCode) : undefined,
      receiverPosEmail: isDelegatedTransfer
        ? (isEmployeeDelegated
            ? (resolvedReceiverEmployee?.email || selectedAccount?.accountHolderEmail)
            : (resolvedReceiverPos?.email || selectedAccount?.accountHolderEmail))
        : undefined,
      receiverEmployeeId: isEmployeeDelegated ? (resolvedReceiverEmployee?.id || selectedAccount?.delegatedEmployeeId) : undefined,
      receiverConfirmationStatus: isDelegatedTransfer ? 'pending' : undefined,
      notes: isLoan
        ? `طلب سلفة رصيد آجل بانتظار موافقة المتجر ${targetSupplier.name} بدون مرفقات بنكية`
        : isEmployeeDelegated
        ? `طلب إيداع لحساب موظف الاستلام (${resolvedReceiverEmployee?.name || selectedAccount?.accountHolderName}) بانتظار تأكيد الاستلام وموافقة المتجر ${targetSupplier.name}`
        : isDelegatedTransfer
        ? `طلب إيداع إلى حساب نقطة البيع المخوّلة (${resolvedReceiverPos?.tradeName || selectedAccount?.accountHolderName}) بانتظار تأكيد الاستلام وموافقة المتجر ${targetSupplier.name}`
        : `طلب إيداع كاش جديد بانتظار مراجعة وتأكيد المتجر ${targetSupplier.name}`
    };

    setDepositRequests(prev => [newDep, ...prev]);

    // Save Deposit / Loan request to Firestore
    firestoreSync.saveDepositRequest(newDep).catch(console.error);

    if (isDelegatedTransfer && newDep.receiverPosId) {
      const receiverPosObj = posClients.find(p => p.id === newDep.receiverPosId);
      const recCurrency = normalizeCurrencyCode(receiverPosObj?.preferredCurrency);
      addNotification({
        posId: newDep.receiverPosId,
        supplierId: targetSupplier.id,
        supplierName: currentPos.tradeName,
        title: 'حوالة جديدة بانتظار تأكيد الاستلام',
        message: `أرسل العميل (${currentPos.tradeName}) طلب شحن بمبلغ ${formatCurrencyAmount(params.amount, recCurrency, activeExchangeRate)} وأشار إلى أن الإيداع تم لحسابك (${selectedAccount?.bankName}). يرجى مراجعة الطلب وتأكيد استلام الحوالة أو عدم استلامها.`,
        type: 'deposit'
      });
    }

    const supDepCurrency = normalizeCurrencyCode(targetSupplier?.preferredCurrency);
    const supDepAmountText = formatCurrencyAmount(params.amount, supDepCurrency, activeExchangeRate);

    // Notify supplier of deposit or loan request
    if (isLoan) {
      addNotification({
        supplierId: targetSupplier.id,
        supplierName: targetSupplier.name,
        posId: currentPos.id,
        posName: currentPos.tradeName,
        posCode: currentPos.posCode,
        targetRole: 'supplier',
        title: 'طلب سلفة رصيد آجل جديد 💰',
        message: `طلب العميل ${currentPos.tradeName} (${currentPos.posCode}) سلفة رصيد آجل بمبلغ ${supDepAmountText}. السبب: ${params.loanReason || 'طلب سلفة رصيد عاجل'}.`,
        type: 'loan',
        depositId,
        amount: params.amount,
        actionTab: 'loans'
      });
    } else {
      addNotification({
        supplierId: targetSupplier.id,
        supplierName: targetSupplier.name,
        posId: currentPos.id,
        posName: currentPos.tradeName,
        posCode: currentPos.posCode,
        targetRole: 'supplier',
        title: isDelegatedTransfer
          ? 'طلب إيداع لحساب مخوّل بانتظار التأكيد 🏦'
          : 'طلب إيداع بنكي جديد بانتظار المطابقة 🏦',
        message: `أرسل العميل ${currentPos.tradeName} (${currentPos.posCode}) طلب شحن بمبلغ ${supDepAmountText} (حوالة: ${newDep.transferNumber} على ${selectedAccount?.bankName || 'حساب المتجر'}) مع صورة الإيصال المرفقة.`,
        type: 'deposit',
        depositId,
        amount: params.amount,
        actionTab: 'deposits'
      });
    }

    if (isLoan) {
      showToast({
        type: 'info',
        title: 'تم إرسال طلب السلفة للمتجر بنجاح',
        description: `تم إرسال طلب سلفة بقيمة ${formatCurrency(params.amount)} إلى المتجر ${targetSupplier.name} بدون الحاجة لمرفقات بنكية. سيصلك الرصيد فور الموافقة.`
      });
    } else if (isDelegatedTransfer) {
      showToast({
        type: 'info',
        title: 'تم إرسال طلب الشحن للمتجر ونقطة البيع المخوّلة',
        description: `تم إرسال الطلب إلى المتجر ${targetSupplier.name} وإلى نقطة البيع المخوّلة (${newDep.receiverPosName}) لتأكيد استلام الحوالة على حساب (${selectedAccount?.bankName}).`
      });
    } else {
      showToast({
        type: 'info',
        title: 'تم إرسال طلب الشحن بنجاح',
        description: `تم تقديم طلب شحن الرصيد المسبق للمتجر ${targetSupplier.name} وسيقوم بمطابقة رقم الحوالة واعتمادها.`
      });
    }
  };

  // Approve deposit request by supplier (handles cash deposits and loan approvals)
  // Fees (depositRequest / loanRequest) are deducted from client recharge and deposited to SuperAdmin ONLY upon completion (approval)
  const approveDepositRequest = (depositId: string) => {
    const dep = depositRequests.find(d => d.id === depositId);
    if (!dep || dep.status !== 'pending') return;

    const isLoan = dep.requestType === 'loan' || Boolean(dep.loanReason);
    if (!assertEmployeePermission(
      isLoan ? effectiveEmployeePerms.canReviewLoanDeposits : effectiveEmployeePerms.canReviewCashDeposits,
      isLoan ? 'ليس لديك صلاحية اعتماد طلبات السُّلَف.' : 'ليس لديك صلاحية اعتماد طلبات الحوالات والإيداعات.'
    )) return;

    const depSupplier = suppliers.find(s => s.id === dep.supplierId) || supplier;
    const feeRule = resolveSpecificServiceFeeRule({
      section: 'client',
      serviceKey: isLoan ? 'loanRequest' : 'depositRequest',
      supplier: depSupplier,
      superAdmin,
    });
    const serviceFeeAmount = calculateFeeFromRule(dep.amount, feeRule, { capAtAmount: true });
    const netRechargeToClient = parseFloat(Math.max(0, dep.amount - serviceFeeAmount).toFixed(2));

    const approvedNotes = isLoan
      ? 'تمت الموافقة على طلب السلفة وقيد الرصيد الآجل في المحفظة'
      : 'تمت الموافقة ومطابقة الحوالة البنكية بنجاح';

    const updatedDep: DepositRequest = {
      ...dep,
      status: 'approved',
      notes: approvedNotes,
      feeAmount: serviceFeeAmount > 0 ? serviceFeeAmount : undefined,
      feeTargetRole: serviceFeeAmount > 0 ? 'client' : undefined,
      feeSettledToAdmin: true,
    };
    setDepositRequests(prev => prev.map(d => d.id === depositId ? updatedDep : d));

    const targetPos = posClients.find(p => p.id === dep.posId);
    const depositSettlement = targetPos
      ? settlePendingGiftFeesOnRecharge({
          currentWalletBalance: targetPos.walletBalance,
          rechargeAmount: netRechargeToClient,
          pendingGiftFees: targetPos.pendingGiftFees,
        })
      : {
          settledFeeAmount: 0,
          finalWalletBalance: netRechargeToClient,
          remainingPendingGiftFees: 0,
        };
    const newBal = depositSettlement.finalWalletBalance;

    setPosClients(prev => prev.map(p => {
      if (p.id !== dep.posId) return p;
      return {
        ...p,
        walletBalance: newBal,
        pendingGiftFees: depositSettlement.remainingPendingGiftFees,
      };
    }));

    if (targetPos) {
      firestoreSync.savePosClient({
        ...targetPos,
        walletBalance: newBal,
        pendingGiftFees: depositSettlement.remainingPendingGiftFees,
      }).catch(console.error);
    }
    firestoreSync.saveDepositRequest(updatedDep).catch(console.error);

    const now = new Date();
    const formattedDate = now.toISOString().replace('T', ' ').substring(0, 16);
    const clientBalBeforeFee = parseFloat(((targetPos?.walletBalance ?? 0) + dep.amount).toFixed(2));
    const clientBalAfterServiceFee = parseFloat(((targetPos?.walletBalance ?? 0) + netRechargeToClient).toFixed(2));

    const clientAccEntries: AccountingEntry[] = [
      {
        id: `acc-${Date.now()}-dep`,
        date: formattedDate,
        type: 'deposit',
        referenceId: dep.id,
        posId: dep.posId,
        supplierId: depSupplier.id,
        description: isLoan
          ? `إيداع سلفة رصيد آجل معتمدة من المتجر (${depSupplier.name}) ${dep.loanReason ? `[سبب السلفة: ${dep.loanReason}]` : ''}`
          : `إيداع رصيد مسبق في المحفظة عبر حوالة بنكية (${dep.bankName} - رقم الحوالة: ${dep.transferNumber})`,
        debit: 0,
        credit: dep.amount,
        balanceAfter: clientBalBeforeFee
      }
    ];
    if (serviceFeeAmount > 0) {
      clientAccEntries.push({
        id: `acc-${Date.now()}-dep-fee`,
        date: formattedDate,
        type: 'fee',
        referenceId: dep.id,
        posId: dep.posId,
        supplierId: depSupplier.id,
        description: isLoan
          ? `رسوم منصة على طلب السلفة (${serviceFeeAmount.toFixed(2)} ر.س)`
          : `رسوم منصة على طلب شحن الرصيد (${serviceFeeAmount.toFixed(2)} ر.س)`,
        debit: serviceFeeAmount,
        credit: 0,
        balanceAfter: clientBalAfterServiceFee
      });
    }
    setAccountingEntries(prev => [...clientAccEntries, ...prev]);
    for (const ent of clientAccEntries) {
      firestoreSync.saveAccountingEntry(ent).catch(console.error);
    }

    let nextAdminBalAfter = superAdmin.walletBalance;
    const totalFeeToAdmin = parseFloat((serviceFeeAmount + depositSettlement.settledFeeAmount).toFixed(2));
    const nextAdminEntries: AdminAccountingEntry[] = [];

    if (serviceFeeAmount > 0) {
      nextAdminBalAfter = parseFloat((nextAdminBalAfter + serviceFeeAmount).toFixed(2));
      const serviceFeeAdminEntry: AdminAccountingEntry = {
        id: `adm-acc-${Date.now()}-dep-fee`,
        date: formattedDate,
        type: 'fee_collected',
        referenceId: dep.id,
        supplierId: depSupplier.id,
        supplierName: `${depSupplier.name} (${depSupplier.storeName})`,
        posId: dep.posId,
        posCode: dep.posCode,
        posName: dep.posName,
        description: isLoan
          ? `تحصيل رسوم خدمة طلب سلفة من العميل (${serviceFeeAmount.toFixed(2)} ر.س): ${dep.posName}`
          : `تحصيل رسوم خدمة طلب شحن رصيد من العميل (${serviceFeeAmount.toFixed(2)} ر.س): ${dep.posName}`,
        grossAmount: dep.amount,
        feeAmount: serviceFeeAmount,
        debit: 0,
        credit: serviceFeeAmount,
        balanceAfter: nextAdminBalAfter,
        notes: `تم الخصم عند اعتماد الطلب واكتمال الشحن للعميل (${dep.posName})`
      };
      nextAdminEntries.push(serviceFeeAdminEntry);
      firestoreSync.saveAdminAccountingEntry(serviceFeeAdminEntry).catch(console.error);
    }

    if (depositSettlement.settledFeeAmount > 0) {
      nextAdminBalAfter = parseFloat((nextAdminBalAfter + depositSettlement.settledFeeAmount).toFixed(2));
      const settledFeeAdminEntry: AdminAccountingEntry = {
        id: `adm-acc-${Date.now()}-gift-dep`,
        date: formattedDate,
        type: 'fee_collected',
        referenceId: dep.id,
        supplierId: depSupplier.id,
        supplierName: `${depSupplier.name} (${depSupplier.storeName})`,
        posId: dep.posId,
        posCode: dep.posCode,
        posName: dep.posName,
        description: `تحصيل رسوم تطبيق مؤجلة (${depositSettlement.settledFeeAmount.toFixed(2)} ر.س) بعد شحن محفظة ${dep.posName}`,
        grossAmount: depositSettlement.settledFeeAmount,
        feeAmount: depositSettlement.settledFeeAmount,
        debit: 0,
        credit: depositSettlement.settledFeeAmount,
        balanceAfter: nextAdminBalAfter,
        notes: `خصم تلقائي عند شحن محفظة العميل (${dep.posName})`
      };
      nextAdminEntries.push(settledFeeAdminEntry);
      firestoreSync.saveAdminAccountingEntry(settledFeeAdminEntry).catch(console.error);
    }

    if (totalFeeToAdmin > 0) {
      setSuperAdmin(prev => ({
        ...prev,
        walletBalance: parseFloat((prev.walletBalance + totalFeeToAdmin).toFixed(2)),
      }));
      firestoreSync.saveSuperAdmin({
        ...superAdmin,
        walletBalance: parseFloat((superAdmin.walletBalance + totalFeeToAdmin).toFixed(2)),
      }).catch(console.error);
    }

    // Record in Admin accounting log
    nextAdminEntries.unshift({
      id: `adm-acc-${Date.now()}-dep`,
      date: formattedDate,
      type: 'deposit_received',
      referenceId: dep.id,
      supplierId: depSupplier.id,
      supplierName: `${depSupplier.name} (${depSupplier.storeName})`,
      posId: dep.posId,
      posCode: dep.posCode,
      posName: dep.posName,
      description: isLoan
        ? `موافقة المتجر على طلب سلفة رصيد آجل بقيمة ${dep.amount.toFixed(2)} ر.س لنقطة البيع ${dep.posName}`
        : `إشعار إيداع رصيد مسبق معتمد بقيمة ${dep.amount.toFixed(2)} ر.س (${dep.bankName} - حوالة ${dep.transferNumber})`,
      grossAmount: dep.amount,
      feeAmount: 0,
      debit: 0,
      credit: 0,
      balanceAfter: nextAdminBalAfter,
      notes: `معتمد من المتجر ${depSupplier.name} لنقطة البيع ${dep.posName}`
    });
    setAdminAccountingEntries(prev => [...nextAdminEntries, ...prev]);

    triggerConfetti();
    const depClientCurrency = normalizeCurrencyCode(targetPos?.preferredCurrency);
    const depClientAmtText = formatCurrencyAmount(netRechargeToClient, depClientCurrency, activeExchangeRate);
    addNotification({
      posId: dep.posId,
      supplierId: depSupplier.id,
      supplierName: depSupplier.name,
      title: isLoan ? 'تمت الموافقة على طلب السلفة' : 'تم شحن المحفظة بنجاح',
      message: isLoan
        ? `وافق المتجر ${depSupplier.name} على طلب السلفة وقيد ${depClientAmtText} في محفظتك.`
        : `تم اعتماد إيداع ${depClientAmtText} في محفظتك من المتجر ${depSupplier.name}.`,
      type: 'deposit'
    });
    showToast({
      type: 'success',
      title: isLoan ? 'تم اعتماد السلفة وقيد الرصيد بنجاح' : 'تم اعتماد طلب الإيداع وحفظه في القواعد الثلاث',
      description: serviceFeeAmount > 0
        ? `تم قيد ${formatCurrency(netRechargeToClient)} لمحفظة ${dep.posName} وتحصيل رسوم التطبيق (${formatCurrency(serviceFeeAmount)}).`
        : isLoan
        ? `تم إضافة رصيد سلفة بقيمة ${formatCurrency(dep.amount)} لمحفظة ${dep.posName} وتسجيلها في القيود المالية وقواعد البيانات.`
        : `تم شحن رصيد ${formatCurrency(dep.amount)} لمحفظة ${dep.posName} وتوثيقه في كافة القواعد المرتبطة.`
    });
  };

  const grantSupplierBalanceOrLoan = (params: {
    posId: string;
    amount: number;
    supportType: 'cash' | 'loan';
    reason: string;
  }): { success: boolean; error?: string } => {
    const isLoan = params.supportType === 'loan';
    if (!assertEmployeePermission(
      isLoan ? effectiveEmployeePerms.canReviewLoanDeposits : effectiveEmployeePerms.canReviewCashDeposits,
      isLoan ? 'ليس لديك صلاحية منح سلف للعملاء.' : 'ليس لديك صلاحية منح رصيد مجاني للعملاء.'
    )) {
      return { success: false, error: 'ليس لديك صلاحية منح هذا الدعم.' };
    }

    const client = posClients.find(p => p.id === params.posId);
    if (!client) {
      return { success: false, error: 'لم يتم العثور على العميل المحدد برقم المعرف.' };
    }

    if (params.amount <= 0) {
      return { success: false, error: 'يرجى إدخال مبلغ صحيح أكبر من الصفر.' };
    }

    // Supplier fee rule (Section 1: Supplier Services -> supportGrant / loanGrant)
    const supplierGrantRule = resolveSpecificServiceFeeRule({
      section: 'supplier',
      serviceKey: isLoan ? 'loanGrant' : 'supportGrant',
      supplier,
      superAdmin,
    });
    const supplierFeeAmount = calculateFeeFromRule(params.amount, supplierGrantRule);

    const reasonText = params.reason.trim() || (isLoan ? 'منح سلفة / رصيد آجل مباشر من المتجر' : 'منح رصيد مجاني / دعم من المتجر');
    const now = new Date();
    const formattedDate = now.toISOString().replace('T', ' ').substring(0, 16);
    const grantId = `grt-${Date.now().toString().slice(-6)}`;

    const newDep: DepositRequest = {
      id: grantId,
      posId: client.id,
      posName: client.tradeName,
      posCode: client.posCode,
      supplierId: supplier.id,
      amount: params.amount,
      transferNumber: `GRANT-${grantId}`,
      transferSenderName: supplier.storeName,
      bankName: isLoan ? 'سلفة مباشرة من المتجر' : 'دعم رصيد مجاني من المتجر',
      date: formattedDate,
      status: 'approved',
      requestType: params.supportType,
      loanReason: reasonText,
      notes: isLoan ? `منح سلفة معتمدة مباشرة: ${reasonText}` : `منح رصيد مجاني مدعوم: ${reasonText}`,
      feeAmount: supplierFeeAmount > 0 ? supplierFeeAmount : undefined,
      feeTargetRole: supplierFeeAmount > 0 ? 'supplier' : undefined,
      feeSettledToAdmin: true,
    };

    setDepositRequests(prev => [newDep, ...prev]);
    firestoreSync.saveDepositRequest(newDep).catch(console.error);

    const depositSettlement = settlePendingGiftFeesOnRecharge({
      currentWalletBalance: client.walletBalance,
      rechargeAmount: params.amount,
      pendingGiftFees: client.pendingGiftFees,
    });
    const newBal = depositSettlement.finalWalletBalance;

    setPosClients(prev => prev.map(p => {
      if (p.id !== client.id) return p;
      return {
        ...p,
        walletBalance: newBal,
        pendingGiftFees: depositSettlement.remainingPendingGiftFees,
      };
    }));

    firestoreSync.savePosClient({
      ...client,
      walletBalance: newBal,
      pendingGiftFees: depositSettlement.remainingPendingGiftFees,
    }).catch(console.error);

    // Deduct supplier service fee from supplier wallet when completed
    if (supplierFeeAmount > 0) {
      const nextSupplierBal = parseFloat((supplier.walletBalance - supplierFeeAmount).toFixed(2));
      setSuppliers(prev => prev.map(s => (s.id === supplier.id ? { ...s, walletBalance: nextSupplierBal } : s)));
      firestoreSync.saveSupplier({
        ...supplier,
        walletBalance: nextSupplierBal,
      }).catch(console.error);
    }

    // Credit supplier service fee + settled client gift fees to SuperAdmin wallet & log entries
    const totalFeeToAdmin = parseFloat((supplierFeeAmount + depositSettlement.settledFeeAmount).toFixed(2));
    if (totalFeeToAdmin > 0) {
      let runningAdminBal = superAdmin.walletBalance;
      const grantAdminEntries: AdminAccountingEntry[] = [];

      if (supplierFeeAmount > 0) {
        runningAdminBal = parseFloat((runningAdminBal + supplierFeeAmount).toFixed(2));
        const supGrantFeeEntry: AdminAccountingEntry = {
          id: `adm-acc-${Date.now()}-grt-sup`,
          date: formattedDate,
          type: 'fee_collected',
          referenceId: grantId,
          supplierId: supplier.id,
          supplierName: `${supplier.name} (${supplier.storeName})`,
          posId: client.id,
          posCode: client.posCode,
          posName: client.tradeName,
          description: isLoan
            ? `تحصيل رسوم خدمة شحن سلفة للعميل على المورد (${supplierFeeAmount.toFixed(2)} ر.س) للعميل ${client.tradeName}`
            : `تحصيل رسوم خدمة دعم الرصيد للعميل على المورد (${supplierFeeAmount.toFixed(2)} ر.س) للعميل ${client.tradeName}`,
          grossAmount: params.amount,
          feeAmount: supplierFeeAmount,
          debit: 0,
          credit: supplierFeeAmount,
          balanceAfter: runningAdminBal,
          notes: `مكتمل ومنفذ من المتجر (${supplier.storeName})`
        };
        grantAdminEntries.push(supGrantFeeEntry);
        firestoreSync.saveAdminAccountingEntry(supGrantFeeEntry).catch(console.error);
      }

      if (depositSettlement.settledFeeAmount > 0) {
        runningAdminBal = parseFloat((runningAdminBal + depositSettlement.settledFeeAmount).toFixed(2));
        const giftSettledEntry: AdminAccountingEntry = {
          id: `adm-acc-${Date.now()}-grt-gift`,
          date: formattedDate,
          type: 'fee_collected',
          referenceId: grantId,
          supplierId: supplier.id,
          supplierName: `${supplier.name} (${supplier.storeName})`,
          posId: client.id,
          posCode: client.posCode,
          posName: client.tradeName,
          description: `تحصيل رسوم تطبيق مؤجلة (${depositSettlement.settledFeeAmount.toFixed(2)} ر.س) بعد دعم محفظة ${client.tradeName}`,
          grossAmount: depositSettlement.settledFeeAmount,
          feeAmount: depositSettlement.settledFeeAmount,
          debit: 0,
          credit: depositSettlement.settledFeeAmount,
          balanceAfter: runningAdminBal,
          notes: `خصم تلقائي عند إضافة الرصيد لمحفظة العميل`
        };
        grantAdminEntries.push(giftSettledEntry);
        firestoreSync.saveAdminAccountingEntry(giftSettledEntry).catch(console.error);
      }

      setAdminAccountingEntries(prev => [...grantAdminEntries, ...prev]);
      setSuperAdmin(prev => ({
        ...prev,
        walletBalance: parseFloat((prev.walletBalance + totalFeeToAdmin).toFixed(2)),
      }));
      firestoreSync.saveSuperAdmin({
        ...superAdmin,
        walletBalance: parseFloat((superAdmin.walletBalance + totalFeeToAdmin).toFixed(2)),
      }).catch(console.error);
    }

    const accEntry: AccountingEntry = {
      id: `acc-${Date.now()}-grant`,
      date: formattedDate,
      type: 'deposit',
      referenceId: newDep.id,
      posId: client.id,
      supplierId: supplier.id,
      description: isLoan
        ? `منح سلفة رصيد آجل معتمدة مباشرة من المتجر (${supplier.name}) [السبب: ${reasonText}]`
        : `منح رصيد مجاني ودعم مالي من المتجر (${supplier.name}) [السبب: ${reasonText}]`,
      debit: 0,
      credit: params.amount,
      balanceAfter: newBal
    };
    setAccountingEntries(prev => [accEntry, ...prev]);
    firestoreSync.saveAccountingEntry(accEntry).catch(console.error);

    const grantedClientCurrency = normalizeCurrencyCode(client.preferredCurrency);
    const grantedClientAmtText = formatCurrencyAmount(params.amount, grantedClientCurrency, activeExchangeRate);
    addNotification({
      posId: client.id,
      supplierId: supplier.id,
      supplierName: supplier.name,
      title: isLoan ? 'تم منحك سلفة رصيد آجل 💰' : 'تم منحك رصيد مجاني / دعم 🎁',
      message: isLoan
        ? `قام المتجر ${supplier.name} بمنحك سلفة بقيمة ${grantedClientAmtText}. السبب: ${reasonText}.`
        : `قام المتجر ${supplier.name} بمنحك رصيد مجاني بقيمة ${grantedClientAmtText}. السبب: ${reasonText}.`,
      type: 'deposit'
    });

    showToast({
      type: 'success',
      title: isLoan ? 'تم منح السلفة وقيد الرصيد بنجاح' : 'تم منح الرصيد المجاني بنجاح',
      description: supplierFeeAmount > 0
        ? `تم إضافة مبلغ ${formatCurrency(params.amount)} لمحفظة العميل (${client.tradeName}) واحتساب رسوم الخدمة (${formatCurrency(supplierFeeAmount)}).`
        : `تم إضافة مبلغ ${formatCurrency(params.amount)} لمحفظة العميل (${client.tradeName}) بنجاح.`
    });

    return { success: true };
  };

  const markLoanAsRepaid = (depositId: string) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canReviewLoanDeposits, 'ليس لديك صلاحية إدارة وتوثيق سداد السُّلَف.')) return;
    const dep = depositRequests.find(d => d.id === depositId);
    if (!dep || dep.requestType !== 'loan' || dep.status !== 'approved') return;

    const remaining = getLoanRemainingAmount(dep);
    if (remaining <= 0) return;

    const now = new Date();
    const formattedDate = now.toISOString().replace('T', ' ').substring(0, 16);
    const targetSupplier = suppliers.find(s => s.id === dep.supplierId) || supplier;

    const paymentRecord: LoanPaymentRecord = {
      id: `lpay-${Date.now().toString().slice(-6)}`,
      amount: remaining,
      date: formattedDate,
      method: 'bank_transfer',
      notes: `تسديد مباشر موثق من المتجر (${targetSupplier.name})`,
      approvedBy: targetSupplier.name
    };

    const { updatedLoan } = applyLoanPaymentToLoan(dep, paymentRecord, targetSupplier.name);

    setDepositRequests(prev => prev.map(d => d.id === depositId ? updatedLoan : d));
    firestoreSync.saveDepositRequest(updatedLoan).catch(console.error);

    const repaidAccEntry: AccountingEntry = {
      id: `acc-${Date.now()}-repaid`,
      date: formattedDate,
      type: 'deposit',
      referenceId: dep.id,
      posId: dep.posId,
      supplierId: targetSupplier.id,
      description: `توثيق تسديد سلفة مستحقة بالكامل بمبلغ ${remaining.toFixed(2)} ر.س للمتجر (${targetSupplier.name})`,
      debit: 0,
      credit: 0,
      balanceAfter: posClients.find(p => p.id === dep.posId)?.walletBalance || 0
    };
    setAccountingEntries(prev => [repaidAccEntry, ...prev]);
    firestoreSync.saveAccountingEntry(repaidAccEntry).catch(console.error);

    const targetLoanPos = posClients.find(p => p.id === dep.posId);
    const loanPosCurrency = normalizeCurrencyCode(targetLoanPos?.preferredCurrency);
    const loanSupRate = normalizeExchangeRateSarPerUsd(targetSupplier.exchangeRateSarPerUsd);
    addNotification({
      posId: dep.posId,
      supplierId: targetSupplier.id,
      supplierName: targetSupplier.name,
      title: 'تم توثيق سداد السلفة بالكامل',
      message: `تم توثيق سداد السلفة رقم #${dep.id} بمبلغ ${formatCurrencyAmount(remaining, loanPosCurrency, loanSupRate)} بالكامل لدى المتجر ${targetSupplier.name}.`,
      type: 'deposit'
    });

    showToast({
      type: 'success',
      title: 'تم تسجيل تسديد السلفة بنجاح',
      description: `تم توثيق تسديد سلفة العميل ${dep.posName} بمبلغ ${formatCurrency(remaining)} بنجاح.`
    });
  };

  const payLoanFromWallet = async (
    loanId: string,
    rawAmount: number
  ): Promise<{ success: boolean; error?: string; receipt?: WalletLoanRepaymentReceipt }> => {
    if (isSupplierPosPreviewMode) {
      showToast({
        type: 'info',
        title: 'وضع الاطلاع فقط',
        description: 'لا يمكن سداد السلف أثناء وضع معاينة واجهة نقطة البيع.'
      });
      return { success: false, error: 'read_only_preview' };
    }
    const loan = depositRequests.find(d => d.id === loanId);
    if (!loan) {
      return { success: false, error: 'لم يتم العثور على السلفة المطلوبة.' };
    }

    const targetPos = posClients.find(p => p.id === loan.posId) || currentPos;
    const targetSupplier = suppliers.find(s => s.id === loan.supplierId) || supplier;
    const loanSupRate = normalizeExchangeRateSarPerUsd(targetSupplier?.exchangeRateSarPerUsd);

    const validation = validateWalletRepayment(loan, rawAmount, targetPos.walletBalance, activeCurrency, loanSupRate);
    if (!validation.valid) {
      showToast({
        type: 'error',
        title: validation.code === 'insufficient_balance' ? 'الرصيد غير كافٍ في المحفظة' : 'تعذر تنفيذ السداد',
        description: validation.error || 'تعذر إتمام السداد من المحفظة.'
      });
      return { success: false, error: validation.error };
    }

    const now = new Date();
    const formattedDate = now.toISOString().replace('T', ' ').substring(0, 16);
    const paymentId = `lpay-${Date.now().toString().slice(-6)}`;
    const paidBefore = getLoanPaidAmount(loan);
    const clientBalanceBefore = roundCurrency(targetPos.walletBalance);
    const supplierBalanceBefore = roundCurrency(targetSupplier.walletBalance);

    const paymentRecord: LoanPaymentRecord = {
      id: paymentId,
      amount: validation.amount,
      date: formattedDate,
      method: 'wallet',
      notes: `سداد مباشر من محفظة العميل (${targetPos.tradeName}) إلى حافظة المتجر (${targetSupplier.name})`
    };

    const { updatedLoan, appliedAmount, newPaidAmount, newRemainingAmount, newState } = applyLoanPaymentToLoan(
      loan,
      paymentRecord,
      targetSupplier.name
    );

    const newPosWalletBalance = roundCurrency(clientBalanceBefore - appliedAmount);
    const newSupplierWalletBalance = roundCurrency(supplierBalanceBefore + appliedAmount);

    const receipt = buildWalletLoanRepaymentReceipt({
      loan,
      paymentId,
      date: formattedDate,
      appliedAmount,
      paidBefore,
      paidAfter: newPaidAmount,
      remainingAfter: newRemainingAmount,
      newState,
      clientId: targetPos.id,
      clientName: targetPos.tradeName,
      clientPosCode: targetPos.posCode,
      clientBalanceBefore,
      supplierId: targetSupplier.id,
      supplierName: targetSupplier.name,
      supplierStoreName: targetSupplier.storeName,
      supplierBalanceBefore,
    });

    setPosClients(prev =>
      prev.map(p => (p.id === targetPos.id ? { ...p, walletBalance: newPosWalletBalance } : p))
    );
    setSuppliers(prev =>
      prev.map(s => (s.id === targetSupplier.id ? { ...s, walletBalance: newSupplierWalletBalance } : s))
    );
    setDepositRequests(prev => prev.map(d => (d.id === loanId ? updatedLoan : d)));

    firestoreSync.savePosClient({ ...targetPos, walletBalance: newPosWalletBalance }).catch(console.error);
    firestoreSync.saveSupplier({ ...targetSupplier, walletBalance: newSupplierWalletBalance }).catch(console.error);
    firestoreSync.saveDepositRequest(updatedLoan).catch(console.error);

    const isFull = newState === 'repaid';
    const accEntry: AccountingEntry = {
      id: `acc-${Date.now()}-lpay`,
      date: formattedDate,
      type: 'transfer_out',
      referenceId: loan.id,
      posId: targetPos.id,
      supplierId: targetSupplier.id,
      description: `سداد ${isFull ? 'كامل' : 'جزئي'} للسلفة #${loan.id} من محفظة العميل إلى حافظة المتجر (${targetSupplier.name}) بمبلغ ${appliedAmount.toFixed(2)} ر.س · المتبقي: ${newRemainingAmount.toFixed(2)} ر.س`,
      debit: appliedAmount,
      credit: 0,
      balanceAfter: newPosWalletBalance
    };
    setAccountingEntries(prev => [accEntry, ...prev]);
    firestoreSync.saveAccountingEntry(accEntry).catch(console.error);

    const admEntry: AdminAccountingEntry = {
      id: `adm-acc-${Date.now()}-lpay`,
      date: formattedDate,
      type: 'agent_transfer',
      referenceId: loan.id,
      supplierId: targetSupplier.id,
      supplierName: `${targetSupplier.name} (${targetSupplier.storeName})`,
      posId: targetPos.id,
      posCode: targetPos.posCode,
      posName: targetPos.tradeName,
      description: `سداد سلفة مباشر من المحفظة #${loan.id} بمبلغ ${appliedAmount.toFixed(2)} ر.س (${isFull ? 'مسددة بالكامل' : 'مسددة جزئياً'})`,
      grossAmount: appliedAmount,
      feeAmount: 0,
      debit: 0,
      credit: 0,
      balanceAfter: superAdmin.walletBalance
    };
    setAdminAccountingEntries(prev => [admEntry, ...prev]);
    firestoreSync.saveAdminAccountingEntry(admEntry).catch(console.error);

    if (isFull) {
      triggerConfetti();
    }

    const posLoanCurrency = normalizeCurrencyCode(targetPos.preferredCurrency);
    const supLoanCurrency = normalizeCurrencyCode(targetSupplier.preferredCurrency);
    addNotification({
      posId: targetPos.id,
      supplierId: targetSupplier.id,
      supplierName: targetSupplier.name,
      targetRole: 'pos',
      title: isFull ? 'تم سداد السلفة بالكامل من المحفظة' : 'تم سداد دفعة من السلفة من المحفظة',
      message: isFull
        ? `تم سداد مبلغ ${formatCurrencyAmount(appliedAmount, posLoanCurrency, loanSupRate)} وخصمه من محفظتك (${targetPos.tradeName}) وإضافته إلى محفظة المتجر ${targetSupplier.name}، وتم إغلاق السلفة #${loan.id} كمسددة بالكامل.`
        : `تم سداد مبلغ ${formatCurrencyAmount(appliedAmount, posLoanCurrency, loanSupRate)} وخصمه من محفظتك (${targetPos.tradeName}) وإضافته إلى محفظة المتجر ${targetSupplier.name}. رصيد محفظتك الجديد: ${formatCurrencyAmount(newPosWalletBalance, posLoanCurrency, loanSupRate)} · المتبقي من السلفة: ${formatCurrencyAmount(newRemainingAmount, posLoanCurrency, loanSupRate)}.`,
      type: 'transfer'
    });

    // Notify supplier of direct wallet repayment
    addNotification({
      supplierId: targetSupplier.id,
      supplierName: targetSupplier.name,
      posId: targetPos.id,
      posName: targetPos.tradeName,
      posCode: targetPos.posCode,
      targetRole: 'supplier',
      title: isFull ? 'سداد سلفة بالكامل من محفظة العميل 💰' : 'سداد دفعة سلفة من محفظة العميل 💰',
      message: `قام العميل ${targetPos.tradeName} (${targetPos.posCode}) بسداد ${formatCurrencyAmount(appliedAmount, supLoanCurrency, loanSupRate)} من رصيد محفظته عن السلفة #${loan.id}. أودع المبلغ في محفظتك المتاحة وأصبح المتبقي: ${formatCurrencyAmount(newRemainingAmount, supLoanCurrency, loanSupRate)}.`,
      type: 'loan_repayment',
      loanId: loan.id,
      amount: appliedAmount,
      actionTab: 'loans'
    });

    showToast({
      type: 'success',
      title: isFull ? 'تم سداد السلفة بالكامل بنجاح' : 'تم سداد الدفعة من السلفة بنجاح',
      description: `تم خصم ${formatCurrency(appliedAmount)} من محفظة العميل (${targetPos.tradeName}) وإضافتها إلى محفظة المتجر ${targetSupplier.name}. رصيدك الحالي: ${formatCurrency(newPosWalletBalance)} · المتبقي من السلفة: ${formatCurrency(newRemainingAmount)}.`
    });

    return { success: true, receipt };
  };

  const confirmLoanRepaymentReceiptByReceiver = (
    requestId: string,
    decision: 'confirmed' | 'rejected',
    note?: string
  ) => {
    if (isSupplierPosPreviewMode) {
      showToast({
        type: 'info',
        title: 'وضع الاطلاع فقط',
        description: 'لا يمكن مراجعة حوالات سداد السلف أثناء وضع معاينة واجهة نقطة البيع.'
      });
      return;
    }
    const req = loanRepaymentRequests.find(r => r.id === requestId);
    if (!req) return;

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const receiverName =
      role === 'employee' || role === 'supplier'
        ? (currentUser?.name || supplier.name || req.targetAccountHolderName || 'موظف استلام الحوالات')
        : (currentPos.tradeName || req.receiverPosName || req.targetAccountHolderName || 'نقطة البيع المخوّلة');
    const defaultNote =
      decision === 'confirmed'
        ? `تم تأكيد استلام حوالة سداد السلفة رقم (${req.transferNumber}) في الحساب البنكي (${req.targetBankName || req.bankName})`
        : `لم يتم استلام حوالة سداد السلفة رقم (${req.transferNumber}) في الحساب البنكي (${req.targetBankName || req.bankName})`;

    const updatedReq: LoanRepaymentRequest = {
      ...req,
      receiverConfirmationStatus: decision as ReceiverConfirmationStatus,
      receiverConfirmedAt: nowStr,
      receiverConfirmedByName: receiverName,
      receiverConfirmationNote: note?.trim() || defaultNote
    };

    setLoanRepaymentRequests(prev => prev.map(r => (r.id === requestId ? updatedReq : r)));
    firestoreSync.saveLoanRepaymentRequest(updatedReq).catch(console.error);

    const targetSup = suppliers.find(s => s.id === req.supplierId) || supplier;
    const targetRepayPos = posClients.find(p => p.id === req.posId);
    const repayPosCurrency = normalizeCurrencyCode(targetRepayPos?.preferredCurrency);
    const repaySupCurrency = normalizeCurrencyCode(targetSup.preferredCurrency);
    const repaySupRate = normalizeExchangeRateSarPerUsd(targetSup.exchangeRateSarPerUsd);
    const repayPosFormatted = formatCurrencyAmount(req.amount, repayPosCurrency, repaySupRate);
    const repaySupFormatted = formatCurrencyAmount(req.amount, repaySupCurrency, repaySupRate);

    addNotification({
      posId: req.posId,
      posName: req.posName,
      posCode: req.posCode,
      supplierId: targetSup.id,
      supplierName: receiverName,
      targetRole: 'pos',
      title:
        decision === 'confirmed'
          ? 'تم تأكيد استلام حوالة سداد السلفة من مستلم المتجر'
          : 'تنبيه: أفاد مستلم الحوالة بعدم استلام حوالة سداد السلفة',
      message:
        decision === 'confirmed'
          ? `أكدت نقطة البيع المخوّلة (${receiverName}) استلام حوالة سداد السلفة #${req.loanId} (مرجع: #${req.transferNumber}) بمبلغ ${repayPosFormatted}، وأصبح التأكيد ظاهراً لدى المتجر لاعتماد خصم السلفة.`
          : `أفادت نقطة البيع المخوّلة (${receiverName}) بعدم استلام حوالة سداد السلفة #${req.loanId} (مرجع: #${req.transferNumber}) بمبلغ ${repayPosFormatted}. السبب: ${updatedReq.receiverConfirmationNote}`,
      type: 'deposit'
    });

    // Notify the supplier directly
    addNotification({
      supplierId: targetSup.id,
      supplierName: receiverName,
      posId: req.posId,
      posName: req.posName,
      posCode: req.posCode,
      targetRole: 'supplier',
      title: decision === 'confirmed' ? 'تأكيد استلام حوالة سداد سلفة من المخوّل ✅' : 'تنبيه: عدم استلام حوالة سداد سلفة من المخوّل ❌',
      message:
        decision === 'confirmed'
          ? `أكدت نقطة البيع المخوّلة (${receiverName}) استلام حوالة سداد السلفة #${req.loanId} (مرجع: #${req.transferNumber}) بمبلغ ${repaySupFormatted} للعميل ${req.posName}.`
          : `أفادت نقطة البيع المخوّلة (${receiverName}) بعدم استلام حوالة سداد السلفة #${req.loanId} (مرجع: #${req.transferNumber}) بمبلغ ${repaySupFormatted} للعميل ${req.posName}. السبب: ${updatedReq.receiverConfirmationNote}`,
      type: 'receiver_confirmation',
      loanId: req.loanId,
      repaymentRequestId: req.id,
      amount: req.amount,
      actionTab: 'loans'
    });

    showToast({
      type: decision === 'confirmed' ? 'success' : 'error',
      title:
        decision === 'confirmed'
          ? 'تم تأكيد استلام حوالة السداد وإشعار المتجر'
          : 'تم تسجيل عدم استلام حوالة السداد وإشعار المتجر',
      description: `سيظهر ردك (${decision === 'confirmed' ? 'تم تأكيد الاستلام' : 'لم يتم الاستلام'}) فوراً للتاجر المتجر (${targetSup.name}) داخل سجل مراجعة سداد السلف.`
    });
  };

  const submitLoanRepaymentRequest = async (params: {
    loanId: string;
    amount: number;
    transferNumber: string;
    bankName: string;
    senderName: string;
    notes?: string;
    targetBankAccountId?: string;
    transferReceiptImage?: string;
    transferReceiptFileName?: string;
  }): Promise<{ success: boolean; requestId?: string; request?: LoanRepaymentRequest; error?: string }> => {
    if (isSupplierPosPreviewMode) {
      showToast({
        type: 'info',
        title: 'وضع الاطلاع فقط',
        description: 'لا يمكن إرسال طلبات سداد سلفة أثناء وضع معاينة واجهة نقطة البيع.'
      });
      return { success: false, error: 'read_only_preview' };
    }
    const loan = depositRequests.find(d => d.id === params.loanId);
    if (!loan) {
      return { success: false, error: 'لم يتم العثور على السلفة المحددة.' };
    }

    const targetSupForRate = suppliers.find(s => s.id === loan.supplierId) || supplier;
    const bankRepayRate = normalizeExchangeRateSarPerUsd(targetSupForRate?.exchangeRateSarPerUsd);
    const validation = validateBankTransferRepayment(loan, {
      ...params,
      currency: activeCurrency,
      exchangeRateSarPerUsd: bankRepayRate
    });
    if (!validation.valid) {
      showToast({
        type: 'error',
        title: 'بيانات طلب السداد غير مكتملة',
        description: validation.error || 'يرجى التحقق من البيانات المدخلة.'
      });
      return { success: false, error: validation.error };
    }

    const targetPos = posClients.find(p => p.id === loan.posId) || currentPos;
    const targetSupplier = suppliers.find(s => s.id === loan.supplierId) || supplier;
    const availableAccounts = getActiveBankAccountsForDeposit(supplierBankAccounts, targetSupplier);
    const selectedAccount = params.targetBankAccountId
      ? availableAccounts.find(a => a.id === params.targetBankAccountId) || availableAccounts[0]
      : availableAccounts[0];

    const resolvedReceiverPos =
      selectedAccount && selectedAccount.canReceiveSupplierTransfers
        ? resolveBankAccountReceiverPos(selectedAccount, posClients)
        : undefined;
    const resolvedReceiverEmployee =
      selectedAccount && selectedAccount.canReceiveSupplierTransfers
        ? resolveBankAccountReceiverEmployee(selectedAccount, targetSupplier.employees || [])
        : undefined;

    const isEmployeeDelegated = Boolean(
      selectedAccount?.canReceiveSupplierTransfers &&
        (selectedAccount.holderType === 'employee' || selectedAccount.delegatedEmployeeId || resolvedReceiverEmployee)
    );
    const isPosDelegated = Boolean(
      selectedAccount?.canReceiveSupplierTransfers && !isEmployeeDelegated && (resolvedReceiverPos || selectedAccount?.delegatedPosId)
    );
    const isDelegatedTransfer = isPosDelegated || isEmployeeDelegated;

    const paidBefore = getLoanPaidAmount(loan);
    const remainingBefore = getLoanRemainingAmount(loan);
    const now = new Date();
    const formattedDate = now.toISOString().replace('T', ' ').substring(0, 16);
    const requestId = `lrep-${Date.now().toString().slice(-6)}`;

    const newRequest: LoanRepaymentRequest = {
      id: requestId,
      loanId: loan.id,
      loanTransferNumber: loan.transferNumber,
      loanDate: loan.date,
      loanTotalAmount: loan.amount,
      loanPaidBefore: paidBefore,
      loanRemainingBefore: remainingBefore,
      loanReason: loan.loanReason,
      posId: targetPos.id,
      posName: targetPos.tradeName,
      posCode: targetPos.posCode,
      supplierId: targetSupplier.id,
      supplierName: targetSupplier.name,
      amount: validation.amount,
      transferNumber: params.transferNumber.trim(),
      bankName: params.bankName.trim() || selectedAccount?.bankName || targetSupplier.bankAccountDetails.bankName,
      senderName: params.senderName.trim(),
      notes: params.notes?.trim() || undefined,
      date: formattedDate,
      status: 'pending',
      transferReceiptImage: params.transferReceiptImage || undefined,
      transferReceiptFileName: params.transferReceiptFileName || undefined,
      targetBankAccountId: selectedAccount?.id,
      targetBankName: selectedAccount?.bankName,
      targetBankAccountNumber: selectedAccount?.accountNumber,
      targetIban: selectedAccount?.iban,
      targetBankAccountCountry: selectedAccount?.country,
      targetAccountHolderName: selectedAccount?.accountHolderName,
      targetAccountHolderEmail: selectedAccount?.accountHolderEmail,
      receiverPosId: isPosDelegated ? (resolvedReceiverPos?.id || selectedAccount?.delegatedPosId) : undefined,
      receiverPosName: isDelegatedTransfer
        ? (isEmployeeDelegated
            ? (resolvedReceiverEmployee?.name || selectedAccount?.accountHolderName)
            : (resolvedReceiverPos?.tradeName || selectedAccount?.delegatedPosName || selectedAccount?.accountHolderName))
        : undefined,
      receiverPosCode: isPosDelegated ? (resolvedReceiverPos?.posCode || selectedAccount?.delegatedPosCode) : undefined,
      receiverPosEmail: isDelegatedTransfer
        ? (isEmployeeDelegated
            ? (resolvedReceiverEmployee?.email || selectedAccount?.accountHolderEmail)
            : (resolvedReceiverPos?.email || selectedAccount?.accountHolderEmail))
        : undefined,
      receiverEmployeeId: isEmployeeDelegated ? (resolvedReceiverEmployee?.id || selectedAccount?.delegatedEmployeeId) : undefined,
      receiverConfirmationStatus: isDelegatedTransfer ? 'pending' : undefined
    };

    setLoanRepaymentRequests(prev => [newRequest, ...prev]);
    firestoreSync.saveLoanRepaymentRequest(newRequest).catch(console.error);

    const supLoanRate = normalizeExchangeRateSarPerUsd(targetSupplier.exchangeRateSarPerUsd);
    const posLoanCur = normalizeCurrencyCode(targetPos.preferredCurrency);
    const supLoanCur = normalizeCurrencyCode(targetSupplier.preferredCurrency);

    if (isDelegatedTransfer && newRequest.receiverPosId) {
      const receiverPosObj = posClients.find(p => p.id === newRequest.receiverPosId);
      const receiverCur = normalizeCurrencyCode(receiverPosObj?.preferredCurrency);
      addNotification({
        posId: newRequest.receiverPosId,
        supplierId: targetSupplier.id,
        supplierName: targetPos.tradeName,
        title: 'حوالة سداد سلفة بانتظار تأكيد الاستلام',
        message: `أرسل العميل (${targetPos.tradeName}) طلب سداد سلفة #${loan.id} بمبلغ ${formatCurrencyAmount(validation.amount, receiverCur, supLoanRate)} إلى حسابك المخوّل (${selectedAccount?.bankName}). يرجى مراجعة الإيصال وتأكيد الاستلام.`,
        type: 'deposit'
      });
    }

    addNotification({
      posId: targetPos.id,
      posName: targetPos.tradeName,
      posCode: targetPos.posCode,
      supplierId: targetSupplier.id,
      supplierName: targetSupplier.name,
      targetRole: 'pos',
      title: 'تم إرسال طلب سداد سلفة بحوالة بنكية',
      message: isDelegatedTransfer
        ? `تم إرسال طلب سداد رقم #${requestId} بقيمة ${formatCurrencyAmount(validation.amount, posLoanCur, supLoanRate)} للسلفة #${loan.id} إلى نقطة البيع المخوّلة (${newRequest.receiverPosName}) والمتجر ${targetSupplier.name} للمراجعة والاعتماد.`
        : `تم إرسال طلب سداد رقم #${requestId} بقيمة ${formatCurrencyAmount(validation.amount, posLoanCur, supLoanRate)} للسلفة #${loan.id} (حوالة: ${newRequest.transferNumber} · ${newRequest.bankName})، وهو بانتظار مراجعة وموافقة المتجر ${targetSupplier.name}.`,
      type: 'deposit'
    });

    // Notify supplier of loan repayment request
    addNotification({
      supplierId: targetSupplier.id,
      supplierName: targetSupplier.name,
      posId: targetPos.id,
      posName: targetPos.tradeName,
      posCode: targetPos.posCode,
      targetRole: 'supplier',
      title: 'طلب سداد سلفة بحوالة بنكية 💳',
      message: `أرسل العميل ${targetPos.tradeName} (${targetPos.posCode}) طلب سداد سلفة #${loan.id} بمبلغ ${formatCurrencyAmount(validation.amount, supLoanCur, supLoanRate)} (حوالة: ${newRequest.transferNumber} على ${newRequest.targetBankName || newRequest.bankName}) مع صورة الإيصال المرفقة.`,
      type: 'loan_repayment',
      loanId: loan.id,
      repaymentRequestId: requestId,
      amount: validation.amount,
      actionTab: 'loans'
    });

    showToast({
      type: 'success',
      title: isDelegatedTransfer
        ? 'تم إرسال طلب سداد السلفة للمتجر ونقطة البيع المخوّلة'
        : 'تم إرسال طلب سداد السلفة بنجاح',
      description: isDelegatedTransfer
        ? `تم توجيه الطلب إلى المتجر ${targetSupplier.name} وإلى المخوّل باستلام الحوالة (${newRequest.receiverPosName}) لمراجعة الإيصال وتأكيد الاستلام.`
        : `تم إرسال طلب سداد بمبلغ ${formatCurrency(validation.amount)} عن السلفة #${loan.id} (رقم الحوالة: ${newRequest.transferNumber}) وبانتظار موافقة المتجر ${targetSupplier.name}.`
    });

    return { success: true, requestId, request: newRequest };
  };

  const approveLoanRepaymentRequest = (requestId: string, overrideAmount?: number) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canReviewLoanDeposits, 'ليس لديك صلاحية اعتماد طلبات سداد السُّلَف.')) return;
    const req = loanRepaymentRequests.find(r => r.id === requestId);
    if (!req || req.status !== 'pending') return;

    const loan = depositRequests.find(d => d.id === req.loanId);
    if (!loan || loan.status !== 'approved') return;

    const remaining = getLoanRemainingAmount(loan);
    if (remaining <= 0) {
      showToast({
        type: 'info',
        title: 'السلفة مسددة بالفعل',
        description: 'تم سداد كامل قيمة هذه السلفة مسبقاً.'
      });
      return;
    }

    const requestedAmount = overrideAmount !== undefined ? roundCurrency(overrideAmount) : req.amount;
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) return;

    const now = new Date();
    const formattedDate = now.toISOString().replace('T', ' ').substring(0, 16);
    const targetSupplier = suppliers.find(s => s.id === loan.supplierId) || supplier;
    const targetPos = posClients.find(p => p.id === loan.posId);

    const paymentRecord: LoanPaymentRecord = {
      id: `lpay-${Date.now().toString().slice(-6)}`,
      amount: requestedAmount,
      date: formattedDate,
      method: 'bank_transfer',
      transferNumber: req.transferNumber,
      bankName: req.bankName,
      senderName: req.senderName,
      notes: req.notes || `موافقة المتجر على حوالة سداد سلفة رقم ${req.transferNumber}`,
      repaymentRequestId: req.id,
      approvedBy: targetSupplier.name,
      transferReceiptImage: req.transferReceiptImage,
      targetBankName: req.targetBankName
    };

    const { updatedLoan, appliedAmount, newRemainingAmount, newState } = applyLoanPaymentToLoan(
      loan,
      paymentRecord,
      targetSupplier.name
    );

    const updatedReq: LoanRepaymentRequest = {
      ...req,
      status: 'approved',
      reviewedAt: formattedDate,
      approvedAmount: appliedAmount
    };

    setDepositRequests(prev => prev.map(d => (d.id === loan.id ? updatedLoan : d)));
    setLoanRepaymentRequests(prev => prev.map(r => (r.id === req.id ? updatedReq : r)));

    firestoreSync.saveDepositRequest(updatedLoan).catch(console.error);
    firestoreSync.saveLoanRepaymentRequest(updatedReq).catch(console.error);

    const isFull = newState === 'repaid';
    const accEntry: AccountingEntry = {
      id: `acc-${Date.now()}-lrep`,
      date: formattedDate,
      type: 'deposit',
      referenceId: loan.id,
      posId: loan.posId,
      supplierId: targetSupplier.id,
      description: `اعتماد سداد سلفة #${loan.id} عبر حوالة بنكية (${req.transferNumber}) بمبلغ ${appliedAmount.toFixed(2)} ر.س (${isFull ? 'سداد كامل' : `سداد جزئي · المتبقي: ${newRemainingAmount.toFixed(2)} ر.س`})`,
      debit: 0,
      credit: 0,
      balanceAfter: targetPos?.walletBalance ?? 0
    };
    setAccountingEntries(prev => [accEntry, ...prev]);
    firestoreSync.saveAccountingEntry(accEntry).catch(console.error);

    const admEntry: AdminAccountingEntry = {
      id: `adm-acc-${Date.now()}-lrep`,
      date: formattedDate,
      type: 'deposit_received',
      referenceId: req.id,
      supplierId: targetSupplier.id,
      supplierName: `${targetSupplier.name} (${targetSupplier.storeName})`,
      posId: loan.posId,
      posCode: loan.posCode,
      posName: loan.posName,
      description: `موافقة المتجر على سداد سلفة #${loan.id} بحوالة بنكية ${req.transferNumber} بمبلغ ${appliedAmount.toFixed(2)} ر.س`,
      grossAmount: appliedAmount,
      feeAmount: 0,
      debit: 0,
      credit: 0,
      balanceAfter: superAdmin.walletBalance
    };
    setAdminAccountingEntries(prev => [admEntry, ...prev]);
    firestoreSync.saveAdminAccountingEntry(admEntry).catch(console.error);

    if (isFull) {
      triggerConfetti();
    }

    const clientAppRate = normalizeExchangeRateSarPerUsd(targetSupplier?.exchangeRateSarPerUsd);
    const clientAppCur = normalizeCurrencyCode(targetPos?.preferredCurrency);
    addNotification({
      posId: loan.posId,
      supplierId: targetSupplier.id,
      supplierName: targetSupplier.name,
      title: isFull ? 'تمت الموافقة وإتمام سداد السلفة بالكامل' : 'تمت الموافقة على سداد جزء من السلفة',
      message: isFull
        ? `راجع المتجر ${targetSupplier.name} الحوالة البنكية (${req.transferNumber}) بمبلغ ${formatCurrencyAmount(appliedAmount, clientAppCur, clientAppRate)}، وأصبحت السلفة #${loan.id} مسددة بالكامل.`
        : `راجع المتجر ${targetSupplier.name} الحوالة البنكية (${req.transferNumber}) وخصم ${formatCurrencyAmount(appliedAmount, clientAppCur, clientAppRate)} من السلفة #${loan.id}. المتبقي: ${formatCurrencyAmount(newRemainingAmount, clientAppCur, clientAppRate)}.`,
      type: 'deposit'
    });

    showToast({
      type: 'success',
      title: isFull ? 'تم اعتماد الحوالة وسداد السلفة بالكامل' : 'تم اعتماد الحوالة وخصم الدفعة الجزئية',
      description: `تم خصم ${formatCurrency(appliedAmount)} من السلفة #${loan.id} للعميل ${loan.posName}. المتبقي: ${formatCurrency(newRemainingAmount)}.`
    });
  };

  const rejectLoanRepaymentRequest = (requestId: string, reason?: string) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canReviewLoanDeposits, 'ليس لديك صلاحية رفض طلبات سداد السُّلَف.')) return;
    const req = loanRepaymentRequests.find(r => r.id === requestId);
    if (!req || req.status !== 'pending') return;

    const now = new Date();
    const formattedDate = now.toISOString().replace('T', ' ').substring(0, 16);
    const cleanReason = reason?.trim() || 'لم يتم مطابقة الحوالة البنكية في كشف الحساب';

    const updatedReq: LoanRepaymentRequest = {
      ...req,
      status: 'rejected',
      reviewedAt: formattedDate,
      rejectionReason: cleanReason
    };

    setLoanRepaymentRequests(prev => prev.map(r => (r.id === requestId ? updatedReq : r)));
    firestoreSync.saveLoanRepaymentRequest(updatedReq).catch(console.error);

    addNotification({
      posId: req.posId,
      supplierId: req.supplierId,
      supplierName: req.supplierName,
      title: 'تم رفض طلب سداد السلفة بالحوالة',
      message: `تم رفض طلب سداد السلفة #${req.loanId} (حوالة ${req.transferNumber}) من المتجر ${req.supplierName}. السبب: ${cleanReason}`,
      type: 'deposit'
    });

    showToast({
      type: 'error',
      title: 'تم رفض طلب سداد السلفة',
      description: cleanReason
    });
  };

  const rejectDepositRequest = (depositId: string, reason?: string) => {
    const dep = depositRequests.find(d => d.id === depositId);
    if (!dep) return;
    const isLoan = dep.requestType === 'loan' || Boolean(dep.loanReason);
    if (!assertEmployeePermission(
      isLoan ? effectiveEmployeePerms.canReviewLoanDeposits : effectiveEmployeePerms.canReviewCashDeposits,
      isLoan ? 'ليس لديك صلاحية رفض طلبات السُّلَف.' : 'ليس لديك صلاحية رفض طلبات الحوالات والإيداعات.'
    )) return;
    const updatedDep: DepositRequest = { ...dep, status: 'rejected', notes: reason || 'تم رفض الطلب لعدم مطابقة بيانات الحوالة' };
    setDepositRequests(prev => prev.map(d => d.id === depositId ? updatedDep : d));
    firestoreSync.saveDepositRequest(updatedDep).catch(console.error);
    addNotification({
      posId: dep.posId,
      supplierId: dep.supplierId,
      supplierName: supplier.name,
      title: dep.requestType === 'loan' ? 'رفض طلب السلفة' : 'رفض طلب الإيداع',
      message: reason || 'تم رفض طلب الإيداع/السلفة من المتجر لعدم مطابقة الشروط.',
      type: 'deposit'
    });
    showToast({
      type: 'error',
      title: 'تم رفض طلب الشحن',
      description: reason || 'تم رفض الطلب لعدم مطابقة الحوالة'
    });
  };

  // Supplier / المتجر completing an order that needed manual fulfillment via Game ID or Account Login
  // Fees & Supplier/Admin settlement occur ONLY here after fulfillment completes.
  const completeSupplierOrder = (orderId: string, notes?: string) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder || targetOrder.status === 'completed' || targetOrder.status === 'failed') return;
    if (!assertEmployeePermission(
      isOrderVisibleToEmployee(targetOrder, effectiveEmployeePerms, role),
      'ليس لديك صلاحية تنفيذ هذا النوع من الطلبات.'
    )) return;
    const isPlayerId = targetOrder.deliveryMethod === 'player_id';
    const defaultNote = isPlayerId
      ? `تم الشحن بنجاح من داخل اللعبة باستخدام الأيدي (${targetOrder?.deliveryDetails.playerId || ''})`
      : 'تم إتمام الشحن وتفعيل الخدمة بنجاح من المتجر';

    const nowFormatted = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const orderService = services.find(s => s.id === targetOrder.serviceId);
    const orderCatalog = orderService ? catalogs.find(c => c.id === orderService.catalogId) : undefined;
    const isGiftOrder = Boolean(targetOrder.isFreeGiftOrder || isCatalogFreeGifts(orderCatalog));
    const targetPos = posClients.find(p => p.id === targetOrder.posId);
    const orderSupplier = suppliers.find(s => s.id === targetOrder.supplierId) || supplier;

    let clientFeeCollectedNow = 0;
    let deferredAdded = 0;
    let nextPosWalletBalance = targetPos?.walletBalance ?? 0;
    let nextPendingGiftFees = targetPos?.pendingGiftFees ?? 0;
    let supplierFeeCollectedNow = 0;
    let supplierNetCredit = 0;
    const needsAdminSettlement = targetOrder.feeSettledToAdmin === false;

    if (needsAdminSettlement) {
      if (isGiftOrder) {
        const giftFeeRes = resolveGiftClaimFeePayment({
          isFreeGiftApplied: true,
          walletBalance: targetPos?.walletBalance ?? 0,
          feeAmount: targetOrder.feeAmount || 0,
          existingPendingFees: targetPos?.pendingGiftFees ?? 0,
        });
        clientFeeCollectedNow = giftFeeRes.walletDeductionNow;
        deferredAdded = giftFeeRes.deferredFeeAdded;
        nextPosWalletBalance = giftFeeRes.newWalletBalance;
        nextPendingGiftFees = giftFeeRes.newPendingGiftFees;
      } else if (targetOrder.paymentMethod === 'wallet') {
        const plannedFee = Math.max(0, targetOrder.feeAmount || 0);
        clientFeeCollectedNow = targetPos
          ? parseFloat(Math.min(Math.max(0, targetPos.walletBalance), plannedFee).toFixed(2))
          : plannedFee;
        nextPosWalletBalance = targetPos
          ? parseFloat((targetPos.walletBalance - clientFeeCollectedNow).toFixed(2))
          : 0;
      } else {
        clientFeeCollectedNow = Math.max(0, targetOrder.feeAmount || 0);
      }

      const supplierSaleRule = resolveSpecificServiceFeeRule({
        section: 'supplier',
        serviceKey: 'saleToClient',
        supplier: orderSupplier,
        superAdmin,
      });
      const resolvedSupFee = typeof targetOrder.supplierFeeAmount === 'number'
        ? targetOrder.supplierFeeAmount
        : (targetOrder.costPrice > 0 ? calculateFeeFromRule(targetOrder.costPrice, supplierSaleRule, { capAtAmount: true }) : 0);
      supplierFeeCollectedNow = Math.max(0, resolvedSupFee);
      supplierNetCredit = parseFloat(Math.max(0, (targetOrder.costPrice || 0) - supplierFeeCollectedNow).toFixed(2));
    }

    const updatedTotalDeducted = needsAdminSettlement
      ? parseFloat(((targetOrder.heldFromClientAtRequest ?? (isGiftOrder ? 0 : targetOrder.costPrice)) + clientFeeCollectedNow).toFixed(2))
      : targetOrder.totalDeducted;

    const updatedOrder: Order = {
      ...targetOrder,
      status: 'completed',
      supplierNotes: notes || defaultNote,
      completedAt: nowFormatted,
      feeSettledToAdmin: true,
      supplierFeeAmount: supplierFeeCollectedNow > 0 ? supplierFeeCollectedNow : targetOrder.supplierFeeAmount,
      totalDeducted: updatedTotalDeducted,
      deferredFeeAmount: deferredAdded > 0 ? deferredAdded : targetOrder.deferredFeeAmount,
      deferredFeeSettled: deferredAdded > 0 ? false : targetOrder.deferredFeeSettled,
      deliveryDetails: {
        ...targetOrder.deliveryDetails,
        inGameChargeStatus: 'completed_in_game'
      }
    };

    setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
    firestoreSync.saveOrder(updatedOrder).catch(console.error);

    if (targetPos) {
      const nextUsedGifts = isGiftOrder
        ? appendUsedGiftServiceId(targetPos.usedGiftServiceIds, targetOrder.serviceId)
        : targetPos.usedGiftServiceIds;
      const nextTotalSpent = needsAdminSettlement
        ? parseFloat((targetPos.totalSpent + (targetOrder.costPrice || 0)).toFixed(2))
        : targetPos.totalSpent;

      const updatedPos: POSClient = {
        ...targetPos,
        walletBalance: needsAdminSettlement ? nextPosWalletBalance : targetPos.walletBalance,
        pendingGiftFees: needsAdminSettlement ? nextPendingGiftFees : targetPos.pendingGiftFees,
        totalSpent: nextTotalSpent,
        usedGiftServiceIds: nextUsedGifts,
      };
      setPosClients(prev => prev.map(p => (p.id === targetPos.id ? updatedPos : p)));
      firestoreSync.savePosClient(updatedPos).catch(console.error);
    }

    if (needsAdminSettlement) {
      if (supplierNetCredit > 0) {
        const nextSupBalance = parseFloat((orderSupplier.walletBalance + supplierNetCredit).toFixed(2));
        setSuppliers(prev => prev.map(s => (s.id === orderSupplier.id ? { ...s, walletBalance: nextSupBalance } : s)));
        firestoreSync.saveSupplier({ ...orderSupplier, walletBalance: nextSupBalance }).catch(console.error);
      }

      const clientEntriesToAdd: AccountingEntry[] = [];
      if (clientFeeCollectedNow > 0 && (targetOrder.paymentMethod === 'wallet' || isGiftOrder)) {
        const feeEntry: AccountingEntry = {
          id: `acc-${Date.now()}-cmp-fee`,
          date: nowFormatted,
          type: 'fee',
          referenceId: targetOrder.id,
          posId: targetOrder.posId,
          supplierId: orderSupplier.id,
          description: `رسوم منصة على إتمام الطلب #${targetOrder.id} (${targetOrder.serviceName})`,
          debit: clientFeeCollectedNow,
          credit: 0,
          balanceAfter: nextPosWalletBalance,
          serviceName: targetOrder.serviceName,
          customerName: targetOrder.customerName || 'عميل مباشر',
        };
        clientEntriesToAdd.push(feeEntry);
      }
      if (targetOrder.salePriceToCustomer && targetOrder.salePriceToCustomer > targetOrder.costPrice) {
        clientEntriesToAdd.push({
          id: `acc-${Date.now()}-cmp-sale`,
          date: nowFormatted,
          type: 'sale',
          referenceId: targetOrder.id,
          posId: targetOrder.posId,
          supplierId: orderSupplier.id,
          description: `بيع للزبون (${targetOrder.customerName || 'مباشر'}) بقيمة ${targetOrder.salePriceToCustomer.toFixed(2)} ر.س`,
          debit: 0,
          credit: targetOrder.salePriceToCustomer,
          balanceAfter: nextPosWalletBalance,
          serviceName: targetOrder.serviceName,
          customerName: targetOrder.customerName || 'عميل مباشر',
        });
      }
      if (clientEntriesToAdd.length > 0) {
        setAccountingEntries(prev => [...clientEntriesToAdd, ...prev]);
        for (const ce of clientEntriesToAdd) {
          firestoreSync.saveAccountingEntry(ce).catch(console.error);
        }
      }

      const totalAdminFeeNow = parseFloat((clientFeeCollectedNow + supplierFeeCollectedNow).toFixed(2));
      if (totalAdminFeeNow > 0) {
        let runningAdminBal = superAdmin.walletBalance;
        const nextAdminEntries: AdminAccountingEntry[] = [];

        if (clientFeeCollectedNow > 0) {
          runningAdminBal = parseFloat((runningAdminBal + clientFeeCollectedNow).toFixed(2));
          nextAdminEntries.push({
            id: `adm-acc-${Date.now()}-cmp-cfee`,
            date: nowFormatted,
            type: 'fee_collected',
            referenceId: targetOrder.id,
            supplierId: orderSupplier.id,
            supplierName: `${orderSupplier.name} (${orderSupplier.storeName})`,
            serviceId: targetOrder.serviceId,
            serviceName: targetOrder.serviceName,
            posId: targetOrder.posId,
            posCode: targetOrder.posCode,
            posName: targetOrder.posName,
            description: `تحصيل رسوم خدمة شراء خدمة من العميل (${clientFeeCollectedNow.toFixed(2)} ر.س) بعد اكتمال الشحن: ${targetOrder.serviceName}`,
            grossAmount: targetOrder.costPrice,
            feeAmount: clientFeeCollectedNow,
            debit: 0,
            credit: clientFeeCollectedNow,
            balanceAfter: runningAdminBal,
            notes: `تم الخصم من العميل (${targetOrder.posName}) وإيداع الرسوم لمحفظة الإدارة بعد اكتمال الخدمة`
          });
        }

        if (supplierFeeCollectedNow > 0) {
          runningAdminBal = parseFloat((runningAdminBal + supplierFeeCollectedNow).toFixed(2));
          nextAdminEntries.push({
            id: `adm-acc-${Date.now()}-cmp-sfee`,
            date: nowFormatted,
            type: 'fee_collected',
            referenceId: targetOrder.id,
            supplierId: orderSupplier.id,
            supplierName: `${orderSupplier.name} (${orderSupplier.storeName})`,
            serviceId: targetOrder.serviceId,
            serviceName: targetOrder.serviceName,
            posId: targetOrder.posId,
            posCode: targetOrder.posCode,
            posName: targetOrder.posName,
            description: `تحصيل رسوم خدمة بيع للعميل على المورد (${supplierFeeCollectedNow.toFixed(2)} ر.س) بعد اكتمال الشحن: ${targetOrder.serviceName}`,
            grossAmount: targetOrder.costPrice,
            feeAmount: supplierFeeCollectedNow,
            debit: 0,
            credit: supplierFeeCollectedNow,
            balanceAfter: runningAdminBal,
            notes: `تم الخصم من استحقاق المورد (${orderSupplier.storeName}) بعد اكتمال الشحن`
          });
        }

        setAdminAccountingEntries(prev => [...nextAdminEntries, ...prev]);
        setSuperAdmin(prev => ({
          ...prev,
          walletBalance: parseFloat((prev.walletBalance + totalAdminFeeNow).toFixed(2)),
        }));
        firestoreSync.saveSuperAdmin({
          ...superAdmin,
          walletBalance: parseFloat((superAdmin.walletBalance + totalAdminFeeNow).toFixed(2)),
        }).catch(console.error);
        for (const ae of nextAdminEntries) {
          firestoreSync.saveAdminAccountingEntry(ae).catch(console.error);
        }
      }
    }

    triggerConfetti();
    addNotification({
      posId: targetOrder.posId,
      supplierId: orderSupplier.id,
      supplierName: orderSupplier.name,
      title: 'مكتمل: تم تنفيذ طلبك',
      message: `تم إتمام تنفيذ الطلب #${targetOrder.id} (${targetOrder.serviceName}) بنجاح.`,
      type: 'order_status',
      orderId: targetOrder.id
    });
    showToast({
      type: 'success',
      title: isPlayerId ? 'تم إتمام الشحن من اللعبة بنجاح!' : 'تم إتمام تنفيذ طلب الخدمة',
      description: isPlayerId
        ? `تم شحن الأيدي (${targetOrder?.deliveryDetails.playerId}) مباشرة من اللعبة وإشعار العميل باكتمال العملية.`
        : `تم شحن الطلب #${orderId} وإشعار نقطة البيع باكتمال العملية.`
    });
  };

  const rejectSupplierOrder = (orderId: string, reason?: string) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder || targetOrder.status === 'failed' || targetOrder.status === 'completed') return;
    if (!assertEmployeePermission(
      isOrderVisibleToEmployee(targetOrder, effectiveEmployeePerms, role),
      'ليس لديك صلاحية إلغاء هذا النوع من الطلبات.'
    )) return;

    // If order used completion-only settlement (feeSettledToAdmin === false), no fee was deducted and nothing reached SuperAdmin/Supplier.
    // Refund ONLY heldFromClientAtRequest (or legacy totalDeducted for pre-existing orders).
    const refundAmount = targetOrder.feeSettledToAdmin === false
      ? (targetOrder.heldFromClientAtRequest ?? (targetOrder.isFreeGiftOrder ? 0 : targetOrder.costPrice) ?? 0)
      : (targetOrder.totalDeducted || 0);
    const cancelDeferredFee =
      targetOrder.deferredFeeAmount && !targetOrder.deferredFeeSettled
        ? targetOrder.deferredFeeAmount
        : 0;

    setPosClients(prev => prev.map(p => {
      if (p.id !== targetOrder.posId) return p;
      const nextPending = cancelDeferredFee > 0
        ? Math.max(0, parseFloat(((p.pendingGiftFees || 0) - cancelDeferredFee).toFixed(2)))
        : p.pendingGiftFees;
      return {
        ...p,
        walletBalance: parseFloat((p.walletBalance + refundAmount).toFixed(2)),
        pendingGiftFees: nextPending,
      };
    }));

    const clientToRefund = posClients.find(p => p.id === targetOrder.posId);
    if (clientToRefund) {
      const nextPending = cancelDeferredFee > 0
        ? Math.max(0, parseFloat(((clientToRefund.pendingGiftFees || 0) - cancelDeferredFee).toFixed(2)))
        : clientToRefund.pendingGiftFees;
      firestoreSync.savePosClient({
        ...clientToRefund,
        walletBalance: parseFloat((clientToRefund.walletBalance + refundAmount).toFixed(2)),
        pendingGiftFees: nextPending,
      }).catch(console.error);
    }

    const updatedOrder: Order = {
      ...targetOrder,
      status: 'failed',
      supplierNotes: reason || 'تم إلغاء الطلب واسترداد الرصيد لنقطة البيع'
    };
    setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
    firestoreSync.saveOrder(updatedOrder).catch(console.error);

    const refundClientCurrency = normalizeCurrencyCode(clientToRefund?.preferredCurrency);
    addNotification({
      posId: targetOrder.posId,
      supplierId: supplier.id,
      supplierName: supplier.name,
      title: 'إلغاء طلب وإعادة الرصيد',
      message: targetOrder.isFreeGiftOrder
        ? `تم إلغاء الطلب #${targetOrder.id}. السبب: ${reason || 'تعذر التنفيذ'}`
        : `تم إلغاء الطلب #${targetOrder.id} واسترداد ${formatCurrencyAmount(refundAmount, refundClientCurrency, activeExchangeRate)} إلى محفظتك. السبب: ${reason || 'تعذر التنفيذ'}`,
      type: 'order_status',
      orderId: targetOrder.id
    });

    showToast({
      type: 'error',
      title: 'تم إلغاء الطلب وإعادة الرصيد',
      description: targetOrder.isFreeGiftOrder
        ? `تم إلغاء الطلب #${targetOrder.id}.`
        : `تم إلغاء الطلب واسترداد ${formatCurrency(refundAmount)} لمحفظة العميل.`
    });
  };

  // Supplier sending OTP / reply message directly to the client
  const sendSupplierReplyToClient = (orderId: string, message: string) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (targetOrder && !assertEmployeePermission(
      isOrderVisibleToEmployee(targetOrder, effectiveEmployeePerms, role),
      'ليس لديك صلاحية إرسال رمز لهذا النوع من الطلبات.'
    )) return;

    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return {
        ...o,
        supplierNotes: message,
        deliveryDetails: {
          ...o.deliveryDetails,
          supplierReplyMessage: message,
          verificationCodeEntered: message
        }
      };
    }));

    if (targetOrder) {
      firestoreSync.saveOrder({
        ...targetOrder,
        deliveryDetails: {
          ...targetOrder.deliveryDetails,
          supplierReplyMessage: message,
          verificationCodeEntered: message
        }
      }).catch(console.error);
      addNotification({
        posId: targetOrder.posId,
        supplierId: supplier.id,
        supplierName: supplier.name,
        targetRole: 'pos',
        title: 'رسالة جديدة من المتجر',
        message: `أرسل المتجر تنبيهاً/رمزاً للطلب #${orderId}: "${message}"`,
        type: 'order_status',
        orderId: targetOrder.id
      });
    }

    try {
      const replyPayload = {
        orderId,
        posId: targetOrder?.posId || '',
        message,
        timestamp: Date.now()
      };
      localStorage.setItem('digipos_live_supplier_reply', JSON.stringify(replyPayload));
      window.dispatchEvent(new CustomEvent('digipos_supplier_reply', {
        detail: replyPayload
      }));
    } catch {
      // ignore
    }

    showToast({
      type: 'success',
      title: 'تم إرسال الرمز للعميل فوراً!',
      description: `تم إرسال الرمز "${message}" وسيظهر في شاشة العميل ونقطة البيع مباشرة.`
    });
  };

  const confirmClientOtpRead = (orderId: string) => {
    if (isSupplierPosPreviewMode) return;
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return;

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const updatedOrder: Order = {
      ...targetOrder,
      deliveryDetails: {
        ...targetOrder.deliveryDetails,
        clientOtpReadConfirmation: true,
        clientOtpReadAt: nowStr
      }
    };

    setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
    firestoreSync.saveOrder(updatedOrder).catch(console.error);

    showToast({
      type: 'success',
      title: 'تأكيد قراءة الرمز',
      description: `تم إشعار المتجر بأن العميل قام بقراءة رمز التحقق للطلب #${orderId}.`
    });
  };

  // Update POS client tier
  const updatePosTier = (posId: string, newTier: AccountTier) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canUpgradeClientTiers, 'ليس لديك صلاحية ترقية أو تعديل رتب العملاء.')) return;
    setPosClients(prev => prev.map(p => {
      if (p.id !== posId) return p;
      const updated = { ...p, tier: newTier };
      firestoreSync.savePosClient(updated).catch(console.error);
      return updated;
    }));
    addNotification({
      posId: posId,
      supplierId: supplier.id,
      supplierName: supplier.name,
      title: 'تحديث رتبة الحساب',
      message: `تمت ترقية/تعديل رتبة حسابك إلى (${newTier}). تمتع بالأسعار والخصومات الجديدة!`,
      type: 'tier_upgrade'
    });
    showToast({
      type: 'success',
      title: 'تم تعديل رتبة نقطة البيع',
      description: `تمت ترقية/تعديل الرتبة إلى (${newTier}) بنجاح وتطبيق تسعيرات الرتبة فوراً.`
    });
  };

  const togglePosLoanPrivilege = (posId: string) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canUpgradeClientTiers, 'ليس لديك صلاحية تعديل ميزات العملاء.')) return;
    let newGrantedState = false;
    setPosClients(prev => prev.map(p => {
      if (p.id !== posId) return p;
      newGrantedState = !p.canRequestLoans;
      const updated = { ...p, canRequestLoans: newGrantedState };
      firestoreSync.savePosClient(updated).catch(console.error);
      return updated;
    }));

    addNotification({
      posId: posId,
      supplierId: supplier.id,
      supplierName: supplier.name,
      title: newGrantedState ? 'تفعيل ميزة طلب السلف والرصيد الآجل' : 'إلغاء ميزة طلب السلف',
      message: newGrantedState
        ? 'منحك المتجر صلاحية إرسال طلبات السلف والرصيد الآجل. يمكنك الآن طلب السلف من نافذة شحن الرصيد.'
        : 'قام المتجر بإلغاء صلاحية طلب السلف والرصيد الآجل لحسابك.',
      type: 'tier_upgrade'
    });

    showToast({
      type: newGrantedState ? 'success' : 'info',
      title: newGrantedState ? 'تم منح ميزة طلب السلفة بنجاح' : 'تم إلغاء ميزة طلب السلفة',
      description: newGrantedState
        ? 'أصبح بإمكان نقطة البيع إرسال طلبات السلف والرصيد الآجل للمتجر.'
        : 'تم سحب ميزة طلب السلف من نقطة البيع.'
    });
  };

  const togglePosReceiveTransfersPrivilege = (posId: string) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canUpgradeClientTiers, 'ليس لديك صلاحية تعديل ميزات العملاء.')) return;
    let newGrantedState = false;
    setPosClients(prev => prev.map(p => {
      if (p.id !== posId) return p;
      newGrantedState = !p.canReceiveSupplierTransfers;
      const updated = { ...p, canReceiveSupplierTransfers: newGrantedState };
      firestoreSync.savePosClient(updated).catch(console.error);
      return updated;
    }));

    addNotification({
      posId: posId,
      supplierId: supplier.id,
      supplierName: supplier.name,
      title: newGrantedState ? 'تفعيل ميزة استلام حوالات المتجر' : 'إلغاء ميزة استلام حوالات المتجر',
      message: newGrantedState
        ? 'منحك المتجر صلاحية استلام ومراجعة حوالات المتجر البنكية وتأكيدها.'
        : 'قام المتجر بإلغاء صلاحية استلام حوالات المتجر لحسابك.',
      type: 'tier_upgrade'
    });

    showToast({
      type: newGrantedState ? 'success' : 'info',
      title: newGrantedState ? 'تم تفعيل ميزة استلام الحوالات بنجاح' : 'تم إلغاء ميزة استلام الحوالات',
      description: newGrantedState
        ? 'أصبح العميل مؤهلاً لاستلام ومراجعة حوالات المتجر البنكية.'
        : 'تم سحب ميزة استلام الحوالات من العميل.'
    });
  };

  const togglePosBonusPrivilege = (posId: string) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canUpgradeClientTiers, 'ليس لديك صلاحية تعديل ميزات العملاء.')) return;
    let newGrantedState = false;
    setPosClients(prev => prev.map(p => {
      if (p.id !== posId) return p;
      newGrantedState = !p.canGetBonus;
      const updated = { ...p, canGetBonus: newGrantedState };
      firestoreSync.savePosClient(updated).catch(console.error);
      return updated;
    }));

    addNotification({
      posId: posId,
      supplierId: supplier.id,
      supplierName: supplier.name,
      title: newGrantedState ? 'تفعيل ميزة الحصول على بونص' : 'إلغاء ميزة الحصول على بونص',
      message: newGrantedState
        ? 'منحك المتجر ميزة الحصول على بونص وعلاوات رصيد إضافية!'
        : 'قام المتجر بإلغاء ميزة الحصول على بونص لحسابك.',
      type: 'tier_upgrade'
    });

    showToast({
      type: newGrantedState ? 'success' : 'info',
      title: newGrantedState ? 'تم تفعيل ميزة البونص بنجاح' : 'تم إلغاء ميزة البونص',
      description: newGrantedState
        ? 'أصبح العميل مؤهلاً للحصول على بونص ومكافآت.'
        : 'تم سحب ميزة البونص من العميل.'
    });
  };

  const togglePosGiftsPrivilege = (posId: string) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canUpgradeClientTiers, 'ليس لديك صلاحية تعديل ميزات العملاء.')) return;
    let newGrantedState = false;
    setPosClients(prev => prev.map(p => {
      if (p.id !== posId) return p;
      newGrantedState = !p.canViewGifts;
      const updated = { ...p, canViewGifts: newGrantedState };
      firestoreSync.savePosClient(updated).catch(console.error);
      return updated;
    }));

    addNotification({
      posId: posId,
      supplierId: supplier.id,
      supplierName: supplier.name,
      title: newGrantedState ? 'تفعيل ميزة الهدايا والعروض المجانية' : 'إلغاء ميزة الهدايا والعروض المجانية',
      message: newGrantedState
        ? 'منحك المتجر ميزة ظهور الهدايا والعروض المجانية الحصرية!'
        : 'قام المتجر بإلغاء ميزة الهدايا والعروض المجانية لحسابك.',
      type: 'tier_upgrade'
    });

    showToast({
      type: newGrantedState ? 'success' : 'info',
      title: newGrantedState ? 'تم تفعيل ميزة الهدايا والعروض المجانية بنجاح' : 'تم إلغاء ميزة الهدايا',
      description: newGrantedState
        ? 'أصبح بإمكان العميل تصفح واستلام الهدايا والعروض المجانية.'
        : 'تم سحب ميزة الهدايا والعروض المجانية من العميل.'
    });
  };

  const togglePosAccreditedPrivilege = (posId: string) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canUpgradeClientTiers, 'ليس لديك صلاحية اعتماد أو تعديل ميزات العملاء.')) return;
    const targetClient = posClientsRef.current.find(p => p.id === posId);
    if (!targetClient) return;

    if (role !== 'super_admin' && targetClient.supplierId !== supplier.id) {
      showToast({
        type: 'error',
        title: 'صلاحية مرفوضة',
        description: 'لا يمكنك تعديل حالة اعتماد عميل لا ينتمي لهذا المتجر.'
      });
      return;
    }

    const currentStatus = getPosUpgradeStatus(targetClient);
    const storeDisplayName = supplier.storeName || supplier.name;
    const nowIso = new Date().toISOString();

    let updatedClient: POSClient;
    let notifTitle = '';
    let notifMessage = '';
    let toastTitle = '';
    let toastDescription = '';
    let toastType: 'success' | 'info' = 'info';

    if (currentStatus === 'pending_client_approval') {
      // Cancel pending upgrade invite
      updatedClient = {
        ...targetClient,
        isAccreditedPos: false,
        posUpgradeStatus: 'none',
        accreditedAt: '',
        accreditedByName: '',
        posUpgradeRespondedAt: '',
      };
      notifTitle = 'تم إلغاء طلب الترقية إلى نقطة بيع معتمدة';
      notifMessage = `قام متجر (${storeDisplayName}) بإلغاء طلب الترقية المعلق لحسابك إلى نقطة بيع معتمدة.`;
      toastTitle = 'تم إلغاء طلب الترقية المعلق';
      toastDescription = `تم إلغاء طلب اعتماد العميل (${updatedClient.tradeName}) كنقطة بيع للمتجر قبل موافقته.`;
    } else if (hasClientApprovedPosUpgrade(targetClient)) {
      // Revoke active accredited POS status
      updatedClient = {
        ...targetClient,
        isAccreditedPos: false,
        posUpgradeStatus: 'none',
        accreditedAt: '',
        accreditedByName: '',
        posUpgradeRespondedAt: '',
      };
      if (inspectedPosId === posId) {
        setInspectedPosId(null);
      }
      notifTitle = 'إلغاء اعتماد نقطة البيع للمتجر';
      notifMessage = `قام متجر (${storeDisplayName}) بإلغاء شارة الاعتماد كنقطة بيع رسمية لحسابك.`;
      toastTitle = 'تم إلغاء اعتماد نقطة البيع';
      toastDescription = `تم إلغاء شارة الاعتماد كنقطة بيع من العميل (${updatedClient.tradeName}) وإيقاف معاينة واجهته.`;
    } else {
      // Send a fresh upgrade invitation requiring explicit client consent
      updatedClient = {
        ...targetClient,
        isAccreditedPos: false,
        posUpgradeStatus: 'pending_client_approval',
        posUpgradeRequestedAt: nowIso,
        posUpgradeRespondedAt: '',
        accreditedAt: '',
        accreditedByName: currentUser?.name || storeDisplayName,
      };
      toastType = 'success';
      notifTitle = 'دعوة ترقية حسابك إلى نقطة بيع معتمدة للمتجر';
      notifMessage = `رشّحك متجر (${storeDisplayName}) للترقية واعتماد حسابك رسمياً كنقطة بيع للمتجر. يرجى فتح لوحتك والموافقة على الترقية لإصدار شهادة الاعتماد وتمكين المتجر من الاطلاع على واجهة نقطة البيع الخاصة بك.`;
      toastTitle = 'تم إرسال طلب الترقية للعميل';
      toastDescription = `تم إرسال دعوة الاعتماد للعميل (${updatedClient.tradeName})؛ وبمجرد موافقته سيتم تفعيل الشهادة وزر الاطلاع على واجهة نقطة البيع.`;
    }

    const nextClients = posClientsRef.current.map(p => (p.id === posId ? updatedClient : p));
    posClientsRef.current = nextClients;
    setPosClients(nextClients);
    firestoreSync.savePosClient(updatedClient).catch(console.error);

    addNotification({
      posId,
      supplierId: targetClient.supplierId || supplier.id,
      supplierName: storeDisplayName,
      targetRole: 'pos',
      title: notifTitle,
      message: notifMessage,
      type: 'tier_upgrade'
    });

    showToast({
      type: toastType,
      title: toastTitle,
      description: toastDescription
    });
  };

  const respondToPosUpgrade = (decision: 'approved' | 'declined') => {
    if (isSupplierPosPreviewMode) {
      showToast({
        type: 'info',
        title: 'وضع الاطلاع فقط',
        description: 'لا يمكن تغيير حالة الموافقة على الترقية أثناء وضع المعاينة.'
      });
      return;
    }
    if (!isAuthenticated || role !== 'pos_client' || !currentPos?.id) {
      return;
    }

    const targetClient = posClientsRef.current.find(p => p.id === currentPos.id) || currentPos;
    const status = getPosUpgradeStatus(targetClient);
    if (status !== 'pending_client_approval') {
      return;
    }

    const nowIso = new Date().toISOString();
    const targetSup = suppliers.find(s => s.id === targetClient.supplierId) || currentPosSupplier || supplier;
    const storeDisplayName = targetSup?.storeName || targetSup?.name || 'المتجر';

    const updatedClient: POSClient =
      decision === 'approved'
        ? {
            ...targetClient,
            isAccreditedPos: true,
            posUpgradeStatus: 'approved',
            posUpgradeRespondedAt: nowIso,
            accreditedAt: nowIso,
            accreditedByName: targetClient.accreditedByName || storeDisplayName,
          }
        : {
            ...targetClient,
            isAccreditedPos: false,
            posUpgradeStatus: 'declined',
            posUpgradeRespondedAt: nowIso,
            accreditedAt: '',
          };

    const nextClients = posClientsRef.current.map(p => (p.id === targetClient.id ? updatedClient : p));
    posClientsRef.current = nextClients;
    setPosClients(nextClients);
    firestoreSync.savePosClient(updatedClient).catch(console.error);

    addNotification({
      posId: targetClient.id,
      posName: targetClient.tradeName,
      posCode: targetClient.posCode,
      supplierId: targetClient.supplierId || targetSup?.id,
      supplierName: storeDisplayName,
      targetRole: 'supplier',
      title:
        decision === 'approved'
          ? 'وافق العميل على الترقية إلى نقطة بيع معتمدة ✓'
          : 'رفض العميل الترقية إلى نقطة بيع معتمدة',
      message:
        decision === 'approved'
          ? `وافق العميل (${targetClient.tradeName} - ${targetClient.posCode}) على الترقية رسمياً كنقطة بيع معتمدة لمتجرك، وأصبح بإمكانك الآن الاطلاع على واجهة نقطة البيع الخاصة به من إدارة العملاء.`
          : `رفض العميل (${targetClient.tradeName} - ${targetClient.posCode}) طلب الترقية إلى نقطة بيع معتمدة.`,
      type: 'tier_upgrade',
      actionTab: 'clients',
    });

    if (decision === 'approved') {
      triggerConfetti();
      showToast({
        type: 'success',
        title: 'تمت الموافقة على الترقية واعتماد نقطة البيع!',
        description: `أصبح حسابك (${targetClient.tradeName}) نقطة بيع معتمدة لدى (${storeDisplayName}) ويمكنك الآن عرض وتحميل شهادة الاعتماد.`
      });
    } else {
      showToast({
        type: 'info',
        title: 'تم تسجيل رفض طلب الترقية',
        description: `تم إشعار المتجر (${storeDisplayName}) برفضك طلب الترقية إلى نقطة بيع معتمدة.`
      });
    }
  };

  const openSupplierPosPreview = (posId: string): boolean => {
    const candidate = posClientsRef.current.find(p => p.id === posId);
    const allowed = canSupplierInspectPosInterface({
      client: candidate,
      supplierId: supplier?.id || '',
      role,
      canViewClients: effectiveEmployeePerms.canViewClients,
      canUpgradeClientTiers: effectiveEmployeePerms.canUpgradeClientTiers,
    });

    if (!allowed || !candidate) {
      const status = getPosUpgradeStatus(candidate);
      const reason = !candidate
        ? 'لم يتم العثور على سجل العميل المطلوب.'
        : candidate.supplierId !== supplier?.id && role !== 'super_admin'
        ? 'هذا العميل لا ينتمي لمتجرك.'
        : status === 'pending_client_approval'
        ? 'بانتظار موافقة العميل الصريحة على الترقية إلى نقطة بيع قبل إتاحة الاطلاع على واجهته.'
        : status === 'declined'
        ? 'رفض العميل الترقية إلى نقطة بيع معتمدة ولا يمكن الاطلاع على واجهته.'
        : 'يجب ترقية العميل واعتماده كنقطة بيع وموافقته أولاً للاطلاع على واجهة نقطة البيع.';

      showToast({
        type: 'error',
        title: 'يتعذر فتح واجهة نقطة البيع',
        description: reason
      });
      return false;
    }

    setInspectedPosId(candidate.id);
    setActiveNavTab('store');
    return true;
  };

  const closeSupplierPosPreview = () => {
    setInspectedPosId(null);
    setActiveNavTab('store');
  };

  const togglePosClientActiveStatus = (posId: string) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canUpgradeClientTiers, 'ليس لديك صلاحية تفعيل أو إيقاف حسابات العملاء.')) return;
    const targetClient = posClientsRef.current.find(p => p.id === posId);
    if (!targetClient) return;

    if (role !== 'super_admin' && targetClient.supplierId !== supplier.id) {
      showToast({
        type: 'error',
        title: 'صلاحية مرفوضة',
        description: 'لا يمكنك تعديل حالة تفعيل عميل لا ينتمي لهذا المتجر.'
      });
      return;
    }

    const nextActive = !isPosClientActive(targetClient);
    const updatedClient: POSClient = { ...targetClient, isActive: nextActive };
    const nextClients = posClientsRef.current.map(p => (p.id === posId ? updatedClient : p));
    posClientsRef.current = nextClients;
    setPosClients(nextClients);
    firestoreSync.savePosClient(updatedClient).catch(console.error);

    addNotification({
      posId,
      supplierId: targetClient.supplierId || supplier.id,
      supplierName: supplier.name,
      title: nextActive ? 'تم إعادة تفعيل حسابك لدى المتجر' : 'تم إيقاف تفعيل حسابك مؤقتاً',
      message: nextActive
        ? 'قام المتجر بإعادة تفعيل حسابك ويمكنك الآن تسجيل الدخول وإجراء الطلبات بشكل طبيعي.'
        : 'قام المتجر بإيقاف تفعيل حسابك مؤقتاً. يرجى التواصل مع مالك المتجر لإعادة التفعيل.',
      type: 'tier_upgrade'
    });

    showToast({
      type: nextActive ? 'success' : 'info',
      title: nextActive ? 'تم تفعيل حساب العميل بنجاح' : 'تم إيقاف تفعيل حساب العميل',
      description: nextActive
        ? `أصبح حساب العميل (${updatedClient.tradeName}) نشطاً ويمكنه تسجيل الدخول والشراء الآن.`
        : `تم إيقاف تفعيل حساب العميل (${updatedClient.tradeName}) ولن يتمكن من الدخول أو الشراء لدى المتجر حتى إعادة التفعيل.`
    });
  };

  const deletePosClient = async (posId: string): Promise<{ success: boolean; error?: string }> => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canUpgradeClientTiers, 'ليس لديك صلاحية حذف حسابات العملاء.')) {
      return { success: false, error: 'ليس لديك صلاحية حذف حسابات العملاء.' };
    }
    const targetClient = posClientsRef.current.find(p => p.id === posId);
    if (!targetClient) {
      return { success: false, error: 'لم يتم العثور على حساب العميل المطلوب.' };
    }
    if (role !== 'super_admin' && targetClient.supplierId !== supplier.id) {
      showToast({
        type: 'error',
        title: 'صلاحية مرفوضة',
        description: 'لا يمكنك حذف عميل لا ينتمي لهذا المتجر.'
      });
      return { success: false, error: 'لا يمكنك حذف عميل لا ينتمي لهذا المتجر.' };
    }

    const remainingClients = posClientsRef.current.filter(p => p.id !== posId);
    posClientsRef.current = remainingClients;
    setPosClients(remainingClients);

    // Clear any store bank transfer delegations pointing to the deleted POS client
    const affectedAccounts = supplierBankAccountsRef.current.filter(acc => acc.delegatedPosId === posId);
    if (affectedAccounts.length > 0) {
      const nextAccounts = supplierBankAccountsRef.current.map(acc => {
        if (acc.delegatedPosId !== posId) return acc;
        const updatedAcc: SupplierBankAccount = {
          ...acc,
          delegatedPosId: undefined,
          canReceiveSupplierTransfers: false,
          holderType: acc.delegatedEmployeeId ? 'employee' : 'supplier',
        };
        firestoreSync.saveSupplierBankAccount(updatedAcc).catch(console.error);
        return updatedAcc;
      });
      supplierBankAccountsRef.current = nextAccounts;
      setSupplierBankAccounts(nextAccounts);
    }

    const cleanEmail = normalizeStoreEmail(targetClient.email);
    const hasRemainingPosWithEmail = Boolean(
      cleanEmail && remainingClients.some(p => normalizeStoreEmail(p.email) === cleanEmail)
    );
    const hasStoreOrAdminWithEmail = Boolean(
      cleanEmail &&
        (normalizeStoreEmail(superAdminRef.current.email) === cleanEmail ||
          MASTER_ADMIN_EMAILS.some(e => normalizeStoreEmail(e) === cleanEmail) ||
          (superAdminRef.current.adminAccounts || []).some(a => normalizeStoreEmail(a.email) === cleanEmail) ||
          suppliersRef.current.some(
            s =>
              normalizeStoreEmail(s.email) === cleanEmail ||
              (s.employees || []).some(emp => normalizeStoreEmail(emp.email) === cleanEmail)
          ))
    );
    const keepEmailUserDocs = hasRemainingPosWithEmail || hasStoreOrAdminWithEmail;

    try {
      await firestoreSync.deletePosClientAccountFromFirestore(posId, targetClient.email, keepEmailUserDocs);
      showToast({
        type: 'success',
        title: 'تم حذف حساب العميل نهائياً',
        description: `تم حذف حساب العميل (${targetClient.tradeName} - ${targetClient.posCode}) وإزالة صلاحية دخوله مع الإبقاء على السجلات المالية التاريخية للمتجر.`
      });
      return { success: true };
    } catch (err) {
      console.error('Failed to delete POS client from Firestore:', err);
      showToast({
        type: 'info',
        title: 'تم حذف العميل محلياً',
        description: `تمت إزالة العميل (${targetClient.tradeName}) محلياً، وتعذر حذف سجله من الخادم حالياً.`
      });
      return { success: true };
    }
  };

  // Update POS client profile details (logo, tradeName, ownerName, email, phone, servicePhone, country, city)
  const updatePosProfile = (posId: string, updates: Partial<POSClient>) => {
    if (isSupplierPosPreviewMode) {
      showToast({
        type: 'info',
        title: 'وضع الاطلاع فقط',
        description: 'لا يمكن تعديل بيانات نقطة البيع أثناء وضع معاينة الواجهة.'
      });
      return;
    }
    const targetClient = posClients.find(p => p.id === posId) || currentPos;
    const targetSup = suppliers.find(s => s.id === targetClient.supplierId) || supplier;
    const updatedClient = { ...targetClient, ...updates };

    setPosClients(prev => prev.map(p => {
      if (p.id !== posId) return p;
      return updatedClient;
    }));

    firestoreSync.savePosClient(updatedClient).catch(console.error);

    if (currentUser && currentUser.associatedId === posId) {
      const updatedAuthUser: AuthUser = {
        ...currentUser,
        name: updates.ownerName || currentUser.name,
        email: updates.email || currentUser.email,
        phone: updates.phone || currentUser.phone
      };
      setCurrentUser(updatedAuthUser);
      firestoreSync.saveUser(updatedAuthUser).catch(console.error);
    }

    showToast({
      type: 'success',
      title: 'تم تحديث البيانات وحفظها في القواعد الثلاث',
      description: 'تم الحفظ والمزامنة في قاعدة بيانات العميل، وقاعدة بيانات المتجر، وقاعدة بيانات مدير التطبيق.'
    });
  };

  const updateSupplierProfile = (supplierId: string, updates: Partial<Supplier>) => {
    if (!assertEmployeePermission(false, 'تعديل بيانات المتجر وإعدادات الحساب محصور لمالك المتجر فقط.')) return;
    const targetSup = suppliers.find(s => s.id === supplierId) || supplier;
    const normalizedUpdates: Partial<Supplier> = {
      ...updates,
      ...(updates.socialLinks !== undefined
        ? { socialLinks: sanitizeSupplierSocialLinks(updates.socialLinks) }
        : {})
    };
    const updatedSup = { ...targetSup, ...normalizedUpdates };

    setSuppliers(prev => prev.map(s => {
      if (s.id !== supplierId) return s;
      return updatedSup;
    }));

    firestoreSync.saveSupplier(updatedSup).catch(console.error);

    if (currentUser && currentUser.associatedId === supplierId) {
      const updatedAuthUser: AuthUser = {
        ...currentUser,
        name: updates.name || currentUser.name,
        email: updates.email || currentUser.email,
        phone: updates.phone || currentUser.phone
      };
      setCurrentUser(updatedAuthUser);
      firestoreSync.saveUser(updatedAuthUser).catch(console.error);
    }

    showToast({
      type: 'success',
      title: 'تم تحديث بيانات المتجر بنجاح',
      description: 'تم الحفظ والمزامنة في قاعدة بيانات المتجر وقاعدة البيانات المركزية.'
    });
  };

  // Create invite link with pre-assigned tier and features
  const createInviteLink = (
    params: { targetTier: AccountTier; features?: InviteLinkFeatures; label?: string } | AccountTier
  ): InviteLink => {
    const targetTier: AccountTier = typeof params === 'string' ? params : params.targetTier;
    const normalizedFeatures = normalizeInviteFeatures(
      typeof params === 'string' ? undefined : params.features
    );
    const cleanLabel = typeof params === 'string' ? undefined : params.label?.trim() || undefined;

    const rawPrefix =
      (supplier.name || supplier.storeName || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() ||
      'POS';
    const code = `${rawPrefix}-${targetTier.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://digipos.app';
    const newLink: InviteLink = {
      id: `inv-${Date.now()}`,
      code,
      supplierId: supplier.id,
      supplierName: supplier.storeName || supplier.name,
      targetTier,
      features: normalizedFeatures,
      isActive: true,
      ...(cleanLabel ? { label: cleanLabel } : {}),
      createdAt: new Date().toISOString().substring(0, 10),
      usedCount: 0,
      url: buildInviteUrl({ origin: appOrigin, code, supplierId: supplier.id })
    };
    if (!assertEmployeePermission(effectiveEmployeePerms.canUpgradeClientTiers, 'ليس لديك صلاحية إنشاء روابط دعوة العملاء.')) {
      return newLink;
    }
    const nextInvites = [newLink, ...inviteLinksRef.current];
    inviteLinksRef.current = nextInvites;
    setInviteLinks(nextInvites);
    firestoreSync.saveInviteLink(newLink).catch(console.error);

    const enabledFeaturesCount = getEnabledInviteFeatureLabels(normalizedFeatures).length;
    const tierName = TIERS_CONFIG[targetTier]?.nameAr || targetTier;
    showToast({
      type: 'success',
      title: 'تم إنشاء رابط الدعوة بنجاح',
      description:
        enabledFeaturesCount > 0
          ? `الرابط جاهز برتبة (${tierName}) مع (${enabledFeaturesCount}) ميزات مفعّلة تلقائياً للعميل عند التسجيل.`
          : `الرابط جاهز برتبة (${tierName}) محددة مسبقاً للعميل عند التسجيل.`
    });
    return newLink;
  };

  const toggleInviteLinkActiveStatus = (inviteId: string) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canUpgradeClientTiers, 'ليس لديك صلاحية إدارة روابط الدعوة.')) return;
    const target = inviteLinksRef.current.find(l => l.id === inviteId);
    if (!target) return;

    if (role !== 'super_admin' && target.supplierId !== supplier.id) {
      showToast({
        type: 'error',
        title: 'صلاحية مرفوضة',
        description: 'لا يمكنك تعديل رابط دعوة لا ينتمي لهذا المتجر.'
      });
      return;
    }

    const nextActive = !isInviteLinkActive(target);
    const updatedLink: InviteLink = { ...target, isActive: nextActive };
    const nextInvites = inviteLinksRef.current.map(l => (l.id === inviteId ? updatedLink : l));
    inviteLinksRef.current = nextInvites;
    setInviteLinks(nextInvites);
    firestoreSync.saveInviteLink(updatedLink).catch(console.error);

    showToast({
      type: nextActive ? 'success' : 'info',
      title: nextActive ? 'تم تفعيل رابط الدعوة' : 'تم إيقاف رابط الدعوة',
      description: nextActive
        ? `الرابط (${updatedLink.code}) نشط الآن ويقبل تسجيلات العملاء الجدد.`
        : `تم تعطيل الرابط (${updatedLink.code}) ولن يقبل أي تسجيلات جديدة حتى إعادة تفعيله.`
    });
  };

  const deleteInviteLink = async (inviteId: string): Promise<{ success: boolean; error?: string }> => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canUpgradeClientTiers, 'ليس لديك صلاحية حذف روابط الدعوة.')) {
      return { success: false, error: 'ليس لديك صلاحية حذف روابط الدعوة.' };
    }
    const target = inviteLinksRef.current.find(l => l.id === inviteId);
    if (!target) {
      return { success: false, error: 'رابط الدعوة غير موجود.' };
    }
    if (role !== 'super_admin' && target.supplierId !== supplier.id) {
      showToast({
        type: 'error',
        title: 'صلاحية مرفوضة',
        description: 'لا يمكنك حذف رابط دعوة لا ينتمي لهذا المتجر.'
      });
      return { success: false, error: 'لا يمكنك حذف رابط دعوة لا ينتمي لهذا المتجر.' };
    }

    const remaining = inviteLinksRef.current.filter(l => l.id !== inviteId);
    inviteLinksRef.current = remaining;
    setInviteLinks(remaining);

    try {
      await firestoreSync.deleteInviteLink(inviteId);
    } catch (err) {
      console.warn('Failed to delete invite link from Firestore:', err);
    }

    showToast({
      type: 'info',
      title: 'تم حذف رابط الدعوة',
      description: `تم حذف رابط الدعوة (${target.code}) بنجاح.`
    });
    return { success: true };
  };

  // Add catalog
  const addCatalog = (nameAr: string, descriptionAr: string, icon: string, isFreeGiftsCatalog?: boolean) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canAddCatalogs, 'ليس لديك صلاحية إضافة الكتالوجات.')) return;
    if (role !== 'super_admin' && !platformSettings.allowSuppliersCreateCustomCatalogs) {
      showToast({
        type: 'error',
        title: 'إجراء غير متاح',
        description: 'إضافة كتالوجات مخصصة معطّلة حالياً من إعدادات مدير التطبيق.'
      });
      return;
    }
    const newCat: Catalog = {
      id: `cat-${Date.now()}`,
      supplierId: supplier.id,
      nameAr,
      descriptionAr,
      icon,
      serviceCount: 0,
      isFreeGiftsCatalog: Boolean(isFreeGiftsCatalog)
    };
    setCatalogs(prev => [...prev, newCat]);
    firestoreSync.saveCatalog(newCat).catch(console.error);
    showToast({
      type: 'success',
      title: 'تمت إضافة الكتالوج',
      description: `تم إنشاء كتالوج "${nameAr}" بنجاح.`
    });
  };

  // Update catalog
  const updateCatalog = (id: string, updates: Partial<Pick<Catalog, 'nameAr' | 'descriptionAr' | 'icon' | 'isFreeGiftsCatalog'>>) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canAddCatalogs, 'ليس لديك صلاحية تعديل الكتالوجات.')) return;
    const targetCat = catalogs.find(c => c.id === id);
    if (targetCat && (targetCat.isFixedByAdmin || targetCat.supplierId === 'all') && role !== 'super_admin') {
      showToast({
        type: 'error',
        title: 'كتالوج ثابت من الإدارة',
        description: 'هذا الكتالوج ثابت من مدير التطبيق ولا يمكن تعديله من حساب المتجر.'
      });
      return;
    }
    setCatalogs(prev => prev.map(c => {
      if (c.id === id) {
        const updated = { ...c, ...updates };
        firestoreSync.saveCatalog(updated).catch(console.error);
        return updated;
      }
      return c;
    }));
    showToast({
      type: 'success',
      title: 'تم تحديث الكتالوج',
      description: 'تم حفظ تعديلات بيانات الكتالوج بنجاح.'
    });
  };

  // Delete catalog
  const deleteCatalog = (id: string): { success: boolean; error?: string } => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canAddCatalogs, 'ليس لديك صلاحية حذف الكتالوجات.')) {
      return { success: false, error: 'صلاحية غير ممنوحة' };
    }
    const targetCat = catalogs.find(c => c.id === id);
    if (targetCat && (targetCat.isFixedByAdmin || targetCat.supplierId === 'all') && role !== 'super_admin') {
      showToast({
        type: 'error',
        title: 'كتالوج ثابت من الإدارة',
        description: 'هذا الكتالوج ثابت من مدير التطبيق ولا يمكن حذفه من حساب المتجر.'
      });
      return { success: false, error: 'كتالوج ثابت من الإدارة' };
    }
    const linkedServices = services.filter(s => s.catalogId === id);
    if (linkedServices.length > 0) {
      showToast({
        type: 'error',
        title: 'تعذر حذف الكتالوج',
        description: `الكتالوج يحتوي على ${linkedServices.length} خدمة مرتبطة. قم بنقلها لكتالوج آخر أو حذفها أولاً.`
      });
      return { success: false, error: 'يحتوي على خدمات مرتبطة' };
    }
    setCatalogs(prev => prev.filter(c => c.id !== id));
    firestoreSync.deleteCatalog(id).catch(console.error);
    showToast({
      type: 'success',
      title: 'تم حذف الكتالوج',
      description: 'تم حذف الكتالوج الفارغ بنجاح.'
    });
    return { success: true };
  };

  // Platform Interface Settings, Fixed Catalogs & Dynamic Dropdowns (Super Admin)
  const updatePlatformInterfaceSettings = (updates: Partial<PlatformInterfaceSettings>) => {
    const nextSettings: PlatformInterfaceSettings = mergePlatformSettings({
      ...platformSettings,
      ...updates,
      updatedAt: new Date().toISOString()
    });
    setPlatformSettings(nextSettings);
    firestoreSync.savePlatformSettings(nextSettings).catch(console.error);
    showToast({
      type: 'success',
      title: 'تم حفظ إعدادات الواجهات',
      description: 'تم تطبيق الإعدادات وتحديث واجهات المتاجر ونقاط البيع والعملاء بنجاح.'
    });
  };

  const addFixedCatalogByAdmin = (input: {
    nameAr: string;
    descriptionAr: string;
    icon: string;
    isFreeGiftsCatalog?: boolean;
  }) => {
    const cleanName = input.nameAr.trim();
    if (!cleanName) return;
    const newFixedCat: Catalog = {
      id: `cat-fixed-${Date.now()}`,
      supplierId: 'all',
      nameAr: cleanName,
      descriptionAr: input.descriptionAr.trim() || 'كتالوج ثابت معتمد من مدير التطبيق لجميع المتاجر',
      icon: input.icon || 'Layers',
      serviceCount: 0,
      isFreeGiftsCatalog: Boolean(input.isFreeGiftsCatalog),
      isFixedByAdmin: true
    };
    setCatalogs(prev => [newFixedCat, ...prev]);
    firestoreSync.saveCatalog(newFixedCat).catch(console.error);
    showToast({
      type: 'success',
      title: 'تمت إضافة الكتالوج الثابت',
      description: `سيظهر الكتالوج "${cleanName}" لجميع المتاجر بشكل ثابت وغير قابل للتعديل.`
    });
  };

  const updateFixedCatalogByAdmin = (
    id: string,
    updates: Partial<Pick<Catalog, 'nameAr' | 'descriptionAr' | 'icon' | 'isFreeGiftsCatalog'>>
  ) => {
    setCatalogs(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated: Catalog = {
        ...c,
        ...updates,
        isFixedByAdmin: true,
        supplierId: 'all'
      };
      firestoreSync.saveCatalog(updated).catch(console.error);
      return updated;
    }));
    showToast({
      type: 'success',
      title: 'تم تحديث الكتالوج الثابت',
      description: 'تم حفظ تعديلات مدير التطبيق على الكتالوج الثابت وتعميمها لجميع المتاجر.'
    });
  };

  const deleteFixedCatalogByAdmin = (id: string): { success: boolean; error?: string } => {
    const linkedServices = services.filter(s => s.catalogId === id);
    if (linkedServices.length > 0) {
      showToast({
        type: 'error',
        title: 'تعذر حذف الكتالوج الثابت',
        description: `الكتالوج مرتبط بـ ${linkedServices.length} خدمة. يرجى نقل أو حذف الخدمات المرتبطة أولاً.`
      });
      return { success: false, error: 'يحتوي على خدمات مرتبطة' };
    }
    setCatalogs(prev => prev.filter(c => c.id !== id));
    firestoreSync.deleteCatalog(id).catch(console.error);
    showToast({
      type: 'success',
      title: 'تم حذف الكتالوج الثابت',
      description: 'تم حذف الكتالوج الثابت من النظام.'
    });
    return { success: true };
  };

  const addDropdownOption = (
    listKey: PlatformDropdownListKey,
    input: { labelAr: string; value?: string }
  ): { success: boolean; error?: string } => {
    const cleanLabel = input.labelAr.trim();
    if (!cleanLabel) {
      return { success: false, error: 'يرجى كتابة اسم العنصر بالعربية' };
    }
    const existingList = platformSettings[listKey] || [];
    const normalizedVal = normalizeDropdownValue(cleanLabel, input.value);

    if (
      existingList.some(
        item =>
          item.labelAr.trim().toLowerCase() === cleanLabel.toLowerCase() ||
          item.value.trim().toLowerCase() === normalizedVal.toLowerCase()
      )
    ) {
      showToast({
        type: 'error',
        title: 'عنصر مكرر',
        description: 'هذا الخيار موجود مسبقاً في القائمة المنسدلة.'
      });
      return { success: false, error: 'هذا الخيار موجود مسبقاً' };
    }

    const newItem: DropdownOptionItem = {
      id: `${listKey}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      value: normalizedVal,
      labelAr: cleanLabel,
      isSystem: false,
      isActive: true
    };
    const nextSettings: PlatformInterfaceSettings = {
      ...platformSettings,
      [listKey]: [...existingList, newItem],
      updatedAt: new Date().toISOString()
    };
    setPlatformSettings(nextSettings);
    firestoreSync.savePlatformSettings(nextSettings).catch(console.error);
    showToast({
      type: 'success',
      title: 'تم تحديث القائمة المنسدلة',
      description: `تمت إضافة "${cleanLabel}" وتحديث القوائم تلقائياً.`
    });
    return { success: true };
  };

  const updateDropdownOption = (
    listKey: PlatformDropdownListKey,
    optionId: string,
    updates: Partial<Pick<DropdownOptionItem, 'labelAr' | 'value' | 'isActive'>>
  ) => {
    const existingList = platformSettings[listKey] || [];
    const nextList = existingList.map(opt =>
      opt.id === optionId ? { ...opt, ...updates } : opt
    );
    const nextSettings: PlatformInterfaceSettings = {
      ...platformSettings,
      [listKey]: nextList,
      updatedAt: new Date().toISOString()
    };
    setPlatformSettings(nextSettings);
    firestoreSync.savePlatformSettings(nextSettings).catch(console.error);
  };

  const deleteDropdownOption = (listKey: PlatformDropdownListKey, optionId: string) => {
    const existingList = platformSettings[listKey] || [];
    const target = existingList.find(opt => opt.id === optionId);
    if (target?.isSystem) {
      // System items are deactivated instead of permanently deleted
      updateDropdownOption(listKey, optionId, { isActive: !target.isActive });
      return;
    }
    const nextSettings: PlatformInterfaceSettings = {
      ...platformSettings,
      [listKey]: existingList.filter(opt => opt.id !== optionId),
      updatedAt: new Date().toISOString()
    };
    setPlatformSettings(nextSettings);
    firestoreSync.savePlatformSettings(nextSettings).catch(console.error);
    showToast({
      type: 'success',
      title: 'تم حذف العنصر',
      description: 'تم حذف العنصر من القائمة المنسدلة.'
    });
  };

  // Add service
  const addService = (serviceData: Omit<DigitalService, 'id' | 'supplierId' | 'isActive'>) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canAddServices, 'ليس لديك صلاحية إضافة الخدمات والباقات.')) return;
    const newSrv: DigitalService = {
      ...serviceData,
      id: `srv-${Date.now()}`,
      supplierId: supplier.id,
      isActive: true
    };
    setServices(prev => [...prev, newSrv]);
    firestoreSync.saveService(newSrv).catch(console.error);
    setCatalogs(prev => prev.map(c => c.id === serviceData.catalogId ? { ...c, serviceCount: (c.serviceCount || 0) + 1 } : c));
    showToast({
      type: 'success',
      title: 'تمت إضافة الخدمة',
      description: `تمت إضافة خدمة "${serviceData.nameAr}" وتسعيراتها لجميع الرتب بنجاح.`
    });
  };

  // Update service
  const updateService = (id: string, updates: Partial<Omit<DigitalService, 'id' | 'supplierId'>>) => {
    if (!assertEmployeePermission(
      effectiveEmployeePerms.canAddServices || effectiveEmployeePerms.canEditServicePrices,
      'ليس لديك صلاحية تعديل الخدمات أو أسعارها.'
    )) return;
    setServices(prev => {
      let oldCatalogId = '';
      let nextCatalogId = '';
      const updatedList = prev.map(s => {
        if (s.id === id) {
          if (role !== 'super_admin' && s.supplierId && s.supplierId !== supplier.id) {
            return s;
          }
          oldCatalogId = s.catalogId;
          const safeUpdates = sanitizeServiceUpdatesForEmployeePermissions(
            s,
            updates,
            effectiveEmployeePerms,
            role
          );
          const updated = { ...s, ...safeUpdates };
          nextCatalogId = updated.catalogId;
          firestoreSync.saveService(updated).catch(console.error);
          return updated;
        }
        return s;
      });

      // Recalculate catalog counts if catalog changed
      if (nextCatalogId && nextCatalogId !== oldCatalogId) {
        setCatalogs(catList => catList.map(cat => ({
          ...cat,
          serviceCount: updatedList.filter(srv => srv.catalogId === cat.id).length
        })));
      }

      return updatedList;
    });

    showToast({
      type: 'success',
      title: 'تم تحديث الخدمة',
      description: 'تم حفظ تعديلات الخدمة والباقات والتسعير الطبقي بنجاح.'
    });
  };

  // Delete service
  const deleteService = (id: string) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canAddServices, 'ليس لديك صلاحية حذف الخدمات.')) return;
    const targetService = services.find(s => s.id === id);
    setServices(prev => prev.filter(s => s.id !== id));
    firestoreSync.deleteService(id).catch(console.error);
    if (targetService) {
      setCatalogs(prev => prev.map(c => 
        c.id === targetService.catalogId 
          ? { ...c, serviceCount: Math.max(0, (c.serviceCount || 1) - 1) } 
          : c
      ));
    }
    showToast({
      type: 'success',
      title: 'تم حذف الخدمة',
      description: 'تم حذف الخدمة بنجاح.'
    });
  };

  // --- Voucher Warehouses Management (مخازن الأكواد حسب الفئة) ---
  const publishWarehouseInternal = (
    wh: VoucherWarehouse,
    options: { catalogId: string; serviceId?: string; serviceNameAr?: string }
  ): VoucherWarehouse => {
    const targetCatalogId = options.catalogId || wh.catalogId || catalogs[0]?.id || 'cat-cards';
    const existingTargetService = options.serviceId
      ? services.find(s => s.id === options.serviceId)
      : wh.linkedServiceId
      ? services.find(s => s.id === wh.linkedServiceId)
      : undefined;

    if (existingTargetService) {
      const updatedSrv = syncWarehouseIntoService(
        { ...existingTargetService, catalogId: targetCatalogId, isActive: true },
        wh
      );
      const linkedPkg = updatedSrv.packages.find(
        p => p.warehouseId === wh.id || p.id === wh.linkedPackageId
      );
      const updatedWh: VoucherWarehouse = {
        ...wh,
        catalogId: targetCatalogId,
        linkedServiceId: updatedSrv.id,
        linkedPackageId: linkedPkg?.id || wh.linkedPackageId || `pkg-${wh.id}`,
        isPublishedAsService: true,
        updatedAt: new Date().toISOString()
      };
      setServices(prev => prev.map(s => (s.id === updatedSrv.id ? updatedSrv : s)));
      firestoreSync.saveService(updatedSrv).catch(console.error);
      setVoucherWarehouses(prev => prev.map(w => (w.id === updatedWh.id ? updatedWh : w)));
      firestoreSync.saveVoucherWarehouse(updatedWh).catch(console.error);
      return updatedWh;
    }

    // Create a new DigitalService for this warehouse / category
    const newSrvId = `srv-wh-${Date.now()}`;
    const newPkgId = `pkg-${wh.id}`;
    const allowPackage = Boolean(wh.allowPackagePurchase);
    const allowSingle =
      wh.allowSingleCodePurchase === false && allowPackage
        ? false
        : wh.allowSingleCodePurchase !== false;
    const newSrv: DigitalService = {
      id: newSrvId,
      catalogId: targetCatalogId,
      supplierId: supplier.id,
      nameAr: options.serviceNameAr?.trim() || wh.categoryName || wh.nameAr,
      descriptionAr: wh.description || `خدمة أكواد وقسائم رقمية فورية - فئة ${wh.categoryName}`,
      icon: 'Ticket',
      deliveryMethods: ['voucher_code'],
      isActive: true,
      packages: [
        {
          id: newPkgId,
          name: wh.nameAr,
          description: wh.description || `فئة ${wh.categoryName}`,
          deliveryMethod: 'voucher_code',
          tierPrices: { ...wh.tierPrices },
          packageTierPrices: wh.packageTierPrices ? { ...wh.packageTierPrices } : undefined,
          allowSingleCodePurchase: allowSingle,
          allowPackagePurchase: allowPackage,
          packageCodesCount: wh.packageCodesCount,
          packageNameAr: wh.packageNameAr,
          vouchers: [...wh.codes],
          availableStock: wh.codes.length,
          warehouseId: wh.id
        }
      ]
    };

    const updatedWh: VoucherWarehouse = {
      ...wh,
      catalogId: targetCatalogId,
      linkedServiceId: newSrvId,
      linkedPackageId: newPkgId,
      isPublishedAsService: true,
      updatedAt: new Date().toISOString()
    };

    setServices(prev => [...prev, newSrv]);
    firestoreSync.saveService(newSrv).catch(console.error);
    setCatalogs(prev =>
      prev.map(c =>
        c.id === targetCatalogId ? { ...c, serviceCount: (c.serviceCount || 0) + 1 } : c
      )
    );
    setVoucherWarehouses(prev => prev.map(w => (w.id === updatedWh.id ? updatedWh : w)));
    firestoreSync.saveVoucherWarehouse(updatedWh).catch(console.error);
    return updatedWh;
  };

  const createVoucherWarehouse = (input: {
    nameAr: string;
    categoryName: string;
    catalogId?: string;
    description?: string;
    rawCodes?: string;
    allowSingleCodePurchase?: boolean;
    allowPackagePurchase?: boolean;
    packageCodesCount?: number;
    packageNameAr?: string;
    tierPrices: TierPrices;
    packageTierPrices?: TierPrices;
    lowStockThreshold?: number;
    publishImmediately?: boolean;
    targetServiceId?: string;
    newServiceNameAr?: string;
  }) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canManageVoucherStock, 'ليس لديك صلاحية إنشاء وإدارة مخزون الأكواد.')) {
      return {
        warehouse: {
          id: '',
          supplierId: supplier.id,
          nameAr: '',
          categoryName: '',
          codes: [],
          usedCodesCount: 0,
          isPublishedAsService: false,
          tierPrices: input.tierPrices,
          createdAt: '',
          updatedAt: ''
        },
        addedCount: 0
      };
    }
    const parsed = parseVoucherCodesInput(input.rawCodes || '');
    const nowIso = new Date().toISOString();
    const whId = `wh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const allowPackage = Boolean(input.allowPackagePurchase);
    const allowSingle =
      input.allowSingleCodePurchase === false && allowPackage
        ? false
        : input.allowSingleCodePurchase !== false;
    const normalizedPkgCount =
      allowPackage
        ? Math.max(1, Math.floor(Number(input.packageCodesCount) || 5))
        : undefined;

    const threshold =
      typeof input.lowStockThreshold === 'number' && !Number.isNaN(input.lowStockThreshold)
        ? Math.max(0, Math.floor(input.lowStockThreshold))
        : 5;

    let warehouse: VoucherWarehouse = {
      id: whId,
      supplierId: supplier.id,
      nameAr: input.nameAr.trim(),
      categoryName: input.categoryName.trim(),
      catalogId: input.catalogId,
      description: input.description?.trim() || undefined,
      codes: parsed.codes,
      usedCodesCount: 0,
      lowStockThreshold: threshold,
      isPublishedAsService: false,
      allowSingleCodePurchase: allowSingle,
      allowPackagePurchase: allowPackage,
      packageCodesCount: normalizedPkgCount,
      packageNameAr: allowPackage ? (input.packageNameAr?.trim() || undefined) : undefined,
      tierPrices: { ...input.tierPrices },
      packageTierPrices: allowPackage && input.packageTierPrices
        ? { ...input.packageTierPrices }
        : undefined,
      createdAt: nowIso.substring(0, 10),
      updatedAt: nowIso
    };

    setVoucherWarehouses(prev => [warehouse, ...prev]);
    firestoreSync.saveVoucherWarehouse(warehouse).catch(console.error);

    if (input.publishImmediately) {
      warehouse = publishWarehouseInternal(warehouse, {
        catalogId: input.catalogId || catalogs[0]?.id || 'cat-cards',
        serviceId: input.targetServiceId || undefined,
        serviceNameAr: input.newServiceNameAr
      });
    }

    showToast({
      type: 'success',
      title: 'تم إنشاء مخزن الأكواد بنجاح',
      description: `تم إنشاء مخزن "${warehouse.nameAr}" (${parsed.codes.length} كود)${warehouse.isPublishedAsService ? ' وعرضه كخدمة للعملاء' : ''}.`
    });

    return { warehouse, addedCount: parsed.codes.length };
  };

  const addCodesToWarehouse = (warehouseId: string, rawCodes: string) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canManageVoucherStock, 'ليس لديك صلاحية تغذية مخزون الأكواد.')) {
      return { addedCount: 0, skippedDuplicates: 0 };
    }
    const targetWh = voucherWarehouses.find(w => w.id === warehouseId);
    if (!targetWh) return { addedCount: 0, skippedDuplicates: 0 };

    const { nextCodes, addedCount, skippedDuplicates } = mergeCodesIntoWarehouse(
      targetWh.codes,
      rawCodes
    );

    if (addedCount === 0) {
      showToast({
        type: 'info',
        title: 'لم يتم إضافة أكواد جديدة',
        description: skippedDuplicates > 0 ? 'جميع الأكواد المدخلة موجودة مسبقاً في المخزن.' : 'يرجى إدخال أكواد صالحة.'
      });
      return { addedCount: 0, skippedDuplicates };
    }

    const updatedWh: VoucherWarehouse = {
      ...targetWh,
      codes: nextCodes,
      updatedAt: new Date().toISOString()
    };

    setVoucherWarehouses(prev => prev.map(w => (w.id === warehouseId ? updatedWh : w)));
    firestoreSync.saveVoucherWarehouse(updatedWh).catch(console.error);

    // Sync linked service package if published
    if (updatedWh.linkedServiceId) {
      const linkedSrv = services.find(s => s.id === updatedWh.linkedServiceId);
      if (linkedSrv) {
        const syncedSrv = syncWarehouseIntoService(linkedSrv, updatedWh);
        setServices(prev => prev.map(s => (s.id === syncedSrv.id ? syncedSrv : s)));
        firestoreSync.saveService(syncedSrv).catch(console.error);
      }
    }

    showToast({
      type: 'success',
      title: 'تمت تعبئة المخزن بالأكواد',
      description: `تمت إضافة ${addedCount} كود لمخزن "${updatedWh.nameAr}"${skippedDuplicates > 0 ? ` (تم تجاهل ${skippedDuplicates} مكرر)` : ''}.`
    });

    return { addedCount, skippedDuplicates };
  };

  const removeCodeFromWarehouse = (warehouseId: string, codeIndex: number) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canManageVoucherStock, 'ليس لديك صلاحية تعديل أو حذف أكواد المخزون.')) return;
    const targetWh = voucherWarehouses.find(w => w.id === warehouseId);
    if (!targetWh) return;
    const nextCodes = targetWh.codes.filter((_, idx) => idx !== codeIndex);
    const updatedWh: VoucherWarehouse = {
      ...targetWh,
      codes: nextCodes,
      updatedAt: new Date().toISOString()
    };
    setVoucherWarehouses(prev => prev.map(w => (w.id === warehouseId ? updatedWh : w)));
    firestoreSync.saveVoucherWarehouse(updatedWh).catch(console.error);

    if (updatedWh.linkedServiceId) {
      const linkedSrv = services.find(s => s.id === updatedWh.linkedServiceId);
      if (linkedSrv) {
        const syncedSrv = syncWarehouseIntoService(linkedSrv, updatedWh);
        setServices(prev => prev.map(s => (s.id === syncedSrv.id ? syncedSrv : s)));
        firestoreSync.saveService(syncedSrv).catch(console.error);
      }
    }
  };

  const updateVoucherWarehouse = (
    warehouseId: string,
    updates: Partial<Pick<VoucherWarehouse, 'nameAr' | 'categoryName' | 'catalogId' | 'description' | 'allowSingleCodePurchase' | 'allowPackagePurchase' | 'packageCodesCount' | 'packageNameAr' | 'tierPrices' | 'packageTierPrices' | 'lowStockThreshold'>>
  ) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canManageVoucherStock, 'ليس لديك صلاحية تعديل إعدادات وأسعار مخزون الأكواد.')) return;
    const targetWh = voucherWarehouses.find(w => w.id === warehouseId);
    if (!targetWh) return;
    const mergedAllowPackage = updates.allowPackagePurchase !== undefined
      ? Boolean(updates.allowPackagePurchase)
      : Boolean(targetWh.allowPackagePurchase);
    const mergedAllowSingle = updates.allowSingleCodePurchase !== undefined
      ? (updates.allowSingleCodePurchase === false && mergedAllowPackage ? false : updates.allowSingleCodePurchase !== false)
      : (targetWh.allowSingleCodePurchase === false && mergedAllowPackage ? false : targetWh.allowSingleCodePurchase !== false);

    const mergedThreshold = updates.lowStockThreshold !== undefined
      ? Math.max(0, Math.floor(updates.lowStockThreshold))
      : (targetWh.lowStockThreshold ?? 5);

    const updatedWh: VoucherWarehouse = {
      ...targetWh,
      ...updates,
      lowStockThreshold: mergedThreshold,
      allowSingleCodePurchase: mergedAllowSingle,
      allowPackagePurchase: mergedAllowPackage,
      packageCodesCount: mergedAllowPackage
        ? Math.max(1, Math.floor(Number(updates.packageCodesCount ?? targetWh.packageCodesCount ?? 5) || 5))
        : targetWh.packageCodesCount,
      updatedAt: new Date().toISOString()
    };
    setVoucherWarehouses(prev => prev.map(w => (w.id === warehouseId ? updatedWh : w)));
    firestoreSync.saveVoucherWarehouse(updatedWh).catch(console.error);

    if (updatedWh.linkedServiceId) {
      const linkedSrv = services.find(s => s.id === updatedWh.linkedServiceId);
      if (linkedSrv) {
        const syncedSrv = syncWarehouseIntoService(linkedSrv, updatedWh);
        setServices(prev => prev.map(s => (s.id === syncedSrv.id ? syncedSrv : s)));
        firestoreSync.saveService(syncedSrv).catch(console.error);
      }
    }

    showToast({
      type: 'success',
      title: 'تم تحديث بيانات المخزن',
      description: `تم حفظ تعديلات "${updatedWh.nameAr}" بنجاح.`
    });
  };

  const setWarehouseLowStockThreshold = (warehouseId: string, threshold: number) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canManageVoucherStock, 'ليس لديك صلاحية ضبط تنبيهات مخزون الأكواد.')) return;
    const targetWh = voucherWarehouses.find(w => w.id === warehouseId);
    if (!targetWh) return;
    const normalized = Math.max(0, Math.floor(threshold));
    const updatedWh: VoucherWarehouse = {
      ...targetWh,
      lowStockThreshold: normalized,
      updatedAt: new Date().toISOString()
    };
    setVoucherWarehouses(prev => prev.map(w => (w.id === warehouseId ? updatedWh : w)));
    firestoreSync.saveVoucherWarehouse(updatedWh).catch(console.error);

    // If stock is already below or at new threshold, trigger immediate alert
    if (updatedWh.codes.length <= normalized) {
      addNotification({
        supplierId: supplier.id,
        supplierName: supplier.name,
        targetRole: 'supplier',
        title: updatedWh.codes.length === 0
          ? `نفد مخزون فئة ${updatedWh.categoryName} (${updatedWh.nameAr}) ⚠️`
          : `تنبيه مخزون منخفض: ${updatedWh.categoryName} (${updatedWh.nameAr}) ⚠️`,
        message: `تم ضبط الحد الأدنى عند ${normalized} كود. المخزون الحالي (${updatedWh.codes.length} كود) وصل للحد الأدنى ويحتاج تعبئة.`,
        type: 'low_stock',
        warehouseId: updatedWh.id,
        categoryName: updatedWh.categoryName,
        remainingStock: updatedWh.codes.length,
        lowStockThreshold: normalized,
        actionTab: 'vouchers'
      });
    }

    showToast({
      type: 'success',
      title: 'تم تحديث حد التنبيه',
      description: `تم تعيين حد التنبيه لمخزون "${updatedWh.nameAr}" عند ${normalized} كود.`
    });
  };

  const publishWarehouseAsService = (
    warehouseId: string,
    options: { catalogId: string; serviceId?: string; serviceNameAr?: string }
  ) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canManageVoucherStock, 'ليس لديك صلاحية إدارة ونشر مخزون الأكواد.')) return;
    const targetWh = voucherWarehouses.find(w => w.id === warehouseId);
    if (!targetWh) return;
    const updatedWh = publishWarehouseInternal(targetWh, options);
    showToast({
      type: 'success',
      title: 'تم عرض المخزن كخدمة للعملاء',
      description: `تم نشر "${updatedWh.nameAr}" ضمن الفئة والكتالوج المحدد بنجاح.`
    });
  };

  const unpublishWarehouseFromService = (warehouseId: string) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canManageVoucherStock, 'ليس لديك صلاحية إدارة مخزون الأكواد.')) return;
    const targetWh = voucherWarehouses.find(w => w.id === warehouseId);
    if (!targetWh) return;
    const updatedWh: VoucherWarehouse = {
      ...targetWh,
      isPublishedAsService: false,
      updatedAt: new Date().toISOString()
    };
    setVoucherWarehouses(prev => prev.map(w => (w.id === warehouseId ? updatedWh : w)));
    firestoreSync.saveVoucherWarehouse(updatedWh).catch(console.error);

    if (targetWh.linkedServiceId) {
      const linkedSrv = services.find(s => s.id === targetWh.linkedServiceId);
      if (linkedSrv) {
        const remainingPkgs = linkedSrv.packages.filter(
          p => p.warehouseId !== warehouseId && p.id !== targetWh.linkedPackageId
        );
        if (remainingPkgs.length === 0) {
          const updatedSrv = { ...linkedSrv, isActive: false };
          setServices(prev => prev.map(s => (s.id === linkedSrv.id ? updatedSrv : s)));
          firestoreSync.saveService(updatedSrv).catch(console.error);
        } else {
          const updatedSrv = { ...linkedSrv, packages: remainingPkgs };
          setServices(prev => prev.map(s => (s.id === linkedSrv.id ? updatedSrv : s)));
          firestoreSync.saveService(updatedSrv).catch(console.error);
        }
      }
    }

    showToast({
      type: 'info',
      title: 'تم إيقاف العرض كخدمة',
      description: `تم إخفاء "${targetWh.nameAr}" من واجهة العملاء مع الاحتفاظ بأكواد المخزن.`
    });
  };

  const deleteVoucherWarehouse = (warehouseId: string) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canManageVoucherStock, 'ليس لديك صلاحية حذف مخازن الأكواد.')) return;
    const targetWh = voucherWarehouses.find(w => w.id === warehouseId);
    setVoucherWarehouses(prev => prev.filter(w => w.id !== warehouseId));
    firestoreSync.deleteVoucherWarehouse(warehouseId).catch(console.error);

    if (targetWh?.linkedServiceId) {
      const linkedSrv = services.find(s => s.id === targetWh.linkedServiceId);
      if (linkedSrv) {
        const updatedSrv: DigitalService = {
          ...linkedSrv,
          packages: linkedSrv.packages.map(p =>
            p.warehouseId === warehouseId ? { ...p, warehouseId: undefined } : p
          )
        };
        setServices(prev => prev.map(s => (s.id === linkedSrv.id ? updatedSrv : s)));
        firestoreSync.saveService(updatedSrv).catch(console.error);
      }
    }

    showToast({
      type: 'success',
      title: 'تم حذف المخزن',
      description: 'تم حذف مخزن الأكواد بنجاح.'
    });
  };

  // Add Supplier by Super Admin
  const addSupplier = (newSupData: Omit<Supplier, 'id' | 'walletBalance' | 'createdAt'>) => {
    const newId = `sup-${Date.now()}`;
    const defaultConfig = getEffectivePlatformFeesConfig(
      {
        feeType: newSupData.feeType,
        feePercentage: newSupData.feePercentage,
        fixedFeeAmount: newSupData.fixedFeeAmount,
        feesConfig: newSupData.feesConfig,
      },
      superAdmin
    );
    const newSup: Supplier = {
      ...newSupData,
      feesConfig: defaultConfig,
      id: newId,
      walletBalance: 0,
      createdAt: new Date().toISOString().substring(0, 10)
    };
    setSuppliers(prev => [...prev, newSup]);
    firestoreSync.saveSupplier(newSup).catch(console.error);
    showToast({
      type: 'success',
      title: 'تمت إضافة المتجر بنجاح',
      description: `تم تسجيل المتجر (${newSup.name}) وضبط نسب الرسوم الخاصة به بنجاح.`
    });
  };

  // Super Admin updates specific supplier fee (supports two-section PlatformFeesConfig + legacy sync)
  const updateSupplierFeeConfig = (
    supplierId: string, 
    config: { feeType: 'percentage' | 'fixed' | 'both'; percentage: number; fixedAmount: number; feesConfig?: PlatformFeesConfig }
  ) => {
    const targetSup = suppliers.find(s => s.id === supplierId);
    const normalizedFeesConfig = config.feesConfig
      ? normalizePlatformFeesConfig(config.feesConfig)
      : normalizePlatformFeesConfig({
          ...getEffectivePlatformFeesConfig(targetSup, superAdmin),
          clientServices: {
            ...getEffectivePlatformFeesConfig(targetSup, superAdmin).clientServices,
            servicePurchase: {
              feeType: config.feeType,
              percentage: config.percentage,
              fixedAmount: config.fixedAmount,
            },
            balanceTransfer: {
              feeType: config.feeType,
              percentage: config.percentage,
              fixedAmount: config.fixedAmount,
            },
          },
        });

    const primaryPurchaseRule = normalizedFeesConfig.clientServices.servicePurchase;
    const updatedSup = targetSup
      ? {
          ...targetSup,
          feeType: primaryPurchaseRule.feeType,
          feePercentage: primaryPurchaseRule.percentage,
          fixedFeeAmount: primaryPurchaseRule.fixedAmount,
          feesConfig: normalizedFeesConfig,
        }
      : null;

    setSuppliers(prev => prev.map(s => {
      if (s.id !== supplierId) return s;
      return {
        ...s,
        feeType: primaryPurchaseRule.feeType,
        feePercentage: primaryPurchaseRule.percentage,
        fixedFeeAmount: primaryPurchaseRule.fixedAmount,
        feesConfig: normalizedFeesConfig,
      };
    }));
    if (updatedSup) {
      firestoreSync.saveSupplier(updatedSup).catch(console.error);
    }
    showToast({
      type: 'success',
      title: 'تم تحديث رسوم المتجر',
      description: `تم حفظ إعدادات الرسوم المخصصة للمتجر (قسم خدمات المورد وقسم خدمات عملائه) بنجاح.`
    });
  };

  // Super Admin updates store personal/business/bank/fee profile
  const adminUpdateSupplier = (
    supplierId: string,
    updates: Partial<Supplier>
  ): { success: boolean; error?: string } => {
    const adminPerms = resolveEffectiveAdminPermissions(currentUser, role);
    if (role !== 'super_admin' || !adminPerms.canManageSuppliers) {
      const msg = 'ليس لديك صلاحية إشراف وتعديل بيانات المتاجر.';
      showToast({ type: 'error', title: 'صلاحية غير ممنوحة', description: msg });
      return { success: false, error: msg };
    }

    const targetSup = suppliers.find(s => s.id === supplierId);
    if (!targetSup) {
      const msg = 'تعذر العثور على بيانات المتجر المطلوب.';
      showToast({ type: 'error', title: 'المتجر غير موجود', description: msg });
      return { success: false, error: msg };
    }

    if (updates.name !== undefined && !updates.name.trim()) {
      const msg = 'يرجى إدخال اسم مالك المتجر.';
      showToast({ type: 'error', title: 'بيانات ناقصة', description: msg });
      return { success: false, error: msg };
    }

    if (updates.storeName !== undefined && !updates.storeName.trim()) {
      const msg = 'يرجى إدخال الاسم التجاري للمتجر.';
      showToast({ type: 'error', title: 'بيانات ناقصة', description: msg });
      return { success: false, error: msg };
    }

    if (updates.email !== undefined) {
      const cleanEmail = normalizeStoreEmail(updates.email);
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        const msg = 'يرجى إدخال بريد إلكتروني صحيح للمتجر.';
        showToast({ type: 'error', title: 'بريد غير صحيح', description: msg });
        return { success: false, error: msg };
      }
      if (
        cleanEmail !== normalizeStoreEmail(targetSup.email) &&
        isEmailUsedByOtherAccount(cleanEmail, {
          currentSupplierId: supplierId,
          suppliers,
          posClients,
          superAdminEmail: superAdmin.email,
          adminAccounts: superAdmin.adminAccounts,
        })
      ) {
        const msg = 'البريد الإلكتروني مستخدم مسبقاً لحساب آخر في المنصة.';
        showToast({ type: 'error', title: 'تعارض البريد الإلكتروني', description: msg });
        return { success: false, error: msg };
      }
    }

    const normalizedUpdates: Partial<Supplier> = {
      ...updates,
      ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
      ...(updates.storeName !== undefined ? { storeName: updates.storeName.trim() } : {}),
      ...(updates.email !== undefined ? { email: normalizeStoreEmail(updates.email) } : {}),
      ...(updates.phone !== undefined ? { phone: updates.phone.trim() } : {}),
      ...(updates.country !== undefined ? { country: updates.country.trim() } : {}),
      ...(updates.city !== undefined ? { city: updates.city.trim() } : {}),
      ...(updates.socialLinks !== undefined
        ? { socialLinks: sanitizeSupplierSocialLinks(updates.socialLinks) }
        : {}),
      ...(updates.exchangeRateSarPerUsd !== undefined
        ? { exchangeRateSarPerUsd: normalizeExchangeRateSarPerUsd(updates.exchangeRateSarPerUsd) }
        : {}),
    };

    const updatedSup: Supplier = { ...targetSup, ...normalizedUpdates };
    setSuppliers(prev => prev.map(s => (s.id === supplierId ? updatedSup : s)));
    firestoreSync.saveSupplier(updatedSup).catch(console.error);

    showToast({
      type: 'success',
      title: 'تم تحديث بيانات المتجر بنجاح',
      description: `تم حفظ تعديلات الإدارة على متجر "${updatedSup.storeName}" ومزامنتها.`
    });
    return { success: true };
  };

  // Super Admin toggles store active/suspended state
  const toggleSupplierActiveStatus = (supplierId: string) => {
    const adminPerms = resolveEffectiveAdminPermissions(currentUser, role);
    if (role !== 'super_admin' || !adminPerms.canManageSuppliers) {
      showToast({
        type: 'error',
        title: 'صلاحية غير ممنوحة',
        description: 'ليس لديك صلاحية تفعيل أو إيقاف المتاجر.'
      });
      return;
    }

    const targetSup = suppliers.find(s => s.id === supplierId);
    if (!targetSup) return;

    const nextActive = !isSupplierActive(targetSup);
    const updatedSup: Supplier = { ...targetSup, isActive: nextActive };
    setSuppliers(prev => prev.map(s => (s.id === supplierId ? updatedSup : s)));
    firestoreSync.saveSupplier(updatedSup).catch(console.error);

    showToast({
      type: nextActive ? 'success' : 'info',
      title: nextActive ? 'تم تفعيل المتجر بنجاح' : 'تم إيقاف المتجر مؤقتاً',
      description: nextActive
        ? `أصبح متجر "${updatedSup.storeName}" نشطاً ويمكنه وموظفيه تسجيل الدخول الآن.`
        : `تم تعليق متجر "${updatedSup.storeName}" ولن يتمكن مالكه أو موظفوه من الدخول حتى إعادة التفعيل.`
    });
  };

  // Super Admin updates global fee (supports two-section PlatformFeesConfig + legacy sync)
  const updateGlobalFeeConfig = (
    config: { feeType: 'percentage' | 'fixed' | 'both'; percentage: number; fixedAmount: number; defaultFeesConfig?: PlatformFeesConfig }
  ) => {
    const baseGlobal = createDefaultPlatformFeesConfig({
      feeType: config.feeType,
      percentage: config.percentage,
      fixedAmount: config.fixedAmount,
    });
    const normalizedGlobalFees = config.defaultFeesConfig
      ? normalizePlatformFeesConfig(config.defaultFeesConfig, baseGlobal)
      : normalizePlatformFeesConfig({
          ...getEffectivePlatformFeesConfig(undefined, superAdmin),
          clientServices: {
            ...getEffectivePlatformFeesConfig(undefined, superAdmin).clientServices,
            servicePurchase: {
              feeType: config.feeType,
              percentage: config.percentage,
              fixedAmount: config.fixedAmount,
            },
            balanceTransfer: {
              feeType: config.feeType,
              percentage: config.percentage,
              fixedAmount: config.fixedAmount,
            },
          },
        });

    const primaryPurchaseRule = normalizedGlobalFees.clientServices.servicePurchase;
    const nextAdmin: SuperAdmin = {
      ...superAdmin,
      defaultFeeType: primaryPurchaseRule.feeType,
      defaultFeePercentage: primaryPurchaseRule.percentage,
      defaultFixedFeeAmount: primaryPurchaseRule.fixedAmount,
      defaultFeesConfig: normalizedGlobalFees,
    };
    setSuperAdmin(nextAdmin);
    firestoreSync.saveSuperAdmin(nextAdmin).catch(console.error);

    // Update all suppliers with global default and sync to Firestore
    const updatedSuppliers = suppliers.map(s => ({
      ...s,
      feeType: primaryPurchaseRule.feeType,
      feePercentage: primaryPurchaseRule.percentage,
      fixedFeeAmount: primaryPurchaseRule.fixedAmount,
      feesConfig: normalizedGlobalFees,
    }));
    setSuppliers(updatedSuppliers);
    updatedSuppliers.forEach(s => {
      firestoreSync.saveSupplier(s).catch(console.error);
    });

    showToast({
      type: 'success',
      title: 'تم تحديث الرسوم العامة لجميع المتاجر',
      description: `تم حفظ وتطبيق إعدادات الرسوم العامة (قسم خدمات المورد وقسم خدمات عملائه) على كافة المتاجر بنجاح.`
    });
  };

  const adminSettleBank = (amount: number, bankIban: string) => {
    if (superAdmin.walletBalance < amount) {
      showToast({
        type: 'error',
        title: 'الرصيد غير كافٍ',
        description: 'رصيد محفظة الإدارة لا يكفي للتحويل إلى الحساب البنكي.'
      });
      return;
    }
    const newBal = parseFloat((superAdmin.walletBalance - amount).toFixed(2));
    const formattedDate = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const refId = `adm-stl-${Date.now().toString().slice(-4)}`;

    setSuperAdmin(prev => ({
      ...prev,
      walletBalance: newBal
    }));

    const settleEntry: AdminAccountingEntry = {
      id: `adm-acc-${Date.now()}-stl`,
      date: formattedDate,
      type: 'bank_settlement',
      referenceId: refId,
      supplierId: supplier.id,
      supplierName: `${supplier.name} (${supplier.storeName})`,
      description: `تسوية رصيد بنكي وتحويل ${amount.toFixed(2)} ر.س إلى الحساب البنكي للإدارة (${bankIban})`,
      grossAmount: amount,
      feeAmount: 0,
      debit: amount,
      credit: 0,
      balanceAfter: newBal,
      notes: `تم الخصم من محفظة الإدارة وتسوية القيمة مع بنك المتجر (${supplier.bankAccountDetails.bankName})`
    };
    setAdminAccountingEntries(prev => [settleEntry, ...prev]);
    firestoreSync.saveAdminAccountingEntry(settleEntry).catch(console.error);

    triggerConfetti();
    showToast({
      type: 'success',
      title: 'تم التحويل إلى الحساب البنكي',
      description: `تم تحويل مبلغ ${formatCurrency(amount)} من محفظة مدير التطبيق إلى الآيبان ${bankIban}.`
    });
  };

  const adminTransferToAgent = (targetPosCode: string, amount: number) => {
    const target = posClients.find(p => p.posCode.trim().toUpperCase() === targetPosCode.trim().toUpperCase());
    if (!target) {
      showToast({
        type: 'error',
        title: 'لم يتم العثور على نقطة البيع',
        description: `المعرف ${targetPosCode} غير مسجل في النظام.`
      });
      return;
    }
    if (superAdmin.walletBalance < amount) {
      showToast({
        type: 'error',
        title: 'رصيد محفظة الإدارة غير كافٍ',
        description: 'لا يوجد رصيد كافٍ في محفظة المدير.'
      });
      return;
    }

    const adminSettlement = settlePendingGiftFeesOnRecharge({
      currentWalletBalance: target.walletBalance,
      rechargeAmount: amount,
      pendingGiftFees: target.pendingGiftFees,
    });
    const newBal = parseFloat((superAdmin.walletBalance - amount + adminSettlement.settledFeeAmount).toFixed(2));
    const formattedDate = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const refId = `adm-trf-${Date.now().toString().slice(-4)}`;

    setSuperAdmin(prev => ({
      ...prev,
      walletBalance: newBal
    }));
    firestoreSync.saveSuperAdmin({
      ...superAdmin,
      walletBalance: newBal,
    }).catch(console.error);

    setPosClients(prev => prev.map(p => {
      if (p.id !== target.id) return p;
      const updatedTarget: POSClient = {
        ...p,
        walletBalance: adminSettlement.finalWalletBalance,
        pendingGiftFees: adminSettlement.remainingPendingGiftFees,
      };
      firestoreSync.savePosClient(updatedTarget).catch(console.error);
      return updatedTarget;
    }));

    const adminLogs: AdminAccountingEntry[] = [
      {
        id: `adm-acc-${Date.now()}-trf`,
        date: formattedDate,
        type: 'agent_transfer',
        referenceId: refId,
        posId: target.id,
        posCode: target.posCode,
        posName: target.tradeName,
        description: `تحويل رصيد بقيمة ${amount.toFixed(2)} ر.س من محفظة الإدارة لنقطة البيع (${target.tradeName} - ${target.posCode})`,
        grossAmount: amount,
        feeAmount: 0,
        debit: amount,
        credit: 0,
        balanceAfter: parseFloat((superAdmin.walletBalance - amount).toFixed(2)),
        notes: `إيداع مباشر في محفظة نقطة البيع`
      }
    ];
    if (adminSettlement.settledFeeAmount > 0) {
      const settledEntry: AdminAccountingEntry = {
        id: `adm-acc-${Date.now()}-gift-adm`,
        date: formattedDate,
        type: 'fee_collected',
        referenceId: refId,
        supplierId: target.supplierId,
        posId: target.id,
        posCode: target.posCode,
        posName: target.tradeName,
        description: `تحصيل رسوم تطبيق مؤجلة (${adminSettlement.settledFeeAmount.toFixed(2)} ر.س) بعد شحن محفظة ${target.tradeName}`,
        grossAmount: adminSettlement.settledFeeAmount,
        feeAmount: adminSettlement.settledFeeAmount,
        debit: 0,
        credit: adminSettlement.settledFeeAmount,
        balanceAfter: newBal,
        notes: `خصم تلقائي عند شحن محفظة العميل من الإدارة`
      };
      adminLogs.unshift(settledEntry);
      firestoreSync.saveAdminAccountingEntry(settledEntry).catch(console.error);
    }

    setAdminAccountingEntries(prev => [...adminLogs, ...prev]);
    for (const admLog of adminLogs) {
      firestoreSync.saveAdminAccountingEntry(admLog).catch(console.error);
    }

    triggerConfetti();
    showToast({
      type: 'success',
      title: 'تم تحويل الرصيد من الإدارة',
      description: `تم إيداع ${formatCurrency(amount)} مباشرة في محفظة ${target.tradeName}.`
    });
  };

  const addOfficeEmployee = (employeeData: {
    name: string;
    email: string;
    password?: string;
    phone: string;
    country?: string;
    isTransferReceiverOnly?: boolean;
    roleTitle: string;
    permissions: EmployeePermissions;
  }): { success: boolean; error?: string; employee?: OfficeEmployee } => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canManageEmployees, 'ليس لديك صلاحية إضافة موظفين جدد للمتجر.')) {
      return { success: false, error: 'ليس لديك صلاحية إضافة موظفين.' };
    }

    const restrictedEmails = [
      superAdmin.email,
      ...MASTER_ADMIN_EMAILS,
      ...(superAdmin.adminAccounts || []).map(a => a.email),
      ...suppliers
        .filter(s => s.id !== supplier.id)
        .flatMap(s => [s.email, ...(s.employees || []).map(e => e.email)]),
      ...posClients.map(p => p.email || ''),
    ];
    const validation = validateOfficeEmployeeInput(
      employeeData,
      supplier.employees || [],
      supplier.email,
      restrictedEmails
    );
    if (!validation.valid) {
      showToast({
        type: 'error',
        title: 'بيانات الموظف غير مكتملة أو غير صالحة',
        description: validation.error
      });
      return { success: false, error: validation.error };
    }

    const cleanEmail = normalizeStoreEmail(employeeData.email);
    const cleanPassword = (employeeData.password || '').trim();
    const normalizedPerms = normalizeEmployeePermissions(employeeData.permissions);
    const newEmp: OfficeEmployee = {
      id: `emp-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`,
      supplierId: supplier.id,
      name: employeeData.name.trim(),
      email: cleanEmail,
      password: cleanPassword,
      phone: employeeData.phone.trim(),
      country: employeeData.country?.trim() || undefined,
      isTransferReceiverOnly: employeeData.isTransferReceiverOnly,
      isActive: true,
      roleTitle: employeeData.roleTitle.trim() || 'موظف مكتب',
      permissions: normalizedPerms,
      createdAt: new Date().toISOString().substring(0, 10)
    };

    const currentSup = suppliers.find(s => s.id === supplier.id) || supplier;
    const updatedSup: Supplier = {
      ...currentSup,
      employees: [
        newEmp,
        ...(currentSup.employees || []).filter(e => normalizeStoreEmail(e.email) !== cleanEmail)
      ]
    };

    // 1. Save in the supplier's employees array & Firestore
    setSuppliers(prev => prev.map(s => (s.id === supplier.id ? updatedSup : s)));
    firestoreSync.saveSupplier(updatedSup).catch(console.error);

    // 2. Register as a dedicated user account of type 'employee' in users collection
    const employeeUser: AuthUser = {
      id: newEmp.id,
      email: cleanEmail,
      name: newEmp.name,
      role: 'employee',
      phone: newEmp.phone,
      associatedId: supplier.id,
      supplierId: supplier.id,
      employeeId: newEmp.id,
      roleTitle: newEmp.roleTitle,
      permissions: normalizedPerms
    };
    firestoreSync.saveUser(employeeUser).catch(console.error);

    showToast({
      type: 'success',
      title: 'تم إنشاء وتوثيق حساب الموظف بنجاح',
      description: `تم إضافة (${newEmp.name}) بحساب مستقل (بريد وكلمة مرور) في متجر (${supplier.name}) وفق الصلاحيات المحددة.`
    });

    return { success: true, employee: newEmp };
  };

  const updateOfficeEmployee = (
    empId: string,
    updates: Partial<OfficeEmployee>
  ): { success: boolean; error?: string } => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canManageEmployees, 'ليس لديك صلاحية تعديل بيانات أو صلاحيات الموظفين.')) {
      return { success: false, error: 'ليس لديك صلاحية تعديل الموظفين.' };
    }

    const currentSup = suppliers.find(s => s.id === supplier.id) || supplier;
    const currentEmployees = currentSup.employees || [];
    const targetEmp = currentEmployees.find(e => e.id === empId);
    if (!targetEmp) {
      return { success: false, error: 'لم يتم العثور على الموظف المحدد.' };
    }

    const nextEmail = normalizeStoreEmail(updates.email ?? targetEmp.email);
    const nextPassword =
      updates.password !== undefined && updates.password.trim().length > 0
        ? updates.password.trim()
        : (targetEmp.password || '').trim();
    const nextPermissions = updates.permissions
      ? normalizeEmployeePermissions(updates.permissions)
      : normalizeEmployeePermissions(targetEmp.permissions);

    const restrictedEmails = [
      superAdmin.email,
      ...MASTER_ADMIN_EMAILS,
      ...(superAdmin.adminAccounts || []).map(a => a.email),
      ...suppliers
        .filter(s => s.id !== supplier.id)
        .flatMap(s => [s.email, ...(s.employees || []).map(e => e.email)]),
      ...posClients.map(p => p.email || ''),
    ];
    const validation = validateOfficeEmployeeInput(
      {
        name: updates.name ?? targetEmp.name,
        email: nextEmail,
        password: updates.password,
        permissions: nextPermissions,
        isTransferReceiverOnly: updates.isTransferReceiverOnly ?? targetEmp.isTransferReceiverOnly,
      },
      currentEmployees,
      currentSup.email,
      restrictedEmails,
      empId
    );
    if (!validation.valid) {
      showToast({
        type: 'error',
        title: 'تعذر تحديث بيانات الموظف',
        description: validation.error
      });
      return { success: false, error: validation.error };
    }

    const mergedEmp: OfficeEmployee = {
      ...targetEmp,
      ...updates,
      name: (updates.name ?? targetEmp.name).trim(),
      email: nextEmail,
      password: nextPassword,
      phone: (updates.phone ?? targetEmp.phone).trim(),
      roleTitle: (updates.roleTitle ?? targetEmp.roleTitle).trim() || 'موظف مكتب',
      isActive: updates.isActive !== undefined ? Boolean(updates.isActive) : (targetEmp.isActive ?? true),
      permissions: nextPermissions,
    };

    const updatedSup: Supplier = {
      ...currentSup,
      employees: currentEmployees.map(e => (e.id === empId ? mergedEmp : e))
    };

    setSuppliers(prev => prev.map(s => (s.id === supplier.id ? updatedSup : s)));
    firestoreSync.saveSupplier(updatedSup).catch(console.error);

    const employeeUser: AuthUser = {
      id: mergedEmp.id,
      email: mergedEmp.email,
      name: mergedEmp.name,
      role: 'employee',
      phone: mergedEmp.phone,
      associatedId: supplier.id,
      supplierId: supplier.id,
      employeeId: mergedEmp.id,
      roleTitle: mergedEmp.roleTitle,
      permissions: mergedEmp.permissions
    };
    firestoreSync.saveUser(employeeUser).catch(console.error);

    if (currentUser?.employeeId === empId) {
      if (!isEmployeeActive(mergedEmp)) {
        clearTransientSessionCaches();
        setCurrentSupplierId('');
        setCurrentUser(null);
      } else {
        setCurrentUser(prev =>
          prev
            ? {
                ...prev,
                name: mergedEmp.name,
                email: mergedEmp.email,
                phone: mergedEmp.phone,
                roleTitle: mergedEmp.roleTitle,
                permissions: mergedEmp.permissions
              }
            : prev
        );
      }
    }

    showToast({
      type: 'success',
      title: 'تم تحديث بيانات وصلاحيات الموظف',
      description:
        mergedEmp.isActive === false
          ? `تم إيقاف حساب الموظف (${mergedEmp.name}) ومنع دخوله للنظام.`
          : 'تم حفظ تعديلات وصلاحيات الموظف وكلمة المرور ومزامنتها مع نظام الدخول بنجاح.'
    });

    return { success: true };
  };

  const removeOfficeEmployee = (empId: string) => {
    if (!assertEmployeePermission(effectiveEmployeePerms.canManageEmployees, 'ليس لديك صلاحية حذف الموظفين.')) return;
    const currentSup = suppliers.find(s => s.id === supplier.id) || supplier;
    const currentEmployees = currentSup.employees || [];
    const targetEmp = currentEmployees.find(e => e.id === empId);
    const updatedSup: Supplier = {
      ...currentSup,
      employees: currentEmployees.filter(e => e.id !== empId)
    };

    setSuppliers(prev => prev.map(s => (s.id === supplier.id ? updatedSup : s)));
    firestoreSync.saveSupplier(updatedSup).catch(console.error);
    firestoreSync.deleteUser(empId).catch(console.error);

    if (currentUser?.employeeId === empId) {
      setCurrentUser(null);
    }

    showToast({
      type: 'info',
      title: 'تم حذف الموظف',
      description: targetEmp
        ? `تم إزالة الموظف (${targetEmp.name}) وسحب صلاحياته من المتجر.`
        : 'تم إزالة الموظف من صلاحيات مكتب المتجر.'
    });
  };

  const addAdminAccount = (accountData: {
    name: string;
    email: string;
    password: string;
    phone: string;
    roleTitle: string;
    permissions: AdminPermissions;
    isActive?: boolean;
  }): { success: boolean; error?: string } => {
    const existingAccounts = superAdmin.adminAccounts || [];
    const validation = validateAdminAccountInput(
      accountData,
      existingAccounts,
      superAdmin.email
    );
    if (!validation.valid) {
      showToast({
        type: 'error',
        title: 'بيانات غير مكتملة أو غير صالحة',
        description: validation.error
      });
      return { success: false, error: validation.error };
    }

    const cleanEmail = accountData.email.trim().toLowerCase();
    const today = new Date().toISOString().substring(0, 10);
    const newAccount: AdminAccount = {
      id: `adm-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`,
      name: accountData.name.trim(),
      email: cleanEmail,
      password: accountData.password.trim(),
      phone: accountData.phone.trim(),
      roleTitle: accountData.roleTitle.trim() || 'مشرف تطبيق',
      permissions: { ...accountData.permissions },
      isActive: accountData.isActive ?? true,
      createdAt: today,
      updatedAt: today
    };

    const nextAdmin: SuperAdmin = {
      ...superAdmin,
      adminAccounts: [newAccount, ...existingAccounts]
    };
    setSuperAdmin(nextAdmin);
    firestoreSync.saveSuperAdmin(nextAdmin).catch(console.error);

    const adminAuthUser: AuthUser = {
      id: newAccount.id,
      email: cleanEmail,
      name: newAccount.name,
      role: 'super_admin',
      phone: newAccount.phone || undefined,
      associatedId: 'admin',
      adminAccountId: newAccount.id,
      roleTitle: newAccount.roleTitle,
      adminPermissions: newAccount.permissions
    };
    firestoreSync.saveUser(adminAuthUser).catch(console.error);

    showToast({
      type: 'success',
      title: 'تم إنشاء حساب إدارة التطبيق بنجاح',
      description: `تم إضافة (${newAccount.name}) بصلاحيات (${newAccount.roleTitle}) وحفظه في قاعدة البيانات.`
    });

    return { success: true };
  };

  const updateAdminAccount = (
    accountId: string,
    updates: Partial<AdminAccount>
  ): { success: boolean; error?: string } => {
    const existingAccounts = superAdmin.adminAccounts || [];
    const target = existingAccounts.find(a => a.id === accountId);
    if (!target) {
      return { success: false, error: 'الحساب الإداري غير موجود.' };
    }

    const mergedAccount: AdminAccount = {
      ...target,
      ...updates,
      name: (updates.name ?? target.name).trim(),
      email: (updates.email ?? target.email).trim().toLowerCase(),
      phone: (updates.phone ?? target.phone).trim(),
      roleTitle: (updates.roleTitle ?? target.roleTitle).trim() || 'مشرف تطبيق',
      password:
        updates.password !== undefined && updates.password.trim().length > 0
          ? updates.password.trim()
          : target.password,
      permissions: updates.permissions ? { ...updates.permissions } : { ...target.permissions },
      updatedAt: new Date().toISOString().substring(0, 10)
    };

    // Only run full input validation if editable fields (other than toggling isActive alone) were updated
    if (
      updates.name !== undefined ||
      updates.email !== undefined ||
      updates.permissions !== undefined ||
      (updates.password !== undefined && updates.password.trim().length > 0)
    ) {
      const validation = validateAdminAccountInput(
        {
          name: mergedAccount.name,
          email: mergedAccount.email,
          password: updates.password ?? '',
          roleTitle: mergedAccount.roleTitle,
          permissions: mergedAccount.permissions
        },
        existingAccounts,
        superAdmin.email,
        accountId
      );
      if (!validation.valid) {
        showToast({
          type: 'error',
          title: 'تعذر تحديث الحساب الإداري',
          description: validation.error
        });
        return { success: false, error: validation.error };
      }
    }

    const nextAdmin: SuperAdmin = {
      ...superAdmin,
      adminAccounts: existingAccounts.map(a => (a.id === accountId ? mergedAccount : a))
    };
    setSuperAdmin(nextAdmin);
    firestoreSync.saveSuperAdmin(nextAdmin).catch(console.error);

    const adminAuthUser: AuthUser = {
      id: mergedAccount.id,
      email: mergedAccount.email,
      name: mergedAccount.name,
      role: 'super_admin',
      phone: mergedAccount.phone || undefined,
      associatedId: 'admin',
      adminAccountId: mergedAccount.id,
      roleTitle: mergedAccount.roleTitle,
      adminPermissions: mergedAccount.permissions
    };
    firestoreSync.saveUser(adminAuthUser).catch(console.error);

    if (currentUser?.adminAccountId === accountId) {
      if (!mergedAccount.isActive) {
        setCurrentUser(null);
      } else {
        setCurrentUser(prev =>
          prev
            ? {
                ...prev,
                name: mergedAccount.name,
                email: mergedAccount.email,
                phone: mergedAccount.phone || undefined,
                roleTitle: mergedAccount.roleTitle,
                adminPermissions: mergedAccount.permissions
              }
            : prev
        );
      }
    }

    showToast({
      type: 'success',
      title: 'تم تحديث الحساب الإداري',
      description: `تم حفظ تعديلات حساب (${mergedAccount.name}) بنجاح.`
    });

    return { success: true };
  };

  const removeAdminAccount = (accountId: string) => {
    const existingAccounts = superAdmin.adminAccounts || [];
    const target = existingAccounts.find(a => a.id === accountId);
    if (!target) return;

    const nextAdmin: SuperAdmin = {
      ...superAdmin,
      adminAccounts: existingAccounts.filter(a => a.id !== accountId)
    };
    setSuperAdmin(nextAdmin);
    firestoreSync.saveSuperAdmin(nextAdmin).catch(console.error);
    firestoreSync.deleteUser(accountId).catch(console.error);

    if (currentUser?.adminAccountId === accountId) {
      setCurrentUser(null);
    }

    showToast({
      type: 'info',
      title: 'تم حذف الحساب الإداري',
      description: `تم إزالة حساب (${target.name}) وسحب صلاحياته من النظام.`
    });
  };

  const guardedSetRole = (nextRole: UserRole) => {
    if (!canSwitchRole({ isAuthenticated, currentUser, nextRole })) {
      return;
    }
    setInspectedPosId(null);
    setRole(nextRole);
  };

  const guardedSetCurrentPosId = (id: string) => {
    if (
      !canSwitchToPosClient({
        isAuthenticated,
        currentUser,
        targetPosId: id,
        posClients,
      })
    ) {
      return;
    }
    currentPosIdRef.current = id;
    setCurrentPosId(id);

    if (isAuthenticated && currentUser?.role === 'pos_client') {
      const targetPos = posClients.find(p => p.id === id);
      if (targetPos?.supplierId && currentSupplierIdRef.current !== targetPos.supplierId) {
        currentSupplierIdRef.current = targetPos.supplierId;
        setCurrentSupplierId(targetPos.supplierId);
      }
    }
  };

  const guardedSetCurrentSupplierId = (id: string) => {
    if (
      !canSwitchToSupplier({
        isAuthenticated,
        currentUser,
        targetSupplierId: id,
        posClients,
      })
    ) {
      return;
    }
    currentSupplierIdRef.current = id;
    setCurrentSupplierId(id);

    if (isAuthenticated && currentUser?.role === 'pos_client') {
      const ownRecords = findPosClientsForEmail(
        currentUser.email,
        posClients,
        currentUser.associatedId
      );
      const matchingPos = ownRecords.find(p => p.supplierId === id);
      if (matchingPos && currentPosIdRef.current !== matchingPos.id) {
        currentPosIdRef.current = matchingPos.id;
        setCurrentPosId(matchingPos.id);
      }
    }
  };

  return (
    <AppContext.Provider
      value={{
        role,
        setRole: guardedSetRole,
        viewMode,
        setViewMode,
        activeNavTab,
        setActiveNavTab,
        activeCurrency,
        activeExchangeRate,
        currencyLabel,
        setActiveCurrency,
        updateSupplierExchangeRate,
        formatCurrency,
        convertFromSar,
        convertToSar,
        isFirestoreConnected,
        isSyncingWithFirestore,
        lastFirestoreSyncAt,
        databaseSyncMessage,
        isSupplierSelectionRequired,
        setIsSupplierSelectionRequired,
        syncAllToFirestore,
        clearUsersSuppliersAndClientsData,
        checkDatabaseConnection,
        ensureDatabaseConnectedAndSynced,
        isAuthenticated,
        currentUser,
        loginWithGoogle,
        sendLoginOtp,
        verifyLoginOtpAndLogin,
        registerAccount,
        requestPasswordReset,
        verifyResetCode,
        completePasswordReset,
        logout,
        currentPos: exposedCurrentPos,
        setCurrentPosId: guardedSetCurrentPosId,
        isSupplierPosPreviewMode,
        openSupplierPosPreview,
        closeSupplierPosPreview,
        respondToPosUpgrade,
        posClients,
        suppliers,
        availableClientSuppliers,
        supplier,
        currentPosSupplier,
        setCurrentSupplierId: guardedSetCurrentSupplierId,
        superAdmin,
        catalogs,
        services,
        voucherWarehouses,
        depositRequests,
        loanRepaymentRequests,
        supplierBankAccounts,
        orders,
        accountingEntries,
        adminAccountingEntries,
        inviteLinks,
        notifications,
        supplierNotifications,
        clientNotifications,
        unreadNotificationsCount,
        unreadSupplierNotificationsCount,
        unreadPosNotificationsCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        clearAllNotifications,
        markAllSupplierNotificationsAsRead,
        clearSupplierNotifications,
        addNotification,
        triggerConfetti,
        showToast,
        toasts,
        removeToast,
        calculateFee,
        executePurchase,
        executeBalanceTransfer,
        submitDepositRequest,
        saveSupplierBankAccount,
        saveBatchBankAccounts,
        toggleBankAccountTransferPrivilege,
        deleteSupplierBankAccount,
        confirmDepositReceiptByReceiver,
        confirmLoanRepaymentReceiptByReceiver,
        approveDepositRequest,
        rejectDepositRequest,
        markLoanAsRepaid,
        payLoanFromWallet,
        submitLoanRepaymentRequest,
        approveLoanRepaymentRequest,
        rejectLoanRepaymentRequest,
        grantSupplierBalanceOrLoan,
        completeSupplierOrder,
        rejectSupplierOrder,
        sendSupplierReplyToClient,
        confirmClientOtpRead,
        updatePosTier,
        togglePosLoanPrivilege,
        togglePosReceiveTransfersPrivilege,
        togglePosBonusPrivilege,
        togglePosGiftsPrivilege,
        togglePosAccreditedPrivilege,
        togglePosClientActiveStatus,
        deletePosClient,
        updatePosProfile,
        updateSupplierProfile,
        createInviteLink,
        toggleInviteLinkActiveStatus,
        deleteInviteLink,
        addCatalog,
        updateCatalog,
        deleteCatalog,
        addService,
        updateService,
        deleteService,
        createVoucherWarehouse,
        addCodesToWarehouse,
        removeCodeFromWarehouse,
        updateVoucherWarehouse,
        setWarehouseLowStockThreshold,
        publishWarehouseAsService,
        unpublishWarehouseFromService,
        deleteVoucherWarehouse,
        platformSettings,
        updatePlatformInterfaceSettings,
        addFixedCatalogByAdmin,
        updateFixedCatalogByAdmin,
        deleteFixedCatalogByAdmin,
        addDropdownOption,
        updateDropdownOption,
        deleteDropdownOption,
        addSupplier,
        updateSupplierFeeConfig,
        adminUpdateSupplier,
        toggleSupplierActiveStatus,
        updateGlobalFeeConfig,
        adminSettleBank,
        adminTransferToAgent,
        addOfficeEmployee,
        updateOfficeEmployee,
        removeOfficeEmployee,
        addAdminAccount,
        updateAdminAccount,
        removeAdminAccount
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
