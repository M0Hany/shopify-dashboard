import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import ProfitOverviewTab from "../components/finance/ProfitOverviewTab";
import ProductMarginsTab from "../components/finance/ProductMarginsTab";
import ShippingPerformanceTab from "../components/finance/ShippingPerformanceTab";
import FinancialExpensesTab from "../components/finance/FinancialExpensesTab";
import PayoutsTab from "../components/finance/PayoutsTab";
import FinancialSettingsTab from "../components/finance/FinancialSettingsTab";
import { 
  ArrowTrendingUpIcon, 
  CurrencyDollarIcon, 
  TruckIcon, 
  BanknotesIcon, 
  CubeIcon, 
  Cog6ToothIcon,
  ArrowPathIcon,
  PlusIcon
} from "@heroicons/react/24/outline";
import MonthNavigator from "../components/finance/MonthNavigator";

type TabType = 'profit-overview' | 'expenses' | 'shipping' | 'payouts' | 'product-margins' | 'settings';

const tabOptions = [
  { value: 'profit-overview', label: 'Profit Overview', icon: ArrowTrendingUpIcon, color: 'emerald' },
  { value: 'expenses', label: 'Expenses', icon: CurrencyDollarIcon, color: 'orange' },
  { value: 'shipping', label: 'Shipping', icon: TruckIcon, color: 'blue' },
  { value: 'payouts', label: 'Payouts', icon: BanknotesIcon, color: 'indigo' },
  { value: 'product-margins', label: 'Product Margins', icon: CubeIcon, color: 'purple' },
  { value: 'settings', label: 'Settings', icon: Cog6ToothIcon, color: 'gray' },
];

const getTabIcon = (tabValue: string, className: string) => {
  const tab = tabOptions.find(t => t.value === tabValue);
  if (!tab) return <ArrowTrendingUpIcon className={className} />;
  const IconComponent = tab.icon;
  return <IconComponent className={className} />;
};

const getButtonStyles = (tabValue: string, isActive: boolean) => {
  const tab = tabOptions.find(t => t.value === tabValue);
  if (!tab) return { bg: 'bg-transparent', icon: 'text-gray-400' };
  
  if (isActive) {
    switch (tab.color) {
      case 'emerald':
        return { bg: '#10b981', icon: 'text-white' };
      case 'orange':
        return { bg: '#f97316', icon: 'text-white' };
      case 'blue':
        return { bg: '#3b82f6', icon: 'text-white' };
      case 'indigo':
        return { bg: '#6366f1', icon: 'text-white' };
      case 'purple':
        return { bg: '#a855f7', icon: 'text-white' };
      case 'gray':
        return { bg: '#4b5563', icon: 'text-white' };
      default:
        return { bg: '#4b5563', icon: 'text-white' };
    }
  } else {
    switch (tab.color) {
      case 'emerald':
        return { bg: 'transparent', icon: 'text-emerald-500' };
      case 'orange':
        return { bg: 'transparent', icon: 'text-orange-500' };
      case 'blue':
        return { bg: 'transparent', icon: 'text-blue-500' };
      case 'indigo':
        return { bg: 'transparent', icon: 'text-indigo-500' };
      case 'purple':
        return { bg: 'transparent', icon: 'text-purple-500' };
      case 'gray':
        return { bg: 'transparent', icon: 'text-gray-400' };
      default:
        return { bg: 'transparent', icon: 'text-gray-400' };
    }
  }
};

