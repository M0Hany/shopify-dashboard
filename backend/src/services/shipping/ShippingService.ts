import { 
  ShippingCredentials, 
  ShippingTokenData,
  ShippingResponse,
  ShippingCharges,
  GetPackagesListPayload,
  MylerzLocationResponse,
  Warehouse,
  TrackingResponse,
  OrderDTO,
  OrderResponse
} from './types';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import axios, { AxiosInstance } from 'axios';

export class ShippingService {
  private static instance: ShippingService;
  private client: AxiosInstance;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.shipping.apiUrl;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Culture': 'en-Mylerz',
        'Pragma': 'no-cache',
        'Priority': 'u=1, i',
        'Referer': 'https://mylerz.net/',
        'Sec-Ch-Ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Opera GX";v="119"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site'
      }
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          await this.authenticate();
          // Retry the original request
          return this.client(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  public static getInstance(): ShippingService {
    if (!ShippingService.instance) {
      ShippingService.instance = new ShippingService();
    }
    return ShippingService.instance;
  }

  public async authenticate(): Promise<void> {
    try {
      // Create form data
      const formData = new URLSearchParams();
      formData.append('grant_type', 'password');
      formData.append('username', config.shipping.username);
      formData.append('password', config.shipping.password);

      const response = await this.client.post<ShippingResponse<ShippingTokenData>>('/token', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });

      if (response.data?.access_token) {
        this.token = response.data.access_token;
        this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));
        
        // Update axios default headers
        this.client.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
      } else {
        throw new Error('Authentication failed: No token received');
      }
    } catch (error) {
      logger.error('Shipping service authentication failed:', error);
      throw new Error('Failed to authenticate with shipping service');
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    const now = new Date();
    if (!this.token || !this.tokenExpiry || now >= this.tokenExpiry) {
      await this.authenticate();
    }
  }

  public async createOrder(orderData: OrderDTO): Promise<OrderResponse> {
    await this.ensureAuthenticated();
    try {
      console.log('Creating order with data:', orderData);
      // Send order data as a collection
      const response = await this.client.post<OrderResponse>('/api/Orders/AddOrders', [orderData]);
      return response.data;
    } catch (error: unknown) {
      console.error('Failed to create order:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response status:', error.response?.status);
        console.error('Request config:', error.config);
      }
      throw new Error('Failed to create shipping order');
    }
  }

  public async trackPackage(awb: string): Promise<TrackingResponse> {
    await this.ensureAuthenticated();
    try {
      const response = await this.client.get<TrackingResponse>(`/api/Packages/GetPackageStatus?AWB=${awb}`);
      return response.data;
    } catch (error) {
      console.error('Failed to track package:', error);
      throw new Error('Failed to get package status');
    }
  }

  public async getAWB(barcode: string, referenceNumber: string): Promise<Buffer> {
    await this.ensureAuthenticated();
    try {
      const response = await this.client.post<Buffer>(
        '/api/Packages/GetAWB',
        { Barcode: barcode, ReferenceNumber: referenceNumber },
        { responseType: 'arraybuffer' }
      );
      return Buffer.from(response.data);
    } catch (error) {
      console.error('Failed to get AWB:', error);
      throw new Error('Failed to generate AWB');
    }
  }

  public async getWarehouses(): Promise<Warehouse[]> {
    await this.ensureAuthenticated();
    try {
      const response = await this.client.get<Warehouse[]>('/api/Orders/GetWarehouses');
      return response.data;
    } catch (error: unknown) {
      console.error('Failed to get warehouses:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response data:', error.response?.data);
        console.error('Response status:', error.response?.status);
        console.error('Request config:', error.config);
      }
      throw new Error('Failed to fetch warehouses');
    }
  }

  public async getExpectedCharges(
    codValue: number,
    warehouseName: string,
    packageWeight: number
  ): Promise<ShippingCharges> {
    await this.ensureAuthenticated();
    try {
      const response = await this.client.post<ShippingCharges>('/api/Packages/GetExpectedCharges', {
        CODValue: codValue,
        WarehouseName: warehouseName,
        PackageWeight: packageWeight
      });
      return response.data;
    } catch (error: unknown) {
      console.error('Failed to get expected charges:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response data:', error.response?.data);
        console.error('Response status:', error.response?.status);
        console.error('Request config:', error.config);
      }
      throw new Error('Failed to calculate shipping charges');
    }
  }

  public async getPackagesList(payload: GetPackagesListPayload): Promise<any> {
    await this.ensureAuthenticated();
    try {
      const response = await this.client.post('/api/package/GetPackagesList', payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Culture': 'en-Mylerz'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get packages list:', error);
      throw new Error('Failed to get packages list');
    }
  }

  async getAllLocations(): Promise<MylerzLocationResponse> {
    try {
      await this.ensureAuthenticated();

      const response = await this.client.get<MylerzLocationResponse>('/loockup/GetAllPickup');

      if (response.data.IsErrorState) {
        throw new Error(`Failed to fetch locations: ${response.data.ErrorDescription}`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to fetch shipping locations:', error);
      throw new Error('Failed to fetch shipping locations');
    }
  }

  async findLocationIds(cityName: string, neighborhoodName: string): Promise<{
    cityId: string;
    neighborhoodId: string;
    subZoneId: string;
  }> {
    try {
      const locations = await this.getAllLocations();
      
      // Find the city (case-insensitive search in both Arabic and English names)
      const city = locations.Value.find(c => 
        c.Name.toLowerCase() === cityName.toLowerCase() ||
        c.NameEn.toLowerCase() === cityName.toLowerCase()
      );

      if (!city) {
        throw new Error(`City not found: ${cityName}`);
      }

      // Find the neighborhood
      const neighborhood = city.Neighborhoods.find(n =>
        n.Name.toLowerCase() === neighborhoodName.toLowerCase() ||
        n.NameEn.toLowerCase() === neighborhoodName.toLowerCase()
      );

      if (!neighborhood) {
        throw new Error(`Neighborhood not found: ${neighborhoodName} in city ${cityName}`);
      }

      // Get the first active subzone (or implement your own logic for selecting subzone)
      const subZone = neighborhood.SubZones.find(sz => sz.IsActive);

      if (!subZone) {
        throw new Error(`No active subzone found for neighborhood: ${neighborhoodName}`);
      }

      return {
        cityId: city.Id.toString(),
        neighborhoodId: neighborhood.Id.toString(),
        subZoneId: subZone.Id.toString()
      };
    } catch (error) {
      logger.error('Failed to find location IDs:', error);
      throw error;
    }
  }

  public async createShipments(orders: any[]): Promise<any> {
    await this.ensureAuthenticated();
    try {
      const response = await this.client.post('/api/package/SavePackageList', orders);
      return response.data;
    } catch (error) {
      logger.error('Failed to create shipments:', error);
      throw new Error('Failed to create shipments');
    }
  }

  public async getShippingStatus(awb: string): Promise<any> {
    await this.ensureAuthenticated();
    try {
      const response = await this.client.get(`/api/package/GetPackageStatus?AWB=${awb}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get shipping status:', error);
      throw new Error('Failed to get shipping status');
    }
  }

  public async processUntaggedOrders(): Promise<{
    successful: string[];
    failed: string[];
    errors: Record<string, string>;
  }> {
    await this.ensureAuthenticated();
    try {
      // Implementation for processing untagged orders
      logger.info('Processing untagged orders');
      return {
        successful: [],
        failed: [],
        errors: {}
      };
    } catch (error) {
      logger.error('Failed to process untagged orders:', error);
      throw new Error('Failed to process untagged orders');
    }
  }
} 