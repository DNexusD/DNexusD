import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendUsedGiftServiceId,
  calculateBaseSupplierFee,
  calculateFeeFromRule,
  calculateServicePurchasePricing,
  computeGiftExpiresAt,
  createDefaultPlatformFeesConfig,
  evaluateClientGiftServiceStatus,
  formatGiftRemainingTimeAr,
  getEffectiveAppFeePercentage,
  getEffectivePlatformFeesConfig,
  getPackageTierPrice,
  hasClientUsedGiftService,
  isCatalogFreeGifts,
  isClientEligibleForGiftService,
  resolveGiftClaimFeePayment,
  resolveSpecificServiceFeeRule,
  settlePendingGiftFeesOnRecharge,
  sumPendingUnsettledClientFees,
  validateFreeGiftWalletBalance,
  ZERO_PRICE_CLIENT_FLOOR_SAR,
} from './pricing';
import { Catalog, DigitalService, PlatformFeesConfig, ServicePackage, SuperAdmin, Supplier } from '../types';

const sampleSupplier: Partial<Supplier> = {
  feeType: 'percentage',
  feePercentage: 1.0,
  fixedFeeAmount: 0,
};

const customAdminFeeSupplier: Partial<Supplier> = {
  feeType: 'percentage',
  feePercentage: 2.5,
  fixedFeeAmount: 0,
};

const sampleSuperAdmin: Partial<SuperAdmin> = {
  defaultFeeType: 'percentage',
  defaultFeePercentage: 1.5,
  defaultFixedFeeAmount: 0,
};

const standardCatalog: Catalog = {
  id: 'cat-games',
  supplierId: 'sup-1',
  nameAr: 'بطاقات الألعاب',
  descriptionAr: 'شحن الألعاب',
  icon: 'Gamepad2',
};

const freeGiftsCatalog: Catalog = {
  id: 'cat-free-gifts',
  supplierId: 'sup-1',
  nameAr: 'كتالوج الهدايا المجانية',
  descriptionAr: 'هدايا ومكافآت خاصة',
  icon: 'Gift',
  isFreeGiftsCatalog: true,
};

const standardPkg: ServicePackage = {
  id: 'pkg-1',
  name: 'باقة تجربة',
  tierPrices: {
    regular: 100,
    bronze: 90,
    silver: 80,
    gold: 70,
    vip: 60,
  },
};

const zeroVipPkg: ServicePackage = {
  id: 'pkg-zero-vip',
  name: 'عملية مجانية VIP',
  tierPrices: {
    regular: 50,
    bronze: 40,
    silver: 30,
    gold: 20,
    vip: 0,
  },
};

const allZeroPkg: ServicePackage = {
  id: 'pkg-all-zero',
  name: 'عملية بقيمة صفر',
  tierPrices: {
    regular: 0,
    bronze: 0,
    silver: 0,
    gold: 0,
    vip: 0,
  },
};

test('getPackageTierPrice preserves 0 instead of falling back to regular', () => {
  assert.equal(getPackageTierPrice(zeroVipPkg, 'vip'), 0);
  assert.equal(getPackageTierPrice(zeroVipPkg, 'gold'), 20);
  assert.equal(getPackageTierPrice(allZeroPkg, 'regular'), 0);
});

test('isCatalogFreeGifts identifies gift catalogs by flag, id, or Arabic label', () => {
  assert.equal(isCatalogFreeGifts(freeGiftsCatalog), true);
  assert.equal(
    isCatalogFreeGifts({ id: 'custom-1', supplierId: 'sup-1', nameAr: 'قسم الهدايا المجانية الجديد', descriptionAr: '', icon: 'Gift', isFreeGiftsCatalog: false }),
    true
  );
  assert.equal(
    isCatalogFreeGifts({ id: 'custom-2', supplierId: 'sup-1', nameAr: 'عروض خاصة', descriptionAr: '', icon: 'Gift', isFreeGiftsCatalog: true }),
    true
  );
  assert.equal(isCatalogFreeGifts(standardCatalog), false);
});

