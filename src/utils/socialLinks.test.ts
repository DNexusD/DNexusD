import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildContactLinksList,
  normalizeSocialUrl,
  sanitizeSupplierSocialLinks,
} from './socialLinks.ts';

describe('normalizeSocialUrl', () => {
  it('normalizes WhatsApp international numbers and wa.me URLs', () => {
    assert.equal(normalizeSocialUrl('whatsapp', '+966 50 123 4567'), 'https://wa.me/966501234567');
    assert.equal(normalizeSocialUrl('whatsapp', '00966501234567'), 'https://wa.me/966501234567');
    assert.equal(normalizeSocialUrl('whatsapp', 'https://wa.me/966501234567'), 'https://wa.me/966501234567');
    assert.equal(normalizeSocialUrl('whatsapp', 'wa.me/966501234567'), 'https://wa.me/966501234567');
  });

  it('normalizes @handles for Telegram, Instagram, X, TikTok, and Snapchat', () => {
    assert.equal(normalizeSocialUrl('telegram', '@my_channel'), 'https://t.me/my_channel');
    assert.equal(normalizeSocialUrl('telegram', 'my_channel'), 'https://t.me/my_channel');
    assert.equal(normalizeSocialUrl('instagram', '@store.sa'), 'https://instagram.com/store.sa');
    assert.equal(normalizeSocialUrl('x', '@digipos_sa'), 'https://x.com/digipos_sa');
    assert.equal(normalizeSocialUrl('tiktok', '@shop123'), 'https://www.tiktok.com/@shop123');
    assert.equal(normalizeSocialUrl('snapchat', 'snap_user'), 'https://www.snapchat.com/add/snap_user');
  });

  it('prepends https:// for domains missing protocol', () => {
    assert.equal(normalizeSocialUrl('facebook', 'facebook.com/myshop'), 'https://facebook.com/myshop');
    assert.equal(normalizeSocialUrl('website', 'example.com/contact'), 'https://example.com/contact');
    assert.equal(normalizeSocialUrl('youtube', 'https://youtube.com/@store'), 'https://youtube.com/@store');
  });

  it('blocks unsafe schemes such as javascript:, data:, and protocol-relative URLs', () => {
    assert.equal(normalizeSocialUrl('website', 'javascript:alert(1)'), null);
    assert.equal(normalizeSocialUrl('custom', '  JaVaScRiPt:alert(document.cookie)'), null);
    assert.equal(normalizeSocialUrl('website', 'data:text/html,<script>alert(1)</script>'), null);
    assert.equal(normalizeSocialUrl('website', '//evil.example.com'), null);
    assert.equal(normalizeSocialUrl('website', ''), null);
    assert.equal(normalizeSocialUrl('website', '   '), null);
  });
});

describe('sanitizeSupplierSocialLinks & buildContactLinksList', () => {
  it('preserves empty strings on cleared keys so Firestore merge overwrites old values', () => {
    const sanitized = sanitizeSupplierSocialLinks({
      whatsapp: ' +966501234567 ',
      telegram: '',
      instagram: '  @brand ',
      customLinks: [
        { id: 'c1', label: 'قناة العروض', url: 't.me/offers_sa' },
        { id: 'c2', label: 'رابط خبيث', url: 'javascript:alert(1)' },
        { id: 'c3', label: '', url: 'https://example.com' },
      ],
    });

    assert.equal(sanitized.whatsapp, '+966501234567');
    assert.equal(sanitized.telegram, '');
    assert.equal(sanitized.instagram, '@brand');
    assert.equal(sanitized.website, '');
    assert.equal(sanitized.customLinks?.length, 1);
    assert.equal(sanitized.customLinks?.[0].label, 'قناة العروض');
  });

  it('builds a clean ordered list of valid clickable contact links', () => {
    const links = buildContactLinksList({
      whatsapp: '+966551112233',
      telegram: '@support_desk',
      facebook: 'javascript:void(0)',
      website: 'https://store.example.com',
      customLinks: [{ id: 'c1', label: 'الدعم المباشر', url: 'support.example.com' }],
    });

    assert.deepEqual(
      links.map((l) => ({ key: l.key, label: l.label, href: l.href })),
      [
        { key: 'whatsapp', label: 'واتساب', href: 'https://wa.me/966551112233' },
        { key: 'telegram', label: 'تيليجرام', href: 'https://t.me/support_desk' },
        { key: 'website', label: 'الموقع الإلكتروني', href: 'https://store.example.com/' },
        { key: 'custom', label: 'الدعم المباشر', href: 'https://support.example.com/' },
      ]
    );
  });
});
