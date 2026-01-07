import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { financialService, FinancialExpenseCategory } from '../../services/financialService';
import { XMarkIcon, DocumentArrowUpIcon, CheckCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface BulkExpenseEntryModalProps {
  month: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface ExpenseRow {
  date: string;
  name: string;
  amount: number;
  type: 'production' | 'operating';
  category?: FinancialExpenseCategory;
  productName?: string;
}

// Pre-filled December 2025 expenses
const DECEMBER_2025_EXPENSES = `Date	Name	Amount
12/1/2025	Yasmin material	360
12/1/2025	Yasmin delivery	120
12/1/2025	Soad delivery	75
12/1/2025	Yarn	3250
12/6/2025	Ola delivery	150
12/6/2025	Marcel delivery	100
12/6/2025	Ola pcs	1540
12/6/2025	Marcel pcs	3645
12/6/2025	Felt pieces cut	4800
12/7/2025	Yasmin pcs	300
12/7/2025	Yasmin fiber	60
12/17/2025	Amira pcs	1500
12/21/2025	Ola & Yasmin delivery	145
12/21/2025	Ola pcs	3240
12/22/2025	Marcel delivery	80
12/22/2025	Marcel pcs	2800
12/22/2025	Soad material	145
12/23/2025	Yasmin pcs	1000
12/23/2025	Soad pcs	1500
12/23/2025	Amira pcs	2300
12/23/2025	Amira fiber	80
12/25/2025	Packaging	480
12/26/2025	Shaimaa & Soaad delivery	100
12/28/2025	Amira pcs	1500
12/28/2025	Amira delivery	110
12/28/2025	Marcel pcs	1100
12/28/2025	Marcel delivery	90
12/28/2025	Ola pcs	1540
12/28/2025	Ola delivery	170
12/31/2025	Ammar salary	4000
12/31/2025	Ads	11427`;

function parseExpenseData(text: string): ExpenseRow[] {
  const lines = text.trim().split('\n').slice(1); // Skip header
  const expenses: ExpenseRow[] = [];

  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 3) continue;

    const dateStr = parts[0].trim();
    const name = parts[1].trim();
    const amount = parseFloat(parts[2].trim());

    if (isNaN(amount) || !dateStr || !name) continue;

    // Parse date (MM/DD/YYYY format)
    const [month, day, year] = dateStr.split('/');
    const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

    // Categorize expense
    const nameLower = name.toLowerCase();
    let type: 'production' | 'operating' = 'production';
    let category: FinancialExpenseCategory = 'Other';
    let productName = '';

    if (nameLower.includes('ads') || nameLower.includes('ad')) {
      type = 'operating';
      category = 'Ads';
    } else if (nameLower.includes('pcs')) {
      type = 'production';
      category = 'Production Labor'; // Production pieces are labor expenses
      // Extract product name from "Name pcs" pattern
      productName = name.replace(/\s*pcs\s*/i, '').trim() || 'Production';
    } else if (nameLower.includes('material') || nameLower.includes('yarn') || nameLower.includes('fiber') || nameLower.includes('felt')) {
      type = 'production';
      category = 'Raw Materials';
      productName = 'Materials';
    } else if (nameLower.includes('delivery')) {
      type = 'production';
      category = 'Material Delivery';
      productName = 'Delivery';
    } else if (nameLower.includes('packaging')) {
      type = 'production';
      category = 'Packaging Bulk';
      productName = 'Packaging';
    } else {
      type = 'production';
      productName = name;
    }

    expenses.push({
      date,
      name,
      amount,
      type,
      category,
      productName,
    });
  }

  return expenses;
}

