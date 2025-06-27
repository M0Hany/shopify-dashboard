import { Router } from 'express';
import { FinanceController } from '../controllers/financeController';

const router = Router();
const financeController = new FinanceController();

// Expense routes
router.post('/expenses', (req, res) => financeController.createExpense(req, res));
router.get('/expenses', (req, res) => financeController.getExpenses(req, res));
router.delete('/expenses/:id', (req, res) => financeController.deleteExpense(req, res));
router.patch('/expenses/:id/note', (req, res) => financeController.updateExpenseNote(req, res));
router.patch('/expenses/:id', (req, res) => financeController.updateExpense(req, res));
router.patch('/expenses/:id/settle', (req, res) => financeController.settleExpense(req, res));

// Settlement routes
router.post('/settlements', (req, res) => financeController.createSettlement(req, res));
router.get('/partners/:partner/balance', (req, res) => financeController.getPartnerBalance(req, res));

// Report routes
router.get('/reports/monthly/:year/:month', (req, res) => financeController.getMonthlyReport(req, res));

export default router; 