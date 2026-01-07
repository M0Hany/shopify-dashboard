# SQL Migration: Complete Expense Categories Update

Run this SQL query to update the database constraint with all new expense categories.

## Step 1: Update Category Constraint (REQUIRED)

```sql
-- Drop existing constraint
ALTER TABLE financial_expenses 
DROP CONSTRAINT IF EXISTS financial_expenses_category_check;

-- Add new constraint with all categories (old + new)
ALTER TABLE financial_expenses 
ADD CONSTRAINT financial_expenses_category_check 
CHECK (category IN (
  -- Existing categories (kept for backward compatibility)
  'Ads',
  'Media Buyer Fixed',
  'Packaging Bulk',
  'Material Shipping',
  'Tools & Misc',
  'Other',
  
  -- New categories
  'Packaging',               -- Alternative to Packaging Bulk
  'Raw Materials',           -- Yarn, fiber, felt, fabric
  'Material Delivery',       -- Delivery costs for materials
  'Production Labor',        -- Piece work (pcs), crochet labor - ONLY labor expense
  'Tools & Equipment',       -- Alternative to Tools & Misc
  'Utilities & Rent',        -- Office rent, utilities, internet
  'Professional Services'    -- Legal, accounting, consulting
));
```

## Step 2: Verify Constraint

```sql
-- Check constraint exists
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'financial_expenses'::regclass
  AND conname = 'financial_expenses_category_check';
```

## Step 3: Test Insert (Optional)

```sql
-- Test that new categories work
INSERT INTO financial_expenses (category, amount, date, month, notes, expense_type)
VALUES 
  ('Production Labor', 100, CURRENT_DATE, TO_CHAR(CURRENT_DATE, 'YYYY-MM'), 'Test', 'production'),
  ('Raw Materials', 200, CURRENT_DATE, TO_CHAR(CURRENT_DATE, 'YYYY-MM'), 'Test', 'production'),
  ('Material Delivery', 50, CURRENT_DATE, TO_CHAR(CURRENT_DATE, 'YYYY-MM'), 'Test', 'production')
ON CONFLICT DO NOTHING;

-- Clean up test data
DELETE FROM financial_expenses WHERE notes = 'Test';
```

## Step 4: Migrate Existing Data (Optional - Recommended)

```sql
-- Migrate "Other" production expenses that are actually production labor
UPDATE financial_expenses
SET category = 'Production Labor'
WHERE category = 'Other'
  AND expense_type = 'production'
  AND (notes ILIKE '%pcs%' OR notes ILIKE '%piece%' OR notes ILIKE '%labor%' OR notes ILIKE '%crochet%');

-- Migrate "Material Shipping" to more specific categories based on notes
UPDATE financial_expenses
SET category = CASE
  WHEN notes ILIKE '%delivery%' OR notes ILIKE '%shipping%' THEN 'Material Delivery'
  WHEN notes ILIKE '%yarn%' OR notes ILIKE '%fiber%' OR notes ILIKE '%felt%' OR notes ILIKE '%material%' THEN 'Raw Materials'
  ELSE category  -- Keep original if unclear
END
WHERE category = 'Material Shipping'
  AND expense_type = 'production';
```

## Verification

```sql
-- Check all categories in use
SELECT 
  category,
  expense_type,
  COUNT(*) as count,
  SUM(amount) as total
FROM financial_expenses
GROUP BY category, expense_type
ORDER BY expense_type, category;

-- Check for any invalid categories (should return 0 rows)
SELECT DISTINCT category
FROM financial_expenses
WHERE category NOT IN (
  'Ads', 'Media Buyer Fixed', 'Packaging Bulk', 'Packaging', 
  'Material Shipping', 'Raw Materials', 'Material Delivery', 
  'Production Labor', 'Tools & Misc', 'Tools & Equipment', 
  'Utilities & Rent', 'Professional Services', 'Other'
);
```

## Notes

- **Backward Compatible**: All existing categories remain valid
- **No Data Loss**: Existing expenses keep their current categories
- **Gradual Migration**: You can migrate data over time or keep using old categories
- **Frontend Updated**: The frontend already supports all new categories


