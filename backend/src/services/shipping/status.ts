import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface GetPackagesListPayload {
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

export class ShippingStatusService {
  private baseUrl: string;
  private username: string;
  private password: string;
  private merchantId: number;
  private memberId: number;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    this.baseUrl = process.env.SHIPPING_API_URL || 'https://api.mylerz.net';
    this.username = process.env.SHIPPING_USERNAME || 'ocd';
    this.password = process.env.SHIPPING_PASSWORD || 'H@ni2003';
    this.merchantId = parseInt(process.env.SHIPPING_MERCHANT_ID || '16677');
    this.memberId = parseInt(process.env.SHIPPING_MEMBER_ID || '22376');
  }

  private async authenticate(): Promise<string> {
    try {
      if (this.token && this.tokenExpiry && this.tokenExpiry > new Date()) {
        return this.token;
      }

      console.log('Authenticating with Mylerz API...');
      const response = await axios.post<AuthResponse>(`${this.baseUrl}/api/token`, {
        grant_type: 'password',
        username: this.username,
        password: this.password
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });

      console.log('Authentication response:', response.data);

      if (!response.data.access_token) {
        throw new Error('No access token received from authentication');
      }

      this.token = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));

      return this.token;
    } catch (error: any) {
      console.error('Authentication error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers
      });
      throw new Error(`Failed to authenticate with shipping service: ${error.message}`);
    }
  }

  async getShippingStatuses() {
    try {
      const token = await this.authenticate();

      // Create date range for last 30 days
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 30);

      const payload: GetPackagesListPayload = {
        FilterModel: {
          PageFilter: {
            PageIndex: 1,
            PageSize: 100
          },
          SearchKeyword: ""
        },
        From: from.toISOString(),
        To: to.toISOString(),
        SelectedTab: 2,
        MerchantIds: [this.merchantId],
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
        MemberId: this.memberId,
        Barcodes: [],
        PreferedTimeSlot: 0,
        AvailableTimeslotId: 0,
        DateTypeId: 3,
        SearchOptionId: 1,
        MemberCategoryID: 2
      };

      console.log('Fetching packages with payload:', JSON.stringify(payload, null, 2));

      const response = await axios.post(`${this.baseUrl}/api/package/GetPackagesList`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Culture': 'en-Mylerz'
        }
      });

      console.log('Packages response:', response.data);

      if (!response.data.Value?.Result) {
        throw new Error('Invalid response format from shipping service');
      }

      // Map the response to include only the data we need
      return response.data.Value.Result.map((item: any) => ({
        customerName: item.CustomerName,
        phone: item.CustomerMobile || item.PhoneNo,
        PackageENStatus: item.PackageENStatus,
        barcode: item.Barcode
      }));
    } catch (error: any) {
      console.error('Error fetching shipping statuses:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers
      });
      throw error;
    }
  }
}

export default new ShippingStatusService(); 