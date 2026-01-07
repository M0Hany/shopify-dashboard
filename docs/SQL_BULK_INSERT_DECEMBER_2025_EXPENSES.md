# SQL Queries: Bulk Insert December 2025 Expenses

Run these SQL queries in Supabase SQL Editor to add all December 2025 expenses directly to the database.

**Note:** This uses the unified `financial_expenses` table with `expense_type` field.

## Step 1: Insert Production Costs

```sql
-- Production Costs for December 2025 (using unified financial_expenses table)
INSERT INTO financial_expenses (category, amount, date, month, notes, expense_type, product_id, product_name, quantity, unit_cost)
VALUES
  ('Material Shipping', 360, '2025-12-01', '2025-12', 'Yasmin material', 'production', 'bulk-yasmin-material', 'Materials', 1, 360),
  ('Material Shipping', 120, '2025-12-01', '2025-12', 'Yasmin delivery', 'production', 'bulk-yasmin-delivery', 'Delivery', 1, 120),
  ('Material Shipping', 75, '2025-12-01', '2025-12', 'Soad delivery', 'production', 'bulk-soad-delivery', 'Delivery', 1, 75),
  ('Material Shipping', 3250, '2025-12-01', '2025-12', 'Yarn', 'production', 'bulk-yarn', 'Materials', 1, 3250),
  ('Material Shipping', 150, '2025-12-06', '2025-12', 'Ola delivery', 'production', 'bulk-ola-delivery', 'Delivery', 1, 150),
  ('Material Shipping', 100, '2025-12-06', '2025-12', 'Marcel delivery', 'production', 'bulk-marcel-delivery', 'Delivery', 1, 100),
  ('Other', 1540, '2025-12-06', '2025-12', 'Ola pcs', 'production', 'bulk-ola-pcs', 'Ola', 1, 1540),
  ('Other', 3645, '2025-12-06', '2025-12', 'Marcel pcs', 'production', 'bulk-marcel-pcs', 'Marcel', 1, 3645),
  ('Material Shipping', 4800, '2025-12-06', '2025-12', 'Felt pieces cut', 'production', 'bulk-felt-pieces', 'Materials', 1, 4800),
  ('Other', 300, '2025-12-07', '2025-12', 'Yasmin pcs', 'production', 'bulk-yasmin-pcs', 'Yasmin', 1, 300),
  ('Material Shipping', 60, '2025-12-07', '2025-12', 'Yasmin fiber', 'production', 'bulk-yasmin-fiber', 'Materials', 1, 60),
  ('Other', 1500, '2025-12-17', '2025-12', 'Amira pcs', 'production', 'bulk-amira-pcs', 'Amira', 1, 1500),
  ('Material Shipping', 145, '2025-12-21', '2025-12', 'Ola & Yasmin delivery', 'production', 'bulk-ola-yasmin-delivery', 'Delivery', 1, 145),
  ('Other', 3240, '2025-12-21', '2025-12', 'Ola pcs', 'production', 'bulk-ola-pcs-2', 'Ola', 1, 3240),
  ('Material Shipping', 80, '2025-12-22', '2025-12', 'Marcel delivery', 'production', 'bulk-marcel-delivery-2', 'Delivery', 1, 80),
  ('Other', 2800, '2025-12-22', '2025-12', 'Marcel pcs', 'production', 'bulk-marcel-pcs-2', 'Marcel', 1, 2800),
  ('Material Shipping', 145, '2025-12-22', '2025-12', 'Soad material', 'production', 'bulk-soad-material', 'Materials', 1, 145),
  ('Other', 1000, '2025-12-23', '2025-12', 'Yasmin pcs', 'production', 'bulk-yasmin-pcs-2', 'Yasmin', 1, 1000),
  ('Other', 1500, '2025-12-23', '2025-12', 'Soad pcs', 'production', 'bulk-soad-pcs', 'Soad', 1, 1500),
  ('Other', 2300, '2025-12-23', '2025-12', 'Amira pcs', 'production', 'bulk-amira-pcs-2', 'Amira', 1, 2300),
  ('Material Shipping', 80, '2025-12-23', '2025-12', 'Amira fiber', 'production', 'bulk-amira-fiber', 'Materials', 1, 80),
  ('Packaging Bulk', 480, '2025-12-25', '2025-12', 'Packaging', 'production', 'bulk-packaging', 'Packaging', 1, 480),
  ('Material Shipping', 100, '2025-12-26', '2025-12', 'Shaimaa & Soaad delivery', 'production', 'bulk-shaimaa-soaad-delivery', 'Delivery', 1, 100),
  ('Other', 1500, '2025-12-28', '2025-12', 'Amira pcs', 'production', 'bulk-amira-pcs-3', 'Amira', 1, 1500),
  ('Material Shipping', 110, '2025-12-28', '2025-12', 'Amira delivery', 'production', 'bulk-amira-delivery', 'Delivery', 1, 110),
  ('Other', 1100, '2025-12-28', '2025-12', 'Marcel pcs', 'production', 'bulk-marcel-pcs-3', 'Marcel', 1, 1100),
  ('Material Shipping', 90, '2025-12-28', '2025-12', 'Marcel delivery', 'production', 'bulk-marcel-delivery-3', 'Delivery', 1, 90),
  ('Other', 1540, '2025-12-28', '2025-12', 'Ola pcs', 'production', 'bulk-ola-pcs-3', 'Ola', 1, 1540),
  ('Material Shipping', 170, '2025-12-28', '2025-12', 'Ola delivery', 'production', 'bulk-ola-delivery-2', 'Delivery', 1, 170);
```

## Step 2: Insert Operating Expenses

```sql
-- Operating Expenses for December 2025
-- Note: "Ammar salary" should be a payout, not an expense. Only add if it's a fixed salary expense.
-- If it's a commission/payout, add it in the Payouts tab instead.
INSERT INTO financial_expenses (category, amount, date, month, notes, expense_type)
VALUES
  ('Ads', 11427, '2025-12-31', '2025-12', 'Ads', 'operating');
  
-- If Ammar salary is a fixed expense (not a payout), uncomment below:
-- ('Other', 4000, '2025-12-31', '2025-12', 'Ammar salary', 'operating'),
```

## Step 3: Verify Insertion

```sql
-- Check expenses by type
SELECT 
  expense_type,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM financial_expenses
WHERE month = '2025-12'
GROUP BY expense_type;

-- Summary
SELECT 
  (SELECT SUM(amount) FROM financial_expenses WHERE month = '2025-12' AND expense_type = 'production') as total_production_costs,
  (SELECT SUM(amount) FROM financial_expenses WHERE month = '2025-12' AND expense_type = 'operating') as total_operating_expenses,
  (SELECT SUM(amount) FROM financial_expenses WHERE month = '2025-12') as total_all_expenses;
```

## Expected Totals

- **Production Costs**: 31,850 EGP (30 expenses)
- **Operating Expenses**: 11,427 EGP (1 expense - Ads only)
- **Total Expenses**: 43,277 EGP

**Note:** If "Ammar salary" is a payout (commission), it should NOT be added as an expense. It will be calculated automatically in the Payouts tab.

## Notes

- All expenses are now in the unified `financial_expenses` table
- `expense_type` field distinguishes between 'production' and 'operating'
- Production expenses include product_id, product_name, quantity, and unit_cost
- Operating expenses only need category, amount, date, and notes
- After running these queries, recalculate profit for December 2025 to see updated DPP values.
