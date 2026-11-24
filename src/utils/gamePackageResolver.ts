export type SupportedGameCode =
  | 'pubg_mobile'
  | 'free_fire'
  | 'yalla_ludo'
  | 'mlbb'
  | 'roblox'
  | 'codm'
  | 'genshin'
  | 'valorant'
  | 'honor_of_kings'
  | 'tiktok'
  | 'bigo_live'
  | 'custom';

export interface GameContextInput {
  gameCode?: SupportedGameCode | string;
  packageName?: string;
  packageDescription?: string;
  serviceName?: string;
  serviceDescription?: string;
  catalogName?: string;
  warehouseCategoryName?: string;
}

export interface ResolvedGameProfile {
  gameCode: SupportedGameCode;
  gameLabelAr: string;
  gameSlugEn: string;
  requiresZoneId: boolean;
  zoneLabelAr?: string;
  zonePlaceholder?: string;
  idPlaceholder: string;
  numericOnly: boolean;
  minLength: number;
  maxLength: number;
  matchedBy: 'explicit' | 'package' | 'service' | 'catalog' | 'fallback';
}

interface GameDefinition {
  gameCode: SupportedGameCode;
  gameLabelAr: string;
  gameSlugEn: string;
  requiresZoneId: boolean;
  zoneLabelAr?: string;
  zonePlaceholder?: string;
  idPlaceholder: string;
  numericOnly: boolean;
  minLength: number;
  maxLength: number;
  strongKeywords: string[];
  /** Currency / package unit keywords strongly associated with this game when matched inside a package */
  packageUnitKeywords?: string[];
}

