import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeService } from '../../services/financeService';
import { Expense, ExpenseCategory, PaymentSource, SplitPayment } from '../../types/finance';
import { format } from 'date-fns';
import { TrashIcon, PencilIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';

export default function ExpensesTab() {
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    category: 'Yarn & Materials' as ExpenseCategory,
    paidBy: 'Business' as PaymentSource,
    splitPayment: { mohamed: '', mariam: '' } as { mohamed: string; mariam: string },
    note: '',
  });
  const [editFormData, setEditFormData] = useState({
    title: '',
    amount: '',
    date: '',
    category: 'Yarn & Materials' as ExpenseCategory,
    paidBy: 'Business' as PaymentSource,
    splitPayment: { mohamed: '', mariam: '' } as { mohamed: string; mariam: string },
    note: '',
  });

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => financeService.getExpenses(),
  });

  const calculateOwedAmount = (partner: 'Mohamed' | 'Mariam') => {
    if (!expenses) return 0;
    
    return expenses.reduce((total, expense) => {
      if (expense.paidBy === partner && !expense.settled) {
        return total + expense.amount;
      }
      if (expense.paidBy === 'Both') {
        const partnerKey = partner === 'Mohamed' ? 'mohamed' : 'mariam';
        const partnerAmount = expense.splitPayment?.[partnerKey] || 0;
        const isSettled = partner === 'Mohamed' ? expense.settledMohamed : expense.settledMariam;
        return total + (isSettled ? 0 : partnerAmount);
      }
      return total;
    }, 0);
  };

  const mohamedOwed = calculateOwedAmount('Mohamed');
  const mariamOwed = calculateOwedAmount('Mariam');

  const createExpenseMutation = useMutation({
    mutationFn: financeService.createExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setIsAddModalOpen(false);
      setFormData({
        title: '',
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        category: 'Yarn & Materials',
        paidBy: 'Business',
        splitPayment: { mohamed: '', mariam: '' },
        note: '',
      });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: financeService.deleteExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setIsDeleteModalOpen(false);
      setSelectedExpense(null);
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Omit<Expense, 'id' | 'settled' | 'settledAt'> }) => 
      financeService.updateExpense(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setIsEditModalOpen(false);
      setSelectedExpense(null);
      setEditFormData({
        title: '',
        amount: '',
        date: '',
        category: 'Yarn & Materials',
        paidBy: 'Business',
        splitPayment: { mohamed: '', mariam: '' },
        note: '',
      });
    },
  });

  const settleExpenseMutation = useMutation({
    mutationFn: ({ id, partner }: { id: string; partner?: 'Mohamed' | 'Mariam' }) => 
      financeService.settleExpense(id, partner),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submissionData = {
      ...formData,
      amount: formData.paidBy === 'Both' 
        ? parseFloat(formData.splitPayment.mohamed) + parseFloat(formData.splitPayment.mariam)
        : parseFloat(formData.amount),
      date: new Date(formData.date),
      splitPayment: {
        mohamed: parseFloat(formData.splitPayment.mohamed) || 0,
        mariam: parseFloat(formData.splitPayment.mariam) || 0
      }
    };
    createExpenseMutation.mutate(submissionData);
  };

  const handleDeleteClick = (expense: Expense) => {
    setSelectedExpense(expense);
    setIsDeleteModalOpen(true);
  };

  const handleEditClick = (expense: Expense) => {
    setSelectedExpense(expense);
    setEditFormData({
      title: expense.title,
      amount: expense.amount.toString(),
      date: format(expense.date, 'yyyy-MM-dd'),
      category: expense.category,
      paidBy: expense.paidBy,
      splitPayment: {
        mohamed: expense.splitPayment?.mohamed.toString() || '',
        mariam: expense.splitPayment?.mariam.toString() || ''
      },
      note: expense.note || '',
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedExpense) {
      const submissionData = {
        ...editFormData,
        amount: editFormData.paidBy === 'Both'
          ? parseFloat(editFormData.splitPayment.mohamed) + parseFloat(editFormData.splitPayment.mariam)
          : parseFloat(editFormData.amount),
        date: new Date(editFormData.date),
        splitPayment: {
          mohamed: parseFloat(editFormData.splitPayment.mohamed) || 0,
          mariam: parseFloat(editFormData.splitPayment.mariam) || 0
        }
      };
      updateExpenseMutation.mutate({
        id: selectedExpense.id,
        data: submissionData,
      });
    }
  };

  const handleConfirmDelete = () => {
    if (selectedExpense) {
      deleteExpenseMutation.mutate(selectedExpense.id);
    }
  };

  const handleSettleClick = (expense: Expense, partner?: 'Mohamed' | 'Mariam') => {
    settleExpenseMutation.mutate({ id: expense.id, partner });
  };

  const categories: ExpenseCategory[] = [
    'Yarn & Materials',
    'Packaging',
    'Marketing & Ads',
    'Equipment',
    'Labor',
    'Shipping & Delivery',
    'Miscellaneous',
  ];

  const paymentOptions: PaymentSource[] = ['Business', 'Mohamed', 'Mariam', 'Both'];

  const renderSettlementButton = (expense: Expense) => {
    if (expense.paidBy === 'Business') {
      return (
        <span className="inline-flex items-center text-green-600">
          <CheckIcon className="w-4 h-4 mr-1" />
          Business Expense
        </span>
      );
    }

    if (expense.paidBy === 'Both') {
      return (
        <div className="space-y-1">
          <div className="text-xs text-gray-500 mb-1">
            Mohamed: ${expense.splitPayment?.mohamed.toFixed(2)}
            {expense.settledMohamed ? (
              <span className="ml-2 text-green-600">✓ Settled</span>
            ) : null}
          </div>
          {!expense.settledMohamed && (
            <button
              onClick={() => handleSettleClick(expense, 'Mohamed')}
              className="w-full inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800 hover:bg-blue-200"
            >
              Settle Mohamed's Part
            </button>
          )}
          <div className="text-xs text-gray-500 mb-1 mt-2">
            Mariam: ${expense.splitPayment?.mariam.toFixed(2)}
            {expense.settledMariam ? (
              <span className="ml-2 text-green-600">✓ Settled</span>
            ) : null}
          </div>
          {!expense.settledMariam && (
            <button
              onClick={() => handleSettleClick(expense, 'Mariam')}
              className="w-full inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800 hover:bg-blue-200"
            >
              Settle Mariam's Part
            </button>
          )}
        </div>
      );
    }

    // Single partner payment (Mohamed or Mariam)
    return (
      <div>
        <div className="text-xs text-gray-500 mb-1">
          Paid by {expense.paidBy}: ${expense.amount.toFixed(2)}
          {expense.settled ? (
            <span className="ml-2 text-green-600">✓ Settled</span>
          ) : null}
        </div>
        {!expense.settled && (
          <button
            onClick={() => handleSettleClick(expense)}
            className="w-full inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800 hover:bg-blue-200"
          >
            Settle {expense.paidBy}'s Payment
          </button>
        )}
      </div>
    );
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Expenses</h3>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Add Expense
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
            <h4 className="text-base font-medium text-gray-900 mb-4">Mohamed's Balance</h4>
            <dl className="grid grid-cols-1 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Owed Amount</dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">
                  ${mohamedOwed.toFixed(2)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
            <h4 className="text-base font-medium text-gray-900 mb-4">Mariam's Balance</h4>
            <dl className="grid grid-cols-1 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Owed Amount</dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">
                  ${mariamOwed.toFixed(2)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-8 flow-root">
          <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-white">
                    <tr>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Title</th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Amount</th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Date</th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Category</th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Paid By</th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Settlement</th>
                      <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {expenses?.map((expense) => (
                      <tr key={expense.id}>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                          {expense.title}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                          ${expense.amount.toFixed(2)}
                          {expense.paidBy === 'Both' && (
                            <div className="text-xs text-gray-500">
                              <div>Mohamed: ${expense.splitPayment?.mohamed.toFixed(2)}</div>
                              <div>Mariam: ${expense.splitPayment?.mariam.toFixed(2)}</div>
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                          {format(expense.date, 'MMM d, yyyy')}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                          {expense.category}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                          {expense.paidBy}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          {renderSettlementButton(expense)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEditClick(expense)}
                              className="p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200 bg-white rounded-md border border-gray-200"
                              title="Edit expense"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(expense)}
                              className="p-1 text-red-400 hover:text-red-600 transition-colors duration-200 bg-white rounded-md border border-gray-200"
                              title="Delete expense"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals - Moved outside the space-y-6 div */}
      {isAddModalOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Add New Expense</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-full bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                    Title
                  </label>
                  <input
                    type="text"
                    id="title"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm h-10 bg-white px-3"
                  />
                </div>

                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                    Date
                  </label>
                  <input
                    type="date"
                    id="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm h-10 bg-white px-3"
                  />
                </div>

                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                    Category
                  </label>
                  <select
                    id="category"
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as ExpenseCategory })}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm h-10 bg-white px-3"
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="paidBy" className="block text-sm font-medium text-gray-700">
                    Paid By
                  </label>
                  <select
                    id="paidBy"
                    required
                    value={formData.paidBy}
                    onChange={(e) => {
                      const newPaidBy = e.target.value as PaymentSource;
                      setFormData({
                        ...formData,
                        paidBy: newPaidBy,
                        amount: '',
                        splitPayment: { mohamed: '', mariam: '' }
                      });
                    }}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm h-10 bg-white px-3"
                  >
                    {paymentOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.paidBy !== 'Both' ? (
                  <div>
                    <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                      Amount
                    </label>
                    <input
                      type="number"
                      id="amount"
                      required
                      min="0"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm h-10 bg-white px-3 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label htmlFor="mohamedAmount" className="block text-sm font-medium text-gray-700">
                        Mohamed's Amount
                      </label>
                      <input
                        type="number"
                        id="mohamedAmount"
                        required
                        min="0"
                        step="0.01"
                        value={formData.splitPayment.mohamed}
                        onChange={(e) => setFormData({
                          ...formData,
                          splitPayment: {
                            ...formData.splitPayment,
                            mohamed: e.target.value
                          }
                        })}
                        className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm h-10 bg-white px-3 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="mariamAmount" className="block text-sm font-medium text-gray-700">
                        Mariam's Amount
                      </label>
                      <input
                        type="number"
                        id="mariamAmount"
                        required
                        min="0"
                        step="0.01"
                        value={formData.splitPayment.mariam}
                        onChange={(e) => setFormData({
                          ...formData,
                          splitPayment: {
                            ...formData.splitPayment,
                            mariam: e.target.value
                          }
                        })}
                        className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm h-10 bg-white px-3 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </>
                )}
              </div>

              <div>
                <label htmlFor="note" className="block text-sm font-medium text-gray-700">
                  Note
                </label>
                <textarea
                  id="note"
                  rows={5}
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white p-3"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createExpenseMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  {createExpenseMutation.isPending ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteModalOpen && selectedExpense && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setIsDeleteModalOpen(false)}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Delete Expense</h3>
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="p-1 rounded-full bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this expense?
              <br />
              <span className="font-medium">{selectedExpense.title}</span> - ${selectedExpense.amount.toFixed(2)}
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
                disabled={deleteExpenseMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                {deleteExpenseMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && selectedExpense && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Edit Expense</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-full bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="edit-title" className="block text-sm font-medium text-gray-700">
                    Title
                  </label>
                  <input
                    type="text"
                    id="edit-title"
                    required
                    value={editFormData.title}
                    onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm h-10 bg-white px-3"
                  />
                </div>

                <div>
                  <label htmlFor="edit-date" className="block text-sm font-medium text-gray-700">
                    Date
                  </label>
                  <input
                    type="date"
                    id="edit-date"
                    required
                    value={editFormData.date}
                    onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm h-10 bg-white px-3"
                  />
                </div>

                <div>
                  <label htmlFor="edit-category" className="block text-sm font-medium text-gray-700">
                    Category
                  </label>
                  <select
                    id="edit-category"
                    required
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value as ExpenseCategory })}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm h-10 bg-white px-3"
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-paidBy" className="block text-sm font-medium text-gray-700">
                    Paid By
                  </label>
                  <select
                    id="edit-paidBy"
                    required
                    value={editFormData.paidBy}
                    onChange={(e) => {
                      const newPaidBy = e.target.value as PaymentSource;
                      setEditFormData({
                        ...editFormData,
                        paidBy: newPaidBy,
                        amount: '',
                        splitPayment: { mohamed: '', mariam: '' }
                      });
                    }}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm h-10 bg-white px-3"
                  >
                    {paymentOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                {editFormData.paidBy !== 'Both' ? (
                  <div>
                    <label htmlFor="edit-amount" className="block text-sm font-medium text-gray-700">
                      Amount
                    </label>
                    <input
                      type="number"
                      id="edit-amount"
                      required
                      min="0"
                      step="0.01"
                      value={editFormData.amount}
                      onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm h-10 bg-white px-3 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label htmlFor="edit-mohamedAmount" className="block text-sm font-medium text-gray-700">
                        Mohamed's Amount
                      </label>
                      <input
                        type="number"
                        id="edit-mohamedAmount"
                        required
                        min="0"
                        step="0.01"
                        value={editFormData.splitPayment.mohamed}
                        onChange={(e) => setEditFormData({
                          ...editFormData,
                          splitPayment: {
                            ...editFormData.splitPayment,
                            mohamed: e.target.value
                          }
                        })}
                        className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm h-10 bg-white px-3 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-mariamAmount" className="block text-sm font-medium text-gray-700">
                        Mariam's Amount
                      </label>
                      <input
                        type="number"
                        id="edit-mariamAmount"
                        required
                        min="0"
                        step="0.01"
                        value={editFormData.splitPayment.mariam}
                        onChange={(e) => setEditFormData({
                          ...editFormData,
                          splitPayment: {
                            ...editFormData.splitPayment,
                            mariam: e.target.value
                          }
                        })}
                        className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm h-10 bg-white px-3 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </>
                )}
              </div>

              <div>
                <label htmlFor="edit-note" className="block text-sm font-medium text-gray-700">
                  Note
                </label>
                <textarea
                  id="edit-note"
                  rows={5}
                  value={editFormData.note}
                  onChange={(e) => setEditFormData({ ...editFormData, note: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white p-3"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateExpenseMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  {updateExpenseMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
} 