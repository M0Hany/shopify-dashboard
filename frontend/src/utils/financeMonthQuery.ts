import type { FinancialExpense, MonthlyProfit, ShippingRecord } from '../services/financialService';

export type FinanceMonthBundle = {
  month: string;
  profit: MonthlyProfit | null;
  orders: unknown[];
  paidOrders: unknown[];
  cancelledOrders: unknown[];
  paidOrderCount: number;
  cancelledOrderCount: number;
  expenses: FinancialExpense[];
  shippingRecords: ShippingRecord[];
  shippingSummary: {
    totalCosts: number;
    totalCustomerCharged: number;
    scooterProfitLoss: number;
    companyProfitLoss: number;
  };
  calculatedAt: string | null;
  isFinalized: boolean;
  fromCache: boolean;
  needsCalculation: boolean;
};

export function getCurrentFinanceMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function isPastFinanceMonth(month: string): boolean {
  return month < getCurrentFinanceMonth();
}

export function financeMonthStaleTime(month: string): number {
  if (isPastFinanceMonth(month)) return Infinity;
  return 0;
}

export function financeMonthRefetchInterval(month: string): number | false {
  if (isPastFinanceMonth(month)) return false;
  return 2 * 60 * 1000;
}

export const financeMonthQueryKey = (month: string) => ['finance-month', month] as const;
