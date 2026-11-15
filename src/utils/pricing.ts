import { AccountTier, Catalog, DigitalService, ServicePackage, SuperAdmin, Supplier } from '../types';

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
  tier: AccountTier
): number {
  if (!pkg || !pkg.tierPrices) return 0;
  const tierVal = pkg.tierPrices[tier];
  if (typeof tierVal === 'number' && Number.isFinite(tierVal) && tierVal >= 0) {
    return tierVal;
  }
  const regularVal = pkg.tierPrices.regular;
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
  clientCanViewGifts?: boolean;
  clientPosId?: string;
  service?: DigitalService | null;
  catalog?: Catalog | null;
  supplier?: Partial<Supplier> | null;
  superAdmin?: Partial<SuperAdmin> | null;
}): ServicePricingBreakdown {
  const { pkg, clientTier, clientCanViewGifts = false, clientPosId, service, catalog, supplier, superAdmin } = params;

  const originalTierPrice = getPackageTierPrice(pkg, clientTier);
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
