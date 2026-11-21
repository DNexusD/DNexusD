import React, { useState } from 'react';
import {
  Download,
  ExternalLink,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  X,
  CreditCard,
  User,
  Calendar,
  Landmark,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export interface ReceiptImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string | null;
  title?: string;
  transferNumber?: string;
  amount?: number;
  senderName?: string;
  bankName?: string;
  date?: string;
  posName?: string;
  posCode?: string;
}

export const ReceiptImageModal: React.FC<ReceiptImageModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title = 'معاينة صورة إيصال الحوالة البنكية',
  transferNumber,
  amount,
  senderName,
  bankName,
  date,
  posName,
  posCode,
}) => {
  const { formatCurrency } = useApp();
  const [isZoomed, setIsZoomed] = useState(false);

  if (!isOpen || !imageUrl) return null;

  const handleDownload = () => {
    try {
      const a = document.createElement('a');
      a.href = imageUrl;
      a.download = `receipt-${transferNumber || Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error('Failed to trigger download', e);
    }
  };

  const handleOpenNewTab = () => {
    // Open in separate window/tab safely
    const win = window.open();
    if (win) {
      win.document.write(
        `<body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;height:100vh;"><img src="${imageUrl}" style="max-width:100%;max-height:100%;object-fit:contain;" alt="إيصال الحوالة" /></body>`
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="معاينة إيصال الحوالة البنكية"
    >
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto text-slate-100 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/90 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-white truncate flex items-center gap-2">
                <span>{title}</span>
                {amount !== undefined && (
                  <span className="font-mono text-emerald-400 text-xs sm:text-sm font-bold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                    {formatCurrency(amount, { withGrouping: true })}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                {posName ? `${posName} (${posCode || ''}) · ` : ''}
                {transferNumber ? `رقم الحوالة: ${transferNumber}` : 'إيصال إيداع معتمد'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsZoomed((prev) => !prev)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={isZoomed ? 'تصغير' : 'تكبير'}
            >
              {isZoomed ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="تحميل صورة الإيصال"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleOpenNewTab}
              className="hidden sm:flex p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="فتح في نافذة مستقلة"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 text-slate-400 transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Transfer Metadata Pill Bar */}
        {(transferNumber || senderName || bankName || date) && (
          <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800 text-[11px] flex flex-wrap items-center gap-x-4 gap-y-1.5 shrink-0 text-slate-300">
            {transferNumber && (
              <div className="flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-slate-400">المرجع:</span>
                <strong className="font-mono text-white">
                  <bdi dir="ltr">{transferNumber}</bdi>
                </strong>
              </div>
            )}
            {senderName && (
              <div className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-slate-400">المحوّل:</span>
                <span className="text-white font-medium">{senderName}</span>
              </div>
            )}
            {bankName && (
              <div className="flex items-center gap-1">
                <Landmark className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="text-slate-400">البنك:</span>
                <span className="text-slate-200">{bankName}</span>
              </div>
            )}
            {date && (
              <div className="flex items-center gap-1 font-mono text-slate-400">
                <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>{date}</span>
              </div>
            )}
          </div>
        )}

        {/* Image Display Viewer */}
        <div className="p-3 sm:p-5 flex-1 overflow-auto bg-slate-950 flex items-center justify-center min-h-[300px]">
          <div
            className={`transition-all duration-200 ${
              isZoomed ? 'w-full max-w-none cursor-zoom-out' : 'max-h-[60vh] max-w-full cursor-zoom-in'
            }`}
            onClick={() => setIsZoomed((prev) => !prev)}
            title="انقر للتكبير / التصغير"
          >
            <img
              src={imageUrl}
              alt="صورة إيصال الحوالة"
              className={`rounded-2xl border border-slate-800 object-contain shadow-2xl mx-auto transition-transform ${
                isZoomed ? 'w-full' : 'max-h-[60vh] max-w-full'
              }`}
            />
          </div>
        </div>

        {/* Footer info & close */}
        <div className="p-3.5 sm:p-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-xs shrink-0">
          <span className="text-[11px] text-slate-400">
            * تم إرفاق هذا الإيصال رقمياً لتأكيد مطابقة قيد الحوالة البنكية.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
