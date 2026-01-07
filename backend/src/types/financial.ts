// Financial System Types - Based on FINANCIAL_SYSTEM_OVERVIEW.md

export type FinancialExpenseCategory =
  | "Ads"
  | "Media Buyer Fixed"
  | "Packaging Bulk"
  | "Packaging"
  | "Material Shipping"
  | "Raw Materials"
  | "Material Delivery"
  | "Production Labor"
  | "Tools & Misc"
  | "Tools & Equipment"
  | "Utilities & Rent"
  | "Professional Services"
  | "Other";

export type ExpenseType = "production" | "operating";

export type ShippingType = "Company" | "Uber";
export type ShippingStatus = "Delivered" | "Cancelled";
export type OwnerPayType = "fixed" | "percent";

// Product Cost Configuration
export interface ProductCost {
  id: string;
  product_id: string; // Shopify product ID
  product_name: string;
  crochet_labor_per_unit: number; // EGP
  yarn_cost_per_unit: number; // EGP
  helper_colors_cost_per_unit: number; // EGP
  laser_felt_cost_per_unit: number; // EGP
  packaging_per_unit: number; // EGP (cards + zipper only)
  total_unit_cost: number; // Calculated: sum of above
  updated_at: string; // ISO date
  created_at: string; // ISO date
}

export interface ProductCostInput {
  product_id: string;
  product_name: string;
  crochet_labor_per_unit: number;
  yarn_cost_per_unit: number;
  helper_colors_cost_per_unit: number;
  laser_felt_cost_per_unit: number;
  packaging_per_unit: number;
}

// Financial Expense (unified - includes both production costs and operating expenses)
export interface FinancialExpense {
  id: string;
  category: FinancialExpenseCategory;
  amount: number; // EGP
  date: string; // ISO date
  month: string; // YYYY-MM (for grouping)
  notes?: string;
  expense_type: ExpenseType; // 'production' or 'operating'
  product_id?: string; // Only for production expenses
  product_name?: string; // Only for production expenses
  quantity?: number; // Only for production expenses
  unit_cost?: number; // Only for production expenses
  created_at: string;
  updated_at: string;
}

export interface FinancialExpenseInput {
  category: FinancialExpenseCategory;
  amount: number;
  date: string;
  notes?: string;
  expense_type?: ExpenseType; // Defaults to 'operating' if not provided
  product_id?: string;
  product_name?: string;
  quantity?: number;
  unit_cost?: number;
}

// Shipping Ledger
export interface ShippingRecord {
  id: string;
  order_id?: number; // Shopify order ID (nullable for batch entries)
  type: ShippingType;
  customer_shipping_charged: number; // EGP (what customer paid)
  actual_shipping_cost: number; // EGP (what we paid)
  status: ShippingStatus;
  date: string; // ISO date
  month: string; // YYYY-MM (for grouping)
  invoice_id?: string; // Optional: shipping company invoice
  created_at: string;
  updated_at: string;
}

export interface ShippingRecordInput {
  order_id?: number;
  type: ShippingType;
  customer_shipping_charged: number;
  actual_shipping_cost: number;
  status: ShippingStatus;
  date: string;
  invoice_id?: string;
}

// Production Cost (cash flow basis - when costs are paid)
export interface ProductionCost {
  id: string;
  product_id: string; // Shopify product ID
  product_name: string;
  quantity: number;
  unit_cost: number; // EGP per unit
  total_cost: number; // EGP (quantity × unit_cost)
  date: string; // ISO date
  month: string; // YYYY-MM
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductionCostInput {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  date: string;
  notes?: string;
}

// Monthly Profit (calculated by Profit Engine)
// Now includes both accrual-based (COGS) and cash-flow based (production_costs_paid) metrics
export interface MonthlyProfit {
  id: string;
  month: string; // YYYY-MM (unique)
  revenue: number;
  cogs: number; // Accrual-based: costs matched to sales
  gross_profit: number; // Accrual-based: Revenue - COGS
  total_expenses: number; // Total monthly expenses (excluding production costs)
  shipping_loss: number; // Shipping profit/loss (negative = loss, positive = profit)
  operating_profit: number; // Accrual-based: Gross Profit - Expenses + Shipping
  dpp: number; // Accrual-based DPP (legacy, kept for backward compatibility)
  production_costs_paid: number; // Cash-flow: production costs paid this month
  cash_dpp: number; // Cash-flow based DPP (Revenue - Production Costs - Expenses - Shipping Net)
  created_at: string;
  updated_at: string;
}

// Payout Configuration
export interface PayoutConfig {
  id: string;
  media_buyer_percent: number; // Default: 3
  ops_percent: number; // Default: 10
  crm_percent: number; // Default: 7.5
  owner_pay_type: OwnerPayType;
  owner_pay_value: number; // Fixed amount or percentage
  updated_at: string;
}

export interface PayoutConfigInput {
  media_buyer_percent: number;
  ops_percent: number;
  crm_percent: number;
  owner_pay_type: OwnerPayType;
  owner_pay_value: number;
}

// Monthly Payouts (calculated)
export interface MonthlyPayout {
  id: string;
  month: string; // YYYY-MM
  dpp: number; // Distributable Profit Pool (before payouts)
  media_buyer_amount: number; // Payout FROM DPP (not an expense)
  ops_amount: number; // Payout FROM DPP (not an expense)
  crm_amount: number; // Payout FROM DPP (not an expense)
  owner_amount: number; // Owner payout FROM DPP
  net_business_profit: number; // Final profit for owner = DPP - All Payouts
  created_at: string;
  updated_at: string;
}

// Dashboard Data Types
export interface ProductMarginData {
  product_id: string;
  product_name: string;
  cost_per_unit: number;
  average_selling_price: number;
  margin_percent: number;
  units_sold: number;
  total_revenue: number;
  total_cost: number;
}

export interface ShippingPerformanceData {
  month: string;
  total_profit_loss: number;
  uber_profit_loss: number;
  company_profit_loss: number;
  cancelled_losses: number;
  total_records: number;
  uber_records: number;
  company_records: number;
}

export interface ExpenseBreakdownData {
  category: FinancialExpenseCategory;
  total_amount: number;
  percent_of_revenue: number;
  month: string;
}

