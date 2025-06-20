// Types for location data
export interface SubZone {
  Id: number;
  Code: string;
  ArName: string;
  EnName: string;
}

export interface Zone {
  Id: number;
  EnName: string;
  ArName: string;
  SubZoneId: number;
  SubZones: SubZone[];
}

export interface City {
  Id: number;
  EnName: string;
  ArName: string;
  Zones: Zone[];
}

export interface LocationResponse {
  Value: City[];
}

// Helper functions
export const getLocationIds = (governorate: string, locationData: LocationResponse): { 
  cityId: string | null;
  neighborhoodId: string | null;
  subZoneId: string | null;
} => {
  const normalizedGovernorate = governorate.trim().toLowerCase();
  const city = locationData.Value.find(
    city => city.EnName.toLowerCase() === normalizedGovernorate || 
           city.ArName === governorate
  );

  if (!city) {
    console.warn(`Unknown governorate: ${governorate}`);
    return {
      cityId: null,
      neighborhoodId: null,
      subZoneId: null
    };
  }

  return {
    cityId: city.Id.toString(),
    neighborhoodId: null,
    subZoneId: null
  };
};

// Import the complete location data from the backend
export { locationData } from '../../../backend/src/data/locations'; 