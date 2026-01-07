import { Router, Request, Response } from 'express';
import { productCostService } from '../services/financial/productCostService';
import { expenseService } from '../services/financial/expenseService';
import { shippingLedgerService } from '../services/financial/shippingLedgerService';
import { profitEngineService } from '../services/financial/profitEngineService';
import { payoutService } from '../services/financial/payoutService';
import { ShippingType, ShippingStatus } from '../types/financial';
import { logger } from '../utils/logger';

const router = Router();

// ==================== Product Costs ====================
router.get('/product-costs', async (req: Request, res: Response) => {
  try {
    const costs = await productCostService.getAll();
    res.json(costs);
  } catch (error: any) {
    logger.error('Error fetching product costs:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch product costs' });
  }
});

router.get('/product-costs/:id', async (req: Request, res: Response) => {
  try {
    const cost = await productCostService.getById(req.params.id);
    if (!cost) {
      return res.status(404).json({ error: 'Product cost not found' });
    }
    res.json(cost);
  } catch (error: any) {
    logger.error('Error fetching product cost:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch product cost' });
  }
});

router.post('/product-costs', async (req: Request, res: Response) => {
  try {
    const cost = await productCostService.create(req.body);
    res.status(201).json(cost);
  } catch (error: any) {
    logger.error('Error creating product cost:', error);
    res.status(500).json({ error: error.message || 'Failed to create product cost' });
  }
});

router.put('/product-costs/:id', async (req: Request, res: Response) => {
  try {
    const cost = await productCostService.update(req.params.id, req.body);
    res.json(cost);
  } catch (error: any) {
    logger.error('Error updating product cost:', error);
    res.status(500).json({ error: error.message || 'Failed to update product cost' });
  }
});

router.delete('/product-costs/:id', async (req: Request, res: Response) => {
  try {
    await productCostService.delete(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error deleting product cost:', error);
    res.status(500).json({ error: error.message || 'Failed to delete product cost' });
  }
});

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
    
    // Get manual shipping records from database
    const manualRecords = await shippingLedgerService.getAll(month);
    
    // If month is specified, also get shipping costs from order tags
    let tagBasedRecords: any[] = [];
    if (month) {
      const fulfilledOrders = await profitEngineService.getFulfilledOrdersForMonth(month);
      const cancelledOrders = await profitEngineService.getCancelledOrdersWithShippingCosts(month);
      
      // Process fulfilled orders
      for (const order of fulfilledOrders) {
        const tags = Array.isArray(order.tags)
          ? order.tags
          : typeof order.tags === 'string'
            ? order.tags.split(',').map(t => t.trim())
            : [];

        // Check for shipping_company_cost tag
        const companyCostTag = tags.find((tag: string) => 
          tag.trim().startsWith('shipping_company_cost:')
        );

        if (companyCostTag) {
          const actualCost = parseFloat(companyCostTag.split(':')[1]?.trim() || '0');
          if (!isNaN(actualCost)) {
            // Get customer shipping charged
            let customerCharged = 0;
            if (order.total_shipping_price_set?.shop_money?.amount) {
              customerCharged = parseFloat(order.total_shipping_price_set.shop_money.amount || '0');
            } else if (order.shipping_lines && order.shipping_lines.length > 0) {
              customerCharged = order.shipping_lines.reduce((sum: number, line: any) => {
                return sum + parseFloat(line.price || '0');
              }, 0);
            }

            // Get transaction date from tag
            const costDateTag = tags.find((tag: string) => 
              tag.trim().startsWith('shipping_company_cost_date:')
            );
            const transactionDate = costDateTag 
              ? costDateTag.split(':')[1]?.trim() 
              : new Date().toISOString().split('T')[0];

            // Extract order number (e.g., "#1120" -> "1120")
            const orderNumber = order.name.replace(/[^0-9]/g, '');

            tagBasedRecords.push({
              id: `tag-${order.id}`,
              order_id: parseInt(orderNumber) || undefined,
              type: 'Company' as ShippingType,
              customer_shipping_charged: customerCharged,
              actual_shipping_cost: actualCost,
              status: 'Delivered' as ShippingStatus,
              date: transactionDate,
              month: month,
              invoice_id: undefined,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              isFromTag: true, // Flag to identify tag-based records
            });
          }
        }

        // Also check for scooter shipping costs
        const isScooter = tags.some((tag: string) => 
          tag.trim().toLowerCase().startsWith('shipping_method:') && 
          tag.trim().toLowerCase().includes('scooter')
        );

        if (isScooter) {
          const scooterCostTag = tags.find((tag: string) => 
            tag.trim().startsWith('scooter_shipping_cost:')
          );

          if (scooterCostTag) {
            const actualCost = parseFloat(scooterCostTag.split(':')[1]?.trim() || '0');
            if (!isNaN(actualCost)) {
              // Get customer shipping charged
              let customerCharged = 0;
              if (order.total_shipping_price_set?.shop_money?.amount) {
                customerCharged = parseFloat(order.total_shipping_price_set.shop_money.amount || '0');
              } else if (order.shipping_lines && order.shipping_lines.length > 0) {
                customerCharged = order.shipping_lines.reduce((sum: number, line: any) => {
                  return sum + parseFloat(line.price || '0');
                }, 0);
              } else {
                customerCharged = 50; // Default estimate
              }

              // Get paid date - ONLY use paid_date, no fallback
              const paidDateTag = tags.find((tag: string) => 
                tag.trim().startsWith('paid_date:')
              );
              const transactionDate = paidDateTag 
                ? paidDateTag.split(':')[1]?.trim() 
                : new Date().toISOString().split('T')[0];

              const orderNumber = order.name.replace(/[^0-9]/g, '');

              tagBasedRecords.push({
                id: `tag-scooter-${order.id}`,
                order_id: parseInt(orderNumber) || undefined,
                type: 'Uber' as ShippingType,
                customer_shipping_charged: customerCharged,
                actual_shipping_cost: actualCost,
                status: 'Delivered' as ShippingStatus,
                date: transactionDate,
                month: month,
                invoice_id: undefined,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                isFromTag: true,
              });
            }
          }
        }
      }

      // Process cancelled orders with shipping costs
      for (const order of cancelledOrders) {
        const tags = Array.isArray(order.tags)
          ? order.tags
          : typeof order.tags === 'string'
            ? order.tags.split(',').map(t => t.trim())
            : [];

        // Check for shipping_company_cost tag
        const companyCostTag = tags.find((tag: string) => 
          tag.trim().startsWith('shipping_company_cost:')
        );

        if (companyCostTag) {
          const actualCost = parseFloat(companyCostTag.split(':')[1]?.trim() || '0');
          if (!isNaN(actualCost)) {
            // For cancelled orders, customer was not charged (order was cancelled)
            const customerCharged = 0;

            // Get transaction date from tag
            const costDateTag = tags.find((tag: string) => 
              tag.trim().startsWith('shipping_company_cost_date:')
            );
            const paidDateTag = tags.find((tag: string) => 
              tag.trim().startsWith('paid_date:')
            );
            const transactionDate = costDateTag 
              ? costDateTag.split(':')[1]?.trim() 
              : paidDateTag
                ? paidDateTag.split(':')[1]?.trim()
                : new Date().toISOString().split('T')[0];

            // Extract order number (e.g., "#1120" -> "1120")
            const orderNumber = order.name.replace(/[^0-9]/g, '');

            tagBasedRecords.push({
              id: `tag-cancelled-${order.id}`,
              order_id: parseInt(orderNumber) || undefined,
              type: 'Company' as ShippingType,
              customer_shipping_charged: customerCharged,
              actual_shipping_cost: actualCost,
              status: 'Cancelled' as ShippingStatus,
              date: transactionDate,
              month: month,
              invoice_id: undefined,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              isFromTag: true, // Flag to identify tag-based records
            });
          }
        }
      }
    }

    // Combine manual records and tag-based records
    const allRecords = [...manualRecords, ...tagBasedRecords];
    
    // Sort by date (most recent first)
    allRecords.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });

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

