import React, { useState, useEffect } from 'react';
import { UserIcon, CurrencyDollarIcon, ExclamationTriangleIcon, PencilIcon, StarIcon as StarIconOutline } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import OrderTimeline from './OrderTimeline';
import { convertToCairoTime } from '../utils/dateUtils';

interface OrderCardProps {
  order: any;
  onClick: () => void;
  isSelected?: boolean;
  onSelect?: (orderId: number) => void;
  onUpdateNote?: (orderId: number, note: string) => void;
  onTogglePriority?: (orderId: number, isPriority: boolean) => void;
}

const OrderCard: React.FC<OrderCardProps> = ({ 
  order, 
  onClick, 
  isSelected = false,
  onSelect,
  onUpdateNote,
  onTogglePriority
}) => {
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteText, setNoteText] = useState(order.note || '');
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'shipped':
        return 'bg-purple-100 text-purple-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
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

  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateNote) {
      onUpdateNote(order.id, noteText);
    }
    setIsNoteModalOpen(false);
  };

  const handlePriorityClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalPriority((prev: boolean) => !prev);
    console.log('Priority icon clicked. tags:', tags, 'isPriority:', !localPriority);
    if (onTogglePriority) {
      onTogglePriority(order.id, !localPriority);
    }
  };

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
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(order.fulfillment_status || 'pending')}`}>
              {order.fulfillment_status || 'pending'}
            </span>
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
            <div className="bg-white rounded-lg p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-medium mb-4">Add Note</h3>
              <form onSubmit={handleNoteSubmit}>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="w-full h-32 p-2 border rounded-md mb-4 bg-white"
                  placeholder="Enter your note here..."
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNoteModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
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
      </div>
    </div>
  );
};

export default OrderCard; 