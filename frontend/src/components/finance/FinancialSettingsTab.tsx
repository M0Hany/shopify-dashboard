import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financialService, ProductCost, ProductCostInput, PayoutConfig, PayoutConfigInput, ProductionCost, ProductionCostInput } from '../../services/financialService';
import { TrashIcon, PencilIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import MonthNavigator from './MonthNavigator';

interface FinancialSettingsTabProps {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  onBack: () => void;
}

export default function FinancialSettingsTab({ selectedMonth, setSelectedMonth, onBack }: FinancialSettingsTabProps) {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<'product-costs' | 'production-costs' | 'payout-config'>('product-costs');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProductCost, setSelectedProductCost] = useState<ProductCost | null>(null);
  
  const [productFormData, setProductFormData] = useState<ProductCostInput>({
    product_id: '',
    product_name: '',
    crochet_labor_per_unit: 0,
    yarn_cost_per_unit: 0,
    helper_colors_cost_per_unit: 0,
    laser_felt_cost_per_unit: 0,
    packaging_per_unit: 0,
  });

  const { data: productCosts, isLoading: productsLoading } = useQuery({
    queryKey: ['product-costs'],
    queryFn: () => financialService.getProductCosts(),
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 0,
  });

  const { data: payoutConfig, isLoading: configLoading } = useQuery({
    queryKey: ['payout-config'],
    queryFn: () => financialService.getPayoutConfig(),
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 0,
  });

  // Production Costs
  const [isProductionCostModalOpen, setIsProductionCostModalOpen] = useState(false);
  const [selectedProductionCost, setSelectedProductionCost] = useState<ProductionCost | null>(null);
  const [productionCostFormData, setProductionCostFormData] = useState<ProductionCostInput>({
    product_id: '',
    product_name: '',
    quantity: 1,
    unit_cost: 0,
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });

  const { data: productionCosts, isLoading: productionCostsLoading } = useQuery({
    queryKey: ['production-costs', selectedMonth],
    queryFn: () => financialService.getProductionCosts(selectedMonth),
  });

  const { data: productCostsForProduction } = useQuery({
    queryKey: ['product-costs'],
    queryFn: () => financialService.getProductCosts(),
    enabled: activeSection === 'production-costs',
  });

  const createProductMutation = useMutation({
    mutationFn: financialService.createProductCost,
    onMutate: async (newProduct) => {
      await queryClient.cancelQueries({ queryKey: ['product-costs'] });
      const previousProducts = queryClient.getQueryData(['product-costs']);
      
      queryClient.setQueryData(['product-costs'], (old: ProductCost[] = []) => {
        const tempProduct: ProductCost = {
          id: `temp-${Date.now()}`,
          ...newProduct,
          total_unit_cost: newProduct.crochet_labor_per_unit + newProduct.yarn_cost_per_unit + 
                          newProduct.helper_colors_cost_per_unit + newProduct.laser_felt_cost_per_unit + 
                          newProduct.packaging_per_unit,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        // Insert in sorted position (by product_name ascending)
        const newList = [...old, tempProduct];
        newList.sort((a, b) => a.product_name.localeCompare(b.product_name));
        return newList;
      });
      
      return { previousProducts };
    },
    onSuccess: (data) => {
      // Update with real data from server and maintain sort
      queryClient.setQueryData(['product-costs'], (old: ProductCost[] = []) => {
        const updated = old.map(product => product.id.startsWith('temp-') ? data : product);
        // Re-sort to maintain order (by product_name ascending)
        updated.sort((a, b) => a.product_name.localeCompare(b.product_name));
        return updated;
      });
      setIsAddModalOpen(false);
      setProductFormData({
        product_id: '',
        product_name: '',
        crochet_labor_per_unit: 0,
        yarn_cost_per_unit: 0,
        helper_colors_cost_per_unit: 0,
        laser_felt_cost_per_unit: 0,
        packaging_per_unit: 0,
      });
      toast.success('Product cost added successfully');
    },
    onError: (error: any, newProduct, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(['product-costs'], context.previousProducts);
      }
      toast.error(error.message || 'Failed to add product cost');
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProductCostInput> }) =>
      financialService.updateProductCost(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['product-costs'] });
      const previousProducts = queryClient.getQueryData(['product-costs']);
      
      queryClient.setQueryData(['product-costs'], (old: ProductCost[] = []) => {
        const updated = old.map(product => {
          if (product.id === id) {
            const updatedProduct = { ...product, ...data };
            if (data.crochet_labor_per_unit !== undefined || data.yarn_cost_per_unit !== undefined ||
                data.helper_colors_cost_per_unit !== undefined || data.laser_felt_cost_per_unit !== undefined ||
                data.packaging_per_unit !== undefined) {
              updatedProduct.total_unit_cost = (data.crochet_labor_per_unit ?? product.crochet_labor_per_unit) +
                                      (data.yarn_cost_per_unit ?? product.yarn_cost_per_unit) +
                                      (data.helper_colors_cost_per_unit ?? product.helper_colors_cost_per_unit) +
                                      (data.laser_felt_cost_per_unit ?? product.laser_felt_cost_per_unit) +
                                      (data.packaging_per_unit ?? product.packaging_per_unit);
            }
            updatedProduct.updated_at = new Date().toISOString();
            return updatedProduct;
          }
          return product;
        });
        // Re-sort to maintain order (by product_name ascending) in case name changed
        updated.sort((a, b) => a.product_name.localeCompare(b.product_name));
        return updated;
      });
      
      return { previousProducts };
    },
    onSuccess: (data) => {
      // Update with real data from server and maintain sort
      queryClient.setQueryData(['product-costs'], (old: ProductCost[] = []) => {
        const updated = old.map(product => product.id === data.id ? data : product);
        // Re-sort to maintain order (by product_name ascending) in case name changed
        updated.sort((a, b) => a.product_name.localeCompare(b.product_name));
        return updated;
      });
      setIsEditModalOpen(false);
      setSelectedProductCost(null);
      toast.success('Product cost updated successfully');
    },
    onError: (error: any, variables, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(['product-costs'], context.previousProducts);
      }
      toast.error(error.message || 'Failed to update product cost');
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: financialService.deleteProductCost,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['product-costs'] });
      const previousProducts = queryClient.getQueryData(['product-costs']);
      
      queryClient.setQueryData(['product-costs'], (old: ProductCost[] = []) => {
        return old.filter(product => product.id !== id);
      });
      
      return { previousProducts };
    },
    onSuccess: () => {
      // Data already removed optimistically, no need to invalidate
      setIsDeleteModalOpen(false);
      setSelectedProductCost(null);
      toast.success('Product cost deleted successfully');
    },
    onError: (error: any, id, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(['product-costs'], context.previousProducts);
      }
      toast.error(error.message || 'Failed to delete product cost');
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: (data: PayoutConfigInput) => financialService.updatePayoutConfig(data),
    onMutate: async (newConfig) => {
      await queryClient.cancelQueries({ queryKey: ['payout-config'] });
      const previousConfig = queryClient.getQueryData(['payout-config']);
      
      queryClient.setQueryData(['payout-config'], (old: PayoutConfig | undefined) => {
        if (!old) return old;
        return { ...old, ...newConfig, updated_at: new Date().toISOString() };
      });
      
      return { previousConfig };
    },
    onSuccess: (data) => {
      // Update with real data from server
      queryClient.setQueryData(['payout-config'], data);
      toast.success('Payout configuration updated successfully');
    },
    onError: (error: any, variables, context) => {
      if (context?.previousConfig) {
        queryClient.setQueryData(['payout-config'], context.previousConfig);
      }
      toast.error(error.message || 'Failed to update payout configuration');
    },
  });

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createProductMutation.mutate(productFormData);
  };

  const handleProductEditClick = (product: ProductCost) => {
    setSelectedProductCost(product);
    setProductFormData({
      product_id: product.product_id,
      product_name: product.product_name,
      crochet_labor_per_unit: product.crochet_labor_per_unit,
      yarn_cost_per_unit: product.yarn_cost_per_unit,
      helper_colors_cost_per_unit: product.helper_colors_cost_per_unit,
      laser_felt_cost_per_unit: product.laser_felt_cost_per_unit,
      packaging_per_unit: product.packaging_per_unit,
    });
    setIsEditModalOpen(true);
  };

  const handleProductEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProductCost) {
      updateProductMutation.mutate({
        id: selectedProductCost.id,
        data: productFormData,
      });
    }
  };

  const handleConfigSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (payoutConfig) {
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);
      updateConfigMutation.mutate({
        media_buyer_percent: parseFloat(formData.get('media_buyer_percent') as string),
        ops_percent: parseFloat(formData.get('ops_percent') as string),
        crm_percent: parseFloat(formData.get('crm_percent') as string),
        owner_pay_type: formData.get('owner_pay_type') as 'fixed' | 'percent',
        owner_pay_value: parseFloat(formData.get('owner_pay_value') as string),
      });
    }
  };

  const totalUnitCost = 
    productFormData.crochet_labor_per_unit +
    productFormData.yarn_cost_per_unit +
    productFormData.helper_colors_cost_per_unit +
    productFormData.laser_felt_cost_per_unit +
    productFormData.packaging_per_unit;

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900">Financial Settings</h3>
        <p className="text-sm text-gray-500 mt-1">Configure product costs and payout settings</p>
      </div>
      {/* Section Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveSection('product-costs')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeSection === 'product-costs'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Product Costs
          </button>
          <button
            onClick={() => setActiveSection('production-costs')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeSection === 'production-costs'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Production Costs
          </button>
          <button
            onClick={() => setActiveSection('payout-config')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeSection === 'payout-config'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Payout Configuration
          </button>
        </nav>
      </div>

      {/* Product Costs Section */}
      {activeSection === 'product-costs' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Product Cost Configuration</h3>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Add Product Cost
            </button>
          </div>

          {productsLoading ? (
            <div className="text-center py-8">Loading product costs...</div>
          ) : (
            <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Labor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Yarn</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Helper Colors</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Laser Felt</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Packaging</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Cost</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {productCosts && productCosts.length > 0 ? (
                      productCosts.map((product) => (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{product.product_name}</div>
                            <div className="text-xs text-gray-500">ID: {product.product_id}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            EGP {product.crochet_labor_per_unit.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            EGP {product.yarn_cost_per_unit.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            EGP {product.helper_colors_cost_per_unit.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            EGP {product.laser_felt_cost_per_unit.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            EGP {product.packaging_per_unit.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            EGP {product.total_unit_cost.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleProductEditClick(product)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                <PencilIcon className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedProductCost(product);
                                  setIsDeleteModalOpen(true);
                                }}
                                className="text-red-600 hover:text-red-900"
                              >
                                <TrashIcon className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">
                          No product costs configured. Add your first product cost to get started.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payout Configuration Section */}
      {activeSection === 'payout-config' && (
        <div className="space-y-6">
          <h3 className="text-lg font-medium text-gray-900">Payout Configuration</h3>
          
          {configLoading ? (
            <div className="text-center py-8">Loading payout configuration...</div>
          ) : payoutConfig ? (
            <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
              <form onSubmit={handleConfigSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Media Buyer Percent (%)
                    </label>
                    <input
                      type="number"
                      name="media_buyer_percent"
                      required
                      min="0"
                      max="100"
                      step="0.01"
                      defaultValue={payoutConfig.media_buyer_percent}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Operations Percent (%)
                    </label>
                    <input
                      type="number"
                      name="ops_percent"
                      required
                      min="0"
                      max="100"
                      step="0.01"
                      defaultValue={payoutConfig.ops_percent}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CRM Percent (%)
                    </label>
                    <input
                      type="number"
                      name="crm_percent"
                      required
                      min="0"
                      max="100"
                      step="0.01"
                      defaultValue={payoutConfig.crm_percent}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Owner Pay Type
                    </label>
                    <select
                      name="owner_pay_type"
                      required
                      defaultValue={payoutConfig.owner_pay_type}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="fixed">Fixed Amount</option>
                      <option value="percent">Percentage</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Owner Pay Value
                    </label>
                    <input
                      type="number"
                      name="owner_pay_value"
                      required
                      min="0"
                      step="0.01"
                      defaultValue={payoutConfig.owner_pay_value}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {payoutConfig.owner_pay_type === 'fixed' ? 'Fixed amount in EGP' : 'Percentage of DPP'}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={updateConfigMutation.isPending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {updateConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>
              </form>
            </div>
          ) : null}
        </div>
      )}

      {/* Add Product Cost Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Add Product Cost</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 rounded-full hover:bg-gray-100">
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleProductSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product ID (Shopify) *</label>
                  <input
                    type="text"
                    required
                    value={productFormData.product_id}
                    onChange={(e) => setProductFormData({ ...productFormData, product_id: e.target.value })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={productFormData.product_name}
                    onChange={(e) => setProductFormData({ ...productFormData, product_name: e.target.value })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Crochet Labor (EGP) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={productFormData.crochet_labor_per_unit}
                    onChange={(e) => setProductFormData({ ...productFormData, crochet_labor_per_unit: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Yarn Cost (EGP) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={productFormData.yarn_cost_per_unit}
                    onChange={(e) => setProductFormData({ ...productFormData, yarn_cost_per_unit: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Helper Colors (EGP) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={productFormData.helper_colors_cost_per_unit}
                    onChange={(e) => setProductFormData({ ...productFormData, helper_colors_cost_per_unit: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Laser Felt (EGP) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={productFormData.laser_felt_cost_per_unit}
                    onChange={(e) => setProductFormData({ ...productFormData, laser_felt_cost_per_unit: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Packaging (EGP) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={productFormData.packaging_per_unit}
                    onChange={(e) => setProductFormData({ ...productFormData, packaging_per_unit: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Cards + zipper bag only (not flyer/cloth/ribbon)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Unit Cost</label>
                  <div className="w-full rounded-md border-gray-300 bg-gray-50 px-3 py-2 text-lg font-semibold text-gray-900">
                    EGP {totalUnitCost.toFixed(2)}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Calculated automatically</p>
                </div>
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
                  disabled={createProductMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {createProductMutation.isPending ? 'Saving...' : 'Save Product Cost'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Cost Modal */}
      {isEditModalOpen && selectedProductCost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Edit Product Cost</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1 rounded-full hover:bg-gray-100">
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleProductEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product ID</label>
                  <input
                    type="text"
                    disabled
                    value={productFormData.product_id}
                    className="w-full rounded-md border-gray-300 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={productFormData.product_name}
                    onChange={(e) => setProductFormData({ ...productFormData, product_name: e.target.value })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Crochet Labor (EGP) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={productFormData.crochet_labor_per_unit}
                    onChange={(e) => setProductFormData({ ...productFormData, crochet_labor_per_unit: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Yarn Cost (EGP) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={productFormData.yarn_cost_per_unit}
                    onChange={(e) => setProductFormData({ ...productFormData, yarn_cost_per_unit: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Helper Colors (EGP) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={productFormData.helper_colors_cost_per_unit}
                    onChange={(e) => setProductFormData({ ...productFormData, helper_colors_cost_per_unit: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Laser Felt (EGP) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={productFormData.laser_felt_cost_per_unit}
                    onChange={(e) => setProductFormData({ ...productFormData, laser_felt_cost_per_unit: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Packaging (EGP) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={productFormData.packaging_per_unit}
                    onChange={(e) => setProductFormData({ ...productFormData, packaging_per_unit: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Unit Cost</label>
                  <div className="w-full rounded-md border-gray-300 bg-gray-50 px-3 py-2 text-lg font-semibold text-gray-900">
                    EGP {totalUnitCost.toFixed(2)}
                  </div>
                </div>
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
                  disabled={updateProductMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {updateProductMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedProductCost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Delete Product Cost</h3>
              <button onClick={() => setIsDeleteModalOpen(false)} className="p-1 rounded-full hover:bg-gray-100">
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete the cost configuration for <span className="font-medium">{selectedProductCost.product_name}</span>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteProductMutation.mutate(selectedProductCost.id);
                }}
                disabled={deleteProductMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleteProductMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
