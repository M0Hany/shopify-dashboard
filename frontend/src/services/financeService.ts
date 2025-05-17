import { Expense, Settlement, PartnerBalance, MonthlyReport } from '../types/finance';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Order {
  id: string;
  name: string;
  total_price: string;
  tags: string[];
  shipping_address?: {
    city?: string;
  };
}

export const financeService = {
  // Expense endpoints
  async createExpense(expense: Omit<Expense, 'id' | 'settled' | 'settledAt'>): Promise<Expense> {
    const response = await fetch(`${API_BASE_URL}/api/finance/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(expense),
    });

    if (!response.ok) {
      throw new Error('Failed to create expense');
    }

    const data = await response.json();
    return {
      ...data,
      date: new Date(data.date),
      settledAt: data.settledAt ? new Date(data.settledAt) : undefined,
    };
  },

  async getExpenses(filters?: {
    category?: string;
    paidBy?: string;
    startDate?: Date;
    endDate?: Date;
    settled?: boolean;
  }): Promise<Expense[]> {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.category) params.append('category', filters.category);
      if (filters.paidBy) params.append('paidBy', filters.paidBy);
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString());
      if (filters.settled !== undefined) params.append('settled', String(filters.settled));
    }

    const response = await fetch(`${API_BASE_URL}/api/finance/expenses?${params}`);
    if (!response.ok) {
      throw new Error('Failed to fetch expenses');
    }

    const data = await response.json();
    return data.map((expense: any) => ({
      ...expense,
      date: new Date(expense.date),
      settledAt: expense.settledAt ? new Date(expense.settledAt) : undefined,
    }));
  },

  // Settlement endpoints
  async createSettlement(settlement: Omit<Settlement, 'id'>): Promise<Settlement> {
    const response = await fetch(`${API_BASE_URL}/api/finance/settlements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settlement),
    });

    if (!response.ok) {
      throw new Error('Failed to create settlement');
    }

    const data = await response.json();
    return {
      ...data,
      date: new Date(data.date),
    };
  },

  async getPartnerBalance(partner: string): Promise<PartnerBalance> {
    const response = await fetch(`${API_BASE_URL}/api/finance/partners/${partner}/balance`);
    if (!response.ok) {
      throw new Error('Failed to fetch partner balance');
    }

    const data = await response.json();
    return {
      ...data,
      lastSettlement: data.lastSettlement ? new Date(data.lastSettlement) : undefined,
    };
  },

  // Report endpoints
  async getMonthlyReport(year: number, month: number): Promise<MonthlyReport> {
    const response = await fetch(
      `${API_BASE_URL}/api/finance/reports/monthly/${year}/${month}`
    );
    if (!response.ok) {
      throw new Error('Failed to fetch monthly report');
    }

    const data = await response.json();
    return {
      ...data,
      expenses: data.expenses.map((expense: any) => ({
        ...expense,
        date: new Date(expense.date),
        settledAt: expense.settledAt ? new Date(expense.settledAt) : undefined,
      })),
      settlements: data.settlements.map((settlement: any) => ({
        ...settlement,
        date: new Date(settlement.date),
      })),
    };
  },

  async deleteExpense(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/finance/expenses/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete expense');
    }
  },

  async updateExpenseNote(id: string, note: string): Promise<Expense> {
    const response = await fetch(`${API_BASE_URL}/api/finance/expenses/${id}/note`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ note }),
    });

    if (!response.ok) {
      throw new Error('Failed to update expense note');
    }

    const data = await response.json();
    return {
      ...data,
      date: new Date(data.date),
      settledAt: data.settledAt ? new Date(data.settledAt) : undefined,
    };
  },

  async updateExpense(id: string, data: Omit<Expense, 'id' | 'settled' | 'settledAt'>): Promise<Expense> {
    const response = await fetch(`${API_BASE_URL}/api/finance/expenses/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to update expense');
    }

    const responseData = await response.json();
    return {
      ...responseData,
      date: new Date(responseData.date),
      settledAt: responseData.settledAt ? new Date(responseData.settledAt) : undefined,
    };
  },

  async settleExpense(id: string, partner?: 'Mohamed' | 'Mariam'): Promise<Expense> {
    const response = await fetch(`${API_BASE_URL}/api/finance/expenses/${id}/settle`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ partner }),
    });

    if (!response.ok) {
      throw new Error('Failed to settle expense');
    }

    const data = await response.json();
    return {
      ...data,
      date: new Date(data.date),
      settledAt: data.settledAt ? new Date(data.settledAt) : undefined,
    };
  },

  async getOrders(startDate: string, endDate: string): Promise<Order[]> {
    const queryParams = new URLSearchParams({
      startDate,
      endDate,
    });

    const response = await fetch(
      `${API_BASE_URL}/api/orders?${queryParams}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch orders');
    }

    return response.json();
  },
}; 