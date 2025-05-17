import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { financeService } from '../../services/financeService';
import { format } from 'date-fns';

export default function ReportsTab() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Reports</h3>
      </div>
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
        <p className="text-gray-500">Reports functionality coming soon...</p>
      </div>
    </div>
  );
} 