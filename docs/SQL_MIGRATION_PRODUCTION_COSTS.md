# SQL Migration: Production Costs & Cash Flow DPP

Run these SQL queries in your Supabase SQL Editor to add support for cash-flow based DPP calculations.

## Step 1: Create Production Costs Table

```sql
-- Production Costs (tracks when production costs are paid, not when products are sold)
-- This is used for cash-flow based DPP calculation
CREATE TABLE production_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL, -- Shopify product ID
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost DECIMAL(10,2) NOT NULL CHECK (unit_cost >= 0),
  total_cost DECIMAL(10,2) NOT NULL CHECK (total_cost >= 0),
  date DATE NOT NULL, -- Date when production cost was paid
  month TEXT NOT NULL, -- YYYY-MM (for grouping)
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX idx_production_costs_month ON production_costs(month);
CREATE INDEX idx_production_costs_product_id ON production_costs(product_id);
CREATE INDEX idx_production_costs_date ON production_costs(date);

-- Trigger to update updated_at
CREATE TRIGGER update_production_costs_updated_at BEFORE UPDATE ON production_costs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Step 2: Add Cash Flow Fields to Monthly Profits Table

```sql
-- Migration: Add cash-flow based fields to monthly_profits
ALTER TABLE monthly_profits 
ADD COLUMN IF NOT EXISTS production_costs_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS cash_dpp DECIMAL(10,2) NOT NULL DEFAULT 0;
```

## Step 3: Verify Migration

```sql
-- Check production_costs table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'production_costs';

-- Check monthly_profits has new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'monthly_profits'
  AND column_name IN ('production_costs_paid', 'cash_dpp');

-- Check indexes
SELECT 
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'production_costs'
ORDER BY indexname;
```

## Notes

- **production_costs_paid**: Tracks production costs paid in the month (cash flow basis)
- **cash_dpp**: Cash-flow based Distributable Profit Pool = Revenue - Production Costs - Expenses - Shipping Net
- The `update_updated_at_column()` function should already exist from previous migrations
- All existing profit calculations will continue to work (backward compatible)


