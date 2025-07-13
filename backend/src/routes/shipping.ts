import express from 'express';
import { ShippingController } from '../controllers/shippingController';
import { Request, Response } from 'express';
import { locationData, LocationResponse } from '../data/locations';
import { Router } from 'express';
import { ShippingService } from '../services/shipping/ShippingService';
import { logger } from '../utils/logger';
import { shopifyService } from '../services/shopify';
import { ShippingStatusChecker } from '../services/shipping/ShippingStatusChecker';
import { OrderDTO } from '../services/shipping/types';

const router = express.Router();
const shippingController = new ShippingController();
const shippingService = ShippingService.getInstance();
const statusChecker = new ShippingStatusChecker();

// Get Packages List
router.post('/packages/list', async (req, res) => {
  try {
    const response = await shippingService.getPackagesList(req.body);
    res.json(response);
  } catch (error) {
    console.error('Error fetching packages list:', error);
    res.status(500).json({ error: 'Failed to fetch packages list' });
  }
});

// Create shipping order
router.post('/orders', async (req, res) => {
  try {
    const orderData: OrderDTO = req.body;
    const response = await shippingService.createOrder(orderData);
    res.json(response);
  } catch (error) {
    console.error('Error creating shipping order:', error);
    res.status(500).json({ error: 'Failed to create shipping order' });
  }
});

// Track package
router.get('/packages/:awb/status', async (req, res) => {
  try {
    const { awb } = req.params;
    const response = await shippingService.trackPackage(awb);
    res.json(response);
  } catch (error) {
    console.error('Error tracking package:', error);
    res.status(500).json({ error: 'Failed to track package' });
  }
});