const GAME_DEFINITIONS: readonly GameDefinition[] = [
  {
    gameCode: 'pubg_mobile',
    gameLabelAr: 'ببجي موبايل (PUBG Mobile)',
    gameSlugEn: 'pubgm',
    requiresZoneId: false,
    idPlaceholder: 'مثال: 5129480192',
    numericOnly: true,
    minLength: 6,
    maxLength: 15,
    strongKeywords: ['pubg', 'pubgm', 'ببجي', 'بوبجي', 'ببجي موبايل'],
    packageUnitKeywords: ['شدة', 'شدات', 'uc', 'رويال باس', 'royal pass', 'royale pass'],
  },
  {
    gameCode: 'free_fire',
    gameLabelAr: 'فري فاير (Free Fire)',
    gameSlugEn: 'freefire',
    requiresZoneId: false,
    idPlaceholder: 'مثال: 1842694356',
    numericOnly: true,
    minLength: 6,
    maxLength: 14,
    strongKeywords: ['free fire', 'freefire', 'garena', 'فري فاير', 'فريفاير', 'غارينا', 'جارينا'],
    packageUnitKeywords: ['عضوية اسبوعية', 'عضوية أسبوعية', 'عضوية شهرية', 'booyah pass', 'بوياه باس'],
  },
  {
    gameCode: 'yalla_ludo',
    gameLabelAr: 'يلا لودو (Yalla Ludo)',
    gameSlugEn: 'yalla_ludo',
    requiresZoneId: false,
    idPlaceholder: 'مثال: 12345678',
    numericOnly: true,
    minLength: 5,
    maxLength: 14,
    strongKeywords: ['yalla ludo', 'yallaludo', 'yalla', 'ludo', 'يلا لودو', 'يلو لودو', 'لودو', 'يلا'],
    packageUnitKeywords: ['ذهب يلا', 'ماسات يلا', 'نرد'],
  },
  {
    gameCode: 'mlbb',
    gameLabelAr: 'موبايل ليجيند (Mobile Legends)',
    gameSlugEn: 'mlbb',
    requiresZoneId: true,
    zoneLabelAr: 'معرف السيرفر (Zone ID)',
    zonePlaceholder: 'مثال: 9059',
    idPlaceholder: 'مثال: 206932215',
    numericOnly: true,
    minLength: 5,
    maxLength: 14,
    strongKeywords: [
      'mobile legends',
      'mobilelegends',
      'mlbb',
      'موبايل ليجيند',
      'موبايل ليجند',
      'موبايل ليجيندز',
      'اساطير الموبايل',
      'أساطير الموبايل',
    ],
    packageUnitKeywords: ['twilight pass', 'starlight', 'ستارلايت'],
  },
  {
    gameCode: 'roblox',
    gameLabelAr: 'روبلوكس (Roblox)',
    gameSlugEn: 'roblox',
    requiresZoneId: false,
    idPlaceholder: 'أدخل أيدي الحساب أو اسم المستخدم في Roblox',
    numericOnly: false,
    minLength: 3,
    maxLength: 32,
    strongKeywords: ['roblox', 'robux', 'روبلوكس', 'روبلوکس', 'روبوكس', 'روبكس'],
    packageUnitKeywords: ['robux', 'روبوكس', 'روبكس'],
  },
  {
    gameCode: 'codm',
    gameLabelAr: 'كول أوف ديوتي موبايل (CODM)',
    gameSlugEn: 'codm',
    requiresZoneId: false,
    idPlaceholder: 'مثال: 6758962451843264513',
    numericOnly: true,
    minLength: 8,
    maxLength: 22,
    strongKeywords: ['call of duty', 'cod mobile', 'codm', 'كول اوف ديوتي', 'كول أوف ديوتي', 'كود موبايل'],
    packageUnitKeywords: ['نقاط cp', 'cod points'],
  },
  {
    gameCode: 'honor_of_kings',
    gameLabelAr: 'أونر أوف كينجز (Honor of Kings)',
    gameSlugEn: 'hok',
    requiresZoneId: false,
    idPlaceholder: 'مثال: 1234567890',
    numericOnly: true,
    minLength: 6,
    maxLength: 16,
    strongKeywords: ['honor of kings', 'hok', 'أونر أوف كينجز', 'اونر اوف كينجز', 'ملوك الشرف', 'شرف الملوك'],
  },
  {
    gameCode: 'genshin',
    gameLabelAr: 'جينشين إمباكت (Genshin Impact)',
    gameSlugEn: 'genshin',
    requiresZoneId: true,
    zoneLabelAr: 'السيرفر (Server)',
    zonePlaceholder: 'مثال: os_euro أو os_asia',
    idPlaceholder: 'مثال: 700123456',
    numericOnly: true,
    minLength: 8,
    maxLength: 12,
    strongKeywords: ['genshin', 'جينشين', 'قنشن', 'جنسن', 'genesis crystal', 'welkin'],
    packageUnitKeywords: ['genesis crystal', 'كريستال جنسن', 'welkin'],
  },
  {
    gameCode: 'valorant',
    gameLabelAr: 'فالورانت (Valorant)',
    gameSlugEn: 'valorant',
    requiresZoneId: false,
    idPlaceholder: 'مثال: PlayerName#TAG',
    numericOnly: false,
    minLength: 4,
    maxLength: 32,
    strongKeywords: ['valorant', 'فالورانت', 'فيلورانت', 'فالورنت'],
    packageUnitKeywords: ['valorant points', 'vp'],
  },
  {
    gameCode: 'bigo_live',
    gameLabelAr: 'بيجو لايف (Bigo Live)',
    gameSlugEn: 'bigo',
    requiresZoneId: false,
    idPlaceholder: 'أدخل Bigo ID',
    numericOnly: false,
    minLength: 4,
    maxLength: 24,
    strongKeywords: ['bigo', 'bigo live', 'بيجو', 'بيجو لايف'],
  },
  {
    gameCode: 'tiktok',
    gameLabelAr: 'تيك توك (TikTok)',
    gameSlugEn: 'tiktok',
    requiresZoneId: false,
    idPlaceholder: 'أدخل اسم المستخدم @username',
    numericOnly: false,
    minLength: 3,
    maxLength: 32,
    strongKeywords: ['tiktok', 'tik tok', 'تيك توك', 'تيكتوك'],
    packageUnitKeywords: ['عملات تيك توك', 'tiktok coins'],
  },
];

function normalizeText(value?: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesKeyword(haystack: string, keyword: string): boolean {
  if (!haystack || !keyword) return false;
  const normKw = normalizeText(keyword);
  if (!normKw) return false;
  // Short ASCII tokens (<= 3 chars like uc, vp, ff, rp) must match as whole words
  if (/^[a-z0-9]{1,3}$/.test(normKw)) {
    const escaped = normKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack);
  }
  return haystack.includes(normKw);
}

function findGameMatchInText(text: string, allowUnitKeywords: boolean): GameDefinition | null {
  if (!text) return null;
  for (const def of GAME_DEFINITIONS) {
    if (def.strongKeywords.some((kw) => matchesKeyword(text, kw))) {
      return def;
    }
  }
  if (allowUnitKeywords) {
    for (const def of GAME_DEFINITIONS) {
      if (def.packageUnitKeywords?.some((kw) => matchesKeyword(text, kw))) {
        return def;
      }
    }
  }
  return null;
}

