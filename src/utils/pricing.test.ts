import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendUsedGiftServiceId,
  calculateBaseSupplierFee,
  calculateServicePurchasePricing,
  getEffectiveAppFeePercentage,
  getPackageTierPrice,
  hasClientUsedGiftService,
  isCatalogFreeGifts,
  resolveGiftClaimFeePayment,
  settlePendingGiftFeesOnRecharge,
  validateFreeGiftWalletBalance,
  ZERO_PRICE_CLIENT_FLOOR_SAR,
} from './pricing';
import { Catalog, ServicePackage, SuperAdmin, Supplier } from '../types';

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



