import { api, getApiUrl } from '../config/api';

const API_URL = getApiUrl();

interface PageFilter {
  PageIndex: number;
  PageSize: number;
}

interface FilterModel {
  PageFilter: PageFilter;
  SearchKeyword: string;
}

export interface GetPackagesListPayload {
  FilterModel: {
    PageFilter: {
      PageIndex: number;
      PageSize: number;
    };
    SearchKeyword: string;
  };
  From: string;
  To: string;
  SelectedTab: number;
  MerchantIds: number[];
  WarehouseIds: number[];
  SubscriberIds: number[];
  HubId: number[];
  HubTypeId: number;
  PhaseId: number[];
  MylerIds: number[];
  TransferBy: number[];
  ServiceTypeId: number[];
  ServiceCategoryId: number[];
  PaymentTypeId: number[];
  StatusId: number[];
  PackageServiceId: number[];
  AttemptsNumber: number | null;
  MemberId: number;
  Barcodes: string[];
  PreferedTimeSlot: number;
  AvailableTimeslotId: number;
  DateTypeId: number;
  SearchOptionId: number;
  MemberCategoryID: number;
}

export interface ShippingPackage {
  PackageId: number;
  CreatedDate: string;
  Barcode: string;
  CustomerReferenceNumber: string | null;
  PackageStatusId: number;
  PackageARStatus: string;
  PackageENStatus: string;
  PackageStatusColor: string;
  CustomerName: string;
  PhoneNo: string;
  Address: string;
  CityEnName: string;
  ZoneEnName: string;
  SubZoneEnName: string;
  CODValue: number;
  RefrenceNumber: string | null;
}

export interface GetPackagesListResponse {
  Value: {
    InProgressCount: number;
    CompletedCount: number;
    NeedActionCount: number;
    ConfirmCount: number;
    CollectCount: number;
    UploadedCount: number;
    Result: any[];
    Total: number;
  };
  IsErrorState: boolean;
  ErrorDescription: string | null;
}

export const getPackagesList = async (payload: GetPackagesListPayload): Promise<GetPackagesListResponse> => {
  try {
    const response = await api.post('/api/shipping/packages/list', payload);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch packages:', error);
    throw error;
  }
};

export const getPackageStatus = async (awb: string) => {
  try {
    const response = await api.get(`/api/shipping/packages/${awb}/status`);
    return response.data;
  } catch (error) {
    console.error('Failed to get package status:', error);
    throw error;
  }
};

export const getAWB = async (barcode: string, referenceNumber: string) => {
  try {
    const response = await api.post(
      '/api/shipping/packages/awb',
      { barcode, referenceNumber },
      { responseType: 'blob' }
    );
    return response.data;
  } catch (error) {
    console.error('Failed to get AWB:', error);
    throw error;
  }
};

export const getWarehouses = async () => {
  try {
    const response = await api.get('/api/shipping/warehouses');
    return response.data;
  } catch (error) {
    console.error('Failed to get warehouses:', error);
    throw error;
  }
};

export const getExpectedCharges = async (
  codValue: number,
  warehouseName: string,
  packageWeight: number
) => {
  try {
    const response = await api.post('/api/shipping/charges', {
      codValue,
      warehouseName,
      packageWeight
    });
    return response.data;
  } catch (error) {
    console.error('Failed to get expected charges:', error);
    throw error;
  }
};

export const SHIPPING_TAGS = {
  CITY_ID: 'mylerz_city_id',
  NEIGHBORHOOD_ID: 'mylerz_neighborhood_id',
  SUBZONE_ID: 'mylerz_subzone_id'
};

