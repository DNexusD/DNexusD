import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GAME_LOGIN_ACCOUNT_TYPES,
  resolveGameAccountTypeLabel,
  validateAccountLoginCredentials,
} from './gameAccountTypes';

test('GAME_LOGIN_ACCOUNT_TYPES includes Google, Facebook, Twitter/X and game-linked accounts', () => {
  const ids = GAME_LOGIN_ACCOUNT_TYPES.map((t) => t.id);
  for (const requiredId of [
    'google',
    'facebook',
    'twitter_x',
    'apple',
    'vk',
    'game_center',
    'supercell',
    'activision',
    'konami',
    'epic_games',
    'steam',
    'playstation',
    'xbox',
    'discord',
    'other',
  ]) {
    assert.ok(ids.includes(requiredId), `Missing game login type: ${requiredId}`);
  }
});

test('resolveGameAccountTypeLabel maps preset ids and custom account type cleanly', () => {
  assert.equal(resolveGameAccountTypeLabel('google'), 'حساب جوجل (Google)');
  assert.equal(resolveGameAccountTypeLabel('facebook'), 'حساب فيسبوك (Facebook)');
  assert.equal(resolveGameAccountTypeLabel('twitter_x'), 'حساب تويتر / إكس (Twitter / X)');
  assert.equal(resolveGameAccountTypeLabel('other', '  حساب تيك توك  '), 'حساب تيك توك');
  assert.equal(resolveGameAccountTypeLabel('other', '   '), '');
  assert.equal(resolveGameAccountTypeLabel(''), '');
});

test('validateAccountLoginCredentials requires account type, account identifier, and password', () => {
  const missingType = validateAccountLoginCredentials({
    accountType: '',
    accountEmail: 'player@gmail.com',
    accountPassword: 'secret',
  });
  assert.equal(missingType.valid, false);
  assert.ok(missingType.error);

  const missingCustomOther = validateAccountLoginCredentials({
    accountType: 'other',
    customAccountType: '   ',
    accountEmail: 'player@gmail.com',
    accountPassword: 'secret',
  });
  assert.equal(missingCustomOther.valid, false);

  const missingCreds = validateAccountLoginCredentials({
    accountType: 'facebook',
    accountEmail: '   ',
    accountPassword: 'secret',
  });
  assert.equal(missingCreds.valid, false);

  const validPreset = validateAccountLoginCredentials({
    accountType: 'twitter_x',
    accountEmail: '@gamer_x',
    accountPassword: 'password123',
  });
  assert.equal(validPreset.valid, true);
  assert.equal(validPreset.accountTypeLabel, 'حساب تويتر / إكس (Twitter / X)');
});
