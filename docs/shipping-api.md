# Mylerz API Integration Parameters

## Endpoint
```
POST https://api.mylerz.net/api/package/SavePackageList
```

## Order Information
| Parameter | Source | Type | Description |
|-----------|--------|------|-------------|
| ValueOfGoods | `order.total_price` | number | Total cost of the order |
| packageNo | `order.name` without '#' | string | Order number (e.g., "1152") |
| Description | Static | string | Always "crochet" |
| Total Weight | Static | number | Always 0.5 |
| DeliveryCost | `order.total_price` | number | Same as ValueOfGoods |

## Service Configuration
| Parameter | Source | Type | Value |
|-----------|--------|------|--------|
| ServiceTypeId | Static | number | 1 |
| ServiceDatetypeID | Static | number | 2 |
| ServiceDate | Dynamic | string | Current date (format: "2025-06-17T23:48:36.678Z") |
| ServiceCategoryId | Static | number | 1 |
| PaymentTypeId | Static | number | 2 |
| PackageSourceId | Static | number | 3 |

## Customer Information
| Parameter | Source | Type | Description |
|-----------|--------|------|-------------|
| CustomerName | `order.customer.first_name + " " + order.customer.last_name` | string | Full customer name |
| mobileNo | `order.customer.phone` | string | Primary phone (handle +20 country code) |
| MobileNo2 | Static | null | Secondary phone |
| CompanyName | Static | null | Company name |
| CustomerNationalId | Static | string | Empty string "" |

## Merchant Information
| Parameter | Source | Type | Value |
|-----------|--------|------|--------|
| MerchantId | Static | number | 16677 |
| MerchantCode | Static | string | "116677" |
| MerchantName | Static | string | "ocd" |
| WarehouseId | Static | number | 30578 |

## Warehouse Configuration
```json
{
  "WareHouses": [
    {
      "Id": 30578,
      "MerchantId": 16677,
      "Code": "mokattam",
      "Name": "mokattam",
      "ZoneId": 248,
      "AreaId": 2
    }
  ]
}
```

## Package Information
| Parameter | Source | Type | Description |
|-----------|--------|------|-------------|
| PackagePieces | `order.line_items.length` | array | Array of pieces info |

### Package Pieces Structure
```json
{
  "pieceNo": "order.line_items.length",
  "ItemCategoryId": 0,
  "PersistanceInstruction": 1,
  "hasItemCategoryError": false
}
```

## Validation Flags
All validation flags are static:
```json
{
  "HasError": false,
  "HaveCOD": false,
  "hasCompanyNameError": false,
  "hasStreetError": false,
  "hasCustomerNameError": false,
  "hasMobileError": false
  // ... other validation flags
}
```

## Additional Configuration
```json
{
  "UserId": 22376,
  "HubEnterPoint": 1,
  "HubId": null,
  "DestinationHubId": null,
  "ActualServiceDate": "Jun 18, 2025, 2:48:36 AM" // Next day with same time
}
```

## Feature Flags
```json
{
  "IsFulfillment": false,
  "ApplyVerification": false,
  "CanPackageWeightEdit": true,
  "confirmedLocation": true,
  "IsSaveAddressBook": false
}
```

## Customer Address Information
| Parameter | Source | Type | Description |
|-----------|--------|------|-------------|
| CustomerAddress.Street | `order.shipping_address.address1` + `order.shipping_address.address2` | string | Full street address in Arabic |
| CityName | Translated from `order.shipping_address.city` | string | City name in Arabic (e.g., "القاهرة") |
| AddressCategoryId | Static | number | Always 1 |

### Address Source
The address information is available in the OrderCard component through:
```typescript
order.shipping_address = {
  address1: string;
  address2?: string;
  city: string;
  province: string;
  zip: string;
}
```

| Parameter | Source | Type | Description |
|-----------|--------|------|-------------|
| CityId | Shopify tag `mylerz_city_id:1` | string | City identifier (e.g., "1") |
| NeighborhoodId | Shopify tag `mylerz_neighborhood_id:280` | string | Neighborhood identifier (e.g., "280") |
| SubZoneId | Shopify tag `mylerz_subzone_id:282` | string | Sub-zone identifier (e.g., "282") |

## Phone Number Formatting
When extracting the phone number from `order.customer.phone`, ensure proper formatting:
- If number starts with "0", replace with "20"
- If number starts with "+20", remove the "+"
- If number doesn't start with "20" or "0", prepend "20"

## Date Formatting
- ServiceDate: Use current date in ISO format (e.g., "2025-06-17T23:48:36.678Z")
- ActualServiceDate: Use next day with same time in format "Jun 18, 2025, 2:48:36 AM"