// Get AWB
router.post('/packages/awb', async (req, res) => {
  try {
    const { barcode, referenceNumber } = req.body;
    const awbBuffer = await shippingService.getAWB(barcode, referenceNumber);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=awb-${barcode}.pdf`);
    res.send(awbBuffer);
  } catch (error) {
    console.error('Error generating AWB:', error);
    res.status(500).json({ error: 'Failed to generate AWB' });
  }
});

// Get warehouses
router.get('/warehouses', async (req, res) => {
  try {
    const warehouses = await shippingService.getWarehouses();
    res.json(warehouses);
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    res.status(500).json({ error: 'Failed to fetch warehouses' });
  }
});

// Get expected charges
router.post('/charges', async (req, res) => {
  try {
    const { codValue, warehouseName, packageWeight } = req.body;
    const charges = await shippingService.getExpectedCharges(
      codValue,
      warehouseName,
      packageWeight
    );
    res.json(charges);
  } catch (error) {
    console.error('Error calculating charges:', error);
    res.status(500).json({ error: 'Failed to calculate shipping charges' });
  }
});

// Test endpoint to manually trigger shipping status check
router.post('/check-status', async (req, res) => {
  try {
    await ShippingStatusChecker.checkAndUpdateStatuses();
    res.json({ message: 'Shipping status check triggered successfully' });
  } catch (error) {
    console.error('Error triggering shipping status check:', error);
    res.status(500).json({ error: 'Failed to trigger shipping status check' });
  }
});

// Test endpoint to manually trigger address tag check
router.post('/check-address-tags', async (req, res) => {
  try {
    logger.info('Manual address tag check triggered');
    const result = await shippingService.processUntaggedOrders();
    logger.info('Manual address tag check completed', result);
    res.json({ 
      message: 'Address tag check completed',
      result 
    });
  } catch (error) {
    logger.error('Error triggering address tag check:', error);
    res.status(500).json({ error: 'Failed to trigger address tag check' });
  }
});

// Shipping locations endpoints
router.get('/locations', shippingController.getLocations);

// Add a new route to test the GetAllPickup endpoint
router.get('/test-get-all-locations', async (req, res) => {
  try {
    const result = await shippingService.getAllLocations();
    
    // Log the full data structure
    logger.info('GetAllLocations test result:', {
      responseReceived: !!result,
      dataCount: result?.Value?.length || 0,
      firstCity: result?.Value?.[0] // Log first city as sample
    });

    // Return the actual data
    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Error testing GetAllLocations:', error);
    res.status(500).json({ 
      error: 'Failed to test GetAllLocations', 
      details: error?.message || 'Unknown error' 
    });
  }
});

// Add the locations endpoint
router.get('/locations', async (req: Request, res: Response) => {
  try {
    const response: LocationResponse = locationData;
    res.json(response);
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// Helper to extract tag value (with trimming)
function getTagValue(tags: string[], prefix: string): string | null {
  const tag = tags.find(t => t.trim().startsWith(prefix));
  if (!tag) return null;
  const value = tag.split(':')[1]?.trim();
  return value === 'null' ? null : value;
}

// Helper to format phone number
function formatPhone(phone: string): string {
  let formatted = phone.replace(/\D/g, '');
  if (formatted.startsWith('0')) {
    formatted = '20' + formatted.substring(1);
  } else if (formatted.startsWith('+20')) {
    formatted = formatted.substring(1);
  } else if (!formatted.startsWith('20')) {
    formatted = '20' + formatted;
  }
  return formatted;
}

// Helper to map order to Mylerz API format
function mapOrderToMylerz(order: any): any {
  const tags = Array.isArray(order.tags)
    ? order.tags.map((t: string) => t.trim())
    : typeof order.tags === 'string'
      ? order.tags.split(',').map((t: string) => t.trim())
      : [];
  const cityId = getTagValue(tags, 'mylerz_city_id:');
  const neighborhoodId = getTagValue(tags, 'mylerz_neighborhood_id:');
  const subZoneId = getTagValue(tags, 'mylerz_subzone_id:');
  const now = new Date();
  const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  
  const warehouse = {
    Id: 30578,
    MerchantId: 16677,
    Code: 'mokattam',
    Name: 'mokattam',
    ZoneId: 2226,
    AreaId: 2
  };

  const subscriber = {
    Id: 9,
    Code: "MYLERZMain",
    ArName: "مايلرز",
    EnName: "MylerzMain"
  };

  return {
    ValueOfGoods: Number(order.total_price),
    hasValueOfGoodsError: false,
    HasError: false,
    HaveCOD: false,
    DisableRefNumber: false,
    WareHouses: [warehouse],
    subscriberItemList: [subscriber],
    NeighborhoodList: [],
    SubZoneList: [],
    packageNo: String(order.name).replace('#', ''),
    Description: 'crochet',
    TotalWeight: 0.5,
    DeliveryCost: Number(order.total_price),
    ServiceTypeId: 1,
    ServiceDatetypeID: 2,
    ServiceDate: now.toISOString(),
    ServiceCategoryId: 1,
    PaymentTypeId: 2,
    PackageSourceId: 3,
    CustomerName: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim(),
    mobileNo: formatPhone(order.shipping_address?.phone || ''),
    MobileNo2: null,
    CompanyName: null,
    CustomerNationalId: '',
    MerchantId: 16677,
    MerchantCode: '116677',
    MerchantName: 'ocd',
    WarehouseId: 30578,
    PackagePieces: Array.isArray(order.line_items)
      ? order.line_items.map((item: any, idx: number) => ({
          pieceNo: idx + 1,
          ItemCategoryId: 0,
          PersistanceInstruction: 1,
          hasItemCategoryError: false
        }))
      : [],
    checkedError: false,
    changed: false,
    hasCompanyNameError: false,
    hasDescriptionError: false,
    hasNotesError: false,
    hasStreetError: false,
    hasCustomerNameError: false,
    hasMobileError: false,
    hasMobile2Error: false,
    CanAddPieces: true,
    detailWarehouses: [warehouse],
    hasMerchantNameRequreid: false,
    hasCODValueRequreid: false,
    hasTotalWeightRequreid: false,
    hasNationalIDRequreid: false,
    hasDetailsWarehouseRequreid: false,
    hasselectedSubscribersRequreid: false,
    selectedSubscribers: [subscriber],
    HasPOD: false,
    CanPackageWeightEdit: true,
    confirmedLocation: true,
    hasInvalidWeightError: false,
    IsSaveAddressBook: false,
    hasOTPError: false,
    hasNationalIDError: false,
    hasVerificationTypeError: false,
    hasServiceSubCategoryError: false,
    hasAmountCheckExchangeError: false,
    UserId: 22376,
    HubEnterPoint: 1,
    HubId: null,
    DestinationHubId: null,
    ActualServiceDate: nextDay.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }),
    IsFulfillment: false,
    ApplyVerification: false,
    CustomerAddress: {
      Street: `${order.shipping_address?.address1 || ''} ${order.shipping_address?.address2 || ''}`.trim(),
      CityId: cityId,
      NeighborhoodId: neighborhoodId,
      SubZoneId: subZoneId
    },
    AddressCategoryId: 1,
    PersistanceInstruction: 1,
    packageNumber: 0,
    PackageReferenceNumber3: "",
    VerificationTypeId: 0,
    ServiceSubCategoryId: 0,
    PickupAddressId: 0,
    hasNeighborError: false,
    hasSubZoneError: false,
    disabledObj1: true,
    SubscriberId: 9,
    PackagePiecesLength: 1,
    hasCOD: true,
    hasAddressCategoryError: false,
    hasCityError: false,
    hasPaymentTypeError: false,
    hasSelectServiceTypeError: false,
    hasServiceCategoryError: false,
    hasPackageServiceTypeError: false,
    hasWeightError: false
  };
}

// Bulk create shipments (with mapping)
router.post('/create-shipments', async (req, res) => {
  try {
    const { orderIds } = req.body;
    logger.info('Received create-shipments request', { orderIds });
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      logger.error('No orderIds provided to create-shipments');
      return res.status(400).json({ error: 'No orderIds provided' });
    }
    // Fetch orders from Shopify (or your DB)
    const orders = await Promise.all(orderIds.map(async (id: string | number) => {
      const order = await shopifyService.getOrder(Number(id));
      return order;
    }));
    logger.info('Fetched orders for create-shipments', { orders });
    // Map orders to Mylerz format
    const mappedOrders = orders.map(mapOrderToMylerz);
    logger.info('Mapped orders for Mylerz API', { mappedOrders });
    const result = await shippingService.createShipments(mappedOrders);
    logger.info('Result from shippingService.createShipments', { result });

    // Add shipping barcode tags to orders and update status
    if (result.Value?.PackageList) {
      await Promise.all(result.Value.PackageList.map(async (shipment: any) => {
        // Find matching order by customer name and phone
        const matchingOrder = orders.find(order => {
          const orderCustomerName = `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim();
          const orderPhone = formatPhone(order.shipping_address?.phone || '');
          return orderCustomerName === shipment.CustomerName && orderPhone === shipment.MobileNo;
        });

        if (matchingOrder) {
          // Get existing tags
          const existingTags = Array.isArray(matchingOrder.tags) 
            ? matchingOrder.tags.map((t: string) => t.trim())
            : typeof matchingOrder.tags === 'string'
              ? matchingOrder.tags.split(',').map((t: string) => t.trim())
              : [];

          // Add ready_to_ship tag and shipping barcode (only if customer has confirmed)
          const newTags = [
            ...existingTags.filter(tag => 
              !tag.startsWith('shipping_barcode:')
            ),
            'ready_to_ship',
            `shipping_barcode:${shipment.BarCode}`
          ];

          // Update order tags
          await shopifyService.updateOrderTags(matchingOrder.id.toString(), newTags);
          logger.info('Updated order tags with shipping barcode and status', {
            orderId: matchingOrder.id,
            barcode: shipment.BarCode,
            newTags
          });
        }
      }));
    }

    res.json(result);
  } catch (error) {
    logger.error('Error creating shipments', { error });
    res.status(500).json({ error: 'Failed to create shipments' });
  }
});

export default router; 