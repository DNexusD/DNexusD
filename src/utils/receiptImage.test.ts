import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateReceiptImage,
  formatReceiptFileSize,
} from './receiptImage';

describe('Receipt Image Utilities', () => {
  describe('validateReceiptImage', () => {
    it('returns error when receipt image is empty or null', () => {
      const res1 = validateReceiptImage(null);
      assert.strictEqual(res1.isValid, false);
      assert.match(res1.error || '', /إلزامية/);

      const res2 = validateReceiptImage('');
      assert.strictEqual(res2.isValid, false);
      assert.match(res2.error || '', /إلزامية/);

      const res3 = validateReceiptImage('   ');
      assert.strictEqual(res3.isValid, false);
      assert.match(res3.error || '', /إلزامية/);
    });

    it('returns error when string is not a data:image URL', () => {
      const res = validateReceiptImage('https://example.com/receipt.pdf');
      assert.strictEqual(res.isValid, false);
      assert.match(res.error || '', /صيغة صورة الإيصال غير صحيحة/);
    });

    it('succeeds with a valid data:image URL', () => {
      const validDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...';
      const res = validateReceiptImage(validDataUrl);
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.error, undefined);
    });
  });

  describe('formatReceiptFileSize', () => {
    it('formats small files in kilobytes', () => {
      assert.strictEqual(formatReceiptFileSize(85), '85 كيلوبايت');
      assert.strictEqual(formatReceiptFileSize(350), '350 كيلوبايت');
    });

    it('formats larger files in megabytes', () => {
      assert.strictEqual(formatReceiptFileSize(1024), '1.0 ميجابايت');
      assert.strictEqual(formatReceiptFileSize(2560), '2.5 ميجابايت');
    });
  });
});
