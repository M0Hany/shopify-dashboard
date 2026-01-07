import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';

interface MonthNavigatorProps {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  showDatePicker?: boolean;
  showToday?: boolean;
}

export default function MonthNavigator({ selectedMonth, onMonthChange, showDatePicker = true, showToday = true }: MonthNavigatorProps) {
  const navigateMonth = (direction: 'prev' | 'next') => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    
    if (direction === 'prev') {
      date.setMonth(date.getMonth() - 1);
    } else {
      date.setMonth(date.getMonth() + 1);
    }
    
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    onMonthChange(newMonth);
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    onMonthChange(currentMonth);
  };

  const formatMonthDisplay = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return format(date, 'MMMM yyyy');
  };

  const isCurrentMonth = selectedMonth === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const isFutureMonth = selectedMonth > `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => navigateMonth('prev')}
        className="p-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        title="Previous month"
      >
        <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
      </button>
      
      {showDatePicker && (
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => onMonthChange(e.target.value)}
          className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
        />
      )}
      
      {!showDatePicker && (
        <span className="text-sm text-gray-600 font-medium px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
          {formatMonthDisplay(selectedMonth)}
        </span>
      )}
      
      <button
        onClick={() => navigateMonth('next')}
        disabled={isFutureMonth}
        className="p-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Next month"
      >
        <ChevronRightIcon className="w-5 h-5 text-gray-600" />
      </button>
      
      {showToday && !isCurrentMonth && (
        <button
          onClick={goToCurrentMonth}
          className="px-3 py-2 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          title="Go to current month"
        >
          Today
        </button>
      )}
    </div>
  );
}

