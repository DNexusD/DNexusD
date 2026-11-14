import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBaseSupplierFee,
  calculateServicePurchasePricing,
  getEffectiveAppFeePercentage,
  getPackageTierPrice,
  isCatalogFreeGifts,
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
