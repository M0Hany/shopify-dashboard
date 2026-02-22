import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import OrderTimeline from '../components/OrderTimeline';
import OrderCard from '../components/OrderCard';
import { MagnifyingGlassIcon, ViewColumnsIcon, ArrowUpIcon, ChevronDownIcon, XMarkIcon, CheckIcon, ArrowPathIcon, ArrowUpCircleIcon, Squares2X2Icon, MapPinIcon, CalendarDaysIcon, TruckIcon, BoltIcon, ClockIcon, SparklesIcon, PauseCircleIcon, HandThumbUpIcon, PaperAirplaneIcon, CheckBadgeIcon, BanknotesIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Menu, Popover, Transition } from '@headlessui/react';
import FileUpload from '../components/FileUpload';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { calculateDaysRemaining } from '../utils/dateUtils';

// Province mapping from English to Arabic
const provinceMapping: { [key: string]: string } = {
  'Cairo': 'القاهرة',
  'Giza': 'الجيزة',
  'Alexandria': 'الإسكندرية',
  'Qalyubia': 'القليوبية',
  'Ismailia': 'الإسماعيلية',
  'Luxor': 'الأقصر',
  'Red Sea': 'البحر الأحمر',
  'Beheira': 'البحيرة',
  'Dakahlia': 'الدقهلية',
  'Suez': 'السويس',
  'Sharqia': 'الشرقية',
  'Gharbia': 'الغربية',
  'Faiyum': 'الفيوم',
  'Monufia': 'المنوفية',
  'Minya': 'المنيا',
  'Aswan': 'أسوان',
  'Asyut': 'أسيوط',
  'Beni Suef': 'بني سويف',
  'Port Said': 'بورسعيد',
  'Damietta': 'دمياط',
  'Sohag': 'سوهاج',
  'Qena': 'قنا',
  'Kafr el-Sheikh': 'كفر الشيخ',
  'South Sinai': 'جنوب سيناء',
  'New Valley': 'الوادي الجديد',
  'Matruh': 'مطروح'
};

// City mapping for each province
const cityMapping: { [key: string]: string[] } = {
  'الجيزة': [
    'مدينة السادس من أكتوبر',
    'مدينة الشيخ زايد',
    'العياط',
    'البدرشين',
    'الصف',
    'العمرانية',
    'أطفيح',
    'الواحات البحرية',
    'الجيزة',
    'حدائق الاهرام',
    'فيصل',
    'الهرم',
    'أبو النمرس',
    'العجوزة',
    'الوراق',
    'أوسيم',
    'بولاق الدكرور',
    'الدقي',
    'أرض اللواء',
    'المهندسين',
    'كرداسة',
    'إمبابة',
    'منشأة القناطر'
  ],
  'القاهرة': [
    'عابدين',
    'العباسية',
    'الأزبكية',
    'القطامية',
    'المنيل',
    'المقطم',
    'دار السلام',
    'البساتين',
    'الجمالية',
    'السيدة زينب',
    'حلوان',
    'المعادي',
    'مصر القديمة',
    'قصر النيل',
    'الخليفة',
    'طرة',
    'الزمالك',
    'الشروق',
    'مدينة بدر',
    'عين شمس',
    'مدينتي',
    'الزيتون',
    'مدينة نصر',
    'القاهرة الجديدة',
    'هليوبوليس',
    'الأميرية',
    'السلام',
    'الوايلي',
    'الشرابية',
    'المرج',
    'المطرية',
    'النزهة',
    'حدائق القبة',
    'شبرا مصر',
    'كورنيش النيل'
  ]
};

// Function to find the best matching city
const findBestMatchingCity = (address: string, province: string): string => {
  const arabicProvince = provinceMapping[province] || province;
  const availableCities = cityMapping[arabicProvince] || [];
  
  if (availableCities.length === 0) return '';

  // Convert address to lowercase for case-insensitive matching
  const addressLower = address.toLowerCase();
  
  // First try exact matches
  for (const city of availableCities) {
    if (addressLower.includes(city.toLowerCase())) {
      return city;
    }
  }
  
  // Then try partial matches
  for (const city of availableCities) {
    const cityWords = city.toLowerCase().split(' ');
    if (cityWords.some(word => addressLower.includes(word))) {
      return city;
    }
  }
  
  // If no match found, return empty string
  return '';
};

interface Order {
  id: number;
  name: string;
  created_at: string;
  custom_due_date?: string;
  custom_create_date?: string;
  custom_start_date?: string;
  effective_created_at: string;
  note?: string;
  packageENStatus?: string;
  customer: {
    first_name: string;
    last_name: string;
    phone: string;
  };
  shipping_address: {
    address1: string;
    address2: string;
    city: string;
    province: string;
    zip: string;
    country: string;
  };
  total_price: string;
  financial_status: string;
  fulfillment_status: string;
  tags?: string[] | string | null;
  payment_gateway_names?: string[]; 
  fulfillments?: Array<{
    id: number;
    status: string;
    shipment_status?: string;
    tracking_company?: string;
    tracking_number?: string;
    created_at?: string;
    updated_at?: string;
  }>;
  line_items: {
    title: string;
    quantity: number;
    price: string;
    variant_title: string | null;
    properties?: Array<{
      name: string;
      value: string;
    }>;
  }[];
}

// Helper function to convert UTC to Cairo time
const convertToCairoTime = (date: Date): Date => {
  const cairoOffset = 3; // GMT+3
  const utcDate = new Date(date.toUTCString());
  const cairoDate = new Date(utcDate.getTime() + (cairoOffset * 60 * 60 * 1000));
  return cairoDate;
};

const statusOptions = [
  { value: 'pending', label: 'Pending Orders' },
  { value: 'order-ready', label: 'Order Ready' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'confirmed', label: 'Confirmed Orders' },
  { value: 'ready-to-ship', label: 'Ready to Ship' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'paid', label: 'Paid' },
  { value: 'all', label: 'All Orders' },
];

// Get status icon JSX element (matching OrderCard.tsx)
const getStatusIcon = (status: string, className: string) => {
  const baseClasses = 'w-5 h-5 flex-shrink-0';
  const fullClassName = `${baseClasses} ${className}`;
  
  switch (status) {
    case 'pending':
      return <ClockIcon className={fullClassName} />;
    case 'order-ready':
      return <SparklesIcon className={fullClassName} />;
    case 'on_hold':
      return <PauseCircleIcon className={fullClassName} />;
    case 'confirmed':
      return <HandThumbUpIcon className={fullClassName} />;
    case 'ready-to-ship':
      return <PaperAirplaneIcon className={fullClassName} />;
    case 'shipped':
      return <TruckIcon className={fullClassName} />;
    case 'fulfilled':
      return <CheckBadgeIcon className={fullClassName} />;
    case 'paid':
      return <BanknotesIcon className={fullClassName} />;
    case 'cancelled':
      return <XCircleIcon className={fullClassName} />;
    case 'all':
      return <ViewColumnsIcon className={fullClassName} />;
    default:
      return <ClockIcon className={fullClassName} />;
  }
};

// Get status color (matching OrderCard.tsx)
const getStatusColor = (status: string, isActive: boolean) => {
  if (isActive) {
    // Active state - use the status color as background
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'order-ready':
        return 'bg-orange-500 text-white border-orange-600';
      case 'on_hold':
        return 'bg-amber-500 text-white border-amber-600';
      case 'confirmed':
        return 'bg-green-500 text-white border-green-600';
      case 'ready-to-ship':
        return 'bg-blue-600 text-white border-blue-700';
      case 'shipped':
        return 'bg-purple-600 text-white border-purple-700';
      case 'fulfilled':
        return 'bg-emerald-600 text-white border-emerald-700';
      case 'cancelled':
        return 'bg-red-600 text-white border-red-700';
      case 'paid':
        return 'bg-indigo-600 text-white border-indigo-700';
      case 'all':
        return 'bg-slate-700 text-white border-slate-800';
      default:
        return 'bg-slate-700 text-white border-slate-800';
    }
  } else {
    // Inactive state - subtle gray with icon color
    return 'bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-50';
  }
};

const findOldestShippedOrderDate = (orders: Order[]): Date => {
  const shippedButNotFulfilledOrders = orders.filter(order => {
    const tags = Array.isArray(order.tags) ? 
      order.tags : 
      typeof order.tags === 'string' ? 
        order.tags.split(',').map(t => t.trim()) : 
        [];
    
    // Check if order is shipped but not fulfilled
    const isShipped = tags.includes('shipped');
    const isFulfilled = tags.includes('fulfilled');
    
    return isShipped && !isFulfilled;
  });

  if (shippedButNotFulfilledOrders.length === 0) {
    // If no shipped orders, use 30 days ago as default
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date;
  }

  // Get shipping dates from tags
  const shippingDates = shippedButNotFulfilledOrders
    .map(order => {
      const tags = Array.isArray(order.tags) ? 
        order.tags : 
        typeof order.tags === 'string' ? 
          order.tags.split(',').map(t => t.trim()) : 
          [];
      
      const shippingDateTag = tags.find(tag => tag.trim().startsWith('shipping_date:'));
      if (shippingDateTag) {
        const dateStr = shippingDateTag.trim().split(':')[1]?.trim();
        if (dateStr) {
          return new Date(dateStr);
        }
      }
      return null;
    })
    .filter((date): date is Date => date !== null);

  if (shippingDates.length === 0) {
    // If no shipping dates found in tags, use 30 days ago as default
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date;
  }

  return new Date(Math.min(...shippingDates.map(date => date.getTime())));
};

