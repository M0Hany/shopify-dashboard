import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
    const response = await axios.post(`${API_URL}/api/shipping/packages/list`, payload, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch packages:', error);
    throw error;
  }
};

export const getPackageStatus = async (awb: string) => {
  try {
    const response = await axios.get(`${API_URL}/api/shipping/packages/${awb}/status`);
    return response.data;
  } catch (error) {
    console.error('Failed to get package status:', error);
    throw error;
  }
};

export const getAWB = async (barcode: string, referenceNumber: string) => {
  try {
    const response = await axios.post(
      `${API_URL}/api/shipping/packages/awb`,
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
    const response = await axios.get(`${API_URL}/api/shipping/warehouses`);
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
    const response = await axios.post(`${API_URL}/api/shipping/charges`, {
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