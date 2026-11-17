import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Smartphone, 
  Monitor, 
  Store, 
  Building2, 
  ShieldCheck, 
  UserCheck,
  ChevronDown,
  LogOut,
  KeyRound,
  Database,
  RefreshCw,
  Cloud,
  Bell,
  CheckCircle2,
  XCircle,
  Wallet,
  Award,
  MessageSquare,
  Check,
  Trash2,
  Clock,
  HandCoins,
  CreditCard
} from 'lucide-react';
import { TIERS_CONFIG } from '../types';
import { resolveEffectiveAdminPermissions } from '../utils/adminAccounts';

export const Header: React.FC = () => {
  const { 
    role, 
    setRole, 
    viewMode, 
    setViewMode, 
    currentPos, 
    setCurrentPosId, 
    posClients, 
    suppliers,
    supplier, 
    setCurrentSupplierId,
    superAdmin,
    setActiveNavTab,
    activeNavTab,
    orders,
    isAuthenticated,
    currentUser,
    logout,
    isFirestoreConnected,
    isSyncingWithFirestore,
    syncAllToFirestore,
    notifications,
    supplierNotifications,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearAllNotifications,
    markAllSupplierNotificationsAsRead,
    clearSupplierNotifications
  } = useApp();

  const [showNotificationsPopover, setShowNotificationsPopover] = useState(false);

  const isSupplierRole = role === 'supplier';

  const clientNotifications = useMemo(() => {
    return notifications.filter(n => !n.posId || n.posId === currentPos?.id);
  }, [notifications, currentPos?.id]);

  const activeNotifications = useMemo(() => {
    if (isSupplierRole) {
      return supplierNotifications;
    }
    return clientNotifications;
  }, [isSupplierRole, supplierNotifications, clientNotifications]);

  const handleMarkAllRead = () => {
    if (isSupplierRole) {
      markAllSupplierNotificationsAsRead();
    } else {
      markAllNotificationsAsRead();
    }
  };

  const handleClearAll = () => {
    if (isSupplierRole) {
      clearSupplierNotifications();
    } else {
      clearAllNotifications();
    }
  };

  const pendingIdCount = orders.filter(o => (o.status === 'pending_supplier' || o.status === 'in_progress') && o.deliveryMethod === 'player_id').length;

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
      {/* Zone 1, 2, 3 Main Top Bar Contract */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark with Official Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-white p-0.5 border border-slate-700/80 shadow-md flex items-center justify-center overflow-hidden shrink-0">
            <img 
              src="/assets/aistudio/IMG-20261106-WA0058_54921a02.jpg" 
              alt="DNexusD"
              className="w-full h-full object-contain rounded-lg"
            />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-base font-bold text-white tracking-tight whitespace-nowrap font-mono text-center">
              DNexusD
            </span>
            <span className="text-[10px] text-slate-400 -mt-1 hidden sm:inline text-center">
              Digital Nexus Developer
            </span>
          </div>
        </div>



        {/* Zone 3: Actions - Toggle View and 3 Distinct Interfaces Switcher */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Notification Bell Button (For POS Client & Store Notifications) */}
          <div className="relative">
            <button
              onClick={() => setShowNotificationsPopover(!showNotificationsPopover)}
              className="relative p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer flex items-center justify-center"
              title={isSupplierRole ? "إشعارات وعمليات المتجر الفورية" : "الإشعارات والتنبيهات من المتجر والمتجر"}
            >
              <Bell className="w-4 h-4 text-amber-400" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white font-black text-[10px] flex items-center justify-center shadow-lg border border-slate-900 animate-pulse">
                  {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* Notifications Popover Dropdown */}
            {showNotificationsPopover && (
              <>
                {/* Overlay backdrop */}
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowNotificationsPopover(false)} 
                />
                
                <div className="absolute left-0 sm:left-auto right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl z-50 overflow-hidden text-right animate-in fade-in zoom-in-95 duration-150">
                  <div className="p-3.5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-amber-400" />
                      <h3 className="font-bold text-white text-sm">
                        {isSupplierRole ? 'إشعارات وتنبيهات المتجر' : 'الإشعارات والتنبيهات'}
                      </h3>
                      {unreadNotificationsCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-semibold border border-amber-500/30">
                          {unreadNotificationsCount} جديد
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {activeNotifications.length > 0 && (
                        <>
                          <button
                            onClick={handleMarkAllRead}
                            className="px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1"
                            title="تحديد الكل كقراءة"
                          >
                            <Check className="w-3 h-3" />
                            <span>قراءة الكل</span>
                          </button>
                          <button
                            onClick={handleClearAll}
                            className="px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1"
                            title="مسح الإشعارات"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>مسح</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60 custom-scrollbar">
                    {activeNotifications.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 space-y-2">
                        <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center mx-auto text-slate-500">
                          <Bell className="w-6 h-6" />
                        </div>
                        <p className="text-xs font-medium text-slate-300">
                          {isSupplierRole ? 'لا توجد إشعارات متجر حالياً' : 'لا توجد إشعارات حالياً'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {isSupplierRole
                            ? 'ستصلك هنا إشعارات فورية بطلبات الشحن باللعبة، طلبات الإيداع، طلبات وسداد السلف، وتأكيدات الحوالات'
                            : 'ستصلك هنا التنبيهات وإشعارات الشحن والطلبات من المتجر'}
                        </p>
                      </div>
                    ) : (
                      activeNotifications.map((notif) => {
                        const isUnread = !notif.isRead;
                        return (
                          <div
                            key={notif.id}
                            onClick={() => markNotificationAsRead(notif.id)}
                            className={`p-3.5 transition-colors cursor-pointer flex items-start gap-3 ${
                              isUnread ? 'bg-amber-500/10 hover:bg-amber-500/15' : 'hover:bg-slate-800/50'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                              notif.type === 'deposit' 
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : notif.type === 'loan'
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                : notif.type === 'loan_repayment'
                                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                : notif.type === 'receiver_confirmation'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : notif.type === 'tier_upgrade'
                                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                : notif.type === 'order_status'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}>
                              {notif.type === 'deposit' ? <Wallet className="w-4 h-4" /> :
                               notif.type === 'loan' ? <HandCoins className="w-4 h-4" /> :
                               notif.type === 'loan_repayment' ? <CreditCard className="w-4 h-4" /> :
                               notif.type === 'receiver_confirmation' ? <ShieldCheck className="w-4 h-4" /> :
                               notif.type === 'tier_upgrade' ? <Award className="w-4 h-4" /> :
                               notif.type === 'order_status' ? <CheckCircle2 className="w-4 h-4" /> :
                               <Bell className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-xs text-white truncate">{notif.title}</span>
                                {isUnread && (
                                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
                                )}
                              </div>
                              <p className="text-xs text-slate-300 leading-normal">{notif.message}</p>
                              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                                {isSupplierRole ? (
                                  <span className="text-amber-400 font-medium">العميل: {notif.posName || 'نقطة بيع'}</span>
                                ) : (
                                  <span className="text-amber-400/80 font-medium">المتجر: {notif.supplierName || supplier?.name || ''}</span>
                                )}
                                <span className="flex items-center gap-1 dir-ltr">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  {notif.createdAt}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          {/* Firebase Cloud Sync Button */}
          <button
            onClick={syncAllToFirestore}
            disabled={isSyncingWithFirestore}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-all shadow-sm disabled:opacity-50"
            title="مزامنة فورية لكافة الطلبات والعمليات والمحافظ والسلف مع قاعدة بيانات فايربيس (Firestore)"
          >
            <Cloud className={`w-3.5 h-3.5 text-emerald-400 ${isSyncingWithFirestore ? 'animate-bounce' : ''}`} />
            <span className="hidden sm:inline">{isSyncingWithFirestore ? 'جاري المزامنة...' : 'مزامنة فايربيس'}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${isFirestoreConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
          </button>

          {/* View mode toggle (Phone frame vs Responsive desktop) */}
          <button
            onClick={() => setViewMode(viewMode === 'mobile_frame' ? 'responsive' : 'mobile_frame')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            title="تبديل وضع العرض (شاشة هاتف ذكي / عرض كامل)"
          >
            {viewMode === 'mobile_frame' ? (
              <>
                <Monitor className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">عرض كامل</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">إطار الجوال</span>
              </>
            )}
          </button>

          {isAuthenticated && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-amber-300 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>واجهة مصرحة حصرياً لحسابك</span>
            </div>
          )}

          {/* User Auth Status & Logout */}
          {isAuthenticated ? (
            <button
              onClick={logout}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors"
              title="تسجيل الخروج والعودة لشاشة الدخول"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">تسجيل الخروج</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <KeyRound className="w-3.5 h-3.5" />
              <span>شاشة تسجيل الدخول</span>
            </div>
          )}
        </div>
      </div>

      {/* Sub-bar: Active Interface Persona Selector */}
      {isAuthenticated && (
        <div className="bg-slate-900 border-t border-slate-800/80 px-4 py-2 text-xs">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {role === 'pos_client' && (
            <div className="flex flex-wrap items-center gap-2">
              {!isAuthenticated ? (
                <>
                  <span className="text-slate-400 flex items-center gap-1 font-medium">
                    <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                    تبديل حساب العميل لاختبار اختلاف أسعار الرتب:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {posClients.map((client, idx) => {
                      const isSelected = client.id === currentPos.id;
                      const tier = TIERS_CONFIG[client.tier];
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
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold text-xs flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>حساب نقطة البيع المسجل: {currentPos.tradeName}</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {(role === 'supplier' || role === 'employee') && (
            <div className="flex flex-wrap items-center gap-4 text-slate-300">
              {role === 'employee' ? (
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold text-xs flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>حساب موظف معتمد: {currentUser?.name} ({currentUser?.roleTitle || 'موظف مكتب'})</span>
                  </span>
                  <span className="text-slate-400">تابع لمتجر: <strong className="text-white">{supplier.name} ({supplier.storeName})</strong></span>
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
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold text-xs flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>المتجر المسجل: {supplier.name} ({supplier.storeName})</span>
                  </span>
                </div>
              )}
              <span className="text-slate-400 hidden sm:inline">·</span>
              <span>رصيد مبيعات المتجر: <strong className="text-white font-mono tabular-nums">{supplier.walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س</strong></span>
            </div>
          )}

          {role === 'super_admin' && (() => {
            const adminPerms = resolveEffectiveAdminPermissions(currentUser, role);
            const canSeeAdminWallet = adminPerms.canViewStatement || adminPerms.canSettleAdminWallet;
            return (
              <div className="flex flex-wrap items-center gap-4 text-slate-300">
                <span className="text-purple-400 font-semibold">
                  {currentUser?.adminAccountId
                    ? `${currentUser.name} (${currentUser.roleTitle || 'مشرف تطبيق'})`
                    : superAdmin.name}
                </span>
                {canSeeAdminWallet && (
                  <>
                    <span className="text-slate-400">·</span>
                    <span>
                      محفظة رسوم المنصة:{' '}
                      <strong className="text-emerald-400 font-mono tabular-nums">
                        {superAdmin.walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س
                      </strong>
                    </span>
                  </>
                )}
                {adminPerms.canManageSuppliers && (
                  <span>
                    المتاجر الخاضعين للإشراف: <strong className="text-white font-mono tabular-nums">{suppliers.length}</strong>
                  </span>
                )}
              </div>
            );
          })()}

          <div className="flex items-center gap-2 mr-auto text-slate-400">
          </div>
        </div>
      </div>
      )}
    </header>
  );
};
