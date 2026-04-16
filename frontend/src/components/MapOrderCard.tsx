import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, Menu } from '@headlessui/react';
import { createPortal } from 'react-dom';
import {
  BanknotesIcon,
  CheckBadgeIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  DocumentTextIcon,
  EllipsisHorizontalIcon,
  PaperAirplaneIcon,
  MapPinIcon,
  PauseCircleIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  SparklesIcon,
  StarIcon,
  TagIcon,
  TrashIcon,
  TruckIcon,
  XMarkIcon,
  XCircleIcon,
  HandThumbUpIcon,
  ChatBubbleLeftIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import { PhoneArrowUpRightIcon } from '@heroicons/react/24/solid';
import { toast } from 'react-hot-toast';
import whatsappLogo from '../assets/whatsapp.png';
import LocationDialog from './ui/LocationDialog';
import type { OrderCardMapRoutePicker, OrderCardProps } from './OrderCard';
import type { OrderForMapSummary } from '../utils/orderMapSummary';
import { buildOrderMapSummary, calculateOrderDaysLeft } from '../utils/orderMapSummary';
import { getOrderLatLng } from '../utils/orderGeolocation';
import { normalizeOrderTagsArray, stripShippingRouteTags } from '../utils/shippingRouteTags';
import { useNavigate } from 'react-router-dom';
import { analyzePriorityMakingLineItems, isPriorityMakingLineItem, shouldHidePriorityMakingLine } from '../utils/priorityMakingRush';

export interface MapOrderCardProps {
  order: OrderForMapSummary;
  onUpdateStatus?: OrderCardProps['onUpdateStatus'];
  onDeleteOrder?: OrderCardProps['onDeleteOrder'];
  onUpdateNote?: OrderCardProps['onUpdateNote'];
  onTogglePriority?: OrderCardProps['onTogglePriority'];
  onUpdateTags?: (orderId: number, newTags: string[]) => void;
  mapRoutePicker?: OrderCardMapRoutePicker;
  readOnly?: boolean;
  onCourierMarkDelivered?: (orderId: number) => void | Promise<void>;
}

function getDaysLeftBadgeStyle(daysLeft: number): string {
  if (daysLeft < 0) return 'bg-red-100 text-red-700 border-red-200';
  if (daysLeft === 0) return 'bg-orange-100 text-orange-700 border-orange-200';
  if (daysLeft <= 2) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  if (daysLeft <= 4) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-green-100 text-green-700 border-green-200';
}

function getDaysLeftText(daysLeft: number): string {
  if (daysLeft === 0) return 'Today';
  return `${daysLeft}`;
}

function getCurrentStatusFromOrder(order: OrderForMapSummary): string {
  const trimmedTags = normalizeOrderTagsArray(order.tags).map((tag) => tag.trim().toLowerCase());
  if (String(order.fulfillment_status || '').toLowerCase() === 'fulfilled') return 'fulfilled';
  if (trimmedTags.includes('paid')) return 'paid';
  if (trimmedTags.includes('cancelled')) return 'cancelled';
  if (trimmedTags.includes('shipped')) return 'shipped';
  if (trimmedTags.includes('ready_to_ship')) return 'ready_to_ship';
  if (trimmedTags.includes('customer_confirmed')) return 'confirmed';
  if (trimmedTags.includes('on_hold')) return 'on_hold';
  if (trimmedTags.includes('order_ready')) return 'order-ready';
  return 'pending';
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'order-ready':
      return 'bg-orange-500 text-white';
    case 'on_hold':
      return 'bg-amber-500 text-white';
    case 'confirmed':
      return 'bg-green-500 text-white';
    case 'ready_to_ship':
      return 'bg-blue-600 text-white font-medium';
    case 'shipped':
      return 'bg-purple-600 text-white';
    case 'fulfilled':
      return 'bg-emerald-600 text-white';
    case 'cancelled':
      return 'bg-red-600 text-white';
    case 'paid':
      return 'bg-indigo-600 text-white';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getStatusIcon(status: string): React.ReactNode {
  switch (status) {
    case 'pending':
      return <ClockIcon className="w-5 h-5" />;
    case 'order-ready':
      return <SparklesIcon className="w-5 h-5" />;
    case 'on_hold':
      return <PauseCircleIcon className="w-5 h-5" />;
    case 'confirmed':
      return <HandThumbUpIcon className="w-5 h-5" />;
    case 'ready_to_ship':
      return <PaperAirplaneIcon className="w-5 h-5" />;
    case 'shipped':
      return <TruckIcon className="w-5 h-5" />;
    case 'fulfilled':
      return <CheckBadgeIcon className="w-5 h-5" />;
    case 'paid':
      return <BanknotesIcon className="w-5 h-5" />;
    case 'cancelled':
      return <XCircleIcon className="w-5 h-5" />;
    default:
      return <ClockIcon className="w-5 h-5" />;
  }
}

export default function MapOrderCard({
  order,
  onUpdateStatus,
  onDeleteOrder,
  onUpdateNote,
  onTogglePriority,
  onUpdateTags,
  mapRoutePicker,
  readOnly = false,
  onCourierMarkDelivered,
}: MapOrderCardProps) {
  const navigate = useNavigate();
  const [productsExpanded, setProductsExpanded] = useState(false);
  const [addRouteExpanded, setAddRouteExpanded] = useState(false);
  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [noteText, setNoteText] = useState(order.note || '');
  const [newTag, setNewTag] = useState('');
  const [orderNumberCopied, setOrderNumberCopied] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(getCurrentStatusFromOrder(order));
  const [openFloatingMenu, setOpenFloatingMenu] = useState<null | 'phone' | 'map' | 'status' | 'actions'>(null);
  const [floatingMenuStyle, setFloatingMenuStyle] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 176,
  });
  const phoneButtonRef = useRef<HTMLButtonElement | null>(null);
  const mapButtonRef = useRef<HTMLButtonElement | null>(null);
  const statusButtonRef = useRef<HTMLButtonElement | null>(null);
  const actionsButtonRef = useRef<HTMLButtonElement | null>(null);
  const floatingMenuRef = useRef<HTMLDivElement | null>(null);
  const noteModalRef = useRef<HTMLDivElement | null>(null);
  const tagDialogRef = useRef<HTMLDivElement | null>(null);

  const summary = useMemo(() => buildOrderMapSummary(order), [order]);
  const daysLeft = useMemo(() => calculateOrderDaysLeft(order), [order]);
  const daysLeftClass = getDaysLeftBadgeStyle(daysLeft);
  const latLng = useMemo(() => getOrderLatLng(order), [order]);
  const currentTags = useMemo(() => normalizeOrderTagsArray(order.tags), [order.tags]);
  const removableRouteId = useMemo(() => {
    if (!mapRoutePicker?.removable?.length) return null;
    if (mapRoutePicker.removable.length === 1) return mapRoutePicker.removable[0].id;
    const routeName = (summary.routeName || '').trim().toLowerCase();
    const matched = mapRoutePicker.removable.find((route) => route.name.trim().toLowerCase() === routeName);
    return matched?.id ?? mapRoutePicker.removable[0].id;
  }, [mapRoutePicker, summary.routeName]);
  const hasAssignedRoute = (mapRoutePicker?.removable?.length ?? 0) > 0;

  const phoneDigits = (summary.phone || '').replace(/\D/g, '');
  const googleMapsUrl = latLng ? `https://www.google.com/maps?q=${latLng.lat},${latLng.lng}` : null;
  const locationText = latLng ? `${latLng.lat},${latLng.lng}` : null;
  const hasPinTag = currentTags.some((tag) => tag.toLowerCase().startsWith('pin:'));
  const hasExistingLocation = Boolean(latLng) || hasPinTag;
  const rushClass =
    summary.rushLine === 'Rushed'
      ? 'text-red-600 font-medium'
      : summary.rushLine === 'Mix'
        ? 'text-orange-600 font-medium'
        : 'text-gray-600';
  const isPriority = currentTags.includes('priority');
  const isOrderCancelled = currentTags.includes('cancelled');
  const hidePriorityMakingLine = shouldHidePriorityMakingLine(analyzePriorityMakingLineItems(order.line_items || []));

  const { data: allTemplates = [] } = useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/whatsapp/templates`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.templates || []) as Array<{ id: string; key: string; name: string; body: string }>;
    },
    enabled: showTemplateDialog,
  });

  useEffect(() => {
    setCurrentStatus(getCurrentStatusFromOrder(order));
  }, [order.tags, order.fulfillment_status]);

  useEffect(() => {
    setNoteText(order.note || '');
  }, [order.note]);

  useEffect(() => {
    if (!openFloatingMenu) return;

    const anchor =
      openFloatingMenu === 'phone'
        ? phoneButtonRef.current
        : openFloatingMenu === 'map'
          ? mapButtonRef.current
          : openFloatingMenu === 'status'
            ? statusButtonRef.current
            : actionsButtonRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    setFloatingMenuStyle({
      top: rect.bottom + 4,
      left: openFloatingMenu === 'status' || openFloatingMenu === 'actions' ? rect.right : rect.left,
      width:
        openFloatingMenu === 'phone'
          ? 176
          : openFloatingMenu === 'map'
            ? 192
            : openFloatingMenu === 'status'
              ? 160
              : 192,
    });

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (floatingMenuRef.current?.contains(target)) return;
      if (anchor.contains(target)) return;
      setOpenFloatingMenu(null);
    };

    const handleViewportChange = () => {
      const updatedRect = anchor.getBoundingClientRect();
      setFloatingMenuStyle({
        top: updatedRect.bottom + 4,
        left: openFloatingMenu === 'status' || openFloatingMenu === 'actions' ? updatedRect.right : updatedRect.left,
        width:
          openFloatingMenu === 'phone'
            ? 176
            : openFloatingMenu === 'map'
              ? 192
              : openFloatingMenu === 'status'
                ? 160
                : 192,
      });
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [openFloatingMenu]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (isNoteModalOpen && noteModalRef.current && !noteModalRef.current.contains(event.target as Node)) {
        setIsNoteModalOpen(false);
      }
      if (showTagDialog && tagDialogRef.current && !tagDialogRef.current.contains(event.target as Node)) {
        setShowTagDialog(false);
      }
    }

    if (isNoteModalOpen || showTagDialog) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNoteModalOpen, showTagDialog]);

  const copyText = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch {
      toast.error('Copy failed');
    }
  };

  const formatPhoneNumber = (phone: string): string => {
    let formatted = phone.replace(/\D/g, '');
    if (!formatted.startsWith('20') && formatted.startsWith('0')) {
      formatted = '20' + formatted.substring(1);
    } else if (!formatted.startsWith('20') && !formatted.startsWith('0')) {
      formatted = '20' + formatted;
    }
    return formatted;
  };

  const parseLatLngInput = (value: string): { lat: string; lng: string } | null => {
    const match = value.trim().match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!match) return null;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat: String(lat), lng: String(lng) };
  };

  const handleOpenPinDialog = () => {
    setPinInput(locationText ?? '');
    setShowPinDialog(true);
    setOpenFloatingMenu(null);
  };

  const handleSavePinTag = () => {
    if (!onUpdateTags) {
      toast.error('Tag update is not available');
      return;
    }
    const parsed = parseLatLngInput(pinInput);
    if (!parsed) {
      toast.error('Use lat,long format (example: 29.9942847,31.4339147)');
      return;
    }

    const baseTags = currentTags.filter((tag) => {
      const lower = tag.toLowerCase();
      return (
        !lower.startsWith('pin:') &&
        !lower.startsWith('mylerz_city_id:') &&
        !lower.startsWith('mylerz_neighborhood_id:') &&
        !lower.startsWith('mylerz_subzone_id:')
      );
    });

    onUpdateTags(order.id, [...baseTags, `pin:${parsed.lat};${parsed.lng}`]);
    setShowPinDialog(false);
    toast.success(hasExistingLocation ? 'Location updated' : 'Location added');
  };

  const handleCopyOrderNumber = async () => {
    try {
      await navigator.clipboard.writeText(order.name);
      setOrderNumberCopied(true);
      toast.success('Order number copied to clipboard');
      setTimeout(() => setOrderNumberCopied(false), 2000);
    } catch {
      toast.error('Failed to copy order number');
    }
  };

  const handleStatusChange = (newStatus: string) => {
    if (!onUpdateStatus || newStatus === currentStatus) return;
    setCurrentStatus(newStatus);
    let statusTag = newStatus.trim();
    if (newStatus.trim().toLowerCase() === 'confirmed') statusTag = 'customer_confirmed';
    else if (newStatus.trim().toLowerCase() === 'order-ready') statusTag = 'order_ready';
    onUpdateStatus(order.id, statusTag);
  };

  const handleAddNote = () => {
    setNoteText(order.note || '');
    setIsNoteModalOpen(true);
    setOpenFloatingMenu(null);
  };

  const handleManageTags = () => {
    setShowTagDialog(true);
    setOpenFloatingMenu(null);
  };

  const handleTogglePriority = () => {
    onTogglePriority?.(order.id, !isPriority);
    setOpenFloatingMenu(null);
  };

  const handleOrderReadyAction = () => {
    handleStatusChange(currentStatus === 'pending' ? 'order-ready' : 'confirmed');
    setOpenFloatingMenu(null);
  };

  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateNote?.(order.id, noteText);
    setIsNoteModalOpen(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdateTags?.(order.id, currentTags.filter((tag) => tag !== tagToRemove));
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const next = newTag.trim();
    if (!next) return;
    if (!currentTags.includes(next)) {
      onUpdateTags?.(order.id, [...currentTags, next]);
    }
    setNewTag('');
  };

  const handleSendTemplateSelect = (t: { id: string; key: string; name: string; body: string }) => {
    if (!order.customer?.phone) {
      toast.error('No phone number for this order');
      return;
    }
    const customerFirstName = order.customer.first_name?.trim() || 'Customer';
    const itemsList = (order.line_items || [])
      .filter((item) => !(hidePriorityMakingLine && isPriorityMakingLineItem(item)))
      .map((item) => {
        const variant = item.variant_title ? ` (${item.variant_title})` : '';
        return `- ${item.title}${variant}`;
      })
      .join('\n') || '—';
    const body = t.body
      .replace(/\{\{customer_first_name\}\}/g, customerFirstName)
      .replace(/\{\{items_list\}\}/g, itemsList);
    const formattedPhone = formatPhoneNumber(order.customer.phone);
    const whatsAppLink = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(body)}`;
    window.open(whatsAppLink, '_blank');
    setShowTemplateDialog(false);
  };

  return (
    <>
      <div className="w-[280px] max-w-full overflow-visible rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <div className="flex min-w-0 flex-1 flex-col justify-start">
                <span className="truncate text-base font-semibold leading-tight text-gray-900">
                  {summary.customerLine}
                </span>
                <span
                  onClick={handleCopyOrderNumber}
                  className={`mt-0.5 cursor-pointer truncate leading-tight text-[10px] transition-all duration-200 ${
                    orderNumberCopied ? 'rounded bg-green-50 px-1 font-semibold text-green-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title={orderNumberCopied ? 'Copied!' : 'Click to copy order number'}
                >
                  {summary.orderName} • <span className={rushClass}>{summary.rushLine}</span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {readOnly && onCourierMarkDelivered ? (
              <button
                type="button"
                onClick={() => {
                  void onCourierMarkDelivered(order.id);
                }}
                className="rounded p-1 text-emerald-600 transition-colors duration-200 hover:bg-emerald-50 hover:text-emerald-700"
                title="Mark delivered"
              >
                <CheckCircleIcon className="h-5 w-5" />
              </button>
            ) : null}
            {!readOnly ? (
              <>
                <button
                  ref={statusButtonRef}
                  type="button"
                  onClick={() => setOpenFloatingMenu((current) => (current === 'status' ? null : 'status'))}
                  className={`inline-flex items-center justify-center rounded-full p-1.5 ${getStatusColor(currentStatus)} transition-opacity hover:opacity-80`}
                  title={currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1).replace(/-/g, ' ')}
                >
                  {getStatusIcon(currentStatus)}
                </button>

                <button
                  ref={actionsButtonRef}
                  type="button"
                  onClick={() => setOpenFloatingMenu((current) => (current === 'actions' ? null : 'actions'))}
                  className="rounded p-1 text-gray-400 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-600"
                  title="More actions"
                >
                  <EllipsisHorizontalIcon className="h-5 w-5" />
                </button>
              </>
            ) : null}
          </div>
        </div>

        {mapRoutePicker && !readOnly ? (
          <div className="mb-2 border-b border-gray-100 pb-2">
            {hasAssignedRoute && removableRouteId ? (
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    try {
                      await mapRoutePicker.onRemoveFromRoute(removableRouteId);
                      setAddRouteExpanded(false);
                    } catch {
                      /* parent already toasts */
                    }
                  })();
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
              >
                Remove from route
              </button>
            ) : mapRoutePicker.addable.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => setAddRouteExpanded((value) => !value)}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50/90 px-2 py-1.5 text-left hover:bg-gray-100/90"
                  aria-expanded={addRouteExpanded}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                    <PlusIcon className="h-3.5 w-3.5 text-gray-400" />
                    Add to route
                  </span>
                  <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform ${addRouteExpanded ? 'rotate-180' : ''}`} />
                </button>
                {addRouteExpanded ? (
                  <div className="mt-1 space-y-1 border-t border-gray-100 pt-1">
                    {mapRoutePicker.addable.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className="flex w-full items-center rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-left text-sm text-gray-800 shadow-sm hover:bg-gray-50"
                        onClick={() => {
                          void (async () => {
                            try {
                              await mapRoutePicker.onAddToRoute(opt.id);
                              setAddRouteExpanded(false);
                            } catch {
                              /* parent already toasts */
                            }
                          })();
                        }}
                      >
                        {opt.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : mapRoutePicker.removable.length === 0 ? (
              <p className="py-1 text-center text-xs text-gray-500">No routes in sidebar.</p>
            ) : null}
          </div>
        ) : null}

        <div className="mb-2 grid grid-cols-4 gap-1.5">
          <div className="relative">
            <button
              ref={phoneButtonRef}
              type="button"
              onClick={() => setOpenFloatingMenu((current) => (current === 'phone' ? null : 'phone'))}
              className="flex h-14 w-full flex-col items-center justify-center rounded-lg border border-gray-200 bg-white px-1 text-[10px] font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <PhoneIcon className="h-4 w-4 text-gray-500" />
            </button>
          </div>

          <div className="relative">
            <button
              ref={mapButtonRef}
              type="button"
              onClick={() => setOpenFloatingMenu((current) => (current === 'map' ? null : 'map'))}
              className="flex h-14 w-full flex-col items-center justify-center rounded-lg border border-gray-200 bg-white px-1 text-[10px] font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <MapPinIcon className="h-4 w-4 text-gray-500" />
            </button>
          </div>

          <div className={`flex h-14 flex-col items-center justify-center rounded-lg border px-1 shadow-sm ${daysLeftClass}`}>
            <div className="text-sm font-bold leading-none">{getDaysLeftText(daysLeft)}</div>
          </div>

          <div className="flex h-14 flex-col items-center justify-center rounded-lg border border-gray-200 bg-white px-1 text-gray-800 shadow-sm">
            <div className="text-[11px] font-bold leading-tight">{summary.totalFormatted}</div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
          <button
            type="button"
            onClick={() => setProductsExpanded((value) => !value)}
            className="flex w-full items-center justify-between gap-2 text-left"
            aria-expanded={productsExpanded}
          >
            <span className="truncate text-sm font-medium text-gray-900">Products</span>
            <ChevronDownIcon className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${productsExpanded ? 'rotate-180' : ''}`} />
          </button>
          <div className={`overflow-hidden transition-all ${productsExpanded ? 'mt-2' : 'mt-0'}`}>
            {productsExpanded ? (
              <div className="space-y-1.5">
                {(order.line_items || []).map((item, index) => (
                  <div key={`${item.title}-${index}`} className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700">
                    <div className="font-medium text-gray-900">
                      {item.quantity}x {item.title}
                    </div>
                    {item.variant_title ? <div className="mt-0.5 text-gray-500">{item.variant_title}</div> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <LocationDialog
        isOpen={showAddressDialog}
        onClose={() => setShowAddressDialog(false)}
        title="View Address"
        locations={[]}
        onSelect={() => undefined}
        shippingAddress={order.shipping_address}
        readOnly
      />
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black bg-opacity-50">
          <div ref={noteModalRef} className="bg-white rounded-lg p-6 max-w-md w-full relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Add Note</h3>
              <button
                onClick={() => setIsNoteModalOpen(false)}
                className="p-1 rounded-full bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleNoteSubmit}>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="w-full h-32 p-2 border rounded-md mb-4 bg-white"
                placeholder="Enter your note here..."
              />
              <div className="flex justify-end">
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showTagDialog && (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black bg-opacity-50">
          <div ref={tagDialogRef} className="bg-white rounded-lg p-6 max-w-md w-full mx-4 relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Manage Tags</h3>
              <button
                onClick={() => setShowTagDialog(false)}
                className="p-1 rounded-full bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddTag} className="mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Enter new tag"
                  className="flex-1 p-2 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                <button type="submit" className="p-2 bg-white border border-gray-200 text-blue-600 rounded-md hover:border-blue-500 transition-colors">
                  <PlusIcon className="w-5 h-5" />
                </button>
              </div>
            </form>
            <div className="flex flex-wrap gap-2">
              {currentTags.map((tag, index) => (
                <div key={`${tag}-${index}`} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-md">
                  <span className="text-sm text-gray-700">{tag}</span>
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="p-1 bg-white border border-gray-200 rounded-md hover:border-red-300 transition-colors"
                  >
                    <XMarkIcon className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <Dialog open={showPinDialog} onClose={() => setShowPinDialog(false)} className="relative z-[11000]">
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
            <Dialog.Title className="text-base font-semibold text-gray-900">
              {hasExistingLocation ? 'Change location' : 'Add location'}
            </Dialog.Title>
            <p className="mt-1 text-sm text-gray-600">Paste coordinates as lat,long</p>
            <input
              type="text"
              value={pinInput}
              onChange={(event) => setPinInput(event.target.value)}
              placeholder="29.9942847,31.4339147"
              className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPinDialog(false)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePinTag}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
      <Dialog open={showTemplateDialog} onClose={() => setShowTemplateDialog(false)} className="relative z-[11000]">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto w-full max-w-md rounded-lg bg-white shadow-xl border border-gray-200 max-h-[80vh] flex flex-col relative">
            <button
              type="button"
              onClick={() => setShowTemplateDialog(false)}
              className="absolute top-3 right-3 p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg z-10"
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
            <div className="overflow-y-auto p-4 pt-12 space-y-2 flex-1">
              {allTemplates.length === 0 ? (
                <p className="text-sm text-gray-500">No templates. Add them in WhatsApp → Message templates.</p>
              ) : (
                [...allTemplates]
                  .sort((a, b) => (a.key === 'order_ready' ? -1 : b.key === 'order_ready' ? 1 : 0))
                  .map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSendTemplateSelect(t)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        t.key === 'order_ready'
                          ? 'bg-amber-50/90 border-amber-200 hover:border-amber-300 hover:bg-amber-100/90'
                          : 'border-gray-200 hover:border-[#25D366] hover:bg-green-50/50'
                      }`}
                    >
                      <span className="font-medium text-gray-900 block">{t.name}</span>
                      <span className="text-sm text-gray-600 line-clamp-2 mt-1 block">
                        {t.body.split(/\r?\n/).slice(0, 2).join(' ').slice(0, 80)}…
                      </span>
                    </button>
                  ))
              )}
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
      {openFloatingMenu
        ? createPortal(
            <div
              ref={floatingMenuRef}
              className="fixed z-[10050] rounded-lg border border-gray-200 bg-white p-1 shadow-lg ring-1 ring-black/5"
              style={{
                top: floatingMenuStyle.top,
                left:
                  openFloatingMenu === 'status' || openFloatingMenu === 'actions'
                    ? floatingMenuStyle.left - floatingMenuStyle.width
                    : floatingMenuStyle.left,
                width: floatingMenuStyle.width,
              }}
            >
              {openFloatingMenu === 'phone' ? (
                <>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                    disabled={!phoneDigits}
                    onClick={() => {
                      const formattedPhone = formatPhoneNumber(summary.phone || '');
                      if (readOnly) {
                        window.open(`https://wa.me/${formattedPhone}`, '_blank', 'noopener,noreferrer');
                      } else {
                        navigate(`/whatsapp?phone=${formattedPhone}`);
                      }
                      setOpenFloatingMenu(null);
                    }}
                  >
                    <ChatBubbleLeftIcon className="h-4 w-4 text-green-600" />
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                    disabled={!phoneDigits}
                    onClick={() => {
                      window.open(`tel:${phoneDigits}`, '_self');
                      setOpenFloatingMenu(null);
                    }}
                  >
                    <PhoneArrowUpRightIcon className="h-4 w-4 text-blue-600" />
                    Call Customer
                  </button>
                  {!readOnly ? (
                    <>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                        disabled={!phoneDigits}
                        onClick={() => {
                          const formattedPhone = formatPhoneNumber(summary.phone || '');
                          window.open(`https://wa.me/${formattedPhone}`, '_blank', 'noopener,noreferrer');
                          setOpenFloatingMenu(null);
                        }}
                      >
                        <img src={whatsappLogo} alt="WhatsApp" className="h-4 w-4" />
                        WhatsApp Business
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                        disabled={!summary.phone}
                        onClick={() => {
                          void copyText(formatPhoneNumber(summary.phone || ''), 'Phone number copied to clipboard');
                          setOpenFloatingMenu(null);
                        }}
                      >
                        <ClipboardDocumentIcon className="h-4 w-4 text-gray-500" />
                        Copy Number
                      </button>
                    </>
                  ) : null}
                </>
              ) : openFloatingMenu === 'map' ? (
                <>
                  <button
                    type="button"
                    className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
                    onClick={() => {
                      setShowAddressDialog(true);
                      setOpenFloatingMenu(null);
                    }}
                  >
                    View address
                  </button>
                  {!readOnly ? (
                    <>
                      <button
                        type="button"
                        className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-40"
                        disabled={!locationText}
                        onClick={() => {
                          if (locationText) void copyText(locationText, 'Location copied');
                          setOpenFloatingMenu(null);
                        }}
                      >
                        Copy location
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-40"
                        disabled={!googleMapsUrl}
                        onClick={() => {
                          if (googleMapsUrl) void copyText(googleMapsUrl, 'Google Maps URL copied');
                          setOpenFloatingMenu(null);
                        }}
                      >
                        Copy URL
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-40"
                    disabled={!googleMapsUrl}
                    onClick={() => {
                      if (googleMapsUrl) window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
                      setOpenFloatingMenu(null);
                    }}
                  >
                    Open location
                  </button>
                  {!readOnly ? (
                    <button
                      type="button"
                      className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
                      onClick={handleOpenPinDialog}
                    >
                      {hasExistingLocation ? 'Change location' : 'Add location'}
                    </button>
                  ) : null}
                </>
              ) : openFloatingMenu === 'status' && !readOnly ? (
                <div className="space-y-1 px-2 py-2">
                  {[
                    ['pending', 'Pending'],
                    ['order-ready', 'Order Ready'],
                    ['on_hold', 'On Hold'],
                    ['confirmed', 'Confirmed'],
                    ['ready_to_ship', 'Ready to Ship'],
                    ['shipped', 'Shipped'],
                    ['fulfilled', 'Fulfilled'],
                    ['paid', 'Paid'],
                    ['cancelled', 'Cancelled'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`w-full rounded-md py-1.5 text-center text-sm font-medium ${getStatusColor(value)}`}
                      onClick={() => {
                        handleStatusChange(value);
                        setOpenFloatingMenu(null);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : !readOnly ? (
                <div className="py-1">
                  <button
                    type="button"
                    onClick={handleAddNote}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <PencilIcon className="h-4 w-4" />
                    Add note
                  </button>
                  <button
                    type="button"
                    onClick={handleManageTags}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <TagIcon className="h-4 w-4" />
                    Manage tags
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTemplateDialog(true);
                      setOpenFloatingMenu(null);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    title="Send a message template via WhatsApp"
                  >
                    <DocumentTextIcon className="h-4 w-4" />
                    Send template
                  </button>
                  {!isOrderCancelled && (currentStatus === 'pending' || currentStatus === 'order-ready') ? (
                    <button
                      type="button"
                      onClick={handleOrderReadyAction}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <SparklesIcon className="h-4 w-4 text-blue-500" />
                      {currentStatus === 'pending' ? 'Mark as ready' : 'Confirm ready'}
                    </button>
                  ) : null}
                  {!isOrderCancelled ? (
                    <button
                      type="button"
                      onClick={handleTogglePriority}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <StarIcon className={`h-4 w-4 ${isPriority ? 'text-yellow-500' : 'text-gray-400'}`} />
                      {isPriority ? 'Remove priority' : 'Add priority'}
                    </button>
                  ) : null}
                  {isOrderCancelled && onDeleteOrder ? (
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteOrder(order.id);
                        setOpenFloatingMenu(null);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <TrashIcon className="h-4 w-4" />
                      Delete order
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
