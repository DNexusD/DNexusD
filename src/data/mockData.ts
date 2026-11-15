import { 
  Supplier, 
  POSClient, 
  Catalog, 
  DigitalService, 
  DepositRequest, 
  Order, 
  SuperAdmin, 
  AccountingEntry, 
  AdminAccountingEntry,
  InviteLink,
  AppNotification,
  SupplierBankAccount
} from '../types';

export const initialSuppliers: Supplier[] = [
  {
    id: 'sup-jamal-01',
    name: 'جمال الصالحي',
    storeName: 'مؤسسة جمال للحلول والخدمات الرقمية',
    phone: '+966 50 123 4567',
    email: 'jamal.digital@supplier.sa',
    feePercentage: 1.0, // 1% commission
    fixedFeeAmount: 0.0,
    feeType: 'percentage',
    walletBalance: 84500.0,
    bankAccountDetails: {
      bankName: 'مصرف الراجحي',
      accountHolder: 'مؤسسة جمال للحلول الرقمية',
      iban: 'SA4480000123608010123456',
      accountNumber: '123608010123456'
    },
    createdAt: '2025-01-15',
    employees: [
      {
        id: 'emp-jamal-01',
        supplierId: 'sup-jamal-01',
        name: 'أحمد السعيد',
        email: 'ahmed.emp@supplier.sa',
        password: '123456',
        phone: '+966 55 111 2233',
        roleTitle: 'مسؤول شحن الأيدي والدعم',
        permissions: {
          canManageOrders: true,
          canManageCatalogs: false,
          canManageClients: true,
          canReviewDeposits: false
        },
        createdAt: '2025-02-01'
      }
    ]
  },
  {
    id: 'sup-tariq-02',
    name: 'طارق الحربي',
    storeName: 'مجموعة المدى لتوزيع البطاقات',
    phone: '+966 54 887 6655',
    email: 'tariq@mada-cards.com',
    feePercentage: 1.5,
    fixedFeeAmount: 0.50,
    feeType: 'both',
    walletBalance: 32000.0,
    bankAccountDetails: {
      bankName: 'البنك الأهلي السعودي (SNB)',
      accountHolder: 'مجموعة المدى الرقمية',
      iban: 'SA0310000009876543210123',
      accountNumber: '9876543210123'
    },
    createdAt: '2025-03-20'
  }
];

export const initialSupplier = initialSuppliers[0];

export const initialSupplierBankAccounts: SupplierBankAccount[] = [
  {
    id: 'bank-jamal-01',
    supplierId: 'sup-jamal-01',
    bankName: 'مصرف الراجحي',
    accountNumber: '123608010123456',
    iban: 'SA4480000123608010123456',
    country: 'المملكة العربية السعودية',
    accountHolderName: 'مؤسسة جمال للحلول الرقمية',
    accountHolderEmail: 'jamal.digital@supplier.sa',
    accountHolderPhone: '+966 50 123 4567',
    canReceiveSupplierTransfers: false,
    isPrimary: true,
    isActive: true,
    notes: 'الحساب البنكي الرئيسي للمتجر لاستلام إيداعات شحن المحافظ',
    createdAt: '2025-01-15'
  },
  {
    id: 'bank-jamal-02',
    supplierId: 'sup-jamal-01',
    bankName: 'البنك الأهلي السعودي (SNB)',
    accountNumber: '445566778899001',
    iban: 'SA031000000445566778899001',
    country: 'المملكة العربية السعودية',
    accountHolderName: 'مؤسسة جمال للحلول الرقمية',
    accountHolderEmail: 'jamal.digital@supplier.sa',
    accountHolderPhone: '+966 50 123 4567',
    canReceiveSupplierTransfers: false,
    isPrimary: false,
    isActive: true,
    notes: 'حساب بنكي معتمد ومخوّل لدى المتجر لاستقبال الحوالات السريعة',
    createdAt: '2025-02-10'
  },
  {
    id: 'bank-jamal-03',
    supplierId: 'sup-jamal-01',
    bankName: 'بنك الكريمي الدولي',
    accountNumber: '30099112233',
    iban: 'YE88000030099112233',
    country: 'اليمن',
    accountHolderName: 'ديجيتال ستار للاتصالات',
    accountHolderEmail: 'contact@digitalstar.com',
    accountHolderPhone: '+967 77 123 4567',
    delegatedPosId: 'pos-2',
    delegatedPosName: 'ديجيتال ستار للاتصالات',
    delegatedPosCode: 'JED-88201',
    canReceiveSupplierTransfers: true,
    isPrimary: false,
    isActive: true,
    notes: 'حساب مخوّل لنقطة بيع ديجيتال ستار لاستلام وتأكيد حوالات العملاء باليمن',
    createdAt: '2025-03-01'
  },
  {
    id: 'bank-jamal-04',
    supplierId: 'sup-jamal-01',
    bankName: 'مصرف الإنماء',
    accountNumber: '200889911223344',
    iban: 'SA550500000200889911223344',
    country: 'المملكة العربية السعودية',
    accountHolderName: 'مؤسسة جمال للحلول الرقمية',
    accountHolderEmail: 'jamal.digital@supplier.sa',
    accountHolderPhone: '+966 50 123 4567',
    canReceiveSupplierTransfers: false,
    isPrimary: false,
    isActive: true,
    notes: 'حساب معتمد ومخوّل للمتجر لاستقبال حوالات شحن الرصيد',
    createdAt: '2025-03-15'
  },
  {
    id: 'bank-tariq-01',
    supplierId: 'sup-tariq-02',
    bankName: 'البنك الأهلي السعودي (SNB)',
    accountNumber: '9876543210123',
    iban: 'SA0310000009876543210123',
    country: 'المملكة العربية السعودية',
    accountHolderName: 'مجموعة المدى الرقمية',
    accountHolderEmail: 'tariq@mada-cards.com',
    accountHolderPhone: '+966 54 887 6655',
    canReceiveSupplierTransfers: false,
    isPrimary: true,
    isActive: true,
    notes: 'الحساب البنكي الرئيسي لمجموعة المدى',
    createdAt: '2025-03-20'
  },
  {
    id: 'bank-tariq-02',
    supplierId: 'sup-tariq-02',
    bankName: 'بنك الرياض',
    accountNumber: '7766554433221',
    iban: 'SA2020000007766554433221',
    country: 'المملكة العربية السعودية',
    accountHolderName: 'مجموعة المدى الرقمية',
    accountHolderEmail: 'tariq@mada-cards.com',
    accountHolderPhone: '+966 54 887 6655',
    canReceiveSupplierTransfers: false,
    isPrimary: false,
    isActive: true,
    notes: 'حساب معتمد ومخوّل لاستلام حوالات العملاء',
    createdAt: '2025-04-05'
  }
];