// ==================== Profit Engine ====================
router.get('/profit', async (req: Request, res: Response) => {
  try {
    const month = req.query.month as string;
    if (!month) {
      return res.status(400).json({ error: 'Month parameter is required (YYYY-MM)' });
    }
    const profit = await profitEngineService.getMonthlyProfit(month);
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
    const profit = await profitEngineService.calculateProfit(month);
    res.json(profit);
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

// ==================== Payouts ====================
router.get('/payouts', async (req: Request, res: Response) => {
  try {
    const month = req.query.month as string;
    if (!month) {
      return res.status(400).json({ error: 'Month parameter is required (YYYY-MM)' });
    }
    const payout = await payoutService.getMonthlyPayout(month);
    if (!payout) {
      return res.status(404).json({ error: 'Payout not found for this month' });
    }
    res.json(payout);
  } catch (error: any) {
    logger.error('Error fetching payout:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch payout' });
  }
});

router.post('/payouts/calculate', async (req: Request, res: Response) => {
  try {
    const month = req.query.month as string || req.body.month;
    if (!month) {
      return res.status(400).json({ error: 'Month parameter is required (YYYY-MM)' });
    }
    const payout = await payoutService.calculatePayouts(month);
    res.json(payout);
  } catch (error: any) {
    logger.error('Error calculating payout:', error);
    res.status(500).json({ error: error.message || 'Failed to calculate payout' });
  }
});

router.get('/payout-config', async (req: Request, res: Response) => {
  try {
    const config = await payoutService.getConfig();
    res.json(config);
  } catch (error: any) {
    logger.error('Error fetching payout config:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch payout config' });
  }
});

router.put('/payout-config', async (req: Request, res: Response) => {
  try {
    const config = await payoutService.updateConfig(req.body);
    res.json(config);
  } catch (error: any) {
    logger.error('Error updating payout config:', error);
    res.status(500).json({ error: error.message || 'Failed to update payout config' });
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

    // Calculate shipping profit/loss ONLY from order tags (no manual shipping_records)
    const fulfilledOrders = await profitEngineService.getFulfilledOrdersForMonth(month);
    
    // Calculate scooter shipping profit/loss from tags
    const scooterShippingProfitLoss = await profitEngineService.calculateScooterShippingProfitLoss(fulfilledOrders, month);
    
    // Calculate company shipping profit/loss from tags
    const companyShippingProfitLoss = await profitEngineService.calculateCompanyShippingProfitLoss(fulfilledOrders, month);

    // Total profit/loss from tags only
    const totalProfitLoss = scooterShippingProfitLoss + companyShippingProfitLoss;

    res.json({
      month,
      total_profit_loss: totalProfitLoss,
      uber_profit_loss: scooterShippingProfitLoss, // Uber = Scooter
      company_profit_loss: companyShippingProfitLoss,
      cancelled_losses: 0, // Cancelled losses not tracked in tags
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
    const monthlyProfit = await profitEngineService.getMonthlyProfit(month);
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

