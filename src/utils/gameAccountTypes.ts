export interface GameAccountTypeOption {
  id: string;
  labelAr: string;
}

export const GAME_LOGIN_ACCOUNT_TYPES: GameAccountTypeOption[] = [
  { id: 'google', labelAr: 'حساب جوجل (Google)' },
  { id: 'facebook', labelAr: 'حساب فيسبوك (Facebook)' },
  { id: 'twitter_x', labelAr: 'حساب تويتر / إكس (Twitter / X)' },
  { id: 'apple', labelAr: 'حساب أبل (Apple ID)' },
  { id: 'vk', labelAr: 'حساب في كي (VK)' },
  { id: 'game_center', labelAr: 'حساب جيم سنتر (Game Center)' },
  { id: 'supercell', labelAr: 'حساب سوبرسل (Supercell ID)' },
  { id: 'activision', labelAr: 'حساب أكتيفيجن (Activision)' },
  { id: 'konami', labelAr: 'حساب كونامي (Konami ID)' },
  { id: 'ea', labelAr: 'حساب إلكترونيك آرتس (EA Account)' },
  { id: 'epic_games', labelAr: 'حساب إيبك قيمز (Epic Games)' },
  { id: 'steam', labelAr: 'حساب ستيم (Steam)' },
  { id: 'riot', labelAr: 'حساب ريوت قيمز (Riot Games)' },
  { id: 'discord', labelAr: 'حساب ديسكورد (Discord)' },
  { id: 'playstation', labelAr: 'حساب بلايستيشن (PlayStation / PSN)' },
  { id: 'xbox', labelAr: 'حساب إكس بوكس / مايكروسوفت (Xbox / Microsoft)' },
  { id: 'nintendo', labelAr: 'حساب نينتندو (Nintendo)' },
  { id: 'ubisoft', labelAr: 'حساب يوبيسوفت (Ubisoft Connect)' },
  { id: 'rockstar', labelAr: 'حساب روكستار (Rockstar Games)' },
  { id: 'garena', labelAr: 'حساب غارينا (Garena)' },
  { id: 'huawei', labelAr: 'حساب هواوي (Huawei ID)' },
  { id: 'game_direct', labelAr: 'حساب اللعبة المباشر (بريد / معرف اللعبة)' },
  { id: 'other', labelAr: 'نوع حساب آخر...' },
];

export function resolveGameAccountTypeLabel(selectedTypeId: string, customAccountType?: string): string {
  const cleanId = (selectedTypeId || '').trim();
  if (!cleanId) return '';
  if (cleanId === 'other') {
    return (customAccountType || '').trim();
  }
  const found = GAME_LOGIN_ACCOUNT_TYPES.find((item) => item.id === cleanId);
  return found ? found.labelAr : cleanId;
}

export function validateAccountLoginCredentials(params: {
  accountType?: string;
  customAccountType?: string;
  accountEmail?: string;
  accountPassword?: string;
}): { valid: boolean; accountTypeLabel: string; error?: string } {
  const accountTypeLabel = resolveGameAccountTypeLabel(
    params.accountType || '',
    params.customAccountType
  );
  if (!accountTypeLabel) {
    return {
      valid: false,
      accountTypeLabel: '',
      error: 'يرجى اختيار نوع الحساب المرتبط باللعبة (مثل جوجل، فيسبوك، تويتر...) قبل تأكيد الدفع.',
    };
  }
  const cleanEmail = (params.accountEmail || '').trim();
  const cleanPassword = (params.accountPassword || '').trim();
  if (!cleanEmail || !cleanPassword) {
    return {
      valid: false,
      accountTypeLabel,
      error: 'يرجى إدخال البريد الإلكتروني / الحساب وكلمة المرور للحساب قبل تأكيد الدفع.',
    };
  }
  return {
    valid: true,
    accountTypeLabel,
  };
}
