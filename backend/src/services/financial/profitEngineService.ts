import { supabase } from '../../config/supabase';
import { MonthlyProfit } from '../../types/financial';
import { productCostService } from './productCostService';
import { expenseService } from './expenseService';
import { shopifyService } from '../shopify';
import { logger } from '../../utils/logger';

const SHIPPING_FLYER_COST = 2; // EGP per order

export class ProfitEngineService {
  /**
   * Calculate profit for a specific month
   * This is the core calculation engine
   */
  async calculateProfit(month: string): Promise<MonthlyProfit> {
    logger.info(`Calculating profit for month: ${month}`);

    // Step 1: Get all paid orders for the month (orders with 'paid' tag)
    const fulfilledOrders = await this.getFulfilledOrdersForMonth(month);
    logger.info(`Found ${fulfilledOrders.length} paid orders for ${month}`);

    // Step 2: Calculate Revenue
    const revenue = this.calculateRevenue(fulfilledOrders);
    logger.info(`Revenue: ${revenue}`);

    // Step 3: Calculate COGS
    const cogs = await this.calculateCOGS(fulfilledOrders);
    logger.info(`COGS: ${cogs}`);

    // Step 4: Calculate Gross Profit
    const grossProfit = revenue - cogs;
    logger.info(`Gross Profit: ${grossProfit}`);

    // Step 5: Get monthly operating expenses (excluding production costs)
    const monthlyExpenses = await expenseService.getMonthlyTotal(month, 'operating');
    logger.info(`Monthly Operating Expenses: ${monthlyExpenses}`);

    // Step 5b: Get production costs paid this month (cash flow basis)
    const productionCostsPaid = await expenseService.getMonthlyTotal(month, 'production');
    logger.info(`Production Costs Paid: ${productionCostsPaid}`);

    // Step 6: Calculate total shipping cost from all orders (fulfilled + cancelled)
    // Step 6a: Get cancelled orders with shipping costs
    const cancelledOrders = await this.getCancelledOrdersWithShippingCosts(month);
    logger.info(`Found ${cancelledOrders.length} cancelled orders with shipping costs for ${month}`);
    
    // Step 6b: Calculate total shipping cost (actual cost paid, not profit/loss)
    const shippingCostFromFulfilled = await this.calculateTotalShippingCostsFromTags(fulfilledOrders, month);
    const shippingCostFromCancelled = await this.calculateTotalShippingCostsFromTags(cancelledOrders, month);
    const totalShippingCost = shippingCostFromFulfilled + shippingCostFromCancelled;
    logger.info(`Total Shipping Cost: ${totalShippingCost}`);

    // Step 7: Calculate Operating Profit (Accrual-based)
    // Operating Profit = Gross Profit - Operating Expenses - Shipping Cost
    const operatingProfit = grossProfit - monthlyExpenses - totalShippingCost;
    logger.info(`Operating Profit (Accrual): ${operatingProfit}`);

    // Step 8: DPP (Accrual-based) = Operating Profit (for backward compatibility)
    const dpp = operatingProfit;
    logger.info(`DPP (Accrual): ${dpp}`);

    // Step 9: Calculate Cash-Flow Based DPP
    // Cash DPP = Revenue - Production Costs Paid - Operating Expenses - Shipping Cost
    // This reflects actual cash available for payouts
    const cashDpp = revenue - productionCostsPaid - monthlyExpenses - totalShippingCost;
    logger.info(`Cash DPP: ${cashDpp}`);

    // Save or update monthly profit record
    // Don't include id - let Supabase auto-generate it
    // Note: shipping_loss stores shipping cost as negative value (for backward compatibility)
    const monthlyProfitData = {
      month,
      revenue,
      cogs,
      gross_profit: grossProfit,
      total_expenses: monthlyExpenses,
      shipping_loss: -totalShippingCost, // Shipping cost stored as negative (for backward compatibility)
      operating_profit: operatingProfit,
      dpp, // Accrual-based (legacy)
      production_costs_paid: productionCostsPaid, // Cash-flow: production costs paid this month
      cash_dpp: cashDpp, // Cash-flow based DPP (for payouts)
    };

    return await this.saveMonthlyProfit(monthlyProfitData);
  }

