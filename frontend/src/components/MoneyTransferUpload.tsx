import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { XMarkIcon, ArrowUpTrayIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import { useQueryClient } from '@tanstack/react-query';

interface UploadResults {
  processed: number;
  updated: number;
  notFound: number;
  errors: number;
  failedTransfers?: Array<{
    customerName: string;
    customerPhone: string;
    reason: string;
  }>;
}

interface MoneyTransferUploadProps {
  onUploadComplete: (results: UploadResults) => void;
}

const MoneyTransferUpload: React.FC<MoneyTransferUploadProps> = ({ onUploadComplete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadResults, setUploadResults] = useState<UploadResults | null>(null);
  const queryClient = useQueryClient();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setError(null);
      setUploadResults(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1
  });

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadResults(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/upload-paid-orders`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload file');
      }

      setUploadResults(data.results);
      onUploadComplete(data.results);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while uploading the file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setFile(null);
    setError(null);
    setUploadResults(null);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center p-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        title="Upload Transfers"
      >
        <DocumentArrowUpIcon className="w-5 h-5 text-green-600" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Upload Money Transfers</h3>
              <button
                onClick={handleClose}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-blue-50 rounded-md">
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> This upload now matches orders using shipping barcodes from column A. 
                Make sure your Excel file has barcodes in the first column starting from row 4.
              </p>
            </div>

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                ${isDragActive ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'}`}
            >
              <input {...getInputProps()} />
              <ArrowUpTrayIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              {file ? (
                <div className="text-sm text-gray-600">
                  Selected file: {file.name}
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  {isDragActive ? (
                    <p>Drop the file here...</p>
                  ) : (
                    <p>Drag and drop your Excel file here, or click to select a file</p>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}

            {uploadResults && (
              <div className="mt-4 p-4 bg-gray-50 rounded-md">
                <h4 className="font-medium text-gray-900 mb-2">Upload Results:</h4>
                <div className="space-y-2 text-sm">
                  <p className="text-gray-600">Total Processed: {uploadResults.processed}</p>
                  <p className="text-green-600">Successfully Updated: {uploadResults.updated}</p>
                  <p className="text-yellow-600">Not Found: {uploadResults.notFound}</p>
                  <p className="text-red-600">Errors: {uploadResults.errors}</p>
                  
                  {uploadResults.failedTransfers && uploadResults.failedTransfers.length > 0 && (
                    <div className="mt-3">
                      <h5 className="font-medium text-gray-900 mb-2">Failed Transfers:</h5>
                      <div className="max-h-40 overflow-y-auto">
                        {uploadResults.failedTransfers.map((transfer, index) => (
                          <div key={index} className="p-2 bg-white rounded border border-red-100 mb-2">
                            <p className="font-medium">{transfer.customerName !== 'N/A' ? transfer.customerName : 'Unknown Customer'}</p>
                            <p className="text-gray-600">{transfer.customerPhone !== 'N/A' ? transfer.customerPhone : 'No Phone'}</p>
                            <p className="text-red-600 text-sm">{transfer.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end space-x-3">
              {uploadResults ? (
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Done
                </button>
              ) : (
                <button
                  onClick={handleUpload}
                  disabled={!file || isUploading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Processing...' : 'Process Transfers'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MoneyTransferUpload; 