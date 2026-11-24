import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { AdminStatementFilter } from '../../types';
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
  matchesAdminStatementTransactionType,
} from '../../utils/platformSettings';
import { 
  Eye,
  Search, 
  Building2, 
  Flame, 
  ArrowUpRight, 
  Coins, 
  Landmark, 
  Send, 
  TrendingUp, 
  FileText, 
  Calendar, 
  Percent,
  Download,
  Loader2,
  ListFilter
} from 'lucide-react';

export const AdminStatementView: React.FC = () => {
  const { 
    superAdmin, 
    suppliers, 
    services, 
    adminAccountingEntries, 
    platformSettings,
    showToast,
    activeCurrency,
    activeExchangeRate,
    currencyLabel,
    formatCurrency
  } = useApp();

  const [activeFilter, setActiveFilter] = useState<AdminStatementFilter>('all');
  const [selectedTransactionType, setSelectedTransactionType] = useState<string>('all');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('all');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<GeneratedPdfResult | null>(null);

  const adminTypeOptions = getActiveDropdownOptions(platformSettings.adminStatementTransactionTypes);

  const selectQuickFilter = (tab: AdminStatementFilter) => {
    setActiveFilter(tab);
    const mapToDropdown: Partial<Record<AdminStatementFilter, string>> = {
      all: 'all',
      fees: 'fee_collected',
      deposits: 'deposit_received',
      settlements: 'bank_settlement',
      transfers: 'agent_transfer',
    };
    setSelectedTransactionType(mapToDropdown[tab] || 'all');
  };

  const handleTypeDropdownChange = (val: string) => {
    setSelectedTransactionType(val);
    const reverseMap: Record<string, AdminStatementFilter> = {
      all: 'all',
      fee_collected: 'fees',
      fees: 'fees',
      deposit_received: 'deposits',
      deposits: 'deposits',
      bank_settlement: 'settlements',
      settlements: 'settlements',
      agent_transfer: 'transfers',
      transfers: 'transfers',
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

  // Filtering entries
  const matchedAdminTypeOpt = adminTypeOptions.find((o) => o.value === selectedTransactionType);
  const filteredEntries = adminAccountingEntries.filter(entry => {
    // 1. Tab / Type filter
    if (
      selectedTransactionType !== 'all' &&
      !matchesAdminStatementTransactionType(entry, selectedTransactionType, matchedAdminTypeOpt?.labelAr)
    ) {
      return false;
    }

    // 2. Per-Supplier filter (لكل متجر)
    if (selectedSupplierId !== 'all' && entry.supplierId !== selectedSupplierId) {
      return false;
    }

    // 3. Per-Service filter (لكل خدمة)
    if (selectedServiceId !== 'all' && entry.serviceId !== selectedServiceId) {
      return false;
    }

    // 4. Date range filter
    if (dateFrom && entry.date.substring(0, 10) < dateFrom) return false;
    if (dateTo && entry.date.substring(0, 10) > dateTo) return false;

    // 5. Text search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDesc = entry.description.toLowerCase().includes(q);
      const matchRef = entry.referenceId.toLowerCase().includes(q);
      const matchSup = entry.supplierName?.toLowerCase().includes(q);
      const matchServ = entry.serviceName?.toLowerCase().includes(q);
      const matchPos = entry.posName?.toLowerCase().includes(q) || entry.posCode?.toLowerCase().includes(q);
      const matchNotes = entry.notes?.toLowerCase().includes(q);
      if (!matchDesc && !matchRef && !matchSup && !matchServ && !matchPos && !matchNotes) {
        return false;
      }
    }

    return true;
  });

  // Financial aggregates
  const totalFeesEarned = filteredEntries
    .filter(e => e.type === 'fee_collected')
    .reduce((sum, e) => sum + (e.feeAmount || e.credit), 0);

  const totalDepositsVolume = filteredEntries
    .filter(e => e.type === 'deposit_received')
    .reduce((sum, e) => sum + (e.grossAmount || 0), 0);

  const totalSettlements = filteredEntries
    .filter(e => e.type === 'bank_settlement')
    .reduce((sum, e) => sum + e.debit, 0);

  const totalAgentTransfers = filteredEntries
    .filter(e => e.type === 'agent_transfer')
    .reduce((sum, e) => sum + e.debit, 0);

  const { totalDebit: totalDebits, totalCredit: totalCredits } = computeLedgerTotals(filteredEntries);

  // Active filter descriptor for print and UI summary
  const getFilterSummaryText = () => {
    const parts: string[] = [];
    if (selectedTransactionType !== 'all') {
      parts.push(`نوع الحركة: ${matchedAdminTypeOpt?.labelAr || selectedTransactionType}`);
    } else {
      if (activeFilter === 'all') parts.push('كشف حساب شامل لجميع العمليات والرسوم');
      if (activeFilter === 'fees') parts.push('رسوم العمليات المحصلة فقط');
      if (activeFilter === 'deposits') parts.push('حركات شحن وإيداعات الرصيد المعتمدة');
      if (activeFilter === 'settlements') parts.push('التسويات والتحويلات البنكية للإدارة');
      if (activeFilter === 'transfers') parts.push('تحويلات الرصيد المباشرة لنقاط البيع');
    }

    if (selectedSupplierId !== 'all') {
      const sup = suppliers.find(s => s.id === selectedSupplierId);
      parts.push(`خاص بالمتجر: ${sup ? sup.name : selectedSupplierId}`);
    } else {
      parts.push('جميع المتاجر');
    }

    if (selectedServiceId !== 'all') {
      const srv = services.find(s => s.id === selectedServiceId);
      parts.push(`خدمة: ${srv ? srv.nameAr : selectedServiceId}`);
    }

    if (dateFrom || dateTo) {
      parts.push(`الفترة: ${dateFrom || '...'} إلى ${dateTo || '...'}`);
    }

    if (searchQuery.trim()) {
      parts.push(`بحث: "${searchQuery.trim()}"`);
    }

    return parts.join(' · ');
  };

  const handleResetFilters = () => {
    setActiveFilter('all');
    setSelectedTransactionType('all');
    setSelectedSupplierId('all');
    setSelectedServiceId('all');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
  };

  const buildPdfReport = async (mode: 'preview' | 'download') => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
      const rows: PdfStatementRow[] = filteredEntries.map((entry) => {
        let badge = 'تحويل لوكيل';
        let badgeTone: PdfBadgeTone = 'amber';
        if (entry.type === 'fee_collected') {
          badge = 'رسوم منصة';
          badgeTone = 'purple';
        } else if (entry.type === 'deposit_received') {
          badge = 'شحن رصيد مسبق';
          badgeTone = 'cyan';
        } else if (entry.type === 'bank_settlement') {
          badge = 'تسوية بنكية';
          badgeTone = 'emerald';
        }

        const partyParts: string[] = [];
        if (entry.supplierName) partyParts.push(entry.supplierName);
        if (entry.serviceName) partyParts.push(entry.serviceName);
        if (entry.posName) partyParts.push(`${entry.posName}${entry.posCode ? ` (${entry.posCode})` : ''}`);

        const descSubParts: string[] = [];
        if (entry.notes) descSubParts.push(entry.notes);
        if (entry.grossAmount) descSubParts.push(`قيمة العملية: ${formatCurrency(entry.grossAmount)}`);

        return {
          id: entry.id,
          cells: {
            date: { text: entry.date },
            type: { text: badge, badge, badgeTone },
            ref: { text: `#${entry.referenceId}`, mono: true },
            party: {
              text: partyParts[0] || 'المنصة العامة',
              subtext: partyParts.slice(1).join(' · ') || undefined,
            },
            description: {
              text: entry.description,
              subtext: descSubParts.join(' · ') || undefined,
            },
            debit: {
              text: entry.debit > 0 ? formatCurrencySar(entry.debit, 'debit', activeCurrency, activeExchangeRate) : '-',
              tone: entry.debit > 0 ? 'debit' : 'neutral',
            },
            credit: {
              text: entry.credit > 0
                ? formatCurrencySar(entry.credit, 'credit', activeCurrency, activeExchangeRate)
                : entry.type === 'deposit_received'
                ? 'إيداع معتمد'
                : '-',
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
        title: 'كشف حساب مدير التطبيق الشامل',
        subtitle: 'سجل قيود المحفظة، الرسوم المكتسبة، الإيداعات، والتسويات البنكية',
        portalLabel: 'إدارة المنصة (Super Admin)',
        entityName: 'محفظة مدير التطبيق',
        entityCode: 'ADMIN-LEDGER',
        generatedAt: nowStr,
        filterSummary: getFilterSummaryText(),
        kpis: [
          { label: 'الرسوم المكتسبة', value: formatCurrencySar(totalFeesEarned, 'credit', activeCurrency, activeExchangeRate), tone: 'accent' },
          { label: 'حجم الإيداعات', value: formatCurrencySar(totalDepositsVolume, 'neutral', activeCurrency, activeExchangeRate), tone: 'neutral' },
          { label: 'التسويات والتحويلات', value: formatCurrencySar(totalSettlements + totalAgentTransfers, 'debit', activeCurrency, activeExchangeRate), tone: 'debit' },
          { label: 'الرصيد المتاح', value: formatCurrencySar(superAdmin.walletBalance, 'neutral', activeCurrency, activeExchangeRate), tone: 'credit' },
        ],
        columns: [
          { key: 'date', label: 'التاريخ', width: '11%', mono: true },
          { key: 'type', label: 'النوع', width: '10%' },
          { key: 'ref', label: 'المرجع', width: '10%', mono: true, nowrap: true },
          { key: 'party', label: 'المتجر / الخدمة', width: '15%' },
          { key: 'description', label: 'بيان العملية', width: '20%' },
          { key: 'debit', label: 'مدين', align: 'left', width: '11%', mono: true, nowrap: true },
          { key: 'credit', label: 'دائن', align: 'left', width: '11%', mono: true, nowrap: true },
          { key: 'balanceAfter', label: 'الرصيد', align: 'left', width: '12%', mono: true, nowrap: true },
        ],
        rows,
        pagination: {
          firstPage: 7,
          otherPages: 10,
        },
        footerSummary: {
          rowCountLabel: `إجمالي القيود المعروضة: ${filteredEntries.length} قيد`,
          totalDebit: formatCurrencySar(totalDebits, 'debit', activeCurrency, activeExchangeRate),
          totalCredit: formatCurrencySar(totalCredits, 'credit', activeCurrency, activeExchangeRate),
          finalBalance: formatCurrencySar(superAdmin.walletBalance, 'neutral', activeCurrency, activeExchangeRate),
        },
        filename: `كشف_حساب_مدير_التطبيق_${nowStr.slice(0, 10)}.pdf`,
      });

      if (mode === 'download') {
        triggerPdfFileDownload(result.blobUrl, result.filename);
        setTimeout(() => URL.revokeObjectURL(result.blobUrl), 60_000);
        showToast({
          type: 'success',
          title: 'تم تصدير وتحميل كشف حساب الإدارة PDF',
          description: `تم إنشاء الملف (${result.filename}) بنجاح.`,
        });
      } else {
        setPdfPreview(result);
      }
    } catch (err) {
      console.error('Admin PDF generation error:', err);
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
    <div className="space-y-6">
      
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-purple-950/60 via-slate-900 to-slate-900 border border-purple-500/30 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>كشف حساب مدير التطبيق الشامل</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  سجل قيود المحفظة والرسوم
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                متابعة دقيقة لكل مليم: رسوم الخدمات المقتطعة، إيداعات الرصيد، التسويات البنكية، وتفصيل الحساب لكل متجر أو خدمة.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            disabled={isExportingPdf}
            onClick={() => buildPdfReport('preview')}
            className="flex-1 sm:flex-none justify-center px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-60"
          >
            {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin text-purple-400" /> : <Eye className="w-4 h-4 text-purple-400" />}
            <span>عرض ومعاينة PDF</span>
          </button>

          <button
            type="button"
            disabled={isExportingPdf}
            onClick={() => buildPdfReport('download')}
            className="flex-1 sm:flex-none justify-center px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 transition-colors shadow-lg shadow-purple-900/30 disabled:opacity-60"
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

      {/* KPI Cards for the filtered result */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>إجمالي الرسوم المكتسبة (دائن)</span>
            <Percent className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-bold font-mono text-purple-400 tabular-nums">
            {formatCurrency(totalFeesEarned, { sign: 'credit', withGrouping: true, includeSymbol: false })} <span className="text-xs font-sans text-slate-400">{currencyLabel}</span>
          </div>
          <div className="text-[10px] text-slate-400">من العمليات والتحويلات</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>حجم الإيداعات المعتمدة</span>
            <Coins className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-cyan-400 tabular-nums">
            {formatCurrency(totalDepositsVolume, { withGrouping: true, includeSymbol: false })} <span className="text-xs font-sans text-slate-400">{currencyLabel}</span>
          </div>
          <div className="text-[10px] text-slate-400">شحن محافظ الوكلاء لدى المتاجر</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>التسويات والتحويلات (مدين)</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-400 tabular-nums">
            {formatCurrency(totalSettlements + totalAgentTransfers, { sign: 'debit', withGrouping: true, includeSymbol: false })} <span className="text-xs font-sans text-slate-400">{currencyLabel}</span>
          </div>
          <div className="text-[10px] text-slate-400">سحب بنكي + شحن وكلاء</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-purple-500/40 bg-purple-950/20 space-y-1">
          <div className="flex items-center justify-between text-purple-300 text-[11px] font-semibold">
            <span>رصيد محفظة مدير التطبيق الحالي</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
            {formatCurrency(superAdmin.walletBalance, { withGrouping: true, includeSymbol: false })} <span className="text-xs font-sans text-slate-400">{currencyLabel}</span>
          </div>
          <div className="text-[10px] text-slate-400">صافي المتاح للصرف أو التسوية</div>
        </div>

      </div>

      {/* Multi-Dimensional Filter Controls */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        
        {/* Main Tab Category */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => selectQuickFilter('all')}
              className={`px-3.5 py-2 rounded-xl font-bold transition-colors ${
                selectedTransactionType === 'all' && activeFilter === 'all'
                  ? 'bg-purple-500 text-slate-950 shadow-md'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              الكل (كشف حساب عام شامل)
            </button>

            <button
              onClick={() => selectQuickFilter('fees')}
              className={`px-3.5 py-2 rounded-xl font-bold transition-colors ${
                activeFilter === 'fees'
                  ? 'bg-purple-500 text-slate-950 shadow-md'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              رسوم العمليات المحصلة
            </button>

            <button
              onClick={() => selectQuickFilter('deposits')}
              className={`px-3.5 py-2 rounded-xl font-bold transition-colors ${
                activeFilter === 'deposits'
                  ? 'bg-purple-500 text-slate-950 shadow-md'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              حركات إيداع وشحن الرصيد
            </button>

            <button
              onClick={() => selectQuickFilter('settlements')}
              className={`px-3.5 py-2 rounded-xl font-bold transition-colors ${
                activeFilter === 'settlements'
                  ? 'bg-purple-500 text-slate-950 shadow-md'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              تسويات الحساب البنكي
            </button>

            <button
              onClick={() => selectQuickFilter('transfers')}
              className={`px-3.5 py-2 rounded-xl font-bold transition-colors ${
                activeFilter === 'transfers'
                  ? 'bg-purple-500 text-slate-950 shadow-md'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              تحويلات رصيد نقاط البيع
            </button>
          </div>

          {(selectedSupplierId !== 'all' || selectedServiceId !== 'all' || selectedTransactionType !== 'all' || searchQuery || dateFrom || dateTo || activeFilter !== 'all') && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-amber-400 hover:underline px-2 py-1"
            >
              إعادة تعيين الفلاتر
            </button>
          )}
        </div>

        {/* Detailed Dropdown Filters (نوع الحركة / لكل متجر / لكل خدمة / بحث / تاريخ) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Transaction Type Selector (Dynamic from Admin Interface Settings) */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
              <ListFilter className="w-3.5 h-3.5 text-purple-400" />
              <span>نوع الحركة:</span>
            </label>
            <select
              value={selectedTransactionType}
              onChange={e => handleTypeDropdownChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:border-purple-500 focus:outline-none"
            >
              <option value="all">جميع الحركات</option>
              {adminTypeOptions.map(opt => (
                <option key={opt.id} value={opt.value}>
                  {opt.labelAr}
                </option>
              ))}
            </select>
          </div>
          
          {/* Supplier Selector */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-purple-400" />
              <span>كشف حساب لكل متجر:</span>
            </label>
            <select
              value={selectedSupplierId}
              onChange={e => setSelectedSupplierId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:border-purple-500 focus:outline-none"
            >
              <option value="all">جميع المتاجر ({suppliers.length} متاجرن)</option>
              {suppliers.map(sup => (
                <option key={sup.id} value={sup.id}>
                  {sup.name} ({sup.storeName})
                </option>
              ))}
            </select>
          </div>

          {/* Service Selector */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>كشف حساب لكل خدمة:</span>
            </label>
            <select
              value={selectedServiceId}
              onChange={e => setSelectedServiceId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:border-purple-500 focus:outline-none"
            >
              <option value="all">جميع الخدمات الرقمية ({services.length} خدمة)</option>
              {services.map(srv => (
                <option key={srv.id} value={srv.id}>
                  {srv.nameAr}
                </option>
              ))}
            </select>
          </div>

          {/* Date range filter */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span>الفترة (من تاريخ - إلى تاريخ):</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-[11px] text-white focus:border-purple-500 focus:outline-none"
                placeholder="من"
              />
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-[11px] text-white focus:border-purple-500 focus:outline-none"
                placeholder="إلى"
              />
            </div>
          </div>

          {/* Search Input */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>بحث بالنص أو رقم المرجع:</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="رقم طلب، اسم نقطة بيع، آيدي..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:border-purple-500 focus:outline-none pr-8"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-3" />
            </div>
          </div>

        </div>

        {/* Current Filter Active Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px] text-slate-400">
          <span className="text-slate-500 font-medium">محدد حالياً:</span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-purple-300">
            {getFilterSummaryText()}
          </span>
          <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
            {filteredEntries.length} قيد محاسبي
          </span>
        </div>

      </div>

      {/* Accounting Entries Table / Ledger */}
      <div id="admin-statement-table-to-export" className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        
        {/* Table Title Bar */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-white text-sm">دفتر الأستاذ العام وقيود حساب مدير التطبيق</span>
            <span className="text-slate-400 text-xs mr-2">({filteredEntries.length} سجل محاسبي)</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-emerald-400">
              إجمالي الدائن (المقبوض): {formatCurrency(totalCredits, { sign: 'credit' })}
            </span>
            <span className="text-rose-400">
              إجمالي المدين (المدفوع): {formatCurrency(totalDebits, { sign: 'debit' })}
            </span>
          </div>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <FileText className="w-10 h-10 text-slate-600 mx-auto" />
            <div className="text-base font-bold text-white">لا توجد قيود محاسبية مطابقة للفلاتر الحالية</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              جرب تغيير خيار المتجر أو الخدمة أو نوع العملية لعرض حركات أخرى من كشف الحساب.
            </p>
            <button
              onClick={handleResetFilters}
              className="mt-2 px-3 py-1.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold"
            >
              عرض جميع القيود
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto touch-scroll scrollbar-none">
            <table className="w-full min-w-[760px] text-right text-xs">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">التاريخ والوقت</th>
                  <th className="py-3 px-4">نوع القيد المحاسبي</th>
                  <th className="py-3 px-4">رقم المرجع</th>
                  <th className="py-3 px-4">المتجر والخدمة / نقطة البيع</th>
                  <th className="py-3 px-4">بيان العملية والتفاصيل</th>
                  <th className="py-3 px-4 text-left">مدين (خصم)</th>
                  <th className="py-3 px-4 text-left">دائن (رسوم مقبوضة)</th>
                  <th className="py-3 px-4 text-left">الرصيد بعد القيد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredEntries.map((entry) => {
                  const isFee = entry.type === 'fee_collected';
                  const isDeposit = entry.type === 'deposit_received';
                  const isSettlement = entry.type === 'bank_settlement';
                  const isTransfer = entry.type === 'agent_transfer';

                  return (
                    <tr key={entry.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Date */}
                      <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap text-[11px]">
                        {entry.date}
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isFee && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                            <Percent className="w-3 h-3 text-purple-400" />
                            <span>رسوم منصة</span>
                          </span>
                        )}
                        {isDeposit && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                            <Coins className="w-3 h-3 text-cyan-400" />
                            <span>شحن رصيد مسبق</span>
                          </span>
                        )}
                        {isSettlement && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            <Landmark className="w-3 h-3 text-emerald-400" />
                            <span>تسوية بنكية</span>
                          </span>
                        )}
                        {isTransfer && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                            <Send className="w-3 h-3 text-amber-400" />
                            <span>تحويل لوكيل</span>
                          </span>
                        )}
                      </td>

                      {/* Reference */}
                      <td className="py-3.5 px-4 font-mono text-purple-300 font-semibold whitespace-nowrap text-[11px]">
                        #{entry.referenceId}
                      </td>

                      {/* Supplier / Service / POS */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 min-w-[140px]">
                          {entry.supplierName && (
                            <div className="font-semibold text-white flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-purple-400 shrink-0" />
                              <span className="truncate">{entry.supplierName}</span>
                            </div>
                          )}
                          {entry.serviceName && (
                            <div className="text-[11px] text-amber-400 flex items-center gap-1">
                              <Flame className="w-3 h-3 text-amber-400 shrink-0" />
                              <span className="truncate">{entry.serviceName}</span>
                            </div>
                          )}
                          {entry.posName && (
                            <div className="text-[10px] text-slate-400">
                              نقطة البيع: {entry.posName} {entry.posCode ? `(${entry.posCode})` : ''}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Description & Notes */}
                      <td className="py-3.5 px-4">
                        <div className="text-slate-200 text-xs font-medium">
                          {entry.description}
                        </div>
                        {entry.notes && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {entry.notes}
                          </div>
                        )}
                        {entry.grossAmount && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            قيمة العملية الأصلية: {formatCurrency(entry.grossAmount)}
                          </div>
                        )}
                      </td>

                      {/* Debit (سحب / تسوية) */}
                      <td className="py-3.5 px-4 text-left font-mono whitespace-nowrap">
                        {entry.debit > 0 ? (
                          <span className="font-bold text-rose-400">
                            {formatCurrency(entry.debit, { sign: 'debit' })}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>

                      {/* Credit (رسوم مقبوضة) */}
                      <td className="py-3.5 px-4 text-left font-mono whitespace-nowrap">
                        {entry.credit > 0 ? (
                          <span className="font-bold text-emerald-400">
                            {formatCurrency(entry.credit, { sign: 'credit' })}
                          </span>
                        ) : (
                          <span className="text-slate-600">
                            {isDeposit ? <span className="text-cyan-400/80 text-[10px]">إيداع معتمد</span> : '-'}
                          </span>
                        )}
                      </td>

                      {/* Balance After */}
                      <td className="py-3.5 px-4 text-left font-mono font-bold text-white whitespace-nowrap tabular-nums">
                        {formatCurrency(entry.balanceAfter, { withGrouping: true, includeSymbol: false })}{' '}
                        <span className="text-[10px] text-slate-400 font-sans">{currencyLabel}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Table Footer with Summary totals */}
              <tfoot className="bg-slate-950 text-slate-300 font-semibold border-t-2 border-slate-700">
                <tr>
                  <td colSpan={5} className="py-3.5 px-4 text-right">
                    <span>المجموع الإجمالي للقيود المعروضة ({filteredEntries.length} قيد)</span>
                  </td>
                  <td className="py-3.5 px-4 text-left font-mono text-rose-400">
                    {formatCurrency(totalDebits, { sign: 'debit' })}
                  </td>
                  <td className="py-3.5 px-4 text-left font-mono text-emerald-400">
                    {formatCurrency(totalCredits, { sign: 'credit' })}
                  </td>
                  <td className="py-3.5 px-4 text-left font-mono text-purple-300">
                    {formatCurrency(superAdmin.walletBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

      </div>

    </div>
  );
};