  /**
   * Get paid orders for a specific month
   * Public method to expose paid orders for a given month
   * Only uses 'paid' and 'paid_date' tags - no fallback to fulfilled tags
   */
  async getFulfilledOrdersForMonth(month: string): Promise<any[]> {
    // Get all orders
    const orders = await shopifyService.getOrders({ limit: 250 });

    // Filter for paid orders in the specified month
    const paidOrders = orders.filter(order => {
      const tags = Array.isArray(order.tags)
        ? order.tags
        : typeof order.tags === 'string'
          ? order.tags.split(',').map((t: string) => t.trim())
          : [];

      // Check if order is paid - ONLY use paid tag, no fallback
      const isPaid = tags.some(tag => tag.trim().toLowerCase() === 'paid');
      if (!isPaid) return false;

      // Check if order is cancelled (exclude cancelled orders)
      const isCancelled = tags.some(tag => tag.trim().toLowerCase() === 'cancelled');
      if (isCancelled) return false;

      // Get paid_date from tags - ONLY use paid_date, no fallback
      const paidDateTag = tags.find(tag => 
        tag.trim().startsWith('paid_date:')
      );
      if (!paidDateTag) {
        // If no paid_date tag, exclude this order
        return false;
      }

      const dateStr = paidDateTag.split(':')[1]?.trim();
      if (!dateStr) return false;

      const orderMonth = dateStr.substring(0, 7); // YYYY-MM
      return orderMonth === month;
    });

    return paidOrders;
  }

  /**
   * Get cancelled orders with shipping costs for a specific month
   * These are orders that were shipped but customer didn't receive them
   * They have shipping_company_cost tags but are cancelled, so they represent pure shipping losses
   */
  async getCancelledOrdersWithShippingCosts(month: string): Promise<any[]> {
    // Get all orders
    const orders = await shopifyService.getOrders({ limit: 250 });

    // Filter for cancelled orders with shipping costs in the specified month
    const cancelledOrders = orders.filter(order => {
      const tags = Array.isArray(order.tags)
        ? order.tags
        : typeof order.tags === 'string'
          ? order.tags.split(',').map((t: string) => t.trim())
          : [];

      // Check if order is cancelled
      const isCancelled = tags.some(tag => tag.trim().toLowerCase() === 'cancelled');
      if (!isCancelled) return false;

      // Check if order has shipping_company_cost tag (indicates shipping was paid)
      const hasShippingCost = tags.some(tag => 
        tag.trim().startsWith('shipping_company_cost:')
      );
      if (!hasShippingCost) return false;

      // Get paid_date from tags to determine the month
      // For cancelled orders, we use paid_date to determine which month the shipping cost belongs to
      const paidDateTag = tags.find(tag => 
        tag.trim().startsWith('paid_date:')
      );
      if (!paidDateTag) {
        // If no paid_date tag, try shipping_company_cost_date
        const costDateTag = tags.find(tag => 
          tag.trim().startsWith('shipping_company_cost_date:')
        );
        if (!costDateTag) return false;
        
        const dateStr = costDateTag.split(':')[1]?.trim();
        if (!dateStr) return false;
        
        const orderMonth = dateStr.substring(0, 7); // YYYY-MM
        return orderMonth === month;
      }

      const dateStr = paidDateTag.split(':')[1]?.trim();
      if (!dateStr) return false;

      const orderMonth = dateStr.substring(0, 7); // YYYY-MM
      return orderMonth === month;
    });

    return cancelledOrders;
  }

