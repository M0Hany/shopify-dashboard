# SQL: Update Expense Categories

Run this SQL query to add "Production Labor" category and clarify that payouts are NOT expenses.

## Step 1: Add Production Labor Category

```sql
-- Drop existing constraint
ALTER TABLE financial_expenses 
DROP CONSTRAINT IF EXISTS financial_expenses_category_check;

-- Add new constraint with Production Labor category
ALTER TABLE financial_expenses 
ADD CONSTRAINT financial_expenses_category_check 
CHECK (category IN (
  -- Existing categories
  'Ads',
  'Media Buyer Fixed',
  'Packaging Bulk',
  'Packaging',
  'Material Shipping',
  'Raw Materials',
  'Material Delivery',
  'Tools & Misc',
  'Tools & Equipment',
  'Utilities & Rent',
  'Professional Services',
  'Other',
  
  -- New category
  'Production Labor'  -- Piece work (pcs), crochet labor - ONLY labor expense
));
```

## Step 2: Migrate Production Pieces to Production Labor

```sql
-- Migrate "Other" production expenses (pcs) to "Production Labor"
UPDATE financial_expenses
SET category = 'Production Labor'
WHERE category = 'Other'
  AND expense_type = 'production'
  AND (notes ILIKE '%pcs%' OR notes ILIKE '%piece%' OR notes ILIKE '%labor%' OR notes ILIKE '%crochet%');
```

## Step 3: Verify Migration

```sql
-- Check production labor expenses
SELECT 
  category,
  COUNT(*) as count,
  SUM(amount) as total
FROM financial_expenses
WHERE expense_type = 'production'
  AND month = '2025-12'
GROUP BY category
ORDER BY total DESC;

-- Verify no "Other" production expenses remain (if all were pcs)
SELECT COUNT(*) as remaining_other_production
FROM financial_expenses
WHERE category = 'Other'
  AND expense_type = 'production'
  AND month = '2025-12';
```

## Important Notes

1. **Production Labor** is the ONLY labor expense category
2. **Media Buyer, Ops, CRM payments are PAYOUTS**, not expenses
   - They are calculated FROM DPP in the Payouts module
   - They should NOT be added as expenses
   - They are shown in the Payouts tab, not Expenses tab
3. **Final Net Profit** = DPP - All Payouts (shown in Payouts tab)

## Category Usage Guide

### Production Expenses (`expense_type = 'production'`)
- **Raw Materials**: Yarn, fiber, felt, fabric
- **Production Labor**: Piece work (pcs), crochet labor
- **Material Delivery**: Delivery costs for materials
- **Packaging**: Packaging supplies

### Operating Expenses (`expense_type = 'operating'`)
- **Ads**: Marketing and advertising
- **Media Buyer Fixed**: Only if there are fixed costs (not commissions)
- **Tools & Equipment**: Tools, equipment, machinery
- **Utilities & Rent**: Office rent, utilities, internet
- **Professional Services**: Legal, accounting, consulting
- **Other**: Anything else

### NOT Expenses (These are Payouts)
- Media Buyer commission (3% of DPP) → Calculated in Payouts
- Operations commission (10% of DPP) → Calculated in Payouts
- CRM commission (7.5% of DPP) → Calculated in Payouts
- Owner payout → Calculated in Payouts