test('getEffectiveAppFeePercentage uses supplier percentage set by Admin or falls back to superAdmin default', () => {
  assert.equal(getEffectiveAppFeePercentage(sampleSupplier, sampleSuperAdmin), 1.0);
  assert.equal(getEffectiveAppFeePercentage(customAdminFeeSupplier, sampleSuperAdmin), 2.5);
  assert.equal(getEffectiveAppFeePercentage({ feePercentage: 0 }, sampleSuperAdmin), 0);
  assert.equal(getEffectiveAppFeePercentage(undefined, sampleSuperAdmin), 1.5);
  assert.equal(getEffectiveAppFeePercentage(undefined, undefined), 1.0);
});

test('Rule 1: non-gift operation priced at 0 by supplier shows/charges 0.5 SAR to client', () => {
  const vipZero = calculateServicePurchasePricing({
    pkg: zeroVipPkg,
    clientTier: 'vip',
    clientCanViewGifts: true,
    catalog: standardCatalog,
    supplier: sampleSupplier,
    superAdmin: sampleSuperAdmin,
  });

  assert.equal(vipZero.originalTierPrice, 0);
  assert.equal(vipZero.unitPrice, 0);
  assert.equal(vipZero.feeAmount, ZERO_PRICE_CLIENT_FLOOR_SAR);
  assert.equal(vipZero.totalAmount, 0.5);
  assert.equal(vipZero.isZeroPriceFloorApplied, true);
  assert.equal(vipZero.isFreeGiftApplied, false);

  const regularZero = calculateServicePurchasePricing({
    pkg: allZeroPkg,
    clientTier: 'regular',
    clientCanViewGifts: false,
    catalog: standardCatalog,
    supplier: sampleSupplier,
    superAdmin: sampleSuperAdmin,
  });

  assert.equal(regularZero.totalAmount, 0.5);
  assert.equal(regularZero.isZeroPriceFloorApplied, true);
});

test('Rule 2: service in Free Gifts catalog charges 0 SAR + Admin fee percentage of original tier price for clients with canViewGifts', () => {
  // Supplier configured with 1.0% by Admin
  const vipGift = calculateServicePurchasePricing({
    pkg: standardPkg,
    clientTier: 'vip',
    clientCanViewGifts: true,
    catalog: freeGiftsCatalog,
    supplier: sampleSupplier,
    superAdmin: sampleSuperAdmin,
  });
  assert.equal(vipGift.originalTierPrice, 60);
  assert.equal(vipGift.unitPrice, 0);
  assert.equal(vipGift.appFeePercentageApplied, 1.0);
  assert.equal(vipGift.feeAmount, 0.6); // 1.0% of 60 = 0.60
  assert.equal(vipGift.totalAmount, 0.6);
  assert.equal(vipGift.isFreeGiftApplied, true);
  assert.equal(vipGift.isZeroPriceFloorApplied, false);

  // Supplier customized to 2.5% by Admin
  const goldCustomGift = calculateServicePurchasePricing({
    pkg: standardPkg,
    clientTier: 'gold',
    clientCanViewGifts: true,
    catalog: freeGiftsCatalog,
    supplier: customAdminFeeSupplier,
    superAdmin: sampleSuperAdmin,
  });
  assert.equal(goldCustomGift.originalTierPrice, 70);
  assert.equal(goldCustomGift.unitPrice, 0);
  assert.equal(goldCustomGift.appFeePercentageApplied, 2.5);
  assert.equal(goldCustomGift.feeAmount, 1.75); // 2.5% of 70 = 1.75
  assert.equal(goldCustomGift.totalAmount, 1.75);

  // Fallback to SuperAdmin defaultFeePercentage (1.5%) when supplier has no custom feePercentage
  const regularAdminDefaultGift = calculateServicePurchasePricing({
    pkg: standardPkg,
    clientTier: 'regular',
    clientCanViewGifts: true,
    catalog: freeGiftsCatalog,
    supplier: undefined,
    superAdmin: sampleSuperAdmin,
  });
  assert.equal(regularAdminDefaultGift.originalTierPrice, 100);
  assert.equal(regularAdminDefaultGift.unitPrice, 0);
  assert.equal(regularAdminDefaultGift.appFeePercentageApplied, 1.5);
  assert.equal(regularAdminDefaultGift.feeAmount, 1.5); // 1.5% of 100 = 1.50
  assert.equal(regularAdminDefaultGift.totalAmount, 1.5);

  // Explicit 0% Admin fee
  const zeroPercentAdminGift = calculateServicePurchasePricing({
    pkg: standardPkg,
    clientTier: 'vip',
    clientCanViewGifts: true,
    catalog: freeGiftsCatalog,
    supplier: { feePercentage: 0 },
    superAdmin: sampleSuperAdmin,
  });
  assert.equal(zeroPercentAdminGift.appFeePercentageApplied, 0);
  assert.equal(zeroPercentAdminGift.feeAmount, 0);
  assert.equal(zeroPercentAdminGift.totalAmount, 0);
});