  /**
   * Calculate revenue from fulfilled orders
   * Revenue = items_revenue + shipping_charged
   */
  private calculateRevenue(orders: any[]): number {
    return orders.reduce((sum, order) => {
      const totalPrice = parseFloat(order.total_price || '0');
      
      // Calculate items revenue (total - shipping)
      // For now, we'll use total_price as items revenue + shipping
      // You may need to adjust this based on your Shopify order structure
      return sum + totalPrice;
    }, 0);
  }

  /**
   * Calculate COGS (Cost of Goods Sold)
   * COGS = Σ(quantity × product_unit_cost) + (orders_count × 2 EGP flyer)
   */
  private async calculateCOGS(orders: any[]): Promise<number> {
    let totalCOGS = 0;

    for (const order of orders) {
      let orderCOGS = 0;

      // Calculate COGS for each line item
      if (order.line_items && Array.isArray(order.line_items)) {
        for (const item of order.line_items) {
          // Try to get product cost
          // Note: You may need to match by product title or variant
          // For now, we'll try to match by product_id if available
          const productId = item.product_id?.toString() || item.variant_id?.toString();
          
          if (productId) {
            const productCost = await productCostService.getByProductId(productId);
            if (productCost) {
              orderCOGS += item.quantity * productCost.total_unit_cost;
            } else {
              logger.warn(`Product cost not found for product_id: ${productId}, order: ${order.name}`);
              // If product cost not found, skip this item (or use default cost)
            }
          }
        }
      }

      // Add shipping flyer cost (2 EGP per order)
      orderCOGS += SHIPPING_FLYER_COST;

      totalCOGS += orderCOGS;
    }

    return totalCOGS;
  }

  /**
   * Calculate scooter shipping profit/loss from fulfilled orders
   * Profit/Loss = customer_shipping_charged - actual_shipping_cost (from tag)
   */
  /**
   * Calculate scooter shipping profit/loss from order tags
   * Public method to allow access from routes
   */
  async calculateScooterShippingProfitLoss(orders: any[], month: string): Promise<number> {
    let totalProfitLoss = 0;

    for (const order of orders) {
      // Check if order has scooter shipping method
      const tags = Array.isArray(order.tags)
        ? order.tags
        : typeof order.tags === 'string'
          ? order.tags.split(',').map((t: string) => t.trim())
          : [];

      // Check for scooter shipping method tag
      const isScooter = tags.some((tag: string) => 
        tag.trim().toLowerCase().startsWith('shipping_method:') && 
        tag.trim().toLowerCase().includes('scooter')
      );

      if (!isScooter) continue;

      // Get scooter shipping cost from tag
      const scooterCostTag = tags.find((tag: string) => 
        tag.trim().startsWith('scooter_shipping_cost:')
      );

      if (!scooterCostTag) {
        logger.warn(`Scooter order ${order.name} missing scooter_shipping_cost tag`);
        continue;
      }

      const actualCost = parseFloat(scooterCostTag.split(':')[1]?.trim() || '0');
      if (isNaN(actualCost)) {
        logger.warn(`Invalid scooter_shipping_cost for order ${order.name}: ${scooterCostTag}`);
        continue;
      }

      // Get customer shipping charged
      // Try to get from order's shipping price, or estimate from total_price
      let customerCharged = 0;
      
      // Try to get shipping price from order (if available in Shopify API response)
      if (order.total_shipping_price_set?.shop_money?.amount) {
        customerCharged = parseFloat(order.total_shipping_price_set.shop_money.amount || '0');
      } else if (order.shipping_lines && order.shipping_lines.length > 0) {
        // Sum all shipping line prices
        customerCharged = order.shipping_lines.reduce((sum: number, line: any) => {
          return sum + parseFloat(line.price || '0');
        }, 0);
      } else {
        // Default estimate: assume customer was charged a standard scooter fee
        // You may want to adjust this based on your pricing
        // Common scooter delivery fees in Egypt are typically 30-50 EGP
        customerCharged = 50; // Default estimate in EGP
        logger.warn(`No shipping price found for scooter order ${order.name}, using default estimate: ${customerCharged} EGP. Consider adding shipping_lines to Shopify order fetch.`);
      }

      // Calculate profit/loss for this order
      const profitLoss = customerCharged - actualCost;
      totalProfitLoss += profitLoss;

      logger.info(`Scooter order ${order.name}: charged=${customerCharged}, cost=${actualCost}, profit/loss=${profitLoss}`);
    }

    return totalProfitLoss;
  }

