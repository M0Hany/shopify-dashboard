import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';
import { formatSupabaseError, slimOrderForFinanceSnapshot } from '../../utils/financeOrderSnapshot';

export type FinanceMonthSnapshotRow = {
  month: string;
  paid_orders_json: unknown[];
  cancelled_orders_json: unknown[];
  shipping_summary: Record<string, number>;
  shipping_records_json: unknown[];
  paid_order_count: number;
  cancelled_order_count: number;
  calculated_at: string;
  is_finalized: boolean;
};

export class FinanceMonthSnapshotService {
  async get(month: string): Promise<FinanceMonthSnapshotRow | null> {
    const { data, error } = await supabase
      .from('finance_month_snapshots')
      .select('*')
      .eq('month', month)
      .maybeSingle();

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        logger.warn('finance_month_snapshots table missing — run docs/FINANCE_MONTH_SNAPSHOTS.sql');
        return null;
      }
      logger.error(`Error fetching finance month snapshot: ${formatSupabaseError(error)}`);
      throw error;
    }

    if (!data) return null;

    return {
      month: data.month,
      paid_orders_json: (data.paid_orders_json as unknown[]) || [],
      cancelled_orders_json: (data.cancelled_orders_json as unknown[]) || [],
      shipping_summary: (data.shipping_summary as Record<string, number>) || {},
      shipping_records_json: (data.shipping_records_json as unknown[]) || [],
      paid_order_count: Number(data.paid_order_count) || 0,
      cancelled_order_count: Number(data.cancelled_order_count) || 0,
      calculated_at: data.calculated_at,
      is_finalized: data.is_finalized,
    };
  }

  async save(params: {
    month: string;
    paidOrders: unknown[];
    cancelledOrders: unknown[];
    shippingSummary: Record<string, number>;
    shippingRecords: unknown[];
    paidOrderCount: number;
    cancelledOrderCount: number;
    isFinalized: boolean;
  }): Promise<FinanceMonthSnapshotRow> {
    const row = {
      month: params.month,
      paid_orders_json: params.paidOrders.map((o) =>
        slimOrderForFinanceSnapshot(o as Record<string, unknown>)
      ),
      cancelled_orders_json: params.cancelledOrders.map((o) =>
        slimOrderForFinanceSnapshot(o as Record<string, unknown>)
      ),
      shipping_summary: params.shippingSummary,
      shipping_records_json: params.shippingRecords,
      paid_order_count: params.paidOrderCount,
      cancelled_order_count: params.cancelledOrderCount,
      calculated_at: new Date().toISOString(),
      is_finalized: params.isFinalized,
    };

    const { data, error } = await supabase
      .from('finance_month_snapshots')
      .upsert(row, { onConflict: 'month' })
      .select()
      .single();

    if (error || !data) {
      const probe = await supabase.from('finance_month_snapshots').select('month').limit(1);
      const detail =
        formatSupabaseError(error) ||
        formatSupabaseError(probe.error) ||
        'unknown Supabase error';

      if (probeMatchesMissingTable(detail)) {
        logger.error(`finance_month_snapshots table missing: ${detail}`);
        throw new Error(
          'Table finance_month_snapshots not found. Run docs/FINANCE_MONTH_SNAPSHOTS.sql in Supabase SQL editor.'
        );
      }
      if (detail.includes('42501') || detail.toLowerCase().includes('row-level security')) {
        throw new Error(
          'Insert blocked by Supabase RLS. Re-run docs/FINANCE_MONTH_SNAPSHOTS.sql or use the service_role key in SUPABASE_KEY.'
        );
      }
      logger.error(`Error saving finance month snapshot: ${detail}`);
      throw new Error(`Failed to save finance snapshot: ${detail}`);
    }

    return {
      month: data.month,
      paid_orders_json: (data.paid_orders_json as unknown[]) || [],
      cancelled_orders_json: (data.cancelled_orders_json as unknown[]) || [],
      shipping_summary: (data.shipping_summary as Record<string, number>) || {},
      shipping_records_json: (data.shipping_records_json as unknown[]) || [],
      paid_order_count: Number(data.paid_order_count) || 0,
      cancelled_order_count: Number(data.cancelled_order_count) || 0,
      calculated_at: data.calculated_at,
      is_finalized: data.is_finalized,
    };
  }
}

function probeMatchesMissingTable(detail: string): boolean {
  if (!detail) return false;
  return (
    detail.includes('42P01') ||
    detail.includes('PGRST205') ||
    detail.includes('does not exist') ||
    detail.includes('Could not find the table')
  );
}

export const financeMonthSnapshotService = new FinanceMonthSnapshotService();
