import { SupplierCustomSocialLink, SupplierSocialLinks } from '../types';

export type SocialPlatformKey =
  | 'whatsapp'
  | 'telegram'
  | 'instagram'
  | 'facebook'
  | 'x'
  | 'tiktok'
  | 'youtube'
  | 'snapchat'
  | 'website';

export interface SocialPlatformMeta {
  key: SocialPlatformKey;
  labelAr: string;
  placeholder: string;
  hintAr: string;
}

export const SOCIAL_PLATFORM_META: SocialPlatformMeta[] = [
  {
    key: 'whatsapp',
    labelAr: 'واتساب',
    placeholder: '+966501234567 أو https://wa.me/966501234567',
    hintAr: 'رقم واتساب مع رمز الدولة أو رابط مباشر',
  },
  {
    key: 'telegram',
    labelAr: 'تيليجرام',
    placeholder: '@username أو https://t.me/username',
    hintAr: 'معرف تيليجرام أو رابط القناة/الحساب',
  },
  {
    key: 'instagram',
    labelAr: 'إنستغرام',
    placeholder: '@username أو https://instagram.com/username',
    hintAr: 'اسم المستخدم أو رابط الصفحة',
  },
  {
    key: 'facebook',
    labelAr: 'فيسبوك',
    placeholder: 'https://facebook.com/yourpage',
    hintAr: 'رابط صفحة أو حساب فيسبوك',
  },
  {
    key: 'x',
    labelAr: 'منصة X (تويتر)',
    placeholder: '@username أو https://x.com/username',
    hintAr: 'معرف الحساب أو رابط X',
  },
  {
    key: 'tiktok',
    labelAr: 'تيك توك',
    placeholder: '@username أو https://tiktok.com/@username',
    hintAr: 'معرف تيك توك أو رابط الحساب',
  },
  {
    key: 'youtube',
    labelAr: 'يوتيوب',
    placeholder: 'https://youtube.com/@channel',
    hintAr: 'رابط قناة يوتيوب',
  },
  {
    key: 'snapchat',
    labelAr: 'سناب شات',
    placeholder: 'username أو https://snapchat.com/add/username',
    hintAr: 'اسم مستخدم سناب شات أو الرابط',
  },
  {
    key: 'website',
    labelAr: 'الموقع الإلكتروني',
    placeholder: 'https://example.com',
    hintAr: 'رابط الموقع الرسمي للمتجر',
  },
];

export interface ResolvedContactLink {
  id: string;
  key: SocialPlatformKey | 'custom';
  label: string;
  href: string;
  rawValue: string;
}

const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/g;

function hasDangerousScheme(value: string): boolean {
  const cleaned = value.replace(CONTROL_CHARS_RE, '').trim().toLowerCase();
  return (
    cleaned.startsWith('javascript:') ||
    cleaned.startsWith('data:') ||
    cleaned.startsWith('vbscript:') ||
    cleaned.startsWith('file:')
  );
}

