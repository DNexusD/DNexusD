export interface ClientWallet {
  id: string; // wallet-{clientId}
  clientId: string; // posClients ID or users UID
  supplierId: string; // associated supplier ID or "platform"
  currency: 'SAR' | 'USD';
  availableBalance: number;
  pendingBalance: number;
  totalDeposited: number;
  totalSpent: number;
  status: 'active' | 'frozen';
  createdAt: string;
  updatedAt: string;
}

export type WalletTransactionType =
  | 'deposit'
  | 'order_hold'
  | 'order_capture'
  | 'order_release'
  | 'refund'
  | 'manual_credit'
  | 'manual_debit'
  | 'loan_repayment';

export type WalletTransactionDirection = 'credit' | 'debit' | 'hold' | 'release';

export type WalletReferenceType = 'order' | 'depositRequest' | 'loanRepayment' | 'manual';

export interface WalletTransaction {
  id: string;
  walletId: string;
  clientId: string;
  supplierId?: string;
  type: WalletTransactionType;
  direction: WalletTransactionDirection;
  amount: number;
  availableBalanceBefore: number;
  availableBalanceAfter: number;
  pendingBalanceBefore: number;
  pendingBalanceAfter: number;
  referenceType: WalletReferenceType;
  referenceId: string;
  description: string;
  createdBy: string;
  createdAt: string;
}
