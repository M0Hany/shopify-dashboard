import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import ProfitOverviewTab from "../components/finance/ProfitOverviewTab";
import ProductMarginsTab from "../components/finance/ProductMarginsTab";
import ShippingPerformanceTab from "../components/finance/ShippingPerformanceTab";
import FinancialExpensesTab from "../components/finance/FinancialExpensesTab";
import PayoutsTab from "../components/finance/PayoutsTab";
import FinancialSettingsTab from "../components/finance/FinancialSettingsTab";

type TabType = 'profit-overview' | 'expenses' | 'shipping' | 'payouts' | 'product-margins' | 'settings';

export default function Finance() {
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState<TabType>('profit-overview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

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

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 md:px-8">
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg border border-gray-200 p-6 sm:p-8">
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
