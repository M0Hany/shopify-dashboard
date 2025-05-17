import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { financeService } from '../../services/financeService';
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, subWeeks, startOfDay, endOfDay, subDays } from 'date-fns';

// Shipping costs including VAT
const SHIPPING_COSTS = {
  'Greater Cairo': 62.70,
  'Giza': 62.70,
  'Alexandria': 68.40,
  'Delta': 74.10,
  'Canal': 79.80,
  'Upper Egypt': 96.90,
  'Red Sea': 96.90,
  'Beyond': 148.20
} as const;

type ShippingZone = keyof typeof SHIPPING_COSTS;
type ShippingCost = typeof SHIPPING_COSTS[ShippingZone];

interface Order {
  id: string;
  name: string;
  total_price: string;
  tags: string[] | string;
  shipping_address?: {
    city?: string;
  };
}

interface RevenueStats {
  totalRevenue: number;
  totalShippingCost: number;
  netRevenue: number;
  orderCount: number;
  averageOrderValue: number;
  shippingZoneBreakdown: {
    [key in ShippingZone]?: {
      orders: number;
      revenue: number;
      shippingCost: number;
    }
  };
}

type DateRangePreset = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'custom';

interface DateRange {
  start: string;
  end: string;
}

export default function RevenueTab() {
  const [dateRangeType, setDateRangeType] = useState<DateRangePreset>('thisMonth');
  const [customDateRange, setCustomDateRange] = useState<DateRange>({
    start: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  const getDateRangeFromPreset = (preset: DateRangePreset): DateRange => {
    const today = new Date();
    
    switch (preset) {
      case 'today':
        return {
          start: format(startOfDay(today), 'yyyy-MM-dd'),
          end: format(endOfDay(today), 'yyyy-MM-dd')
        };
      case 'yesterday':
        const yesterday = subDays(today, 1);
        return {
          start: format(startOfDay(yesterday), 'yyyy-MM-dd'),
          end: format(endOfDay(yesterday), 'yyyy-MM-dd')
        };
      case 'thisWeek':
        return {
          start: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          end: format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        };
      case 'lastWeek':
        const lastWeek = subWeeks(today, 1);
        return {
          start: format(startOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          end: format(endOfWeek(lastWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        };
      case 'thisMonth':
        return {
          start: format(startOfMonth(today), 'yyyy-MM-dd'),
          end: format(endOfMonth(today), 'yyyy-MM-dd')
        };
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        return {
          start: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
          end: format(endOfMonth(lastMonth), 'yyyy-MM-dd')
        };
      case 'custom':
        return customDateRange;
      default:
        return {
          start: format(startOfMonth(today), 'yyyy-MM-dd'),
          end: format(endOfMonth(today), 'yyyy-MM-dd')
        };
    }
  };

  const currentDateRange = getDateRangeFromPreset(dateRangeType);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', currentDateRange],
    queryFn: () => financeService.getOrders(currentDateRange.start, currentDateRange.end)
  });

  const calculateRevenueStats = (): RevenueStats => {
    if (!orders) {
      return {
        totalRevenue: 0,
        totalShippingCost: 0,
        netRevenue: 0,
        orderCount: 0,
        averageOrderValue: 0,
        shippingZoneBreakdown: {}
      };
    }

    const stats: RevenueStats = {
      totalRevenue: 0,
      totalShippingCost: 0,
      netRevenue: 0,
      orderCount: 0,
      averageOrderValue: 0,
      shippingZoneBreakdown: {}
    };

    orders.forEach((order: Order) => {
      // Normalize tags to always be an array and ensure they're trimmed
      const tags = Array.isArray(order.tags) ? order.tags.map(t => t.trim()) :
                  typeof order.tags === 'string' ? order.tags.split(',').map((t: string) => t.trim()) :
                  [];

      if (tags.includes('fulfilled')) {
        // Get fulfillment date from tags, ensuring consistent trimming
        const fulfillmentDateTag = tags
          .find((tag: string) => tag.trim().startsWith('fulfillment_date:'));
        
        if (fulfillmentDateTag) {
          const fulfillmentDate = fulfillmentDateTag.trim().split(':')[1]?.trim();
          // Only include orders fulfilled within the date range
          if (fulfillmentDate && 
              fulfillmentDate >= currentDateRange.start && 
              fulfillmentDate <= currentDateRange.end) {
            const orderTotal = parseFloat(order.total_price);
            let shippingZone: ShippingZone = 'Beyond'; // Default to Beyond for unknown cities

            // Determine shipping zone based on city
            const city = order.shipping_address?.city?.toLowerCase() || '';
            if (city.includes('cairo') || city.includes('giza')) {
              shippingZone = 'Greater Cairo';
            } else if (city.includes('alexandria') || city.includes('alex')) {
              shippingZone = 'Alexandria';
            } else if (
              ['mansoura', 'tanta', 'damanhour', 'kafr el sheikh', 'damietta'].some(deltaCity => 
                city.includes(deltaCity)
              )
            ) {
              shippingZone = 'Delta';
            } else if (
              ['port said', 'ismailia', 'suez'].some(canalCity => 
                city.includes(canalCity)
              )
            ) {
              shippingZone = 'Canal';
            } else if (
              ['aswan', 'luxor', 'hurghada', 'sharm'].some(upperCity => 
                city.includes(upperCity)
              )
            ) {
              shippingZone = 'Upper Egypt';
            }

            const shippingCost = SHIPPING_COSTS[shippingZone];

            // Update total stats
            stats.totalRevenue += orderTotal;
            stats.totalShippingCost += shippingCost;
            stats.orderCount++;

            // Update zone breakdown
            if (!stats.shippingZoneBreakdown[shippingZone]) {
              stats.shippingZoneBreakdown[shippingZone] = {
                orders: 0,
                revenue: 0,
                shippingCost: 0
              };
            }

            stats.shippingZoneBreakdown[shippingZone]!.orders++;
            stats.shippingZoneBreakdown[shippingZone]!.revenue += orderTotal;
            stats.shippingZoneBreakdown[shippingZone]!.shippingCost += shippingCost;
          }
        }
      }
    });

    // Calculate derived stats
    stats.netRevenue = stats.totalRevenue - stats.totalShippingCost;
    stats.averageOrderValue = stats.orderCount > 0 ? stats.totalRevenue / stats.orderCount : 0;

    return stats;
  };

  const stats = calculateRevenueStats();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Revenue</h3>
        <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="date-range" className="block text-sm font-medium text-gray-700 mb-1">
              Date Range
            </label>
            <select
              id="date-range"
              value={dateRangeType}
              onChange={(e) => setDateRangeType(e.target.value as DateRangePreset)}
              className="block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm hover:border-gray-400 transition-colors duration-200"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="thisWeek">This Week</option>
              <option value="lastWeek">Last Week</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          {dateRangeType === 'custom' && (
            <>
              <div className="min-w-[160px]">
                <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  id="start-date"
                  value={customDateRange.start}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm hover:border-gray-400 transition-colors duration-200"
                />
              </div>
              <div className="min-w-[160px]">
                <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  id="end-date"
                  value={customDateRange.end}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm hover:border-gray-400 transition-colors duration-200"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white shadow-sm border border-gray-200 hover:border-gray-300 transition-colors duration-200 rounded-lg p-6">
          <h4 className="text-sm font-medium text-gray-500">Total Revenue</h4>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            EGP {stats.totalRevenue.toFixed(2)}
          </p>
        </div>
        <div className="bg-white shadow-sm border border-gray-200 hover:border-gray-300 transition-colors duration-200 rounded-lg p-6">
          <h4 className="text-sm font-medium text-gray-500">Net Revenue</h4>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            EGP {stats.netRevenue.toFixed(2)}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            After shipping costs
          </p>
        </div>
        <div className="bg-white shadow-sm border border-gray-200 hover:border-gray-300 transition-colors duration-200 rounded-lg p-6">
          <h4 className="text-sm font-medium text-gray-500">Total Orders</h4>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {stats.orderCount}
          </p>
        </div>
        <div className="bg-white shadow-sm border border-gray-200 hover:border-gray-300 transition-colors duration-200 rounded-lg p-6">
          <h4 className="text-sm font-medium text-gray-500">Average Order Value</h4>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            EGP {stats.averageOrderValue.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Shipping Zone Breakdown */}
      <div className="bg-white shadow-sm border border-gray-200 hover:border-gray-300 transition-colors duration-200 rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Shipping Zone Breakdown</h3>
        </div>
        <div className="px-6 py-5">
          <div className="flex flex-col">
            <div className="-my-2 -mx-6 overflow-x-auto">
              <div className="inline-block min-w-full py-2 align-middle px-6">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-3.5 px-3 text-left text-sm font-semibold text-gray-900 border-b border-gray-200">Zone</th>
                      <th className="py-3.5 px-3 text-right text-sm font-semibold text-gray-900 border-b border-gray-200">Orders</th>
                      <th className="py-3.5 px-3 text-right text-sm font-semibold text-gray-900 border-b border-gray-200">Revenue</th>
                      <th className="py-3.5 px-3 text-right text-sm font-semibold text-gray-900 border-b border-gray-200">Shipping Cost</th>
                      <th className="py-3.5 px-3 text-right text-sm font-semibold text-gray-900 border-b border-gray-200">Net Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {Object.entries(stats.shippingZoneBreakdown).map(([zone, data]) => (
                      <tr key={zone} className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="whitespace-nowrap py-4 px-3 text-sm text-gray-900">{zone}</td>
                        <td className="whitespace-nowrap py-4 px-3 text-sm text-right text-gray-900">{data.orders}</td>
                        <td className="whitespace-nowrap py-4 px-3 text-sm text-right text-gray-900">
                          EGP {data.revenue.toFixed(2)}
                        </td>
                        <td className="whitespace-nowrap py-4 px-3 text-sm text-right text-gray-900">
                          EGP {data.shippingCost.toFixed(2)}
                        </td>
                        <td className="whitespace-nowrap py-4 px-3 text-sm text-right text-gray-900">
                          EGP {(data.revenue - data.shippingCost).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-300">
                      <th className="py-3.5 px-3 text-left text-sm font-semibold text-gray-900">Total</th>
                      <th className="py-3.5 px-3 text-right text-sm font-semibold text-gray-900">{stats.orderCount}</th>
                      <th className="py-3.5 px-3 text-right text-sm font-semibold text-gray-900">
                        EGP {stats.totalRevenue.toFixed(2)}
                      </th>
                      <th className="py-3.5 px-3 text-right text-sm font-semibold text-gray-900">
                        EGP {stats.totalShippingCost.toFixed(2)}
                      </th>
                      <th className="py-3.5 px-3 text-right text-sm font-semibold text-gray-900">
                        EGP {stats.netRevenue.toFixed(2)}
                      </th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 