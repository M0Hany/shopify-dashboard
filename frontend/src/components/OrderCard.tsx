import React, { useState, useEffect, useRef, useMemo } from 'react';
import instapayLogo from '../assets/instapay.png';
import { UserIcon, CurrencyDollarIcon, ExclamationTriangleIcon, PencilIcon, StarIcon as StarIconOutline, ChevronDownIcon, XMarkIcon, PhoneIcon, TruckIcon, TrashIcon, MapPinIcon, CheckIcon, CalendarIcon, TagIcon, PlusIcon, ChatBubbleLeftIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
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
}> = ({ status, orderTags }) => {
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
  const isInstapayPaid = trimmedTags.includes('instapay_paid');
  const isInstapayOrder = useMemo(() => {
    const paymentGateways: string[] = Array.isArray((order as any)?.payment_gateway_names)
      ? (order as any).payment_gateway_names
      : typeof (order as any)?.payment_gateway_names === 'string'
        ? [(order as any).payment_gateway_names]
        : [];
    const gatewayStr = paymentGateways.join(' ').toLowerCase();
    const gatewayMentionsInstaPay = gatewayStr.includes('instapay') || gatewayStr.includes('pay via instapay');
    return gatewayMentionsInstaPay || trimmedTags.includes('instapay') || isInstapayPaid;
  }, [order, trimmedTags, isInstapayPaid]);
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
    // Calculate due date based on start date (either custom or created_at)
    dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + 14);
    dueDate = convertToCairoTime(dueDate);
  }

  // Ensure both dates are valid
  if (isNaN(startDate.getTime()) || isNaN(dueDate.getTime())) {
    console.error('Invalid dates:', { startDate, dueDate, order });
    // Fallback to created_at + 14 days if dates are invalid
    startDate = convertToCairoTime(new Date(order.created_at));
    dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + 14);
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
    if (!order.customer?.phone || isOrderConfirmed) return;
    setShowReadyConfirmDialog(true);
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
    const updatedTags = [...tagsWithoutDueDate, `custom_due_date:${formattedDate}`];
    
    if (onUpdateTags) {
      onUpdateTags(order.id, updatedTags);
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
      className={`bg-white rounded-lg border ${isOrderCancelled ? 'border-red-200' : 'border-gray-200'} hover:border-gray-300 transition-all duration-200`}
    >
      <div className="p-4">
        {/* Header: Checkbox, Note Icon, and Status */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
          <div 
            onClick={handleCheckboxClick}
            className="relative w-5 h-5 cursor-pointer"
          >
            <div className={`absolute w-5 h-5 rounded-full border-2 ${isSelected ? 'border-blue-600' : 'border-gray-300'} bg-white`} />
            {isSelected && (
              <div className="absolute w-3 h-3 rounded-full bg-blue-600" style={{ top: '4px', left: '4px' }} />
            )}
          </div>
            {!isOrderCancelled && (
              <>
            <button
              onClick={handleNoteIconClick}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200 bg-white rounded-md"
              title="Add note"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
            <button
                    onClick={handleOrderReadyClick}
                    disabled={isOrderConfirmed || !order.customer?.phone}
                    className="p-1 bg-white rounded-md"
                    title={isOrderConfirmed ? "Order already confirmed" : "Confirm order is ready"}
            >
                    <CheckIcon className={`w-4 h-4 ${isOrderConfirmed ? 'text-gray-300' : 'text-blue-500'}`} />
            </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Tag button will be moved after InstaPay block to keep order: Priority -> InstaPay -> Tags */}
            
            {isOrderCancelled && (
              <button
                onClick={handleDeleteClick}
                className="p-1 transition-all duration-200 bg-white rounded-md"
                title="Delete order"
              >
                <TrashIcon className="w-4 h-4 text-red-500 hover:text-red-600" />
              </button>
            )}
            <button
              onClick={handlePriorityClick}
              className="p-1 transition-all duration-200 bg-white rounded-md"
              title={isPriority ? "Remove priority" : "Add priority"}
            >
              {isPriority ? (
                <StarIconSolid className="w-4 h-4 text-yellow-500" />
              ) : (
                <StarIconOutline className="w-4 h-4 text-gray-300" />
              )}
            </button>

            {isInstapayOrder && (
              <Menu as="div" className="relative inline-block text-left">
                {({ open }) => (
                  <>
                    <div>
                      <Menu.Button
                        className="p-1 bg-white rounded-md focus:outline-none"
                        title="InstaPay payment status"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <img
                          src={instapayLogo}
                          alt="InstaPay"
                          className={`h-[15px] w-auto ${isInstapayPaid ? 'opacity-100' : 'opacity-30'}`}
                        />
                      </Menu.Button>
                    </div>
                    {open && (
                      <Menu.Items
                        static
                        className="absolute right-0 mt-1 w-32 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="py-1">
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                className={`block w-full text-left px-3 py-1.5 text-sm ${active ? 'bg-gray-100' : 'bg-white'} ${isInstapayPaid ? 'text-green-700' : 'text-gray-700'}`}
                                onClick={() => {
                                  const currentTags = Array.isArray(order.tags)
                                    ? order.tags.map((t: string) => t.trim())
                                    : typeof order.tags === 'string'
                                      ? order.tags.split(',').map((t: string) => t.trim())
                                      : [];
                                  if (!currentTags.includes('instapay_paid')) {
                                    const updated = [...currentTags, 'instapay_paid'];
                                    onUpdateTags && onUpdateTags(order.id, updated);
                                  }
                                }}
                              >
                                Paid
                              </button>
                            )}
                          </Menu.Item>
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                className={`block w-full text-left px-3 py-1.5 text-sm ${active ? 'bg-gray-100' : 'bg-white'} ${!isInstapayPaid ? 'text-red-700' : 'text-gray-700'}`}
                                onClick={() => {
                                  const currentTags = Array.isArray(order.tags)
                                    ? order.tags.map((t: string) => t.trim())
                                    : typeof order.tags === 'string'
                                      ? order.tags.split(',').map((t: string) => t.trim())
                                      : [];
                                  const updated = currentTags.filter((t: string) => t !== 'instapay_paid');
                                  onUpdateTags && onUpdateTags(order.id, updated);
                                }}
                              >
                                Not paid
                              </button>
                            )}
                          </Menu.Item>
                        </div>
                      </Menu.Items>
                    )}
                  </>
                )}
              </Menu>
            )}
            <button
              onClick={handleTagClick}
              className="p-1 transition-all duration-200 bg-white rounded-md"
              title="Manage tags"
            >
              <TagIcon className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
            <Menu as="div" className="relative inline-block text-left">
              {({ open }) => (
                <>
                  <div>
                    <Menu.Button 
                      className={`inline-flex items-center justify-center px-3 py-1.5 rounded-full text-sm font-medium leading-4 ${getStatusColor(currentStatus)}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {currentStatus}
                      <ChevronDownIcon className="w-3 h-3 ml-1" />
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
          </div>
        </div>

        {/* Customer Info and Price */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-900">
              {order.customer?.first_name} {order.customer?.last_name}
            </span>
          </div>
          {order.customer?.phone && (
            <div className="flex items-center gap-2">
              <PhoneIcon className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-700">{order.customer.phone}</span>
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={handleWhatsAppChat}
                  className="p-1 text-green-600 hover:text-green-700 bg-white hover:bg-green-50 rounded transition-colors"
                  title="Open WhatsApp chat"
                >
                  <ChatBubbleLeftIcon className="w-3 h-3" />
                </button>
                <button
                  onClick={handleCopyPhone}
                  className="p-1 text-gray-500 hover:text-gray-700 bg-white hover:bg-gray-50 rounded transition-colors"
                  title="Copy phone number"
                >
                  <ClipboardDocumentIcon className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
          {order.shipping_address && (
            <div className="flex items-center gap-2">
              <MapPinIcon className={`w-4 h-4 ${
                locationIds.cityId && locationIds.neighborhoodId && locationIds.subZoneId &&
                locationIds.cityId !== "null" && locationIds.neighborhoodId !== "null" && locationIds.subZoneId !== "null"
                  ? 'text-green-500' 
                  : 'text-red-500'
              }`} />
              {locationIds.cityId && locationIds.cityId !== "null" ? (
                <div className="flex items-center gap-2 w-full">
                  <span className="text-xs text-gray-700">
                    {cityData?.ArName || cityData?.EnName}
                    {locationIds.neighborhoodId && locationIds.neighborhoodId !== "null" ? (
                      <>
                        , {cityData?.Zones.find(z => z.Id.toString() === locationIds.neighborhoodId)?.ArName}
                        {locationIds.subZoneId && locationIds.subZoneId !== "null" ? (
                          <>
                            , {cityData?.Zones
                                .find(z => z.Id.toString() === locationIds.neighborhoodId)
                                ?.SubZones.find(sz => sz.Id.toString() === locationIds.subZoneId)?.ArName}
                          </>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startLocationEdit();
                            }}
                            className={`ml-2 px-2 py-0.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors ${
                              canEditLocation ? 'text-gray-600' : 'text-blue-600'
                            }`}
                          >
                            {canEditLocation ? 'Edit Location' : 'View Address'}
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startLocationEdit();
                        }}
                        className={`ml-2 px-2 py-0.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors ${
                          canEditLocation ? 'text-gray-600' : 'text-blue-600'
                        }`}
                      >
                        {canEditLocation ? 'Edit Location' : 'View Address'}
                      </button>
                    )}
                  </span>
                  {locationIds.cityId && locationIds.neighborhoodId && locationIds.subZoneId &&
                   locationIds.cityId !== "null" && locationIds.neighborhoodId !== "null" && locationIds.subZoneId !== "null" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startLocationEdit();
                      }}
                      className={`ml-2 px-2 py-0.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors ${
                        canEditLocation ? 'text-gray-600' : 'text-blue-600'
                      }`}
                    >
                      {canEditLocation ? 'Edit Location' : 'View Address'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-500">Missing address</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startLocationEdit();
                    }}
                    className={`px-2 py-0.5 text-xs bg-white border rounded transition-colors ${
                      canEditLocation 
                        ? 'border-red-300 text-red-600 hover:bg-red-50' 
                        : 'border-blue-300 text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    {canEditLocation ? 'Choose Location' : 'View Address'}
                  </button>
                </div>
              )}
            </div>
          )}
          {/* WhatsApp Messages Status */}
          <div className="flex items-center gap-2">
            <ChatBubbleLeftIcon className="w-4 h-4 text-gray-400" />
            <div className="flex items-center gap-1.5">
              {trimmedTags.includes('confirmation_sent') && (
                <span className="px-2 py-0.5 text-xs bg-gray-50 border border-gray-200 text-gray-600 rounded">
                  confirmation
                </span>
              )}
              {trimmedTags.includes('order_ready_confirmed') && (
                <span className="px-2 py-0.5 text-xs bg-gray-50 border border-gray-200 text-gray-600 rounded">
                  ready
                </span>
              )}
              {trimmedTags.includes('shipping_notification_sent') && (
                <span className="px-2 py-0.5 text-xs bg-gray-50 border border-gray-200 text-gray-600 rounded">
                  shipped
                </span>
              )}
              {!trimmedTags.includes('confirmation_sent') && 
               !trimmedTags.includes('order_ready_confirmed') && 
               !trimmedTags.includes('shipping_notification_sent') && (
                <span className="text-xs text-gray-400">No messages sent</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CurrencyDollarIcon className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-900">
              ${order.total_price}
            </span>
          </div>
        </div>

        {/* Order Notes - only show if not cancelled */}
        {!isOrderCancelled && order.note && (
          <div className="mb-4 p-3 bg-amber-50 rounded-md">
            <div className="flex gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0" />
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

        {/* Items List */}
        <div className="space-y-2 mb-4">
          <div className="text-xs text-gray-500">{order.line_items?.length} items:</div>
          <div className="space-y-1">
            {order.line_items?.map((item: any, index: number) => (
              <div key={index} className="flex justify-between text-sm">
                <div className="flex gap-2">
                  <span className={`${isOrderCancelled ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                    {item.title}
                    {item.variant_title && ` (${item.variant_title})`}
                  </span>
                  <span className="text-gray-500">×{item.quantity}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Number */}
        <div className="pt-3 border-t">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Order {order.name}</span>
            <span className="text-xs text-gray-500">{order.line_items?.length} items</span>
            </div>
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