export type ExpenseCategory =
  | 'Yarn & Materials'
  | 'Packaging'
  | 'Marketing & Ads'
  | 'Equipment'
  | 'Labor'
  | 'Shipping & Delivery'
  | 'Miscellaneous';

export type PaymentSource = 'Business' | 'Mohamed' | 'Mariam' | 'Both';

export interface SplitPayment {
  mohamed: number;
  mariam: number;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  date: Date;
  category: ExpenseCategory;
  paidBy: PaymentSource;
  splitPayment?: SplitPayment;
  note?: string;
  settled: boolean;
  settledAt?: Date;
  settledMohamed?: boolean;
  settledMariam?: boolean;
}

export interface Settlement {
  id: string;
  partner: Partner;
  amount: number;
  date: Date;
  relatedExpenses: string[];
  note?: string;
}

export interface PartnerBalance {
  partner: Partner;
  owedAmount: number;
  settledAmount: number;
  lastSettlement?: Date;
}

export interface MonthlyReport {
  expenses: Expense[];
  settlements: Settlement[];
  totalExpenses: number;
  totalSettlements: number;
  netAmount: number;
  period: {
    month: number;
    year: number;
  };
} 