test('Free Gifts catalog rule does not apply gift discount when client lacks canViewGifts privilege', () => {
  const ineligibleClient = calculateServicePurchasePricing({
    pkg: standardPkg,
    clientTier: 'vip',
    clientCanViewGifts: false,
    catalog: freeGiftsCatalog,
    supplier: sampleSupplier,
    superAdmin: sampleSuperAdmin,
  });

  assert.equal(ineligibleClient.isFreeGiftApplied, false);
  assert.equal(ineligibleClient.unitPrice, 60);
  assert.equal(ineligibleClient.feeAmount, calculateBaseSupplierFee(60, sampleSupplier, sampleSuperAdmin));
  assert.equal(ineligibleClient.totalAmount, 60.6);
});

test('Standard positive price calculation uses supplier fee configuration', () => {
  const standard = calculateServicePurchasePricing({
    pkg: standardPkg,
    clientTier: 'bronze',
    clientCanViewGifts: true,
    catalog: standardCatalog,
    supplier: { feeType: 'both', feePercentage: 1.0, fixedFeeAmount: 0.5 },
    superAdmin: sampleSuperAdmin,
  });

  assert.equal(standard.originalTierPrice, 90);
  assert.equal(standard.unitPrice, 90);
  assert.equal(standard.feeAmount, 1.4); // 1% of 90 (0.9) + 0.5 = 1.4
  assert.equal(standard.totalAmount, 91.4);
  assert.equal(standard.isFreeGiftApplied, false);
  assert.equal(standard.isZeroPriceFloorApplied, false);
});

test('getPackageTierPrice and calculateServicePurchasePricing use packageTierPrices for package purchases', () => {
  const dualPkg: ServicePackage = {
    id: 'pkg-dual',
    name: 'قسائم ستور',
    allowSingleCodePurchase: true,
    allowPackagePurchase: true,
    packageCodesCount: 5,
    tierPrices: {
      regular: 20,
      bronze: 19,
      silver: 18,
      gold: 17,
      vip: 16,
    },
    packageTierPrices: {
      regular: 95,
      bronze: 90,
      silver: 85,
      gold: 80,
      vip: 75,
    },
  };

  assert.equal(getPackageTierPrice(dualPkg, 'vip', 'single_code'), 16);
  assert.equal(getPackageTierPrice(dualPkg, 'vip', 'package'), 75);

  const pkgCalc = calculateServicePurchasePricing({
    pkg: dualPkg,
    clientTier: 'gold',
    purchaseUnit: 'package',
    catalog: standardCatalog,
    supplier: sampleSupplier,
    superAdmin: sampleSuperAdmin,
  });

  assert.equal(pkgCalc.originalTierPrice, 80);
  assert.equal(pkgCalc.feeAmount, 0.8);
  assert.equal(pkgCalc.totalAmount, 80.8);

  const packageOnlyPkg: ServicePackage = {
    ...dualPkg,
    allowSingleCodePurchase: false,
    allowPackagePurchase: true,
  };
  // Even if purchaseUnit defaults to single_code, package-only falls back to packageTierPrices
  assert.equal(getPackageTierPrice(packageOnlyPkg, 'silver', 'single_code'), 85);
});

