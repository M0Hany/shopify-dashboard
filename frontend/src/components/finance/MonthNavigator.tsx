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
    <div className="flex items-stretch border border-gray-300 rounded-lg bg-white overflow-hidden">
      <button
        onClick={() => navigateMonth('prev')}
        className="p-0 w-8 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 flex-shrink-0 border-0 self-stretch"
        title="Previous month"
      >
        <ChevronLeftIcon className="w-5 h-5" />
      </button>
      
      {showDatePicker && (
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => onMonthChange(e.target.value)}
          className="px-3 text-sm text-gray-900 bg-white border-0 focus:outline-none focus:ring-0 flex-1 min-w-0"
          style={{ paddingTop: '0.375rem', paddingBottom: '0.375rem' }}
        />
      )}
      
      {!showDatePicker && (
        <span className="px-3 text-sm text-gray-900 bg-white flex-1 min-w-0 flex items-center" style={{ paddingTop: '0.375rem', paddingBottom: '0.375rem' }}>
          {formatMonthDisplay(selectedMonth)}
        </span>
      )}
      
      <button
        onClick={() => navigateMonth('next')}
        disabled={isFutureMonth}
        className="p-0 w-8 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all duration-200 flex-shrink-0 border-0 self-stretch"
        title="Next month"
      >
        <ChevronRightIcon className="w-5 h-5" />
      </button>
      
      {showToday && !isCurrentMonth && (
        <button
          onClick={goToCurrentMonth}
          className="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 flex-shrink-0 flex items-center"
          title="Go to current month"
        >
          Today
        </button>
      )}
    </div>
  );
}
