import { AppearancePortalRole, PageAppearanceSettings } from '../types';

export interface AppearanceElementDefinition {
  key: string;
  labelAr: string;
  descriptionAr: string;
  categoryAr: string;
}

export const ADMIN_APPEARANCE_ELEMENTS: readonly AppearanceElementDefinition[] = [
  {
    key: 'admin_header_actions',
    labelAr: 'أزرار الإجراءات السريعة بالرأس',
    descriptionAr: 'أزرار إضافة ممول/متجر جديد وإرسال رابط تسجيل في البطاقة العلوية',
    categoryAr: 'رأس الصفحة',
  },
  {
    key: 'admin_kpi_cards',
    labelAr: 'بطاقات الإحصائيات السريعة',
    descriptionAr: 'محفظة مدير التطبيق، إجمالي شبكة المتاجر، والرسوم العامة الافتراضية',
    categoryAr: 'رأس الصفحة',
  },
  {
    key: 'admin_reset_button',
    labelAr: 'زر تصفير الخدمات والمستخدمين',
    descriptionAr: 'زر التصفير السريع الظاهر في شريط تبويبات مدير التطبيق',
    categoryAr: 'التنقل والإجراءات',
  },
  {
    key: 'admin_wallet_actions',
    labelAr: 'خيارات استخدام مبالغ المحفظة',
    descriptionAr: 'بطاقات التسوية البنكية والتحويل لنقاط البيع في تبويب الإشراف',
    categoryAr: 'محتوى الصفحة',
  },
  {
    key: 'admin_store_filters',
    labelAr: 'شريط البحث وتصفية المتاجر',
    descriptionAr: 'حقل البحث وأزرار تصفية المتاجر (الكل / نشط / موقوف)',
    categoryAr: 'محتوى الصفحة',
  },
  {
    key: 'admin_stores_grid',
    labelAr: 'قائمة وبطاقات المتاجر المعتمدين',
    descriptionAr: 'شبكة عرض المتاجر الخاضعة للإشراف وأزرار التحكم الخاصة بكل متجر',
    categoryAr: 'محتوى الصفحة',
  },
];

export const SUPPLIER_APPEARANCE_ELEMENTS: readonly AppearanceElementDefinition[] = [
  {
    key: 'supplier_admin_notice',
    labelAr: 'تعميم إدارة التطبيق للمتاجر',
    descriptionAr: 'شريط التنبيه والتعميم الإداري أعلى صفحة المتجر',
    categoryAr: 'التنبيهات والرأس',
  },
  {
    key: 'supplier_role_badge',
    labelAr: 'شارة المالك أو صلاحيات الموظف',
    descriptionAr: 'شارة حالة الدخول (مالك المتجر / صلاحيات الموظف وعدد الموظفين)',
    categoryAr: 'التنبيهات والرأس',
  },
  {
    key: 'supplier_qr_id_bar',
    labelAr: 'شريط المعرّف الرسمي ورمز QR',
    descriptionAr: 'رمز الاستجابة السريعة والمعرّف وأزرار النسخ والمشاركة',
    categoryAr: 'التنبيهات والرأس',
  },
  {
    key: 'supplier_social_links',
    labelAr: 'روابط التواصل الاجتماعي للمتجر',
    descriptionAr: 'أيقونات وروابط التواصل المعروضة في البطاقة العلوية للمتجر',
    categoryAr: 'التنبيهات والرأس',
  },
  {
    key: 'supplier_quick_actions',
    labelAr: 'أزرار الإجراءات السريعة',
    descriptionAr: 'أزرار إضافة كاتالوج، خدمة، رابط دعوة، دعم رصيد، وصلاحيات الموظفين',
    categoryAr: 'التنبيهات والرأس',
  },
  {
    key: 'supplier_kpi_cards',
    labelAr: 'بطاقات المؤشرات السريعة',
    descriptionAr: 'إحصائيات طلبات الأيدي، طلبات الشحن، رصيد المبيعات، وعدد العملاء',
    categoryAr: 'المؤشرات والعملة',
  },
  {
    key: 'supplier_currency_bar',
    labelAr: 'شريط العملة وسعر الصرف',
    descriptionAr: 'أدوات تبديل عملة العرض (ريال/دولار) وضبط سعر الصرف',
    categoryAr: 'المؤشرات والعملة',
  },
  {
    key: 'supplier_low_stock_alert',
    labelAr: 'تنبيه انخفاض مخزون الأكواد',
    descriptionAr: 'الشريط التحذيري عند وصول فئات الأكواد إلى الحد الأدنى',
    categoryAr: 'المحتوى والأقسام',
  },
  {
    key: 'supplier_stock_summary_card',
    labelAr: 'بطاقة ملخص مخزون الأكواد',
    descriptionAr: 'ملخص إجمالي المتوفر والمباع والمتبقي داخل تبويب الكتالوجات',
    categoryAr: 'المحتوى والأقسام',
  },
  {
    key: 'supplier_catalogs_grid',
    labelAr: 'شبكة بطاقات الكتالوجات',
    descriptionAr: 'بطاقات تصنيفات الخدمات أعلى جدول الباقات والتسعير الطبقي',
    categoryAr: 'المحتوى والأقسام',
  },
];

