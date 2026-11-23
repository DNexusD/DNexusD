import {
  AccountTier,
  Catalog,
  ClientServiceFeesConfig,
  DigitalService,
  Order,
  PlatformFeesConfig,
  ServiceFeeRule,
  ServicePackage,
  SuperAdmin,
  Supplier,
  SupplierServiceFeesConfig,
  WarehousePurchaseUnit,
} from '../types';

export const ZERO_PRICE_CLIENT_FLOOR_SAR = 0.5;

export type SupplierFeeServiceKey = keyof SupplierServiceFeesConfig;
export type ClientFeeServiceKey = keyof ClientServiceFeesConfig;

export const DEFAULT_ZERO_FEE_RULE: ServiceFeeRule = {
  feeType: 'percentage',
  percentage: 0,
  fixedAmount: 0,
};

export const DEFAULT_PRIMARY_FEE_RULE: ServiceFeeRule = {
  feeType: 'percentage',
  percentage: 1.0,
  fixedAmount: 0,
};

export function normalizeServiceFeeRule(
  rule?: Partial<ServiceFeeRule> | null,
  fallback: ServiceFeeRule = DEFAULT_ZERO_FEE_RULE
): ServiceFeeRule {
  const feeType =
    rule?.feeType === 'percentage' || rule?.feeType === 'fixed' || rule?.feeType === 'both'
      ? rule.feeType
      : fallback.feeType;
  const percentage =
    typeof rule?.percentage === 'number' && Number.isFinite(rule.percentage) && rule.percentage >= 0
      ? parseFloat(rule.percentage.toFixed(4))
      : fallback.percentage;
  const fixedAmount =
    typeof rule?.fixedAmount === 'number' && Number.isFinite(rule.fixedAmount) && rule.fixedAmount >= 0
      ? parseFloat(rule.fixedAmount.toFixed(2))
      : fallback.fixedAmount;

  return {
    feeType,
    percentage,
    fixedAmount,
  };
}

export function createDefaultPlatformFeesConfig(
  legacyPrimaryRule?: Partial<ServiceFeeRule> | null
): PlatformFeesConfig {
  const primary = normalizeServiceFeeRule(legacyPrimaryRule, DEFAULT_PRIMARY_FEE_RULE);
  return {
    supplierServices: {
      supportGrant: { ...DEFAULT_ZERO_FEE_RULE },
      loanGrant: { ...DEFAULT_ZERO_FEE_RULE },
      saleToClient: { ...DEFAULT_ZERO_FEE_RULE },
    },
    clientServices: {
      depositRequest: { ...DEFAULT_ZERO_FEE_RULE },
      loanRequest: { ...DEFAULT_ZERO_FEE_RULE },
      servicePurchase: { ...primary },
      balanceTransfer: { ...primary },
    },
  };
}

export function normalizePlatformFeesConfig(
  config?: Partial<PlatformFeesConfig> | null,
  fallbackConfig?: PlatformFeesConfig
): PlatformFeesConfig {
  const base = fallbackConfig || createDefaultPlatformFeesConfig();
  return {
    supplierServices: {
      supportGrant: normalizeServiceFeeRule(config?.supplierServices?.supportGrant, base.supplierServices.supportGrant),
      loanGrant: normalizeServiceFeeRule(config?.supplierServices?.loanGrant, base.supplierServices.loanGrant),
      saleToClient: normalizeServiceFeeRule(config?.supplierServices?.saleToClient, base.supplierServices.saleToClient),
    },
    clientServices: {
      depositRequest: normalizeServiceFeeRule(config?.clientServices?.depositRequest, base.clientServices.depositRequest),
      loanRequest: normalizeServiceFeeRule(config?.clientServices?.loanRequest, base.clientServices.loanRequest),
      servicePurchase: normalizeServiceFeeRule(config?.clientServices?.servicePurchase, base.clientServices.servicePurchase),
      balanceTransfer: normalizeServiceFeeRule(
        config?.clientServices?.balanceTransfer ?? config?.clientServices?.servicePurchase,
        base.clientServices.balanceTransfer || base.clientServices.servicePurchase
      ),
    },
  };
}

