import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { financialService } from '../../services/financialService';
import { format } from 'date-fns';
import { SkeletonCard } from '../common/SkeletonLoader';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface PayoutsTabProps {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  onBack: () => void;
}

export default function PayoutsTab({ selectedMonth, setSelectedMonth, onBack }: PayoutsTabProps) {
  // Fetch profit data
  const { data: profit, isLoading: profitLoading } = useQuery({
    queryKey: ['monthly-profit', selectedMonth],
    queryFn: () => financialService.getMonthlyProfit(selectedMonth),
    enabled: !!selectedMonth,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 0,
  });

  // Get payout config to calculate payouts
  const { data: payoutConfig, isLoading: configLoading } = useQuery({
    queryKey: ['payout-config'],
    queryFn: () => financialService.getPayoutConfig(),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 0,
  });

  // Fetch fulfilled orders and cancelled orders - same as ProfitOverviewTab
  const { data: fulfilledOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ['fulfilled-orders', selectedMonth],
    queryFn: async () => {
      const fulfilled = await financialService.getFulfilledOrders(selectedMonth);
      const cancelled = await financialService.getCancelledOrders(selectedMonth);
      return [...fulfilled, ...cancelled];
    },
    enabled: !!selectedMonth,
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 0,
  });

  // Calculate revenue from actual orders (matching ProfitOverviewTab calculation)
  const calculatedRevenue = useMemo(() => {
    if (!fulfilledOrders || fulfilledOrders.length === 0) return 0;
    
    return fulfilledOrders.reduce((sum: number, order: any) => {
      const tags = Array.isArray(order.tags) ? order.tags : typeof order.tags === 'string' ? order.tags.split(',').map((t: string) => t.trim()) : [];
      const isCancelled = tags.some((tag: string) => tag.trim().toLowerCase() === 'cancelled');
      // Cancelled orders don't contribute to revenue (we didn't receive money)
      return sum + (isCancelled ? 0 : parseFloat(order.total_price || '0'));
    }, 0);
  }, [fulfilledOrders]);

  // Calculate shipping cost from actual orders (matching ProfitOverviewTab calculation)
  const calculatedShippingCost = useMemo(() => {
    if (!fulfilledOrders || fulfilledOrders.length === 0) return 0;
    
    return fulfilledOrders.reduce((sum: number, order: any) => {
      const tags = Array.isArray(order.tags) ? order.tags : typeof order.tags === 'string' ? order.tags.split(',').map((t: string) => t.trim()) : [];
      
      // Get shipping cost from tags
      const scooterCostTag = tags.find((tag: string) => tag.trim().startsWith('scooter_shipping_cost:'));
      const companyCostTag = tags.find((tag: string) => tag.trim().startsWith('shipping_company_cost:'));
      
      let shippingCost = 0;
      if (scooterCostTag) {
        shippingCost = parseFloat(scooterCostTag.split(':')[1]?.trim() || '0');
      } else if (companyCostTag) {
        shippingCost = parseFloat(companyCostTag.split(':')[1]?.trim() || '0');
      }
      
      return sum + (isNaN(shippingCost) ? 0 : shippingCost);
    }, 0);
  }, [fulfilledOrders]);

  // Calculate DPP using calculated revenue and shipping cost (matching ProfitOverviewTab logic)
  // DPP = Revenue - Expenses - Shipping Cost
  const calculatedDPP = useMemo(() => {
    const expenses = profit?.total_expenses ?? 0;
    return calculatedRevenue - expenses - calculatedShippingCost;
  }, [calculatedRevenue, calculatedShippingCost, profit?.total_expenses]);

  // Calculate payouts and final profit directly from displayed numbers (same as ProfitOverviewTab)
  const calculatedPayouts = useMemo(() => {
    if (!payoutConfig || !calculatedDPP) return null;

    const mediaBuyerAmount = calculatedDPP * (payoutConfig.media_buyer_percent / 100);
    const opsAmount = calculatedDPP * (payoutConfig.ops_percent / 100);
    const crmAmount = calculatedDPP * (payoutConfig.crm_percent / 100);
    
    // Calculate owner pay
    let ownerAmount = 0;
    if (payoutConfig.owner_pay_type === 'fixed') {
      ownerAmount = payoutConfig.owner_pay_value;
    } else {
      ownerAmount = calculatedDPP * (payoutConfig.owner_pay_value / 100);
    }

    // Calculate net business profit
    const netBusinessProfit = calculatedDPP - mediaBuyerAmount - opsAmount - crmAmount - ownerAmount;

    return {
      dpp: calculatedDPP,
      media_buyer_amount: mediaBuyerAmount,
      ops_amount: opsAmount,
      crm_amount: crmAmount,
      owner_amount: ownerAmount,
      net_business_profit: netBusinessProfit,
    };
  }, [payoutConfig, calculatedDPP]);


  const formatMonthDisplay = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return format(date, 'MMMM yyyy');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-EG', {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Prepare pie chart data
  const pieData = calculatedPayouts ? [
    { name: 'Media Buyer', value: calculatedPayouts.media_buyer_amount, color: '#3b82f6' },
    { name: 'Operations', value: calculatedPayouts.ops_amount, color: '#10b981' },
    { name: 'CRM', value: calculatedPayouts.crm_amount, color: '#f59e0b' },
    { name: 'Owner', value: calculatedPayouts.owner_amount, color: '#8b5cf6' },
    { name: 'Net Business Profit', value: calculatedPayouts.net_business_profit, color: '#10b981' },
  ].filter(item => item.value > 0) : [];

  const isLoading = profitLoading || configLoading || ordersLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900">Payouts</h3>
        <p className="text-sm text-gray-500 mt-1">Commission distribution for {formatMonthDisplay(selectedMonth)}</p>
      </div>

      {calculatedPayouts ? (
        <div className="space-y-6">
          {/* DPP Card */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-lg p-6">
            <h4 className="text-sm font-medium text-gray-600 mb-2">Distributable Profit Pool (DPP)</h4>
            <p className="text-4xl font-bold text-purple-700">
              {formatCurrency(calculatedPayouts.dpp)}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Available after all expenses (Revenue - Production Costs - Operating Expenses - Shipping Net)
            </p>
            <p className="mt-1 text-xs font-medium text-purple-600">
              ⚠️ Payouts are calculated FROM this amount, not subtracted as expenses
            </p>
          </div>

          {/* Payout Distribution Chart */}
          {pieData.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Payout Distribution</h4>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Payouts Grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg p-6">
              <h4 className="text-sm font-medium text-gray-700">Media Buyer</h4>
              <p className="mt-2 text-2xl font-bold text-blue-700">
                {formatCurrency(calculatedPayouts.media_buyer_amount)}
              </p>
              <p className="mt-1 text-xs text-gray-600">{payoutConfig?.media_buyer_percent || 0}% of DPP</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-lg p-6">
              <h4 className="text-sm font-medium text-gray-700">Operations</h4>
              <p className="mt-2 text-2xl font-bold text-green-700">
                {formatCurrency(calculatedPayouts.ops_amount)}
              </p>
              <p className="mt-1 text-xs text-gray-600">{payoutConfig?.ops_percent || 0}% of DPP</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-200 rounded-lg p-6">
              <h4 className="text-sm font-medium text-gray-700">CRM</h4>
              <p className="mt-2 text-2xl font-bold text-yellow-700">
                {formatCurrency(calculatedPayouts.crm_amount)}
              </p>
              <p className="mt-1 text-xs text-gray-600">{payoutConfig?.crm_percent || 0}% of DPP</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-lg p-6">
              <h4 className="text-sm font-medium text-gray-700">Owner</h4>
              <p className="mt-2 text-2xl font-bold text-purple-700">
                {formatCurrency(calculatedPayouts.owner_amount)}
              </p>
              <p className="mt-1 text-xs text-gray-600">
                {payoutConfig?.owner_pay_type === 'fixed' 
                  ? `Fixed: ${formatCurrency(payoutConfig.owner_pay_value)}` 
                  : `${payoutConfig?.owner_pay_value || 0}% of DPP`}
              </p>
            </div>
          </div>

          {/* Final Net Profit for Owner */}
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-300 rounded-lg p-6 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-lg font-semibold text-gray-900">Final Net Profit (For You)</h4>
            </div>
            <p className="text-5xl font-bold text-emerald-700 mt-2">
              {formatCurrency(calculatedPayouts.net_business_profit)}
            </p>
            <div className="mt-4 pt-4 border-t border-emerald-200">
              <div className="text-sm space-y-1">
                <div className="flex justify-between text-gray-600">
                  <span>DPP (Available for Distribution):</span>
                  <span className="font-semibold">{formatCurrency(calculatedPayouts.dpp)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Total Payouts (Media Buyer + Ops + CRM + Owner):</span>
                  <span className="font-semibold text-red-600">
                    - {formatCurrency(calculatedPayouts.media_buyer_amount + calculatedPayouts.ops_amount + calculatedPayouts.crm_amount + calculatedPayouts.owner_amount)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold pt-2 border-t border-emerald-200">
                  <span>Your Final Net Profit:</span>
                  <span>{formatCurrency(calculatedPayouts.net_business_profit)}</span>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500">This is your profit after all expenses and payouts</p>
          </div>

          {/* Breakdown Table */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h4 className="text-sm font-medium text-gray-900">Payout Breakdown</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipient</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">% of DPP</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Media Buyer</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(calculatedPayouts.media_buyer_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {calculatedPayouts.dpp > 0 ? ((calculatedPayouts.media_buyer_amount / calculatedPayouts.dpp) * 100).toFixed(2) : '0.00'}%
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Operations</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(calculatedPayouts.ops_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {calculatedPayouts.dpp > 0 ? ((calculatedPayouts.ops_amount / calculatedPayouts.dpp) * 100).toFixed(2) : '0.00'}%
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">CRM</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(calculatedPayouts.crm_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {calculatedPayouts.dpp > 0 ? ((calculatedPayouts.crm_amount / calculatedPayouts.dpp) * 100).toFixed(2) : '0.00'}%
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Owner</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(calculatedPayouts.owner_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {calculatedPayouts.dpp > 0 ? ((calculatedPayouts.owner_amount / calculatedPayouts.dpp) * 100).toFixed(2) : '0.00'}%
                    </td>
                  </tr>
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Total Payouts</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(calculatedPayouts.media_buyer_amount + calculatedPayouts.ops_amount + calculatedPayouts.crm_amount + calculatedPayouts.owner_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {calculatedPayouts.dpp > 0 ? (((calculatedPayouts.media_buyer_amount + calculatedPayouts.ops_amount + calculatedPayouts.crm_amount + calculatedPayouts.owner_amount) / calculatedPayouts.dpp) * 100).toFixed(2) : '0.00'}%
                    </td>
                  </tr>
                  <tr className="bg-emerald-50 font-bold">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Final Net Profit (For You)</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-emerald-700 text-lg">
                      {formatCurrency(calculatedPayouts.net_business_profit)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {calculatedPayouts.dpp > 0 ? ((calculatedPayouts.net_business_profit / calculatedPayouts.dpp) * 100).toFixed(2) : '0.00'}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-600 font-medium">No payout data for {formatMonthDisplay(selectedMonth)}</p>
          <p className="mt-2 text-sm text-gray-500">
            {!profit ? 'Calculate profit first to see payout distribution.' : !payoutConfig ? 'Payout configuration is required to calculate payouts.' : 'Payouts will be calculated automatically from revenue, expenses, and shipping costs.'}
          </p>
        </div>
      )}
    </div>
  );
}