export default function BulkExpenseEntryModal({ month, onClose, onSuccess }: BulkExpenseEntryModalProps) {
  const queryClient = useQueryClient();
  const [expenseText, setExpenseText] = useState(DECEMBER_2025_EXPENSES);
  const [parsedExpenses, setParsedExpenses] = useState<ExpenseRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);

  const parseExpenses = () => {
    const expenses = parseExpenseData(expenseText);
    setParsedExpenses(expenses);
    toast.success(`Parsed ${expenses.length} expenses`);
  };

  const expenseMutation = useMutation({
    mutationFn: async (expense: ExpenseRow) => {
      if (expense.type === 'production') {
        // Create production expense
        return financialService.createExpense({
          category: expense.category || 'Other',
          amount: expense.amount,
          date: expense.date,
          notes: expense.name,
          expense_type: 'production',
          product_id: 'bulk-' + expense.name.toLowerCase().replace(/\s+/g, '-'),
          product_name: expense.productName || expense.name,
          quantity: 1,
          unit_cost: expense.amount,
        });
      } else {
        // Create operating expense
        return financialService.createExpense({
          category: expense.category || 'Other',
          amount: expense.amount,
          date: expense.date,
          notes: expense.name,
          expense_type: 'operating',
        });
      }
    },
    onMutate: async (expense) => {
      // Extract month from date
      const date = new Date(expense.date);
      const expenseMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      await queryClient.cancelQueries({ queryKey: ['financial-expenses', expenseMonth] });
      const previousExpenses = queryClient.getQueryData(['financial-expenses', expenseMonth]);
      
      // Optimistically add expense
      queryClient.setQueryData(['financial-expenses', expenseMonth], (old: any[] = []) => {
        const tempExpense = {
          id: `temp-${Date.now()}-${Math.random()}`,
          category: expense.category || 'Other',
          amount: expense.amount,
          date: expense.date,
          month: expenseMonth,
          notes: expense.name,
          expense_type: expense.type,
          product_id: expense.type === 'production' ? 'bulk-' + expense.name.toLowerCase().replace(/\s+/g, '-') : null,
          product_name: expense.type === 'production' ? (expense.productName || expense.name) : null,
          quantity: expense.type === 'production' ? 1 : null,
          unit_cost: expense.type === 'production' ? expense.amount : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        return [...old, tempExpense];
      });
      
      return { previousExpenses, expenseMonth };
    },
    onSuccess: (data, expense, context) => {
      // Update with real data from server
      if (context?.expenseMonth) {
        queryClient.setQueryData(['financial-expenses', context.expenseMonth], (old: any[] = []) => {
          return old.map(exp => exp.id.startsWith('temp-') && exp.notes === expense.name ? data : exp);
        });
      }
    },
    onError: (error, expense, context) => {
      // Rollback on error
      if (context?.previousExpenses && context?.expenseMonth) {
        queryClient.setQueryData(['financial-expenses', context.expenseMonth], context.previousExpenses);
      }
    },
  });

  const handleSubmit = async () => {
    if (parsedExpenses.length === 0) {
      toast.error('Please parse expenses first');
      return;
    }

    setIsProcessing(true);
    setProcessedCount(0);

    try {
      const productionExpenses = parsedExpenses.filter(e => e.type === 'production');
      const operatingExpenses = parsedExpenses.filter(e => e.type === 'operating');

      // Process all expenses (both production and operating)
      for (const expense of parsedExpenses) {
        try {
          await expenseMutation.mutateAsync(expense);
          setProcessedCount(prev => prev + 1);
        } catch (error: any) {
          console.error('Error creating expense:', error);
          toast.error(`Failed to add: ${expense.name}`);
        }
      }

      toast.success(`Successfully added ${processedCount} expenses!`);
      onSuccess();
    } catch (error: any) {
      toast.error('Error processing expenses: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const productionExpenses = parsedExpenses.filter(e => e.type === 'production');
  const operatingExpenses = parsedExpenses.filter(e => e.type === 'operating');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 pb-4 border-b">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Bulk Add Expenses</h3>
            <p className="text-sm text-gray-500 mt-1">Paste expense data (Date, Name, Amount) or use pre-filled December 2025 data</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-500 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expense Data (Tab-separated: Date, Name, Amount)
            </label>
            <textarea
              value={expenseText}
              onChange={(e) => setExpenseText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              rows={15}
              placeholder="Date	Name	Amount&#10;12/1/2025	Yasmin material	360"
            />
            <button
              onClick={parseExpenses}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              <DocumentArrowUpIcon className="w-4 h-4 inline mr-2" />
              Parse Expenses
            </button>
          </div>

          {parsedExpenses.length > 0 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-900">
                  Parsed {parsedExpenses.length} expenses
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Production Costs: {productionExpenses.length} | Operating Expenses: {operatingExpenses.length}
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Production Costs Preview */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Production Costs ({productionExpenses.length})</h4>
                  <div className="bg-gray-50 rounded-lg p-3 max-h-64 overflow-y-auto">
                    <div className="space-y-1 text-xs">
                      {productionExpenses.map((expense, idx) => (
                        <div key={idx} className="flex justify-between items-center py-1 border-b border-gray-200">
                          <span className="text-gray-700">{expense.name}</span>
                          <span className="font-semibold text-gray-900">EGP {expense.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Operating Expenses Preview */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Operating Expenses ({operatingExpenses.length})</h4>
                  <div className="bg-gray-50 rounded-lg p-3 max-h-64 overflow-y-auto">
                    <div className="space-y-1 text-xs">
                      {operatingExpenses.map((expense, idx) => (
                        <div key={idx} className="flex justify-between items-center py-1 border-b border-gray-200">
                          <span className="text-gray-700">{expense.name}</span>
                          <span className="font-semibold text-gray-900">EGP {expense.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isProcessing || parsedExpenses.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                Processing... ({processedCount}/{parsedExpenses.length})
              </>
            ) : (
              <>
                <CheckCircleIcon className="w-4 h-4" />
                Add All Expenses
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

