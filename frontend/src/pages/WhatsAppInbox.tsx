import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ChatBubbleLeftIcon,
  DocumentTextIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  SignalIcon,
  ArrowTopRightOnSquareIcon,
  ShoppingBagIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import {
  applyTemplatePlaceholders,
  buildWaMeLink,
  formatPhoneForWhatsApp,
  getOrderPhone,
  orderItemsList,
} from '../utils/whatsappMessaging';

const API = import.meta.env.VITE_API_URL;
const WEB_SECRET = import.meta.env.VITE_WHATSAPP_WEB_ADMIN_SECRET as string | undefined;

function webHeaders(): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json' };
  if (WEB_SECRET) h['X-WhatsApp-Web-Secret'] = WEB_SECRET;
  return h;
}

interface Template {
  id: string;
  key: string;
  name: string;
  body: string;
}

interface HubOrder {
  id: number;
  name: string;
  tags?: string | string[];
  customer?: { first_name?: string; phone?: string };
  shipping_address?: { phone?: string };
  line_items?: Array<{ title: string; variant_title?: string | null }>;
}

function parseTags(tags: string | string[] | undefined): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map((t) => t.trim());
  return tags.split(',').map((t) => t.trim());
}

function hasTag(order: HubOrder, tag: string): boolean {
  return parseTags(order.tags).some((t) => t.toLowerCase() === tag.toLowerCase());
}