export const initialSuperAdmin: SuperAdmin = {
  name: 'الإدارة العامة للمنصة',
  email: 'admin@digipos-platform.com',
  walletBalance: 12450.75, // platform commission fees gathered
  defaultFeePercentage: 1.0,
  defaultFixedFeeAmount: 0.0,
  defaultFeeType: 'percentage',
  bankAccounts: [
    {
      bankName: 'البنك الأهلي السعودي (SNB)',
      iban: 'SA0310000001234567890123',
      accountHolder: 'شركة المنصة الرقمية المحدودة'
    }
  ]
};

export const initialPosClients: POSClient[] = [
  {
    id: 'pos-1',
    posCode: 'RYD-10492',
    tradeName: 'مركز الأمل للخدمات الرقمية',
    ownerName: 'محمد العتيبي',
    phone: '+966 55 987 6543',
    servicePhone: '+966 55 987 6544',
    email: 'pos.alamal@digipos.sa',
    logoUrl: '',
    country: 'المملكة العربية السعودية',
    city: 'الرياض',
    supplierId: 'sup-jamal-01',
    tier: 'vip', // مميز - 60 ر.س للخدمة
    walletBalance: 3450.0,
    totalSpent: 48920.0,
    ordersCount: 312,
    createdAt: '2025-02-01',
    qrCodeValue: 'POS:RYD-10492|NAME:Al-Amal Digital|SUP:sup-jamal-01'
  },
  {
    id: 'pos-2',
    posCode: 'JED-28314',
    tradeName: 'ديجيتال ستار للاتصالات',
    ownerName: 'أحمد العمودي',
    phone: '+966 54 112 2334',
    servicePhone: '+966 54 112 2335',
    email: 'contact@digitalstar.com',
    logoUrl: '',
    country: 'المملكة العربية السعودية',
    city: 'جدة',
    supplierId: 'sup-jamal-01',
    tier: 'gold', // ذهبي - 70 ر.س للخدمة
    walletBalance: 1820.0,
    totalSpent: 26400.0,
    ordersCount: 168,
    createdAt: '2025-02-15',
    qrCodeValue: 'POS:JED-28314|NAME:Digital Star|SUP:sup-jamal-01'
  },
  {
    id: 'pos-3',
    posCode: 'DAM-59123',
    tradeName: 'نقطة بيع الفرسان للإلكترونيات',
    ownerName: 'خالد الدوسري',
    phone: '+966 56 334 4556',
    servicePhone: '+966 56 334 4557',
    email: 'fursan.pos@digipos.sa',
    logoUrl: '',
    country: 'المملكة العربية السعودية',
    city: 'الدمام',
    supplierId: 'sup-jamal-01',
    tier: 'regular', // عادي - 100 ر.س للخدمة
    walletBalance: 650.0,
    totalSpent: 4200.0,
    ordersCount: 34,
    createdAt: '2025-04-10',
    qrCodeValue: 'POS:DAM-59123|NAME:Al-Fursan POS|SUP:sup-jamal-01'
  },
  {
    id: 'pos-4',
    posCode: 'MAK-48190',
    tradeName: 'متجر سارة للبطاقات الذكية',
    ownerName: 'سارة الزهراني',
    phone: '+966 53 778 8990',
    servicePhone: '+966 53 778 8991',
    email: 'sarah.cards@digipos.sa',
    logoUrl: '',
    country: 'المملكة العربية السعودية',
    city: 'مكة المكرمة',
    supplierId: 'sup-jamal-01',
    tier: 'silver', // فضي - 80 ر.س للخدمة
    walletBalance: 2100.0,
    totalSpent: 18900.0,
    ordersCount: 115,
    createdAt: '2025-03-05',
    qrCodeValue: 'POS:MAK-48190|NAME:Sarah Smart Cards|SUP:sup-jamal-01'
  }
];

