import {
  AccountingEntry,
  AdminAccountingEntry,
  Catalog,
  DepositRequest,
  DropdownOptionItem,
  PlatformDropdownListKey,
  PlatformInterfaceSettings,
  UserRole,
} from '../types';
import { isCatalogFreeGifts } from './pricing';

export const DEFAULT_STATEMENT_TRANSACTION_TYPES: DropdownOptionItem[] = [
  { id: 'st-purchase', value: 'purchase', labelAr: 'مشتريات خدمات', isSystem: true, isActive: true },
  { id: 'st-sale', value: 'sale', labelAr: 'مبيعات للزبائن', isSystem: true, isActive: true },
  { id: 'st-deposit', value: 'deposit', labelAr: 'إيداعات وشحن رصيد', isSystem: true, isActive: true },
  { id: 'st-fee', value: 'fee', labelAr: 'رسوم التطبيق', isSystem: true, isActive: true },
  { id: 'st-transfer-out', value: 'transfer_out', labelAr: 'تحويل صادر', isSystem: true, isActive: true },
  { id: 'st-transfer-in', value: 'transfer_in', labelAr: 'تحويل وارد', isSystem: true, isActive: true },
  { id: 'st-loan', value: 'loan', labelAr: 'سلف رصيد آجل', isSystem: true, isActive: true },
  { id: 'st-service-add', value: 'service_add', labelAr: 'خدمات مضافة', isSystem: true, isActive: true },
];

export const DEFAULT_ADMIN_STATEMENT_TRANSACTION_TYPES: DropdownOptionItem[] = [
  { id: 'adm-st-fee', value: 'fee_collected', labelAr: 'رسوم العمليات المحصلة', isSystem: true, isActive: true },
  { id: 'adm-st-dep', value: 'deposit_received', labelAr: 'حركات إيداع وشحن الرصيد', isSystem: true, isActive: true },
  { id: 'adm-st-settle', value: 'bank_settlement', labelAr: 'تسويات الحساب البنكي', isSystem: true, isActive: true },
  { id: 'adm-st-agent', value: 'agent_transfer', labelAr: 'تحويلات رصيد نقاط البيع', isSystem: true, isActive: true },
];

export const DEFAULT_APPROVED_BANK_NAMES: DropdownOptionItem[] = [
  { id: 'bank-rajhi', value: 'مصرف الراجحي', labelAr: 'مصرف الراجحي', isSystem: true, isActive: true },
  { id: 'bank-snb', value: 'البنك الأهلي السعودي (SNB)', labelAr: 'البنك الأهلي السعودي (SNB)', isSystem: true, isActive: true },
  { id: 'bank-riyad', value: 'بنك الرياض', labelAr: 'بنك الرياض', isSystem: true, isActive: true },
  { id: 'bank-alinma', value: 'مصرف الإنماء', labelAr: 'مصرف الإنماء', isSystem: true, isActive: true },
  { id: 'bank-kuraimi', value: 'بنك الكريمي للتمويل الأصغر الإسلامي', labelAr: 'بنك الكريمي للتمويل الأصغر الإسلامي', isSystem: true, isActive: true },
  { id: 'bank-tadhamon', value: 'بنك التضامن الإسلامي', labelAr: 'بنك التضامن الإسلامي', isSystem: true, isActive: true },
  { id: 'bank-saba', value: 'بنك سبأ الإسلامي', labelAr: 'بنك سبأ الإسلامي', isSystem: true, isActive: true },
  { id: 'bank-yemen-intl', value: 'بنك اليمن الدولي', labelAr: 'بنك اليمن الدولي', isSystem: true, isActive: true },
];

