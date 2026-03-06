'use client';

import { useMemo } from 'react';
import { ParkingData, Filters, getOccupancyColor } from '@/types/parking';

interface StatsPanelProps {
  data: ParkingData | null;
  filters: Filters;
}

const OCCUPANCY_CATEGORIES = [
  { key: 'quiet', label: 'Rustig', color: '#16a34a', test: (pct: number | null) => pct !== null && pct < 30 },
  { key: 'available', label: 'Beschikbaar', color: '#22c55e', test: (pct: number | null) => pct !== null && pct >= 30 && pct < 60 },
  { key: 'busy', label: 'Druk', color: '#eab308', test: (pct: number | null) => pct !== null && pct >= 60 && pct < 80 },
  { key: 'almostFull', label: 'Bijna vol', color: '#f97316', test: (pct: number | null) => pct !== null && pct >= 80 && pct < 95 },
  { key: 'full', label: 'Vol', color: '#dc2626', test: (pct: number | null) => pct !== null && pct >= 95 },
  { key: 'unknown', label: 'Onbekend', color: '#6b7280', test: (pct: number | null) => pct === null },
];

export default function StatsPanel({ data, filters }: StatsPanelProps) {
  const stats = useMemo(() => {
    if (!data) return null;

    const filtered = data.features.filter((feature) => {
      const props = feature.properties;
      if (filters.municipalities.length > 0 && !filters.municipalities.includes(props.municipality)) return false;
      if (filters.operators.length > 0 && !filters.operators.includes(props.operator)) return false;
      if (filters.statusFilter === 'open' && !props.open) return false;
      if (filters.statusFilter === 'full' && !props.full) return false;
      if (filters.statusFilter === 'available' && (props.full || !props.open)) return false;
      return true;
    });

    let totalCapacity = 0;
    let totalVacant = 0;
    const muniCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};

    OCCUPANCY_CATEGORIES.forEach(cat => { categoryCounts[cat.key] = 0; });

    filtered.forEach((f) => {
      const p = f.properties;
      totalCapacity += p.capacity || 0;
      totalVacant += p.vacantSpaces || 0;
      muniCounts[p.municipality] = (muniCounts[p.municipality] || 0) + 1;

      for (const cat of OCCUPANCY_CATEGORIES) {
        if (cat.test(p.occupancyPercent)) {
          categoryCounts[cat.key]++;
          break;
        }
      }
    });

    const topMunicipalities = Object.entries(muniCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      total: data.metadata.total_facilities,
      filtered: filtered.length,
      totalCapacity,
      totalVacant,
      totalOccupied: totalCapacity - totalVacant,
      categoryCounts,
      topMunicipalities,
      uniqueMunicipalities: data.metadata.municipalities.length,
    };
  }, [data, filters]);

  if (!stats) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
      {/* Main count */}
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-gray-900">{stats.filtered.toLocaleString('nl-NL')}</span>
          {stats.filtered !== stats.total && (
            <span className="text-sm text-gray-400">/ {stats.total.toLocaleString('nl-NL')}</span>
          )}
          <span className="text-sm text-gray-500">parkeergarages</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {stats.uniqueMunicipalities} gemeenten
        </p>
      </div>

      {/* Occupancy breakdown */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bezettingsgraad</h3>
        <div className="space-y-1.5">
          {OCCUPANCY_CATEGORIES.map((cat) => {
            const count = stats.categoryCounts[cat.key];
            const percentage = stats.filtered > 0 ? (count / stats.filtered) * 100 : 0;

            return (
              <div key={cat.key} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-600 truncate">{cat.label}</span>
                    <span className="text-gray-900 font-medium ml-2">{count}</span>
                  </div>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden mt-0.5">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: cat.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Capacity summary */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Capaciteit</h3>
        <div className="space-y-0.5">
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Totale capaciteit</span>
            <span className="text-gray-900 font-medium">{stats.totalCapacity.toLocaleString('nl-NL')}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Bezet</span>
            <span className="text-gray-900 font-medium">{stats.totalOccupied.toLocaleString('nl-NL')}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Vrij</span>
            <span className="text-green-600 font-medium">{stats.totalVacant.toLocaleString('nl-NL')}</span>
          </div>
        </div>
      </div>

      {/* Data source */}
      <div className="pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          Bron:{' '}
          <a
            href="https://npropendata.rdw.nl/parkingdata/v2"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            Open Parkeerdata (SPDP v2)
          </a>
        </p>
      </div>
    </div>
  );
}
