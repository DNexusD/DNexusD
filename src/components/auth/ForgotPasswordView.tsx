import React, { useState } from 'react';
import {
  Mail,
  ArrowRight,
  KeyRound,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface ForgotPasswordViewProps {
  initialEmail?: string;
  onBackToLogin: () => void;
}

export const ForgotPasswordView: React.FC<ForgotPasswordViewProps> = ({
  initialEmail = '',
  onBackToLogin,
}) => {
  const { requestPasswordReset } = useApp();

  const [email, setEmail] = useState(initialEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage('يرجى إدخال بريد إلكتروني صحيح.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await requestPasswordReset(trimmedEmail);
      if (res.success) {
        setSuccessMessage(res.message);
      } else {
        setErrorMessage(res.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div dir="rtl" className="space-y-4">
      {/* Header & Back Button */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white">استعادة كلمة المرور</h2>
            <p className="text-[11px] text-slate-400">
              أدخل بريدك الإلكتروني لإرسال رابط إعادة تعيين كلمة المرور
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onBackToLogin}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>العودة للدخول</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="forgot-email-input"
            className="block text-xs font-semibold text-slate-300 mb-1.5"
          >
            البريد الإلكتروني:
          </label>
          <div className="relative">
            <input
              id="forgot-email-input"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2.5 text-xs text-white pl-9 focus:outline-none font-mono"
              dir="ltr"
            />
            <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Clear Arabic Success Message */}
        {successMessage && (
          <div
            role="status"
            className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs flex items-start gap-2.5"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-white">تم الإرسال بنجاح</div>
              <p className="text-[11px] text-emerald-200/90 leading-relaxed">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Clear Arabic Error Message */}
        {errorMessage && (
          <div
            role="alert"
            className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-500/20"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>جاري إرسال الرابط...</span>
            </>
          ) : (
            <>
              <Mail className="w-4 h-4" />
              <span>إرسال رابط إعادة تعيين كلمة المرور</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
