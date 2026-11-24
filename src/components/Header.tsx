import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  Building2, 
  UserCheck,
  Coins,
  Eye,
  ArrowRight
} from 'lucide-react';
import { TIERS_CONFIG } from '../types';
import { resolveEffectiveAdminPermissions } from '../utils/adminAccounts';

export const Header: React.FC = () => {
  const { 
    role, 
    currentPos, 
    setCurrentPosId, 
    posClients, 
    suppliers,
    supplier, 
    setCurrentSupplierId,
    superAdmin,
    isAuthenticated,
    currentUser,
    activeCurrency,
    activeExchangeRate,
    setActiveCurrency,
    formatCurrency,
    isSupplierPosPreviewMode,
    closeSupplierPosPreview
  } = useApp();

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
      {/* Zone 1, 2, 3 Main Top Bar Contract */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Brand Wordmark with Official Logo */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white p-0.5 border border-slate-700/80 shadow-md flex items-center justify-center overflow-hidden shrink-0">
            <img 
              src="/assets/aistudio/IMG-20261106-WA0058_54921a02.jpg" 
              alt="DNexusD"
              className="w-full h-full object-contain rounded-lg"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-base sm:text-lg font-bold text-white tracking-tight whitespace-nowrap font-mono">
              DNexusD
            </span>
            <span className="text-[10px] text-slate-400 -mt-1 hidden xs:inline">
              Digital Nexus Developer
            </span>
          </div>
        </div>

        {/* Zone 3: Quick Role indicator on desktop/tablet */}
        <div className="flex items-center gap-2 text-xs">
          {role === 'pos_client' && (
            <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold hidden sm:inline-flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>واجهة نقطة البيع</span>
            </span>
          )}
          {(role === 'supplier' || role === 'employee') && (
            <span className="px-2.5 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold hidden sm:inline-flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>{role === 'employee' ? 'واجهة موظف المتجر' : 'واجهة إدارة المتجر'}</span>
            </span>
          )}
          {role === 'super_admin' && (
            <span className="px-2.5 py-1 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 font-bold hidden sm:inline-flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-purple-400" />
              <span>إدارة التطبيق المركزية</span>
            </span>
          )}
        </div>
      </div>

      {/* Sub-bar: Active Interface Persona Selector */}
      {isAuthenticated && (
        <div className="bg-slate-900 border-t border-slate-800/80 px-3 sm:px-4 md:px-6 py-2 text-xs w-full">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3">
          {role === 'pos_client' && (
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              {!isAuthenticated ? (
                <>
                  <span className="text-slate-400 flex items-center gap-1 font-medium">
                    <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                    تبديل حساب العميل لاختبار اختلاف أسعار الرتب:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {posClients.map((client, idx) => {
                      const isSelected = client.id === currentPos.id;
                      const tier = TIERS_CONFIG[client.tier] || TIERS_CONFIG.regular;
                      const itemKey = client.id ? `${client.id}-${idx}` : `client-${idx}`;
                      return (
                        <button
                          key={itemKey}
                          onClick={() => setCurrentPosId(client.id)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 border ${
                            isSelected
                              ? 'bg-slate-800 text-white border-amber-500 ring-1 ring-amber-500/50'
                              : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                          }`}
                        >
                          {client.logoUrl ? (
                            <img src={client.logoUrl} alt="" className="w-3.5 h-3.5 rounded object-cover shrink-0" />
                          ) : null}
                          <span className="truncate max-w-[110px]">{client.tradeName}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${tier.badgeColor} ${tier.textColor}`}>
                            {tier.nameAr}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-slate-300 min-w-0">
                  <span className="px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold text-xs flex items-center gap-1.5 truncate">
                    <UserCheck className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">حساب نقطة البيع: {currentPos.tradeName}</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {(role === 'supplier' || role === 'employee') && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-slate-300 min-w-0">
              {role === 'employee' ? (
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
                  <span className="px-2.5 py-1 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold text-xs flex items-center gap-1.5 truncate">
                    <UserCheck className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">موظف: {currentUser?.name} ({currentUser?.roleTitle || 'موظف مكتب'})</span>
                  </span>
                  <span className="text-slate-400 text-[11px] truncate">متجر: <strong className="text-white">{supplier.name}</strong></span>
                </div>
              ) : !isAuthenticated ? (
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-semibold">المتجر النشط:</span>
                  <select
                    value={supplier.id}
                    onChange={e => setCurrentSupplierId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-0.5 text-xs text-white"
                  >
                    {suppliers.map((s, idx) => (
                      <option key={s.id ? `${s.id}-${idx}` : idx} value={s.id}>{s.name} ({s.storeName})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold text-xs flex items-center gap-1.5 truncate">
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">مالك المتجر: {supplier.name} ({supplier.storeName})</span>
                  </span>
                </div>
              )}
              {role === 'supplier' && (
                <span className="text-slate-300 text-[11px] whitespace-nowrap">
                  الرصيد: <strong className="text-white font-mono tabular-nums">{formatCurrency(supplier.walletBalance, { withGrouping: true })}</strong>
                </span>
              )}
              {isSupplierPosPreviewMode && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="px-2.5 py-1 rounded-xl bg-cyan-500/15 text-cyan-200 border border-cyan-500/40 font-bold text-xs flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>معاينة واجهة: {currentPos.tradeName} (قراءة فقط)</span>
                  </span>
                  <button
                    type="button"
                    onClick={closeSupplierPosPreview}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  >
                    <ArrowRight className="w-3 h-3" />
                    <span>العودة للمتجر</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {role === 'super_admin' && (() => {
            const adminPerms = resolveEffectiveAdminPermissions(currentUser, role);
            const canSeeAdminWallet = adminPerms.canViewStatement || adminPerms.canSettleAdminWallet;
            return (
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-slate-300 min-w-0">
                <span className="text-purple-400 font-semibold truncate">
                  {currentUser?.adminAccountId
                    ? `${currentUser.name} (${currentUser.roleTitle || 'مشرف تطبيق'})`
                    : superAdmin.name}
                </span>
                {canSeeAdminWallet && (
                  <span className="text-[11px] whitespace-nowrap">
                    محفظة المنصة:{' '}
                    <strong className="text-emerald-400 font-mono tabular-nums">
                      {formatCurrency(superAdmin.walletBalance, { withGrouping: true })}
                    </strong>
                  </span>
                )}
                {adminPerms.canManageSuppliers && (
                  <span className="text-slate-400 text-[11px] hidden sm:inline whitespace-nowrap">
                    المتاجر: <strong className="text-white font-mono tabular-nums">{suppliers.length}</strong>
                  </span>
                )}
              </div>
            );
          })()}

          {/* Currency Switcher */}
          <div className="flex items-center justify-between sm:justify-end gap-2 text-slate-300 shrink-0 border-t sm:border-t-0 border-slate-800/60 pt-2 sm:pt-0">
            <div className="flex items-center gap-1 bg-slate-950/90 border border-slate-700/80 rounded-xl p-0.5 sm:p-1">
              <span className="text-[11px] text-slate-400 flex items-center gap-1 px-1.5">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">العملة:</span>
              </span>
              <button
                type="button"
                onClick={() => setActiveCurrency('SAR')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeCurrency === 'SAR'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                ر.س
              </button>
              <button
                type="button"
                onClick={() => setActiveCurrency('USD')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeCurrency === 'USD'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                $ دولار
              </button>
            </div>
            {activeCurrency === 'USD' && (
              <span
                className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10.5px] font-mono whitespace-nowrap"
                dir="ltr"
                title="سعر الصرف المعتمد من التاجر"
              >
                1$ = {activeExchangeRate} ر.س
              </span>
            )}
          </div>
        </div>
      </div>
      )}
    </header>
  );
};
