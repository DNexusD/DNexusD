import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_APPEARANCE_ELEMENTS,
  POS_APPEARANCE_ELEMENTS,
  SUPPLIER_APPEARANCE_ELEMENTS,
  createDefaultAppearanceSettings,
  getAppearanceElementsForPortal,
  getAppearanceVisibilitySummary,
  isPageElementVisible,
  normalizeAppearanceSettings,
  resetPageAppearanceSettings,
  setAllPageElementsVisibility,
  setAppearanceCompactMode,
  setPageElementVisibility,
  togglePageElementVisibility,
} from './appearanceSettings';

test('all three portals define unique non-empty element keys', () => {
  const portals = ['super_admin', 'supplier', 'pos_client'] as const;
  for (const portal of portals) {
    const items = getAppearanceElementsForPortal(portal);
    assert.ok(items.length >= 6, `${portal} should expose at least 6 toggleable items`);
    const keys = items.map(i => i.key);
    assert.equal(new Set(keys).size, keys.length, `${portal} keys must be unique`);
  }
  assert.ok(ADMIN_APPEARANCE_ELEMENTS.length > 0);
  assert.ok(SUPPLIER_APPEARANCE_ELEMENTS.length > 0);
  assert.ok(POS_APPEARANCE_ELEMENTS.length > 0);
});

test('isPageElementVisible defaults to true for undefined or empty settings', () => {
  assert.equal(isPageElementVisible(undefined, 'admin_kpi_cards'), true);
  assert.equal(isPageElementVisible(null, 'pos_wallet_strip'), true);
  assert.equal(isPageElementVisible(createDefaultAppearanceSettings(), 'supplier_kpi_cards'), true);
});

test('togglePageElementVisibility hides then restores an element cleanly', () => {
  const hiddenOnce = togglePageElementVisibility(undefined, 'pos_wallet_strip', '2026-11-24T10:00:00Z');
  assert.equal(isPageElementVisible(hiddenOnce, 'pos_wallet_strip'), false);
  assert.equal(isPageElementVisible(hiddenOnce, 'pos_search_box'), true);
  assert.equal(hiddenOnce.updatedAt, '2026-11-24T10:00:00Z');

  const restored = togglePageElementVisibility(hiddenOnce, 'pos_wallet_strip', '2026-11-24T10:01:00Z');
  assert.equal(isPageElementVisible(restored, 'pos_wallet_strip'), true);
  assert.deepEqual(restored.hiddenElements, {});
});

test('setPageElementVisibility and setAllPageElementsVisibility manage bulk visibility', () => {
  const allHidden = setAllPageElementsVisibility('supplier', false, undefined, '2026-11-24T10:02:00Z');
  const summaryHidden = getAppearanceVisibilitySummary('supplier', allHidden);
  assert.equal(summaryHidden.visible, 0);
  assert.equal(summaryHidden.hidden, SUPPLIER_APPEARANCE_ELEMENTS.length);

  const oneShown = setPageElementVisibility(allHidden, 'supplier_kpi_cards', true);
  assert.equal(isPageElementVisible(oneShown, 'supplier_kpi_cards'), true);
  assert.equal(getAppearanceVisibilitySummary('supplier', oneShown).visible, 1);

  const allShown = setAllPageElementsVisibility('supplier', true, oneShown);
  assert.equal(getAppearanceVisibilitySummary('supplier', allShown).hidden, 0);
});

test('compactMode and resetPageAppearanceSettings behave as expected', () => {
  const hidden = togglePageElementVisibility(undefined, 'admin_kpi_cards');
  const compacted = setAppearanceCompactMode(hidden, true);
  assert.equal(compacted.compactMode, true);
  assert.equal(isPageElementVisible(compacted, 'admin_kpi_cards'), false);

  const reset = resetPageAppearanceSettings('2026-11-24T10:05:00Z');
  assert.equal(reset.compactMode, false);
  assert.deepEqual(reset.hiddenElements, {});
  assert.equal(isPageElementVisible(reset, 'admin_kpi_cards'), true);
});

test('normalizeAppearanceSettings strips malformed keys and false flags', () => {
  const normalized = normalizeAppearanceSettings({
    hiddenElements: {
      admin_kpi_cards: true,
      admin_stores_grid: false,
      '': true,
      bad: 'yes',
    },
    compactMode: 'true',
  });
  assert.deepEqual(normalized.hiddenElements, { admin_kpi_cards: true });
  assert.equal(normalized.compactMode, false);
});
