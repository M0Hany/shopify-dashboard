import { FinancialExpense, MonthlyProfit, ShippingRecord } from '../../types/financial';
import { logger } from '../../utils/logger';
import {
  getCurrentFinanceMonth,
  isPastFinanceMonth,
  orderMonthFromTag,
  parseOrderTags,
} from '../../utils/financeMonth';
import { expenseService } from './expenseService';
import { financeMonthSnapshotService } from './financeMonthSnapshotService';
import { profitEngineService } from './profitEngineService';
import { shippingLedgerService } from './shippingLedgerService';

export type FinanceMonthBundle = {
  month: string;
  profit: MonthlyProfit | null;
  orders: unknown[];
  paidOrders: unknown[];
  cancelledOrders: unknown[];
  paidOrderCount: number;
  cancelledOrderCount: number;
  expenses: FinancialExpense[];
  shippingRecords: ShippingRecord[];
  shippingSummary: {
    totalCosts: number;
    totalCustomerCharged: number;
    scooterProfitLoss: number;
    companyProfitLoss: number;
  };
  calculatedAt: string | null;
  isFinalized: boolean;
  fromCache: boolean;
  needsCalculation: boolean;
};

function buildTagShippingRecords(
  paidOrders: unknown[],
  cancelledOrders: unknown[],
  month: string
): ShippingRecord[] {
  const records: ShippingRecord[] = [];

  const pushRecord = (order: any, type: 'Company' | 'Uber', actualCost: number, status: 'Delivered' | 'Cancelled', transactionDate: string) => {
    let customerCharged = 0;
    if (order.total_shipping_price_set?.shop_money?.amount) {
      customerCharged = parseFloat(order.total_shipping_price_set.shop_money.amount || '0');
    } else if (order.shipping_lines?.length) {
      customerCharged = order.shipping_lines.reduce(
        (sum: number, line: any) => sum + parseFloat(line.price || '0'),
        0
      );
    }
    const orderNumber = String(order.name || '').replace(/[^0-9]/g, '');
    records.push({
      id: `tag-${order.id}`,
      order_id: parseInt(orderNumber, 10) || undefined,
      type,
      customer_shipping_charged: customerCharged,
      actual_shipping_cost: actualCost,
      status,
      date: transactionDate,
      month,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      isFromTag: true,
    });
  };

  for (const raw of paidOrders) {
    const order = raw as any;
    const tags = parseOrderTags(order.tags);
    const companyCostTag = tags.find((t) => t.startsWith('shipping_company_cost:'));
    if (companyCostTag) {
      const actualCost = parseFloat(companyCostTag.split(':')[1]?.trim() || '0');
      if (!Number.isNaN(actualCost)) {
        const dateTag = tags.find((t) => t.startsWith('shipping_company_cost_date:'));
        pushRecord(order, 'Company', actualCost, 'Delivered', dateTag?.split(':')[1]?.trim() || month + '-01');
      }
    }
    const isScooter = tags.some(
      (t) => t.toLowerCase().startsWith('shipping_method:') && t.toLowerCase().includes('scooter')
    );
    if (isScooter) {
      const scooterCostTag = tags.find((t) => t.startsWith('scooter_shipping_cost:'));
      if (scooterCostTag) {
        const actualCost = parseFloat(scooterCostTag.split(':')[1]?.trim() || '0');
        if (!Number.isNaN(actualCost)) {
          pushRecord(order, 'Uber', actualCost, 'Delivered', month + '-01');
        }
      }
    }
  }

  for (const raw of cancelledOrders) {
    const order = raw as any;
    const tags = parseOrderTags(order.tags);
    const companyCostTag = tags.find((t) => t.startsWith('shipping_company_cost:'));
    const scooterCostTag = tags.find((t) => t.startsWith('scooter_shipping_cost:'));
    const costTag = companyCostTag || scooterCostTag;
    if (!costTag) continue;
    const actualCost = parseFloat(costTag.split(':')[1]?.trim() || '0');
    if (Number.isNaN(actualCost)) continue;
    const type: 'Company' | 'Uber' = companyCostTag ? 'Company' : 'Uber';
    const dateStr =
      orderMonthFromTag(tags, [
        'paid_date:',
        'fulfillment_date:',
        'shipping_company_cost_date:',
        'scooter_shipping_cost_date:',
      ]) || month;
    pushRecord(order, type, actualCost, 'Cancelled', dateStr + (dateStr.length === 7 ? '-01' : ''));
  }

  return records;
}

async function assembleBundle(params: {
  month: string;
  profit: MonthlyProfit | null;
  paidOrders: unknown[];
  cancelledOrders: unknown[];
  paidOrderCount: number;
  cancelledOrderCount: number;
  shippingRecords: ShippingRecord[];
  shippingSummary: FinanceMonthBundle['shippingSummary'];
  calculatedAt: string | null;
  isFinalized: boolean;
  fromCache: boolean;
  needsCalculation: boolean;
}): Promise<FinanceMonthBundle> {
  const expenses = await expenseService.getAll(params.month);
  const manualShipping = await shippingLedgerService.getAll(params.month);
  const manualOnly = manualShipping.filter((r) => !r.isFromTag);
  const tagShipping = params.shippingRecords.length
    ? params.shippingRecords
    : buildTagShippingRecords(params.paidOrders, params.cancelledOrders, params.month);

  return {
    month: params.month,
    profit: params.profit,
    orders: [...params.paidOrders, ...params.cancelledOrders],
    paidOrders: params.paidOrders,
    cancelledOrders: params.cancelledOrders,
    paidOrderCount: params.paidOrderCount,
    cancelledOrderCount: params.cancelledOrderCount,
    expenses,
    shippingRecords: [...tagShipping, ...manualOnly],
    shippingSummary: params.shippingSummary,
    calculatedAt: params.calculatedAt,
    isFinalized: params.isFinalized,
    fromCache: params.fromCache,
    needsCalculation: params.needsCalculation,
  };
}

