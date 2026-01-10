# Financial System Integration Overview

## Executive Summary

This document outlines the financial system architecture that integrates with the existing Shopify dashboard. The system follows a **profit recognition on fulfillment** model, where revenue and costs are recognized only when orders are marked as `fulfilled`. The system is designed to be fully automated, transparent, and aligned with the existing order lifecycle and tag-based architecture.

---

## 1️⃣ What You Already Have (And We Keep)

### ✅ Existing Financial Logic (DO NOT CHANGE)

Your dashboard already implements the core financial principles:

- **`fulfilled` tag = Profit Recognition Event**
  - Orders with `fulfilled` tag are counted as delivered
  - Revenue is recognized when this tag is present
  - This is the **only** status that generates profit

- **`cancelled` tag = No Revenue**
  - Orders with `cancelled` tag never enter profit calculations
  - Shipping losses from cancelled orders are tracked separately

- **Shipping Loss Handled Separately**
  - Shipping is treated as its own profit center
  - Cancelled orders after shipping create shipping losses

- **Cash ≠ Profit**
  - `paid` tag indicates cash received (separate from fulfillment)
  - Profit is recognized on fulfillment, not payment
  - Cash timing does not affect profit calculations

- **Tags Drive Logic (Good for Automation)**
  - All financial logic is tag-based
  - Easy to query and automate
  - No complex state management needed

### 🔒 What We Will NOT Change

- Order lifecycle (pending → order_ready → confirmed → shipped → fulfilled)
- Tag system structure
- Fulfillment logic
- Shopify sync mechanism
- Order status transitions
- Existing order filtering and display logic

**We only extend the system with new financial modules.**

---

## 2️⃣ New Mental Model: 3 Financial Layers

The financial system operates in three distinct layers:

### Layer A — Configuration (Rarely Changes)
**"How money SHOULD be calculated"**

- Product cost per unit definitions
- Commission percentages
- Owner pay structure (fixed or percentage)
- Expense categories

**Characteristics:**
- Set once, reused everywhere
- Changes infrequently (only when costs change)
- Drives all calculations

### Layer B — Inputs (Manual Entry)
**"What actually happened"**

- Expense entries (Ads, Packaging, etc.)
- Shipping records (actual costs vs. charged)
- Product cost updates (when materials change)

**Characteristics:**
- User-entered data
- Historical record of actual events
- Feeds into automated calculations

### Layer C — Engines (Fully Automated)
**"What is my profit and what's hurting me?"**

- Profit Engine (calculates monthly profit automatically)
- Shipping Profit/Loss Calculator
- Commission Calculator
- Product Margin Analyzer

**Characteristics:**
- Runs automatically on data changes
- No manual calculation needed
- Real-time updates

---

## 3️⃣ New Modules to Add

### Module 1: Product Cost Config (CORE MODULE)

**📍 Most Important Module in the Entire System**

#### Purpose
Define unit economics once, reuse everywhere. This eliminates the need for inventory valuation and provides accurate cost-per-unit for profit calculations.

#### Data Model

```typescript
interface ProductCost {
  id: string;
  product_id: string;              // Shopify product ID
  product_name: string;             // Display name
  crochet_labor_per_unit: number;  // EGP
  yarn_cost_per_unit: number;       // EGP
  helper_colors_cost_per_unit: number; // EGP
  laser_felt_cost_per_unit: number;    // EGP
  packaging_per_unit: number;          // EGP (cards + zipper only)
  total_unit_cost: number;             // Calculated: sum of above
  updated_at: string;                  // ISO date
  created_at: string;                  // ISO date
}
```

#### ⚠️ DO NOT Include in Product Cost

These are handled elsewhere:
- **Shipping flyer** (2 EGP per order, added at fulfillment)
- **Ads** (monthly expense)
- **Overheads** (monthly expenses)

#### How It's Used

When an order is fulfilled:

```typescript
// For each line item in fulfilled order
COGS += (item.quantity × productCost.total_unit_cost)

// Add shipping flyer cost (once per order)
COGS += 2 // EGP per order
```

