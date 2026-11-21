import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { StatementFilter } from '../../types';
import {
  generateStatementPdf,
  triggerPdfFileDownload,
  computeLedgerTotals,
  formatCurrencySar,
  GeneratedPdfResult,
  PdfBadgeTone,
  PdfStatementRow,
} from '../../utils/pdfStatement';
import { PdfPreviewModal } from '../common/PdfPreviewModal';
import {
  getActiveDropdownOptions,
  matchesStatementTransactionType,
} from '../../utils/platformSettings';
import {
  buildClientStatementEntries,
  filterClientStatementDropdownOptions,
} from '../../utils/clientStatement';
import { 
  Eye,
  Search, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ShoppingBag, 
  RefreshCw,
  Download,
  Loader2,
  HandCoins
} from 'lucide-react';

export const StatementView: React.FC = () => {
  const { currentPos, accountingEntries, orders, depositRequests, platformSettings, showToast, activeCurrency, activeExchangeRate, formatCurrency } = useApp();

  const [activeFilter, setActiveFilter] = useState<StatementFilter>('all');
  const [selectedTransactionType, setSelectedTransactionType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<GeneratedPdfResult | null>(null);

  const statementTypeOptions = filterClientStatementDropdownOptions(
    getActiveDropdownOptions(platformSettings.statementTransactionTypes)
  );

  const selectQuickFilter = (tab: StatementFilter) => {
    setActiveFilter(tab);
    const mapToDropdown: Record<string, string> = {
      all: 'all',
      sales: 'sale',
      purchases: 'purchase',
      deposits: 'deposit',
      transfers: 'transfers',
      loans: 'loan',
    };
    setSelectedTransactionType(mapToDropdown[tab] || 'all');
  };

  const handleTransactionDropdownChange = (val: string) => {
    setSelectedTransactionType(val);
    const reverseMap: Record<string, StatementFilter> = {
      all: 'all',
      sale: 'sales',
      purchase: 'purchases',
      deposit: 'deposits',
      transfers: 'transfers',
      transfer_in: 'transfers',
      transfer_out: 'transfers',
      loan: 'loans',
    };
    setActiveFilter(reverseMap[val] || 'all');
  };

  useEffect(() => {
    return () => {
      if (pdfPreview?.blobUrl) {
        URL.revokeObjectURL(pdfPreview.blobUrl);
      }
    };
  }, [pdfPreview]);

  const isLoanEntry = (entry: typeof accountingEntries[0]) => {
    const desc = entry.description.toLowerCase();
    if (desc.includes('سلف') || desc.includes('سلفة')) return true;
    const matchingDep = depositRequests.find(d => d.id === entry.referenceId);
    if (matchingDep && (matchingDep.requestType === 'loan' || matchingDep.loanReason)) return true;
    return false;
  };

  // Entries for current POS (fees hidden; folded into regular purchases/transfers, kept 0 for free gifts)
  const rawPosEntries = accountingEntries.filter(entry => entry.posId === currentPos.id);
  const posEntries = buildClientStatementEntries(rawPosEntries, orders);

  // Filter logic
  const matchedTypeOption = statementTypeOptions.find((o) => o.value === selectedTransactionType);
  const filteredEntries = posEntries.filter(entry => {
    if (
      selectedTransactionType !== 'all' &&
      !matchesStatementTransactionType(entry, selectedTransactionType, depositRequests, matchedTypeOption?.labelAr)
    ) {
      return false;
    }
    
    // Search query (customer, service, or text)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDesc = entry.description.toLowerCase().includes(q);
      const matchCust = entry.customerName?.toLowerCase().includes(q);
      const matchServ = entry.serviceName?.toLowerCase().includes(q);
      const matchRef = entry.referenceId.toLowerCase().includes(q);
      if (!matchDesc && !matchCust && !matchServ && !matchRef) return false;
    }

    return true;
  });

  const { totalDebit: totalDebits, totalCredit: totalCredits } = computeLedgerTotals(filteredEntries);

  const getPosFilterLabel = () => {
    const map: Record<StatementFilter, string> = {
      all: 'كشف حساب عام (جميع الحركات)',
      sales: 'مبيعات الخدمات للزبائن',
      purchases: 'مشتريات الخدمات من المتجر',
      deposits: 'شحن الرصيد المسبق',
      transfers: 'تحويلات الرصيد',
      loans: 'سلف الرصيد الآجل (السلف)',
      by_customer: 'حسب العميل',
      by_service: 'حسب الخدمة',
    };
    const parts = [
      selectedTransactionType !== 'all'
        ? (matchedTypeOption?.labelAr || selectedTransactionType)
        : map[activeFilter],
    ];
    if (searchQuery.trim()) {
      parts.push(`بحث: "${searchQuery.trim()}"`);
    }
    return parts.join(' · ');
  };

  const buildPdfReport = async (mode: 'preview' | 'download') => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
      const rows: PdfStatementRow[] = filteredEntries.map((entry) => {
        let badge = 'تحويل رصيد';
        let badgeTone: PdfBadgeTone = 'cyan';
        if (isLoanEntry(entry)) {
          badge = 'سلفة رصيد آجل';
          badgeTone = 'cyan';
        } else if (entry.type === 'deposit') {
          badge = 'إيداع شحن';
          badgeTone = 'emerald';
        } else if (entry.type === 'purchase') {
          badge = 'شراء خدمة';
          badgeTone = 'amber';
        } else if (entry.type === 'sale') {
          badge = 'بيع لزبون';
          badgeTone = 'purple';
        }

        const subParts: string[] = [];
        if (entry.customerName) subParts.push(`الزبون: ${entry.customerName}`);
        if (entry.serviceName) subParts.push(`الخدمة: ${entry.serviceName}`);
        if (entry.referenceId) subParts.push(`مرجع: #${entry.referenceId}`);

        return {
          id: entry.id,
          cells: {
            date: { text: entry.date },
            type: { text: badge, badge, badgeTone },
            description: {
              text: entry.description,
              subtext: subParts.join(' · ') || undefined,
            },
            debit: {
              text: entry.debit > 0 ? formatCurrencySar(entry.debit, 'debit', activeCurrency, activeExchangeRate) : '-',
              tone: entry.debit > 0 ? 'debit' : 'neutral',
            },
            credit: {
              text: entry.credit > 0 ? formatCurrencySar(entry.credit, 'credit', activeCurrency, activeExchangeRate) : '-',
              tone: entry.credit > 0 ? 'credit' : 'neutral',
            },
            balanceAfter: {
              text: formatCurrencySar(entry.balanceAfter, 'neutral', activeCurrency, activeExchangeRate),
              tone: 'bold',
            },
          },
        };
      });

      const result = await generateStatementPdf({
        title: 'كشف حساب نقطة البيع والمحفظة',
        subtitle: 'تقرير مالي تفصيلي لحركة الإيداعات، المشتريات، المبيعات والتحويلات',
        portalLabel: 'بوابة نقطة البيع (POS)',
        entityName: currentPos.tradeName,
        entityCode: currentPos.posCode,
        generatedAt: nowStr,
        filterSummary: getPosFilterLabel(),
        kpis: [
          { label: 'عدد القيود', value: `${filteredEntries.length} قيد`, tone: 'neutral' },
          { label: 'إجمالي المدين (الخصومات)', value: formatCurrencySar(totalDebits, 'debit', activeCurrency, activeExchangeRate), tone: 'debit' },
          { label: 'إجمالي الدائن (الإيداعات)', value: formatCurrencySar(totalCredits, 'credit', activeCurrency, activeExchangeRate), tone: 'credit' },
          { label: 'الرصيد الحالي', value: formatCurrencySar(currentPos.walletBalance, 'neutral', activeCurrency, activeExchangeRate), tone: 'accent' },
        ],
        columns: [
          { key: 'date', label: 'التاريخ والوقت', width: '15%', mono: true },
          { key: 'type', label: 'نوع القيد', width: '12%' },
          { key: 'description', label: 'البيان والشرح', width: '31%' },
          { key: 'debit', label: 'مدين (خصم)', align: 'left', width: '14%', mono: true, nowrap: true },
          { key: 'credit', label: 'دائن (إيداع)', align: 'left', width: '14%', mono: true, nowrap: true },
          { key: 'balanceAfter', label: 'الرصيد بعد القيد', align: 'left', width: '14%', mono: true, nowrap: true },
        ],
        rows,
        pagination: {
          firstPage: 9,
          otherPages: 13,
        },
        footerSummary: {
          rowCountLabel: `إجمالي القيود المعروضة: ${filteredEntries.length} قيد`,
          totalDebit: formatCurrencySar(totalDebits, 'debit', activeCurrency, activeExchangeRate),
          totalCredit: formatCurrencySar(totalCredits, 'credit', activeCurrency, activeExchangeRate),
          finalBalance: formatCurrencySar(currentPos.walletBalance, 'neutral', activeCurrency, activeExchangeRate),
        },
        filename: `كشف_حساب_${currentPos.tradeName}_${nowStr.slice(0, 10)}.pdf`,
      });

      if (mode === 'download') {
        triggerPdfFileDownload(result.blobUrl, result.filename);
        setTimeout(() => URL.revokeObjectURL(result.blobUrl), 60_000);
        showToast({
          type: 'success',
          title: 'تم تصدير وتحميل كشف الحساب PDF',
          description: `تم إنشاء الملف (${result.filename}) بنجاح.`,
        });
      } else {
        setPdfPreview(result);
      }
    } catch (err) {
      console.error('POS PDF generation error:', err);
      showToast({
        type: 'error',
        title: 'تعذر إنشاء ملف PDF',
        description: err instanceof Error ? err.message : 'حدث خطأ أثناء تجهيز كشف الحساب.',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-5">
      
      {/* Header & PDF Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>كشف حساب حركة المحفظة والعمليات</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            نقطة البيع: {currentPos.tradeName} ({currentPos.posCode}) · الرصيد الحالي: {formatCurrency(currentPos.walletBalance)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isExportingPdf}
            onClick={() => buildPdfReport('preview')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-bold transition-colors disabled:opacity-60"
          >
            {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Eye className="w-4 h-4 text-amber-400" />}
            <span>عرض ومعاينة PDF</span>
          </button>

          <button
            type="button"
            disabled={isExportingPdf}
            onClick={() => buildPdfReport('download')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 text-xs font-bold transition-colors disabled:opacity-60"
          >
            {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>تحميل كشف الحساب PDF</span>
          </button>
        </div>
      </div>

      <PdfPreviewModal
        pdfResult={pdfPreview}
        onClose={() => setPdfPreview(null)}
      />

      {/* Filter Segmented Controls */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs">
        <button
          onClick={() => selectQuickFilter('all')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
            selectedTransactionType === 'all' && activeFilter === 'all'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          كشف حساب عام (الكل)
        </button>

        <button
          onClick={() => selectQuickFilter('sales')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
            activeFilter === 'sales'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          مبيعات الخدمات للزبائن
        </button>

        <button
          onClick={() => selectQuickFilter('purchases')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
            activeFilter === 'purchases'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          مشتريات الخدمات من المتجر
        </button>

        <button
          onClick={() => selectQuickFilter('deposits')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
            activeFilter === 'deposits'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          شحن الرصيد المسبق
        </button>

        <button
          onClick={() => selectQuickFilter('transfers')}
          className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
            activeFilter === 'transfers'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          تحويل الرصيد
        </button>

        {currentPos.canRequestLoans && (
          <button
            onClick={() => selectQuickFilter('loans')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
              activeFilter === 'loans'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            سلف الرصيد الآجل (السلف)
          </button>
        )}
      </div>

      {/* Search & Dynamic Transaction Type Dropdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث حسب الزبون، الخدمة، رقم القيد أو العملية..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-10 pl-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <select
            value={selectedTransactionType}
            onChange={e => handleTransactionDropdownChange(e.target.value)}
            aria-label="نوع الحركة في كشف الحساب / كشف البنك"
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
          >
            <option value="all">نوع الحركة (كشف الحساب / كشف البنك): الكل</option>
            {statementTypeOptions.map(opt => (
              <option key={opt.id} value={opt.value}>{opt.labelAr}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-slate-400 block text-[10px]">عدد القيود المعروضة</span>
          <span className="text-lg font-bold font-mono text-white tabular-nums">{filteredEntries.length}</span>
        </div>
        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-slate-400 block text-[10px]">إجمالي المدين (الخصومات)</span>
          <span className="text-lg font-bold font-mono text-rose-400 tabular-nums">{formatCurrency(totalDebits)}</span>
        </div>
        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-slate-400 block text-[10px]">إجمالي الدائن (الإيداعات)</span>
          <span className="text-lg font-bold font-mono text-emerald-400 tabular-nums">{formatCurrency(totalCredits)}</span>
        </div>
        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-slate-400 block text-[10px]">الرصيد النهائي الحالي</span>
          <span className="text-lg font-bold font-mono text-amber-400 tabular-nums">{formatCurrency(currentPos.walletBalance)}</span>
        </div>
      </div>

      {/* Ledgers Table */}
      <div id="statement-table-to-export" className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold">
              <tr>
                <th className="py-3 px-3">التاريخ والوقت</th>
                <th className="py-3 px-3">نوع القيد</th>
                <th className="py-3 px-3">البيان والشرح</th>
                <th className="py-3 px-3 text-left">مدين (خصم)</th>
                <th className="py-3 px-3 text-left">دائن (إيداع)</th>
                <th className="py-3 px-3 text-left">الرصيد بعد القيد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    لا توجد قيود محاسبية مطابقة للفلتر المحدد.
                  </td>
                </tr>
              ) : (
                filteredEntries.map(entry => {
                  let badge = null;
                  if (isLoanEntry(entry)) {
                    badge = (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 inline-flex items-center gap-1">
                        <HandCoins className="w-3 h-3" />
                        سلفة رصيد آجل
                      </span>
                    );
                  } else if (entry.type === 'deposit') {
                    badge = (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                        <ArrowDownLeft className="w-3 h-3" />
                        إيداع شحن
                      </span>
                    );
                  } else if (entry.type === 'purchase') {
                    badge = (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
                        <ShoppingBag className="w-3 h-3" />
                        شراء خدمة
                      </span>
                    );
                  } else if (entry.type === 'sale') {
                    badge = (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 inline-flex items-center gap-1">
                        <ArrowUpRight className="w-3 h-3" />
                        بيع لزبون
                      </span>
                    );
                  } else {
                    badge = (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 inline-flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" />
                        تحويل رصيد
                      </span>
                    );
                  }

                  return (
                    <tr key={entry.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 text-slate-400 font-mono whitespace-nowrap">
                        {entry.date}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {badge}
                      </td>
                      <td className="py-3 px-3 text-slate-200">
                        <div className="font-semibold text-white">{entry.description}</div>
                        {(entry.customerName || entry.serviceName) && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                            {entry.customerName && <span>الزبون: {entry.customerName}</span>}
                            {entry.customerName && entry.serviceName && <span>·</span>}
                            {entry.serviceName && <span>الخدمة: {entry.serviceName}</span>}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-left font-mono tabular-nums whitespace-nowrap">
                        {entry.debit > 0 ? (
                          <span className="text-rose-400 font-bold">{formatCurrency(entry.debit, { sign: 'debit' })}</span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-left font-mono tabular-nums whitespace-nowrap">
                        {entry.credit > 0 ? (
                          <span className="text-emerald-400 font-bold">{formatCurrency(entry.credit, { sign: 'credit' })}</span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-left font-mono tabular-nums text-white font-bold whitespace-nowrap">
                        {formatCurrency(entry.balanceAfter)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
