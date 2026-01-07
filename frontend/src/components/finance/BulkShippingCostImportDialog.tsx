import { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, DocumentTextIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface BulkShippingCostImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (entries: Array<{ orderNumber: string; cost: number }>, transactionDate: string, orderIdMappings?: { [key: string]: number }) => Promise<void>;
}

interface Order {
  id: number;
  name: string;
  created_at: string;
  customer: {
    first_name: string;
    last_name: string;
    phone: string;
  };
  shipping_address: {
    city: string;
    province: string;
    address1: string;
  };
  total_price: string;
  financial_status: string;
  fulfillment_status: string;
}

interface DuplicateOrder {
  orderNumber: string;
  cost: number;
  orders: Order[];
  selectedOrderId: number | null;
}

export default function BulkShippingCostImportDialog({
  isOpen,
  onClose,
  onImport,
}: BulkShippingCostImportDialogProps) {
  const [pastedText, setPastedText] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedEntries, setParsedEntries] = useState<Array<{ orderNumber: string; cost: number }>>([]);
  const [duplicates, setDuplicates] = useState<DuplicateOrder[]>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [currentDuplicateIndex, setCurrentDuplicateIndex] = useState(0);

  const parseText = async () => {
    if (!pastedText.trim()) {
      toast.error('Please paste the shipping cost data');
      return;
    }

    const lines = pastedText.trim().split('\n');
    const entries: Array<{ orderNumber: string; cost: number }> = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Try to match patterns like:
      // #1120		78.36
      // #1120 78.36
      // 1120		78.36
      // 1120 78.36
      const patterns = [
        /^#?(\d+)[\s\t]+([\d.]+)$/, // #1120    78.36 or 1120    78.36
        /^#?(\d+)[\s\t]*([\d.]+)$/, // #1120 78.36 or 1120 78.36
      ];

      let matched = false;
      for (const pattern of patterns) {
        const match = trimmed.match(pattern);
        if (match) {
          const orderNumber = `#${match[1]}`;
          const cost = parseFloat(match[2]);
          
          if (isNaN(cost)) {
            continue;
          }

          entries.push({ orderNumber, cost });
          matched = true;
          break;
        }
      }

      if (!matched) {
        // Try splitting by tab or multiple spaces
        const parts = trimmed.split(/[\s\t]+/).filter(p => p.trim());
        if (parts.length >= 2) {
          const orderPart = parts[0].replace(/[^0-9]/g, '');
          const costPart = parts[1];
          
          if (orderPart && costPart) {
            const orderNumber = `#${orderPart}`;
            const cost = parseFloat(costPart);
            
            if (!isNaN(cost)) {
              entries.push({ orderNumber, cost });
            }
          }
        }
      }
    }

    if (entries.length === 0) {
      toast.error('No valid entries found. Please check the format.');
      return;
    }

    setParsedEntries(entries);
    
    // Check for duplicates after parsing
    setIsCheckingDuplicates(true);
    try {
      const duplicatesFound = await checkForDuplicates(entries);
      
      if (duplicatesFound.length > 0) {
        // Initialize selectedOrderId with first order for each duplicate
        const duplicatesWithSelection = duplicatesFound.map(dup => ({
          ...dup,
          selectedOrderId: dup.orders[0]?.id || null,
        }));
        setDuplicates(duplicatesWithSelection);
        setCurrentDuplicateIndex(0);
        setShowDuplicateDialog(true);
        setIsCheckingDuplicates(false);
        toast.success(`Parsed ${entries.length} entries. Found ${duplicatesFound.length} duplicate(s) that need selection.`);
      } else {
        setIsCheckingDuplicates(false);
        toast.success(`Parsed ${entries.length} entries. No duplicates found.`);
      }
    } catch (error: any) {
      setIsCheckingDuplicates(false);
      toast.error('Failed to check for duplicates');
    }
  };

  const checkForDuplicates = async (entries: Array<{ orderNumber: string; cost: number }>): Promise<DuplicateOrder[]> => {
    try {
      // Fetch all orders
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/orders`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      
      const allOrders: Order[] = await response.json();
      const duplicatesFound: DuplicateOrder[] = [];
      
      // Check each entry for duplicates
      for (const entry of entries) {
        const orderNum = entry.orderNumber.replace(/[^0-9]/g, '');
        const matchingOrders = allOrders.filter(order => {
          const orderNameNum = order.name.replace(/[^0-9]/g, '');
          return orderNameNum === orderNum;
        });
        
        if (matchingOrders.length > 1) {
          duplicatesFound.push({
            orderNumber: entry.orderNumber,
            cost: entry.cost,
            orders: matchingOrders,
            selectedOrderId: null,
          });
        }
      }
      
      return duplicatesFound;
    } catch (error: any) {
      console.error('Error checking for duplicates:', error);
      toast.error('Failed to check for duplicate orders');
      return [];
    }
  };

  const handleImport = async () => {
    if (parsedEntries.length === 0) {
      toast.error('Please parse the data first');
      return;
    }

    if (!transactionDate) {
      toast.error('Please select a transaction date');
      return;
    }

    // If duplicates exist but haven't been resolved, show dialog
    if (duplicates.length > 0 && duplicates.some(dup => !dup.selectedOrderId)) {
      setShowDuplicateDialog(true);
      setCurrentDuplicateIndex(0);
      toast.error('Please resolve all duplicate orders first');
      return;
    }

    // Proceed with import
    setIsProcessing(true);
    try {
      // Create order ID mappings from duplicates
      const orderIdMappings: { [key: string]: number } = {};
      duplicates.forEach(dup => {
        if (dup.selectedOrderId) {
          orderIdMappings[dup.orderNumber] = dup.selectedOrderId;
        }
      });

      await onImport(parsedEntries, transactionDate, orderIdMappings);
      toast.success(`Successfully imported ${parsedEntries.length} shipping costs`);
      handleClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to import shipping costs');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDuplicateSelection = (e: React.MouseEvent, selectedOrderId: number) => {
    e.stopPropagation();
    e.preventDefault();
    const currentDuplicate = duplicates[currentDuplicateIndex];
    if (!currentDuplicate) return;

    setDuplicates(prev => 
      prev.map((dup, index) => 
        index === currentDuplicateIndex
          ? { ...dup, selectedOrderId }
          : dup
      )
    );
  };

  const handleNextDuplicate = () => {
    if (currentDuplicateIndex < duplicates.length - 1) {
      setCurrentDuplicateIndex(prev => prev + 1);
    }
  };

  const handlePreviousDuplicate = () => {
    if (currentDuplicateIndex > 0) {
      setCurrentDuplicateIndex(prev => prev - 1);
    }
  };

  const handleConfirmDuplicates = () => {
    // Check if all duplicates have a selection
    const unselected = duplicates.find(dup => !dup.selectedOrderId);
    if (unselected) {
      toast.error(`Please select an order for ${unselected.orderNumber}`);
      // Jump to the unselected duplicate
      const unselectedIndex = duplicates.findIndex(dup => !dup.selectedOrderId);
      if (unselectedIndex !== -1) {
        setCurrentDuplicateIndex(unselectedIndex);
      }
      return;
    }

    // Close duplicate dialog - user can now click Import
    setShowDuplicateDialog(false);
    toast.success('All duplicate orders have been resolved. Click "Import" to proceed.');
  };

  const handleClose = () => {
    setPastedText('');
    setParsedEntries([]);
    setTransactionDate(format(new Date(), 'yyyy-MM-dd'));
    setDuplicates([]);
    setShowDuplicateDialog(false);
    onClose();
  };

  const totalCost = parsedEntries.reduce((sum, entry) => sum + entry.cost, 0);
  const totalCostWithTax = totalCost * 1.14;

  return (
    <Transition show={isOpen} as="div">
      <Dialog as="div" className="relative z-50" onClose={showDuplicateDialog ? () => {} : handleClose}>
        <Transition.Child
          as="div"
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        />

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as="div"
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
                <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    onClick={handleClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                    <DocumentTextIcon className="h-6 w-6 text-blue-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                    <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                      Bulk Import Shipping Company Costs
                    </Dialog.Title>
                    <div className="mt-4 space-y-4">
                      {/* Transaction Date */}
                      <div>
                        <label htmlFor="transaction-date" className="block text-sm font-medium text-gray-700 mb-1">
                          Transaction Date
                        </label>
                        <input
                          type="date"
                          id="transaction-date"
                          value={transactionDate}
                          onChange={(e) => setTransactionDate(e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        />
                      </div>

                      {/* Paste Area */}
                      <div>
                        <label htmlFor="pasted-text" className="block text-sm font-medium text-gray-700 mb-1">
                          Paste Shipping Cost Data
                        </label>
                        <p className="text-xs text-gray-500 mb-2">
                          Format: Order number and cost (e.g., #1120 78.36 or #1120    78.36)
                        </p>
                        <textarea
                          id="pasted-text"
                          rows={8}
                          value={pastedText}
                          onChange={(e) => setPastedText(e.target.value)}
                          placeholder="#1120		78.36&#10;#1122		78.36&#10;#1113		78.36"
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm font-mono"
                        />
                      </div>

                      {/* Parse Button */}
                      <div>
                        <button
                          type="button"
                          onClick={parseText}
                          disabled={!pastedText.trim() || isCheckingDuplicates}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isCheckingDuplicates ? 'Checking for duplicates...' : 'Parse Data'}
                        </button>
                      </div>

                      {/* Parsed Entries Preview */}
                      {parsedEntries.length > 0 && (
                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="text-sm font-medium text-gray-900">
                              Parsed Entries ({parsedEntries.length})
                            </h4>
                            <div className="text-sm text-gray-600">
                              <div>Total Cost: EGP {totalCost.toFixed(2)}</div>
                              <div className="font-semibold">
                                With 14% Tax: EGP {totalCostWithTax.toFixed(2)}
                              </div>
                            </div>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {parsedEntries.slice(0, 20).map((entry, index) => (
                                <div key={index} className="flex justify-between">
                                  <span className="font-mono">{entry.orderNumber}</span>
                                  <span>EGP {entry.cost.toFixed(2)}</span>
                                </div>
                              ))}
                              {parsedEntries.length > 20 && (
                                <div className="col-span-2 text-gray-500 text-center">
                                  ... and {parsedEntries.length - 20} more
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={parsedEntries.length === 0 || isProcessing || isCheckingDuplicates || !transactionDate || (duplicates.length > 0 && duplicates.some(dup => !dup.selectedOrderId))}
                    className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? 'Importing...' : `Import ${parsedEntries.length} Entries`}
                  </button>
                  {duplicates.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowDuplicateDialog(true);
                        setCurrentDuplicateIndex(0);
                      }}
                      className="inline-flex w-full justify-center rounded-md bg-yellow-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yellow-500 sm:mr-3 sm:w-auto"
                    >
                      Resolve {duplicates.length} Duplicate{duplicates.length > 1 ? 's' : ''}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleClose}
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                  >
                    Cancel
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>

      {/* Duplicate Orders Selection Dialog */}
      <Transition show={showDuplicateDialog} as="div">
        <Dialog as="div" className="relative z-50" onClose={() => setShowDuplicateDialog(false)}>
          <Transition.Child
            as="div"
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          />

          <div className="fixed inset-0 z-10 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as="div"
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel 
                  className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                    <button
                      type="button"
                      className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      onClick={() => setShowDuplicateDialog(false)}
                    >
                      <span className="sr-only">Close</span>
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                      <DocumentTextIcon className="h-6 w-6 text-yellow-600" aria-hidden="true" />
                    </div>
                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                      <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                        Select Correct Order for Duplicate ID
                      </Dialog.Title>
                      <div className="mt-4">
                        {duplicates.length > 0 && currentDuplicateIndex < duplicates.length ? (
                          <>
                            <div className="flex items-center justify-between mb-4">
                              <p className="text-sm text-gray-500">
                                Order {currentDuplicateIndex + 1} of {duplicates.length}
                              </p>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={handlePreviousDuplicate}
                                  disabled={currentDuplicateIndex === 0}
                                  className="p-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
                                </button>
                                <button
                                  type="button"
                                  onClick={handleNextDuplicate}
                                  disabled={currentDuplicateIndex === duplicates.length - 1}
                                  className="p-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <ChevronRightIcon className="w-5 h-5 text-gray-600" />
                                </button>
                              </div>
                            </div>

                            {(() => {
                              const currentDuplicate = duplicates[currentDuplicateIndex];
                              return (
                                <div className="border border-gray-200 rounded-lg p-4">
                                  <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-lg font-semibold text-gray-900">
                                      {currentDuplicate.orderNumber} - Cost: EGP {currentDuplicate.cost.toFixed(2)}
                                    </h4>
                                  </div>
                                  <p className="text-sm text-gray-600 mb-4">
                                    Multiple orders found with this number. Please select the correct one:
                                  </p>
                                  <div className="space-y-3 max-h-96 overflow-y-auto">
                                    {currentDuplicate.orders.map((order) => {
                                      const isSelected = currentDuplicate.selectedOrderId === order.id;
                                      return (
                                        <div
                                          key={order.id}
                                          onClick={(e) => handleDuplicateSelection(e, order.id)}
                                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                            isSelected
                                              ? 'border-blue-500 bg-blue-50 shadow-md'
                                              : 'border-gray-200 hover:border-gray-400 hover:shadow-sm bg-white'
                                          }`}
                                        >
                                          <div className="flex items-start gap-3">
                                            {isSelected && (
                                              <CheckIcon className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" />
                                            )}
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2 mb-2">
                                                <span className="font-semibold text-gray-900 text-lg">
                                                  Order {order.name}
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                  (ID: {order.id})
                                                </span>
                                              </div>
                                              <div className="text-sm text-gray-600 space-y-1">
                                                <div>
                                                  <span className="font-medium">Customer:</span> {order.customer?.first_name} {order.customer?.last_name}
                                                </div>
                                                <div>
                                                  <span className="font-medium">Phone:</span> {order.customer?.phone || 'N/A'}
                                                </div>
                                                <div>
                                                  <span className="font-medium">Address:</span> {order.shipping_address?.address1 || 'N/A'}, {order.shipping_address?.city || 'N/A'}, {order.shipping_address?.province || 'N/A'}
                                                </div>
                                                <div>
                                                  <span className="font-medium">Total:</span> EGP {parseFloat(order.total_price || '0').toFixed(2)}
                                                </div>
                                                <div>
                                                  <span className="font-medium">Status:</span> {order.financial_status || 'N/A'} / {order.fulfillment_status || 'N/A'}
                                                </div>
                                                <div className="text-xs text-gray-500 pt-1">
                                                  Created: {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
                          </>
                        ) : (
                          <p className="text-sm text-gray-500">No duplicates to resolve.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                      onClick={handleConfirmDuplicates}
                      disabled={isProcessing || duplicates.some(dup => !dup.selectedOrderId)}
                      className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Confirm Selections ({duplicates.filter(dup => dup.selectedOrderId).length}/{duplicates.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDuplicateDialog(false)}
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                    >
                      Cancel
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </Transition>
  );
}




