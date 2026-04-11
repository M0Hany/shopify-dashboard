import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'react-hot-toast';
import {
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MapPinIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { getOrderLatLng } from '../utils/orderGeolocation';
import {
  buildDraftRoutesFromShippingTags,
  shippingTagRoutesFingerprint,
} from '../utils/shippingRouteTags';
import type { OrderForMapSummary } from '../utils/orderMapSummary';
import OrderCard, { type OrderCardProps } from './OrderCard';
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

const ROUTE_LINE_COLORS = ['#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#c026d3'];

function routeColorIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % ROUTE_LINE_COLORS.length;
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

export type OrdersMapOrderCardProps = Omit<OrderCardProps, 'order' | 'mapRoutePicker' | 'isSelected'>;

export interface OrdersMapPanelProps {
  orders: OrderForMapSummary[];
  /** Set route name to assign shipping_route (+ date) tags; null strips those tags from the order. */
  onReplaceShippingRouteForOrder: (orderId: number, routeName: string | null) => Promise<void>;
  /** Same handlers as list view — map pin popups render full OrderCard. */
  mapOrderCardProps: OrdersMapOrderCardProps;
  selectedOrderIds: number[];
}

export function OrdersMapPanel({
  orders,
  onReplaceShippingRouteForOrder,
  mapOrderCardProps,
  selectedOrderIds,
}: OrdersMapPanelProps) {
  const [localRoutes, setLocalRoutes] = useState<DraftRoute[]>([]);
  /** Stop order overrides for routes rebuilt from Shopify tags (cleared when tag set changes). */
  const [tagRouteOverrides, setTagRouteOverrides] = useState<Record<string, number[]>>({});
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  /** Which route’s stop list is expanded in the sidebar (collapsed by default). */
  const [stopsExpandedRouteId, setStopsExpandedRouteId] = useState<string | null>(null);
  const [newRouteName, setNewRouteName] = useState('');

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
    for (const g of geocoded) pts.push([g.lat, g.lng]);
    return pts;
  }, [geocoded]);

  const fitBoundsKey = useMemo(() => {
    const depot = `${ROUTE_DEPOT.lat.toFixed(6)},${ROUTE_DEPOT.lng.toFixed(6)}`;
    const stops = [...geocoded]
      .sort((a, b) => a.order.id - b.order.id)
      .map((g) => `${g.order.id}:${g.lat.toFixed(6)}:${g.lng.toFixed(6)}`);
    return `${depot}|${stops.join(';')}`;
  }, [geocoded]);

  const activeRoute = routes.find((r) => r.id === activeRouteId) ?? null;

  const addRoute = useCallback(() => {
    const name = newRouteName.trim();
    if (!name) {
      toast.error('Enter a route name');
      return;
    }
    const id = `local-${Date.now()}`;
    setLocalRoutes((prev) => [...prev, { id, name, orderIds: [], fromTags: false }]);
    setActiveRouteId(id);
    setNewRouteName('');
  }, [newRouteName]);

  const removeRoute = useCallback((id: string) => {
    if (id.startsWith('sr:')) {
      toast.error('This route comes from Shopify tags. Remove shipping_route / shipping_route_date tags on those orders to clear it.');
      return;
    }
    setLocalRoutes((prev) => prev.filter((r) => r.id !== id));
    setActiveRouteId((cur) => (cur === id ? null : cur));
  }, []);

  const addOrderToRoute = useCallback(
    async (routeId: string, orderId: number) => {
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
    [routes, onReplaceShippingRouteForOrder]
  );

  const reoptimizeAllRoutes = useCallback(() => {
    const tagUpdates: Record<string, number[]> = {};
    const localById = new Map<string, number[]>();
    for (const r of routes) {
      if (r.orderIds.length < 2) continue;
      const next = reoptimizeStopOrder(r.orderIds, byId, ROUTE_DEPOT);
      if (r.id.startsWith('sr:')) tagUpdates[r.id] = next;
      else localById.set(r.id, next);
    }
    if (Object.keys(tagUpdates).length === 0 && localById.size === 0) {
      toast.error('No route has at least two stops');
      return;
    }
    if (Object.keys(tagUpdates).length > 0) {
      setTagRouteOverrides((prev) => ({ ...prev, ...tagUpdates }));
    }
    if (localById.size > 0) {
      setLocalRoutes((prev) =>
        prev.map((x) => (localById.has(x.id) ? { ...x, orderIds: localById.get(x.id)! } : x))
      );
    }
    toast.success('Reoptimized all routes with 2+ stops (shortest path, approx.)');
  }, [routes, byId]);

  const moveStop = useCallback(
    (routeId: string, index: number, dir: -1 | 1) => {
      if (routeId.startsWith('sr:')) {
        setTagRouteOverrides((prev) => {
          const base = routesFromTags.find((r) => r.id === routeId)?.orderIds ?? [];
          const current = [...(prev[routeId] ?? base)];
          const j = index + dir;
          if (j < 0 || j >= current.length) return prev;
          [current[index], current[j]] = [current[j], current[index]];
          return { ...prev, [routeId]: current };
        });
        return;
      }
      setLocalRoutes((prev) =>
        prev.map((r) => {
          if (r.id !== routeId) return r;
          const j = index + dir;
          if (j < 0 || j >= r.orderIds.length) return r;
          const next = [...r.orderIds];
          [next[index], next[j]] = [next[j], next[index]];
          return { ...r, orderIds: next };
        })
      );
    },
    [routesFromTags]
  );

  const removeStop = useCallback(
    async (routeId: string, orderId: number) => {
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
    [onReplaceShippingRouteForOrder]
  );

  return (
    <div className="flex flex-col md:flex-row gap-3 min-h-0">
      <aside className="order-2 md:order-1 w-full md:w-[min(100%,20rem)] shrink-0 flex flex-col gap-3 md:max-h-[min(80vh,720px)] md:overflow-y-auto pr-0.5">
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
          <button
            type="button"
            onClick={reoptimizeAllRoutes}
            disabled={routes.length === 0}
            className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-40"
          >
            <ArrowPathIcon className="h-4 w-4 shrink-0" aria-hidden />
            Reoptimize all routes
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 shadow-sm overflow-hidden">
          {routes.length === 0 ? (
            <p className="p-3 text-sm text-gray-500">
              No routes in this view. Add tags like <span className="font-mono text-[11px]">shipping_route:Name</span> on orders, or create a new route with Add.
            </p>
          ) : (
            routes.map((r) => {
              const color = ROUTE_LINE_COLORS[routeColorIndex(r.id)];
              const isActive = r.id === activeRouteId;
              const stats = routeStats.get(r.id);
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
                      {r.fromTags && (
                        <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                          Tags
                        </span>
                      )}
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
                                className="flex items-center gap-1 rounded-md bg-white/90 border border-gray-100 px-1.5 py-1 text-xs"
                              >
                                <span className="text-gray-400 w-4 shrink-0">{idx + 1}</span>
                                <span className="truncate flex-1 font-medium text-gray-800">{o?.name ?? oid}</span>
                                <span className="flex shrink-0 items-center gap-0.5">
                                  <button
                                    type="button"
                                    className="p-0.5 rounded text-gray-500 hover:bg-gray-100"
                                    onClick={() => moveStop(r.id, idx, -1)}
                                    disabled={idx === 0}
                                    aria-label="Move stop up"
                                  >
                                    <ChevronUpIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    className="p-0.5 rounded text-gray-500 hover:bg-gray-100"
                                    onClick={() => moveStop(r.id, idx, 1)}
                                    disabled={idx === r.orderIds.length - 1}
                                    aria-label="Move stop down"
                                  >
                                    <ChevronDownIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    className="p-0.5 rounded text-red-600 hover:bg-red-50"
                                    onClick={() => void removeStop(r.id, oid)}
                                    aria-label="Remove stop"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                </span>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                      {!r.fromTags && (
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

      <div className="order-1 md:order-2 flex-1 min-h-[220px] h-[42dvh] sm:h-[48dvh] md:h-[min(80vh,720px)] rounded-xl overflow-hidden border border-gray-200 shadow-sm z-0">
        <MapContainer
          center={[ROUTE_DEPOT.lat, ROUTE_DEPOT.lng]}
          zoom={12}
          className="h-full w-full"
          scrollWheelZoom
          maxZoom={19}
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

          {geocoded.map(({ order, lat, lng }) => {
            const inAnyRoute = routes.some((rt) => rt.orderIds.includes(order.id));
            const { addable, removable } = routePickerLists(routes, order.id);
            return (
              <Marker key={order.id} position={[lat, lng]} opacity={inAnyRoute ? 1 : 0.88}>
                <Popup minWidth={280} closeButton={false} className="order-map-popup-panel">
                  <div className="max-h-[min(75vh,640px)] overflow-y-auto overflow-x-hidden p-0 m-0">
                    <OrderCard
                      order={order as any}
                      {...mapOrderCardProps}
                      isSelected={selectedOrderIds.includes(order.id)}
                      mapRoutePicker={{
                        addable,
                        removable,
                        onAddToRoute: (routeId) => addOrderToRoute(routeId, order.id),
                        onRemoveFromRoute: (routeId) => removeStop(routeId, order.id),
                      }}
                    />
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {routes.map((r) => {
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
                  color: ROUTE_LINE_COLORS[routeColorIndex(r.id)],
                  weight: 4,
                  opacity: 0.88,
                }}
              />
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
