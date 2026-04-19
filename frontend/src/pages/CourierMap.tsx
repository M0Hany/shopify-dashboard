import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { OrdersMapPanel } from '../components/OrdersMapPanel';
import type { OrderForMapSummary } from '../utils/orderMapSummary';
import { COURIER_ASSIGNED_TAG, getMapShippingRouteGroupKey, normalizeOrderTagsArray } from '../utils/shippingRouteTags';

type CourierOrder = OrderForMapSummary;

export default function CourierMap() {
  const queryClient = useQueryClient();
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);

  const { data: orders = [], isLoading, error } = useQuery<CourierOrder[]>({
    queryKey: ['orders'],
    queryFn: async (): Promise<CourierOrder[]> => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/orders`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      return response.json();
    },
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => undefined,
      {
        enableHighAccuracy: true,
        maximumAge: 15000,
        timeout: 20000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const updateTagsMutation = useMutation({
    mutationFn: async ({ orderId, newTags }: { orderId: number; newTags: string[] }) => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${orderId}/tags`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tags: newTags }),
      });
      if (!response.ok) {
        throw new Error('Failed to update tags');
      }
      return response.json();
    },
    onMutate: async ({ orderId, newTags }) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      const previous = queryClient.getQueryData<CourierOrder[]>(['orders']);
      queryClient.setQueryData<CourierOrder[] | undefined>(['orders'], (current) => {
        if (!current) return current;
        return current.map((order) => (order.id === orderId ? { ...order, tags: newTags } : order));
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['orders'], context.previous);
    },
  });

  const courierOrders = useMemo(() => {
    return orders
      .filter((order) => {
        const tags = normalizeOrderTagsArray(order.tags);
        const hasCourierTag = tags.some((tag) => tag.trim().toLowerCase() === COURIER_ASSIGNED_TAG);
        const isMarked = tags.some((tag) => {
          const normalized = tag.trim().toLowerCase();
          return normalized === 'mark' || normalized === 'marked';
        });
        return hasCourierTag && !isMarked && !!getMapShippingRouteGroupKey(order);
      })
      .sort((a, b) => a.id - b.id);
  }, [orders]);

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-600">Loading courier map...</div>;
  }

  if (error) {
    return <div className="p-6 text-sm text-red-600">Failed to load courier map.</div>;
  }

  return (
    <div className="p-2 sm:p-8 max-w-[1600px] mx-auto w-full space-y-3">
      <div className="max-w-7xl mx-auto w-full rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Courier Map</h2>
        <p className="mt-1 text-sm text-gray-600">
          Read-only view of routes assigned to the courier.
        </p>
      </div>

      <OrdersMapPanel
        orders={courierOrders}
        onReplaceShippingRouteForOrder={async () => undefined}
        selectedOrderIds={[]}
        readOnly
        currentLocation={currentLocation}
        mapOrderCardProps={{
          onUpdateTags: (orderId, newTags) => {
            updateTagsMutation.mutate({ orderId, newTags });
          },
        }}
      />
    </div>
  );
}
