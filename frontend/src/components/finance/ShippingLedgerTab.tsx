import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financialService, ShippingRecord, ShippingRecordInput, ShippingType, ShippingStatus } from '../../services/financialService';
import { format } from 'date-fns';
import { TrashIcon, PencilIcon, XMarkIcon, PlusIcon, DocumentArrowDownIcon, ArrowLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import MonthNavigator from './MonthNavigator';
import BulkShippingCostImportDialog from './BulkShippingCostImportDialog';
import BulkShippingCostRevertDialog from './BulkShippingCostRevertDialog';

interface ShippingLedgerTabProps {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  onBack?: () => void;
}

export default function ShippingLedgerTab({ selectedMonth, setSelectedMonth, onBack }: ShippingLedgerTabProps) {
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isBulkRevertOpen, setIsBulkRevertOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ShippingRecord | null>(null);
  
  const [formData, setFormData] = useState<ShippingRecordInput>({
    order_id: undefined,
    type: 'Company',
    customer_shipping_charged: 0,
    actual_shipping_cost: 0,
    status: 'Delivered',
    date: format(new Date(), 'yyyy-MM-dd'),
    invoice_id: undefined,
  });

  const { data: records, isLoading } = useQuery({
    queryKey: ['shipping-records', selectedMonth],
    queryFn: () => financialService.getShippingRecords(selectedMonth),
    enabled: !!selectedMonth,
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 0,
  });

  const createMutation = useMutation({
    mutationFn: financialService.createShippingRecord,
    onMutate: async (newRecord) => {
      await queryClient.cancelQueries({ queryKey: ['shipping-records', selectedMonth] });
      const previousRecords = queryClient.getQueryData(['shipping-records', selectedMonth]);
      
      queryClient.setQueryData(['shipping-records', selectedMonth], (old: ShippingRecord[] = []) => {
        const tempRecord: ShippingRecord = {
          id: `temp-${Date.now()}`,
          ...newRecord,
          month: selectedMonth,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        // Insert in sorted position (by date descending)
        const newList = [...old, tempRecord];
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
      
      return { previousRecords };
    },
    onSuccess: (data) => {
      // Update with real data from server and maintain sort
      queryClient.setQueryData(['shipping-records', selectedMonth], (old: ShippingRecord[] = []) => {
        const updated = old.map(record => record.id.startsWith('temp-') ? data : record);
        // Re-sort to maintain order (by date descending)
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
      // Background refresh only
      queryClient.invalidateQueries({ queryKey: ['shipping-performance', selectedMonth], exact: false });
      setIsAddModalOpen(false);
      setFormData({
        order_id: undefined,
        type: 'Company',
        customer_shipping_charged: 0,
        actual_shipping_cost: 0,
        status: 'Delivered',
        date: format(new Date(), 'yyyy-MM-dd'),
        invoice_id: undefined,
      });
      toast.success('Shipping record added successfully');
    },
    onError: (error: any, newRecord, context) => {
      if (context?.previousRecords) {
        queryClient.setQueryData(['shipping-records', selectedMonth], context.previousRecords);
      }
      toast.error(error.message || 'Failed to add shipping record');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ShippingRecordInput> }) =>
      financialService.updateShippingRecord(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['shipping-records', selectedMonth] });
      const previousRecords = queryClient.getQueryData(['shipping-records', selectedMonth]);
      
      queryClient.setQueryData(['shipping-records', selectedMonth], (old: ShippingRecord[] = []) => {
        const updated = old.map(record => 
          record.id === id 
            ? { ...record, ...data, updated_at: new Date().toISOString() }
            : record
        );
        // Re-sort to maintain order (by date descending) in case date changed
        updated.sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          if (dateB !== dateA) {
            return dateB - dateA; // Descending by date
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        return updated;
      });
      
      return { previousRecords };
    },
    onSuccess: (data) => {
      // Update with real data from server
      queryClient.setQueryData(['shipping-records', selectedMonth], (old: ShippingRecord[] = []) => {
        return old.map(record => record.id === data.id ? data : record);
      });
      // Background refresh only
      queryClient.invalidateQueries({ queryKey: ['shipping-performance', selectedMonth], exact: false });
      setIsEditModalOpen(false);
      setSelectedRecord(null);
      toast.success('Shipping record updated successfully');
    },
    onError: (error: any, variables, context) => {
      if (context?.previousRecords) {
        queryClient.setQueryData(['shipping-records', selectedMonth], context.previousRecords);
      }
      toast.error(error.message || 'Failed to update shipping record');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: financialService.deleteShippingRecord,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['shipping-records', selectedMonth] });
      const previousRecords = queryClient.getQueryData(['shipping-records', selectedMonth]);
      
      queryClient.setQueryData(['shipping-records', selectedMonth], (old: ShippingRecord[] = []) => {
        return old.filter(record => record.id !== id);
      });
      
      return { previousRecords };
    },
    onSuccess: () => {
      // Data already removed optimistically, just background refresh
      queryClient.invalidateQueries({ queryKey: ['shipping-performance', selectedMonth], exact: false });
      setIsDeleteModalOpen(false);
      setSelectedRecord(null);
      toast.success('Shipping record deleted successfully');
    },
    onError: (error: any, id, context) => {
      if (context?.previousRecords) {
        queryClient.setQueryData(['shipping-records', selectedMonth], context.previousRecords);
      }
      toast.error(error.message || 'Failed to delete shipping record');
    },
  });

  const totalProfitLoss = records?.reduce((sum, record) => {
    return sum + (record.customer_shipping_charged - record.actual_shipping_cost);
  }, 0) || 0;

  const totalShippingCost = records?.reduce((sum, record) => sum + record.actual_shipping_cost, 0) || 0;
  const totalCustomerCharged = records?.reduce((sum, record) => sum + record.customer_shipping_charged, 0) || 0;
  const totalOrders = records?.length || 0;

  const companyRecords = records?.filter(r => r.type === 'Company') || [];
  const uberRecords = records?.filter(r => r.type === 'Uber') || [];
  const cancelledRecords = records?.filter(r => r.status === 'Cancelled') || [];

  const companyProfitLoss = companyRecords.reduce((sum, r) => sum + (r.customer_shipping_charged - r.actual_shipping_cost), 0);
  const uberProfitLoss = uberRecords.reduce((sum, r) => sum + (r.customer_shipping_charged - r.actual_shipping_cost), 0);
  const cancelledLosses = cancelledRecords.reduce((sum, r) => sum + r.actual_shipping_cost, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleEditClick = (record: ShippingRecord) => {
    setSelectedRecord(record);
    setFormData({
      order_id: record.order_id,
      type: record.type,
      customer_shipping_charged: record.customer_shipping_charged,
      actual_shipping_cost: record.actual_shipping_cost,
      status: record.status,
      date: record.date,
      invoice_id: record.invoice_id,
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRecord) {
      updateMutation.mutate({
        id: selectedRecord.id,
        data: formData,
      });
    }
  };

  const formatMonthDisplay = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return format(date, 'MMMM yyyy');
  };

  const profitLoss = formData.customer_shipping_charged - formData.actual_shipping_cost;

  const handleBulkImport = async (entries: Array<{ orderNumber: string; cost: number }>, transactionDate: string, orderIdMappings?: { [key: string]: number }) => {
    try {
      const result = await financialService.bulkImportShippingCosts(entries, transactionDate, orderIdMappings);
      
      if (result.summary.failed > 0) {
        toast.error(`${result.summary.successful} succeeded, ${result.summary.failed} failed. Check console for details.`);
        console.log('Failed entries:', result.results.failed);
      } else {
        toast.success(`Successfully imported ${result.summary.successful} shipping costs`);
      }
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['shipping-records', selectedMonth] });
      queryClient.invalidateQueries({ queryKey: ['shipping-performance', selectedMonth] });
    } catch (error: any) {
      throw error;
    }
  };

  const handleBulkRevert = async (orderIds: number[]) => {
    try {
      const result = await financialService.bulkRevertShippingCosts(orderIds);
      
      if (result.summary.failed > 0) {
        toast.error(`${result.summary.successful} succeeded, ${result.summary.failed} failed. Check console for details.`);
        console.log('Failed orders:', result.results.failed);
      } else {
        toast.success(`Successfully reverted shipping costs for ${result.summary.successful} orders`);
      }
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['shipping-records', selectedMonth] });
      queryClient.invalidateQueries({ queryKey: ['shipping-performance', selectedMonth] });
      queryClient.invalidateQueries({ queryKey: ['monthly-profit', selectedMonth] });
    } catch (error: any) {
      throw error;
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading shipping records...</div>;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-EG', {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              title="Back to Profit Overview"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
          )}
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Shipping Ledger</h3>
            <p className="text-sm text-gray-500 mt-1">Manage shipping costs and track performance</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <MonthNavigator 
            selectedMonth={selectedMonth} 
            onMonthChange={setSelectedMonth}
            showDatePicker={true}
            showToday={false}
          />
          <button
            onClick={() => setIsBulkImportOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            <DocumentArrowDownIcon className="w-5 h-5 mr-2" />
            Bulk Import Costs
          </button>
          <button
            onClick={() => setIsBulkRevertOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-red-700 bg-white hover:bg-red-50"
          >
            <ArrowPathIcon className="w-5 h-5 mr-2" />
            Revert Import
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            Add Record
          </button>
        </div>
      </div>

      {/* Summary Cards - Styled similar to ProfitOverviewTab */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <h4 className="text-sm font-medium text-gray-700">Shipping Costs Included</h4>
          <p className="mt-2 text-3xl font-bold text-orange-700">
            {formatCurrency(totalShippingCost)}
          </p>
          <p className="mt-1 text-xs text-orange-600">
            Total Orders: <span className="font-semibold">{totalOrders}</span>
          </p>
          <p className="mt-1 text-xs text-orange-600">
            Customer Charged: {formatCurrency(totalCustomerCharged)}
          </p>
        </div>
        <div className={`bg-gradient-to-br ${totalProfitLoss >= 0 ? 'from-green-50 to-green-100 border-green-200' : 'from-red-50 to-red-100 border-red-200'} border-2 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow`}>
          <h4 className="text-sm font-medium text-gray-700">Total Profit/Loss</h4>
          <p className={`mt-2 text-3xl font-bold ${totalProfitLoss >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {formatCurrency(totalProfitLoss)}
          </p>
        </div>
        <div className={`bg-gradient-to-br ${companyProfitLoss >= 0 ? 'from-blue-50 to-blue-100 border-blue-200' : 'from-red-50 to-red-100 border-red-200'} border-2 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow`}>
          <h4 className="text-sm font-medium text-gray-700">Company Profit/Loss</h4>
          <p className={`mt-2 text-3xl font-bold ${companyProfitLoss >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
            {formatCurrency(companyProfitLoss)}
          </p>
        </div>
        <div className={`bg-gradient-to-br ${uberProfitLoss >= 0 ? 'from-purple-50 to-purple-100 border-purple-200' : 'from-red-50 to-red-100 border-red-200'} border-2 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow`}>
          <h4 className="text-sm font-medium text-gray-700">Uber Profit/Loss</h4>
          <p className={`mt-2 text-3xl font-bold ${uberProfitLoss >= 0 ? 'text-purple-700' : 'text-red-700'}`}>
            {formatCurrency(uberProfitLoss)}
          </p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <h4 className="text-sm font-medium text-gray-700">Cancelled Losses</h4>
          <p className="mt-2 text-3xl font-bold text-red-700">
            {formatCurrency(cancelledLosses)}
          </p>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Charged</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actual Cost</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Profit/Loss</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {records && records.length > 0 ? (
                records.map((record) => {
                  const profit = record.customer_shipping_charged - record.actual_shipping_cost;
                  return (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(record.date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          {record.order_id ? `#${record.order_id}` : '-'}
                          {record.isFromTag && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800" title="From order tags">
                              Tag
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          record.status === 'Delivered' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {formatCurrency(record.customer_shipping_charged)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {formatCurrency(record.actual_shipping_cost)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${
                        profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(profit)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {record.isFromTag ? (
                          <span className="text-xs text-gray-500 italic">From order tags</span>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEditClick(record)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <PencilIcon className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRecord(record);
                                setIsDeleteModalOpen(true);
                              }}
                              className="text-red-600 hover:text-red-900"
                            >
                              <TrashIcon className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">
                    No shipping records for {formatMonthDisplay(selectedMonth)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Record Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Add Shipping Record</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 rounded-full hover:bg-gray-100">
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order ID (optional)</label>
                <input
                  type="number"
                  value={formData.order_id || ''}
                  onChange={(e) => setFormData({ ...formData, order_id: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as ShippingType })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="Company">Company</option>
                    <option value="Uber">Uber</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as ShippingStatus })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Charged (EGP) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.customer_shipping_charged}
                  onChange={(e) => setFormData({ ...formData, customer_shipping_charged: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Actual Cost (EGP) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.actual_shipping_cost}
                  onChange={(e) => setFormData({ ...formData, actual_shipping_cost: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Profit/Loss</label>
                <div className={`w-full rounded-md border-gray-300 bg-gray-50 px-3 py-2 font-semibold ${
                  profitLoss >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  EGP {profitLoss.toFixed(2)}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice ID (optional)</label>
                <input
                  type="text"
                  value={formData.invoice_id || ''}
                  onChange={(e) => setFormData({ ...formData, invoice_id: e.target.value || undefined })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Record Modal */}
      {isEditModalOpen && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Edit Shipping Record</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1 rounded-full hover:bg-gray-100">
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order ID (optional)</label>
                <input
                  type="number"
                  value={formData.order_id || ''}
                  onChange={(e) => setFormData({ ...formData, order_id: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as ShippingType })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="Company">Company</option>
                    <option value="Uber">Uber</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as ShippingStatus })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Charged (EGP) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.customer_shipping_charged}
                  onChange={(e) => setFormData({ ...formData, customer_shipping_charged: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Actual Cost (EGP) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.actual_shipping_cost}
                  onChange={(e) => setFormData({ ...formData, actual_shipping_cost: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Profit/Loss</label>
                <div className={`w-full rounded-md border-gray-300 bg-gray-50 px-3 py-2 font-semibold ${
                  profitLoss >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  EGP {profitLoss.toFixed(2)}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice ID (optional)</label>
                <input
                  type="text"
                  value={formData.invoice_id || ''}
                  onChange={(e) => setFormData({ ...formData, invoice_id: e.target.value || undefined })}
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
      {isDeleteModalOpen && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Delete Shipping Record</h3>
              <button onClick={() => setIsDeleteModalOpen(false)} className="p-1 rounded-full hover:bg-gray-100">
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this shipping record?
              <br />
              {selectedRecord.order_id && <span>Order #{selectedRecord.order_id} - </span>}
              <span className="font-medium">{selectedRecord.type}</span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(selectedRecord.id)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Dialog */}
      <BulkShippingCostImportDialog
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onImport={handleBulkImport}
      />
      <BulkShippingCostRevertDialog
        isOpen={isBulkRevertOpen}
        onClose={() => setIsBulkRevertOpen(false)}
        onRevert={handleBulkRevert}
      />
    </div>
  );
}