#### Integration Points

- **Orders Table**: Join `line_items[].product_id` with `ProductCost.product_id`
- **Profit Engine**: Uses this for COGS calculation
- **Product Margin Dashboard**: Shows cost vs. selling price

---

### Module 2: Expense Tracker

**📍 Answers "What's hurting me?"**

#### Purpose
Track monthly expenses that affect operating profit. These expenses are **never** attached to individual orders.

#### Expense Categories (Locked)

```typescript
type ExpenseCategory =
  | "Ads"
  | "Media Buyer Fixed"
  | "Packaging Bulk"
  | "Material Shipping"
  | "Tools & Misc"
  | "Other";
```

#### Data Model

```typescript
interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;        // EGP
  date: string;          // ISO date
  month: string;         // YYYY-MM (for grouping)
  notes?: string;        // Optional description
  created_at: string;
  updated_at: string;
}
```

#### Rules

1. Expenses are **monthly** (grouped by month for profit calculations)
2. Expenses do **NOT** attach to orders
3. Expenses affect **Operating Profit** (not COGS)
4. Each expense must have a category

#### Dashboard Views

- **Expense Breakdown by Category**: Pie chart or bar chart
- **Month-over-Month Comparison**: Line chart showing trends
- **% of Revenue per Category**: Critical insight (e.g., "Ads = 38% of revenue")

#### Integration Points

- **Profit Engine**: Subtracts monthly expenses from Gross Profit
- **Finance Dashboard**: Shows expense trends and pain points

---

### Module 3: Shipping Ledger

**📍 Fixes Shipping Chaos Permanently**

#### Purpose
Track shipping as its own profit center. Handles both company shipping (Shipblu, etc.) and Uber shipping separately.

#### Data Model

```typescript
interface ShippingRecord {
  id: string;
  order_id?: number;                    // Shopify order ID (nullable for batch entries)
  type: "Company" | "Uber";             // Shipping method
  customer_shipping_charged: number;    // EGP (what customer paid)
  actual_shipping_cost: number;         // EGP (what we paid)
  status: "Delivered" | "Cancelled";   // Order status
  date: string;                         // ISO date
  invoice_id?: string;                   // Optional: shipping company invoice
  month: string;                        // YYYY-MM (for grouping)
  created_at: string;
  updated_at: string;
}
```

#### Logic

For each shipping record:

```typescript
shipping_profit = customer_shipping_charged - actual_shipping_cost
```

**Cancelled Orders:**
- `customer_shipping_charged = 0` (no revenue)
- `actual_shipping_cost > 0` (we still paid)
- Result: **Pure loss** (negative shipping profit)

#### Monthly Shipping Summary

```typescript
MonthlyShippingPL = Σ(shipping_profit) for all records in month
```

This plugs directly into Operating Profit calculation.

#### Integration Points

- **Orders Table**: Can auto-create records when order is `shipped` or `cancelled`
- **Profit Engine**: Adds shipping profit/loss to Operating Profit
- **Shipping Dashboard**: Shows Uber vs. Company performance

---

### Module 4: Profit Engine (Fully Automated)

**📍 The Heart — No Manual Input**

#### Purpose
Automatically calculate profit whenever data changes. Runs on:
- Order fulfillment
- Expense addition
- Shipping record update
- Product cost change

#### Step-by-Step Calculation (LOCKED)

##### 1️⃣ Revenue

```typescript
Revenue = 
  Σ(fulfilled_orders.items_revenue) +    // Line items total (no shipping)
  Σ(fulfilled_orders.shipping_charged)   // Shipping charged to customer
```

**Source**: Orders with `fulfilled` tag, grouped by month.

##### 2️⃣ Cost of Goods Sold (COGS)

```typescript
COGS = 
  Σ(fulfilled_orders × product_unit_cost) +  // From ProductCost table
  (fulfilled_orders_count × 2)               // Shipping flyer (2 EGP per order)
```

