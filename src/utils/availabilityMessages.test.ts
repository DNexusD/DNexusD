import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getBalanceRequestAvailability,
  getServiceOrCodeAvailability,
  getStoreCatalogEmptyMessage,
} from './availabilityMessages';

test('getBalanceRequestAvailability reports unavailable message when wallet balance is zero or insufficient', () => {
  const zeroRes = getBalanceRequestAvailability({
    walletBalance: 0,
    requiredAmount: 100,
    walletLabel: 'محفظتك',
    requestLabel: 'تحويل الرصيد',
  });
  assert.equal(zeroRes.available, false);
  assert.equal(zeroRes.reason, 'empty_balance');
  assert.match(zeroRes.title, /عدم توفر الرصيد المطلوب/);
  assert.match(zeroRes.message, /0\.00 ر\.س/);

  const shortRes = getBalanceRequestAvailability({
    walletBalance: 40,
    requiredAmount: 100,
    walletLabel: 'محفظة الإدارة',
    requestLabel: 'تحويل الرصيد',
  });
  assert.equal(shortRes.available, false);
  assert.equal(shortRes.reason, 'insufficient_balance');
  assert.match(shortRes.message, /100\.00 ر\.س/);
  assert.match(shortRes.message, /40\.00 ر\.س/);

  const noBankRes = getBalanceRequestAvailability({
    walletBalance: 0,
    requireBankAccount: true,
    bankAccountsCount: 0,
    requestLabel: 'طلب شحن الرصيد',
  });
  assert.equal(noBankRes.available, false);
  assert.equal(noBankRes.reason, 'no_bank_account');
  assert.match(noBankRes.title, /عدم توفر المطلوب/);

  const okRes = getBalanceRequestAvailability({
    walletBalance: 200,
    requiredAmount: 150,
  });
  assert.equal(okRes.available, true);
});

test('getServiceOrCodeAvailability explains unavailable codes, services, or balance clearly', () => {
  const noCodes = getServiceOrCodeAvailability({
    hasPackages: true,
    isOutOfStock: true,
    deliveryMethod: 'voucher_code',
    purchaseUnit: 'single_code',
    packageName: 'بطاقة 50',
    paymentMethod: 'wallet',
    walletBalance: 500,
    totalAmount: 50,
  });
  assert.equal(noCodes.available, false);
  assert.equal(noCodes.reason, 'codes_unavailable');
  assert.match(noCodes.title, /عدم توفر الأكواد المطلوبة/);

  const noService = getServiceOrCodeAvailability({
    hasPackages: true,
    isOutOfStock: true,
    deliveryMethod: 'player_id',
    packageName: 'شدات ببجي',
    paymentMethod: 'wallet',
    walletBalance: 500,
    totalAmount: 50,
  });
  assert.equal(noService.available, false);
  assert.equal(noService.reason, 'service_unavailable');
  assert.match(noService.title, /عدم توفر الخدمة المطلوبة/);

  const noBalanceForCode = getServiceOrCodeAvailability({
    hasPackages: true,
    isOutOfStock: false,
    deliveryMethod: 'voucher_code',
    purchaseUnit: 'package',
    paymentMethod: 'wallet',
    walletBalance: 0,
    totalAmount: 120,
  });
  assert.equal(noBalanceForCode.available, false);
  assert.equal(noBalanceForCode.reason, 'empty_balance');
  assert.match(noBalanceForCode.title, /عدم توفر الرصيد المطلوب/);
  assert.match(noBalanceForCode.message, /باقة الأكواد المطلوبة/);

  const freeGiftZeroWallet = getServiceOrCodeAvailability({
    hasPackages: true,
    isOutOfStock: false,
    deliveryMethod: 'voucher_code',
    paymentMethod: 'wallet',
    walletBalance: 0,
    totalAmount: 0,
    isFreeGiftApplied: true,
  });
  assert.equal(freeGiftZeroWallet.available, true);
});

test('getStoreCatalogEmptyMessage reports unavailable store services when store is empty', () => {
  const emptyStore = getStoreCatalogEmptyMessage({
    totalStoreServices: 0,
    isFreeGiftsSelected: false,
  });
  assert.match(emptyStore.title, /عدم توفر خدمات أو أكواد حالياً/);
  assert.equal(emptyStore.showResetFilterButton, false);

  const filterMismatch = getStoreCatalogEmptyMessage({
    totalStoreServices: 3,
    isFreeGiftsSelected: false,
  });
  assert.equal(filterMismatch.showResetFilterButton, true);
});
