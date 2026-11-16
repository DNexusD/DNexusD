import { AccountingEntry, DropdownOptionItem, Order } from '../types';

function roundCurrency(value: number): number {
  return parseFloat((Number.isFinite(value) ? value : 0).toFixed(2));
}

export function filterClientStatementDropdownOptions(
  options: DropdownOptionItem[]
): DropdownOptionItem[] {
  return options.filter(
    (opt) => opt.value !== 'fee' && !opt.labelAr.includes('رسوم')
  );
}

/**
 * Prepares accounting entries for the client-facing StatementView:
 * - Never displays standalone application fee rows or "رسوم المنصة / التطبيق" labels.
 * - For Free Gift orders: keeps service price at 0.00 (debit: 0) and hides the silently-deducted fee row.
 * - For standard purchases / transfers / zero-floor purchases: folds the fee into the parent row's debit
 *   and carries over the post-fee balanceAfter so ledger balances stay consistent without exposing fees.
 */
export function buildClientStatementEntries(
  entries: AccountingEntry[],
  orders: Order[] = []
): AccountingEntry[] {
  const orderById = new Map<string, Order>();
  for (const ord of orders) {
    if (ord?.id) orderById.set(ord.id, ord);
  }

  const feeMetaByRef = new Map<
    string,
    { totalFeeDebit: number; balanceAfter: number; descriptions: string[] }
  >();

  for (const entry of entries) {
    if (entry.type !== 'fee') continue;
    const refId = entry.referenceId;
    if (!refId) continue;
    const existing = feeMetaByRef.get(refId);
    if (existing) {
      existing.totalFeeDebit = roundCurrency(existing.totalFeeDebit + (entry.debit || 0));
      existing.descriptions.push(entry.description || '');
      if (typeof entry.balanceAfter === 'number') {
        existing.balanceAfter = entry.balanceAfter;
      }
    } else {
      feeMetaByRef.set(refId, {
        totalFeeDebit: roundCurrency(entry.debit || 0),
        balanceAfter: entry.balanceAfter,
        descriptions: [entry.description || ''],
      });
    }
  }

  const mergedRefs = new Set<string>();
  const result: AccountingEntry[] = [];

  for (const entry of entries) {
    if (entry.type === 'fee') {
      continue;
    }

    const refId = entry.referenceId;
    const feeMeta = refId ? feeMetaByRef.get(refId) : undefined;

    if (
      feeMeta &&
      !mergedRefs.has(refId) &&
      (entry.type === 'purchase' || entry.type === 'transfer_out')
    ) {
      mergedRefs.add(refId);
      const matchingOrder = orderById.get(refId);
      const feeDescCombined = feeMeta.descriptions.join(' ');
      const isZeroFloor =
        entry.description.includes('[قيمة صفرية') ||
        feeDescCombined.includes('الحد الأدنى للعملية الصفرية');
      const isFreeGift =
        Boolean(matchingOrder?.isFreeGiftOrder) ||
        entry.description.includes('[هدية مجانية') ||
        (entry.type === 'purchase' && entry.debit === 0 && !isZeroFloor);

      if (isFreeGift) {
        // Free gift: always show 0.00 service price to the client and hide application fee
        result.push({
          ...entry,
          debit: 0,
        });
      } else {
        // Standard purchase / zero-floor / transfer_out: show unified total deducted without separate fee row
        result.push({
          ...entry,
          debit: roundCurrency((entry.debit || 0) + feeMeta.totalFeeDebit),
          balanceAfter: feeMeta.balanceAfter,
        });
      }
      continue;
    }

    result.push(entry);
  }

  return result;
}