test('validateFreeGiftWalletBalance allows claiming free gifts regardless of wallet balance', () => {
  const emptyWallet = validateFreeGiftWalletBalance({
    isFreeGiftApplied: true,
    walletBalance: 0,
    totalAmount: 0.6,
  });
  assert.equal(emptyWallet.allowed, true);

  const sufficientWallet = validateFreeGiftWalletBalance({
    isFreeGiftApplied: true,
    walletBalance: 5,
    totalAmount: 0.6,
  });
  assert.equal(sufficientWallet.allowed, true);
});

test('resolveGiftClaimFeePayment deducts fee immediately when wallet has enough, and defers silently when insufficient', () => {
  // Sufficient wallet balance -> deduct immediately
  const paidNow = resolveGiftClaimFeePayment({
    isFreeGiftApplied: true,
    walletBalance: 10,
    feeAmount: 0.6,
    existingPendingFees: 0,
  });
  assert.equal(paidNow.isDeferred, false);
  assert.equal(paidNow.walletDeductionNow, 0.6);
  assert.equal(paidNow.deferredFeeAdded, 0);
  assert.equal(paidNow.newWalletBalance, 9.4);
  assert.equal(paidNow.newPendingGiftFees, 0);

  // Empty or insufficient wallet -> allow gift, keep wallet non-negative, record deferred fee
  const deferredEmpty = resolveGiftClaimFeePayment({
    isFreeGiftApplied: true,
    walletBalance: 0,
    feeAmount: 0.6,
    existingPendingFees: 0,
  });
  assert.equal(deferredEmpty.isDeferred, true);
  assert.equal(deferredEmpty.walletDeductionNow, 0);
  assert.equal(deferredEmpty.deferredFeeAdded, 0.6);
  assert.equal(deferredEmpty.newWalletBalance, 0);
  assert.equal(deferredEmpty.newPendingGiftFees, 0.6);

  // Partial insufficient wallet (0.25 < 0.60) -> keeps 0.25 and queues 0.60
  const deferredPartial = resolveGiftClaimFeePayment({
    isFreeGiftApplied: true,
    walletBalance: 0.25,
    feeAmount: 0.6,
    existingPendingFees: 0.5,
  });
  assert.equal(deferredPartial.isDeferred, true);
  assert.equal(deferredPartial.walletDeductionNow, 0);
  assert.equal(deferredPartial.newWalletBalance, 0.25);
  assert.equal(deferredPartial.newPendingGiftFees, 1.1);
});

test('settlePendingGiftFeesOnRecharge automatically deducts pending gift fees when wallet is topped up', () => {
  const fullSettle = settlePendingGiftFeesOnRecharge({
    currentWalletBalance: 0,
    rechargeAmount: 10,
    pendingGiftFees: 1.1,
  });
  assert.equal(fullSettle.settledFeeAmount, 1.1);
  assert.equal(fullSettle.finalWalletBalance, 8.9);
  assert.equal(fullSettle.remainingPendingGiftFees, 0);

  const partialSettle = settlePendingGiftFeesOnRecharge({
    currentWalletBalance: 0.2,
    rechargeAmount: 0.5,
    pendingGiftFees: 1.1,
  });
  assert.equal(partialSettle.settledFeeAmount, 0.7);
  assert.equal(partialSettle.finalWalletBalance, 0);
  assert.equal(partialSettle.remainingPendingGiftFees, 0.4);
});

