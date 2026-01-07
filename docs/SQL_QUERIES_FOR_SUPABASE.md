# SQL Queries for Supabase - Financial System

Copy and paste these queries into your Supabase SQL Editor to create all required tables.

## 1. Product Costs Table

```sql
-- Product Cost Configuration
CREATE TABLE product_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  crochet_labor_per_unit DECIMAL(10,2) NOT NULL,
  yarn_cost_per_unit DECIMAL(10,2) NOT NULL,
  helper_colors_cost_per_unit DECIMAL(10,2) NOT NULL,
  laser_felt_cost_per_unit DECIMAL(10,2) NOT NULL,
  packaging_per_unit DECIMAL(10,2) NOT NULL,
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

-- Index for faster lookups
CREATE INDEX idx_product_costs_product_id ON product_costs(product_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_product_costs_updated_at BEFORE UPDATE ON product_costs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## 2. Financial Expenses Table (Unified - Production Costs + Operating Expenses)

```sql
-- Financial Expenses (unified table for both production costs and operating expenses)
CREATE TABLE financial_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN (
    'Ads', 
    'Media Buyer Fixed', 
    'Packaging Bulk', 
    'Packaging',
    'Material Shipping', 
    'Raw Materials',
    'Material Delivery',
    'Production Labor',
    'Tools & Misc', 
    'Tools & Equipment',
    'Utilities & Rent',
    'Professional Services',
    'Other'
  )),
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  date DATE NOT NULL,
  month TEXT NOT NULL, -- YYYY-MM
  notes TEXT,
  expense_type TEXT NOT NULL DEFAULT 'operating' CHECK (expense_type IN ('production', 'operating')),
  product_id TEXT, -- Only for production expenses
  product_name TEXT, -- Only for production expenses
  quantity INTEGER, -- Only for production expenses
  unit_cost DECIMAL(10,2), -- Only for production expenses
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX idx_financial_expenses_month ON financial_expenses(month);
CREATE INDEX idx_financial_expenses_category ON financial_expenses(category);
CREATE INDEX idx_financial_expenses_date ON financial_expenses(date);
CREATE INDEX idx_financial_expenses_type ON financial_expenses(expense_type);

-- Trigger to update updated_at
CREATE TRIGGER update_financial_expenses_updated_at BEFORE UPDATE ON financial_expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## 3. Shipping Records Table

```sql
-- Shipping Ledger
CREATE TABLE shipping_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id INTEGER, -- Shopify order ID (nullable for batch entries)
  type TEXT NOT NULL CHECK (type IN ('Company', 'Uber')),
  customer_shipping_charged DECIMAL(10,2) NOT NULL CHECK (customer_shipping_charged >= 0),
  actual_shipping_cost DECIMAL(10,2) NOT NULL CHECK (actual_shipping_cost >= 0),
  status TEXT NOT NULL CHECK (status IN ('Delivered', 'Cancelled')),
  date DATE NOT NULL,
  month TEXT NOT NULL, -- YYYY-MM
  invoice_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX idx_shipping_records_month ON shipping_records(month);
CREATE INDEX idx_shipping_records_type ON shipping_records(type);
CREATE INDEX idx_shipping_records_status ON shipping_records(status);
CREATE INDEX idx_shipping_records_order_id ON shipping_records(order_id);

-- Trigger to update updated_at
CREATE TRIGGER update_shipping_records_updated_at BEFORE UPDATE ON shipping_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## 4. Monthly Profits Table

```sql
-- Monthly Profit (calculated by Profit Engine)
CREATE TABLE monthly_profits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT UNIQUE NOT NULL, -- YYYY-MM
  revenue DECIMAL(10,2) NOT NULL DEFAULT 0,
  cogs DECIMAL(10,2) NOT NULL DEFAULT 0,
  gross_profit DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_expenses DECIMAL(10,2) NOT NULL DEFAULT 0,
  shipping_loss DECIMAL(10,2) NOT NULL DEFAULT 0,
  operating_profit DECIMAL(10,2) NOT NULL DEFAULT 0,
  dpp DECIMAL(10,2) NOT NULL DEFAULT 0, -- Distributable Profit Pool
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_monthly_profits_month ON monthly_profits(month);

