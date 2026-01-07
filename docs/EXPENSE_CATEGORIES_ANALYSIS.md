# Expense Categories Analysis & Recommendations

## Current Categories

The system currently has these expense categories:

1. **Ads** - Marketing and advertising expenses
2. **Media Buyer Fixed** - Fixed media buyer costs
3. **Packaging Bulk** - Bulk packaging purchases
4. **Material Shipping** - Material shipping costs (confusing name - used for both materials AND shipping)
5. **Tools & Misc** - Tools and miscellaneous items
6. **Other** - Catch-all category

## Issues with Current Categories

Based on your December 2025 expenses, I see these problems:

1. **"Material Shipping" is confusing** - It's being used for:
   - Raw materials (yarn, fiber, felt, materials)
   - Delivery/shipping costs
   - These are different things!

2. **"Other" is overused** - Currently used for:
   - Production pieces (pcs) - 12,420 EGP
   - Salaries (Ammar salary) - 4,000 EGP
   - These should have dedicated categories

3. **Missing categories** for common expenses:
   - Labor/Salaries
   - Production Labor/Piece Work
   - Raw Materials (separate from shipping)

## Recommended New Category Structure

### For Production Expenses (`expense_type = 'production'`)

1. **Raw Materials** - Yarn, fiber, felt, fabric, etc.
2. **Production Labor** - Piece work (pcs), crochet labor, assembly
3. **Material Delivery** - Delivery costs for materials
4. **Packaging** - Packaging supplies (cards, zippers, bags)
5. **Other Production** - Other production-related costs

### For Operating Expenses (`expense_type = 'operating'`)

1. **Ads** - Marketing and advertising expenses
2. **Media Buyer Fixed** - Fixed media buyer costs (if any fixed costs, otherwise use payouts)
3. **Tools & Equipment** - Tools, equipment, machinery
4. **Utilities & Rent** - Office rent, utilities, internet
5. **Professional Services** - Legal, accounting, consulting
6. **Other Operating** - Other operating expenses

**Note:** Media Buyer, Operations, and CRM payments are **NOT expenses** - they are **payouts calculated FROM DPP**. Only production labor (pcs) is an expense.

## Proposed Complete Category List

```typescript
export type FinancialExpenseCategory =
  // Production Categories
  | "Raw Materials"           // Yarn, fiber, felt, fabric
  | "Production Labor"        // Piece work (pcs), crochet labor - ONLY labor expense
  | "Material Delivery"       // Delivery costs for materials
  | "Packaging"               // Packaging supplies
  
  // Operating Categories
  | "Ads"                     // Marketing and advertising
  | "Media Buyer Fixed"        // Fixed media buyer costs (if any)
  | "Tools & Equipment"        // Tools, equipment, machinery
  | "Utilities & Rent"         // Office rent, utilities, internet
  | "Professional Services"    // Legal, accounting, consulting
  
  // General
  | "Other";                  // Catch-all for anything else

// IMPORTANT: Media Buyer, Ops, CRM payments are PAYOUTS (from DPP), NOT expenses!
// They are calculated in the Payouts module, not tracked as expenses.
```

## Migration Strategy

### Option 1: Add New Categories (Recommended)
- Keep existing categories for backward compatibility
- Add new categories
- Gradually migrate old expenses to new categories

### Option 2: Replace Categories
- Replace "Material Shipping" with "Raw Materials" and "Material Delivery"
- Replace "Other" usage with "Production Labor" and "Labor"
- Requires data migration

## Category Mapping for December 2025 Expenses

| Current Category | Expense | Recommended New Category |
|-----------------|---------|-------------------------|
| Material Shipping | Yarn, fiber, felt, materials | **Raw Materials** |
| Material Shipping | Delivery costs | **Material Delivery** |
| Other | Production pieces (pcs) | **Production Labor** |
| Other | Ammar salary | **Labor** |
| Packaging Bulk | Packaging | **Packaging** |
| Ads | Ads | **Ads** |

## SQL Migration Query

```sql
-- Add new categories to the CHECK constraint
ALTER TABLE financial_expenses 
DROP CONSTRAINT IF EXISTS financial_expenses_category_check;

ALTER TABLE financial_expenses 
ADD CONSTRAINT financial_expenses_category_check 
CHECK (category IN (
  'Ads',
  'Media Buyer Fixed',
  'Packaging Bulk',
  'Packaging',
  'Material Shipping',
  'Raw Materials',
  'Material Delivery',
  'Production Labor',
  'Labor',
  'Tools & Misc',
  'Tools & Equipment',
  'Utilities & Rent',
  'Professional Services',
  'Other'
));
```

## Recommendation

**Start with Option 1** - Add new categories while keeping old ones:
- Add: "Raw Materials", "Production Labor", "Material Delivery", "Labor"
- Keep: All existing categories for backward compatibility
- Use new categories for future expenses
- Optionally migrate old expenses later

This gives you:
- ✅ Better categorization for production vs operating expenses
- ✅ Clear separation of materials vs delivery costs
- ✅ Dedicated category for labor/salaries
- ✅ Backward compatibility with existing data
- ✅ No breaking changes