  /**
   * Calculate shipping company costs profit/loss from fulfilled orders
   * This extracts shipping_company_cost tags from orders and calculates profit/loss
   * Profit/Loss = customer_shipping_charged - actual_shipping_cost (from tag, includes 14% tax)
   * Public method to allow access from routes
   */
  async calculateCompanyShippingProfitLoss(orders: any[], month: string): Promise<number> {
    let totalProfitLoss = 0;

    for (const order of orders) {
      const tags = Array.isArray(order.tags)
        ? order.tags
        : typeof order.tags === 'string'
          ? order.tags.split(',').map((t: string) => t.trim())
          : [];

      // Check for shipping company cost tag
      const companyCostTag = tags.find((tag: string) => 
        tag.trim().startsWith('shipping_company_cost:')
      );

      if (!companyCostTag) {
        // Skip orders without shipping company cost tag
        continue;
      }

      // Get actual shipping cost from tag (already includes 14% tax)
      const actualCost = parseFloat(companyCostTag.split(':')[1]?.trim() || '0');
      if (isNaN(actualCost)) {
        logger.warn(`Invalid shipping_company_cost for order ${order.name}: ${companyCostTag}`);
        continue;
      }

      // Get customer shipping charged
      // Try to get shipping price from order (if available in Shopify API response)
      let customerCharged = 0;
      
      if (order.total_shipping_price_set?.shop_money?.amount) {
        customerCharged = parseFloat(order.total_shipping_price_set.shop_money.amount || '0');
      } else if (order.shipping_lines && order.shipping_lines.length > 0) {
        // Sum all shipping line prices
        customerCharged = order.shipping_lines.reduce((sum: number, line: any) => {
          return sum + parseFloat(line.price || '0');
        }, 0);
      } else {
        // If no shipping price found, we can't calculate profit/loss accurately
        // Log a warning but continue (this will result in a loss equal to the cost)
        logger.warn(`No shipping price found for company shipping order ${order.name}, using 0 as customer charged`);
        customerCharged = 0;
      }

      // Calculate profit/loss for this order
      const profitLoss = customerCharged - actualCost;
      totalProfitLoss += profitLoss;

      logger.info(`Company shipping order ${order.name}: charged=${customerCharged}, cost=${actualCost}, profit/loss=${profitLoss}`);
    }

    return totalProfitLoss;
  }

  /**
   * Calculate shipping losses from cancelled orders
   * These are orders that were shipped but customer didn't receive them
   * For cancelled orders: customer_charged = 0 (no revenue), so loss = -actual_shipping_cost
   * Public method to allow access from routes
   */
  async calculateCancelledShippingLosses(orders: any[], month: string): Promise<number> {
    let totalLosses = 0;

    for (const order of orders) {
      const tags = Array.isArray(order.tags)
        ? order.tags
        : typeof order.tags === 'string'
          ? order.tags.split(',').map((t: string) => t.trim())
          : [];

      // Check for shipping company cost tag
      const companyCostTag = tags.find((tag: string) => 
        tag.trim().startsWith('shipping_company_cost:')
      );

      if (!companyCostTag) {
        // Skip orders without shipping company cost tag
        continue;
      }

      // Get actual shipping cost from tag (already includes 14% tax)
      const actualCost = parseFloat(companyCostTag.split(':')[1]?.trim() || '0');
      if (isNaN(actualCost)) {
        logger.warn(`Invalid shipping_company_cost for cancelled order ${order.name}: ${companyCostTag}`);
        continue;
      }

      // For cancelled orders, customer was not charged (order was cancelled)
      // So the loss is the full shipping cost
      const loss = -actualCost; // Negative because it's a loss
      totalLosses += loss;

      logger.info(`Cancelled order ${order.name}: shipping cost=${actualCost}, loss=${loss}`);
    }

    return totalLosses;
  }