test('hasClientUsedGiftService hides gift services once completed and preserves unfulfilled or non-gift services', () => {
  assert.equal(
    hasClientUsedGiftService({
      serviceId: 'srv-gift-1',
      isGiftService: true,
      usedGiftServiceIds: [],
      orders: [{ posId: 'pos-1', serviceId: 'srv-gift-1', status: 'pending_supplier' }],
      posId: 'pos-1',
    }),
    false
  );

  assert.equal(
    hasClientUsedGiftService({
      serviceId: 'srv-gift-1',
      isGiftService: true,
      usedGiftServiceIds: [],
      orders: [{ posId: 'pos-1', serviceId: 'srv-gift-1', status: 'completed' }],
      posId: 'pos-1',
    }),
    true
  );

  assert.equal(
    hasClientUsedGiftService({
      serviceId: 'srv-gift-2',
      isGiftService: true,
      usedGiftServiceIds: appendUsedGiftServiceId(undefined, 'srv-gift-2'),
      orders: [],
      posId: 'pos-1',
    }),
    true
  );

  // Non-gift services stay visible even after completed orders
  assert.equal(
    hasClientUsedGiftService({
      serviceId: 'srv-pubg',
      isGiftService: false,
      usedGiftServiceIds: ['srv-pubg'],
      orders: [{ posId: 'pos-1', serviceId: 'srv-pubg', status: 'completed' }],
      posId: 'pos-1',
    }),
    false
  );
});

test('isClientEligibleForGiftService and calculateServicePurchasePricing enforce merchant gift targeting', () => {
  const baseGiftService: DigitalService = {
    id: 'srv-gift-target',
    catalogId: 'cat-free-gifts',
    supplierId: 'sup-1',
    nameAr: 'هدية مخصصة',
    descriptionAr: 'وصف',
    icon: 'Gift',
    isActive: true,
    deliveryMethods: ['player_id'],
    packages: [standardPkg],
  };

  // 1. specific_clients: targeted client sees & gets 0 price even when canViewGifts=false; untargeted does NOT even when canViewGifts=true
  const clientTargetedSrv: DigitalService = {
    ...baseGiftService,
    giftTargetType: 'specific_clients',
    giftTargetPosIds: ['pos-target'],
  };
  assert.equal(
    isClientEligibleForGiftService({
      service: clientTargetedSrv,
      catalog: freeGiftsCatalog,
      clientPosId: 'pos-target',
      clientTier: 'regular',
      clientCanViewGifts: false,
    }),
    true
  );
  assert.equal(
    isClientEligibleForGiftService({
      service: clientTargetedSrv,
      catalog: freeGiftsCatalog,
      clientPosId: 'pos-other',
      clientTier: 'vip',
      clientCanViewGifts: true,
    }),
    false
  );
  const targetedPricing = calculateServicePurchasePricing({
    pkg: standardPkg,
    clientTier: 'regular',
    clientCanViewGifts: false,
    clientPosId: 'pos-target',
    service: clientTargetedSrv,
    catalog: freeGiftsCatalog,
    supplier: sampleSupplier,
    superAdmin: sampleSuperAdmin,
  });
  assert.equal(targetedPricing.isFreeGiftApplied, true);
  assert.equal(targetedPricing.unitPrice, 0);

  // 2. specific_tiers: only selected tiers get the gift regardless of canViewGifts
  const tierTargetedSrv: DigitalService = {
    ...baseGiftService,
    giftTargetType: 'specific_tiers',
    giftTargetTiers: ['gold', 'vip'],
  };
  assert.equal(
    isClientEligibleForGiftService({
      service: tierTargetedSrv,
      catalog: freeGiftsCatalog,
      clientPosId: 'pos-gold',
      clientTier: 'gold',
      clientCanViewGifts: false,
    }),
    true
  );
  assert.equal(
    isClientEligibleForGiftService({
      service: tierTargetedSrv,
      catalog: freeGiftsCatalog,
      clientPosId: 'pos-bronze',
      clientTier: 'bronze',
      clientCanViewGifts: true,
    }),
    false
  );

  // 3. all_tiers: all clients see and receive the gift even without canViewGifts
  const allTiersSrv: DigitalService = {
    ...baseGiftService,
    giftTargetType: 'all_tiers',
  };
  assert.equal(
    isClientEligibleForGiftService({
      service: allTiersSrv,
      catalog: freeGiftsCatalog,
      clientPosId: 'pos-any',
      clientTier: 'regular',
      clientCanViewGifts: false,
    }),
    true
  );

  // 4. Non-gift catalog always returns false even if giftTargetType is present
  assert.equal(
    isClientEligibleForGiftService({
      service: allTiersSrv,
      catalog: standardCatalog,
      clientPosId: 'pos-any',
      clientTier: 'vip',
      clientCanViewGifts: true,
    }),
    false
  );
});

