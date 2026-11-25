import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AdminStatementView } from './AdminStatementView';
import { AdminInterfaceSettingsView } from './AdminInterfaceSettingsView';
import { AdminAccountsView } from './AdminAccountsView';
import {
  AdminStoreSupervisionModal,
  StoreSupervisionTab
} from './AdminStoreSupervisionModal';
import {
  AdminDashboardTab,
  getFirstAllowedAdminTab,
  isAdminTabAllowed,
  resolveEffectiveAdminPermissions
} from '../../utils/adminAccounts';
import {
  computeStoreSupervisionMetrics,
  filterSuppliersForAdmin,
  isSupplierActive
} from '../../utils/storeSupervision';
import {
  PlatformFeesConfig,
  ServiceFeeRule,
} from '../../types';
import {
  ClientFeeServiceKey,
  getEffectivePlatformFeesConfig,
  SupplierFeeServiceKey,
} from '../../utils/pricing';
import { 
  ShieldCheck, 
  Wallet, 
  Percent, 
  Building2, 
  ArrowRight, 
  Send, 
  Landmark, 
  Copy, 
  Check, 
  PlusCircle, 
  Users, 
  Sliders, 
  FileText,
  Trash2,
  UserCog,
  AlertCircle,
  LogOut,
  Search,
  Eye,
  Edit3,
  Activity,
  Power,
  CheckCircle2,
  XCircle,
  Store,
  Clock,
  RefreshCw
} from 'lucide-react';
import { getBalanceRequestAvailability } from '../../utils/availabilityMessages';
import { AppearanceControlModal } from '../common/AppearanceControlModal';
import {
  getAppearanceVisibilitySummary,
  isPageElementVisible,
} from '../../utils/appearanceSettings';

