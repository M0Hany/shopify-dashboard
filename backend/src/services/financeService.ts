import { Expense, Settlement, PartnerBalance, Order, ExpenseCategory, Partner } from '../types/finance';
import { supabase } from '../config/supabase';

export class FinanceService {
  // Order-related methods
  async calculateNetRevenue(order: Order): Promise<number> {
    return order.totalAmount - order.deliveryFee;
  }

  // Expense-related methods
  async createExpense(expense: Omit<Expense, 'id' | 'settled' | 'settledAt'>): Promise<Expense> {
    console.log('Received expense data:', expense);
    console.log('Date type:', typeof expense.date);
    console.log('Date value:', expense.date);

    // Ensure date is a Date object
    const date = expense.date instanceof Date ? expense.date : new Date(expense.date);
    console.log('Converted date:', date);

    const newExpense: Expense = {
      ...expense,
      date,
      id: crypto.randomUUID(),
      settled: false,
    };

    console.log('New expense object:', newExpense);

    const { data, error } = await supabase
      .from('expenses')
      .insert([{
        ...newExpense,
        date: newExpense.date.toISOString(),
        "paidBy": newExpense.paidBy,
        splitPayment: newExpense.splitPayment || { mohamed: 0, mariam: 0 }
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    return {
      ...data,
      date: new Date(data.date),
      paidBy: data.paidBy,
      splitPayment: data.splitPayment || { mohamed: 0, mariam: 0 }
    } as Expense;
  }

  async getExpenses(filters?: {
    category?: string;
    paidBy?: string;
    startDate?: Date;
    endDate?: Date;
    settled?: boolean;
  }): Promise<Expense[]> {
    let query = supabase
      .from('expenses')
      .select('*');

    if (filters) {
      if (filters.category) {
        query = query.eq('category', filters.category);
      }
      if (filters.paidBy) {
        query = query.eq('"paidBy"', filters.paidBy);
      }
      if (filters.startDate) {
        query = query.gte('date', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        query = query.lte('date', filters.endDate.toISOString());
      }
      if (filters.settled !== undefined) {
        query = query.eq('settled', filters.settled);
      }
    }

    const { data, error } = await query;
    
    if (error) throw error;
    
    return (data || []).map(expense => ({
      ...expense,
      date: new Date(expense.date),
      paidBy: expense.paidBy,
      splitPayment: expense.splitPayment || { mohamed: 0, mariam: 0 },
      settledAt: expense.settledAt ? new Date(expense.settledAt) : undefined,
    })) as Expense[];
  }

  async deleteExpense(id: string): Promise<void> {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async updateExpenseNote(id: string, note: string): Promise<Expense> {
    const { data, error } = await supabase
      .from('expenses')
      .update({ note })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      ...data,
      date: new Date(data.date),
      paidBy: data.paidBy,
      splitPayment: data.splitPayment || { mohamed: 0, mariam: 0 },
      settledAt: data.settledAt ? new Date(data.settledAt) : undefined,
    } as Expense;
  }

  async updateExpense(id: string, data: Omit<Expense, 'id' | 'settled' | 'settledAt'>): Promise<Expense> {
    const { data: updatedExpense, error } = await supabase
      .from('expenses')
      .update({
        title: data.title,
        amount: data.amount,
        date: data.date.toISOString(),
        category: data.category,
        "paidBy": data.paidBy,
        splitPayment: data.splitPayment || { mohamed: 0, mariam: 0 },
        note: data.note
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      ...updatedExpense,
      date: new Date(updatedExpense.date),
      paidBy: updatedExpense.paidBy,
      splitPayment: updatedExpense.splitPayment || { mohamed: 0, mariam: 0 },
      settledAt: updatedExpense.settledAt ? new Date(updatedExpense.settledAt) : undefined,
    } as Expense;
  }

  // Settlement-related methods
  async createSettlement(settlement: Omit<Settlement, 'id'>): Promise<Settlement> {
    const newSettlement: Settlement = {
      ...settlement,
      id: crypto.randomUUID(),
    };

    const { data, error } = await supabase
      .from('settlements')
      .insert([{
        ...newSettlement,
        date: newSettlement.date.toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;

    // Update related expenses
    await this.updateExpenseSettlementStatus(
      newSettlement.relatedExpenses,
      true,
      newSettlement.date
    );

    // Update partner balance
    await this.updatePartnerBalance(newSettlement);

    return {
      ...data,
      date: new Date(data.date),
    } as Settlement;
  }

  async getPartnerBalance(partner: string): Promise<PartnerBalance> {
    const { data, error } = await supabase
      .from('partner_balances')
      .select('*')
      .eq('partner', partner)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // Record not found
        return {
          partner: partner as Partner,
          owedAmount: 0,
          settledAmount: 0,
        };
      }
      throw error;
    }

    return {
      ...data,
      lastSettlement: data.lastSettlement ? new Date(data.lastSettlement) : undefined,
    } as PartnerBalance;
  }

  // Reporting methods
  async generateMonthlyReport(month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const [expenses, settlements] = await Promise.all([
      this.getExpenses({
        startDate,
        endDate,
      }),
      this.getSettlementsByDateRange(startDate, endDate),
    ]);

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalSettlements = settlements.reduce((sum, set) => sum + set.amount, 0);

    return {
      expenses,
      settlements,
      totalExpenses,
      totalSettlements,
      netAmount: totalSettlements - totalExpenses,
      period: {
        month,
        year,
      },
    };
  }

  // Helper methods
  private async updateExpenseSettlementStatus(
    expenseIds: string[],
    settled: boolean,
    settledAt?: Date
  ): Promise<void> {
    const { error } = await supabase
      .from('expenses')
      .update({
        settled,
        settledAt: settledAt?.toISOString(),
      })
      .in('id', expenseIds);

    if (error) throw error;
  }

  private async updatePartnerBalance(settlement: Settlement): Promise<void> {
    const { error } = await supabase.rpc('update_partner_balance', {
      p_partner: settlement.partner,
      p_amount: settlement.amount,
      p_settlement_date: settlement.date.toISOString(),
    });

    if (error) throw error;
  }

  private async getSettlementsByDateRange(startDate: Date, endDate: Date): Promise<Settlement[]> {
    const { data, error } = await supabase
      .from('settlements')
      .select('*')
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString());

    if (error) throw error;

    return (data || []).map(settlement => ({
      ...settlement,
      date: new Date(settlement.date),
    })) as Settlement[];
  }

  async settleExpense(id: string, partner?: 'Mohamed' | 'Mariam'): Promise<Expense> {
    const { data: expense, error: fetchError } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const updateData: any = {};

    if (expense.paidBy === 'Both') {
      if (!partner) throw new Error('Partner must be specified for split expenses');
      
      // Update the settlement status for the specified partner
      if (partner === 'Mohamed') {
        updateData.settledMohamed = true;
      } else {
        updateData.settledMariam = true;
      }
      
      // Check if both partners are now settled
      const bothSettled = partner === 'Mohamed' 
        ? expense.settledMariam 
        : expense.settledMohamed;

      if (bothSettled) {
        // If both partners are settled, mark the expense as fully settled
        updateData.settled = true;
        updateData.settledAt = new Date().toISOString();
      }
    } else if (expense.paidBy === 'Mohamed' || expense.paidBy === 'Mariam') {
      // For single partner payments, mark as settled directly
      updateData.settled = true;
      updateData.settledAt = new Date().toISOString();
    }

    const { data: updatedExpense, error: updateError } = await supabase
      .from('expenses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    return {
      ...updatedExpense,
      date: new Date(updatedExpense.date),
      paidBy: updatedExpense.paidBy,
      splitPayment: updatedExpense.splitPayment || { mohamed: 0, mariam: 0 },
      settledAt: updatedExpense.settledAt ? new Date(updatedExpense.settledAt) : undefined,
      settledMohamed: updatedExpense.settledMohamed || false,
      settledMariam: updatedExpense.settledMariam || false
    } as Expense;
  }
} 