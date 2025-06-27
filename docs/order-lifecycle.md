# Shopify Order Lifecycle Automation Blueprint

## Overview
- **Business Type**: Handmade crochet products (on-demand production)
- **Manual Steps**: Single confirmation when item is made
- **Integration Points**: Shopify Dashboard, WhatsApp Cloud API, Shipping Company API

## Order Status Lifecycle

| Status | Description |
|--------|-------------|
| `pending` | New order, initial state |
| `customer_confirmed` | Customer confirmed lead time, order in production |
| `ready_to_ship` | Product completed, awaiting customer delivery confirmation |
| `shipped` | Order picked up by shipping company |
| `fulfilled` | Order successfully delivered |
| `paid` | Payment received and confirmed |
| `cancelled` | Order cancelled by customer |

## Automated Process Flow

### 1. Order Creation
- **Trigger**: New Shopify order
- **Actions**:
  - Create order in dashboard
  - Set status: `pending`
  - Send lead time confirmation WhatsApp message

### 2. Production Confirmation
- **Trigger**: Customer WhatsApp response
- **Actions**:
  - If confirmed: Set status to `customer_confirmed`
  - If cancelled: Set status to `cancelled`

### 3. Product Completion
- **Trigger**: Manual team confirmation (item is made)
- **Actions**:
  - Set status to `ready_to_ship`
  - Automatically send delivery availability WhatsApp message
  - Await customer confirmation for 1-2 day delivery window

### 4. Delivery Scheduling
- **Trigger**: Customer delivery confirmation via WhatsApp
- **Actions**:
  - On confirmation:
    - Status remains `ready_to_ship`
    - Automatically create order in shipping portal
    - Await pickup by shipping company
  - On reschedule: Store new date for retry
  - On cancel: Set status to `cancelled`

### 5. Shipping Integration
- **Trigger**: Shipping order created and picked up
- **Actions**:
  - Set status to `shipped` on pickup
  - Send pickup notification WhatsApp message

### 6. Order Fulfillment
- **Trigger**: Delivery confirmation from shipping API
- **Actions**:
  - Set status to `fulfilled`
  - Send delivery confirmation WhatsApp message

## Special Cases

### Rescheduled Deliveries
- Store rescheduled date in order metadata
- Automated daily check for rescheduled orders
- Retry delivery confirmation process on rescheduled date

### Cancelled Orders
- Set status to `cancelled`
- No further automated actions
- Archive order in dashboard

## API Integration Details

### Shipping API
- **Trigger Point**: Customer confirms delivery availability
- **Required Data**:
  ```json
  {
    "customer_name": "string",
    "phone": "string",
    "address": "string",
    "reference": "string"
  }
  ```
- **Status Tracking**:
  - Webhook integration for real-time updates
  - Status mapping to dashboard states

### WhatsApp Integration
- **Required Templates**:
  1. Lead Time Confirmation
  2. Delivery Scheduling (Sent when product is ready)
  3. Pickup Notification
  4. Delivery Confirmation

## Dashboard Features
- Order status management
- Manual status override capabilities
- Shipping tracking integration
- WhatsApp message history
- Rescheduling management
- Order analytics and reporting
- Automated shipping portal integration 