export function getEffectivePlatformFeesConfig(
  supplier?: Partial<Supplier> | null,
  superAdmin?: Partial<SuperAdmin> | null
): PlatformFeesConfig {
  const adminLegacyPrimary = normalizeServiceFeeRule(
    {
      feeType: superAdmin?.defaultFeeType,
      percentage: superAdmin?.defaultFeePercentage,
      fixedAmount: superAdmin?.defaultFixedFeeAmount,
    },
    DEFAULT_PRIMARY_FEE_RULE
  );

  const globalConfig = superAdmin?.defaultFeesConfig
    ? normalizePlatformFeesConfig(superAdmin.defaultFeesConfig, createDefaultPlatformFeesConfig(adminLegacyPrimary))
    : createDefaultPlatformFeesConfig(adminLegacyPrimary);

  if (!supplier) {
    return globalConfig;
  }

  const hasLegacySupplierPrimary =
    supplier.feeType !== undefined ||
    supplier.feePercentage !== undefined ||
    supplier.fixedFeeAmount !== undefined;

  const supplierLegacyPrimary = hasLegacySupplierPrimary
    ? normalizeServiceFeeRule(
        {
          feeType: supplier.feeType,
          percentage: supplier.feePercentage,
          fixedAmount: supplier.fixedFeeAmount,
        },
        globalConfig.clientServices.servicePurchase
      )
    : globalConfig.clientServices.servicePurchase;

  if (supplier.feesConfig) {
    return normalizePlatformFeesConfig(supplier.feesConfig, {
      ...globalConfig,
      clientServices: {
        ...globalConfig.clientServices,
        servicePurchase: supplierLegacyPrimary,
        balanceTransfer: globalConfig.clientServices.balanceTransfer || supplierLegacyPrimary,
      },
    });
  }

  return {
    supplierServices: { ...globalConfig.supplierServices },
    clientServices: {
      ...globalConfig.clientServices,
      servicePurchase: supplierLegacyPrimary,
      balanceTransfer: supplierLegacyPrimary,
    },
  };
}

export function resolveSpecificServiceFeeRule(params: {
  section: 'supplier' | 'client';
  serviceKey: SupplierFeeServiceKey | ClientFeeServiceKey;
  supplier?: Partial<Supplier> | null;
  superAdmin?: Partial<SuperAdmin> | null;
}): ServiceFeeRule {
  const effective = getEffectivePlatformFeesConfig(params.supplier, params.superAdmin);
  if (params.section === 'supplier') {
    const key = params.serviceKey as SupplierFeeServiceKey;
    return effective.supplierServices[key] || DEFAULT_ZERO_FEE_RULE;
  }
  const key = params.serviceKey as ClientFeeServiceKey;
  if (key === 'balanceTransfer') {
    return effective.clientServices.balanceTransfer || effective.clientServices.servicePurchase;
  }
  return effective.clientServices[key] || DEFAULT_ZERO_FEE_RULE;
}

export function calculateFeeFromRule(
  amount: number,
  rule?: Partial<ServiceFeeRule> | null,
  options?: { capAtAmount?: boolean }
): number {
  const safeAmount = typeof amount === 'number' && Number.isFinite(amount) && amount > 0 ? amount : 0;
  if (safeAmount <= 0) return 0;

  const normalized = normalizeServiceFeeRule(rule, DEFAULT_ZERO_FEE_RULE);
  let fee = 0;

  if (normalized.feeType === 'percentage' || normalized.feeType === 'both') {
    fee += (safeAmount * normalized.percentage) / 100;
  }
  if (normalized.feeType === 'fixed' || normalized.feeType === 'both') {
    fee += normalized.fixedAmount;
  }

  const rounded = parseFloat(Math.max(0, fee).toFixed(2));
  if (options?.capAtAmount) {
    return parseFloat(Math.min(safeAmount, rounded).toFixed(2));
  }
  return rounded;
}

