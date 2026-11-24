import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ToastContainer } from './components/ToastContainer';
import { Header } from './components/Header';
import { MobileFrame } from './components/MobileFrame';
import { PosDashboard } from './components/pos/PosDashboard';
import { SupplierDashboard } from './components/supplier/SupplierDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { PromptStudio } from './components/prompt-studio/PromptStudio';
import { AuthScreen } from './components/auth/AuthScreen';
import { ResetPasswordView } from './components/auth/ResetPasswordView';
import { parsePasswordResetUrl } from './utils/passwordReset';
import { isFirestoreInternalAssertionError } from './utils/firestoreConnectivity';
import { recoverFirestoreInstance } from './services/firebase';
import { SupplierContactLinks } from './components/common/SupplierContactLinks';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { SupplierSelector } from './components/auth/SupplierSelector';

const MainContent: React.FC = () => {
  const { role, activeNavTab, isAuthenticated, isSupplierSelectionRequired, logout } = useApp();
  const [resetOobCode, setResetOobCode] = React.useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const parsed = parsePasswordResetUrl(window.location.search);
    return parsed.isPasswordResetFlow ? parsed.oobCode : null;
  });
  const [authInitialMode, setAuthInitialMode] = React.useState<'login' | 'register' | 'forgot_password'>('login');

  const clearResetParamsFromUrl = () => {
    setResetOobCode(null);
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.delete('mode');
      url.searchParams.delete('oobCode');
      url.searchParams.delete('apiKey');
      url.searchParams.delete('lang');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  };

  if (resetOobCode) {
    return (
      <ResetPasswordView
        oobCode={resetOobCode}
        onRequestNewLink={() => {
          setAuthInitialMode('forgot_password');
          clearResetParamsFromUrl();
        }}
        onBackToLogin={() => {
          setAuthInitialMode('login');
          clearResetParamsFromUrl();
        }}
      />
    );
  }

  // If user is not authenticated, show initial login & register welcome screen
  if (!isAuthenticated) {
    return <AuthScreen initialMode={authInitialMode} />;
  }

  if (role === 'pos_client' && isSupplierSelectionRequired) {
    return (
      <div className="max-w-md mx-auto py-6">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
          <SupplierSelector />
          <div className="pt-2 border-t border-slate-800 flex justify-center">
            <button
              type="button"
              onClick={logout}
              className="text-xs text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
            >
              تسجيل الخروج والعودة لشاشة الدخول
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeNavTab === 'prompt_studio') {
    return <PromptStudio />;
  }


  if (role === 'pos_client') {
    return <PosDashboard />;
  }

  if (role === 'supplier' || role === 'employee') {
    return <SupplierDashboard />;
  }

  if (role === 'super_admin') {
    return <AdminDashboard />;
  }

  return <PosDashboard />;
};

const AppFooter: React.FC = () => {
  const { platformSettings } = useApp();

  return (
    <footer className="border-t border-slate-900 bg-slate-950/90 py-5 text-center text-xs text-slate-500">
      <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <img 
            src="/assets/aistudio/IMG-20261106-WA0058_54921a02.jpg" 
            alt="DNexusD" 
            className="w-5 h-5 rounded object-contain bg-white p-0.5 shrink-0" 
          />
          <span className="font-mono font-semibold text-slate-300 text-[11px] leading-none whitespace-nowrap">منصة DNexusD</span>
          <span className="text-slate-600 select-none text-[10px]">·</span>
          <span className="text-[11px] text-slate-400 leading-none whitespace-nowrap">ملتقى الخدمات الرقمية المتكاملة ونقاط البيع</span>
        </div>

        {/* Platform Management Contact Links */}
        {platformSettings.socialLinks && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <SupplierContactLinks
              socialLinks={platformSettings.socialLinks}
              labelPrefix="للتواصل مع إدارة المنصة:"
            />
          </div>
        )}

        <div className="text-[10px] text-slate-600 font-mono">
          جميع العمليات المالية والتسعيرات متوافقة مع أنظمة نقاط البيع والمحافظ المسبقة
        </div>
      </div>
    </footer>
  );
};

export default function App() {
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isFirestoreInternalAssertionError(event.reason)) {
        event.preventDefault();
        console.warn('Recovering from internal Firestore assertion error:', event.reason);
        void recoverFirestoreInstance();
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <ErrorBoundary>
      <AppProvider>
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950">
          <ToastContainer />
          <Header />
          
          <div className="flex-1 w-full">
            <MobileFrame>
              <div className="w-full p-4 sm:p-6">
                <MainContent />
              </div>
            </MobileFrame>
          </div>

          <AppFooter />
        </div>
      </AppProvider>
    </ErrorBoundary>
  );
}
