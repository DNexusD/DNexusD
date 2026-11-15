export function isValidLoginEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(clean);
}

export function isValidSixDigitCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  const clean = code.trim();
  return /^\d{6}$/.test(clean);
}

export function formatCooldownButtonText(cooldownSeconds: number, isSendingOtp = false): string {
  if (isSendingOtp) return 'جاري الإرسال...';
  if (cooldownSeconds <= 0) return 'إرسال الرمز';
  return `إعادة الإرسال (${cooldownSeconds}ث)`;
}
