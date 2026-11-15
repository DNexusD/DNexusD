import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AdminStatementView } from './AdminStatementView';
import { AdminInterfaceSettingsView } from './AdminInterfaceSettingsView';
import { AdminAccountsView } from './AdminAccountsView';
import {
  AdminDashboardTab,
  getFirstAllowedAdminTab,
  isAdminTabAllowed,
  resolveEffectiveAdminPermissions
} from '../../utils/adminAccounts';
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
  UserCog
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { 
    role,
    currentUser,
    superAdmin, 
    suppliers,
    supplier, 
    posClients, 
    addSupplier,
    updateSupplierFeeConfig, 
    updateGlobalFeeConfig, 
    adminSettleBank, 
    adminTransferToAgent,
    activeNavTab,
    setActiveNavTab,
    showToast,
    clearUsersSuppliersAndClientsData
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
  const [globalFixedAmount, setGlobalFixedAmount] = useState<number>(superAdmin.defaultFixedFeeAmount || 0);

  // Settings state for per-supplier fee
  const [selectedSupplierForFee, setSelectedSupplierForFee] = useState<string>(supplier.id);
  const activeSelectedSup = suppliers.find(s => s.id === selectedSupplierForFee) || supplier;
  const [supplierFeeType, setSupplierFeeType] = useState<'percentage' | 'fixed' | 'both'>(activeSelectedSup.feeType || 'percentage');
  const [supplierPercentage, setSupplierPercentage] = useState<number>(activeSelectedSup.feePercentage ?? 1.0);
  const [supplierFixedAmount, setSupplierFixedAmount] = useState<number>(activeSelectedSup.fixedFeeAmount ?? 0);

  // Add new Supplier Form state
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [newSupName, setNewSupName] = useState('');
  const [newSupStoreName, setNewSupStoreName] = useState('');
  const [newSupPhone, setNewSupPhone] = useState('');
  const [newSupEmail, setNewSupEmail] = useState('');
  const [newSupBankName, setNewSupBankName] = useState('مصرف الراجحي');
  const [newSupIban, setNewSupIban] = useState('SA');
  const [newSupFeeType, setNewSupFeeType] = useState<'percentage' | 'fixed' | 'both'>('percentage');
  const [newSupFeePercent, setNewSupFeePercent] = useState<number>(1.0);
  const [newSupFixedFee, setNewSupFixedFee] = useState<number>(0.0);

  // Admin Wallet Usage Actions
  const [activeAdminAction, setActiveAdminAction] = useState<'settle_bank' | 'transfer_agent' | null>(null);
  const [settleAmount, setSettleAmount] = useState<number | ''>(500);
  const [settleIban, setSettleIban] = useState(superAdmin.bankAccounts[0]?.iban || '');
  const [targetAgentCode, setTargetAgentCode] = useState('RYD-10492');
  const [agentAmount, setAgentAmount] = useState<number | ''>(250);

  // Invite supplier link
  const [showSupplierInvite, setShowSupplierInvite] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleSaveGlobalFee = (e: React.FormEvent) => {
    e.preventDefault();
    updateGlobalFeeConfig({
      feeType: globalFeeType,
      percentage: Number(globalPercentage),
      fixedAmount: Number(globalFixedAmount)
    });
  };

  const handleSaveSupplierFee = (e: React.FormEvent) => {
    e.preventDefault();
    updateSupplierFeeConfig(selectedSupplierForFee, {
      feeType: supplierFeeType,
      percentage: Number(supplierPercentage),
      fixedAmount: Number(supplierFixedAmount)
    });
  };

  const handleCreateSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupName.trim() || !newSupStoreName.trim()) return;

    addSupplier({
      name: newSupName.trim(),
      storeName: newSupStoreName.trim(),
      phone: newSupPhone.trim() || '+966 50 000 0000',
      email: newSupEmail.trim() || 'supplier@digipos.sa',
      feePercentage: Number(newSupFeePercent),
      fixedFeeAmount: Number(newSupFixedFee),
      feeType: newSupFeeType,
      bankAccountDetails: {
        bankName: newSupBankName,
        accountHolder: newSupStoreName,
        iban: newSupIban,
        accountNumber: '9928174029'
      }
    });

    setShowAddSupplierModal(false);
    setNewSupName('');
    setNewSupStoreName('');
  };

  const handleSettleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleAmount || settleAmount <= 0) return;
    adminSettleBank(Number(settleAmount), settleIban);
    setActiveAdminAction(null);
  };

  const handleAgentTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentAmount || agentAmount <= 0) return;
    adminTransferToAgent(targetAgentCode, Number(agentAmount));
    setActiveAdminAction(null);
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
                الإشراف العام على الموردين والممولين، إدارة الحسابات الإدارية، وضبط نسب ومبالغ الرسوم المقطوعة على العمليات.
              </p>
            </div>
          </div>

          {perms.canManageSuppliers && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowAddSupplierModal(true)}
                className="px-3.5 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md"
              >
                <PlusCircle className="w-4 h-4" />
                <span>إضافة ممول / مورد جديد</span>
              </button>

              <button
                onClick={() => setShowSupplierInvite(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Send className="w-3.5 h-3.5 text-purple-400" />
                <span>إرسال رابط تسجيل لمورد</span>
              </button>
            </div>
          )}
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
                  {superAdmin.walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                  <span className="text-xs text-slate-400 font-sans">ر.س</span>
                </div>
                <div className="text-[10px] text-slate-400 pt-1">
                  تتجمع تلقائياً من رسوم كل عملية شراء وبيع خدمات أو تحويل رصيد
                </div>
              </div>
            )}

            {(perms.canManageSuppliers || perms.canViewStatement) && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400 block">إجمالي شبكة الموردين المسجلين</span>
                <div className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
                  {suppliers.length} موردين معتمدين
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
                  {superAdmin.defaultFeePercentage}% {superAdmin.defaultFixedFeeAmount > 0 ? `+ ${superAdmin.defaultFixedFeeAmount} ر.س` : ''}
                </div>
                <div className="text-[10px] text-slate-400 pt-1">
                  تطبق على جميع العمليات ما لم يتم تخصيص المورد
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
            <span>إشراف الموردين والمحافظ والتحويلات</span>
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
            onClick={() => {
              if (window.confirm('هل أنت تأكد من إفراغ التخزين المحلي والسحابي لمجموعات المستخدمين، الموردين، ونقاط البيع؟ (users, suppliers, posClients)')) {
                clearUsersSuppliersAndClientsData();
              }
            }}
            className="mr-auto flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all font-semibold"
            title="إفراغ ومسح سجلات users, suppliers, posClients من التخزين المحلي والسحابي"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>إفراغ التخزين (Users / Suppliers / POS)</span>
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
                  حسب المواصفات: يمكن لمدير التطبيق تسوية مبالغه واستلامها بنكياً من المورد، أو تحويل رصيد لنقاط البيع، أو شراء وبيع خدمات.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Action A: Settle to bank account from supplier */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-bold text-white">
                      <Landmark className="w-4 h-4 text-emerald-400" />
                      <span>تسوية الرصيد واستلام قيمته من الحساب البنكي للمورد</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      خصم المبلغ من محفظة مدير التطبيق وتأكيد استلام قيمته من الحساب البنكي للمورد ({supplier.name}) وإضافتها لحساب مدير التطبيق البنكي.
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
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-purple-400" />
                  <span>قائمة الموردين المعتمدين تحت إشراف الإدارة</span>
                </h2>
                <span className="text-xs text-slate-400 font-mono">العدد: {suppliers.length} موردين</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {suppliers.map(sup => (
                  <div key={sup.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm text-white">{sup.name}</h4>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          رسوم: {sup.feePercentage}% {sup.fixedFeeAmount > 0 ? `+ ${sup.fixedFeeAmount} ر.س` : ''}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[11px]">{sup.storeName}</div>
                      <div className="text-slate-500 text-[10px]">{sup.phone} · {sup.email}</div>
                      <div className="text-slate-500 text-[10px] font-mono">
                        البنك: {sup.bankAccountDetails.bankName} ({sup.bankAccountDetails.iban})
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
                      <span className="text-slate-400">رصيد مبيعاته:</span>
                      <strong className="text-emerald-400 font-mono font-bold tabular-nums">
                        {sup.walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
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
                  <span>ضبط نسبة ومبلغ الرسوم العامة لجميع الموردين</span>
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
                      مبلغ مقطوع (ر.س)
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
                      <label className="block text-slate-400 mb-1">المبلغ المقطوع (ر.س):</label>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        max="50"
                        value={globalFixedAmount}
                        onChange={e => setGlobalFixedAmount(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-white text-center"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
                >
                  حفظ وتطبيق الرسوم العامة لجميع الموردين
                </button>
              </div>
            </form>

            {/* Per-supplier fee override */}
            <form onSubmit={handleSaveSupplierFee} className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 text-xs">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  <span>تخصيص نسبة ومبلغ الرسوم لكل مورد على حدة</span>
                </h3>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  يمكن تحديد نسبة أو مبلغ رسوم مخصص لمورد معين يختلف عن النسبة العامة للنظام.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">اختر المورد المراد تخصيص رسومه:</label>
                  <select
                    value={selectedSupplierForFee}
                    onChange={e => {
                      setSelectedSupplierForFee(e.target.value);
                      const found = suppliers.find(s => s.id === e.target.value);
                      if (found) {
                        setSupplierFeeType(found.feeType || 'percentage');
                        setSupplierPercentage(found.feePercentage ?? 1.0);
                        setSupplierFixedAmount(found.fixedFeeAmount ?? 0);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.storeName})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">نوع الرسوم لهذا المورد:</label>
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
                      مبلغ مقطوع (ر.س)
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
                      <label className="block text-slate-400 mb-1">المبلغ المقطوع (ر.س):</label>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        max="50"
                        value={supplierFixedAmount}
                        onChange={e => setSupplierFixedAmount(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-white text-center"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs transition-colors"
                >
                  حفظ الرسوم المخصصة لهذا المورد
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
            <h3 className="font-bold text-base text-white">إضافة ممول / مورد خدمات جديد للمنصة</h3>
            <form onSubmit={handleCreateSupplier} className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">اسم المورد الكامل:</label>
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
                    value={newSupEmail}
                    onChange={e => setNewSupEmail(e.target.value)}
                    placeholder="jamal@supplier.sa"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
                    dir="ltr"
                  />
                </div>
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
                  <label className="block text-slate-400 mb-1">مبلغ الرسوم المقطوع (ر.س):</label>
                  <input
                    type="number"
                    step="0.25"
                    value={newSupFixedFee}
                    onChange={e => setNewSupFixedFee(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">آيبان الحساب البنكي للمورد:</label>
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
                  إضافة المورد وتفعيله
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
                <label className="block text-slate-400 mb-1">المبلغ المراد تحويله للبنك (ر.س):</label>
                <input
                  type="number"
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
                * سيتم خصم المبلغ من محفظة رسوم التطبيق وتأكيد استلام قيمته من الحساب البنكي للمورد ({supplier.bankAccountDetails.accountHolder}).
              </div>

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
                <label className="block text-slate-400 mb-1">المبلغ المحول (ر.س):</label>
                <input
                  type="number"
                  required
                  value={agentAmount}
                  onChange={e => setAgentAmount(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-white text-center"
                />
              </div>

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
            <h3 className="font-bold text-base text-white">رابط إنشاء حساب لمورد جديد</h3>
            <p className="text-xs text-slate-400">
              أرسل هذا الرابط إلى المورد للتسجيل في المنصة وربط بوابته وحسابه البنكي.
            </p>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-purple-300 break-all select-all text-left" dir="ltr">
              {supplierInviteUrl}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(supplierInviteUrl);
                  setCopiedLink(true);
                  showToast({ type: 'success', title: 'تم النسخ', description: 'تم نسخ رابط المورد للحافظة' });
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

    </div>
  );
};