export const POS_APPEARANCE_ELEMENTS: readonly AppearanceElementDefinition[] = [
  {
    key: 'pos_admin_notice',
    labelAr: 'تنبيه إدارة التطبيق العام',
    descriptionAr: 'رسالة التعميم والتنبيه الصادرة من مدير التطبيق',
    categoryAr: 'التنبيهات والمزايا',
  },
  {
    key: 'pos_special_features',
    labelAr: 'شريط الميزات الخاصة الحصرية',
    descriptionAr: 'شريط شارة الاعتماد والسلف والبونص والهدايا المخصصة لحسابك',
    categoryAr: 'التنبيهات والمزايا',
  },
  {
    key: 'pos_contact_meta',
    labelAr: 'بيانات التواصل والموقع والمتجر',
    descriptionAr: 'رقم الهاتف، هاتف الخدمات، الدولة والمدينة، واسم المتجر التابع له',
    categoryAr: 'بطاقة الهوية والمحفظة',
  },
  {
    key: 'pos_supplier_social',
    labelAr: 'روابط التواصل مع المتجر',
    descriptionAr: 'أيقونات التواصل الخاصة بالمتجر داخل بطاقة الهوية',
    categoryAr: 'بطاقة الهوية والمحفظة',
  },
  {
    key: 'pos_qr_and_code',
    labelAr: 'المعرّف الرقمي ورمز QR',
    descriptionAr: 'زر عرض رمز QR ومربع رقم معرّف العميل وزر النسخ',
    categoryAr: 'بطاقة الهوية والمحفظة',
  },
  {
    key: 'pos_wallet_strip',
    labelAr: 'شريط رصيد المحفظة وأزرار الشحن',
    descriptionAr: 'عرض الرصيد الحالي وأزرار شحن المحفظة وتحويل الرصيد لوكيل آخر',
    categoryAr: 'بطاقة الهوية والمحفظة',
  },
  {
    key: 'pos_search_box',
    labelAr: 'مربع البحث عن الخدمات',
    descriptionAr: 'شريط البحث السريع وعداد النتائج المتاحة داخل المتجر',
    categoryAr: 'واجهة المتجر',
  },
  {
    key: 'pos_catalog_strip',
    labelAr: 'شريط الكتالوجات للانتقال السريع',
    descriptionAr: 'أزرار التصنيفات السريعة والهدايا المجانية أعلى الخدمات',
    categoryAr: 'واجهة المتجر',
  },
  {
    key: 'pos_tier_explainer',
    labelAr: 'بطاقة توضيح تسعيرة الرتبة',
    descriptionAr: 'البطاقة التوضيحية الخاصة بعرض أسعار الخدمات حسب رتبة حسابك',
    categoryAr: 'واجهة المتجر',
  },
];

export const APPEARANCE_ELEMENTS_BY_PORTAL: Record<
  AppearancePortalRole,
  readonly AppearanceElementDefinition[]
> = {
  super_admin: ADMIN_APPEARANCE_ELEMENTS,
  supplier: SUPPLIER_APPEARANCE_ELEMENTS,
  pos_client: POS_APPEARANCE_ELEMENTS,
};

export const PORTAL_APPEARANCE_TITLE_AR: Record<AppearancePortalRole, string> = {
  super_admin: 'مظهر صفحة مدير التطبيق',
  supplier: 'مظهر صفحة التاجر / المتجر',
  pos_client: 'مظهر صفحة العميل / نقطة البيع',
};

