import { Request, Response } from 'express';
import { FinanceService } from '../services/financeService';
import { Expense, Settlement } from '../types/finance';

export class FinanceController {
  private financeService: FinanceService;

  constructor() {
    this.financeService = new FinanceService();
  }

  // Expense endpoints
  async createExpense(req: Request, res: Response) {
    try {
      console.log('Request body:', req.body);
      const expense = await this.financeService.createExpense(req.body);
      res.status(201).json(expense);
    } catch (error: any) {
      console.error('Error creating expense:', error);
      res.status(500).json({ error: error.message || 'Failed to create expense' });
    }
  }

  async getExpenses(req: Request, res: Response) {
    try {
      const filters = {
        category: req.query.category as string,
        paidBy: req.query.paidBy as string,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        settled: req.query.settled ? req.query.settled === 'true' : undefined
      };

      const expenses = await this.financeService.getExpenses(filters);
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch expenses' });
    }
  }

  async deleteExpense(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await this.financeService.deleteExpense(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete expense' });
    }
  }

  async updateExpenseNote(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { note } = req.body;
      const updatedExpense = await this.financeService.updateExpenseNote(id, note);
      res.json(updatedExpense);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update expense note' });
    }
  }

  async updateExpense(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const expenseData = req.body;
      const updatedExpense = await this.financeService.updateExpense(id, {
        ...expenseData,
        date: new Date(expenseData.date)
      });
      res.json(updatedExpense);
    } catch (error) {
      console.error('Error updating expense:', error);
      res.status(500).json({ error: 'Failed to update expense' });
    }
  }

  // Settlement endpoints
  async createSettlement(req: Request, res: Response) {
    try {
      const settlement = await this.financeService.createSettlement(req.body);
      res.status(201).json(settlement);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create settlement' });
    }
  }

  async getPartnerBalance(req: Request, res: Response) {
    try {
      const { partner } = req.params;
      const balance = await this.financeService.getPartnerBalance(partner);
      res.json(balance);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch partner balance' });
    }
  }

  // Report endpoints
  async getMonthlyReport(req: Request, res: Response) {
    try {
      const { month, year } = req.params;
      const report = await this.financeService.generateMonthlyReport(
        parseInt(month),
        parseInt(year)
      );
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate monthly report' });
    }
  }

  async settleExpense(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { partner } = req.body;
      const updatedExpense = await this.financeService.settleExpense(id, partner);
      res.json(updatedExpense);
    } catch (error) {
      console.error('Error settling expense:', error);
      res.status(500).json({ error: 'Failed to settle expense' });
    }
  }
} 