test('evaluateClientGiftServiceStatus enforces merchant usage limits per client (default 1 and custom N)', () => {
  const baseGift: DigitalService = {
    id: 'srv-gift-limit',
    catalogId: 'cat-free-gifts',
    supplierId: 'sup-1',
    nameAr: 'هدية محدودة الاستخدام',
    descriptionAr: 'وصف',
    icon: 'Gift',
    isActive: true,
    deliveryMethods: ['player_id'],
    packages: [standardPkg],
    giftTargetType: 'all_tiers',
  };

  // Default max uses = 1
  const initialDefault = evaluateClientGiftServiceStatus({
    service: baseGift,
    catalog: freeGiftsCatalog,
    clientPosId: 'pos-1',
    clientTier: 'regular',
    orders: [],
  });
  assert.equal(initialDefault.isTargeted, true);
  assert.equal(initialDefault.isActive, true);
  assert.equal(initialDefault.maxUses, 1);
  assert.equal(initialDefault.usedCount, 0);
  assert.equal(initialDefault.remainingUses, 1);

  // Even a pending_supplier gift order consumes 1 usage so client cannot claim multiple times while pending
  const afterOnePending = evaluateClientGiftServiceStatus({
    service: baseGift,
    catalog: freeGiftsCatalog,
    clientPosId: 'pos-1',
    clientTier: 'regular',
    orders: [{ posId: 'pos-1', serviceId: 'srv-gift-limit', status: 'pending_supplier' }],
  });
  assert.equal(afterOnePending.isActive, false);
  assert.equal(afterOnePending.isUsageExhausted, true);
  assert.equal(afterOnePending.inactiveReason, 'usage_limit_reached');
  assert.equal(afterOnePending.remainingUses, 0);

  // Failed orders do NOT consume usage
  const afterFailedOrder = evaluateClientGiftServiceStatus({
    service: baseGift,
    catalog: freeGiftsCatalog,
    clientPosId: 'pos-1',
    clientTier: 'regular',
    orders: [{ posId: 'pos-1', serviceId: 'srv-gift-limit', status: 'failed' }],
  });
  assert.equal(afterFailedOrder.isActive, true);
  assert.equal(afterFailedOrder.usedCount, 0);

  // Custom max uses = 3: active at 2 uses, deactivated at 3 uses; independent per client
  const multiUseGift: DigitalService = {
    ...baseGift,
    giftMaxUsesPerClient: 3,
  };
  const clientAWith2Uses = evaluateClientGiftServiceStatus({
    service: multiUseGift,
    catalog: freeGiftsCatalog,
    clientPosId: 'pos-A',
    clientTier: 'gold',
    orders: [
      { posId: 'pos-A', serviceId: 'srv-gift-limit', status: 'completed' },
      { posId: 'pos-A', serviceId: 'srv-gift-limit', status: 'completed' },
      { posId: 'pos-B', serviceId: 'srv-gift-limit', status: 'completed' },
    ],
  });
  assert.equal(clientAWith2Uses.isActive, true);
  assert.equal(clientAWith2Uses.usedCount, 2);
  assert.equal(clientAWith2Uses.remainingUses, 1);

  const clientAWith3Uses = evaluateClientGiftServiceStatus({
    service: multiUseGift,
    catalog: freeGiftsCatalog,
    clientPosId: 'pos-A',
    clientTier: 'gold',
    orders: [
      { posId: 'pos-A', serviceId: 'srv-gift-limit', status: 'completed' },
      { posId: 'pos-A', serviceId: 'srv-gift-limit', status: 'completed' },
      { posId: 'pos-A', serviceId: 'srv-gift-limit', status: 'completed' },
    ],
  });
  assert.equal(clientAWith3Uses.isActive, false);
  assert.equal(clientAWith3Uses.isUsageExhausted, true);
  assert.equal(clientAWith3Uses.inactiveReason, 'usage_limit_reached');
});