export const initialCatalogs: Catalog[] = [
  {
    id: 'cat-games',
    supplierId: 'sup-jamal-01',
    nameAr: 'شحن الألعاب الإلكترونية',
    descriptionAr: 'شحن فوري مباشر عبر الأيدي أو كود القسائم لأقوى الألعاب العالمية',
    icon: 'Gamepad2',
    serviceCount: 4
  },
  {
    id: 'cat-cards',
    supplierId: 'sup-jamal-01',
    nameAr: 'بطاقات الهدايا والمتاجر',
    descriptionAr: 'بطاقات بلايستيشن، إكسبوكس، أبل ستور، وجوجل بلاي بأكواد فورية',
    icon: 'CreditCard',
    serviceCount: 3
  },
  {
    id: 'cat-stream',
    supplierId: 'sup-jamal-01',
    nameAr: 'اشتراكات البث والترفيه',
    descriptionAr: 'حسابات وتفعيل اشتراكات منصات البث الموسيقي والمرئي العالمية',
    icon: 'Tv',
    serviceCount: 2
  },
  {
    id: 'cat-apps',
    supplierId: 'sup-jamal-01',
    nameAr: 'برامج وتطبيقات السوشيال ميديا',
    descriptionAr: 'تليجرام بريميوم، ديسكورد نيترو، وسيرفرات الذكاء الاصطناعي',
    icon: 'Sparkles',
    serviceCount: 2
  },
  {
    id: 'cat-free-gifts',
    supplierId: 'sup-jamal-01',
    nameAr: 'كتالوج الهدايا المجانية',
    descriptionAr: 'هدايا وعروض مجانية حصرية للعملاء الممنوحين ميزة الهدايا المجانية (سعر 0 ر.س + رسوم التطبيق بالنسبة المحددة من مدير التطبيق من سعر الرتبة الأصلي)',
    icon: 'Gift',
    serviceCount: 1,
    isFreeGiftsCatalog: true
  }
];

export const initialServices: DigitalService[] = [
  {
    id: 'srv-pubg',
    catalogId: 'cat-games',
    supplierId: 'sup-jamal-01',
    nameAr: 'شحن شدات ببجي موبايل (PUBG UC)',
    descriptionAr: 'شحن فوري فائق السرعة عبر الآيدي، أو عبر حساب اللعبة مع التحقق المزدوج، أو تسليم كود قسيمة.',
    icon: 'Flame',
    isActive: true,
    deliveryMethods: ['player_id', 'account_login', 'voucher_code'],
    packages: [
      {
        id: 'pkg-pubg-660',
        name: 'باقة 660 شدة UC (الأساسية)',
        description: 'الباقة الأكثر طلباً للموسم والرويال باس',
        tierPrices: {
          regular: 100, // عادي: 100 ر.س
          bronze: 90,   // نحاسي: 90 ر.س
          silver: 80,   // فضي: 80 ر.س
          gold: 70,     // ذهبي: 70 ر.س
          vip: 60       // مميز: 60 ر.س
        },
        availableStock: 250,
        vouchers: [
          'PUBG-UC660-8839-4412-XA91',
          'PUBG-UC660-1928-7731-KJ82',
          'PUBG-UC660-9921-5541-ZZ10',
          'PUBG-UC660-3341-8890-QQ44'
        ]
      },
      {
        id: 'pkg-pubg-325',
        name: 'باقة 325 شدة UC',
        description: 'شحن سريع لتفعيل الإضافات الخفيفة',
        tierPrices: {
          regular: 55,
          bronze: 50,
          silver: 45,
          gold: 40,
          vip: 35
        },
        availableStock: 120,
        vouchers: [
          'PUBG-UC325-1049-9941-CC20',
          'PUBG-UC325-8831-2210-VV77'
        ]
      },
      {
        id: 'pkg-pubg-1800',
        name: 'باقة 1800 شدة UC (باقة المحترفين)',
        description: 'شحن مميز لصناديق الأسلحة المطورة',
        tierPrices: {
          regular: 260,
          bronze: 240,
          silver: 220,
          gold: 200,
          vip: 175
        },
        availableStock: 45,
        vouchers: [
          'PUBG-UC1800-4491-0029-TT88',
          'PUBG-UC1800-9912-3345-PP11'
        ]
      }
    ]
  },
  {
    id: 'srv-freefire',
    catalogId: 'cat-games',
    supplierId: 'sup-jamal-01',
    nameAr: 'شحن جواهر فري فاير (Free Fire)',
    descriptionAr: 'شحن مباشر وفوري عبر معرف اللاعب (Player ID) أو عبر كود قسيمة غارينا.',
    icon: 'Zap',
    isActive: true,
    deliveryMethods: ['player_id', 'voucher_code'],
    packages: [
      {
        id: 'pkg-ff-530',
        name: '530 جوهرة + 53 جوهرة بونص',
        tierPrices: {
          regular: 85,
          bronze: 78,
          silver: 70,
          gold: 63,
          vip: 55
        },
        availableStock: 80,
        vouchers: [
          'GARENA-FF530-5582-9910-XX21',
          'GARENA-FF530-1092-4431-BB99'
        ]
      },
      {
        id: 'pkg-ff-1080',
        name: '1080 جوهرة + 108 جوهرة بونص',
        tierPrices: {
          regular: 165,
          bronze: 152,
          silver: 140,
          gold: 125,
          vip: 110
        },
        availableStock: 60,
        vouchers: [
          'GARENA-FF1080-8841-2290-AA33'
        ]
      }
    ]
  },
  {
    id: 'srv-playstation',
    catalogId: 'cat-cards',
    supplierId: 'sup-jamal-01',
    nameAr: 'بطاقات بلايستيشن ستور السعودي (PSN SA)',
    descriptionAr: 'أكواد رقمية أصلية فورية لحسابات البلايستيشن ستور السعودي الرسمية.',
    icon: 'Disc',
    isActive: true,
    deliveryMethods: ['voucher_code'],
    packages: [
      {
        id: 'pkg-psn-20usd',
        name: 'بطاقة 20$ ستور سعودي',
        description: 'رصيد محفظة بلايستيشن فوري',
        tierPrices: {
          regular: 82,
          bronze: 77,
          silver: 73,
          gold: 69,
          vip: 64
        },
        availableStock: 35,
        vouchers: [
          '4R8K-99M2-LP7X',
          '2A5N-88PQ-11CZ',
          '9K3L-00TX-77WD'
        ]
      },
      {
        id: 'pkg-psn-50usd',
        name: 'بطاقة 50$ ستور سعودي',
        description: 'رصيد محفظة بلايستيشن للألعاب الكبيرة',
        tierPrices: {
          regular: 205,
          bronze: 195,
          silver: 185,
          gold: 175,
          vip: 162
        },
        availableStock: 20,
        vouchers: [
          '6Y1P-44KJ-88QR',
          '3B9X-55TM-22LK'
        ]
      }
    ]
  },
  {
    id: 'srv-telegram',
    catalogId: 'cat-apps',
    supplierId: 'sup-jamal-01',
    nameAr: 'اشتراك تيليجرام بريميوم (Telegram Premium)',
    descriptionAr: 'تفعيل فوري عبر يوزر الحساب أو إيميل الحساب مع إشعارات التحقق.',
    icon: 'Send',
    isActive: true,
    deliveryMethods: ['account_login', 'player_id'],
    packages: [
      {
        id: 'pkg-tg-3m',
        name: 'اشتراك 3 أشهر رسمي',
        tierPrices: {
          regular: 75,
          bronze: 70,
          silver: 65,
          gold: 60,
          vip: 52
        },
        availableStock: 99
      },
      {
        id: 'pkg-tg-1y',
        name: 'اشتراك سنة كاملة (12 شهر)',
        tierPrices: {
          regular: 180,
          bronze: 168,
          silver: 156,
          gold: 144,
          vip: 128
        },
        availableStock: 99
      }
    ]
  },
  {
    id: 'srv-gift-pubg-60',
    catalogId: 'cat-free-gifts',
    supplierId: 'sup-jamal-01',
    nameAr: 'هدية شحن 60 شدة ببجي (عرض مجاني)',
    descriptionAr: 'خدمة ضمن كتالوج الهدايا المجانية: تُصرف للعميل الذي يملك ميزة الهدايا المجانية بسعر 0 ر.س وتُحتسب رسوم التطبيق بالنسبة المحددة من مدير التطبيق من السعر الأصلي الخاص برتبته.',
    icon: 'Gift',
    isActive: true,
    deliveryMethods: ['player_id', 'voucher_code'],
    packages: [
      {
        id: 'pkg-gift-pubg-60',
        name: 'باقة الهدية الحصرية (60 شدة)',
        description: 'السعر الأصلي للرتب: عادي 100 · نحاسي 90 · فضي 80 · ذهبي 70 · مميز 60 (مشمولة بسعر 0 ر.س في الهدايا المجانية)',
        tierPrices: {
          regular: 100,
          bronze: 90,
          silver: 80,
          gold: 70,
          vip: 60
        },
        availableStock: 100
      }
    ]
  }
];

