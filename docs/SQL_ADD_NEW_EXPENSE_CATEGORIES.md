# SQL: Add New Expense Categories

Run this SQL query to add new expense categories while keeping existing ones for backward compatibility.

## Step 1: Update Category Constraint

```sql
-- Drop existing constraint
ALTER TABLE financial_expenses 
DROP CONSTRAINT IF EXISTS financial_expenses_category_check;

-- Add new constraint with all categories (old + new)
ALTER TABLE financial_expenses 
ADD CONSTRAINT financial_expenses_category_check 
CHECK (category IN (
  -- Existing categories (keep for backward compatibility)
  'Ads',
  'Media Buyer Fixed',
  'Packaging Bulk',
  'Material Shipping',
  'Tools & Misc',
  'Other',
  
  -- New categories
  'Raw Materials',           -- Yarn, fiber, felt, fabric
  'Production Labor',        -- Piece work (pcs), crochet labor
  'Material Delivery',       -- Delivery costs for materials
  'Packaging',               -- Packaging supplies (alternative to Packaging Bulk)
  'Labor',                   -- Salaries, wages, contractor payments
  'Tools & Equipment',       -- Tools, equipment, machinery (alternative to Tools & Misc)
  'Utilities & Rent',        -- Office rent, utilities, internet
  'Professional Services'    -- Legal, accounting, consulting
));
```

## Step 2: Verify Categories

```sql
-- Check all available categories
SELECT DISTINCT category, expense_type, COUNT(*) as count
FROM financial_expenses
GROUP BY category, expense_type
ORDER BY expense_type, category;
```

## Step 3: Optional - Migrate Existing Data

If you want to migrate existing expenses to new categories:

```sql
-- Migrate "Material Shipping" expenses to more specific categories
-- Based on notes/name, categorize as Raw Materials or Material Delivery
UPDATE financial_expenses
SET category = CASE
  WHEN notes ILIKE '%delivery%' OR notes ILIKE '%shipping%' THEN 'Material Delivery'
  WHEN notes ILIKE '%yarn%' OR notes ILIKE '%fiber%' OR notes ILIKE '%felt%' OR notes ILIKE '%material%' THEN 'Raw Materials'
  ELSE category  -- Keep original if unclear
END
WHERE category = 'Material Shipping'
  AND expense_type = 'production';

-- Migrate "Other" production expenses (pcs) to "Production Labor"
UPDATE financial_expenses
SET category = 'Production Labor'
WHERE category = 'Other'
  AND expense_type = 'production'
  AND (notes ILIKE '%pcs%' OR notes ILIKE '%piece%' OR notes ILIKE '%labor%');

-- Migrate "Other" operating expenses (salary) to "Labor"
UPDATE financial_expenses
SET category = 'Labor'
WHERE category = 'Other'
  AND expense_type = 'operating'
  AND (notes ILIKE '%salary%' OR notes ILIKE '%wage%' OR notes ILIKE '%pay%');
```

## Notes

- **Backward Compatible**: All existing categories remain valid
- **Gradual Migration**: You can migrate data over time or keep using old categories
- **New Expenses**: Use new categories for better organization
- **Production vs Operating**: Categories work for both expense types, but some make more sense for one type


