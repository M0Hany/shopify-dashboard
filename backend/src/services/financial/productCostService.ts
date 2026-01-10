import { supabase } from '../../config/supabase';
import { ProductCost, ProductCostInput } from '../../types/financial';
import { logger } from '../../utils/logger';

export class ProductCostService {
  async getAll(): Promise<ProductCost[]> {
    const { data, error } = await supabase
      .from('product_costs')
      .select('*')
      .order('product_name', { ascending: true });

    if (error) {
      logger.error('Error fetching product costs:', error);
      throw error;
    }

    return data || [];
  }

  async getByProductId(productId: string): Promise<ProductCost | null> {
    const { data, error } = await supabase
      .from('product_costs')
      .select('*')
      .eq('product_id', productId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error('Error fetching product cost:', error);
      throw error;
    }

    return data;
  }

  async create(input: ProductCostInput): Promise<ProductCost> {
    const totalUnitCost = 
      input.crochet_labor_per_unit +
      input.yarn_cost_per_unit +
      input.helper_colors_cost_per_unit +
      input.laser_felt_cost_per_unit +
      input.packaging_per_unit;

    const { data, error } = await supabase
      .from('product_costs')
      .insert([{
        ...input,
        total_unit_cost: totalUnitCost,
      }])
      .select()
      .single();

    if (error) {
      logger.error('Error creating product cost:', error);
      throw error;
    }

    return data;
  }

  async update(id: string, input: Partial<ProductCostInput>): Promise<ProductCost> {
    // If any cost fields are updated, recalculate total_unit_cost
    let updateData: any = { ...input };

    if (input.crochet_labor_per_unit !== undefined ||
        input.yarn_cost_per_unit !== undefined ||
        input.helper_colors_cost_per_unit !== undefined ||
        input.laser_felt_cost_per_unit !== undefined ||
        input.packaging_per_unit !== undefined) {
      
      // Get existing record to calculate new total
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error('Product cost not found');
      }

      const crochet = input.crochet_labor_per_unit ?? existing.crochet_labor_per_unit;
      const yarn = input.yarn_cost_per_unit ?? existing.yarn_cost_per_unit;
      const helper = input.helper_colors_cost_per_unit ?? existing.helper_colors_cost_per_unit;
      const laser = input.laser_felt_cost_per_unit ?? existing.laser_felt_cost_per_unit;
      const packaging = input.packaging_per_unit ?? existing.packaging_per_unit;

      updateData.total_unit_cost = crochet + yarn + helper + laser + packaging;
    }

    const { data, error } = await supabase
      .from('product_costs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating product cost:', error);
      throw error;
    }

    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('product_costs')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Error deleting product cost:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<ProductCost | null> {
    const { data, error } = await supabase
      .from('product_costs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error('Error fetching product cost:', error);
      throw error;
    }

    return data;
  }
}

export const productCostService = new ProductCostService();







