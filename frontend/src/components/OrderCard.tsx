import React, { useState, useEffect, useRef, useMemo } from 'react';
import whatsappLogo from '../assets/whatsapp.png';
import { UserIcon, CurrencyDollarIcon, ExclamationTriangleIcon, PencilIcon, StarIcon as StarIconOutline, ChevronDownIcon, XMarkIcon, PhoneIcon, TruckIcon, TrashIcon, MapPinIcon, CheckIcon, CalendarIcon, TagIcon, PlusIcon, ChatBubbleLeftIcon, ClipboardDocumentIcon, EllipsisHorizontalIcon, DocumentTextIcon, HashtagIcon, ClockIcon, SparklesIcon, CheckBadgeIcon, PaperAirplaneIcon, XCircleIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid, PhoneArrowUpRightIcon } from '@heroicons/react/24/solid';
import OrderTimeline from './OrderTimeline';
import { convertToCairoTime } from '../utils/dateUtils';
import { Menu } from '@headlessui/react';
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
  status: string; 
  orderTags: string[];
  fulfillments?: Array<{
    id: number;
    status: string;
    shipment_status?: string;
    tracking_company?: string;
    tracking_number?: string;
    created_at?: string;
    updated_at?: string;
  }>;
}> = ({ status, orderTags, fulfillments }) => {
  // Check if order is shipped with ShipBlu
  const isShipBlu = orderTags.some((tag: string) => 
    tag.trim().toLowerCase() === 'sent to shipblu'
  );

  // Get ShipBlu delivery status from fulfillments
  const getShipBluStatus = () => {
    if (!isShipBlu || !fulfillments || fulfillments.length === 0) return null;
    
    // Find the most recent fulfillment with shipment_status
    const fulfillmentWithStatus = fulfillments
      .filter(f => f.shipment_status)
      .sort((a, b) => {
        const aDate = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const bDate = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return bDate - aDate; // Most recent first
      })[0];
    
    return fulfillmentWithStatus?.shipment_status || null;
  };

  // Get shipping date from tags
  const getShippingDaysAgo = () => {
    const now = new Date();
    const shippingDateTag = orderTags.find((tag: string) => tag.trim().startsWith('shipping_date:'));
    if (shippingDateTag) {
      const dateStr = shippingDateTag.trim().split(':')[1]?.trim();
      if (dateStr) {
        const shippingDate = new Date(dateStr);
        const diffTime = Math.abs(now.getTime() - shippingDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return `Shipped ${diffDays} days ago`;
      }
    }
    return 'Shipped recently';
  };

  // Get shipping barcode from tags
  const getShippingBarcode = () => {
    const barcodeTag = orderTags.find((tag: string) => tag.trim().startsWith('shipping_barcode:'));
    return barcodeTag ? barcodeTag.trim().split(':')[1]?.trim() : null;
  };

  // Get shipping status from tags
  const getShippingStatus = () => {
    const statusTag = orderTags.find((tag: string) => tag.trim().startsWith('shipping_status:'));
    return statusTag ? statusTag.trim().split(':')[1]?.trim() : null;
  };

  const shippingBarcode = getShippingBarcode();
  const shippingStatus = getShippingStatus();
  const shipBluStatus = getShipBluStatus();

  // If ShipBlu, show ShipBlu status; otherwise show regular shipping status
  if (isShipBlu) {
    return (
      <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-md">
        <TruckIcon className="w-5 h-5 text-blue-600" />
        <div className="flex flex-col">
          <span className="text-sm text-blue-700 font-medium">
            {getShippingDaysAgo()}
          </span>
          {shipBluStatus && (
            <div className="text-xs text-blue-600">
              <div className="italic">
                Delivery Status: {shipBluStatus}
              </div>
            </div>
          )}
          {shippingBarcode && (
            <div className="text-xs font-mono text-blue-500 mt-1">
              {shippingBarcode}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-md">
      <TruckIcon className="w-5 h-5 text-purple-600" />
      <div className="flex flex-col">
        <span className="text-sm text-purple-700 font-medium">
          {getShippingDaysAgo()}
        </span>
        {shippingStatus && (
          <div className="text-xs text-purple-600">
            <div className="italic">
              {shippingStatus}
            </div>
          </div>
        )}
        {shippingBarcode && (
          <div className="text-xs font-mono text-purple-500 mt-1">
            {shippingBarcode}
          </div>
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
  const [isNeighborhoodDialogOpen, setIsNeighborhoodDialogOpen] = useState(false);
  const [isSubzoneDialogOpen, setIsSubzoneDialogOpen] = useState(false);
  const [isCityDialogOpen, setIsCityDialogOpen] = useState(false);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<Zone | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [itemsExpanded, setItemsExpanded] = useState(false);
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
  
  // Check if manual WhatsApp confirmation has been sent
  const hasManualWhatsAppConfirmation = trimmedTags.includes('manual_whatsapp_confirmation');
  
  // Check if automated WhatsApp confirmation tag exists
  const hasAutomatedWhatsAppConfirmation = trimmedTags.includes('automated_whatsapp_confirmation');
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

  // Detect making time from line items
  const makingTimeDays = detectMakingTime(order.line_items || []);
  const isRushOrder = makingTimeDays === 3;
  const isHandmadeOrder = makingTimeDays === 7;
  
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
      case 'confirmed':
        return 'bg-green-600 text-white';
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
      case 'confirmed':
        return <CheckBadgeIcon className="w-5 h-5" />;
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
      toast.success('Phone number copied to clipboard');
    } catch (error) {
      console.error('Failed to copy phone number:', error);
      toast.error('Failed to copy phone number');
    }
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
    
    // Generate the WhatsApp message
    const message = getManualWhatsAppConfirmationTemplate(
      order.customer.first_name || '',
      order.line_items || []
    );
    
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
    
    // Automatically add priority tag if it doesn't exist (custom due date = priority order)
    if (!updatedTags.includes('priority')) {
      updatedTags = [...updatedTags, 'priority'];
      setLocalPriority(true); // Update local state for instant UI feedback
    }
    
    if (onUpdateTags) {
      onUpdateTags(order.id, updatedTags);
    }
    
    // Also update priority via the priority handler to ensure backend is updated
    if (onTogglePriority && !currentTags.includes('priority')) {
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

  return (
    <>
    <div 
      className={`bg-white rounded-lg border ${isOrderCancelled ? 'border-red-200' : 'border-gray-200'} hover:border-gray-300 transition-all duration-200 ${
        isRushOrder ? 'border-l-4 border-l-red-500' : 
        isHandmadeOrder ? 'border-l-4 border-l-blue-500' : 
        ''
      }`}
      title={isRushOrder ? 'Rush Order (3 days)' : isHandmadeOrder ? 'Handmade Timeline (7 days)' : undefined}
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
              <span className="text-base font-semibold text-gray-900 truncate">
                {order.customer?.first_name} {order.customer?.last_name}
              </span>
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
                        {!isOrderCancelled && (
                          <>
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
                            {isOrderReady && (
                              <Menu.Item>
                                {({ active }) => (
                                  <button
                                    onClick={handleManualWhatsAppConfirmation}
                                    className={`${active ? 'bg-gray-100' : ''} flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700`}
                                    title={hasManualWhatsAppConfirmation ? "WhatsApp confirmation already sent" : "Send WhatsApp shipping confirmation"}
                                  >
                                    <img
                                      src={whatsappLogo}
                                      alt="WhatsApp"
                                      className={`w-4 h-4 ${hasManualWhatsAppConfirmation ? 'opacity-100' : 'opacity-30'}`}
                                    />
                                    WhatsApp confirmation
                                  </button>
                                )}
                              </Menu.Item>
                            )}
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
                          <PhoneIcon className="w-5 h-5 text-green-500 flex-shrink-0 hover:text-green-600 transition-colors" />
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
                <span className="truncate">{order.customer.phone}</span>
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
                  <MapPinIcon className={`w-5 h-5 ${
                    locationIds.cityId && locationIds.neighborhoodId && locationIds.subZoneId &&
                    locationIds.cityId !== "null" && locationIds.neighborhoodId !== "null" && locationIds.subZoneId !== "null"
                      ? 'text-green-500 hover:text-green-600' 
                      : 'text-red-500 hover:text-red-600'
                  } transition-colors`} />
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

            {/* Right Side: Order ID and Price */}
            <div className="flex flex-col gap-2 flex-shrink-0">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <button
                  className="p-1 cursor-pointer rounded hover:bg-gray-100 transition-colors"
                  title="Order ID"
                >
                  <HashtagIcon className="w-5 h-5 text-gray-400 flex-shrink-0 hover:text-gray-500 transition-colors" />
                </button>
                <span className="truncate font-medium">{order.name}</span>
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

        {/* Order Notes - only show if not cancelled */}
        {!isOrderCancelled && order.note && (
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

        {/* Timeline or Shipping Status - only show if not cancelled and not paid */}
        {!isOrderCancelled && !trimmedTags.includes('paid') && (
          <>
            {trimmedTags.includes('shipped') ? (
              <div className="mb-4">
                <ShippingStatus 
                  status={order.packageENStatus || 'Pending pickup'} 
                  orderTags={trimmedTags}
                  fulfillments={order.fulfillments}
                />
              </div>
            ) : !trimmedTags.includes('fulfilled') && (
              <div className="mb-4">
                <OrderTimeline
                  createdAt={startDate.toISOString()}
                  dueDate={dueDate.toISOString()}
                  isCustom={!!dueDateTag}
                  orderName={order.name}
                  onUpdateStartDate={handleStartDateSelect}
                  onUpdateDueDate={handleDateSelect}
                />
              </div>
            )}
          </>
        )}

        {/* Condensed Items List */}
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">{regularLineItems.length} items</div>
          <div className="space-y-0.5">
            {(itemsExpanded ? regularLineItems : regularLineItems.slice(0, 2)).map((item: any, index: number) => (
              <div key={index} className="flex justify-between text-xs">
                <span className={`truncate ${isOrderCancelled ? 'text-gray-500 line-through' : 'text-gray-700'}`}>
                  {item.title}
                  {item.variant_title && ` (${item.variant_title})`}
                </span>
                <span className="text-gray-500 ml-2 flex-shrink-0">×{item.quantity}</span>
              </div>
            ))}
            {regularLineItems.length > 2 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setItemsExpanded(!itemsExpanded);
                }}
                className="text-xs text-blue-600 hover:text-blue-700 mt-1"
              >
                {itemsExpanded ? 'Show less' : `+${regularLineItems.length - 2} more items`}
              </button>
            )}
          </div>
          
          {/* Addon Line Items (Making Time Options) */}
          {addonLineItems.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-500 mb-1">Making Time:</div>
              <div className="space-y-1">
                {addonLineItems.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between text-sm">
                    <div className="flex gap-2 items-center">
                      <span className={`${isOrderCancelled ? 'text-gray-500 line-through' : 'text-blue-700 font-medium'}`}>
                        {item.title}
                        {item.properties && item.properties.length > 0 && (
                          <span className="text-gray-600 ml-2">
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
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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
    </>
  );
};

export default OrderCard; 