function toProfile(
  def: GameDefinition,
  matchedBy: ResolvedGameProfile['matchedBy']
): ResolvedGameProfile {
  return {
    gameCode: def.gameCode,
    gameLabelAr: def.gameLabelAr,
    gameSlugEn: def.gameSlugEn,
    requiresZoneId: def.requiresZoneId,
    zoneLabelAr: def.zoneLabelAr,
    zonePlaceholder: def.zonePlaceholder,
    idPlaceholder: def.idPlaceholder,
    numericOnly: def.numericOnly,
    minLength: def.minLength,
    maxLength: def.maxLength,
    matchedBy,
  };
}

/**
 * Resolves the game profile and local ID format rules prioritizing the
 * SELECTED PACKAGE first, then falling back to service and catalog context.
 */
export function resolveGameProfileFromPackage(context?: GameContextInput): ResolvedGameProfile {
  if (context?.gameCode) {
    const explicit = GAME_DEFINITIONS.find((g) => g.gameCode === context.gameCode);
    if (explicit) {
      return toProfile(explicit, 'explicit');
    }
  }

  const packageText = normalizeText(
    [context?.packageName, context?.packageDescription, context?.warehouseCategoryName]
      .filter(Boolean)
      .join(' ')
  );
  const serviceText = normalizeText(
    [context?.serviceName, context?.serviceDescription].filter(Boolean).join(' ')
  );
  const catalogText = normalizeText(context?.catalogName);

  const pkgStrongMatch = findGameMatchInText(packageText, false);
  if (pkgStrongMatch) {
    return toProfile(pkgStrongMatch, 'package');
  }

  const pkgUnitMatch = findGameMatchInText(packageText, true);
  const serviceStrongMatch = findGameMatchInText(serviceText, false);
  if (pkgUnitMatch && (!serviceStrongMatch || serviceStrongMatch.gameCode === pkgUnitMatch.gameCode)) {
    return toProfile(pkgUnitMatch, 'package');
  }

  const serviceMatch = serviceStrongMatch || findGameMatchInText(serviceText, true);
  if (serviceMatch) {
    return toProfile(serviceMatch, 'service');
  }

  const catalogMatch = findGameMatchInText(catalogText, true);
  if (catalogMatch) {
    return toProfile(catalogMatch, 'catalog');
  }

  return {
    gameCode: 'custom',
    gameLabelAr: context?.serviceName?.trim() || context?.packageName?.trim() || 'خدمة رقمية',
    gameSlugEn: 'custom',
    requiresZoneId: false,
    idPlaceholder: 'أدخل معرف الحساب / الأيدي (Player ID)',
    numericOnly: false,
    minLength: 4,
    maxLength: 32,
    matchedBy: 'fallback',
  };
}

export function validatePlayerIdFormat(
  rawPlayerId: string,
  profile: ResolvedGameProfile,
  rawZoneId?: string
): { valid: boolean; cleanId: string; cleanZoneId?: string; error?: string } {
  const cleanId = (rawPlayerId || '').trim();
  const cleanZoneId = (rawZoneId || '').trim();

  if (!cleanId) {
    return { valid: false, cleanId, error: 'يرجى إدخال معرف اللاعب (Player ID) أولاً.' };
  }
  if (cleanId.length < profile.minLength || cleanId.length > profile.maxLength) {
    return {
      valid: false,
      cleanId,
      error: `معرف اللاعب لـ ${profile.gameLabelAr} يجب أن يكون بين ${profile.minLength} و ${profile.maxLength} خانة.`,
    };
  }
  if (profile.numericOnly && !/^\d+$/.test(cleanId)) {
    return {
      valid: false,
      cleanId,
      error: `معرف اللاعب في ${profile.gameLabelAr} يجب أن يتكون من أرقام فقط.`,
    };
  }
  if (profile.gameCode === 'valorant' && !cleanId.includes('#')) {
    return {
      valid: false,
      cleanId,
      error: 'يرجى إدخال معرف Riot كاملاً بصيغة Name#TAG.',
    };
  }
  if (profile.requiresZoneId && !cleanZoneId) {
    return {
      valid: false,
      cleanId,
      error: `لعبة ${profile.gameLabelAr} تتطلب إدخال ${profile.zoneLabelAr || 'رقم السيرفر (Zone ID)'}.`,
    };
  }
  if (profile.gameCode === 'mlbb' && cleanZoneId && !/^\d+$/.test(cleanZoneId)) {
    return {
      valid: false,
      cleanId,
      cleanZoneId,
      error: 'معرف السيرفر (Zone ID) في موبايل ليجيند يجب أن يكون أرقاماً فقط.',
    };
  }

  return {
    valid: true,
    cleanId,
    cleanZoneId: cleanZoneId || undefined,
  };
}