export const initialDepositRequests: DepositRequest[] = [
  {
    id: 'dep-101',
    posId: 'pos-1',
    posName: 'مركز الأمل للخدمات الرقمية',
    posCode: 'RYD-10492',
    supplierId: 'sup-jamal-01',
    amount: 5000,
    transferNumber: 'TRX-99482014',
    transferSenderName: 'محمد مبارك العتيبي',
    bankName: 'مصرف الراجحي',
    date: '2026-11-05 14:30',
    status: 'approved',
    notes: 'تمت مطابقة الحوالة وإيداع الرصيد بنجاح',
    requestType: 'cash',
    loanRepaidStatus: 'repaid'
  },
  {
    id: 'dep-102',
    posId: 'pos-2',
    posName: 'ديجيتال ستار للاتصالات',
    posCode: 'JED-28314',
    supplierId: 'sup-jamal-01',
    amount: 3000,
    transferNumber: 'TRX-77401928',
    transferSenderName: 'أحمد سالم العمودي',
    bankName: 'البنك الأهلي السعودي',
    date: '2026-11-06 09:15',
    status: 'pending',
    notes: 'بانتظار تأكيد إشعار البنك',
    requestType: 'cash'
  },
  {
    id: 'dep-103',
    posId: 'pos-3',
    posName: 'نقطة بيع الفرسان للإلكترونيات',
    posCode: 'DAM-59123',
    supplierId: 'sup-jamal-01',
    amount: 1500,
    transferNumber: 'TRX-55192834',
    transferSenderName: 'خالد عبدالله الدوسري',
    bankName: 'بنك الرياض',
    date: '2026-11-06 11:45',
    status: 'pending',
    notes: 'طلب إيداع مسبق للمحفظة',
    requestType: 'cash'
  },
  {
    id: 'dep-loan-104',
    posId: 'pos-1',
    posName: 'مركز الأمل للخدمات الرقمية',
    posCode: 'RYD-10492',
    supplierId: 'sup-jamal-01',
    amount: 2000,
    transferNumber: 'LOAN-ADVANCE-8812',
    transferSenderName: 'طلب سلفة رصيد آجل',
    bankName: 'سلفة / رصيد آجل (بدون إيصال بنكي)',
    date: '2026-11-08 16:20',
    status: 'approved',
    notes: 'طلب سلفة رصيد آجل معتمدة من المتجر جمال الصالحي',
    requestType: 'loan',
    loanReason: 'تغطية مبيعات ليلية عاجلة لباقات ببجي وتيليجرام',
    loanRepaidStatus: 'unpaid'
  },
  {
    id: 'dep-loan-105',
    posId: 'pos-2',
    posName: 'ديجيتال ستار للاتصالات',
    posCode: 'JED-28314',
    supplierId: 'sup-jamal-01',
    amount: 1000,
    transferNumber: 'LOAN-ADVANCE-9941',
    transferSenderName: 'طلب سلفة رصيد آجل',
    bankName: 'سلفة / رصيد آجل (بدون إيصال بنكي)',
    date: '2026-11-09 02:10',
    status: 'pending',
    notes: 'طلب سلفة جديد بانتظار موافقة المتجر بدون إيصال بنكي',
    requestType: 'loan',
    loanReason: 'شحن رصيد آجل عاجل للزبائن لإنهاء مبيعات نهاية الأسبوع',
    loanRepaidStatus: 'unpaid'
  }
];

