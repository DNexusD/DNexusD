import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveGameProfileFromPackage,
  validatePlayerIdFormat,
} from './gamePackageResolver.ts';

test('resolveGameProfileFromPackage prioritizes selected package over generic service/catalog', () => {
  const ffProfile = resolveGameProfileFromPackage({
    packageName: '520 جوهرة فري فاير',
    serviceName: 'شحن ألعاب منوع',
    catalogName: 'الألعاب الإلكترونية',
  });
  assert.equal(ffProfile.gameCode, 'free_fire');
  assert.equal(ffProfile.matchedBy, 'package');

  const pubgProfile = resolveGameProfileFromPackage({
    packageName: '660 شدة ببجي موبايل',
    serviceName: 'شحن ألعاب منوع',
    catalogName: 'الألعاب الإلكترونية',
  });
  assert.equal(pubgProfile.gameCode, 'pubg_mobile');
  assert.equal(pubgProfile.matchedBy, 'package');

  const unitProfile = resolveGameProfileFromPackage({
    packageName: '325 UC',
    serviceName: 'بطاقات شحن',
    catalogName: 'شحن فوري',
  });
  assert.equal(unitProfile.gameCode, 'pubg_mobile');
});

test('resolveGameProfileFromPackage disambiguates shared units like جوهرة via serviceName', () => {
  const mlbbProfile = resolveGameProfileFromPackage({
    packageName: '86 جوهرة',
    serviceName: 'شحن موبايل ليجيند (Mobile Legends)',
    catalogName: 'شحن الألعاب',
  });
  assert.equal(mlbbProfile.gameCode, 'mlbb');
  assert.equal(mlbbProfile.requiresZoneId, true);
  assert.equal(mlbbProfile.matchedBy, 'service');
});

test('validatePlayerIdFormat enforces per-game ID rules and Zone ID when required without any network lookup', () => {
  const pubg = resolveGameProfileFromPackage({ packageName: '60 شدة ببجي' });
  assert.equal(validatePlayerIdFormat('', pubg).valid, false);
  assert.equal(validatePlayerIdFormat('abc12345', pubg).valid, false);
  assert.equal(validatePlayerIdFormat('123', pubg).valid, false);
  assert.equal(validatePlayerIdFormat('5129480192', pubg).valid, true);

  const mlbb = resolveGameProfileFromPackage({ packageName: 'موبايل ليجيند 86 ماسة' });
  assert.equal(validatePlayerIdFormat('206932215', mlbb).valid, false);
  assert.equal(validatePlayerIdFormat('206932215', mlbb, '9059').valid, true);
});