export const addShippingLocationTags = async (orderId: string, governorate: string) => {
  try {
    // Get locations from API
    const locationsData = await getLocations();
    
    // Find the city in the locations data
    const city = locationsData.Value.find(
      city => 
        city.EnName.toLowerCase() === governorate.toLowerCase() || 
        city.ArName === governorate
    );

    if (!city) {
      throw new Error(`Unknown governorate: ${governorate}`);
    }

    // Prepare tags with just the city ID for now
    // Neighborhood and SubZone will be set by user through UI
    const tags = [
      `${SHIPPING_TAGS.CITY_ID}:${city.Id}`,
      `${SHIPPING_TAGS.NEIGHBORHOOD_ID}:null`,
      `${SHIPPING_TAGS.SUBZONE_ID}:null`
    ];

    // Add tags to Shopify order
    // TODO: Implement the actual Shopify API call here
    console.log('Adding tags to order:', orderId, tags);
  } catch (error) {
    console.error('Error adding shipping location tags:', error);
    throw error;
  }
};

export const getShippingLocationFromTags = (tags: string[]) => {
  const normalizedTags = tags.map(tag => tag.trim().toLowerCase());
  
  const cityId = normalizedTags
    .find(tag => tag.startsWith(SHIPPING_TAGS.CITY_ID.toLowerCase()))
    ?.split(':')[1];
    
  const neighborhoodId = normalizedTags
    .find(tag => tag.startsWith(SHIPPING_TAGS.NEIGHBORHOOD_ID.toLowerCase()))
    ?.split(':')[1];
    
  const subZoneId = normalizedTags
    .find(tag => tag.startsWith(SHIPPING_TAGS.SUBZONE_ID.toLowerCase()))
    ?.split(':')[1];

  return {
    cityId: cityId || null,
    neighborhoodId: neighborhoodId || null,
    subZoneId: subZoneId || null
  };
};

interface ShopifyOrder {
  id: number;
  name: string;
  shipping_address: {
    province: string;
    city: string;
    phone: string;
  };
  tags: string | string[];
}

interface AddressTagsResult {
  total: number;
  successful: number;
  failed: number;
  errors: string[];
}

export const addBulkAddressTags = async (orders: ShopifyOrder[]): Promise<AddressTagsResult> => {
  try {
    const response = await fetch(`${API_URL}/api/orders/bulk-add-address-tags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orders }),
    });

    if (!response.ok) {
      throw new Error('Failed to add address tags');
    }

    return await response.json();
  } catch (error) {
    console.error('Error adding address tags:', error);
    throw error;
  }
};

// Types from backend
interface SubZone {
  Id: number;
  Code: string;
  ArName: string;
  EnName: string;
}

interface Zone {
  Id: number;
  EnName: string;
  ArName: string;
  SubZoneId: number;
  SubZones: SubZone[];
}

interface City {
  Id: number;
  EnName: string;
  ArName: string;
  Zones: Zone[];
}

interface LocationResponse {
  Value: City[];
}

// Get locations from API
export const getLocations = async (): Promise<LocationResponse> => {
  const response = await api.get('/api/shipping/locations');
  return response.data;
};

// Create shipping order with location data from API
export const createShippingOrder = async (order: any) => {
  try {
    // Get locations data from API
    const locationsData = await getLocations();
    const governorate = order.shipping_address.province.trim();
    
    // Find the city in the locations data
    const city = locationsData.Value.find(
      city => 
        city.EnName.toLowerCase() === governorate.toLowerCase() || 
        city.ArName === governorate
    );

    if (!city) {
      throw new Error(`Unknown governorate: ${governorate}`);
    }

    // Use the city ID from the API data
    const locationInfo = {
      cityId: city.Id.toString(),
      // These will be set by the user through the UI now
      neighborhoodId: null,
      subZoneId: null
    };

    // Create the shipping order payload
    const payload = {
      // ... your shipping order payload
      cityId: locationInfo.cityId,
      neighborhoodId: locationInfo.neighborhoodId,
      subZoneId: locationInfo.subZoneId,
    };

    // Make the API call to create the shipping order
    const response = await api.post('/api/shipping/orders', payload);
    return response.data;
  } catch (error) {
    console.error('Error creating shipping order:', error);
    throw error;
  }
}; 