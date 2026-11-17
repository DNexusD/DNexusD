import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { POSClient, SupplierBankAccount } from '../../types';
import { ALL_WORLD_COUNTRIES } from '../../constants/countries';
import { getBanksForCountry } from '../../constants/banksByCountry';
import {
  filterSupplierBankAccounts,
  getSupplierBankAccounts,
  resolveBankAccountReceiverEmployee,
  resolveBankAccountReceiverPos,
} from '../../utils/bankAccounts';
import { getActiveDropdownOptions } from '../../utils/platformSettings';
import {
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  Globe,
  KeyRound,
  Landmark,
  Mail,
  Phone,
  Plus,
  PlusCircle,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';

type AddBankMode = 'employee' | 'client';

interface BankEntryRow {
  rowKey: string;
  bankName: string;
  accountNumber: string;
  iban: string;
  notes: string;
  isCustomBank: boolean;
}

interface BatchFormState {
  country: string;
  delegatedPosId: string;
  accountHolderName: string;
  accountHolderEmail: string;
  accountHolderPhone: string;
  employeePassword: string;
  isActive: boolean;
  notes: string;
}

interface EditBankAccountFormState {
  id: string;
  bankName: string;
  accountNumber: string;
  iban: string;
  country: string;
  accountHolderName: string;
  accountHolderEmail: string;
  accountHolderPhone: string;
  holderType: 'employee' | 'client' | 'supplier';
  delegatedPosId: string;
  delegatedEmployeeId: string;
  canReceiveSupplierTransfers: boolean;
  isPrimary: boolean;
  isActive: boolean;
  notes: string;
}

const createBankEntryRow = (index = 1): BankEntryRow => ({
  rowKey: `row-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
  bankName: '',
  accountNumber: '',
  iban: '',
  notes: '',
  isCustomBank: false,
});

export const BankAccountsView: React.FC = () => {
  const {
    supplier,
    posClients,
    supplierBankAccounts,
    platformSettings,
    saveSupplierBankAccount,
    saveBatchBankAccounts,
    toggleBankAccountTransferPrivilege,
    deleteSupplierBankAccount,
    showToast,
  } = useApp();

  const approvedBankOptions = useMemo(
    () => getActiveDropdownOptions(platformSettings.approvedBankNames),
    [platformSettings.approvedBankNames]
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<EditBankAccountFormState | null>(null);
  const [addMode, setAddMode] = useState<AddBankMode>('employee');
  const [batchForm, setBatchForm] = useState<BatchFormState>({
    country: supplier.country || 'المملكة العربية السعودية',
    delegatedPosId: '',
    accountHolderName: '',
    accountHolderEmail: '',
    accountHolderPhone: '',
    employeePassword: '',
    isActive: true,
    notes: '',
  });
  const [bankEntries, setBankEntries] = useState<BankEntryRow[]>([createBankEntryRow(1)]);
  const [formError, setFormError] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const supplierAccounts = useMemo(
    () => getSupplierBankAccounts(supplierBankAccounts, supplier),
    [supplierBankAccounts, supplier]
  );

  const supplierPosClients = useMemo(
    () => posClients.filter((p) => p.supplierId === supplier.id),
    [posClients, supplier.id]
  );

  const supplierEmployees = useMemo(() => supplier.employees || [], [supplier.employees]);

  const filteredAccounts = useMemo(
    () =>
      filterSupplierBankAccounts(supplierAccounts, searchQuery, {
        posClients: supplierPosClients,
        employees: supplierEmployees,
      }),
    [supplierAccounts, searchQuery, supplierPosClients, supplierEmployees]
  );

  const delegatedAccountsCount = useMemo(
    () => supplierAccounts.filter((a) => a.canReceiveSupplierTransfers && a.isActive).length,
    [supplierAccounts]
  );

  const activeAccountsCount = useMemo(
    () => supplierAccounts.filter((a) => a.isActive !== false).length,
    [supplierAccounts]
  );

  const activeCountryForAdd = batchForm.country;
  const banksForAddCountry = useMemo(() => {
    const countrySpecific = getBanksForCountry(activeCountryForAdd);
    if (countrySpecific.length > 0) return countrySpecific;
    return approvedBankOptions.map((b) => b.labelAr);
  }, [activeCountryForAdd, approvedBankOptions]);

  const banksForEditCountry = useMemo(() => {
    if (!editingAccount) return [];
    const countrySpecific = getBanksForCountry(editingAccount.country);
    if (countrySpecific.length > 0) return countrySpecific;
    return approvedBankOptions.map((b) => b.labelAr);
  }, [editingAccount, approvedBankOptions]);

  const selectedClientObj = useMemo(
    () => supplierPosClients.find((c) => c.id === batchForm.delegatedPosId),
    [supplierPosClients, batchForm.delegatedPosId]
  );

  const openAddModal = () => {
    setEditingAccount(null);
    setAddMode('employee');
    setBatchForm({
      country: supplier.country || 'المملكة العربية السعودية',
      delegatedPosId: '',
      accountHolderName: '',
      accountHolderEmail: '',
      accountHolderPhone: '',
      employeePassword: '',
      isActive: true,
      notes: '',
    });
    setBankEntries([createBankEntryRow(1)]);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (account: SupplierBankAccount) => {
    const matchedPos = resolveBankAccountReceiverPos(
      { ...account, canReceiveSupplierTransfers: true },
      supplierPosClients
    );
    const matchedEmp = resolveBankAccountReceiverEmployee(
      { ...account, canReceiveSupplierTransfers: true },
      supplierEmployees
    );

    setEditingAccount({
      id: account.id.startsWith('default-') ? '' : account.id,
      bankName: account.bankName,
      accountNumber: account.accountNumber || '',
      iban: account.iban || '',
      country: account.country || 'المملكة العربية السعودية',
      accountHolderName: account.accountHolderName || '',
      accountHolderEmail: account.accountHolderEmail || '',
      accountHolderPhone: account.accountHolderPhone || '',
      holderType:
        account.holderType ||
        (matchedEmp || account.delegatedEmployeeId
          ? 'employee'
          : matchedPos || account.delegatedPosId
          ? 'client'
          : 'supplier'),
      delegatedPosId: account.delegatedPosId || matchedPos?.id || '',
      delegatedEmployeeId: account.delegatedEmployeeId || matchedEmp?.id || '',
      canReceiveSupplierTransfers: Boolean(account.canReceiveSupplierTransfers),
      isPrimary: Boolean(account.isPrimary),
      isActive: account.isActive !== false,
      notes: account.notes || '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleModeSwitch = (nextMode: AddBankMode) => {
    setAddMode(nextMode);
    setFormError('');
    if (nextMode === 'employee') {
      setBatchForm((prev) => ({
        ...prev,
        delegatedPosId: '',
        accountHolderName: '',
        accountHolderEmail: '',
        accountHolderPhone: '',
        employeePassword: '',
      }));
    } else {
      setBatchForm((prev) => ({
        ...prev,
        delegatedPosId: '',
        accountHolderName: '',
        accountHolderEmail: '',
        accountHolderPhone: '',
        employeePassword: '',
      }));
    }
    setBankEntries([createBankEntryRow(1)]);
  };

  const handleAddCountryChange = (nextCountry: string) => {
    const nextCountryBanks = getBanksForCountry(nextCountry);
    setBatchForm((prev) => ({ ...prev, country: nextCountry }));
    setBankEntries((prev) =>
      prev.map((row) => {
        if (row.isCustomBank) return row;
        const stillValid = nextCountryBanks.includes(row.bankName);
        return {
          ...row,
          bankName: stillValid ? row.bankName : '',
        };
      })
    );
  };

  const handleSelectPosClientForAdd = (posId: string) => {
    const chosen: POSClient | undefined = supplierPosClients.find((p) => p.id === posId);
    if (!chosen) {
      setBatchForm((prev) => ({
        ...prev,
        delegatedPosId: '',
        accountHolderName: '',
        accountHolderEmail: '',
        accountHolderPhone: '',
      }));
      return;
    }

    const clientCountry = chosen.country || batchForm.country || 'المملكة العربية السعودية';
    const nextCountryBanks = getBanksForCountry(clientCountry);

    setBatchForm((prev) => ({
      ...prev,
      delegatedPosId: chosen.id,
      accountHolderName: chosen.ownerName || chosen.tradeName,
      accountHolderEmail: chosen.email || '',
      accountHolderPhone: chosen.phone || '',
      country: clientCountry,
    }));

    setBankEntries((prev) =>
      prev.map((row) => {
        if (row.isCustomBank) return row;
        const stillValid = nextCountryBanks.includes(row.bankName);
        return {
          ...row,
          bankName: stillValid ? row.bankName : '',
        };
      })
    );
  };

  const handleUpdateBankRow = (rowKey: string, patch: Partial<BankEntryRow>) => {
    setBankEntries((prev) =>
      prev.map((row) => (row.rowKey === rowKey ? { ...row, ...patch } : row))
    );
  };

  const handleAddAnotherBankRow = () => {
    setBankEntries((prev) => [...prev, createBankEntryRow(prev.length + 1)]);
  };

  const handleRemoveBankRow = (rowKey: string) => {
    setBankEntries((prev) => (prev.length > 1 ? prev.filter((r) => r.rowKey !== rowKey) : prev));
  };

  const handleEditCountryChange = (nextCountry: string) => {
    if (!editingAccount) return;
    const nextCountryBanks = getBanksForCountry(nextCountry);
    setEditingAccount((prev) =>
      prev
        ? {
            ...prev,
            country: nextCountry,
            bankName:
              nextCountryBanks.length === 0 || nextCountryBanks.includes(prev.bankName)
                ? prev.bankName
                : '',
          }
        : null
    );
  };

  const handleSelectPosClientForEdit = (posId: string) => {
    if (!editingAccount) return;
    const chosen: POSClient | undefined = supplierPosClients.find((p) => p.id === posId);
    if (!chosen) {
      setEditingAccount((prev) => (prev ? { ...prev, delegatedPosId: '' } : null));
      return;
    }
    setEditingAccount((prev) =>
      prev
        ? {
            ...prev,
            holderType: 'client',
            delegatedPosId: chosen.id,
            delegatedEmployeeId: '',
            accountHolderName: chosen.ownerName || chosen.tradeName,
            accountHolderEmail: chosen.email || prev.accountHolderEmail,
            accountHolderPhone: chosen.phone || prev.accountHolderPhone,
            country: chosen.country || prev.country,
            canReceiveSupplierTransfers: true,
          }
        : null
    );
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

  const handleBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const res = saveBatchBankAccounts({
      mode: addMode,
      country: batchForm.country,
      accountHolderName: batchForm.accountHolderName,
      accountHolderEmail: batchForm.accountHolderEmail,
      accountHolderPhone: batchForm.accountHolderPhone,
      employeePassword: batchForm.employeePassword,
      delegatedPosId: addMode === 'client' ? batchForm.delegatedPosId : undefined,
      isActive: batchForm.isActive,
      notes: batchForm.notes,
      banks: bankEntries.map((row) => ({
        bankName: row.bankName,
        accountNumber: row.accountNumber,
        iban: row.iban,
        notes: row.notes,
      })),
    });

    if (!res.success) {
      setFormError(res.error || 'يرجى مراجعة الحقول المطلوبة');
      return;
    }
    setIsModalOpen(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setFormError('');
    const res = saveSupplierBankAccount({
      id: editingAccount.id || undefined,
      bankName: editingAccount.bankName,
      accountNumber: editingAccount.accountNumber,
      iban: editingAccount.iban,
      country: editingAccount.country,
      accountHolderName: editingAccount.accountHolderName,
      accountHolderEmail: editingAccount.accountHolderEmail,
      accountHolderPhone: editingAccount.accountHolderPhone,
      holderType: editingAccount.holderType,
      delegatedPosId: editingAccount.delegatedPosId || undefined,
      delegatedEmployeeId: editingAccount.delegatedEmployeeId || undefined,
      canReceiveSupplierTransfers: editingAccount.canReceiveSupplierTransfers,
      isPrimary: editingAccount.isPrimary,
      isActive: editingAccount.isActive,
      notes: editingAccount.notes,
    });
    if (!res.success) {
      setFormError(res.error || 'يرجى مراجعة الحقول المطلوبة');
      return;
    }
    setIsModalOpen(false);
    setEditingAccount(null);
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
            أضف حسابات بنكية عبر إضافة موظف استلام حوالات في بلده أو اختيار عميل من عملاء المتجر، مع دعم إضافة أكثر من بنك ومراجعة الحوالات.
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
            <span className="text-[11px] text-slate-400 block">حسابات مخوّلة لاستلام الحوالات</span>
            <span className="text-xl font-bold font-mono tabular-nums text-cyan-400 mt-0.5 block">
              {delegatedAccountsCount}
            </span>
          </div>
          <UserCheck className="w-6 h-6 text-cyan-400/80 shrink-0" />
        </div>
      </div>

      {/* Unified Search Bar */}
      <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-amber-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            aria-label="البحث في الحسابات البنكية"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بكل البيانات: اسم البنك، الدولة، اسم صاحب الحساب، رقم الحساب، الآيبان، البريد، الهاتف، الموظف أو العميل..."
            className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl pr-10 pl-9 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="مسح البحث"
              className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center absolute left-2 top-1/2 -translate-y-1/2 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 text-[11px] text-slate-400 px-1">
          <span>
            النتائج:{' '}
            <strong className="font-mono text-amber-400 tabular-nums">{filteredAccounts.length}</strong>{' '}
            من أصل{' '}
            <strong className="font-mono text-slate-200 tabular-nums">{supplierAccounts.length}</strong>
          </span>
        </div>
      </div>

      {/* Accounts Cards */}
      {filteredAccounts.length === 0 ? (
        <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3 text-xs">
          <div className="w-11 h-11 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
            <Search className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="font-bold text-sm text-white">لا توجد حسابات بنكية مطابقة لبحثك</p>
            <p className="text-slate-400">
              جرب البحث باسم البنك أو الدولة أو اسم صاحب الحساب أو رقم الحساب أو البريد الإلكتروني أو الملاحظات.
            </p>
          </div>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
            >
              مسح البحث وعرض جميع الحسابات
            </button>
          )}
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredAccounts.map((acc) => {
          const matchedPos = resolveBankAccountReceiverPos(
            { ...acc, canReceiveSupplierTransfers: true },
            supplierPosClients
          );
          const matchedEmployee = resolveBankAccountReceiverEmployee(
            { ...acc, canReceiveSupplierTransfers: true },
            supplierEmployees
          );
          const isEmployeeHolder =
            acc.holderType === 'employee' || Boolean(acc.delegatedEmployeeId) || Boolean(matchedEmployee);
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

                {/* Delegation & Privilege Status */}
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isEmployeeHolder ? (
                        <Briefcase className={`w-4 h-4 shrink-0 ${acc.canReceiveSupplierTransfers ? 'text-cyan-400' : 'text-slate-500'}`} />
                      ) : (
                        <ShieldCheck className={`w-4 h-4 shrink-0 ${acc.canReceiveSupplierTransfers ? 'text-emerald-400' : 'text-slate-500'}`} />
                      )}
                      <span
                        className={`font-bold ${
                          isEmployeeHolder
                            ? 'text-cyan-300'
                            : acc.canReceiveSupplierTransfers
                            ? 'text-emerald-300'
                            : 'text-slate-300'
                        }`}
                      >
                        {isEmployeeHolder
                          ? 'موظف استلام ومراجعة حوالات المتجر'
                          : acc.canReceiveSupplierTransfers
                          ? 'مخوّل باستلام ومراجعة حوالات المتجر'
                          : 'حساب متجر مباشر (غير مفوّض)'}
                      </span>
                    </div>
                    {isEmployeeHolder ? (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>
                          الموظف المسؤول:{' '}
                          <strong className="text-white">{matchedEmployee?.name || acc.accountHolderName}</strong>
                          {(matchedEmployee?.country || acc.country) && (
                            <span className="text-cyan-300"> · {matchedEmployee?.country || acc.country}</span>
                          )}
                        </span>
                      </div>
                    ) : matchedPos ? (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>
                          العميل المرتبط: <strong className="text-white">{matchedPos.tradeName}</strong>{' '}
                          <span className="font-mono text-amber-300">({matchedPos.posCode})</span>
                        </span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500">
                        حساب مباشر للمتجر لاستقبال إيداعات العملاء.
                      </div>
                    )}
                  </div>

                  {isPersisted && (matchedPos || isEmployeeHolder || acc.canReceiveSupplierTransfers) && (
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
      )}

      {/* Add / Edit Bank Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-black/80 overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 text-slate-100 my-auto max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    {editingAccount ? 'تعديل بيانات الحساب البنكي' : 'إضافة حساب بنكي جديد'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingAccount
                      ? 'عدّل تفاصيل الحساب البنكي والدولة وصاحب الحساب.'
                      : 'اختر إضافة صاحب الحساب كموظف استلام حوالات في بلده، أو اختيار عميل مسجل لديك وإضافة بنوكه.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingAccount(null);
                }}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
                aria-label="إغلاق النافذة"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editingAccount ? (
              /* Edit Existing Single Bank Account Form */
              <form onSubmit={handleEditSubmit} className="space-y-4 pt-4 text-xs">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 font-semibold">
                    {formError}
                  </div>
                )}

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <label className="block font-bold text-amber-300 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4" />
                    <span>ربط الحساب بنقطة بيع أو عميل (اختياري):</span>
                  </label>
                  <select
                    value={editingAccount.delegatedPosId}
                    onChange={(e) => handleSelectPosClientForEdit(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- حساب متجر مباشر / موظف --</option>
                    {supplierPosClients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.tradeName} ({client.ownerName}) · {client.posCode} {client.email ? `· ${client.email}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">الدولة التي يقع فيها الحساب:</label>
                    <select
                      required
                      value={editingAccount.country}
                      onChange={(e) => handleEditCountryChange(e.target.value)}
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
                    <label className="block font-semibold text-slate-300 mb-1">
                      اسم البنك (بنوك {editingAccount.country || 'الدولة'}):
                    </label>
                    <div className="space-y-1.5">
                      {banksForEditCountry.length > 0 && (
                        <select
                          value={banksForEditCountry.includes(editingAccount.bankName) ? editingAccount.bankName : ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              setEditingAccount({ ...editingAccount, bankName: e.target.value });
                            }
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        >
                          <option value="">-- اختر من بنوك {editingAccount.country} أو اكتب يدوياً أدناه --</option>
                          {banksForEditCountry.map((bank) => (
                            <option key={bank} value={bank}>
                              {bank}
                            </option>
                          ))}
                        </select>
                      )}
                      <input
                        type="text"
                        required
                        value={editingAccount.bankName}
                        onChange={(e) => setEditingAccount({ ...editingAccount, bankName: e.target.value })}
                        placeholder="اسم البنك"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">رقم الحساب البنكي:</label>
                    <input
                      type="text"
                      value={editingAccount.accountNumber}
                      onChange={(e) => setEditingAccount({ ...editingAccount, accountNumber: e.target.value })}
                      placeholder="مثال: 123608010123456"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">رقم الآيبان (IBAN) - اختياري:</label>
                    <input
                      type="text"
                      value={editingAccount.iban}
                      onChange={(e) => setEditingAccount({ ...editingAccount, iban: e.target.value })}
                      placeholder="SA448000..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">اسم صاحب الحساب:</label>
                    <input
                      type="text"
                      required
                      value={editingAccount.accountHolderName}
                      onChange={(e) => setEditingAccount({ ...editingAccount, accountHolderName: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">إيميل صاحب الحساب:</label>
                    <input
                      type="email"
                      required
                      value={editingAccount.accountHolderEmail}
                      onChange={(e) => setEditingAccount({ ...editingAccount, accountHolderEmail: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">رقم الهاتف (اختياري):</label>
                    <input
                      type="text"
                      value={editingAccount.accountHolderPhone}
                      onChange={(e) => setEditingAccount({ ...editingAccount, accountHolderPhone: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">ملاحظات الحساب (اختياري):</label>
                  <input
                    type="text"
                    value={editingAccount.notes}
                    onChange={(e) => setEditingAccount({ ...editingAccount, notes: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-emerald-500/40">
                    <input
                      type="checkbox"
                      checked={editingAccount.canReceiveSupplierTransfers}
                      onChange={(e) => setEditingAccount({ ...editingAccount, canReceiveSupplierTransfers: e.target.checked })}
                      className="w-4 h-4 mt-0.5 rounded text-emerald-500 bg-slate-900 border-slate-700"
                    />
                    <div>
                      <span className="font-bold text-white block">منح ميزة استلام ومراجعة حوالات المتجر</span>
                      <span className="text-[11px] text-slate-400">تفعيل مراجعة وتأكيد استلام الحوالات الواردة لهذا الحساب.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <input
                      type="checkbox"
                      checked={editingAccount.isActive}
                      onChange={(e) => setEditingAccount({ ...editingAccount, isActive: e.target.checked })}
                      className="w-4 h-4 mt-0.5 rounded text-amber-500 bg-slate-900 border-slate-700"
                    />
                    <div>
                      <span className="font-bold text-white block">الحساب نشط ومتاح للإيداع</span>
                      <span className="text-[11px] text-slate-400">يظهر الحساب للعملاء عند طلب شحن رصيد المحفظة.</span>
                    </div>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingAccount(null);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>حفظ التعديلات</span>
                  </button>
                </div>
              </form>
            ) : (
              /* Add New Bank Account Flow: Two Explicit Choices */
              <form onSubmit={handleBatchSubmit} className="space-y-4 pt-4 text-xs">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 font-semibold">
                    {formError}
                  </div>
                )}

                {/* Mode Choice Selector */}
                <div className="space-y-2">
                  <span className="block font-bold text-slate-200">اختر نوع صاحب الحساب البنكي:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleModeSwitch('employee')}
                      aria-pressed={addMode === 'employee'}
                      className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer flex items-start gap-2.5 ${
                        addMode === 'employee'
                          ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          addMode === 'employee' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-xs block text-white">
                          إضافة كموظف (مستلم حوالات في بلده)
                        </span>
                        <span className="text-[11px] text-slate-400 block mt-0.5 leading-snug">
                          ليس عميلاً، يُضاف كموظف بمهمة استلام ومراجعة وتأكيد حوالات المتجر في بلده.
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleModeSwitch('client')}
                      aria-pressed={addMode === 'client'}
                      className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer flex items-start gap-2.5 ${
                        addMode === 'client'
                          ? 'bg-amber-500/15 border-amber-400 text-white shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          addMode === 'client' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-xs block text-white">
                          اختيار عميل من عملاء المتجر
                        </span>
                        <span className="text-[11px] text-slate-400 block mt-0.5 leading-snug">
                          اختيار عميل مسجل وتعبئة بياناته تلقائياً مع إضافة بنك أو أكثر لحوالات المتجر.
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* MODE 1: ADD AS EMPLOYEE (Not a Client) */}
                {addMode === 'employee' && (
                  <>
                    {/* Step 1: Country Selection First */}
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-cyan-500/30 space-y-2">
                      <label htmlFor="employee-bank-country" className="block font-bold text-cyan-300 flex items-center gap-1.5">
                        <Globe className="w-4 h-4" />
                        <span>1. الدولة التي يملك الموظف حسابات بنكية فيها:</span>
                      </label>
                      <select
                        id="employee-bank-country"
                        required
                        value={batchForm.country}
                        onChange={(e) => handleAddCountryChange(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                      >
                        <option value="">اختر الدولة...</option>
                        {ALL_WORLD_COUNTRIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-slate-400">
                        تُعرض لك مباشرة قائمة البنوك الواقعة في ({batchForm.country || 'الدولة المختارة'}) لتختار منها بنكاً أو أكثر.
                      </p>
                    </div>

                    {/* Step 2: Banks List in Chosen Country (Multi-Bank Supported) */}
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-white flex items-center gap-1.5">
                            <Landmark className="w-4 h-4 text-amber-400" />
                            <span>2. الحسابات البنكية للموظف في ({batchForm.country || 'الدولة المختارة'}):</span>
                          </span>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            اختر البنك من القائمة الخاصة بنفس الدولة ويمكنك إضافة أكثر من بنك.
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={handleAddAnotherBankRow}
                          className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 font-bold text-[11px] flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>إضافة بنك آخر</span>
                        </button>
                      </div>

                      <div className="space-y-3">
                        {bankEntries.map((row, index) => {
                          const hasPresetBanks = banksForAddCountry.length > 0;
                          const selectVal = row.isCustomBank
                            ? '__custom__'
                            : banksForAddCountry.includes(row.bankName)
                            ? row.bankName
                            : '';

                          return (
                            <div
                              key={row.rowKey}
                              className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-amber-300">
                                  البنك رقم {index + 1} · ({batchForm.country})
                                </span>
                                {bankEntries.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveBankRow(row.rowKey)}
                                    className="text-rose-400 hover:text-rose-300 text-[11px] flex items-center gap-1 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>حذف</span>
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div className="sm:col-span-2 space-y-1.5">
                                  <label className="block font-semibold text-slate-300">
                                    اختر البنك ({batchForm.country}):
                                  </label>
                                  {hasPresetBanks && (
                                    <select
                                      aria-label={`بنك رقم ${index + 1}`}
                                      value={selectVal}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '__custom__') {
                                          handleUpdateBankRow(row.rowKey, { isCustomBank: true, bankName: '' });
                                        } else {
                                          handleUpdateBankRow(row.rowKey, { isCustomBank: false, bankName: val });
                                        }
                                      }}
                                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                                    >
                                      <option value="">-- اختر البنك من قائمة بنوك {batchForm.country} --</option>
                                      {banksForAddCountry.map((bank) => (
                                        <option key={bank} value={bank}>
                                          {bank}
                                        </option>
                                      ))}
                                      <option value="__custom__">أخرى / كتابة اسم بنك آخر يدوياً</option>
                                    </select>
                                  )}

                                  {(row.isCustomBank || !hasPresetBanks) && (
                                    <input
                                      type="text"
                                      required
                                      value={row.bankName}
                                      onChange={(e) => handleUpdateBankRow(row.rowKey, { bankName: e.target.value })}
                                      placeholder="اكتب اسم البنك في هذه الدولة"
                                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                                    />
                                  )}
                                </div>

                                <div>
                                  <label className="block font-semibold text-slate-300 mb-1">رقم الحساب البنكي:</label>
                                  <input
                                    type="text"
                                    value={row.accountNumber}
                                    onChange={(e) => handleUpdateBankRow(row.rowKey, { accountNumber: e.target.value })}
                                    placeholder="مثال: 123608010123456"
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-400"
                                    dir="ltr"
                                  />
                                </div>

                                <div>
                                  <label className="block font-semibold text-slate-300 mb-1">رقم الآيبان (IBAN) - اختياري:</label>
                                  <input
                                    type="text"
                                    value={row.iban}
                                    onChange={(e) => handleUpdateBankRow(row.rowKey, { iban: e.target.value })}
                                    placeholder="SA448000..."
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-400"
                                    dir="ltr"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Step 3: Remaining Employee Details */}
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                      <div className="flex items-start gap-2">
                        <UserCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-white block">
                            3. استكمال بقية بيانات الموظف (استلام ومراجعة وتأكيد الحوالات):
                          </span>
                          <span className="text-[11px] text-slate-400">
                            سيتم إضافته تلقائياً كموظف لدى المتجر بمهمة استلام ومراجعة وتأكيد الحوالات الواردة لهذه الحسابات في ({batchForm.country}).
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-300 mb-1">الاسم الكامل للموظف:</label>
                          <input
                            type="text"
                            required
                            value={batchForm.accountHolderName}
                            onChange={(e) => setBatchForm({ ...batchForm, accountHolderName: e.target.value })}
                            placeholder="اسم الموظف وصاحب الحساب"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-300 mb-1">البريد الإلكتروني للموظف:</label>
                          <input
                            type="email"
                            required
                            value={batchForm.accountHolderEmail}
                            onChange={(e) => setBatchForm({ ...batchForm, accountHolderEmail: e.target.value })}
                            placeholder="employee@example.com"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-400"
                            dir="ltr"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-300 mb-1">رقم هاتف الموظف:</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={batchForm.accountHolderPhone}
                              onChange={(e) => setBatchForm({ ...batchForm, accountHolderPhone: e.target.value })}
                              placeholder="+967 77..."
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 pl-8 text-white font-mono focus:outline-none focus:border-cyan-400"
                              dir="ltr"
                            />
                            <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                          </div>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-300 mb-1">كلمة مرور دخول الموظف (اختياري):</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={batchForm.employeePassword}
                              onChange={(e) => setBatchForm({ ...batchForm, employeePassword: e.target.value })}
                              placeholder="افتراضي: 123456"
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 pl-8 text-white font-mono focus:outline-none focus:border-cyan-400"
                              dir="ltr"
                            />
                            <KeyRound className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* MODE 2: CHOOSE FROM SUPPLIER CLIENTS */}
                {addMode === 'client' && (
                  <>
                    {/* Step 1: Choose Client First */}
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-2.5">
                      <label htmlFor="select-supplier-client" className="block font-bold text-amber-300 flex items-center gap-1.5">
                        <Users className="w-4 h-4" />
                        <span>1. اختر عميلاً من قائمة عملاء المتجر:</span>
                      </label>
                      <select
                        id="select-supplier-client"
                        required
                        value={batchForm.delegatedPosId}
                        onChange={(e) => handleSelectPosClientForAdd(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="">-- اختر العميل لتعبئة بياناته تلقائياً --</option>
                        {supplierPosClients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.tradeName} ({client.ownerName}) · {client.posCode} · {client.country}
                            {client.email ? ` · ${client.email}` : ''}
                          </option>
                        ))}
                      </select>

                      {supplierPosClients.length === 0 && (
                        <p className="text-[11px] text-rose-300">
                          لا يوجد عملاء مسجلون لديك حالياً. يمكنك اختيار &quot;إضافة كموظف&quot; أعلاه.
                        </p>
                      )}

                      {selectedClientObj && (
                        <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/30 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>تمت تعبئة البيانات الشخصية من ملف العميل تلقائياً:</span>
                            </span>
                            <span className="font-mono text-[10px] text-amber-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                              {selectedClientObj.posCode}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1">اسم صاحب الحساب (العميل):</label>
                              <input
                                type="text"
                                required
                                value={batchForm.accountHolderName}
                                onChange={(e) => setBatchForm({ ...batchForm, accountHolderName: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1">البريد الإلكتروني:</label>
                              <input
                                type="email"
                                required
                                value={batchForm.accountHolderEmail}
                                onChange={(e) => setBatchForm({ ...batchForm, accountHolderEmail: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                                dir="ltr"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1">رقم الهاتف:</label>
                              <input
                                type="text"
                                value={batchForm.accountHolderPhone}
                                onChange={(e) => setBatchForm({ ...batchForm, accountHolderPhone: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                                dir="ltr"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-1">دولة الحساب البنكي:</label>
                              <select
                                required
                                value={batchForm.country}
                                onChange={(e) => handleAddCountryChange(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500"
                              >
                                {ALL_WORLD_COUNTRIES.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Step 2: Banks List Dedicated for Receiving Supplier Transfers */}
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-white flex items-center gap-1.5">
                            <Landmark className="w-4 h-4 text-amber-400" />
                            <span>
                              2. الحسابات البنكية الخاصة باستلام حوالات المتجر ({batchForm.country || 'الدولة'}):
                            </span>
                          </span>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            تُخصص هذه الحسابات للعميل لاستلام حوالات المتجر ومراجعتها وتأكيدها، ويمكنك إضافة أكثر من بنك.
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={handleAddAnotherBankRow}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 font-bold text-[11px] flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>إضافة بنك آخر لهذا العميل</span>
                        </button>
                      </div>

                      <div className="space-y-3">
                        {bankEntries.map((row, index) => {
                          const hasPresetBanks = banksForAddCountry.length > 0;
                          const selectVal = row.isCustomBank
                            ? '__custom__'
                            : banksForAddCountry.includes(row.bankName)
                            ? row.bankName
                            : '';

                          return (
                            <div
                              key={row.rowKey}
                              className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-amber-300">
                                  الحساب البنكي رقم {index + 1} · ({batchForm.country})
                                </span>
                                {bankEntries.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveBankRow(row.rowKey)}
                                    className="text-rose-400 hover:text-rose-300 text-[11px] flex items-center gap-1 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>حذف</span>
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div className="sm:col-span-2 space-y-1.5">
                                  <label className="block font-semibold text-slate-300">
                                    اسم البنك ({batchForm.country}):
                                  </label>
                                  {hasPresetBanks && (
                                    <select
                                      aria-label={`بنك العميل رقم ${index + 1}`}
                                      value={selectVal}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '__custom__') {
                                          handleUpdateBankRow(row.rowKey, { isCustomBank: true, bankName: '' });
                                        } else {
                                          handleUpdateBankRow(row.rowKey, { isCustomBank: false, bankName: val });
                                        }
                                      }}
                                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                                    >
                                      <option value="">-- اختر البنك من قائمة بنوك {batchForm.country} --</option>
                                      {banksForAddCountry.map((bank) => (
                                        <option key={bank} value={bank}>
                                          {bank}
                                        </option>
                                      ))}
                                      <option value="__custom__">أخرى / كتابة اسم بنك آخر يدوياً</option>
                                    </select>
                                  )}

                                  {(row.isCustomBank || !hasPresetBanks) && (
                                    <input
                                      type="text"
                                      required
                                      value={row.bankName}
                                      onChange={(e) => handleUpdateBankRow(row.rowKey, { bankName: e.target.value })}
                                      placeholder="اكتب اسم البنك"
                                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                                    />
                                  )}
                                </div>

                                <div>
                                  <label className="block font-semibold text-slate-300 mb-1">رقم الحساب البنكي:</label>
                                  <input
                                    type="text"
                                    value={row.accountNumber}
                                    onChange={(e) => handleUpdateBankRow(row.rowKey, { accountNumber: e.target.value })}
                                    placeholder="مثال: 301928374"
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                                    dir="ltr"
                                  />
                                </div>

                                <div>
                                  <label className="block font-semibold text-slate-300 mb-1">رقم الآيبان (IBAN) - اختياري:</label>
                                  <input
                                    type="text"
                                    value={row.iban}
                                    onChange={(e) => handleUpdateBankRow(row.rowKey, { iban: e.target.value })}
                                    placeholder="SA448000..."
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                                    dir="ltr"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {/* Common Notes & Active Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">ملاحظات عامة (اختياري):</label>
                    <input
                      type="text"
                      value={batchForm.notes}
                      onChange={(e) => setBatchForm({ ...batchForm, notes: e.target.value })}
                      placeholder={
                        addMode === 'employee'
                          ? `حساب استلام حوالات العملاء في ${batchForm.country || 'الدولة'}`
                          : 'حساب خاص باستلام ومراجعة حوالات المتجر'
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40">
                    <input
                      type="checkbox"
                      checked={batchForm.isActive}
                      onChange={(e) => setBatchForm({ ...batchForm, isActive: e.target.checked })}
                      className="w-4 h-4 mt-0.5 rounded text-amber-500 bg-slate-900 border-slate-700"
                    />
                    <div>
                      <span className="font-bold text-white block">الحسابات نشطة ومتاحة للإيداع</span>
                      <span className="text-[11px] text-slate-400">
                        تظهر هذه الحسابات للعملاء عند شحن الرصيد وتُفوّض تلقائياً لاستلام ومراجعة وتأكيد الحوالات.
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
                    <span>
                      {addMode === 'employee'
                        ? `حفظ الموظف و(${bankEntries.length}) حساب بنكي`
                        : `حفظ (${bankEntries.length}) حساب بنكي للعميل`}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