function validateHttpUrl(candidate: string): string | null {
  if (hasDangerousScheme(candidate)) return null;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (!parsed.hostname || (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost')) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function normalizeSocialUrl(
  platform: SocialPlatformKey | 'custom',
  rawValue?: string | null
): string | null {
  if (!rawValue) return null;
  const trimmed = rawValue.replace(CONTROL_CHARS_RE, '').trim();
  if (!trimmed) return null;
  if (hasDangerousScheme(trimmed)) return null;
  if (trimmed.startsWith('//')) return null;

  // Reject any non-http/https scheme explicitly (e.g. ftp:, mailto:, tel:, custom:)
  const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') {
      return null;
    }
    return validateHttpUrl(trimmed);
  }

  // Handle WhatsApp phone numbers (e.g. +966 50 123 4567 or 00966501234567)
  if (platform === 'whatsapp') {
    const strippedForPhone = trimmed.replace(/[\s\-().+]/g, '');
    if (/^\d{7,16}$/.test(strippedForPhone)) {
      const normalizedDigits = strippedForPhone.startsWith('00')
        ? strippedForPhone.slice(2)
        : strippedForPhone;
      return `https://wa.me/${normalizedDigits}`;
    }
    return validateHttpUrl(`https://${trimmed.replace(/^\/+/, '')}`);
  }

  // Handle bare @handles or usernames for platforms that support handles
  const cleanHandle = trimmed.replace(/^@+/, '');
  const isBareHandle = !trimmed.includes('/') && !trimmed.includes('.');

  if (platform === 'telegram' && (trimmed.startsWith('@') || isBareHandle)) {
    if (!/^[a-zA-Z0-9_]{3,64}$/.test(cleanHandle)) return null;
    return `https://t.me/${cleanHandle}`;
  }

  if (platform === 'instagram' && (trimmed.startsWith('@') || isBareHandle)) {
    if (!/^[a-zA-Z0-9._]{1,64}$/.test(cleanHandle)) return null;
    return `https://instagram.com/${cleanHandle}`;
  }

  if (platform === 'x' && (trimmed.startsWith('@') || isBareHandle)) {
    if (!/^[a-zA-Z0-9_]{1,50}$/.test(cleanHandle)) return null;
    return `https://x.com/${cleanHandle}`;
  }

  if (platform === 'tiktok' && (trimmed.startsWith('@') || isBareHandle)) {
    if (!/^[a-zA-Z0-9._]{1,64}$/.test(cleanHandle)) return null;
    return `https://www.tiktok.com/@${cleanHandle}`;
  }

  if (platform === 'snapchat' && (trimmed.startsWith('@') || isBareHandle)) {
    if (!/^[a-zA-Z0-9._-]{1,64}$/.test(cleanHandle)) return null;
    return `https://www.snapchat.com/add/${cleanHandle}`;
  }

  return validateHttpUrl(`https://${trimmed.replace(/^\/+/, '')}`);
}

export function sanitizeSupplierSocialLinks(
  input?: SupplierSocialLinks | null
): SupplierSocialLinks {
  const safeCustomLinks: SupplierCustomSocialLink[] = Array.isArray(input?.customLinks)
    ? input!.customLinks
        .map((item, idx) => ({
          id: (item?.id || `custom-${idx + 1}`).trim(),
          label: (item?.label || '').trim(),
          url: (item?.url || '').trim(),
        }))
        .filter((item) => item.label.length > 0 && item.url.length > 0 && normalizeSocialUrl('custom', item.url) !== null)
    : [];

  return {
    whatsapp: (input?.whatsapp || '').trim(),
    telegram: (input?.telegram || '').trim(),
    instagram: (input?.instagram || '').trim(),
    facebook: (input?.facebook || '').trim(),
    x: (input?.x || '').trim(),
    tiktok: (input?.tiktok || '').trim(),
    youtube: (input?.youtube || '').trim(),
    snapchat: (input?.snapchat || '').trim(),
    website: (input?.website || '').trim(),
    customLinks: safeCustomLinks,
  };
}

export function buildContactLinksList(
  socialLinks?: SupplierSocialLinks | null
): ResolvedContactLink[] {
  if (!socialLinks) return [];

  const result: ResolvedContactLink[] = [];

  for (const meta of SOCIAL_PLATFORM_META) {
    const rawValue = socialLinks[meta.key];
    if (!rawValue || !rawValue.trim()) continue;
    const href = normalizeSocialUrl(meta.key, rawValue);
    if (!href) continue;
    result.push({
      id: `platform-${meta.key}`,
      key: meta.key,
      label: meta.labelAr,
      href,
      rawValue: rawValue.trim(),
    });
  }

  if (Array.isArray(socialLinks.customLinks)) {
    for (const custom of socialLinks.customLinks) {
      const label = custom.label?.trim();
      const rawValue = custom.url?.trim();
      if (!label || !rawValue) continue;
      const href = normalizeSocialUrl('custom', rawValue);
      if (!href) continue;
      result.push({
        id: custom.id || `custom-${label}`,
        key: 'custom',
        label,
        href,
        rawValue,
      });
    }
  }

  return result;
}
