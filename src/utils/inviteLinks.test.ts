import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInviteUrl,
  buildPosClientInviteDefaults,
  getEnabledInviteFeatureLabels,
  isInviteLinkActive,
  normalizeInviteFeatures,
  parseInviteCodeFromInput,
  parseInviteUrl,
  resolveValidInviteLink,
} from './inviteLinks';
import { InviteLink, Supplier } from '../types';

function makeSupplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: 'sup-1',
    name: 'تاجر الاختبار',
    storeName: 'متجر الاختبار',
    phone: '0500000001',
    email: 'sup1@store.sa',
    feePercentage: 1,
    fixedFeeAmount: 0,
    feeType: 'percentage',
    walletBalance: 1000,
    bankAccountDetails: {
      bankName: 'الراجحي',
      accountHolder: 'تاجر الاختبار',
      iban: 'SA111',
      accountNumber: '111',
    },
    createdAt: '2026-01-01',
    ...overrides,
  };
}

function makeInviteLink(overrides: Partial<InviteLink> = {}): InviteLink {
  return {
    id: 'inv-1',
    code: 'SUP-VIP-555',
    supplierId: 'sup-1',
    supplierName: 'متجر الاختبار',
    targetTier: 'vip',
    features: {
      canRequestLoans: true,
      canReceiveSupplierTransfers: false,
      canGetBonus: true,
      canViewGifts: true,
    },
    isActive: true,
    label: 'دعوة VIP',
    createdAt: '2026-05-01',
    usedCount: 0,
    url: 'https://example.app/?invite=SUP-VIP-555&sup=sup-1',
    ...overrides,
  };
}

test('buildInviteUrl and parseInviteUrl handle new invite URLs and legacy ref URLs cleanly', () => {
  const url = buildInviteUrl({
    origin: 'https://my-app.run.app/',
    code: 'ABC-GOLD-101',
    supplierId: 'sup-9',
  });
  assert.equal(url, 'https://my-app.run.app/?invite=ABC-GOLD-101&sup=sup-9');

  const parsedNew = parseInviteUrl(url);
  assert.equal(parsedNew.isInviteFlow, true);
  assert.equal(parsedNew.inviteCode, 'ABC-GOLD-101');
  assert.equal(parsedNew.supplierId, 'sup-9');

  const parsedLegacy = parseInviteUrl('https://digipos.app/join?ref=JAM-VIP-123&tier=vip&sup=sup-1');
  assert.equal(parsedLegacy.isInviteFlow, true);
  assert.equal(parsedLegacy.inviteCode, 'JAM-VIP-123');
  assert.equal(parsedLegacy.supplierId, 'sup-1');

  assert.equal(parseInviteCodeFromInput(url), 'ABC-GOLD-101');
  assert.equal(parseInviteCodeFromInput('  JAM-GOLD-99  '), 'JAM-GOLD-99');
  assert.equal(parseInviteUrl('?mode=resetPassword&oobCode=XYZ').isInviteFlow, false);
});

test('normalizeInviteFeatures and getEnabledInviteFeatureLabels reflect exact booleans and Arabic labels', () => {
  const defaults = normalizeInviteFeatures(undefined);
  assert.deepEqual(defaults, {
    canRequestLoans: false,
    canReceiveSupplierTransfers: false,
    canGetBonus: false,
    canViewGifts: false,
    isAccreditedPos: false,
  });

  const partial = normalizeInviteFeatures({ canRequestLoans: true, canViewGifts: true, isAccreditedPos: true });
  assert.deepEqual(partial, {
    canRequestLoans: true,
    canReceiveSupplierTransfers: false,
    canGetBonus: false,
    canViewGifts: true,
    isAccreditedPos: true,
  });

  const labels = getEnabledInviteFeatureLabels(partial).map((x) => x.labelAr);
  assert.deepEqual(labels, ['ميزة طلب السلفة', 'الهدايا والعروض المجانية', 'اعتماد كنقطة بيع للمتجر']);
});

test('resolveValidInviteLink enforces active status, active supplier, and authoritative tier & features', () => {
  const activeSup = makeSupplier({ id: 'sup-1', isActive: true });
  const suspendedSup = makeSupplier({ id: 'sup-2', isActive: false });
  const activeInvite = makeInviteLink();
  const disabledInvite = makeInviteLink({
    id: 'inv-2',
    code: 'SUP-OFF-202',
    isActive: false,
  });
  const suspendedStoreInvite = makeInviteLink({
    id: 'inv-3',
    code: 'SUP-SUSP-303',
    supplierId: 'sup-2',
  });

  const ok = resolveValidInviteLink({
    codeOrUrl: 'https://evil.site/?invite=sup-vip-555&tier=regular',
    inviteLinks: [activeInvite, disabledInvite, suspendedStoreInvite],
    suppliers: [activeSup, suspendedSup],
  });
  assert.equal(ok.valid, true);
  if (ok.valid) {
    // Authoritative InviteLink overrides any tampered URL tier parameter
    assert.equal(ok.targetTier, 'vip');
    assert.equal(ok.supplier.id, 'sup-1');
    const clientDefaults = buildPosClientInviteDefaults(ok);
    assert.deepEqual(clientDefaults, {
      tier: 'vip',
      canRequestLoans: true,
      canReceiveSupplierTransfers: false,
      canGetBonus: true,
      canViewGifts: true,
      isAccreditedPos: false,
    });
  }

  assert.equal(isInviteLinkActive(disabledInvite), false);
  const blockedDisabled = resolveValidInviteLink({
    codeOrUrl: 'SUP-OFF-202',
    inviteLinks: [activeInvite, disabledInvite],
    suppliers: [activeSup],
  });
  assert.equal(blockedDisabled.valid, false);

  const blockedSuspendedStore = resolveValidInviteLink({
    codeOrUrl: 'SUP-SUSP-303',
    inviteLinks: [suspendedStoreInvite],
    suppliers: [activeSup, suspendedSup],
  });
  assert.equal(blockedSuspendedStore.valid, false);

  const unknownCode = resolveValidInviteLink({
    codeOrUrl: 'NO-SUCH-CODE',
    inviteLinks: [activeInvite],
    suppliers: [activeSup],
  });
  assert.equal(unknownCode.valid, false);
});
