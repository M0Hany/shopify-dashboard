import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { financialService, ProductCost } from '../../services/financialService';
import { format } from 'date-fns';
import { 
  MagnifyingGlassIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  FunnelIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { SkeletonTable } from '../common/SkeletonLoader';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import toast from 'react-hot-toast';

interface ProductMarginData {
  product_id: string;
  product_name: string;
  cost_per_unit: number;
  average_selling_price: number;
  margin_percent: number;
  units_sold: number;
  total_revenue: number;
  total_cost: number;
}

type SortField = 'product_name' | 'margin_percent' | 'units_sold' | 'total_revenue' | 'average_selling_price';
type SortDirection = 'asc' | 'desc';

interface ProductMarginsTabProps {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  onBack: () => void;
}

export default function ProductMarginsTab({ selectedMonth, setSelectedMonth, onBack }: ProductMarginsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('margin_percent');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [marginRange, setMarginRange] = useState<[number, number]>([0, 100]);
  const [showFilters, setShowFilters] = useState(false);

  const { data: productCosts, isLoading: costsLoading } = useQuery({
    queryKey: ['product-costs'],
    queryFn: () => financialService.getProductCosts(),
  });

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/orders`);
      if (!response.ok) throw new Error('Failed to fetch orders');
      return response.json();
    },
  });

  // Calculate product margins
  const calculateMargins = (): ProductMarginData[] => {
    if (!orders || !productCosts) return [];

    const fulfilledOrders = orders.filter((order: any) => {
      const tags = Array.isArray(order.tags)
        ? order.tags
        : typeof order.tags === 'string'
          ? order.tags.split(',').map((t: string) => t.trim())
          : [];

      // Use 'paid' tag - ONLY use paid tag, no fallback
      const isPaid = tags.some((tag: string) => tag.trim().toLowerCase() === 'paid');
      const isCancelled = tags.some((tag: string) => tag.trim().toLowerCase() === 'cancelled');
      if (!isPaid || isCancelled) return false;

      // Get paid_date - ONLY use paid_date, no fallback
      const paidDateTag = tags.find((tag: string) => tag.trim().startsWith('paid_date:'));
      if (!paidDateTag) return false;
      
      const dateStr = paidDateTag.split(':')[1]?.trim();
      if (dateStr) {
        const orderMonth = dateStr.substring(0, 7);
        return orderMonth === selectedMonth;
      }
      return false;
    });

    const productMap = new Map<string, {
      product_id: string;
      product_name: string;
      total_quantity: number;
      total_revenue: number;
      items: Array<{ price: number; quantity: number }>;
    }>();

    fulfilledOrders.forEach((order: any) => {
      if (order.line_items && Array.isArray(order.line_items)) {
        order.line_items.forEach((item: any) => {
          let productId = item.product_id?.toString() || item.variant_id?.toString() || '';
          let productCost: ProductCost | undefined;

          if (productId) {
            productCost = productCosts.find((pc: ProductCost) => pc.product_id === productId);
          }

          if (!productCost && item.title) {
            productCost = productCosts.find((pc: ProductCost) => 
              pc.product_name.toLowerCase().includes(item.title.toLowerCase()) ||
              item.title.toLowerCase().includes(pc.product_name.toLowerCase())
            );
            if (productCost) {
              productId = productCost.product_id;
            }
          }

          if (!productCost) return;

          const itemPrice = parseFloat(item.price || '0');
          const quantity = item.quantity || 0;

          if (!productMap.has(productId)) {
            productMap.set(productId, {
              product_id: productId,
              product_name: productCost.product_name,
              total_quantity: 0,
              total_revenue: 0,
              items: [],
            });
          }

          const productData = productMap.get(productId)!;
          productData.total_quantity += quantity;
          productData.total_revenue += itemPrice * quantity;
          productData.items.push({ price: itemPrice, quantity });
        });
      }
    });

    const margins: ProductMarginData[] = Array.from(productMap.values()).map((data) => {
      const productCost = productCosts.find((pc: ProductCost) => pc.product_id === data.product_id);
      if (!productCost) return null;

      const costPerUnit = productCost.total_unit_cost;
      const totalCost = costPerUnit * data.total_quantity;
      const averageSellingPrice = data.total_quantity > 0 ? data.total_revenue / data.total_quantity : 0;
      const marginPercent = averageSellingPrice > 0
        ? ((averageSellingPrice - costPerUnit) / averageSellingPrice) * 100
        : 0;

      return {
        product_id: data.product_id,
        product_name: data.product_name,
        cost_per_unit: costPerUnit,
        average_selling_price: averageSellingPrice,
        margin_percent: marginPercent,
        units_sold: data.total_quantity,
        total_revenue: data.total_revenue,
        total_cost: totalCost,
      };
    }).filter((m): m is ProductMarginData => m !== null);

    return margins;
  };

  const allMargins = useMemo(() => calculateMargins(), [orders, productCosts, selectedMonth]);

  // Filter and sort margins
  const filteredAndSortedMargins = useMemo(() => {
    let filtered = allMargins.filter(margin => {
      const matchesSearch = margin.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           margin.product_id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMarginRange = margin.margin_percent >= marginRange[0] && margin.margin_percent <= marginRange[1];
      return matchesSearch && matchesMarginRange;
    });

    // Sort
    filtered.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case 'product_name':
          aVal = a.product_name;
          bVal = b.product_name;
          break;
        case 'margin_percent':
          aVal = a.margin_percent;
          bVal = b.margin_percent;
          break;
        case 'units_sold':
          aVal = a.units_sold;
          bVal = b.units_sold;
          break;
        case 'total_revenue':
          aVal = a.total_revenue;
          bVal = b.total_revenue;
          break;
        case 'average_selling_price':
          aVal = a.average_selling_price;
          bVal = b.average_selling_price;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return filtered;
  }, [allMargins, searchQuery, marginRange, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' 
      ? <ArrowUpIcon className="h-4 w-4 inline ml-1" />
      : <ArrowDownIcon className="h-4 w-4 inline ml-1" />;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-EG', {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatMonthDisplay = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return format(date, 'MMMM yyyy');
  };

  const exportToCSV = () => {
    const headers = ['Product Name', 'Product ID', 'Cost/Unit', 'Avg Price', 'Margin %', 'Units Sold', 'Total Revenue', 'Total Cost', 'Profit'];
    const rows = filteredAndSortedMargins.map(m => [
      m.product_name,
      m.product_id,
      m.cost_per_unit.toFixed(2),
      m.average_selling_price.toFixed(2),
      m.margin_percent.toFixed(1),
      m.units_sold,
      m.total_revenue.toFixed(2),
      m.total_cost.toFixed(2),
      (m.total_revenue - m.total_cost).toFixed(2),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-margins-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  };

  // Prepare chart data
  const chartData = filteredAndSortedMargins.slice(0, 10).map(m => ({
    name: m.product_name.length > 15 ? m.product_name.substring(0, 15) + '...' : m.product_name,
    margin: m.margin_percent,
    revenue: m.total_revenue,
  }));

  const getMarginColor = (margin: number) => {
    if (margin >= 50) return '#10b981';
    if (margin >= 30) return '#3b82f6';
    if (margin >= 10) return '#f59e0b';
    return '#ef4444';
  };

  if (costsLoading || ordersLoading) {
    return (
      <div className="space-y-6">
        <SkeletonTable />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900">Product Margins</h3>
        <p className="text-sm text-gray-500 mt-1">Analyze profitability by product for {formatMonthDisplay(selectedMonth)}</p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
              showFilters 
                ? 'bg-blue-50 border-blue-300 text-blue-700' 
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FunnelIcon className="h-5 w-5" />
            Filters
          </button>
          <button
            onClick={exportToCSV}
            disabled={filteredAndSortedMargins.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            Export CSV
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Margin Range: {marginRange[0]}% - {marginRange[1]}%
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={marginRange[0]}
                onChange={(e) => setMarginRange([parseInt(e.target.value), marginRange[1]])}
                className="flex-1"
              />
              <input
                type="range"
                min="0"
                max="100"
                value={marginRange[1]}
                onChange={(e) => setMarginRange([marginRange[0], parseInt(e.target.value)])}
                className="flex-1"
              />
            </div>
          </div>
        )}
      </div>

      {filteredAndSortedMargins.length > 0 ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg p-6">
              <h4 className="text-sm font-medium text-gray-700">Products</h4>
              <p className="mt-2 text-3xl font-bold text-blue-700">
                {filteredAndSortedMargins.length}
              </p>
            </div>
            <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
              <h4 className="text-sm font-medium text-gray-500">Total Units</h4>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {filteredAndSortedMargins.reduce((sum, m) => sum + m.units_sold, 0)}
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-lg p-6">
              <h4 className="text-sm font-medium text-gray-700">Avg Margin</h4>
              <p className="mt-2 text-3xl font-bold text-green-700">
                {filteredAndSortedMargins.length > 0
                  ? (filteredAndSortedMargins.reduce((sum, m) => sum + m.margin_percent, 0) / filteredAndSortedMargins.length).toFixed(1)
                  : '0.0'}%
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-lg p-6">
              <h4 className="text-sm font-medium text-gray-700">Total Profit</h4>
              <p className="mt-2 text-3xl font-bold text-purple-700">
                {formatCurrency(filteredAndSortedMargins.reduce((sum, m) => sum + (m.total_revenue - m.total_cost), 0))}
              </p>
            </div>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Products by Margin</h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  <Bar dataKey="margin">
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getMarginColor(entry.margin)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Margins Table */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('product_name')}
                    >
                      Product <SortIcon field="product_name" />
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost/Unit</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Price</th>
                    <th 
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('margin_percent')}
                    >
                      Margin % <SortIcon field="margin_percent" />
                    </th>
                    <th 
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('units_sold')}
                    >
                      Units <SortIcon field="units_sold" />
                    </th>
                    <th 
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('total_revenue')}
                    >
                      Revenue <SortIcon field="total_revenue" />
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Profit</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAndSortedMargins.map((margin) => (
                    <tr key={margin.product_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{margin.product_name}</div>
                        <div className="text-xs text-gray-500">ID: {margin.product_id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {formatCurrency(margin.cost_per_unit)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {formatCurrency(margin.average_selling_price)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${
                        margin.margin_percent >= 50 ? 'text-green-600' :
                        margin.margin_percent >= 30 ? 'text-blue-600' :
                        margin.margin_percent >= 10 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {margin.margin_percent.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {margin.units_sold}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">
                        {formatCurrency(margin.total_revenue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                        {formatCurrency(margin.total_cost)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${
                        (margin.total_revenue - margin.total_cost) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(margin.total_revenue - margin.total_cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 font-semibold">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Total</td>
                    <td colSpan={3} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {filteredAndSortedMargins.reduce((sum, m) => sum + m.units_sold, 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(filteredAndSortedMargins.reduce((sum, m) => sum + m.total_revenue, 0))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {formatCurrency(filteredAndSortedMargins.reduce((sum, m) => sum + m.total_cost, 0))}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${
                      filteredAndSortedMargins.reduce((sum, m) => sum + (m.total_revenue - m.total_cost), 0) >= 0
                        ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(filteredAndSortedMargins.reduce((sum, m) => sum + (m.total_revenue - m.total_cost), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-600 font-medium text-lg">No product margin data found</p>
          <p className="mt-2 text-sm text-gray-500">
            {searchQuery || marginRange[0] > 0 || marginRange[1] < 100
              ? 'Try adjusting your search or filters.'
              : !productCosts || productCosts.length === 0
              ? 'Configure product costs in Settings first.'
              : 'No fulfilled orders found for this month, or product costs are not configured for the products sold.'}
          </p>
        </div>
      )}
    </div>
  );
}
