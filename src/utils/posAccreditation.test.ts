import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPosAccreditationCertificateHtml,
  canSupplierInspectPosInterface,
  filterStoreClients,
  formatAccreditationCertificateNumber,
  getPosUpgradeStatus,
  hasClientApprovedPosUpgrade,
  isPosClientAccredited,
  needsPosUpgradeApproval,
} from './posAccreditation';
import { POSClient, Supplier } from '../types';

function makeClient(overrides: Partial<POSClient> = {}): POSClient {
  return {
    id: 'pos-1',
    posCode: 'RYD-10001',
    tradeName: 'محل الأمل للاتصالات',
    ownerName: 'أحمد العتيبي',
    phone: '0500000001',
    email: 'pos1@test.sa',
    country: 'السعودية',
    city: 'الرياض',
    supplierId: 'sup-1',
    tier: 'gold',
    walletBalance: 500,
    totalSpent: 1200,
    ordersCount: 12,
    createdAt: '2026-01-01',
    qrCodeValue: 'DIGIPOS:RYD-10001',
    isActive: true,
    isAccreditedPos: false,
    ...overrides,
  };
}

function makeSupplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: 'sup-abc123',
    name: 'متجر النخبة',
    storeName: 'النخبة الرقمي',
    phone: '0551112223',
    email: 'sup@test.sa',
    feePercentage: 1,
    fixedFeeAmount: 0,
    feeType: 'percentage',
    walletBalance: 5000,
    bankAccountDetails: {
      bankName: 'الراجحي',
      accountHolder: 'النخبة',
      iban: 'SA111',
      accountNumber: '111',
    },
    createdAt: '2026-01-01',
    ...overrides,
  };
}

test('isPosClientAccredited checks boolean flag strictly', () => {
  assert.equal(isPosClientAccredited(undefined), false);
  assert.equal(isPosClientAccredited(makeClient({ isAccreditedPos: undefined })), false);
  assert.equal(isPosClientAccredited(makeClient({ isAccreditedPos: false })), false);
  assert.equal(isPosClientAccredited(makeClient({ isAccreditedPos: true })), true);
});

test('filterStoreClients filters by accreditation, active state, and search text', () => {
  const c1 = makeClient({ id: '1', posCode: 'RYD-10001', tradeName: 'نقطة النور', isAccreditedPos: true, isActive: true });
  const c2 = makeClient({ id: '2', posCode: 'JED-20002', tradeName: 'مؤسسة البدر', city: 'جدة', isAccreditedPos: false, isActive: true });
  const c3 = makeClient({ id: '3', posCode: 'DAM-30003', tradeName: 'الرواد', isAccreditedPos: true, isActive: false });
  const all = [c1, c2, c3];

  assert.deepEqual(filterStoreClients(all, { filter: 'accredited' }).map((c) => c.id), ['1', '3']);
  assert.deepEqual(filterStoreClients(all, { filter: 'unaccredited' }).map((c) => c.id), ['2']);
  assert.deepEqual(filterStoreClients(all, { filter: 'active' }).map((c) => c.id), ['1', '2']);
  assert.deepEqual(filterStoreClients(all, { filter: 'suspended' }).map((c) => c.id), ['3']);
  assert.deepEqual(filterStoreClients(all, { filter: 'accredited', searchQuery: 'النور' }).map((c) => c.id), ['1']);
  assert.deepEqual(filterStoreClients(all, { searchQuery: 'JED-20002' }).map((c) => c.id), ['2']);
});

test('formatAccreditationCertificateNumber and buildPosAccreditationCertificateHtml escape HTML safely', () => {
  const certNo = formatAccreditationCertificateNumber('RYD-10001', 'sup-abc123');
  assert.equal(certNo, 'CERT-RYD-10001-C123');

  const html = buildPosAccreditationCertificateHtml({
    client: makeClient({
      tradeName: '<script>alert(1)</script>متجر',
      ownerName: 'أحمد & علي',
      isAccreditedPos: true,
      accreditedAt: '2026-11-20T10:00:00.000Z',
      accreditedByName: 'إدارة المتجر',
    }),
    supplier: makeSupplier({ storeName: 'متجر <b>الرئيسي</b>' }),
    tierNameAr: 'ذهبي',
  });

  assert.equal(html.includes('<script>alert(1)</script>'), false);
  assert.equal(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;متجر'), true);
  assert.equal(html.includes('متجر &lt;b&gt;الرئيسي&lt;/b&gt;'), true);
  assert.equal(html.includes('CERT-RYD-10001-C123'), true);
});

test('POS upgrade consent states and supplier interface inspection guard enforce explicit approval and store isolation', () => {
  const noneClient = makeClient({ isAccreditedPos: false, posUpgradeStatus: 'none' });
  const pendingClient = makeClient({ isAccreditedPos: false, posUpgradeStatus: 'pending_client_approval' });
  const legacyUnconfirmed = makeClient({ isAccreditedPos: true, posUpgradeStatus: undefined });
  const declinedClient = makeClient({ isAccreditedPos: false, posUpgradeStatus: 'declined' });
  const approvedClient = makeClient({
    supplierId: 'sup-abc123',
    isAccreditedPos: true,
    posUpgradeStatus: 'approved',
  });

  assert.equal(getPosUpgradeStatus(noneClient), 'none');
  assert.equal(needsPosUpgradeApproval(pendingClient), true);
  assert.equal(needsPosUpgradeApproval(legacyUnconfirmed), true);
  assert.equal(hasClientApprovedPosUpgrade(legacyUnconfirmed), false);
  assert.equal(hasClientApprovedPosUpgrade(declinedClient), false);
  assert.equal(hasClientApprovedPosUpgrade(approvedClient), true);

  // Supplier owns store and client approved upgrade -> allowed
  assert.equal(
    canSupplierInspectPosInterface({
      client: approvedClient,
      supplierId: 'sup-abc123',
      role: 'supplier',
    }),
    true
  );

  // Different supplier -> denied
  assert.equal(
    canSupplierInspectPosInterface({
      client: approvedClient,
      supplierId: 'sup-other',
      role: 'supplier',
    }),
    false
  );

  // Client pending or declined -> denied even for owning supplier
  assert.equal(
    canSupplierInspectPosInterface({
      client: pendingClient,
      supplierId: 'sup-abc123',
      role: 'supplier',
    }),
    false
  );
  assert.equal(
    canSupplierInspectPosInterface({
      client: declinedClient,
      supplierId: 'sup-abc123',
      role: 'supplier',
    }),
    false
  );

  // Employee permission enforcement
  assert.equal(
    canSupplierInspectPosInterface({
      client: approvedClient,
      supplierId: 'sup-abc123',
      role: 'employee',
      canViewClients: false,
      canUpgradeClientTiers: false,
    }),
    false
  );
  assert.equal(
    canSupplierInspectPosInterface({
      client: approvedClient,
      supplierId: 'sup-abc123',
      role: 'employee',
      canViewClients: true,
    }),
    true
  );
});
