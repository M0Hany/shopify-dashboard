import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import whatsappLogo from '../assets/whatsapp.png';
import { UserIcon, CurrencyDollarIcon, ExclamationTriangleIcon, PencilIcon, StarIcon as StarIconOutline, ChevronDownIcon, XMarkIcon, PhoneIcon, TruckIcon, TrashIcon, MapPinIcon, CheckIcon, CalendarIcon, TagIcon, PlusIcon, ChatBubbleLeftIcon, ClipboardDocumentIcon, EllipsisHorizontalIcon, DocumentTextIcon, ClockIcon, SparklesIcon, CheckBadgeIcon, PaperAirplaneIcon, XCircleIcon, BanknotesIcon, BoltIcon, HandRaisedIcon, HandThumbUpIcon, PauseCircleIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid, PhoneArrowUpRightIcon } from '@heroicons/react/24/solid';
import { convertToCairoTime, calculateDaysRemaining } from '../utils/dateUtils';
import { Menu, Dialog } from '@headlessui/react';
import { format } from 'date-fns';
import LocationDialog, { Zone, SubZone } from './ui/LocationDialog';
import { locationData } from '../data/locations';
import { toast } from 'react-hot-toast';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { useNavigate } from 'react-router-dom';

interface LocationSelections {
  cityId: string | null;
  neighborhoodId: string | null;
  subzoneId: string | null;
}

interface OrderCardProps {
  order: any;
  isSelected?: boolean;
  onSelect?: (orderId: number) => void;
  onUpdateStatus?: (orderId: number, status: string) => void;
  onDeleteOrder?: (orderId: number) => void;
  onUpdateNote?: (orderId: number, note: string) => void;
  onTogglePriority?: (orderId: number, isPriority: boolean) => void;
  onUpdateTags?: (orderId: number, newTags: string[]) => void;
  onUpdateDueDate?: (orderId: number, date: string) => void;
  onUpdateStartDate?: (orderId: number, date: string) => void;
}

// Add new ShippingStatus component
const ShippingStatus: React.FC<{ 
  orderTags: string[];
  orderId: number;
  fulfillments?: Array<{
    id: number;
    status: string;
    displayStatus?: string;
    tracking_company?: string;
    tracking_number?: string;
    created_at?: string;
    updated_at?: string;
  }>;
  onUpdateStatus?: (orderId: number, status: string) => void;
  onUpdateTags?: (orderId: number, newTags: string[]) => void;
}> = ({ orderTags, orderId, fulfillments, onUpdateStatus, onUpdateTags }) => {
  // Get delivery status from fulfillments displayStatus
  const getDeliveryStatus = (): string | null => {
    if (!fulfillments || fulfillments.length === 0) return null;
    
    // Find the most recent fulfillment with displayStatus
    const fulfillmentWithStatus = fulfillments
      .filter(f => f.displayStatus)
      .sort((a, b) => {
        const aDate = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const bDate = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return bDate - aDate; // Most recent first
      })[0];
    
    return fulfillmentWithStatus?.displayStatus || null;
  };

  // Map Shopify displayStatus enum to human-readable text
  const formatDisplayStatus = (displayStatus: string | null): string => {
    if (!displayStatus) return 'No status';
    
    // Map enum values to human-readable text
    const statusMap: Record<string, string> = {
      'IN_TRANSIT': 'In transit',
      'OUT_FOR_DELIVERY': 'Out for delivery',
      'ATTEMPTED_DELIVERY': 'Attempted delivery',
      'DELAYED': 'Delayed',
      'FAILED_DELIVERY': 'Failed delivery',
      'DELIVERED': 'Delivered',
      'TRACKING_ADDED': 'Tracking Added',
      'FULFILLED': 'Tracking Added',
      'NOT_DELIVERED': 'Cancelled',
      'NO_STATUS': 'No status'
    };
    
    return statusMap[displayStatus] || displayStatus.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  // Get color based on delivery status
  const getStatusColor = (displayStatus: string | null): { bg: string; border: string; text: string; icon: string } => {
    if (!displayStatus) {
      return {
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        text: 'text-gray-700',
        icon: 'text-gray-500'
      };
    }
    
    const statusUpper = displayStatus.toUpperCase();
    
    // Not Delivered = Cancelled (red, highlighted)
    if (statusUpper === 'NOT_DELIVERED') {
      return {
        bg: 'bg-red-50',
        border: 'border-red-300',
        text: 'text-red-800',
        icon: 'text-red-600'
      };
    } else if (statusUpper === 'DELIVERED') {
      return {
        bg: 'bg-green-50',
        border: 'border-green-300',
        text: 'text-green-800',
        icon: 'text-green-600'
      };
    } else if (statusUpper === 'IN_TRANSIT' || statusUpper === 'OUT_FOR_DELIVERY') {
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-300',
        text: 'text-blue-800',
        icon: 'text-blue-600'
      };
    } else if (statusUpper === 'DELAYED' || statusUpper === 'FAILED_DELIVERY' || statusUpper === 'ATTEMPTED_DELIVERY') {
      return {
        bg: 'bg-yellow-50',
        border: 'border-yellow-300',
        text: 'text-yellow-800',
        icon: 'text-yellow-600'
      };
    } else {
      // Fulfilled / Tracking Added - subtle gray (not picked up yet)
      return {
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        text: 'text-gray-700',
        icon: 'text-gray-500'
      };
    }
  };

  const deliveryStatus = getDeliveryStatus();
  const formattedStatus = formatDisplayStatus(deliveryStatus);
  const colors = getStatusColor(deliveryStatus);
  const isNotDelivered = deliveryStatus?.toUpperCase() === 'NOT_DELIVERED';
  const isShipped = orderTags.some((tag: string) => tag.trim().toLowerCase() === 'shipped');

  const handleMarkAsCancelled = () => {
    if (!onUpdateTags || !onUpdateStatus) return;
    
    const currentTags: string[] = Array.isArray(orderTags) 
      ? orderTags 
      : typeof orderTags === 'string'
        ? orderTags.split(',').map((t: string) => t.trim())
        : [];
    
    // Remove existing status tags
    const statusTags = ['order_ready', 'on_hold', 'customer_confirmed', 'ready_to_ship', 'shipped', 'fulfilled'];
    let filtered = currentTags.filter((tag: string) => {
      const trimmed = tag.trim().toLowerCase();
      return !statusTags.some((st: string) => st.trim().toLowerCase() === trimmed) &&
             !tag.trim().toLowerCase().startsWith('cancellation_reason:');
    });
    
    // Add cancelled tag
    filtered = [...filtered, 'cancelled'];
    
    // Add cancelled_date tag
    const today = format(new Date(), 'yyyy-MM-dd');
    filtered = filtered.filter(tag => !tag.toLowerCase().startsWith('cancelled_date:'));
    filtered = [...filtered, `cancelled_date:${today}`];
    
    // If order is shipped, add cancelled_after_shipping tag
    if (isShipped) {
      filtered = [...filtered, 'cancelled_after_shipping'];
    }
    
    // Update tags first
    onUpdateTags(orderId, filtered);
    
    // Then update status
    onUpdateStatus(orderId, 'cancelled');
  };

  return (
    <div className={`w-full mb-4 p-4 rounded-lg border-2 ${colors.bg} ${colors.border} shadow-sm`}>
      <div className="flex items-center gap-3">
        <TruckIcon className={`w-6 h-6 ${colors.icon} flex-shrink-0`} />
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
            Delivery Status
          </div>
          <div className={`text-lg font-bold ${colors.text}`}>
            {formattedStatus}
          </div>
        </div>
        {isNotDelivered && onUpdateStatus && onUpdateTags && (
          <button
            onClick={handleMarkAsCancelled}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors whitespace-nowrap"
          >
            Mark as Cancelled
          </button>
        )}
      </div>
    </div>
  );
};

