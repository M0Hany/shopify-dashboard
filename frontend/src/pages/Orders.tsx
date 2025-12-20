import { useEffect, useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import OrderTimeline from '../components/OrderTimeline';
import OrderCard from '../components/OrderCard';
import { MagnifyingGlassIcon, ViewColumnsIcon, ArrowDownIcon, ArrowUpIcon, ChevronDownIcon, XMarkIcon, FunnelIcon, CheckIcon, DocumentArrowUpIcon, ArrowPathIcon, ArrowUpCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Menu, Popover, Transition } from '@headlessui/react';
import FileUpload from '../components/FileUpload';
import MoneyTransferUpload from '../components/MoneyTransferUpload';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

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
  { value: 'confirmed', label: 'Confirmed Orders' },
  { value: 'ready-to-ship', label: 'Ready to Ship' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'paid', label: 'Paid' },
  { value: 'all', label: 'All Orders' },
];

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
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle scroll to show/hide scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to top function
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    }, 300); // 300ms delay

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
        // Remove existing status tags (case-insensitive)
        const statusTags = ['order_ready', 'customer_confirmed', 'ready_to_ship', 'shipped', 'fulfilled'];
        let filtered = currentTags.filter((t: string) => {
          const trimmed = t.trim().toLowerCase();
          return !statusTags.some(st => st.trim().toLowerCase() === trimmed);
        });
        // Map frontend status to tag value (trimmed)
        let tagValue = status.trim();
        if (status.trim().toLowerCase() === 'confirmed') tagValue = 'customer_confirmed';
        else if (status.trim().toLowerCase() === 'order-ready') tagValue = 'order_ready';
        if (status.trim().toLowerCase() !== 'pending') filtered = [...filtered, tagValue.trim()];
        if (status.trim().toLowerCase() === 'fulfilled') filtered = filtered.filter((t: string) => t.trim().toLowerCase() !== 'priority');
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
      
      // Optimistically update all orders in cache
      orderIds.forEach(orderId => {
        updateOrderInCache(orderId, (o) => {
          const currentTags = Array.isArray(o.tags)
            ? o.tags
            : typeof o.tags === 'string'
              ? o.tags.split(',').map((t: string) => t.trim())
              : [];
          // Remove existing status tags (case-insensitive)
          const statusTags = ['order_ready', 'customer_confirmed', 'ready_to_ship', 'shipped', 'fulfilled'];
          let filtered = currentTags.filter((t: string) => {
            const trimmed = t.trim().toLowerCase();
            return !statusTags.some(st => st.trim().toLowerCase() === trimmed);
          });
          // Map frontend status to tag value (trimmed)
          let tagValue = status.trim();
          if (status.trim().toLowerCase() === 'confirmed') tagValue = 'customer_confirmed';
          else if (status.trim().toLowerCase() === 'order-ready') tagValue = 'order_ready';
          if (status.trim().toLowerCase() !== 'pending') filtered = [...filtered, tagValue.trim()];
          if (status.trim().toLowerCase() === 'fulfilled') filtered = filtered.filter((t: string) => t.trim().toLowerCase() !== 'priority');
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

  const handleSelectAll = () => {
    if (orders) {
      // Get only the orders that are currently visible based on the filter
      const visibleOrders = orders.filter(filterOrdersByStatus);
      
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

  const handleExport = () => {
    if (!orders || selectedOrders.length === 0) return;

    const selectedOrderData = orders.filter(order => selectedOrders.includes(order.id));
    const exportData = selectedOrderData.map(order => {
      // Format phone number: remove all non-digits and ensure leading zero
      let formattedPhone = order.customer.phone.replace(/\D/g, '');
      if (formattedPhone.startsWith('20')) {
        formattedPhone = formattedPhone.substring(2);
      }
      if (!formattedPhone.startsWith('0')) {
        formattedPhone = '0' + formattedPhone;
      }
      
      // Get the full address and city from Shopify
      const fullAddress = `${order.shipping_address.address1}${order.shipping_address.address2 ? `, ${order.shipping_address.address2}` : ''}`;
      const shopifyCity = order.shipping_address.city;

      // List of valid cities
      const validCities = [
        'Cairo', 'Giza', 'Alexandria', 'Beheira', 'Dakahlia', 'Damietta', 'Gharbia',
        'Ismailia', 'Kafr El Sheikh', 'Monufia', 'Port Said', 'Qalyubia', 'Sharqia',
        'Suez', 'North Coast', 'Asyut', 'Aswan', 'Beni Suef', 'Faiyum', 'Luxor',
        'Matruh', 'Minya', 'El Wadi el Gedid', 'North Sinai', 'Qena', 'Red Sea',
        'Sohag', 'South Sinai', 'Banha City'
      ];
      
      // Try to find a matching city from our valid cities list
      let city = '';
      
      // First try to match the Shopify city directly
      const matchingCity = validCities.find(validCity => 
        validCity.toLowerCase() === shopifyCity.toLowerCase() ||
        shopifyCity.toLowerCase().includes(validCity.toLowerCase())
      );

      if (matchingCity) {
        city = matchingCity;
      } else {
        // If no match found in the city field, try the full address
        const addressMatch = validCities.find(validCity =>
          fullAddress.toLowerCase().includes(validCity.toLowerCase())
        );
        
        if (addressMatch) {
          city = addressMatch;
        } else {
          // If still no match, use the original city from Shopify
          city = shopifyCity;
        }
      }

      // Determine neighborhood and district based on city
      const neighborhood = (city === 'Cairo' || city === 'Giza') ? '' : city;
      const district = (city === 'Cairo' || city === 'Giza') ? '' : city;
      
      return {
        'Package_Serial': order.name.replace('#', ''),
        'Description': 'crochet',
        'Total_Weight': '0.5',
        'Service': 'Next Day',
        'Service_Type': 'Door-to-Door',
        'Service_Category': 'Delivery',
        'Payment_Type': 'Cash-on-Delivery',
        'COD_Value': Math.floor(parseFloat(order.total_price)),
        'Quantity': order.line_items.reduce((total, item) => total + item.quantity, 0),
        'Weight': '0.5',
        'Customer_Name': `${order.customer.first_name} ${order.customer.last_name}`,
        'Mobile_No': formattedPhone,
        'Street': fullAddress,
        'City': city,
        'Neighborhood': neighborhood,
        'District': district,
        'Address_Category': 'Home',
        'Fulfillment': 'False'
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);

    // Set the Mobile_No column to text format to preserve leading zeros
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    const mobileNoCol = Object.keys(ws).find(key => 
      ws[key].v === 'Mobile_No'
    )?.replace(/[0-9]/g, '');

    if (mobileNoCol) {
      for (let row = range.s.r + 1; row <= range.e.r; row++) {
        const cellRef = mobileNoCol + (row + 1);
        if (!ws[cellRef]) continue;
        ws[cellRef].z = '@';  // Set cell format to Text
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Delivery Form");
    XLSX.writeFile(wb, "delivery_form.xlsx");
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
        const statusTags = ['order_ready', 'customer_confirmed', 'ready_to_ship', 'shipped', 'fulfilled'];
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
      case 'confirmed':
        // Show only orders with customer_confirmed tag (case-insensitive)
        return trimmedTags.some(tag => tag.trim().toLowerCase() === statusTags.customerConfirmed.toLowerCase());
      case 'ready-to-ship':
        return trimmedTags.some(tag => tag.trim() === statusTags.readyToShip);
      case 'shipped':
        return trimmedTags.some(tag => tag.trim() === statusTags.shipped);
      case 'fulfilled':
        // Show both fulfilled and paid orders
        return trimmedTags.some(tag => 
          tag.trim() === statusTags.fulfilled || 
          tag.trim() === statusTags.paid
        );
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
      orderReady: 'order_ready'
    };
    
    // Return priority number based on status (higher number = lower in sort)
    if (trimmedTags.some(tag => tag.trim().toLowerCase() === statusTags.cancelled.toLowerCase())) return 70;
    if (trimmedTags.some(tag => tag.trim().toLowerCase() === statusTags.paid.toLowerCase())) return 60;
    if (trimmedTags.some(tag => tag.trim().toLowerCase() === statusTags.fulfilled.toLowerCase())) return 50;
    if (trimmedTags.some(tag => tag.trim().toLowerCase() === statusTags.shipped.toLowerCase())) return 40;
    if (trimmedTags.some(tag => tag.trim().toLowerCase() === statusTags.readyToShip.toLowerCase())) return 30;
    if (trimmedTags.some(tag => tag.trim().toLowerCase() === statusTags.customerConfirmed.toLowerCase())) return 20;
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

  const handleUploadComplete = (results: {
    processed: number;
    updated: number;
    notFound: number;
    errors: number;
  }) => {
    // Refresh orders after successful upload
    queryClient.invalidateQueries({ queryKey: ['orders'] });
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

  // Helper function to calculate days left for an order
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
      if (dueDateTag) {
        const dateStr = dueDateTag.split(':')[1];
        if (dateStr) {
          const dueDate = convertToCairoTime(new Date(dateStr));
          if (!isNaN(dueDate.getTime())) {
            const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return daysLeft;
          }
        }
      }
      
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
              // Last resort: use current date
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
      const dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + daysToAdd);
      const finalDueDate = convertToCairoTime(dueDate);
      
      // Validate final due date
      if (isNaN(finalDueDate.getTime())) {
        return 7; // Return default days left
      }
      
      // Calculate days left
      const daysLeft = Math.ceil((finalDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      return daysLeft;
    } catch (error) {
      // Return a default value to prevent sorting errors
      return 7;
    }
  };

  // First, decorate orders with their original index
  const sortedOrders = (orders || [])?.map((order: Order, idx: number) => ({
    ...order,
    originalIndex: idx
  }))
  // Then filter
  .filter((order: Order & { originalIndex: number }) => {
    const query = debouncedSearchQuery.toLowerCase();
    const nameStr = (order.name || '').toLowerCase();
    const customerNameStr = `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.toLowerCase();
    const phoneStr = (order.customer?.phone || '').toLowerCase();

    const matchesSearch = query === '' ||
      nameStr.includes(query) ||
      customerNameStr.includes(query) ||
      phoneStr.includes(query);
    
    const matchesStatus = filterOrdersByStatus(order);
    
    // Filter by selected summary items if any are selected
    const matchesSummaryItems = selectedSummaryItems.size === 0 || 
      Array.from(selectedSummaryItems).some(itemTitle => orderContainsItem(order, itemTitle));
    
    return matchesSearch && matchesStatus && matchesSummaryItems;
  })
  // Finally sort with stable tiebreaker
  .sort((a: Order & { originalIndex: number }, b: Order & { originalIndex: number }) => {
    // Get status priority for sorting
    const aStatusPriority = getStatusPriority(a);
    const bStatusPriority = getStatusPriority(b);

    // First sort by status priority
    if (aStatusPriority !== bStatusPriority) {
      return aStatusPriority - bStatusPriority;
    }

    // If both orders are shipped, sort by shipping date
    const aTags = Array.isArray(a.tags) ? a.tags : typeof a.tags === 'string' ? a.tags.split(',').map(t => t.trim()) : [];
    const bTags = Array.isArray(b.tags) ? b.tags : typeof b.tags === 'string' ? b.tags.split(',').map(t => t.trim()) : [];
    
    if (aTags.includes('shipped') && bTags.includes('shipped')) {
      const aShippingDate = getShippingDate(a);
      const bShippingDate = getShippingDate(b);
      
      // If both have shipping dates, sort by date (oldest first)
      if (aShippingDate && bShippingDate) {
        return aShippingDate.getTime() - bShippingDate.getTime();
      }
      // If only one has shipping date, put it first
      if (aShippingDate) return -1;
      if (bShippingDate) return 1;
    }

    // For pending orders, sort by days left first (ascending - fewest days first)
    const isPendingA = aStatusPriority === 10; // pending orders have priority 10
    const isPendingB = bStatusPriority === 10;
    
    if (isPendingA && isPendingB) {
      const aDaysLeft = calculateDaysLeft(a);
      const bDaysLeft = calculateDaysLeft(b);
      if (aDaysLeft !== bDaysLeft) {
        return aDaysLeft - bDaysLeft; // Ascending: fewest days first
      }
    }

    // Then sort by priority tag
    const aPriority = aTags.includes('priority');
    const bPriority = bTags.includes('priority');
    if (aPriority && !bPriority) return -1;
    if (!aPriority && bPriority) return 1;

    // For non-pending orders, sort by days left
    if (!isPendingA || !isPendingB) {
      const aDaysLeft = calculateDaysLeft(a);
      const bDaysLeft = calculateDaysLeft(b);
      if (aDaysLeft !== bDaysLeft) {
        return aDaysLeft - bDaysLeft;
      }
    }

    // Sort by order ID in ascending order
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

  // Helper function to check if an order has complete address tags
  const hasCompleteAddressTags = (order: any) => {
    const tags = Array.isArray(order.tags) ? order.tags.map((t: string) => t.trim()) : 
                typeof order.tags === 'string' ? order.tags.split(',').map((t: string) => t.trim()) :
                [];
    
    // Helper function to get tag value
    const getTagValue = (prefix: string): string | null => {
      const tag = tags.find((tag: string) => tag.startsWith(prefix));
      const value = tag ? tag.split(':')[1].trim() : null;
      return value === "null" ? null : value;
    };

    const cityId = getTagValue('mylerz_city_id');
    const neighborhoodId = getTagValue('mylerz_neighborhood_id');
    const subZoneId = getTagValue('mylerz_subzone_id');

    return cityId && neighborhoodId && subZoneId &&
           cityId !== "null" && neighborhoodId !== "null" && subZoneId !== "null";
  };

  // Check if all selected orders have complete address tags
  // Helper: detect instapay order and whether it is marked paid
  const isInstapayOrder = (order: any) => {
    const gateways = Array.isArray(order?.payment_gateway_names) ? order.payment_gateway_names : [];
    const gatewayStr = gateways.join(' ').toLowerCase();
    const mentionsInsta = gatewayStr.includes('instapay') || gatewayStr.includes('pay via instapay');
    const tags = Array.isArray(order?.tags) ? order.tags : typeof order?.tags === 'string' ? order.tags.split(',').map((t: string) => t.trim()) : [];
    return mentionsInsta || tags.includes('instapay') || tags.includes('instapay_paid');
  };

  const isInstapayPaid = (order: any) => {
    const tags = Array.isArray(order?.tags) ? order.tags : typeof order?.tags === 'string' ? order.tags.split(',').map((t: string) => t.trim()) : [];
    return tags.includes('instapay_paid');
  };

  const allSelectedOrdersAreShippable = selectedOrders.length > 0 &&
    selectedOrders.every(orderId => {
      const order = orders?.find(o => o.id === orderId);
      if (!order) return false;
      const addressOk = hasCompleteAddressTags(order);
      if (!addressOk) return false;
      if (isInstapayOrder(order) && !isInstapayPaid(order)) return false;
      return true;
    });

  const createShipmentsMutation = useMutation({
    mutationFn: async (orderIds: number[]) => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/shipping/create-shipments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderIds }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create shipments');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast.success(`Successfully created ${data.successful} shipments`);
      if (data.failed > 0) {
        toast.error(`Failed to create ${data.failed} shipments`);
      }
      scheduleBackgroundOrdersRefresh();
      setSelectedOrders([]);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create shipments');
      console.error('Error creating shipments:', error);
    }
  });

  const handleCreateShipments = async () => {
    if (!selectedOrders.length) {
      toast.error('Please select at least one order');
      return;
    }

    // Validate that all selected orders have the required location tags
    const ordersWithMissingTags = orders?.filter(order => {
      if (!selectedOrders.includes(order.id)) return false;

      const tags = Array.isArray(order.tags) ? order.tags :
                  typeof order.tags === 'string' ? order.tags.split(',').map(t => t.trim()) :
                  [];

      const hasAllLocationTags = tags.some(tag => tag.startsWith('mylerz_city_id:')) &&
                                tags.some(tag => tag.startsWith('mylerz_neighborhood_id:')) &&
                                tags.some(tag => tag.startsWith('mylerz_subzone_id:'));

      return !hasAllLocationTags;
    });

    if (ordersWithMissingTags && ordersWithMissingTags.length > 0) {
      toast.error('Some orders are missing location tags. Please add address tags first.');
      return;
    }

    // Block InstaPay orders that are not marked paid
    const unpaidInstaPayOrders = orders?.filter(order => {
      if (!selectedOrders.includes(order.id)) return false;
      return isInstapayOrder(order) && !isInstapayPaid(order);
    });
    if (unpaidInstaPayOrders && unpaidInstaPayOrders.length > 0) {
      toast.error('Some InstaPay orders are not marked as paid. Please set InstaPay to Paid first.');
      return;
    }

    try {
      await createShipmentsMutation.mutateAsync(selectedOrders);
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

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

  const handleSendEmail = () => {
    if (!selectedOrders.length || !orders) return;

    const selectedOrdersData = orders.filter(order => selectedOrders.includes(order.id));
    const shippedOrders = selectedOrdersData.filter(order => {
      const tags = Array.isArray(order.tags) ? order.tags : 
                  typeof order.tags === 'string' ? order.tags.split(',').map(t => t.trim()) :
                  [];
      return tags.includes('shipped');
    });
    
    const barcodes = shippedOrders
      .map(order => {
        const tags = Array.isArray(order.tags) ? order.tags : 
                    typeof order.tags === 'string' ? order.tags.split(',').map(t => t.trim()) :
                    [];
        const barcodeTag = tags.find(tag => tag.startsWith('shipping_barcode:'));
        return barcodeTag ? barcodeTag.split(':')[1].trim() : null;
      })
      .filter((barcode): barcode is string => barcode !== null);

    if (barcodes.length === 0) {
      toast.error('No shipping barcodes found in selected orders');
      return;
    }

    const emailBody = `Dear Mylerz,

The following orders are late and still undelivered. Please check and update us with the current status:

Order Barcodes:

${barcodes.join('\n')}

___`;

    const mailtoLink = `mailto:support@mylerz.com?subject=Late Orders Status Request&body=${encodeURIComponent(emailBody)}`;
    window.open(mailtoLink, '_blank');
  };

  // Function to check if all selected orders are shipped
  const areAllSelectedOrdersShipped = () => {
    if (!selectedOrders.length || !orders) return false;
    
    const selectedOrdersData = orders.filter(order => selectedOrders.includes(order.id));
    return selectedOrdersData.every(order => {
      const tags = Array.isArray(order.tags) ? order.tags : 
                  typeof order.tags === 'string' ? order.tags.split(',').map(t => t.trim()) :
                  [];
      return tags.includes('shipped');
    });
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
    }
  }, [selectedOrders]);

  // Production Summary Card Component
  const ProductionSummaryCard = () => {
    // If orders are selected, show summary for selected orders only
    const ordersToSummarize = selectedOrders.length > 0 
      ? orders?.filter(order => selectedOrders.includes(order.id)) || []
      : undefined;
    
    const summary = calculatePendingItemsSummary(ordersToSummarize);
    
    if (summary.totalOrders === 0) return null;

    const displayedItems = isSummaryExpanded ? summary.items : summary.items.slice(0, 5);

    return (
      <div 
        className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 text-sm font-semibold">📊</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Production Summary</h3>
              <p className="text-sm text-gray-600">
                {selectedOrders.length > 0 
                  ? `${selectedOrders.length} selected order${selectedOrders.length > 1 ? 's' : ''}`
                  : `${summary.totalOrders} pending orders`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
              className="text-xs text-blue-600 font-medium bg-white px-2 py-1 rounded hover:bg-gray-50"
              title={isSummaryExpanded ? "Click to collapse" : "Click to see all items"}
            >
              {isSummaryExpanded ? 'Collapse' : 'Expand'}
            </button>
            {selectedSummaryItems.size > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSummaryItems(new Set());
                }}
                className="text-xs text-gray-600 font-medium bg-white px-2 py-1 rounded hover:bg-gray-50"
                title="Clear filter"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>

        {/* Items List */}
        <div className="space-y-2">
          {displayedItems.map((item, index) => {
            const isSelected = selectedSummaryItems.has(item.title);
            return (
              <div 
                key={index} 
                onClick={(e) => handleSummaryItemClick(item.title, e)}
                className={`flex justify-between items-center py-1 px-2 rounded border cursor-pointer transition-colors ${
                  isSelected 
                    ? 'bg-blue-200 border-blue-400 shadow-sm' 
                    : 'bg-white border-blue-100 hover:bg-blue-50'
                }`}
                title={isSelected ? "Click to deselect" : "Click to filter by this item"}
              >
                <span className={`text-sm truncate flex-1 ${isSelected ? 'font-semibold text-blue-900' : 'text-gray-700'}`}>
                  {item.title}
                </span>
                <span className={`text-sm font-semibold ml-2 ${isSelected ? 'text-blue-900' : 'text-blue-600'}`}>
                  {item.quantity}
                </span>
            </div>
            );
          })}
          {!isSummaryExpanded && summary.items.length > 5 && (
            <div 
              className="text-xs text-blue-600 text-center py-1 font-medium cursor-pointer hover:text-blue-700"
              onClick={() => setIsSummaryExpanded(true)}
            >
              +{summary.items.length - 5} more items (click to expand)
            </div>
          )}
          {isSummaryExpanded && summary.items.length > 5 && (
            <div 
              className="text-xs text-blue-600 text-center py-1 font-medium cursor-pointer hover:text-blue-700"
              onClick={() => setIsSummaryExpanded(false)}
            >
              Click to collapse
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-3 pt-2 border-t border-blue-200">
          <div className="text-xs text-gray-600 text-center">
            {selectedOrders.length > 0 
              ? 'Items in selected orders'
              : 'Items to be produced from pending orders'}
          </div>
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
      {/* Top Bar */}
      <div className="bg-white border-b px-2 sm:px-4 py-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        {/* Search */}
        <div className="relative w-full sm:w-[400px]">
          <input
            type="text"
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="block w-full pl-10 pr-10 py-2 text-gray-900 bg-white border border-gray-300 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute inset-y-[1px] right-[1px] px-3 flex items-center justify-center bg-white rounded-r-md hover:bg-gray-50 focus:outline-none focus:ring-0"
            >
              <XMarkIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
      </div>
      
      {/* Main Header */}
      <div className="bg-white border-b px-4 sm:px-8 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {/* Left side - Title and Description */}
          <div>
            <h1 className="text-2xl sm:text-[28px] font-semibold text-gray-900 leading-tight">Orders</h1>
            <p className="text-sm sm:text-base text-gray-500">Manage and track your customer orders</p>
          </div>

          {/* Right side - Filter, Sort, and Select All */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto">
            {/* Filter Dropdown */}
            <Popover className="relative">
              {({ open, close }) => (
                <>
                  <Popover.Button
                    className={`p-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 ${open ? 'ring-2 ring-blue-500' : ''}`}
                    title="Filter orders"
                  >
                    <FunnelIcon className="w-5 h-5 text-gray-600" />
                  </Popover.Button>
                  <Transition
                    show={open}
                    enter="transition duration-100 ease-out"
                    enterFrom="transform scale-95 opacity-0"
                    enterTo="transform scale-100 opacity-100"
                    leave="transition duration-75 ease-in"
                    leaveFrom="transform scale-100 opacity-100"
                    leaveTo="transform scale-95 opacity-0"
                  >
                    <Popover.Panel className="absolute z-10 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg">
                      <div className="py-1">
                        {statusOptions.map(option => (
                          <button
                            key={option.value}
                            onClick={() => {
                              setPreviousStatusFilter(statusFilter);
                              setStatusFilter(option.value);
                              setIsSearchOverridingFilter(false);
                              close();
                            }}
                            className={`w-full text-left px-4 py-2 text-sm bg-white ${statusFilter === option.value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'} hover:bg-gray-100`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </Popover.Panel>
                  </Transition>
                </>
              )}
            </Popover>

            {/* Upload Button */}
            <MoneyTransferUpload onUploadComplete={handleUploadComplete} />

            {/* Select All Button */}
            <button
              onClick={handleSelectAll}
              className={`p-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 relative ${orders && selectedOrders.length === orders.filter(filterOrdersByStatus).length ? 'bg-blue-50 border-blue-400' : ''}`}
              title="Select all orders"
            >
              <CheckIcon className={`w-5 h-5 ${orders && selectedOrders.length === orders.filter(filterOrdersByStatus).length ? 'text-blue-600' : 'text-gray-600'}`} />
              {selectedOrders.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5">{selectedOrders.length}</span>
              )}
            </button>

            {/* Refresh Button */}
            <button
              onClick={handleManualRefreshWithLoading}
              disabled={ordersLoading || isRefreshing}
              className="p-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh orders"
            >
              <ArrowPathIcon className={`w-5 h-5 text-gray-600 ${ordersLoading || isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Export Button and Bulk Actions - Only show when orders are selected */}
        {selectedOrders.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Extract Delivery Form ({selectedOrders.length})
            </button>

            {areAllSelectedOrdersShipped() ? (
              // Show email button for shipped orders
              <button
                onClick={handleSendEmail}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                Send Status Request Email
              </button>
            ) : (
              // Show Add Shipments button for non-shipped orders
            <button
              onClick={handleCreateShipments}
              disabled={createShipmentsMutation.isPending || !allSelectedOrdersAreShippable}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-purple-400 disabled:cursor-not-allowed"
            >
              {createShipmentsMutation.isPending ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating Shipments...
                </>
              ) : (
                'Add Shipments'
              )}
            </button>
            )}

            <Menu as="div" className="relative inline-block text-left">
              {({ open }) => (
                <>
                  <div>
                    <Menu.Button 
                      className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Bulk Status Update
                      <ChevronDownIcon className="w-4 h-4 ml-1" />
                    </Menu.Button>
                  </div>
                  {open && (
                    <Menu.Items
                      static
                      className="absolute right-0 mt-1 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                    >
                      <div className="py-1">
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              className={`${
                                active ? 'bg-gray-100' : ''
                              } block w-full text-left px-4 py-2 text-sm text-white bg-orange-500 hover:bg-orange-600`}
                              onClick={() => handleBulkStatusUpdate('order-ready')}
                            >
                              Mark Order Ready
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              className={`${
                                active ? 'bg-gray-100' : ''
                              } block w-full text-left px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700`}
                              onClick={() => handleBulkStatusUpdate('confirmed')}
                            >
                              Mark Confirmed
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              className={`${
                                active ? 'bg-gray-100' : ''
                              } block w-full text-left px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 font-medium`}
                              onClick={() => handleBulkStatusUpdate('ready_to_ship')}
                            >
                              Mark Ready to Ship
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              className={`${
                                active ? 'bg-gray-100' : ''
                              } block w-full text-left px-4 py-2 text-sm text-white bg-purple-600 hover:bg-purple-700`}
                              onClick={() => handleBulkStatusUpdate('shipped')}
                            >
                              Mark Shipped
                            </button>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              className={`${
                                active ? 'bg-gray-100' : ''
                              } block w-full text-left px-4 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700`}
                              onClick={() => handleBulkStatusUpdate('fulfilled')}
                            >
                              Mark Fulfilled
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
        )}
      </div>

      {/* Order Grid */}
      <div className="p-2 sm:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {/* Production Summary Card - Only show for pending orders */}
          {statusFilter === 'pending' && <ProductionSummaryCard />}
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
          className="fixed bottom-6 right-6 z-50 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-200 border border-gray-200"
          title="Scroll to top"
        >
          <ArrowUpIcon className="w-6 h-6 text-gray-700" />
        </button>
      )}
    </div>
  );
};

export default Orders; 