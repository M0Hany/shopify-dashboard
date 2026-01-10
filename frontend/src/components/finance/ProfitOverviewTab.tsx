import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financialService } from '../../services/financialService';
import { format, subMonths } from 'date-fns';
import { 
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ArrowPathIcon,
  XMarkIcon,
  EyeIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  Cog6ToothIcon,
  CubeIcon
} from '@heroicons/react/24/outline';
import { SkeletonCard, SkeletonChart } from '../common/SkeletonLoader';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import toast from 'react-hot-toast';

// Animated number counter component
function AnimatedNumber({ value, duration = 1000 }: { value: number | undefined; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value === undefined || value === null || isNaN(value)) {
      setDisplayValue(0);
      return;
    }

    let startTime: number;
    const startValue = 0;
    const endValue = value;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(startValue + (endValue - startValue) * easeOutQuart);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return <>{displayValue.toFixed(2)}</>;
}

// Comparison badge component
function ComparisonBadge({ current, previous, label }: { current: number; previous: number; label: string }) {
  if (previous === 0) return null;
  
  const change = ((current - previous) / previous) * 100;
  const isPositive = change >= 0;
  const Icon = isPositive ? ArrowTrendingUpIcon : ArrowTrendingDownIcon;

  return (
    <div className={`flex items-center gap-1 text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
      <Icon className="h-4 w-4" />
      <span>{Math.abs(change).toFixed(1)}% vs last month</span>
    </div>
  );
}

interface ProfitOverviewTabProps {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  onNavigate?: (tab: 'expenses' | 'shipping' | 'payouts' | 'product-margins' | 'settings') => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function ProfitOverviewTab({ selectedMonth, setSelectedMonth, onNavigate, onRefresh, isRefreshing }: ProfitOverviewTabProps) {
  const queryClient = useQueryClient();
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [showExpensesModal, setShowExpensesModal] = useState(false);
  const [showShippingCostModal, setShowShippingCostModal] = useState(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showCharts, setShowCharts] = useState(false);

  const { data: profit, isLoading, error } = useQuery({
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

  // Get previous month for comparison
  const previousMonth = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    const prevDate = subMonths(date, 1);
    return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  }, [selectedMonth]);

  const { data: previousProfit } = useQuery({
    queryKey: ['monthly-profit', previousMonth],
    queryFn: () => financialService.getMonthlyProfit(previousMonth),
    enabled: !!previousMonth,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 0,
  });

  // Get last 6 months for trend chart - only fetch when charts are shown
  const { data: trendData } = useQuery({
    queryKey: ['profit-trend', selectedMonth],
    queryFn: async () => {
      const months = [];
      const [year, month] = selectedMonth.split('-').map(Number);
      for (let i = 5; i >= 0; i--) {
        const date = new Date(year, month - 1 - i, 1);
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        try {
          const data = await financialService.getMonthlyProfit(monthStr);
          months.push({
            month: format(date, 'MMM'),
            revenue: data.revenue,
            profit: data.gross_profit,
            dpp: data.dpp,
          });
        } catch {
          months.push({
            month: format(date, 'MMM'),
            revenue: 0,
            profit: 0,
            dpp: 0,
          });
        }
      }
      return months;
    },
    enabled: !!selectedMonth && showCharts,
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 0,
  });

  const calculateMutation = useMutation({
    mutationFn: (month: string) => financialService.calculateProfit(month),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['monthly-profit', selectedMonth] });
      const previousProfit = queryClient.getQueryData(['monthly-profit', selectedMonth]);
      return { previousProfit };
    },
    onSuccess: (data) => {
      // Update with real calculated data
      queryClient.setQueryData(['monthly-profit', selectedMonth], data);
      // Also update payout if it exists (since it depends on profit)
      queryClient.invalidateQueries({ queryKey: ['monthly-payout', selectedMonth], exact: true });
      toast.success('Profit calculated successfully!');
    },
    onError: (error: any, variables, context) => {
      if (context?.previousProfit) {
        queryClient.setQueryData(['monthly-profit', selectedMonth], context.previousProfit);
      }
      toast.error(error.message || 'Failed to calculate profit');
    },
  });

  // Fetch fulfilled orders and cancelled orders - always fetch to calculate revenue correctly
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

  // Fetch expenses - always fetch to calculate correct expenses in the box
  const { data: expensesForModal, isLoading: expensesModalLoading } = useQuery({
    queryKey: ['financial-expenses', selectedMonth],
    queryFn: () => financialService.getExpenses(selectedMonth),
    enabled: !!selectedMonth,
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 0,
  });

  // Calculate expenses from expenses query (not from profit.total_expenses)
  const calculatedExpenses = useMemo(() => {
    if (!expensesForModal || expensesForModal.length === 0) return 0;
    return expensesForModal.reduce((sum: number, expense: any) => sum + expense.amount, 0);
  }, [expensesForModal]);

  // Fetch shipping records - always fetch to calculate correct profit/loss
  const { data: shippingRecordsForModal, isLoading: shippingRecordsModalLoading } = useQuery({
    queryKey: ['shipping-records', selectedMonth],
    queryFn: () => financialService.getShippingRecords(selectedMonth),
    enabled: !!selectedMonth,
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 0,
  });

  const { data: ordersForShippingModal } = useQuery({
    queryKey: ['shipping-orders', selectedMonth],
    queryFn: async () => {
      const fulfilled = await financialService.getFulfilledOrders(selectedMonth);
      const cancelled = await financialService.getCancelledOrders(selectedMonth);
      return [...fulfilled, ...cancelled];
    },
    enabled: showShippingCostModal && !!selectedMonth,
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 0,
  });

  // Sort orders based on sortField and sortDirection
  const sortedOrders = useMemo(() => {
    if (!fulfilledOrders || !sortField) return fulfilledOrders || [];
    
    return [...fulfilledOrders].sort((a: any, b: any) => {
      const tagsA = Array.isArray(a.tags) ? a.tags : typeof a.tags === 'string' ? a.tags.split(',').map((t: string) => t.trim()) : [];
      const tagsB = Array.isArray(b.tags) ? b.tags : typeof b.tags === 'string' ? b.tags.split(',').map((t: string) => t.trim()) : [];
      
      let aVal: any;
      let bVal: any;
      
      switch (sortField) {
        case 'order':
          aVal = a.name || '';
          bVal = b.name || '';
          break;
        case 'customer':
          aVal = `${a.customer?.first_name || ''} ${a.customer?.last_name || ''}`.trim();
          bVal = `${b.customer?.first_name || ''} ${b.customer?.last_name || ''}`.trim();
          break;
        case 'date':
          const paidDateTagA = tagsA.find((tag: string) => tag.trim().startsWith('paid_date:'));
          const paidDateTagB = tagsB.find((tag: string) => tag.trim().startsWith('paid_date:'));
          aVal = paidDateTagA ? paidDateTagA.split(':')[1]?.trim() || '' : a.created_at || '';
          bVal = paidDateTagB ? paidDateTagB.split(':')[1]?.trim() || '' : b.created_at || '';
          break;
        case 'total':
          aVal = parseFloat(a.total_price || '0');
          bVal = parseFloat(b.total_price || '0');
          break;
        case 'status':
          const isCancelledA = tagsA.some((tag: string) => tag.trim().toLowerCase() === 'cancelled');
          const isCancelledB = tagsB.some((tag: string) => tag.trim().toLowerCase() === 'cancelled');
          aVal = isCancelledA ? 'Cancelled' : 'Delivered';
          bVal = isCancelledB ? 'Cancelled' : 'Delivered';
          break;
        case 'shipping':
          const scooterCostTagA = tagsA.find((tag: string) => tag.trim().startsWith('scooter_shipping_cost:'));
          const companyCostTagA = tagsA.find((tag: string) => tag.trim().startsWith('shipping_company_cost:'));
          const scooterCostTagB = tagsB.find((tag: string) => tag.trim().startsWith('scooter_shipping_cost:'));
          const companyCostTagB = tagsB.find((tag: string) => tag.trim().startsWith('shipping_company_cost:'));
          aVal = scooterCostTagA ? parseFloat(scooterCostTagA.split(':')[1]?.trim() || '0') : companyCostTagA ? parseFloat(companyCostTagA.split(':')[1]?.trim() || '0') : 0;
          bVal = scooterCostTagB ? parseFloat(scooterCostTagB.split(':')[1]?.trim() || '0') : companyCostTagB ? parseFloat(companyCostTagB.split(':')[1]?.trim() || '0') : 0;
          break;
        case 'net': {
          const cancelledA = tagsA.some((tag: string) => tag.trim().toLowerCase() === 'cancelled');
          const cancelledB = tagsB.some((tag: string) => tag.trim().toLowerCase() === 'cancelled');
          // For cancelled orders: revenue = 0, so net = 0 - shipping cost = negative
          const totalA = cancelledA ? 0 : parseFloat(a.total_price || '0');
          const totalB = cancelledB ? 0 : parseFloat(b.total_price || '0');
          const shippingA = (() => {
            const scooterTag = tagsA.find((tag: string) => tag.trim().startsWith('scooter_shipping_cost:'));
            const companyTag = tagsA.find((tag: string) => tag.trim().startsWith('shipping_company_cost:'));
            return scooterTag ? parseFloat(scooterTag.split(':')[1]?.trim() || '0') : companyTag ? parseFloat(companyTag.split(':')[1]?.trim() || '0') : 0;
          })();
          const shippingB = (() => {
            const scooterTag = tagsB.find((tag: string) => tag.trim().startsWith('scooter_shipping_cost:'));
            const companyTag = tagsB.find((tag: string) => tag.trim().startsWith('shipping_company_cost:'));
            return scooterTag ? parseFloat(scooterTag.split(':')[1]?.trim() || '0') : companyTag ? parseFloat(companyTag.split(':')[1]?.trim() || '0') : 0;
          })();
          aVal = totalA - shippingA;
          bVal = totalB - shippingB;
          break;
        }
        default:
          return 0;
      }
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [fulfilledOrders, sortField, sortDirection]);

  // Calculate shipping costs and revenue from tags
  const { data: shippingData } = useQuery({
    queryKey: ['shipping-data-from-tags', selectedMonth],
    queryFn: async () => {
      const orders = await financialService.getFulfilledOrders(selectedMonth);
      let totalCosts = 0;
      let totalCustomerCharged = 0;
      
      orders.forEach((order: any) => {
        const tags = Array.isArray(order.tags)
          ? order.tags
          : typeof order.tags === 'string'
            ? order.tags.split(',').map((t: string) => t.trim())
            : [];

        // Get customer shipping charged
        let customerCharged = 0;
        if (order.total_shipping_price_set?.shop_money?.amount) {
          customerCharged = parseFloat(order.total_shipping_price_set.shop_money.amount || '0');
        } else if (order.shipping_lines && order.shipping_lines.length > 0) {
          customerCharged = order.shipping_lines.reduce((sum: number, line: any) => {
            return sum + parseFloat(line.price || '0');
          }, 0);
        }
        totalCustomerCharged += customerCharged;

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
      });
      
      return {
        costs: totalCosts,
        customerCharged: totalCustomerCharged,
        profitLoss: totalCustomerCharged - totalCosts,
      };
    },
    enabled: !!selectedMonth && !!profit,
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 0,
  });


  const formatMonthDisplay = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return format(date, 'MMMM yyyy');
  };

  // Calculate revenue from actual orders (only non-cancelled paid orders contribute to revenue)
  const calculatedRevenue = useMemo(() => {
    if (!fulfilledOrders || fulfilledOrders.length === 0) return 0;
    
    return fulfilledOrders.reduce((sum: number, order: any) => {
      const tags = Array.isArray(order.tags) ? order.tags : typeof order.tags === 'string' ? order.tags.split(',').map((t: string) => t.trim()) : [];
      const isCancelled = tags.some((tag: string) => tag.trim().toLowerCase() === 'cancelled');
      // Cancelled orders don't contribute to revenue (we didn't receive money)
      // But they are included in the modal and their shipping costs are deducted from net
      return sum + (isCancelled ? 0 : parseFloat(order.total_price || '0'));
    }, 0);
  }, [fulfilledOrders]);

  // Calculate shipping cost from actual orders (matching modal calculation)
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

  // Calculate DPP using calculated revenue and shipping cost (matching modal logic)
  // DPP = Revenue - Expenses - Shipping Cost
  const calculatedDPP = useMemo(() => {
    return calculatedRevenue - calculatedExpenses - calculatedShippingCost;
  }, [calculatedRevenue, calculatedExpenses, calculatedShippingCost]);

  // Calculate payouts and final profit directly from displayed numbers
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
      media_buyer_amount: mediaBuyerAmount,
      ops_amount: opsAmount,
      crm_amount: crmAmount,
      owner_amount: ownerAmount,
      net_business_profit: netBusinessProfit,
    };
  }, [payoutConfig, calculatedDPP]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-EG', {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Prepare pie chart data
  const pieData = profit ? [
    { name: 'COGS', value: profit.cogs, color: '#ef4444' },
    { name: 'Expenses', value: profit.total_expenses, color: '#f59e0b' },
    { name: 'Shipping Loss', value: Math.abs(profit.shipping_loss), color: '#8b5cf6' },
    { name: 'Gross Profit', value: profit.gross_profit, color: '#10b981' },
  ].filter(item => item.value > 0) : [];

  // Prepare bar chart data
  const barData = profit ? [
    { name: 'Revenue', value: calculatedRevenue, color: '#3b82f6' },
    { name: 'COGS', value: profit.cogs, color: '#ef4444' },
    { name: 'Gross Profit', value: profit.gross_profit, color: '#10b981' },
  ] : [];

  // Combined loading state - wait for all critical data before showing numbers
  const isAllDataLoading = isLoading || ordersLoading || shippingRecordsModalLoading || configLoading || expensesModalLoading;

  return (
    <div className="space-y-6">
      {isAllDataLoading ? (
        <div className="space-y-6">
          <div className="flex justify-center items-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600 font-medium">Loading financial data...</p>
              <p className="text-sm text-gray-500 mt-2">Please wait while we calculate all metrics</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      ) : error && !error.message?.includes('not found') && !error.message?.includes('404') ? (
        <div className="text-center py-8 bg-red-50 rounded-lg border border-red-200">
          <p className="text-red-600">Error loading profit data: {error.message}</p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['monthly-profit', selectedMonth] })}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      ) : profit ? (
        <div className="space-y-6">

          {/* Key Metrics Cards - 2x2 Layout: Revenue, Expenses, Shipping Cost, DPP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {/* Revenue Box */}
            <div 
              className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setShowOrdersModal(true)}
              title="Click to view orders included in revenue"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-gray-700">Revenue</h4>
                  <EyeIcon className="w-4 h-4 text-blue-600" />
                </div>
                {previousProfit && (
                  <ComparisonBadge 
                    current={calculatedRevenue} 
                    previous={previousProfit.revenue} 
                    label="Revenue"
                  />
                )}
              </div>
              <p className="text-3xl font-bold text-blue-700">
                EGP <AnimatedNumber value={calculatedRevenue} />
              </p>
              <p className="mt-2 text-xs text-blue-600">
                Net: {formatCurrency(calculatedRevenue - calculatedShippingCost)}
              </p>
            </div>

            {/* Expenses Box */}
            <div 
              className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => {
                onNavigate?.('expenses');
              }}
              title="Click to view expenses"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-gray-700">Expenses</h4>
                  <EyeIcon 
                    className="w-4 h-4 text-red-600" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowExpensesModal(true);
                    }}
                  />
                </div>
                {previousProfit && (
                  <ComparisonBadge 
                    current={calculatedExpenses} 
                    previous={previousProfit.total_expenses ?? 0} 
                    label="Expenses"
                  />
                )}
              </div>
              <p className="text-3xl font-bold text-red-700">
                EGP <AnimatedNumber value={calculatedExpenses} />
              </p>
            </div>

            {/* Shipping Cost Box */}
            <div 
              className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => {
                onNavigate?.('shipping');
              }}
              title="Click to view shipping performance"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-gray-700">Shipping Cost</h4>
                  <EyeIcon 
                    className="w-4 h-4 text-orange-600" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowShippingCostModal(true);
                    }}
                  />
                </div>
              </div>
              <p className="text-3xl font-bold text-orange-700">
                EGP <AnimatedNumber value={calculatedShippingCost} />
              </p>
              <p className="mt-2 text-xs text-orange-600">
                Shipping Profit/Loss: {(() => {
                  if (!shippingRecordsForModal || shippingRecordsForModal.length === 0) return '-';
                  const totalCustomerCharged = shippingRecordsForModal.reduce((sum, record) => sum + record.customer_shipping_charged, 0);
                  const totalCost = shippingRecordsForModal.reduce((sum, record) => sum + record.actual_shipping_cost, 0);
                  return formatCurrency(totalCustomerCharged - totalCost);
                })()}
              </p>
            </div>

            {/* DPP Box */}
            <div 
              className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer" 
              onClick={() => onNavigate?.('payouts')}
              title="Click to view payouts"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">DPP</h4>
                {previousProfit && (
                  <ComparisonBadge 
                    current={calculatedDPP} 
                    previous={previousProfit.cash_dpp ?? previousProfit.dpp ?? 0} 
                    label="DPP"
                  />
                )}
              </div>
              <p className="text-3xl font-bold text-purple-700 mb-3">
                EGP <AnimatedNumber value={calculatedDPP} />
              </p>
              {calculatedPayouts && (
                <div className="flex flex-col gap-1.5 mt-auto">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0"></div>
                    <span className="text-xs text-gray-600 truncate">Media Buyer: {formatCurrency(calculatedPayouts.media_buyer_amount)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-600 flex-shrink-0"></div>
                    <span className="text-xs text-gray-600 truncate">Operations: {formatCurrency(calculatedPayouts.ops_amount)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-600 flex-shrink-0"></div>
                    <span className="text-xs text-gray-600 truncate">CRM: {formatCurrency(calculatedPayouts.crm_amount)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-600 flex-shrink-0"></div>
                    <span className="text-xs text-gray-600 truncate">Owner: {formatCurrency(calculatedPayouts.owner_amount)}</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-purple-300">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">Final Net Profit:</span>
                      <span className="text-sm font-bold text-emerald-700">
                        {formatCurrency(calculatedPayouts.net_business_profit)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {!calculatedPayouts && payoutConfig && (
                <p className="text-xs text-gray-500 mt-2">Loading payouts...</p>
              )}
              {!payoutConfig && (
                <p className="text-xs text-gray-500 mt-2">Configure payouts to see distribution</p>
              )}
            </div>
          </div>


          {/* Charts Section - Lazy Loaded */}
          {!showCharts ? (
            <div className="flex justify-center">
              <button
                onClick={() => setShowCharts(true)}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-sm"
              >
                Show Charts
              </button>
            </div>
          ) : (
            <>
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => setShowCharts(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Hide Charts
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue vs COGS Bar Chart */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Revenue vs COGS</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="value" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Revenue Breakdown Pie Chart */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Revenue Breakdown</h4>
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
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Trend Chart */}
              {trendData && trendData.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">6-Month Trend</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} name="Revenue" />
                      <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} name="Gross Profit" />
                      <Line type="monotone" dataKey="dpp" stroke="#8b5cf6" strokeWidth={2} name="DPP" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-600 font-medium text-lg">No profit data for {formatMonthDisplay(selectedMonth)}</p>
          <p className="mt-2 text-sm text-gray-500">Calculate profit to see financial metrics for this month.</p>
          <button
            onClick={() => calculateMutation.mutate(selectedMonth)}
            disabled={calculateMutation.isPending}
            className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {calculateMutation.isPending ? 'Calculating...' : 'Calculate Profit'}
          </button>
        </div>
      )}

      {/* Expenses Modal */}
      {showExpensesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowExpensesModal(false)}>
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 pb-4 border-b">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Expenses Included</h3>
                <p className="text-sm text-gray-500 mt-1">{formatMonthDisplay(selectedMonth)}</p>
              </div>
              <button
                onClick={() => setShowExpensesModal(false)}
                className="p-2 rounded-full bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-500 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {expensesModalLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                  <p className="mt-2 text-gray-600">Loading expenses...</p>
                </div>
              ) : !expensesForModal || expensesForModal.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">No expenses found for {formatMonthDisplay(selectedMonth)}</p>
                </div>
              ) : (() => {
                const totalAmount = expensesForModal.reduce((sum, exp) => sum + exp.amount, 0);

                return (
                  <div className="space-y-2">
                    <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-sm font-medium text-red-900">
                        Total Expenses: <span className="font-bold">{expensesForModal.length}</span>
                      </p>
                      <p className="text-sm text-red-700 mt-1">
                        Total Amount: {formatCurrency(totalAmount)}
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {expensesForModal.map((expense) => (
                            <tr key={expense.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                {format(new Date(expense.date), 'yyyy-MM-dd')}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                {expense.category}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  expense.expense_type === 'production' 
                                    ? 'bg-blue-100 text-blue-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {expense.expense_type === 'production' ? 'Production' : 'Operating'}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                                {formatCurrency(expense.amount)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                {expense.notes || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                          <tr>
                            <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                              Total:
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                              {formatCurrency(totalAmount)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Shipping Cost Modal */}
      {showShippingCostModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowShippingCostModal(false)}>
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 pb-4 border-b">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Shipping Costs Included</h3>
                <p className="text-sm text-gray-500 mt-1">{formatMonthDisplay(selectedMonth)}</p>
              </div>
              <button
                onClick={() => setShowShippingCostModal(false)}
                className="p-2 rounded-full bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-500 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {shippingRecordsModalLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                  <p className="mt-2 text-gray-600">Loading shipping records...</p>
                </div>
              ) : (() => {
                // Shipping records already include both manual records and virtual records from order tags
                // So we only need to use shippingRecordsForModal, not extract from orders separately
                const totalShippingCost = (shippingRecordsForModal || []).reduce((sum, record) => sum + record.actual_shipping_cost, 0);
                const totalCustomerCharged = (shippingRecordsForModal || []).reduce((sum, record) => sum + record.customer_shipping_charged, 0);
                const totalProfitLoss = totalCustomerCharged - totalShippingCost;

                if (!shippingRecordsForModal || shippingRecordsForModal.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <p className="text-gray-600">No shipping costs found for {formatMonthDisplay(selectedMonth)}</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <p className="text-sm font-medium text-orange-900">
                        Total Orders: <span className="font-bold">{(shippingRecordsForModal || []).length}</span>
                      </p>
                      <p className="text-sm font-medium text-orange-900 mt-1">
                        Total Shipping Cost: {formatCurrency(totalShippingCost)}
                      </p>
                      <p className="text-sm text-orange-700 mt-1">
                        Customer Charged: {formatCurrency(totalCustomerCharged)} | Profit/Loss: {formatCurrency(totalProfitLoss)}
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order/Invoice</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Charged</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actual Cost</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Profit/Loss</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {(shippingRecordsForModal || []).map((record) => {
                            const isCancelled = record.status === 'Cancelled';
                            const profitLoss = record.customer_shipping_charged - record.actual_shipping_cost;
                            
                            return (
                              <tr key={record.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                  {format(new Date(record.date), 'yyyy-MM-dd')}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {record.order_id ? `Order #${record.order_id}` : record.invoice_id ? `Invoice: ${record.invoice_id}` : 'Manual Entry'}
                                  {isCancelled && (
                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                      Cancelled
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                  {record.type}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700">
                                  {record.customer_shipping_charged > 0 ? formatCurrency(record.customer_shipping_charged) : '-'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                                  {formatCurrency(record.actual_shipping_cost)}
                                </td>
                                <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-semibold ${
                                  profitLoss >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {formatCurrency(profitLoss)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                          <tr>
                            <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                              Total:
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                              {formatCurrency(totalCustomerCharged)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                              {formatCurrency(totalShippingCost)}
                            </td>
                            <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-bold ${
                              totalProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {formatCurrency(totalProfitLoss)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Orders Modal */}
      {showOrdersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowOrdersModal(false)}>
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 pb-4 border-b">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Orders Included in Revenue</h3>
                <p className="text-sm text-gray-500 mt-1">{formatMonthDisplay(selectedMonth)}</p>
              </div>
              <button
                onClick={() => setShowOrdersModal(false)}
                className="p-2 rounded-full bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-500 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {ordersLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-600">Loading orders...</p>
                </div>
              ) : fulfilledOrders && fulfilledOrders.length > 0 ? (
                <div className="space-y-2">
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm font-medium text-blue-900">
                      Total Orders: <span className="font-bold">{fulfilledOrders.length}</span>
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      Total Revenue: {formatCurrency((fulfilledOrders || []).reduce((sum: number, order: any) => {
                        const tags = Array.isArray(order.tags) ? order.tags : typeof order.tags === 'string' ? order.tags.split(',').map((t: string) => t.trim()) : [];
                        const isCancelled = tags.some((tag: string) => tag.trim().toLowerCase() === 'cancelled');
                        // Cancelled orders don't contribute to revenue (we didn't receive money)
                        return sum + (isCancelled ? 0 : parseFloat(order.total_price || '0'));
                      }, 0))}
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th 
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => {
                              if (sortField === 'order') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('order');
                                setSortDirection('asc');
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              Order
                              {sortField === 'order' && (
                                sortDirection === 'asc' ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />
                              )}
                            </div>
                          </th>
                          <th 
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => {
                              if (sortField === 'customer') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('customer');
                                setSortDirection('asc');
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              Customer
                              {sortField === 'customer' && (
                                sortDirection === 'asc' ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />
                              )}
                            </div>
                          </th>
                          <th 
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => {
                              if (sortField === 'date') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('date');
                                setSortDirection('desc');
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              Date
                              {sortField === 'date' && (
                                sortDirection === 'asc' ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />
                              )}
                            </div>
                          </th>
                          <th 
                            className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => {
                              if (sortField === 'total') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('total');
                                setSortDirection('desc');
                              }
                            }}
                          >
                            <div className="flex items-center justify-end gap-1">
                              Price
                              {sortField === 'total' && (
                                sortDirection === 'asc' ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />
                              )}
                            </div>
                          </th>
                          <th 
                            className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => {
                              if (sortField === 'status') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('status');
                                setSortDirection('asc');
                              }
                            }}
                          >
                            <div className="flex items-center justify-center gap-1">
                              Status
                              {sortField === 'status' && (
                                sortDirection === 'asc' ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />
                              )}
                            </div>
                          </th>
                          <th 
                            className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => {
                              if (sortField === 'shipping') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('shipping');
                                setSortDirection('desc');
                              }
                            }}
                          >
                            <div className="flex items-center justify-end gap-1">
                              Shipping
                              {sortField === 'shipping' && (
                                sortDirection === 'asc' ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />
                              )}
                            </div>
                          </th>
                          <th 
                            className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => {
                              if (sortField === 'net') {
                                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortField('net');
                                setSortDirection('desc');
                              }
                            }}
                          >
                            <div className="flex items-center justify-end gap-1">
                              Net
                              {sortField === 'net' && (
                                sortDirection === 'asc' ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />
                              )}
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {(sortedOrders || []).map((order: any) => {
                          const tags = Array.isArray(order.tags) 
                            ? order.tags 
                            : typeof order.tags === 'string' 
                              ? order.tags.split(',').map((t: string) => t.trim())
                              : [];
                          // Get paid_date - ONLY use paid_date, no fallback
                          const paidDateTag = tags.find((tag: string) => tag.trim().startsWith('paid_date:'));
                          const fulfilledDate = paidDateTag 
                            ? paidDateTag.split(':')[1]?.trim() 
                            : order.created_at 
                              ? format(new Date(order.created_at), 'yyyy-MM-dd')
                              : 'N/A';

                          // Check if order is cancelled
                          const isCancelled = tags.some((tag: string) => 
                            tag.trim().toLowerCase() === 'cancelled'
                          );

                          // Get actual shipping cost from tags
                          let actualShippingCost = 0;
                          const scooterCostTag = tags.find((tag: string) => 
                            tag.trim().startsWith('scooter_shipping_cost:')
                          );
                          const companyCostTag = tags.find((tag: string) => 
                            tag.trim().startsWith('shipping_company_cost:')
                          );
                          
                          if (scooterCostTag) {
                            actualShippingCost = parseFloat(scooterCostTag.split(':')[1]?.trim() || '0');
                          } else if (companyCostTag) {
                            actualShippingCost = parseFloat(companyCostTag.split(':')[1]?.trim() || '0');
                          }

                          // For cancelled orders: we didn't receive money, so revenue = 0
                          // Net = 0 - shipping cost = negative (loss)
                          // For delivered orders: Net = Total Price - Shipping Cost
                          const totalPrice = isCancelled ? 0 : parseFloat(order.total_price || '0');
                          const net = totalPrice - actualShippingCost;

                          return (
                            <tr key={order.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                {order.name}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                {order.customer?.first_name} {order.customer?.last_name}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                {fulfilledDate}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                                {isCancelled ? (
                                  <span className="text-gray-400">-</span>
                                ) : (
                                  formatCurrency(totalPrice)
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-center">
                                {isCancelled ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    Cancelled
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    Delivered
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700">
                                {actualShippingCost > 0 ? formatCurrency(actualShippingCost) : '-'}
                              </td>
                              <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-semibold ${
                                net < 0 ? 'text-red-600' : 'text-gray-900'
                              }`}>
                                {formatCurrency(net)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                        <tr>
                          <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                            Total:
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                            {formatCurrency((sortedOrders || []).reduce((sum: number, order: any) => {
                              const tags = Array.isArray(order.tags) ? order.tags : typeof order.tags === 'string' ? order.tags.split(',').map((t: string) => t.trim()) : [];
                              const isCancelled = tags.some((tag: string) => tag.trim().toLowerCase() === 'cancelled');
                              return sum + (isCancelled ? 0 : parseFloat(order.total_price || '0'));
                            }, 0))}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-semibold text-gray-900">
                            -
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                            {formatCurrency((sortedOrders || []).reduce((sum: number, order: any) => {
                              const tags = Array.isArray(order.tags) ? order.tags : typeof order.tags === 'string' ? order.tags.split(',').map((t: string) => t.trim()) : [];
                              let shippingCost = 0;
                              const scooterCostTag = tags.find((tag: string) => tag.trim().startsWith('scooter_shipping_cost:'));
                              const companyCostTag = tags.find((tag: string) => tag.trim().startsWith('shipping_company_cost:'));
                              if (scooterCostTag) {
                                shippingCost = parseFloat(scooterCostTag.split(':')[1]?.trim() || '0');
                              } else if (companyCostTag) {
                                shippingCost = parseFloat(companyCostTag.split(':')[1]?.trim() || '0');
                              }
                              return sum + shippingCost;
                            }, 0))}
                          </td>
                          <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-bold ${
                            (() => {
                              const totalNet = (sortedOrders || []).reduce((sum: number, order: any) => {
                                const tags = Array.isArray(order.tags) ? order.tags : typeof order.tags === 'string' ? order.tags.split(',').map((t: string) => t.trim()) : [];
                                const isCancelled = tags.some((tag: string) => tag.trim().toLowerCase() === 'cancelled');
                                const totalPrice = isCancelled ? 0 : parseFloat(order.total_price || '0');
                                let shippingCost = 0;
                                const scooterCostTag = tags.find((tag: string) => tag.trim().startsWith('scooter_shipping_cost:'));
                                const companyCostTag = tags.find((tag: string) => tag.trim().startsWith('shipping_company_cost:'));
                                if (scooterCostTag) {
                                  shippingCost = parseFloat(scooterCostTag.split(':')[1]?.trim() || '0');
                                } else if (companyCostTag) {
                                  shippingCost = parseFloat(companyCostTag.split(':')[1]?.trim() || '0');
                                }
                                return sum + (totalPrice - shippingCost);
                              }, 0);
                              return totalNet < 0 ? 'text-red-600' : 'text-gray-900';
                            })()
                          }`}>
                            {formatCurrency((sortedOrders || []).reduce((sum: number, order: any) => {
                              const tags = Array.isArray(order.tags) ? order.tags : typeof order.tags === 'string' ? order.tags.split(',').map((t: string) => t.trim()) : [];
                              const isCancelled = tags.some((tag: string) => tag.trim().toLowerCase() === 'cancelled');
                              const totalPrice = isCancelled ? 0 : parseFloat(order.total_price || '0');
                              let shippingCost = 0;
                              const scooterCostTag = tags.find((tag: string) => tag.trim().startsWith('scooter_shipping_cost:'));
                              const companyCostTag = tags.find((tag: string) => tag.trim().startsWith('shipping_company_cost:'));
                              if (scooterCostTag) {
                                shippingCost = parseFloat(scooterCostTag.split(':')[1]?.trim() || '0');
                              } else if (companyCostTag) {
                                shippingCost = parseFloat(companyCostTag.split(':')[1]?.trim() || '0');
                              }
                              return sum + (totalPrice - shippingCost);
                            }, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600">No fulfilled orders found for {formatMonthDisplay(selectedMonth)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