export const initialOrders: Order[] = [
  {
    id: 'ord-8801',
    date: '2026-11-06 12:20',
    posId: 'pos-1',
    posCode: 'RYD-10492',
    posName: 'مركز الأمل للخدمات الرقمية',
    supplierId: 'sup-jamal-01',
    serviceId: 'srv-pubg',
    serviceName: 'شحن شدات ببجي موبايل (PUBG UC)',
    packageId: 'pkg-pubg-660',
    packageName: 'باقة 660 شدة UC (الأساسية)',
    deliveryMethod: 'player_id',
    deliveryDetails: {
      playerId: '5129480192',
      playerNickname: 'Falcon_King99'
    },
    costPrice: 60, // VIP tier price
    salePriceToCustomer: 75,
    feeAmount: 0.60, // 1% admin fee
    totalDeducted: 60.60,
    paymentMethod: 'wallet',
    status: 'completed',
    customerName: 'فهد الشمري',
    customerPhone: '+966 50 445 5667'
  },
  {
    id: 'ord-8802',
    date: '2026-11-06 11:05',
    posId: 'pos-2',
    posCode: 'JED-28314',
    posName: 'ديجيتال ستار للاتصالات',
    supplierId: 'sup-jamal-01',
    serviceId: 'srv-playstation',
    serviceName: 'بطاقات بلايستيشن ستور السعودي (PSN SA)',
    packageId: 'pkg-psn-20usd',
    packageName: 'بطاقة 20$ ستور سعودي',
    deliveryMethod: 'voucher_code',
    deliveryDetails: {
      voucherCode: '4R8K-99M2-LP7X'
    },
    costPrice: 69, // Gold tier price
    salePriceToCustomer: 85,
    feeAmount: 0.69,
    totalDeducted: 69.69,
    paymentMethod: 'wallet',
    status: 'completed',
    customerName: 'عبدالرحمن الشهري',
    customerPhone: '+966 55 667 7889'
  },
  {
    id: 'ord-8803',
    date: '2026-11-06 13:40',
    posId: 'pos-3',
    posCode: 'DAM-59123',
    posName: 'نقطة بيع الفرسان للإلكترونيات',
    supplierId: 'sup-jamal-01',
    serviceId: 'srv-telegram',
    serviceName: 'اشتراك تيليجرام بريميوم (Telegram Premium)',
    packageId: 'pkg-tg-3m',
    packageName: 'اشتراك 3 أشهر رسمي',
    deliveryMethod: 'account_login',
    deliveryDetails: {
      accountEmail: 'client.vip@t-mail.com',
      accountPassword: 'VipClient@2026',
      verificationCodeEntered: '884910'
    },
    costPrice: 75,
    feeAmount: 0.75,
    totalDeducted: 75.75,
    paymentMethod: 'wallet',
    status: 'pending_supplier', // Needs supplier fulfillment!
    supplierNotes: 'بانتظار تفعيل المتجر المباشر للاشتراك على السيرفر',
    customerName: 'تركي العازمي'
  },
  {
    id: 'ord-8804',
    date: '2026-11-06 14:15',
    posId: 'pos-1',
    posCode: 'RYD-10492',
    posName: 'مركز الأمل للخدمات الرقمية',
    supplierId: 'sup-jamal-01',
    serviceId: 'srv-pubg',
    serviceName: 'شحن شدات ببجي موبايل (PUBG UC)',
    packageId: 'pkg-pubg-660',
    packageName: 'باقة 660 شدة UC (الأساسية)',
    deliveryMethod: 'player_id',
    deliveryDetails: {
      playerId: '5129480192',
      playerNickname: 'Falcon_King99 #0192',
      inGameChargeStatus: 'waiting_charge'
    },
    costPrice: 60,
    salePriceToCustomer: 75,
    feeAmount: 0.60,
    totalDeducted: 60.60,
    paymentMethod: 'wallet',
    status: 'pending_supplier', // Sent to the المتجر with ID to complete in game
    supplierNotes: 'طلب شحن جديد عبر الأيدي مرسل للمتجر للشحن المباشر من اللعبة',
    customerName: 'فهد الشمري',
    customerPhone: '+966 50 445 5667'
  }
];

