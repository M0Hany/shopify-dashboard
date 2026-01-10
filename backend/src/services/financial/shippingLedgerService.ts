import { supabase } from '../../config/supabase';
import { ShippingRecord, ShippingRecordInput } from '../../types/financial';
import { logger } from '../../utils/logger';

export class ShippingLedgerService {
  async getAll(month?: string): Promise<ShippingRecord[]> {
    let query = supabase
      .from('shipping_records')
      .select('*')
      .order('date', { ascending: false });

    if (month) {
      query = query.eq('month', month);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching shipping records:', error);
      throw error;
    }

    return data || [];
  }

  async getById(id: string): Promise<ShippingRecord | null> {
    const { data, error } = await supabase
      .from('shipping_records')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error('Error fetching shipping record:', error);
      throw error;
    }

    return data;
  }

  async create(input: ShippingRecordInput): Promise<ShippingRecord> {
    // Extract month from date (YYYY-MM-DD -> YYYY-MM)
    const date = new Date(input.date);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('shipping_records')
      .insert([{
        ...input,
        month,
      }])
      .select()
      .single();

    if (error) {
      logger.error('Error creating shipping record:', error);
      throw error;
    }

    return data;
  }

  async update(id: string, input: Partial<ShippingRecordInput>): Promise<ShippingRecord> {
    const updateData: any = { ...input };

    // If date is updated, recalculate month
    if (input.date) {
      const date = new Date(input.date);
      updateData.month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    const { data, error } = await supabase
      .from('shipping_records')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating shipping record:', error);
      throw error;
    }

    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('shipping_records')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Error deleting shipping record:', error);
      throw error;
    }
  }

  async getMonthlyProfitLoss(month: string): Promise<number> {
    const { data, error } = await supabase
      .from('shipping_records')
      .select('customer_shipping_charged, actual_shipping_cost')
      .eq('month', month);

    if (error) {
      logger.error('Error calculating monthly shipping profit/loss:', error);
      throw error;
    }

    return (data || []).reduce((sum, record) => {
      return sum + (record.customer_shipping_charged - record.actual_shipping_cost);
    }, 0);
  }

  async getByType(month: string): Promise<{ Company: number; Uber: number }> {
    const { data, error } = await supabase
      .from('shipping_records')
      .select('type, customer_shipping_charged, actual_shipping_cost')
      .eq('month', month);

    if (error) {
      logger.error('Error fetching shipping records by type:', error);
      throw error;
    }

    const result = { Company: 0, Uber: 0 };
    (data || []).forEach(record => {
      const profit = record.customer_shipping_charged - record.actual_shipping_cost;
      result[record.type as 'Company' | 'Uber'] += profit;
    });

    return result;
  }

  async getCancelledLosses(month: string): Promise<number> {
    const { data, error } = await supabase
      .from('shipping_records')
      .select('actual_shipping_cost')
      .eq('month', month)
      .eq('status', 'Cancelled');

    if (error) {
      logger.error('Error calculating cancelled losses:', error);
      throw error;
    }

    return (data || []).reduce((sum, record) => sum + record.actual_shipping_cost, 0);
  }
}

export const shippingLedgerService = new ShippingLedgerService();







