import { supabase } from '../../config/supabase';
import { PayoutConfig, PayoutConfigInput, MonthlyPayout } from '../../types/financial';
import { profitEngineService } from './profitEngineService';
import { logger } from '../../utils/logger';

export class PayoutService {
  /**
   * Get payout configuration
   */
  async getConfig(): Promise<PayoutConfig> {
    const { data, error } = await supabase
      .from('payout_config')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No config exists, create default
        return await this.createDefaultConfig();
      }
      logger.error('Error fetching payout config:', error);
      throw error;
    }

    return data;
  }

  /**
   * Create default payout configuration
   */
  private async createDefaultConfig(): Promise<PayoutConfig> {
    const defaultConfig: PayoutConfigInput = {
      media_buyer_percent: 3,
      ops_percent: 10,
      crm_percent: 7.5,
      owner_pay_type: 'percent',
      owner_pay_value: 0, // 0% by default (can be changed)
    };

    const { data, error } = await supabase
      .from('payout_config')
      .insert([defaultConfig])
      .select()
      .single();

    if (error) {
      logger.error('Error creating default payout config:', error);
      throw error;
    }

    return data;
  }

  /**
   * Update payout configuration
   */
  async updateConfig(input: PayoutConfigInput): Promise<PayoutConfig> {
    // Check if config exists
    const existing = await this.getConfig();

    const { data, error } = await supabase
      .from('payout_config')
      .update(input)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating payout config:', error);
      throw error;
    }

    return data;
  }

  /**
   * Calculate payouts for a specific month
   */
  async calculatePayouts(month: string): Promise<MonthlyPayout> {
    // Get DPP from monthly profit
    // Use cash_dpp for payouts (cash-flow basis) instead of accrual-based dpp
    const monthlyProfit = await profitEngineService.getMonthlyProfit(month);
    if (!monthlyProfit) {
      throw new Error(`Monthly profit not found for ${month}. Please calculate profit first.`);
    }

    // Use cash_dpp for payouts (reflects actual cash available)
    // Fallback to dpp if cash_dpp is not available (backward compatibility)
    const dpp = monthlyProfit.cash_dpp ?? monthlyProfit.dpp ?? 0;

    // Get payout configuration
    const config = await this.getConfig();

    // Calculate payouts
    const mediaBuyerAmount = dpp * (config.media_buyer_percent / 100);
    const opsAmount = dpp * (config.ops_percent / 100);
    const crmAmount = dpp * (config.crm_percent / 100);

    // Calculate owner pay
    let ownerAmount = 0;
    if (config.owner_pay_type === 'fixed') {
      ownerAmount = config.owner_pay_value;
    } else {
      ownerAmount = dpp * (config.owner_pay_value / 100);
    }

    // Calculate net business profit
    const netBusinessProfit = dpp - mediaBuyerAmount - opsAmount - crmAmount - ownerAmount;

    // Don't include id, created_at, updated_at - let Supabase auto-generate them
    const monthlyPayoutData = {
      month,
      dpp,
      media_buyer_amount: mediaBuyerAmount,
      ops_amount: opsAmount,
      crm_amount: crmAmount,
      owner_amount: ownerAmount,
      net_business_profit: netBusinessProfit,
    };

    return await this.saveMonthlyPayout(monthlyPayoutData);
  }

  /**
   * Save or update monthly payout record
   */
  private async saveMonthlyPayout(payoutData: Omit<MonthlyPayout, 'id' | 'created_at' | 'updated_at'>): Promise<MonthlyPayout> {
    // Check if record exists
    const { data: existing } = await supabase
      .from('monthly_payouts')
      .select('*')
      .eq('month', payoutData.month)
      .single();

    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('monthly_payouts')
        .update({
          dpp: payoutData.dpp,
          media_buyer_amount: payoutData.media_buyer_amount,
          ops_amount: payoutData.ops_amount,
          crm_amount: payoutData.crm_amount,
          owner_amount: payoutData.owner_amount,
          net_business_profit: payoutData.net_business_profit,
        })
        .eq('month', payoutData.month)
        .select()
        .single();

      if (error) {
        logger.error('Error updating monthly payout:', error);
        throw error;
      }

      return data;
    } else {
      // Create new record (don't include id, created_at, updated_at - let database handle them)
      const { data, error } = await supabase
        .from('monthly_payouts')
        .insert([payoutData])
        .select()
        .single();

      if (error) {
        logger.error('Error creating monthly payout:', error);
        throw error;
      }

      return data;
    }
  }

  /**
   * Get monthly payout
   * Automatically recalculates if DPP doesn't match current profit DPP
   */
  async getMonthlyPayout(month: string): Promise<MonthlyPayout | null> {
    // First, get the current profit DPP
    const monthlyProfit = await profitEngineService.getMonthlyProfit(month);
    if (!monthlyProfit) {
      return null;
    }

    const currentDpp = monthlyProfit.dpp;

    // Get existing payout record
    const { data, error } = await supabase
      .from('monthly_payouts')
      .select('*')
      .eq('month', month)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No payout record exists, return null
        return null;
      }
      logger.error('Error fetching monthly payout:', error);
      throw error;
    }

    // Check if DPP matches current profit cash DPP
    const currentCashDpp = monthlyProfit.cash_dpp ?? monthlyProfit.dpp ?? 0;
    if (data.dpp !== currentCashDpp) {
      logger.info(`DPP mismatch detected for ${month}. Payout DPP: ${data.dpp}, Current Cash DPP: ${currentCashDpp}. Recalculating payouts...`);
      // DPP doesn't match, recalculate payouts
      return await this.calculatePayouts(month);
    }

    return data;
  }
}

export const payoutService = new PayoutService();