export function sumPendingUnsettledClientFees(
  orders: Array<Pick<Order, 'posId' | 'status' | 'feeAmount' | 'feeSettledToAdmin' | 'isFreeGiftOrder'>>,
  posId: string
): number {
  if (!Array.isArray(orders) || !posId) return 0;
  const total = orders.reduce((sum, order) => {
    if (
      order.posId === posId &&
      (order.status === 'pending_supplier' || order.status === 'in_progress') &&
      order.feeSettledToAdmin === false &&
      !order.isFreeGiftOrder
    ) {
      return sum + (Number.isFinite(order.feeAmount) && order.feeAmount > 0 ? order.feeAmount : 0);
    }
    return sum;
  }, 0);
  return parseFloat(total.toFixed(2));
}

export interface ServicePricingBreakdown {
  originalTierPrice: number;
  unitPrice: number;
  feeAmount: number;
  totalAmount: number;
  appFeePercentageApplied: number;
  isFreeGiftApplied: boolean;
  isZeroPriceFloorApplied: boolean;
}

export function isCatalogFreeGifts(catalog?: Catalog | null): boolean {
  if (!catalog) return false;
  return Boolean(
    catalog.isFreeGiftsCatalog ||
      catalog.id === 'cat-free-gifts' ||
      (catalog.nameAr && catalog.nameAr.includes('الهدايا المجانية'))
  );
}

export function getPackageTierPrice(
  pkg: ServicePackage | null | undefined,
  tier: AccountTier,
  purchaseUnit: WarehousePurchaseUnit = 'single_code'
): number {
  if (!pkg) return 0;

  const usePackagePrices =
    (purchaseUnit === 'package' && Boolean(pkg.allowPackagePurchase) && Boolean(pkg.packageTierPrices)) ||
    (pkg.allowSingleCodePurchase === false && Boolean(pkg.allowPackagePurchase) && Boolean(pkg.packageTierPrices));

  const priceMap = usePackagePrices ? pkg.packageTierPrices : pkg.tierPrices;
  if (!priceMap) return 0;

  const tierVal = priceMap[tier];
  if (typeof tierVal === 'number' && Number.isFinite(tierVal) && tierVal >= 0) {
    return tierVal;
  }
  const regularVal = priceMap.regular;
  if (typeof regularVal === 'number' && Number.isFinite(regularVal) && regularVal >= 0) {
    return regularVal;
  }
  return 0;
}

export function getEffectiveAppFeePercentage(
  supplier?: Partial<Supplier> | null,
  superAdmin?: Partial<SuperAdmin> | null
): number {
  const rule = resolveSpecificServiceFeeRule({
    section: 'client',
    serviceKey: 'servicePurchase',
    supplier,
    superAdmin,
  });
  return rule.percentage;
}

export function calculateBaseSupplierFee(
  amount: number,
  supplier?: Partial<Supplier> | null,
  superAdmin?: Partial<SuperAdmin> | null
): number {
  const rule = resolveSpecificServiceFeeRule({
    section: 'client',
    serviceKey: 'servicePurchase',
    supplier,
    superAdmin,
  });
  return calculateFeeFromRule(amount, rule);
}

export function isClientEligibleForGiftService(params: {
  service?: DigitalService | null;
  catalog?: Catalog | null;
  clientPosId?: string;
  clientTier: AccountTier;
  clientCanViewGifts?: boolean;
}): boolean {
  const { service, catalog, clientPosId, clientTier, clientCanViewGifts = false } = params;
  if (!isCatalogFreeGifts(catalog)) return false;

  if (service?.giftTargetType === 'specific_clients') {
    return Boolean(
      clientPosId &&
        Array.isArray(service.giftTargetPosIds) &&
        service.giftTargetPosIds.includes(clientPosId)
    );
  }

  if (service?.giftTargetType === 'specific_tiers') {
    return Boolean(
      Array.isArray(service.giftTargetTiers) &&
        service.giftTargetTiers.includes(clientTier)
    );
  }

  if (service?.giftTargetType === 'all_tiers') {
    return true;
  }

  return Boolean(clientCanViewGifts);
}

