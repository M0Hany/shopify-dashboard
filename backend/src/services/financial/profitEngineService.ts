import { supabase } from '../../config/supabase';
import { MonthlyProfit } from '../../types/financial';
import { expenseService } from './expenseService';
import { shopifyService } from '../shopify';
import { logger } from '../../utils/logger';
import { isPastFinanceMonth, orderMonthFromTag, parseOrderTags } from '../../utils/financeMonth';
import { formatSupabaseError } from '../../utils/financeOrderSnapshot';
import { financeMonthSnapshotService } from './financeMonthSnapshotService';

const PAID_DATE_PREFIXES = ['paid_date:'];
const CANCELLED_DATE_PREFIXES = [
  'paid_date:',
  'fulfillment_date:',
  'shipping_company_cost_date:',
  'scooter_shipping_cost_date:',
];

function filterPaidOrdersForMonth(orders: any[], month: string): any[] {
  return orders.filter((order) => {
    const tags = parseOrderTags(order.tags);
    if (!tags.some((t) => t.toLowerCase() === 'paid')) return false;
    if (tags.some((t) => t.toLowerCase() === 'cancelled')) return false;
    const orderMonth = orderMonthFromTag(tags, PAID_DATE_PREFIXES);
    return orderMonth === month;
  });
}

function filterCancelledOrdersForMonth(orders: any[], month: string): any[] {
  return orders.filter((order) => {
    const tags = parseOrderTags(order.tags);
    if (!tags.some((t) => t.toLowerCase() === 'cancelled')) return false;
    const hasShippingCost = tags.some(
      (t) =>
        t.startsWith('shipping_company_cost:') || t.startsWith('scooter_shipping_cost:')
    );
    if (!hasShippingCost) return false;
    const orderMonth = orderMonthFromTag(tags, CANCELLED_DATE_PREFIXES);
    return orderMonth === month;
  });
}

export class ProfitEngineService {
  /**
   * One scoped Shopify fetch per order set (not the full catalog).
   */
  async loadFinanceOrdersForMonth(
    month: string,
    options?: { fresh?: boolean }
  ): Promise<{ paid: any[]; cancelled: any[] }> {
    // Past months with cache: callers that need live data pass fresh: true
    if (!options?.fresh && isPastFinanceMonth(month)) {
      const snapshot = await financeMonthSnapshotService.get(month);
      const profit = await profitEngineService.getMonthlyProfitRow(month);
      if (snapshot && profit) {
        return { paid: [], cancelled: [] };
      }
    }

    const [paidCandidates, cancelledCandidates] = await Promise.all([
      shopifyService.getOrders({ ordersQuery: 'tag:paid NOT tag:cancelled' }),
      shopifyService.getOrders({ ordersQuery: 'tag:cancelled' }),
    ]);

    return {
      paid: filterPaidOrdersForMonth(paidCandidates, month),
      cancelled: filterCancelledOrdersForMonth(cancelledCandidates, month),
    };
  }

  async calculateProfit(month: string): Promise<MonthlyProfit> {
    const { paid, cancelled } = await this.loadFinanceOrdersForMonth(month, { fresh: true });
    return this.calculateProfitFromOrders(month, paid, cancelled);
  }

