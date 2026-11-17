import {
  DeliveryMethod,
  DigitalService,
  ServicePackage,
  TierPrices,
  VoucherWarehouse,
  WarehousePurchaseUnit,
} from '../types';

export function parseVoucherCodesInput(raw: string): {
  codes: string[];
  duplicatesRemoved: number;
} {
  const parts = raw
    .split(/[\r\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const codes: string[] = [];
  let duplicatesRemoved = 0;

  for (const code of parts) {
    if (seen.has(code)) {
      duplicatesRemoved++;
      continue;
    }
    seen.add(code);
    codes.push(code);
  }

  return { codes, duplicatesRemoved };
}

export function mergeCodesIntoWarehouse(
  existingCodes: string[],
  rawInput: string
): {
  nextCodes: string[];
  addedCount: number;
  skippedDuplicates: number;
} {
  const { codes: incoming } = parseVoucherCodesInput(rawInput);
  const existingSet = new Set(existingCodes.map((c) => c.trim()));
  const nextCodes = [...existingCodes];
  let addedCount = 0;
  let skippedDuplicates = 0;

  for (const code of incoming) {
    if (existingSet.has(code)) {
      skippedDuplicates++;
      continue;
    }
    existingSet.add(code);
    nextCodes.push(code);
    addedCount++;
  }

  return { nextCodes, addedCount, skippedDuplicates };
}

export function getPackageLinkedWarehouse(
  pkg: ServicePackage,
  warehouses?: VoucherWarehouse[]
): VoucherWarehouse | undefined {
  if (!warehouses || warehouses.length === 0) return undefined;
  if (pkg.warehouseId) {
    const byId = warehouses.find((w) => w.id === pkg.warehouseId);
    if (byId) return byId;
  }
  return warehouses.find((w) => w.linkedPackageId === pkg.id);
}

export function getPackageAvailableStock(
  pkg: ServicePackage,
  warehouses?: VoucherWarehouse[]
): number | undefined {
  const linkedWh = getPackageLinkedWarehouse(pkg, warehouses);
  if (linkedWh) {
    return Math.max(0, linkedWh.codes.length);
  }
  if (Array.isArray(pkg.vouchers)) {
    return Math.max(0, pkg.vouchers.length);
  }
  if (typeof pkg.availableStock === 'number') {
    return Math.max(0, pkg.availableStock);
  }
  return undefined;
}

export function isPackageVoucherBacked(
  pkg: ServicePackage,
  warehouses?: VoucherWarehouse[]
): boolean {
  return Boolean(
    getPackageLinkedWarehouse(pkg, warehouses) || Array.isArray(pkg.vouchers)
  );
}

export interface ResolvedPackagePurchaseOptions {
  allowSingleCode: boolean;
  allowPackage: boolean;
  packageCodesCount: number;
  packageNameAr: string;
  singleCodeTierPrices: TierPrices;
  packageTierPrices: TierPrices;
  availableCodesCount: number | undefined;
  availablePackagesCount: number | undefined;
  defaultPurchaseUnit: WarehousePurchaseUnit;
  linkedWarehouse?: VoucherWarehouse;
}

export function resolvePackagePurchaseOptions(
  pkg: ServicePackage,
  warehouses?: VoucherWarehouse[]
): ResolvedPackagePurchaseOptions {
  const linkedWh = getPackageLinkedWarehouse(pkg, warehouses);
  const rawAllowSingle = linkedWh
    ? linkedWh.allowSingleCodePurchase
    : pkg.allowSingleCodePurchase;
  const rawAllowPackage = linkedWh
    ? linkedWh.allowPackagePurchase
    : pkg.allowPackagePurchase;

  const allowPackage = Boolean(rawAllowPackage);
  // Default single code to true unless explicitly disabled AND package mode is enabled
  const allowSingleCode =
    rawAllowSingle === false && allowPackage ? false : rawAllowSingle !== false;

  const rawCodesCount = Number(
    linkedWh?.packageCodesCount ?? pkg.packageCodesCount ?? 5
  );
  const packageCodesCount =
    Number.isFinite(rawCodesCount) && rawCodesCount >= 1
      ? Math.floor(rawCodesCount)
      : 5;

  const packageNameAr =
    (linkedWh?.packageNameAr ?? pkg.packageNameAr)?.trim() ||
    `باقة (${packageCodesCount} أكواد)`;

  const singleCodeTierPrices = linkedWh?.tierPrices || pkg.tierPrices;
  const packageTierPrices =
    linkedWh?.packageTierPrices ||
    pkg.packageTierPrices ||
    singleCodeTierPrices;

  const availableCodesCount = getPackageAvailableStock(pkg, warehouses);
  const availablePackagesCount =
    typeof availableCodesCount === 'number'
      ? Math.floor(availableCodesCount / packageCodesCount)
      : undefined;

  const defaultPurchaseUnit: WarehousePurchaseUnit = allowSingleCode
    ? 'single_code'
    : 'package';

  return {
    allowSingleCode,
    allowPackage,
    packageCodesCount,
    packageNameAr,
    singleCodeTierPrices,
    packageTierPrices,
    availableCodesCount,
    availablePackagesCount,
    defaultPurchaseUnit,
    linkedWarehouse: linkedWh,
  };
}

/**
 * Merges live warehouse purchase mode settings & pricing onto a ServicePackage
 * so UI components and pricing helpers see up-to-date warehouse configurations.
 */
export function mergeWarehouseOptionsIntoPackage(
  pkg: ServicePackage,
  warehouses?: VoucherWarehouse[]
): ServicePackage {
  const linkedWh = getPackageLinkedWarehouse(pkg, warehouses);
  if (!linkedWh) return pkg;
  return {
    ...pkg,
    tierPrices: { ...linkedWh.tierPrices },
    packageTierPrices: linkedWh.packageTierPrices
      ? { ...linkedWh.packageTierPrices }
      : pkg.packageTierPrices,
    allowSingleCodePurchase: linkedWh.allowSingleCodePurchase !== false,
    allowPackagePurchase: Boolean(linkedWh.allowPackagePurchase),
    packageCodesCount: linkedWh.packageCodesCount ?? pkg.packageCodesCount,
    packageNameAr: linkedWh.packageNameAr ?? pkg.packageNameAr,
    vouchers: [...linkedWh.codes],
    availableStock: linkedWh.codes.length,
  };
}

export function isPackageOutOfStock(
  pkg: ServicePackage,
  deliveryMethod?: DeliveryMethod,
  warehouses?: VoucherWarehouse[],
  purchaseUnit?: WarehousePurchaseUnit
): boolean {
  const opts = resolvePackagePurchaseOptions(pkg, warehouses);
  const stock = opts.availableCodesCount;
  const hasRealVoucherBacking = isPackageVoucherBacked(pkg, warehouses);

  if (deliveryMethod === 'voucher_code' && !hasRealVoucherBacking) {
    return true;
  }

  if (typeof stock !== 'number') {
    return false;
  }

  if (purchaseUnit === 'single_code') {
    return !opts.allowSingleCode || stock < 1;
  }

  if (purchaseUnit === 'package') {
    return !opts.allowPackage || stock < opts.packageCodesCount;
  }

  // No specific unit requested: out of stock only if no enabled unit can be satisfied
  if (opts.allowSingleCode || opts.allowPackage) {
    const canBuySingle = opts.allowSingleCode && stock >= 1;
    const canBuyPkg = opts.allowPackage && stock >= opts.packageCodesCount;
    if (hasRealVoucherBacking || deliveryMethod === 'voucher_code') {
      return !(canBuySingle || canBuyPkg);
    }
    return stock <= 0;
  }

  if (deliveryMethod === 'voucher_code' && stock <= 0) {
    return true;
  }
  return stock <= 0;
}

export function getServiceTotalStock(
  service: DigitalService,
  warehouses?: VoucherWarehouse[]
): number {
  return service.packages.reduce((sum, pkg) => {
    const stock = getPackageAvailableStock(pkg, warehouses);
    return sum + (stock ?? 0);
  }, 0);
}

export interface DeductStockResult {
  outOfStock: boolean;
  assignedVoucher?: string;
  assignedVouchers?: string[];
  deductedCount: number;
  updatedService: DigitalService;
  updatedWarehouse?: VoucherWarehouse;
}

/**
 * Atomically deducts 1 code (single_code) or N codes (package) from a service package
 * and any linked VoucherWarehouse upon purchase.
 */
export function deductPackageStock(params: {
  service: DigitalService;
  pkgId: string;
  deliveryMethod: DeliveryMethod;
  warehouses?: VoucherWarehouse[];
  purchaseUnit?: WarehousePurchaseUnit;
  nowIso?: string;
}): DeductStockResult {
  const {
    service,
    pkgId,
    deliveryMethod,
    warehouses = [],
    purchaseUnit,
    nowIso = new Date().toISOString(),
  } = params;
  const targetPkg = service.packages.find((p) => p.id === pkgId);
  if (!targetPkg) {
    return { outOfStock: true, deductedCount: 0, updatedService: service };
  }

  const opts = resolvePackagePurchaseOptions(targetPkg, warehouses);
  const effectiveUnit: WarehousePurchaseUnit =
    purchaseUnit || opts.defaultPurchaseUnit;

  // Validate requested unit is permitted on this package/warehouse
  if (effectiveUnit === 'single_code' && !opts.allowSingleCode) {
    return { outOfStock: true, deductedCount: 0, updatedService: service };
  }
  if (effectiveUnit === 'package' && !opts.allowPackage) {
    return { outOfStock: true, deductedCount: 0, updatedService: service };
  }

  const codesToDeduct =
    effectiveUnit === 'package' ? opts.packageCodesCount : 1;

  const linkedWh = opts.linkedWarehouse;

  // Case 1: Linked Voucher Warehouse
  if (linkedWh) {
    const sourceCodes = linkedWh.codes;
    if (sourceCodes.length < codesToDeduct) {
      return { outOfStock: true, deductedCount: 0, updatedService: service };
    }

    const assignedCodes = sourceCodes.slice(0, codesToDeduct);
    const nextCodes = sourceCodes.slice(codesToDeduct);
    const updatedWarehouse: VoucherWarehouse = {
      ...linkedWh,
      codes: nextCodes,
      usedCodesCount: (linkedWh.usedCodesCount || 0) + codesToDeduct,
      updatedAt: nowIso,
    };

    const updatedService: DigitalService = {
      ...service,
      packages: service.packages.map((p) => {
        if (p.id !== pkgId) return p;
        return {
          ...p,
          vouchers: nextCodes,
          availableStock: nextCodes.length,
        };
      }),
    };

    return {
      outOfStock: false,
      assignedVoucher: assignedCodes.join('\n'),
      assignedVouchers: assignedCodes,
      deductedCount: codesToDeduct,
      updatedService,
      updatedWarehouse,
    };
  }

  // Case 2: Package with explicit vouchers array
  if (Array.isArray(targetPkg.vouchers)) {
    if (deliveryMethod === 'voucher_code') {
      if (targetPkg.vouchers.length < codesToDeduct) {
        return { outOfStock: true, deductedCount: 0, updatedService: service };
      }
      const assignedCodes = targetPkg.vouchers.slice(0, codesToDeduct);
      const nextVouchers = targetPkg.vouchers.slice(codesToDeduct);
      const updatedService: DigitalService = {
        ...service,
        packages: service.packages.map((p) => {
          if (p.id !== pkgId) return p;
          return {
            ...p,
            vouchers: nextVouchers,
            availableStock: nextVouchers.length,
          };
        }),
      };
      return {
        outOfStock: false,
        assignedVoucher: assignedCodes.join('\n'),
        assignedVouchers: assignedCodes,
        deductedCount: codesToDeduct,
        updatedService,
      };
    }

    // Non-voucher delivery (e.g. player_id / account_login) on a package that also tracks stock
    const currentStock =
      typeof targetPkg.availableStock === 'number'
        ? targetPkg.availableStock
        : targetPkg.vouchers.length;

    if (currentStock < codesToDeduct) {
      return { outOfStock: true, deductedCount: 0, updatedService: service };
    }

    const nextStock = Math.max(0, currentStock - codesToDeduct);
    const updatedService: DigitalService = {
      ...service,
      packages: service.packages.map((p) =>
        p.id === pkgId ? { ...p, availableStock: nextStock } : p
      ),
    };
    return { outOfStock: false, deductedCount: codesToDeduct, updatedService };
  }

  // Case 3: Package with numeric availableStock (no explicit vouchers list or warehouse)
  if (typeof targetPkg.availableStock === 'number') {
    // Real operations only: never auto-generate fake voucher codes when no real codes exist
    if (deliveryMethod === 'voucher_code') {
      return { outOfStock: true, deductedCount: 0, updatedService: service };
    }
    if (targetPkg.availableStock < codesToDeduct) {
      return { outOfStock: true, deductedCount: 0, updatedService: service };
    }
    const nextStock = Math.max(0, targetPkg.availableStock - codesToDeduct);

    const updatedService: DigitalService = {
      ...service,
      packages: service.packages.map((p) =>
        p.id === pkgId ? { ...p, availableStock: nextStock } : p
      ),
    };
    return {
      outOfStock: false,
      deductedCount: codesToDeduct,
      updatedService,
    };
  }

  // Fallback for untracked packages: never generate fake voucher codes
  if (deliveryMethod === 'voucher_code') {
    return { outOfStock: true, deductedCount: 0, updatedService: service };
  }

  return {
    outOfStock: false,
    deductedCount: 1,
    updatedService: service,
  };
}

/**
 * Syncs a warehouse's codes, name, purchase modes, and tier prices into the matching service package.
 */
export function syncWarehouseIntoService(
  service: DigitalService,
  warehouse: VoucherWarehouse
): DigitalService {
  const pkgExists = service.packages.some(
    (p) => p.id === warehouse.linkedPackageId || p.warehouseId === warehouse.id
  );

  const allowPackage = Boolean(warehouse.allowPackagePurchase);
  const allowSingle =
    warehouse.allowSingleCodePurchase === false && allowPackage
      ? false
      : warehouse.allowSingleCodePurchase !== false;

  const syncedPkg: ServicePackage = {
    id: warehouse.linkedPackageId || `pkg-${warehouse.id}`,
    name: warehouse.nameAr,
    description: warehouse.description || `فئة ${warehouse.categoryName}`,
    tierPrices: { ...warehouse.tierPrices },
    packageTierPrices: warehouse.packageTierPrices
      ? { ...warehouse.packageTierPrices }
      : undefined,
    allowSingleCodePurchase: allowSingle,
    allowPackagePurchase: allowPackage,
    packageCodesCount: warehouse.packageCodesCount,
    packageNameAr: warehouse.packageNameAr,
    vouchers: [...warehouse.codes],
    availableStock: warehouse.codes.length,
    warehouseId: warehouse.id,
  };

  const nextPackages = pkgExists
    ? service.packages.map((p) =>
        p.id === warehouse.linkedPackageId || p.warehouseId === warehouse.id
          ? { ...p, ...syncedPkg, id: p.id }
          : p
      )
    : [...service.packages, syncedPkg];

  const nextDeliveryMethods: DeliveryMethod[] = service.deliveryMethods.includes('voucher_code')
    ? service.deliveryMethods
    : [...service.deliveryMethods, 'voucher_code'];

  return {
    ...service,
    deliveryMethods: nextDeliveryMethods,
    packages: nextPackages,
  };
}

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export function isWarehouseLowStock(warehouse: VoucherWarehouse): boolean {
  const threshold =
    typeof warehouse.lowStockThreshold === 'number' && !Number.isNaN(warehouse.lowStockThreshold)
      ? warehouse.lowStockThreshold
      : DEFAULT_LOW_STOCK_THRESHOLD;
  return warehouse.codes.length <= threshold;
}

export interface CategoryStockSummary {
  categoryName: string;
  warehousesCount: number;
  totalStocked: number; // remaining + sold
  totalSold: number;
  totalRemaining: number;
  lowStockCount: number;
  outOfStockCount: number;
  warehouses: VoucherWarehouse[];
}

export interface OverallStockSummary {
  totalWarehouses: number;
  totalCategories: number;
  totalStocked: number; // total codes received/stocked
  totalSold: number; // total codes sold/deducted
  totalRemaining: number; // total codes remaining
  lowStockCount: number; // count of warehouses at or below threshold
  outOfStockCount: number; // count of warehouses with 0 codes
  categories: CategoryStockSummary[];
}

export function computeStockSummary(warehouses: VoucherWarehouse[]): OverallStockSummary {
  let totalStocked = 0;
  let totalSold = 0;
  let totalRemaining = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  const catMap = new Map<string, CategoryStockSummary>();

  for (const wh of warehouses) {
    const remaining = wh.codes.length;
    const sold = wh.usedCodesCount || 0;
    const stocked = remaining + sold;
    const isLow = isWarehouseLowStock(wh);
    const isOut = remaining === 0;

    totalStocked += stocked;
    totalSold += sold;
    totalRemaining += remaining;
    if (isLow) lowStockCount++;
    if (isOut) outOfStockCount++;

    const catName = wh.categoryName?.trim() || 'فئة عامة';
    if (!catMap.has(catName)) {
      catMap.set(catName, {
        categoryName: catName,
        warehousesCount: 0,
        totalStocked: 0,
        totalSold: 0,
        totalRemaining: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        warehouses: [],
      });
    }

    const catEntry = catMap.get(catName)!;
    catEntry.warehousesCount++;
    catEntry.totalStocked += stocked;
    catEntry.totalSold += sold;
    catEntry.totalRemaining += remaining;
    if (isLow) catEntry.lowStockCount++;
    if (isOut) catEntry.outOfStockCount++;
    catEntry.warehouses.push(wh);
  }

  const categories = Array.from(catMap.values());

  return {
    totalWarehouses: warehouses.length,
    totalCategories: categories.length,
    totalStocked,
    totalSold,
    totalRemaining,
    lowStockCount,
    outOfStockCount,
    categories,
  };
}