export function createDefaultAppearanceSettings(): PageAppearanceSettings {
  return {
    hiddenElements: {},
    compactMode: false,
  };
}

export function normalizeAppearanceSettings(
  raw: unknown
): PageAppearanceSettings {
  if (!raw || typeof raw !== 'object') {
    return createDefaultAppearanceSettings();
  }
  const obj = raw as Record<string, unknown>;
  const rawHidden = obj.hiddenElements;
  const hiddenElements: Record<string, boolean> = {};
  if (rawHidden && typeof rawHidden === 'object' && !Array.isArray(rawHidden)) {
    for (const [k, v] of Object.entries(rawHidden as Record<string, unknown>)) {
      if (v === true && typeof k === 'string' && k.trim()) {
        hiddenElements[k] = true;
      }
    }
  }
  return {
    hiddenElements,
    compactMode: obj.compactMode === true,
    ...(typeof obj.updatedAt === 'string' && obj.updatedAt.trim()
      ? { updatedAt: obj.updatedAt }
      : {}),
  };
}

export function getAppearanceElementsForPortal(
  portal: AppearancePortalRole
): readonly AppearanceElementDefinition[] {
  return APPEARANCE_ELEMENTS_BY_PORTAL[portal] || [];
}

export function isPageElementVisible(
  settings: PageAppearanceSettings | null | undefined,
  elementKey: string
): boolean {
  if (!settings || !settings.hiddenElements) return true;
  return settings.hiddenElements[elementKey] !== true;
}

export function togglePageElementVisibility(
  settings: PageAppearanceSettings | null | undefined,
  elementKey: string,
  nowIso: string = new Date().toISOString()
): PageAppearanceSettings {
  const normalized = normalizeAppearanceSettings(settings);
  const nextHidden = { ...normalized.hiddenElements };
  if (nextHidden[elementKey] === true) {
    delete nextHidden[elementKey];
  } else {
    nextHidden[elementKey] = true;
  }
  return {
    ...normalized,
    hiddenElements: nextHidden,
    updatedAt: nowIso,
  };
}

export function setPageElementVisibility(
  settings: PageAppearanceSettings | null | undefined,
  elementKey: string,
  visible: boolean,
  nowIso: string = new Date().toISOString()
): PageAppearanceSettings {
  const normalized = normalizeAppearanceSettings(settings);
  const nextHidden = { ...normalized.hiddenElements };
  if (visible) {
    delete nextHidden[elementKey];
  } else {
    nextHidden[elementKey] = true;
  }
  return {
    ...normalized,
    hiddenElements: nextHidden,
    updatedAt: nowIso,
  };
}

export function setAllPageElementsVisibility(
  portal: AppearancePortalRole,
  visible: boolean,
  current?: PageAppearanceSettings | null,
  nowIso: string = new Date().toISOString()
): PageAppearanceSettings {
  const normalized = normalizeAppearanceSettings(current);
  if (visible) {
    return {
      hiddenElements: {},
      compactMode: normalized.compactMode,
      updatedAt: nowIso,
    };
  }
  const nextHidden: Record<string, boolean> = {};
  for (const item of getAppearanceElementsForPortal(portal)) {
    nextHidden[item.key] = true;
  }
  return {
    hiddenElements: nextHidden,
    compactMode: normalized.compactMode,
    updatedAt: nowIso,
  };
}

export function setAppearanceCompactMode(
  settings: PageAppearanceSettings | null | undefined,
  compactMode: boolean,
  nowIso: string = new Date().toISOString()
): PageAppearanceSettings {
  const normalized = normalizeAppearanceSettings(settings);
  return {
    ...normalized,
    compactMode,
    updatedAt: nowIso,
  };
}

export function resetPageAppearanceSettings(
  nowIso: string = new Date().toISOString()
): PageAppearanceSettings {
  return {
    hiddenElements: {},
    compactMode: false,
    updatedAt: nowIso,
  };
}

export function getAppearanceVisibilitySummary(
  portal: AppearancePortalRole,
  settings?: PageAppearanceSettings | null
): { total: number; visible: number; hidden: number } {
  const defs = getAppearanceElementsForPortal(portal);
  const total = defs.length;
  let visible = 0;
  for (const def of defs) {
    if (isPageElementVisible(settings, def.key)) {
      visible += 1;
    }
  }
  return {
    total,
    visible,
    hidden: Math.max(0, total - visible),
  };
}
