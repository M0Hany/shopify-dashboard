export interface ShippingCredentials {
  username: string;
  password: string;
}

export interface ShippingToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface ShippingTokenData {
  access_token: string;
  token_type: string;
  expires_in: number;
  userName: string;
  issued: string;
  expires: string;
}

export interface PageFilter {
  PageIndex: number;
  PageSize: number;
}

export interface FilterModel {
  PageFilter: PageFilter;
  SearchKeyword: string;
}

export interface GetPackagesListPayload {
  FilterModel: FilterModel;
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

export interface OrderDTO {
  WarehouseName?: string;
  PickupDueDate: string;
  Package_Serial: string;
  Service_Type: 'DTD' | 'DTC' | 'CTD' | 'CTC';
  Service: 'SD' | 'ND';
  COD_Value: number;
  Customer_Name: string;
  Mobile_No: string;
  Street: string;
  Country: string;
  Neighborhood: string;
}

export interface OrderResponse {
  PickupOrderCode: string;
  Packages: Array<{
    packageNo: number;
    BarCode: string;
    Status: string;
  }>;
}

export interface TrackingResponse {
  BarCode: string;
  Status: string;
}

export interface ErrorResponse {
  IsErrorState: boolean;
  ErrorDescription: string;
}

export interface Warehouse {
  name: string;
  address: string;
  contactDetails: string;
}

export interface ShippingCharges {
  shippingFee: number;
  vat: number;
  totalCharges: number;
}

export interface ShippingResponse<T> {
  data: T;
  success: boolean;
  message: string | null;
  validationErrors: any[] | null;
}

export interface MylerzLocation {
  Id: number;
  Name: string;
  NameEn: string;
  Code: string;
  IsActive: boolean;
}

export interface MylerzCity extends MylerzLocation {
  CountryId: number;
  Neighborhoods: MylerzNeighborhood[];
}

export interface MylerzNeighborhood extends MylerzLocation {
  CityId: number;
  SubZones: MylerzSubZone[];
}

export interface MylerzSubZone extends MylerzLocation {
  NeighborhoodId: number;
}

export interface SubZone {
  ArName: string;
  Code: string;
  EnName: string;
  Id: number;
}

export interface Zone {
  ArName: string;
  EnName: string;
  Id: number;
  SubZoneId: number;
  SubZones: SubZone[];
}

export interface City {
  ArName: string;
  EnName: string;
  Id: number;
  Zones: Zone[];
}

export interface MylerzLocationResponse {
  Value: City[];
  CoreValue: null;
  IsErrorState: boolean;
  ErrorDescription: null | string;
  ErrorMetadata: null | any;
} 