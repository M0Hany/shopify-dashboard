import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financialService, FinancialExpense, FinancialExpenseCategory, ExpenseType } from '../../services/financialService';
import { format, subMonths } from 'date-fns';
import { TrashIcon, PencilIcon, XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { SkeletonCard } from '../common/SkeletonLoader';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

const EXPENSE_CATEGORIES: FinancialExpenseCategory[] = [
  "Ads",
  "Media Buyer Fixed",
  "Packaging Bulk",
  "Packaging",
  "Material Shipping",
  "Raw Materials",
  "Material Delivery",
  "Production Labor",
  "Tools & Misc",
  "Tools & Equipment",
  "Utilities & Rent",
  "Professional Services",
  "Other"
];

interface FinancialExpensesTabProps {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  onBack: () => void;
  openAddModal?: boolean;
  onAddModalClose?: () => void;
}

export default function FinancialExpensesTab({ selectedMonth, setSelectedMonth, onBack, openAddModal, onAddModalClose }: FinancialExpensesTabProps) {
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Sync external modal state
  useEffect(() => {
    if (openAddModal !== undefined) {
      setIsAddModalOpen(openAddModal);
    }
  }, [openAddModal]);

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    onAddModalClose?.();
  };
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<FinancialExpense | null>(null);
  
  const [formData, setFormData] = useState({
    category: "Ads" as FinancialExpenseCategory,
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });
  const [searchQuery, setSearchQuery] = useState('');

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['financial-expenses', selectedMonth],
    queryFn: () => financialService.getExpenses(selectedMonth),
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 0,
  });

  const createMutation = useMutation({
    mutationFn: financialService.createExpense,
    onMutate: async (newExpense) => {
      // Calculate month from expense date
      const expenseDate = new Date(newExpense.date);
      const expenseMonth = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}`;
      
      // Cancel outgoing refetches for the expense's month
      await queryClient.cancelQueries({ queryKey: ['financial-expenses', expenseMonth] });
      
      // Snapshot previous value
      const previousExpenses = queryClient.getQueryData(['financial-expenses', expenseMonth]);
      
      // Optimistically update - add to the expense's month, not selectedMonth
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      queryClient.setQueryData(['financial-expenses', expenseMonth], (old: FinancialExpense[] = []) => {
        const tempExpense: FinancialExpense = {
          id: tempId,
          category: newExpense.category,
          amount: newExpense.amount,
          date: newExpense.date,
          month: expenseMonth,
          notes: newExpense.notes,
          expense_type: newExpense.expense_type || 'operating',
          product_id: newExpense.product_id,
          product_name: newExpense.product_name,
          quantity: newExpense.quantity,
          unit_cost: newExpense.unit_cost,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        // Insert in sorted position (by date descending, then by created_at descending)
        const newList = [...old, tempExpense];
        newList.sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          if (dateB !== dateA) {
            return dateB - dateA; // Descending by date
          }
          // If same date, sort by created_at descending (newest first)
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        return newList;
      });
      
      return { previousExpenses, expenseMonth, tempId };
    },
    onSuccess: (data, newExpense, context) => {
      // Use the month from context (where we optimistically added it)
      const expenseMonth = context?.expenseMonth || selectedMonth;
      const tempId = context?.tempId;
      
      // Update with real data from server - replace temp expense by exact tempId and maintain sort
      queryClient.setQueryData(['financial-expenses', expenseMonth], (old: FinancialExpense[] = []) => {
        let updated: FinancialExpense[];
        if (tempId) {
          // Replace by exact tempId
          updated = old.map(exp => exp.id === tempId ? data : exp);
        } else {
          // Fallback: find by matching properties
          const tempIndex = old.findIndex(exp => 
            exp.id.startsWith('temp-') && 
            exp.date === newExpense.date && 
            Math.abs(exp.amount - newExpense.amount) < 0.01 &&
            exp.category === newExpense.category
          );
          if (tempIndex >= 0) {
            updated = [...old];
            updated[tempIndex] = data;
          } else {
            // If no temp found, just add the real data
            updated = [...old, data];
          }
        }
        // Re-sort to maintain order (by date descending, then by created_at descending)
        updated.sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          if (dateB !== dateA) {
            return dateB - dateA; // Descending by date
          }
          // If same date, sort by created_at descending (newest first)
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        return updated;
      });
      
      handleCloseModal();
      setFormData({
        category: "Ads",
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        notes: '',
      });
      toast.success('Expense added successfully');
    },
    onError: (error: any, newExpense, context) => {
      // Rollback on error - use the expense's month
      if (context?.previousExpenses && context?.expenseMonth) {
        queryClient.setQueryData(['financial-expenses', context.expenseMonth], context.previousExpenses);
      }
      toast.error(error.message || 'Failed to add expense');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof formData> }) =>
      financialService.updateExpense(id, {
        category: data.category!,
        amount: parseFloat(data.amount!),
        date: data.date!,
        notes: data.notes,
      }),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['financial-expenses', selectedMonth] });
      const previousExpenses = queryClient.getQueryData(['financial-expenses', selectedMonth]);
      
      queryClient.setQueryData(['financial-expenses', selectedMonth], (old: FinancialExpense[] = []) => {
        return old.map(exp => 
          exp.id === id 
            ? { ...exp, ...data, amount: parseFloat(data.amount!), updated_at: new Date().toISOString() }
            : exp
        );
      });
      
      return { previousExpenses };
    },
    onSuccess: (data) => {
      // Get old expense to calculate difference
      const oldExpense = queryClient.getQueryData<FinancialExpense[]>(['financial-expenses', selectedMonth])
        ?.find(exp => exp.id === data.id);
      
      // Update with real data from server
      queryClient.setQueryData(['financial-expenses', selectedMonth], (old: FinancialExpense[] = []) => {
        return old.map(exp => exp.id === data.id ? data : exp);
      });
      
      // Trend data will automatically update via useMemo when expenses change
      
      setIsEditModalOpen(false);
      setSelectedExpense(null);
      toast.success('Expense updated successfully');
    },
    onError: (error: any, variables, context) => {
      if (context?.previousExpenses) {
        queryClient.setQueryData(['financial-expenses', selectedMonth], context.previousExpenses);
      }
      toast.error(error.message || 'Failed to update expense');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: financialService.deleteExpense,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['financial-expenses', selectedMonth] });
      const previousExpenses = queryClient.getQueryData(['financial-expenses', selectedMonth]);
      
      queryClient.setQueryData(['financial-expenses', selectedMonth], (old: FinancialExpense[] = []) => {
        return old.filter(exp => exp.id !== id);
      });
      
      return { previousExpenses };
    },
    onSuccess: (_, deletedId) => {
      // Get deleted expense to update trend
      const deletedExpense = queryClient.getQueryData<FinancialExpense[]>(['financial-expenses', selectedMonth])
        ?.find(exp => exp.id === deletedId);
      
      // Trend data will automatically update via useMemo when expenses change
      
      setIsDeleteModalOpen(false);
      setSelectedExpense(null);
      toast.success('Expense deleted successfully');
    },
    onError: (error: any, id, context) => {
      if (context?.previousExpenses) {
        queryClient.setQueryData(['financial-expenses', selectedMonth], context.previousExpenses);
      }
      toast.error(error.message || 'Failed to delete expense');
    },
  });

  // Get last 6 months for trend - computed from cached expenses, no API calls
  const trendData = useMemo(() => {
    const months = [];
    const [year, month] = selectedMonth.split('-').map(Number);
    for (let i = 5; i >= 0; i--) {
      const date = new Date(year, month - 1 - i, 1);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      // Get expenses for this month from cache (use current month's expenses if available)
      const monthExpenses = queryClient.getQueryData<FinancialExpense[]>(['financial-expenses', monthStr]) || 
                           (monthStr === selectedMonth ? expenses : []) || [];
      months.push({
        month: format(date, 'MMM'),
        total: monthExpenses.reduce((sum, exp) => sum + exp.amount, 0),
      });
    }
    return months;
  }, [expenses, selectedMonth, queryClient]);

  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    if (!searchQuery) return expenses;
    return expenses.filter(exp => 
      exp.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.amount.toString().includes(searchQuery)
    );
  }, [expenses, searchQuery]);

  const totalExpenses = filteredExpenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0;
  const expensesByCategory = filteredExpenses?.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>) || {};

  const pieColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const pieData = Object.entries(expensesByCategory).map(([name, value], index) => ({
    name,
    value,
    color: pieColors[index % pieColors.length],
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const expenseData = {
      category: formData.category,
      amount: parseFloat(formData.amount),
      date: formData.date,
      notes: formData.notes || undefined,
      expense_type: 'operating' as ExpenseType, // Default to operating for manual entries
    };
    createMutation.mutate(expenseData);
  };

  const handleEditClick = (expense: FinancialExpense) => {
    setSelectedExpense(expense);
    setFormData({
      category: expense.category,
      amount: expense.amount.toString(),
      date: expense.date,
      notes: expense.notes || '',
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedExpense) {
      updateMutation.mutate({
        id: selectedExpense.id,
        data: formData,
      });
    }
  };

  const handleDeleteClick = (expense: FinancialExpense) => {
    setSelectedExpense(expense);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedExpense) {
      deleteMutation.mutate(selectedExpense.id);
    }
  };

  const formatMonthDisplay = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return format(date, 'MMMM yyyy');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-EG', {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900">Financial Expenses</h3>
        <p className="text-sm text-gray-500 mt-1">Track and manage business expenses for {formatMonthDisplay(selectedMonth)}</p>
      </div>

      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search expenses by category, notes, or amount..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 rounded-lg p-6">
          <h4 className="text-sm font-medium text-gray-700">Total Expenses</h4>
          <p className="mt-2 text-3xl font-bold text-orange-700">
            {formatCurrency(totalExpenses)}
          </p>
          <p className="mt-1 text-xs text-gray-600">{formatMonthDisplay(selectedMonth)}</p>
        </div>
        <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
          <h4 className="text-sm font-medium text-gray-500">Number of Expenses</h4>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {filteredExpenses?.length || 0}
          </p>
        </div>
        <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
          <h4 className="text-sm font-medium text-gray-500">Average per Expense</h4>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {formatCurrency(filteredExpenses?.length ? (totalExpenses / filteredExpenses.length) : 0)}
          </p>
        </div>
      </div>

      {/* Charts */}
      {pieData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Expenses by Category</h4>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Trend Chart */}
          {trendData && trendData.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">6-Month Trend</h4>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#f59e0b" strokeWidth={2} name="Total Expenses" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Expenses by Category Grid */}
      {Object.keys(expensesByCategory).length > 0 && (
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
          <h4 className="text-sm font-medium text-gray-900 mb-4">Category Breakdown</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(expensesByCategory).map(([category, amount]) => (
              <div key={category} className="flex justify-between items-center p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors">
                <span className="text-sm font-medium text-gray-700">{category}</span>
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expenses Table */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredExpenses && filteredExpenses.length > 0 ? (
                filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(expense.date), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {expense.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {expense.notes || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEditClick(expense)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit expense"
                        >
                          <PencilIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(expense)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete expense"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                    {searchQuery 
                      ? `No expenses found matching "${searchQuery}"`
                      : `No expenses found for ${formatMonthDisplay(selectedMonth)}`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Add Expense</h3>
              <button
                onClick={handleCloseModal}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as FinancialExpenseCategory })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (EGP) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {isEditModalOpen && selectedExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Edit Expense</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as FinancialExpenseCategory })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (EGP) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Delete Expense</h3>
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this expense?
              <br />
              <span className="font-medium">{selectedExpense.category}</span> - EGP {selectedExpense.amount.toFixed(2)}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