test('evaluateClientGiftServiceStatus deactivates gift after merchant visibility period expires even if unused', () => {
  const startMs = Date.UTC(2026, 10, 1, 10, 0, 0);
  const expiresAtIso = computeGiftExpiresAt({
    durationValue: 24,
    durationUnit: 'hours',
    startMs,
  });
  assert.ok(expiresAtIso);

  const timedGift: DigitalService = {
    id: 'srv-gift-timed',
    catalogId: 'cat-free-gifts',
    supplierId: 'sup-1',
    nameAr: 'هدية مؤقتة',
    descriptionAr: 'وصف',
    icon: 'Gift',
    isActive: true,
    deliveryMethods: ['voucher_code'],
    packages: [standardPkg],
    giftTargetType: 'all_tiers',
    giftMaxUsesPerClient: 1,
    giftDurationValue: 24,
    giftDurationUnit: 'hours',
    giftExpiresAt: expiresAtIso,
  };

  // Before expiry (12 hours after start): active
  const beforeExpiry = evaluateClientGiftServiceStatus({
    service: timedGift,
    catalog: freeGiftsCatalog,
    clientPosId: 'pos-1',
    clientTier: 'regular',
    orders: [],
    nowMs: startMs + 12 * 60 * 60 * 1000,
  });
  assert.equal(beforeExpiry.isTargeted, true);
  assert.equal(beforeExpiry.isExpired, false);
  assert.equal(beforeExpiry.isActive, true);
  assert.equal(formatGiftRemainingTimeAr(beforeExpiry.remainingMs || 0), '12 ساعة');

  // At/after expiry (24 hours + 1 ms): deactivated even though usedCount is 0
  const afterExpiry = evaluateClientGiftServiceStatus({
    service: timedGift,
    catalog: freeGiftsCatalog,
    clientPosId: 'pos-1',
    clientTier: 'regular',
    orders: [],
    nowMs: startMs + 24 * 60 * 60 * 1000 + 1,
  });
  assert.equal(afterExpiry.isTargeted, true);
  assert.equal(afterExpiry.usedCount, 0);
  assert.equal(afterExpiry.isExpired, true);
  assert.equal(afterExpiry.isActive, false);
  assert.equal(afterExpiry.inactiveReason, 'expired');
});

