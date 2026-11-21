import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { SupplierSelector } from './SupplierSelector';
import { ForgotPasswordView } from './ForgotPasswordView';
import {
  formatCooldownButtonText,
  isValidLoginEmail,
  isValidSixDigitCode
} from '../../utils/loginCode';
import jsQR from 'jsqr';
import { 
  Lock, 
  Mail, 
  ShieldCheck, 
  KeyRound, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Store, 
  Building2, 
  UserCheck, 
  Sparkles, 
  Smartphone, 
  Eye, 
  EyeOff,
  RefreshCw,
  Send,
  Database,
  ExternalLink,
  QrCode,
  Upload,
  Clipboard,
  ListFilter,
  Image as ImageIcon
} from 'lucide-react';

interface AuthScreenProps {
  initialMode?: 'login' | 'register' | 'forgot_password';
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ initialMode = 'login' }) => {
  const { 
    sendLoginOtp, 
    verifyLoginOtpAndLogin, 
    registerAccount, 
    showToast, 
    loginWithGoogle, 
    isFirestoreConnected,
    checkDatabaseConnection,
    isSupplierSelectionRequired,
    setIsSupplierSelectionRequired,
    suppliers,
    setCurrentSupplierId,
    currentUser
  } = useApp();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot_password'>(initialMode);
  const [isLoggingInGoogle, setIsLoggingInGoogle] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isCheckingConn, setIsCheckingConn] = useState(false);
  const [connStatusMsg, setConnStatusMsg] = useState<string | null>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // OTP Timer state (10-minute code validity + 60s resend cooldown)
  const [otpSent, setOtpSent] = useState(false);
  const [otpSentToEmail, setOtpSentToEmail] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const lastAutoSubmittedOtpRef = useRef('');

  // Registration form state
  // Required: البريد الإلكتروني، تأكيد البريد الإلكتروني، كلمة المرور، تأكيد كلمة المرور
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regConfirmEmail, setRegConfirmEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('pos_client');
  const [regPhone, setRegPhone] = useState('');
  const [regTradeName, setRegTradeName] = useState('');
  const [regSupplierId, setRegSupplierId] = useState('');
  const [isScanningQrImage, setIsScanningQrImage] = useState(false);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Handle uploading QR Code Image file to decode supplier ID using jsQR
  const handleQrImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningQrImage(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setIsScanningQrImage(false);
          showToast({
            type: 'error',
            title: 'خطأ المعالجة',
            description: 'تعذر إنشاء سياق رسم الصورة'
          });
          return;
        }
        ctx.drawImage(img, 0, 0, img.width, img.height);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        setIsScanningQrImage(false);
        if (code && code.data) {
          let decodedStr = code.data.trim();
          if (decodedStr.includes(':')) {
            const parts = decodedStr.split(':');
            decodedStr = parts[parts.length - 1].trim();
          }
          setRegSupplierId(decodedStr);
          showToast({
            type: 'success',
            title: 'تم قراءة كيو أر المتجر بنجاح!',
            description: `تم استخراج معرف المتجر (${decodedStr}) وتعبئته تلقائياً.`
          });
        } else {
          showToast({
            type: 'error',
            title: 'تعذر قراءة الكيو أر',
            description: 'لم يتم العثور على كيو أر صالح في الصورة المرفوعة. يمكنك إدخال معرف المتجر يدوياً أو اختيار صورة أخرى.'
          });
        }
      };
      img.onerror = () => {
        setIsScanningQrImage(false);
        showToast({
          type: 'error',
          title: 'فشل تحميل الصورة',
          description: 'الصورة المرفوعة غير صالحة أو تالفة.'
        });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle pasting supplier ID from clipboard
  const handlePasteSupplierId = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        let cleaned = text.trim();
        if (cleaned.includes(':')) {
          const parts = cleaned.split(':');
          cleaned = parts[parts.length - 1].trim();
        }
        setRegSupplierId(cleaned);
        showToast({
          type: 'success',
          title: 'تم لصق معرف المتجر',
          description: `تم لصق المعرف: ${cleaned}`
        });
      }
    } catch {
      showToast({
        type: 'info',
        title: 'تعذر الوصول للحافظة',
        description: 'يرجى كتابة أو لصق المعرف في الحقل المخصص.'
      });
    }
  };

  // Countdown timer for 60s button cooldown & 10-minute code expiration
  useEffect(() => {
    if (cooldownSeconds <= 0 && remainingSeconds <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setCooldownSeconds(prev => (prev > 1 ? prev - 1 : 0));
      setRemainingSeconds(prev => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds, remainingSeconds]);

  // Handle Manual Database Connection Test
  const handleManualCheckConnection = async () => {
    setIsCheckingConn(true);
    setConnStatusMsg(null);
    try {
      const res = await checkDatabaseConnection();
      setConnStatusMsg(res.message);
      if (res.success) {
        showToast({
          type: 'success',
          title: 'الاتصال بقاعدة البيانات يعمل بنجاح!',
          description: res.message
        });
      } else {
        showToast({
          type: 'error',
          title: 'فشل الاتصال بقاعدة البيانات',
          description: res.message
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر فحص الاتصال';
      setConnStatusMsg(`خطأ: ${msg}`);
    } finally {
      setIsCheckingConn(false);
    }
  };

  // Handle Send OTP
  const handleSendOtp = async () => {
    setAuthError(null);
    if (!isValidLoginEmail(loginEmail)) {
      const msg = 'يرجى إدخال بريد إلكتروني صحيح';
      setAuthError(msg);
      showToast({
        type: 'error',
        title: 'البريد الإلكتروني غير صحيح',
        description: msg
      });
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await sendLoginOtp(loginEmail);
      if (res.success) {
        setOtpSent(true);
        setOtpSentToEmail(res.email || loginEmail.trim().toLowerCase());
        setCooldownSeconds(res.cooldownSeconds ?? 15);
        setRemainingSeconds(res.remainingSeconds ?? 600);
        lastAutoSubmittedOtpRef.current = '';
        setAuthError(null);
      } else if (res.error) {
        setAuthError(res.error);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر إرسال رمز التحقق';
      setAuthError(msg);
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Verify credentials (direct Email+Password, or Email+Password+OTP if OTP was requested/entered)
  const performLogin = async (otpCodeToVerify: string, requireOtp: boolean) => {
    setAuthError(null);

    if (!isValidLoginEmail(loginEmail)) {
      const msg = 'يرجى إدخال بريد إلكتروني صحيح';
      setAuthError(msg);
      showToast({
        type: 'error',
        title: 'البريد الإلكتروني مطلوب',
        description: msg
      });
      return;
    }

    if (!loginPassword.trim()) {
      const msg = 'يرجى إدخال كلمة المرور';
      setAuthError(msg);
      showToast({
        type: 'error',
        title: 'كلمة المرور مطلوبة',
        description: msg
      });
      return;
    }

    const cleanOtp = otpCodeToVerify.trim();
    if ((requireOtp || cleanOtp.length > 0) && !isValidSixDigitCode(cleanOtp)) {
      const msg = 'يرجى إدخال رمز التحقق المكون من 6 أرقام';
      setAuthError(msg);
      showToast({
        type: 'error',
        title: 'رمز التحقق مطلوب',
        description: msg
      });
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await verifyLoginOtpAndLogin(loginEmail, loginPassword, cleanOtp);
      if (!res.success && res.error) {
        setAuthError(res.error);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر إتمام تسجيل الدخول';
      setAuthError(msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const shouldRequireOtp = otpSent && otpSentToEmail === loginEmail.trim().toLowerCase();
    await performLogin(loginOtp, shouldRequireOtp);
  };

  // Handle Google Account Login
  const handleGoogleLogin = async () => {
    setAuthError(null);
    setIsLoggingInGoogle(true);
    try {
      const res = await loginWithGoogle();
      if (!res.success && res.error) {
        setAuthError(res.error);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر تسجيل الدخول باستخدام حساب جوجل';
      setAuthError(msg);
    } finally {
      setIsLoggingInGoogle(false);
    }
  };

  const [registrationBanner, setRegistrationBanner] = useState<string | null>(null);

  // Handle Registration Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Verification 1: Email confirmation match
    if (regEmail.trim().toLowerCase() !== regConfirmEmail.trim().toLowerCase()) {
      showToast({
        type: 'error',
        title: 'عدم تطابق البريد الإلكتروني',
        description: 'البريد الإلكتروني وتأكيد البريد الإلكتروني غير متطابقين، يرجى التحقق منهما.'
      });
      return;
    }

    // Verification 2: Password confirmation match
    if (regPassword !== regConfirmPassword) {
      showToast({
        type: 'error',
        title: 'عدم تطابق كلمة المرور',
        description: 'كلمة المرور وتأكيد كلمة المرور غير متطابقين.'
      });
      return;
    }

    if (regPassword.length < 6) {
      showToast({
        type: 'error',
        title: 'كلمة المرور قصيرة',
        description: 'يرجى إدخال كلمة مرور من 6 خانات على الأقل لضمان أمان حسابك.'
      });
      return;
    }

    if (regRole === 'pos_client' && !regSupplierId.trim()) {
      showToast({
        type: 'error',
        title: 'معرف المتجر مطلوب',
        description: 'يرجى تقديم معرف المتجر الذي ترغب بإنشاء الحساب لديه (عبر كتابة المعرف، اللصق، أو رفع صورة الكيو أر).'
      });
      return;
    }

    setIsRegistering(true);
    try {
      const createdEmail = regEmail.trim();
      const res = await registerAccount({
        name: regName.trim() || (regRole === 'supplier' ? 'المتجر الرقمي' : 'عميل نقطة بيع'),
        email: createdEmail,
        password: regPassword,
        role: regRole,
        phone: regPhone.trim(),
        tradeName: regTradeName.trim(),
        supplierId: regRole === 'pos_client' ? regSupplierId.trim() : undefined
      });

      if (res.success) {
        // Pre-fill login email, clear registration form fields and switch to login mode
        setLoginEmail(createdEmail);
        setLoginPassword('');
        setLoginOtp('');
        setRegName('');
        setRegEmail('');
        setRegConfirmEmail('');
        setRegPassword('');
        setRegConfirmPassword('');
        setRegPhone('');
        setRegTradeName('');
        setRegSupplierId('');
        setAuthError(null);
        
        setRegistrationBanner(`تم إنشاء الحساب (${createdEmail}) وتوثيقه بنجاح في قاعدة البيانات! يمكنك الآن إدخال كلمة المرور والدخول مباشرة إلى حسابك.`);
        setMode('login');
      } else if (res.error) {
        setAuthError(res.error);
        if (res.code === 'auth/email-already-in-use' || res.error.includes('مسجل بالفعل')) {
          setLoginEmail(createdEmail);
          setLoginPassword('');
          setLoginOtp('');
          setRegistrationBanner(`هذا البريد الإلكتروني (${createdEmail}) مسجل بالفعل. تم تحويلك لشاشة تسجيل الدخول مباشرة.`);
          setMode('login');
        }
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-1 sm:p-4">
      <div className="w-full max-w-lg">
        
        {/* Main Authentication Box */}
        <div className="rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden backdrop-blur-xl">
          
          {/* Segmented Switcher: تسجيل الدخول vs إنشاء حساب */}
          <div className="grid grid-cols-2 p-1 bg-slate-950/80 border-b border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`py-2 sm:py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-xs ${
                mode === 'login' || mode === 'forgot_password'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>تسجيل الدخول</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`py-2 sm:py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all text-xs ${
                mode === 'register'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>إنشاء حساب جديد</span>
            </button>
          </div>

          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
            
            {/* ======================= MODE 0: FORGOT PASSWORD ======================= */}
            {mode === 'forgot_password' && (
              <ForgotPasswordView
                initialEmail={loginEmail}
                onBackToLogin={() => {
                  setAuthError(null);
                  setMode('login');
                }}
              />
            )}

            {/* ======================= MODE 1: LOGIN ======================= */}
            {mode === 'login' && (
              <div className="space-y-4">
                {/* Registration Success Banner */}
                {registrationBanner && (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5 shadow-lg shadow-emerald-500/5 animate-fade-in">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-bold text-white text-xs">تم إنشاء وتوثيق الحساب في قاعدة البيانات!</div>
                      <p className="text-[11px] text-emerald-200 leading-relaxed">
                        {registrationBanner}
                      </p>
                    </div>
                  </div>
                )}





                {isSupplierSelectionRequired && currentUser ? (
                  <SupplierSelector />
                ) : (
                  <form onSubmit={handleLoginSubmit} className="space-y-3.5 sm:space-y-4">
                    <div className="space-y-0.5 sm:space-y-1">
                      <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
                        <span>تسجيل الدخول ومتابعة العمليات</span>
                      </h2>
                      <p className="text-[11px] sm:text-xs text-slate-400">
                        اختر تسجيل الدخول السريع عبر حساب جوجل، أو الدخول مباشرة بالبريد الإلكتروني وكلمة المرور.
                      </p>
                    </div>

                    {/* Google Sign-In Button at the Top */}
                    <button
                      type="button"
                      data-testid="google-login-btn"
                      onClick={handleGoogleLogin}
                      disabled={isLoggingInGoogle || isLoggingIn}
                      className="w-full py-3 sm:py-3.5 px-4 rounded-xl sm:rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all shadow-md border border-slate-200 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                    >
                      {isLoggingInGoogle ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-slate-700" />
                          <span>جاري تسجيل الدخول بحساب جوجل...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              fill="#4285F4"
                              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                            />
                            <path
                              fill="#34A853"
                              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                            />
                            <path
                              fill="#EA4335"
                              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                            />
                          </svg>
                          <span>الدخول باستخدام حساب جوجل</span>
                        </>
                      )}
                    </button>

                    {/* Divider */}
                    <div className="relative flex items-center py-1">
                      <div className="flex-grow border-t border-slate-800" />
                      <span className="shrink-0 mx-3 text-[11px] font-medium text-slate-400">أو المتابعة بالبريد الإلكتروني</span>
                      <div className="flex-grow border-t border-slate-800" />
                    </div>

                    {/* 1. Email */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        البريد الإلكتروني:
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          required
                          value={loginEmail}
                          onChange={e => {
                            setLoginEmail(e.target.value);
                            if (otpSent || otpSentToEmail || cooldownSeconds > 0) {
                              setOtpSent(false);
                              setOtpSentToEmail(null);
                              setCooldownSeconds(0);
                              setRemainingSeconds(0);
                              setLoginOtp('');
                              lastAutoSubmittedOtpRef.current = '';
                            }
                          }}
                          placeholder="name@company.com"
                          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 sm:py-2.5 text-xs text-white pl-9 focus:outline-none transition-colors font-mono"
                          dir="ltr"
                        />
                        <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 sm:top-3 pointer-events-none" />
                      </div>
                    </div>

                    {/* 2. Password */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-300">
                          كلمة المرور:
                        </label>
                        <button
                          type="button"
                          data-testid="forgot-password-trigger"
                          onClick={() => {
                            setAuthError(null);
                            setMode('forgot_password');
                          }}
                          className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 hover:underline transition-colors"
                        >
                          نسيت كلمة المرور؟
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showLoginPassword ? 'text' : 'password'}
                          required
                          value={loginPassword}
                          onChange={e => setLoginPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 sm:py-2.5 text-xs text-white pl-9 focus:outline-none transition-colors font-mono"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="absolute left-3 top-2.5 sm:top-3 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* 3. OTP Code (One-time code with 10-minute expiry and 60s cooldown) */}
                    <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2.5 sm:space-y-3">
                      <div className="flex items-center justify-between text-xs gap-1.5 flex-wrap">
                        <label className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
                          <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                          <span>رمز التحقق لمرة واحدة (OTP - اختياري):</span>
                        </label>

                        {remainingSeconds > 0 ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] sm:text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            <Clock className="w-3 h-3 animate-spin text-amber-400" />
                            <span>ينتهي خلال: {formatTimer(remainingSeconds)}</span>
                          </span>
                        ) : otpSent ? (
                          <span className="text-[10px] sm:text-[11px] font-semibold text-rose-400">
                            انتهت الصلاحية (دقيقتان)
                          </span>
                        ) : (
                          <span className="text-[10px] sm:text-[11px] text-slate-500">
                            اختياري للتحقق الإضافي
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          value={loginOtp}
                          onChange={e => {
                            const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setLoginOtp(digits);
                            if (digits.length < 6) {
                              lastAutoSubmittedOtpRef.current = '';
                            } else if (
                              digits.length === 6 &&
                              !isLoggingIn &&
                              isValidLoginEmail(loginEmail) &&
                              loginPassword.trim().length > 0 &&
                              lastAutoSubmittedOtpRef.current !== digits
                            ) {
                              lastAutoSubmittedOtpRef.current = digits;
                              void performLogin(digits, true);
                            }
                          }}
                          placeholder="رمز التحقق (اختياري)"
                          className="flex-1 min-w-0 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-2 sm:px-3 py-2 text-center font-mono text-sm sm:text-base font-bold tracking-wider sm:tracking-widest text-white focus:outline-none transition-colors placeholder:text-[11px] placeholder:font-normal placeholder:tracking-normal placeholder:font-sans placeholder:text-slate-500"
                          dir="ltr"
                        />

                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={isSendingOtp || cooldownSeconds > 0}
                          className={`px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-colors shrink-0 whitespace-nowrap ${
                            isSendingOtp || cooldownSeconds > 0
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md'
                          }`}
                        >
                          {isSendingOtp ? (
                            <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          )}
                          <span>{formatCooldownButtonText(cooldownSeconds, isSendingOtp)}</span>
                        </button>
                      </div>

                      {otpSent && otpSentToEmail && remainingSeconds > 0 && (
                        <div
                          data-testid="otp-email-sent-notice"
                          className="flex items-start gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-200"
                        >
                          <Mail className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <div className="leading-relaxed text-[11px]">
                            تم إرسال الرمز إلى بريدك{' '}
                            <strong dir="ltr" className="text-white font-mono">
                              {otpSentToEmail}
                            </strong>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Prominent Login Error Banner */}
                    {authError && (
                      <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 shadow-lg shadow-rose-500/5 animate-fade-in">
                        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                        <div className="space-y-1 flex-1">
                          <div className="font-bold text-white text-xs">تنبيه أثناء عملية الدخول:</div>
                          <p className="text-[11px] text-rose-200 leading-relaxed font-sans">{authError}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAuthError(null)}
                          className="text-rose-400 hover:text-rose-300 text-xs p-1"
                          title="إغلاق التنبيه"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {/* Login Button */}
                    <button
                      type="submit"
                      disabled={isLoggingIn || isLoggingInGoogle}
                      className="w-full py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/25 active:scale-[0.99] disabled:opacity-50"
                    >
                      {isLoggingIn ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>جاري فحص الاتصال بقاعدة البيانات وتسجيل الدخول...</span>
                        </>
                      ) : (
                        <>
                          <ArrowRight className="w-4 h-4" />
                          <span>تسجيل الدخول ومتابعة العمليات</span>
                        </>
                      )}
                    </button>

                  </form>
                )}
              </div>
            )}

            {/* ======================= MODE 2: REGISTER ======================= */}
            {mode === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-amber-400" />
                    <span>إنشاء حساب جديد في المنصة</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    وفق المتطلبات: يطلب منك الإيميل وتأكيد الإيميل، كلمة المرور وتأكيد كلمة المرور.
                  </p>
                </div>

                {/* Account Role Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    نوع الحساب المطلوب:
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setRegRole('pos_client')}
                      className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                        regRole === 'pos_client'
                          ? 'bg-amber-500 text-slate-950 font-bold border-amber-500 shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <Store className="w-4 h-4" />
                      <span>نقطة بيع / وكيل</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegRole('supplier')}
                      className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                        regRole === 'supplier'
                          ? 'bg-purple-500 text-slate-950 font-bold border-purple-500 shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                      <span>متجر خدمات</span>
                    </button>
                  </div>
                </div>

                {/* Supplier ID Field for POS Clients / Agents */}
                {regRole === 'pos_client' && (
                  <div className="p-3 sm:p-4 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-2.5 shadow-lg shadow-amber-500/5">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-semibold text-amber-400 flex items-center gap-1.5 text-xs">
                        <QrCode className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>معرف المتجر المراد التسجيل لديه (مطلوب):</span>
                      </label>
                      <span className="text-[10px] text-amber-300 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        ID أو QR Code
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      اكتب المعرف، أو قم بلصقه، أو ارفع صورة الكيو أر (QR) للمتجر لاستخراجه وقراءته تلقائياً:
                    </p>

                    <div className="space-y-2">
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          required={regRole === 'pos_client'}
                          value={regSupplierId}
                          onChange={e => setRegSupplierId(e.target.value)}
                          placeholder="أدخل معرف المتجر أو امسحه (مثال: sup-jamal-01)"
                          className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 sm:py-2.5 text-xs text-white pl-28 focus:outline-none font-mono"
                          dir="ltr"
                        />

                        <div className="absolute left-1.5 top-1 sm:top-1.5 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={handlePasteSupplierId}
                            title="لصق المعرف من الحافظة"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          >
                            <Clipboard className="w-3.5 h-3.5" />
                          </button>

                          <label
                            title="تحميل صورة الكيو أر (QR)"
                            className="p-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer transition-colors flex items-center gap-1 text-[11px] font-bold shadow-sm"
                          >
                            {isScanningQrImage ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
                            ) : (
                              <ImageIcon className="w-3.5 h-3.5 text-slate-950" />
                            )}
                            <span>رفع QR</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleQrImageUpload}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>

                      {/* Quick Select Option from system suppliers list */}
                      <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-800/80">
                        <span className="text-slate-400">أو اختر من قائمة المتاجر المتاحين:</span>
                        <button
                          type="button"
                          onClick={() => setShowSupplierDropdown(!showSupplierDropdown)}
                          className="text-amber-400 hover:underline font-semibold flex items-center gap-1 text-[11px]"
                        >
                          <ListFilter className="w-3.5 h-3.5" />
                          <span>{showSupplierDropdown ? 'إغلاق القائمة' : 'استعراض المتاجر'}</span>
                        </button>
                      </div>

                      {showSupplierDropdown && (
                        <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-slate-900 rounded-xl border border-slate-800 text-xs">
                          {suppliers.length === 0 ? (
                            <div className="p-3 text-center text-[11px] text-slate-400">
                              لا توجد متاجر مسجلة في المنصة حالياً.
                            </div>
                          ) : (
                            suppliers.map(sup => (
                              <button
                                key={sup.id}
                                type="button"
                                onClick={() => {
                                  setRegSupplierId(sup.id);
                                  setShowSupplierDropdown(false);
                                }}
                                className={`p-2 rounded-lg text-right transition-colors flex items-center justify-between ${
                                  regSupplierId === sup.id
                                    ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                                    : 'hover:bg-slate-800 text-slate-300'
                                }`}
                              >
                                <div>
                                  <div className="font-bold text-white text-xs">{sup.name} - {sup.storeName}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">المعرف: {sup.id}</div>
                                </div>
                                {regSupplierId === sup.id && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />}
                              </button>
                            ))
                          )}
                        </div>
                      )}

                      {/* Real-time Verification Status Badge */}
                      {regSupplierId.trim() && (
                        <div className="pt-1">
                          {suppliers.some(s => s.id === regSupplierId.trim()) ? (
                            <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20 text-[11px]">
                              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                              <span>
                                تم التحقق - المتجر: <strong>{suppliers.find(s => s.id === regSupplierId.trim())?.name}</strong> ({suppliers.find(s => s.id === regSupplierId.trim())?.storeName})
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-amber-300 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20 text-[11px]">
                              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                              <span>
                                سيتم إرسال طلب الانضمام إلى المتجر بالمعرف: <strong className="font-mono text-white">{regSupplierId.trim()}</strong>
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Name & Trade Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      الاسم الكامل:
                    </label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={e => setRegName(e.target.value)}
                      placeholder="مثال: خالد المنصوري"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      اسم المتجر أو المؤسسة:
                    </label>
                    <input
                      type="text"
                      value={regTradeName}
                      onChange={e => setRegTradeName(e.target.value)}
                      placeholder="مثال: متجر القمة للبطاقات"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* 1. Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    البريد الإلكتروني:
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    placeholder="name@domain.com"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                    dir="ltr"
                  />
                </div>

                {/* 2. Confirm Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    تأكيد البريد الإلكتروني:
                  </label>
                  <input
                    type="email"
                    required
                    value={regConfirmEmail}
                    onChange={e => setRegConfirmEmail(e.target.value)}
                    placeholder="أعد كتابة البريد الإلكتروني نفسه"
                    className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none ${
                      regConfirmEmail && regEmail.toLowerCase() !== regConfirmEmail.toLowerCase()
                        ? 'border-rose-500'
                        : 'border-slate-800 focus:border-amber-500'
                    }`}
                    dir="ltr"
                  />
                  {regConfirmEmail && regEmail.toLowerCase() !== regConfirmEmail.toLowerCase() && (
                    <span className="text-[10px] text-rose-400 mt-0.5 block">
                      البريد الإلكتروني غير متطابق!
                    </span>
                  )}
                </div>

                {/* 3. Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    كلمة المرور:
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white font-mono pl-10 focus:outline-none"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute left-3 top-2.5 text-slate-500 hover:text-slate-300"
                    >
                      {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* 4. Confirm Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    تأكيد كلمة المرور:
                  </label>
                  <div className="relative">
                    <input
                      type={showRegConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={regConfirmPassword}
                      onChange={e => setRegConfirmPassword(e.target.value)}
                      placeholder="أعد إدخال كلمة المرور للتأكيد"
                      className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs text-white font-mono pl-10 focus:outline-none ${
                        regConfirmPassword && regPassword !== regConfirmPassword
                          ? 'border-rose-500'
                          : 'border-slate-800 focus:border-amber-500'
                      }`}
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                      className="absolute left-3 top-2.5 text-slate-500 hover:text-slate-300"
                    >
                      {showRegConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {regConfirmPassword && regPassword !== regConfirmPassword && (
                    <span className="text-[10px] text-rose-400 mt-0.5 block">
                      كلمة المرور وتأكيدها غير متطابقين!
                    </span>
                  )}
                </div>

                {/* Register Error Banner */}
                {authError && (
                  <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 shadow-lg shadow-rose-500/5 animate-fade-in">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-1 flex-1">
                      <div className="font-bold text-white text-xs">تعذر إنشاء الحساب:</div>
                      <p className="text-[11px] text-rose-200 leading-relaxed font-sans">{authError}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAuthError(null)}
                      className="text-rose-400 hover:text-rose-300 text-xs p-1"
                      title="إغلاق التنبيه"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Register Submit Button */}
                <button
                  type="submit"
                  disabled={isRegistering}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/25 active:scale-[0.99] disabled:opacity-50"
                >
                  {isRegistering ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري فحص الاتصال وتوثيق الحساب في قاعدة البيانات...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تأكيد وإنشاء الحساب والدخول للمنصة</span>
                    </>
                  )}
                </button>

              </form>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};
