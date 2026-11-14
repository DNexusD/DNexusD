import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { validateResetPasswordInput } from '../../utils/passwordReset';

interface ResetPasswordViewProps {
  oobCode: string;
  onRequestNewLink: () => void;
  onBackToLogin: () => void;
}

export const ResetPasswordView: React.FC<ResetPasswordViewProps> = ({
  oobCode,
  onRequestNewLink,
  onBackToLogin,
}) => {
  const { verifyResetCode, completePasswordReset } = useApp();

  const [status, setStatus] = useState<'verifying' | 'valid' | 'invalid' | 'success'>('verifying');
  const [verifiedEmail, setVerifiedEmail] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const checkCode = async () => {
      setStatus('verifying');
      setErrorMessage(null);
      const res = await verifyResetCode(oobCode);
      if (!active) return;
      if (res.valid) {
        setVerifiedEmail(res.email || '');
        setStatus('valid');
      } else {
        setErrorMessage(res.error || 'رابط إعادة تعيين كلمة المرور غير صالح أو منتهي الصلاحية.');
        setStatus('invalid');
      }
    };
    checkCode();
    return () => {
      active = false;
    };
  }, [oobCode, verifyResetCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validation = validateResetPasswordInput(newPassword, confirmPassword);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'يرجى التحقق من كلمة المرور المدخلة.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await completePasswordReset(oobCode, newPassword, confirmPassword);
      if (res.success) {
        setNewPassword('');
        setConfirmPassword('');
        setStatus('success');
      } else {
        setErrorMessage(res.error || 'تعذر تحديث كلمة المرور.');
        if (res.isExpiredOrInvalidCode) {
          setStatus('invalid');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-[75vh] flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-lg rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden p-5 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">تعيين كلمة مرور جديدة</h1>
              <p className="text-[11px] text-slate-400">إعادة تعيين كلمة المرور لحسابك</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onBackToLogin}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>تسجيل الدخول</span>
          </button>
        </div>

        {/* 1. Verifying link */}
        {status === 'verifying' && (
          <div className="py-10 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
            <div className="text-sm font-bold text-white">جاري التحقق من رابط إعادة التعيين...</div>
            <p className="text-xs text-slate-400">يرجى الانتظار لحظة.</p>
          </div>
        )}

        {/* 2. Invalid or expired link */}
        {status === 'invalid' && (
          <div className="space-y-4">
            <div
              role="alert"
              className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="text-sm font-bold text-white">الرابط غير صالح أو منتهي الصلاحية</div>
                <p className="text-xs text-rose-200 leading-relaxed">
                  {errorMessage || 'انتهت صلاحية رابط إعادة تعيين كلمة المرور أو تم استخدامه مسبقاً.'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={onRequestNewLink}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2"
              >
                <KeyRound className="w-4 h-4" />
                <span>طلب رابط جديد</span>
              </button>
              <button
                type="button"
                onClick={onBackToLogin}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                العودة لتسجيل الدخول
              </button>
            </div>
          </div>
        )}

        {/* 3. New password form */}
        {status === 'valid' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {verifiedEmail && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
                <span className="text-slate-400">البريد الإلكتروني:</span>
                <span className="font-mono font-semibold text-amber-300" dir="ltr">
                  {verifiedEmail}
                </span>
              </div>
            )}

            <div>
              <label htmlFor="reset-new-password" className="block text-xs font-semibold text-slate-300 mb-1">
                كلمة المرور الجديدة:
              </label>
              <div className="relative">
                <input
                  id="reset-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور الجديدة (6 أحرف على الأقل)"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2.5 text-xs text-white font-mono pl-10 focus:outline-none"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(v => !v)}
                  aria-label={showNewPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  className="absolute left-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="reset-confirm-password" className="block text-xs font-semibold text-slate-300 mb-1">
                تأكيد كلمة المرور الجديدة:
              </label>
              <div className="relative">
                <input
                  id="reset-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور الجديدة للتأكيد"
                  className={`w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-xs text-white font-mono pl-10 focus:outline-none ${
                    confirmPassword && confirmPassword !== newPassword
                      ? 'border-rose-500'
                      : 'border-slate-800 focus:border-amber-500'
                  }`}
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(v => !v)}
                  aria-label={showConfirmPassword ? 'إخفاء تأكيد كلمة المرور' : 'إظهار تأكيد كلمة المرور'}
                  className="absolute left-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && confirmPassword !== newPassword && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  كلمة المرور وتأكيدها غير متطابقين.
                </span>
              )}
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري حفظ كلمة المرور الجديدة...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>حفظ كلمة المرور الجديدة</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* 4. Success state */}
        {status === 'success' && (
          <div className="space-y-4">
            <div
              role="status"
              className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2"
            >
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>تم تغيير كلمة المرور بنجاح</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                يمكنك الآن العودة إلى صفحة تسجيل الدخول واستخدام كلمة المرور الجديدة.
              </p>
            </div>

            <button
              type="button"
              onClick={onBackToLogin}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm"
            >
              الانتقال إلى تسجيل الدخول
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
