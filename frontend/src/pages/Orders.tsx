import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import OrderTimeline from '../components/OrderTimeline';
import OrderCard from '../components/OrderCard';
import OrderDetails from '../components/OrderDetails';
import { MagnifyingGlassIcon, ViewColumnsIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

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

const Orders = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [ordersState, setOrdersState] = useState<Order[] | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const { data: orders, isLoading, error } = useQuery<Order[]>({
    queryKey: ['orders'],
    queryFn: async (): Promise<Order[]> => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/orders`);
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      const data = await response.json();
      return data.map((order: Order) => {
        // Convert tags to array if it's a string
        const tags = typeof order.tags === 'string' 
          ? order.tags.split(',') 
          : Array.isArray(order.tags) 
            ? order.tags 
            : [];

        // Extract custom due date from tags
        const customDueDateTag = tags.find((tag: string) => tag.startsWith('custom_due_date:'));
        const customDueDate = customDueDateTag ? customDueDateTag.split(':')[1] : undefined;

        // Extract custom create date from tags
        const customCreateDateTag = tags.find((tag: string) => tag.startsWith('custom_create_date:'));
        const customCreateDate = customCreateDateTag ? customCreateDateTag.split(':')[1] : undefined;
        
        // Extract custom start date from tags
        const customStartDateTag = tags.find((tag: string) => tag.startsWith('custom_start_date:'));
        const customStartDate = customStartDateTag ? customStartDateTag.split(':')[1] : undefined;
        
        return {
          ...order,
          tags,
          custom_due_date: customDueDate,
          custom_create_date: customCreateDate,
          custom_start_date: customStartDate,
          effective_created_at: customStartDate || customCreateDate || order.created_at
        };
      })
      // Pin priority orders at the top
      .sort((a: Order, b: Order) => {
        const aPriority = (Array.isArray(a.tags) ? a.tags : typeof a.tags === 'string' ? a.tags.split(',') : [])
          .map((t: string) => t.trim())
          .includes('priority');
        const bPriority = (Array.isArray(b.tags) ? b.tags : typeof b.tags === 'string' ? b.tags.split(',') : [])
          .map((t: string) => t.trim())
          .includes('priority');
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
        // If days left are equal, sort by order ID
        return a.id - b.id;
      });
    },
  });

  // Sync local ordersState with fetched orders
  useEffect(() => {
    if (orders) setOrdersState(orders);
  }, [orders]);

  const updateDueDateMutation = useMutation({
    mutationFn: async ({ orderId, dueDate }: { orderId: number; dueDate: string }) => {
      console.log('Updating due date:', { orderId, dueDate });
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
      console.log('Updating start date:', { orderId, startDate });
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
        throw new Error('Failed to fulfill order');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error) => {
      console.error('Error fulfilling order:', error);
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
      if (selectedOrders.length === orders.length) {
        setSelectedOrders([]);
      } else {
        setSelectedOrders(orders.map(order => order.id));
      }
    }
  };

  const handleExport = () => {
    if (!orders || selectedOrders.length === 0) return;

    const selectedOrderData = orders.filter(order => selectedOrders.includes(order.id));
    const exportData = selectedOrderData.map(order => {
      // Format phone number: remove all non-digits, ensure it starts with 01
      let formattedPhone = order.customer.phone.replace(/\D/g, '');
      if (formattedPhone.startsWith('20')) {
        formattedPhone = formattedPhone.substring(2);
      }
      if (!formattedPhone.startsWith('01')) {
        formattedPhone = '01' + formattedPhone;
      }
      
      // Format COD: convert to integer (remove decimal point and everything after it)
      const formattedCOD = Math.floor(parseFloat(order.total_price));
      
      // Get Arabic province name
      const arabicProvince = provinceMapping[order.shipping_address.province] || order.shipping_address.province;
      
      // Find the best matching city
      const fullAddress = `${order.shipping_address.address1}${order.shipping_address.address2 ? `, ${order.shipping_address.address2}` : ''}`;
      const matchedCity = findBestMatchingCity(fullAddress, order.shipping_address.province);
      
      return {
        'Consignee Name': `${order.customer.first_name} ${order.customer.last_name}`,
        'Address': `${order.shipping_address.address1}${order.shipping_address.address2 ? `, ${order.shipping_address.address2}` : ''}, ${order.shipping_address.city}, ${order.shipping_address.province} ${order.shipping_address.zip}, ${order.shipping_address.country}`,
        'City': matchedCity || order.shipping_address.city,
        'Phone_1': formattedPhone,
        'COD': formattedCOD
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Delivery Form");
    XLSX.writeFile(wb, "delivery_form.xlsx");
  };

  const handleOrderClick = (order: any) => {
    setSelectedOrder(order);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedOrder(null);
  };

  const handleUpdateNote = (orderId: number, note: string) => {
    updateNoteMutation.mutate({ orderId, note });
  };

  const handleTogglePriority = (orderId: number, isPriority: boolean) => {
    setOrdersState((prev: Order[] | null) => {
      if (!prev) return prev;
      // Update the tags for the specific order
      const updatedOrders = prev.map((order: Order) => {
        if (order.id !== orderId) return order;
        let tags = Array.isArray(order.tags) ? order.tags : typeof order.tags === 'string' ? order.tags.split(',') : [];
        tags = tags.map((t: string) => t.trim());
        if (isPriority && !tags.includes('priority')) {
          tags = [...tags, 'priority'];
        } else if (!isPriority && tags.includes('priority')) {
          tags = tags.filter((t: string) => t.trim() !== 'priority');
        }
        return { ...order, tags };
      });
      
      // Sort the updated orders with priority orders at top
      return updatedOrders.sort((a: Order, b: Order) => {
        const aPriority = (Array.isArray(a.tags) ? a.tags : typeof a.tags === 'string' ? a.tags.split(',') : [])
          .map((t: string) => t.trim())
          .includes('priority');
        const bPriority = (Array.isArray(b.tags) ? b.tags : typeof b.tags === 'string' ? b.tags.split(',') : [])
          .map((t: string) => t.trim())
          .includes('priority');
        
        // Sort by priority first
        if (aPriority && !bPriority) return -1;
        if (!bPriority && aPriority) return 1;
        
        // If both have same priority status, maintain existing order
        return 0;
      });
    });
    // Send the update to the server in the background
    updatePriorityMutation.mutate({ orderId, isPriority });
  };

  const handleUpdateStatus = (orderId: number, status: string) => {
    // Special case for fulfilling an order
    if (status === 'fulfill') {
      fulfillOrderMutation.mutate(orderId);
      return;
    }
    
    setOrdersState((prev: Order[] | null) => {
      if (!prev) return prev;
      // Update the tags for the specific order
      const updatedOrders = prev.map((order: Order) => {
        if (order.id !== orderId) return order;
        
        let tags = Array.isArray(order.tags) ? [...order.tags] : 
                  typeof order.tags === 'string' ? order.tags.split(',').map(t => t.trim()) : [];
        
        // Ensure all tags are trimmed for consistent comparison
        tags = tags.map((tag: string) => tag.trim());
        
        // Remove existing status tags - with proper trimming for comparison
        const statusTags = ['customer_confirmed', 'ready to ship', 'shipped'];
        tags = tags.filter(tag => !statusTags.includes(tag.trim()));
        
        // Map frontend status values to actual tag values
        let tagValue = status;
        if (status === 'confirmed') {
          tagValue = 'customer_confirmed';
        }
        
        // Add the new status tag if it's not "pending" or "fulfilled"
        if (status !== 'pending' && status !== 'fulfilled') {
          tags.push(tagValue.trim());
        }
        
        // Add a temporary tag to keep this order visible in filtered views
        // Will be cleared on next data refresh
        tags.push('__status_just_updated');
        
        return { ...order, tags };
      });
      
      return updatedOrders;
    });
    
    // Send the update to the server
    updateStatusMutation.mutate({ orderId, status });
  };

  // Filter orders based on the selected filter
  const filterOrdersByStatus = (order: Order): boolean => {
    const tags = Array.isArray(order.tags) 
      ? order.tags 
      : typeof order.tags === 'string' 
        ? order.tags.split(',').map((t: string) => t.trim()) 
        : [];
    
    const trimmedTags = tags.map((tag: string) => tag.trim());
    
    // If an order was just updated, keep it visible momentarily regardless of status
    if (trimmedTags.includes('__status_just_updated')) {
      return true;
    }
    
    switch(statusFilter) {
      case 'pending':
        // Show both pending orders (no status tags) and confirmed orders (customer_confirmed tag)
        // but exclude other statuses (shipped, ready to ship) and fulfilled orders
        const isPending = !trimmedTags.some(tag => 
          tag === 'shipped' || 
          tag === 'ready to ship'
        );
        const isNotFulfilled = order.fulfillment_status !== 'fulfilled';
        return isPending && isNotFulfilled;
      case 'ready-to-ship':
        return trimmedTags.includes('ready to ship');
      case 'shipped':
        return trimmedTags.includes('shipped');
      case 'fulfilled':
        return order.fulfillment_status === 'fulfilled';
      case 'all':
      default:
        return true;
    }
  };

  // First, decorate orders with their original index
  const sortedOrders = (ordersState || orders)?.map((order: Order, idx: number) => ({
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
    const aPriority = (Array.isArray(a.tags) ? a.tags : typeof a.tags === 'string' ? a.tags.split(',') : [])
      .map((t: string) => t.trim())
      .includes('priority');
    const bPriority = (Array.isArray(b.tags) ? b.tags : typeof b.tags === 'string' ? b.tags.split(',') : [])
      .map((t: string) => t.trim())
      .includes('priority');
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
    // If days left are equal, sort by order ID (numerically)
    if (a.id !== b.id) {
      return a.id - b.id;
    }
    // Final stable sort tiebreaker using original index
    return a.originalIndex - b.originalIndex;
  });

  // Clear temporary status update tags after a delay
  useEffect(() => {
    if (!ordersState) return;
    
    // Check if any orders have the temporary status tag
    const hasTemporaryTags = ordersState.some(order => {
      const tags = Array.isArray(order.tags) 
        ? order.tags 
        : typeof order.tags === 'string' 
          ? order.tags.split(',').map((t: string) => t.trim()) 
          : [];
      
      return tags.some(tag => tag === '__status_just_updated');
    });
    
    if (hasTemporaryTags) {
      // Set a timeout to clear the temporary tags
      const timeoutId = setTimeout(() => {
        setOrdersState(prev => {
          if (!prev) return prev;
          
          return prev.map(order => {
            const tags = Array.isArray(order.tags) 
              ? [...order.tags] 
              : typeof order.tags === 'string' 
                ? order.tags.split(',').map((t: string) => t.trim()) 
                : [];
            
            // Remove the temporary tag
            const filteredTags = tags.filter(tag => tag !== '__status_just_updated');
            
            return { ...order, tags: filteredTags };
          });
        });
      }, 3000); // Keep visible for 3 seconds
      
      return () => clearTimeout(timeoutId);
    }
  }, [ordersState]);

  if (isLoading) {
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
      <div className="bg-white border-b px-4 py-2 flex justify-between items-center">
        {/* Search */}
        <div className="relative w-[400px]">
          <input
            type="text"
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
        </div>

      </div>
      
      {/* Main Header */}
      <div className="bg-white border-b px-8 py-6">
        <div className="flex justify-between items-center">
          {/* Left side - Title and Description */}
          <div>
            <h1 className="text-[28px] font-semibold text-gray-900 leading-tight">Orders</h1>
            <p className="text-base text-gray-500">Manage and track your customer orders</p>
          </div>

          {/* Right side - Filter and Select All */}
          <div className="flex items-center gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-4 pr-10 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
            >
              <option value="pending">Pending Orders</option>
              <option value="ready-to-ship">Ready to Ship</option>
              <option value="shipped">Shipped</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="all">All Orders</option>
            </select>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedOrders.length === (sortedOrders?.length || 0)}
                onChange={handleSelectAll}
                className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Select All</span>
            </label>
          </div>
        </div>

        {/* Export Button - Only show when orders are selected */}
        {selectedOrders.length > 0 && (
          <div className="mt-4">
            <button
              onClick={handleExport}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Extract Delivery Form ({selectedOrders.length})
            </button>
          </div>
        )}
      </div>

      {/* Order Grid */}
      <div className="p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedOrders?.map((order: any) => (
            <OrderCard
              key={order.id}
              order={order}
              onClick={() => handleOrderClick(order)}
              isSelected={selectedOrders.includes(order.id)}
              onSelect={handleOrderSelect}
              onUpdateNote={handleUpdateNote}
              onTogglePriority={handleTogglePriority}
              onUpdateStatus={handleUpdateStatus}
            />
          ))}
        </div>
      </div>

      {/* Order Details Drawer */}
      {isDrawerOpen && selectedOrder && (
        <OrderDetails
          order={selectedOrder}
          isOpen={isDrawerOpen}
          onClose={handleCloseDrawer}
          onUpdateDueDate={(date) => {
            if (selectedOrder) {
              updateDueDateMutation.mutate({
                orderId: selectedOrder.id,
                dueDate: date
              });
            }
          }}
          onUpdateStartDate={(date) => {
            console.log('onUpdateStartDate called with date:', date);
            console.log('selectedOrder:', selectedOrder);
            if (selectedOrder) {
              console.log('Calling updateStartDateMutation with:', {
                orderId: selectedOrder.id,
                startDate: date
              });
              updateStartDateMutation.mutate({
                orderId: selectedOrder.id,
                startDate: date
              });
            }
          }}
        />
      )}
    </div>
  );
};

export default Orders; 