export const AdminDashboard: React.FC = () => {
  const { 
    role,
    currentUser,
    superAdmin, 
    suppliers,
    supplier, 
    posClients, 
    orders,
    depositRequests,
    loanRepaymentRequests,
    accountingEntries,
    adminAccountingEntries,
    services,
    voucherWarehouses,
    catalogs,
    supplierBankAccounts,
    addSupplier,
    updateSupplierFeeConfig, 
    toggleSupplierActiveStatus,
    updateGlobalFeeConfig, 
    adminSettleBank, 
    adminTransferToAgent,
    activeNavTab,
    setActiveNavTab,
    showToast,
    clearUsersSuppliersAndClientsData,
    activeCurrency,
    activeExchangeRate,
    currencyLabel,
    convertFromSar,
    convertToSar,
    formatCurrency,
    logout,
    getMyAppearanceSettings,
    updateMyAppearanceSettings,
    syncAllToFirestore,
    isSyncingWithFirestore
  } = useApp();

  const [showAppearanceModal, setShowAppearanceModal] = useState(false);
  const adminAppearance = getMyAppearanceSettings('super_admin');
  const adminAppearanceSummary = getAppearanceVisibilitySummary('super_admin', adminAppearance);
  const isAdminElVisible = (key: string) => isPageElementVisible(adminAppearance, key);

  const perms = resolveEffectiveAdminPermissions(currentUser, role);
  const canViewAdminWallet = perms.canViewStatement || perms.canSettleAdminWallet;

  // Local admin tab switcher (syncs with global activeNavTab and enforces permissions)
  const [adminSubTab, setAdminSubTab] = useState<AdminDashboardTab>(() => {
    const candidate = activeNavTab as AdminDashboardTab;
    if (
      ['statement', 'overview', 'fees', 'interface_settings', 'admin_accounts'].includes(candidate) &&
      isAdminTabAllowed(candidate, perms)
    ) {
      return candidate;
    }
    return getFirstAllowedAdminTab(perms);
  });

  useEffect(() => {
    const candidate = activeNavTab as AdminDashboardTab;
    const isValidTab = ['statement', 'overview', 'fees', 'interface_settings', 'admin_accounts'].includes(candidate);

    if (isValidTab && isAdminTabAllowed(candidate, perms)) {
      if (adminSubTab !== candidate) {
        setAdminSubTab(candidate);
      }
      return;
    }

    if (!isAdminTabAllowed(adminSubTab, perms)) {
      const firstAllowed = getFirstAllowedAdminTab(perms);
      setAdminSubTab(firstAllowed);
      if (activeNavTab !== firstAllowed) {
        setActiveNavTab(firstAllowed);
      }
    }
  }, [
    activeNavTab,
    adminSubTab,
    perms.canViewStatement,
    perms.canSettleAdminWallet,
    perms.canManageSuppliers,
    perms.canManageFees,
    perms.canManageInterfaceSettings,
    perms.canManageAdminAccounts,
    setActiveNavTab
  ]);

  const handleSelectAdminTab = (tab: AdminDashboardTab) => {
    if (!isAdminTabAllowed(tab, perms)) return;
    setAdminSubTab(tab);
    setActiveNavTab(tab);
  };

  type ServiceRuleDraft = {
    feeType: 'percentage' | 'fixed' | 'both';
    percentage: number;
    fixedDisplay: string;
    fixedSarBase: number;
    isFixedDirty: boolean;
  };

  type PlatformFeesDraft = {
    supplierServices: Record<SupplierFeeServiceKey, ServiceRuleDraft>;
    clientServices: Record<ClientFeeServiceKey, ServiceRuleDraft>;
  };

  const toServiceRuleDraft = (rule: ServiceFeeRule): ServiceRuleDraft => ({
    feeType: rule.feeType,
    percentage: rule.percentage ?? 0,
    fixedDisplay: String(Number(convertFromSar(rule.fixedAmount ?? 0).toFixed(2))),
    fixedSarBase: rule.fixedAmount ?? 0,
    isFixedDirty: false,
  });

  const buildDraftFromConfig = (cfg: PlatformFeesConfig): PlatformFeesDraft => ({
    supplierServices: {
      supportGrant: toServiceRuleDraft(cfg.supplierServices.supportGrant),
      loanGrant: toServiceRuleDraft(cfg.supplierServices.loanGrant),
      saleToClient: toServiceRuleDraft(cfg.supplierServices.saleToClient),
    },
    clientServices: {
      depositRequest: toServiceRuleDraft(cfg.clientServices.depositRequest),
      loanRequest: toServiceRuleDraft(cfg.clientServices.loanRequest),
      servicePurchase: toServiceRuleDraft(cfg.clientServices.servicePurchase),
      balanceTransfer: toServiceRuleDraft(cfg.clientServices.balanceTransfer || cfg.clientServices.servicePurchase),
    },
  });

  const draftRuleToSarRule = (draft: ServiceRuleDraft): ServiceFeeRule => ({
    feeType: draft.feeType,
    percentage: Math.max(0, Number(draft.percentage) || 0),
    fixedAmount: draft.isFixedDirty
      ? convertToSar(Math.max(0, Number(draft.fixedDisplay) || 0))
      : (draft.fixedSarBase ?? 0),
  });

  const draftToPlatformFeesConfig = (draft: PlatformFeesDraft): PlatformFeesConfig => ({
    supplierServices: {
      supportGrant: draftRuleToSarRule(draft.supplierServices.supportGrant),
      loanGrant: draftRuleToSarRule(draft.supplierServices.loanGrant),
      saleToClient: draftRuleToSarRule(draft.supplierServices.saleToClient),
    },
    clientServices: {
      depositRequest: draftRuleToSarRule(draft.clientServices.depositRequest),
      loanRequest: draftRuleToSarRule(draft.clientServices.loanRequest),
      servicePurchase: draftRuleToSarRule(draft.clientServices.servicePurchase),
      balanceTransfer: draftRuleToSarRule(draft.clientServices.balanceTransfer),
    },
  });

  const [feesScope, setFeesScope] = useState<'global' | 'supplier'>('global');

  // Settings state for Global two-section fees
  const [globalFeesDraft, setGlobalFeesDraft] = useState<PlatformFeesDraft>(() =>
    buildDraftFromConfig(getEffectivePlatformFeesConfig(undefined, superAdmin))
  );

  // Settings state for per-supplier two-section fees
  const [selectedSupplierForFee, setSelectedSupplierForFee] = useState<string>(supplier.id || suppliers[0]?.id || '');
  const activeSelectedSup = suppliers.find(s => s.id === selectedSupplierForFee) || suppliers[0] || supplier;
  const [supplierFeesDraft, setSupplierFeesDraft] = useState<PlatformFeesDraft>(() =>
    buildDraftFromConfig(getEffectivePlatformFeesConfig(activeSelectedSup, superAdmin))
  );

  useEffect(() => {
    setGlobalFeesDraft(buildDraftFromConfig(getEffectivePlatformFeesConfig(undefined, superAdmin)));
  }, [
    activeCurrency,
    activeExchangeRate,
    superAdmin.defaultFeeType,
    superAdmin.defaultFeePercentage,
    superAdmin.defaultFixedFeeAmount,
    superAdmin.defaultFeesConfig,
  ]);

  useEffect(() => {
    if (!selectedSupplierForFee && suppliers[0]?.id) {
      setSelectedSupplierForFee(suppliers[0].id);
    }
  }, [suppliers, selectedSupplierForFee]);

  useEffect(() => {
    setSupplierFeesDraft(buildDraftFromConfig(getEffectivePlatformFeesConfig(activeSelectedSup, superAdmin)));
  }, [
    activeCurrency,
    activeExchangeRate,
    activeSelectedSup?.id,
    activeSelectedSup?.feeType,
    activeSelectedSup?.feePercentage,
    activeSelectedSup?.fixedFeeAmount,
    activeSelectedSup?.feesConfig,
    superAdmin,
  ]);

  // Add new Supplier Form state
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [newSupName, setNewSupName] = useState('');
  const [newSupStoreName, setNewSupStoreName] = useState('');
  const [newSupPhone, setNewSupPhone] = useState('');
  const [newSupEmail, setNewSupEmail] = useState('');
  const [newSupPassword, setNewSupPassword] = useState('');
  const [newSupBankName, setNewSupBankName] = useState('مصرف الراجحي');
  const [newSupIban, setNewSupIban] = useState('SA');
  const [newSupFeeType, setNewSupFeeType] = useState<'percentage' | 'fixed' | 'both'>('percentage');
  const [newSupFeePercent, setNewSupFeePercent] = useState<number>(1.0);
  const [newSupFixedFee, setNewSupFixedFee] = useState<number>(0.0);

  // Admin Wallet Usage Actions
  const [activeAdminAction, setActiveAdminAction] = useState<'settle_bank' | 'transfer_agent' | null>(null);
  const [settleAmount, setSettleAmount] = useState<number | ''>('');
  const [settleIban, setSettleIban] = useState(superAdmin.bankAccounts[0]?.iban || '');
  const [targetAgentCode, setTargetAgentCode] = useState('');
  const [agentAmount, setAgentAmount] = useState<number | ''>('');

  // Invite supplier link
  const [showSupplierInvite, setShowSupplierInvite] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  // Store Supervision & Management state
  const [storeSearchQuery, setStoreSearchQuery] = useState('');
  const [storeStatusFilter, setStoreStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [supervisedStoreState, setSupervisedStoreState] = useState<{
    supplierId: string;
    initialTab: StoreSupervisionTab;
  } | null>(null);

  const filteredSuppliersList = filterSuppliersForAdmin(
    suppliers,
    storeSearchQuery,
    storeStatusFilter
  );
  const activeSupervisedStore = supervisedStoreState
    ? suppliers.find(s => s.id === supervisedStoreState.supplierId) || null
    : null;

  const handleSaveGlobalFee = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedConfig = draftToPlatformFeesConfig(globalFeesDraft);
    const primaryRule = resolvedConfig.clientServices.servicePurchase;
    updateGlobalFeeConfig({
      feeType: primaryRule.feeType,
      percentage: primaryRule.percentage,
      fixedAmount: primaryRule.fixedAmount,
      defaultFeesConfig: resolvedConfig,
    });
  };

  const handleSaveSupplierFee = (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = selectedSupplierForFee || suppliers[0]?.id;
    if (!targetId) {
      showToast({
        type: 'error',
        title: 'لا يوجد متجر محدد',
        description: 'لا توجد متاجر مسجلة حالياً لتخصيص رسوم لها.'
      });
      return;
    }
    const resolvedConfig = draftToPlatformFeesConfig(supplierFeesDraft);
    const primaryRule = resolvedConfig.clientServices.servicePurchase;
    updateSupplierFeeConfig(targetId, {
      feeType: primaryRule.feeType,
      percentage: primaryRule.percentage,
      fixedAmount: primaryRule.fixedAmount,
      feesConfig: resolvedConfig,
    });
  };

  const handleCreateSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupName.trim() || !newSupStoreName.trim()) return;

    addSupplier({
      name: newSupName.trim(),
      storeName: newSupStoreName.trim(),
      phone: newSupPhone.trim(),
      email: newSupEmail.trim(),
      password: newSupPassword.trim() || undefined,
      feePercentage: Number(newSupFeePercent),
      fixedFeeAmount: convertToSar(Number(newSupFixedFee) || 0),
      feeType: newSupFeeType,
      bankAccountDetails: {
        bankName: newSupBankName,
        accountHolder: newSupStoreName.trim(),
        iban: newSupIban.trim(),
        accountNumber: ''
      }
    });

    setShowAddSupplierModal(false);
    setNewSupName('');
    setNewSupStoreName('');
    setNewSupPhone('');
    setNewSupEmail('');
    setNewSupPassword('');
    setNewSupIban('');
  };

  const settleAmountSar = settleAmount ? convertToSar(Number(settleAmount)) : 0;
  const agentAmountSar = agentAmount ? convertToSar(Number(agentAmount)) : 0;

  const settleAvailability = getBalanceRequestAvailability({
    walletBalance: superAdmin.walletBalance,
    requiredAmount: settleAmountSar,
    walletLabel: 'محفظة الإدارة',
    requestLabel: 'التسوية البنكية',
    currency: activeCurrency,
    exchangeRateSarPerUsd: activeExchangeRate,
  });

  const agentTransferAvailability = getBalanceRequestAvailability({
    walletBalance: superAdmin.walletBalance,
    requiredAmount: agentAmountSar,
    walletLabel: 'محفظة الإدارة',
    requestLabel: 'تحويل الرصيد لنقطة البيع',
    currency: activeCurrency,
    exchangeRateSarPerUsd: activeExchangeRate,
  });

  const handleSettleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleAmount || Number(settleAmount) <= 0) return;
    adminSettleBank(settleAmountSar, settleIban);
    if (superAdmin.walletBalance >= settleAmountSar) {
      setActiveAdminAction(null);
    }
  };

  const handleAgentTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentAmount || Number(agentAmount) <= 0) return;
    adminTransferToAgent(targetAgentCode, agentAmountSar);
    const targetExists = posClients.some(
      p => p.posCode.trim().toUpperCase() === targetAgentCode.trim().toUpperCase()
    );
    if (targetExists && superAdmin.walletBalance >= agentAmountSar) {
      setActiveAdminAction(null);
    }
  };

  const supplierInviteUrl = 'https://digipos.app/register-supplier?admin_token=AUTH-SUP-2026';

  return (
    <div className={adminAppearance.compactMode ? 'space-y-4' : 'space-y-6'}>
      
      {/* Top Admin Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  واجهة مدير التطبيق (Super Admin Dashboard)
                </h1>
                {currentUser?.adminAccountId && (
                  <span className="text-xs font-semibold text-purple-300">
                    · {currentUser.name} ({currentUser.roleTitle || 'مشرف تطبيق'})
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                الإشراف العام على المتاجر والممولين، إدارة الحسابات الإدارية، وضبط نسب ومبالغ الرسوم المقطوعة على العمليات.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {isAdminElVisible('admin_header_actions') && perms.canManageSuppliers && (
              <>
                <button
                  onClick={() => setShowAddSupplierModal(true)}
                  className="px-3 sm:px-3.5 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md min-h-[38px]"
                >
                  <PlusCircle className="w-4 h-4 shrink-0" />
                  <span className="truncate">إضافة متجر جديد</span>
                </button>

                <button
                  onClick={() => setShowSupplierInvite(true)}
                  className="px-3 sm:px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors min-h-[38px]"
                >
                  <Send className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="truncate">رابط تسجيل لمتجر</span>
                </button>
              </>
            )}

            {(perms.canManageSuppliers || perms.canManageAdminAccounts || perms.canClearSystemData) && (
              <button
                type="button"
                onClick={() => void syncAllToFirestore()}
                disabled={isSyncingWithFirestore}
                data-testid="admin-sync-upgrade-db-btn"
                className="px-3 sm:px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-60 text-emerald-300 border border-emerald-500/35 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap min-h-[38px]"
                title="مزامنة الجداول المفصولة (الموظفين والصلاحيات والإشعارات) وترقية هيكل قاعدة البيانات في Firestore"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 shrink-0 ${isSyncingWithFirestore ? 'animate-spin' : ''}`} />
                <span>{isSyncingWithFirestore ? 'جاري الترقية...' : 'مزامنة وترقية قاعدة البيانات'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowAppearanceModal(true)}
              data-testid="admin-appearance-control-btn"
              className="px-3 sm:px-3.5 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 border border-purple-500/35 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap min-h-[38px]"
              title="التحكم بمظهر الصفحة وإخفاء أو إظهار العناصر"
            >
              <Sliders className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>مظهر الصفحة</span>
              {adminAppearanceSummary.hidden > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-purple-500 text-slate-950 font-mono text-[10px] font-black">
                  {adminAppearanceSummary.hidden}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={logout}
              className="px-3 sm:px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[38px]"
              title="تسجيل الخروج والعودة لشاشة الدخول"
            >
              <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
              <span>خروج</span>
            </button>
          </div>
        </div>

        {/* Central Wallet & Platform Stats */}
        {isAdminElVisible('admin_kpi_cards') && (canViewAdminWallet || perms.canManageSuppliers || perms.canManageFees) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-5 border-t border-slate-800/80">
            {canViewAdminWallet && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-purple-500/30 space-y-1">
                <span className="text-[11px] text-purple-300 font-semibold block">
                  محفظة مدير التطبيق (إجمالي رسوم العمليات)
                </span>
                <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
                  {formatCurrency(superAdmin.walletBalance, { withGrouping: true, includeSymbol: false })}{' '}
                  <span className="text-xs text-slate-400 font-sans">{currencyLabel}</span>
                </div>
                <div className="text-[10px] text-slate-400 pt-1">
                  تتجمع تلقائياً من رسوم كل عملية شراء وبيع خدمات أو تحويل رصيد
                </div>
              </div>
            )}

            {(perms.canManageSuppliers || perms.canViewStatement) && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400 block">إجمالي شبكة المتاجر المسجلين</span>
                <div className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
                  {suppliers.length} متاجرن معتمدين
                </div>
                <div className="text-[10px] text-slate-400 pt-1">
                  يشرفون على {posClients.length} نقاط بيع
                </div>
              </div>
            )}

            {(perms.canManageFees || perms.canViewStatement) && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400 block">الرسوم العامة الافتراضية للمنصة</span>
                <div className="text-2xl font-bold font-mono text-cyan-400 tabular-nums">
                  {superAdmin.defaultFeePercentage}% {superAdmin.defaultFixedFeeAmount > 0 ? `+ ${formatCurrency(superAdmin.defaultFixedFeeAmount)}` : ''}
                </div>
                <div className="text-[10px] text-slate-400 pt-1">
                  تطبق على جميع العمليات ما لم يتم تخصيص المتجر
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Admin Navigation Bar */}
      <div className="overflow-x-auto touch-scroll scrollbar-none flex lg:flex-wrap items-center gap-1.5 sm:gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs -mx-1 px-1 sm:mx-0 sm:px-1.5">
        {perms.canViewStatement && (
          <button
            onClick={() => handleSelectAdminTab('statement')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold transition-all whitespace-nowrap shrink-0 min-h-[38px] ${
              adminSubTab === 'statement'
                ? 'bg-purple-500 text-slate-950 shadow-lg shadow-purple-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>كشف حساب مدير التطبيق</span>
          </button>
        )}

        {(perms.canManageSuppliers || perms.canSettleAdminWallet) && (
          <button
            onClick={() => handleSelectAdminTab('overview')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold transition-all whitespace-nowrap shrink-0 min-h-[38px] ${
              adminSubTab === 'overview'
                ? 'bg-purple-500 text-slate-950 shadow-lg shadow-purple-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            <span>إشراف المتاجر والمحافظ</span>
          </button>
        )}

        {perms.canManageFees && (
          <button
            onClick={() => handleSelectAdminTab('fees')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold transition-all whitespace-nowrap shrink-0 min-h-[38px] ${
              adminSubTab === 'fees'
                ? 'bg-purple-500 text-slate-950 shadow-lg shadow-purple-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Percent className="w-4 h-4 shrink-0" />
            <span>إعدادات الرسوم</span>
          </button>
        )}

        {perms.canManageInterfaceSettings && (
          <button
            onClick={() => handleSelectAdminTab('interface_settings')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold transition-all whitespace-nowrap shrink-0 min-h-[38px] ${
              adminSubTab === 'interface_settings'
                ? 'bg-purple-500 text-slate-950 shadow-lg shadow-purple-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Sliders className="w-4 h-4 shrink-0" />
            <span>إعدادات الواجهات والقوائم</span>
          </button>
        )}

        {perms.canManageAdminAccounts && (
          <button
            onClick={() => handleSelectAdminTab('admin_accounts')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold transition-all whitespace-nowrap shrink-0 min-h-[38px] ${
              adminSubTab === 'admin_accounts'
                ? 'bg-purple-500 text-slate-950 shadow-lg shadow-purple-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <UserCog className="w-4 h-4 shrink-0" />
            <span>حسابات إدارة التطبيق ({(superAdmin.adminAccounts || []).length})</span>
          </button>
        )}

        {isAdminElVisible('admin_reset_button') && perms.canClearSystemData && (
          <button
            type="button"
            data-testid="admin-reset-system-btn"
            onClick={() => setShowResetConfirmModal(true)}
            className="mr-auto flex items-center gap-1.5 px-3.5 py-2 sm:py-2.5 rounded-xl text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all font-semibold whitespace-nowrap shrink-0 min-h-[38px]"
            title="تصفير الخدمات والمستخدمين مع الإبقاء على مدير التطبيق وموظفيه"
          >
            <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
            <span>تصفير النظام</span>
          </button>
        )}
      </div>

      {/* View 1: Detailed Admin Statement View */}
      {adminSubTab === 'statement' && perms.canViewStatement && (
        <AdminStatementView />
      )}

      {/* View 1B: Interface Settings, Fixed Catalogs & Dynamic Dropdowns */}
      {adminSubTab === 'interface_settings' && perms.canManageInterfaceSettings && (
        <AdminInterfaceSettingsView />
      )}

      {/* View 1C: Admin Accounts & Granular Permissions Management */}
      {adminSubTab === 'admin_accounts' && perms.canManageAdminAccounts && (
        <AdminAccountsView />
      )}

      {/* View 2: Platform Overview & Wallet Usage */}
      {adminSubTab === 'overview' && (perms.canManageSuppliers || perms.canSettleAdminWallet) && (
        <>
          {/* Admin Wallet Usage Operations */}
          {isAdminElVisible('admin_wallet_actions') && perms.canSettleAdminWallet && (
            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-amber-400" />
                  <span>خيارات استخدام مبالغ محفظة مدير التطبيق</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  حسب المواصفات: يمكن لمدير التطبيق تسوية مبالغه واستلامها بنكياً من المتجر، أو تحويل رصيد لنقاط البيع، أو شراء وبيع خدمات.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Action A: Settle to bank account from supplier */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-bold text-white">
                      <Landmark className="w-4 h-4 text-emerald-400" />
                      <span>تسوية الرصيد واستلام قيمته من الحساب البنكي للمتجر</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      خصم المبلغ من محفظة مدير التطبيق وتأكيد استلام قيمته من الحساب البنكي للمتجر ({suppliers.length > 0 ? supplier.name : 'غير محدد'}) وإضافتها لحساب مدير التطبيق البنكي.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveAdminAction('settle_bank')}
                    className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>تسوية وسحب رصيد بنكي</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Action B: Transfer balance to POS agents */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-bold text-white">
                      <Send className="w-4 h-4 text-cyan-400" />
                      <span>تحويل رصيد من المحفظة إلى نقاط البيع والوكلاء</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      استخدام مبالغ محفظة الإدارة في شحن محافظ الوكلاء مباشرة عبر معرف العميل.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveAdminAction('transfer_agent')}
                    className="py-2.5 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>تحويل رصيد لنقطة بيع</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* List of Registered Suppliers under Supervision */}
          {perms.canManageSuppliers && (
            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-purple-400" />
                    <span>إشراف وإدارة المتاجر المعتمدين</span>
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    افتح لوحة إشراف أي متجر للاطلاع على بياناته الشخصية وتعديلها، مراجعة عملائه، ومتابعة حركة طلباته وسلفه وقيوده المحاسبية.
                  </p>
                </div>
                <span className="text-xs text-slate-400 font-mono shrink-0">
                  الإجمالي: {suppliers.length} متجر ({suppliers.filter(s => isSupplierActive(s)).length} نشط)
                </span>
              </div>

              {/* Search & Status Filters */}
              {isAdminElVisible('admin_store_filters') && suppliers.length > 0 && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={storeSearchQuery}
                      onChange={e => setStoreSearchQuery(e.target.value)}
                      placeholder="ابحث باسم المتجر، اسم المالك، البريد، الهاتف، المدينة أو الآيبان..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-white text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(['all', 'active', 'suspended'] as const).map(statusKey => (
                      <button
                        key={statusKey}
                        type="button"
                        onClick={() => setStoreStatusFilter(statusKey)}
                        className={`px-3 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                          storeStatusFilter === statusKey
                            ? 'bg-purple-500 text-slate-950 border-purple-400'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {statusKey === 'all' ? 'الكل' : statusKey === 'active' ? 'نشط' : 'موقوف'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!isAdminElVisible('admin_stores_grid') ? (
                <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 text-center text-slate-400">
                  تم إخفاء قائمة وبطاقات المتاجر من إعدادات مظهر الصفحة. يمكنك إظهارها من زر «مظهر الصفحة» أعلى الشاشة.
                </div>
              ) : suppliers.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center text-slate-400">
                  لا توجد متاجر أو ممولون مسجلون حالياً. يمكنك إضافة متجر جديد من زر &quot;إضافة ممول / متجر جديد&quot;.
                </div>
              ) : filteredSuppliersList.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center text-slate-400">
                  لا توجد متاجر مطابقة لمعايير البحث أو التصفية الحالية.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredSuppliersList.map(sup => {
                    const supActive = isSupplierActive(sup);
                    const supMetrics = computeStoreSupervisionMetrics({
                      supplier: sup,
                      posClients,
                      orders,
                      depositRequests,
                      loanRepaymentRequests,
                      accountingEntries,
                      adminAccountingEntries,
                      services,
                      voucherWarehouses,
                      catalogs,
                      supplierBankAccounts,
                    });

                    return (
                      <div
                        key={sup.id}
                        className={`p-4 rounded-2xl bg-slate-950 border flex flex-col justify-between gap-3 transition-colors ${
                          supActive
                            ? 'border-slate-800 hover:border-purple-500/40'
                            : 'border-rose-500/30 bg-rose-950/10'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                                {sup.logoUrl ? (
                                  <img
                                    src={sup.logoUrl}
                                    alt={sup.storeName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Building2 className="w-5 h-5 text-purple-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="font-bold text-sm text-white truncate">
                                    {sup.storeName}
                                  </h4>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                                      supActive
                                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                        : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                    }`}
                                  >
                                    {supActive ? (
                                      <>
                                        <CheckCircle2 className="w-2.5 h-2.5" />
                                        <span>نشط</span>
                                      </>
                                    ) : (
                                      <>
                                        <XCircle className="w-2.5 h-2.5" />
                                        <span>موقوف</span>
                                      </>
                                    )}
                                  </span>
                                </div>
                                <div className="text-slate-300 text-[11px] truncate">
                                  المالك: {sup.name}
                                </div>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20 shrink-0">
                              رسوم: {sup.feePercentage}% {sup.fixedFeeAmount > 0 ? `+ ${formatCurrency(sup.fixedFeeAmount)}` : ''}
                            </span>
                          </div>

                          <div className="text-slate-400 text-[11px] flex flex-wrap items-center gap-2">
                            <span dir="ltr" className="font-mono">{sup.phone || '-'}</span>
                            <span>·</span>
                            <span dir="ltr" className="font-mono">{sup.email}</span>
                            {(sup.country || sup.city) && (
                              <>
                                <span>·</span>
                                <span>{[sup.country, sup.city].filter(Boolean).join(' / ')}</span>
                              </>
                            )}
                          </div>
                          <div className="text-slate-500 text-[10px] font-mono">
                            البنك: {sup.bankAccountDetails.bankName || 'غير محدد'} ({sup.bankAccountDetails.iban || 'بدون آيبان'})
                          </div>

                          {/* Store Quick Metrics Grid */}
                          <div className="grid grid-cols-4 gap-1.5 pt-1 text-center">
                            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800/80">
                              <span className="text-[9px] text-slate-400 block">العملاء</span>
                              <strong className="font-mono text-cyan-300">{supMetrics.clientsCount}</strong>
                            </div>
                            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800/80">
                              <span className="text-[9px] text-slate-400 block">الطلبات</span>
                              <strong className="font-mono text-amber-300">{supMetrics.ordersCount}</strong>
                            </div>
                            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800/80">
                              <span className="text-[9px] text-slate-400 block">الموظفين</span>
                              <strong className="font-mono text-slate-200">{supMetrics.employeesCount}</strong>
                            </div>
                            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800/80">
                              <span className="text-[9px] text-slate-400 block">رسوم المنصة</span>
                              <strong className="font-mono text-purple-300 text-[10px]">
                                {formatCurrency(supMetrics.totalPlatformFeesEarned)}
                              </strong>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2.5 pt-2 border-t border-slate-800">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">رصيد مبيعات المتجر:</span>
                            <strong className="text-emerald-400 font-mono font-bold tabular-nums">
                              {formatCurrency(sup.walletBalance, { withGrouping: true })}
                            </strong>
                          </div>

                          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setSupervisedStoreState({ supplierId: sup.id, initialTab: 'overview' })
                              }
                              className="col-span-2 sm:flex-1 px-3 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[36px]"
                            >
                              <Eye className="w-3.5 h-3.5 shrink-0" />
                              <span>إشراف وإدارة المتجر</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setSupervisedStoreState({ supplierId: sup.id, initialTab: 'profile' })
                              }
                              className="px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer min-h-[36px]"
                              title="البيانات الشخصية والبنكية"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>البيانات</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setSupervisedStoreState({ supplierId: sup.id, initialTab: 'clients' })
                              }
                              className="px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer min-h-[36px]"
                              title="عرض عملاء المتجر"
                            >
                              <Users className="w-3.5 h-3.5 shrink-0" />
                              <span>العملاء</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setSupervisedStoreState({ supplierId: sup.id, initialTab: 'activity' })
                              }
                              className="px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-700 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer min-h-[36px]"
                              title="عرض حركة المتجر"
                            >
                              <Activity className="w-3.5 h-3.5 shrink-0" />
                              <span>الحركة</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleSupplierActiveStatus(sup.id)}
                              className={`p-2 rounded-xl border transition-colors cursor-pointer flex items-center justify-center min-h-[36px] ${
                                supActive
                                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              }`}
                              title={supActive ? 'إيقاف المتجر مؤقتاً' : 'إعادة تفعيل المتجر'}
                            >
                              <Power className="w-3.5 h-3.5 shrink-0" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* View 3: Two-Section Fee Settings (Global vs Per-Supplier) */}
      {adminSubTab === 'fees' && perms.canManageFees && (() => {
        const isGlobalScope = feesScope === 'global';
        const activeDraft = isGlobalScope ? globalFeesDraft : supplierFeesDraft;
        const setActiveDraft = isGlobalScope ? setGlobalFeesDraft : setSupplierFeesDraft;
        const accentColor = isGlobalScope ? 'amber' : 'purple';

        const updateSupplierServiceDraft = (
          key: SupplierFeeServiceKey,
          patch: Partial<ServiceRuleDraft>
        ) => {
          setActiveDraft(prev => ({
            ...prev,
            supplierServices: {
              ...prev.supplierServices,
              [key]: { ...prev.supplierServices[key], ...patch },
            },
          }));
        };

        const updateClientServiceDraft = (
          key: ClientFeeServiceKey,
          patch: Partial<ServiceRuleDraft>
        ) => {
          setActiveDraft(prev => ({
            ...prev,
            clientServices: {
              ...prev.clientServices,
              [key]: { ...prev.clientServices[key], ...patch },
            },
          }));
        };

        const supplierServiceRows: Array<{
          key: SupplierFeeServiceKey;
          title: string;
          subtitle: string;
        }> = [
          {
            key: 'supportGrant',
            title: 'خدمة دعم الرصيد للعميل',
            subtitle: 'تُخصم من المورد وتُودع للإدارة عند منح رصيد مجاني / دعم للعميل',
          },
          {
            key: 'loanGrant',
            title: 'خدمة شحن سلفة للعميل',
            subtitle: 'تُخصم من المورد وتُودع للإدارة عند شحن سلفة آجل مباشرة للعميل',
          },
          {
            key: 'saleToClient',
            title: 'خدمة بيع للعميل',
            subtitle: 'تُخصم من استحقاق المورد وتُودع للإدارة فقط بعد إتمام الشحن والتسليم',
          },
        ];

        const clientServiceRows: Array<{
          key: ClientFeeServiceKey;
          title: string;
          subtitle: string;
        }> = [
          {
            key: 'depositRequest',
            title: 'خدمة طلب شحن رصيد',
            subtitle: 'تُخصم من مبلغ الشحن وتُودع للإدارة فقط بعد اعتماد الطلب واكتماله',
          },
          {
            key: 'loanRequest',
            title: 'خدمة طلب سلفة',
            subtitle: 'تُخصم وتُودع للإدارة فقط بعد الموافقة على السلفة وقيد الرصيد',
          },
          {
            key: 'servicePurchase',
            title: 'خدمة شراء خدمة',
            subtitle: 'تُخصم وتُودع للإدارة فقط بعد إتمام الطلب والشحن بالكامل (وتشمل نسبة الهدايا)',
          },
          {
            key: 'balanceTransfer',
            title: 'خدمة تحويل رصيد بين العملاء',
            subtitle: 'تُخصم من المرسل وتُودع للإدارة عند تنفيذ التحويل الفوري',
          },
        ];

        const renderServiceFeeCard = (
          title: string,
          subtitle: string,
          rule: ServiceRuleDraft,
          onChange: (patch: Partial<ServiceRuleDraft>) => void
        ) => (
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
            <div>
              <div className="font-bold text-xs text-white">{title}</div>
              <p className="text-[10.5px] text-slate-400 mt-0.5 leading-relaxed">{subtitle}</p>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => onChange({ feeType: 'percentage' })}
                className={`py-1.5 px-2 rounded-lg border text-[11px] text-center transition-colors cursor-pointer ${
                  rule.feeType === 'percentage'
                    ? isGlobalScope
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-500'
                      : 'bg-purple-500 text-slate-950 font-bold border-purple-500'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                نسبة (%)
              </button>
              <button
                type="button"
                onClick={() => onChange({ feeType: 'fixed' })}
                className={`py-1.5 px-2 rounded-lg border text-[11px] text-center transition-colors cursor-pointer ${
                  rule.feeType === 'fixed'
                    ? isGlobalScope
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-500'
                      : 'bg-purple-500 text-slate-950 font-bold border-purple-500'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                مبلغ ({currencyLabel})
              </button>
              <button
                type="button"
                onClick={() => onChange({ feeType: 'both' })}
                className={`py-1.5 px-2 rounded-lg border text-[11px] text-center transition-colors cursor-pointer ${
                  rule.feeType === 'both'
                    ? isGlobalScope
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-500'
                      : 'bg-purple-500 text-slate-950 font-bold border-purple-500'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                نسبة + مبلغ
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(rule.feeType === 'percentage' || rule.feeType === 'both') && (
                <div className={rule.feeType === 'percentage' ? 'col-span-2' : ''}>
                  <label className="block text-[10.5px] text-slate-400 mb-1">النسبة المئوية (%):</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="25"
                    value={rule.percentage}
                    onChange={e => onChange({ percentage: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 font-mono font-bold text-white text-center text-xs"
                  />
                </div>
              )}

              {(rule.feeType === 'fixed' || rule.feeType === 'both') && (
                <div className={rule.feeType === 'fixed' ? 'col-span-2' : ''}>
                  <label className="block text-[10.5px] text-slate-400 mb-1">المبلغ المقطوع ({currencyLabel}):</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={rule.fixedDisplay}
                    onChange={e => onChange({ fixedDisplay: e.target.value, isFixedDirty: true })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 font-mono font-bold text-white text-center text-xs"
                  />
                </div>
              )}
            </div>
          </div>
        );

        return (
          <div className="space-y-4">
            {/* Scope & Completion Policy Header */}
            <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 text-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <Percent className={`w-4 h-4 ${accentColor === 'amber' ? 'text-amber-400' : 'text-purple-400'}`} />
                    <span>إدارة نسب ورسوم التطبيق (قسم خدمات المورد + قسم خدمات عملائه)</span>
                  </h3>
                  <p className="text-slate-400 text-[11px] mt-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>سياسة التحصيل: لا يتم خصم الرسوم أو إيداعها في حساب مدير التطبيق إلا بعد استكمال الخدمة فعلياً (بعد الطلب وإتمام الشحن أو الاعتماد).</span>
                  </p>
                </div>

                {/* Scope Selector: Global vs Specific Store */}
                <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-950 border border-slate-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => setFeesScope('global')}
                    className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isGlobalScope
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Percent className="w-3.5 h-3.5" />
                    <span>الرسوم العامة (للكل)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeesScope('supplier')}
                    className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                      !isGlobalScope
                        ? 'bg-purple-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>تخصيص لمتجر محدد</span>
                  </button>
                </div>
              </div>

              {!isGlobalScope && (
                <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-purple-200 font-semibold">
                    <Store className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>اختر المتجر المراد تخصيص رسوم خدماته وخدمات عملائه:</span>
                  </div>
                  <select
                    value={selectedSupplierForFee}
                    onChange={e => setSelectedSupplierForFee(e.target.value)}
                    className="sm:min-w-[260px] bg-slate-950 border border-purple-500/40 rounded-xl px-3 py-2 text-xs text-white font-semibold"
                  >
                    {suppliers.length === 0 ? (
                      <option value="">لا توجد متاجر مسجلة حالياً</option>
                    ) : (
                      suppliers.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.storeName})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}
            </div>

            {/* Two-Section Form */}
            <form
              onSubmit={isGlobalScope ? handleSaveGlobalFee : handleSaveSupplierFee}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Section 1: Supplier Services */}
                <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
                  <div className="border-b border-slate-800 pb-3">
                    <h4 className="font-bold text-sm text-white flex items-center gap-2">
                      <Store className="w-4 h-4 text-cyan-400" />
                      <span>القسم الأول: رسوم خدمات المورد</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      الرسوم المفروضة على المتجر (المورد) عند تنفيذ خدماته لعملائه واستكمالها.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {supplierServiceRows.map(row => (
                      <React.Fragment key={row.key}>
                        {renderServiceFeeCard(
                          row.title,
                          row.subtitle,
                          activeDraft.supplierServices[row.key],
                          patch => updateSupplierServiceDraft(row.key, patch)
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Section 2: Client Services */}
                <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
                  <div className="border-b border-slate-800 pb-3">
                    <h4 className="font-bold text-sm text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <span>القسم الثاني: رسوم خدمات عملاء المورد</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      الرسوم المفروضة على طلبات وعمليات العملاء عند اكتمال الخدمة أو اعتماد الطلب.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {clientServiceRows.map(row => (
                      <React.Fragment key={row.key}>
                        {renderServiceFeeCard(
                          row.title,
                          row.subtitle,
                          activeDraft.clientServices[row.key],
                          patch => updateClientServiceDraft(row.key, patch)
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={!isGlobalScope && suppliers.length === 0}
                className={`w-full py-3 rounded-2xl font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  isGlobalScope
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    : 'bg-purple-500 hover:bg-purple-400 text-slate-950'
                }`}
              >
                {isGlobalScope
                  ? 'حفظ وتطبيق قسمي الرسوم العامة على جميع المتاجر'
                  : `حفظ وتطبيق قسمي الرسوم المخصصة للمتجر (${activeSelectedSup?.storeName || ''})`}
              </button>
            </form>
          </div>
        );
      })()}

      {/* Add New Supplier Modal (User's requirement: يمكن ان يضيف ممولين) */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 text-slate-100 text-xs my-6">
            <h3 className="font-bold text-base text-white">إضافة ممول / متجر خدمات جديد للمنصة</h3>
            <form onSubmit={handleCreateSupplier} className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">اسم المتجر الكامل:</label>
                <input
                  type="text"
                  required
                  value={newSupName}
                  onChange={e => setNewSupName(e.target.value)}
                  placeholder="مثال: جمال الصالحي"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">اسم المؤسسة أو المتجر التجاري:</label>
                <input
                  type="text"
                  required
                  value={newSupStoreName}
                  onChange={e => setNewSupStoreName(e.target.value)}
                  placeholder="مثال: مؤسسة جمال للحلول الرقمية"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">رقم الهاتف:</label>
                  <input
                    type="text"
                    value={newSupPhone}
                    onChange={e => setNewSupPhone(e.target.value)}
                    placeholder="+966 50 123 4567"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">البريد الإلكتروني:</label>
                  <input
                    type="email"
                    required
                    value={newSupEmail}
                    onChange={e => setNewSupEmail(e.target.value)}
                    placeholder="jamal@supplier.sa"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">كلمة مرور دخول المتجر:</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newSupPassword}
                  onChange={e => setNewSupPassword(e.target.value)}
                  placeholder="•••••••• (6 أحرف على الأقل)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">نسبة الرسوم (%):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newSupFeePercent}
                    onChange={e => setNewSupFeePercent(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">مبلغ الرسوم المقطوع ({currencyLabel}):</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={newSupFixedFee}
                    onChange={e => setNewSupFixedFee(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">آيبان الحساب البنكي للمتجر:</label>
                <input
                  type="text"
                  value={newSupIban}
                  onChange={e => setNewSupIban(e.target.value)}
                  placeholder="SA4480000123608010123456"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
                  dir="ltr"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs"
                >
                  إضافة المتجر وتفعيله
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle to Bank Modal */}
      {activeAdminAction === 'settle_bank' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 text-slate-100 text-xs">
            <h3 className="font-bold text-base text-white">تسوية مبالغ محفظة الإدارة للبنك</h3>
            <form onSubmit={handleSettleSubmit} className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">المبلغ المراد تحويله للبنك ({currencyLabel}):</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={settleAmount}
                  onChange={e => setSettleAmount(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">آيبان الحساب البنكي لمدير التطبيق:</label>
                <input
                  type="text"
                  required
                  value={settleIban}
                  onChange={e => setSettleIban(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-white"
                  dir="ltr"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950 text-slate-400 text-[11px] leading-relaxed">
                * سيتم خصم المبلغ من محفظة رسوم التطبيق (الرصيد المتاح: {formatCurrency(superAdmin.walletBalance)}).
              </div>

              {!settleAvailability.available && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 space-y-1"
                >
                  <div className="font-bold text-rose-300 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{settleAvailability.title}</span>
                  </div>
                  <p className="text-rose-200/90 leading-relaxed">{settleAvailability.message}</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
                >
                  تأكيد التسوية البنكية
                </button>
                <button
                  type="button"
                  onClick={() => setActiveAdminAction(null)}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer to Agent Modal */}
      {activeAdminAction === 'transfer_agent' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 text-slate-100 text-xs">
            <h3 className="font-bold text-base text-white">تحويل رصيد من الإدارة لنقطة بيع</h3>
            <form onSubmit={handleAgentTransferSubmit} className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">معرف نقطة البيع (مثال: RYD-10492):</label>
                <input
                  type="text"
                  required
                  value={targetAgentCode}
                  onChange={e => setTargetAgentCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono text-white text-center"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">المبلغ المحول ({currencyLabel}):</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={agentAmount}
                  onChange={e => setAgentAmount(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-white text-center"
                />
              </div>

              {!agentTransferAvailability.available && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 space-y-1"
                >
                  <div className="font-bold text-rose-300 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{agentTransferAvailability.title}</span>
                  </div>
                  <p className="text-rose-200/90 leading-relaxed">{agentTransferAvailability.message}</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs"
                >
                  تحويل الرصيد فوراً
                </button>
                <button
                  type="button"
                  onClick={() => setActiveAdminAction(null)}
                  className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Invite Modal */}
      {showSupplierInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 text-slate-100 text-center">
            <h3 className="font-bold text-base text-white">رابط إنشاء حساب لمتجر جديد</h3>
            <p className="text-xs text-slate-400">
              أرسل هذا الرابط إلى المتجر للتسجيل في المنصة وربط بوابته وحسابه البنكي.
            </p>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-purple-300 break-all select-all text-left" dir="ltr">
              {supplierInviteUrl}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(supplierInviteUrl);
                  setCopiedLink(true);
                  showToast({ type: 'success', title: 'تم النسخ', description: 'تم نسخ رابط المتجر للحافظة' });
                  setTimeout(() => setCopiedLink(false), 2500);
                }}
                className="flex-1 py-2.5 rounded-xl bg-purple-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'تم النسخ' : 'نسخ الرابط'}</span>
              </button>
              <button
                onClick={() => setShowSupplierInvite(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clean Reset Services & Non-Admin Users Confirmation Modal */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-3xl p-6 space-y-4 text-slate-100 text-xs shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-400">
              <Trash2 className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-base text-white">تأكيد تصفير الخدمات والمستخدمين</h3>
            </div>

            <p className="text-slate-300 leading-relaxed">
              سيتم تصفير وحذف كافة البيانات التالية محلياً ومن قاعدة البيانات السحابية:
            </p>
            <ul className="space-y-1 text-slate-400 list-disc pr-5">
              <li>جميع الخدمات ومخازن الأكواد والكتالوجات غير الثابتة</li>
              <li>جميع المتاجر وموظفي المتاجر ونقاط البيع والعملاء</li>
              <li>جميع المستخدمين المسجلين غير الإداريين والحسابات البنكية</li>
              <li>جميع الطلبات والإيداعات والسلف والقيود والروابط</li>
            </ul>

            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] leading-relaxed">
              سيتم الإبقاء على حسابات <strong>مدير التطبيق وموظفيه ({(superAdmin.adminAccounts || []).length + 1} حساب)</strong> وإعدادات المنصة والكتالوجات الثابتة دون مساس.
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                data-testid="confirm-reset-system-btn"
                onClick={async () => {
                  setShowResetConfirmModal(false);
                  await clearUsersSuppliersAndClientsData();
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs transition-colors"
              >
                تأكيد التصفير الآن
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Store Supervision & Management Modal */}
      {activeSupervisedStore && supervisedStoreState && (
        <AdminStoreSupervisionModal
          supplier={activeSupervisedStore}
          initialTab={supervisedStoreState.initialTab}
          onClose={() => setSupervisedStoreState(null)}
        />
      )}

      {/* Page Appearance & Element Visibility Modal */}
      <AppearanceControlModal
        isOpen={showAppearanceModal}
        onClose={() => setShowAppearanceModal(false)}
        portal="super_admin"
        settings={adminAppearance}
        onChange={(next, opts) => updateMyAppearanceSettings('super_admin', next, opts)}
      />

    </div>
  );
};
