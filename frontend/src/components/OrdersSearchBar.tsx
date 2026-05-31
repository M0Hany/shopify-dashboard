import React, { memo, useEffect, useState } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

export const ORDERS_SEARCH_DEBOUNCE_MS = 500;

export type OrdersSearchBarProps = {
  onDebouncedChange: (query: string) => void;
  /** Applied once (e.g. from URL ?search=) — sets input and notifies parent immediately. */
  seedQuery?: string | null;
};

function OrdersSearchBar({ onDebouncedChange, seedQuery = null }: OrdersSearchBarProps) {
  const [draftQuery, setDraftQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');

  useEffect(() => {
    if (seedQuery == null || seedQuery === '') return;
    setDraftQuery(seedQuery);
    setAppliedQuery(seedQuery);
    onDebouncedChange(seedQuery);
  }, [seedQuery, onDebouncedChange]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedQuery(draftQuery);
      onDebouncedChange(draftQuery);
    }, ORDERS_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draftQuery, onDebouncedChange]);

  const isPending = draftQuery !== appliedQuery;

  const handleClear = () => {
    setDraftQuery('');
  };

  return (
    <div className="relative flex-1 min-w-0">
      <input
        type="text"
        placeholder="Search orders..."
        value={draftQuery}
        onChange={(e) => setDraftQuery(e.target.value)}
        className="block w-full pl-10 pr-10 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
        aria-busy={isPending}
      />
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <MagnifyingGlassIcon className={`h-5 w-5 ${isPending ? 'text-blue-400' : 'text-gray-400'}`} />
      </div>
      {draftQuery ? (
        <button
          type="button"
          onClick={handleClear}
          className="absolute inset-y-0 right-0 pr-3 flex items-center justify-center rounded-r-lg transition-colors"
          title="Clear search"
        >
          <XMarkIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
        </button>
      ) : null}
    </div>
  );
}

export default memo(OrdersSearchBar);
