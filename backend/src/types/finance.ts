export type ExpenseCategory =
  | 'Yarn & Materials'
  | 'Packaging'
  | 'Marketing & Ads'
  | 'Equipment'
  | 'Labor'
  | 'Shipping & Delivery'
  | 'Miscellaneous';

export type Partner = 'Mohamed' | 'Mariam';
export type PaymentSource = Partner | 'Both' | 'Business';

export interface Order {
  id: string;
  shopifyOrderId: string;
  totalAmount: number;
  city: string;
  fulfilledAt: Date;
  deliveryFee: number;
  netRevenue: number;
  status: 'fulfilled' | 'cancelled' | 'loss';
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  date: Date;
  category: ExpenseCategory;
  paidBy: PaymentSource;
  shared: boolean;
  recurring: boolean;
  note?: string;
  settled: boolean;
  settledAt?: Date;
  settledMohamed?: boolean;
  settledMariam?: boolean;
  splitPayment?: { mohamed: number; mariam: number };
}

export interface Settlement {
  id: string;
  partner: Partner;
  amount: number;
  date: Date;
  relatedExpenses: string[]; // Expense IDs
  note?: string;
}

export interface PartnerBalance {
  partner: Partner;
  owedAmount: number;
  settledAmount: number;
  lastSettlement?: Date;
} 