  /**
   * Calculate profit when orders are already loaded.
   */
  async calculateProfitFromOrders(
    month: string,
    fulfilledOrders: any[],
    cancelledOrders: any[]
  ): Promise<MonthlyProfit> {
    logger.info(`Calculating profit for month: ${month}`);

    const revenue = this.calculateRevenue(fulfilledOrders);
    const cogs = 0;
    const grossProfit = revenue;
    const monthlyExpenses = await expenseService.getMonthlyTotal(month, 'operating');
    const productionCostsPaid = await expenseService.getMonthlyTotal(month, 'production');
    const shippingCostFromFulfilled = await this.calculateTotalShippingCostsFromTags(
      fulfilledOrders,
      month
    );
    const shippingCostFromCancelled = await this.calculateTotalShippingCostsFromTags(
      cancelledOrders,
      month
    );
    const totalShippingCost = shippingCostFromFulfilled + shippingCostFromCancelled;
    const operatingProfit = grossProfit - monthlyExpenses - totalShippingCost;
    const dpp = operatingProfit;
    const cashDpp = revenue - productionCostsPaid - monthlyExpenses - totalShippingCost;

    const monthlyProfitData = {
      month,
      revenue,
      cogs,
      gross_profit: grossProfit,
      total_expenses: monthlyExpenses,
      shipping_loss: -totalShippingCost,
      operating_profit: operatingProfit,
      dpp,
      production_costs_paid: productionCostsPaid,
      cash_dpp: cashDpp,
    };

    return await this.saveMonthlyProfit(monthlyProfitData);
  }

  /**
   * Get paid orders for a specific month
   * Public method to expose paid orders for a given month
   * Only uses 'paid' and 'paid_date' tags - no fallback to fulfilled tags
   */
  async getFulfilledOrdersForMonth(month: string): Promise<any[]> {
    if (isPastFinanceMonth(month)) {
      const snapshot = await financeMonthSnapshotService.get(month);
      const profit = await this.getMonthlyProfitRow(month);
      if (snapshot && profit) return [];
    }
    const { paid } = await this.loadFinanceOrdersForMonth(month, { fresh: !isPastFinanceMonth(month) });
    return paid;
  }

  async getCancelledOrdersWithShippingCosts(month: string): Promise<any[]> {
    if (isPastFinanceMonth(month)) {
      const snapshot = await financeMonthSnapshotService.get(month);
      const profit = await this.getMonthlyProfitRow(month);
      if (snapshot && profit) return [];
    }
    const { cancelled } = await this.loadFinanceOrdersForMonth(month, { fresh: !isPastFinanceMonth(month) });
    return cancelled;
  }

  /**
   * Revenue = sum of paid order totals (items + shipping charged to customer).
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
  private async saveMonthlyProfit(
    profitData: Omit<MonthlyProfit, 'id' | 'created_at' | 'updated_at'>
  ): Promise<MonthlyProfit> {
    const { data, error } = await supabase
      .from('monthly_profits')
      .upsert(profitData, { onConflict: 'month' })
      .select()
      .single();

    if (error) {
      const detail = formatSupabaseError(error);
      if (error.code === '42P01' || error.code === 'PGRST205') {
        logger.error(`monthly_profits table missing: ${detail}`);
        throw new Error(
          'Table monthly_profits not found. Run docs/FINANCE_MONTH_SNAPSHOTS.sql in Supabase SQL editor.'
        );
      }
      logger.error(`Error saving monthly profit: ${detail}`);
      throw new Error(`Failed to save monthly profit: ${detail}`);
    }

    return data as MonthlyProfit;
  }

  /** Read stored profit only — never triggers Shopify or recalculation. */
  async getMonthlyProfitRow(month: string): Promise<MonthlyProfit | null> {
    const { data, error } = await supabase
      .from('monthly_profits')
      .select('*')
      .eq('month', month)
      .maybeSingle();

    if (error) {
      const detail = formatSupabaseError(error);
      if (error.code === '42P01' || error.code === 'PGRST205') {
        logger.warn(`monthly_profits table missing: ${detail}`);
        return null;
      }
      logger.error(`Error fetching monthly profit: ${detail}`);
      throw new Error(detail);
    }

    return data as MonthlyProfit | null;
  }

  /**
   * @deprecated Prefer getMonthlyProfitRow + explicit calculateProfit / finance month bundle.
   */
  async getMonthlyProfit(month: string, forceRecalculate = false): Promise<MonthlyProfit | null> {
    if (forceRecalculate) {
      return await this.calculateProfit(month);
    }
    const row = await this.getMonthlyProfitRow(month);
    if (row) return row;
    return null;
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