**Source**: 
- Join fulfilled orders with ProductCost table
- Add 2 EGP flyer cost per order

##### 3️⃣ Gross Profit

```typescript
Gross Profit = Revenue - COGS
```

##### 4️⃣ Operating Profit

```typescript
Operating Profit = 
  Gross Profit
  - Ads (monthly expense)
  - Monthly Expenses (all categories)
  + Shipping Profit/Loss (can be negative)
```

⚠️ **Note**: Shipping is **added** here because it can be negative (losses).

##### 5️⃣ Distributable Profit Pool (DPP)

```typescript
DPP = Operating Profit
```

**This is the ONLY number commissions are calculated from.**

#### Monthly Profit Record

```typescript
interface MonthlyProfit {
  month: string;                    // YYYY-MM
  revenue: number;
  cogs: number;
  gross_profit: number;
  operating_profit: number;
  dpp: number;
  created_at: string;
  updated_at: string;
}
```

#### Integration Points

- **Orders Table**: Queries fulfilled orders by month
- **ProductCost Table**: Joins for COGS calculation
- **Expense Tracker**: Gets monthly expenses
- **Shipping Ledger**: Gets monthly shipping profit/loss
- **Finance Dashboard**: Displays profit breakdown

---

### Module 5: Payouts Module (Commissions + Owner)

**📍 Prevents Fights and Confusion**

#### Purpose
Calculate and display who gets paid what, based on real profit. Fully transparent and automated.

#### Data Model

```typescript
interface PayoutConfig {
  id: string;
  media_buyer_percent: number;      // Default: 3
  ops_percent: number;              // Default: 10
  crm_percent: number;              // Default: 7.5
  owner_pay_type: "fixed" | "percent";
  owner_pay_value: number;          // Fixed amount or percentage
  updated_at: string;
}

interface MonthlyPayout {
  id: string;
  month: string;                    // YYYY-MM
  dpp: number;                      // Distributable Profit Pool
  media_buyer_amount: number;
  ops_amount: number;
  crm_amount: number;
  owner_amount: number;
  net_business_profit: number;       // Remaining after all payouts
  created_at: string;
  updated_at: string;
}
```

#### Calculations

```typescript
// From DPP (Distributable Profit Pool)
media_buyer = DPP × 0.03
ops = DPP × 0.10
crm = DPP × 0.075

// Owner pay (one of two options)
if (owner_pay_type === "fixed") {
  owner_amount = owner_pay_value;
} else {
  owner_amount = DPP × (owner_pay_value / 100);
}

// Net Business Profit (reinvestment pool)
net_business_profit = DPP - media_buyer - ops - crm - owner_amount
```

#### Payout Order (Locked)

1. Pay all real costs (COGS, expenses)
2. Calculate Net Operating Profit
3. Calculate DPP
4. Pay commissions (Media Buyer, Ops, CRM)
5. Pay owner (fixed or percent)
6. Remaining stays in business

**No circular math. No arguments.**

#### Dashboard View

- **Who gets paid what**: Table showing all payouts
- **Based on real profit**: Transparent calculation
- **Monthly breakdown**: See trends over time

#### Integration Points

- **Profit Engine**: Uses DPP from monthly profit
- **Finance Dashboard**: Shows payout breakdown
- **Settings**: Configure commission percentages

---

## 4️⃣ Adjustments to Existing System (VERY SMALL)

### 🔧 Adjustment 1: Add `fulfilled_at` Date

**Ensure every fulfilled order has:**

```typescript
// In Order interface
fulfilled_at?: string;  // ISO date string (YYYY-MM-DD)
```

