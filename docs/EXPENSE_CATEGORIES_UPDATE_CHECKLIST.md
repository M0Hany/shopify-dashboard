# Expense Categories Update Checklist

## ✅ Already Updated (No Action Needed)

### Frontend
- ✅ `frontend/src/services/financialService.ts` - Types updated with all new categories
- ✅ `frontend/src/components/finance/FinancialExpensesTab.tsx` - Category dropdown updated
- ✅ `frontend/src/components/finance/BulkExpenseEntryModal.tsx` - Auto-categorization updated
- ✅ `backend/src/types/financial.ts` - Types updated with all new categories

### Backend
- ✅ `backend/src/services/financial/expenseService.ts` - Supports all categories
- ✅ `backend/src/routes/financial.ts` - Routes updated

## ⚠️ REQUIRED: Database Update

**You MUST run this SQL query in Supabase** to update the database constraint:

```sql
-- Drop existing constraint
ALTER TABLE financial_expenses 
DROP CONSTRAINT IF EXISTS financial_expenses_category_check;

-- Add new constraint with all categories
ALTER TABLE financial_expenses 
ADD CONSTRAINT financial_expenses_category_check 
CHECK (category IN (
  -- Existing categories (backward compatible)
  'Ads',
  'Media Buyer Fixed',
  'Packaging Bulk',
  'Material Shipping',
  'Tools & Misc',
  'Other',
  
  -- New categories
  'Packaging',
  'Raw Materials',
  'Material Delivery',
  'Production Labor',
  'Tools & Equipment',
  'Utilities & Rent',
  'Professional Services'
));
```

**Location:** `docs/SQL_MIGRATION_EXPENSE_CATEGORIES_COMPLETE.md` has the complete migration script.

## 📋 Summary

### What's Already Done
- ✅ Frontend code updated
- ✅ Backend code updated
- ✅ Types updated
- ✅ UI components updated

### What You Need to Do
- ⚠️ **Run SQL migration** to update database constraint (see above)
- ⚠️ **Optional:** Migrate existing data to use new categories (see migration doc)

## Current Categories Available

**Production Categories:**
- Raw Materials
- Production Labor (ONLY labor expense)
- Material Delivery
- Packaging / Packaging Bulk

**Operating Categories:**
- Ads
- Media Buyer Fixed
- Tools & Equipment / Tools & Misc
- Utilities & Rent
- Professional Services
- Other

## Important Notes

1. **Database constraint MUST be updated** - Without this, you cannot use new categories
2. **Backward compatible** - Old categories still work
3. **Production Labor** is the ONLY labor expense category
4. **Media Buyer, Ops, CRM are payouts** (not expenses) - calculated in Payouts tab