export default function Finance() {
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState<TabType>('profit-overview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);

  // Invalidate all finance-related queries on first mount to ensure fresh data
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['monthly-profit'] });
    queryClient.invalidateQueries({ queryKey: ['monthly-payout'] });
    queryClient.invalidateQueries({ queryKey: ['financial-expenses'] });
    queryClient.invalidateQueries({ queryKey: ['shipping-records'] });
    queryClient.invalidateQueries({ queryKey: ['product-costs'] });
    queryClient.invalidateQueries({ queryKey: ['payout-config'] });
    queryClient.invalidateQueries({ queryKey: ['profit-trend'] });
    queryClient.invalidateQueries({ queryKey: ['fulfilled-orders'] });
    queryClient.invalidateQueries({ queryKey: ['shipping-orders'] });
    queryClient.invalidateQueries({ queryKey: ['shipping-data-from-tags'] });
  }, []); // Only run on mount

  const handleNavigate = (tab: TabType) => {
    setSelectedTab(tab);
  };

  const handleBack = () => {
    setSelectedTab('profit-overview');
  };

  const handleRefresh = async () => {
    if (isRefreshing) return; // Prevent multiple simultaneous refreshes
    
    setIsRefreshing(true);
    try {
      // Invalidate all finance-related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['monthly-profit'] }),
        queryClient.invalidateQueries({ queryKey: ['monthly-payout'] }),
        queryClient.invalidateQueries({ queryKey: ['financial-expenses'] }),
        queryClient.invalidateQueries({ queryKey: ['shipping-records'] }),
        queryClient.invalidateQueries({ queryKey: ['product-costs'] }),
        queryClient.invalidateQueries({ queryKey: ['payout-config'] }),
        queryClient.invalidateQueries({ queryKey: ['profit-trend'] }),
        queryClient.invalidateQueries({ queryKey: ['fulfilled-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['shipping-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['shipping-data-from-tags'] }),
      ]);
    } catch (error) {
      console.error('Error refreshing finance data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAddExpense = () => {
    if (selectedTab !== 'expenses') {
      setSelectedTab('expenses');
    }
    // Open modal after a brief delay to ensure tab is mounted
    setTimeout(() => {
      setIsAddExpenseModalOpen(true);
    }, 150);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Similar to Orders.tsx */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        {/* Top Row: Month Navigator, Action Buttons */}
        <div className="px-3 sm:px-4 py-2.5 flex items-center gap-2.5 bg-gray-50/50">
          {/* Month Navigator - Full width like search bar */}
          <div className="relative flex-1 min-w-0">
            <MonthNavigator 
              selectedMonth={selectedMonth} 
              onMonthChange={setSelectedMonth}
              showDatePicker={true}
              showToday={false}
            />
          </div>

          {/* Compact Action Buttons Group */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Add Expense Button - Only show when on expenses tab or profit-overview */}
            {(selectedTab === 'expenses' || selectedTab === 'profit-overview') && (
              <button
                onClick={handleAddExpense}
                className="p-1.5 rounded-lg text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                title="Add Expense"
              >
                <PlusIcon className="w-5 h-5" />
              </button>
            )}

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              title="Refresh data"
            >
              <ArrowPathIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tab Icons - Similar to Orders.tsx filter chips */}
        <div className="px-3 sm:px-4 py-2 bg-white">
          <div className="flex items-center justify-center gap-1 flex-wrap">
            {tabOptions.map(option => {
              const isActive = selectedTab === option.value;
              const styles = getButtonStyles(option.value, isActive);
              
              // Get background color for inline style
              const getBackgroundColor = () => {
                if (isActive) {
                  switch (option.color) {
                    case 'emerald': return '#10b981';
                    case 'orange': return '#f97316';
                    case 'blue': return '#3b82f6';
                    case 'indigo': return '#6366f1';
                    case 'purple': return '#a855f7';
                    case 'gray': return '#4b5563';
                    default: return '#4b5563';
                  }
                }
                return 'transparent';
              };
              
              return (
                <button
                  key={option.value}
                  onClick={() => handleNavigate(option.value as TabType)}
                  className={`
                    flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg
                    focus:outline-none focus:ring-0
                  `}
                  style={{
                    backgroundColor: getBackgroundColor(),
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = getBackgroundColor();
                    e.currentTarget.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = getBackgroundColor();
                    e.currentTarget.style.opacity = '1';
                  }}
                  title={option.label}
                >
                  {getTabIcon(option.value, `w-5 h-5 flex-shrink-0 ${styles.icon}`)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content Area - Mobile-first padding */}
      <div className="px-3 sm:px-4 md:px-6 py-4 sm:py-6">
        {selectedTab === 'profit-overview' && (
          <ProfitOverviewTab 
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            onNavigate={handleNavigate}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
        )}
        {selectedTab === 'expenses' && (
          <FinancialExpensesTab 
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            onBack={handleBack}
            openAddModal={isAddExpenseModalOpen}
            onAddModalClose={() => setIsAddExpenseModalOpen(false)}
          />
        )}
        {selectedTab === 'shipping' && (
          <ShippingPerformanceTab 
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            onBack={handleBack}
          />
        )}
        {selectedTab === 'payouts' && (
          <PayoutsTab 
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            onBack={handleBack}
          />
        )}
        {selectedTab === 'product-margins' && (
          <ProductMarginsTab 
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            onBack={handleBack}
          />
        )}
        {selectedTab === 'settings' && (
          <FinancialSettingsTab 
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
}
