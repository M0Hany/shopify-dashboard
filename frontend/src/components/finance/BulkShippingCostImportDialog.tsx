import { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface BulkShippingCostImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (entries: Array<{ orderNumber: string; cost: number }>, transactionDate: string, orderIdMappings?: { [key: string]: number }) => Promise<void>;
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

  const parseText = () => {
    if (!pastedText.trim()) {
      toast.error('Please paste the shipping cost data');
      return;
    }

    const lines = pastedText.trim().split('\n');
    const entries: Array<{ orderNumber: string; cost: number }> = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const patterns = [
        /^#?(\d+)[\s\t]+([\d.]+)$/,
        /^#?(\d+)[\s\t]*([\d.]+)$/,
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
        const parts = trimmed.split(/[\s\t]+/).filter((p) => p.trim());
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
    toast.success(`Parsed ${entries.length} entries`);
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

    setIsProcessing(true);
    try {
      await onImport(parsedEntries, transactionDate);
      toast.success(`Successfully imported ${parsedEntries.length} shipping costs`);
      handleClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to import shipping costs';
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setPastedText('');
    setParsedEntries([]);
    setTransactionDate(format(new Date(), 'yyyy-MM-dd'));
    onClose();
  };

  const totalCost = parsedEntries.reduce((sum, entry) => sum + entry.cost, 0);

  return (
    <Transition show={isOpen} as="div">
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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

                      <div>
                        <button
                          type="button"
                          onClick={parseText}
                          disabled={!pastedText.trim()}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Parse Data
                        </button>
                      </div>

                      {parsedEntries.length > 0 && (
                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="text-sm font-medium text-gray-900">
                              Parsed Entries ({parsedEntries.length})
                            </h4>
                            <div className="text-sm font-semibold text-gray-600">
                              Total Cost: EGP {totalCost.toFixed(2)}
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
                    disabled={parsedEntries.length === 0 || isProcessing || !transactionDate}
                    className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? 'Importing...' : `Import ${parsedEntries.length} Entries`}
                  </button>
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
    </Transition>
  );
}
