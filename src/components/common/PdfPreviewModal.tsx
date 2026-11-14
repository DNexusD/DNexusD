import React from 'react';
import { Download, Eye, FileText, X, CheckCircle2 } from 'lucide-react';
import { GeneratedPdfResult, triggerPdfFileDownload } from '../../utils/pdfStatement';

interface PdfPreviewModalProps {
  pdfResult: GeneratedPdfResult | null;
  onClose: () => void;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({ pdfResult, onClose }) => {
  if (!pdfResult) return null;

  const handleDownload = () => {
    triggerPdfFileDownload(pdfResult.blobUrl, pdfResult.filename);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="معاينة وتحميل كشف الحساب PDF"
    >
      <div className="w-full max-w-5xl h-[90vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white truncate flex items-center gap-2">
                <span>{pdfResult.title}</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  PDF جاهز ({pdfResult.pageCount} {pdfResult.pageCount === 1 ? 'صفحة' : 'صفحات'})
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {pdfResult.filename} · {pdfResult.rowCount} سجل · {(pdfResult.blob.size / 1024).toFixed(0)} KB
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>تحميل ملف PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              aria-label="إغلاق المعاينة"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable A4 Pages Preview */}
        <div className="flex-1 bg-slate-950/90 p-3 sm:p-5 overflow-y-auto flex flex-col items-center gap-5">
          <div className="w-full max-w-3xl flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>معاينة مستند كشف الحساب المنسق (A4 عربي RTL)</span>
            </span>
            <span className="font-mono text-slate-500" dir="ltr">{pdfResult.generatedAt}</span>
          </div>

          {pdfResult.previewImages.map((imgSrc, idx) => (
            <div
              key={idx}
              className="w-full max-w-3xl rounded-xl overflow-hidden shadow-2xl border border-slate-700 bg-white"
            >
              <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-[10px] text-slate-600 font-semibold">
                <span>{pdfResult.title}</span>
                <span>صفحة {idx + 1} من {pdfResult.pageCount}</span>
              </div>
              <img
                src={imgSrc}
                alt={`صفحة ${idx + 1} من كشف الحساب`}
                className="w-full h-auto block"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