export const DEFAULT_PLATFORM_INTERFACE_SETTINGS: PlatformInterfaceSettings = {
  supplierInterfaceNotice: '',
  showSupplierInterfaceNotice: false,
  posInterfaceNotice: '',
  showPosInterfaceNotice: false,
  allowSuppliersCreateCustomCatalogs: true,
  showResaleMarginInPosPurchase: true,
  showTierComparisonInPosStore: true,
  statementTransactionTypes: DEFAULT_STATEMENT_TRANSACTION_TYPES,
  adminStatementTransactionTypes: DEFAULT_ADMIN_STATEMENT_TRANSACTION_TYPES,
  approvedBankNames: DEFAULT_APPROVED_BANK_NAMES,
};

export function mergePlatformSettings(
  partial?: Partial<PlatformInterfaceSettings> | null
): PlatformInterfaceSettings {
  if (!partial) {
    return {
      ...DEFAULT_PLATFORM_INTERFACE_SETTINGS,
      statementTransactionTypes: [...DEFAULT_STATEMENT_TRANSACTION_TYPES],
      adminStatementTransactionTypes: [...DEFAULT_ADMIN_STATEMENT_TRANSACTION_TYPES],
      approvedBankNames: [...DEFAULT_APPROVED_BANK_NAMES],
    };
  }

  return {
    supplierInterfaceNotice:
      typeof partial.supplierInterfaceNotice === 'string'
        ? partial.supplierInterfaceNotice
        : DEFAULT_PLATFORM_INTERFACE_SETTINGS.supplierInterfaceNotice,
    showSupplierInterfaceNotice:
      typeof partial.showSupplierInterfaceNotice === 'boolean'
        ? partial.showSupplierInterfaceNotice
        : DEFAULT_PLATFORM_INTERFACE_SETTINGS.showSupplierInterfaceNotice,
    posInterfaceNotice:
      typeof partial.posInterfaceNotice === 'string'
        ? partial.posInterfaceNotice
        : DEFAULT_PLATFORM_INTERFACE_SETTINGS.posInterfaceNotice,
    showPosInterfaceNotice:
      typeof partial.showPosInterfaceNotice === 'boolean'
        ? partial.showPosInterfaceNotice
        : DEFAULT_PLATFORM_INTERFACE_SETTINGS.showPosInterfaceNotice,
    allowSuppliersCreateCustomCatalogs:
      typeof partial.allowSuppliersCreateCustomCatalogs === 'boolean'
        ? partial.allowSuppliersCreateCustomCatalogs
        : DEFAULT_PLATFORM_INTERFACE_SETTINGS.allowSuppliersCreateCustomCatalogs,
    showResaleMarginInPosPurchase:
      typeof partial.showResaleMarginInPosPurchase === 'boolean'
        ? partial.showResaleMarginInPosPurchase
        : DEFAULT_PLATFORM_INTERFACE_SETTINGS.showResaleMarginInPosPurchase,
    showTierComparisonInPosStore:
      typeof partial.showTierComparisonInPosStore === 'boolean'
        ? partial.showTierComparisonInPosStore
        : DEFAULT_PLATFORM_INTERFACE_SETTINGS.showTierComparisonInPosStore,
    statementTransactionTypes:
      Array.isArray(partial.statementTransactionTypes) && partial.statementTransactionTypes.length > 0
        ? partial.statementTransactionTypes
        : [...DEFAULT_STATEMENT_TRANSACTION_TYPES],
    adminStatementTransactionTypes:
      Array.isArray(partial.adminStatementTransactionTypes) && partial.adminStatementTransactionTypes.length > 0
        ? partial.adminStatementTransactionTypes
        : [...DEFAULT_ADMIN_STATEMENT_TRANSACTION_TYPES],
    approvedBankNames:
      Array.isArray(partial.approvedBankNames) && partial.approvedBankNames.length > 0
        ? partial.approvedBankNames
        : [...DEFAULT_APPROVED_BANK_NAMES],
    updatedAt: partial.updatedAt,
  };
}

export function getActiveDropdownOptions(options?: DropdownOptionItem[] | null): DropdownOptionItem[] {
  if (!Array.isArray(options)) return [];
  return options.filter((opt) => opt && opt.isActive !== false && opt.labelAr.trim().length > 0);
}

