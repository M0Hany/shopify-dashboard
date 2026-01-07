// Financial System API Service

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Types
export interface ProductCost {
  id: string;
  product_id: string;
  product_name: string;
  crochet_labor_per_unit: number;
  yarn_cost_per_unit: number;
  helper_colors_cost_per_unit: number;
  laser_felt_cost_per_unit: number;
  packaging_per_unit: number;
  total_unit_cost: number;
  updated_at: string;
  created_at: string;
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

export interface FinancialExpense {
  id: string;
  category: FinancialExpenseCategory;
  amount: number;
  date: string;
  month: string;
  notes?: string;
  expense_type: ExpenseType;
  product_id?: string;
  product_name?: string;
  quantity?: number;
  unit_cost?: number;
  created_at: string;
  updated_at: string;
}

export interface FinancialExpenseInput {
  category: FinancialExpenseCategory;
  amount: number;
  date: string;
  notes?: string;
  expense_type?: ExpenseType;
  product_id?: string;
  product_name?: string;
  quantity?: number;
  unit_cost?: number;
}

export type ShippingType = "Company" | "Uber";
export type ShippingStatus = "Delivered" | "Cancelled";

export interface ShippingRecord {
  id: string;
  order_id?: number;
  type: ShippingType;
  customer_shipping_charged: number;
  actual_shipping_cost: number;
  status: ShippingStatus;
  date: string;
  month: string;
  invoice_id?: string;
  created_at: string;
  updated_at: string;
  isFromTag?: boolean; // Flag to indicate if record comes from order tags
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

export interface ProductionCost {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  date: string;
  month: string;
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

export interface MonthlyProfit {
  id: string;
  month: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  total_expenses: number;
  shipping_loss: number;
  operating_profit: number;
  dpp: number; // Accrual-based (legacy)
  production_costs_paid?: number; // Cash-flow: production costs paid this month
  cash_dpp?: number; // Cash-flow based DPP (for payouts)
  created_at: string;
  updated_at: string;
}

export type OwnerPayType = "fixed" | "percent";

export interface PayoutConfig {
  id: string;
  media_buyer_percent: number;
  ops_percent: number;
  crm_percent: number;
  owner_pay_type: OwnerPayType;
  owner_pay_value: number;
  updated_at: string;
}

export interface PayoutConfigInput {
  media_buyer_percent: number;
  ops_percent: number;
  crm_percent: number;
  owner_pay_type: OwnerPayType;
  owner_pay_value: number;
}

export interface MonthlyPayout {
  id: string;
  month: string;
  dpp: number;
  media_buyer_amount: number;
  ops_amount: number;
  crm_amount: number;
  owner_amount: number;
  net_business_profit: number;
  created_at: string;
  updated_at: string;
}

// API Functions
export const financialService = {
  // Product Costs
  async getProductCosts(): Promise<ProductCost[]> {
    const response = await fetch(`${API_URL}/api/financial/product-costs`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) throw new Error('Failed to fetch product costs');
    return response.json();
  },

  async getProductCost(id: string): Promise<ProductCost> {
    const response = await fetch(`${API_URL}/api/financial/product-costs/${id}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) throw new Error('Failed to fetch product cost');
    return response.json();
  },

  async createProductCost(input: ProductCostInput): Promise<ProductCost> {
    const response = await fetch(`${API_URL}/api/financial/product-costs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error('Failed to create product cost');
    return response.json();
  },

  async updateProductCost(id: string, input: Partial<ProductCostInput>): Promise<ProductCost> {
    const response = await fetch(`${API_URL}/api/financial/product-costs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error('Failed to update product cost');
    return response.json();
  },

  async deleteProductCost(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/financial/product-costs/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete product cost');
  },

  // Expenses
  async getExpenses(month?: string): Promise<FinancialExpense[]> {
    const url = month 
      ? `${API_URL}/api/financial/expenses?month=${month}`
      : `${API_URL}/api/financial/expenses`;
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) throw new Error('Failed to fetch expenses');
    return response.json();
  },

  async createExpense(input: FinancialExpenseInput): Promise<FinancialExpense> {
    const response = await fetch(`${API_URL}/api/financial/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error('Failed to create expense');
    return response.json();
  },

  async updateExpense(id: string, input: Partial<FinancialExpenseInput>): Promise<FinancialExpense> {
    const response = await fetch(`${API_URL}/api/financial/expenses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error('Failed to update expense');
    return response.json();
  },

  async deleteExpense(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/financial/expenses/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete expense');
  },

  // Shipping Records
  async getShippingRecords(month?: string): Promise<ShippingRecord[]> {
    const url = month
      ? `${API_URL}/api/financial/shipping?month=${month}`
      : `${API_URL}/api/financial/shipping`;
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) throw new Error('Failed to fetch shipping records');
    return response.json();
  },

  async createShippingRecord(input: ShippingRecordInput): Promise<ShippingRecord> {
    const response = await fetch(`${API_URL}/api/financial/shipping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error('Failed to create shipping record');
    return response.json();
  },

  async updateShippingRecord(id: string, input: Partial<ShippingRecordInput>): Promise<ShippingRecord> {
    const response = await fetch(`${API_URL}/api/financial/shipping/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error('Failed to update shipping record');
    return response.json();
  },

  async deleteShippingRecord(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/financial/shipping/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete shipping record');
  },

  // Profit Engine
  async getMonthlyProfit(month: string): Promise<MonthlyProfit | null> {
    const response = await fetch(`${API_URL}/api/financial/profit?month=${month}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (response.status === 404) {
      return null; // Profit not found for this month
    }
    if (!response.ok) throw new Error('Failed to fetch monthly profit');
    return response.json();
  },

  async calculateProfit(month: string): Promise<MonthlyProfit> {
    const response = await fetch(`${API_URL}/api/financial/profit/calculate?month=${month}`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to calculate profit');
    return response.json();
  },

  async getFulfilledOrders(month: string): Promise<any[]> {
    const response = await fetch(`${API_URL}/api/financial/profit/orders?month=${month}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) throw new Error('Failed to fetch fulfilled orders');
    return response.json();
  },

  async getCancelledOrders(month: string): Promise<any[]> {
    const response = await fetch(`${API_URL}/api/financial/profit/cancelled-orders?month=${month}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) throw new Error('Failed to fetch cancelled orders');
    return response.json();
  },

  async getProfitSummary(startMonth: string, endMonth: string): Promise<MonthlyProfit[]> {
    const response = await fetch(`${API_URL}/api/financial/profit/summary?startMonth=${startMonth}&endMonth=${endMonth}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) throw new Error('Failed to fetch profit summary');
    return response.json();
  },

  // Payouts
  async getMonthlyPayout(month: string): Promise<MonthlyPayout | null> {
    const response = await fetch(`${API_URL}/api/financial/payouts?month=${month}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (response.status === 404) {
      return null; // Payout data doesn't exist yet
    }
    if (!response.ok) throw new Error('Failed to fetch monthly payout');
    return response.json();
  },

  async calculatePayouts(month: string): Promise<MonthlyPayout> {
    const response = await fetch(`${API_URL}/api/financial/payouts/calculate?month=${month}`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to calculate payouts');
    return response.json();
  },

  async getPayoutConfig(): Promise<PayoutConfig> {
    const response = await fetch(`${API_URL}/api/financial/payout-config`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) throw new Error('Failed to fetch payout config');
    return response.json();
  },

  async updatePayoutConfig(input: PayoutConfigInput): Promise<PayoutConfig> {
    const response = await fetch(`${API_URL}/api/financial/payout-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error('Failed to update payout config');
    return response.json();
  },

  // Dashboard
  async getShippingPerformance(month: string): Promise<any> {
    const response = await fetch(`${API_URL}/api/financial/dashboard/shipping-performance?month=${month}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) throw new Error('Failed to fetch shipping performance');
    return response.json();
  },

  async getExpenseBreakdown(month: string): Promise<any[]> {
    const response = await fetch(`${API_URL}/api/financial/dashboard/expense-breakdown?month=${month}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) throw new Error('Failed to fetch expense breakdown');
    return response.json();
  },

  // Production Costs (now using unified expenses with expense_type='production')
  async getProductionCosts(month?: string): Promise<FinancialExpense[]> {
    const url = month 
      ? `${API_URL}/api/financial/expenses?month=${month}&expense_type=production`
      : `${API_URL}/api/financial/expenses?expense_type=production`;
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) throw new Error('Failed to fetch production costs');
    return response.json();
  },

  async createProductionCost(input: ProductionCostInput): Promise<FinancialExpense> {
    // Convert to unified expense format
    const expenseInput: FinancialExpenseInput = {
      category: 'Other',
      amount: input.quantity * input.unit_cost,
      date: input.date,
      notes: input.notes,
      expense_type: 'production',
      product_id: input.product_id,
      product_name: input.product_name,
      quantity: input.quantity,
      unit_cost: input.unit_cost,
    };
    return this.createExpense(expenseInput);
  },

  async updateProductionCost(id: string, input: Partial<ProductionCostInput>): Promise<FinancialExpense> {
    const expenseInput: Partial<FinancialExpenseInput> = {
      expense_type: 'production',
    };
    if (input.product_id) expenseInput.product_id = input.product_id;
    if (input.product_name) expenseInput.product_name = input.product_name;
    if (input.quantity) expenseInput.quantity = input.quantity;
    if (input.unit_cost) expenseInput.unit_cost = input.unit_cost;
    if (input.date) expenseInput.date = input.date;
    if (input.notes !== undefined) expenseInput.notes = input.notes;
    if (input.quantity && input.unit_cost) {
      expenseInput.amount = input.quantity * input.unit_cost;
    }
    return this.updateExpense(id, expenseInput);
  },

  async deleteProductionCost(id: string): Promise<void> {
    return this.deleteExpense(id);
  },

  // Bulk import shipping company costs
  async bulkImportShippingCosts(entries: Array<{ orderNumber: string; cost: number }>, transactionDate: string, orderIdMappings?: { [key: string]: number }): Promise<any> {
    const response = await fetch(`${API_URL}/api/orders/bulk-import-shipping-costs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ entries, transactionDate, orderIdMappings: orderIdMappings || {} }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to bulk import shipping costs');
    }
    return response.json();
  },

  async bulkRevertShippingCosts(orderIds: number[]): Promise<any> {
    const response = await fetch(`${API_URL}/api/orders/bulk-revert-shipping-costs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderIds }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to bulk revert shipping costs');
    }
    return response.json();
  },
};

