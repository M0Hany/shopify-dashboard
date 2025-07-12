import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import OrderTimeline from '../components/OrderTimeline';
import OrderCard from '../components/OrderCard';
import { MagnifyingGlassIcon, ViewColumnsIcon, ArrowDownIcon, ArrowUpIcon, ChevronDownIcon, XMarkIcon, FunnelIcon, ArrowsUpDownIcon, CheckIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Menu, Popover, Transition } from '@headlessui/react';
import FileUpload from '../components/FileUpload';
import MoneyTransferUpload from '../components/MoneyTransferUpload';
import { getPackagesList, addBulkAddressTags } from '../services/shipping';
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
  line_items: {
    title: string;
    quantity: number;
    price: string;
    variant_title: string | null;
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
  { value: 'confirmed', label: 'Confirmed Orders' },
  { value: 'ready-to-ship', label: 'Ready to Ship' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'paid', label: 'Paid' },
  { value: 'all', label: 'All Orders' },
];

interface ShippingStatusResponse {
  tabOneOrders: any[];
  tabTwoOrders: any[];
  tabThreeOrders: any[];
}

interface OrderShippingStatus {
  packageENStatus: string;
  lastUpdated: string;
  Barcode: string;
}

interface OrderShippingStatuses {
  [orderId: string]: OrderShippingStatus[];
}

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

const fetchAllShippingStatuses = async (fromDate: Date): Promise<ShippingStatusResponse> => {
  const toDate = new Date();
  
  // Format dates for API
  const from = fromDate.toISOString().split('T')[0] + 'T20:00:00.000Z';
  const to = toDate.toISOString().split('T')[0] + 'T20:59:59.000Z';

  // Base payload
  const basePayload = {
    FilterModel: {
      PageFilter: {
        PageIndex: 1,
        PageSize: 100
      },
      SearchKeyword: ""
    },
    From: from,
    To: to,
    MerchantIds: [16677],
    WarehouseIds: [],
    SubscriberIds: [],
    HubId: [],
    HubTypeId: 0,
    PhaseId: [],
    MylerIds: [],
    TransferBy: [],
    ServiceTypeId: [],
    ServiceCategoryId: [],
    PaymentTypeId: [],
    StatusId: [],
    PackageServiceId: [],
    AttemptsNumber: null,
    MemberId: 22376,
    Barcodes: [],
    PreferedTimeSlot: 0,
    AvailableTimeslotId: 0,
    DateTypeId: 3,
    SearchOptionId: 1,
    MemberCategoryID: 2
  };

  // Fetch from all tabs concurrently
  const [tabOne, tabTwo, tabThree] = await Promise.all([
    getPackagesList({ ...basePayload, SelectedTab: 1 }),
    getPackagesList({ ...basePayload, SelectedTab: 2 }),
    getPackagesList({ ...basePayload, SelectedTab: 3 })
  ]);

  return {
    tabOneOrders: tabOne.Value.Result,
    tabTwoOrders: tabTwo.Value.Result,
    tabThreeOrders: tabThree.Value.Result
  };
};

interface AuthContextType {
  token: string | null;
  // ... other auth context properties ...
}