export function calculateServicePurchasePricing(params: {
  pkg: ServicePackage | null | undefined;
  clientTier: AccountTier;
  purchaseUnit?: WarehousePurchaseUnit;
  clientCanViewGifts?: boolean;
  clientPosId?: string;
  service?: DigitalService | null;
  catalog?: Catalog | null;
  supplier?: Partial<Supplier> | null;
  superAdmin?: Partial<SuperAdmin> | null;
}): ServicePricingBreakdown {
  const { pkg, clientTier, purchaseUnit = 'single_code', clientCanViewGifts = false, clientPosId, service, catalog, supplier, superAdmin } = params;

  const originalTierPrice = getPackageTierPrice(pkg, clientTier, purchaseUnit);
  const appFeePct = getEffectiveAppFeePercentage(supplier, superAdmin);

  const isGiftEligible = isClientEligibleForGiftService({
    service,
    catalog,
    clientPosId,
    clientTier,
    clientCanViewGifts,
  });

  if (isGiftEligible) {
    const giftFee = parseFloat(((originalTierPrice * appFeePct) / 100).toFixed(2));
    return {
      originalTierPrice,
      unitPrice: 0,
      feeAmount: giftFee,
      totalAmount: giftFee,
      appFeePercentageApplied: appFeePct,
      isFreeGiftApplied: true,
      isZeroPriceFloorApplied: false
    };
  }

  // Rule 1: Any non-gift operation whose value is set by the supplier to 0
  // appears to the client with value 0.5 SAR.
  if (originalTierPrice === 0) {
    return {
      originalTierPrice: 0,
      unitPrice: 0,
      feeAmount: ZERO_PRICE_CLIENT_FLOOR_SAR,
      totalAmount: ZERO_PRICE_CLIENT_FLOOR_SAR,
      appFeePercentageApplied: appFeePct,
      isFreeGiftApplied: false,
      isZeroPriceFloorApplied: true
    };
  }

  // Standard tier pricing + supplier platform fee
  const unitPrice = originalTierPrice;
  const feeAmount = calculateBaseSupplierFee(unitPrice, supplier, superAdmin);
  const totalAmount = parseFloat((unitPrice + feeAmount).toFixed(2));

  return {
    originalTierPrice,
    unitPrice,
    feeAmount,
    totalAmount,
    appFeePercentageApplied: appFeePct,
    isFreeGiftApplied: false,
    isZeroPriceFloorApplied: false
  };
}

export const FREE_GIFT_MIN_WALLET_BALANCE_SAR = 0;
export const FREE_GIFT_EMPTY_WALLET_MESSAGE = 'لاستلام هديتك لابد ان يكون في محفظتك 10 ر.س';
export const FREE_GIFT_LOW_WALLET_MESSAGE = 'لاستلام هديتك لابد ان يكون في محفظتك على الأقل 1 ر.س';

export function validateFreeGiftWalletBalance(_params: {
  isFreeGiftApplied: boolean;
  walletBalance: number;
  totalAmount?: number;
}): { allowed: boolean; message?: string } {
  // Free gifts can always be claimed: if wallet covers app fee it is deducted immediately;
  // otherwise the app fee is deferred silently until the next wallet recharge.
  return { allowed: true };
}

function roundCurrencySar(value: number): number {
  return parseFloat((Number.isFinite(value) ? value : 0).toFixed(2));
}

export interface GiftFeePaymentResolution {
  walletDeductionNow: number;
  deferredFeeAdded: number;
  newWalletBalance: number;
  newPendingGiftFees: number;
  isDeferred: boolean;
}

export function resolveGiftClaimFeePayment(params: {
  isFreeGiftApplied: boolean;
  walletBalance: number;
  feeAmount: number;
  existingPendingFees?: number;
}): GiftFeePaymentResolution {
  const walletBalance = roundCurrencySar(params.walletBalance);
  const feeAmount = Math.max(0, roundCurrencySar(params.feeAmount));
  const existingPendingFees = Math.max(0, roundCurrencySar(params.existingPendingFees ?? 0));

  if (!params.isFreeGiftApplied) {
    return {
      walletDeductionNow: feeAmount,
      deferredFeeAdded: 0,
      newWalletBalance: roundCurrencySar(walletBalance - feeAmount),
      newPendingGiftFees: existingPendingFees,
      isDeferred: false,
    };
  }

  if (feeAmount <= 0) {
    return {
      walletDeductionNow: 0,
      deferredFeeAdded: 0,
      newWalletBalance: walletBalance,
      newPendingGiftFees: existingPendingFees,
      isDeferred: false,
    };
  }

  if (walletBalance >= feeAmount) {
    return {
      walletDeductionNow: feeAmount,
      deferredFeeAdded: 0,
      newWalletBalance: roundCurrencySar(walletBalance - feeAmount),
      newPendingGiftFees: existingPendingFees,
      isDeferred: false,
    };
  }

  // Insufficient balance: allow claiming gift, do not drop/negative wallet balance, defer fee until recharge
  return {
    walletDeductionNow: 0,
    deferredFeeAdded: feeAmount,
    newWalletBalance: walletBalance,
    newPendingGiftFees: roundCurrencySar(existingPendingFees + feeAmount),
    isDeferred: true,
  };
}