export const initialAccountingEntries: AccountingEntry[] = [
  {
    id: 'acc-1',
    date: '2026-11-05 14:30',
    type: 'deposit',
    referenceId: 'dep-101',
    posId: 'pos-1',
    description: 'إيداع رصيد مسبق في المحفظة عبر حوالة الراجحي TRX-99482014',
    debit: 0,
    credit: 5000,
    balanceAfter: 5000
  },
  {
    id: 'acc-2',
    date: '2026-11-06 12:20',
    type: 'purchase',
    referenceId: 'ord-8801',
    posId: 'pos-1',
    description: 'شراء خدمة: باقة 660 شدة UC ببجي (آيدي: 5129480192) - رتبة مميز',
    debit: 60,
    credit: 0,
    balanceAfter: 4940,
    serviceName: 'شحن شدات ببجي موبايل',
    customerName: 'فهد الشمري'
  },
  {
    id: 'acc-3',
    date: '2026-11-06 12:20',
    type: 'fee',
    referenceId: 'ord-8801',
    posId: 'pos-1',
    description: 'رسوم منصة تطبيق 1% على عملية شراء باقة 660 شدة',
    debit: 0.60,
    credit: 0,
    balanceAfter: 4939.40
  },
  {
    id: 'acc-4',
    date: '2026-11-06 12:25',
    type: 'sale',
    referenceId: 'ord-8801',
    posId: 'pos-1',
    description: 'بيع للزبون فهد الشمري باقة 660 شدة بسعر تجزئة 75 ر.س (ربح: 14.40 ر.س)',
    debit: 0,
    credit: 75,
    balanceAfter: 5014.40,
    serviceName: 'شحن شدات ببجي موبايل',
    customerName: 'فهد الشمري'
  }
];

export const initialInviteLinks: InviteLink[] = [
  {
    id: 'inv-vip-01',
    code: 'JAMAL-VIP-JOIN',
    supplierId: 'sup-jamal-01',
    supplierName: 'جمال الصالحي',
    targetTier: 'vip',
    createdAt: '2026-11-01',
    usedCount: 3,
    url: 'https://digipos.app/register?ref=JAMAL-VIP-JOIN&tier=vip'
  },
  {
    id: 'inv-gold-02',
    code: 'JAMAL-GOLD-99',
    supplierId: 'sup-jamal-01',
    supplierName: 'جمال الصالحي',
    targetTier: 'gold',
    createdAt: '2026-11-03',
    usedCount: 7,
    url: 'https://digipos.app/register?ref=JAMAL-GOLD-99&tier=gold'
  }
];

