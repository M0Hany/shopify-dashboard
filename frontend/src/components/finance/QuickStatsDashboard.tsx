import { useQuery } from '@tanstack/react-query';
import { financialService } from '../../services/financialService';
import { format } from 'date-fns';
import { 
  CurrencyDollarIcon, 
  ChartBarIcon, 
  BanknotesIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';

export default function QuickStatsDashboard() {
  const navigate = useNavigate();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const { data: profit, isLoading: profitLoading } = useQuery({
    queryKey: ['monthly-profit', currentMonth],
    queryFn: () => financialService.getMonthlyProfit(currentMonth),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 0,
  });

  const { data: payout, isLoading: payoutLoading } = useQuery({
    queryKey: ['monthly-payout', currentMonth],
    queryFn: () => financialService.getMonthlyPayout(currentMonth),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 0,
  });

  const { data: expenses } = useQuery({
    queryKey: ['expenses', currentMonth],
    queryFn: async () => {
      const allExpenses = await financialService.getExpenses();
      const monthExpenses = allExpenses.filter((exp: any) => {
        const expenseDate = new Date(exp.date);
        const expenseMonth = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}`;
        return expenseMonth === currentMonth;
      });
      return monthExpenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);
    },
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 0,
  });

  const stats = [
    {
      name: 'Revenue',
      value: profit?.revenue || 0,
      icon: CurrencyDollarIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      tab: 0,
    },
    {
      name: 'Gross Profit',
      value: profit?.gross_profit || 0,
      icon: ChartBarIcon,
      color: profit?.gross_profit && profit.gross_profit >= 0 ? 'text-green-600' : 'text-red-600',
      bgColor: profit?.gross_profit && profit.gross_profit >= 0 ? 'bg-green-50' : 'bg-red-50',
      borderColor: profit?.gross_profit && profit.gross_profit >= 0 ? 'border-green-200' : 'border-red-200',
      tab: 0,
    },
    {
      name: 'DPP',
      value: profit?.dpp || payout?.dpp || 0,
      icon: BanknotesIcon,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      tab: 4,
    },
    {
      name: 'Expenses',
      value: expenses || 0,
      icon: ArrowTrendingDownIcon,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      tab: 3,
    },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-EG', {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (profitLoading || payoutLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white shadow-sm border border-gray-200 rounded-lg p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {format(new Date(), 'MMMM yyyy')} Overview
          </h2>
          <p className="text-sm text-gray-500">Quick financial snapshot</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <button
              key={stat.name}
              onClick={() => {
                // Navigate to Finance tab and switch to the relevant tab
                navigate('/finance');
                // Use a small delay to ensure navigation happens first
                setTimeout(() => {
                  const event = new CustomEvent('switch-finance-tab', { detail: { tabIndex: stat.tab } });
                  window.dispatchEvent(event);
                }, 100);
              }}
              className={`text-left bg-white shadow-sm border-2 ${stat.borderColor} rounded-lg p-4 hover:shadow-md transition-all duration-200 hover:scale-105 cursor-pointer`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 mb-1">{stat.name}</p>
                  <p className={`text-2xl font-bold ${stat.color}`}>
                    {formatCurrency(stat.value)}
                  </p>
                </div>
                <div className={`${stat.bgColor} p-3 rounded-lg`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
