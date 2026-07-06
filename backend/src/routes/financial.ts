import { Router, Request, Response } from 'express';
import { expenseService } from '../services/financial/expenseService';
import { shippingLedgerService } from '../services/financial/shippingLedgerService';
import { profitEngineService } from '../services/financial/profitEngineService';
import { financeMonthService, getShippingRecordsForMonth } from '../services/financial/financeMonthService';
import { financeMonthSnapshotService } from '../services/financial/financeMonthSnapshotService';
import { isPastFinanceMonth } from '../utils/financeMonth';
import { logger } from '../utils/logger';

const router = Router();

// ==================== Expenses ====================
router.get('/expenses', async (req: Request, res: Response) => {
  try {
    const month = req.query.month as string | undefined;
    const expenseType = req.query.expense_type as string | undefined;
    const expenses = await expenseService.getAll(month, expenseType as any);
    res.json(expenses);
  } catch (error: any) {
    logger.error('Error fetching expenses:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch expenses' });
  }
});

router.get('/expenses/:id', async (req: Request, res: Response) => {
  try {
    const expense = await expenseService.getById(req.params.id);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.json(expense);
  } catch (error: any) {
    logger.error('Error fetching expense:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch expense' });
  }
});

router.post('/expenses', async (req: Request, res: Response) => {
  try {
    const expense = await expenseService.create(req.body);
    res.status(201).json(expense);
  } catch (error: any) {
    logger.error('Error creating expense:', error);
    res.status(500).json({ error: error.message || 'Failed to create expense' });
  }
});

router.put('/expenses/:id', async (req: Request, res: Response) => {
  try {
    const expense = await expenseService.update(req.params.id, req.body);
    res.json(expense);
  } catch (error: any) {
    logger.error('Error updating expense:', error);
    res.status(500).json({ error: error.message || 'Failed to update expense' });
  }
});

router.delete('/expenses/:id', async (req: Request, res: Response) => {
  try {
    await expenseService.delete(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error deleting expense:', error);
    res.status(500).json({ error: error.message || 'Failed to delete expense' });
  }
});

// ==================== Shipping Ledger ====================
router.get('/shipping', async (req: Request, res: Response) => {
  try {
    const month = req.query.month as string | undefined;
    if (!month) {
      const manualRecords = await shippingLedgerService.getAll();
      res.json(manualRecords);
      return;
    }

    const allRecords = await getShippingRecordsForMonth(month);
    allRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json(allRecords);
  } catch (error: any) {
    logger.error('Error fetching shipping records:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch shipping records' });
  }
});

router.get('/shipping/:id', async (req: Request, res: Response) => {
  try {
    const record = await shippingLedgerService.getById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: 'Shipping record not found' });
    }
    res.json(record);
  } catch (error: any) {
    logger.error('Error fetching shipping record:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch shipping record' });
  }
});

router.post('/shipping', async (req: Request, res: Response) => {
  try {
    const record = await shippingLedgerService.create(req.body);
    res.status(201).json(record);
  } catch (error: any) {
    logger.error('Error creating shipping record:', error);
    res.status(500).json({ error: error.message || 'Failed to create shipping record' });
  }
});

router.put('/shipping/:id', async (req: Request, res: Response) => {
  try {
    const record = await shippingLedgerService.update(req.params.id, req.body);
    res.json(record);
  } catch (error: any) {
    logger.error('Error updating shipping record:', error);
    res.status(500).json({ error: error.message || 'Failed to update shipping record' });
  }
});

router.delete('/shipping/:id', async (req: Request, res: Response) => {
  try {
    await shippingLedgerService.delete(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error deleting shipping record:', error);
    res.status(500).json({ error: error.message || 'Failed to delete shipping record' });
  }
});

// ==================== Finance month bundle (single request per month) ====================
router.get('/month/:month', async (req: Request, res: Response) => {
  try {
    const month = req.params.month;
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Month must be YYYY-MM' });
    }
    res.set({ 'Cache-Control': 'no-store' });
    const bundle = await financeMonthService.getMonthBundle(month);
    res.json(bundle);
  } catch (error: any) {
    const msg = error?.message || 'Failed to fetch finance month';
    logger.error(`Error fetching finance month bundle: ${msg}`);
    res.status(500).json({ error: msg });
  }
});

router.post('/month/:month/calculate', async (req: Request, res: Response) => {
  try {
    const month = req.params.month;
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Month must be YYYY-MM' });
    }
    const bundle = await financeMonthService.calculateAndSaveMonth(month);
    res.json(bundle);
  } catch (error: any) {
    const msg = error?.message || 'Failed to calculate finance month';
    logger.error(`Error calculating finance month: ${msg}`);
    res.status(500).json({ error: msg });
  }
});