export const initialAdminAccountingEntries: AdminAccountingEntry[] = [
  {
    id: 'adm-acc-01',
    date: '2026-11-05 10:15',
    type: 'fee_collected',
    referenceId: 'ord-8790',
    supplierId: 'sup-jamal-01',
    supplierName: 'جمال الصالحي (مؤسسة جمال للحلول الرقمية)',
    serviceId: 'srv-pubg',
    serviceName: 'شحن شدات ببجي موبايل (PUBG UC)',
    posId: 'pos-1',
    posCode: 'RYD-10492',
    posName: 'مركز الأمل للخدمات الرقمية',
    description: 'تحصيل رسوم منصة 1% على عملية شراء باقة شدات ببجي 1800 UC',
    grossAmount: 175.0,
    feeAmount: 1.75,
    debit: 0,
    credit: 1.75,
    balanceAfter: 12950.75,
    notes: 'تم استقطاع الرسوم آلياً وإضافتها لمحفظة الإدارة'
  },
  {
    id: 'adm-acc-02',
    date: '2026-11-05 14:35',
    type: 'deposit_received',
    referenceId: 'dep-101',
    supplierId: 'sup-jamal-01',
    supplierName: 'جمال الصالحي (مؤسسة جمال للحلول الرقمية)',
    posId: 'pos-1',
    posCode: 'RYD-10492',
    posName: 'مركز الأمل للخدمات الرقمية',
    description: 'إشعار شحن رصيد مسبق للمتجر جمال الصالحي بمبلغ 5,000.00 ر.س (حوالة TRX-99482014)',
    grossAmount: 5000.0,
    feeAmount: 0,
    debit: 0,
    credit: 0,
    balanceAfter: 12950.75,
    notes: 'عملية إيداع رصيد مسبق تم اعتمادها بين نقطة البيع والمتجر'
  },
  {
    id: 'adm-acc-03',
    date: '2026-11-05 16:40',
    type: 'bank_settlement',
    referenceId: 'adm-stl-4401',
    supplierId: 'sup-jamal-01',
    supplierName: 'جمال الصالحي (مؤسسة جمال للحلول الرقمية)',
    description: 'تسوية رصيد وتحويل بنكي من محفظة مدير التطبيق إلى الحساب البنكي للإدارة (SA4480000123608010123456)',
    grossAmount: 500.0,
    feeAmount: 0,
    debit: 500.0,
    credit: 0,
    balanceAfter: 12450.75,
    notes: 'تم الخصم من محفظة رسوم التطبيق وتأكيد استلام قيمته من الحساب البنكي للمتجر'
  },
  {
    id: 'adm-acc-04',
    date: '2026-11-06 11:05',
    type: 'fee_collected',
    referenceId: 'ord-8802',
    supplierId: 'sup-jamal-01',
    supplierName: 'جمال الصالحي (مؤسسة جمال للحلول الرقمية)',
    serviceId: 'srv-psn',
    serviceName: 'بطاقات بلايستيشن ستور السعودي (PSN SA)',
    posId: 'pos-2',
    posCode: 'JED-88201',
    posName: 'ديجيتال ستار للاتصالات',
    description: 'تحصيل رسوم منصة 1% على شراء بطاقة 20$ ستور سعودي (كود فوري)',
    grossAmount: 69.0,
    feeAmount: 0.69,
    debit: 0,
    credit: 0.69,
    balanceAfter: 12451.44,
    notes: 'تم خصم الرسوم بنجاح من محفظة نقطة البيع'
  },
  {
    id: 'adm-acc-05',
    date: '2026-11-06 12:20',
    type: 'fee_collected',
    referenceId: 'ord-8801',
    supplierId: 'sup-jamal-01',
    supplierName: 'جمال الصالحي (مؤسسة جمال للحلول الرقمية)',
    serviceId: 'srv-pubg',
    serviceName: 'شحن شدات ببجي موبايل (PUBG UC)',
    posId: 'pos-1',
    posCode: 'RYD-10492',
    posName: 'مركز الأمل للخدمات الرقمية',
    description: 'تحصيل رسوم منصة 1% على شراء باقة 660 شدة UC ببجي (آيدي: 5129480192)',
    grossAmount: 60.0,
    feeAmount: 0.60,
    debit: 0,
    credit: 0.60,
    balanceAfter: 12452.04,
    notes: 'تم الشحن من اللعبة بواسطة المتجر'
  },
  {
    id: 'adm-acc-06',
    date: '2026-11-06 13:10',
    type: 'fee_collected',
    referenceId: 'trf-491022',
    supplierId: 'sup-jamal-01',
    supplierName: 'جمال الصالحي (مؤسسة جمال للحلول الرقمية)',
    posId: 'pos-1',
    posCode: 'RYD-10492',
    posName: 'مركز الأمل للخدمات الرقمية',
    description: 'تحصيل رسوم منصة 1% على تحويل رصيد بقيمة 200 ر.س بين الوكلاء (RYD-10492 إلى DAM-59123)',
    grossAmount: 200.0,
    feeAmount: 2.00,
    debit: 0,
    credit: 2.00,
    balanceAfter: 12454.04,
    notes: 'رسوم تحويل رصيد عبر معرف الوكيل'
  },
  {
    id: 'adm-acc-07',
    date: '2026-11-06 14:15',
    type: 'fee_collected',
    referenceId: 'ord-8804',
    supplierId: 'sup-jamal-01',
    supplierName: 'جمال الصالحي (مؤسسة جمال للحلول الرقمية)',
    serviceId: 'srv-pubg',
    serviceName: 'شحن شدات ببجي موبايل (PUBG UC)',
    posId: 'pos-1',
    posCode: 'RYD-10492',
    posName: 'مركز الأمل للخدمات الرقمية',
    description: 'تحصيل رسوم منصة 1% على طلب شحن أيدي ببجي 660 شدة (مرسل للمتجر)',
    grossAmount: 60.0,
    feeAmount: 0.60,
    debit: 0,
    credit: 0.60,
    balanceAfter: 12454.64,
    notes: 'طلب شحن أيدي قيد التنفيذ لدى المتجر'
  },
  {
    id: 'adm-acc-08',
    date: '2026-11-06 14:45',
    type: 'deposit_received',
    referenceId: 'dep-102',
    supplierId: 'sup-jamal-01',
    supplierName: 'جمال الصالحي (مؤسسة جمال للحلول الرقمية)',
    posId: 'pos-2',
    posCode: 'JED-88201',
    posName: 'ديجيتال ستار للاتصالات',
    description: 'إشعار شحن رصيد مسبق للمتجر جمال الصالحي بمبلغ 2,500.00 ر.س (البنك الأهلي TRX-88319022)',
    grossAmount: 2500.0,
    feeAmount: 0,
    debit: 0,
    credit: 0,
    balanceAfter: 12454.64,
    notes: 'طلب إيداع رصيد مسبق معتمد'
  },
  {
    id: 'adm-acc-09',
    date: '2026-11-06 15:00',
    type: 'fee_collected',
    referenceId: 'ord-8820',
    supplierId: 'sup-tariq-02',
    supplierName: 'طارق الحربي (مجموعة المدى لتوزيع البطاقات)',
    serviceId: 'srv-ff',
    serviceName: 'شحن جواهر فري فاير (Free Fire)',
    posId: 'pos-3',
    posCode: 'DAM-59123',
    posName: 'نقطة بيع الفرسان للإلكترونيات',
    description: 'تحصيل رسوم مخصصة للمتجر طارق الحربي (1.5% + 0.50 ر.س) على شحن 530 جوهرة فري فاير',
    grossAmount: 60.0,
    feeAmount: 1.40,
    debit: 0,
    credit: 1.40,
    balanceAfter: 12456.04,
    notes: 'رسوم مخصصة لمتجر طارق الحربي'
  }
];