export async function getShippingRecordsForMonth(month: string): Promise<ShippingRecord[]> {
  const manualShipping = await shippingLedgerService.getAll(month);
  const manualOnly = manualShipping.filter((r) => !r.isFromTag);

  // Past months: use cached shipping rows when available
  if (isPastFinanceMonth(month)) {
    const snapshot = await financeMonthSnapshotService.get(month);
    if (snapshot?.shipping_records_json?.length) {
      return [...(snapshot.shipping_records_json as ShippingRecord[]), ...manualOnly];
    }
  }

  const { paid, cancelled } = await profitEngineService.loadFinanceOrdersForMonth(month, {
    fresh: true,
  });
  const tagShipping = buildTagShippingRecords(paid, cancelled, month);
  return [...tagShipping, ...manualOnly];
}

export class FinanceMonthService {
  async getMonthBundle(month: string, options: { force?: boolean } = {}): Promise<FinanceMonthBundle> {
    const isPast = isPastFinanceMonth(month);

    // Current month: always live from Shopify; persist totals in Supabase as we go
    if (!isPast) {
      return this.calculateAndSaveMonth(month);
    }

    // Past month: read Supabase cache (survives Shopify plan renewal)
    if (!options.force) {
      const snapshot = await financeMonthSnapshotService.get(month);
      const profit = await profitEngineService.getMonthlyProfitRow(month);

      if (snapshot && profit) {
        const summary = snapshot.shipping_summary || {};
        const cachedShipping = (snapshot.shipping_records_json || []) as ShippingRecord[];
        const paidOrders = snapshot.paid_orders_json || [];
        const cancelledOrders = snapshot.cancelled_orders_json || [];
        return assembleBundle({
          month,
          profit,
          paidOrders,
          cancelledOrders,
          paidOrderCount: snapshot.paid_order_count || paidOrders.length,
          cancelledOrderCount: snapshot.cancelled_order_count || cancelledOrders.length,
          shippingRecords: cachedShipping,
          shippingSummary: {
            totalCosts: Number(summary.totalCosts) || 0,
            totalCustomerCharged: Number(summary.totalCustomerCharged) || 0,
            scooterProfitLoss: Number(summary.scooterProfitLoss) || 0,
            companyProfitLoss: Number(summary.companyProfitLoss) || 0,
          },
          calculatedAt: snapshot.calculated_at,
          isFinalized: true,
          fromCache: true,
          needsCalculation: false,
        });
      }
    }

    // Past month not saved yet — try Shopify while orders still exist, then cache
    return this.calculateAndSaveMonth(month);
  }

  async calculateAndSaveMonth(month: string): Promise<FinanceMonthBundle> {
    logger.info(`Calculating and saving finance month bundle: ${month}`);

    const { paid, cancelled } = await profitEngineService.loadFinanceOrdersForMonth(month, {
      fresh: true,
    });
    const profit = await profitEngineService.calculateProfitFromOrders(month, paid, cancelled);

    const scooterProfitLoss = await profitEngineService.calculateScooterShippingProfitLoss(paid, month);
    const companyProfitLoss = await profitEngineService.calculateCompanyShippingProfitLoss(paid, month);

    let totalCosts = 0;
    let totalCustomerCharged = 0;
    for (const raw of paid) {
      const order = raw as any;
      const tags = parseOrderTags(order.tags);
      const scooterTag = tags.find((t) => t.startsWith('scooter_shipping_cost:'));
      const companyTag = tags.find((t) => t.startsWith('shipping_company_cost:'));
      if (scooterTag) totalCosts += parseFloat(scooterTag.split(':')[1]?.trim() || '0') || 0;
      if (companyTag) totalCosts += parseFloat(companyTag.split(':')[1]?.trim() || '0') || 0;
      if (order.total_shipping_price_set?.shop_money?.amount) {
        totalCustomerCharged += parseFloat(order.total_shipping_price_set.shop_money.amount || '0');
      }
    }

    const shippingSummary = {
      totalCosts,
      totalCustomerCharged,
      scooterProfitLoss,
      companyProfitLoss,
    };

    const isFinalized = isPastFinanceMonth(month);
    const tagShippingRecords = buildTagShippingRecords(paid, cancelled, month);

    await financeMonthSnapshotService.save({
      month,
      paidOrders: paid,
      cancelledOrders: cancelled,
      shippingSummary,
      shippingRecords: tagShippingRecords,
      paidOrderCount: paid.length,
      cancelledOrderCount: cancelled.length,
      isFinalized,
    });

    return assembleBundle({
      month,
      profit,
      paidOrders: paid,
      cancelledOrders: cancelled,
      paidOrderCount: paid.length,
      cancelledOrderCount: cancelled.length,
      shippingRecords: tagShippingRecords,
      shippingSummary,
      calculatedAt: new Date().toISOString(),
      isFinalized,
      fromCache: false,
      needsCalculation: false,
    });
  }
}

export const financeMonthService = new FinanceMonthService();
