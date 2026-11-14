import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePasswordResetUrl,
  validateResetPasswordInput,
  mapPasswordResetErrorAr,
} from './passwordReset.ts';

test('parsePasswordResetUrl extracts mode and oobCode cleanly', () => {
  const valid = parsePasswordResetUrl('?mode=resetPassword&oobCode=TEST_CODE_123');
  assert.equal(valid.isPasswordResetFlow, true);
  assert.equal(valid.mode, 'resetPassword');
  assert.equal(valid.oobCode, 'TEST_CODE_123');

  const other = parsePasswordResetUrl('?mode=verifyEmail&oobCode=ABC');
  assert.equal(other.isPasswordResetFlow, false);

  const missingCode = parsePasswordResetUrl('?mode=resetPassword');
  assert.equal(missingCode.isPasswordResetFlow, false);
});

test('validateResetPasswordInput validates minimum length and confirmation match', () => {
  assert.equal(validateResetPasswordInput('12345', '12345').valid, false);
  assert.equal(validateResetPasswordInput('123456', '654321').valid, false);
  assert.equal(validateResetPasswordInput('Secure123', 'Secure123').valid, true);
});

test('mapPasswordResetErrorAr maps Firebase Auth codes to clear Arabic messages', () => {
  const invalidEmail = mapPasswordResetErrorAr({ code: 'auth/invalid-email' }, 'send');
  assert.match(invalidEmail.message, /البريد الإلكتروني/);

  const notFound = mapPasswordResetErrorAr({ code: 'auth/user-not-found' }, 'send');
  assert.match(notFound.message, /لم يتم العثور على حساب/);

  const expired = mapPasswordResetErrorAr({ code: 'auth/expired-action-code' }, 'verify_code');
  assert.equal(expired.isExpiredOrInvalidCode, true);
  assert.match(expired.message, /انتهت صلاحية/);

  const weak = mapPasswordResetErrorAr({ code: 'auth/weak-password' }, 'confirm');
  assert.match(weak.message, /ضعيفة/);
});
