import { CurrencyCode } from '../types';

export const DEFAULT_SAR_PER_USD = 3.75;

export function normalizeCurrencyCode(code?: string | null): CurrencyCode {
  return code === 'USD' ? 'USD' : 'SAR';
}

export function normalizeExchangeRateSarPerUsd(rate?: number | null): number {
  if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
    const rounded = parseFloat(rate.toFixed(4));
    return rounded > 0 ? rounded : DEFAULT_SAR_PER_USD;
  }
  return DEFAULT_SAR_PER_USD;
}

function cleanZero(val: number): number {
  return Object.is(val, -0) || val === 0 ? 0 : val;
}

export function convertSarToCurrency(
  amountSar: number,
  currency: CurrencyCode,
  exchangeRateSarPerUsd?: number | null
): number {
  const safeSar = typeof amountSar === 'number' && Number.isFinite(amountSar) ? amountSar : 0;
  if (normalizeCurrencyCode(currency) === 'SAR') {
    return cleanZero(parseFloat(safeSar.toFixed(2)));
  }
  const rate = normalizeExchangeRateSarPerUsd(exchangeRateSarPerUsd);
  return cleanZero(parseFloat((safeSar / rate).toFixed(2)));
}

export function convertCurrencyToSar(
  amountInCurrency: number,
  currency: CurrencyCode,
  exchangeRateSarPerUsd?: number | null
): number {
  const safeVal =
    typeof amountInCurrency === 'number' && Number.isFinite(amountInCurrency)
      ? amountInCurrency
      : 0;
  if (normalizeCurrencyCode(currency) === 'SAR') {
    return cleanZero(parseFloat(safeVal.toFixed(2)));
  }
  const rate = normalizeExchangeRateSarPerUsd(exchangeRateSarPerUsd);
  return cleanZero(parseFloat((safeVal * rate).toFixed(2)));
}

export function getCurrencyShortLabel(currency: CurrencyCode): string {
  return normalizeCurrencyCode(currency) === 'USD' ? '$' : 'ر.س';
}

export function getCurrencyCodeLabel(currency: CurrencyCode): string {
  return normalizeCurrencyCode(currency) === 'USD' ? 'USD' : 'SAR';
}

export function getCurrencyFullNameAr(currency: CurrencyCode): string {
  return normalizeCurrencyCode(currency) === 'USD'
    ? 'دولار أمريكي ($)'
    : 'ريال سعودي (ر.س)';
}

export interface FormatCurrencyOptions {
  decimals?: number;
  includeSymbol?: boolean;
  withGrouping?: boolean;
  sign?: 'credit' | 'debit';
}

export function formatCurrencyAmount(
  amountSar: number,
  currency: CurrencyCode = 'SAR',
  exchangeRateSarPerUsd?: number | null,
  options: FormatCurrencyOptions = {}
): string {
  const {
    decimals = 2,
    includeSymbol = true,
    withGrouping = false,
    sign,
  } = options;

  const converted = convertSarToCurrency(amountSar, currency, exchangeRateSarPerUsd);
  const absVal = Math.abs(converted);
  const formattedNum = withGrouping
    ? absVal.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : absVal.toFixed(decimals);

  let prefix = '';
  if (sign === 'credit' && converted > 0) {
    prefix = '+';
  } else if (sign === 'debit' && converted > 0) {
    prefix = '-';
  } else if (converted < 0) {
    prefix = '-';
  }

  if (!includeSymbol) {
    return `${prefix}${formattedNum}`;
  }

  const symbol = getCurrencyShortLabel(currency);
  return `${prefix}${formattedNum} ${symbol}`;
}
