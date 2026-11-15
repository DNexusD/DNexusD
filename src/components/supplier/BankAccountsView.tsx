import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { POSClient, SupplierBankAccount } from '../../types';
import { ALL_WORLD_COUNTRIES } from '../../constants/countries';
import {
  getSupplierBankAccounts,
  normalizeEmail,
  resolveBankAccountReceiverPos,
} from '../../utils/bankAccounts';
import { getActiveDropdownOptions } from '../../utils/platformSettings';
import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  Globe,
  Landmark,
  Mail,
  Phone,
  PlusCircle,
  ShieldCheck,
  Store,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';

interface BankAccountFormState {
  id?: string;
  bankName: string;
  accountNumber: string;
  iban: string;
  country: string;
  accountHolderName: string;
  accountHolderEmail: string;
  accountHolderPhone: string;
  delegatedPosId: string;
  canReceiveSupplierTransfers: boolean;
  isPrimary: boolean;
  isActive: boolean;
  notes: string;
}

const EMPTY_FORM: BankAccountFormState = {
  bankName: '',
  accountNumber: '',
  iban: '',
  country: 'المملكة العربية السعودية',
  accountHolderName: '',
  accountHolderEmail: '',
  accountHolderPhone: '',
  delegatedPosId: '',
  canReceiveSupplierTransfers: false,
  isPrimary: false,
  isActive: true,
  notes: '',
};