export interface PendingGiftFeeSettlementResult {
  settledFeeAmount: number;
  finalWalletBalance: number;
  remainingPendingGiftFees: number;
}

export function settlePendingGiftFeesOnRecharge(params: {
  currentWalletBalance: number;
  rechargeAmount: number;
  pendingGiftFees?: number;
}): PendingGiftFeeSettlementResult {
  const currentBalance = roundCurrencySar(params.currentWalletBalance);
  const rechargeAmount = Math.max(0, roundCurrencySar(params.rechargeAmount));
  const pendingFees = Math.max(0, roundCurrencySar(params.pendingGiftFees ?? 0));
  const balanceAfterRecharge = roundCurrencySar(currentBalance + rechargeAmount);

  if (pendingFees <= 0 || balanceAfterRecharge <= 0) {
    return {
      settledFeeAmount: 0,
      finalWalletBalance: balanceAfterRecharge,
      remainingPendingGiftFees: pendingFees,
    };
  }

  const settledFeeAmount = roundCurrencySar(Math.min(balanceAfterRecharge, pendingFees));
  const finalWalletBalance = roundCurrencySar(balanceAfterRecharge - settledFeeAmount);
  const remainingPendingGiftFees = roundCurrencySar(pendingFees - settledFeeAmount);

  return {
    settledFeeAmount,
    finalWalletBalance,
    remainingPendingGiftFees,
  };
}

export function appendUsedGiftServiceId(
  usedGiftServiceIds: string[] | undefined,
  serviceId: string
): string[] {
  const list = Array.isArray(usedGiftServiceIds) ? usedGiftServiceIds : [];
  if (!serviceId || list.includes(serviceId)) return list;
  return [...list, serviceId];
}

export function hasClientUsedGiftService(params: {
  serviceId: string;
  isGiftService: boolean;
  usedGiftServiceIds?: string[];
  orders?: Array<{ posId: string; serviceId: string; status: string }>;
  posId: string;
}): boolean {
  if (!params.isGiftService) return false;
  if (Array.isArray(params.usedGiftServiceIds) && params.usedGiftServiceIds.includes(params.serviceId)) {
    return true;
  }
  if (
    Array.isArray(params.orders) &&
    params.orders.some(
      (o) => o.posId === params.posId && o.serviceId === params.serviceId && o.status === 'completed'
    )
  ) {
    return true;
  }
  return false;
}

export type GiftDurationUnit = 'hours' | 'days';

export function normalizeGiftMaxUses(maxUses?: number): number {
  if (typeof maxUses === 'number' && Number.isFinite(maxUses) && maxUses >= 1) {
    return Math.floor(maxUses);
  }
  return 1;
}

export function computeGiftExpiresAt(params: {
  durationValue?: number;
  durationUnit?: GiftDurationUnit;
  startMs?: number;
}): string | undefined {
  const val = params.durationValue;
  if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) {
    return undefined;
  }
  const unitMs = params.durationUnit === 'hours' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const start = typeof params.startMs === 'number' && Number.isFinite(params.startMs) ? params.startMs : Date.now();
  return new Date(start + val * unitMs).toISOString();
}