  /**
   * Calculate total shipping costs from tags (actual costs paid, not profit/loss)
   * This sums up all shipping costs from scooter_shipping_cost and shipping_company_cost tags
   */
  private async calculateTotalShippingCostsFromTags(orders: any[], month: string): Promise<number> {
    let totalCosts = 0;

    for (const order of orders) {
      const tags = Array.isArray(order.tags)
        ? order.tags
        : typeof order.tags === 'string'
          ? order.tags.split(',').map((t: string) => t.trim())
          : [];

      // Get scooter shipping cost
      const scooterCostTag = tags.find((tag: string) => 
        tag.trim().startsWith('scooter_shipping_cost:')
      );
      if (scooterCostTag) {
        const cost = parseFloat(scooterCostTag.split(':')[1]?.trim() || '0');
        if (!isNaN(cost)) {
          totalCosts += cost;
        }
      }

      // Get company shipping cost
      const companyCostTag = tags.find((tag: string) => 
        tag.trim().startsWith('shipping_company_cost:')
      );
      if (companyCostTag) {
        const cost = parseFloat(companyCostTag.split(':')[1]?.trim() || '0');
        if (!isNaN(cost)) {
          totalCosts += cost;
        }
      }
    }

    return totalCosts;
  }

  /**
   * Save or update monthly profit record
   */
  private async saveMonthlyProfit(profitData: Omit<MonthlyProfit, 'id' | 'created_at' | 'updated_at'>): Promise<MonthlyProfit> {
    // Check if record exists
    const { data: existing } = await supabase
      .from('monthly_profits')
      .select('*')
      .eq('month', profitData.month)
      .single();

    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('monthly_profits')
        .update({
          revenue: profitData.revenue,
          cogs: profitData.cogs,
          gross_profit: profitData.gross_profit,
          total_expenses: profitData.total_expenses,
          shipping_loss: profitData.shipping_loss,
          operating_profit: profitData.operating_profit,
          dpp: profitData.dpp,
          production_costs_paid: profitData.production_costs_paid,
          cash_dpp: profitData.cash_dpp,
        })
        .eq('month', profitData.month)
        .select()
        .single();

      if (error) {
        logger.error('Error updating monthly profit:', error);
        throw error;
      }

      return data;
    } else {
      // Create new record (don't include id, created_at, updated_at - let database handle them)
      const { data, error } = await supabase
        .from('monthly_profits')
        .insert([profitData])
        .select()
        .single();

      if (error) {
        logger.error('Error creating monthly profit:', error);
        throw error;
      }

      return data;
    }
  }

  /**
   * Get monthly profit (calculate if doesn't exist)
   */
  async getMonthlyProfit(month: string, forceRecalculate = false): Promise<MonthlyProfit | null> {
    if (forceRecalculate) {
      return await this.calculateProfit(month);
    }

    const { data, error } = await supabase
      .from('monthly_profits')
      .select('*')
      .eq('month', month)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found, calculate it
        return await this.calculateProfit(month);
      }
      logger.error('Error fetching monthly profit:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get profit summary for date range
   */
  async getProfitSummary(startMonth: string, endMonth: string): Promise<MonthlyProfit[]> {
    const { data, error } = await supabase
      .from('monthly_profits')
      .select('*')
      .gte('month', startMonth)
      .lte('month', endMonth)
      .order('month', { ascending: true });

    if (error) {
      logger.error('Error fetching profit summary:', error);
      throw error;
    }

    return data || [];
  }
}

export const profitEngineService = new ProfitEngineService();