const Orders = () => {
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [previousStatusFilter, setPreviousStatusFilter] = useState('pending');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [isSearchOverridingFilter, setIsSearchOverridingFilter] = useState(false);
  const [suppressOrdersInvalidation, setSuppressOrdersInvalidation] = useState(false);
  const [selectedSummaryItems, setSelectedSummaryItems] = useState<Set<string>>(new Set());
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const ordersRefreshTimerRef = useRef<number | null>(null);
  
  // Quick Filter state
  const [activeQuickFilterTab, setActiveQuickFilterTab] = useState<'production' | 'city' | 'days' | 'shipping' | 'rushed' | 'fulfillment_month' | 'paid_month' | 'cancelled_calendar' | 'cancelled_reason'>('production');
  const [selectedProductionItems, setSelectedProductionItems] = useState<Set<string>>(new Set());
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());
  const [selectedDayRanges, setSelectedDayRanges] = useState<Set<string>>(new Set());
  const [selectedShippingMethods, setSelectedShippingMethods] = useState<Set<string>>(new Set());
  const [selectedRushTypes, setSelectedRushTypes] = useState<Set<string>>(new Set());
  const [selectedFulfillmentMonths, setSelectedFulfillmentMonths] = useState<Set<string>>(new Set());
  const [selectedPaidMonths, setSelectedPaidMonths] = useState<Set<string>>(new Set());
  const [selectedCancelledMonths, setSelectedCancelledMonths] = useState<Set<string>>(new Set());
  const [selectedCancelledReasons, setSelectedCancelledReasons] = useState<Set<string>>(new Set());
  const [isQuickFilterExpanded, setIsQuickFilterExpanded] = useState(false);
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle scroll to show/hide scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      // Check both window scroll and main element scroll
      const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      setShowScrollToTop(scrollY > 300);
    };

    // Listen to window scroll (for normal scroll behavior)
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Also listen to main element scroll if it exists (for contained scroll)
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.addEventListener('scroll', handleScroll, { passive: true });
    }
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (mainElement) {
        mainElement.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  // Scroll to top function
  const scrollToTop = () => {
    // Try window scroll first
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Also try scrolling the main element if it exists
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Read search query from URL params on mount or when search param changes
  useEffect(() => {
    const searchParam = searchParams.get('search');
    if (searchParam) {
      setSearchQuery(searchParam);
      // Clear the URL param after reading it
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Debounce search query to reduce unnecessary filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500); // 500ms delay to improve typing performance

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle search query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      // When searching, save current filter and switch to all orders
      if (statusFilter !== 'all') {
        setPreviousStatusFilter(statusFilter);
        setStatusFilter('all');
        setIsSearchOverridingFilter(true);
      }
    } else {
      // When search is cleared, restore previous filter
      if (isSearchOverridingFilter && previousStatusFilter !== 'all') {
        setStatusFilter(previousStatusFilter);
      }
      setIsSearchOverridingFilter(false);
    }
  }, [searchQuery, statusFilter, previousStatusFilter]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const { data: orders, isLoading: ordersLoading, error, refetch } = useQuery<Order[]>({
    queryKey: ['orders'],
    queryFn: async (): Promise<Order[]> => {
      // Fetch orders
      const ordersResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/orders`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!ordersResponse.ok) {
        throw new Error('Failed to fetch orders');
      }
      const ordersData = await ordersResponse.json();
      return ordersData;
    },
    // Specific caching options for orders
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: true, // Only refetch when reconnecting to network
  });

  // Debounced background refresh to reconcile local state with server
  const scheduleBackgroundOrdersRefresh = useCallback(() => {
    if (ordersRefreshTimerRef.current) {
      clearTimeout(ordersRefreshTimerRef.current);
    }
    ordersRefreshTimerRef.current = window.setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }, 300);
  }, [queryClient]);

  // Helper to update a specific order optimistically in the cache
  const updateOrderInCache = useCallback((orderId: number, mutate: (o: Order) => Order) => {
    queryClient.setQueryData<Order[] | undefined>(['orders'], (current) => {
      if (!current) return current;
      return current.map((o) => (o.id === orderId ? mutate(o) : o));
    });
  }, [queryClient]);

  // Manual refresh function
  const handleManualRefresh = useCallback(async () => {
    try {
      // Force a fresh refetch by invalidating the cache first
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      await refetch();
      toast.success('Orders refreshed successfully');
    } catch (error) {
      console.error('Error refreshing orders:', error);
      toast.error('Failed to refresh orders');
    }
  }, [refetch, queryClient]);

  // Add state for refresh loading
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Updated manual refresh function with loading state
  const handleManualRefreshWithLoading = useCallback(async () => {
    if (isRefreshing) return; // Prevent multiple simultaneous refreshes
    
    setIsRefreshing(true);
    try {
      // Force a fresh refetch by invalidating the cache first
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      await refetch();
      toast.success('Orders refreshed successfully');
    } catch (error) {
      console.error('Error refreshing orders:', error);
      toast.error('Failed to refresh orders');
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch, queryClient, isRefreshing]);

  const updateDueDateMutation = useMutation({
    mutationFn: async ({ orderId, dueDate }: { orderId: number; dueDate: string }) => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${orderId}/due-date`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ custom_due_date: dueDate }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update due date');
      }
      return response.json();
    },
    onMutate: async ({ orderId, dueDate }) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      const previous = queryClient.getQueryData<Order[]>(['orders']);
      updateOrderInCache(orderId, (o) => ({ ...o, custom_due_date: dueDate }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['orders'], context.previous);
    },
    // Intentionally no background refresh to avoid fetching after each single update
  });

  const updateStartDateMutation = useMutation({
    mutationFn: async ({ orderId, startDate }: { orderId: number; startDate: string }) => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${orderId}/start-date`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ custom_start_date: startDate }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update start date');
      }
      return response.json();
    },
    onMutate: async ({ orderId, startDate }) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      const previous = queryClient.getQueryData<Order[]>(['orders']);
      updateOrderInCache(orderId, (o) => ({ ...o, custom_start_date: startDate }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['orders'], context.previous);
    },
    // Intentionally no background refresh to avoid fetching after each single update
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ orderId, note }: { orderId: number; note: string }) => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${orderId}/note`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note }),
      });
      if (!response.ok) {
        throw new Error('Failed to update note');
      }
      return response.json();
    },
    onMutate: async ({ orderId, note }) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      const previous = queryClient.getQueryData<Order[]>(['orders']);
      updateOrderInCache(orderId, (o) => ({ ...o, note }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['orders'], context.previous);
    },
    // Intentionally no background refresh to avoid fetching after each single update
  });

  const updatePriorityMutation = useMutation({
    mutationFn: async ({ orderId, isPriority }: { orderId: number; isPriority: boolean }) => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${orderId}/priority`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isPriority }),
      });
      if (!response.ok) {
        throw new Error('Failed to update priority');
      }
      return response.json();
    },
    onMutate: async ({ orderId, isPriority }) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      const previous = queryClient.getQueryData<Order[]>(['orders']);
      updateOrderInCache(orderId, (o) => {
        const currentTags = Array.isArray(o.tags)
          ? o.tags.map((t) => t.trim())
          : typeof o.tags === 'string'
            ? o.tags.split(',').map((t: string) => t.trim())
            : [];
        const nextTags = isPriority
          ? currentTags.includes('priority') ? currentTags : [...currentTags, 'priority']
          : currentTags.filter((t) => t !== 'priority');
        return { ...o, tags: nextTags } as Order;
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['orders'], context.previous);
    },
    // Intentionally no background refresh to avoid fetching after each single update
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: string }) => {
      // Normalize frontend status values to backend-expected tags (trimmed and case-insensitive)
      let serverStatus = status.trim();
      if (status.trim().toLowerCase() === 'confirmed') serverStatus = 'customer_confirmed';
      else if (status.trim().toLowerCase() === 'fulfill') serverStatus = 'fulfilled';
      else if (status.trim().toLowerCase() === 'order-ready') serverStatus = 'order_ready';
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: serverStatus }),
      });
      if (!response.ok) {
        throw new Error('Failed to update order status');
      }
      return response.json();
    },
    onMutate: async ({ orderId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      const previous = queryClient.getQueryData<Order[]>(['orders']);
      updateOrderInCache(orderId, (o) => {
        const currentTags = Array.isArray(o.tags)
          ? o.tags
          : typeof o.tags === 'string'
            ? o.tags.split(',').map((t: string) => t.trim())
            : [];
        // Parse status: may be "fulfilled,fulfillment_date:YYYY-MM-DD" → add as separate tags
        const statusParts = status.split(',').map((s: string) => s.trim());
        const actualStatus = statusParts[0];
        const additionalTagsFromStatus = statusParts.slice(1);
        // Remove existing status tags and fulfillment date tags (case-insensitive)
        const statusTags = ['order_ready', 'on_hold', 'customer_confirmed', 'ready_to_ship', 'shipped', 'fulfilled'];
        let filtered = currentTags.filter((t: string) => {
          const trimmed = t.trim().toLowerCase();
          const isStatusTag = statusTags.some(st => st.trim().toLowerCase() === trimmed);
          const isFulfillmentDate = t.trim().startsWith('fulfilled_at:') || t.trim().startsWith('fulfillment_date:');
          return !isStatusTag && !isFulfillmentDate;
        });
        // Map main status to tag value (trimmed)
        let tagValue = actualStatus.trim();
        if (actualStatus.trim().toLowerCase() === 'confirmed') tagValue = 'customer_confirmed';
        else if (actualStatus.trim().toLowerCase() === 'order-ready') tagValue = 'order_ready';
        else if (actualStatus.trim().toLowerCase() === 'on_hold') tagValue = 'on_hold';
        if (actualStatus.trim().toLowerCase() !== 'pending') filtered = [...filtered, tagValue];
        additionalTagsFromStatus.forEach((tag: string) => {
          if (tag) filtered.push(tag.trim());
        });
        if (actualStatus.trim().toLowerCase() === 'fulfilled') filtered = filtered.filter((t: string) => t.trim().toLowerCase() !== 'priority');
        return { ...o, tags: filtered } as Order;
      });
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['orders'], context.previous);
      console.error('Error updating order status:', error);
    },
    // Intentionally no background refresh to avoid fetching after each single update
  });

  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ orderIds, status }: { orderIds: number[]; status: string }) => {
      // Normalize frontend status values to backend-expected tags (trimmed and case-insensitive)
      let serverStatus = status.trim();
      if (status.trim().toLowerCase() === 'confirmed') serverStatus = 'customer_confirmed';
      else if (status.trim().toLowerCase() === 'fulfill') serverStatus = 'fulfilled';
      else if (status.trim().toLowerCase() === 'order-ready') serverStatus = 'order_ready';
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/bulk/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderIds, status: serverStatus }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to bulk update order status');
      }
      return response.json();
    },
    onMutate: async ({ orderIds, status }) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      const previous = queryClient.getQueryData<Order[]>(['orders']);
      
      // Parse status: may be "fulfilled,fulfillment_date:YYYY-MM-DD" → add as separate tags
      const statusParts = status.split(',').map((s: string) => s.trim());
      const actualStatus = statusParts[0];
      const additionalTagsFromStatus = statusParts.slice(1);
      // Optimistically update all orders in cache
      orderIds.forEach(orderId => {
        updateOrderInCache(orderId, (o) => {
          const currentTags = Array.isArray(o.tags)
            ? o.tags
            : typeof o.tags === 'string'
              ? o.tags.split(',').map((t: string) => t.trim())
              : [];
          // Remove existing status tags and fulfillment date tags (case-insensitive)
          const statusTags = ['order_ready', 'on_hold', 'customer_confirmed', 'ready_to_ship', 'shipped', 'fulfilled'];
          let filtered = currentTags.filter((t: string) => {
            const trimmed = t.trim().toLowerCase();
            const isStatusTag = statusTags.some(st => st.trim().toLowerCase() === trimmed);
            const isFulfillmentDate = t.trim().startsWith('fulfilled_at:') || t.trim().startsWith('fulfillment_date:');
            return !isStatusTag && !isFulfillmentDate;
          });
          // Map main status to tag value (trimmed)
          let tagValue = actualStatus.trim();
          if (actualStatus.trim().toLowerCase() === 'confirmed') tagValue = 'customer_confirmed';
          else if (actualStatus.trim().toLowerCase() === 'order-ready') tagValue = 'order_ready';
          if (actualStatus.trim().toLowerCase() !== 'pending') filtered = [...filtered, tagValue];
          additionalTagsFromStatus.forEach((tag: string) => {
            if (tag) filtered.push(tag.trim());
          });
          if (actualStatus.trim().toLowerCase() === 'fulfilled') filtered = filtered.filter((t: string) => t.trim().toLowerCase() !== 'priority');
          return { ...o, tags: filtered } as Order;
        });
      });
      
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['orders'], context.previous);
      console.error('Error bulk updating order status:', error);
    },
    onSettled: () => {
      scheduleBackgroundOrdersRefresh();
    },
  });

  const fulfillOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${orderId}/fulfill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Fulfillment error details:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          orderId
        });
        throw new Error(errorData.details || 'Failed to fulfill order');
      }
      return response.json();
    },
    onMutate: async (orderId: number) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      const previous = queryClient.getQueryData<Order[]>(['orders']);
      updateOrderInCache(orderId, (o) => {
        const currentTags = Array.isArray(o.tags)
          ? o.tags
          : typeof o.tags === 'string'
            ? o.tags.split(',').map((t: string) => t.trim())
            : [];
        const nextTags = [...currentTags.filter((t: string) => t !== 'priority'), 'fulfilled'];
        return { ...o, tags: nextTags } as Order;
      });
      return { previous };
    },
    onError: (error: any, _orderId, context) => {
      if (context?.previous) queryClient.setQueryData(['orders'], context.previous);
      console.error('Error fulfilling order:', {
        message: error.message,
        error
      });
    },
    // Intentionally no background refresh to avoid fetching after each single update
  });

  // Add delete order mutation
  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${orderId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete order');
      }
      return response.json();
    },
    onMutate: async (orderId: number) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      const previous = queryClient.getQueryData<Order[]>(['orders']);
      updateOrderInCache(orderId, (o) => {
        const currentTags = Array.isArray(o.tags)
          ? o.tags
          : typeof o.tags === 'string'
            ? o.tags.split(',').map((t: string) => t.trim())
            : [];
        return { ...o, tags: [...currentTags, 'deleted'] } as Order;
      });
      return { previous };
    },
    onError: (_err, _orderId, context) => {
      if (context?.previous) queryClient.setQueryData(['orders'], context.previous);
    },
    // Intentionally no background refresh to avoid fetching after each single update
  });

  const handleOrderSelect = (orderId: number) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  // Helper function to check if an order matches all current filters (status + quick filters + search)
  const matchesAllFilters = (order: Order): boolean => {
    const query = debouncedSearchQuery.toLowerCase();
    const nameStr = (order.name || '').toLowerCase();
    const customerNameStr = `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.toLowerCase();
    const phoneStr = (order.customer?.phone || '').toLowerCase();

    const matchesSearch = query === '' ||
      nameStr.includes(query) ||
      customerNameStr.includes(query) ||
      phoneStr.includes(query);
    
    const matchesStatus = filterOrdersByStatus(order);
    
    // Quick filter: Production items
    if (selectedProductionItems.size > 0) {
      const matches = Array.from(selectedProductionItems).some(itemTitle => orderContainsItem(order, itemTitle));
      if (!matches) return false;
    }
    
    // Quick filter: Cities
    if (selectedCities.size > 0) {
      const province = order.shipping_address?.province || 'Unknown';
      if (!selectedCities.has(province)) return false;
    }
    
    // Quick filter: Days left
    if (selectedDayRanges.size > 0) {
      const daysLeft = calculateDaysLeft(order);
      const range = getDayRange(daysLeft);
      if (!selectedDayRanges.has(range)) return false;
    }
    
    // Quick filter: Shipping methods
    if (selectedShippingMethods.size > 0) {
      const method = getShippingMethodFromOrder(order);
      if (!selectedShippingMethods.has(method)) return false;
    }
    
    // Quick filter: Rushed/Standard
    if (selectedRushTypes.size > 0) {
      const rushType = getRushTypeFromOrder(order);
      if (!selectedRushTypes.has(rushType)) return false;
    }
    
    // Quick filter: Fulfillment month (only for fulfilled orders)
    if (selectedFulfillmentMonths.size > 0 && statusFilter === 'fulfilled') {
      const tags = Array.isArray(order.tags) 
        ? order.tags 
        : typeof order.tags === 'string' 
          ? order.tags.split(',').map(t => t.trim())
          : [];
      
      // Check if order is fulfilled
      const isFulfilled = tags.some((tag: string) => tag.trim().toLowerCase() === 'fulfilled');
      if (!isFulfilled) return false;
      
      // Get fulfillment_date - ONLY use fulfillment_date, no fallback
      const fulfillmentDateTag = tags.find((tag: string) => 
        tag.trim().startsWith('fulfillment_date:')
      );
      
      if (fulfillmentDateTag) {
        const dateStr = fulfillmentDateTag.split(':')[1]?.trim();
        if (dateStr) {
          const month = dateStr.substring(0, 7); // YYYY-MM
          const [year, monthNum] = month.split('-');
          const monthName = format(new Date(parseInt(year), parseInt(monthNum) - 1, 1), 'MMMM yyyy');
          if (!selectedFulfillmentMonths.has(monthName)) return false;
        } else {
          return false; // Has tag but no date, exclude
        }
      } else {
        return false; // No fulfillment_date tag, exclude
      }
    }
    
    // Quick filter: Paid month (for paid filter view)
    if (selectedPaidMonths.size > 0) {
      const tags = Array.isArray(order.tags) 
        ? order.tags 
        : typeof order.tags === 'string' 
          ? order.tags.split(',').map(t => t.trim())
          : [];
      
      // Check if order is paid
      const isPaid = tags.some((tag: string) => tag.trim().toLowerCase() === 'paid');
      if (!isPaid) return false;
      
      // Get paid_date - ONLY use paid_date, no fallback
      const paidDateTag = tags.find((tag: string) => 
        tag.trim().startsWith('paid_date:')
      );
      
      if (paidDateTag) {
        const dateStr = paidDateTag.split(':')[1]?.trim();
        if (dateStr) {
          const month = dateStr.substring(0, 7); // YYYY-MM
          const [year, monthNum] = month.split('-');
          const monthName = format(new Date(parseInt(year), parseInt(monthNum) - 1, 1), 'MMMM yyyy');
          if (!selectedPaidMonths.has(monthName)) return false;
        } else {
          return false; // Has tag but no date, exclude
        }
      } else {
        return false; // No paid_date tag, exclude
      }
    }
    
    // Quick filter: Cancelled calendar (for cancelled filter view)
    if (selectedCancelledMonths.size > 0 && statusFilter === 'cancelled') {
      const tags = Array.isArray(order.tags) 
        ? order.tags 
        : typeof order.tags === 'string' 
          ? order.tags.split(',').map(t => t.trim())
          : [];
      
      // Check if order is cancelled
      const isCancelled = tags.some((tag: string) => tag.trim().toLowerCase() === 'cancelled');
      if (!isCancelled) return false;
      
      // Get cancelled_date
      const cancelledDateTag = tags.find((tag: string) => 
        tag.trim().startsWith('cancelled_date:')
      );
      
      if (cancelledDateTag) {
        const dateStr = cancelledDateTag.split(':')[1]?.trim();
        if (dateStr) {
          const month = dateStr.substring(0, 7); // YYYY-MM
          const [year, monthNum] = month.split('-');
          const monthName = format(new Date(parseInt(year), parseInt(monthNum) - 1, 1), 'MMMM yyyy');
          if (!selectedCancelledMonths.has(monthName)) return false;
        } else {
          return false; // Has tag but no date, exclude
        }
      } else {
        return false; // No cancelled_date tag, exclude
      }
    }
    
    // Quick filter: Cancelled reason (for cancelled filter view)
    if (selectedCancelledReasons.size > 0 && statusFilter === 'cancelled') {
      const tags = Array.isArray(order.tags) 
        ? order.tags 
        : typeof order.tags === 'string' 
          ? order.tags.split(',').map(t => t.trim())
          : [];
      
      // Check if order is cancelled
      const isCancelled = tags.some((tag: string) => tag.trim().toLowerCase() === 'cancelled');
      if (!isCancelled) return false;
      
      // Check for cancelled_after_shipping
      const isCancelledAfterShipping = tags.some((tag: string) => tag.trim().toLowerCase() === 'cancelled_after_shipping');
      // Check for no_reply_cancelled
      const isNoReplyCancelled = tags.some((tag: string) => tag.trim().toLowerCase() === 'no_reply_cancelled');
      
      let reason = 'Other';
      if (isCancelledAfterShipping) {
        reason = 'Cancelled After shipping';
      } else if (isNoReplyCancelled) {
        reason = 'No response';
      }
      
      if (!selectedCancelledReasons.has(reason)) return false;
    }
    
    // Legacy filter: selected summary items (for backward compatibility)
    const matchesSummaryItems = selectedSummaryItems.size === 0 || 
      Array.from(selectedSummaryItems).some(itemTitle => orderContainsItem(order, itemTitle));
    
    return matchesSearch && matchesStatus && matchesSummaryItems;
  };

  // Returns true if order matches status + all quick filters EXCEPT the one for excludeTab.
  // Used so each quick filter tab shows counts for "currently displayed" orders (combined filters).
  const orderMatchesOtherQuickFilters = (order: Order, excludeTab: string): boolean => {
    const query = debouncedSearchQuery.toLowerCase();
    const nameStr = (order.name || '').toLowerCase();
    const customerNameStr = `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.toLowerCase();
    const phoneStr = (order.customer?.phone || '').toLowerCase();
    const matchesSearch = query === '' || nameStr.includes(query) || customerNameStr.includes(query) || phoneStr.includes(query);
    const matchesStatus = filterOrdersByStatus(order);
    if (!matchesSearch || !matchesStatus) return false;

    if (excludeTab !== 'production' && selectedProductionItems.size > 0) {
      if (!Array.from(selectedProductionItems).some(itemTitle => orderContainsItem(order, itemTitle))) return false;
    }
    if (excludeTab !== 'city' && selectedCities.size > 0) {
      const province = order.shipping_address?.province || 'Unknown';
      if (!selectedCities.has(province)) return false;
    }
    if (excludeTab !== 'days' && selectedDayRanges.size > 0) {
      const daysLeft = calculateDaysLeft(order);
      const range = getDayRange(daysLeft);
      if (!selectedDayRanges.has(range)) return false;
    }
    if (excludeTab !== 'shipping' && selectedShippingMethods.size > 0) {
      const method = getShippingMethodFromOrder(order);
      if (!selectedShippingMethods.has(method)) return false;
    }
    if (excludeTab !== 'rushed' && selectedRushTypes.size > 0) {
      const rushType = getRushTypeFromOrder(order);
      if (!selectedRushTypes.has(rushType)) return false;
    }
    if (excludeTab !== 'fulfillment_month' && selectedFulfillmentMonths.size > 0 && statusFilter === 'fulfilled') {
      const tags = Array.isArray(order.tags) ? order.tags : typeof order.tags === 'string' ? order.tags.split(',').map((t: string) => t.trim()) : [];
      const isFulfilled = tags.some((tag: string) => tag.trim().toLowerCase() === 'fulfilled');
      if (!isFulfilled) return false;
      const fulfillmentDateTag = tags.find((tag: string) => tag.trim().startsWith('fulfillment_date:'));
      if (fulfillmentDateTag) {
        const dateStr = fulfillmentDateTag.split(':')[1]?.trim();
        if (dateStr) {
          const month = dateStr.substring(0, 7);
          const [year, monthNum] = month.split('-');
          const monthName = format(new Date(parseInt(year), parseInt(monthNum) - 1, 1), 'MMMM yyyy');
          if (!selectedFulfillmentMonths.has(monthName)) return false;
        } else return false;
      } else return false;
    }
    if (excludeTab !== 'paid_month' && selectedPaidMonths.size > 0) {
      const tags = Array.isArray(order.tags) ? order.tags : typeof order.tags === 'string' ? order.tags.split(',').map((t: string) => t.trim()) : [];
      const isPaid = tags.some((tag: string) => tag.trim().toLowerCase() === 'paid');
      if (!isPaid) return false;
      const paidDateTag = tags.find((tag: string) => tag.trim().startsWith('paid_date:'));
      if (paidDateTag) {
        const dateStr = paidDateTag.split(':')[1]?.trim();
        if (dateStr) {
          const month = dateStr.substring(0, 7);
          const [year, monthNum] = month.split('-');
          const monthName = format(new Date(parseInt(year), parseInt(monthNum) - 1, 1), 'MMMM yyyy');
          if (!selectedPaidMonths.has(monthName)) return false;
        } else return false;
      } else return false;
    }
    if (excludeTab !== 'cancelled_calendar' && selectedCancelledMonths.size > 0 && statusFilter === 'cancelled') {
      const tags = Array.isArray(order.tags) ? order.tags : typeof order.tags === 'string' ? order.tags.split(',').map((t: string) => t.trim()) : [];
      const isCancelled = tags.some((tag: string) => tag.trim().toLowerCase() === 'cancelled');
      if (!isCancelled) return false;
      const cancelledDateTag = tags.find((tag: string) => tag.trim().startsWith('cancelled_date:'));
      if (cancelledDateTag) {
        const dateStr = cancelledDateTag.split(':')[1]?.trim();
        if (dateStr) {
          const month = dateStr.substring(0, 7);
          const [year, monthNum] = month.split('-');
          const monthName = format(new Date(parseInt(year), parseInt(monthNum) - 1, 1), 'MMMM yyyy');
          if (!selectedCancelledMonths.has(monthName)) return false;
        } else return false;
      } else return false;
    }
    if (excludeTab !== 'cancelled_reason' && selectedCancelledReasons.size > 0 && statusFilter === 'cancelled') {
      const tags = Array.isArray(order.tags) ? order.tags : typeof order.tags === 'string' ? order.tags.split(',').map((t: string) => t.trim()) : [];
      const isCancelled = tags.some((tag: string) => tag.trim().toLowerCase() === 'cancelled');
      if (!isCancelled) return false;
      const isCancelledAfterShipping = tags.some((tag: string) => tag.trim().toLowerCase() === 'cancelled_after_shipping');
      const isNoReplyCancelled = tags.some((tag: string) => tag.trim().toLowerCase() === 'no_reply_cancelled');
      let reason = 'Other';
      if (isCancelledAfterShipping) reason = 'Cancelled After shipping';
      else if (isNoReplyCancelled) reason = 'No response';
      if (!selectedCancelledReasons.has(reason)) return false;
    }
    const matchesSummaryItems = selectedSummaryItems.size === 0 || Array.from(selectedSummaryItems).some(itemTitle => orderContainsItem(order, itemTitle));
    return matchesSummaryItems;
  };

  const handleSelectAll = () => {
    if (orders) {
      // Get only the orders that are currently visible based on all filters (status + quick filters + search)
      const visibleOrders = orders.filter(matchesAllFilters);
      
      if (selectedOrders.length === visibleOrders.length) {
        setSelectedOrders([]);
      } else {
        setSelectedOrders(visibleOrders.map(order => order.id));
      }
    }
  };

  const handleBulkStatusUpdate = (status: string) => {
    if (selectedOrders.length === 0) return;
    
    // Save current filter before bulk update
    setPreviousStatusFilter(statusFilter);
    
    // Use bulk update mutation
    bulkUpdateStatusMutation.mutate(
      { orderIds: selectedOrders, status },
      {
        onSuccess: () => {
    setSelectedOrders([]);
          toast.success(`Successfully updated ${selectedOrders.length} order${selectedOrders.length > 1 ? 's' : ''}`);
        },
        onError: (error: any) => {
          toast.error(error.message || 'Failed to bulk update orders');
        }
      }
    );
  };

  const handleUpdateNote = (orderId: number, note: string) => {
    updateNoteMutation.mutate({ orderId, note });
  };

  const handleTogglePriority = (orderId: number, isPriority: boolean) => {
    const updateTags = (currentTags: string[] | string | null | undefined): string[] => {
      const tags = Array.isArray(currentTags) 
        ? currentTags 
        : typeof currentTags === 'string' 
          ? currentTags.split(',').map((t: string) => t.trim())
          : [];

        if (isPriority && !tags.includes('priority')) {
        return [...tags, 'priority'];
      } else if (!isPriority) {
        return tags.filter((t: string) => t !== 'priority');
        }
      return tags;
    };
      
    // Update local state
    const order = orders?.find(o => o.id === orderId);
    if (order) {
      const updatedTags = updateTags(order.tags);
    updatePriorityMutation.mutate({ orderId, isPriority });
    }
  };

  const handleUpdateStatus = (orderId: number, status: string) => {
    const updateTags = (currentTags: string[] | string | null | undefined): string[] => {
      const tags = Array.isArray(currentTags) 
        ? currentTags 
        : typeof currentTags === 'string' 
          ? currentTags.split(',').map((t: string) => t.trim())
          : [];
        
      // Remove existing status tags (trimmed and case-insensitive)
        const statusTags = ['order_ready', 'on_hold', 'customer_confirmed', 'ready_to_ship', 'shipped', 'fulfilled'];
      const filteredTags = tags.filter((t: string) => {
        const trimmed = t.trim().toLowerCase();
        return !statusTags.some(st => st.trim().toLowerCase() === trimmed);
      });
        
        // Map frontend status values to actual tag values (trimmed)
        let tagValue = status.trim();
        if (status.trim().toLowerCase() === 'confirmed') {
          tagValue = 'customer_confirmed';
        } else if (status.trim().toLowerCase() === 'order-ready') {
          tagValue = 'order_ready';
        }
        
        // Add the new status tag if it's not "pending"
        if (status.trim().toLowerCase() !== 'pending') {
        filteredTags.push(tagValue.trim());
        }

        // If status is fulfilled, remove priority tag
        if (status === 'fulfilled') {
        return filteredTags.filter((t: string) => t !== 'priority');
        }
        
      return [...filteredTags, '__status_just_updated'];
    };

    // Update local state
    const order = orders?.find(o => o.id === orderId);
    if (order) {
      const updatedTags = updateTags(order.tags);
    updateStatusMutation.mutate({ orderId, status });
    }
  };

  const handleDeleteOrder = (orderId: number) => {
    if (window.confirm('Are you sure you want to hide this order? This will remove it from all views.')) {
      // Get the current order from ordersData
      const order = orders?.find(o => o.id === orderId);
      if (!order || !orders) return;

      // Get current tags
      const currentTags = Array.isArray(order.tags) 
        ? order.tags.map(t => t.trim())
        : typeof order.tags === 'string'
          ? order.tags.split(',').map(t => t.trim())
          : [];

      // Add deleted tag
      const newTags = [...currentTags, 'deleted'];
      
      // Update order tags using mutation
      updateTagsMutation.mutate({ orderId, newTags });
    }
  };

  // Filter orders based on the selected filter
  const filterOrdersByStatus = (order: Order): boolean => {
    const tags = Array.isArray(order.tags) 
      ? order.tags 
      : typeof order.tags === 'string' 
        ? order.tags.split(',').map(tag => tag.trim())
        : [];
    
    const trimmedTags = tags.map((tag: string) => tag.trim());
    
    // First check: if order has deleted tag, always exclude it
    if (trimmedTags.includes('deleted')) {
      return false;
    }

    // If an order was just updated, keep it visible momentarily regardless of status
    if (trimmedTags.includes('__status_just_updated')) {
      return true;
    }

    // Define status tags with proper trimming (case-insensitive comparison)
    const statusTags = {
      orderReady: 'order_ready',
      onHold: 'on_hold',
      shipped: 'shipped',
      readyToShip: 'ready_to_ship',
      fulfilled: 'fulfilled',
      cancelled: 'cancelled',
      customerConfirmed: 'customer_confirmed',
      paid: 'paid'
    };
    
    switch(statusFilter) {
      case 'pending':
        // Show only pending orders (no status tags)
        // Exclude orders with any status tag including order_ready and customer_confirmed
        return !trimmedTags.some(tag => {
          const trimmed = tag.trim().toLowerCase();
          return [
            statusTags.orderReady.toLowerCase(),
            statusTags.onHold.toLowerCase(),
            statusTags.shipped.toLowerCase(),
            statusTags.readyToShip.toLowerCase(),
            statusTags.fulfilled.toLowerCase(),
            statusTags.cancelled.toLowerCase(),
            statusTags.paid.toLowerCase(),
            statusTags.customerConfirmed.toLowerCase()
          ].includes(trimmed);
        });
      case 'order-ready':
        // Show only orders with order_ready tag (case-insensitive)
        return trimmedTags.some(tag => tag.trim().toLowerCase() === statusTags.orderReady.toLowerCase());
      case 'on_hold':
        // Show only orders with on_hold tag (case-insensitive)
        return trimmedTags.some(tag => tag.trim().toLowerCase() === statusTags.onHold.toLowerCase());
      case 'confirmed':
        // Show only orders with customer_confirmed tag (case-insensitive)
        return trimmedTags.some(tag => tag.trim().toLowerCase() === statusTags.customerConfirmed.toLowerCase());
      case 'ready-to-ship':
        return trimmedTags.some(tag => tag.trim() === statusTags.readyToShip);
      case 'shipped':
        return trimmedTags.some(tag => tag.trim() === statusTags.shipped);
      case 'fulfilled':
        // Show only fulfilled orders (exclude paid orders)
        return trimmedTags.some(tag => tag.trim() === statusTags.fulfilled) &&
               !trimmedTags.some(tag => tag.trim() === statusTags.paid);
      case 'cancelled':
        return trimmedTags.some(tag => tag.trim() === statusTags.cancelled);
      case 'paid':
        return trimmedTags.some(tag => tag.trim() === statusTags.paid);
      case 'all':
      default:
        return true;
    }
  };

  // Get status priority for sorting
  const getStatusPriority = (order: Order) => {
    const tags = Array.isArray(order.tags) ? order.tags : typeof order.tags === 'string' ? order.tags.split(',') : [];
    const trimmedTags = tags.map((t: string) => t.trim());
    
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
    };
    
    // Return priority number based on status (higher number = lower in sort)
    if (trimmedTags.some(tag => tag.trim().toLowerCase() === statusTags.cancelled.toLowerCase())) return 70;
    if (trimmedTags.some(tag => tag.trim().toLowerCase() === statusTags.paid.toLowerCase())) return 60;
    if (trimmedTags.some(tag => tag.trim().toLowerCase() === statusTags.fulfilled.toLowerCase())) return 50;
    if (trimmedTags.some(tag => tag.trim().toLowerCase() === statusTags.shipped.toLowerCase())) return 40;
    if (trimmedTags.some(tag => tag.trim().toLowerCase() === statusTags.readyToShip.toLowerCase())) return 30;
    if (trimmedTags.some(tag => tag.trim().toLowerCase() === statusTags.customerConfirmed.toLowerCase())) return 20;
    if (trimmedTags.some(tag => tag.trim().toLowerCase() === statusTags.onHold.toLowerCase())) return 17;
    if (trimmedTags.some(tag => tag.trim().toLowerCase() === statusTags.orderReady.toLowerCase())) return 15;
    return 10; // pending orders should be first
  };

  // Update search query handler
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  // Clear search handler
  const handleClearSearch = () => {
    handleSearchChange('');
    // Restore previous filter when clearing search
    if (statusFilter === 'all' && previousStatusFilter !== 'all') {
      setStatusFilter(previousStatusFilter);
    }
  };


  // Get shipping date from tags
  const getShippingDate = (order: Order) => {
    const tags = Array.isArray(order.tags) ? order.tags : 
                typeof order.tags === 'string' ? order.tags.split(',').map(t => t.trim()) :
                [];
    const shippingDateTag = tags.find(tag => tag.trim().startsWith('shipping_date:'));
    if (shippingDateTag) {
      const dateStr = shippingDateTag.split(':')[1]?.trim();
      if (dateStr) {
        return new Date(dateStr);
      }
    }
    return null;
  };

  // Helper function to check if an order contains a specific item
  const orderContainsItem = (order: Order, itemTitle: string): boolean => {
    return order.line_items?.some(item => {
      const itemKey = item.variant_title ? `${item.title} - ${item.variant_title}` : item.title;
      return itemKey === itemTitle;
    }) || false;
  };

  // Helper function to detect making time from line items
  const detectMakingTime = (lineItems: any[]): number | null => {
    if (!lineItems || lineItems.length === 0) return null;
    
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
      
      // Check properties for making time
      if (item.properties && Array.isArray(item.properties)) {
        for (const prop of item.properties) {
          const propName = (prop.name || '').toLowerCase();
          const propValue = prop.value || '';
          
          if (propName.includes('making time') || propName.includes('timeline') || propName.includes('rush')) {
            const rushPropMatch = propValue.match(/rush.*?\[(\d+)\s*days?\]/i);
            if (rushPropMatch) {
              return parseInt(rushPropMatch[1], 10);
            }
            const handmadePropMatch = propValue.match(/handmade.*?\[(\d+)\s*days?\]/i);
            if (handmadePropMatch) {
              return parseInt(handmadePropMatch[1], 10);
            }
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
      
      if (title.toLowerCase().includes('making time') || title.toLowerCase().includes('choose your')) {
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

  // Helper function to calculate days left for an order (matches OrderTimeline calculation)
  const calculateDaysLeft = (order: Order): number => {
    try {
      const now = convertToCairoTime(new Date());
      
      // Get tags
      const tags = Array.isArray(order.tags) 
        ? order.tags 
        : typeof order.tags === 'string' 
          ? order.tags.split(',').map(t => t.trim())
          : [];
      
      // Check for custom due date
      const dueDateTag = tags.find((tag: string) => tag.startsWith('custom_due_date:'));
      let dueDate: Date;
      
      if (dueDateTag) {
        const dateStr = dueDateTag.split(':')[1];
        if (dateStr) {
          const parsedDueDate = convertToCairoTime(new Date(dateStr));
          if (!isNaN(parsedDueDate.getTime())) {
            dueDate = parsedDueDate;
          } else {
            // Fallback: calculate from start date
            dueDate = null as any;
          }
        } else {
          dueDate = null as any;
        }
      } else {
        dueDate = null as any;
      }
      
      // If no custom due date, calculate from start date
      if (!dueDate || isNaN(dueDate.getTime())) {
        // Check for custom start date
        const startDateTag = tags.find((tag: string) => tag.startsWith('custom_start_date:'));
        let startDate: Date;
        
        if (startDateTag) {
          const dateStr = startDateTag.split(':')[1];
          if (dateStr) {
            const parsedDate = convertToCairoTime(new Date(dateStr));
            if (!isNaN(parsedDate.getTime())) {
              startDate = parsedDate;
            } else {
              // Fallback to created_at or effective_created_at
              const fallbackDate = order.created_at || order.effective_created_at || new Date().toISOString();
              startDate = convertToCairoTime(new Date(fallbackDate));
              if (isNaN(startDate.getTime())) {
                startDate = now;
              }
            }
          } else {
            const fallbackDate = order.created_at || order.effective_created_at || new Date().toISOString();
            startDate = convertToCairoTime(new Date(fallbackDate));
            if (isNaN(startDate.getTime())) {
              startDate = now;
            }
          }
        } else {
          // Use created_at or effective_created_at, with fallbacks
          const fallbackDate = order.created_at || order.effective_created_at;
          if (fallbackDate) {
            startDate = convertToCairoTime(new Date(fallbackDate));
            if (isNaN(startDate.getTime())) {
              startDate = now;
            }
          } else {
            startDate = now;
          }
        }
        
        // Detect making time from line items
        const makingTimeDays = detectMakingTime(order.line_items || []);
        const daysToAdd = makingTimeDays || 7; // Default to 7 days if not detected
        
        // Calculate due date
        const calculatedDueDate = new Date(startDate);
        calculatedDueDate.setDate(calculatedDueDate.getDate() + daysToAdd);
        dueDate = convertToCairoTime(calculatedDueDate);
        
        // Validate final due date
        if (isNaN(dueDate.getTime())) {
          return 7; // Return default days left
        }
      }
      
      // Use calculateDaysRemaining to match OrderTimeline calculation
      return calculateDaysRemaining(dueDate, now);
    } catch (error) {
      // Return a default value to prevent sorting errors
      return 7;
    }
  };

  // Helper function to get day range label
  const getDayRange = (daysLeft: number): string => {
    if (daysLeft < 0) {
      const absDays = Math.abs(daysLeft);
      return absDays === 1 ? '-1 day' : `-${absDays} days`;
    }
    if (daysLeft === 0) return 'today';
    if (daysLeft === 1) return '1 day';
    if (daysLeft === 2) return '2 days';
    if (daysLeft === 3) return '3 days';
    if (daysLeft === 4) return '4 days';
    if (daysLeft === 5) return '5 days';
    if (daysLeft === 6) return '6 days';
    if (daysLeft === 7) return '7 days';
    return '+7 days';
  };

  // Helper function to get shipping method from order
  const getShippingMethodFromOrder = (order: Order): string => {
    const tags = Array.isArray(order.tags) ? order.tags : 
                typeof order.tags === 'string' ? order.tags.split(',').map(t => t.trim()) :
                [];
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

  // Helper function to get rush type from order
  const getRushTypeFromOrder = (order: Order): string => {
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

  // First, decorate orders with their original index
  const sortedOrders = (orders || [])?.map((order: Order, idx: number) => ({
    ...order,
    originalIndex: idx
  }))
  // Then filter using the same logic as handleSelectAll
  .filter((order: Order & { originalIndex: number }) => matchesAllFilters(order))
  // Sort with different rules based on status filter
  .sort((a: Order & { originalIndex: number }, b: Order & { originalIndex: number }) => {
    // For fulfilled orders, pin priority orders first, then sort by order ID
    if (statusFilter === 'fulfilled') {
      // Helper to check if order has priority tag (case-insensitive with trimming)
      const hasPriority = (order: Order): boolean => {
        const tags = Array.isArray(order.tags) 
          ? order.tags.map((t: string) => t.trim())
          : typeof order.tags === 'string' 
            ? order.tags.split(',').map(t => t.trim())
            : [];
        return tags.some((tag: string) => tag.trim().toLowerCase() === 'priority');
      };
      
      const aPriority = hasPriority(a);
      const bPriority = hasPriority(b);
      
      // Rule 1: Priority orders are pinned to the top
      if (aPriority && !bPriority) return -1;
      if (!aPriority && bPriority) return 1;
      
      // Rule 2: Within each group (priority/non-priority), sort by order ID
      // Extract numeric part from order name (e.g., "#1023" -> 1023)
      const getOrderNumber = (orderName: string): number => {
        const match = orderName?.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      };
      
      const aNum = getOrderNumber(a.name || '');
      const bNum = getOrderNumber(b.name || '');
      
      return aNum - bNum; // Ascending order
    }

    // For all other statuses, use the existing sorting rules
    // Helper to check if order has priority tag (case-insensitive with trimming)
    const hasPriority = (order: Order): boolean => {
      const tags = Array.isArray(order.tags) 
        ? order.tags.map((t: string) => t.trim())
        : typeof order.tags === 'string' 
          ? order.tags.split(',').map(t => t.trim())
          : [];
      return tags.some((tag: string) => tag.trim().toLowerCase() === 'priority');
    };

    const aPriority = hasPriority(a);
    const bPriority = hasPriority(b);

    // Rule 1: Priority orders are pinned to the top
    if (aPriority && !bPriority) return -1;
    if (!aPriority && bPriority) return 1;

    // Rule 2: Sort by days left (ascending - fewest days first)
    const aDaysLeft = calculateDaysLeft(a);
    const bDaysLeft = calculateDaysLeft(b);
    if (aDaysLeft !== bDaysLeft) {
      return aDaysLeft - bDaysLeft;
    }

    // Rule 3: Sort by order ID (ascending)
    if (a.id !== b.id) {
      return a.id - b.id;
    }

    // Final stable sort tiebreaker using original index
    return a.originalIndex - b.originalIndex;
  });

  // Clear temporary status update tags after a delay
  useEffect(() => {
    if (!orders) return;
    
    // Check if any orders have the temporary status tag
    const hasTemporaryTags = orders.some(order => {
      const tags = Array.isArray(order.tags) 
        ? order.tags 
        : typeof order.tags === 'string' 
          ? order.tags.split(',').map((t: string) => t.trim()) 
          : [];
      return tags.includes('__status_just_updated');
    });
    
    if (hasTemporaryTags) {
      // Set a timeout to clear the temporary tags
      const timeoutId = setTimeout(() => {
        const updatedOrders = orders.map(order => {
            const tags = Array.isArray(order.tags) 
            ? order.tags 
              : typeof order.tags === 'string' 
                ? order.tags.split(',').map((t: string) => t.trim()) 
                : [];
          return {
            ...order,
            tags: tags.filter((t: string) => t !== '__status_just_updated')
          };
        });
        queryClient.setQueryData(['orders'], updatedOrders);
      }, 3000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [orders, queryClient]);


  // Mutation for updating tags
  const updateTagsMutation = useMutation({
    mutationFn: async ({ orderId, newTags }: { orderId: number; newTags: string[] }) => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${orderId}/tags`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tags: newTags }),
      });
      if (!response.ok) {
        throw new Error('Failed to update tags');
      }
      return response.json();
    },
    onMutate: async ({ orderId, newTags }: { orderId: number; newTags: string[] }) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      const previous = queryClient.getQueryData<Order[]>(['orders']);
      updateOrderInCache(orderId, (o) => ({ ...o, tags: newTags }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['orders'], context.previous);
    },
    // Intentionally no background refresh to avoid fetching after each single update
  });

  const handleUpdateTags = (orderId: number, newTags: string[]) => {
    updateTagsMutation.mutate({ orderId, newTags });
  };



  // Get visible tabs based on current status filter
  // Order: production -> days -> city -> shipping -> rushed -> fulfillment_month -> paid_month -> cancelled_calendar -> cancelled_reason
  const getVisibleTabs = (): Array<'production' | 'city' | 'days' | 'shipping' | 'rushed' | 'fulfillment_month' | 'paid_month' | 'cancelled_calendar' | 'cancelled_reason'> => {
    const tabs: Array<'production' | 'city' | 'days' | 'shipping' | 'rushed' | 'fulfillment_month' | 'paid_month' | 'cancelled_calendar' | 'cancelled_reason'> = [];
    
    // For cancelled view, show calendar and reason tabs
    if (statusFilter === 'cancelled') {
      tabs.push('cancelled_calendar');
      tabs.push('cancelled_reason');
      tabs.push('city');
      tabs.push('shipping');
      tabs.push('rushed');
      return tabs;
    }
    
    // For on_hold view, show all tabs
    if (statusFilter === 'on_hold') {
      tabs.push('production');
      tabs.push('days');
      tabs.push('city');
      tabs.push('shipping');
      tabs.push('rushed');
      return tabs;
    }
    
    // Production tab
    if (['pending', 'order-ready', 'confirmed', 'all'].includes(statusFilter)) {
      tabs.push('production');
    }
    
    // Days tab
    if (['pending', 'order-ready', 'confirmed', 'ready-to-ship', 'all'].includes(statusFilter)) {
      tabs.push('days');
    }
    
    // City tab (always visible)
    tabs.push('city');
    
    // Shipping tab
    if (['pending', 'order-ready', 'confirmed', 'ready-to-ship', 'shipped', 'fulfilled', 'all'].includes(statusFilter)) {
      tabs.push('shipping');
    }
    
    // Rushed tab (always visible)
    tabs.push('rushed');
    
    // Fulfillment month tab (only for fulfilled orders)
    if (statusFilter === 'fulfilled') {
      tabs.push('fulfillment_month');
    }
    
    // Paid month tab (only for paid orders)
    if (statusFilter === 'paid') {
      tabs.push('paid_month');
    }
    
    return tabs;
  };

  // Calculate data for production tab (counts reflect current displayed orders = status + other quick filters)
  const getProductionData = () => {
    if (!orders) return [];

    const ordersToProcess = selectedOrders.length > 0
      ? orders.filter(order => selectedOrders.includes(order.id))
      : orders.filter(order => filterOrdersByStatus(order) && orderMatchesOtherQuickFilters(order, 'production'));
    
    const itemCounts: { [key: string]: number } = {};
    
    ordersToProcess.forEach(order => {
      order.line_items?.forEach(item => {
        const itemKey = item.variant_title ? `${item.title} - ${item.variant_title}` : item.title;
        itemCounts[itemKey] = (itemCounts[itemKey] || 0) + item.quantity;
      });
    });
    
    return Object.entries(itemCounts)
      .map(([title, quantity]) => ({ title, quantity }))
      .sort((a, b) => b.quantity - a.quantity);
  };

  // Calculate data for city tab (counts reflect current displayed orders)
  const getCityData = () => {
    if (!orders) return [];

    const ordersToProcess = selectedOrders.length > 0
      ? orders.filter(order => selectedOrders.includes(order.id))
      : orders.filter(order => filterOrdersByStatus(order) && orderMatchesOtherQuickFilters(order, 'city'));
    
    const cityCounts: { [key: string]: number } = {};
    
    ordersToProcess.forEach(order => {
      const province = order.shipping_address?.province || 'Unknown';
      cityCounts[province] = (cityCounts[province] || 0) + 1;
    });
    
    return Object.entries(cityCounts)
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count);
  };

  // Calculate data for days left tab (counts reflect current displayed orders)
  const getDaysLeftData = () => {
    if (!orders) return [];

    const ordersToProcess = selectedOrders.length > 0
      ? orders.filter(order => selectedOrders.includes(order.id))
      : orders.filter(order => filterOrdersByStatus(order) && orderMatchesOtherQuickFilters(order, 'days'));
    
    const rangeCounts: { [key: string]: number } = {};
    
    ordersToProcess.forEach(order => {
      const daysLeft = calculateDaysLeft(order);
      const range = getDayRange(daysLeft);
      rangeCounts[range] = (rangeCounts[range] || 0) + 1;
    });
    
    // Separate negative days, zero/positive days, and +7 days
    const negativeRanges: string[] = [];
    const positiveRanges: string[] = [];
    let plusSevenRange: string | null = null;
    
    Object.keys(rangeCounts).forEach(range => {
      if (range.startsWith('-')) {
        negativeRanges.push(range);
      } else if (range === '+7 days') {
        plusSevenRange = range;
      } else {
        positiveRanges.push(range);
      }
    });
    
    // Sort negative ranges (most negative first, e.g., -5, -4, -3, -2, -1)
    negativeRanges.sort((a, b) => {
      const aNum = parseInt(a.replace(/[^-\d]/g, ''));
      const bNum = parseInt(b.replace(/[^-\d]/g, ''));
      return aNum - bNum; // More negative first
    });
    
    // Sort positive ranges in order: today, 1 day, 2 days, etc.
    const positiveOrder = ['today', '1 day', '2 days', '3 days', '4 days', '5 days', '6 days', '7 days'];
    positiveRanges.sort((a, b) => {
      const aIndex = positiveOrder.indexOf(a);
      const bIndex = positiveOrder.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
    
    // Combine: negative days (most negative first), then positive days, then +7 days
    const allRanges = [...negativeRanges, ...positiveRanges];
    if (plusSevenRange) {
      allRanges.push(plusSevenRange);
    }
    
    return allRanges
      .filter(range => rangeCounts[range] > 0)
      .map(range => ({ range, count: rangeCounts[range] }));
  };

  // Calculate data for shipping tab (counts reflect current displayed orders)
  const getShippingData = () => {
    if (!orders) return [];

    const ordersToProcess = selectedOrders.length > 0
      ? orders.filter(order => selectedOrders.includes(order.id))
      : orders.filter(order => filterOrdersByStatus(order) && orderMatchesOtherQuickFilters(order, 'shipping'));
    
    const methodCounts: { [key: string]: number } = {};
    
    ordersToProcess.forEach(order => {
      const method = getShippingMethodFromOrder(order);
      methodCounts[method] = (methodCounts[method] || 0) + 1;
    });
    
    const methodOrder = ['Shipblu', 'Other Company', 'Scooter', 'Pickup'];
    return methodOrder
      .filter(method => methodCounts[method] > 0)
      .map(method => ({ method, count: methodCounts[method] }));
  };

  // Calculate data for rushed tab (counts reflect current displayed orders)
  const getRushedData = () => {
    if (!orders) return [];

    const ordersToProcess = selectedOrders.length > 0
      ? orders.filter(order => selectedOrders.includes(order.id))
      : orders.filter(order => filterOrdersByStatus(order) && orderMatchesOtherQuickFilters(order, 'rushed'));
    
    const typeCounts: { [key: string]: number } = {
      'Rushed': 0,
      'Standard': 0,
      'Mix': 0
    };
    
    ordersToProcess.forEach(order => {
      const type = getRushTypeFromOrder(order);
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    // Only show types that have count > 0
    const typeOrder = ['Rushed', 'Standard', 'Mix'];
    return typeOrder
      .filter(type => typeCounts[type] > 0)
      .map(type => ({ type, count: typeCounts[type] }));
  };

  // Calculate data for fulfillment month tab (counts reflect current displayed orders)
  const getFulfillmentMonthData = () => {
    if (!orders) return [];

    const ordersToProcess = selectedOrders.length > 0
      ? orders.filter(order => selectedOrders.includes(order.id))
      : orders.filter(order => filterOrdersByStatus(order) && orderMatchesOtherQuickFilters(order, 'fulfillment_month'));
    
    const monthCounts: { [key: string]: number } = {};
    
    ordersToProcess.forEach(order => {
      const tags = Array.isArray(order.tags) 
        ? order.tags 
        : typeof order.tags === 'string' 
          ? order.tags.split(',').map(t => t.trim())
          : [];
      
      // Check if order is fulfilled
      const isFulfilled = tags.some((tag: string) => tag.trim().toLowerCase() === 'fulfilled');
      if (!isFulfilled) return;
      
      // Get fulfillment_date - ONLY use fulfillment_date, no fallback
      const fulfillmentDateTag = tags.find((tag: string) => 
        tag.trim().startsWith('fulfillment_date:')
      );
      
      if (fulfillmentDateTag) {
        const dateStr = fulfillmentDateTag.split(':')[1]?.trim();
        if (dateStr) {
          const month = dateStr.substring(0, 7); // YYYY-MM
          const [year, monthNum] = month.split('-');
          const monthName = format(new Date(parseInt(year), parseInt(monthNum) - 1, 1), 'MMMM yyyy');
          monthCounts[monthName] = (monthCounts[monthName] || 0) + 1;
        }
      }
    });
    
    // Sort by month (most recent first)
    return Object.entries(monthCounts)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => {
        const aDate = new Date(a.month);
        const bDate = new Date(b.month);
        return bDate.getTime() - aDate.getTime(); // Descending (newest first)
      });
  };

  // Calculate data for paid month tab (counts reflect current displayed orders)
  const getPaidMonthData = () => {
    if (!orders) return [];

    const ordersToProcess = selectedOrders.length > 0
      ? orders.filter(order => selectedOrders.includes(order.id))
      : orders.filter(order => filterOrdersByStatus(order) && orderMatchesOtherQuickFilters(order, 'paid_month'));
    
    const monthCounts: { [key: string]: number } = {};
    
    ordersToProcess.forEach(order => {
      const tags = Array.isArray(order.tags) 
        ? order.tags 
        : typeof order.tags === 'string' 
          ? order.tags.split(',').map(t => t.trim())
          : [];
      
      // Check if order is paid
      const isPaid = tags.some((tag: string) => tag.trim().toLowerCase() === 'paid');
      if (!isPaid) return;
      
      // Get paid_date - ONLY use paid_date, no fallback
      const paidDateTag = tags.find((tag: string) => 
        tag.trim().startsWith('paid_date:')
      );
      
      if (paidDateTag) {
        const dateStr = paidDateTag.split(':')[1]?.trim();
        if (dateStr) {
          const month = dateStr.substring(0, 7); // YYYY-MM
          const [year, monthNum] = month.split('-');
          const monthName = format(new Date(parseInt(year), parseInt(monthNum) - 1, 1), 'MMMM yyyy');
          monthCounts[monthName] = (monthCounts[monthName] || 0) + 1;
        }
      }
    });
    
    // Sort by month (most recent first)
    return Object.entries(monthCounts)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => {
        const aDate = new Date(a.month);
        const bDate = new Date(b.month);
        return bDate.getTime() - aDate.getTime(); // Descending (newest first)
      });
  };

  // Calculate data for cancelled calendar tab (counts reflect current displayed orders)
  const getCancelledCalendarData = () => {
    if (!orders) return [];

    const ordersToProcess = selectedOrders.length > 0
      ? orders.filter(order => selectedOrders.includes(order.id))
      : orders.filter(order => filterOrdersByStatus(order) && orderMatchesOtherQuickFilters(order, 'cancelled_calendar'));
    
    const monthCounts: { [key: string]: number } = {};
    
    ordersToProcess.forEach(order => {
      const tags = Array.isArray(order.tags) 
        ? order.tags 
        : typeof order.tags === 'string' 
          ? order.tags.split(',').map(t => t.trim())
          : [];
      
      // Check if order is cancelled
      const isCancelled = tags.some((tag: string) => tag.trim().toLowerCase() === 'cancelled');
      if (!isCancelled) return;
      
      // Get cancelled_date
      const cancelledDateTag = tags.find((tag: string) => 
        tag.trim().startsWith('cancelled_date:')
      );
      
      if (cancelledDateTag) {
        const dateStr = cancelledDateTag.split(':')[1]?.trim();
        if (dateStr) {
          const month = dateStr.substring(0, 7); // YYYY-MM
          const [year, monthNum] = month.split('-');
          const monthName = format(new Date(parseInt(year), parseInt(monthNum) - 1, 1), 'MMMM yyyy');
          monthCounts[monthName] = (monthCounts[monthName] || 0) + 1;
        }
      }
    });
    
    // Sort by month (most recent first)
    return Object.entries(monthCounts)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => {
        const aDate = new Date(a.month);
        const bDate = new Date(b.month);
        return bDate.getTime() - aDate.getTime(); // Descending (newest first)
      });
  };

  // Calculate data for cancelled reason tab (counts reflect current displayed orders)
  const getCancelledReasonData = () => {
    if (!orders) return [];

    const ordersToProcess = selectedOrders.length > 0
      ? orders.filter(order => selectedOrders.includes(order.id))
      : orders.filter(order => filterOrdersByStatus(order) && orderMatchesOtherQuickFilters(order, 'cancelled_reason'));
    
    const reasonCounts: { [key: string]: number } = {
      'Cancelled After shipping': 0,
      'No response': 0,
      'Other': 0
    };
    
    ordersToProcess.forEach(order => {
      const tags = Array.isArray(order.tags) 
        ? order.tags 
        : typeof order.tags === 'string' 
          ? order.tags.split(',').map(t => t.trim())
          : [];
      
      // Check if order is cancelled
      const isCancelled = tags.some((tag: string) => tag.trim().toLowerCase() === 'cancelled');
      if (!isCancelled) return;
      
      // Check for cancelled_after_shipping
      const isCancelledAfterShipping = tags.some((tag: string) => tag.trim().toLowerCase() === 'cancelled_after_shipping');
      // Check for no_reply_cancelled
      const isNoReplyCancelled = tags.some((tag: string) => tag.trim().toLowerCase() === 'no_reply_cancelled');
      
      if (isCancelledAfterShipping) {
        reasonCounts['Cancelled After shipping']++;
      } else if (isNoReplyCancelled) {
        reasonCounts['No response']++;
      } else {
        reasonCounts['Other']++;
      }
    });
    
    return Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count);
  };

  // Calculate accumulated item quantities for pending orders
  const calculatePendingItemsSummary = (ordersToUse?: Order[]) => {
    if (!orders) return { items: [], totalOrders: 0, totalPieces: 0 };
    
    // Use selected orders if provided, otherwise use all pending orders
    let ordersToProcess: Order[];
    
    if (ordersToUse && ordersToUse.length > 0) {
      // Use provided orders (selected orders)
      ordersToProcess = ordersToUse;
    } else {
      // Filter pending orders
      ordersToProcess = orders.filter(order => {
      const tags = Array.isArray(order.tags) 
        ? order.tags 
        : typeof order.tags === 'string' 
          ? order.tags.split(',').map(tag => tag.trim())
          : [];
      
        // Check if order is pending (no status tags and not deleted) - case-insensitive
        return !tags.some(tag => tag.trim().toLowerCase() === 'deleted') && 
               !tags.some(tag => {
                 const trimmed = tag.trim().toLowerCase();
                 return ['order_ready', 'customer_confirmed', 'ready_to_ship', 'shipped', 'fulfilled', 'cancelled', 'paid'].some(st => st.toLowerCase() === trimmed);
               });
    });
    }

    const itemCounts: { [key: string]: number } = {};
    let totalPieces = 0;

    ordersToProcess.forEach(order => {
      order.line_items?.forEach(item => {
        const itemKey = item.variant_title ? `${item.title} - ${item.variant_title}` : item.title;
        itemCounts[itemKey] = (itemCounts[itemKey] || 0) + item.quantity;
        totalPieces += item.quantity;
      });
    });

    const sortedItems = Object.entries(itemCounts)
      .map(([title, quantity]) => ({ title, quantity }))
      .sort((a, b) => b.quantity - a.quantity); // Sort by quantity descending

    return {
      items: sortedItems,
      totalOrders: ordersToProcess.length,
      totalPieces
    };
  };

  // Handle item click in summary card
  const handleSummaryItemClick = (itemTitle: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card expansion/collapse
    
    setSelectedSummaryItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemTitle)) {
        newSet.delete(itemTitle);
      } else {
        newSet.add(itemTitle);
      }
      return newSet;
    });
  };

  // Clear item selection when clicking outside or when orders are selected
  useEffect(() => {
    if (selectedOrders.length > 0) {
      setSelectedSummaryItems(new Set());
      // Don't clear quick filters - they should work with selected orders
    }
  }, [selectedOrders]);

  // Quick Filter Card Component
  const QuickFilterCard = () => {
    const visibleTabs = getVisibleTabs();
    
    // Set default tab to production if available, otherwise first visible tab
    // Only run when statusFilter changes, not when activeQuickFilterTab changes
    useEffect(() => {
      if (visibleTabs.length > 0) {
        // Only reset if current tab is not in visible tabs
        if (!visibleTabs.includes(activeQuickFilterTab)) {
          // For cancelled orders, prefer cancelled_calendar tab
          if (statusFilter === 'cancelled' && visibleTabs.includes('cancelled_calendar')) {
            setActiveQuickFilterTab('cancelled_calendar');
          } else if (statusFilter === 'paid' && visibleTabs.includes('paid_month')) {
            setActiveQuickFilterTab('paid_month');
          } else if (statusFilter === 'fulfilled' && visibleTabs.includes('fulfillment_month')) {
            setActiveQuickFilterTab('fulfillment_month');
          } else if (visibleTabs.includes('production')) {
            setActiveQuickFilterTab('production');
          } else {
            setActiveQuickFilterTab(visibleTabs[0]);
          }
        }
      }
    }, [statusFilter]); // Only depend on statusFilter, not activeQuickFilterTab

    // Get current tab data
    const getCurrentTabData = () => {
      switch (activeQuickFilterTab) {
        case 'production':
          return getProductionData();
        case 'city':
          return getCityData();
        case 'days':
          return getDaysLeftData();
        case 'shipping':
          return getShippingData();
        case 'rushed':
          return getRushedData();
        case 'fulfillment_month':
          return getFulfillmentMonthData();
        case 'paid_month':
          return getPaidMonthData();
        case 'cancelled_calendar':
          return getCancelledCalendarData();
        case 'cancelled_reason':
          return getCancelledReasonData();
        default:
          return [];
      }
    };

    // Get selected items for current tab
    const getSelectedItems = () => {
      switch (activeQuickFilterTab) {
        case 'production':
          return selectedProductionItems;
        case 'city':
          return selectedCities;
        case 'days':
          return selectedDayRanges;
        case 'shipping':
          return selectedShippingMethods;
        case 'rushed':
          return selectedRushTypes;
        case 'fulfillment_month':
          return selectedFulfillmentMonths;
        case 'paid_month':
          return selectedPaidMonths;
        case 'cancelled_calendar':
          return selectedCancelledMonths;
        case 'cancelled_reason':
          return selectedCancelledReasons;
        default:
          return new Set<string>();
      }
    };

    // Handle item click
    const handleItemClick = (value: string, e: React.MouseEvent) => {
      e.stopPropagation();
      
      switch (activeQuickFilterTab) {
        case 'production':
          setSelectedProductionItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(value)) newSet.delete(value);
            else newSet.add(value);
            return newSet;
          });
          break;
        case 'city':
          setSelectedCities(prev => {
            const newSet = new Set(prev);
            if (newSet.has(value)) newSet.delete(value);
            else newSet.add(value);
            return newSet;
          });
          break;
        case 'days':
          setSelectedDayRanges(prev => {
            const newSet = new Set(prev);
            if (newSet.has(value)) newSet.delete(value);
            else newSet.add(value);
            return newSet;
          });
          break;
        case 'shipping':
          setSelectedShippingMethods(prev => {
            const newSet = new Set(prev);
            if (newSet.has(value)) newSet.delete(value);
            else newSet.add(value);
            return newSet;
          });
          break;
        case 'rushed':
          setSelectedRushTypes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(value)) newSet.delete(value);
            else newSet.add(value);
            return newSet;
          });
          break;
        case 'fulfillment_month':
          setSelectedFulfillmentMonths(prev => {
            const newSet = new Set(prev);
            if (newSet.has(value)) newSet.delete(value);
            else newSet.add(value);
            return newSet;
          });
          break;
        case 'paid_month':
          setSelectedPaidMonths(prev => {
            const newSet = new Set(prev);
            if (newSet.has(value)) newSet.delete(value);
            else newSet.add(value);
            return newSet;
          });
          break;
        case 'cancelled_calendar':
          setSelectedCancelledMonths(prev => {
            const newSet = new Set(prev);
            if (newSet.has(value)) newSet.delete(value);
            else newSet.add(value);
            return newSet;
          });
          break;
        case 'cancelled_reason':
          setSelectedCancelledReasons(prev => {
            const newSet = new Set(prev);
            if (newSet.has(value)) newSet.delete(value);
            else newSet.add(value);
            return newSet;
          });
          break;
      }
    };

    // Clear all filters from all tabs
    const handleClearFilter = () => {
      setSelectedProductionItems(new Set());
      setSelectedCities(new Set());
      setSelectedDayRanges(new Set());
      setSelectedShippingMethods(new Set());
      setSelectedRushTypes(new Set());
      setSelectedFulfillmentMonths(new Set());
      setSelectedPaidMonths(new Set());
      setSelectedCancelledMonths(new Set());
      setSelectedCancelledReasons(new Set());
    };

    const currentData = getCurrentTabData();
    const selectedItems = getSelectedItems();
    const displayedItems = isQuickFilterExpanded ? currentData : currentData.slice(0, 5);
    
    // Check if any tab has selected items
    const hasAnyFilters = 
      selectedProductionItems.size > 0 ||
      selectedCities.size > 0 ||
      selectedDayRanges.size > 0 ||
      selectedShippingMethods.size > 0 ||
      selectedRushTypes.size > 0 ||
      selectedFulfillmentMonths.size > 0 ||
      selectedPaidMonths.size > 0 ||
      selectedCancelledMonths.size > 0 ||
      selectedCancelledReasons.size > 0;

    // Calculate total revenue of selected orders (excluding cancelled orders)
    const selectedOrdersRevenue = useMemo(() => {
      if (!orders || selectedOrders.length === 0) return 0;
      return selectedOrders.reduce((sum, orderId) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return sum;
        
        // Check if order is cancelled - exclude cancelled orders from revenue
        const tags = Array.isArray(order.tags) 
          ? order.tags 
          : typeof order.tags === 'string' 
            ? order.tags.split(',').map(t => t.trim())
            : [];
        const isCancelled = tags.some((tag: string) => tag.trim().toLowerCase() === 'cancelled');
        
        // Cancelled orders don't contribute to revenue (we didn't receive money)
        if (isCancelled) return sum;
        
        return sum + parseFloat(order.total_price || '0');
      }, 0);
    }, [orders, selectedOrders]);

    // Get empty message based on active tab
    const getEmptyMessage = () => {
      switch (activeQuickFilterTab) {
        case 'cancelled_calendar':
          return "Couldn't find cancelled_date tags";
        case 'cancelled_reason':
          return "Couldn't find cancellation data";
        case 'fulfillment_month':
          return "Couldn't find fulfillment_date tags";
        case 'paid_month':
          return "Couldn't find paid_date tags";
        default:
          return null;
      }
    };

    // Don't show card in "all orders" view
    if (statusFilter === 'all') return null;

    const emptyMessage = getEmptyMessage();

    const tabConfig = {
      production: { icon: '🧶', label: 'Production', tooltip: 'Production' },
      city: { icon: '📍', label: 'City', tooltip: 'City' },
      days: { icon: '📅', label: 'Days', tooltip: 'Days Left' },
      shipping: { icon: '🚚', label: 'Shipping', tooltip: 'Shipping Method' },
      rushed: { icon: '⚡', label: 'Rushed', tooltip: 'Rushed/Standard' },
      fulfillment_month: { icon: '📆', label: 'Month', tooltip: 'Fulfillment Month' },
      paid_month: { icon: '📅', label: 'Calendar', tooltip: 'Paid Month' },
      cancelled_calendar: { icon: '📅', label: 'Calendar', tooltip: 'Cancelled Month' },
      cancelled_reason: { icon: '❌', label: 'Reason', tooltip: 'Cancellation Reason' },
    };

    const visibleOrderCount = orders?.filter(matchesAllFilters).length ?? 0;
    const allVisibleSelected = orders && selectedOrders.length === visibleOrderCount && visibleOrderCount > 0;

    // Revenue of visible (filtered) orders, excluding cancelled — always available for display
    const visibleOrdersRevenue = useMemo(() => {
      if (!orders) return 0;
      return orders
        .filter(o => matchesAllFilters(o))
        .filter(order => {
          const tags = Array.isArray(order.tags) ? order.tags : typeof order.tags === 'string' ? order.tags.split(',').map((t: string) => t.trim()) : [];
          return !tags.some((tag: string) => tag.trim().toLowerCase() === 'cancelled');
        })
        .reduce((sum, order) => sum + parseFloat(order.total_price || '0'), 0);
    }, [orders, matchesAllFilters]);

    const getBulkStatusColor = (status: string) => {
      switch (status) {
        case 'pending': return 'bg-yellow-100 text-yellow-800';
        case 'order-ready': return 'bg-orange-500 text-white';
        case 'on_hold': return 'bg-amber-500 text-white';
        case 'confirmed': return 'bg-green-500 text-white';
        case 'ready_to_ship': return 'bg-blue-600 text-white';
        case 'shipped': return 'bg-purple-600 text-white';
        case 'fulfilled': return 'bg-emerald-600 text-white';
        case 'paid': return 'bg-indigo-600 text-white';
        case 'cancelled': return 'bg-red-600 text-white';
        default: return 'bg-gray-100 text-gray-800';
      }
    };

    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
        {/* Row 1: Left = orders/revenue box, Right = Select all + Refresh (icon only) */}
        <div className="flex items-center justify-between gap-4 mb-3 pb-3 border-b border-blue-200">
          {/* Left: single box — orders count | revenue on one line */}
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm min-w-0 flex-shrink-0">
            <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
              {selectedOrders.length > 0 ? `${selectedOrders.length} selected` : `${visibleOrderCount} orders`}
            </span>
            <span className="text-gray-300">|</span>
            <span className="text-xs font-semibold text-green-700 whitespace-nowrap">
              {new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(
                selectedOrders.length > 0 ? selectedOrdersRevenue : visibleOrdersRevenue
              )}
            </span>
          </div>
          {/* Right: Select all + Refresh — icon only */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={handleSelectAll}
              className={`
                inline-flex items-center justify-center rounded-lg p-1.5 transition-all duration-200
                ${allVisibleSelected ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'}
              `}
              title="Select all visible orders"
            >
              <CheckIcon className="w-5 h-5" />
            </button>
            <button
              onClick={handleManualRefreshWithLoading}
              disabled={ordersLoading || isRefreshing}
              className="inline-flex items-center justify-center rounded-lg p-1.5 bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              title="Refresh orders"
            >
              <ArrowPathIcon className={`w-5 h-5 ${ordersLoading || isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Row 2: Bulk actions (left) + Clear (right); row visible when either is active; inactive button dimmed and disabled */}
        {(selectedOrders.length > 0 || hasAnyFilters) && (
          <div className="flex items-center justify-between gap-2 min-w-0 mb-3 pb-3 border-b border-blue-200">
            <Menu as="div" className={`relative min-w-0 flex-1 ${selectedOrders.length === 0 ? 'opacity-50' : ''}`}>
              {({ open }) => (
                <>
                  <Menu.Button
                    disabled={selectedOrders.length === 0}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium w-full max-w-[12rem] bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:hover:bg-gray-100 transition-all duration-200"
                  >
                    Bulk actions
                    <ChevronDownIcon className="w-4 h-4" />
                  </Menu.Button>
                  {open && selectedOrders.length > 0 && (
                    <Menu.Items
                      static
                      className="absolute left-0 mt-1.5 w-44 origin-top-left rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 border border-gray-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="py-2 px-2 space-y-1">
                        <Menu.Item>
                          {() => (
                            <button className={`rounded-md w-full text-center py-1.5 text-sm font-medium ${getBulkStatusColor('pending')}`} onClick={() => handleBulkStatusUpdate('pending')}>
                              Pending
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {() => (
                            <button className={`rounded-md w-full text-center py-1.5 text-sm font-medium ${getBulkStatusColor('order-ready')}`} onClick={() => handleBulkStatusUpdate('order-ready')}>
                              Order Ready
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {() => (
                            <button className={`rounded-md w-full text-center py-1.5 text-sm font-medium ${getBulkStatusColor('on_hold')}`} onClick={() => handleBulkStatusUpdate('on_hold')}>
                              On Hold
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {() => (
                            <button className={`rounded-md w-full text-center py-1.5 text-sm font-medium ${getBulkStatusColor('confirmed')}`} onClick={() => handleBulkStatusUpdate('confirmed')}>
                              Confirmed
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {() => (
                            <button className={`rounded-md w-full text-center py-1.5 text-sm font-medium ${getBulkStatusColor('ready_to_ship')}`} onClick={() => handleBulkStatusUpdate('ready_to_ship')}>
                              Ready to Ship
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {() => (
                            <button className={`rounded-md w-full text-center py-1.5 text-sm font-medium ${getBulkStatusColor('shipped')}`} onClick={() => handleBulkStatusUpdate('shipped')}>
                              Shipped
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {() => (
                            <button className={`rounded-md w-full text-center py-1.5 text-sm font-medium ${getBulkStatusColor('fulfilled')}`} onClick={() => handleBulkStatusUpdate('fulfilled')}>
                              Fulfilled
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {() => (
                            <button className={`rounded-md w-full text-center py-1.5 text-sm font-medium ${getBulkStatusColor('paid')}`} onClick={() => handleBulkStatusUpdate('paid')}>
                              Paid
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {() => (
                            <button className={`rounded-md w-full text-center py-1.5 text-sm font-medium ${getBulkStatusColor('cancelled')}`} onClick={() => handleBulkStatusUpdate('cancelled')}>
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
            <button
              onClick={(e) => { e.stopPropagation(); handleClearFilter(); }}
              disabled={!hasAnyFilters}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium min-w-0 flex-1 max-w-[12rem] bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:hover:bg-gray-100 transition-all duration-200 ${!hasAnyFilters ? 'opacity-50' : ''}`}
              title="Clear all filters"
            >
              Clear
            </button>
          </div>
        )}

        {/* Row 3: Filter icon tabs — full width, horizontal scroll; margin from above */}
        <div className="mb-4 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-1">
          <div className="flex items-center justify-center gap-2 flex-nowrap py-1 min-w-max">
            {visibleTabs.map(tab => {
              const config = tabConfig[tab];
              const isActive = activeQuickFilterTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveQuickFilterTab(tab)}
                  className={`
                    w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center
                    transition-all duration-200
                    ${isActive 
                      ? 'bg-blue-600 text-white ring-2 ring-blue-300 ring-offset-2' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }
                  `}
                  title={config.tooltip}
                >
                  <span className="text-lg">{config.icon}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="space-y-2">
          {currentData.length === 0 && emptyMessage ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-600">{emptyMessage}</p>
            </div>
          ) : (
            displayedItems.map((item: any, index: number) => {
              const value = activeQuickFilterTab === 'production' ? item.title :
                           activeQuickFilterTab === 'city' ? item.city :
                           activeQuickFilterTab === 'days' ? item.range :
                           activeQuickFilterTab === 'shipping' ? item.method :
                           activeQuickFilterTab === 'fulfillment_month' ? item.month :
                           activeQuickFilterTab === 'paid_month' ? item.month :
                           activeQuickFilterTab === 'cancelled_calendar' ? item.month :
                           activeQuickFilterTab === 'cancelled_reason' ? item.reason :
                           item.type;
              const count = item.quantity || item.count;
              const isSelected = selectedItems.has(value);
              
              // Check if this is an "other-company" province (should be green)
              const otherCompanyProvinces = [
                'New Valley',
                'North Sinai',
                'South Sinai',
                'Red Sea',
                'Matrouh',
                'Qena',
                'Luxor',
                'Aswan',
                'Asyut',
                'Beni Suef',
                'Fayoum',
                'Minya',
                'Sohag'
              ];
              const isOtherCompanyProvince = activeQuickFilterTab === 'city' && otherCompanyProvinces.includes(value);
              
              return (
                <div 
                  key={index} 
                  onClick={(e) => handleItemClick(value, e)}
                  className={`flex justify-between items-center py-2 px-3 rounded-md border cursor-pointer transition-colors ${
                    isSelected 
                      ? isOtherCompanyProvince
                        ? 'bg-green-200 border-green-400 shadow-sm'
                        : 'bg-blue-200 border-blue-400 shadow-sm'
                      : isOtherCompanyProvince
                        ? 'bg-green-50 border-green-300 hover:border-green-400 hover:bg-green-100'
                        : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                  title={isSelected ? "Click to deselect" : "Click to filter by this item"}
                >
                  <span className={`text-sm truncate flex-1 ${
                    isSelected 
                      ? isOtherCompanyProvince
                        ? 'font-semibold text-green-900'
                        : 'font-semibold text-blue-900'
                      : isOtherCompanyProvince
                        ? 'text-green-800'
                        : 'text-gray-700'
                  }`}>
                    {value}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${
                      isSelected 
                        ? isOtherCompanyProvince
                          ? 'text-green-900'
                          : 'text-blue-900'
                        : isOtherCompanyProvince
                          ? 'text-green-700'
                          : 'text-blue-600'
                    }`}>
                      {count}
                    </span>
                    {isSelected && (
                      <CheckIcon className={`w-4 h-4 ${isOtherCompanyProvince ? 'text-green-600' : 'text-blue-600'}`} />
                    )}
                  </div>
                </div>
              );
            })
          )}
          {!isQuickFilterExpanded && currentData.length > 5 && (
            <div 
              className="text-xs text-blue-600 text-center py-1 font-medium cursor-pointer hover:text-blue-700"
              onClick={() => setIsQuickFilterExpanded(true)}
            >
              +{currentData.length - 5} more items (click to expand)
            </div>
          )}
          {isQuickFilterExpanded && currentData.length > 5 && (
            <div 
              className="text-xs text-blue-600 text-center py-1 font-medium cursor-pointer hover:text-blue-700"
              onClick={() => setIsQuickFilterExpanded(false)}
            >
              Click to collapse
            </div>
          )}
        </div>
      </div>
    );
  };

  if (ordersLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading orders...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-500">
          Error: {error instanceof Error ? error.message : 'Failed to load orders'}
        </div>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">No orders found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Compact Header - White Background */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        {/* Top Row: Search and Action Buttons */}
        <div className="px-3 sm:px-4 py-2.5 flex items-center gap-2.5 bg-gray-50/50">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="block w-full pl-10 pr-10 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute inset-y-0 right-0 pr-3 flex items-center justify-center rounded-r-lg transition-colors"
                title="Clear search"
              >
                <XMarkIcon className="h-5 w-5 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Icons - One line, horizontal scroll if needed; box/icon sizes fixed; scrollbar hidden */}
        <div className="pl-16 sm:pl-5 sm:pr-4 py-2 bg-white overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center justify-center gap-1 flex-nowrap">
            {statusOptions.map(option => {
              const isActive = statusFilter === option.value;
              
              // Get background and icon color based on status and active state
              const getButtonStyles = () => {
                if (isActive) {
                  // Active state - use icon color as background, white icon
                  switch (option.value) {
                    case 'pending':
                      return { bg: 'bg-yellow-500', icon: 'text-white' };
                    case 'order-ready':
                      return { bg: 'bg-orange-500', icon: 'text-white' };
                    case 'on_hold':
                      return { bg: 'bg-amber-500', icon: 'text-white' };
                    case 'confirmed':
                      return { bg: 'bg-green-500', icon: 'text-white' };
                    case 'ready-to-ship':
                      return { bg: 'bg-blue-500', icon: 'text-white' };
                    case 'shipped':
                      return { bg: 'bg-purple-500', icon: 'text-white' };
                    case 'fulfilled':
                      return { bg: 'bg-emerald-500', icon: 'text-white' };
                    case 'cancelled':
                      return { bg: 'bg-red-500', icon: 'text-white' };
                    case 'paid':
                      return { bg: 'bg-indigo-500', icon: 'text-white' };
                    case 'all':
                      return { bg: 'bg-gray-600', icon: 'text-white' };
                    default:
                      return { bg: 'bg-gray-600', icon: 'text-white' };
                  }
                } else {
                  // Inactive state - transparent background with colored icon
                  switch (option.value) {
                    case 'pending':
                      return { bg: 'bg-transparent', icon: 'text-yellow-500' };
                    case 'order-ready':
                      return { bg: 'bg-transparent', icon: 'text-orange-500' };
                    case 'on_hold':
                      return { bg: 'bg-transparent', icon: 'text-amber-500' };
                    case 'confirmed':
                      return { bg: 'bg-transparent', icon: 'text-green-500' };
                    case 'ready-to-ship':
                      return { bg: 'bg-transparent', icon: 'text-blue-500' };
                    case 'shipped':
                      return { bg: 'bg-transparent', icon: 'text-purple-500' };
                    case 'fulfilled':
                      return { bg: 'bg-transparent', icon: 'text-emerald-500' };
                    case 'cancelled':
                      return { bg: 'bg-transparent', icon: 'text-red-500' };
                    case 'paid':
                      return { bg: 'bg-transparent', icon: 'text-indigo-500' };
                    case 'all':
                      return { bg: 'bg-transparent', icon: 'text-gray-400' };
                    default:
                      return { bg: 'bg-transparent', icon: 'text-gray-400' };
                  }
                }
              };
              
              const styles = getButtonStyles();
              
              // Map background classes to actual colors for inline styles
              const getBackgroundColor = () => {
                if (isActive) {
                  switch (option.value) {
                    case 'pending': return '#eab308'; // yellow-500
                    case 'order-ready': return '#f97316'; // orange-500
                    case 'on_hold': return '#f59e0b'; // amber-500
                    case 'confirmed': return '#22c55e'; // green-500
                    case 'ready-to-ship': return '#3b82f6'; // blue-500
                    case 'shipped': return '#a855f7'; // purple-500
                    case 'fulfilled': return '#10b981'; // emerald-500
                    case 'cancelled': return '#ef4444'; // red-500
                    case 'paid': return '#6366f1'; // indigo-500
                    case 'all': return '#4b5563'; // gray-600
                    default: return '#4b5563';
                  }
                }
                return 'transparent';
              };
              
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    setPreviousStatusFilter(statusFilter);
                    setStatusFilter(option.value);
                    setIsSearchOverridingFilter(false);
                  }}
                  className={`
                    flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg
                    focus:outline-none focus:ring-0
                  `}
                  style={{
                    backgroundColor: getBackgroundColor(),
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = getBackgroundColor();
                    e.currentTarget.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = getBackgroundColor();
                    e.currentTarget.style.opacity = '1';
                  }}
                  title={option.label}
                >
                  {getStatusIcon(option.value, styles.icon)}
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* Order Grid */}
      <div className="p-2 sm:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {/* Quick Filter Card - Shows in all views */}
          <QuickFilterCard />
          {sortedOrders?.map((order: any) => (
            <OrderCard
              key={order.id}
              order={order}
              isSelected={selectedOrders.includes(order.id)}
              onSelect={handleOrderSelect}
              onUpdateNote={handleUpdateNote}
              onTogglePriority={handleTogglePriority}
              onUpdateStatus={handleUpdateStatus}
              onDeleteOrder={handleDeleteOrder}
              onUpdateTags={handleUpdateTags}
            />
          ))}
        </div>
      </div>

      {/* Scroll to Top Button */}
      {showScrollToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-24 right-6 md:bottom-6 z-50 bg-black rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-200 hover:bg-gray-900"
          title="Scroll to top"
        >
          <ArrowUpIcon className="w-6 h-6 text-white" />
        </button>
      )}
    </div>
  );
};

export default Orders; 