const OrderCard: React.FC<OrderCardProps> = ({ 
  order, 
  isSelected = false,
  onSelect,
  onUpdateStatus,
  onDeleteOrder,
  onUpdateNote,
  onTogglePriority,
  onUpdateTags,
  onUpdateDueDate,
  onUpdateStartDate
}) => {
  const navigate = useNavigate();
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [showReadyConfirmDialog, setShowReadyConfirmDialog] = useState(false);
  const [note, setNote] = useState('');
  const [noteText, setNoteText] = useState(order.note || '');
  const [whatsAppMessage, setWhatsAppMessage] = useState('');
  const [tempLocationSelections, setTempLocationSelections] = useState<LocationSelections | null>(null);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isShippedModalOpen, setIsShippedModalOpen] = useState(false);
  const [isScooterShippingCostModalOpen, setIsScooterShippingCostModalOpen] = useState(false);
  const [scooterShippingCost, setScooterShippingCost] = useState('');
  const [scooterFulfillmentDate, setScooterFulfillmentDate] = useState<Date>(new Date());
  const [isCompanyShippingCostModalOpen, setIsCompanyShippingCostModalOpen] = useState(false);
  const [companyShippingCost, setCompanyShippingCost] = useState('');
  const [companyFulfillmentDate, setCompanyFulfillmentDate] = useState<Date>(new Date());
  const [isPickupFulfillmentDateModalOpen, setIsPickupFulfillmentDateModalOpen] = useState(false);
  const [pickupFulfillmentDate, setPickupFulfillmentDate] = useState<Date>(new Date());
  const [isCancellationReasonModalOpen, setIsCancellationReasonModalOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [pendingCancellationStatus, setPendingCancellationStatus] = useState<string | null>(null);
  const [isNeighborhoodDialogOpen, setIsNeighborhoodDialogOpen] = useState(false);
  const [isSubzoneDialogOpen, setIsSubzoneDialogOpen] = useState(false);
  const [isCityDialogOpen, setIsCityDialogOpen] = useState(false);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<Zone | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const [orderNumberCopied, setOrderNumberCopied] = useState(false);
  const [phoneNumberCopied, setPhoneNumberCopied] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const noteModalRef = useRef<HTMLDivElement>(null);
  const whatsAppModalRef = useRef<HTMLDivElement>(null);
  const shippedModalRef = useRef<HTMLDivElement>(null);
  const tags = Array.isArray(order.tags) ? order.tags :
              typeof order.tags === 'string' ? order.tags.split(',').map((t: string) => t.trim()) :
              [];
  // Local state for instant UI feedback
  const [localPriority, setLocalPriority] = useState(tags.map((t: string) => t.trim()).includes('priority'));
  useEffect(() => {
    setLocalPriority(tags.map((t: string) => t.trim()).includes('priority'));
  }, [order.tags]);
  const isPriority = localPriority;
  
  // Ensure all tags are trimmed before searching
  const trimmedTags = tags.map((tag: string) => tag.trim());
  
  // Check if order is order-ready
  const isOrderReady = trimmedTags.some((tag: string) => tag.trim().toLowerCase() === 'order_ready');
  
  // Check if order is cancelled with no_reply_cancelled tag
  const isNoReplyCancelled = trimmedTags.some((tag: string) => tag.trim().toLowerCase() === 'no_reply_cancelled');
  
  // Check if order was confirmed from on_hold
  const isConfirmedFromOnHold = trimmedTags.some((tag: string) => tag.trim().toLowerCase() === 'confirmed_from_on_hold');
  
  // Check if manual WhatsApp confirmation has been sent
  const hasManualWhatsAppConfirmation = trimmedTags.includes('manual_whatsapp_confirmation');
  
  // Check if automated WhatsApp confirmation tag exists
  const hasAutomatedWhatsAppConfirmation = trimmedTags.includes('automated_whatsapp_confirmation');

  // Fetch manual WhatsApp confirmation template from API (for inline button when order ready)
  const { data: manualConfirmationTemplate } = useQuery({
    queryKey: ['whatsapp-template', 'manual_whatsapp_confirmation'],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/whatsapp/templates/key/manual_whatsapp_confirmation`);
      if (!res.ok) return null;
      const json = await res.json();
      return json as { id: string; key: string; name: string; body: string };
    },
  });

  // Fetch all templates when Send template dialog is open
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

  // Utility function to detect making time from line items
  const detectMakingTime = (lineItems: any[]): number | null => {
    if (!lineItems || lineItems.length === 0) return null;
    
    // Look for addon line items that contain making time information
    for (const item of lineItems) {
      const title = item.title || '';
      
      // Check for "Rush My Order [3 days]" pattern in title
      const rushMatch = title.match(/rush.*?\[(\d+)\s*days?\]/i);
      if (rushMatch) {
        return parseInt(rushMatch[1], 10);
      }
      
      // Check for "Handmade Timeline [7 days]" pattern in title
      const handmadeMatch = title.match(/handmade.*?\[(\d+)\s*days?\]/i);
      if (handmadeMatch) {
        return parseInt(handmadeMatch[1], 10);
      }
      
      // Check properties for making time (for all line items, not just making time ones)
      if (item.properties && Array.isArray(item.properties)) {
        for (const prop of item.properties) {
          const propName = (prop.name || '').toLowerCase();
          const propValue = prop.value || '';
          
          // Check if this property is related to making time
          if (propName.includes('making time') || propName.includes('timeline') || propName.includes('rush')) {
            // Check for rush pattern
            const rushPropMatch = propValue.match(/rush.*?\[(\d+)\s*days?\]/i);
            if (rushPropMatch) {
              return parseInt(rushPropMatch[1], 10);
            }
            // Check for handmade pattern
            const handmadePropMatch = propValue.match(/handmade.*?\[(\d+)\s*days?\]/i);
            if (handmadePropMatch) {
              return parseInt(handmadePropMatch[1], 10);
            }
            // Check for just the number of days
            const daysMatch = propValue.match(/(\d+)\s*days?/i);
            if (daysMatch && (propValue.toLowerCase().includes('rush') || propValue.toLowerCase().includes('3'))) {
              return parseInt(daysMatch[1], 10);
            }
            if (daysMatch && (propValue.toLowerCase().includes('handmade') || propValue.toLowerCase().includes('7'))) {
              return parseInt(daysMatch[1], 10);
            }
          }
        }
      }
      
      // Check for "Choose your making time:" line items
      if (title.toLowerCase().includes('making time') || title.toLowerCase().includes('choose your')) {
        // If it's a making time line item, check if it has a value that indicates rush or handmade
        if (title.toLowerCase().includes('rush') || title.match(/3\s*days?/i)) {
          return 3;
        }
        if (title.toLowerCase().includes('handmade') || title.match(/7\s*days?/i)) {
          return 7;
        }
      }
    }
    
    return null;
  };

  // Detect rush type from line items (Rushed, Standard, or Mix)
  const getRushType = (): 'Rushed' | 'Standard' | 'Mix' => {
    const lineItems = order.line_items || [];
    if (lineItems.length === 0) return 'Standard';
    
    let hasRushed = false;
    let hasStandard = false;
    
    // Check each line item for making time
    for (const item of lineItems) {
      const makingTimeDays = detectMakingTime([item]);
      if (makingTimeDays === 3) {
        hasRushed = true;
      } else if (makingTimeDays === 7 || makingTimeDays === null) {
        hasStandard = true;
      }
    }
    
    // If order has both rushed and standard items, it's a Mix
    if (hasRushed && hasStandard) {
      return 'Mix';
    }
    
    // If only rushed items found
    if (hasRushed) {
      return 'Rushed';
    }
    
    // Default to Standard
    return 'Standard';
  };

  const rushType = getRushType();
  const isRushOrder = rushType === 'Rushed';
  const isHandmadeOrder = rushType === 'Standard' && !isRushOrder;
  
  // Separate regular line items from addon line items
  const regularLineItems = (order.line_items || []).filter((item: any) => {
    const title = (item.title || '').toLowerCase();
    // Filter out addon line items (making time options)
    return !title.includes('choose your making time') && 
           !title.includes('making time') &&
           !title.match(/rush.*?\[.*?days?\]/i) &&
           !title.match(/handmade.*?\[.*?days?\]/i);
  });
  
  const addonLineItems = (order.line_items || []).filter((item: any) => {
    const title = (item.title || '').toLowerCase();
    // Include addon line items
    return title.includes('choose your making time') || 
           title.includes('making time') ||
           title.match(/rush.*?\[.*?days?\]/i) ||
           title.match(/handmade.*?\[.*?days?\]/i);
  });

  const dueDateTag = trimmedTags.find((tag: string) => tag.startsWith('custom_due_date:'));
  const startDateTag = trimmedTags.find((tag: string) => tag.startsWith('custom_start_date:'));
  const orderReadyDateTag = trimmedTags.find((tag: string) => tag.toLowerCase().startsWith('order_ready_date:'));
  const movedToOnHoldDateTag = trimmedTags.find((tag: string) => tag.toLowerCase().startsWith('moved_to_on_hold:'));
  const customerConfirmedDateTag = trimmedTags.find((tag: string) => tag.toLowerCase().startsWith('customer_confirmed_date:'));
  const shippedDateTag = trimmedTags.find((tag: string) => tag.toLowerCase().startsWith('shipped_date:') || tag.toLowerCase().startsWith('shipping_date:'));
  
  // Calculate dates in Cairo timezone
  let startDate;
  if (startDateTag) {
    const dateStr = startDateTag.split(':')[1];
    const parsedDate = convertToCairoTime(new Date(dateStr));
    if (!isNaN(parsedDate.getTime())) {
      startDate = parsedDate;
    }
  }
  
  if (!startDate) {
    startDate = convertToCairoTime(new Date(order.created_at));
  }
  
  let dueDate;
  if (dueDateTag) {
    const dateStr = dueDateTag.split(':')[1];
    const parsedDate = convertToCairoTime(new Date(dateStr));
    if (!isNaN(parsedDate.getTime())) {
      dueDate = parsedDate;
    }
  }
  
  if (!dueDate) {
    // Calculate due date based on making time if detected, otherwise default to 7 days
    // For mixed orders, use the longest making time (7 days for standard)
    const makingTimeDays = detectMakingTime(order.line_items || []);
    const daysToAdd = makingTimeDays || 7;
    dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + daysToAdd);
    dueDate = convertToCairoTime(dueDate);
  }

  // Ensure both dates are valid
  if (isNaN(startDate.getTime()) || isNaN(dueDate.getTime())) {
    console.error('Invalid dates:', { startDate, dueDate, order });
    // Fallback to created_at + 7 days if dates are invalid
    startDate = convertToCairoTime(new Date(order.created_at));
    dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + 7);
    dueDate = convertToCairoTime(dueDate);
  }

  // Calculate days left
  const calculateDaysLeft = (): number => {
    try {
      const now = convertToCairoTime(new Date());
      return calculateDaysRemaining(dueDate, now);
    } catch (error) {
      return 7; // Default fallback
    }
  };

  const daysLeft = calculateDaysLeft();

  // Get days left badge styling
  const getDaysLeftBadgeStyle = () => {
    if (daysLeft < 0) {
      return 'bg-red-100 text-red-700 border-red-200';
    } else if (daysLeft === 0) {
      return 'bg-orange-100 text-orange-700 border-orange-200';
    } else if (daysLeft <= 2) {
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    } else if (daysLeft <= 4) {
      return 'bg-amber-100 text-amber-700 border-amber-200';
    } else {
      return 'bg-green-100 text-green-700 border-green-200';
    }
  };

  const getDaysLeftText = () => {
    // Return just the number, negative for overdue, "Today" for 0
    if (daysLeft === 0) {
      return 'Today';
    }
    return `${daysLeft}`;
  };

  // Calculate days since order_ready_date
  const getDaysInOrderReady = (): number | null => {
    if (!orderReadyDateTag) return null;
    try {
      const dateStr = orderReadyDateTag.split(':')[1];
      const orderReadyDate = convertToCairoTime(new Date(dateStr));
      if (isNaN(orderReadyDate.getTime())) return null;
      
      const now = convertToCairoTime(new Date());
      // Reset hours to midnight for accurate day calculation
      const orderReady = new Date(orderReadyDate);
      orderReady.setHours(0, 0, 0, 0);
      const current = new Date(now);
      current.setHours(0, 0, 0, 0);
      
      // Calculate days from order_ready_date to now
      const diffTime = current.getTime() - orderReady.getTime();
      const days = Math.round(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, days); // Don't show negative days
    } catch (error) {
      return null;
    }
  };

  // Calculate days since moved_to_on_hold
  const getDaysInOnHold = (): number | null => {
    if (!movedToOnHoldDateTag) return null;
    try {
      const dateStr = movedToOnHoldDateTag.split(':')[1];
      const onHoldDate = convertToCairoTime(new Date(dateStr));
      if (isNaN(onHoldDate.getTime())) return null;
      
      const now = convertToCairoTime(new Date());
      // Reset hours to midnight for accurate day calculation
      const onHold = new Date(onHoldDate);
      onHold.setHours(0, 0, 0, 0);
      const current = new Date(now);
      current.setHours(0, 0, 0, 0);
      
      // Calculate days from moved_to_on_hold to now
      const diffTime = current.getTime() - onHold.getTime();
      const days = Math.round(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, days); // Don't show negative days
    } catch (error) {
      return null;
    }
  };

  // Calculate days since customer_confirmed_date
  const getDaysInConfirmed = (): number | null => {
    if (!customerConfirmedDateTag) return null;
    try {
      const dateStr = customerConfirmedDateTag.split(':')[1];
      const confirmedDate = convertToCairoTime(new Date(dateStr));
      if (isNaN(confirmedDate.getTime())) return null;
      
      const now = convertToCairoTime(new Date());
      // Reset hours to midnight for accurate day calculation
      const confirmed = new Date(confirmedDate);
      confirmed.setHours(0, 0, 0, 0);
      const current = new Date(now);
      current.setHours(0, 0, 0, 0);
      
      // Calculate days from customer_confirmed_date to now
      const diffTime = current.getTime() - confirmed.getTime();
      const days = Math.round(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, days); // Don't show negative days
    } catch (error) {
      return null;
    }
  };

  // Calculate days since shipped_date
  const getDaysInShipped = (): number | null => {
    if (!shippedDateTag) return null;
    try {
      const dateStr = shippedDateTag.split(':')[1];
      const shippedDate = convertToCairoTime(new Date(dateStr));
      if (isNaN(shippedDate.getTime())) return null;
      
      const now = convertToCairoTime(new Date());
      // Reset hours to midnight for accurate day calculation
      const shipped = new Date(shippedDate);
      shipped.setHours(0, 0, 0, 0);
      const current = new Date(now);
      current.setHours(0, 0, 0, 0);
      
      // Calculate days from shipped_date to now
      const diffTime = current.getTime() - shipped.getTime();
      const days = Math.round(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, days); // Don't show negative days
    } catch (error) {
      return null;
    }
  };

  const daysInOrderReady = getDaysInOrderReady();
  const daysInOnHold = getDaysInOnHold();
  const daysInConfirmed = getDaysInConfirmed();
  const daysInShipped = getDaysInShipped();

  // Determine the current status based on tags and fulfillment status
  const getCurrentStatus = () => {
    // Trim all tags for consistent matching
    const trimmedTags = tags.map((tag: string) => tag.trim());
    
    // Define status tags with proper trimming (case-insensitive)
    const statusTags = {
      cancelled: 'cancelled',
      paid: 'paid',
      fulfilled: 'fulfilled',
      shipped: 'shipped',
              readyToShip: 'ready_to_ship',
      customerConfirmed: 'customer_confirmed',
      onHold: 'on_hold',
      orderReady: 'order_ready'
    } as const;
    
    if (trimmedTags.some((tag: string) => tag.trim().toLowerCase() === statusTags.cancelled.toLowerCase())) {
      return 'cancelled';
    } else if (trimmedTags.some((tag: string) => tag.trim().toLowerCase() === statusTags.paid.toLowerCase())) {
      return 'paid';
    } else if (trimmedTags.some((tag: string) => tag.trim().toLowerCase() === statusTags.fulfilled.toLowerCase())) {
      return 'fulfilled';
    } else if (trimmedTags.some((tag: string) => tag.trim().toLowerCase() === statusTags.shipped.toLowerCase())) {
      return 'shipped';
    } else if (trimmedTags.some((tag: string) => tag.trim().toLowerCase() === statusTags.readyToShip.toLowerCase())) {
      return 'ready_to_ship';
    } else if (trimmedTags.some((tag: string) => tag.trim().toLowerCase() === statusTags.customerConfirmed.toLowerCase())) {
      return 'confirmed';
    } else if (trimmedTags.some((tag: string) => tag.trim().toLowerCase() === statusTags.onHold.toLowerCase())) {
      return 'on_hold';
    } else if (trimmedTags.some((tag: string) => tag.trim().toLowerCase() === statusTags.orderReady.toLowerCase())) {
      return 'order-ready';
    } else {
      return 'pending';
    }
  };

  const [currentStatus, setCurrentStatus] = useState(getCurrentStatus());

  useEffect(() => {
    setCurrentStatus(getCurrentStatus());
  }, [order.tags, order.fulfillment_status]);

  const getStatusColor = (status: string) => {
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
  };

  const getStatusIcon = (status: string) => {
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
  };

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === currentStatus) return;
    
    // If the new status is cancelled, open cancellation reason dialog
    if (newStatus === 'cancelled') {
      setPendingCancellationStatus('cancelled');
      setCancellationReason('');
      setIsCancellationReasonModalOpen(true);
      return; // Don't update status yet, wait for reason
    }
    
    // Store the previous status before updating to the new one
    const previousStatus = currentStatus;
    
    // Update the local status immediately for UI feedback
    setCurrentStatus(newStatus);
    
    // If the new status is shipped, open the shipping notification modal
    // Use setTimeout to ensure the modal opens after the status update is processed
    if (newStatus === 'shipped') {
      // Short timeout to ensure the modal opens after the status update
      setTimeout(() => {
        setIsShippedModalOpen(true);
      }, 100);
    }

    // Add fulfillment date tag when status changes to fulfilled
    if (newStatus === 'fulfilled') {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // Check if shipping method is Scooter
      const shippingMethod = getShippingMethod();
      if (shippingMethod === 'Scooter') {
        // Check if scooter shipping cost tag already exists
        const scooterCostTag = trimmedTags.find((tag: string) => tag.trim().startsWith('scooter_shipping_cost:'));
        if (!scooterCostTag) {
          // Open scooter shipping cost dialog
          setTimeout(() => {
            setScooterFulfillmentDate(new Date()); // Reset to today when opening
            setIsScooterShippingCostModalOpen(true);
          }, 100);
          // Don't update status yet - wait for cost input
          return;
        }
      }
      
      // Check if shipping method is Other Company
      if (shippingMethod === 'Other Company') {
        // Check if shipping company cost tag already exists
        const companyCostTag = trimmedTags.find((tag: string) => tag.trim().startsWith('shipping_company_cost:'));
        if (!companyCostTag) {
          // Open company shipping cost dialog
          setTimeout(() => {
            setCompanyFulfillmentDate(new Date()); // Reset to today when opening
            setIsCompanyShippingCostModalOpen(true);
          }, 100);
          // Don't update status yet - wait for cost input
          return;
        }
      }
      
      // Check if shipping method is Pickup - open date picker dialog
      if (shippingMethod === 'Pickup') {
        // Open pickup fulfillment date dialog
        setTimeout(() => {
          setPickupFulfillmentDate(new Date()); // Reset to today when opening
          setIsPickupFulfillmentDateModalOpen(true);
        }, 100);
        // Don't update status yet - wait for date input
        return;
      }
      
      if (onUpdateStatus) {
        // Remove priority tag and add fulfillment date
        setLocalPriority(false);
        onUpdateStatus(order.id, `${newStatus},fulfillment_date:${today}`.trim());
        return;
      }
    }
    
    // Send status update to the server
    if (onUpdateStatus) {
      // Map the status to the correct tag (trimmed and case-insensitive)
      let statusTag = newStatus.trim();
      if (newStatus.trim().toLowerCase() === 'confirmed') {
        statusTag = 'customer_confirmed';
      } else if (newStatus.trim().toLowerCase() === 'order-ready') {
        statusTag = 'order_ready';
        // Add order_ready tag and order_ready_date tag when manually changing to order-ready
        const currentTags = getCurrentTags();
        const today = format(new Date(), 'yyyy-MM-dd');
        const orderReadyDateTag = `order_ready_date:${today}`;
        // Remove any existing order_ready and order_ready_date tags
        const filteredTags = currentTags.filter((tag: string) => 
          !tag.startsWith('order_ready_date:') && tag.trim().toLowerCase() !== 'order_ready'
        );
        const updatedTags = [...filteredTags, 'order_ready', orderReadyDateTag];
        if (onUpdateTags) {
          onUpdateTags(order.id, updatedTags);
        }
      } else if (newStatus.trim().toLowerCase() === 'on_hold') {
        statusTag = 'on_hold';
      }
      onUpdateStatus(order.id, statusTag);
    }
  };

  // Add useEffect to ensure the shipped modal opens when status changes to shipped
  useEffect(() => {
    if (currentStatus === 'shipped' && 
        !isShippedModalOpen && 
        order.customer?.phone &&
        tags.includes('__status_just_updated')) {
      setIsShippedModalOpen(true);
    }
  }, [currentStatus, order.customer?.phone, tags]);

  const handleFulfillOrder = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUpdateStatus) {
      onUpdateStatus(order.id, 'fulfilled');
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(order.id);
    }
  };

  const handleNoteIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsNoteModalOpen(true);
  };

  const handleChatIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsWhatsAppModalOpen(true);
  };

  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateNote) {
      onUpdateNote(order.id, noteText);
    }
    setIsNoteModalOpen(false);
  };

  const handleWhatsAppMessageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatsAppMessage.trim() || !order.customer?.phone) return;
    
    // Format phone and message for WhatsApp link
    const formattedPhone = formatPhoneNumber(order.customer.phone);
    const encodedMessage = encodeURIComponent(whatsAppMessage);
    
    // Create a WhatsApp link that works with both Web and Business App
    const whatsAppLink = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
    
    // Open in a new tab
    window.open(whatsAppLink, '_blank');
    
    setWhatsAppMessage('');
    setIsWhatsAppModalOpen(false);
  };

  const handleSendConfirmation = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!order.customer?.phone) return;
    
    // Format phone for WhatsApp link
    const formattedPhone = formatPhoneNumber(order.customer.phone);
    
    // Get the confirmation template
    const confirmationTemplate = getConfirmationTemplate(order.customer.first_name);
    
    // Create a WhatsApp link
    const whatsAppLink = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(confirmationTemplate)}`;
    
    // Open in a new tab
    window.open(whatsAppLink, '_blank');
    
    setIsWhatsAppModalOpen(false);
  };

  const handleSendShippingNotification = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!order.customer?.phone) return;
    
    // Format phone for WhatsApp link
    const formattedPhone = formatPhoneNumber(order.customer.phone);
    
    // Get the shipping notification template
    const shippingTemplate = getShippingTemplate(order.customer.first_name);
    
    // Create a WhatsApp link
    const whatsAppLink = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(shippingTemplate)}`;
    
    // Open in a new tab
    window.open(whatsAppLink, '_blank');
    
    setIsShippedModalOpen(false);
  };

  const handleScooterShippingCostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseFloat(scooterShippingCost);
    
    if (isNaN(cost) || cost < 0) {
      toast.error('Please enter a valid shipping cost');
      return;
    }
    
    // Get current tags
    const currentTags = getCurrentTags();
    
    // Remove any existing scooter_shipping_cost, paid, paid_date, and fulfillment_date tags
    const tagsWithoutCost = currentTags.filter((tag: string) => 
      !tag.trim().startsWith('scooter_shipping_cost:') &&
      tag.trim() !== 'paid' &&
      !tag.trim().startsWith('paid_date:') &&
      !tag.trim().startsWith('fulfillment_date:')
    );
    
    // Format selected date
    const selectedDate = format(scooterFulfillmentDate, 'yyyy-MM-dd');
    
    // Add new scooter_shipping_cost, paid, paid_date, and fulfillment_date tags
    const updatedTags = [
      ...tagsWithoutCost, 
      `scooter_shipping_cost:${cost}`,
      'paid',
      `paid_date:${selectedDate}`,
      `fulfillment_date:${selectedDate}`
    ];
    
    // Update tags
    if (onUpdateTags) {
      onUpdateTags(order.id, updatedTags);
    }
    
    // Now update status to fulfilled
    if (onUpdateStatus) {
      setLocalPriority(false);
      onUpdateStatus(order.id, 'fulfilled');
    }
    
    // Close modal and reset cost and date
    setIsScooterShippingCostModalOpen(false);
    setScooterShippingCost('');
    setScooterFulfillmentDate(new Date());
    toast.success('Scooter shipping cost saved');
  };

  const handleCompanyShippingCostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseFloat(companyShippingCost);
    
    if (isNaN(cost) || cost < 0) {
      toast.error('Please enter a valid shipping cost');
      return;
    }
    
    // Get current tags
    const currentTags = getCurrentTags();
    
    // Remove any existing shipping_company_cost, paid, paid_date, and fulfillment_date tags
    const tagsWithoutCost = currentTags.filter((tag: string) => 
      !tag.trim().startsWith('shipping_company_cost:') &&
      !tag.trim().startsWith('shipping_company_cost_date:') &&
      tag.trim() !== 'paid' &&
      !tag.trim().startsWith('paid_date:') &&
      !tag.trim().startsWith('fulfillment_date:')
    );
    
    // Format selected date
    const selectedDate = format(companyFulfillmentDate, 'yyyy-MM-dd');
    
    // Add new shipping_company_cost, shipping_company_cost_date, paid, paid_date, and fulfillment_date tags
    const updatedTags = [
      ...tagsWithoutCost, 
      `shipping_company_cost:${cost}`,
      `shipping_company_cost_date:${selectedDate}`,
      'paid',
      `paid_date:${selectedDate}`,
      `fulfillment_date:${selectedDate}`
    ];
    
    // Update tags
    if (onUpdateTags) {
      onUpdateTags(order.id, updatedTags);
    }
    
    // Now update status to fulfilled
    if (onUpdateStatus) {
      setLocalPriority(false);
      onUpdateStatus(order.id, 'fulfilled');
    }
    
    // Close modal and reset cost and date
    setIsCompanyShippingCostModalOpen(false);
    setCompanyShippingCost('');
    setCompanyFulfillmentDate(new Date());
    toast.success('Shipping company cost saved');
  };

  const handlePickupFulfillmentDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Get current tags
    const currentTags = getCurrentTags();
    
    // Remove any existing paid, paid_date, and fulfillment_date tags
    const tagsWithoutPaid = currentTags.filter((tag: string) => 
      tag.trim() !== 'paid' &&
      !tag.trim().startsWith('paid_date:') &&
      !tag.trim().startsWith('fulfillment_date:')
    );
    
    // Format selected date
    const selectedDate = format(pickupFulfillmentDate, 'yyyy-MM-dd');
    
    // Add paid, paid_date, and fulfillment_date tags for pickup orders
    const updatedTags = [
      ...tagsWithoutPaid,
      'paid',
      `paid_date:${selectedDate}`,
      `fulfillment_date:${selectedDate}`
    ];
    
    // Update tags
    if (onUpdateTags) {
      onUpdateTags(order.id, updatedTags);
    }
    
    // Now update status to fulfilled
    if (onUpdateStatus) {
      setLocalPriority(false);
      onUpdateStatus(order.id, `fulfilled,fulfillment_date:${selectedDate}`.trim());
    }
    
    // Close modal and reset date
    setIsPickupFulfillmentDateModalOpen(false);
    setPickupFulfillmentDate(new Date());
    toast.success('Pickup order fulfilled');
  };
  
  const handleCancellationReasonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellationReason.trim()) {
      toast.error('Please enter a cancellation reason');
      return;
    }
    
    // Get current tags
    const currentTags = getCurrentTags();
    
    // Check if order is shipped
    const isShipped = trimmedTags.includes('shipped');
    
    // Remove existing status tags and cancellation_reason tag
    const statusTags = ['order_ready', 'on_hold', 'customer_confirmed', 'ready_to_ship', 'shipped', 'fulfilled'];
    let filtered = currentTags.filter((tag: string) => {
      const trimmed = tag.trim().toLowerCase();
      return !statusTags.some(st => st.trim().toLowerCase() === trimmed) &&
             !tag.trim().toLowerCase().startsWith('cancellation_reason:');
    });
    
    // Add cancelled tag and cancellation reason tag
    filtered = [...filtered, 'cancelled', `cancellation_reason:${cancellationReason.trim()}`];
    
    // Add cancelled_date tag
    const today = format(new Date(), 'yyyy-MM-dd');
    filtered = filtered.filter(tag => !tag.toLowerCase().startsWith('cancelled_date:'));
    filtered = [...filtered, `cancelled_date:${today}`];
    
    // If order is shipped, add cancelled_after_shipping tag
    if (isShipped) {
      filtered = [...filtered, 'cancelled_after_shipping'];
    }
    
    // Update tags first
    if (onUpdateTags) {
      onUpdateTags(order.id, filtered);
    }
    
    // Then update status
    if (onUpdateStatus) {
      setLocalPriority(false);
      onUpdateStatus(order.id, 'cancelled');
    }
    
    // Update local status
    setCurrentStatus('cancelled');
    
    // Close modal and reset
    setIsCancellationReasonModalOpen(false);
    setCancellationReason('');
    setPendingCancellationStatus(null);
    toast.success('Order cancelled');
  };
  
  // Format phone number for WhatsApp
  const formatPhoneNumber = (phone: string): string => {
    // Remove any non-numeric characters
    let formatted = phone.replace(/\D/g, '');
    
    // Ensure it starts with country code (e.g., 20 for Egypt)
    if (!formatted.startsWith('20') && formatted.startsWith('0')) {
      formatted = '20' + formatted.substring(1);
    } else if (!formatted.startsWith('20') && !formatted.startsWith('0')) {
      formatted = '20' + formatted;
    }
    
    return formatted;
  };

  // Function to open WhatsApp chat with customer
  const handleWhatsAppChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!order.customer?.phone) return;
    
    const formattedPhone = formatPhoneNumber(order.customer.phone);
    navigate(`/whatsapp?phone=${formattedPhone}`);
  };

  // Function to copy phone number to clipboard
  const handleCopyPhone = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!order.customer?.phone) return;
    
    try {
      const formattedPhone = formatPhoneNumber(order.customer.phone);
      await navigator.clipboard.writeText(formattedPhone);
      setPhoneNumberCopied(true);
      toast.success('Phone number copied to clipboard');
      setTimeout(() => setPhoneNumberCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy phone number:', error);
      toast.error('Failed to copy phone number');
    }
  };

  // Handle phone number click to copy
  const handlePhoneNumberClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await handleCopyPhone(e);
  };

  // Function to dial customer phone number
  const handleDialPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!order.customer?.phone) return;
    
    // Format phone number for tel: link
    const cleaned = order.customer.phone.replace(/\D/g, '');
    const telLink = `tel:${cleaned}`;
    
    // Open dialer
    window.location.href = telLink;
  };

  // Function to open WhatsApp Business app with customer number
  const handleWhatsAppBusiness = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!order.customer?.phone) return;
    
    // Format phone number for WhatsApp
    const formattedPhone = formatPhoneNumber(order.customer.phone);
    
    // Create WhatsApp Business link (wa.me works for both web and mobile, opens Business app on mobile)
    const whatsAppLink = `https://wa.me/${formattedPhone}`;
    
    // Open WhatsApp
    window.open(whatsAppLink, '_blank');
  };
  
  // Get confirmation message template
  const getConfirmationTemplate = (customerName: string): string => {
    return `Hello ${customerName}✨
OCD Crochet here, your order is confirmed! 

Since every piece is handmade by one person, delivery may take around 2 weeks. 

Thank you for your patience!
Please kindly confirm 🤍`;
  };

  // Get shipping notification message template
  const getShippingTemplate = (customerName: string): string => {
    return `Hello ${customerName}, this is OCD crochet✨
Your order is being picked up by the shipping company and should be arriving to you in the next couple of days🚚`;
  };

  // Get manual WhatsApp confirmation message template
  const getManualWhatsAppConfirmationTemplate = (customerFirstName: string, orderItems: any[]): string => {
    const itemsList = orderItems.map(item => {
      const variant = item.variant_title ? ` (${item.variant_title})` : '';
      return `- ${item.title}${variant}`;
    }).join('\n');
    
    return `Good evening ${customerFirstName}, this is OCD Crochet ✨

Your order for:

${itemsList}

is being shipped and it usually arrives within 2–3 working days.

Could you kindly confirm if you'll be available to receive it during that time? 💌`;
  };

  // Handle manual WhatsApp confirmation button click
  const handleManualWhatsAppConfirmation = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!order.customer?.phone || !isOrderReady) return;

    const customerFirstName = order.customer.first_name || '';
    const orderItems = order.line_items || [];
    const itemsList = orderItems.map((item: any) => {
      const variant = item.variant_title ? ` (${item.variant_title})` : '';
      return `- ${item.title}${variant}`;
    }).join('\n');

    let message: string;
    if (manualConfirmationTemplate?.body) {
      message = manualConfirmationTemplate.body
        .replace(/\{\{customer_first_name\}\}/g, customerFirstName)
        .replace(/\{\{items_list\}\}/g, itemsList);
    } else {
      message = getManualWhatsAppConfirmationTemplate(customerFirstName, orderItems);
    }

    // Format phone number for WhatsApp
    const formattedPhone = formatPhoneNumber(order.customer.phone);
    
    // Encode the message
    const encodedMessage = encodeURIComponent(message);
    
    // Create WhatsApp Business link (wa.me works for both web and mobile)
    const whatsAppLink = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
    
    // Open WhatsApp
    window.open(whatsAppLink, '_blank');
    
    // Add the tag if it doesn't exist
    if (!hasManualWhatsAppConfirmation && onUpdateTags) {
      const currentTags = Array.isArray(order.tags)
        ? order.tags.map((t: string) => t.trim())
        : typeof order.tags === 'string'
          ? order.tags.split(',').map((t: string) => t.trim())
          : [];
      
      if (!currentTags.includes('manual_whatsapp_confirmation')) {
        const updatedTags = [...currentTags, 'manual_whatsapp_confirmation'];
        onUpdateTags(order.id, updatedTags);
      }
    }
  };

  // Apply template and open WA with filled message (for Send template in three-dots menu)
  const handleSendTemplateSelect = (t: { id: string; key: string; name: string; body: string }) => {
    if (!order.customer?.phone) {
      toast.error('No phone number for this order');
      return;
    }
    const customerFirstName = order.customer.first_name?.trim() || 'Customer';
    const itemsList = (order.line_items || []).map((item: any) => {
      const variant = item.variant_title ? ` (${item.variant_title})` : '';
      return `- ${item.title}${variant}`;
    }).join('\n') || '—';
    const body = t.body
      .replace(/\{\{customer_first_name\}\}/g, customerFirstName)
      .replace(/\{\{items_list\}\}/g, itemsList);
    const formattedPhone = formatPhoneNumber(order.customer.phone);
    const whatsAppLink = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(body)}`;
    window.open(whatsAppLink, '_blank');
    setShowTemplateDialog(false);
  };

  const handlePriorityClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalPriority((prev: boolean) => !prev);
    console.log('Priority icon clicked. tags:', tags, 'isPriority:', !localPriority);
    if (onTogglePriority) {
      onTogglePriority(order.id, !localPriority);
    }
  };

  // Close modals when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Note modal
      if (isNoteModalOpen && noteModalRef.current && !noteModalRef.current.contains(event.target as Node)) {
        event.preventDefault();
        event.stopPropagation();
        setIsNoteModalOpen(false);
      }
      
      // WhatsApp modal
      if (isWhatsAppModalOpen && whatsAppModalRef.current && !whatsAppModalRef.current.contains(event.target as Node)) {
        event.preventDefault();
        event.stopPropagation();
        setIsWhatsAppModalOpen(false);
      }
      
      // Shipped modal
      if (isShippedModalOpen && shippedModalRef.current && !shippedModalRef.current.contains(event.target as Node)) {
        event.preventDefault();
        event.stopPropagation();
        setIsShippedModalOpen(false);
      }
    }

    if (isNoteModalOpen || isWhatsAppModalOpen || isShippedModalOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNoteModalOpen, isWhatsAppModalOpen, isShippedModalOpen]);

  // Update the getShippingDate function
  const getShippingDate = () => {
    const shippingDateTag = trimmedTags.find((tag: string) => tag.trim().startsWith('shipping_date:'));
    if (shippingDateTag) {
      const dateStr = shippingDateTag.trim().split(':')[1]?.trim();
      if (dateStr) {
        return dateStr;
      }
    }
    return null;
  };

  const isOrderCancelled = trimmedTags.some((tag: string) => tag.trim() === 'cancelled');
  
  // Get cancellation reason from tags
  const getCancellationReason = () => {
    const reasonTag = trimmedTags.find((tag: string) => tag.trim().toLowerCase().startsWith('cancellation_reason:'));
    return reasonTag ? reasonTag.split(':')[1]?.trim() : null;
  };
  
  const cancellationReasonText = getCancellationReason();
  
  // Check if order was cancelled after shipping (has cancelled tag AND cancelled_after_shipping tag)
  const isCancelledAfterShipping = isOrderCancelled && trimmedTags.includes('cancelled_after_shipping');
  
  // Check if shipping cost was incurred (has shipping cost tag)
  const hasShippingCost = trimmedTags.some((tag: string) => 
    tag.trim().toLowerCase().startsWith('scooter_shipping_cost:') ||
    tag.trim().toLowerCase().startsWith('shipping_company_cost:')
  );

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDeleteOrder) {
      onDeleteOrder(order.id);
    }
  };

  // Get location IDs from tags
  const getLocationFromTags = () => {
    // Convert tags to array if it's a string
    const tagsArray = typeof tags === 'string' 
      ? tags.split(',').map((tag: string) => tag.trim())
      : Array.isArray(tags) 
        ? tags.map((tag: string) => tag.trim())
        : [];

    // Helper function to get tag value
    const getTagValue = (prefix: string) => {
      const tag = tagsArray.find(tag => tag.startsWith(prefix));
      const value = tag ? tag.split(':')[1].trim() : null;
      // Consider "null" string as null value
      return value === "null" ? null : value;
    };

    return {
      cityId: getTagValue('mylerz_city_id'),
      neighborhoodId: getTagValue('mylerz_neighborhood_id'),
      subZoneId: getTagValue('mylerz_subzone_id')
    };
  };

  const locationIds = getLocationFromTags();

  // Get city data based on either selected city or shipping address
  const cityData = useMemo(() => {
    const cityId = selectedCityId || locationIds.cityId;
    if (!cityId || cityId === "null") return null;
    
    return locationData.Value.find(
      city => city.Id.toString() === cityId
    );
  }, [selectedCityId, locationIds.cityId]);

  // Get the current neighborhood data if it exists
  const currentNeighborhood = locationIds.neighborhoodId && cityData 
    ? cityData.Zones.find(z => z.Id.toString() === locationIds.neighborhoodId)
    : null;

  // Helper function to preserve non-location tags
  const preserveNonLocationTags = (currentTags: string[]) => {
    return currentTags.filter((tag: string) => 
      !tag.startsWith('mylerz_city_id:') &&
      !tag.startsWith('mylerz_neighborhood_id:') &&
      !tag.startsWith('mylerz_subzone_id:')
    );
  };

  // Helper function to get current tags array
  const getCurrentTags = () => {
    return typeof tags === 'string' 
      ? tags.split(',').map(tag => tag.trim())
      : Array.isArray(tags) 
        ? tags.map(tag => tag.trim())
        : [];
  };

  // Function to commit location changes
  const commitLocationChanges = (selections: NonNullable<typeof tempLocationSelections>) => {
    const currentTags = getCurrentTags();
    
    // Preserve non-location tags
    const preservedTags = preserveNonLocationTags(currentTags);
    
    // Add all location tags
    if (selections.cityId) {
      preservedTags.push(`mylerz_city_id:${selections.cityId}`);
    }
    if (selections.neighborhoodId) {
      preservedTags.push(`mylerz_neighborhood_id:${selections.neighborhoodId}`);
    }
    if (selections.subzoneId) {
      preservedTags.push(`mylerz_subzone_id:${selections.subzoneId}`);
    }
    
    // Update tags once with all changes
    if (onUpdateTags) {
      onUpdateTags(order.id, preservedTags);
    }
    
    // Clear temporary selections
    setTempLocationSelections(null);
  };

  // Function to start location editing
  const startLocationEdit = () => {
    // Initialize temporary selections with current values
    setTempLocationSelections({
      cityId: locationIds.cityId !== "null" ? locationIds.cityId : null,
      neighborhoodId: locationIds.neighborhoodId !== "null" ? locationIds.neighborhoodId : null,
      subzoneId: locationIds.subZoneId !== "null" ? locationIds.subZoneId : null
    });
    setIsCityDialogOpen(true);
  };

  // Function to cancel location editing
  const cancelLocationEdit = () => {
    setTempLocationSelections(null);
    setSelectedCityId(null);
    setSelectedNeighborhood(null);
    setIsCityDialogOpen(false);
    setIsNeighborhoodDialogOpen(false);
    setIsSubzoneDialogOpen(false);
  };

  // Check if order has any advanced status tags that prevent location editing
  const advancedStatusTags = ['shipped', 'fulfilled', 'ready_to_ship', 'cancelled', 'paid'];
  const canEditLocation = !advancedStatusTags.some(status => 
    trimmedTags.includes(status.trim())
  );

  // Check if order has been confirmed
  const isOrderConfirmed = trimmedTags.includes('order_ready_confirmed');

  // Handle initial button click
  const handleOrderReadyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // If order is pending, change status to order-ready, add automated_whatsapp_confirmation tag, and send WhatsApp message
    if (currentStatus === 'pending') {
      // Check if order has customer phone number
      if (!order.customer?.phone) {
        toast.error('Customer phone number is required to send WhatsApp message');
        return;
      }

      // Get current tags
      const currentTags = Array.isArray(order.tags)
        ? order.tags.map((t: string) => t.trim())
        : typeof order.tags === 'string'
          ? order.tags.split(',').map((t: string) => t.trim())
          : [];
      
      // Remove existing status tags (case-insensitive)
      const statusTags = ['order_ready', 'customer_confirmed', 'ready_to_ship', 'shipped', 'fulfilled'];
      let filtered = currentTags.filter((t: string) => {
        const trimmed = t.trim().toLowerCase();
        return !statusTags.some(st => st.trim().toLowerCase() === trimmed);
      });
      
      // Add order_ready tag
      filtered = [...filtered, 'order_ready'];
      
      // Add order_ready_date tag with today's date (YYYY-MM-DD)
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
      const orderReadyDateTag = `order_ready_date:${dateStr}`;
      // Remove any existing order_ready_date tag
      filtered = filtered.filter((tag: string) => !tag.startsWith('order_ready_date:'));
      filtered = [...filtered, orderReadyDateTag];
      
      // Add automated_whatsapp_confirmation tag if it doesn't exist
      if (!filtered.includes('automated_whatsapp_confirmation')) {
        filtered = [...filtered, 'automated_whatsapp_confirmation'];
      }
      
      // Update tags with both order_ready and automated_whatsapp_confirmation
      // This will make the order_ready tag appear instantly
      if (onUpdateTags) {
        onUpdateTags(order.id, filtered);
      }
      
      // Also call onUpdateStatus to trigger backend status update endpoint
      // (for Discord notifications, etc.)
      // Use requestAnimationFrame to ensure tags update is applied first
      requestAnimationFrame(() => {
        if (onUpdateStatus) {
          onUpdateStatus(order.id, 'order-ready');
        }
      });

      // Send WhatsApp order_ready message
      (async () => {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/whatsapp/order-ready`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              phone: order.customer.phone,
              orderNumber: order.name // Include order number (e.g., "#1023")
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to send order ready notification');
          }
          
          toast.success('Order ready notification sent successfully');
        } catch (error) {
          console.error('Error sending order ready notification:', error);
          toast.error('Failed to send order ready notification');
        }
      })();
      
      return;
    }
    
    // If order is order-ready, show WhatsApp confirmation dialog
    if (currentStatus === 'order-ready') {
    if (!order.customer?.phone || isOrderConfirmed) return;
    setShowReadyConfirmDialog(true);
    }
  };

  // Handle actual confirmation after dialog
  const handleOrderReadyConfirm = async () => {
    if (!order.customer?.phone || isOrderConfirmed) return;
    
    try {
      // Send the order ready notification via the API
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/whatsapp/order-ready`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          phone: order.customer.phone,
          orderNumber: order.name // Include order number (e.g., "#1023")
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send order ready notification');
      }
      
      // Update tags to include order_ready_confirmed
      if (onUpdateTags) {
        const currentTags = getCurrentTags();
        onUpdateTags(order.id, [...currentTags, 'order_ready_confirmed']);
      }

      // Show success message
      toast.success('Order ready notification sent successfully');
    } catch (error) {
      console.error('Error sending order ready notification:', error);
      toast.error('Failed to send order ready notification');
    } finally {
      setShowReadyConfirmDialog(false);
    }
  };

  const handleDateSelect = (date: Date) => {
    const newDueDate = date;
    if (onUpdateDueDate) {
      onUpdateDueDate(order.id, newDueDate.toISOString());
    }

    // Update tags to include custom_due_date
    const currentTags = Array.isArray(order.tags) 
      ? order.tags 
      : typeof order.tags === 'string'
        ? order.tags.split(',').map((t: string) => t.trim())
        : [];

    // Remove any existing custom_due_date tag
    const tagsWithoutDueDate = currentTags.filter((tag: string) => !tag.startsWith('custom_due_date:'));
    
    // Add new custom_due_date tag
    const formattedDate = format(newDueDate, 'yyyy-MM-dd');
    let updatedTags = [...tagsWithoutDueDate, `custom_due_date:${formattedDate}`];
    
    // Check if date is being extended (new date is later than current due date)
    const currentDueDate = dueDate ? new Date(dueDate) : null;
    const isDateExtended = currentDueDate && newDueDate > currentDueDate;
    
    // Automatically add priority tag if it doesn't exist AND date is not being extended
    // (custom due date = priority order, but extending date shouldn't add priority)
    if (!updatedTags.includes('priority') && !isDateExtended) {
      updatedTags = [...updatedTags, 'priority'];
      setLocalPriority(true); // Update local state for instant UI feedback
    }
    
    if (onUpdateTags) {
      onUpdateTags(order.id, updatedTags);
    }
    
    // Also update priority via the priority handler to ensure backend is updated
    if (onTogglePriority && !currentTags.includes('priority') && !isDateExtended) {
      onTogglePriority(order.id, true);
    }
  };
  
  const handleStartDateSelect = (date: Date) => {
    const newStartDate = date;
    if (onUpdateStartDate) {
      onUpdateStartDate(order.id, newStartDate.toISOString());
    }

    // Update tags to include custom_start_date
    const currentTags = Array.isArray(order.tags) 
      ? order.tags 
      : typeof order.tags === 'string'
        ? order.tags.split(',').map((t: string) => t.trim())
        : [];

    // Remove any existing custom_start_date tag
    const tagsWithoutStartDate = currentTags.filter((tag: string) => !tag.startsWith('custom_start_date:'));
    
    // Add new custom_start_date tag
    const formattedDate = format(newStartDate, 'yyyy-MM-dd');
    const updatedTags = [...tagsWithoutStartDate, `custom_start_date:${formattedDate}`];
    
    if (onUpdateTags) {
      onUpdateTags(order.id, updatedTags);
    }
  };

  const [showTagDialog, setShowTagDialog] = useState(false);
  const [newTag, setNewTag] = useState('');
  const tagDialogRef = useRef<HTMLDivElement>(null);

  // Add useEffect for clicking outside tag dialog
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tagDialogRef.current && !tagDialogRef.current.contains(event.target as Node)) {
        setShowTagDialog(false);
      }
    }

    if (showTagDialog) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTagDialog]);

  const handleTagClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTagDialog(true);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = Array.isArray(order.tags) 
      ? order.tags 
      : typeof order.tags === 'string'
        ? order.tags.split(',').map((t: string) => t.trim())
        : [];

    const updatedTags = currentTags.filter((tag: string) => tag !== tagToRemove);
    if (onUpdateTags) {
      onUpdateTags(order.id, updatedTags);
    }
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim()) return;

    const currentTags = Array.isArray(order.tags) 
      ? order.tags 
      : typeof order.tags === 'string'
        ? order.tags.split(',').map((t: string) => t.trim())
        : [];

    if (!currentTags.includes(newTag.trim())) {
      const updatedTags = [...currentTags, newTag.trim()];
      if (onUpdateTags) {
        onUpdateTags(order.id, updatedTags);
      }
    }
    setNewTag('');
  };

  // Get shipping method from tags
  const getShippingMethod = (): string => {
    const shippingMethodTag = tags.find((tag: string) => 
      tag.trim().toLowerCase().startsWith('shipping_method:')
    );
    if (shippingMethodTag) {
      const method = shippingMethodTag.split(':')[1]?.trim().toLowerCase();
      if (method === 'scooter') return 'Scooter';
      if (method === 'pickup') return 'Pickup';
      if (method === 'other-company' || method === 'other_company') return 'Other Company';
    }
    return 'Shipblu'; // Default
  };

  // Get shipping icon and styling based on method
  const getShippingIcon = () => {
    const method = getShippingMethod();
    
    switch (method) {
      case 'Other Company':
        return {
          icon: TruckIcon,
          className: 'w-5 h-5 text-green-600 flex-shrink-0 hover:text-green-700 transition-colors',
          containerClassName: 'bg-green-100 border border-green-300 rounded'
        };
      case 'Scooter':
        return {
          icon: BoltIcon,
          className: 'w-5 h-5 text-orange-500 flex-shrink-0 hover:text-orange-600 transition-colors',
          containerClassName: ''
        };
      case 'Pickup':
        return {
          icon: HandRaisedIcon,
          className: 'w-5 h-5 text-purple-500 flex-shrink-0 hover:text-purple-600 transition-colors',
          containerClassName: ''
        };
      case 'Shipblu':
      default:
        return {
          icon: TruckIcon,
          className: 'w-5 h-5 text-gray-400 flex-shrink-0 hover:text-gray-500 transition-colors',
          containerClassName: ''
        };
    }
  };

  // Handle shipping method change
  const handleShippingMethodChange = (method: string) => {
    const currentTags = Array.isArray(order.tags) 
      ? order.tags 
      : typeof order.tags === 'string'
        ? order.tags.split(',').map((t: string) => t.trim())
        : [];

    // Remove existing shipping_method tags (case-insensitive)
    const updatedTags = currentTags.filter((tag: string) => 
      !tag.trim().toLowerCase().startsWith('shipping_method:')
    );

    // Add new shipping method tag
    let tagValue = '';
    if (method === 'Scooter') tagValue = 'shipping_method:scooter';
    else if (method === 'Pickup') tagValue = 'shipping_method:pickup';
    else if (method === 'Other Company') tagValue = 'shipping_method:other-company';

    if (tagValue) {
      updatedTags.push(tagValue);
      if (onUpdateTags) {
        onUpdateTags(order.id, updatedTags);
      }
    }
  };

  // Handle copy order number to clipboard
  const handleCopyOrderNumber = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(order.name);
      setOrderNumberCopied(true);
      toast.success('Order number copied to clipboard');
      setTimeout(() => setOrderNumberCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy order number');
    }
  };

  return (
    <>
    <div 
      className="bg-white rounded-lg border border-gray-200 transition-all duration-200 hover:border-gray-300"
      title={rushType === 'Rushed' ? 'Rush Order (3 days)' : rushType === 'Mix' ? 'Mixed Order (Rushed & Standard items)' : rushType === 'Standard' ? 'Handmade Timeline (7 days)' : isCancelledAfterShipping ? (hasShippingCost ? 'Cancelled after shipping - shipping cost incurred' : 'Cancelled after shipping - may incur shipping costs') : undefined}
    >
      <div className="p-4">
        {/* Two-Column Header Layout */}
        <div className="flex justify-between items-start mb-3">
          {/* Left Column: Checkbox, Customer Name, Order Number */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div 
                onClick={handleCheckboxClick}
                className="relative w-5 h-5 cursor-pointer flex-shrink-0"
              >
                <div className={`absolute w-5 h-5 rounded-full border-2 ${isSelected ? 'border-blue-600' : 'border-gray-300'} bg-white`} />
                {isSelected && (
                  <div className="absolute w-3 h-3 rounded-full bg-blue-600" style={{ top: '4px', left: '4px' }} />
                )}
              </div>
              <div className="flex flex-col flex-1 min-w-0 justify-start">
                <span className="text-base font-semibold text-gray-900 truncate leading-tight">
                  {order.customer?.first_name} {order.customer?.last_name}
                </span>
                <span
                  onClick={handleCopyOrderNumber}
                  className={`text-[10px] transition-all duration-200 cursor-pointer truncate leading-tight mt-0.5 ${
                    orderNumberCopied 
                      ? 'text-green-600 font-semibold bg-green-50 px-1 rounded' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title={orderNumberCopied ? "Copied!" : "Click to copy order number"}
                >
                  {order.name} • <span className={rushType === 'Rushed' ? 'text-red-600 font-medium' : rushType === 'Mix' ? 'text-orange-600 font-medium' : 'text-gray-600'}>{rushType}</span> {orderNumberCopied && <ClipboardDocumentIcon className="w-3 h-3 text-green-600 inline-block ml-1" />}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Status, Priority, and Actions Menu */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Priority Star - Only visible when active */}
            {isPriority && (
              <button
                onClick={handlePriorityClick}
                className="p-1 transition-colors duration-200 rounded hover:bg-gray-100"
                title="Remove priority"
              >
                <StarIconSolid className="w-5 h-5 text-yellow-500" />
              </button>
            )}
            {/* WhatsApp confirmation - only when order is ready */}
            {isOrderReady && order.customer?.phone && (
              <button
                onClick={(e) => { e.stopPropagation(); handleManualWhatsAppConfirmation(e); }}
                className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                title={hasManualWhatsAppConfirmation ? 'WhatsApp confirmation already sent' : 'Send WhatsApp shipping confirmation'}
              >
                <img
                  src={whatsappLogo}
                  alt="WhatsApp confirmation"
                  className={`w-5 h-5 ${hasManualWhatsAppConfirmation ? 'opacity-100' : 'opacity-30'}`}
                />
              </button>
            )}
            {/* Status Chip - Icon Only */}
            <Menu as="div" className="relative inline-block text-left">
              {({ open }) => (
                <>
                  <div>
                    <Menu.Button 
                      className={`inline-flex items-center justify-center p-1.5 rounded-full ${getStatusColor(currentStatus)} hover:opacity-80 transition-opacity`}
                      onClick={(e) => e.stopPropagation()}
                      title={currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1).replace(/-/g, ' ')}
                    >
                      {getStatusIcon(currentStatus)}
                    </Menu.Button>
                  </div>
                  {open && (
                    <Menu.Items
                      static
                      className="absolute right-0 mt-1 w-40 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="py-2 px-2 space-y-1">
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              className={`rounded-md w-full text-center py-1.5 text-sm font-medium ${getStatusColor('pending')}`}
                              onClick={() => handleStatusChange('pending')}
                            >
                              Pending
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              className={`rounded-md w-full text-center py-1.5 text-sm font-medium ${getStatusColor('order-ready')}`}
                              onClick={() => handleStatusChange('order-ready')}
                            >
                              Order Ready
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              className={`rounded-md w-full text-center py-1.5 text-sm font-medium ${getStatusColor('on_hold')}`}
                              onClick={() => handleStatusChange('on_hold')}
                            >
                              On Hold
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              className={`rounded-md w-full text-center py-1.5 text-sm font-medium ${getStatusColor('confirmed')}`}
                              onClick={() => handleStatusChange('confirmed')}
                            >
                              Confirmed
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button
                                      className={`rounded-md w-full text-center py-1.5 text-sm font-medium ${getStatusColor('ready_to_ship')}`}
        onClick={() => handleStatusChange('ready_to_ship')}
      >
        Ready to Ship
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              className={`rounded-md w-full text-center py-1.5 text-sm font-medium ${getStatusColor('shipped')}`}
                              onClick={() => handleStatusChange('shipped')}
                            >
                              Shipped
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              className={`rounded-md w-full text-center py-1.5 text-sm font-medium ${getStatusColor('fulfilled')}`}
                              onClick={() => handleStatusChange('fulfilled')}
                            >
                              Fulfilled
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              className={`rounded-md w-full text-center py-1.5 text-sm font-medium ${getStatusColor('paid')}`}
                              onClick={() => handleStatusChange('paid')}
                            >
                              Paid
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              className={`rounded-md w-full text-center py-1.5 text-sm font-medium ${getStatusColor('cancelled')}`}
                              onClick={() => handleStatusChange('cancelled')}
                            >
                              Cancelled
                            </button>
                          )}
                        </Menu.Item>
                      </div>
                    </Menu.Items>
                  )}
                </>
              )}
            </Menu>


            {/* Actions Dropdown Menu */}
            <Menu as="div" className="relative inline-block text-left">
              {({ open }) => (
                <>
                  <Menu.Button
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200 rounded hover:bg-gray-100"
                    onClick={(e) => e.stopPropagation()}
                    title="More actions"
                  >
                    <EllipsisHorizontalIcon className="w-5 h-5" />
                  </Menu.Button>
                  {open && (
                    <Menu.Items
                      static
                      className="absolute right-0 mt-1 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="py-1">
                        {/* Add note - always visible */}
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              onClick={handleNoteIconClick}
                              className={`${active ? 'bg-gray-100' : ''} flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700`}
                            >
                              <PencilIcon className="w-4 h-4" />
                              Add note
                            </button>
                          )}
                        </Menu.Item>
                        {/* Manage tags - always visible */}
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              onClick={handleTagClick}
                              className={`${active ? 'bg-gray-100' : ''} flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700`}
                            >
                              <TagIcon className="w-4 h-4" />
                              Manage tags
                            </button>
                          )}
                        </Menu.Item>
                        {/* Send template - always visible for all orders */}
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!order.customer?.phone) {
                                  toast.error('No phone number for this order');
                                  return;
                                }
                                setShowTemplateDialog(true);
                              }}
                              className={`${active ? 'bg-gray-100' : ''} flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700`}
                              title="Send a message template via WhatsApp"
                            >
                              <DocumentTextIcon className="w-4 h-4" />
                              Send template
                            </button>
                          )}
                        </Menu.Item>
                        {!isOrderCancelled && (
                          <>
                            {(currentStatus === 'pending' || currentStatus === 'order-ready') && (
                              <Menu.Item>
                                {({ active }) => (
                                  <button
                                    onClick={handleOrderReadyClick}
                                    disabled={currentStatus === 'order-ready' && (isOrderConfirmed || !order.customer?.phone)}
                                    className={`${active ? 'bg-gray-100' : ''} flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed`}
                                    title={
                                      currentStatus === 'pending' 
                                        ? "Mark order as ready" 
                                        : isOrderConfirmed 
                                          ? "Order already confirmed" 
                                          : "Confirm order is ready"
                                    }
                                  >
                                    <CheckIcon className={`w-4 h-4 ${
                                      currentStatus === 'order-ready' && isOrderConfirmed 
                                        ? 'text-gray-300' 
                                        : hasAutomatedWhatsAppConfirmation 
                                          ? 'text-gray-700' 
                                          : 'text-blue-500'
                                    }`} />
                                    {currentStatus === 'pending' ? 'Mark as ready' : 'Confirm ready'}
                                  </button>
                                )}
                              </Menu.Item>
                            )}
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  onClick={handlePriorityClick}
                                  className={`${active ? 'bg-gray-100' : ''} flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700`}
                                  title={isPriority ? "Remove priority" : "Add priority"}
                                >
                                  {isPriority ? (
                                    <StarIconSolid className="w-4 h-4 text-yellow-500" />
                                  ) : (
                                    <StarIconOutline className="w-4 h-4 text-gray-400" />
                                  )}
                                  {isPriority ? 'Remove priority' : 'Add priority'}
                                </button>
                              )}
                            </Menu.Item>
                          </>
                        )}
                        {isOrderCancelled && (
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={handleDeleteClick}
                                className={`${active ? 'bg-gray-100' : ''} flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600`}
                              >
                                <TrashIcon className="w-4 h-4" />
                                Delete order
                              </button>
                            )}
                          </Menu.Item>
                        )}
                      </div>
                    </Menu.Items>
                  )}
                </>
              )}
            </Menu>
            
            
          </div>
        </div>

        {/* Compact Customer Info Section */}
        <div className="mb-4 pb-3 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            {/* Left Side: Phone and Address */}
            <div className="flex-1 space-y-2">
              {order.customer?.phone && (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Menu as="div" className="relative inline-block text-left">
                    {({ open }) => (
                      <>
                        <Menu.Button
                          className="p-1 cursor-pointer rounded hover:bg-gray-100 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                          title="Phone actions"
                        >
                          <PhoneIcon className="w-5 h-5 text-gray-400 flex-shrink-0 hover:text-gray-500 transition-colors" />
                        </Menu.Button>
                    {open && (
                      <Menu.Items
                        static
                        className="absolute left-0 mt-1 w-48 origin-top-left rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="py-1">
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={handleWhatsAppChat}
                                className={`${active ? 'bg-gray-100' : ''} flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700`}
                              >
                                <ChatBubbleLeftIcon className="w-4 h-4 text-green-600" />
                                WhatsApp Web
                              </button>
                            )}
                          </Menu.Item>
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={handleDialPhone}
                                className={`${active ? 'bg-gray-100' : ''} flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700`}
                              >
                                <PhoneArrowUpRightIcon className="w-4 h-4 text-blue-600" />
                                Call Customer
                              </button>
                            )}
                          </Menu.Item>
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={handleWhatsAppBusiness}
                                className={`${active ? 'bg-gray-100' : ''} flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700`}
                              >
                                <img src={whatsappLogo} alt="WhatsApp" className="w-4 h-4" />
                                WhatsApp Business
                              </button>
                            )}
                          </Menu.Item>
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={handleCopyPhone}
                                className={`${active ? 'bg-gray-100' : ''} flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700`}
                              >
                                <ClipboardDocumentIcon className="w-4 h-4 text-gray-500" />
                                Copy Number
                              </button>
                            )}
                          </Menu.Item>
                        </div>
                      </Menu.Items>
                    )}
                    </>
                  )}
                </Menu>
                <span 
                  onClick={handlePhoneNumberClick}
                  className={`truncate transition-all duration-200 cursor-pointer ${
                    phoneNumberCopied 
                      ? 'text-green-600 font-semibold bg-green-50 px-1 rounded' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                  title={phoneNumberCopied ? "Copied!" : "Click to copy phone number"}
                >
                  {order.customer.phone} {phoneNumberCopied && <ClipboardDocumentIcon className="w-3 h-3 text-green-600 inline-block ml-1" />}
                </span>
              </div>
            )}
            {order.shipping_address && (
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startLocationEdit();
                  }}
                  className="p-1 cursor-pointer rounded hover:bg-gray-100 transition-colors"
                  title={canEditLocation ? 'Edit Location' : 'View Address'}
                >
                  <MapPinIcon className="w-5 h-5 text-gray-400 hover:text-gray-500 transition-colors" />
                </button>
              {locationIds.cityId && locationIds.cityId !== "null" ? (
                <div className="flex items-center gap-2 w-full">
                  <span className="text-xs text-gray-700">
                    {cityData?.ArName || cityData?.EnName}
                    {locationIds.neighborhoodId && locationIds.neighborhoodId !== "null" && (
                      <>
                        , {cityData?.Zones.find(z => z.Id.toString() === locationIds.neighborhoodId)?.ArName}
                        {locationIds.subZoneId && locationIds.subZoneId !== "null" && (
                          <>
                            , {cityData?.Zones
                                .find(z => z.Id.toString() === locationIds.neighborhoodId)
                                ?.SubZones.find(sz => sz.Id.toString() === locationIds.subZoneId)?.ArName}
                          </>
                        )}
                      </>
                    )}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 w-full">
                  <span className="text-xs text-gray-700">
                    {order.shipping_address?.province && order.shipping_address?.city 
                      ? `${order.shipping_address.province}, ${order.shipping_address.city}`
                      : order.shipping_address?.province 
                        ? order.shipping_address.province
                        : order.shipping_address?.city
                          ? order.shipping_address.city
                          : 'Missing address'
                    }
                  </span>
                </div>
              )}
            </div>
          )}
            </div>

            {/* Right Side: Shipping Method and Price */}
            <div className="flex flex-col gap-2 flex-shrink-0">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Menu as="div" className="relative inline-block text-left">
                  {({ open }) => {
                    const shippingIcon = getShippingIcon();
                    const IconComponent = shippingIcon.icon;
                    return (
                    <>
                      <Menu.Button
                        onClick={(e) => e.stopPropagation()}
                        className={`p-1 cursor-pointer rounded hover:bg-gray-100 transition-colors ${shippingIcon.containerClassName}`}
                        title="Shipping Method"
                      >
                        <IconComponent className={shippingIcon.className} />
                      </Menu.Button>
                      {open && (
                        <Menu.Items
                          static
                          className="absolute right-0 mt-1 w-40 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="py-1">
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  onClick={() => handleShippingMethodChange('Other Company')}
                                  className={`${active ? 'bg-gray-100' : ''} flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700`}
                                >
                                  Other Company
                                </button>
                              )}
                            </Menu.Item>
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  onClick={() => handleShippingMethodChange('Scooter')}
                                  className={`${active ? 'bg-gray-100' : ''} flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700`}
                                >
                                  Scooter
                                </button>
                              )}
                            </Menu.Item>
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  onClick={() => handleShippingMethodChange('Pickup')}
                                  className={`${active ? 'bg-gray-100' : ''} flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700`}
                                >
                                  Pickup
                                </button>
                              )}
                            </Menu.Item>
                          </div>
                        </Menu.Items>
                      )}
                    </>
                    );
                  }}
                </Menu>
                <span className={`truncate font-medium ${
                  getShippingMethod() === 'Other Company' 
                    ? 'text-green-700 font-semibold' 
                    : getShippingMethod() === 'Scooter'
                    ? 'text-orange-600'
                    : getShippingMethod() === 'Pickup'
                    ? 'text-purple-600'
                    : 'text-gray-600'
                }`}>
                  {getShippingMethod()}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <button
                  className="p-1 cursor-pointer rounded hover:bg-gray-100 transition-colors"
                  title="Total Price"
                >
                  <CurrencyDollarIcon className="w-5 h-5 text-gray-400 flex-shrink-0 hover:text-gray-500 transition-colors" />
                </button>
                <span className="truncate font-medium">${order.total_price}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Warning boxes for different cancellation scenarios */}
        {isCancelledAfterShipping && (
          <div className={`mb-4 p-4 rounded-lg border-2 shadow-sm ${
            hasShippingCost 
              ? 'bg-red-50 border-red-400' 
              : 'bg-yellow-50 border-yellow-400'
          }`}>
            <div className="flex items-center gap-3">
              {hasShippingCost ? (
                <XCircleIcon className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              ) : (
                <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className={`text-sm font-bold ${
                  hasShippingCost ? 'text-red-800' : 'text-yellow-800'
                }`}>
                  {hasShippingCost ? 'Shipping Cost Incurred' : 'May Incur Shipping Cost'}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* No Reply Cancelled */}
        {isNoReplyCancelled && (
          <div className="mb-4 p-4 rounded-lg border-2 shadow-sm bg-orange-50 border-orange-400">
            <div className="flex items-center gap-3">
              <ClockIcon className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-bold text-orange-800">
                  No Reply Cancelled
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Manual Cancellation with Reason */}
        {isOrderCancelled && cancellationReasonText && !isCancelledAfterShipping && !isNoReplyCancelled && (
          <div className="mb-4 p-4 rounded-lg border-2 shadow-sm bg-gray-50 border-gray-400">
            <div className="flex items-center gap-3">
              <XCircleIcon className="w-6 h-6 text-gray-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-bold text-gray-800">
                  {cancellationReasonText}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Order Notes - only show if not cancelled */}
        {!isOrderCancelled && order.note && order.note.trim() && (
          <div 
            className="mb-4 p-3 bg-amber-50 rounded-md cursor-pointer hover:bg-amber-100 transition-colors"
            onClick={handleNoteIconClick}
          >
            <div className="flex gap-2">
              <DocumentTextIcon className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-700 font-medium">
                {order.note}
              </p>
            </div>
          </div>
        )}

        {/* Shipping Status - only show if shipped */}
        {!isOrderCancelled && !trimmedTags.includes('paid') && trimmedTags.includes('shipped') && (
          <ShippingStatus 
            orderTags={trimmedTags}
            orderId={order.id}
            fulfillments={order.fulfillments}
            onUpdateStatus={onUpdateStatus}
            onUpdateTags={onUpdateTags}
          />
        )}

        {/* Priority 1: Items Section - Most Prominent */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900">Items</h3>
            <span className="text-xs text-gray-500">{regularLineItems.length} {regularLineItems.length === 1 ? 'item' : 'items'}</span>
          </div>
          <div className="space-y-2">
            {(itemsExpanded ? regularLineItems : regularLineItems.slice(0, 3)).map((item: any, index: number) => (
              <div key={index} className="flex items-start justify-between gap-2">
                <span className={`text-sm flex-1 ${isOrderCancelled ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                  {item.title}
                  {item.variant_title && (
                    <span className="text-gray-600 ml-1">({item.variant_title})</span>
                  )}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-xs font-semibold flex-shrink-0 ${
                  isOrderCancelled 
                    ? 'bg-gray-200 text-gray-500' 
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  ×{item.quantity}
                </span>
              </div>
            ))}
            {regularLineItems.length > 3 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setItemsExpanded(!itemsExpanded);
                }}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium w-full text-center py-1"
              >
                {itemsExpanded ? 'Show less' : `+${regularLineItems.length - 3} more items`}
              </button>
            )}
          </div>
          
          {/* Addon Line Items (Making Time Options) */}
          {addonLineItems.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-300">
              <div className="text-xs text-gray-600 font-medium mb-1.5">Making Time:</div>
              <div className="space-y-1.5">
                {addonLineItems.map((item: any, index: number) => (
                  <div key={index} className="text-sm">
                    <span className={`${isOrderCancelled ? 'text-gray-500 line-through' : 'text-blue-700 font-medium'}`}>
                      {item.title}
                      {item.properties && item.properties.length > 0 && (
                        <span className="text-gray-600 ml-2 font-normal">
                          {item.properties.map((prop: any, propIndex: number) => (
                            <span key={propIndex}>
                              {prop.name}: {prop.value}
                              {propIndex < item.properties.length - 1 && ', '}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Priority 2: Compact Info Row - Days Left + Dates */}
        {!isOrderCancelled && !trimmedTags.includes('paid') && !trimmedTags.includes('fulfilled') && (
          <div className="mb-3 flex items-center justify-center gap-2 whitespace-nowrap overflow-hidden">
            {/* Days Left Badge */}
            <div className={`flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-md border min-w-[60px] ${getDaysLeftBadgeStyle()}`}>
              <ClockIcon className="w-4 h-4" />
              <span className="text-[10px] font-medium">{getDaysLeftText()}</span>
            </div>
            
            {/* Order Ready Days - Only show if order_ready_date tag exists and order is in order-ready status */}
            {daysInOrderReady !== null && currentStatus === 'order-ready' && (
              <>
                {/* Separator */}
                <div className="h-3 w-px bg-gray-300" />
                <div className="flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-md border min-w-[60px] bg-orange-50 border-orange-200">
                  <SparklesIcon className="w-4 h-4 text-orange-600" />
                  <span className="text-[10px] font-medium text-orange-700">{daysInOrderReady === 0 ? 'Today' : `${daysInOrderReady}d`}</span>
                </div>
              </>
            )}
            
            {/* On Hold Days - Only show if moved_to_on_hold tag exists and order is in on_hold status */}
            {daysInOnHold !== null && currentStatus === 'on_hold' && (
              <>
                {/* Separator */}
                <div className="h-3 w-px bg-gray-300" />
                <div className="flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-md border min-w-[60px] bg-amber-50 border-amber-200">
                  <PauseCircleIcon className="w-4 h-4 text-amber-600" />
                  <span className="text-[10px] font-medium text-amber-700">{daysInOnHold}d</span>
                </div>
              </>
            )}
            
            {/* Confirmed Days - Only show if customer_confirmed_date tag exists and order is in confirmed or ready_to_ship status */}
            {daysInConfirmed !== null && (currentStatus === 'confirmed' || currentStatus === 'ready_to_ship') && (
              <>
                {/* Separator */}
                <div className="h-3 w-px bg-gray-300" />
                <div className="flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-md border min-w-[60px] bg-green-50 border-green-200">
                  <HandThumbUpIcon className="w-4 h-4 text-green-600" />
                  <span className="text-[10px] font-medium text-green-700">{daysInConfirmed === 0 ? 'Today' : `${daysInConfirmed}d`}</span>
                </div>
              </>
            )}
            
            {/* Shipped Days - Only show if shipped_date tag exists and order is in shipped status */}
            {daysInShipped !== null && currentStatus === 'shipped' && (
              <>
                {/* Separator */}
                <div className="h-3 w-px bg-gray-300" />
                <div className="flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-md border min-w-[60px] bg-purple-50 border-purple-200">
                  <TruckIcon className="w-4 h-4 text-purple-600" />
                  <span className="text-[10px] font-medium text-purple-700">{daysInShipped === 0 ? 'Today' : `${daysInShipped}d`}</span>
                </div>
              </>
            )}
            
            {/* Separator - Only show if we have date boxes displayed */}
            {((daysInOrderReady !== null && currentStatus === 'order-ready') || (daysInOnHold !== null && currentStatus === 'on_hold') || (daysInConfirmed !== null && (currentStatus === 'confirmed' || currentStatus === 'ready_to_ship')) || (daysInShipped !== null && currentStatus === 'shipped')) && (
              <div className="h-3 w-px bg-gray-300" />
            )}
            
            {/* Start Date - Clickable */}
            <DatePicker
              selected={startDate}
              onChange={(date: Date) => handleStartDateSelect(date)}
              customInput={
                <button 
                  className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-md border border-gray-200 min-w-[60px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <CalendarIcon className="w-4 h-4 text-gray-400" />
                  <span className="text-[10px] font-medium">{format(startDate, 'MMM d')}</span>
                </button>
              }
              minDate={new Date(0)}
              dateFormat="MMM d"
              popperPlacement="bottom-start"
              popperClassName="z-50"
            />
            
            {/* Separator */}
            <div className="h-3 w-px bg-gray-300" />
            
            {/* Due Date - Clickable */}
            <DatePicker
              selected={dueDate}
              onChange={(date: Date) => handleDateSelect(date)}
              customInput={
                <button 
                  className={`transition-colors flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-md border min-w-[60px] ${
                    dueDateTag 
                      ? 'text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 font-medium' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-gray-200'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <CalendarIcon className={`w-4 h-4 ${dueDateTag ? 'text-red-500' : 'text-gray-400'}`} />
                  <span className="text-[10px] font-medium">{format(dueDate, 'MMM d')}</span>
                </button>
              }
              minDate={new Date()}
              dateFormat="MMM d"
              popperPlacement="bottom-start"
              popperClassName="z-50"
            />
          </div>
        )}
      </div>
    </div>

      {/* Confirmation Dialog */}
      {showReadyConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowReadyConfirmDialog(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Confirm Order Ready</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to send a WhatsApp message to {order.customer?.first_name} {order.customer?.last_name} confirming their order is ready?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowReadyConfirmDialog(false)}
                className="px-4 py-2 bg-white text-gray-600 hover:text-gray-800 transition-colors duration-200 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleOrderReadyConfirm}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200"
              >
                Send Message
              </button>
            </div>
          </div>
        </div>
      )}

        {/* Note Modal */}
        {isNoteModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div ref={noteModalRef} className="bg-white rounded-lg p-6 max-w-md w-full relative" onClick={e => e.stopPropagation()}>
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
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* WhatsApp Message Modal */}
        {isWhatsAppModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div ref={whatsAppModalRef} className="bg-white rounded-lg p-6 max-w-md w-full relative" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium">Send WhatsApp Message</h3>
                <button
                  onClick={() => setIsWhatsAppModalOpen(false)}
                  className="p-1 rounded-full bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                {order.customer?.phone ? 
                  `Message will be sent to ${order.customer.first_name} ${order.customer.last_name} (${order.customer.phone})` :
                  'Customer phone number not available'}
              </p>
              <form onSubmit={handleWhatsAppMessageSubmit}>
                <textarea
                  value={whatsAppMessage}
                  onChange={(e) => setWhatsAppMessage(e.target.value)}
                  className="w-full h-32 p-2 border rounded-md mb-4 bg-white"
                  placeholder="Enter your WhatsApp message..."
                  disabled={!order.customer?.phone}
                />
                <div className="flex justify-between gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!whatsAppMessage.trim() || !order.customer?.phone}
                  >
                    Send Message
                  </button>
                  <button
                    type="button"
                    onClick={handleSendConfirmation}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!order.customer?.phone}
                  >
                    Send Confirmation
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Shipped Notification Modal */}
        {isShippedModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div ref={shippedModalRef} className="bg-white rounded-lg p-6 max-w-md w-full relative" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium">Order Shipped Notification</h3>
                <button
                  onClick={() => setIsShippedModalOpen(false)}
                  className="p-1 rounded-full bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                {order.customer?.phone ? 
                  `Send shipping notification to ${order.customer.first_name} ${order.customer.last_name} (${order.customer.phone})` :
                  'Customer phone number not available'}
              </p>
              <div className="p-3 bg-gray-50 rounded-md mb-4">
                <p className="text-sm text-gray-700 whitespace-pre-line">
                  {getShippingTemplate(order.customer?.first_name || '')}
                </p>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSendShippingNotification}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!order.customer?.phone}
                >
                  Send Shipping Notification
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Location Dialogs */}
        {/* City Dialog */}
        <LocationDialog<any>
          isOpen={isCityDialogOpen}
          onClose={() => {
            cancelLocationEdit();
          }}
          title="Select City"
          locations={locationData.Value}
          shippingAddress={order.shipping_address}
          selectedId={
            tempLocationSelections?.cityId && tempLocationSelections.cityId !== "null" 
              ? parseInt(tempLocationSelections.cityId)
              : locationIds.cityId && locationIds.cityId !== "null" 
                ? parseInt(locationIds.cityId || "") 
                : undefined
          }
          readOnly={!canEditLocation}
          onSelect={(city) => {
            // Set the selected city ID for immediate UI update
            setSelectedCityId(city.Id.toString());
            
            // Update temporary selections
            setTempLocationSelections({
              cityId: city.Id.toString(),
              neighborhoodId: null,
              subzoneId: null
            });
            
            setIsCityDialogOpen(false);
            setIsNeighborhoodDialogOpen(true);
          }}
        />

        {cityData && (
          <>
            {/* Neighborhood Dialog */}
            <LocationDialog<Zone>
              isOpen={isNeighborhoodDialogOpen}
              onClose={() => {
                cancelLocationEdit();
              }}
              title="Select Neighborhood"
              locations={cityData.Zones}
              shippingAddress={order.shipping_address}
              selectedId={
                tempLocationSelections?.neighborhoodId && tempLocationSelections.neighborhoodId !== "null"
                  ? parseInt(tempLocationSelections.neighborhoodId)
                  : locationIds.neighborhoodId && locationIds.neighborhoodId !== "null"
                    ? parseInt(locationIds.neighborhoodId || "")
                    : undefined
              }
              readOnly={!canEditLocation}
              onSelect={(neighborhood) => {
                setSelectedNeighborhood(neighborhood);
                
                // Update temporary selections
                const currentSelections = {
                  cityId: tempLocationSelections?.cityId || locationIds.cityId || "",
                  neighborhoodId: neighborhood.Id.toString(),
                  subzoneId: null
                };
                setTempLocationSelections(currentSelections);

                if (neighborhood.SubZones.length === 1) {
                  const subzone = neighborhood.SubZones[0];
                  // Update temporary selections with both neighborhood and subzone
                  const selections = {
                    cityId: currentSelections.cityId,
                    neighborhoodId: neighborhood.Id.toString(),
                    subzoneId: subzone.Id.toString()
                  };
                  setTempLocationSelections(selections);
                  
                  // Commit changes since we're done with selection
                  commitLocationChanges(selections);
                  setIsNeighborhoodDialogOpen(false);
                } else {
                  setIsNeighborhoodDialogOpen(false);
                  setIsSubzoneDialogOpen(true);
                }
              }}
            />

            {/* Subzone Dialog */}
            {selectedNeighborhood && (
              <LocationDialog<SubZone>
                isOpen={isSubzoneDialogOpen}
                onClose={() => {
                  cancelLocationEdit();
                }}
                title="Select SubZone"
                locations={selectedNeighborhood.SubZones}
                shippingAddress={order.shipping_address}
                selectedId={
                  tempLocationSelections?.subzoneId && tempLocationSelections.subzoneId !== "null"
                    ? parseInt(tempLocationSelections.subzoneId)
                    : locationIds.subZoneId && locationIds.subZoneId !== "null"
                      ? parseInt(locationIds.subZoneId || "")
                      : undefined
                }
                readOnly={!canEditLocation}
                onSelect={(subzone) => {
                  // Update temporary selections with all three levels
                  const selections = {
                    cityId: tempLocationSelections?.cityId || locationIds.cityId || "",
                    neighborhoodId: selectedNeighborhood.Id.toString(),
                    subzoneId: subzone.Id.toString()
                  };
                  setTempLocationSelections(selections);
                  
                  // Commit changes
                  commitLocationChanges(selections);
                  setIsSubzoneDialogOpen(false);
                }}
              />
            )}
          </>
        )}

        {/* Scooter Shipping Cost Modal */}
        {isScooterShippingCostModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full relative" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Scooter Shipping Cost</h3>
                <button
                  onClick={() => {
                    setIsScooterShippingCostModalOpen(false);
                    setScooterShippingCost('');
                  }}
                  className="p-1 rounded-full bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Please enter the actual shipping cost for this scooter delivery (in EGP).
              </p>
              <form onSubmit={handleScooterShippingCostSubmit}>
                <input
                  type="number"
                  value={scooterShippingCost}
                  onChange={(e) => setScooterShippingCost(e.target.value)}
                  placeholder="Enter shipping cost (EGP)"
                  className="w-full p-2 border rounded-md mb-4 bg-white text-gray-900"
                  min="0"
                  step="0.01"
                  required
                  autoFocus
                />
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fulfillment Date
                  </label>
                  <DatePicker
                    selected={scooterFulfillmentDate}
                    onChange={(date: Date | null) => {
                      if (date) {
                        setScooterFulfillmentDate(date);
                      }
                    }}
                    dateFormat="yyyy-MM-dd"
                    className="w-full p-2 border rounded-md bg-white text-gray-900"
                    maxDate={new Date()}
                    required
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsScooterShippingCostModalOpen(false);
                      setScooterShippingCost('');
                      setScooterFulfillmentDate(new Date());
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    Save & Fulfill
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Other Company Shipping Cost Modal */}
        {isCompanyShippingCostModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full relative" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Shipping Company Cost</h3>
                <button
                  onClick={() => {
                    setIsCompanyShippingCostModalOpen(false);
                    setCompanyShippingCost('');
                  }}
                  className="p-1 rounded-full bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Please enter the actual shipping cost for this shipping company delivery (in EGP).
              </p>
              <form onSubmit={handleCompanyShippingCostSubmit}>
                <input
                  type="number"
                  value={companyShippingCost}
                  onChange={(e) => setCompanyShippingCost(e.target.value)}
                  placeholder="Enter shipping cost (EGP)"
                  className="w-full p-2 border rounded-md mb-4 bg-white text-gray-900"
                  min="0"
                  step="0.01"
                  required
                  autoFocus
                />
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fulfillment Date
                  </label>
                  <DatePicker
                    selected={companyFulfillmentDate}
                    onChange={(date: Date | null) => {
                      if (date) {
                        setCompanyFulfillmentDate(date);
                      }
                    }}
                    dateFormat="yyyy-MM-dd"
                    className="w-full p-2 border rounded-md bg-white text-gray-900"
                    maxDate={new Date()}
                    required
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCompanyShippingCostModalOpen(false);
                      setCompanyShippingCost('');
                      setCompanyFulfillmentDate(new Date());
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    Save & Fulfill
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Pickup Fulfillment Date Modal */}
        {isPickupFulfillmentDateModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full relative" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Pickup Order Fulfillment</h3>
                <button
                  onClick={() => {
                    setIsPickupFulfillmentDateModalOpen(false);
                    setPickupFulfillmentDate(new Date());
                  }}
                  className="p-1 rounded-full bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Please select the fulfillment and paid date for this pickup order.
              </p>
              <form onSubmit={handlePickupFulfillmentDateSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fulfillment & Paid Date
                  </label>
                  <DatePicker
                    selected={pickupFulfillmentDate}
                    onChange={(date: Date | null) => {
                      if (date) {
                        setPickupFulfillmentDate(date);
                      }
                    }}
                    dateFormat="yyyy-MM-dd"
                    className="w-full p-2 border rounded-md bg-white text-gray-900"
                    maxDate={new Date()}
                    required
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPickupFulfillmentDateModalOpen(false);
                      setPickupFulfillmentDate(new Date());
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    Save & Fulfill
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Cancellation Reason Dialog */}
        {isCancellationReasonModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 relative" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Cancel Order</h3>
                <button
                  onClick={() => {
                    setIsCancellationReasonModalOpen(false);
                    setCancellationReason('');
                    setPendingCancellationStatus(null);
                  }}
                  className="p-1 rounded-full bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Please provide a reason for cancelling this order. This will be saved with the order.
              </p>
              <form onSubmit={handleCancellationReasonSubmit}>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Enter cancellation reason..."
                  className="w-full h-32 p-2 border rounded-md mb-4 bg-white text-gray-900"
                  required
                  autoFocus
                />
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCancellationReasonModalOpen(false);
                      setCancellationReason('');
                      setPendingCancellationStatus(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                  >
                    Confirm Cancellation
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tag Management Dialog */}
        {showTagDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div 
              ref={tagDialogRef}
              className="bg-white rounded-lg p-6 max-w-md w-full mx-4 relative"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Manage Tags</h3>
                <button
                  onClick={() => setShowTagDialog(false)}
                  className="p-1 rounded-full bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Add New Tag Form */}
              <form onSubmit={handleAddTag} className="mb-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Enter new tag"
                    className="flex-1 p-2 border border-gray-200 rounded-md text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    className="p-2 bg-white border border-gray-200 text-blue-600 rounded-md hover:border-blue-500 transition-colors"
                  >
                    <PlusIcon className="w-5 h-5" />
                  </button>
                </div>
              </form>

              {/* Tags List */}
              <div className="flex flex-wrap gap-2">
                {(Array.isArray(order.tags) 
                  ? order.tags 
                  : typeof order.tags === 'string'
                    ? order.tags.split(',').map((t: string) => t.trim())
                    : []
                ).map((tag: string, index: number) => (
                  <div 
                    key={index}
                    className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-md"
                  >
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

        {/* Send template dialog - same UI as WhatsAppInbox template picker */}
        <Dialog open={showTemplateDialog} onClose={() => setShowTemplateDialog(false)} className="relative z-[60]">
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
                  ([...allTemplates]
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
                  )
                )}
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
    </>
  );
};

export default OrderCard; 