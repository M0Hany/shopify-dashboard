import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'react-hot-toast';
import { Dialog } from '@headlessui/react';
import {
  BanknotesIcon,
  ChevronDownIcon,
  DocumentArrowDownIcon,
  MapIcon,
  MapPinIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { getOrderLatLng } from '../utils/orderGeolocation';
import {
  buildDraftRoutesFromShippingTags,
  COURIER_ASSIGNED_TAG,
  normalizeOrderTagsArray,
  shippingTagRoutesFingerprint,
} from '../utils/shippingRouteTags';
import type { OrderForMapSummary } from '../utils/orderMapSummary';
import { generateShippingSlipsPdf } from '../utils/shippingSlipsPdf';
import { type OrderCardProps } from './OrderCard';
import MapOrderCard from './MapOrderCard';
import { reoptimizeStopOrder, routeRowStats } from '../utils/routeGeoUtils';

import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconRetinaUrl: iconRetina,
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

/** Fixed start point for all delivery routes (OSM + Leaflet is free). */
export const ROUTE_DEPOT = {
  lat: 29.9830676,
  lng: 31.3498779,
  mapsUrl: 'https://maps.app.goo.gl/zmr5zwZ6fJj8sWH36',
} as const;

const INITIAL_ROUTE_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#9333ea'];

function routeColorIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function routeColor(routeId: string, routeIndex: number): string {
  if (routeIndex < INITIAL_ROUTE_COLORS.length) {
    return INITIAL_ROUTE_COLORS[routeIndex];
  }

  const seed = routeColorIndex(routeId);
  const hue = seed % 360;
  const saturation = 65 + (seed % 12);
  const lightness = 42 + (seed % 10);
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

type DraftRoute = {
  id: string;
  name: string;
  orderIds: number[];
  /** When true, membership comes from Shopify `shipping_route:` tags (refreshed with orders). */
  fromTags: boolean;
};

function routePickerLists(
  routes: DraftRoute[],
  orderId: number
): { addable: { id: string; name: string }[]; removable: { id: string; name: string }[] } {
  const removable = routes.filter((r) => r.orderIds.includes(orderId)).map((r) => ({ id: r.id, name: r.name }));
  const addable = routes.filter((r) => !r.orderIds.includes(orderId)).map((r) => ({ id: r.id, name: r.name }));
  return { addable, removable };
}

function formatRouteEgp(n: number): string {
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function sameOrderIds(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function toLatLngParam(lat: number, lng: number): string {
  return `${lat},${lng}`;
}

/**
 * Fit bounds only when marker geometry actually changes — not when the parent
 * passes a new `orders` array reference (that was resetting zoom on every render).
 */
function MapFitBounds({
  points,
  fitKey,
}: {
  points: [number, number][];
  /** Stable string derived from depot + order ids/coords; effect deps on this only */
  fitKey: string;
}) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0 || !fitKey) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
    } else {
      const b = L.latLngBounds(points.map(([lat, lng]) => [lat, lng]));
      map.fitBounds(b, { padding: [40, 40], maxZoom: 17 });
    }
    // Next frame: tiles/layout after flex parent size is final
    requestAnimationFrame(() => {
      map.invalidateSize({ animate: false });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `points` omitted: new array ref every parent render; `fitKey` encodes geometry.
  }, [map, fitKey]);
  return null;
}

/** Leaflet needs this when the map lives in a flex/responsive box or after zoom. */
function MapInvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    ro.observe(el);
    const onWin = () => map.invalidateSize({ animate: false });
    window.addEventListener('resize', onWin);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onWin);
    };
  }, [map]);
  return null;
}