-- Trigger to update updated_at
CREATE TRIGGER update_monthly_profits_updated_at BEFORE UPDATE ON monthly_profits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Note:** If you already have the `monthly_profits` table, run this migration to add the missing columns:

```sql
-- Migration: Add total_expenses and shipping_loss columns to monthly_profits
ALTER TABLE monthly_profits 
ADD COLUMN IF NOT EXISTS total_expenses DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_loss DECIMAL(10,2) NOT NULL DEFAULT 0;
```

## 5. Payout Configuration Table

```sql
-- Payout Configuration (single row table)
CREATE TABLE payout_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_buyer_percent DECIMAL(5,2) DEFAULT 3.00 CHECK (media_buyer_percent >= 0 AND media_buyer_percent <= 100),
  ops_percent DECIMAL(5,2) DEFAULT 10.00 CHECK (ops_percent >= 0 AND ops_percent <= 100),
  crm_percent DECIMAL(5,2) DEFAULT 7.50 CHECK (crm_percent >= 0 AND crm_percent <= 100),
  owner_pay_type TEXT NOT NULL CHECK (owner_pay_type IN ('fixed', 'percent')),
  owner_pay_value DECIMAL(10,2) NOT NULL CHECK (owner_pay_value >= 0),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO payout_config (media_buyer_percent, ops_percent, crm_percent, owner_pay_type, owner_pay_value)
VALUES (3.00, 10.00, 7.50, 'percent', 0);

-- Trigger to update updated_at
CREATE TRIGGER update_payout_config_updated_at BEFORE UPDATE ON payout_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## 6. Monthly Payouts Table

```sql
-- Monthly Payouts (calculated)
CREATE TABLE monthly_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT NOT NULL UNIQUE, -- YYYY-MM
  dpp DECIMAL(10,2) NOT NULL DEFAULT 0, -- Distributable Profit Pool
  media_buyer_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  ops_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  crm_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  owner_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  net_business_profit DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_monthly_payouts_month ON monthly_payouts(month);

-- Trigger to update updated_at
CREATE TRIGGER update_monthly_payouts_updated_at BEFORE UPDATE ON monthly_payouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Verification Queries

After running the above queries, verify the tables were created:

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'product_costs',
    'financial_expenses',
    'shipping_records',
    'monthly_profits',
    'payout_config',
    'monthly_payouts'
  )
ORDER BY table_name;

-- Check payout_config has default values
SELECT * FROM payout_config;

-- Check indexes
SELECT 
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'product_costs',
    'financial_expenses',
    'shipping_records',
    'monthly_profits',
    'payout_config',
    'monthly_payouts'
  )
ORDER BY tablename, indexname;
```

**Note:** The `financial_expenses` table now handles both production costs and operating expenses using the `expense_type` field:
- `expense_type = 'production'`: Production costs (includes product_id, product_name, quantity, unit_cost)
- `expense_type = 'operating'`: Operating expenses (Ads, Media Buyer Fixed, etc.)

**Migration Note:** If you already have separate `production_costs` and `financial_expenses` tables, see `docs/SQL_MIGRATION_UNIFIED_EXPENSES.md` for migration instructions.

**Note:** If you already have the `monthly_profits` table, run this migration to add cash-flow fields:

```sql
-- Migration: Add cash-flow based fields to monthly_profits
ALTER TABLE monthly_profits 
ADD COLUMN IF NOT EXISTS production_costs_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS cash_dpp DECIMAL(10,2) NOT NULL DEFAULT 0;
```

## Notes

1. All monetary values use `DECIMAL(10,2)` for precision (supports up to 99,999,999.99 EGP)
2. The `month` field is stored as TEXT in `YYYY-MM` format for easy querying
3. The `total_unit_cost` in `product_costs` is a generated column that automatically calculates the sum
4. The `payout_config` table should only have one row (enforced by application logic)
5. All tables have `created_at` and `updated_at` timestamps
6. The `update_updated_at_column()` function is created once and reused by all triggers
7. **Production Costs** table tracks cash flow (when costs are paid), separate from COGS (when products are sold)

