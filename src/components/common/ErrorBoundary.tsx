import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { recoverFirestoreInstance } from '../../services/firebase';
import { isFirestoreInternalAssertionError } from '../../utils/firestoreConnectivity';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    if (isFirestoreInternalAssertionError(error)) {
      return {
        hasError: false,
        errorMessage: '',
      };
    }
    return {
      hasError: true,
      errorMessage: error?.message || 'حدث خطأ غير متوقع أثناء عرض الواجهة.',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    if (isFirestoreInternalAssertionError(error)) {
      console.warn('Recovering UI cleanly after internal Firestore assertion:', error);
      void recoverFirestoreInstance().then(() => {
        this.setState({ hasError: false, errorMessage: '' });
      });
      return;
    }
    console.error('Application UI ErrorBoundary caught error:', error, errorInfo);
  }

  handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleResetError = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      let friendlyMsg = this.state.errorMessage;
      try {
        if (friendlyMsg.startsWith('{')) {
          const parsed = JSON.parse(friendlyMsg) as { error?: string; operationType?: string; path?: string };
          if (parsed?.error) {
            friendlyMsg = `تعذر إتمام عملية قاعدة البيانات (${parsed.operationType || 'read'}): ${parsed.error}`;
          }
        }
      } catch {
        // keep original string
      }

      return (
        <div
          dir="rtl"
          className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-rose-500/30 p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-white">حدث خطأ غير متوقع في التطبيق</h2>
              <p className="text-xs text-slate-400 leading-relaxed break-words">
                {friendlyMsg}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleResetError}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                المحاولة مجدداً
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>إعادة تحميل الصفحة</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