export function formatGiftRemainingTimeAr(remainingMs: number): string {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return 'منتهية الصلاحية';
  }
  const totalMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    const dayLabel = days === 1 ? 'يوم واحد' : days === 2 ? 'يومان' : days <= 10 ? `${days} أيام` : `${days} يوماً`;
    if (hours > 0) {
      return `${dayLabel} و${hours} س`;
    }
    return dayLabel;
  }
  if (hours > 0) {
    const hourLabel = hours === 1 ? 'ساعة واحدة' : hours === 2 ? 'ساعتان' : hours <= 10 ? `${hours} ساعات` : `${hours} ساعة`;
    if (minutes > 0) {
      return `${hourLabel} و${minutes} د`;
    }
    return hourLabel;
  }
  return minutes === 1 ? 'دقيقة واحدة' : minutes <= 10 ? `${minutes} دقائق` : `${minutes} دقيقة`;
}

export interface ClientGiftServiceStatus {
  isGiftCatalog: boolean;
  isTargeted: boolean;
  isActive: boolean;
  isExpired: boolean;
  isUsageExhausted: boolean;
  maxUses: number;
  usedCount: number;
  remainingUses: number;
  expiresAtMs: number | null;
  remainingMs: number | null;
  inactiveReason?: 'not_targeted' | 'expired' | 'usage_limit_reached';
}

export function evaluateClientGiftServiceStatus(params: {
  service?: DigitalService | null;
  catalog?: Catalog | null;
  clientPosId?: string;
  clientTier: AccountTier;
  clientCanViewGifts?: boolean;
  usedGiftServiceIds?: string[];
  orders?: Array<{ posId: string; serviceId: string; status: string }>;
  nowMs?: number;
}): ClientGiftServiceStatus {
  const {
    service,
    catalog,
    clientPosId,
    clientTier,
    clientCanViewGifts = false,
    usedGiftServiceIds,
    orders,
    nowMs = Date.now(),
  } = params;

  const isGiftCatalog = isCatalogFreeGifts(catalog);
  const maxUses = normalizeGiftMaxUses(service?.giftMaxUsesPerClient);

  if (!isGiftCatalog || !service) {
    return {
      isGiftCatalog,
      isTargeted: false,
      isActive: false,
      isExpired: false,
      isUsageExhausted: false,
      maxUses,
      usedCount: 0,
      remainingUses: 0,
      expiresAtMs: null,
      remainingMs: null,
      inactiveReason: 'not_targeted',
    };
  }

  const isTargeted = isClientEligibleForGiftService({
    service,
    catalog,
    clientPosId,
    clientTier,
    clientCanViewGifts,
  });

  const matchingOrdersCount = Array.isArray(orders) && clientPosId
    ? orders.filter(
        (o) => o.posId === clientPosId && o.serviceId === service.id && o.status !== 'failed'
      ).length
    : 0;

  const hasLegacyUsedFlag =
    matchingOrdersCount === 0 &&
    Array.isArray(usedGiftServiceIds) &&
    usedGiftServiceIds.includes(service.id);

  const usedCount = hasLegacyUsedFlag ? 1 : matchingOrdersCount;
  const remainingUses = Math.max(0, maxUses - usedCount);
  const isUsageExhausted = usedCount >= maxUses;

  const parsedExpiresAt = service.giftExpiresAt ? Date.parse(service.giftExpiresAt) : NaN;
  const hasValidExpiry = Number.isFinite(parsedExpiresAt);
  const expiresAtMs = hasValidExpiry ? parsedExpiresAt : null;
  const remainingMs = hasValidExpiry ? parsedExpiresAt - nowMs : null;
  const isExpired = hasValidExpiry && nowMs >= parsedExpiresAt;

  const isActive = isTargeted && !isExpired && !isUsageExhausted;

  let inactiveReason: ClientGiftServiceStatus['inactiveReason'];
  if (!isTargeted) {
    inactiveReason = 'not_targeted';
  } else if (isExpired) {
    inactiveReason = 'expired';
  } else if (isUsageExhausted) {
    inactiveReason = 'usage_limit_reached';
  }

  return {
    isGiftCatalog: true,
    isTargeted,
    isActive,
    isExpired,
    isUsageExhausted,
    maxUses,
    usedCount,
    remainingUses,
    expiresAtMs,
    remainingMs,
    inactiveReason,
  };
}

