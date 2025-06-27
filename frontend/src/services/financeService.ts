import { api } from '../config/api';
import { Expense, Settlement, PartnerBalance, MonthlyReport } from '../types/finance';

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
    try {
      const response = await api.post('/api/finance/expenses', expense);
      const data = response.data;
      return {
        ...data,
        date: new Date(data.date),
        settledAt: data.settledAt ? new Date(data.settledAt) : undefined,
      };
    } catch (error) {
      throw new Error('Failed to create expense');
    }
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

    try {
      const response = await api.get(`/api/finance/expenses?${params}`);
      const data = response.data;
      return data.map((expense: any) => ({
        ...expense,
        date: new Date(expense.date),
        settledAt: expense.settledAt ? new Date(expense.settledAt) : undefined,
      }));
    } catch (error) {
      throw new Error('Failed to fetch expenses');
    }
  },

  // Settlement endpoints
  async createSettlement(settlement: Omit<Settlement, 'id'>): Promise<Settlement> {
    try {
      const response = await api.post('/api/finance/settlements', settlement);
      const data = response.data;
      return {
        ...data,
        date: new Date(data.date),
      };
    } catch (error) {
      throw new Error('Failed to create settlement');
    }
  },

  async getPartnerBalance(partner: string): Promise<PartnerBalance> {
    try {
      const response = await api.get(`/api/finance/partners/${partner}/balance`);
      const data = response.data;
      return {
        ...data,
        lastSettlement: data.lastSettlement ? new Date(data.lastSettlement) : undefined,
      };
    } catch (error) {
      throw new Error('Failed to fetch partner balance');
    }
  },

  // Report endpoints
  async getMonthlyReport(year: number, month: number): Promise<MonthlyReport> {
    try {
      const response = await api.get(`/api/finance/reports/monthly/${year}/${month}`);
      const data = response.data;
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
    } catch (error) {
      throw new Error('Failed to fetch monthly report');
    }
  },

  async deleteExpense(id: string): Promise<void> {
    try {
      await api.delete(`/api/finance/expenses/${id}`);
    } catch (error) {
      throw new Error('Failed to delete expense');
    }
  },

  async updateExpenseNote(id: string, note: string): Promise<Expense> {
    try {
      const response = await api.patch(`/api/finance/expenses/${id}/note`, { note });
      const data = response.data;
      return {
        ...data,
        date: new Date(data.date),
        settledAt: data.settledAt ? new Date(data.settledAt) : undefined,
      };
    } catch (error) {
      throw new Error('Failed to update expense note');
    }
  },

  async updateExpense(id: string, data: Omit<Expense, 'id' | 'settled' | 'settledAt'>): Promise<Expense> {
    try {
      const response = await api.patch(`/api/finance/expenses/${id}`, data);
      const responseData = response.data;
      return {
        ...responseData,
        date: new Date(responseData.date),
        settledAt: responseData.settledAt ? new Date(responseData.settledAt) : undefined,
      };
    } catch (error) {
      throw new Error('Failed to update expense');
    }
  },

  async settleExpense(id: string, partner?: 'Mohamed' | 'Mariam'): Promise<Expense> {
    try {
      const response = await api.patch(`/api/finance/expenses/${id}/settle`, { partner });
      const data = response.data;
      return {
        ...data,
        date: new Date(data.date),
        settledAt: data.settledAt ? new Date(data.settledAt) : undefined,
      };
    } catch (error) {
      throw new Error('Failed to settle expense');
    }
  },

  async getOrders(startDate: string, endDate: string): Promise<Order[]> {
    try {
      const response = await api.get(`/api/finance/orders?startDate=${startDate}&endDate=${endDate}`);
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch orders');
    }
  }
}; 