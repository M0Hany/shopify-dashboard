# 📊 OCD Crochet Finance Module

## Overview

The Finance Module extends the OCD Crochet dashboard with a comprehensive accounting system to track profits, expenses, cash flow, and partner settlements. This module seamlessly integrates with the existing Order Management system, maintaining consistent UI/UX patterns.

## 🎯 Core Objectives

- Track revenue from Shopify orders
- Manage business expenses and recurring costs
- Handle partner expense settlements
- Generate financial reports and insights
- Export data for accounting purposes

## 🔧 Technical Requirements

### Backend Infrastructure
- **Hosting:** Vercel
- **Database:** Free-tier options compatible with Vercel:
  - [Planetscale](https://planetscale.com/)
  - [Supabase](https://supabase.com/)
  - [Neon](https://neon.tech/)

### Data Sources
- **Revenue:** Automated sync with Shopify API
  - Only fulfilled orders count towards revenue
  - Cancelled orders handled separately
- **Expenses:** Manual entry and management
- **Export:** XLSX/CSV generation support
- **Authentication:** Inherited from main dashboard

## 🧮 Feature Specifications

### 1. Financial Dashboard

#### Revenue Overview
- **Total Revenue Display**
  - Fulfilled Orders (Primary metric)
  - Confirmed Orders (Secondary insight)
- **Profit/Loss Summary**
  - Based on fulfilled orders only
  - Clear visualization of margins
- **Time Range Filters**
  - Weekly view
  - Monthly view
  - Custom date range
  - Quick selectors (Last 7 days, Last 30 days, etc.)

### 2. Revenue Management

#### Shopify Integration
- **Order Data Collection**
  - Order number
  - Fulfillment date
  - Total amount
  - Delivery city
- **Revenue Calculations**
  ```
  Net Revenue = Order Total - Delivery Fee
  ```
  - Delivery fees based on predefined city rates

#### Order Status Handling
- **Fulfilled Orders:** Count as revenue
- **Cancelled Orders:**
  - Pre-shipping: Excluded from calculations
  - Post-shipping: Marked as loss
  - Loss calculation: Return shipping cost

### 3. Expense Management

#### Expense Entry Fields
- **Required Fields**
  - Title/Name
  - Amount
  - Date
  - Category
  - Paid By (Mohamed/Mariam/Both)
- **Optional Fields**
  - Notes
  - Shared (Yes/No)
  - Recurring (Monthly/No)
  
#### Expense Categories
- Yarn & Materials
- Packaging
- Marketing & Ads
- Equipment
- Labor
- Shipping & Delivery
- Miscellaneous

#### Expense States
- **Status**
  - Pending
  - Settled
- **Recurrence**
  - One-time
  - Monthly

### 4. Partner Settlement System

#### Core Principles
- Focus on expense reimbursement
- No profit sharing calculations
- Track shared expenses between Mohamed and Mariam

#### Settlement Features
- Expense assignment (Mohamed/Mariam)
- Shared expense tracking
- Settlement confirmation
- Running balance calculation
- Settlement history

### 5. Reporting System

#### Available Reports
- **Order Revenue Report**
  - Fulfilled orders only
  - Net revenue calculations
  - City-wise breakdown
- **Monthly Financial Summary**
  - Revenue totals
  - Expense breakdown
  - Net profit/loss
- **Partner Settlement Report**
  - Shared expenses
  - Settlement history
  - Current balances
- **Expense Analysis**
  - Category-wise breakdown
  - Monthly trends
  - Recurring vs one-time

#### Export Options
- XLSX format (primary)
- CSV format (alternative)
- Customizable date ranges
- Category/type filters

### 6. Filtering & Views

#### Global Filters
- Date range selection
- Category filtering
- Status filtering
- Partner selection

#### Order Filters
- Fulfillment status
- City/Region
- Date range
- Amount range

#### Expense Filters
- Category
- Paid by
- Settlement status
- Recurrence status

## 🎨 UI/UX Guidelines

### Visual Design
- Match existing dashboard aesthetics
- Responsive grid layout
- Clear data visualization
- Mobile-friendly interface

### Color Coding
```
Fulfilled:    #22C55E (Green)
Cancelled:    #EF4444 (Red)
Pending:      #F59E0B (Yellow)
Settled:      #6B7280 (Gray)
```

### Key UI Elements
- Add Expense FAB
- Settlement action buttons
- Export controls
- Filter panels
- Data tables/grids

## 📝 Data Models

```typescript
interface Order {
  id: string;
  shopifyOrderId: string;
  totalAmount: number;
  city: string;
  fulfilledAt: Date;
  deliveryFee: number;
  netRevenue: number;
  status: 'fulfilled' | 'cancelled' | 'loss';
}

interface Expense {
  id: string;
  title: string;
  amount: number;
  date: Date;
  category: ExpenseCategory;
  paidBy: 'Mohamed' | 'Mariam' | 'Both';
  shared: boolean;
  recurring: boolean;
  note?: string;
  settled: boolean;
  settledAt?: Date;
}

interface Settlement {
  id: string;
  partner: 'Mohamed' | 'Mariam';
  amount: number;
  date: Date;
  relatedExpenses: string[]; // Expense IDs
  note?: string;
}

interface PartnerBalance {
  partner: 'Mohamed' | 'Mariam';
  owedAmount: number;
  settledAmount: number;
  lastSettlement?: Date;
}
```

## 🔔 Notifications

### System Alerts
- Upcoming recurring expenses
- Large unsettled balances
- Monthly report generation
- Settlement confirmations

### Reminder System
- Monthly expense entry
- Settlement requests
- Report generation
- Balance thresholds

## 📈 Future Enhancements

- Automated expense categorization
- Bank integration for settlement tracking
- Advanced financial analytics
- Budget planning tools
- Tax calculation assistance
- Multi-currency support

---

*Last Updated: [Current Date]* 