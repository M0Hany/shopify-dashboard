import React, { useState, useEffect } from 'react';
import { XMarkIcon, UserIcon, PhoneIcon, MapPinIcon, CalendarIcon, ClockIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { convertToCairoTime, calculateDaysRemaining } from '../utils/dateUtils';
import OrderTimeline from './OrderTimeline';

interface OrderDetailsProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdateDueDate?: (date: string) => void;
  onUpdateStartDate?: (date: string) => void;
}

const OrderDetails: React.FC<OrderDetailsProps> = ({ 
  order, 
  isOpen, 
  onClose, 
  onUpdateDueDate,
  onUpdateStartDate 
}) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [currentDueDate, setCurrentDueDate] = useState<Date>(new Date());
  const [currentStartDate, setCurrentStartDate] = useState<Date>(new Date());

  useEffect(() => {
    // Parse tags to look for custom_due_date tag
    const tags = Array.isArray(order.tags) ? order.tags :
                typeof order.tags === 'string' ? order.tags.split(',').map((t: string) => t.trim()) :
                [];
    
    const dueDateTag = tags.find((tag: string) => tag.startsWith('custom_due_date:'));
    const startDateTag = tags.find((tag: string) => tag.startsWith('custom_start_date:'));
    
    let initialDueDate;
    
    if (dueDateTag) {
      const dateStr = dueDateTag.split(':')[1];
      const parsedDate = convertToCairoTime(new Date(dateStr));
      if (!isNaN(parsedDate.getTime())) {
        initialDueDate = parsedDate;
      }
    }
    
    if (!initialDueDate) {
      // Use created_at date and add 14 days
      const createdAtDate = convertToCairoTime(new Date(order.effective_created_at || order.created_at));
      initialDueDate = new Date(createdAtDate);
      initialDueDate.setDate(initialDueDate.getDate() + 14);
      initialDueDate = convertToCairoTime(initialDueDate);
    }
    
    // Set initial start date
    let initialStartDate = convertToCairoTime(new Date(order.effective_created_at || order.created_at));
    
    if (startDateTag) {
      const dateStr = startDateTag.split(':')[1];
      const parsedDate = convertToCairoTime(new Date(dateStr));
      if (!isNaN(parsedDate.getTime())) {
        initialStartDate = parsedDate;
      }
    }
    
    setCurrentDueDate(initialDueDate);
    setCurrentStartDate(initialStartDate);
  }, [order]);
  
  if (!order) return null;

  // Use effective_created_at if available, otherwise fall back to created_at
  const createdAt = convertToCairoTime(new Date(order.effective_created_at || order.created_at));
  const daysLeft = calculateDaysRemaining(currentDueDate, convertToCairoTime(new Date()));

  const handleDateSelect = (date: Date) => {
    setCurrentDueDate(date);
    if (onUpdateDueDate) {
      onUpdateDueDate(date.toISOString());
    }
  };
  
  const handleStartDateSelect = (date: Date) => {
    console.log('Start date selected:', date.toISOString());
    setCurrentStartDate(date);
    if (onUpdateStartDate) {
      console.log('Calling onUpdateStartDate with:', date.toISOString());
      onUpdateStartDate(date.toISOString());
    } else {
      console.warn('onUpdateStartDate callback is not defined');
    }
  };

  // Check if due date is from a custom tag
  const tags = Array.isArray(order.tags) ? order.tags :
              typeof order.tags === 'string' ? order.tags.split(',').map((t: string) => t.trim()) :
              [];
  
  const dueDateTag = tags.find((tag: string) => tag.startsWith('custom_due_date:'));
  const startDateTag = tags.find((tag: string) => tag.startsWith('custom_start_date:'));
  const isCustomDueDate = !!dueDateTag;
  const isCustomStartDate = !!startDateTag;

  return (
    <>
      {/* Overlay */}
      <div 
        className={`fixed inset-0 bg-black transition-opacity duration-300 z-50 ${
          isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div 
        className={`fixed inset-y-0 right-0 w-full md:w-[480px] bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-[51] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="relative p-6 pb-5">
          <div className="flex justify-between items-start">
          <div>
              <h2 className="text-xl font-medium text-gray-900">
              Order Details
            </h2>
            <div className="flex items-center gap-2 mt-1">
                <h3 className="text-base text-gray-600">Order {order.name}</h3>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Placed on {format(createdAt, 'MMM d, yyyy')}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                order.fulfillment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                order.fulfillment_status === 'processing' ? 'bg-blue-500 text-white' :
                'bg-gray-100 text-gray-800'
              }`}>
                {order.fulfillment_status ? order.fulfillment_status.charAt(0).toUpperCase() + order.fulfillment_status.slice(1) : 'Pending'}
              </span>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 bg-white"
                aria-label="Close"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-200" />
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100vh-88px)] p-6 space-y-6">
          {/* Order Notes */}
          {order.note && (
            <section>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Order Notes</h3>
              <div className="bg-amber-50 rounded-lg p-4">
                <div className="flex gap-2">
                  <XMarkIcon className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-700 font-medium">{order.note}</p>
                </div>
              </div>
            </section>
          )}

          {/* Customer Information */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Customer Information</h3>
            <div className="bg-white rounded-lg border border-gray-100 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-900">
                  {order.customer?.first_name} {order.customer?.last_name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <PhoneIcon className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-900">{order.customer?.phone}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPinIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                <span className="text-sm text-gray-900">
                  {order.shipping_address?.address1}
                  {order.shipping_address?.address2 && <>, {order.shipping_address.address2}</>}<br />
                  {order.shipping_address?.city}, {order.shipping_address?.province} {order.shipping_address?.zip}
                </span>
              </div>
            </div>
          </section>

          {/* Timeline */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Timeline</h3>
            <div className="bg-white rounded-lg border border-gray-100 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">Order Date:</span>
                </div>
                <div className="relative">
                  <DatePicker
                    selected={currentStartDate}
                    onChange={handleStartDateSelect}
                    customInput={
                      <button className="text-sm text-gray-900 px-3 py-1 rounded border border-gray-200 hover:border-gray-300 flex items-center gap-1 bg-white">
                        {format(currentStartDate, 'MMM d, yyyy')}
                        <span className="text-blue-600 ml-1">›</span>
                      </button>
                    }
                    dateFormat="MMM d, yyyy"
                    popperPlacement="bottom-end"
                    popperClassName="z-50"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">Due Date:</span>
                </div>
                <div className="relative">
                  <DatePicker
                    selected={currentDueDate}
                    onChange={handleDateSelect}
                    customInput={
                      <button className="text-sm text-gray-900 px-3 py-1 rounded border border-gray-200 hover:border-gray-300 flex items-center gap-1 bg-white">
                        {format(currentDueDate, 'MMM d, yyyy')}
                        <span className="text-blue-600 ml-1">›</span>
                </button>
                    }
                    minDate={new Date()}
                    dateFormat="MMM d, yyyy"
                    popperPlacement="bottom-end"
                    popperClassName="z-50"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClockIcon className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">Days Left:</span>
                </div>
                <span className="text-sm font-medium text-[#FF9800]">
                  {daysLeft} days
                </span>
              </div>
            </div>
          </section>

          {/* Order Timeline Component */}
          <section>
            <OrderTimeline
              createdAt={currentStartDate.toISOString()}
              dueDate={currentDueDate.toISOString()}
              isCustom={isCustomDueDate || isCustomStartDate}
            />
          </section>

          {/* Items */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Items</h3>
            <div className="space-y-3">
              {order.line_items?.map((item: any, index: number) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.title}</p>
                      {item.variant_title && (
                        <p className="text-sm text-gray-500">{item.variant_title}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">${item.price}</p>
                      <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t p-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-lg font-semibold text-gray-900">${order.total_price}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default OrderDetails; 