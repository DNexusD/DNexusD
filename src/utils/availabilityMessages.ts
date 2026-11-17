import { DeliveryMethod, WarehousePurchaseUnit } from '../types';

export interface AvailabilityCheckResult {
  available: boolean;
  reason?:
    | 'empty_balance'
    | 'insufficient_balance'
    | 'no_bank_account'
    | 'no_supplier'
    | 'no_packages'
    | 'codes_unavailable'
    | 'service_unavailable';
  title: string;
  message: string;
}

export function getBalanceRequestAvailability(params: {
  walletBalance: number;
  requiredAmount?: number;
  walletLabel?: string;
  requestLabel?: string;
  requireBankAccount?: boolean;
  bankAccountsCount?: number;
  hasSupplier?: boolean;
}): AvailabilityCheckResult {
  const {
    walletBalance,
    requiredAmount = 0,
    walletLabel = 'محفظتك',
    requestLabel = 'طلب الرصيد',
    requireBankAccount = false,
    bankAccountsCount = 0,
    hasSupplier = true,
  } = params;

  if (!hasSupplier) {
    return {
      available: false,
      reason: 'no_supplier',
      title: 'عدم توفر المطلوب',
      message: `تعذر إرسال ${requestLabel}: لا يوجد متجر مرتبط بحسابك حالياً.`,
    };
  }

  if (requireBankAccount && bankAccountsCount <= 0) {
    return {
      available: false,
      reason: 'no_bank_account',
      title: 'عدم توفر المطلوب',
      message: `عذراً، لا تتوفر حسابات بنكية معتمدة لدى المتجر لاستقبال ${requestLabel} حالياً.`,
    };
  }

  const safeBalance = Number.isFinite(walletBalance) ? walletBalance : 0;
  const safeRequired = Number.isFinite(requiredAmount) ? requiredAmount : 0;

  if (safeBalance <= 0) {
    return {
      available: false,
      reason: 'empty_balance',
      title: 'عدم توفر الرصيد المطلوب',
      message: `لا يتوفر رصيد في ${walletLabel} حالياً (0.00 ر.س). تعذر تنفيذ ${requestLabel}، يرجى شحن الرصيد أولاً.`,
    };
  }

  if (safeRequired > 0 && safeBalance < safeRequired) {
    return {
      available: false,
      reason: 'insufficient_balance',
      title: 'عدم توفر الرصيد المطلوب',
      message: `لا يتوفر الرصيد الكافي في ${walletLabel} لتنفيذ ${requestLabel}! المطلوب ${safeRequired.toFixed(2)} ر.س، والمتاح حالياً ${safeBalance.toFixed(2)} ر.س.`,
    };
  }

  return {
    available: true,
    title: '',
    message: '',
  };
}

export function getServiceOrCodeAvailability(params: {
  hasPackages: boolean;
  isOutOfStock: boolean;
  deliveryMethod: DeliveryMethod;
  purchaseUnit?: WarehousePurchaseUnit;
  packageCodesCount?: number;
  packageName?: string;
  paymentMethod: 'wallet' | 'visa';
  walletBalance: number;
  totalAmount: number;
  isFreeGiftApplied?: boolean;
}): AvailabilityCheckResult {
  const {
    hasPackages,
    isOutOfStock,
    deliveryMethod,
    purchaseUnit = 'single_code',
    packageCodesCount = 1,
    packageName = '',
    paymentMethod,
    walletBalance,
    totalAmount,
    isFreeGiftApplied = false,
  } = params;

  if (!hasPackages) {
    return {
      available: false,
      reason: 'no_packages',
      title: 'عدم توفر الخدمة المطلوبة',
      message: 'عذراً، لا تتوفر باقات أو فئات لهذه الخدمة حالياً لدى المتجر.',
    };
  }

  const isVoucher = deliveryMethod === 'voucher_code';
  const pkgSuffix = packageName ? ` (${packageName})` : '';

  if (isOutOfStock) {
    if (isVoucher) {
      return {
        available: false,
        reason: 'codes_unavailable',
        title: 'عدم توفر الأكواد المطلوبة',
        message:
          purchaseUnit === 'package'
            ? `عذراً، الأكواد المتوفرة في المخزن غير كافية لتسليم باقة كاملة (${packageCodesCount} أكواد)${pkgSuffix}.`
            : `عذراً، لا تتوفر أكواد شحن متاحة لهذه الفئة${pkgSuffix} حالياً في مخزن المتجر.`,
      };
    }

    return {
      available: false,
      reason: 'service_unavailable',
      title: 'عدم توفر الخدمة المطلوبة',
      message: `عذراً، الخدمة أو الباقة المطلوبة${pkgSuffix} غير متوفرة حالياً لدى المتجر (نفد المخزون).`,
    };
  }

  const safeBalance = Number.isFinite(walletBalance) ? walletBalance : 0;
  const safeTotal = Number.isFinite(totalAmount) ? totalAmount : 0;

  if (!isFreeGiftApplied && paymentMethod === 'wallet' && (safeBalance <= 0 || safeBalance < safeTotal)) {
    const requestedItemLabel = isVoucher
      ? purchaseUnit === 'package'
        ? 'باقة الأكواد المطلوبة'
        : 'الكود المطلوب'
      : 'الخدمة المطلوبة';

    if (safeBalance <= 0) {
      return {
        available: false,
        reason: 'empty_balance',
        title: 'عدم توفر الرصيد المطلوب',
        message: `لا يتوفر رصيد في محفظتك حالياً (0.00 ر.س) لطلب ${requestedItemLabel} بقيمة ${safeTotal.toFixed(2)} ر.س. يرجى شحن المحفظة أو اختيار الدفع بالبطاقة.`,
      };
    }

    return {
      available: false,
      reason: 'insufficient_balance',
      title: 'عدم توفر الرصيد المطلوب',
      message: `لا يتوفر الرصيد الكافي في محفظتك لطلب ${requestedItemLabel}! المطلوب ${safeTotal.toFixed(2)} ر.س، والمتاح حالياً ${safeBalance.toFixed(2)} ر.س. يرجى شحن المحفظة أو الدفع بالبطاقة.`,
    };
  }

  return {
    available: true,
    title: '',
    message: '',
  };
}

export function getStoreCatalogEmptyMessage(params: {
  totalStoreServices: number;
  isFreeGiftsSelected: boolean;
}): { title: string; description: string; showResetFilterButton: boolean } {
  if (params.totalStoreServices <= 0) {
    return {
      title: 'عدم توفر خدمات أو أكواد حالياً',
      description: 'لا تتوفر خدمات أو باقات أكواد مضافة في المتجر حالياً. يرجى التواصل مع المتجر أو المحاولة لاحقاً.',
      showResetFilterButton: false,
    };
  }

  if (params.isFreeGiftsSelected) {
    return {
      title: 'لا توجد هدايا مجانية متاحة حالياً',
      description: 'سيتم عرض الهدايا المجانية هنا بمجرد إضافتها من المتجر.',
      showResetFilterButton: true,
    };
  }

  return {
    title: 'لا توجد خدمات مطابقة للبحث أو التصنيف المحدد',
    description: 'جرب تغيير كلمة البحث أو اختيار جميع الكتالوجات.',
    showResetFilterButton: true,
  };
}
