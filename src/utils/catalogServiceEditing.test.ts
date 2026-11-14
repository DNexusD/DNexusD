import test from 'node:test';
import assert from 'node:assert/strict';
import { Catalog, DigitalService, ServicePackage } from '../types';

test('Catalog updating and validation', () => {
  const initialCatalog: Catalog = {
    id: 'cat-games',
    supplierId: 'sup-jamal-01',
    nameAr: 'ألعاب الفيديو',
    descriptionAr: 'شحن فوري لأشهر الألعاب',
    icon: 'Gamepad2',
    serviceCount: 2
  };

  const updates: Partial<Pick<Catalog, 'nameAr' | 'descriptionAr' | 'icon'>> = {
    nameAr: 'ألعاب الفيديو والرياضات الإلكترونية',
    descriptionAr: 'شحن رسمي معتمد ومباشر لجميع الألعاب',
    icon: 'Sparkles'
  };

  const updatedCatalog: Catalog = {
    ...initialCatalog,
    ...updates
  };

  assert.equal(updatedCatalog.nameAr, 'ألعاب الفيديو والرياضات الإلكترونية');
  assert.equal(updatedCatalog.descriptionAr, 'شحن رسمي معتمد ومباشر لجميع الألعاب');
  assert.equal(updatedCatalog.icon, 'Sparkles');
  assert.equal(updatedCatalog.id, 'cat-games');
});

test('Catalog deletion prevents deleting catalog with linked services', () => {
  const catalogs: Catalog[] = [
    { id: 'cat-1', supplierId: 's1', nameAr: 'قسم 1', descriptionAr: '', icon: 'Layers', serviceCount: 2 },
    { id: 'cat-empty', supplierId: 's1', nameAr: 'قسم فارغ', descriptionAr: '', icon: 'Layers', serviceCount: 0 }
  ];

  const services: DigitalService[] = [
    {
      id: 'srv-1',
      catalogId: 'cat-1',
      supplierId: 's1',
      nameAr: 'ببجي',
      descriptionAr: '',
      icon: 'Gamepad2',
      deliveryMethods: ['player_id'],
      packages: [],
      isActive: true
    }
  ];

  const tryDeleteCatalog = (catId: string): { canDelete: boolean; linkedCount: number } => {
    const linked = services.filter(s => s.catalogId === catId);
    return {
      canDelete: linked.length === 0,
      linkedCount: linked.length
    };
  };

  const res1 = tryDeleteCatalog('cat-1');
  assert.equal(res1.canDelete, false, 'Should not allow deleting catalog with linked services');
  assert.equal(res1.linkedCount, 1);

  const resEmpty = tryDeleteCatalog('cat-empty');
  assert.equal(resEmpty.canDelete, true, 'Should allow deleting empty catalog');
  assert.equal(resEmpty.linkedCount, 0);
});

test('Service updating and 5-tier pricing customization', () => {
  const initialService: DigitalService = {
    id: 'srv-pubg',
    catalogId: 'cat-games',
    supplierId: 'sup-jamal-01',
    nameAr: 'ببجي موبايل',
    descriptionAr: 'شحن عبر الأيدي',
    icon: 'Gamepad2',
    deliveryMethods: ['player_id'],
    isActive: true,
    packages: [
      {
        id: 'pkg-60',
        name: '60 شدة',
        tierPrices: {
          regular: 5,
          bronze: 4.5,
          silver: 4.2,
          gold: 4.0,
          vip: 3.8
        }
      }
    ]
  };

  // Modify service details & add a package
  const newPackage: ServicePackage = {
    id: 'pkg-325',
    name: '325 شدة',
    tierPrices: {
      regular: 25,
      bronze: 23,
      silver: 21,
      gold: 20,
      vip: 19
    }
  };

  const updatedPackages = [
    {
      ...initialService.packages[0],
      tierPrices: {
        ...initialService.packages[0].tierPrices,
        vip: 3.5 // updated VIP tier price
      }
    },
    newPackage
  ];

  const updatedService: DigitalService = {
    ...initialService,
    nameAr: 'ببجي موبايل (العالمية والكورية)',
    deliveryMethods: ['player_id', 'voucher_code'],
    packages: updatedPackages
  };

  assert.equal(updatedService.nameAr, 'ببجي موبايل (العالمية والكورية)');
  assert.equal(updatedService.deliveryMethods.length, 2);
  assert.equal(updatedService.packages.length, 2);
  assert.equal(updatedService.packages[0].tierPrices.vip, 3.5);
  assert.equal(updatedService.packages[1].name, '325 شدة');
  assert.equal(updatedService.packages[1].tierPrices.regular, 25);
  assert.equal(updatedService.packages[1].tierPrices.vip, 19);
});
