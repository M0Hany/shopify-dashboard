# Financial Flow Explanation

## Understanding the Two Types of Costs

### 1. Expenses (Subtracted from Revenue to Calculate DPP)

These are actual costs that reduce your profit:

**Production Expenses** (`expense_type = 'production'`):
- Raw Materials (yarn, fiber, felt, fabric)
- **Production Labor** (piece work/pcs, crochet labor) ← ONLY labor expense
- Material Delivery (delivery costs for materials)
- Packaging (packaging supplies)

**Operating Expenses** (`expense_type = 'operating'`):
- Ads (marketing and advertising)
- Tools & Equipment
- Utilities & Rent
- Professional Services
- Other operating costs

### 2. Payouts (Calculated FROM DPP, Not Expenses)

These are distributions FROM profit, not expenses:

- **Media Buyer** (3% of DPP)
- **Operations** (10% of DPP)
- **CRM** (7.5% of DPP)
- **Owner** (fixed or % of DPP)

**Important:** These are NOT expenses! They are calculated FROM DPP after all expenses are subtracted.

## Complete Financial Flow

```
Revenue (Cash Received)
  ↓
- Production Costs Paid (when paid, not when sold)
  ↓
- Operating Expenses (Ads, Tools, etc.)
  ↓
+ Shipping Profit/Loss
  ↓
= Cash DPP (Distributable Profit Pool)
  ↓
- Media Buyer Payout (3% of DPP)
- Operations Payout (10% of DPP)
- CRM Payout (7.5% of DPP)
- Owner Payout (fixed or %)
  ↓
= Final Net Profit (For You)
```

## Where to Add Each Type

### Add as Expenses (in Expenses Tab or Bulk Add):
- ✅ Production pieces (pcs) → Category: "Production Labor"
- ✅ Raw materials (yarn, fiber, felt) → Category: "Raw Materials"
- ✅ Material delivery costs → Category: "Material Delivery"
- ✅ Packaging → Category: "Packaging"
- ✅ Ads → Category: "Ads"
- ✅ Tools, equipment → Category: "Tools & Equipment"
- ✅ Utilities, rent → Category: "Utilities & Rent"

### Add as Payouts (in Payouts Tab):
- ✅ Media Buyer commission → Automatically calculated (3% of DPP)
- ✅ Operations commission → Automatically calculated (10% of DPP)
- ✅ CRM commission → Automatically calculated (7.5% of DPP)
- ✅ Owner payout → Automatically calculated (based on config)

**Do NOT add payouts as expenses!** They are automatically calculated from DPP.

## Example: December 2025

### Expenses (Subtracted from Revenue):
- Production Labor (pcs): 12,420 EGP
- Raw Materials (yarn, fiber, felt): ~8,000 EGP
- Material Delivery: ~1,200 EGP
- Packaging: 480 EGP
- Ads: 11,427 EGP
- **Total Expenses: ~33,527 EGP**

### Payouts (From DPP):
- Media Buyer: 3% of DPP
- Operations: 10% of DPP
- CRM: 7.5% of DPP
- Owner: Based on config
- **Total Payouts: Calculated from DPP**

### Final Calculation:
```
Revenue: X EGP
- Production Costs: 31,850 EGP
- Operating Expenses: 15,427 EGP
+ Shipping Net: Y EGP
= Cash DPP: Z EGP

Then:
Cash DPP: Z EGP
- Media Buyer: Z × 3%
- Operations: Z × 10%
- CRM: Z × 7.5%
- Owner: Based on config
= Final Net Profit (For You)
```

## Key Points

1. **Production Labor (pcs) is the ONLY labor expense** - Add in Expenses tab
2. **Media Buyer, Ops, CRM are payouts** - Calculated automatically in Payouts tab
3. **DPP = Revenue - All Expenses** - This is what's available for distribution
4. **Final Net Profit = DPP - All Payouts** - This is your actual profit
5. **Payouts are NOT expenses** - They don't reduce DPP, they're distributed FROM DPP

## UI Locations

- **Expenses Tab**: Add production costs and operating expenses
- **Profit Overview Tab**: See DPP and Final Net Profit
- **Payouts Tab**: See all payouts and Final Net Profit breakdown


