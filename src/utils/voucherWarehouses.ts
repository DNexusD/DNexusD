import {
  DeliveryMethod,
  DigitalService,
  ServicePackage,
  VoucherWarehouse,
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

export function isPackageOutOfStock(
  pkg: ServicePackage,
  deliveryMethod?: DeliveryMethod,
  warehouses?: VoucherWarehouse[]
): boolean {
  const linkedWh = getPackageLinkedWarehouse(pkg, warehouses);
  if (linkedWh) {
    return linkedWh.codes.length <= 0;
  }
  if (Array.isArray(pkg.vouchers)) {
    return pkg.vouchers.length <= 0;
  }
  if (deliveryMethod === 'voucher_code' && pkg.availableStock === 0) {
    return true;
  }
  if (typeof pkg.availableStock === 'number') {
    return pkg.availableStock <= 0;
  }
  return false;
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
  updatedService: DigitalService;
  updatedWarehouse?: VoucherWarehouse;
}

/**
 * Atomically deducts 1 unit (voucher code or package stock) from a service package
 * and any linked VoucherWarehouse upon purchase.
 */
export function deductPackageStock(params: {
  service: DigitalService;
  pkgId: string;
  deliveryMethod: DeliveryMethod;
  warehouses?: VoucherWarehouse[];
  nowIso?: string;
}): DeductStockResult {
  const { service, pkgId, deliveryMethod, warehouses = [], nowIso = new Date().toISOString() } = params;
  const targetPkg = service.packages.find((p) => p.id === pkgId);
  if (!targetPkg) {
    return { outOfStock: true, updatedService: service };
  }

  const linkedWh = getPackageLinkedWarehouse(targetPkg, warehouses);

  // Case 1: Linked Voucher Warehouse
  if (linkedWh) {
    const sourceCodes = linkedWh.codes;
    if (sourceCodes.length <= 0) {
      return { outOfStock: true, updatedService: service };
    }

    const assignedCode = deliveryMethod === 'voucher_code' ? sourceCodes[0] : undefined;
    // Deduct 1 code when purchasing voucher_code, OR deduct 1 stock unit if direct package backed by warehouse
    const nextCodes = sourceCodes.slice(1);
    const updatedWarehouse: VoucherWarehouse = {
      ...linkedWh,
      codes: nextCodes,
      usedCodesCount: (linkedWh.usedCodesCount || 0) + 1,
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
      assignedVoucher: assignedCode ?? sourceCodes[0],
      updatedService,
      updatedWarehouse,
    };
  }

  // Case 2: Package with explicit vouchers array
  if (Array.isArray(targetPkg.vouchers)) {
    if (deliveryMethod === 'voucher_code') {
      if (targetPkg.vouchers.length <= 0) {
        return { outOfStock: true, updatedService: service };
      }
      const assignedVoucher = targetPkg.vouchers[0];
      const nextVouchers = targetPkg.vouchers.slice(1);
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
        assignedVoucher,
        updatedService,
      };
    }

    // Non-voucher delivery (e.g. player_id / account_login) on a package that also tracks stock
    const currentStock =
      typeof targetPkg.availableStock === 'number'
        ? targetPkg.availableStock
        : targetPkg.vouchers.length;

    if (currentStock <= 0) {
      return { outOfStock: true, updatedService: service };
    }

    const nextStock = Math.max(0, currentStock - 1);
    const updatedService: DigitalService = {
      ...service,
      packages: service.packages.map((p) =>
        p.id === pkgId ? { ...p, availableStock: nextStock } : p
      ),
    };
    return { outOfStock: false, updatedService };
  }

  // Case 3: Package with numeric availableStock (no explicit vouchers list)
  if (typeof targetPkg.availableStock === 'number') {
    if (targetPkg.availableStock <= 0) {
      return { outOfStock: true, updatedService: service };
    }
    const nextStock = Math.max(0, targetPkg.availableStock - 1);
    const generatedVoucher =
      deliveryMethod === 'voucher_code'
        ? `${service.nameAr.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`
        : undefined;

    const updatedService: DigitalService = {
      ...service,
      packages: service.packages.map((p) =>
        p.id === pkgId ? { ...p, availableStock: nextStock } : p
      ),
    };
    return {
      outOfStock: false,
      assignedVoucher: generatedVoucher,
      updatedService,
    };
  }

  // Fallback for legacy untracked packages
  const generatedVoucher =
    deliveryMethod === 'voucher_code'
      ? `${service.nameAr.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`
      : undefined;

  return {
    outOfStock: false,
    assignedVoucher: generatedVoucher,
    updatedService: service,
  };
}

/**
 * Syncs a warehouse's codes, name, and tier prices into the matching service package.
 */
export function syncWarehouseIntoService(
  service: DigitalService,
  warehouse: VoucherWarehouse
): DigitalService {
  const pkgExists = service.packages.some(
    (p) => p.id === warehouse.linkedPackageId || p.warehouseId === warehouse.id
  );

  const syncedPkg: ServicePackage = {
    id: warehouse.linkedPackageId || `pkg-${warehouse.id}`,
    name: warehouse.nameAr,
    description: warehouse.description || `فئة ${warehouse.categoryName}`,
    tierPrices: { ...warehouse.tierPrices },
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
