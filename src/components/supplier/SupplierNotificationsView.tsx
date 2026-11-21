import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AppNotification } from '../../types';
import {
  isEmployeeTabAllowed,
  resolveEffectiveEmployeePermissions,
  SupplierDashboardTab,
} from '../../utils/employeePermissions';
import {
  Bell,
  Search,
  Check,
  CheckCheck,
  Trash2,
  Clock,
  Gamepad2,
  Lock,
  Wallet,
  HandCoins,
  CreditCard,
  ShieldCheck,
  ArrowRight,
  Store,
  Sparkles,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Eye,
} from 'lucide-react';

interface SupplierNotificationsViewProps {
  onNavigateTab: (
    tab:
      | 'catalogs'
      | 'pending_orders'
      | 'account_orders'
      | 'deposits'
      | 'loans'
      | 'bank_accounts'
      | 'clients'
      | 'vouchers'
      | 'client_statements'
      | 'employees'
      | 'notifications'
  ) => void;
}

type NotificationCategory = 'all' | 'unread' | 'low_stock' | 'deposits' | 'loans' | 'orders' | 'transfers';

export const SupplierNotificationsView: React.FC<SupplierNotificationsViewProps> = ({
  onNavigateTab,
}) => {
  const {
    role,
    currentUser,
    supplier,
    supplierNotifications,
    unreadSupplierNotificationsCount,
    markNotificationAsRead,
    markAllSupplierNotificationsAsRead,
    clearSupplierNotifications,
  } = useApp();

  const perms = useMemo(
    () => resolveEffectiveEmployeePermissions(currentUser, role, supplier),
    [currentUser, role, supplier]
  );

  const [activeCategory, setActiveCategory] = useState<NotificationCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Counts for each category
  const categoryCounts = useMemo(() => {
    const unread = supplierNotifications.filter((n) => !n.isRead).length;
    const low_stock = supplierNotifications.filter((n) => n.type === 'low_stock').length;
    const deposits = supplierNotifications.filter((n) => n.type === 'deposit').length;
    const loans = supplierNotifications.filter(
      (n) => n.type === 'loan' || n.type === 'loan_repayment'
    ).length;
    const orders = supplierNotifications.filter((n) => n.type === 'order_status').length;
    const transfers = supplierNotifications.filter(
      (n) => n.type === 'transfer' || n.type === 'receiver_confirmation'
    ).length;

    return {
      all: supplierNotifications.length,
      unread,
      low_stock,
      deposits,
      loans,
      orders,
      transfers,
    };
  }, [supplierNotifications]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return supplierNotifications.filter((notif) => {
      // Category filter
      if (activeCategory === 'unread' && notif.isRead) return false;
      if (activeCategory === 'low_stock' && notif.type !== 'low_stock') return false;
      if (activeCategory === 'deposits' && notif.type !== 'deposit') return false;
      if (
        activeCategory === 'loans' &&
        notif.type !== 'loan' &&
        notif.type !== 'loan_repayment'
      )
        return false;
      if (activeCategory === 'orders' && notif.type !== 'order_status') return false;
      if (
        activeCategory === 'transfers' &&
        notif.type !== 'transfer' &&
        notif.type !== 'receiver_confirmation'
      )
        return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const haystacks = [
          notif.title,
          notif.message,
          notif.posName || '',
          notif.posCode || '',
          notif.orderId || '',
          notif.depositId || '',
          notif.loanId || '',
          notif.repaymentRequestId || '',
        ];
        if (!haystacks.some((h) => h.toLowerCase().includes(q))) {
          return false;
        }
      }

      return true;
    });
  }, [supplierNotifications, activeCategory, searchQuery]);

  const handleActionClick = (notif: AppNotification) => {
    markNotificationAsRead(notif.id);
    let targetTab: SupplierDashboardTab | null = null;
    if (notif.actionTab) {
      targetTab = notif.actionTab;
    } else if (notif.type === 'low_stock') {
      targetTab = 'vouchers';
    } else if (notif.type === 'deposit') {
      targetTab = 'deposits';
    } else if (notif.type === 'loan' || notif.type === 'loan_repayment') {
      targetTab = 'loans';
    } else if (notif.type === 'order_status') {
      targetTab = 'pending_orders';
    }
    if (targetTab && isEmployeeTabAllowed(targetTab, perms, role)) {
      onNavigateTab(targetTab);
    }
  };

  const getNotificationIcon = (notif: AppNotification) => {
    switch (notif.type) {
      case 'low_stock':
        return <AlertTriangle className="w-5 h-5 text-rose-400" />;
      case 'order_status':
        if (notif.actionTab === 'account_orders') {
          return <Lock className="w-5 h-5 text-cyan-400" />;
        }
        return <Gamepad2 className="w-5 h-5 text-amber-400" />;
      case 'deposit':
        return <Wallet className="w-5 h-5 text-emerald-400" />;
      case 'loan':
        return <HandCoins className="w-5 h-5 text-cyan-400" />;
      case 'loan_repayment':
        return <CreditCard className="w-5 h-5 text-amber-400" />;
      case 'receiver_confirmation':
        return <ShieldCheck className="w-5 h-5 text-emerald-400" />;
      default:
        return <Bell className="w-5 h-5 text-amber-400" />;
    }
  };

  const getCategoryBadge = (notif: AppNotification) => {
    switch (notif.type) {
      case 'low_stock':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            تنبيه نقص مخزون
          </span>
        );
      case 'order_status':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            طلب ألعاب وأكواد
          </span>
        );
      case 'deposit':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            إيداع وشحن محفظة
          </span>
        );
      case 'loan':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            طلب سلفة رصيد آجل
          </span>
        );
      case 'loan_repayment':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            سداد سلفة
          </span>
        );
      case 'receiver_confirmation':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            تأكيد مستلم الحوالة
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
            إشعار متجر
          </span>
        );
    }
  };

  const getActionLabel = (notif: AppNotification) => {
    if (notif.actionTab === 'vouchers' || notif.type === 'low_stock') return 'إدارة وتعبئة مخزون الأكواد';
    if (notif.actionTab === 'pending_orders') return 'الانتقال لتنفيذ الطلب باللعبة';
    if (notif.actionTab === 'account_orders') return 'الانتقال لشحن الحساب';
    if (notif.actionTab === 'deposits') return 'الانتقال لمراجعة الإيداع';
    if (notif.actionTab === 'loans') return 'الانتقال لسجل السلف والسداد';
    if (notif.actionTab === 'clients') return 'الانتقال لإدارة العملاء';
    if (notif.actionTab === 'client_statements') return 'الانتقال للتقارير وكشف الحسابات';
    if (notif.actionTab === 'bank_accounts') return 'الانتقال لإدارة الحسابات البنكية';
    if (notif.type === 'deposit') return 'الانتقال لمراجعة الإيداع';
    if (notif.type === 'loan' || notif.type === 'loan_repayment') return 'الانتقال لسجل السلف';
    if (notif.type === 'order_status') return 'الانتقال للطلبات المعلقة';
    return 'عرض التفاصيل';
  };

  return (
    <div className="space-y-5">
      {/* Top Banner Card */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  إشعارات وتنبيهات المتجر
                </h2>
                {unreadSupplierNotificationsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold animate-pulse">
                    {unreadSupplierNotificationsCount} جديد
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                متابعة فورية لطلبات شحن المحافظ، طلبات السُّلَف وسدادها، مشتريات الأيدي والألعاب، وتأكيدات مستلمي الحوالات لدى متجر{' '}
                <strong className="text-amber-400">{supplier.storeName}</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {supplierNotifications.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={markAllSupplierNotificationsAsRead}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="تحديد كافة الإشعارات كمقروءة"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>تحديد الكل كمقروء</span>
                </button>

                <button
                  type="button"
                  onClick={clearSupplierNotifications}
                  className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="مسح كافة الإشعارات"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>مسح الإشعارات</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Quick KPI Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-3 border-t border-slate-800/80 text-xs">
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">إجمالي الإشعارات</span>
            <span className="font-mono font-bold text-white text-sm">
              {categoryCounts.all}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">غير مقروءة</span>
            <span className="font-mono font-bold text-amber-400 text-sm">
              {categoryCounts.unread}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950 border border-rose-500/30 flex items-center justify-between">
            <span className="text-rose-300 text-[11px]">نقص مخزون الأكواد</span>
            <span className="font-mono font-bold text-rose-400 text-sm">
              {categoryCounts.low_stock}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">طلبات الإيداع</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">
              {categoryCounts.deposits}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">السُّلَف والسداد</span>
            <span className="font-mono font-bold text-cyan-400 text-sm">
              {categoryCounts.loans}
            </span>
          </div>
        </div>
      </div>

      {/* Categories Bar and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Categories Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {[
            { id: 'all', label: `الكل (${categoryCounts.all})` },
            { id: 'unread', label: `غير مقروءة (${categoryCounts.unread})` },
            { id: 'low_stock', label: `⚠️ نقص المخزون (${categoryCounts.low_stock})` },
            { id: 'deposits', label: `طلبات الإيداع (${categoryCounts.deposits})` },
            { id: 'loans', label: `السُّلَف والسداد (${categoryCounts.loans})` },
            { id: 'orders', label: `طلبات الألعاب (${categoryCounts.orders})` },
            { id: 'transfers', label: `تأكيدات الحوالات (${categoryCounts.transfers})` },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id as NotificationCategory)}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم العميل، الرمز، الطلب..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
              <Bell className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white">لا توجد إشعارات مطابقة حالياً</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              عندما يقوم أي عميل بإرسال طلب شحن رصيد، طلب سلفة، شراء خدمة أيدي، أو تأكيد استلام حوالة بنكية، ستصلك التنبيهات الفورية هنا مباشرة.
            </p>
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const isUnread = !notif.isRead;

            return (
              <div
                key={notif.id}
                className={`p-4 sm:p-5 rounded-3xl border transition-all space-y-3 ${
                  isUnread
                    ? 'bg-slate-900/95 border-amber-500/40 shadow-lg shadow-amber-500/5'
                    : 'bg-slate-900/60 border-slate-800/90 hover:border-slate-700'
                }`}
              >
                {/* Header line */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isUnread
                          ? 'bg-amber-500/15 border border-amber-500/30'
                          : 'bg-slate-800 border border-slate-700'
                      }`}
                    >
                      {getNotificationIcon(notif)}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-ping"></span>
                        )}
                        <h4 className="font-bold text-sm text-white">{notif.title}</h4>
                        {getCategoryBadge(notif)}
                        {notif.orderId && (
                          <span className="font-mono text-[10px] text-amber-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            #{notif.orderId}
                          </span>
                        )}
                        {notif.depositId && (
                          <span className="font-mono text-[10px] text-emerald-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            #{notif.depositId}
                          </span>
                        )}
                        {notif.loanId && (
                          <span className="font-mono text-[10px] text-cyan-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            #{notif.loanId}
                          </span>
                        )}
                      </div>

                      {/* Client attribution and timestamp */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        {notif.posName && (
                          <span className="flex items-center gap-1 font-semibold text-slate-300">
                            <Store className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>{notif.posName}</span>
                            {notif.posCode && (
                              <span className="font-mono text-slate-400">({notif.posCode})</span>
                            )}
                          </span>
                        )}
                        <span className="text-slate-600">·</span>
                        <span className="flex items-center gap-1 font-mono text-slate-400" dir="ltr">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{notif.createdAt}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {notif.amount !== undefined && notif.amount > 0 && (
                    <div className="text-right sm:text-left shrink-0">
                      <span className="text-[10px] text-slate-400 block">المبلغ</span>
                      <span className="text-base sm:text-lg font-bold font-mono text-emerald-400 tabular-nums">
                        {notif.amount.toFixed(2)} ر.س
                      </span>
                    </div>
                  )}
                </div>

                {/* Message Body */}
                <div className="pr-0 sm:pr-13 text-xs sm:text-[13px] text-slate-300 leading-relaxed">
                  {notif.message}
                </div>

                {/* Card Actions Footer */}
                <div className="pr-0 sm:pr-13 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const targetTab: SupplierDashboardTab | null = notif.actionTab
                        ? notif.actionTab
                        : notif.type === 'low_stock'
                        ? 'vouchers'
                        : notif.type === 'deposit'
                        ? 'deposits'
                        : notif.type === 'loan' || notif.type === 'loan_repayment'
                        ? 'loans'
                        : notif.type === 'order_status'
                        ? 'pending_orders'
                        : null;
                      if (!targetTab || !isEmployeeTabAllowed(targetTab, perms, role)) {
                        return null;
                      }
                      return (
                        <button
                          type="button"
                          onClick={() => handleActionClick(notif)}
                          className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                        >
                          <span>{getActionLabel(notif)}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      );
                    })()}
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => markNotificationAsRead(notif.id)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Check className="w-3 h-3 text-amber-400" />
                      <span>{isUnread ? 'تحديد كمقروء' : 'مقروء'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
