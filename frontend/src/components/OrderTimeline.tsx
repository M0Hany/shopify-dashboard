import React from 'react';
import { ClockIcon, CalendarIcon } from '@heroicons/react/24/outline';
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

  // Get progress bar gradient colors based on days remaining
  const getProgressGradient = () => {
    if (daysLeft <= 2) return 'from-red-500 to-red-600'; // 2 days or overdue - red
    if (daysLeft <= 4) return 'from-yellow-400 to-yellow-500'; // 3-4 days - yellow
    return 'from-green-500 to-green-600'; // 5-7 days - green
  };

  // Get badge color for days left
  const getBadgeColor = () => {
    if (daysLeft <= 2) return 'bg-red-100 text-red-700 border-red-200'; // 2 days or overdue - red
    if (daysLeft <= 4) return 'bg-yellow-100 text-yellow-700 border-yellow-200'; // 3-4 days - yellow
    return 'bg-green-100 text-green-700 border-green-200'; // 5-7 days - green
  };

  // Ensure dates are valid
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    console.error('Invalid dates in OrderTimeline:', { start, end, createdAt, dueDate });
    return null;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 space-y-3">
      {/* Date Range */}
      <div className="flex items-center justify-between">
        <DatePicker
          selected={start}
          onChange={(date: Date) => onUpdateStartDate?.(date)}
          customInput={
            <button className="flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 py-1.5 px-3 rounded-md border border-gray-200 hover:border-gray-300 transition-all">
              <CalendarIcon className="w-4 h-4 text-gray-500" />
              {format(start, 'MMM d')}
            </button>
          }
          dateFormat="MMM d"
          popperPlacement="bottom-start"
          popperClassName="z-50"
        />
        <div className="flex-1 mx-3 flex items-center justify-center relative">
          <div className="h-px bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 w-full"></div>
          <span className="absolute text-xs text-gray-400 bg-white px-2">→</span>
        </div>
        <DatePicker
          selected={end}
          onChange={(date: Date) => onUpdateDueDate?.(date)}
          customInput={
            <button className={`flex items-center gap-1.5 text-sm font-medium py-1.5 px-3 rounded-md border transition-all ${
              isCustom 
                ? 'text-gray-700 bg-red-50 border-red-200 hover:bg-red-100 hover:border-red-300' 
                : 'text-gray-700 bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
            }`}>
              <CalendarIcon className="w-4 h-4 text-gray-500" />
              {format(end, 'MMM d')}
            </button>
          }
          minDate={new Date()}
          dateFormat="MMM d"
          popperPlacement="bottom-end"
          popperClassName="z-50"
        />
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
          <div
            className={`h-full bg-gradient-to-r ${getProgressGradient()} transition-all duration-500 ease-out rounded-full`}
            style={{ width: `${calculateProgress()}%` }}
          />
        </div>
        
        {/* Days Left Badge */}
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${getBadgeColor()}`}>
            <ClockIcon className="w-3.5 h-3.5" />
            <span>
              {daysLeft < 0
                ? `${Math.abs(daysLeft)} days overdue`
                : daysLeft === 0
                ? 'Due today'
                : `${daysLeft} days left`}
            </span>
          </div>
          {isCustom && (
            <span className="text-xs text-gray-500 italic">Custom due date</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderTimeline; 