test('Two-section PlatformFeesConfig resolves global vs store-specific rules for all supplier & client services', () => {
  const globalConfig: PlatformFeesConfig = {
    supplierServices: {
      supportGrant: { feeType: 'fixed', percentage: 0, fixedAmount: 2 },
      loanGrant: { feeType: 'percentage', percentage: 1.5, fixedAmount: 0 },
      saleToClient: { feeType: 'percentage', percentage: 0.5, fixedAmount: 0 },
    },
    clientServices: {
      depositRequest: { feeType: 'fixed', percentage: 0, fixedAmount: 3 },
      loanRequest: { feeType: 'both', percentage: 2, fixedAmount: 1 },
      servicePurchase: { feeType: 'percentage', percentage: 1.5, fixedAmount: 0 },
      balanceTransfer: { feeType: 'fixed', percentage: 0, fixedAmount: 1 },
    },
  };

  const adminWithSections: Partial<SuperAdmin> = {
    defaultFeeType: 'percentage',
    defaultFeePercentage: 1.5,
    defaultFixedFeeAmount: 0,
    defaultFeesConfig: globalConfig,
  };

  // Store without custom feesConfig inherits global sections
  const inheritedSupplier: Partial<Supplier> = { id: 'sup-inherited' };
  const inheritedEffective = getEffectivePlatformFeesConfig(inheritedSupplier, adminWithSections);
  assert.deepEqual(inheritedEffective.supplierServices.supportGrant, globalConfig.supplierServices.supportGrant);
  assert.deepEqual(inheritedEffective.clientServices.depositRequest, globalConfig.clientServices.depositRequest);

  // Store with custom two-section feesConfig overrides both sections independently
  const customSupplier: Partial<Supplier> = {
    id: 'sup-custom',
    feeType: 'percentage',
    feePercentage: 2.0,
    fixedFeeAmount: 0,
    feesConfig: {
      supplierServices: {
        supportGrant: { feeType: 'percentage', percentage: 3, fixedAmount: 0 },
        loanGrant: { feeType: 'fixed', percentage: 0, fixedAmount: 5 },
        saleToClient: { feeType: 'both', percentage: 1, fixedAmount: 0.25 },
      },
      clientServices: {
        depositRequest: { feeType: 'percentage', percentage: 0.5, fixedAmount: 0 },
        loanRequest: { feeType: 'fixed', percentage: 0, fixedAmount: 4 },
        servicePurchase: { feeType: 'percentage', percentage: 2.0, fixedAmount: 0 },
        balanceTransfer: { feeType: 'percentage', percentage: 0.25, fixedAmount: 0 },
      },
    },
  };

  const supSaleRule = resolveSpecificServiceFeeRule({
    section: 'supplier',
    serviceKey: 'saleToClient',
    supplier: customSupplier,
    superAdmin: adminWithSections,
  });
  assert.equal(calculateFeeFromRule(200, supSaleRule), 2.25); // 1% of 200 (2.00) + 0.25

  const clientLoanRule = resolveSpecificServiceFeeRule({
    section: 'client',
    serviceKey: 'loanRequest',
    supplier: customSupplier,
    superAdmin: adminWithSections,
  });
  assert.equal(calculateFeeFromRule(500, clientLoanRule, { capAtAmount: true }), 4);
  assert.equal(calculateFeeFromRule(2, clientLoanRule, { capAtAmount: true }), 2);

  // Default zero fees for new per-service rules when no defaultFeesConfig is set
  const defaultCfg = createDefaultPlatformFeesConfig({ feeType: 'percentage', percentage: 1, fixedAmount: 0 });
  assert.equal(defaultCfg.supplierServices.supportGrant.percentage, 0);
  assert.equal(defaultCfg.clientServices.depositRequest.fixedAmount, 0);
  assert.equal(defaultCfg.clientServices.servicePurchase.percentage, 1);
});

test('sumPendingUnsettledClientFees reserves fees only for unsettled non-gift pending orders', () => {
  const orders = [
    { posId: 'pos-1', status: 'pending_supplier' as const, feeAmount: 2.5, feeSettledToAdmin: false, isFreeGiftOrder: false },
    { posId: 'pos-1', status: 'in_progress' as const, feeAmount: 1.25, feeSettledToAdmin: false, isFreeGiftOrder: false },
    // Completed or failed or already settled or gift orders should NOT reserve extra balance
    { posId: 'pos-1', status: 'completed' as const, feeAmount: 5, feeSettledToAdmin: true, isFreeGiftOrder: false },
    { posId: 'pos-1', status: 'failed' as const, feeAmount: 3, feeSettledToAdmin: false, isFreeGiftOrder: false },
    { posId: 'pos-1', status: 'pending_supplier' as const, feeAmount: 1, feeSettledToAdmin: false, isFreeGiftOrder: true },
    { posId: 'pos-2', status: 'pending_supplier' as const, feeAmount: 10, feeSettledToAdmin: false, isFreeGiftOrder: false },
  ];

  assert.equal(sumPendingUnsettledClientFees(orders, 'pos-1'), 3.75);
  assert.equal(sumPendingUnsettledClientFees(orders, 'pos-2'), 10);
  assert.equal(sumPendingUnsettledClientFees(orders, 'pos-3'), 0);
});