// ==================== Profit Engine ====================
router.get('/profit', async (req: Request, res: Response) => {
  try {
    const month = req.query.month as string;
    if (!month) {
      return res.status(400).json({ error: 'Month parameter is required (YYYY-MM)' });
    }
    const profit = await profitEngineService.getMonthlyProfitRow(month);
    if (!profit) {
      return res.status(404).json({ error: 'Profit not found for this month' });
    }
    res.json(profit);
  } catch (error: any) {
    logger.error('Error fetching profit:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch profit' });
  }
});

router.post('/profit/calculate', async (req: Request, res: Response) => {
  try {
    const month = req.query.month as string || req.body.month;
    if (!month) {
      return res.status(400).json({ error: 'Month parameter is required (YYYY-MM)' });
    }
    const bundle = await financeMonthService.calculateAndSaveMonth(month);
    res.json(bundle.profit);
  } catch (error: any) {
    logger.error('Error calculating profit:', error);
    res.status(500).json({ error: error.message || 'Failed to calculate profit' });
  }
});

router.get('/profit/summary', async (req: Request, res: Response) => {
  try {
    const startMonth = req.query.startMonth as string;
    const endMonth = req.query.endMonth as string;
    if (!startMonth || !endMonth) {
      return res.status(400).json({ error: 'startMonth and endMonth parameters are required (YYYY-MM)' });
    }
    const summary = await profitEngineService.getProfitSummary(startMonth, endMonth);
    res.json(summary);
  } catch (error: any) {
    logger.error('Error fetching profit summary:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch profit summary' });
  }
});

router.get('/profit/orders', async (req: Request, res: Response) => {
  try {
    const month = req.query.month as string;
    if (!month) {
      return res.status(400).json({ error: 'Month parameter is required (YYYY-MM)' });
    }
    const orders = await profitEngineService.getFulfilledOrdersForMonth(month);
    res.json(orders);
  } catch (error: any) {
    logger.error('Error fetching fulfilled orders:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch fulfilled orders' });
  }
});

router.get('/profit/cancelled-orders', async (req: Request, res: Response) => {
  try {
    const month = req.query.month as string;
    if (!month) {
      return res.status(400).json({ error: 'Month parameter is required (YYYY-MM)' });
    }
    const orders = await profitEngineService.getCancelledOrdersWithShippingCosts(month);
    res.json(orders);
  } catch (error: any) {
    logger.error('Error fetching cancelled orders:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch cancelled orders' });
  }
});

// ==================== Dashboard Endpoints ====================
router.get('/dashboard/product-margins', async (req: Request, res: Response) => {
  try {
    // This will be implemented to calculate product margins
    // For now, return empty array
    res.json([]);
  } catch (error: any) {
    logger.error('Error fetching product margins:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch product margins' });
  }
});

router.get('/dashboard/shipping-performance', async (req: Request, res: Response) => {
  try {
    const month = req.query.month as string;
    if (!month) {
      return res.status(400).json({ error: 'Month parameter is required (YYYY-MM)' });
    }

    const snapshot = await financeMonthSnapshotService.get(month);
    if (isPastFinanceMonth(month) && snapshot?.shipping_summary) {
      const s = snapshot.shipping_summary;
      const scooter = Number(s.scooterProfitLoss) || 0;
      const company = Number(s.companyProfitLoss) || 0;
      return res.json({
        month,
        total_profit_loss: scooter + company,
        uber_profit_loss: scooter,
        company_profit_loss: company,
        cancelled_losses: 0,
      });
    }

    const fulfilledOrders = await profitEngineService.getFulfilledOrdersForMonth(month);
    const scooterShippingProfitLoss = await profitEngineService.calculateScooterShippingProfitLoss(
      fulfilledOrders,
      month
    );
    const companyShippingProfitLoss = await profitEngineService.calculateCompanyShippingProfitLoss(
      fulfilledOrders,
      month
    );

    res.json({
      month,
      total_profit_loss: scooterShippingProfitLoss + companyShippingProfitLoss,
      uber_profit_loss: scooterShippingProfitLoss,
      company_profit_loss: companyShippingProfitLoss,
      cancelled_losses: 0,
    });
  } catch (error: any) {
    logger.error('Error fetching shipping performance:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch shipping performance' });
  }
});

router.get('/dashboard/expense-breakdown', async (req: Request, res: Response) => {
  try {
    const month = req.query.month as string;
    if (!month) {
      return res.status(400).json({ error: 'Month parameter is required (YYYY-MM)' });
    }

    const byCategory = await expenseService.getByCategory(month);
    const monthlyProfit = await profitEngineService.getMonthlyProfitRow(month);
    const revenue = monthlyProfit?.revenue || 0;

    const breakdown = Object.entries(byCategory).map(([category, amount]) => ({
      category,
      total_amount: amount,
      percent_of_revenue: revenue > 0 ? (amount / revenue) * 100 : 0,
      month,
    }));

    res.json(breakdown);
  } catch (error: any) {
    logger.error('Error fetching expense breakdown:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch expense breakdown' });
  }
});

export default router;

