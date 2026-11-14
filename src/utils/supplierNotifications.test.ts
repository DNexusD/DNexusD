import test from 'node:test';
import assert from 'node:assert/strict';
import { AppNotification } from '../types';

test('supplier notifications filtering and unread count', () => {
  const sampleNotifications: AppNotification[] = [
    {
      id: 'notif-1',
      title: 'طلب شحن أيدي جديد',
      message: 'طلب جديد لشحن فري فاير',
      createdAt: 'منذ دقيقة',
      isRead: false,
      type: 'order_status',
      targetRole: 'supplier',
      posName: 'مركز ألعاب الفهد'
    },
    {
      id: 'notif-2',
      title: 'طلب إيداع بنكي',
      message: 'طلب شحن رصيد 500 ر.س',
      createdAt: 'منذ 5 دقائق',
      isRead: true,
      type: 'deposit',
      targetRole: 'supplier',
      posName: 'سوبرماركت البركة'
    },
    {
      id: 'notif-3',
      title: 'تم قبول إيداعك',
      message: 'تمت الموافقة على طلب الشحن',
      createdAt: 'منذ 10 دقائق',
      isRead: false,
      type: 'deposit',
      targetRole: 'pos',
      posId: 'pos-101'
    }
  ];

  const supplierNotifs = sampleNotifications.filter(n => n.targetRole === 'supplier' || n.targetRole === 'all');
  const posNotifs = sampleNotifications.filter(n => n.targetRole !== 'supplier' && (!n.posId || n.posId === 'pos-101'));

  assert.equal(supplierNotifs.length, 2, 'Should filter 2 supplier notifications');
  assert.equal(posNotifs.length, 1, 'Should filter 1 POS notification');

  const unreadSupplierCount = supplierNotifs.filter(n => !n.isRead).length;
  assert.equal(unreadSupplierCount, 1, 'Should have 1 unread supplier notification');

  // Verify mark as read
  const updatedNotifs = supplierNotifs.map(n => ({ ...n, isRead: true }));
  const remainingUnread = updatedNotifs.filter(n => !n.isRead).length;
  assert.equal(remainingUnread, 0, 'All supplier notifications marked read');
});

test('supplier notifications classification by category', () => {
  const notifications: AppNotification[] = [
    {
      id: 'n1',
      title: 'طلب شحن أيدي باللعبة',
      message: 'لعبة ببجي موبايل',
      createdAt: 'الآن',
      isRead: false,
      type: 'order_status',
      targetRole: 'supplier',
      actionTab: 'pending_orders'
    },
    {
      id: 'n2',
      title: 'طلب إيداع نقدي',
      message: 'إيداع 1000 ر.س',
      createdAt: 'الآن',
      isRead: false,
      type: 'deposit',
      targetRole: 'supplier',
      actionTab: 'deposits'
    },
    {
      id: 'n3',
      title: 'طلب سلفة مالية',
      message: 'طلب سلفة بمبلغ 250 ر.س',
      createdAt: 'الآن',
      isRead: false,
      type: 'loan',
      targetRole: 'supplier',
      actionTab: 'loans'
    },
    {
      id: 'n4',
      title: 'سداد سلفة بحوالة بنكية',
      message: 'سداد سلفة رقم LN-2026-001',
      createdAt: 'الآن',
      isRead: false,
      type: 'loan_repayment',
      targetRole: 'supplier',
      actionTab: 'loans'
    },
    {
      id: 'n5',
      title: 'تأكيد استلام حوالة',
      message: 'المفوض أكد استلام الحوالة',
      createdAt: 'الآن',
      isRead: false,
      type: 'receiver_confirmation',
      targetRole: 'supplier',
      actionTab: 'deposits'
    }
  ];

  const deposits = notifications.filter(n => n.type === 'deposit');
  const loans = notifications.filter(n => n.type === 'loan' || n.type === 'loan_repayment');
  const orders = notifications.filter(n => n.type === 'order_status');
  const confirmations = notifications.filter(n => n.type === 'receiver_confirmation');

  assert.equal(deposits.length, 1);
  assert.equal(loans.length, 2);
  assert.equal(orders.length, 1);
  assert.equal(confirmations.length, 1);
});
