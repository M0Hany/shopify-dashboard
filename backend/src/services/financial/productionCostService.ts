import { supabase } from '../../config/supabase';
import { ProductionCost, ProductionCostInput } from '../../types/financial';
import { logger } from '../../utils/logger';

export class ProductionCostService {
  async getAll(month?: string): Promise<ProductionCost[]> {
    let query = supabase
      .from('production_costs')
      .select('*')
      .order('date', { ascending: false });

    if (month) {
      query = query.eq('month', month);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching production costs:', error);
      throw error;
    }

    return data || [];
  }

  async getById(id: string): Promise<ProductionCost | null> {
    const { data, error } = await supabase
      .from('production_costs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error('Error fetching production cost:', error);
      throw error;
    }

    return data;
  }

  async create(input: ProductionCostInput): Promise<ProductionCost> {
    // Extract month from date (YYYY-MM-DD -> YYYY-MM)
    const date = new Date(input.date);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    // Calculate total cost
    const totalCost = input.quantity * input.unit_cost;

    const { data, error } = await supabase
      .from('production_costs')
      .insert([{
        ...input,
        total_cost: totalCost,
        month,
      }])
      .select()
      .single();

    if (error) {
      logger.error('Error creating production cost:', error);
      throw error;
    }

    return data;
  }

  async update(id: string, input: Partial<ProductionCostInput>): Promise<ProductionCost> {
    const updateData: any = { ...input };

    // If date is updated, recalculate month
    if (input.date) {
      const date = new Date(input.date);
      updateData.month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    // If quantity or unit_cost is updated, recalculate total_cost
    const existing = await this.getById(id);
    if (existing) {
      const quantity = input.quantity ?? existing.quantity;
      const unitCost = input.unit_cost ?? existing.unit_cost;
      updateData.total_cost = quantity * unitCost;
    }

    const { data, error } = await supabase
      .from('production_costs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating production cost:', error);
      throw error;
    }

    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('production_costs')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Error deleting production cost:', error);
      throw error;
    }
  }

  async getMonthlyTotal(month: string): Promise<number> {
    const { data, error } = await supabase
      .from('production_costs')
      .select('total_cost')
      .eq('month', month);

    if (error) {
      logger.error('Error calculating monthly production cost total:', error);
      throw error;
    }

    return (data || []).reduce((sum, cost) => sum + parseFloat(cost.total_cost.toString()), 0);
  }

  async getByProduct(month: string): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('production_costs')
      .select('product_id, total_cost')
      .eq('month', month);

    if (error) {
      logger.error('Error fetching production costs by product:', error);
      throw error;
    }

    const result: Record<string, number> = {};
    (data || []).forEach(cost => {
      result[cost.product_id] = (result[cost.product_id] || 0) + parseFloat(cost.total_cost.toString());
    });

    return result;
  }
}

export const productionCostService = new ProductionCostService();