const WhatsAppInbox: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const { data: webStatus } = useQuery({
    queryKey: ['whatsapp-web-status'],
    queryFn: async () => {
      const res = await fetch(`${API}/api/whatsapp/web/status`, { headers: webHeaders() });
      if (!res.ok) throw new Error('status failed');
      return res.json() as Promise<{
        enabled: boolean;
        status: string;
        connectedPhone: string | null;
      }>;
    },
    refetchInterval: 15000,
  });

  const { data: hubStats } = useQuery({
    queryKey: ['whatsapp-hub-stats'],
    queryFn: async () => {
      const res = await fetch(`${API}/api/whatsapp/stats`);
      if (!res.ok) throw new Error('stats failed');
      const json = await res.json();
      return json.stats as {
        pendingConfirmations?: number;
        webConnected?: boolean;
        webStatus?: string;
      };
    },
    refetchInterval: 60000,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: async () => {
      const res = await fetch(`${API}/api/whatsapp/templates`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.templates || []) as Template[];
    },
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', 'hub'],
    queryFn: async () => {
      const res = await fetch(`${API}/api/orders?scope=active`);
      if (!res.ok) throw new Error('orders failed');
      return (await res.json()) as HubOrder[];
    },
  });

  const pendingConfirmations = useMemo(
    () =>
      orders.filter(
        (o) =>
          getOrderPhone(o) &&
          !hasTag(o, 'confirmation_sent') &&
          !hasTag(o, 'confirmation_scheduled') &&
          !hasTag(o, 'cancelled') &&
          !hasTag(o, 'fulfilled') &&
          !hasTag(o, 'shipped')
      ),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders.filter((o) => getOrderPhone(o)).slice(0, 40);
    return orders
      .filter((o) => {
        const phone = getOrderPhone(o) || '';
        const name = o.name?.toLowerCase() || '';
        const customer = o.customer?.first_name?.toLowerCase() || '';
        return (
          phone.includes(q.replace(/\D/g, '')) ||
          name.includes(q) ||
          customer.includes(q)
        );
      })
      .slice(0, 40);
  }, [orders, search]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );

  const selectedPhone = selectedOrder ? getOrderPhone(selectedOrder) : null;

  const placeholderData = useMemo(() => {
    if (!selectedOrder) {
      return { customer_first_name: 'Customer', items_list: '—', order_number: '—' };
    }
    return {
      customer_first_name: selectedOrder.customer?.first_name?.trim() || 'Customer',
      items_list: orderItemsList(selectedOrder.line_items),
      order_number: selectedOrder.name,
    };
  }, [selectedOrder]);

  const sendWebMutation = useMutation({
    mutationFn: async ({ phone, text }: { phone: string; text: string }) => {
      const res = await fetch(`${API}/api/whatsapp/web/send-text`, {
        method: 'POST',
        headers: webHeaders(),
        body: JSON.stringify({ phone, message: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Send failed');
      return json;
    },
    onSuccess: () => toast.success('Message sent from linked WhatsApp'),
    onError: (e: Error) => toast.error(e.message),
  });

  const selectOrder = (order: HubOrder) => {
    setSelectedOrderId(order.id);
    setMessage('');
  };

  const applyTemplate = (t: Template) => {
    setMessage(applyTemplatePlaceholders(t.body, placeholderData));
  };

  const openInWhatsApp = () => {
    if (!selectedPhone || !message.trim()) {
      toast.error('Select a customer and enter a message');
      return;
    }
    window.open(buildWaMeLink(selectedPhone, message.trim()), '_blank');
  };

  const sendFromDashboard = () => {
    if (!selectedPhone || !message.trim()) {
      toast.error('Select a customer and enter a message');
      return;
    }
    if (webStatus?.status !== 'connected') {
      toast.error('Link your WhatsApp account first (top banner)');
      return;
    }
    sendWebMutation.mutate({ phone: selectedPhone, text: message.trim() });
  };

  const webConnected = webStatus?.status === 'connected';
  const pendingCount =
    hubStats?.pendingConfirmations ?? pendingConfirmations.length;

  return (
    <div className="flex h-[calc(100vh-4rem)] md:h-[calc(100vh-3.5rem)] min-h-0 flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-[#25D366] to-[#20BA5A] px-4 py-4 shadow-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ChatBubbleLeftIcon className="h-7 w-7 text-white" />
            <div>
              <h1 className="text-lg font-semibold text-white">Messaging hub</h1>
              <p className="text-xs text-white/80">
                Templates + linked WhatsApp — no WABA inbox
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/whatsapp/connect"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/30"
            >
              <LinkIcon className="h-4 w-4" />
              {webConnected ? 'Account linked' : 'Link account'}
            </Link>
            <Link
              to="/whatsapp/templates"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/30"
            >
              <DocumentTextIcon className="h-4 w-4" />
              Templates
            </Link>
          </div>
        </div>
      </div>

      {/* Connection banner */}
      <div
        className={`flex-shrink-0 border-b px-4 py-2 text-sm ${
          webConnected
            ? 'border-green-200 bg-green-50 text-green-800'
            : 'border-amber-200 bg-amber-50 text-amber-900'
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          <SignalIcon className="h-5 w-5 flex-shrink-0" />
          {webConnected ? (
            <span>
              WhatsApp linked
              {webStatus?.connectedPhone ? ` (+${webStatus.connectedPhone})` : ''}. Order
              confirmations send automatically; use below for everything else.
            </span>
          ) : (
            <span>
              {webStatus?.enabled === false
                ? 'WhatsApp Web is off on the server — set WHATSAPP_WEB_ENABLED=true and restart.'
                : 'Link your WhatsApp Business account to send from the dashboard and automate order confirmations.'}{' '}
              <Link to="/whatsapp/connect" className="font-medium underline">
                Link now
              </Link>
            </span>
          )}
        </div>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4 overflow-hidden p-4 lg:flex-row">
        {/* Left: queues + customer picker */}
        <div className="flex min-h-0 w-full flex-col gap-4 lg:w-80 lg:flex-shrink-0">
          {pendingCount > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-900">
                {pendingCount} awaiting first confirmation
              </p>
              <p className="mt-1 text-xs text-amber-800">
                Auto-sent ~1h after order if WhatsApp is linked. Tap below to message manually.
              </p>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b p-3">
              <p className="mb-2 text-sm font-semibold text-gray-900">Customers</p>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Order #, name, phone…"
                  className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-sm focus:border-[#25D366] focus:outline-none focus:ring-1 focus:ring-[#25D366]"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {ordersLoading ? (
                <p className="p-4 text-sm text-gray-500">Loading orders…</p>
              ) : filteredOrders.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No orders with phone numbers</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filteredOrders.map((order) => {
                    const phone = getOrderPhone(order)!;
                    const pending = pendingConfirmations.some((p) => p.id === order.id);
                    return (
                      <li key={order.id}>
                        <button
                          type="button"
                          onClick={() => selectOrder(order)}
                          className={`w-full px-3 py-2.5 text-left transition-colors hover:bg-gray-50 ${
                            selectedOrderId === order.id ? 'bg-green-50' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-gray-900">{order.name}</p>
                              <p className="truncate text-xs text-gray-600">
                                {order.customer?.first_name || 'Customer'} · {formatPhoneForWhatsApp(phone)}
                              </p>
                            </div>
                            {pending && (
                              <span className="flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                                New
                              </span>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Right: compose */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
          {!selectedOrder ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <ChatBubbleLeftIcon className="mb-3 h-12 w-12 text-gray-300" />
              <h2 className="text-lg font-medium text-gray-900">Select a customer</h2>
              <p className="mt-1 max-w-sm text-sm text-gray-500">
                Pick an order from the list, choose a template, then open WhatsApp or send from
                your linked account.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <div>
                  <p className="font-semibold text-gray-900">{selectedOrder.name}</p>
                  <p className="text-sm text-gray-600">
                    {placeholderData.customer_first_name} ·{' '}
                    {selectedPhone && formatPhoneForWhatsApp(selectedPhone)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const digits = (selectedPhone || '').replace(/\D/g, '');
                    const searchPhone = digits.length > 1 ? digits.substring(1) : digits;
                    navigate(`/orders?search=${searchPhone}`);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <ShoppingBagIcon className="h-4 w-4" />
                  View order
                </button>
              </div>

              <div className="border-b px-4 py-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Templates
                </p>
                <div className="flex flex-wrap gap-2">
                  {templates.length === 0 ? (
                    <Link
                      to="/whatsapp/templates"
                      className="text-sm text-[#128C7E] hover:underline"
                    >
                      Add templates →
                    </Link>
                  ) : (
                    templates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => applyTemplate(t)}
                        className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                          t.key === 'order_ready'
                            ? 'border-amber-300 bg-amber-50 hover:bg-amber-100'
                            : 'border-gray-200 hover:border-[#25D366] hover:bg-green-50'
                        }`}
                      >
                        {t.name}
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="min-h-0 flex-1 p-4">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Message preview — edit before sending…"
                  className="h-full min-h-[160px] w-full resize-none rounded-xl border border-gray-200 bg-[#EFEAE2]/50 p-4 text-sm focus:border-[#25D366] focus:outline-none focus:ring-1 focus:ring-[#25D366]"
                />
              </div>

              <div className="flex flex-col gap-2 border-t p-4 sm:flex-row">
                <button
                  type="button"
                  onClick={openInWhatsApp}
                  disabled={!message.trim()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#25D366] bg-white px-4 py-3 text-sm font-medium text-[#128C7E] hover:bg-green-50 disabled:opacity-50"
                >
                  <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                  Open in WhatsApp
                </button>
                <button
                  type="button"
                  onClick={sendFromDashboard}
                  disabled={!message.trim() || !webConnected || sendWebMutation.isPending}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-medium text-white hover:bg-[#20BA5A] disabled:opacity-50"
                  title={
                    webConnected
                      ? 'Send via linked WhatsApp Web session'
                      : 'Link WhatsApp first'
                  }
                >
                  <PaperAirplaneIcon className="h-5 w-5" />
                  {sendWebMutation.isPending ? 'Sending…' : 'Send from dashboard'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppInbox;
