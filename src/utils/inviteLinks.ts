import { AccountTier, InviteLink, InviteLinkFeatures, POSClient, Supplier } from '../types';
import { isSupplierActive } from './storeSupervision';

const VALID_TIERS: AccountTier[] = ['regular', 'bronze', 'silver', 'gold', 'vip'];

export const INVITE_FEATURE_OPTIONS: Array<{
  key: keyof Required<InviteLinkFeatures>;
  labelAr: string;
  descriptionAr: string;
}> = [
  {
    key: 'canRequestLoans',
    labelAr: 'ميزة طلب السلفة',
    descriptionAr: 'تمكين العميل من إرسال طلبات السلف والرصيد الآجل للمتجر',
  },
  {
    key: 'canReceiveSupplierTransfers',
    labelAr: 'استلام حوالات المتجر',
    descriptionAr: 'منح العميل صلاحية استلام وتأكيد الحوالات البنكية للمتجر',
  },
  {
    key: 'canGetBonus',
    labelAr: 'ميزة الحصول على بونص',
    descriptionAr: 'تأهيل العميل لعلاوات الرصيد والبونص والمكافآت',
  },
  {
    key: 'canViewGifts',
    labelAr: 'الهدايا والعروض المجانية',
    descriptionAr: 'إظهار قسم الهدايا والعروض المجانية الحصرية للعميل',
  },
  {
    key: 'isAccreditedPos',
    labelAr: 'اعتماد كنقطة بيع للمتجر',
    descriptionAr: 'اعتماد العميل تلقائياً كنقطة بيع رسمية للمتجر مع شارة وشهادة الاعتماد',
  },
];

export function normalizeInviteTier(tier?: string | null): AccountTier {
  if (tier && VALID_TIERS.includes(tier as AccountTier)) {
    return tier as AccountTier;
  }
  return 'regular';
}

export function normalizeInviteFeatures(
  raw?: Partial<InviteLinkFeatures> | null
): Required<InviteLinkFeatures> {
  return {
    canRequestLoans: Boolean(raw?.canRequestLoans),
    canReceiveSupplierTransfers: Boolean(raw?.canReceiveSupplierTransfers),
    canGetBonus: Boolean(raw?.canGetBonus),
    canViewGifts: Boolean(raw?.canViewGifts),
    isAccreditedPos: Boolean(raw?.isAccreditedPos),
  };
}

export function isInviteLinkActive(link?: Pick<InviteLink, 'isActive'> | null): boolean {
  return link?.isActive !== false;
}

export function getEnabledInviteFeatureLabels(
  features?: Partial<InviteLinkFeatures> | null
): Array<{ key: keyof Required<InviteLinkFeatures>; labelAr: string }> {
  const normalized = normalizeInviteFeatures(features);
  return INVITE_FEATURE_OPTIONS.filter((opt) => normalized[opt.key]).map((opt) => ({
    key: opt.key,
    labelAr: opt.labelAr,
  }));
}

export function buildInviteUrl(params: {
  origin?: string;
  code: string;
  supplierId: string;
}): string {
  const cleanOrigin = (params.origin || 'https://digipos.app').replace(/\/+$/, '');
  const cleanCode = params.code.trim();
  const cleanSupplierId = params.supplierId.trim();
  const query = new URLSearchParams();
  query.set('invite', cleanCode);
  if (cleanSupplierId) {
    query.set('sup', cleanSupplierId);
  }
  return `${cleanOrigin}/?${query.toString()}`;
}

export function parseInviteUrl(searchOrUrl: string): {
  inviteCode: string;
  supplierId: string;
  isInviteFlow: boolean;
} {
  const raw = (searchOrUrl || '').trim();
  if (!raw) {
    return { inviteCode: '', supplierId: '', isInviteFlow: false };
  }

  let searchStr = '';
  if (raw.includes('?')) {
    searchStr = raw.slice(raw.indexOf('?'));
  } else if (raw.includes('=') && !raw.includes('://')) {
    searchStr = `?${raw}`;
  }

  if (!searchStr) {
    return { inviteCode: '', supplierId: '', isInviteFlow: false };
  }

  try {
    const params = new URLSearchParams(searchStr);
    const inviteCode = (params.get('invite') || params.get('ref') || '').trim();
    const supplierId = (params.get('sup') || '').trim();
    return {
      inviteCode,
      supplierId,
      isInviteFlow: inviteCode.length > 0,
    };
  } catch {
    return { inviteCode: '', supplierId: '', isInviteFlow: false };
  }
}

export function parseInviteCodeFromInput(input: string): string {
  const trimmed = (input || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('?') || trimmed.includes('invite=') || trimmed.includes('ref=')) {
    const parsed = parseInviteUrl(trimmed);
    if (parsed.inviteCode) {
      return parsed.inviteCode;
    }
  }
  return trimmed;
}

export type ResolvedInviteResult =
  | {
      valid: true;
      inviteLink: InviteLink;
      supplier: Supplier;
      targetTier: AccountTier;
      features: Required<InviteLinkFeatures>;
    }
  | {
      valid: false;
      error: string;
    };

export function resolveValidInviteLink(params: {
  codeOrUrl: string;
  inviteLinks: InviteLink[];
  suppliers: Supplier[];
}): ResolvedInviteResult {
  const code = parseInviteCodeFromInput(params.codeOrUrl);
  if (!code) {
    return { valid: false, error: 'كود أو رابط الدعوة غير مكتمل.' };
  }

  const normalizedCode = code.toUpperCase();
  const matched = (params.inviteLinks || []).find(
    (link) => (link.code || '').trim().toUpperCase() === normalizedCode
  );
  if (!matched) {
    return {
      valid: false,
      error: 'رابط أو كود الدعوة غير موجود أو غير صالح. يرجى التأكد منه من المتجر.',
    };
  }

  if (!isInviteLinkActive(matched)) {
    return {
      valid: false,
      error: 'تم إيقاف رابط الدعوة هذا من قِبل المتجر ولم يعد متاحاً للتسجيل.',
    };
  }

  const matchedSupplier = (params.suppliers || []).find(
    (s) => s.id === matched.supplierId
  );
  if (!matchedSupplier) {
    return {
      valid: false,
      error: 'المتجر المرتبط برابط الدعوة غير موجود في المنصة.',
    };
  }

  if (!isSupplierActive(matchedSupplier)) {
    return {
      valid: false,
      error: 'المتجر المرتبط برابط الدعوة موقوف حالياً ولا يقبل تسجيلات جديدة.',
    };
  }

  return {
    valid: true,
    inviteLink: matched,
    supplier: matchedSupplier,
    targetTier: normalizeInviteTier(matched.targetTier),
    features: normalizeInviteFeatures(matched.features),
  };
}

export function buildPosClientInviteDefaults(resolved: {
  targetTier: AccountTier;
  features: Required<InviteLinkFeatures>;
}): Pick<
  POSClient,
  | 'tier'
  | 'canRequestLoans'
  | 'canReceiveSupplierTransfers'
  | 'canGetBonus'
  | 'canViewGifts'
  | 'isAccreditedPos'
> {
  return {
    tier: resolved.targetTier,
    canRequestLoans: resolved.features.canRequestLoans,
    canReceiveSupplierTransfers: resolved.features.canReceiveSupplierTransfers,
    canGetBonus: resolved.features.canGetBonus,
    canViewGifts: resolved.features.canViewGifts,
    isAccreditedPos: resolved.features.isAccreditedPos,
  };
}
