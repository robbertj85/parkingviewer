export interface ParkingFacilityProperties {
  uuid: string;
  name: string;
  municipality: string;
  operator: string;
  capacity: number | null;
  vacantSpaces: number | null;
  occupancyPercent: number | null;
  open: boolean | null;
  full: boolean | null;
  lastUpdated: number | null;
}

export interface ParkingFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  properties: ParkingFacilityProperties;
}

export interface ParkingData {
  type: 'FeatureCollection';
  metadata: {
    generated_at: string;
    total_facilities: number;
    municipalities: string[];
    municipality_counts: Record<string, number>;
  };
  features: ParkingFeature[];
}

export interface Summary {
  generated_at: string;
  total_facilities: number;
  total_with_dynamic: number;
  total_capacity: number;
  total_vacant: number;
  total_occupied: number;
  facilities_open: number;
  facilities_full: number;
  municipalities: number;
  by_operator: Record<string, number>;
  by_municipality: Record<string, number>;
}

export interface HourlySnapshot {
  timestamp: string;
  facility_count: number;
  facilities: Record<string, {
    v?: number; // vacantSpaces
    c?: number; // capacity
    o?: boolean; // open
    f?: boolean; // full
  }>;
}

export interface DailySnapshots {
  date: string;
  snapshots: Record<string, HourlySnapshot>;
}

export interface MunicipalityIndex {
  generated_at: string;
  municipalities: {
    name: string;
    slug: string;
    facility_count: number;
  }[];
}

export interface MunicipalityData {
  municipality: string;
  generated_at: string;
  facility_count: number;
  facilities: {
    uuid: string;
    name: string;
    operator: string;
    latitude: number;
    longitude: number;
    capacity: number | null;
    vacantSpaces: number | null;
    occupancyPercent: number | null;
    open: boolean | null;
    full: boolean | null;
    lastUpdated: number | null;
  }[];
}

export interface Filters {
  municipalities: string[];
  operators: string[];
  statusFilter: 'all' | 'open' | 'full' | 'available';
}

export const DEFAULT_FILTERS: Filters = {
  municipalities: [],
  operators: [],
  statusFilter: 'all',
};

export function getOccupancyColor(pct: number | null): string {
  if (pct === null) return '#6b7280'; // gray
  if (pct >= 95) return '#dc2626';   // red
  if (pct >= 80) return '#f97316';   // orange
  if (pct >= 60) return '#eab308';   // yellow
  if (pct >= 30) return '#3b82f6';   // blue
  return '#2563eb';                   // dark blue
}

export function getOccupancyLabel(pct: number | null): string {
  if (pct === null) return 'Onbekend';
  if (pct >= 95) return 'Vol';
  if (pct >= 80) return 'Bijna vol';
  if (pct >= 60) return 'Druk';
  if (pct >= 30) return 'Beschikbaar';
  return 'Rustig';
}