export const initialNotifications: AppNotification[] = [
  // Supplier Notifications
  {
    id: 'notif-sup-01',
    supplierId: 'sup-jamal-01',
    supplierName: 'مؤسسة جمال للحلول الرقمية',
    targetRole: 'supplier',
    posId: 'pos-1',
    posName: 'مركز الأمل',
    posCode: 'RYD-10492',
    title: 'طلب شحن أيدي جديد باللعبة (ببجي موبايل 660 UC) 🎮',
    message: 'أرسل العميل مركز الأمل (RYD-10492) طلب شحن للأيدي (512398711) بمبلغ 41.50 ر.س. يرجى الشحن من داخل اللعبة.',
    type: 'order_status',
    isRead: false,
    createdAt: '2026-11-14 09:15',
    orderId: 'ord-8801',
    amount: 41.5,
    actionTab: 'pending_orders',
  },
  {
    id: 'notif-sup-02',
    supplierId: 'sup-jamal-01',
    supplierName: 'مؤسسة جمال للحلول الرقمية',
    targetRole: 'supplier',
    posId: 'pos-2',
    posName: 'ديجيتال ستار',
    posCode: 'JED-28314',
    title: 'طلب إيداع بنكي جديد بانتظار المطابقة 🏦',
    message: 'أرسل العميل ديجيتال ستار طلب شحن رصيد بمبلغ 1200.00 ر.س عبر مصرف الراجحي (حوالة: TRX-99281740) مع صورة الإيصال المرفقة.',
    type: 'deposit',
    isRead: false,
    createdAt: '2026-11-14 08:30',
    depositId: 'dep-cash-1',
    amount: 1200,
    actionTab: 'deposits',
  },
  {
    id: 'notif-sup-03',
    supplierId: 'sup-jamal-01',
    supplierName: 'مؤسسة جمال للحلول الرقمية',
    targetRole: 'supplier',
    posId: 'pos-1',
    posName: 'مركز الأمل',
    posCode: 'RYD-10492',
    title: 'طلب سداد سلفة بحوالة بنكية 💳',
    message: 'أرسل العميل مركز الأمل طلب سداد سلفة #dep-loan-104 بمبلغ 1000.00 ر.س عبر الحساب البنكي المخوّل مع صورة الإيصال.',
    type: 'loan_repayment',
    isRead: false,
    createdAt: '2026-11-14 07:45',
    loanId: 'dep-loan-104',
    repaymentRequestId: 'lrep-101',
    amount: 1000,
    actionTab: 'loans',
  },
  {
    id: 'notif-sup-04',
    supplierId: 'sup-jamal-01',
    supplierName: 'مؤسسة جمال للحلول الرقمية',
    targetRole: 'supplier',
    posId: 'pos-2',
    posName: 'ديجيتال ستار',
    posCode: 'JED-28314',
    title: 'تأكيد استلام حوالة من نقطة البيع المخوّلة ✅',
    message: 'أكدت نقطة البيع المخوّلة (ديجيتال ستار) استلام الحوالة رقم TRX-111 بمبلغ 1200.00 ر.س على حساب بنك الكريمي.',
    type: 'receiver_confirmation',
    isRead: true,
    createdAt: '2026-11-13 16:20',
    depositId: 'dep-cash-1',
    amount: 1200,
    actionTab: 'deposits',
  },
  // Client Notifications
  {
    id: 'notif-01',
    posId: 'pos-1',
    supplierId: 'sup-jamal-01',
    supplierName: 'مؤسسة جمال للحلول الرقمية',
    targetRole: 'pos',
    title: 'تأكيد وشحن الأيدي بنجاح ✅',
    message: 'تم شحن طلب شدات ببجي موبايل (660 UC) للأيدي (512398711) بنجاح من المتجر.',
    type: 'order_status',
    isRead: false,
    createdAt: '2026-11-06 14:20',
    orderId: 'ord-8801'
  },
  {
    id: 'notif-02',
    posId: 'pos-1',
    supplierId: 'sup-jamal-01',
    supplierName: 'مؤسسة جمال للحلول الرقمية',
    targetRole: 'pos',
    title: 'ترقية رتبة متجرك ⭐',
    message: 'تهانينا! قام المتجر بترقية رتبة حسابك إلى الرتبة الذهبية (تخفيض تلقائي للأسعار 30%).',
    type: 'tier_upgrade',
    isRead: false,
    createdAt: '2026-11-05 10:15'
  },
  {
    id: 'notif-03',
    posId: 'pos-1',
    supplierId: 'sup-jamal-01',
    supplierName: 'مؤسسة جمال للحلول الرقمية',
    targetRole: 'pos',
    title: 'اعتماد وإيداع رصيد المحفظة 💰',
    message: 'تم تأكيد طلب الإيداع بمبلغ 500.00 ر.س وإضافته لرصيد محفظتك المتاح.',
    type: 'deposit',
    isRead: true,
    createdAt: '2026-11-04 18:30'
  },
  {
    id: 'notif-04',
    posId: 'pos-1',
    supplierId: 'sup-jamal-01',
    supplierName: 'مؤسسة جمال للحلول الرقمية',
    targetRole: 'pos',
    title: 'إشعار توفر أكواد وقسائم رقمية 📢',
    message: 'تم تحديث وتغذية أكواد القسائم الرقمية المباشرة لكروت بطاقات بلايستيشن وشاهد VIP.',
    type: 'announcement',
    isRead: true,
    createdAt: '2026-11-03 09:00'
  }
];

