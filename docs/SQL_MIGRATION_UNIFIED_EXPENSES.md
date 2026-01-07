# SQL Migration: Unified Expenses Table

This migration consolidates `production_costs` and `financial_expenses` into a single `financial_expenses` table with an `expense_type` field.

## Step 1: Add expense_type to financial_expenses

```sql
-- Add expense_type column to distinguish production costs from operating expenses
ALTER TABLE financial_expenses 
ADD COLUMN IF NOT EXISTS expense_type TEXT NOT NULL DEFAULT 'operating' 
CHECK (expense_type IN ('production', 'operating'));

-- Add product_id and product_name for production costs (nullable for operating expenses)
ALTER TABLE financial_expenses 
ADD COLUMN IF NOT EXISTS product_id TEXT,
ADD COLUMN IF NOT EXISTS product_name TEXT,
ADD COLUMN IF NOT EXISTS quantity INTEGER,
ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(10,2);

-- Create index for expense_type for faster queries
CREATE INDEX IF NOT EXISTS idx_financial_expenses_type ON financial_expenses(expense_type);
```

## Step 2: Migrate production_costs data to financial_expenses

```sql
-- Migrate all production_costs to financial_expenses
INSERT INTO financial_expenses (
  category,
  amount,
  date,
  month,
  notes,
  expense_type,
  product_id,
  product_name,
  quantity,
  unit_cost,
  created_at,
  updated_at
)
SELECT 
  CASE 
    WHEN notes ILIKE '%packaging%' THEN 'Packaging Bulk'
    WHEN notes ILIKE '%material%' OR notes ILIKE '%yarn%' OR notes ILIKE '%fiber%' OR notes ILIKE '%felt%' THEN 'Material Shipping'
    ELSE 'Other'
  END as category,
  total_cost as amount,
  date,
  month,
  notes,
  'production' as expense_type,
  product_id,
  product_name,
  quantity,
  unit_cost,
  created_at,
  updated_at
FROM production_costs
WHERE NOT EXISTS (
  SELECT 1 FROM financial_expenses fe 
  WHERE fe.date = production_costs.date 
    AND fe.amount = production_costs.total_cost 
    AND fe.notes = production_costs.notes
);
```

## Step 3: Update existing financial_expenses to have expense_type

```sql
-- Set expense_type to 'operating' for all existing expenses (if not already set)
UPDATE financial_expenses 
SET expense_type = 'operating' 
WHERE expense_type IS NULL OR expense_type = '';
```

## Step 4: Drop production_costs table (optional - after verifying migration)

```sql
-- WARNING: Only run this after verifying all data was migrated correctly!
-- DROP TABLE IF EXISTS production_costs CASCADE;
```

## Step 5: Verify Migration

```sql
-- Check expense counts by type
SELECT 
  expense_type,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM financial_expenses
WHERE month = '2025-12'  -- Example month
GROUP BY expense_type;

-- Verify all production costs were migrated
SELECT 
  (SELECT COUNT(*) FROM production_costs) as production_costs_count,
  (SELECT COUNT(*) FROM financial_expenses WHERE expense_type = 'production') as migrated_production_count;
```

## Notes

- **expense_type**: 'production' for production costs, 'operating' for operating expenses
- **product_id/product_name**: Only populated for production expenses
- **quantity/unit_cost**: Only populated for production expenses
- **category**: Used for both types, but has different meanings:
  - Production: Material Shipping, Packaging Bulk, Other
  - Operating: Ads, Media Buyer Fixed, Packaging Bulk, Material Shipping, Tools & Misc, Other


