import { AccountTier, Catalog, DigitalService, ServicePackage, SuperAdmin, Supplier, WarehousePurchaseUnit } from '../types';

export const ZERO_PRICE_CLIENT_FLOOR_SAR = 0.5;

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
  if (
    typeof supplier?.feePercentage === 'number' &&
    Number.isFinite(supplier.feePercentage) &&
    supplier.feePercentage >= 0
  ) {
    return supplier.feePercentage;
  }
  if (
    typeof superAdmin?.defaultFeePercentage === 'number' &&
    Number.isFinite(superAdmin.defaultFeePercentage) &&
    superAdmin.defaultFeePercentage >= 0
  ) {
    return superAdmin.defaultFeePercentage;
  }
  return 1.0;
}

export function calculateBaseSupplierFee(
  amount: number,
  supplier?: Partial<Supplier> | null,
  superAdmin?: Partial<SuperAdmin> | null
): number {
  const safeAmount = typeof amount === 'number' && Number.isFinite(amount) && amount > 0 ? amount : 0;
  let fee = 0;
  const feeType = supplier?.feeType || superAdmin?.defaultFeeType || 'percentage';

  if (feeType === 'percentage' || feeType === 'both') {
    const pct = getEffectiveAppFeePercentage(supplier, superAdmin);
    fee += (safeAmount * pct) / 100;
  }
  if (feeType === 'fixed' || feeType === 'both') {
    const fixed = supplier?.fixedFeeAmount ?? superAdmin?.defaultFixedFeeAmount ?? 0.0;
    fee += fixed;
  }
  return parseFloat(fee.toFixed(2));
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
  const freeGiftCatalog = isCatalogFreeGifts(catalog);
  const appFeePct = getEffectiveAppFeePercentage(supplier, superAdmin);

  let isGiftEligible = freeGiftCatalog && clientCanViewGifts;
  if (isGiftEligible && service) {
    const targetType = service.giftTargetType || 'all_tiers';
    if (targetType === 'specific_tiers') {
      const allowedTiers = service.giftTargetTiers || [];
      if (!allowedTiers.includes(clientTier)) {
        isGiftEligible = false;
      }
    } else if (targetType === 'specific_clients') {
      const allowedPosIds = service.giftTargetPosIds || [];
      if (!clientPosId || !allowedPosIds.includes(clientPosId)) {
        isGiftEligible = false;
      }
    }
  }

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
