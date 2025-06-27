import request from 'supertest';
import express from 'express';
import shippingRoutes from '../routes/shipping';
import { ShippingService } from '../services/shipping/ShippingService';

const app = express();
app.use(express.json());
app.use('/api/shipping', shippingRoutes);

// Define interfaces for the payload structure
interface PageFilter {
  PageIndex: number;
  PageSize: number;
}

interface FilterModel {
  PageFilter: PageFilter;
  SearchKeyword: string;
}

interface GetPackagesListPayload {
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

describe('Shipping API', () => {
  let shippingService: ShippingService;

  beforeAll(() => {
    shippingService = ShippingService.getInstance();
  });

  describe('Authentication', () => {
    it('should authenticate with shipping service', async () => {
      const response = await request(app)
        .post('/api/shipping/auth')
        .send({
          grant_type: 'password',
          username: process.env.SHIPPING_USERNAME,
          password: process.env.SHIPPING_PASSWORD
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('token_type', 'bearer');
      expect(response.body).toHaveProperty('expires_in');
    });
  });

  describe('GetPackagesList', () => {
    it('should fetch packages list with proper payload structure', async () => {
      // First authenticate to get token
      const authResponse = await request(app)
        .post('/api/shipping/auth')
        .send({
          grant_type: 'password',
          username: process.env.SHIPPING_USERNAME,
          password: process.env.SHIPPING_PASSWORD
        });

      const token = authResponse.body.access_token;

      // Prepare the payload
      const payload: GetPackagesListPayload = {
        FilterModel: {
          PageFilter: {
            PageIndex: 1,
            PageSize: 30
          },
          SearchKeyword: ""
        },
        From: "2025-06-13T21:00:00.710Z",
        To: "2025-06-15T20:59:59.710Z",
        SelectedTab: 2,
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

      // Then fetch packages list with the payload
      const response = await request(app)
        .post('/api/shipping/packages/list')
        .set('Authorization', `Bearer ${token}`)
        .set('accept', 'application/json, text/plain, */*')
        .set('accept-language', 'en-US,en;q=0.9')
        .set('cache-control', 'no-cache')
        .set('content-type', 'application/json')
        .set('culture', 'en-Mylerz')
        .set('origin', 'https://mylerz.net')
        .set('pragma', 'no-cache')
        .set('priority', 'u=1, i')
        .set('referer', 'https://mylerz.net/')
        .set('sec-ch-ua', '"Chromium";v="134", "Not:A-Brand";v="24", "Opera GX";v="119"')
        .set('sec-ch-ua-mobile', '?0')
        .set('sec-ch-ua-platform', '"Windows"')
        .set('sec-fetch-dest', 'empty')
        .set('sec-fetch-mode', 'cors')
        .set('sec-fetch-site', 'same-site')
        .set('user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 OPR/119.0.0.0')
        .send(payload);

      console.log('GetPackagesList Response:', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      expect(response.body.Value).toBeDefined();
      expect(response.body.Value.Result).toBeDefined();
    });

    it('should handle pagination correctly', async () => {
      const authResponse = await request(app)
        .post('/api/shipping/auth')
        .send({
          grant_type: 'password',
          username: process.env.SHIPPING_USERNAME,
          password: process.env.SHIPPING_PASSWORD
        });

      const token = authResponse.body.access_token;

      // Test with different page sizes
      const pageSizes = [10, 20, 30];
      
      for (const pageSize of pageSizes) {
        const payload: GetPackagesListPayload = {
          FilterModel: {
            PageFilter: {
              PageIndex: 1,
              PageSize: pageSize
            },
            SearchKeyword: ""
          },
          From: new Date().toISOString(),
          To: new Date().toISOString(),
          SelectedTab: 3,
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

        const response = await request(app)
          .post('/api/shipping/packages/list')
          .set('Authorization', `Bearer ${token}`)
          .send(payload);

        console.log(`GetPackagesList Response (PageSize: ${pageSize}):`, JSON.stringify(response.body, null, 2));

        expect(response.status).toBe(200);
      }
    });
  });
});