export function getCatalogsForSupplierView(catalogs: Catalog[], supplierId: string): Catalog[] {
  const seen = new Set<string>();
  const result: Catalog[] = [];

  for (const cat of catalogs) {
    if (!cat || !cat.id || seen.has(cat.id)) continue;
    const isFixed = Boolean(cat.isFixedByAdmin || cat.supplierId === 'all');
    if (isFixed || !cat.supplierId || cat.supplierId === supplierId) {
      seen.add(cat.id);
      result.push(cat);
    }
  }
  return result;
}

export function getCatalogsForPosView(
  catalogs: Catalog[],
  supplierId: string,
  canViewGifts: boolean
): Catalog[] {
  return getCatalogsForSupplierView(catalogs, supplierId).filter(
    (c) => canViewGifts || !isCatalogFreeGifts(c)
  );
}

export function canSupplierModifyCatalog(
  catalog?: Catalog | null,
  role?: UserRole
): boolean {
  if (!catalog) return false;
  if (role === 'super_admin') return true;
  if (catalog.isFixedByAdmin || catalog.supplierId === 'all') return false;
  return true;
}

export function matchesStatementTransactionType(
  entry: AccountingEntry,
  selectedType: string,
  depositRequests: DepositRequest[] = [],
  customLabelAr?: string
): boolean {
  if (!selectedType || selectedType === 'all') return true;

  if (selectedType === 'loan' || selectedType === 'loans') {
    const desc = (entry.description || '').toLowerCase();
    if (desc.includes('سلف') || desc.includes('سلفة')) return true;
    const matchingDep = depositRequests.find((d) => d.id === entry.referenceId);
    if (matchingDep && (matchingDep.requestType === 'loan' || Boolean(matchingDep.loanReason))) {
      return true;
    }
    return (entry.type as string) === 'loan';
  }

  if (selectedType === 'transfers') {
    return entry.type === 'transfer_out' || entry.type === 'transfer_in';
  }

  if ((entry.type as string) === selectedType) {
    return true;
  }

  // Allow custom admin-added statement transaction types to match descriptions or service names if tagged
  if (customLabelAr && customLabelAr.trim()) {
    const label = customLabelAr.trim().toLowerCase();
    const desc = (entry.description || '').toLowerCase();
    if (desc.includes(label)) return true;
  }

  return false;
}

export function matchesAdminStatementTransactionType(
  entry: AdminAccountingEntry,
  selectedType: string,
  customLabelAr?: string
): boolean {
  if (!selectedType || selectedType === 'all') return true;

  const aliasMap: Record<string, string> = {
    fees: 'fee_collected',
    deposits: 'deposit_received',
    settlements: 'bank_settlement',
    transfers: 'agent_transfer',
  };
  const normalized = aliasMap[selectedType] || selectedType;

  if ((entry.type as string) === normalized) return true;

  if (customLabelAr && customLabelAr.trim()) {
    const label = customLabelAr.trim().toLowerCase();
    const desc = (entry.description || '').toLowerCase();
    const notes = (entry.notes || '').toLowerCase();
    if (desc.includes(label) || notes.includes(label)) return true;
  }

  return false;
}

export function normalizeDropdownValue(labelAr: string, explicitValue?: string): string {
  const trimmedValue = (explicitValue || '').trim();
  if (trimmedValue) return trimmedValue;
  const asciiSlug = labelAr
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (asciiSlug) return asciiSlug;
  return `opt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function getDropdownListTitle(listKey: PlatformDropdownListKey): string {
  switch (listKey) {
    case 'statementTransactionTypes':
      return 'نوع الحركة في كشف الحساب / كشف البنك (العملاء والموردون)';
    case 'adminStatementTransactionTypes':
      return 'نوع الحركة في كشف حساب مدير التطبيق';
    case 'approvedBankNames':
      return 'قائمة البنوك المعتمدة في القوائم المنسدلة';
  }
}
