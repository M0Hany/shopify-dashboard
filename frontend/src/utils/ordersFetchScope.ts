/** Matches GET /api/orders?scope=… */
export type OrdersFetchScope = 'active' | 'all' | 'fulfilled' | 'cancelled';

export function resolveOrdersFetchScope(
  statusFilter: string,
  loadAllOrders: boolean
): OrdersFetchScope {
  if (statusFilter === 'fulfilled') return 'fulfilled';
  if (statusFilter === 'cancelled') return 'cancelled';
  if (statusFilter === 'all' && loadAllOrders) return 'all';
  return 'active';
}

export function ordersApiUrl(scope: OrdersFetchScope): string {
  return `${import.meta.env.VITE_API_URL}/api/orders?scope=${scope}`;
}
