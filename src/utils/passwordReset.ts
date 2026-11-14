// Pure helper utilities for Firebase Auth password reset flow (Arabic & RTL)

export interface ParsedPasswordResetUrl {
  mode: string;
  oobCode: string;
  isPasswordResetFlow: boolean;
}

export function parsePasswordResetUrl(search: string): ParsedPasswordResetUrl {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const mode = (params.get('mode') || '').trim();
  const oobCode = (params.get('oobCode') || '').trim();
  return {
    mode,
    oobCode,
    isPasswordResetFlow: mode === 'resetPassword' && oobCode.length > 0,
  };
}

export function validateResetPasswordInput(
  password: string,
  confirmPassword: string
): { valid: boolean; error?: string } {
  if (!password || password.length < 6) {
    return {
      valid: false,
      error: 'يجب أن تتكون كلمة المرور الجديدة من 6 أحرف على الأقل.',
    };
  }
  if (password !== confirmPassword) {
    return {
      valid: false,
      error: 'كلمة المرور الجديدة وتأكيدها غير متطابقين.',
    };
  }
  return { valid: true };
}

export function mapPasswordResetErrorAr(
  error: unknown,
  stage: 'send' | 'verify_code' | 'confirm'
): { message: string; isExpiredOrInvalidCode: boolean } {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';

  if (code === 'auth/invalid-email') {
    return {
      message: 'صيغة البريد الإلكتروني غير صحيحة، يرجى التأكد والمحاولة مرة أخرى.',
      isExpiredOrInvalidCode: false,
    };
  }

  if (code === 'auth/user-not-found') {
    return {
      message: 'لم يتم العثور على حساب مسجل بهذا البريد الإلكتروني.',
      isExpiredOrInvalidCode: false,
    };
  }

  if (code === 'auth/too-many-requests') {
    return {
      message: 'تم إرسال عدد كبير من الطلبات. يرجى الانتظار قليلاً ثم المحاولة مجدداً.',
      isExpiredOrInvalidCode: false,
    };
  }

  if (code === 'auth/network-request-failed') {
    return {
      message: 'تعذر الاتصال بالخادم، يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.',
      isExpiredOrInvalidCode: false,
    };
  }

  if (code === 'auth/expired-action-code') {
    return {
      message: 'انتهت صلاحية رابط إعادة تعيين كلمة المرور. يرجى طلب رابط جديد.',
      isExpiredOrInvalidCode: true,
    };
  }

  if (code === 'auth/invalid-action-code') {
    return {
      message: 'رابط إعادة تعيين كلمة المرور غير صالح أو تم استخدامه مسبقاً. يرجى طلب رابط جديد.',
      isExpiredOrInvalidCode: true,
    };
  }

  if (code === 'auth/weak-password') {
    return {
      message: 'كلمة المرور ضعيفة جداً، يرجى اختيار كلمة مرور من 6 أحرف على الأقل.',
      isExpiredOrInvalidCode: false,
    };
  }

  if (stage === 'send') {
    return {
      message: 'تعذر إرسال رابط إعادة تعيين كلمة المرور حالياً. يرجى المحاولة مجدداً.',
      isExpiredOrInvalidCode: false,
    };
  }

  return {
    message: 'حدث خطأ أثناء إعادة تعيين كلمة المرور. يرجى المحاولة مجدداً أو طلب رابط جديد.',
    isExpiredOrInvalidCode: stage === 'verify_code',
  };
}
