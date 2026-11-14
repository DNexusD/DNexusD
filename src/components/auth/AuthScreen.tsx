import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { SupplierSelector } from './SupplierSelector';
import { ForgotPasswordView } from './ForgotPasswordView';
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

  // OTP Timer state (active for 2 minutes = 120s)
  const [otpSent, setOtpSent] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [demoOtpHint, setDemoOtpHint] = useState<string | null>(null);

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
            title: 'تم قراءة كيو أر المورد بنجاح!',
            description: `تم استخراج معرف المورد (${decodedStr}) وتعبئته تلقائياً.`
          });
        } else {
          showToast({
            type: 'error',
            title: 'تعذر قراءة الكيو أر',
            description: 'لم يتم العثور على كيو أر صالح في الصورة المرفوعة. يمكنك إدخال معرف المورد يدوياً أو اختيار صورة أخرى.'
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
          title: 'تم لصق معرف المورد',
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

  // Countdown timer for 2-minute OTP
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (remainingSeconds > 0) {
      timer = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            setDemoOtpHint(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [remainingSeconds]);

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
    if (!loginEmail.trim()) {
      showToast({
        type: 'error',
        title: 'البريد الإلكتروني مطلوب',
        description: 'يرجى إدخال بريدك الإلكتروني لإرسال رمز التحقق لمرة واحدة'
      });
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await sendLoginOtp(loginEmail);
      if (res.success && res.code) {
        setOtpSent(true);
        setRemainingSeconds(res.remainingSeconds || 120);
        setDemoOtpHint(res.code);
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

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!loginEmail.trim() || !loginPassword.trim()) {
      showToast({
        type: 'error',
        title: 'حقول مطلوبة',
        description: 'يرجى كتابة البريد الإلكتروني وكلمة المرور'
      });
      return;
    }

    if (!loginOtp.trim()) {
      showToast({
        type: 'error',
        title: 'رمز التحقق مطلوب',
        description: 'يرجى إدخال رمز التحقق المرسل إلى بريدك الإلكتروني (صالح لمدة دقيقتين)'
      });
      return;
    }

    if (remainingSeconds === 0) {
      showToast({
        type: 'error',
        title: 'انتهت صلاحية الرمز',
        description: 'انتهت صلاحية رمز التحقق (دقيقتين فقط). اضغط على "إعادة إرسال الرمز" للحصول على رمز جديد.'
      });
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await verifyLoginOtpAndLogin(loginEmail, loginPassword, loginOtp);
      if (!res.success && res.error) {
        setAuthError(res.error);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر إتمام عملية الدخول';
      setAuthError(msg);
    } finally {
      setIsLoggingIn(false);
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
        title: 'معرف المورد مطلوب',
        description: 'يرجى تقديم معرف المورد الذي ترغب بإنشاء الحساب لديه (عبر كتابة المعرف، اللصق، أو رفع صورة الكيو أر).'
      });
      return;
    }

    setIsRegistering(true);
    try {
      const createdEmail = regEmail.trim();
      const res = await registerAccount({
        name: regName.trim() || (regRole === 'supplier' ? 'المورد الرقمي' : 'عميل نقطة بيع'),
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
        
        setRegistrationBanner(`تم إنشاء الحساب (${createdEmail}) وتوثيقه بنجاح في قاعدة البيانات! يرجى إدخال كلمة المرور وطلب رمز OTP للتحقق والدخول إلى المنصة.`);
        setMode('login');
      } else if (res.error) {
        setAuthError(res.error);
      }
    } finally {
      setIsRegistering(false);
    }
  };

  // Quick fill demo credentials
  const fillDemoCredentials = (roleType: 'client' | 'supplier' | 'admin' | 'employee') => {
    if (roleType === 'client') {
      setLoginEmail('pos.alamal@digipos.sa');
      setLoginPassword('PosClientPass2026!');
    } else if (roleType === 'supplier') {
      setLoginEmail('jamal.digital@supplier.sa');
      setLoginPassword('SupplierPass2026!');
    } else if (roleType === 'employee') {
      setLoginEmail('ahmed.emp@supplier.sa');
      setLoginPassword('123456');
    } else {
      setLoginEmail('admin@digipos-platform.com');
      setLoginPassword('SuperAdminPass2026!');
    }
    setOtpSent(false);
    setRemainingSeconds(0);
    setLoginOtp('');
    setDemoOtpHint(null);
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

                {/* Firebase Connection Status Pill */}
                <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${isFirestoreConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                      <span className="text-[11px] text-slate-300 font-medium">قاعدة بيانات Firebase Firestore:</span>
                      <span className={`font-mono text-[10px] px-2 py-0.5 rounded border font-semibold ${
                        isFirestoreConnected 
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                          : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                      }`}>
                        {isFirestoreConnected ? 'متصلة سحابياً (Online)' : 'جاري الفحص...'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleManualCheckConnection}
                      disabled={isCheckingConn}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 hover:text-amber-400 border border-slate-700/80 transition-colors shrink-0 disabled:opacity-50"
                      title="فحص الاتصال اللحظي بقاعدة بيانات Firestore"
                    >
                      <RefreshCw className={`w-3 h-3 text-amber-400 ${isCheckingConn ? 'animate-spin' : ''}`} />
                      <span>{isCheckingConn ? 'جاري الفحص...' : 'فحص الاتصال اللحظي'}</span>
                    </button>
                  </div>

                  {connStatusMsg && (
                    <div className="text-[10px] text-slate-400 pt-1.5 border-t border-slate-800/80 font-mono">
                      {connStatusMsg}
                    </div>
                  )}
                </div>

                {/* Firestore Direct Access Guide */}
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2">
                  <div className="flex items-center justify-between text-amber-300 font-bold">
                    <span className="flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-amber-400" />
                      <span>بيانات الوصول لقاعدتك في Firebase:</span>
                    </span>
                    <a
                      href="https://console.firebase.google.com/project/turnkey-plasma-07cdj/firestore/databases/ai-studio-dnexusd2-b2353ab9-efaa-467e-b2a7-f958ebd4a4c8/data"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded-md transition-colors inline-flex items-center gap-1"
                    >
                      <span>فتح الكونسول مباشرة</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <div className="text-[11px] text-slate-300 space-y-0.5 font-mono">
                    <div>المشروع: <strong className="text-white">turnkey-plasma-07cdj</strong></div>
                    <div>اسم القاعدة: <strong className="text-amber-400">ai-studio-dnexusd2-b2353ab9...</strong></div>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                    💡 <strong>سبب عدم ظهورها تلقائياً:</strong> في Firebase Console يفتح الموقع افتراضياً على قاعدة <code className="text-slate-300 font-mono">(default)</code>. يجب اختيار القاعدة المسماة <code className="text-amber-300 font-mono">ai-studio-dnexusd2-b2353ab9...</code> من القائمة المنسدلة بالأعلى، والتأكد من فتح الكونسول بحساب <code className="text-slate-200 font-mono">jmiyemen66@gmail.com</code>.
                  </p>
                </div>

                {/* Direct Google Sign-In */}
                <button
                  type="button"
                  onClick={async () => {
                    setIsLoggingInGoogle(true);
                    setAuthError(null);
                    try {
                      const res = await loginWithGoogle();
                      if (!res.success && res.error) {
                        setAuthError(res.error);
                      }
                    } catch (err: unknown) {
                      const msg = err instanceof Error ? err.message : 'تعذر تسجيل الدخول عبر Google';
                      setAuthError(msg);
                    } finally {
                      setIsLoggingInGoogle(false);
                    }
                  }}
                  disabled={isLoggingInGoogle}
                  className="w-full py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-[0.99] disabled:opacity-50"
                >
                  {isLoggingInGoogle ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-700" />
                      <span>جاري فحص الاتصال وتسجيل الدخول عبر Google...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                      </svg>
                      <span>تسجيل الدخول السريع بحساب Google (Firebase)</span>
                    </>
                  )}
                </button>

                <div className="relative flex items-center justify-center my-2">
                  <div className="border-t border-slate-800 w-full"></div>
                  <span className="bg-slate-900 px-3 text-[10px] text-slate-500 uppercase font-mono tracking-wider shrink-0">أو تسجيل الدخول برمز التحقق OTP</span>
                  <div className="border-t border-slate-800 w-full"></div>
                </div>

                {isSupplierSelectionRequired && currentUser ? (
                  <SupplierSelector />
                ) : (
                  <form onSubmit={handleLoginSubmit} className="space-y-3.5 sm:space-y-4">
                    <div className="space-y-0.5 sm:space-y-1">
                      <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
                        <span>تسجيل الدخول بالبريد ورمز التحقق</span>
                      </h2>
                      <p className="text-[11px] sm:text-xs text-slate-400">
                        يتطلب إدخال البريد الإلكتروني، كلمة المرور، ورمز تحقق لمرة واحدة (OTP) يستمر فعالاً لمدة دقيقتين فقط.
                      </p>
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
                          onChange={e => setLoginEmail(e.target.value)}
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

                    {/* 3. OTP Code (One-time code with 2-minute timer) */}
                    <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2.5 sm:space-y-3">
                      <div className="flex items-center justify-between text-xs gap-1.5 flex-wrap">
                        <label className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
                          <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                          <span>رمز التحقق لمرة واحدة (OTP):</span>
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
                            صلاحية الرمز: دقيقتان
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
                          onChange={e => setLoginOtp(e.target.value.replace(/\D/g, ''))}
                          placeholder="رمز التحقق (6 أرقام)"
                          className="flex-1 min-w-0 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl px-2 sm:px-3 py-2 text-center font-mono text-sm sm:text-base font-bold tracking-wider sm:tracking-widest text-white focus:outline-none transition-colors placeholder:text-[11px] placeholder:font-normal placeholder:tracking-normal placeholder:font-sans placeholder:text-slate-500"
                          dir="ltr"
                        />

                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={isSendingOtp || remainingSeconds > 60}
                          className={`px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-colors shrink-0 whitespace-nowrap ${
                            remainingSeconds > 60
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md'
                          }`}
                        >
                          {isSendingOtp ? (
                            <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          )}
                          <span>{otpSent ? 'إعادة الإرسال' : 'إرسال الرمز'}</span>
                        </button>
                      </div>

                      {demoOtpHint && (
                        <div className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs gap-1">
                          <span className="text-amber-300 text-[10px] sm:text-[11px] truncate">
                            الرمز: <strong className="font-mono text-white text-xs sm:text-sm tracking-wider mr-1">{demoOtpHint}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => setLoginOtp(demoOtpHint)}
                            className="text-[10px] sm:text-[11px] font-bold text-amber-400 underline hover:text-amber-300 shrink-0"
                          >
                            تعبئة تلقائية
                          </button>
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
                      disabled={isLoggingIn}
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

                    {/* Quick Demo Fill Buttons for Testing */}
                    <div className="pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block mb-1.5 font-semibold">
                        حسابات تجريبية سريعة لاختبار الصلاحيات:
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
                        <button
                          type="button"
                          onClick={() => fillDemoCredentials('supplier')}
                          className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-center transition-colors font-medium"
                        >
                          المورد (المالك)
                        </button>
                        <button
                          type="button"
                          onClick={() => fillDemoCredentials('employee')}
                          className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-center transition-colors font-bold"
                          title="حساب موظف مع كلمة المرور (123456)"
                        >
                          موظف المكتب
                        </button>
                        <button
                          type="button"
                          onClick={() => fillDemoCredentials('client')}
                          className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-center transition-colors font-medium"
                        >
                          نقطة بيع
                        </button>
                        <button
                          type="button"
                          onClick={() => fillDemoCredentials('admin')}
                          className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-center transition-colors font-medium"
                        >
                          مدير التطبيق
                        </button>
                      </div>
                    </div>
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
                      <span>مورد خدمات / مُنَزِّل</span>
                    </button>
                  </div>
                </div>

                {/* Supplier ID Field for POS Clients / Agents */}
                {regRole === 'pos_client' && (
                  <div className="p-3 sm:p-4 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-2.5 shadow-lg shadow-amber-500/5">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-semibold text-amber-400 flex items-center gap-1.5 text-xs">
                        <QrCode className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>معرف المورد المراد التسجيل لديه (مطلوب):</span>
                      </label>
                      <span className="text-[10px] text-amber-300 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        ID أو QR Code
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      اكتب المعرف، أو قم بلصقه، أو ارفع صورة الكيو أر (QR) للمورد لاستخراجه وقراءته تلقائياً:
                    </p>

                    <div className="space-y-2">
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          required={regRole === 'pos_client'}
                          value={regSupplierId}
                          onChange={e => setRegSupplierId(e.target.value)}
                          placeholder="أدخل معرف المورد أو امسحه (مثال: sup-jamal-01)"
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
                        <span className="text-slate-400">أو اختر من قائمة الموردين المتاحين:</span>
                        <button
                          type="button"
                          onClick={() => setShowSupplierDropdown(!showSupplierDropdown)}
                          className="text-amber-400 hover:underline font-semibold flex items-center gap-1 text-[11px]"
                        >
                          <ListFilter className="w-3.5 h-3.5" />
                          <span>{showSupplierDropdown ? 'إغلاق القائمة' : 'استعراض الموردين'}</span>
                        </button>
                      </div>

                      {showSupplierDropdown && (
                        <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-slate-900 rounded-xl border border-slate-800 text-xs">
                          {suppliers.map(sup => (
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
                          ))}
                        </div>
                      )}

                      {/* Real-time Verification Status Badge */}
                      {regSupplierId.trim() && (
                        <div className="pt-1">
                          {suppliers.some(s => s.id === regSupplierId.trim()) ? (
                            <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20 text-[11px]">
                              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                              <span>
                                تم التحقق - المورد: <strong>{suppliers.find(s => s.id === regSupplierId.trim())?.name}</strong> ({suppliers.find(s => s.id === regSupplierId.trim())?.storeName})
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-amber-300 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20 text-[11px]">
                              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                              <span>
                                سيتم إرسال طلب الانضمام إلى المورد بالمعرف: <strong className="font-mono text-white">{regSupplierId.trim()}</strong>
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