const depotMarkerIcon = L.divIcon({
  className: 'route-depot-marker',
  html: `<div style="width:36px;height:36px;border-radius:50%;background:#111827;color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.25);" title="Start">🏭</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -32],
});

const markedOrderMarkerIcon = L.divIcon({
  className: 'marked-order-marker',
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#f97316;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);" title="Marked delivered"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  popupAnchor: [0, -10],
});

export type OrdersMapOrderCardProps = Omit<OrderCardProps, 'order' | 'mapRoutePicker' | 'isSelected'>;

export interface OrdersMapPanelProps {
  orders: OrderForMapSummary[];
  /** Set route name to assign shipping_route (+ date) tags; null strips those tags from the order. */
  onReplaceShippingRouteForOrder: (orderId: number, routeName: string | null) => Promise<void>;
  /** Same handlers as list view — map pin popups render full OrderCard. */
  mapOrderCardProps: OrdersMapOrderCardProps;
  selectedOrderIds: number[];
  readOnly?: boolean;
  currentLocation?: { lat: number; lng: number } | null;
  onToggleCourierAssignmentRoute?: (route: { id: string; name: string; orderIds: number[] }, assign: boolean) => void | Promise<void>;
  leftColumnTopContent?: ReactNode;
}

export function OrdersMapPanel({
  orders,
  onReplaceShippingRouteForOrder,
  mapOrderCardProps,
  selectedOrderIds,
  readOnly = false,
  currentLocation = null,
  onToggleCourierAssignmentRoute,
  leftColumnTopContent,
}: OrdersMapPanelProps) {
  const [localRoutes, setLocalRoutes] = useState<DraftRoute[]>([]);
  /** Stop order overrides for routes rebuilt from Shopify tags (cleared when tag set changes). */
  const [tagRouteOverrides, setTagRouteOverrides] = useState<Record<string, number[]>>({});
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  /** Which route’s stop list is expanded in the sidebar (collapsed by default). */
  const [stopsExpandedRouteId, setStopsExpandedRouteId] = useState<string | null>(null);
  const [newRouteName, setNewRouteName] = useState('');
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const markerRefs = useRef<Record<number, L.Marker>>({});
  const [scooterCostDialogRouteId, setScooterCostDialogRouteId] = useState<string | null>(null);
  const [scooterCostInput, setScooterCostInput] = useState('');
  const [bulkPaying, setBulkPaying] = useState(false);

  const tagFingerprint = useMemo(() => shippingTagRoutesFingerprint(orders), [orders]);

  const routesFromTags = useMemo(() => buildDraftRoutesFromShippingTags(orders), [orders]);

  useEffect(() => {
    setTagRouteOverrides({});
  }, [tagFingerprint]);

  const routes = useMemo((): DraftRoute[] => {
    const tagged = routesFromTags.map((r) => ({
      id: r.id,
      name: r.name,
      orderIds: tagRouteOverrides[r.id] ?? r.orderIds,
      fromTags: true as const,
    }));
    return [...localRoutes, ...tagged];
  }, [routesFromTags, localRoutes, tagRouteOverrides]);

  const routeIdsKey = useMemo(() => routes.map((r) => r.id).join(','), [routes]);

  useEffect(() => {
    setActiveRouteId((cur) => {
      const ids = routeIdsKey.split(',').filter(Boolean);
      if (cur && ids.includes(cur)) return cur;
      return ids[0] ?? null;
    });
  }, [routeIdsKey]);

  useEffect(() => {
    const ids = routeIdsKey.split(',').filter(Boolean);
    setStopsExpandedRouteId((cur) => (cur && ids.includes(cur) ? cur : null));
  }, [routeIdsKey]);

  const geocoded = useMemo(() => {
    const list: { order: OrderForMapSummary; lat: number; lng: number }[] = [];
    for (const o of orders) {
      const ll = getOrderLatLng(o);
      if (ll) list.push({ order: o, ...ll });
    }
    return list;
  }, [orders]);

  const noLocation = useMemo(() => orders.filter((o) => !getOrderLatLng(o)), [orders]);

  const byId = useMemo(() => new Map<number, OrderForMapSummary>(orders.map((o) => [o.id, o])), [orders]);

  const routeStats = useMemo(() => {
    const m = new Map<string, ReturnType<typeof routeRowStats>>();
    for (const r of routes) {
      m.set(r.id, routeRowStats(r.orderIds, byId, ROUTE_DEPOT));
    }
    return m;
  }, [routes, byId]);

  const boundsPoints = useMemo((): [number, number][] => {
    const pts: [number, number][] = [[ROUTE_DEPOT.lat, ROUTE_DEPOT.lng]];
    if (currentLocation) pts.push([currentLocation.lat, currentLocation.lng]);
    for (const g of geocoded) pts.push([g.lat, g.lng]);
    return pts;
  }, [geocoded, currentLocation]);

  const fitBoundsKey = useMemo(() => {
    const depot = `${ROUTE_DEPOT.lat.toFixed(6)},${ROUTE_DEPOT.lng.toFixed(6)}`;
    const current = currentLocation ? `|me:${currentLocation.lat.toFixed(6)},${currentLocation.lng.toFixed(6)}` : '';
    const stops = [...geocoded]
      .sort((a, b) => a.order.id - b.order.id)
      .map((g) => `${g.order.id}:${g.lat.toFixed(6)}:${g.lng.toFixed(6)}`);
    return `${depot}${current}|${stops.join(';')}`;
  }, [geocoded, currentLocation]);

  const activeRoute = routes.find((r) => r.id === activeRouteId) ?? null;
  const scooterCostDialogRoute = routes.find((r) => r.id === scooterCostDialogRouteId) ?? null;

  const addRoute = useCallback(() => {
    if (readOnly) return;
    const name = newRouteName.trim();
    if (!name) {
      toast.error('Enter a route name');
      return;
    }
    const id = `local-${Date.now()}`;
    setLocalRoutes((prev) => [...prev, { id, name, orderIds: [], fromTags: false }]);
    setActiveRouteId(id);
    setNewRouteName('');
  }, [newRouteName, readOnly]);

  const removeRoute = useCallback((id: string) => {
    if (readOnly) return;
    if (id.startsWith('sr:')) {
      toast.error('This route comes from Shopify tags. Remove the shipping_route tag on those orders to clear it.');
      return;
    }
    setLocalRoutes((prev) => prev.filter((r) => r.id !== id));
    setActiveRouteId((cur) => (cur === id ? null : cur));
  }, [readOnly]);

  const addOrderToRoute = useCallback(
    async (routeId: string, orderId: number) => {
      if (readOnly) return;
      const r = routes.find((x) => x.id === routeId);
      if (!r || r.orderIds.includes(orderId)) return;
      try {
        await onReplaceShippingRouteForOrder(orderId, r.name);
      } catch (e) {
        const code = e instanceof Error ? e.message : '';
        if (code === 'map_route_no_orders') toast.error('No orders loaded');
        else if (code === 'map_route_order_not_found') toast.error('Order not found');
        else if (code === 'map_route_invalid_name') toast.error('Enter a route name');
        else toast.error('Could not update route tags');
        throw new Error('sync');
      }
      if (routeId.startsWith('sr:')) {
        setTagRouteOverrides((prev) => {
          const next = { ...prev };
          delete next[routeId];
          return next;
        });
      } else {
        setLocalRoutes((prev) => prev.filter((x) => x.id !== routeId));
      }
    },
    [routes, onReplaceShippingRouteForOrder, readOnly]
  );

  const reoptimizeAllRoutes = useCallback((showToast: boolean) => {
    const tagUpdates: Record<string, number[]> = {};
    const localById = new Map<string, number[]>();
    for (const r of routes) {
      if (r.orderIds.length < 2) continue;
      const next = reoptimizeStopOrder(r.orderIds, byId, ROUTE_DEPOT);
      if (sameOrderIds(next, r.orderIds)) continue;
      if (r.id.startsWith('sr:')) tagUpdates[r.id] = next;
      else localById.set(r.id, next);
    }
    const hasUpdates = Object.keys(tagUpdates).length > 0 || localById.size > 0;
    if (!hasUpdates) return false;
    if (Object.keys(tagUpdates).length > 0) {
      setTagRouteOverrides((prev) => ({ ...prev, ...tagUpdates }));
    }
    if (localById.size > 0) {
      setLocalRoutes((prev) =>
        prev.map((x) => (localById.has(x.id) ? { ...x, orderIds: localById.get(x.id)! } : x))
      );
    }
    if (showToast) {
      toast.success('Reoptimized all routes with 2+ stops (shortest path, approx.)');
    }
    return true;
  }, [routes, byId]);

  const routeOptimizationKey = useMemo(() => {
    return routes
      .map((r) => {
        const geokey = r.orderIds
          .map((oid) => {
            const o = byId.get(oid);
            const ll = o ? getOrderLatLng(o) : null;
            return ll ? `${oid}:${ll.lat.toFixed(6)},${ll.lng.toFixed(6)}` : `${oid}:na`;
          })
          .join('|');
        return `${r.id}=>${geokey}`;
      })
      .join('||');
  }, [routes, byId]);

  useEffect(() => {
    void reoptimizeAllRoutes(false);
  }, [routeOptimizationKey, reoptimizeAllRoutes]);

  const openRouteDirections = useCallback(
    (route: DraftRoute) => {
      const stopCoords = route.orderIds
        .map((oid) => {
          const order = byId.get(oid);
          return order ? getOrderLatLng(order) : null;
        })
        .filter((coord): coord is { lat: number; lng: number } => !!coord);

      if (stopCoords.length === 0) {
        toast.error('This route has no mappable stops');
        return;
      }

      const origin = toLatLngParam(ROUTE_DEPOT.lat, ROUTE_DEPOT.lng);
      const destination = toLatLngParam(
        stopCoords[stopCoords.length - 1].lat,
        stopCoords[stopCoords.length - 1].lng
      );
      const waypointCoords = stopCoords.slice(0, -1);

      const params = new URLSearchParams({
        api: '1',
        origin,
        destination,
        travelmode: 'driving',
      });

      if (waypointCoords.length > 0) {
        params.set(
          'waypoints',
          waypointCoords.map((coord) => toLatLngParam(coord.lat, coord.lng)).join('|')
        );
      }

      window.open(`https://www.google.com/maps/dir/?${params.toString()}`, '_blank', 'noopener,noreferrer');
    },
    [byId]
  );

  const downloadRouteSlipsPdf = useCallback(
    async (route: DraftRoute) => {
      const routeOrders = route.orderIds
        .map((oid) => byId.get(oid))
        .filter((order): order is OrderForMapSummary => !!order);

      if (routeOrders.length === 0) {
        toast.error('This route has no orders');
        return;
      }
      try {
        const routeSlug = route.name.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'route';
        const dateStamp = new Date().toISOString().slice(0, 10);
        await generateShippingSlipsPdf(routeOrders, `shipping-slips-${routeSlug}-${dateStamp}.pdf`);
      } catch (error) {
        console.error('Failed to generate route shipping slips PDF:', error);
        toast.error('Failed to generate route shipping slips PDF');
      }
    },
    [byId]
  );

  const focusOrderOnMap = useCallback(
    (orderId: number) => {
      const order = byId.get(orderId);
      const ll = order ? getOrderLatLng(order) : null;
      if (!ll) {
        toast.error('This order has no map coordinates');
        return;
      }
      if (mapInstance) {
        mapInstance.flyTo([ll.lat, ll.lng], Math.max(mapInstance.getZoom(), 16), { animate: true, duration: 0.6 });
      }
      markerRefs.current[orderId]?.openPopup();
    },
    [byId, mapInstance]
  );

  const applyBulkScooterPaid = useCallback(
    async (route: DraftRoute, totalCostRaw: string) => {
      if (readOnly) return;
      if (!mapOrderCardProps.onUpdateTags || !mapOrderCardProps.onUpdateStatus) {
        toast.error('Bulk payment action is not available');
        return;
      }

      const totalCost = Number(totalCostRaw);
      if (!Number.isFinite(totalCost) || totalCost <= 0) {
        toast.error('Enter a valid scooter total cost');
        return;
      }

      const routeOrders = route.orderIds
        .map((id) => byId.get(id))
        .filter((order): order is OrderForMapSummary => !!order);

      if (routeOrders.length === 0) {
        toast.error('No orders found in this route');
        return;
      }

      const perOrderCost = Number((totalCost / routeOrders.length).toFixed(2));
      const paidDate = new Date().toISOString().split('T')[0];

      setBulkPaying(true);
      try {
        for (const order of routeOrders) {
          const currentTags = normalizeOrderTagsArray(order.tags);
          const cleaned = currentTags.filter((tag) => {
            const low = tag.trim().toLowerCase();
            return (
              !low.startsWith('scooter_shipping_cost:') &&
              !low.startsWith('paid_date:') &&
              low !== COURIER_ASSIGNED_TAG
            );
          });

          const nextTags = [...cleaned, `scooter_shipping_cost:${perOrderCost}`, `paid_date:${paidDate}`];
          mapOrderCardProps.onUpdateTags(order.id, nextTags);
          mapOrderCardProps.onUpdateStatus(order.id, 'paid');
        }

        toast.success(`Marked ${routeOrders.length} order(s) as paid (${perOrderCost} each)`);
        setScooterCostDialogRouteId(null);
        setScooterCostInput('');
      } catch {
        toast.error('Failed to apply scooter payment in bulk');
      } finally {
        setBulkPaying(false);
      }
    },
    [byId, mapOrderCardProps, readOnly]
  );

  const removeStop = useCallback(
    async (routeId: string, orderId: number) => {
      if (readOnly) return;
      try {
        await onReplaceShippingRouteForOrder(orderId, null);
      } catch (e) {
        const code = e instanceof Error ? e.message : '';
        if (code === 'map_route_no_orders') toast.error('No orders loaded');
        else if (code === 'map_route_order_not_found') toast.error('Order not found');
        else toast.error('Could not update route tags');
        throw new Error('sync');
      }
      if (routeId.startsWith('sr:')) {
        setTagRouteOverrides((prev) => {
          const next = { ...prev };
          delete next[routeId];
          return next;
        });
      } else {
        setLocalRoutes((prev) => {
          const mapped = prev.map((rt) =>
            rt.id === routeId ? { ...rt, orderIds: rt.orderIds.filter((oid) => oid !== orderId) } : rt
          );
          return mapped.filter((rt) => !(rt.id === routeId && rt.orderIds.length === 0));
        });
      }
    },
    [onReplaceShippingRouteForOrder, readOnly]
  );

  const isRouteAssignedToCourier = useCallback(
    (route: DraftRoute) => {
      if (route.orderIds.length === 0) return false;
      return route.orderIds.every((id) => {
        const order = byId.get(id);
        if (!order) return false;
        return normalizeOrderTagsArray(order.tags).some((tag) => tag.trim().toLowerCase() === COURIER_ASSIGNED_TAG);
      });
    },
    [byId]
  );

  const isOrderMarkedDelivered = useCallback((order: OrderForMapSummary): boolean => {
    return normalizeOrderTagsArray(order.tags).some((tag) => {
      const normalized = tag.trim().toLowerCase();
      return normalized === 'mark' || normalized === 'marked';
    });
  }, []);

  return (
    <div className="flex flex-col md:flex-row gap-3 min-h-0">
      <aside className="order-2 md:order-1 w-full md:w-[min(100%,20rem)] shrink-0 flex flex-col gap-3 md:max-h-[min(80vh,720px)] md:overflow-y-auto pr-0.5">
        {leftColumnTopContent ? leftColumnTopContent : null}

        {!readOnly ? (
          <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex gap-2">
              <input
                type="text"
                value={newRouteName}
                onChange={(e) => setNewRouteName(e.target.value)}
                placeholder="Route name"
                className="flex-1 min-w-0 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <button
                type="button"
                onClick={addRoute}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-gray-900 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
              >
                <PlusIcon className="h-4 w-4" aria-hidden />
                Add
              </button>
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 shadow-sm overflow-hidden">
          {routes.length === 0 ? (
            <p className="p-3 text-sm text-gray-500">
              No routes in this view. Add tags like <span className="font-mono text-[11px]">shipping_route:Name</span> on orders, or create a new route with Add.
            </p>
          ) : (
            routes.map((r, routeIndex) => {
              const color = routeColor(r.id, routeIndex);
              const isActive = r.id === activeRouteId;
              const stats = routeStats.get(r.id);
              const isCourierAssigned = isRouteAssignedToCourier(r);
              return (
                <div key={r.id} className={isActive ? 'bg-blue-50/50' : ''}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveRouteId(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveRouteId(r.id);
                      }
                    }}
                    className="w-full px-3 pt-2.5 pb-1 text-left cursor-pointer hover:bg-gray-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400/40"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
                        style={{ backgroundColor: color }}
                        aria-hidden
                      />
                      <span className="flex-1 min-w-0 truncate text-sm font-medium text-gray-900">{r.name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRouteDirections(r);
                        }}
                        className="shrink-0 rounded-md border border-blue-200 bg-blue-50 p-1 text-blue-700 hover:bg-blue-100"
                        title="Open route directions in Google Maps"
                      >
                        <MapIcon className="h-3.5 w-3.5" />
                      </button>
                      {!readOnly ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setScooterCostDialogRouteId(r.id);
                            setScooterCostInput('');
                          }}
                          className="shrink-0 rounded-md border border-amber-200 bg-amber-50 p-1 text-amber-700 hover:bg-amber-100"
                          title="Set bulk scooter payment and mark route paid"
                        >
                          <BanknotesIcon className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadRouteSlipsPdf(r);
                        }}
                        className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 p-1 text-emerald-700 hover:bg-emerald-100"
                        title="Download shipping slips PDF for this route"
                      >
                        <DocumentArrowDownIcon className="h-3.5 w-3.5" />
                      </button>
                      {!readOnly && onToggleCourierAssignmentRoute ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void onToggleCourierAssignmentRoute(
                              { id: r.id, name: r.name, orderIds: r.orderIds },
                              !isCourierAssigned
                            );
                          }}
                          className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium ${
                            isCourierAssigned
                              ? 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                          }`}
                          title={isCourierAssigned ? 'Remove this route from courier view' : 'Assign this route to courier view'}
                        >
                          {isCourierAssigned ? 'Courier' : 'Assign'}
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-gray-600">
                      <span className="font-medium text-gray-800">
                        {stats?.km != null ? `${stats.km.toFixed(1)} km` : '— km'}
                      </span>
                      <span className="text-gray-300">·</span>
                      <span>{stats?.count ?? 0} orders</span>
                      <span className="text-gray-300">·</span>
                      <span className="font-medium text-gray-800">{formatRouteEgp(stats?.revenue ?? 0)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveRouteId(r.id);
                      setStopsExpandedRouteId((prev) => (prev === r.id ? null : r.id));
                    }}
                    className="flex w-full items-center justify-between gap-2 border-t border-gray-100/80 px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400/40"
                    aria-expanded={stopsExpandedRouteId === r.id}
                  >
                    <span>
                      Stops
                      <span className="ml-1 font-normal text-gray-500">({r.orderIds.length})</span>
                    </span>
                    <ChevronDownIcon
                      className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${stopsExpandedRouteId === r.id ? 'rotate-180' : ''}`}
                      aria-hidden
                    />
                  </button>
                  {stopsExpandedRouteId === r.id && (
                    <div className="px-3 pb-3 space-y-2 border-t border-gray-100/80">
                      {r.orderIds.length === 0 ? (
                        <p className="text-xs text-gray-500 pt-2">Open a map pin and use Add to route.</p>
                      ) : (
                        <ol className="space-y-1 max-h-40 overflow-y-auto pt-1">
                          {r.orderIds.map((oid, idx) => {
                            const o = byId.get(oid);
                            return (
                              <li
                                key={`${r.id}-${oid}-${idx}`}
                                className="flex items-center gap-1 rounded-md border border-gray-100 bg-white/90 px-1.5 py-1 text-xs"
                              >
                                <button
                                  type="button"
                                  className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-0.5 text-left hover:bg-blue-50"
                                  onClick={() => focusOrderOnMap(oid)}
                                  title="Focus this order on map"
                                >
                                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded bg-blue-100 px-1 text-[10px] font-semibold text-blue-700">
                                    {idx + 1}
                                  </span>
                                  <span className="inline-flex rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-700">
                                    #{oid}
                                  </span>
                                  <span className="truncate text-[11px] font-medium text-gray-800">{o?.name ?? 'Order'}</span>
                                </button>
                                {!readOnly ? (
                                  <span className="flex shrink-0 items-center">
                                    <button
                                      type="button"
                                      className="rounded p-0.5 text-red-600 hover:bg-red-50"
                                      onClick={() => void removeStop(r.id, oid)}
                                      aria-label="Remove stop"
                                    >
                                      <TrashIcon className="h-4 w-4" />
                                    </button>
                                  </span>
                                ) : null}
                              </li>
                            );
                          })}
                        </ol>
                      )}
                      {!readOnly && !r.fromTags && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => removeRoute(r.id)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Delete route
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <details className="rounded-xl border border-amber-200/80 bg-amber-50/40 text-sm group">
          <summary className="cursor-pointer list-none flex items-center justify-between gap-2 px-3 py-2.5 font-medium text-amber-950 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2 min-w-0">
              <MapPinIcon className="h-4 w-4 shrink-0 text-amber-800" aria-hidden />
              <span className="truncate">No location · {noLocation.length}</span>
            </span>
            <ChevronDownIcon className="h-4 w-4 shrink-0 text-amber-800 group-open:rotate-180 transition-transform md:hidden" />
          </summary>
          {noLocation.length === 0 ? (
            <p className="px-3 pb-2 text-xs text-amber-900/70">Every order in this view has coordinates.</p>
          ) : (
            <ul className="max-h-32 md:max-h-48 overflow-y-auto border-t border-amber-100/80 px-2 py-1.5 space-y-0.5 text-amber-950/85">
              {noLocation.map((o) => (
                <li key={o.id} className="truncate text-xs py-0.5 px-1">
                  {o.name}
                </li>
              ))}
            </ul>
          )}
        </details>
      </aside>

      <div className="order-1 md:order-2 w-full flex-none min-h-[320px] h-[55vh] sm:h-[48vh] md:flex-1 md:h-[min(80vh,720px)] rounded-xl overflow-hidden border border-gray-200 shadow-sm z-0 bg-white">
        <MapContainer
          center={[ROUTE_DEPOT.lat, ROUTE_DEPOT.lng]}
          zoom={12}
          className="h-full w-full"
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
          maxZoom={19}
          whenReady={(event) => setMapInstance(event.target)}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            maxNativeZoom={19}
          />
          <MapInvalidateOnResize />
          <MapFitBounds points={boundsPoints} fitKey={fitBoundsKey} />

          <Marker position={[ROUTE_DEPOT.lat, ROUTE_DEPOT.lng]} icon={depotMarkerIcon}>
            <Popup>
              <div className="text-sm font-semibold text-gray-900">Start / depot</div>
              <a
                href={ROUTE_DEPOT.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline"
              >
                Open in Maps
              </a>
            </Popup>
          </Marker>

          {currentLocation ? (
            <Marker
              position={[currentLocation.lat, currentLocation.lng]}
              icon={L.divIcon({
                className: 'courier-current-location-marker',
                html: `<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #bfdbfe;box-shadow:0 0 0 6px rgba(37,99,235,.16);" title="Current location"></div>`,
                iconSize: [18, 18],
                iconAnchor: [9, 9],
                popupAnchor: [0, -10],
              })}
            >
              <Popup>
                <div className="text-sm font-medium text-gray-900">Current location</div>
              </Popup>
            </Marker>
          ) : null}

          {geocoded.map(({ order, lat, lng }) => {
            const inAnyRoute = routes.some((rt) => rt.orderIds.includes(order.id));
            const { addable, removable } = routePickerLists(routes, order.id);
            const isMarkedDelivered = isOrderMarkedDelivered(order);
            const markerIcon = isMarkedDelivered ? markedOrderMarkerIcon : DefaultIcon;
            return (
              <Marker
                key={order.id}
                ref={(instance) => {
                  if (instance) markerRefs.current[order.id] = instance;
                  else delete markerRefs.current[order.id];
                }}
                position={[lat, lng]}
                opacity={inAnyRoute ? 1 : 0.88}
                icon={markerIcon}
              >
                <Popup minWidth={280} closeButton={false} className="order-map-popup-panel">
                  <div className="overflow-visible p-0 m-0">
                    <MapOrderCard
                      order={order as OrderForMapSummary}
                      onUpdateStatus={mapOrderCardProps.onUpdateStatus}
                      onDeleteOrder={mapOrderCardProps.onDeleteOrder}
                      onUpdateNote={mapOrderCardProps.onUpdateNote}
                      onTogglePriority={mapOrderCardProps.onTogglePriority}
                      onUpdateTags={mapOrderCardProps.onUpdateTags}
                      mapRoutePicker={
                        readOnly
                          ? undefined
                          : {
                              addable,
                              removable,
                              onAddToRoute: (routeId) => addOrderToRoute(routeId, order.id),
                              onRemoveFromRoute: (routeId) => removeStop(routeId, order.id),
                            }
                      }
                      readOnly={readOnly}
                      onCourierMarkDelivered={mapOrderCardProps.onUpdateTags ? async (orderId) => {
                        const currentOrder = byId.get(orderId);
                        if (!currentOrder) {
                          toast.error('Order not found');
                          return;
                        }
                        const currentTags = normalizeOrderTagsArray(currentOrder.tags);
                        if (currentTags.some((tag) => {
                          const normalized = tag.trim().toLowerCase();
                          return normalized === 'mark' || normalized === 'marked';
                        })) {
                          toast.success('Order already marked');
                          return;
                        }
                        mapOrderCardProps.onUpdateTags?.(orderId, [...currentTags, 'marked']);
                        toast.success('Order marked as delivered');
                      } : undefined}
                    />
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {routes.map((r, routeIndex) => {
            const pts: [number, number][] = [[ROUTE_DEPOT.lat, ROUTE_DEPOT.lng]];
            for (const oid of r.orderIds) {
              const o = byId.get(oid);
              const ll = o ? getOrderLatLng(o) : null;
              if (ll) pts.push([ll.lat, ll.lng]);
            }
            if (pts.length < 2) return null;
            return (
              <Polyline
                key={`line-${r.id}`}
                positions={pts}
                pathOptions={{
                  color: routeColor(r.id, routeIndex),
                  weight: 4,
                  opacity: 0.88,
                }}
              />
            );
          })}
        </MapContainer>
      </div>

      <Dialog open={!readOnly && !!scooterCostDialogRoute} onClose={() => !bulkPaying && setScooterCostDialogRouteId(null)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
            <Dialog.Title className="text-base font-semibold text-gray-900">
              Bulk scooter payment
            </Dialog.Title>
            <p className="mt-1 text-sm text-gray-600">
              {scooterCostDialogRoute
                ? `Route: ${scooterCostDialogRoute.name} (${scooterCostDialogRoute.orderIds.length} orders)`
                : ''}
            </p>
            <label className="mt-3 block text-sm font-medium text-gray-700">
              Total paid to scooter
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={scooterCostInput}
              onChange={(e) => setScooterCostInput(e.target.value)}
              placeholder="e.g. 280"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              disabled={bulkPaying}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setScooterCostDialogRouteId(null)}
                disabled={bulkPaying}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (scooterCostDialogRoute) {
                    void applyBulkScooterPaid(scooterCostDialogRoute, scooterCostInput);
                  }
                }}
                disabled={bulkPaying}
                className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {bulkPaying ? 'Applying...' : 'Apply'}
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}
