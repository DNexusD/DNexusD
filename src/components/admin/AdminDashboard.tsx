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
  XCircle
} from 'lucide-react';
import { getBalanceRequestAvailability } from '../../utils/availabilityMessages';

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
    logout
  } = useApp();

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

  // Settings state for Global fee
  const [globalFeeType, setGlobalFeeType] = useState<'percentage' | 'fixed' | 'both'>(superAdmin.defaultFeeType || 'percentage');
  const [globalPercentage, setGlobalPercentage] = useState<number>(superAdmin.defaultFeePercentage);
  const [globalFixedAmount, setGlobalFixedAmount] = useState<string>(() =>
    String(Number(convertFromSar(superAdmin.defaultFixedFeeAmount || 0).toFixed(2)))
  );
  const [isGlobalFixedDirty, setIsGlobalFixedDirty] = useState(false);

  // Settings state for per-supplier fee
  const [selectedSupplierForFee, setSelectedSupplierForFee] = useState<string>(supplier.id);
  const activeSelectedSup = suppliers.find(s => s.id === selectedSupplierForFee) || supplier;
  const [supplierFeeType, setSupplierFeeType] = useState<'percentage' | 'fixed' | 'both'>(activeSelectedSup.feeType || 'percentage');
  const [supplierPercentage, setSupplierPercentage] = useState<number>(activeSelectedSup.feePercentage ?? 1.0);
  const [supplierFixedAmount, setSupplierFixedAmount] = useState<string>(() =>
    String(Number(convertFromSar(activeSelectedSup.fixedFeeAmount ?? 0).toFixed(2)))
  );
  const [isSupplierFixedDirty, setIsSupplierFixedDirty] = useState(false);

  useEffect(() => {
    setGlobalFixedAmount(String(Number(convertFromSar(superAdmin.defaultFixedFeeAmount || 0).toFixed(2))));
    setIsGlobalFixedDirty(false);
  }, [activeCurrency, activeExchangeRate, superAdmin.defaultFixedFeeAmount]);

  useEffect(() => {
    setSupplierFixedAmount(String(Number(convertFromSar(activeSelectedSup.fixedFeeAmount ?? 0).toFixed(2))));
    setIsSupplierFixedDirty(false);
  }, [activeCurrency, activeExchangeRate, activeSelectedSup.id, activeSelectedSup.fixedFeeAmount]);

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
    const fixedSar = isGlobalFixedDirty
      ? convertToSar(Math.max(0, Number(globalFixedAmount) || 0))
      : (superAdmin.defaultFixedFeeAmount || 0);
    updateGlobalFeeConfig({
      feeType: globalFeeType,
      percentage: Number(globalPercentage),
      fixedAmount: fixedSar
    });
    setIsGlobalFixedDirty(false);
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
    const targetSup = suppliers.find(s => s.id === targetId) || activeSelectedSup;
    const fixedSar = isSupplierFixedDirty
      ? convertToSar(Math.max(0, Number(supplierFixedAmount) || 0))
      : (targetSup?.fixedFeeAmount ?? 0);
    updateSupplierFeeConfig(targetId, {
      feeType: supplierFeeType,
      percentage: Number(supplierPercentage),
      fixedAmount: fixedSar
    });
    setIsSupplierFixedDirty(false);
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
    <div className="space-y-6">
      
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

          <div className="flex flex-wrap items-center gap-2">
            {perms.canManageSuppliers && (
              <>
                <button
                  onClick={() => setShowAddSupplierModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>إضافة ممول / متجر جديد</span>
                </button>

                <button
                  onClick={() => setShowSupplierInvite(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5 text-purple-400" />
                  <span>إرسال رابط تسجيل لمتجر</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={logout}
              className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="تسجيل الخروج والعودة لشاشة الدخول"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>

        {/* Central Wallet & Platform Stats */}
        {(canViewAdminWallet || perms.canManageSuppliers || perms.canManageFees) && (
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
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs">
        {perms.canViewStatement && (
          <button
            onClick={() => handleSelectAdminTab('statement')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all ${
              adminSubTab === 'statement'
                ? 'bg-purple-500 text-slate-950 shadow-lg shadow-purple-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>كشف حساب مدير التطبيق (المحفظة والرسوم)</span>
          </button>
        )}

        {(perms.canManageSuppliers || perms.canSettleAdminWallet) && (
          <button
            onClick={() => handleSelectAdminTab('overview')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all ${
              adminSubTab === 'overview'
                ? 'bg-purple-500 text-slate-950 shadow-lg shadow-purple-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>إشراف المتاجر والمحافظ والتحويلات</span>
          </button>
        )}

        {perms.canManageFees && (
          <button
            onClick={() => handleSelectAdminTab('fees')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all ${
              adminSubTab === 'fees'
                ? 'bg-purple-500 text-slate-950 shadow-lg shadow-purple-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Percent className="w-4 h-4" />
            <span>إعدادات نسب ومبالغ الرسوم</span>
          </button>
        )}

        {perms.canManageInterfaceSettings && (
          <button
            onClick={() => handleSelectAdminTab('interface_settings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all ${
              adminSubTab === 'interface_settings'
                ? 'bg-purple-500 text-slate-950 shadow-lg shadow-purple-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>إعدادات الواجهات والكتالوجات والقوائم</span>
          </button>
        )}

        {perms.canManageAdminAccounts && (
          <button
            onClick={() => handleSelectAdminTab('admin_accounts')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all ${
              adminSubTab === 'admin_accounts'
                ? 'bg-purple-500 text-slate-950 shadow-lg shadow-purple-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <UserCog className="w-4 h-4" />
            <span>حسابات إدارة التطبيق ({(superAdmin.adminAccounts || []).length})</span>
          </button>
        )}

        {perms.canClearSystemData && (
          <button
            type="button"
            data-testid="admin-reset-system-btn"
            onClick={() => setShowResetConfirmModal(true)}
            className="mr-auto flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all font-semibold"
            title="تصفير الخدمات والمستخدمين مع الإبقاء على مدير التطبيق وموظفيه"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>تصفير الخدمات والمستخدمين</span>
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
          {perms.canSettleAdminWallet && (
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
              {suppliers.length > 0 && (
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

              {suppliers.length === 0 ? (
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

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setSupervisedStoreState({ supplierId: sup.id, initialTab: 'overview' })
                              }
                              className="flex-1 px-3 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>إشراف وإدارة المتجر</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setSupervisedStoreState({ supplierId: sup.id, initialTab: 'profile' })
                              }
                              className="px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title="البيانات الشخصية والبنكية"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                              <span>البيانات</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setSupervisedStoreState({ supplierId: sup.id, initialTab: 'clients' })
                              }
                              className="px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title="عرض عملاء المتجر"
                            >
                              <Users className="w-3.5 h-3.5" />
                              <span>العملاء</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setSupervisedStoreState({ supplierId: sup.id, initialTab: 'activity' })
                              }
                              className="px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title="عرض حركة المتجر"
                            >
                              <Activity className="w-3.5 h-3.5" />
                              <span>الحركة</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleSupplierActiveStatus(sup.id)}
                              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                                supActive
                                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              }`}
                              title={supActive ? 'إيقاف المتجر مؤقتاً' : 'إعادة تفعيل المتجر'}
                            >
                              <Power className="w-3.5 h-3.5" />
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

      {/* View 3: Fee Settings (Global vs Per-Supplier) */}
      {adminSubTab === 'fees' && perms.canManageFees && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Global fee config */}
            <form onSubmit={handleSaveGlobalFee} className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 text-xs">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Percent className="w-4 h-4 text-amber-400" />
                  <span>ضبط نسبة ومبلغ الرسوم العامة لجميع المتاجر</span>
                </h3>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  تحدد النسبة والمبلغ الثابت المقتطع لصالح محفظة الإدارة على أي عملية بيع أو تحويل، كما تُحتسب هذه النسبة المئوية كرسوم تطبيق من السعر الأصلي للرتبة في خدمات كتالوج الهدايا المجانية.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">طريقة احتساب الرسوم العامة:</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setGlobalFeeType('percentage')}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-colors ${
                        globalFeeType === 'percentage'
                          ? 'bg-amber-500 text-slate-950 font-bold border-amber-500'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      نسبة مئوية (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setGlobalFeeType('fixed')}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-colors ${
                        globalFeeType === 'fixed'
                          ? 'bg-amber-500 text-slate-950 font-bold border-amber-500'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      مبلغ مقطوع ({currencyLabel})
                    </button>
                    <button
                      type="button"
                      onClick={() => setGlobalFeeType('both')}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-colors ${
                        globalFeeType === 'both'
                          ? 'bg-amber-500 text-slate-950 font-bold border-amber-500'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      نسبة + مبلغ
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {(globalFeeType === 'percentage' || globalFeeType === 'both') && (
                    <div>
                      <label className="block text-slate-400 mb-1">النسبة المئوية (%):</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="25"
                        value={globalPercentage}
                        onChange={e => setGlobalPercentage(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-white text-center"
                      />
                    </div>
                  )}

                  {(globalFeeType === 'fixed' || globalFeeType === 'both') && (
                    <div>
                      <label className="block text-slate-400 mb-1">المبلغ المقطوع ({currencyLabel}):</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={globalFixedAmount}
                        onChange={e => {
                          setGlobalFixedAmount(e.target.value);
                          setIsGlobalFixedDirty(true);
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-white text-center"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
                >
                  حفظ وتطبيق الرسوم العامة لجميع المتاجر
                </button>
              </div>
            </form>

            {/* Per-supplier fee override */}
            <form onSubmit={handleSaveSupplierFee} className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 text-xs">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  <span>تخصيص نسبة ومبلغ الرسوم لكل متجر على حدة</span>
                </h3>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  يمكن تحديد نسبة أو مبلغ رسوم مخصص لمتجر معين يختلف عن النسبة العامة للنظام.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">اختر المتجر المراد تخصيص رسومه:</label>
                  <select
                    value={selectedSupplierForFee}
                    onChange={e => {
                      setSelectedSupplierForFee(e.target.value);
                      const found = suppliers.find(s => s.id === e.target.value);
                      if (found) {
                        setSupplierFeeType(found.feeType || 'percentage');
                        setSupplierPercentage(found.feePercentage ?? 1.0);
                        setSupplierFixedAmount(String(Number(convertFromSar(found.fixedFeeAmount ?? 0).toFixed(2))));
                        setIsSupplierFixedDirty(false);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {suppliers.length === 0 ? (
                      <option value="">لا توجد متاجر مسجلة حالياً</option>
                    ) : (
                      suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.storeName})</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">نوع الرسوم لهذا المتجر:</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSupplierFeeType('percentage')}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-colors ${
                        supplierFeeType === 'percentage'
                          ? 'bg-purple-500 text-slate-950 font-bold border-purple-500'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      نسبة مئوية (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSupplierFeeType('fixed')}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-colors ${
                        supplierFeeType === 'fixed'
                          ? 'bg-purple-500 text-slate-950 font-bold border-purple-500'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      مبلغ مقطوع ({currencyLabel})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSupplierFeeType('both')}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-colors ${
                        supplierFeeType === 'both'
                          ? 'bg-purple-500 text-slate-950 font-bold border-purple-500'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      نسبة + مبلغ
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {(supplierFeeType === 'percentage' || supplierFeeType === 'both') && (
                    <div>
                      <label className="block text-slate-400 mb-1">النسبة المئوية (%):</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="25"
                        value={supplierPercentage}
                        onChange={e => setSupplierPercentage(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-white text-center"
                      />
                    </div>
                  )}

                  {(supplierFeeType === 'fixed' || supplierFeeType === 'both') && (
                    <div>
                      <label className="block text-slate-400 mb-1">المبلغ المقطوع ({currencyLabel}):</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={supplierFixedAmount}
                        onChange={e => {
                          setSupplierFixedAmount(e.target.value);
                          setIsSupplierFixedDirty(true);
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-white text-center"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs transition-colors"
                >
                  حفظ الرسوم المخصصة لهذا المتجر
                </button>
              </div>
            </form>

          </div>
        </>
      )}

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

    </div>
  );
};