const Orders = () => {
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [sortAscending, setSortAscending] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [shippingStatuses, setShippingStatuses] = useState<OrderShippingStatuses>({});
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const { data: orders, isLoading: ordersLoading, error, refetch } = useQuery<Order[]>({
    queryKey: ['orders'],
    queryFn: async (): Promise<Order[]> => {
      // First fetch orders
      const ordersResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/orders`);
      if (!ordersResponse.ok) {
        throw new Error('Failed to fetch orders');
      }
      const ordersData = await ordersResponse.json();

      // Find oldest shipped order date
      const oldestDate = findOldestShippedOrderDate(ordersData);

      try {
        // Fetch shipping statuses
        const shippingData = await fetchAllShippingStatuses(oldestDate);
        
        // Match orders with shipping statuses
        const matchedStatuses = matchOrdersWithShippingStatuses(ordersData, shippingData);
        
        // Update shipping statuses state
        setShippingStatuses(matchedStatuses);
      } catch (error) {
        console.error('Failed to fetch shipping statuses:', error);
      }

      return ordersData;
    },
  });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error) => {
      console.error('Error updating due date:', error);
    }
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error) => {
      console.error('Error updating start date:', error);
    }
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: string }) => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error('Failed to update order status');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error) => {
      console.error('Error updating order status:', error);
    }
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
    onSuccess: () => {
      console.log('Order fulfilled successfully');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error: any) => {
      console.error('Error fulfilling order:', {
        message: error.message,
        error
      });
    }
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error) => {
      console.error('Error deleting order:', error);
    }
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
    
    // Update each selected order's status
    selectedOrders.forEach(orderId => {
      updateStatusMutation.mutate({ orderId, status });
    });
    
    // Clear selection after update
    setSelectedOrders([]);
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
        
      // Remove existing status tags
        const statusTags = ['customer_confirmed', 'ready to ship', 'shipped', 'fulfilled'];
      const filteredTags = tags.filter((t: string) => !statusTags.includes(t));
        
        // Map frontend status values to actual tag values
        let tagValue = status;
        if (status === 'confirmed') {
          tagValue = 'customer_confirmed';
        }
        
        // Add the new status tag if it's not "pending"
        if (status !== 'pending') {
        filteredTags.push(tagValue);
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

    // Define status tags with proper trimming
    const statusTags = {
      shipped: 'shipped',
      readyToShip: 'ready to ship',
      fulfilled: 'fulfilled',
      cancelled: 'cancelled',
      customerConfirmed: 'customer_confirmed',
      paid: 'paid'
    };
    
    switch(statusFilter) {
      case 'pending':
        // Show only pending orders (no status tags)
        // Exclude orders with any status tag including customer_confirmed
        return !trimmedTags.some(tag => [
          statusTags.shipped,
          statusTags.readyToShip,
          statusTags.fulfilled,
          statusTags.cancelled,
          statusTags.paid,
          statusTags.customerConfirmed
        ].includes(tag.trim()));
      case 'confirmed':
        // Show only orders with customer_confirmed tag
        return trimmedTags.some(tag => tag.trim() === statusTags.customerConfirmed);
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
    
    // Define status tags with proper trimming
    const statusTags = {
      cancelled: 'cancelled',
      paid: 'paid',
      fulfilled: 'fulfilled',
      shipped: 'shipped',
      readyToShip: 'ready to ship',
      customerConfirmed: 'customer_confirmed'
    };
    
    // Return priority number based on status (higher number = lower in sort)
    if (trimmedTags.some(tag => tag.trim() === statusTags.cancelled)) return 70;
    if (trimmedTags.some(tag => tag.trim() === statusTags.paid)) return 60;
    if (trimmedTags.some(tag => tag.trim() === statusTags.fulfilled)) return 50;
    if (trimmedTags.some(tag => tag.trim() === statusTags.shipped)) return 40;
    if (trimmedTags.some(tag => tag.trim() === statusTags.readyToShip)) return 30;
    if (trimmedTags.some(tag => tag.trim() === statusTags.customerConfirmed)) return 20;
    return 10; // pending orders should be first
  };

  // Toggle sort order
  const handleToggleSort = () => {
    setSortAscending(!sortAscending);
  };

  // Update search query handler
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  // Clear search handler
  const handleClearSearch = () => {
    handleSearchChange('');
  };

  const handleUploadComplete = (results: {
    processed: number;
    updated: number;
    notFound: number;
    errors: number;
  }) => {
    // Refresh orders after successful upload
    refetch();
  };

  // Move matchOrdersWithShippingStatuses inside component
  const matchOrdersWithShippingStatuses = (
    orders: Order[], 
    shippingData: ShippingStatusResponse
  ): OrderShippingStatuses => {
    const allShippingOrders = [
      ...shippingData.tabOneOrders,
      ...shippingData.tabTwoOrders,
      ...shippingData.tabThreeOrders
    ];

    const orderStatuses: OrderShippingStatuses = {};

    orders.forEach(order => {
      // Get shipping barcode from order tags
      const tags = Array.isArray(order.tags) ? 
        order.tags : 
        typeof order.tags === 'string' ? 
          order.tags.split(',').map(t => t.trim()) : 
          [];
      
      const barcodeTag = tags.find(tag => tag.startsWith('shipping_barcode:'));
      if (!barcodeTag) {
        return; // Skip orders without shipping barcode
      }

      const orderBarcode = barcodeTag.split(':')[1]?.trim();
      if (!orderBarcode) {
        return; // Skip if barcode is empty
      }

      // Find matching shipping status by barcode
      const matchingStatuses = allShippingOrders.filter(shipping => 
        shipping.Barcode?.trim() === orderBarcode.trim()
      );

      if (matchingStatuses.length > 0) {
        orderStatuses[order.id] = matchingStatuses.map(status => ({
          packageENStatus: status.PackageENStatus,
          lastUpdated: status.LastUpdate || status.CreatedDate,
          Barcode: status.Barcode
        }));

        // Check if any matching status is "Delivered" or "Confirm Delivered" and order is currently shipped
        const deliveryStatuses = ["Delivered", "Confirm Delivered"];
        const hasDeliveredStatus = matchingStatuses.some(status => 
          deliveryStatuses.includes(status.PackageENStatus)
        );

        if (hasDeliveredStatus && tags.includes('shipped') && !tags.includes('fulfilled')) {
          const today = format(new Date(), 'yyyy-MM-dd');
          updateStatusMutation.mutate({ 
            orderId: order.id, 
            status: `fulfilled,fulfillment_date:${today}` 
          });
        }
      }
    });

    return orderStatuses;
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

  // First, decorate orders with their original index
  const sortedOrders = (orders || [])?.map((order: Order, idx: number) => ({
    ...order,
    originalIndex: idx
  }))
  // Then filter
  .filter((order: Order & { originalIndex: number }) => {
    const matchesSearch = searchQuery === '' || 
      order.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${order.customer?.first_name} ${order.customer?.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer?.phone.includes(searchQuery);
    
    const matchesStatus = filterOrdersByStatus(order);
    
    return matchesSearch && matchesStatus;
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

    // Then sort by priority tag
    const aPriority = aTags.includes('priority');
    const bPriority = bTags.includes('priority');
    if (aPriority && !bPriority) return -1;
    if (!aPriority && bPriority) return 1;

    // Both are same priority status, now sort by days left
    const now = convertToCairoTime(new Date());
    const aDueDate = a.custom_due_date 
      ? convertToCairoTime(new Date(a.custom_due_date))
      : new Date(convertToCairoTime(new Date(a.effective_created_at)).getTime() + 14 * 24 * 60 * 60 * 1000);
    const bDueDate = b.custom_due_date 
      ? convertToCairoTime(new Date(b.custom_due_date))
      : new Date(convertToCairoTime(new Date(b.effective_created_at)).getTime() + 14 * 24 * 60 * 60 * 1000);
    const aDaysLeft = Math.ceil((aDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const bDaysLeft = Math.ceil((bDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (aDaysLeft !== bDaysLeft) {
      return aDaysLeft - bDaysLeft;
    }

    // If ascending sort is enabled, sort by order ID in ascending order
    if (sortAscending) {
      return a.id - b.id;
    }

    // If days left are equal and not ascending sort, sort by order ID in descending order
    if (a.id !== b.id) {
      return b.id - a.id;
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
  const allSelectedOrdersHaveCompleteTags = selectedOrders.length > 0 && 
    selectedOrders.every(orderId => {
      const order = orders?.find(o => o.id === orderId);
      return order && hasCompleteAddressTags(order);
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
      queryClient.invalidateQueries({ queryKey: ['orders'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error) => {
      console.error('Error updating tags:', error);
    }
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
                              setStatusFilter(option.value);
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

            {/* Sort Button (icon only) */}
            <button
              onClick={handleToggleSort}
              className="p-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Sort by ID"
            >
              <ArrowsUpDownIcon className="w-5 h-5 text-gray-600" />
            </button>

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
              disabled={createShipmentsMutation.isPending || !allSelectedOrdersHaveCompleteTags}
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
                              onClick={() => handleBulkStatusUpdate('ready to ship')}
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
                              onClick={() => handleBulkStatusUpdate('fulfill')}
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
              shippingStatuses={shippingStatuses[order.id]}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Orders; 