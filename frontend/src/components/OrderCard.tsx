import React, { useState, useEffect, useRef } from 'react';
import { UserIcon, CurrencyDollarIcon, ExclamationTriangleIcon, PencilIcon, StarIcon as StarIconOutline, ChevronDownIcon, ChatBubbleLeftRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import OrderTimeline from './OrderTimeline';
import { convertToCairoTime } from '../utils/dateUtils';
import { Menu } from '@headlessui/react';

interface OrderCardProps {
  order: any;
  onClick: () => void;
  isSelected?: boolean;
  onSelect?: (orderId: number) => void;
  onUpdateNote?: (orderId: number, note: string) => void;
  onTogglePriority?: (orderId: number, isPriority: boolean) => void;
  onUpdateStatus?: (orderId: number, status: string) => void;
  onSendWhatsAppMessage?: (orderId: number, phone: string, message: string) => void;
  onSendConfirmationMessage?: (orderId: number, phone: string) => void;
}

const OrderCard: React.FC<OrderCardProps> = ({ 
  order, 
  onClick, 
  isSelected = false,
  onSelect,
  onUpdateNote,
  onTogglePriority,
  onUpdateStatus,
  onSendWhatsAppMessage,
  onSendConfirmationMessage
}) => {
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isShippedModalOpen, setIsShippedModalOpen] = useState(false);
  const [whatsAppMessage, setWhatsAppMessage] = useState('');
  const [noteText, setNoteText] = useState(order.note || '');
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
  
  const dueDateTag = tags.find((tag: string) => tag.startsWith('custom_due_date:'));
  
  // Calculate dates in Cairo timezone
  const createdAt = convertToCairoTime(new Date(order.effective_created_at || order.created_at));
  let dueDate;
  
  if (dueDateTag) {
    const dateStr = dueDateTag.split(':')[1];
    const parsedDate = convertToCairoTime(new Date(dateStr));
    if (!isNaN(parsedDate.getTime())) {
      dueDate = parsedDate;
    }
  }
  
  if (!dueDate) {
    dueDate = new Date(createdAt);
    dueDate.setDate(dueDate.getDate() + 14);
    dueDate = convertToCairoTime(dueDate);
  }

  // Determine the current status based on tags and fulfillment status
  const getCurrentStatus = () => {
    // Trim all tags for consistent matching
    const trimmedTags = tags.map((tag: string) => tag.trim());
    
    if (order.fulfillment_status === 'fulfilled') {
      return 'fulfilled';
    } else if (trimmedTags.includes('shipped')) {
      return 'shipped';
    } else if (trimmedTags.includes('ready to ship')) {
      return 'ready to ship';
    } else if (trimmedTags.includes('customer_confirmed')) {
      return 'confirmed';
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
      case 'confirmed':
        return 'bg-green-600 text-white';
      case 'ready to ship':
        return 'bg-blue-600 text-white font-medium';
      case 'shipped':
        return 'bg-purple-600 text-white';
      case 'fulfilled':
        return 'bg-emerald-600 text-white';
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
    
    // Send status update to the server
    if (onUpdateStatus) {
      onUpdateStatus(order.id, newStatus);
    }
  };

  // Add useEffect to ensure the shipped modal opens when status changes to shipped
  useEffect(() => {
    if (currentStatus === 'shipped' && 
        !isShippedModalOpen && 
        order.customer?.phone) {
      setIsShippedModalOpen(true);
    }
  }, [currentStatus, order.customer?.phone]);

  const handleFulfillOrder = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUpdateStatus) {
      onUpdateStatus(order.id, 'fulfill');
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

  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-all duration-200 cursor-pointer"
    >
      <div className="p-4">
        {/* Header: Checkbox, Note Icon, and Status */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
          <div 
            onClick={handleCheckboxClick}
            className="relative w-5 h-5 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}}
              className="absolute w-5 h-5 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </div>
            <button
              onClick={handleNoteIconClick}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200 bg-white rounded-md"
              title="Add note"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
            <button
              onClick={handleChatIconClick}
              className="p-1 text-gray-400 hover:text-green-600 transition-colors duration-200 bg-white rounded-md"
              title="Send WhatsApp message"
            >
              <ChatBubbleLeftRightIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
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
            <Menu as="div" className="relative inline-block text-left">
              {({ open }) => (
                <>
                  <div>
                    <Menu.Button 
                      className={`inline-flex items-center justify-center px-3 py-1.5 rounded-full text-sm font-medium ${getStatusColor(currentStatus)}`}
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
                              className={`rounded-md w-full text-center py-1.5 text-sm font-medium ${getStatusColor('ready to ship')}`}
                              onClick={() => handleStatusChange('ready to ship')}
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
                        {order.fulfillment_status !== 'fulfilled' && (
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                className={`rounded-md w-full text-center py-1.5 text-sm font-medium bg-emerald-600 text-white`}
                                onClick={handleFulfillOrder}
                              >
                                Fulfill
                              </button>
                            )}
                          </Menu.Item>
                        )}
                        {order.fulfillment_status === 'fulfilled' && (
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                className={`rounded-md w-full text-center py-1.5 text-sm font-medium ${getStatusColor('fulfilled')}`}
                                onClick={() => handleStatusChange('fulfilled')}
                                disabled
                              >
                                Fulfilled
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

        {/* Customer Info and Price */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-900">
              {order.customer?.first_name} {order.customer?.last_name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CurrencyDollarIcon className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-900">
              ${order.total_price}
            </span>
          </div>
        </div>

        {/* Order Notes */}
        {order.note && (
          <div className="mb-4 p-3 bg-amber-50 rounded-md">
            <div className="flex gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-700 font-medium">
                {order.note}
              </p>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="mb-4">
          <OrderTimeline
            createdAt={createdAt.toISOString()}
            dueDate={dueDate.toISOString()}
            isCustom={!!dueDateTag}
          />
        </div>

        {/* Items List */}
        <div className="space-y-2 mb-4">
          <div className="text-xs text-gray-500">{order.line_items?.length} items:</div>
          <div className="space-y-1">
            {order.line_items?.map((item: any, index: number) => (
              <div key={index} className="flex justify-between text-sm">
                <div className="flex gap-2">
                  <span className="text-gray-900">
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

        {/* Note Modal */}
        {isNoteModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div ref={noteModalRef} className="bg-white rounded-lg p-6 max-w-md w-full relative">
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
            <div ref={whatsAppModalRef} className="bg-white rounded-lg p-6 max-w-md w-full relative">
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
            <div ref={shippedModalRef} className="bg-white rounded-lg p-6 max-w-md w-full relative">
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
      </div>
    </div>
  );
};

export default OrderCard; 