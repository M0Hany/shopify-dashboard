import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, MapPinIcon, CheckIcon } from '@heroicons/react/24/outline';

// Define the Zone and SubZone types
interface Zone {
  Id: number;
  EnName: string;
  ArName: string;
  SubZoneId: number;
  SubZones: SubZone[];
}

interface SubZone {
  Id: number;
  Code: string;
  ArName: string;
  EnName: string;
}

interface ShippingAddress {
  address1: string;
  address2?: string;
  city: string;
  province: string;
  zip: string;
}

interface LocationDialogProps<T extends Zone | SubZone> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  locations: T[];
  onSelect: (location: T) => void;
  shippingAddress?: ShippingAddress;
  selectedId?: number | null;
  readOnly?: boolean;
}

function LocationDialog<T extends Zone | SubZone>({
  isOpen,
  onClose,
  title,
  locations,
  onSelect,
  shippingAddress,
  selectedId,
  readOnly = false
}: LocationDialogProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredLocations, setFilteredLocations] = useState<T[]>(locations);

  useEffect(() => {
    // First, find the selected location if it exists
    const selectedLocation = locations.find(loc => loc.Id === selectedId);
    
    // Filter the remaining locations
    const filtered = locations.filter(
      (location) =>
        location.EnName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        location.ArName.includes(searchTerm)
    );

    // If there's a selected location and it's not in the filtered results (due to search),
    // add it to the filtered results
    if (selectedLocation && !filtered.find(loc => loc.Id === selectedId)) {
      filtered.unshift(selectedLocation);
    }

    // If there's a selected location and it's in the filtered results,
    // move it to the top
    if (selectedLocation) {
      const index = filtered.findIndex(loc => loc.Id === selectedId);
      if (index > 0) {
        const [item] = filtered.splice(index, 1);
        filtered.unshift(item);
      }
    }

    setFilteredLocations(filtered);
  }, [searchTerm, locations, selectedId]);

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-sm rounded bg-white p-4 w-full">
          <div className="flex justify-between items-center mb-4">
            <Dialog.Title className="text-lg font-medium">
              {readOnly ? 'View Address' : title}
            </Dialog.Title>
            <button
              onClick={onClose}
              className="p-1 bg-white rounded-full hover:bg-white border border-transparent hover:border-gray-300 transition-colors"
            >
              <XMarkIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {shippingAddress && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-start gap-2">
                <MapPinIcon className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-gray-600">
                  <div>{shippingAddress.address1}</div>
                  {shippingAddress.address2 && <div>{shippingAddress.address2}</div>}
                  <div>
                    {shippingAddress.city}, {shippingAddress.province}
                    {shippingAddress.zip && ` ${shippingAddress.zip}`}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!readOnly && (
            <div className="mb-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div className="max-h-96 overflow-y-auto bg-white">
            {filteredLocations.map((location) => (
              <button
                key={location.Id}
                onClick={() => {
                  if (!readOnly) {
                    onSelect(location);
                  }
                }}
                disabled={readOnly}
                className={`w-full text-left px-4 py-2 bg-white rounded-md mb-1 flex items-center gap-2 ${
                  location.Id === selectedId ? 'bg-blue-50 border border-blue-200' : readOnly ? '' : 'hover:bg-gray-50'
                } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
              >
                {location.Id === selectedId && (
                  <CheckIcon className="h-5 w-5 text-blue-500 flex-shrink-0" />
                )}
                <span className="text-gray-900 text-right flex-grow">{location.ArName}</span>
              </button>
            ))}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

export type { Zone, SubZone };
export default LocationDialog; 