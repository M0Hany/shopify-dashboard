import React, { useState } from 'react';

interface FileUploadProps {
  onUploadComplete: (results: {
    processed: number;
    updated: number;
    notFound: number;
    errors: number;
  }) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    console.log('=== STARTING FILE UPLOAD ===');
    console.log('File details:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log('Sending request to:', `${import.meta.env.VITE_API_URL}/api/orders/upload-paid-orders`);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/upload-paid-orders`, {
        method: 'POST',
        body: formData,
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload file');
      }

      onUploadComplete(data.results);
    } catch (err) {
      console.error('=== UPLOAD ERROR ===', err);
      setError(err instanceof Error ? err.message : 'An error occurred while uploading the file');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Upload Paid Orders Excel File
      </label>
      <div className="flex items-center space-x-4">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          disabled={isUploading}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-indigo-50 file:text-indigo-700
            hover:file:bg-indigo-100
            disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {isUploading && (
          <div className="text-sm text-gray-500">
            Uploading...
          </div>
        )}
      </div>
      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
};

export default FileUpload; 