**When order is marked as fulfilled:**
- Set `fulfilled_at = current_date` if not already set
- This drives:
  - **Delivered month** (for profit grouping)
  - **Profit month** (which month's profit this order belongs to)

**Implementation:**
- Update `updateStatusMutation` in `Orders.tsx` to set `fulfilled_at` when status becomes `fulfilled`
- Backend should store this in order metadata or tags (`fulfilled_at:YYYY-MM-DD`)

### 🔧 Adjustment 2: Shipping Flyer Logic

**On fulfillment:**

```typescript
// Add to COGS calculation
COGS += 2; // EGP per order (shipping flyer)
```

**Rules:**
- Only once per order (not per line item)
- Only for fulfilled orders
- Hardcoded at 2 EGP (can be made configurable later)

**Implementation:**
- Profit Engine automatically adds 2 EGP per fulfilled order
- No manual entry needed

### 🔧 Adjustment 3: Cancelled After Shipped

**Ensure:**

1. **Cancelled orders NEVER enter Orders Profit Engine**
   - Filter: `tags.includes('cancelled')` → exclude from revenue/COGS
   - Already handled by existing `filterOrdersByStatus` logic

2. **BUT DO enter Shipping Ledger**
   - If order was shipped before cancellation:
     - Create ShippingRecord with `status: "Cancelled"`
     - `customer_shipping_charged = 0`
     - `actual_shipping_cost = actual_cost` (we still paid)
     - This creates a shipping loss

**Implementation:**
- Shipping Ledger can auto-create records when order status changes to `cancelled` and has `shipped` tag
- Or manual entry for cancelled shipments

---

## 5️⃣ Key Dashboards You'll Unlock

### 📊 Profit Overview Dashboard

**Main Metrics:**
- Revenue (items + shipping)
- Gross Profit (Revenue - COGS)
- Operating Profit (Gross - Expenses + Shipping)
- Net Business Profit (after all payouts)

**Views:**
- Monthly breakdown (table)
- Trend chart (line graph)
- Month-over-month comparison

**Data Source:**
- MonthlyProfit table (from Profit Engine)

---

### 📦 Product Margins Dashboard

**Metrics:**
- Cost per unit (from ProductCost)
- Average selling price (from fulfilled orders)
- Margin % (selling price - cost) / selling price
- Units sold per month

**Views:**
- Product margin table (sorted by margin %)
- Margin trend chart
- High/low margin products

**Data Source:**
- ProductCost table + Orders (fulfilled) grouped by product

---

### 🚚 Shipping Performance Dashboard

**Metrics:**
- Shipping profit/loss (total)
- Uber vs. Company comparison
- Cancelled order losses
- Average shipping margin

**Views:**
- Monthly shipping P&L
- Method comparison (Uber vs. Company)
- Cancelled order impact

**Data Source:**
- ShippingLedger table grouped by month and type

---

### 💸 Expense Pain Points Dashboard

**Metrics:**
- Total expenses by category
- % of revenue per category
- Month-over-month expense trends
- Expense efficiency (expense / revenue)

**Views:**
- Expense breakdown (pie chart)
- Category trends (line chart)
- Revenue % indicators (bar chart with thresholds)

**Data Source:**
- Expense table grouped by category and month

---

### 👥 Payouts Dashboard

**Metrics:**
- Who gets paid what (Media Buyer, Ops, CRM, Owner)
- Payout as % of DPP
- Net Business Profit (remaining)
- Payout trends over time

**Views:**
- Monthly payout breakdown (table)
- Payout distribution (pie chart)
- Payout trends (line chart)

**Data Source:**
- MonthlyPayout table

---

## 6️⃣ Database Schema Overview

### New Tables to Create

```sql
-- Product Cost Configuration
CREATE TABLE product_costs (
  id UUID PRIMARY KEY,
  product_id TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  crochet_labor_per_unit DECIMAL(10,2),
  yarn_cost_per_unit DECIMAL(10,2),
  helper_colors_cost_per_unit DECIMAL(10,2),
  laser_felt_cost_per_unit DECIMAL(10,2),
  packaging_per_unit DECIMAL(10,2),
  total_unit_cost DECIMAL(10,2) GENERATED ALWAYS AS (
    crochet_labor_per_unit + 
    yarn_cost_per_unit + 
    helper_colors_cost_per_unit + 
    laser_felt_cost_per_unit + 
    packaging_per_unit
  ) STORED,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Expenses
CREATE TABLE expenses (
  id UUID PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('Ads', 'Media Buyer Fixed', 'Packaging Bulk', 'Material Shipping', 'Tools & Misc', 'Other')),
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  month TEXT NOT NULL, -- YYYY-MM
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Shipping Ledger
CREATE TABLE shipping_records (
  id UUID PRIMARY KEY,
  order_id INTEGER, -- Shopify order ID (nullable)
  type TEXT NOT NULL CHECK (type IN ('Company', 'Uber')),
  customer_shipping_charged DECIMAL(10,2) NOT NULL,
  actual_shipping_cost DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Delivered', 'Cancelled')),
  date DATE NOT NULL,
  month TEXT NOT NULL, -- YYYY-MM
  invoice_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Monthly Profit (calculated by Profit Engine)
CREATE TABLE monthly_profits (
  id UUID PRIMARY KEY,
  month TEXT UNIQUE NOT NULL, -- YYYY-MM
  revenue DECIMAL(10,2) NOT NULL,
  cogs DECIMAL(10,2) NOT NULL,
  gross_profit DECIMAL(10,2) NOT NULL,
  operating_profit DECIMAL(10,2) NOT NULL,
  dpp DECIMAL(10,2) NOT NULL, -- Distributable Profit Pool
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Payout Configuration
CREATE TABLE payout_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_buyer_percent DECIMAL(5,2) DEFAULT 3.00,
  ops_percent DECIMAL(5,2) DEFAULT 10.00,
  crm_percent DECIMAL(5,2) DEFAULT 7.50,
  owner_pay_type TEXT NOT NULL CHECK (owner_pay_type IN ('fixed', 'percent')),
  owner_pay_value DECIMAL(10,2) NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Monthly Payouts (calculated)
CREATE TABLE monthly_payouts (
  id UUID PRIMARY KEY,
  month TEXT NOT NULL, -- YYYY-MM
  dpp DECIMAL(10,2) NOT NULL,
  media_buyer_amount DECIMAL(10,2) NOT NULL,
  ops_amount DECIMAL(10,2) NOT NULL,
  crm_amount DECIMAL(10,2) NOT NULL,
  owner_amount DECIMAL(10,2) NOT NULL,
  net_business_profit DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(month)
);
```

### Existing Tables (No Changes)

- **Orders**: Keep as-is, just ensure `fulfilled_at` is set when `fulfilled` tag is added

---

## 7️⃣ API Endpoints Needed

### Product Costs
- `GET /api/finance/product-costs` - List all product costs
- `POST /api/finance/product-costs` - Create product cost
- `PUT /api/finance/product-costs/:id` - Update product cost
- `DELETE /api/finance/product-costs/:id` - Delete product cost

### Expenses
- `GET /api/finance/expenses?month=YYYY-MM` - Get expenses for month
- `POST /api/finance/expenses` - Create expense
- `PUT /api/finance/expenses/:id` - Update expense
- `DELETE /api/finance/expenses/:id` - Delete expense

### Shipping Ledger
- `GET /api/finance/shipping?month=YYYY-MM` - Get shipping records for month
- `POST /api/finance/shipping` - Create shipping record
- `PUT /api/finance/shipping/:id` - Update shipping record
- `DELETE /api/finance/shipping/:id` - Delete shipping record

### Profit Engine
- `GET /api/finance/profit?month=YYYY-MM` - Get monthly profit (triggers calculation if needed)
- `POST /api/finance/profit/calculate?month=YYYY-MM` - Force recalculate profit for month
- `GET /api/finance/profit/summary?startMonth=YYYY-MM&endMonth=YYYY-MM` - Get profit summary for date range

### Payouts
- `GET /api/finance/payouts?month=YYYY-MM` - Get monthly payouts
- `GET /api/finance/payout-config` - Get payout configuration
- `PUT /api/finance/payout-config` - Update payout configuration
- `POST /api/finance/payouts/calculate?month=YYYY-MM` - Calculate payouts for month

### Dashboards
- `GET /api/finance/dashboard/product-margins` - Product margins data
- `GET /api/finance/dashboard/shipping-performance` - Shipping performance data
- `GET /api/finance/dashboard/expense-breakdown?month=YYYY-MM` - Expense breakdown

---

## 8️⃣ Frontend Components Structure

### Finance Page (`frontend/src/pages/Finance.tsx`)

```typescript
// Main tabs:
- Profit Overview
- Product Margins
- Shipping Performance
- Expenses
- Payouts
- Settings (Product Costs, Payout Config)
```

### Component Structure

```
frontend/src/components/finance/
├── ProfitOverview.tsx          // Main profit dashboard
├── ProductMargins.tsx          // Product margin analysis
├── ShippingPerformance.tsx     // Shipping P&L
├── ExpensesTab.tsx             // Expense tracker (existing)
├── PayoutsTab.tsx              // Commissions and owner pay
├── ProductCostConfig.tsx       // Product cost management
├── ShippingLedger.tsx          // Shipping record management
└── PayoutConfig.tsx            // Commission configuration
```

---

## 9️⃣ Integration Flow Example

### When Order is Fulfilled

1. **Order Status Update** (existing)
   - User clicks "Mark Fulfilled" in Orders page
   - `updateStatusMutation` sets `fulfilled` tag
   - Backend sets `fulfilled_at: YYYY-MM-DD` tag

2. **Profit Engine Trigger** (new)
   - Backend detects `fulfilled` tag added
   - Queries order line items
   - Joins with ProductCost table
   - Calculates COGS for this order
   - Updates MonthlyProfit for the month

3. **Dashboard Update** (new)
   - Finance page automatically refreshes
   - Profit Overview shows updated numbers
   - Product Margins updates if product is new

### When Expense is Added

1. **User Enters Expense** (new)
   - User goes to Finance → Expenses tab
   - Fills form: category, amount, date
   - Submits to `POST /api/finance/expenses`

2. **Profit Engine Recalculates** (new)
   - Backend detects new expense
   - Recalculates Operating Profit for the month
   - Updates MonthlyProfit record

3. **Dashboard Updates** (new)
   - Profit Overview shows new Operating Profit
   - Expense Pain Points shows updated breakdown

---

## 🔟 Key Principles (Locked Forever)

1. **Profit is recognized only when products are sold** (`fulfilled` tag)
2. **Cash timing does NOT affect profit** (`paid` tag is separate)
3. **Inventory complexity is intentionally skipped** (no WIP valuation)
4. **Shipping is its own profit center** (tracked separately)
5. **Commissions are calculated from DPP only** (no circular math)
6. **Expenses are monthly, not per-order** (simplifies everything)

---

## 📝 Next Steps

1. **Backend Implementation**
   - Create database tables
   - Implement API endpoints
   - Build Profit Engine calculation logic
   - Add `fulfilled_at` tracking to order updates

2. **Frontend Implementation**
   - Build Finance page components
   - Create Product Cost Config UI
   - Build Expense Tracker UI
   - Create Shipping Ledger UI
   - Build Profit Overview dashboard
   - Create Product Margins dashboard

3. **Testing**
   - Test profit calculations with sample data
   - Verify cancelled orders don't affect profit
   - Test shipping profit/loss calculations
   - Verify commission calculations

4. **Migration**
   - Set up initial Product Cost data
   - Backfill historical expenses (if available)
   - Calculate profit for current month

---

## 🎯 Success Criteria

The system is successful when:

- ✅ Profit is calculated automatically when orders are fulfilled
- ✅ Product margins are visible and accurate
- ✅ Shipping profit/loss is clearly tracked
- ✅ Expenses show pain points (% of revenue)
- ✅ Payouts are transparent and automated
- ✅ No manual profit calculations needed
- ✅ Historical data is preserved and queryable

---

*This document serves as the integration guide for the financial system. All modules are designed to work seamlessly with the existing dashboard architecture while maintaining the tag-based order lifecycle.*







