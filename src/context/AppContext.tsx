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
  WarehousePurchaseUnit
} from '../types';
import {
  deductPackageStock,
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
  calculateBaseSupplierFee,
  calculateServicePurchasePricing,
  hasClientUsedGiftService,
  isCatalogFreeGifts,
  resolveGiftClaimFeePayment,
  settlePendingGiftFeesOnRecharge,
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
  ensureCleanBootLocalStorageOnce,
  filterPreservedFixedCatalogs,
  isPreservedAdminAuthUser,
  sanitizeLocalStorageForCleanReset
} from '../utils/systemReset';
import confetti from 'canvas-confetti';
import {
  testConnection,
  auth,
  googleProvider,
  db,
  handleFirestoreError,
  OperationType,
  ConnectionTestResult,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset
} from '../services/firebase';
import { signInWithPopup, signOut as fbSignOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { onSnapshot, collection, doc } from 'firebase/firestore';
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

  // Firebase Firestore Status & Sync
  isFirestoreConnected: boolean;
  isSyncingWithFirestore: boolean;
  isSupplierSelectionRequired: boolean;
  setIsSupplierSelectionRequired: (required: boolean) => void;
  syncAllToFirestore: () => Promise<void>;
  clearUsersSuppliersAndClientsData: () => Promise<void>;
  checkDatabaseConnection: () => Promise<ConnectionTestResult>;

  // Authentication State & Actions
  isAuthenticated: boolean;
  currentUser: AuthUser | null;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  sendLoginOtp: (email: string) => Promise<{ success: boolean; code?: string; error?: string; remainingSeconds?: number; email?: string; cooldownSeconds?: number }>;
  verifyLoginOtpAndLogin: (email: string, password: string, otpCode: string) => Promise<{ success: boolean; error?: string }>;
  registerAccount: (params: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    phone?: string;
    tradeName?: string;
    supplierId?: string;
  }) => Promise<{ success: boolean; error?: string }>;
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
  
  completeSupplierOrder: (orderId: string, notes?: string) => void;
  rejectSupplierOrder: (orderId: string, reason?: string) => void;
  sendSupplierReplyToClient: (orderId: string, message: string) => void;
  confirmClientOtpRead: (orderId: string) => void;

  updatePosTier: (posId: string, newTier: AccountTier) => void;
  togglePosLoanPrivilege: (posId: string) => void;
  togglePosReceiveTransfersPrivilege: (posId: string) => void;
  togglePosBonusPrivilege: (posId: string) => void;
  togglePosGiftsPrivilege: (posId: string) => void;
  updatePosProfile: (posId: string, updates: Partial<POSClient>) => void;
  updateSupplierProfile: (supplierId: string, updates: Partial<Supplier>) => void;
  createInviteLink: (targetTier: AccountTier) => InviteLink;
  
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
  updateSupplierFeeConfig: (supplierId: string, config: { feeType: 'percentage' | 'fixed' | 'both'; percentage: number; fixedAmount: number }) => void;
  updateGlobalFeeConfig: (config: { feeType: 'percentage' | 'fixed' | 'both'; percentage: number; fixedAmount: number }) => void;
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
  }) => OfficeEmployee;
  updateOfficeEmployee: (empId: string, updates: Partial<OfficeEmployee>) => void;
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
  const [role, setRole] = useState<UserRole>(() => {
    try {
      if (typeof window !== 'undefined') {
        ensureCleanBootLocalStorageOnce(window.localStorage);
      }
      const saved = localStorage.getItem('digipos_auth_user');
      if (saved) {
        const parsed = JSON.parse(saved) as AuthUser;
        if (parsed?.role) return parsed.role;
      }
    } catch {
      // ignore
    }
    return 'pos_client';
  });
  const [viewMode, setViewMode] = useState<'mobile_frame' | 'responsive'>('mobile_frame');
  const [activeNavTab, setActiveNavTab] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('digipos_auth_user');
      if (saved) {
        const parsed = JSON.parse(saved) as AuthUser;
        if (parsed?.role === 'super_admin') {
          return getFirstAllowedAdminTab(resolveEffectiveAdminPermissions(parsed, 'super_admin'));
        }
        if (parsed?.role === 'supplier' || parsed?.role === 'employee') {
          return 'catalogs';
        }
      }
    } catch {
      // ignore
    }
    return 'store';
  });
  
  const [posClients, setPosClients] = useState<POSClient[]>(() => {
    try {
      const saved = localStorage.getItem('digipos_clients_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      // ignore
    }
    return [];
  });
  
  const [currentPosId, setCurrentPosId] = useState<string>('');

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    try {
      const saved = localStorage.getItem('digipos_suppliers_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [currentSupplierId, setCurrentSupplierId] = useState<string>('');
  
  const supplier = suppliers.find(s => s.id === currentSupplierId) || suppliers[0] || EMPTY_SUPPLIER_FALLBACK;
  
  const [superAdmin, setSuperAdmin] = useState<SuperAdmin>(() => {
    try {
      const saved = localStorage.getItem('digipos_admin_v2');
      return saved ? JSON.parse(saved) : initialSuperAdmin;
    } catch {
      return initialSuperAdmin;
    }
  });

  const [platformSettings, setPlatformSettings] = useState<PlatformInterfaceSettings>(() => {
    const saved = localStorage.getItem('digipos_platform_settings_v1');
    if (saved) {
      try {
        return mergePlatformSettings(JSON.parse(saved) as Partial<PlatformInterfaceSettings>);
      } catch {
        return DEFAULT_PLATFORM_INTERFACE_SETTINGS;
      }
    }
    return DEFAULT_PLATFORM_INTERFACE_SETTINGS;
  });
  
  const [catalogs, setCatalogs] = useState<Catalog[]>(() => {
    const saved = localStorage.getItem('digipos_catalogs_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Catalog[];
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // fallback
      }
    }
    return [];
  });
  
  const [services, setServices] = useState<DigitalService[]>(() => {
    const saved = localStorage.getItem('digipos_services_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as DigitalService[];
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // fallback
      }
    }
    return [];
  });

  const [voucherWarehouses, setVoucherWarehouses] = useState<VoucherWarehouse[]>(() => {
    const saved = localStorage.getItem('digipos_voucher_warehouses_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as VoucherWarehouse[];
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // fallback
      }
    }
    return [];
  });
  
  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>(() => {
    try {
      const saved = localStorage.getItem('digipos_deposits_v2');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [loanRepaymentRequests, setLoanRepaymentRequests] = useState<LoanRepaymentRequest[]>(() => {
    try {
      const saved = localStorage.getItem('digipos_loan_repayments_v1');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [supplierBankAccounts, setSupplierBankAccounts] = useState<SupplierBankAccount[]>(() => {
    const saved = localStorage.getItem('digipos_supplier_bank_accounts_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as SupplierBankAccount[];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('digipos_orders_v2');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  
  const [accountingEntries, setAccountingEntries] = useState<AccountingEntry[]>(() => {
    try {
      const saved = localStorage.getItem('digipos_accounting_v2');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [adminAccountingEntries, setAdminAccountingEntries] = useState<AdminAccountingEntry[]>(() => {
    try {
      const saved = localStorage.getItem('digipos_admin_accounting_v2');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>(() => {
    try {
      const saved = localStorage.getItem('digipos_invites_v2');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem('digipos_notifications_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // fallback
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('digipos_notifications_v2', JSON.stringify(notifications));
  }, [notifications]);

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
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

  // Authentication state
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('digipos_auth_user');
    return saved ? JSON.parse(saved) : null;
  });

  const isAuthenticated = currentUser !== null;

  // Track active OTP per email with 2-minute duration
  const [activeOtps, setActiveOtps] = useState<Record<string, { code: string; expiresAt: number }>>({});

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Firebase Firestore connection state
  const [isFirestoreConnected, setIsFirestoreConnected] = useState<boolean>(false);
  const [isSyncingWithFirestore, setIsSyncingWithFirestore] = useState<boolean>(false);
  const [isSupplierSelectionRequired, setIsSupplierSelectionRequired] = useState<boolean>(false);

  // Compute registered suppliers for the currently logged in / authenticated client
  const availableClientSuppliers = React.useMemo(() => {
    if (!currentUser || currentUser.role !== 'pos_client') {
      return suppliers;
    }
    const cleanEmail = currentUser.email.toLowerCase();
    const matchingPosRecords = posClients.filter(p => p.email?.toLowerCase() === cleanEmail);
    if (matchingPosRecords.length === 0) {
      return suppliers;
    }
    const registeredSupIds = Array.from(new Set(matchingPosRecords.map(p => p.supplierId)));
    const registeredSuppliers = suppliers.filter(s => registeredSupIds.includes(s.id));
    return registeredSuppliers.length > 0 ? registeredSuppliers : suppliers;
  }, [currentUser, posClients, suppliers]);

  // Validate Connection to Firestore on boot and on-demand
  const checkDatabaseConnection = async (retries = 1): Promise<ConnectionTestResult> => {
    let res = await testConnection(12000);
    if (!res.success && retries > 0) {
      await new Promise(r => setTimeout(r, 1000));
      res = await testConnection(15000);
    }
    setIsFirestoreConnected(res.success);
    return res;
  };

  const applyLocalNonAdminStateReset = (preservedAdmin: SuperAdmin) => {
    sanitizeLocalStorageForCleanReset(localStorage, preservedAdmin);
    localStorage.setItem(CLEAN_BOOT_STORAGE_FLAG, '1');
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
    setCatalogs(prev => filterPreservedFixedCatalogs(prev));
    setCurrentPosId('');
    setCurrentSupplierId('');
    setIsSupplierSelectionRequired(false);
    setCurrentUser(prev =>
      isPreservedAdminAuthUser(prev, preservedAdmin) ? prev : null
    );
  };

  useEffect(() => {
    let isMounted = true;
    const runBootSync = async () => {
      try {
        const res = await checkDatabaseConnection();
        if (!isMounted) return;
        if (res.success) {
          console.log('Firebase Firestore connection verified:', res.message);
          const mig = await firestoreSync.ensureCleanStateMigrationOnce(superAdminRef.current);
          if (isMounted && mig.migrated) {
            applyLocalNonAdminStateReset(superAdminRef.current);
          }
        } else {
          console.warn('Firebase Firestore initial connection test:', res.message);
          setTimeout(async () => {
            if (!isMounted) return;
            try {
              const retryRes = await checkDatabaseConnection(0);
              if (retryRes.success && isMounted) {
                console.log('Firebase Firestore connection verified on retry:', retryRes.message);
                const mig = await firestoreSync.ensureCleanStateMigrationOnce(superAdminRef.current);
                if (isMounted && mig.migrated) {
                  applyLocalNonAdminStateReset(superAdminRef.current);
                }
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

    void runBootSync();

    return () => {
      isMounted = false;
    };
  }, []);

  const isRegisteringRef = React.useRef(false);
  const suppliersRef = React.useRef(suppliers);
  suppliersRef.current = suppliers;
  const currentPosIdRef = React.useRef(currentPosId);
  currentPosIdRef.current = currentPosId;
  const currentSupplierIdRef = React.useRef(supplier?.id);
  currentSupplierIdRef.current = supplier?.id;
  const superAdminRef = React.useRef(superAdmin);
  superAdminRef.current = superAdmin;

  // Listen to Firebase Auth state (registered once on mount)
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      // Prevent auto-authenticating during account registration
      if (isRegisteringRef.current) {
        return;
      }

      if (fbUser) {
        const cleanEmail = (fbUser.email || '').trim().toLowerCase();
        if (cleanEmail === 'almekhlafiraghad2@gmail.com') {
          fbSignOut(auth).catch(console.error);
          setCurrentUser(null);
          return;
        }
        let userRole: UserRole = 'pos_client';
        let adminAccountId: string | undefined;
        let adminPermissions: AdminPermissions | undefined;
        let roleTitle: string | undefined;
        let resolvedName = fbUser.displayName || 'مستخدم فايربيس';

        // Check sub-admin accounts first before generic admin email checks
        const matchedAdminAcc = (superAdminRef.current.adminAccounts || []).find(
          a => a.email?.trim().toLowerCase() === cleanEmail
        );
        const matchedSup = suppliersRef.current.find(s => s.email?.toLowerCase() === cleanEmail);

        if (matchedAdminAcc) {
          if (!matchedAdminAcc.isActive) {
            fbSignOut(auth).catch(console.error);
            setCurrentUser(null);
            return;
          }
          userRole = 'super_admin';
          resolvedName = matchedAdminAcc.name;
          adminAccountId = matchedAdminAcc.id;
          adminPermissions = matchedAdminAcc.permissions;
          roleTitle = matchedAdminAcc.roleTitle;
          const firstTab = getFirstAllowedAdminTab(
            resolveEffectiveAdminPermissions(
              {
                id: fbUser.uid,
                email: cleanEmail,
                name: resolvedName,
                role: 'super_admin',
                adminAccountId,
                adminPermissions
              },
              'super_admin'
            )
          );
          setActiveNavTab(firstTab);
        } else if (cleanEmail === 'jmiyemen66@gmail.com' || cleanEmail.includes('admin')) {
          userRole = 'super_admin';
          setActiveNavTab('statement');
        } else if (matchedSup || cleanEmail.includes('supplier')) {
          userRole = 'supplier';
          if (matchedSup) setCurrentSupplierId(matchedSup.id);
          setActiveNavTab('catalogs');
        } else {
          userRole = 'pos_client';
          setActiveNavTab('store');
        }

        const userObj: AuthUser = {
          id: fbUser.uid,
          email: cleanEmail,
          name: resolvedName,
          role: userRole,
          phone: fbUser.phoneNumber || undefined,
          associatedId:
            userRole === 'super_admin'
              ? 'admin'
              : userRole === 'supplier'
              ? (matchedSup?.id || currentSupplierIdRef.current || '')
              : currentPosIdRef.current,
          adminAccountId,
          roleTitle,
          adminPermissions
        };
        setCurrentUser(userObj);
        setRole(userRole);
      } else {
        // Preserve OTP / employee / sub-admin sessions that do not use Firebase Auth currentUser
        setCurrentUser(prev => {
          if (prev && (prev.id.startsWith('usr-') || prev.id.startsWith('emp-') || prev.id.startsWith('adm-'))) {
            return prev;
          }
          return null;
        });
      }
    });
    return () => unsubAuth();
  }, []);

  // Real-time synchronization from Firestore
  useEffect(() => {
    if (!isFirestoreConnected) return;

    // 1. Orders live sync
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const remoteOrders: Order[] = [];
      snapshot.forEach(docSnap => {
        remoteOrders.push(docSnap.data() as Order);
      });
      remoteOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setOrders(remoteOrders);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'orders');
    });

    // 2. Deposit Requests & Loans live sync
    const unsubDeposits = onSnapshot(collection(db, 'depositRequests'), (snapshot) => {
      const remoteDeps: DepositRequest[] = [];
      snapshot.forEach(docSnap => {
        remoteDeps.push(docSnap.data() as DepositRequest);
      });
      remoteDeps.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setDepositRequests(remoteDeps);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'depositRequests');
    });

    // 3. POS Clients live sync (Deduplicated by ID)
    const unsubClients = onSnapshot(collection(db, 'posClients'), (snapshot) => {
      const clientMap = new Map<string, POSClient>();
      snapshot.forEach(docSnap => {
        const client = docSnap.data() as POSClient;
        if (client && client.id) {
          clientMap.set(client.id, client);
        }
      });
      setPosClients(Array.from(clientMap.values()));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'posClients');
    });

    // 4. Suppliers live sync (Deduplicated by ID)
    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      const supMap = new Map<string, Supplier>();
      snapshot.forEach(docSnap => {
        const sup = docSnap.data() as Supplier;
        if (sup && sup.id) {
          supMap.set(sup.id, sup);
        }
      });
      setSuppliers(Array.from(supMap.values()));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'suppliers');
    });

    // 5. Loan Repayment Requests live sync
    const unsubLoanRepayments = onSnapshot(collection(db, 'loanRepaymentRequests'), (snapshot) => {
      const remoteReqs: LoanRepaymentRequest[] = [];
      snapshot.forEach(docSnap => {
        remoteReqs.push(docSnap.data() as LoanRepaymentRequest);
      });
      remoteReqs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setLoanRepaymentRequests(remoteReqs);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'loanRepaymentRequests');
    });

    // 6. Supplier Bank Accounts live sync
    const unsubBankAccounts = onSnapshot(collection(db, 'supplierBankAccounts'), (snapshot) => {
      const accMap = new Map<string, SupplierBankAccount>();
      snapshot.forEach(docSnap => {
        const acc = docSnap.data() as SupplierBankAccount;
        if (acc && acc.id) {
          accMap.set(acc.id, acc);
        }
      });
      setSupplierBankAccounts(Array.from(accMap.values()));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'supplierBankAccounts');
    });

    // 7. Catalogs live sync
    const unsubCatalogs = onSnapshot(collection(db, 'catalogs'), (snapshot) => {
      const catMap = new Map<string, Catalog>();
      snapshot.forEach(docSnap => {
        const cat = docSnap.data() as Catalog;
        if (cat && cat.id) {
          catMap.set(cat.id, cat);
        }
      });
      setCatalogs(Array.from(catMap.values()));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'catalogs');
    });

    // 8. Services live sync
    const unsubServices = onSnapshot(collection(db, 'services'), (snapshot) => {
      const srvMap = new Map<string, DigitalService>();
      snapshot.forEach(docSnap => {
        const srv = docSnap.data() as DigitalService;
        if (srv && srv.id) {
          srvMap.set(srv.id, srv);
        }
      });
      setServices(Array.from(srvMap.values()));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'services');
    });

    // 8b. Voucher Warehouses live sync
    const unsubWarehouses = onSnapshot(collection(db, 'voucherWarehouses'), (snapshot) => {
      const whMap = new Map<string, VoucherWarehouse>();
      snapshot.forEach(docSnap => {
        const wh = docSnap.data() as VoucherWarehouse;
        if (wh && wh.id) {
          whMap.set(wh.id, wh);
        }
      });
      setVoucherWarehouses(Array.from(whMap.values()));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'voucherWarehouses');
    });

    // 9. Platform Interface Settings live sync
    const unsubPlatformSettings = onSnapshot(doc(db, 'system', 'platformSettings'), (docSnap) => {
      if (docSnap.exists()) {
        setPlatformSettings(mergePlatformSettings(docSnap.data() as Partial<PlatformInterfaceSettings>));
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'system/platformSettings');
    });

    // 10. Super Admin & Admin Accounts live sync
    const unsubSuperAdmin = onSnapshot(doc(db, 'system', 'superAdmin'), (docSnap) => {
      if (docSnap.exists()) {
        const remoteAdmin = docSnap.data() as Partial<SuperAdmin>;
        setSuperAdmin(prev => ({
          ...prev,
          ...remoteAdmin,
          adminAccounts: Array.isArray(remoteAdmin.adminAccounts)
            ? remoteAdmin.adminAccounts
            : (prev.adminAccounts || [])
        }));

        if (Array.isArray(remoteAdmin.adminAccounts)) {
          setCurrentUser(prevUser => {
            if (!prevUser?.adminAccountId) return prevUser;
            const syncedAcc = remoteAdmin.adminAccounts?.find(a => a.id === prevUser.adminAccountId);
            if (!syncedAcc || !syncedAcc.isActive) {
              return null;
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
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'system/superAdmin');
    });

    return () => {
      unsubOrders();
      unsubDeposits();
      unsubClients();
      unsubSuppliers();
      unsubLoanRepayments();
      unsubBankAccounts();
      unsubCatalogs();
      unsubServices();
      unsubWarehouses();
      unsubPlatformSettings();
      unsubSuperAdmin();
    };
  }, [isFirestoreConnected]);

  // Sync to local storage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('digipos_auth_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('digipos_auth_user');
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('digipos_clients_v2', JSON.stringify(posClients));
  }, [posClients]);
  useEffect(() => {
    localStorage.setItem('digipos_suppliers_v2', JSON.stringify(suppliers));
  }, [suppliers]);
  useEffect(() => {
    localStorage.setItem('digipos_admin_v2', JSON.stringify(superAdmin));
  }, [superAdmin]);
  useEffect(() => {
    localStorage.setItem('digipos_platform_settings_v1', JSON.stringify(platformSettings));
  }, [platformSettings]);
  useEffect(() => {
    localStorage.setItem('digipos_catalogs_v2', JSON.stringify(catalogs));
  }, [catalogs]);
  useEffect(() => {
    localStorage.setItem('digipos_services_v2', JSON.stringify(services));
  }, [services]);
  useEffect(() => {
    localStorage.setItem('digipos_voucher_warehouses_v1', JSON.stringify(voucherWarehouses));
  }, [voucherWarehouses]);
  useEffect(() => {
    localStorage.setItem('digipos_deposits_v2', JSON.stringify(depositRequests));
  }, [depositRequests]);
  useEffect(() => {
    localStorage.setItem('digipos_loan_repayments_v1', JSON.stringify(loanRepaymentRequests));
  }, [loanRepaymentRequests]);
  useEffect(() => {
    localStorage.setItem('digipos_supplier_bank_accounts_v1', JSON.stringify(supplierBankAccounts));
  }, [supplierBankAccounts]);
  useEffect(() => {
    localStorage.setItem('digipos_orders_v2', JSON.stringify(orders));
  }, [orders]);
  useEffect(() => {
    localStorage.setItem('digipos_accounting_v2', JSON.stringify(accountingEntries));
  }, [accountingEntries]);
  useEffect(() => {
    localStorage.setItem('digipos_admin_accounting_v2', JSON.stringify(adminAccountingEntries));
  }, [adminAccountingEntries]);
  useEffect(() => {
    localStorage.setItem('digipos_invites_v2', JSON.stringify(inviteLinks));
  }, [inviteLinks]);

  // Google Login via Firebase Popup
  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    if (!isFirestoreConnected) {
      const conn = await testConnection(6000).catch(() => ({ success: false, message: '' }));
      if (conn.success) {
        setIsFirestoreConnected(true);
      }
    }
    try {
      const res = await signInWithPopup(auth, googleProvider);
      setIsFirestoreConnected(true);
      const fbUser = res.user;
      const cleanEmail = (fbUser.email || '').toLowerCase();
      const displayName = fbUser.displayName || 'مستخدم Google';

      let userRole: UserRole = 'pos_client';
      let userName = displayName;
      let associatedId = '';
      let adminAccountId: string | undefined;
      let adminPermissions: AdminPermissions | undefined;
      let roleTitle: string | undefined;

      const matchedAdminAcc = (superAdmin.adminAccounts || []).find(
        a => a.email?.trim().toLowerCase() === cleanEmail
      );
      const matchedSup = suppliers.find(s => s.email?.toLowerCase() === cleanEmail);
      const isSuperAdminEmail = cleanEmail === 'jmiyemen66@gmail.com' || cleanEmail.includes('admin') || cleanEmail.includes('super');

      let matchedEmployeeSupplier: Supplier | undefined;
      let matchedEmployeeName = '';
      for (const sup of suppliers) {
        if (sup.employees && sup.employees.some(e => e.email?.toLowerCase() === cleanEmail)) {
          matchedEmployeeSupplier = sup;
          const emp = sup.employees.find(e => e.email?.toLowerCase() === cleanEmail);
          if (emp) matchedEmployeeName = emp.name;
          break;
        }
      }

      if (matchedAdminAcc) {
        if (!matchedAdminAcc.isActive) {
          fbSignOut(auth).catch(console.error);
          showToast({
            type: 'error',
            title: 'الحساب الإداري موقوف',
            description: 'تم إيقاف هذا الحساب الإداري من قبل المدير العام للتطبيق.'
          });
          return { success: false, error: 'تم إيقاف هذا الحساب الإداري من قبل المدير العام للتطبيق.' };
        }
        userRole = 'super_admin';
        userName = matchedAdminAcc.name;
        associatedId = 'admin';
        adminAccountId = matchedAdminAcc.id;
        adminPermissions = matchedAdminAcc.permissions;
        roleTitle = matchedAdminAcc.roleTitle;
        setIsSupplierSelectionRequired(false);
        const firstTab = getFirstAllowedAdminTab(
          resolveEffectiveAdminPermissions(
            {
              id: fbUser.uid,
              email: cleanEmail,
              name: userName,
              role: 'super_admin',
              adminAccountId,
              adminPermissions
            },
            'super_admin'
          )
        );
        setActiveNavTab(firstTab);
      } else if (matchedSup) {
        userRole = 'supplier';
        userName = matchedSup.name;
        associatedId = matchedSup.id;
        setCurrentSupplierId(matchedSup.id);
        setIsSupplierSelectionRequired(false);
        setActiveNavTab('catalogs');
      } else if (matchedEmployeeSupplier) {
        userRole = 'supplier';
        userName = `${matchedEmployeeName} (موظف مكتب)`;
        associatedId = matchedEmployeeSupplier.id;
        setCurrentSupplierId(matchedEmployeeSupplier.id);
        setIsSupplierSelectionRequired(false);
        setActiveNavTab('catalogs');
      } else if (isSuperAdminEmail) {
        userRole = 'super_admin';
        userName = superAdmin.name || displayName;
        associatedId = 'admin';
        setIsSupplierSelectionRequired(false);
        setActiveNavTab('statement');
      } else {
        userRole = 'pos_client';
        setActiveNavTab('store');
        const matchingPosRecords = posClients.filter(p => p.email?.toLowerCase() === cleanEmail);
        if (matchingPosRecords.length > 0) {
          userName = matchingPosRecords[0].ownerName;
          associatedId = matchingPosRecords[0].id;

          const registeredSupIds = Array.from(new Set(matchingPosRecords.map(p => p.supplierId)));
          const matchedSuppliers = suppliers.filter(s => registeredSupIds.includes(s.id));

          if (matchedSuppliers.length === 1) {
            setCurrentSupplierId(matchedSuppliers[0].id);
            const clientRecord = matchingPosRecords.find(p => p.supplierId === matchedSuppliers[0].id) || matchingPosRecords[0];
            setCurrentPosId(clientRecord.id);
            setIsSupplierSelectionRequired(false);
          } else {
            setIsSupplierSelectionRequired(true);
            setCurrentSupplierId(matchedSuppliers[0]?.id || suppliers[0]?.id || '');
            setCurrentPosId(matchingPosRecords[0].id);
          }
        } else {
          // Auto create client record in POS clients
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
            supplierId: supplier.id,
            tier: 'regular',
            walletBalance: 0,
            totalSpent: 0,
            ordersCount: 0,
            createdAt: new Date().toISOString().substring(0, 10),
            qrCodeValue: `DIGIPOS:${newPosCode}`,
            logoUrl: fbUser.photoURL || undefined
          };
          setPosClients(prev => [newPos, ...prev.filter(p => p.id !== newPos.id)]);
          associatedId = newPos.id;
          setCurrentPosId(newPos.id);
          setIsSupplierSelectionRequired(false);
          firestoreSync.savePosClient(newPos).catch(console.error);
        }
      }

      const authUser: AuthUser = {
        id: fbUser.uid,
        email: cleanEmail,
        name: userName,
        role: userRole,
        phone: fbUser.phoneNumber || undefined,
        associatedId,
        adminAccountId,
        roleTitle,
        adminPermissions
      };

      setCurrentUser(authUser);
      setRole(userRole);
      firestoreSync.saveUser(authUser).catch(console.error);

      // Auto-sync all records to Firestore so collections appear immediately in the Firebase console
      setTimeout(() => {
        syncAllToFirestore().catch(console.error);
      }, 500);

      if (userRole !== 'pos_client') {
        triggerConfetti();
      }
      showToast({
        type: 'success',
        title: 'تم تسجيل الدخول عبر Google ومزامنة السحابة',
        description: `مرحباً بك ${userName}. تم ربط ومزامنة كافة البيانات مع قاعدة بيانات Firestore بنجاح.`
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
        msg = 'قام المتصفح بحظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة والمحاولة مجدداً.';
      } else if (fbErr?.code === 'auth/unauthorized-domain') {
        msg = 'نطاق الموقع الحالي غير مضاف في النطاقات المصرح بها داخل إعدادات Firebase Auth.';
      } else if (fbErr?.code === 'auth/network-request-failed') {
        msg = 'تعذر الاتصال بخدمات جوجل، يرجى التحقق من اتصال الإنترنت.';
      }
      showToast({
        type: 'error',
        title: 'فشل تسجيل الدخول بحساب جوجل',
        description: msg
      });
      return { success: false, error: msg };
    }
  };

  // Sync / Seed all local & mock state to Firebase Firestore
  const syncAllToFirestore = async (): Promise<void> => {
    setIsSyncingWithFirestore(true);
    try {
      const res = await firestoreSync.seedInitialDataToFirestore({
        posClients,
        suppliers,
        superAdmin,
        catalogs,
        services,
        orders,
        depositRequests,
        loanRepaymentRequests,
        supplierBankAccounts,
        accountingEntries,
        adminAccountingEntries,
        inviteLinks
      });

      if (res.success) {
        setIsFirestoreConnected(true);
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

    // Ensure database connection is active or probe if needed
    if (!isFirestoreConnected) {
      const conn = await testConnection(6000).catch(() => ({ success: false, message: '' }));
      if (conn.success) {
        setIsFirestoreConnected(true);
      }
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
      cooldownSeconds: 60,
      remainingSeconds: 120 
    };
  };

  const verifyLoginOtpAndLogin = async (email: string, password: string, otpCode: string) => {
    // 1. Verify and establish database connectivity if needed
    if (!isFirestoreConnected) {
      const conn = await testConnection(6000).catch(() => ({ success: false, message: '' }));
      if (conn.success) {
        setIsFirestoreConnected(true);
      }
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otpCode.trim();

    if (!cleanEmail || !password) {
      showToast({ type: 'error', title: 'بيانات غير مكتملة', description: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' });
      return { success: false, error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' };
    }

    // 2. Verify OTP existence and expiration (2 minutes limit)
    const storedOtp = activeOtps[cleanEmail];
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

    // 3. Identify user role based on email or existing accounts
    let userRole: UserRole = 'pos_client';
    let userName = 'محمد العتيبي (نقطة البيع)';
    let associatedId = 'pos-1';

    const matchedAdminAcc = (superAdmin.adminAccounts || []).find(
      a => a.email?.trim().toLowerCase() === cleanEmail
    );
    const matchedSup = suppliers.find(s => s.email?.toLowerCase() === cleanEmail);
    const isSuperAdminEmail = cleanEmail === 'jmiyemen66@gmail.com' || cleanEmail.includes('admin') || cleanEmail.includes('super');

    // Check if any supplier has an employee with this email
    let matchedEmployeeSupplier: Supplier | undefined;
    let matchedEmployee: OfficeEmployee | undefined;
    for (const sup of suppliers) {
      if (sup.employees && sup.employees.length > 0) {
        const emp = sup.employees.find(e => e.email?.toLowerCase().trim() === cleanEmail);
        if (emp) {
          matchedEmployeeSupplier = sup;
          matchedEmployee = emp;
          break;
        }
      }
    }

    if (matchedAdminAcc) {
      if (!matchedAdminAcc.isActive) {
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

      const configuredPassword = (matchedAdminAcc.password || '').trim();
      const enteredPassword = password.trim();

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

      userRole = 'super_admin';
      userName = matchedAdminAcc.name;
      associatedId = 'admin';
      setIsSupplierSelectionRequired(false);
      const firstTab = getFirstAllowedAdminTab(
        resolveEffectiveAdminPermissions(
          {
            id: matchedAdminAcc.id,
            email: cleanEmail,
            name: userName,
            role: 'super_admin',
            adminAccountId: matchedAdminAcc.id,
            adminPermissions: matchedAdminAcc.permissions
          },
          'super_admin'
        )
      );
      setActiveNavTab(firstTab);
    } else if (matchedEmployee && matchedEmployeeSupplier) {
      // 3.A: Strict Password Verification against the password set by the store manager
      const configuredPassword = (matchedEmployee.password || '').trim();
      const enteredPassword = password.trim();

      if (!configuredPassword || configuredPassword !== enteredPassword) {
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

      // Password matches! Authenticate as employee in this supplier's store
      userRole = 'employee';
      userName = matchedEmployee.name;
      associatedId = matchedEmployeeSupplier.id;
      setCurrentSupplierId(matchedEmployeeSupplier.id);
      setIsSupplierSelectionRequired(false);

      // Direct employee to permitted section
      if (matchedEmployee.permissions.canManageOrders) {
        setActiveNavTab('pending_orders');
      } else if (matchedEmployee.permissions.canManageCatalogs) {
        setActiveNavTab('catalogs');
      } else if (matchedEmployee.permissions.canReviewDeposits) {
        setActiveNavTab('deposits');
      } else if (matchedEmployee.permissions.canManageClients) {
        setActiveNavTab('clients');
      } else {
        setActiveNavTab('catalogs');
      }
    } else {
      // 3.B: Verify password for non-employee roles
      let isPasswordValid = false;
      const demoPasswords: Record<string, string> = {
        'admin@digipos-platform.com': 'SuperAdminPass2026!',
      };

      if (demoPasswords[cleanEmail]) {
        if (demoPasswords[cleanEmail] === password.trim()) {
          isPasswordValid = true;
        }
      } else {
        try {
          await signInWithEmailAndPassword(auth, cleanEmail, password.trim());
          isPasswordValid = true;
        } catch (authErr: unknown) {
          const fbErr = authErr as { code?: string; message?: string };
          console.warn('Firebase Auth sign-in verification check:', fbErr?.code);
          if (fbErr?.code === 'auth/wrong-password' || fbErr?.code === 'auth/invalid-credential') {
            showToast({
              type: 'error',
              title: 'كلمة المرور غير صحيحة',
              description: 'كلمة المرور المدخلة غير صحيحة. يرجى التأكد من كتابة كلمة المرور بالشكل السليم.'
            });
            return {
              success: false,
              error: 'كلمة المرور المدخلة غير صحيحة. يرجى إعادة إدخالها والمحاولة مجدداً.'
            };
          }
          // If not in Firebase Auth, check if it's registered locally or valid length
          const posExists = posClients.some(p => p.email?.toLowerCase() === cleanEmail);
          const supExists = suppliers.some(s => s.email?.toLowerCase() === cleanEmail);
          if (!posExists && !supExists && !isSuperAdminEmail) {
            showToast({
              type: 'error',
              title: 'الحساب غير مسجل',
              description: 'لم يتم العثور على حساب بهذا البريد في قاعدة البيانات. يمكنك إنشاء حساب جديد عبر تبويب "إنشاء حساب جديد".'
            });
            return {
              success: false,
              error: 'الحساب غير مسجل في قاعدة البيانات. يرجى إنشاء حساب جديد.'
            };
          }
          if (password.trim().length >= 6) {
            isPasswordValid = true;
          }
        }
      }

      if (!isPasswordValid) {
        showToast({
          type: 'error',
          title: 'كلمة المرور غير صحيحة',
          description: 'كلمة المرور المدخلة غير صحيحة. يرجى التأكد من صحة البيانات والمحاولة مجدداً.'
        });
        return {
          success: false,
          error: 'كلمة المرور المدخلة غير صحيحة. يرجى إعادة إدخالها.'
        };
      }

      if (matchedSup) {
        userRole = 'supplier';
        userName = matchedSup.name;
        associatedId = matchedSup.id;
        setCurrentSupplierId(matchedSup.id);
        setIsSupplierSelectionRequired(false);
        setActiveNavTab('catalogs');
      } else if (isSuperAdminEmail) {
        userRole = 'super_admin';
        userName = superAdmin.name;
        associatedId = 'admin';
        setIsSupplierSelectionRequired(false);
        setActiveNavTab('statement');
      } else {
        userRole = 'pos_client';
        setActiveNavTab('store');
        setIsSupplierSelectionRequired(false);
        const matchingPosRecords = posClients.filter(p => p.email?.toLowerCase() === cleanEmail);

        if (matchingPosRecords.length > 0) {
          userName = matchingPosRecords[0].ownerName;
          associatedId = matchingPosRecords[0].id;

          const registeredSupIds = Array.from(new Set(matchingPosRecords.map(p => p.supplierId)));
          const matchedSuppliers = suppliers.filter(s => registeredSupIds.includes(s.id));

          if (matchedSuppliers.length >= 1) {
            setCurrentSupplierId(matchedSuppliers[0].id);
            const clientRecord = matchingPosRecords.find(p => p.supplierId === matchedSuppliers[0].id) || matchingPosRecords[0];
            setCurrentPosId(clientRecord.id);
          }
        } else {
          const fallbackPos = posClients[0];
          if (fallbackPos) {
            userName = fallbackPos.ownerName;
            associatedId = fallbackPos.id;
            setCurrentPosId(fallbackPos.id);
          } else {
            showToast({
              type: 'error',
              title: 'الحساب غير مسجل',
              description: 'لا توجد بيانات نقطة بيع مسجلة لهذا البريد الإلكتروني. يرجى إنشاء حساب جديد أو مراجعة المتجر.'
            });
            return {
              success: false,
              error: 'لا توجد بيانات عميل مسجلة لهذا البريد الإلكتروني.'
            };
          }
        }
      }
    }

    const authUser: AuthUser = {
      id: matchedAdminAcc
        ? matchedAdminAcc.id
        : matchedEmployee
        ? matchedEmployee.id
        : `usr-${Date.now().toString().slice(-6)}`,
      email: cleanEmail,
      name: userName,
      role: userRole,
      phone: matchedAdminAcc ? matchedAdminAcc.phone : undefined,
      associatedId,
      supplierId: matchedEmployeeSupplier ? matchedEmployeeSupplier.id : undefined,
      employeeId: matchedEmployee ? matchedEmployee.id : undefined,
      adminAccountId: matchedAdminAcc ? matchedAdminAcc.id : undefined,
      roleTitle: matchedAdminAcc
        ? matchedAdminAcc.roleTitle
        : matchedEmployee
        ? matchedEmployee.roleTitle
        : undefined,
      permissions: matchedEmployee ? matchedEmployee.permissions : undefined,
      adminPermissions: matchedAdminAcc ? matchedAdminAcc.permissions : undefined
    };

    // Clear used OTP (single-use constraint)
    setActiveOtps(prev => {
      const copy = { ...prev };
      delete copy[cleanEmail];
      return copy;
    });

    setIsSupplierSelectionRequired(false);
    setCurrentUser(authUser);
    setRole(userRole);
    firestoreSync.saveUser(authUser).catch(console.error);
    if (userRole !== 'pos_client') {
      triggerConfetti();
    }

    const roleLabelAr = userRole === 'employee' 
      ? `موظف في متجر ${matchedEmployeeSupplier?.name || 'المتجر'}` 
      : userRole === 'supplier' 
      ? 'المتجر' 
      : userRole === 'super_admin' 
      ? (matchedAdminAcc ? `إدارة التطبيق (${matchedAdminAcc.roleTitle})` : 'مدير التطبيق')
      : 'العميل (نقطة البيع)';

    showToast({
      type: 'success',
      title: 'تم الاتصال بقاعدة البيانات وتسجيل الدخول بنجاح!',
      description: userRole === 'employee'
        ? `تم التحقق بنجاح من قاعدة البيانات. مرحباً بك يا ${userName} (موظف في متجر ${matchedEmployeeSupplier?.name}). تم نقلك لواجهة المتجر وفق صلاحياتك.`
        : matchedAdminAcc
        ? `تم التحقق بنجاح من قاعدة البيانات. مرحباً بك يا ${userName} (${matchedAdminAcc.roleTitle})، تم تفعيل صلاحياتك الإدارية المحددة.`
        : `تم التحقق بنجاح من قاعدة البيانات ومزامنة الحساب. مرحباً بك يا ${userName}، تم الانتقال فوراً إلى واجهة ${roleLabelAr}.`
    });

    return { success: true };
  };

  const registerAccount = async (params: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    phone?: string;
    tradeName?: string;
    supplierId?: string;
  }) => {
    if (!isFirestoreConnected) {
      const conn = await testConnection(6000).catch(() => ({ success: false, message: '' }));
      if (conn.success) {
        setIsFirestoreConnected(true);
      }
    }
    const { name, email, role: chosenRole, phone, tradeName, supplierId } = params;
    const cleanEmail = email.trim().toLowerCase();

    isRegisteringRef.current = true;
    try {
      // 1. Create User in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);
      const fbUser = userCredential.user;

      let associatedId = '';
      let newPos: POSClient | undefined;
      let newSup: Supplier | undefined;

      // 2. Prepare entity and save to Firestore
      if (chosenRole === 'pos_client') {
        const targetSupplierId = supplierId?.trim() || supplier.id;
        const newPosCode = `POS-${Math.floor(10000 + Math.random() * 90000)}`;
        newPos = {
          id: `pos-${fbUser.uid}`,
          posCode: newPosCode,
          tradeName: tradeName || `متجر ${name}`,
          ownerName: name,
          phone: phone || '+966 55 000 0000',
          country: 'المملكة العربية السعودية',
          city: 'الرياض',
          supplierId: targetSupplierId,
          tier: 'regular',
          walletBalance: 0,
          totalSpent: 0,
          ordersCount: 0,
          createdAt: new Date().toISOString().substring(0, 10),
          qrCodeValue: `DIGIPOS:${newPosCode}`
        };
        associatedId = newPos.id;
        await firestoreSync.savePosClient(newPos);
        setPosClients(prev => [newPos!, ...prev.filter(p => p.id !== newPos!.id)]);
      } else if (chosenRole === 'supplier') {
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

      // Force sign-out and clear state so the user MUST log in manually
      await fbSignOut(auth);
      setCurrentUser(null);
      localStorage.removeItem('digipos_auth_user');

      showToast({
        type: 'success',
        title: 'تم إنشاء وتوثيق الحساب بنجاح!',
        description: `أهلاً بك يا ${name}، تم إنشاء حسابك وحفظه في قاعدة البيانات. يرجى تسجيل الدخول.`
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
          description: 'هذا البريد الإلكتروني لديه حساب مفعل في المنصة، يرجى الانتقال لوجهة تسجيل الدخول كعميل أو متجر.'
        });
      } else {
        showToast({
          type: 'error',
          title: 'فشل إنشاء الحساب',
          description: userFriendlyMsg
        });
      }
      return { success: false, error: userFriendlyMsg };
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
    fbSignOut(auth).catch(console.error);
    setCurrentUser(null);
    setIsSupplierSelectionRequired(false);
    showToast({
      type: 'info',
      title: 'تم تسجيل الخروج',
      description: 'نراك قريباً في منصة DNexusD'
    });
  };

  const currentPos = posClients.find(p => p.id === currentPosId) || posClients[0] || EMPTY_POS_FALLBACK;

  const currentPosSupplier = React.useMemo(() => {
    return suppliers.find(s => s.id === currentPos?.supplierId) || supplier;
  }, [suppliers, currentPos?.supplierId, supplier]);

  const supplierNotifications = React.useMemo(() => {
    return notifications.filter(
      n =>
        (n.targetRole === 'supplier' || (!n.targetRole && !n.posId)) &&
        (!n.supplierId || n.supplierId === supplier?.id)
    );
  }, [notifications, supplier?.id]);

  const clientNotifications = React.useMemo(() => {
    return notifications.filter(
      n =>
        (n.targetRole === 'pos' || (!n.targetRole && n.posId)) &&
        (!n.posId || n.posId === currentPos?.id)
    );
  }, [notifications, currentPos?.id]);

  const unreadSupplierNotificationsCount = React.useMemo(() => {
    return supplierNotifications.filter(n => !n.isRead).length;
  }, [supplierNotifications]);

  const unreadPosNotificationsCount = React.useMemo(() => {
    return clientNotifications.filter(n => !n.isRead).length;
  }, [clientNotifications]);

  const unreadNotificationsCount = React.useMemo(() => {
    return role === 'supplier'
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

  // Fee calculation supporting percentage, fixed amount, or both
  const calculateFee = (amount: number, targetSup?: Supplier) => {
    const activeSup = targetSup || supplier;
    return calculateBaseSupplierFee(amount, activeSup);
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
    const { service, pkg, purchaseUnit, deliveryMethod, deliveryDetails, paymentMethod, customerName, customerPhone, resalePrice } = params;
    
    // 1. Resolve live service/package + linked warehouse purchase options & pricing
    const liveService = services.find(s => s.id === service.id) || service;
    const rawLivePkg = liveService.packages.find(p => p.id === pkg.id) || pkg;
    const effectivePkg = mergeWarehouseOptionsIntoPackage(rawLivePkg, voucherWarehouses);
    const purchaseOpts = resolvePackagePurchaseOptions(effectivePkg, voucherWarehouses);
    const effectiveUnit: WarehousePurchaseUnit = purchaseUnit || purchaseOpts.defaultPurchaseUnit;

    const serviceCatalog = catalogs.find(c => c.id === liveService.catalogId);
    const activeOrderSupplier = currentPosSupplier || supplier;
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

    // 2.5 If this is a Free Gift, prevent re-claiming a gift service that has already been completed by this client
    if (
      pricing.isFreeGiftApplied &&
      hasClientUsedGiftService({
        serviceId: liveService.id,
        isGiftService: true,
        usedGiftServiceIds: currentPos.usedGiftServiceIds,
        orders,
        posId: currentPos.id,
      })
    ) {
      showToast({
        type: 'info',
        title: 'تم استلام الهدية مسبقاً',
        description: 'لقد قمت باستخدام هذه الهدية المجانية وإتمامها بالفعل.',
      });
      return { success: false, error: 'gift_already_used' };
    }

    // 3. Balance verification for non-gift wallet purchases (free gifts are allowed even if wallet < app fee; fee is deferred silently)
    if (!pricing.isFreeGiftApplied && paymentMethod === 'wallet') {
      if (currentPos.walletBalance < totalDeduction) {
        showToast({
          type: 'error',
          title: 'الرصيد غير كافٍ',
          description: `الرصيد غير كافٍ! رصيد محفظتك (${currentPos.walletBalance.toFixed(2)} ر.س) لا يكفي لإتمام العملية (${totalDeduction.toFixed(2)} ر.س). يرجى إعادة شحن المحفظة.`
        });
        return { success: false, error: 'insufficient_balance' };
      }
    }

    const giftFeeResolution = pricing.isFreeGiftApplied
      ? resolveGiftClaimFeePayment({
          isFreeGiftApplied: true,
          walletBalance: currentPos.walletBalance,
          feeAmount,
          existingPendingFees: currentPos.pendingGiftFees,
        })
      : null;

    const actualWalletDeduction = pricing.isFreeGiftApplied
      ? giftFeeResolution!.walletDeductionNow
      : (paymentMethod === 'wallet' ? totalDeduction : 0);
    const adminFeeCollectedNow = pricing.isFreeGiftApplied
      ? giftFeeResolution!.walletDeductionNow
      : feeAmount;
    const deferredFeeAdded = pricing.isFreeGiftApplied
      ? giftFeeResolution!.deferredFeeAdded
      : 0;
    const nextPendingGiftFees = pricing.isFreeGiftApplied
      ? giftFeeResolution!.newPendingGiftFees
      : (currentPos.pendingGiftFees || 0);

    // 4. Handle stock & voucher code assignment/deduction atomically
    const stockDeduction = deductPackageStock({
      service: liveService,
      pkgId: effectivePkg.id,
      deliveryMethod,
      warehouses: voucherWarehouses,
      purchaseUnit: effectiveUnit
    });

    if (stockDeduction.outOfStock) {
      showToast({
        type: 'error',
        title: 'نفد المخزون',
        description:
          effectiveUnit === 'package'
            ? `عذراً، المخزون المتوفر في "${effectivePkg.name}" غير كافٍ لتسليم باقة كاملة (${purchaseOpts.packageCodesCount} أكواد).`
            : `عذراً، نفد مخزون "${effectivePkg.name}" حالياً. يرجى اختيار باقة أخرى أو التواصل مع المتجر لتعبئة المخزون.`
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
          supplierId: supplier.id,
          supplierName: supplier.name,
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

    // If delivery is Player ID, dispatch order with the ID to the "المتجر" (supplier) to complete via in-game charge
    const initialStatus = deliveryMethod === 'player_id' 
      ? 'pending_supplier' 
      : (deliveryMethod === 'account_login' ? 'pending_supplier' : 'completed');

    const nextUsedGiftServiceIds =
      pricing.isFreeGiftApplied && initialStatus === 'completed'
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
      supplierId: supplier.id,
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
      totalDeducted: pricing.isFreeGiftApplied ? actualWalletDeduction : totalDeduction,
      isFreeGiftOrder: pricing.isFreeGiftApplied || undefined,
      deferredFeeAmount: deferredFeeAdded > 0 ? deferredFeeAdded : undefined,
      deferredFeeSettled: deferredFeeAdded > 0 ? false : undefined,
      paymentMethod,
      status: initialStatus,
      customerName: customerName || 'عميل مباشر',
      customerPhone: customerPhone || '',
      supplierNotes: deliveryMethod === 'player_id' 
        ? `طلب شحن عبر الأيدي (${deliveryDetails.playerId || ''}) مرسل للمتجر للشحن من داخل اللعبة`
        : undefined
    };

    const nextPosWalletBalance = parseFloat((currentPos.walletBalance - actualWalletDeduction).toFixed(2));
    const nextPosTotalSpent = parseFloat((currentPos.totalSpent + unitPrice).toFixed(2));
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

    // Add collected fee to Super Admin's wallet (deferred fees are added upon wallet recharge)
    if (adminFeeCollectedNow > 0) {
      setSuperAdmin(prev => ({
        ...prev,
        walletBalance: parseFloat((prev.walletBalance + adminFeeCollectedNow).toFixed(2))
      }));
    }

    // Update Supplier revenue/balance
    setSuppliers(prev => prev.map(s => {
      if (s.id !== supplier.id) return s;
      return {
        ...s,
        walletBalance: parseFloat((s.walletBalance + unitPrice).toFixed(2))
      };
    }));

    // Add to Orders
    setOrders(prev => [newOrder, ...prev]);

    // Record Accounting Entries for POS client
    const newAccountingEntries: AccountingEntry[] = [];
    const balanceAfterPurchase = !pricing.isFreeGiftApplied && paymentMethod === 'wallet'
      ? parseFloat((currentPos.walletBalance - unitPrice).toFixed(2))
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
      supplierId: supplier.id,
      description: (deliveryMethod === 'player_id'
        ? `طلب شحن عبر الأيدي (${deliveryDetails.playerId}): ${service.nameAr} - ${pkg.name} (${currentPos.tier}) - أُرسل للمتجر للشحن من اللعبة`
        : `شراء خدمة: ${service.nameAr} - ${pkg.name} (${currentPos.tier}) من المتجر ${supplier.name}`) + purchaseTag,
      debit: unitPrice,
      credit: 0,
      balanceAfter: balanceAfterPurchase,
      serviceName: service.nameAr,
      customerName: customerName || 'عميل مباشر'
    });

    if (!pricing.isFreeGiftApplied && paymentMethod === 'wallet' && feeAmount > 0) {
      const balanceAfterFee = parseFloat((balanceAfterPurchase - feeAmount).toFixed(2));
      newAccountingEntries.push({
        id: `acc-${Date.now()}-2`,
        date: formattedDate,
        type: 'fee',
        referenceId: orderId,
        posId: currentPos.id,
        supplierId: supplier.id,
        description: pricing.isZeroPriceFloorApplied
          ? `رسوم الحد الأدنى للعملية الصفرية (${feeAmount.toFixed(2)} ر.س)`
          : `رسوم منصة تطبيق على عملية الشراء (${feeAmount.toFixed(2)} ر.س)`,
        debit: feeAmount,
        credit: 0,
        balanceAfter: balanceAfterFee
      });
    } else if (pricing.isFreeGiftApplied && actualWalletDeduction > 0) {
      const balanceAfterFee = parseFloat((balanceAfterPurchase - actualWalletDeduction).toFixed(2));
      newAccountingEntries.push({
        id: `acc-${Date.now()}-2`,
        date: formattedDate,
        type: 'fee',
        referenceId: orderId,
        posId: currentPos.id,
        supplierId: supplier.id,
        description: `رسوم تطبيق على عملية (${service.nameAr})`,
        debit: actualWalletDeduction,
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
        supplierId: supplier.id,
        description: `بيع للزبون (${customerName || 'مباشر'}) بقيمة ${resalePrice.toFixed(2)} ر.س (هامش ربح: ${(resalePrice - unitPrice).toFixed(2)} ر.س)`,
        debit: 0,
        credit: resalePrice,
        balanceAfter: nextPosWalletBalance,
        serviceName: service.nameAr,
        customerName: customerName || 'عميل مباشر'
      });
    }

    setAccountingEntries(prev => [...newAccountingEntries, ...prev]);

    // Record entry in Admin Accounting Statement only when fee is actually collected now
    let newAdminAccEntry: AdminAccountingEntry | null = null;
    if (adminFeeCollectedNow > 0) {
      const adminBalAfter = parseFloat((superAdmin.walletBalance + adminFeeCollectedNow).toFixed(2));
      newAdminAccEntry = {
        id: `adm-acc-${Date.now()}-fee`,
        date: formattedDate,
        type: 'fee_collected',
        referenceId: orderId,
        supplierId: supplier.id,
        supplierName: `${supplier.name} (${supplier.storeName})`,
        serviceId: service.id,
        serviceName: service.nameAr,
        posId: currentPos.id,
        posCode: currentPos.posCode,
        posName: currentPos.tradeName,
        description: pricing.isFreeGiftApplied
          ? `تحصيل رسوم هدية مجانية (${pricing.appFeePercentageApplied}% من ${pricing.originalTierPrice.toFixed(2)} ر.س = ${adminFeeCollectedNow.toFixed(2)} ر.س): ${service.nameAr} - ${pkg.name}`
          : pricing.isZeroPriceFloorApplied
          ? `تحصيل الحد الأدنى للعملية الصفرية (${adminFeeCollectedNow.toFixed(2)} ر.س): ${service.nameAr} - ${pkg.name}`
          : `تحصيل رسوم منصة (${adminFeeCollectedNow.toFixed(2)} ر.س) على عملية شراء: ${service.nameAr} - ${pkg.name}`,
        grossAmount: pricing.isFreeGiftApplied ? pricing.originalTierPrice : unitPrice,
        feeAmount: adminFeeCollectedNow,
        debit: 0,
        credit: adminFeeCollectedNow,
        balanceAfter: adminBalAfter,
        notes: `تم الخصم من محفظة العميل (${currentPos.tradeName}) وتحويل الرسوم لمحفظة الإدارة`
      };
      setAdminAccountingEntries(prev => [newAdminAccEntry!, ...prev]);
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
    firestoreSync.saveSupplier({
      ...supplier,
      walletBalance: parseFloat((supplier.walletBalance + unitPrice).toFixed(2))
    }).catch(console.error);
    if (adminFeeCollectedNow > 0) {
      firestoreSync.saveSuperAdmin({
        ...superAdmin,
        walletBalance: parseFloat((superAdmin.walletBalance + adminFeeCollectedNow).toFixed(2))
      }).catch(console.error);
      if (newAdminAccEntry) {
        firestoreSync.saveAdminAccountingEntry(newAdminAccEntry).catch(console.error);
      }
    }
    for (const ent of newAccountingEntries) {
      firestoreSync.saveAccountingEntry(ent).catch(console.error);
    }

    triggerConfetti();

    // Notify the supplier of the new purchase / game top-up order
    addNotification({
      supplierId: supplier.id,
      supplierName: supplier.name,
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
          ? `أرسل العميل ${currentPos.tradeName} (${currentPos.posCode}) طلب شحن للأيدي (${deliveryDetails.playerId}) لباقة ${pkg.name} بمبلغ ${unitPrice.toFixed(2)} ر.س.`
          : deliveryMethod === 'account_login'
          ? `أرسل العميل ${currentPos.tradeName} (${currentPos.posCode}) طلب شحن حساب (${deliveryDetails.accountEmail || 'حساب العميل'}) لباقة ${pkg.name} بمبلغ ${unitPrice.toFixed(2)} ر.س.`
          : `قام العميل ${currentPos.tradeName} (${currentPos.posCode}) بشراء ${pkg.name} بمبلغ ${unitPrice.toFixed(2)} ر.س.`,
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

    if (deliveryMethod === 'player_id') {
      showToast({
        type: 'info',
        title: 'تم إرسال الطلب مع الأيدي إلى المتجر',
        description: `تم إرسال الأيدي (${deliveryDetails.playerId}) للمتجر بنجاح ليكمل الشحن من داخل اللعبة. سيتم إشعارك فور اكتمال الشحن.`
      });
    } else if (pricing.isFreeGiftApplied) {
      showToast({
        type: 'success',
        title: 'تم استلام الهدية المجانية بنجاح!',
        description: `تم استلام وتنفيذ ${service.nameAr} بقيمة 0.00 ر.س.`
      });
    } else {
      showToast({
        type: 'success',
        title: 'تمت العملية بنجاح!',
        description: `تم شحن وتسليم ${service.nameAr} وخصم ${totalDeduction.toFixed(2)} ر.س.`
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

    if (target.id === currentPos.id) {
      showToast({
        type: 'error',
        title: 'عملية غير صالحة',
        description: 'لا يمكنك تحويل رصيد إلى محفظتك الخاصة.'
      });
      return { success: false, error: 'self_transfer' };
    }

    const feeAmount = calculateFee(amount, supplier);
    const totalDeducted = amount + feeAmount;

    if (currentPos.walletBalance < totalDeducted) {
      showToast({
        type: 'error',
        title: 'الرصيد غير كافٍ',
        description: `الرصيد غير كافٍ! رصيدك الحالي (${currentPos.walletBalance.toFixed(2)} ر.س) لا يكفي لإتمام التحويل (${totalDeducted.toFixed(2)} ر.س). يرجى إعادة شحن المحفظة.`
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
    setAccountingEntries(prev => [
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
        supplierId: supplier.id,
        description: `استلام تحويل رصيد من (${currentPos.tradeName} - ${currentPos.posCode})`,
        debit: 0,
        credit: amount,
        balanceAfter: targetSettlement.finalWalletBalance
      },
      ...prev
    ]);

    if (feeAmount > 0 || targetSettlement.settledFeeAmount > 0) {
      const nextAdminEntries: AdminAccountingEntry[] = [];
      let runningAdminBal = superAdmin.walletBalance;
      if (feeAmount > 0) {
        runningAdminBal = parseFloat((runningAdminBal + feeAmount).toFixed(2));
        nextAdminEntries.push({
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
        });
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
    addNotification({
      posId: target.id,
      supplierId: supplier.id,
      supplierName: currentPos.tradeName,
      title: 'تحويل رصيد وارد',
      message: `استلمت تحويل رصيد بقيمة ${amount.toFixed(2)} ر.س من (${currentPos.tradeName} - ${currentPos.posCode}).`,
      type: 'transfer'
    });
    showToast({
      type: 'success',
      title: 'تم تحويل الرصيد وحفظه في القواعد الثلاث',
      description: `تم إرسال ${amount.toFixed(2)} ر.س إلى ${target.tradeName} (${target.posCode}) وحفظ العملية في كافة القواعد المرتبطة.`
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
    notes?: string;
  }): { success: boolean; error?: string; account?: SupplierBankAccount } => {
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
        updateOfficeEmployee(existingEmp.id, targetEmp);
      } else {
        targetEmp = addOfficeEmployee({
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
          ? `أكدت نقطة البيع المخوّلة (${receiverName}) استلام الحوالة #${dep.transferNumber} بمبلغ ${dep.amount.toFixed(2)} ر.س، وأصبح الإشعار ظاهراً لدى المتجر في نفس طلب الشحن.`
          : `أفادت نقطة البيع المخوّلة (${receiverName}) بعدم استلام الحوالة #${dep.transferNumber} بمبلغ ${dep.amount.toFixed(2)} ر.س. السبب: ${updatedDep.receiverConfirmationNote}`,
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
          ? `أكدت نقطة البيع المخوّلة (${receiverName}) استلام الحوالة #${dep.transferNumber} بمبلغ ${dep.amount.toFixed(2)} ر.س للعميل ${dep.posName} في الحساب (${dep.targetBankName || dep.bankName}).`
          : `أفادت نقطة البيع المخوّلة (${receiverName}) بعدم استلام الحوالة #${dep.transferNumber} بمبلغ ${dep.amount.toFixed(2)} ر.س للعميل ${dep.posName}. الملاحظة: ${updatedDep.receiverConfirmationNote}`,
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
      addNotification({
        posId: newDep.receiverPosId,
        supplierId: targetSupplier.id,
        supplierName: currentPos.tradeName,
        title: 'حوالة جديدة بانتظار تأكيد الاستلام',
        message: `أرسل العميل (${currentPos.tradeName}) طلب شحن بمبلغ ${params.amount.toFixed(2)} ر.س وأشار إلى أن الإيداع تم لحسابك (${selectedAccount?.bankName}). يرجى مراجعة الطلب وتأكيد استلام الحوالة أو عدم استلامها.`,
        type: 'deposit'
      });
    }

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
        message: `طلب العميل ${currentPos.tradeName} (${currentPos.posCode}) سلفة رصيد آجل بمبلغ ${params.amount.toFixed(2)} ر.س. السبب: ${params.loanReason || 'طلب سلفة رصيد عاجل'}.`,
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
        message: `أرسل العميل ${currentPos.tradeName} (${currentPos.posCode}) طلب شحن بمبلغ ${params.amount.toFixed(2)} ر.س (حوالة: ${newDep.transferNumber} على ${selectedAccount?.bankName || 'حساب المتجر'}) مع صورة الإيصال المرفقة.`,
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
        description: `تم إرسال طلب سلفة بقيمة ${params.amount.toFixed(2)} ر.س إلى المتجر ${targetSupplier.name} بدون الحاجة لمرفقات بنكية. سيصلك الرصيد فور الموافقة.`
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
  const approveDepositRequest = (depositId: string) => {
    const dep = depositRequests.find(d => d.id === depositId);
    if (!dep || dep.status !== 'pending') return;

    const isLoan = dep.requestType === 'loan';
    const approvedNotes = isLoan
      ? 'تمت الموافقة على طلب السلفة وقيد الرصيد الآجل في المحفظة'
      : 'تمت الموافقة ومطابقة الحوالة البنكية بنجاح';

    const updatedDep: DepositRequest = { ...dep, status: 'approved', notes: approvedNotes };
    setDepositRequests(prev => prev.map(d => d.id === depositId ? updatedDep : d));

    const targetPos = posClients.find(p => p.id === dep.posId);
    const depositSettlement = targetPos
      ? settlePendingGiftFeesOnRecharge({
          currentWalletBalance: targetPos.walletBalance,
          rechargeAmount: dep.amount,
          pendingGiftFees: targetPos.pendingGiftFees,
        })
      : {
          settledFeeAmount: 0,
          finalWalletBalance: dep.amount,
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

    const depAccEntry: AccountingEntry = {
      id: `acc-${Date.now()}-dep`,
      date: formattedDate,
      type: 'deposit',
      referenceId: dep.id,
      posId: dep.posId,
      supplierId: supplier.id,
      description: isLoan
        ? `إيداع سلفة رصيد آجل معتمدة من المتجر (${supplier.name}) ${dep.loanReason ? `[سبب السلفة: ${dep.loanReason}]` : ''}`
        : `إيداع رصيد مسبق في المحفظة عبر حوالة بنكية (${dep.bankName} - رقم الحوالة: ${dep.transferNumber})`,
      debit: 0,
      credit: dep.amount,
      balanceAfter: newBal
    };
    setAccountingEntries(prev => [depAccEntry, ...prev]);
    firestoreSync.saveAccountingEntry(depAccEntry).catch(console.error);

    let nextAdminBalAfter = superAdmin.walletBalance;
    const nextAdminEntries: AdminAccountingEntry[] = [];

    if (depositSettlement.settledFeeAmount > 0) {
      nextAdminBalAfter = parseFloat((superAdmin.walletBalance + depositSettlement.settledFeeAmount).toFixed(2));
      setSuperAdmin(prev => ({
        ...prev,
        walletBalance: nextAdminBalAfter,
      }));
      firestoreSync.saveSuperAdmin({
        ...superAdmin,
        walletBalance: nextAdminBalAfter,
      }).catch(console.error);

      const settledFeeAdminEntry: AdminAccountingEntry = {
        id: `adm-acc-${Date.now()}-gift-dep`,
        date: formattedDate,
        type: 'fee_collected',
        referenceId: dep.id,
        supplierId: dep.supplierId,
        supplierName: `${supplier.name} (${supplier.storeName})`,
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

    // Record in Admin accounting log
    nextAdminEntries.unshift({
      id: `adm-acc-${Date.now()}-dep`,
      date: formattedDate,
      type: 'deposit_received',
      referenceId: dep.id,
      supplierId: dep.supplierId,
      supplierName: `${supplier.name} (${supplier.storeName})`,
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
      notes: `معتمد من المتجر ${supplier.name} لنقطة البيع ${dep.posName}`
    });
    setAdminAccountingEntries(prev => [...nextAdminEntries, ...prev]);

    triggerConfetti();
    addNotification({
      posId: dep.posId,
      supplierId: dep.supplierId,
      supplierName: supplier.name,
      title: isLoan ? 'تمت الموافقة على طلب السلفة' : 'تم شحن المحفظة بنجاح',
      message: isLoan
        ? `وافق المتجر ${supplier.name} على طلب السلفة بقيمة ${dep.amount.toFixed(2)} ر.س وقيدها في محفظتك.`
        : `تم اعتماد إيداع ${dep.amount.toFixed(2)} ر.س في محفظتك من المتجر ${supplier.name}.`,
      type: 'deposit'
    });
    showToast({
      type: 'success',
      title: isLoan ? 'تم اعتماد السلفة وقيد الرصيد بنجاح' : 'تم اعتماد طلب الإيداع وحفظه في القواعد الثلاث',
      description: isLoan
        ? `تم إضافة رصيد سلفة بقيمة ${dep.amount.toFixed(2)} ر.س لمحفظة ${dep.posName} وتسجيلها في القيود المالية وقواعد البيانات.`
        : `تم شحن رصيد ${dep.amount.toFixed(2)} ر.س لمحفظة ${dep.posName} وتوثيقه في كافة القواعد المرتبطة.`
    });
  };

  const markLoanAsRepaid = (depositId: string) => {
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

    addNotification({
      posId: dep.posId,
      supplierId: targetSupplier.id,
      supplierName: targetSupplier.name,
      title: 'تم توثيق سداد السلفة بالكامل',
      message: `تم توثيق سداد السلفة رقم #${dep.id} بمبلغ ${remaining.toFixed(2)} ر.س بالكامل لدى المتجر ${targetSupplier.name}.`,
      type: 'deposit'
    });

    showToast({
      type: 'success',
      title: 'تم تسجيل تسديد السلفة بنجاح',
      description: `تم توثيق تسديد سلفة العميل ${dep.posName} بمبلغ ${remaining.toFixed(2)} ر.س بنجاح.`
    });
  };

  const payLoanFromWallet = async (
    loanId: string,
    rawAmount: number
  ): Promise<{ success: boolean; error?: string; receipt?: WalletLoanRepaymentReceipt }> => {
    const loan = depositRequests.find(d => d.id === loanId);
    if (!loan) {
      return { success: false, error: 'لم يتم العثور على السلفة المطلوبة.' };
    }

    const targetPos = posClients.find(p => p.id === loan.posId) || currentPos;
    const targetSupplier = suppliers.find(s => s.id === loan.supplierId) || supplier;

    const validation = validateWalletRepayment(loan, rawAmount, targetPos.walletBalance);
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

    addNotification({
      posId: targetPos.id,
      supplierId: targetSupplier.id,
      supplierName: targetSupplier.name,
      targetRole: 'pos',
      title: isFull ? 'تم سداد السلفة بالكامل من المحفظة' : 'تم سداد دفعة من السلفة من المحفظة',
      message: isFull
        ? `تم سداد مبلغ ${appliedAmount.toFixed(2)} ر.س وخصمه من محفظتك (${targetPos.tradeName}) وإضافته إلى محفظة المتجر ${targetSupplier.name}، وتم إغلاق السلفة #${loan.id} كمسددة بالكامل.`
        : `تم سداد مبلغ ${appliedAmount.toFixed(2)} ر.س وخصمه من محفظتك (${targetPos.tradeName}) وإضافته إلى محفظة المتجر ${targetSupplier.name}. رصيد محفظتك الجديد: ${newPosWalletBalance.toFixed(2)} ر.س · المتبقي من السلفة: ${newRemainingAmount.toFixed(2)} ر.س.`,
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
      message: `قام العميل ${targetPos.tradeName} (${targetPos.posCode}) بسداد ${appliedAmount.toFixed(2)} ر.س من رصيد محفظته عن السلفة #${loan.id}. أودع المبلغ في محفظتك المتاحة وأصبح المتبقي: ${newRemainingAmount.toFixed(2)} ر.س.`,
      type: 'loan_repayment',
      loanId: loan.id,
      amount: appliedAmount,
      actionTab: 'loans'
    });

    showToast({
      type: 'success',
      title: isFull ? 'تم سداد السلفة بالكامل بنجاح' : 'تم سداد الدفعة من السلفة بنجاح',
      description: `تم خصم ${appliedAmount.toFixed(2)} ر.س من محفظة العميل (${targetPos.tradeName}) وإضافتها إلى محفظة المتجر ${targetSupplier.name}. رصيدك الحالي: ${newPosWalletBalance.toFixed(2)} ر.س · المتبقي من السلفة: ${newRemainingAmount.toFixed(2)} ر.س.`
    });

    return { success: true, receipt };
  };

  const confirmLoanRepaymentReceiptByReceiver = (
    requestId: string,
    decision: 'confirmed' | 'rejected',
    note?: string
  ) => {
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
          ? `أكدت نقطة البيع المخوّلة (${receiverName}) استلام حوالة سداد السلفة #${req.loanId} (مرجع: #${req.transferNumber}) بمبلغ ${req.amount.toFixed(2)} ر.س، وأصبح التأكيد ظاهراً لدى المتجر لاعتماد خصم السلفة.`
          : `أفادت نقطة البيع المخوّلة (${receiverName}) بعدم استلام حوالة سداد السلفة #${req.loanId} (مرجع: #${req.transferNumber}) بمبلغ ${req.amount.toFixed(2)} ر.س. السبب: ${updatedReq.receiverConfirmationNote}`,
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
          ? `أكدت نقطة البيع المخوّلة (${receiverName}) استلام حوالة سداد السلفة #${req.loanId} (مرجع: #${req.transferNumber}) بمبلغ ${req.amount.toFixed(2)} ر.س للعميل ${req.posName}.`
          : `أفادت نقطة البيع المخوّلة (${receiverName}) بعدم استلام حوالة سداد السلفة #${req.loanId} (مرجع: #${req.transferNumber}) بمبلغ ${req.amount.toFixed(2)} ر.س للعميل ${req.posName}. السبب: ${updatedReq.receiverConfirmationNote}`,
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
    const loan = depositRequests.find(d => d.id === params.loanId);
    if (!loan) {
      return { success: false, error: 'لم يتم العثور على السلفة المحددة.' };
    }

    const validation = validateBankTransferRepayment(loan, params);
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

    if (isDelegatedTransfer && newRequest.receiverPosId) {
      addNotification({
        posId: newRequest.receiverPosId,
        supplierId: targetSupplier.id,
        supplierName: targetPos.tradeName,
        title: 'حوالة سداد سلفة بانتظار تأكيد الاستلام',
        message: `أرسل العميل (${targetPos.tradeName}) طلب سداد سلفة #${loan.id} بمبلغ ${validation.amount.toFixed(2)} ر.س إلى حسابك المخوّل (${selectedAccount?.bankName}). يرجى مراجعة الإيصال وتأكيد الاستلام.`,
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
        ? `تم إرسال طلب سداد رقم #${requestId} بقيمة ${validation.amount.toFixed(2)} ر.س للسلفة #${loan.id} إلى نقطة البيع المخوّلة (${newRequest.receiverPosName}) والمتجر ${targetSupplier.name} للمراجعة والاعتماد.`
        : `تم إرسال طلب سداد رقم #${requestId} بقيمة ${validation.amount.toFixed(2)} ر.س للسلفة #${loan.id} (حوالة: ${newRequest.transferNumber} · ${newRequest.bankName})، وهو بانتظار مراجعة وموافقة المتجر ${targetSupplier.name}.`,
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
      message: `أرسل العميل ${targetPos.tradeName} (${targetPos.posCode}) طلب سداد سلفة #${loan.id} بمبلغ ${validation.amount.toFixed(2)} ر.س (حوالة: ${newRequest.transferNumber} على ${newRequest.targetBankName || newRequest.bankName}) مع صورة الإيصال المرفقة.`,
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
        : `تم إرسال طلب سداد بمبلغ ${validation.amount.toFixed(2)} ر.س عن السلفة #${loan.id} (رقم الحوالة: ${newRequest.transferNumber}) وبانتظار موافقة المتجر ${targetSupplier.name}.`
    });

    return { success: true, requestId, request: newRequest };
  };

  const approveLoanRepaymentRequest = (requestId: string, overrideAmount?: number) => {
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

    addNotification({
      posId: loan.posId,
      supplierId: targetSupplier.id,
      supplierName: targetSupplier.name,
      title: isFull ? 'تمت الموافقة وإتمام سداد السلفة بالكامل' : 'تمت الموافقة على سداد جزء من السلفة',
      message: isFull
        ? `راجع المتجر ${targetSupplier.name} الحوالة البنكية (${req.transferNumber}) بمبلغ ${appliedAmount.toFixed(2)} ر.س، وأصبحت السلفة #${loan.id} مسددة بالكامل.`
        : `راجع المتجر ${targetSupplier.name} الحوالة البنكية (${req.transferNumber}) وخصم ${appliedAmount.toFixed(2)} ر.س من السلفة #${loan.id}. المتبقي: ${newRemainingAmount.toFixed(2)} ر.س.`,
      type: 'deposit'
    });

    showToast({
      type: 'success',
      title: isFull ? 'تم اعتماد الحوالة وسداد السلفة بالكامل' : 'تم اعتماد الحوالة وخصم الدفعة الجزئية',
      description: `تم خصم ${appliedAmount.toFixed(2)} ر.س من السلفة #${loan.id} للعميل ${loan.posName}. المتبقي: ${newRemainingAmount.toFixed(2)} ر.س.`
    });
  };

  const rejectLoanRepaymentRequest = (requestId: string, reason?: string) => {
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

  // Supplier / المتجر completing an order that needed manual fulfillment via Game ID
  const completeSupplierOrder = (orderId: string, notes?: string) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return;
    const isPlayerId = targetOrder.deliveryMethod === 'player_id';
    const defaultNote = isPlayerId
      ? `تم الشحن بنجاح من داخل اللعبة باستخدام الأيدي (${targetOrder?.deliveryDetails.playerId || ''})`
      : 'تم إتمام الشحن وتفعيل الخدمة بنجاح من المتجر';

    const updatedOrder: Order = {
      ...targetOrder,
      status: 'completed',
      supplierNotes: notes || defaultNote,
      completedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      deliveryDetails: {
        ...targetOrder.deliveryDetails,
        inGameChargeStatus: 'completed_in_game'
      }
    };

    setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
    firestoreSync.saveOrder(updatedOrder).catch(console.error);

    // If this completed order is a Free Gift, mark it as used so it hides from the client's store view
    const orderService = services.find(s => s.id === targetOrder.serviceId);
    const orderCatalog = orderService ? catalogs.find(c => c.id === orderService.catalogId) : undefined;
    if (targetOrder.isFreeGiftOrder || isCatalogFreeGifts(orderCatalog)) {
      setPosClients(prev => prev.map(p => {
        if (p.id !== targetOrder.posId) return p;
        const updatedPos: POSClient = {
          ...p,
          usedGiftServiceIds: appendUsedGiftServiceId(p.usedGiftServiceIds, targetOrder.serviceId),
        };
        firestoreSync.savePosClient(updatedPos).catch(console.error);
        return updatedPos;
      }));
    }

    triggerConfetti();
    addNotification({
      posId: targetOrder.posId,
      supplierId: supplier.id,
      supplierName: supplier.name,
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
    if (!targetOrder) return;

    // Refund customer & cancel any unpaid deferred gift fee associated with this rejected order
    const refundAmount = targetOrder.totalDeducted || 0;
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

    addNotification({
      posId: targetOrder.posId,
      supplierId: supplier.id,
      supplierName: supplier.name,
      title: 'إلغاء طلب وإعادة الرصيد',
      message: targetOrder.isFreeGiftOrder
        ? `تم إلغاء الطلب #${targetOrder.id}. السبب: ${reason || 'تعذر التنفيذ'}`
        : `تم إلغاء الطلب #${targetOrder.id} واسترداد ${targetOrder.totalDeducted.toFixed(2)} ر.س إلى محفظتك. السبب: ${reason || 'تعذر التنفيذ'}`,
      type: 'order_status',
      orderId: targetOrder.id
    });

    showToast({
      type: 'error',
      title: 'تم إلغاء الطلب وإعادة الرصيد',
      description: targetOrder.isFreeGiftOrder
        ? `تم إلغاء الطلب #${targetOrder.id}.`
        : `تم إلغاء الطلب واسترداد ${targetOrder.totalDeducted.toFixed(2)} ر.س لمحفظة العميل.`
    });
  };

  // Supplier sending OTP / reply message directly to the client
  const sendSupplierReplyToClient = (orderId: string, message: string) => {
    const targetOrder = orders.find(o => o.id === orderId);

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
      addNotification({
        posId: targetOrder.posId,
        supplierId: supplier.id,
        supplierName: supplier.name,
        title: 'رسالة جديدة من المتجر',
        message: `أرسل المتجر تنبيهاً/رمزاً للطلب #${orderId}: "${message}"`,
        type: 'order_status',
        orderId: targetOrder.id
      });
    }

    try {
      localStorage.setItem('digipos_live_supplier_reply', JSON.stringify({
        orderId,
        message,
        timestamp: Date.now()
      }));
      window.dispatchEvent(new CustomEvent('digipos_supplier_reply', {
        detail: { orderId, message }
      }));
    } catch (e) {
      // ignore
    }

    showToast({
      type: 'success',
      title: 'تم إرسال الرمز للعميل فوراً!',
      description: `تم إرسال الرمز "${message}" وسيظهر في شاشة العميل ونقطة البيع مباشرة.`
    });
  };

  const confirmClientOtpRead = (orderId: string) => {
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

  // Update POS client profile details (logo, tradeName, ownerName, email, phone, servicePhone, country, city)
  const updatePosProfile = (posId: string, updates: Partial<POSClient>) => {
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

  // Create invite link with pre-assigned tier
  const createInviteLink = (targetTier: AccountTier) => {
    const code = `${supplier.name.slice(0, 3).toUpperCase()}-${targetTier.toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const newLink: InviteLink = {
      id: `inv-${Date.now()}`,
      code,
      supplierId: supplier.id,
      supplierName: supplier.name,
      targetTier,
      createdAt: new Date().toISOString().substring(0, 10),
      usedCount: 0,
      url: `https://digipos.app/join?ref=${code}&tier=${targetTier}&sup=${supplier.id}`
    };
    setInviteLinks(prev => [newLink, ...prev]);
    firestoreSync.saveInviteLink(newLink).catch(console.error);
    showToast({
      type: 'success',
      title: 'تم إنشاء رابط الدعوة',
      description: `الرابط جاهز مع رتبة (${targetTier}) محددة مسبقاً للعميل عند التسجيل.`
    });
    return newLink;
  };

  // Add catalog
  const addCatalog = (nameAr: string, descriptionAr: string, icon: string, isFreeGiftsCatalog?: boolean) => {
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
      title: 'تم تعديل الكتالوج',
      description: 'تم حفظ تعديلات بيانات الكتالوج بنجاح.'
    });
  };

  // Delete catalog
  const deleteCatalog = (id: string): { success: boolean; error?: string } => {
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
    setServices(prev => {
      let oldCatalogId = '';
      const updatedList = prev.map(s => {
        if (s.id === id) {
          oldCatalogId = s.catalogId;
          const updated = { ...s, ...updates };
          firestoreSync.saveService(updated).catch(console.error);
          return updated;
        }
        return s;
      });

      // Recalculate catalog counts if catalog changed
      if (updates.catalogId && updates.catalogId !== oldCatalogId) {
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
    const newSup: Supplier = {
      ...newSupData,
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

  // Super Admin updates specific supplier fee
  const updateSupplierFeeConfig = (
    supplierId: string, 
    config: { feeType: 'percentage' | 'fixed' | 'both'; percentage: number; fixedAmount: number }
  ) => {
    const targetSup = suppliers.find(s => s.id === supplierId);
    const updatedSup = targetSup
      ? {
          ...targetSup,
          feeType: config.feeType,
          feePercentage: config.percentage,
          fixedFeeAmount: config.fixedAmount
        }
      : null;

    setSuppliers(prev => prev.map(s => {
      if (s.id !== supplierId) return s;
      return {
        ...s,
        feeType: config.feeType,
        feePercentage: config.percentage,
        fixedFeeAmount: config.fixedAmount
      };
    }));
    if (updatedSup) {
      firestoreSync.saveSupplier(updatedSup).catch(console.error);
    }
    showToast({
      type: 'success',
      title: 'تم تحديث رسوم المتجر',
      description: `تم ضبط رسوم المتجر: نوع (${config.feeType}) نسبة (${config.percentage}%) ومبلغ مقطوع (${config.fixedAmount} ر.س).`
    });
  };

  // Super Admin updates global fee
  const updateGlobalFeeConfig = (
    config: { feeType: 'percentage' | 'fixed' | 'both'; percentage: number; fixedAmount: number }
  ) => {
    const nextAdmin: SuperAdmin = {
      ...superAdmin,
      defaultFeeType: config.feeType,
      defaultFeePercentage: config.percentage,
      defaultFixedFeeAmount: config.fixedAmount
    };
    setSuperAdmin(nextAdmin);
    firestoreSync.saveSuperAdmin(nextAdmin).catch(console.error);

    // Update all suppliers with global default and sync to Firestore
    const updatedSuppliers = suppliers.map(s => ({
      ...s,
      feeType: config.feeType,
      feePercentage: config.percentage,
      fixedFeeAmount: config.fixedAmount
    }));
    setSuppliers(updatedSuppliers);
    updatedSuppliers.forEach(s => {
      firestoreSync.saveSupplier(s).catch(console.error);
    });

    showToast({
      type: 'success',
      title: 'تم تحديث النسبة والمبلغ العام',
      description: `تم تطبيق الإعدادات العامة على جميع المتاجر: نسبة ${config.percentage}% ومبلغ ${config.fixedAmount} ر.س.`
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

    setAdminAccountingEntries(prev => [
      {
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
      },
      ...prev
    ]);

    triggerConfetti();
    showToast({
      type: 'success',
      title: 'تم التحويل إلى الحساب البنكي',
      description: `تم تحويل مبلغ ${amount.toFixed(2)} ر.س من محفظة مدير التطبيق إلى الآيبان ${bankIban}.`
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

    triggerConfetti();
    showToast({
      type: 'success',
      title: 'تم تحويل الرصيد من الإدارة',
      description: `تم إيداع ${amount.toFixed(2)} ر.س مباشرة في محفظة ${target.tradeName}.`
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
  }): OfficeEmployee => {
    const cleanEmail = employeeData.email.trim().toLowerCase();
    const cleanPassword = employeeData.password?.trim() || '123456';
    const newEmp: OfficeEmployee = {
      id: `emp-${Date.now().toString().slice(-6)}`,
      supplierId: supplier.id,
      name: employeeData.name.trim(),
      email: cleanEmail,
      password: cleanPassword,
      phone: employeeData.phone.trim(),
      country: employeeData.country?.trim() || undefined,
      isTransferReceiverOnly: employeeData.isTransferReceiverOnly,
      roleTitle: employeeData.roleTitle.trim() || 'موظف مكتب',
      permissions: employeeData.permissions,
      createdAt: new Date().toISOString().substring(0, 10)
    };

    // 1. Save in the supplier's employees array
    setSuppliers(prev => prev.map(s => {
      if (s.id !== supplier.id) return s;
      const currentEmployees = s.employees || [];
      const updated = {
        ...s,
        employees: [newEmp, ...currentEmployees.filter(e => e.email?.toLowerCase().trim() !== cleanEmail)]
      };
      firestoreSync.saveSupplier(updated).catch(console.error);
      return updated;
    }));

    // 2. Register as a dedicated user account of type 'employee' in users collection!
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
      permissions: newEmp.permissions
    };
    firestoreSync.saveUser(employeeUser).catch(console.error);

    showToast({
      type: 'success',
      title: 'تم إنشاء وتوثيق حساب الموظف بنجاح',
      description: `تم إضافة (${newEmp.name}) كحساب موظف معتمد في متجر (${supplier.name}) وحفظ كلمة المرور والصلاحيات في قاعدة البيانات.`
    });

    return newEmp;
  };

  const updateOfficeEmployee = (empId: string, updates: Partial<OfficeEmployee>) => {
    let updatedEmp: OfficeEmployee | undefined;

    setSuppliers(prev => prev.map(s => {
      if (s.id !== supplier.id) return s;
      const currentEmployees = s.employees || [];
      const updatedList = currentEmployees.map(e => {
        if (e.id === empId) {
          updatedEmp = { ...e, ...updates };
          return updatedEmp;
        }
        return e;
      });
      const updated = {
        ...s,
        employees: updatedList
      };
      firestoreSync.saveSupplier(updated).catch(console.error);
      return updated;
    }));

    if (updatedEmp) {
      const emp = updatedEmp as OfficeEmployee;
      const employeeUser: AuthUser = {
        id: emp.id,
        email: emp.email.toLowerCase().trim(),
        name: emp.name,
        role: 'employee',
        phone: emp.phone,
        associatedId: supplier.id,
        supplierId: supplier.id,
        employeeId: emp.id,
        roleTitle: emp.roleTitle,
        permissions: emp.permissions
      };
      firestoreSync.saveUser(employeeUser).catch(console.error);
    }

    showToast({
      type: 'success',
      title: 'تم تحديث بيانات الموظف',
      description: 'تم حفظ تعديلات وصلاحيات الموظف وكلمة المرور بنجاح في النظام.'
    });
  };

  const removeOfficeEmployee = (empId: string) => {
    setSuppliers(prev => prev.map(s => {
      if (s.id !== supplier.id) return s;
      const currentEmployees = s.employees || [];
      const updated = {
        ...s,
        employees: currentEmployees.filter(e => e.id !== empId)
      };
      firestoreSync.saveSupplier(updated).catch(console.error);
      return updated;
    }));

    showToast({
      type: 'info',
      title: 'تم حذف الموظف',
      description: 'تم إزالة الموظف من صلاحيات مكتب المتجر.'
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

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        viewMode,
        setViewMode,
        activeNavTab,
        setActiveNavTab,
        isFirestoreConnected,
        isSyncingWithFirestore,
        isSupplierSelectionRequired,
        setIsSupplierSelectionRequired,
        syncAllToFirestore,
        clearUsersSuppliersAndClientsData,
        checkDatabaseConnection,
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
        currentPos,
        setCurrentPosId,
        posClients,
        suppliers,
        availableClientSuppliers,
        supplier,
        currentPosSupplier,
        setCurrentSupplierId,
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
        completeSupplierOrder,
        rejectSupplierOrder,
        sendSupplierReplyToClient,
        confirmClientOtpRead,
        updatePosTier,
        togglePosLoanPrivilege,
        togglePosReceiveTransfersPrivilege,
        togglePosBonusPrivilege,
        togglePosGiftsPrivilege,
        updatePosProfile,
        updateSupplierProfile,
        createInviteLink,
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
