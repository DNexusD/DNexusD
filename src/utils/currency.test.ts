import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SAR_PER_USD,
  convertCurrencyToSar,
  convertSarToCurrency,
  formatCurrencyAmount,
  getCurrencyFullNameAr,
  getCurrencyShortLabel,
  normalizeCurrencyCode,
  normalizeExchangeRateSarPerUsd,
} from './currency';

test('normalizeCurrencyCode defaults to SAR and accepts USD', () => {
  assert.equal(normalizeCurrencyCode(undefined), 'SAR');
  assert.equal(normalizeCurrencyCode(null), 'SAR');
  assert.equal(normalizeCurrencyCode('SAR'), 'SAR');
  assert.equal(normalizeCurrencyCode('EUR'), 'SAR');
  assert.equal(normalizeCurrencyCode('USD'), 'USD');
});

test('normalizeExchangeRateSarPerUsd validates positive rates and falls back to 3.75', () => {
  assert.equal(normalizeExchangeRateSarPerUsd(undefined), DEFAULT_SAR_PER_USD);
  assert.equal(normalizeExchangeRateSarPerUsd(0), DEFAULT_SAR_PER_USD);
  assert.equal(normalizeExchangeRateSarPerUsd(-2), DEFAULT_SAR_PER_USD);
  assert.equal(normalizeExchangeRateSarPerUsd(Number.NaN), DEFAULT_SAR_PER_USD);
  assert.equal(normalizeExchangeRateSarPerUsd(3.75), 3.75);
  assert.equal(normalizeExchangeRateSarPerUsd(4), 4);
  assert.equal(normalizeExchangeRateSarPerUsd(3.8125), 3.8125);
});

test('convertSarToCurrency and convertCurrencyToSar convert accurately using merchant exchange rate', () => {
  // Default rate 3.75
  assert.equal(convertSarToCurrency(375, 'USD', 3.75), 100);
  assert.equal(convertSarToCurrency(100, 'USD', 3.75), 26.67);
  assert.equal(convertSarToCurrency(100, 'SAR', 3.75), 100);
  assert.equal(convertSarToCurrency(0, 'USD', 3.75), 0);

  // Custom merchant rate e.g. 4.00 SAR = 1 USD
  assert.equal(convertSarToCurrency(100, 'USD', 4), 25);
  assert.equal(convertCurrencyToSar(25, 'USD', 4), 100);

  // Custom merchant rate e.g. 5.20 SAR = 1 USD
  assert.equal(convertSarToCurrency(52, 'USD', 5.2), 10);
  assert.equal(convertCurrencyToSar(10, 'USD', 5.2), 52);

  // SAR pass-through
  assert.equal(convertCurrencyToSar(75.5, 'SAR', 4.5), 75.5);
});

test('formatCurrencyAmount formats SAR and USD with grouping and credit/debit signs', () => {
  assert.equal(formatCurrencyAmount(1500, 'SAR', 3.75, { withGrouping: true }), '1,500.00 ر.س');
  assert.equal(formatCurrencyAmount(3750, 'USD', 3.75, { withGrouping: true }), '1,000.00 $');
  assert.equal(formatCurrencyAmount(40, 'USD', 4, { sign: 'credit' }), '+10.00 $');
  assert.equal(formatCurrencyAmount(40, 'USD', 4, { sign: 'debit' }), '-10.00 $');
  assert.equal(formatCurrencyAmount(-20, 'USD', 4), '-5.00 $');
  assert.equal(formatCurrencyAmount(0, 'USD', 3.75), '0.00 $');
});

test('currency labels return expected Arabic and short symbols', () => {
  assert.equal(getCurrencyShortLabel('SAR'), 'ر.س');
  assert.equal(getCurrencyShortLabel('USD'), '$');
  assert.equal(getCurrencyFullNameAr('SAR'), 'ريال سعودي (ر.س)');
  assert.equal(getCurrencyFullNameAr('USD'), 'دولار أمريكي ($)');
});