export const BankAccountsView: React.FC = () => {
  const {
    supplier,
    posClients,
    supplierBankAccounts,
    platformSettings,
    saveSupplierBankAccount,
    toggleBankAccountTransferPrivilege,
    deleteSupplierBankAccount,
    showToast,
  } = useApp();

  const approvedBankOptions = useMemo(
    () => getActiveDropdownOptions(platformSettings.approvedBankNames),
    [platformSettings.approvedBankNames]
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<BankAccountFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const supplierAccounts = useMemo(
    () => getSupplierBankAccounts(supplierBankAccounts, supplier),
    [supplierBankAccounts, supplier]
  );

  const supplierPosClients = useMemo(
    () => posClients.filter((p) => p.supplierId === supplier.id),
    [posClients, supplier.id]
  );

  const delegatedAccountsCount = useMemo(
    () => supplierAccounts.filter((a) => a.canReceiveSupplierTransfers && a.isActive).length,
    [supplierAccounts]
  );

  const activeAccountsCount = useMemo(
    () => supplierAccounts.filter((a) => a.isActive !== false).length,
    [supplierAccounts]
  );

  const openAddModal = () => {
    setForm({
      ...EMPTY_FORM,
      country: supplier.country || 'المملكة العربية السعودية',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (account: SupplierBankAccount) => {
    const matchedPos = resolveBankAccountReceiverPos(
      { ...account, canReceiveSupplierTransfers: true },
      supplierPosClients
    );
    setForm({
      id: account.id.startsWith('default-') ? undefined : account.id,
      bankName: account.bankName,
      accountNumber: account.accountNumber || '',
      iban: account.iban || '',
      country: account.country || 'المملكة العربية السعودية',
      accountHolderName: account.accountHolderName || '',
      accountHolderEmail: account.accountHolderEmail || '',
      accountHolderPhone: account.accountHolderPhone || '',
      delegatedPosId: account.delegatedPosId || matchedPos?.id || '',
      canReceiveSupplierTransfers: Boolean(account.canReceiveSupplierTransfers),
      isPrimary: Boolean(account.isPrimary),
      isActive: account.isActive !== false,
      notes: account.notes || '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSelectPosClient = (posId: string) => {
    const chosen: POSClient | undefined = supplierPosClients.find((p) => p.id === posId);
    if (!chosen) {
      setForm((prev) => ({
        ...prev,
        delegatedPosId: '',
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      delegatedPosId: chosen.id,
      accountHolderName: chosen.ownerName || chosen.tradeName,
      accountHolderEmail: chosen.email || prev.accountHolderEmail,
      accountHolderPhone: chosen.phone || prev.accountHolderPhone,
      country: chosen.country || prev.country,
      canReceiveSupplierTransfers: true,
    }));
  };

  const handleEmailChange = (value: string) => {
    const clean = normalizeEmail(value);
    const matchedPos = supplierPosClients.find((p) => normalizeEmail(p.email) === clean);
    setForm((prev) => ({
      ...prev,
      accountHolderEmail: value,
      delegatedPosId: matchedPos ? matchedPos.id : prev.delegatedPosId,
    }));
  };

  const handleCopy = (val: string, key: string, label: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    setCopiedKey(key);
    showToast({
      type: 'success',
      title: 'تم النسخ',
      description: `تم نسخ ${label} إلى الحافظة.`,
    });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const res = saveSupplierBankAccount({
      id: form.id,
      bankName: form.bankName,
      accountNumber: form.accountNumber,
      iban: form.iban,
      country: form.country,
      accountHolderName: form.accountHolderName,
      accountHolderEmail: form.accountHolderEmail,
      accountHolderPhone: form.accountHolderPhone,
      delegatedPosId: form.delegatedPosId || undefined,
      canReceiveSupplierTransfers: form.canReceiveSupplierTransfers,
      isPrimary: form.isPrimary,
      isActive: form.isActive,
      notes: form.notes,
    });
    if (!res.success) {
      setFormError(res.error || 'يرجى مراجعة الحقول المطلوبة');
      return;
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Header Strip */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Landmark className="w-5 h-5 text-amber-400 shrink-0" />
            <span>إدارة الحسابات البنكية وتفويض استلام الحوالات</span>
          </h2>
          <p className="text-xs text-slate-400">
            أضف وعدّل حساباتك البنكية مع بيانات صاحب الحساب والدولة والإيميل، وامنح ميزة استلام ومراجعة الحوالات لأي نقطة بيع أو عميل.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          <span>إضافة حساب بنكي جديد</span>
        </button>
      </div>

      {/* Compact Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block">إجمالي الحسابات البنكية</span>
            <span className="text-xl font-bold font-mono tabular-nums text-white mt-0.5 block">
              {supplierAccounts.length}
            </span>
          </div>
          <Landmark className="w-6 h-6 text-amber-400/80 shrink-0" />
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block">الحسابات النشطة للإيداع</span>
            <span className="text-xl font-bold font-mono tabular-nums text-emerald-400 mt-0.5 block">
              {activeAccountsCount}
            </span>
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-400/80 shrink-0" />
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block">حسابات مخوّلة لنقاط البيع</span>
            <span className="text-xl font-bold font-mono tabular-nums text-cyan-400 mt-0.5 block">
              {delegatedAccountsCount}
            </span>
          </div>
          <UserCheck className="w-6 h-6 text-cyan-400/80 shrink-0" />
        </div>
      </div>

      {/* Accounts Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {supplierAccounts.map((acc) => {
          const matchedPos = resolveBankAccountReceiverPos(
            { ...acc, canReceiveSupplierTransfers: true },
            supplierPosClients
          );
          const isPersisted = !acc.id.startsWith('default-');

          return (
            <div
              key={acc.id}
              className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 text-xs flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Top Line: Bank & Actions */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-amber-400 shrink-0">
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-white truncate">{acc.bankName}</h3>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1 text-slate-300">
                          <Globe className="w-3 h-3 text-slate-500" />
                          <span>{acc.country}</span>
                        </span>
                        <span>·</span>
                        <span className={acc.isActive !== false ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                          {acc.isActive !== false ? 'نشط للتحويل' : 'موقوف'}
                        </span>
                        {acc.isPrimary && (
                          <>
                            <span>·</span>
                            <span className="text-amber-400 font-semibold">حساب رئيسي</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(acc)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                      <span>تعديل</span>
                    </button>

                    {isPersisted && !acc.isPrimary && (
                      <button
                        type="button"
                        onClick={() => deleteSupplierBankAccount(acc.id)}
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors cursor-pointer"
                        title="حذف الحساب البنكي"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Holder Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-500 block">اسم صاحب الحساب</span>
                    <span className="font-semibold text-white">{acc.accountHolderName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">إيميل صاحب الحساب</span>
                    <span className="font-mono text-slate-200 flex items-center gap-1 truncate">
                      <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                      <bdi dir="ltr">{acc.accountHolderEmail}</bdi>
                    </span>
                  </div>
                  {acc.accountNumber && (
                    <div>
                      <span className="text-[10px] text-slate-500 block">رقم الحساب</span>
                      <div className="flex items-center gap-1.5 font-mono text-amber-300 font-bold">
                        <bdi dir="ltr">{acc.accountNumber}</bdi>
                        <button
                          type="button"
                          onClick={() => handleCopy(acc.accountNumber, `${acc.id}-num`, 'رقم الحساب')}
                          className="text-slate-400 hover:text-white cursor-pointer"
                          title="نسخ رقم الحساب"
                        >
                          {copiedKey === `${acc.id}-num` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  )}
                  {acc.iban && (
                    <div>
                      <span className="text-[10px] text-slate-500 block">رقم الآيبان (IBAN)</span>
                      <div className="flex items-center gap-1.5 font-mono text-cyan-300 font-semibold truncate">
                        <bdi dir="ltr" className="truncate">{acc.iban}</bdi>
                        <button
                          type="button"
                          onClick={() => handleCopy(acc.iban || '', `${acc.id}-iban`, 'الآيبان')}
                          className="text-slate-400 hover:text-white shrink-0 cursor-pointer"
                          title="نسخ الآيبان"
                        >
                          {copiedKey === `${acc.id}-iban` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* POS Delegation & Privilege Status */}
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className={`w-4 h-4 shrink-0 ${acc.canReceiveSupplierTransfers ? 'text-emerald-400' : 'text-slate-500'}`} />
                      <span className={`font-bold ${acc.canReceiveSupplierTransfers ? 'text-emerald-300' : 'text-slate-300'}`}>
                        {acc.canReceiveSupplierTransfers
                          ? 'مخوّل باستلام ومراجعة حوالات المتجر'
                          : 'حساب متجر مباشر (غير مفوّض لنقطة بيع)'}
                      </span>
                    </div>
                    {matchedPos ? (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>
                          نقطة البيع المرتبطة: <strong className="text-white">{matchedPos.tradeName}</strong>{' '}
                          <span className="font-mono text-amber-300">({matchedPos.posCode})</span>
                        </span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500">
                        لم يتم ربطه بنقطة بيع مسجلة بنفس البريد الإلكتروني بعد.
                      </div>
                    )}
                  </div>

                  {isPersisted && (matchedPos || acc.canReceiveSupplierTransfers) && (
                    <button
                      type="button"
                      onClick={() => toggleBankAccountTransferPrivilege(acc.id, !acc.canReceiveSupplierTransfers)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        acc.canReceiveSupplierTransfers
                          ? 'bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-500/40'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      }`}
                    >
                      {acc.canReceiveSupplierTransfers ? 'إلغاء ميزة الاستلام' : 'منح ميزة استلام الحوالات'}
                    </button>
                  )}
                </div>

                {acc.notes && (
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    ملاحظة: {acc.notes}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Bank Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 text-slate-100 my-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    {form.id ? 'تعديل بيانات الحساب البنكي' : 'إضافة حساب بنكي جديد'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    أدخل بيانات الحساب البنكي وصاحب الحساب والدولة، ويمكنك منح نقطة بيع ميزة استلام الحوالات.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pt-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 font-semibold">
                  {formError}
                </div>
              )}

              {/* Quick Link to Existing POS Client / Customer */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="block font-bold text-amber-300 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" />
                  <span>ربط الحساب بنقطة بيع أو عميل (اختياري — تعبئة تلقائية للبيانات):</span>
                </label>
                <select
                  value={form.delegatedPosId}
                  onChange={(e) => handleSelectPosClient(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- حساب متجر مباشر / اختيار يدوي --</option>
                  {supplierPosClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.tradeName} ({client.ownerName}) · {client.posCode} {client.email ? `· ${client.email}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bank Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">اسم البنك:</label>
                  <div className="space-y-1.5">
                    {approvedBankOptions.length > 0 && (
                      <select
                        value={approvedBankOptions.some((b) => b.labelAr === form.bankName) ? form.bankName : ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            setForm({ ...form, bankName: e.target.value });
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="">-- اختر من قائمة البنوك المعتمدة أو اكتب يدوياً أدناه --</option>
                        {approvedBankOptions.map((bank) => (
                          <option key={bank.id} value={bank.labelAr}>
                            {bank.labelAr}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      type="text"
                      required
                      value={form.bankName}
                      onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                      placeholder="مثال: مصرف الراجحي / بنك الكريمي / البنك الأهلي"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">الدولة التي يقع فيها الحساب:</label>
                  <select
                    required
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">اختر الدولة...</option>
                    {ALL_WORLD_COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">رقم الحساب البنكي:</label>
                  <input
                    type="text"
                    value={form.accountNumber}
                    onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                    placeholder="مثال: 123608010123456"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">رقم الآيبان (IBAN) - اختياري:</label>
                  <input
                    type="text"
                    value={form.iban}
                    onChange={(e) => setForm({ ...form, iban: e.target.value })}
                    placeholder="SA448000..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Account Holder Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">اسم صاحب الحساب:</label>
                  <input
                    type="text"
                    required
                    value={form.accountHolderName}
                    onChange={(e) => setForm({ ...form, accountHolderName: e.target.value })}
                    placeholder="الاسم الكامل لصاحب الحساب"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">إيميل صاحب الحساب:</label>
                  <input
                    type="email"
                    required
                    value={form.accountHolderEmail}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="holder@example.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">رقم هاتف صاحب الحساب (اختياري):</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={form.accountHolderPhone}
                      onChange={(e) => setForm({ ...form, accountHolderPhone: e.target.value })}
                      placeholder="+966 5x..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 pl-8 text-white font-mono focus:outline-none focus:border-amber-500"
                      dir="ltr"
                    />
                    <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">ملاحظات الحساب (اختياري):</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="مثال: حساب استقبال حوالات العملاء في اليمن أو الرياض"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Delegation & Status Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-emerald-500/40">
                  <input
                    type="checkbox"
                    checked={form.canReceiveSupplierTransfers}
                    onChange={(e) => setForm({ ...form, canReceiveSupplierTransfers: e.target.checked })}
                    className="w-4 h-4 mt-0.5 rounded text-emerald-500 bg-slate-900 border-slate-700"
                  />
                  <div>
                    <span className="font-bold text-white block">
                      منح ميزة استلام ومراجعة حوالات المتجر
                    </span>
                    <span className="text-[11px] text-slate-400">
                      عند التفعيل، تظهر لنقطة البيع / العميل واجهة &quot;استلام ومراجعة حوالات المتجر&quot; لتأكيد استلام الحوالات الواردة لهذا الحساب.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="w-4 h-4 mt-0.5 rounded text-amber-500 bg-slate-900 border-slate-700"
                  />
                  <div>
                    <span className="font-bold text-white block">الحساب نشط ومتاح للإيداع</span>
                    <span className="text-[11px] text-slate-400">
                      يظهر هذا الحساب للعملاء عند تقديم طلب شحن رصيد المحفظة لاختيار الحساب المحوّل إليه.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{form.id ? 'حفظ التعديلات' : 'إضافة وحفظ الحساب'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
