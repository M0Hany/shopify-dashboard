import { supabase } from '../../config/supabase';
import { FinancialExpense, FinancialExpenseInput, ExpenseType } from '../../types/financial';
import { logger } from '../../utils/logger';

export class ExpenseService {
  async getAll(month?: string, expenseType?: ExpenseType): Promise<FinancialExpense[]> {
    let query = supabase
      .from('financial_expenses')
      .select('*')
      .order('date', { ascending: false });

    if (month) {
      query = query.eq('month', month);
    }

    if (expenseType) {
      query = query.eq('expense_type', expenseType);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching expenses:', error);
      throw error;
    }

    return data || [];
  }

  async getById(id: string): Promise<FinancialExpense | null> {
    const { data, error } = await supabase
      .from('financial_expenses')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error('Error fetching expense:', error);
      throw error;
    }

    return data;
  }

  async create(input: FinancialExpenseInput): Promise<FinancialExpense> {
    // Extract month from date (YYYY-MM-DD -> YYYY-MM)
    const date = new Date(input.date);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    // Default expense_type to 'operating' if not provided
    const expenseType = input.expense_type || 'operating';

    const { data, error } = await supabase
      .from('financial_expenses')
      .insert([{
        ...input,
        expense_type: expenseType,
        month,
      }])
      .select()
      .single();

    if (error) {
      logger.error('Error creating expense:', error);
      throw error;
    }

    return data;
  }

  async update(id: string, input: Partial<FinancialExpenseInput>): Promise<FinancialExpense> {
    const updateData: any = { ...input };

    // If date is updated, recalculate month
    if (input.date) {
      const date = new Date(input.date);
      updateData.month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    const { data, error } = await supabase
      .from('financial_expenses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating expense:', error);
      throw error;
    }

    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('financial_expenses')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Error deleting expense:', error);
      throw error;
    }
  }

  async getMonthlyTotal(month: string, expenseType?: ExpenseType): Promise<number> {
    let query = supabase
      .from('financial_expenses')
      .select('amount')
      .eq('month', month);

    if (expenseType) {
      query = query.eq('expense_type', expenseType);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error calculating monthly expense total:', error);
      throw error;
    }

    return (data || []).reduce((sum, expense) => sum + expense.amount, 0);
  }

  async getByCategory(month: string): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('financial_expenses')
      .select('category, amount')
      .eq('month', month);

    if (error) {
      logger.error('Error fetching expenses by category:', error);
      throw error;
    }

    const result: Record<string, number> = {};
    (data || []).forEach(expense => {
      result[expense.category] = (result[expense.category] || 0) + expense.amount;
    });

    return result;
  }
}

export const expenseService = new ExpenseService();




