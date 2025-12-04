import React from 'react';
import { ClockIcon } from '@heroicons/react/24/outline';
import { convertToCairoTime, calculateDaysRemaining } from '../utils/dateUtils';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format } from 'date-fns';

interface OrderTimelineProps {
  createdAt: string;
  dueDate: string;
  isCustom?: boolean;
  orderName?: string;
  onUpdateStartDate?: (date: Date) => void;
  onUpdateDueDate?: (date: Date) => void;
}

const OrderTimeline: React.FC<OrderTimelineProps> = ({ 
  createdAt, 
  dueDate, 
  isCustom, 
  orderName,
  onUpdateStartDate,
  onUpdateDueDate 
}) => {
  // Ensure dates are in Cairo timezone
  const start = convertToCairoTime(new Date(createdAt));
  const end = convertToCairoTime(new Date(dueDate));
  const now = convertToCairoTime(new Date());
  const daysLeft = calculateDaysRemaining(end, now);

  // Debug logging only for order #1040
  if (orderName === '#1040') {
    console.log('OrderTimeline dates for #1040:', {
      createdAt,
      dueDate,
      start: start.toISOString(),
      end: end.toISOString(),
      now: now.toISOString(),
      daysLeft
    });
  }

  // Format date to show only month and day
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'Africa/Cairo'
    });
  };

  // Calculate progress percentage based on priority intervals
  const calculateProgress = () => {
    if (daysLeft <= 0) return 100; // Overdue - full width
    if (daysLeft <= 2) return 90; // High priority (1-2 days)
    if (daysLeft <= 4) return 75; // Medium priority (3-4 days)
    if (daysLeft <= 7) return 60; // Normal (5-7 days)
    return 30; // Default for more than 7 days
  };

  // Get progress bar color based on days remaining
  // 7-5 days: green, 4-3 days: yellow, 2-overdue: red
  const getProgressColor = () => {
    if (daysLeft <= 2) return 'bg-red-500'; // 2 days or overdue - red
    if (daysLeft <= 4) return 'bg-yellow-500'; // 3-4 days - yellow
    return 'bg-green-500'; // 5-7 days - green
  };

  // Ensure dates are valid
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    console.error('Invalid dates in OrderTimeline:', { start, end, createdAt, dueDate });
    return null;
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm text-gray-600">
        <DatePicker
          selected={start}
          onChange={(date: Date) => onUpdateStartDate?.(date)}
          customInput={
            <button className="text-sm text-gray-600 bg-white py-0.5 px-1.5 rounded border border-gray-200 hover:border-gray-300">
              {format(start, 'MMM d')}
              <span className="text-blue-600 ml-1">›</span>
            </button>
          }
          dateFormat="MMM d"
          popperPlacement="bottom-start"
          popperClassName="z-50"
        />
        <DatePicker
          selected={end}
          onChange={(date: Date) => onUpdateDueDate?.(date)}
          customInput={
            <button className={`text-sm py-0.5 px-1.5 rounded border ${
              isCustom 
                ? 'text-gray-700 bg-red-100 border-red-300 hover:border-red-400' 
                : 'text-gray-600 bg-white border-gray-200 hover:border-gray-300'
            }`}>
              {format(end, 'MMM d')}
              <span className="text-blue-600 ml-1">›</span>
            </button>
          }
          minDate={new Date()}
          dateFormat="MMM d"
          popperPlacement="bottom-end"
          popperClassName="z-50"
        />
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getProgressColor()} transition-all duration-300`}
          style={{ width: `${calculateProgress()}%` }}
        />
      </div>
      <div className="flex items-center gap-1 text-sm text-gray-600">
        <ClockIcon className="w-4 h-4" />
        <span>
          {daysLeft < 0
            ? `${Math.abs(daysLeft)} days overdue`
            : daysLeft === 0
            ? 'Due today'
            : `${daysLeft} days left`}
        </span>
      </div>
    </div>
  );
};

export default OrderTimeline; 