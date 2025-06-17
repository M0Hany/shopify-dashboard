import { 
  ShippingCredentials, 
  ShippingTokenData,
  ShippingResponse,
  ShippingCharges,
  GetPackagesListPayload,
  MylerzLocationResponse,
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

  private async authenticate(): Promise<void> {
    try {
      logger.info('Attempting to authenticate with shipping service...');
      
      // Form data for token request
      const formData = new URLSearchParams();
      formData.append('username', config.shipping.username);
      formData.append('password', config.shipping.password);
      formData.append('grant_type', 'password');

      const response = await this.client.post<ShippingTokenData>('/token', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (response.data?.access_token) {
        this.token = response.data.access_token;
        this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));
        
        // Update axios default headers
        this.client.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
        
        logger.info('Successfully authenticated with shipping service');
      } else {
        logger.error('Authentication failed - Invalid response:', response.data);
        throw new Error('Authentication failed: No token received');
      }
    } catch (error) {
      logger.error('Shipping service authentication failed:', {
        error,
        config: {
          url: this.baseUrl,
          username: config.shipping.username,
          hasPassword: !!config.shipping.password
        }
      });
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
        console.error('Response data:', error.response?.data);
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
      const response = await this.client.post('/api/package/GetPackagesList', payload);
      return response.data;
    } catch (error) {
      console.error('Failed to get packages list:', error);
      throw new Error('Failed to get packages list');
    }
  }

  async getAllLocations(): Promise<MylerzLocationResponse> {
    try {
      logger.info('Ensuring authentication before fetching locations...');
      await this.ensureAuthenticated();

      logger.info('Fetching all shipping locations...');
      const response = await this.client.get<MylerzLocationResponse>('/api/loockup/GetAllPickup', {
        validateStatus: function (status) {
          return status < 500; // Accept all status codes less than 500
        }
      });

      // Log the raw response for debugging
      logger.info('Raw API Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });

      if (!response.data) {
        logger.error('No data received from locations API');
        throw new Error('No data received from locations API');
      }

      // Check if the response has the expected structure
      if (!response.data.Value || !Array.isArray(response.data.Value)) {
        logger.error('Invalid response format:', response.data);
        throw new Error('Invalid response format from locations API');
      }

      // Check for API errors
      if (response.data.IsErrorState) {
        logger.error('API returned error state:', {
          description: response.data.ErrorDescription,
          metadata: response.data.ErrorMetadata
        });
        throw new Error(`API Error: ${response.data.ErrorDescription || 'Unknown error'}`);
      }

      logger.info(`Successfully fetched ${response.data.Value.length} cities`);
      return response.data;
    } catch (error: any) {
      const axiosError = error.isAxiosError ? error : null;
      logger.error('Failed to fetch shipping locations:', {
        error: error.message,
        response: axiosError?.response?.data,
        status: axiosError?.response?.status,
        config: {
          ...axiosError?.config,
          headers: axiosError?.config?.headers
        },
        stack: error.stack
      });
      throw new Error(`Failed to fetch shipping locations: ${error.message}`);
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
        c.ArName.toLowerCase() === cityName.toLowerCase() ||
        c.EnName.toLowerCase() === cityName.toLowerCase()
      );

      if (!city) {
        throw new Error(`City not found: ${cityName}`);
      }

      // Find the neighborhood
      let foundZone: Zone | undefined;
      let foundSubZone: SubZone | undefined;

      // Search through all zones and their subzones
      for (const zone of city.Zones) {
        const subZone = zone.SubZones.find(sz => 
          sz.ArName.toLowerCase() === neighborhoodName.toLowerCase() ||
          sz.EnName.toLowerCase() === neighborhoodName.toLowerCase()
        );
        if (subZone) {
          foundZone = zone;
          foundSubZone = subZone;
          break;
        }
      }

      if (!foundZone || !foundSubZone) {
        throw new Error(`Neighborhood not found: ${neighborhoodName} in city ${cityName}`);
      }

      return {
        cityId: city.Id.toString(),
        neighborhoodId: foundZone.Id.toString(),
        subZoneId: foundSubZone.Id.toString()
      };
    } catch (error) {
      logger.error('Failed to find location IDs:', error);
      throw error;
    }
  }
} 