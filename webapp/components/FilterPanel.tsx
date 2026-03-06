'use client';

import { useState, useMemo } from 'react';
import { ParkingData, Filters, DEFAULT_FILTERS } from '@/types/parking';

interface FilterPanelProps {
  data: ParkingData | null;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

type SortMode = 'count' | 'az' | 'za';

function SortButton({ sort, onToggle }: { sort: SortMode; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="ml-auto text-[10px] text-gray-400 hover:text-gray-600 px-1 py-0.5 rounded hover:bg-gray-100 transition flex-shrink-0"
      title={sort === 'count' ? 'Sorteer op aantal' : sort === 'az' ? 'A-Z' : 'Z-A'}
    >
      {sort === 'count' ? '#' : sort === 'az' ? 'A-Z' : 'Z-A'}
    </button>
  );
}

function sortEntries(entries: [string, number][], sort: SortMode): [string, number][] {
  if (sort === 'az') return [...entries].sort((a, b) => a[0].localeCompare(b[0], 'nl'));
  if (sort === 'za') return [...entries].sort((a, b) => b[0].localeCompare(a[0], 'nl'));
  return [...entries].sort((a, b) => b[1] - a[1]);
}

function cycleSortMode(current: SortMode): SortMode {
  if (current === 'count') return 'az';
  if (current === 'az') return 'za';
  return 'count';
}

export default function FilterPanel({ data, filters, onFiltersChange }: FilterPanelProps) {
  const [showAllMunis, setShowAllMunis] = useState(false);
  const [opSearch, setOpSearch] = useState('');
  const [muniSearch, setMuniSearch] = useState('');
  const [opSort, setOpSort] = useState<SortMode>('count');
  const [muniSort, setMuniSort] = useState<SortMode>('count');

  const { municipalities, operators } = useMemo(() => {
    if (!data) return { municipalities: [], operators: [] };

    const muniCounts: Record<string, number> = {};
    const opCounts: Record<string, number> = {};

    data.features.forEach((f) => {
      const p = f.properties;
      muniCounts[p.municipality] = (muniCounts[p.municipality] || 0) + 1;
      opCounts[p.operator] = (opCounts[p.operator] || 0) + 1;
    });

    return {
      municipalities: Object.entries(muniCounts),
      operators: Object.entries(opCounts),
    };
  }, [data]);

  const filteredOps = useMemo(() => {
    let result = operators;
    if (opSearch) {
      const q = opSearch.toLowerCase();
      result = result.filter(([name]) => name.toLowerCase().includes(q));
    }
    return sortEntries(result, opSort);
  }, [operators, opSearch, opSort]);

  const filteredMunis = useMemo(() => {
    let result = municipalities;
    if (muniSearch) {
      const q = muniSearch.toLowerCase();
      result = result.filter(([name]) => name.toLowerCase().includes(q));
    }
    return sortEntries(result, muniSort);
  }, [municipalities, muniSearch, muniSort]);

  const displayedMunis = showAllMunis || muniSearch ? filteredMunis : filteredMunis.slice(0, 10);

  const toggleMunicipality = (name: string) => {
    const current = filters.municipalities;
    const updated = current.includes(name)
      ? current.filter((m) => m !== name)
      : [...current, name];
    onFiltersChange({ ...filters, municipalities: updated });
  };

  const toggleOperator = (name: string) => {
    const current = filters.operators;
    const updated = current.includes(name)
      ? current.filter((o) => o !== name)
      : [...current, name];
    onFiltersChange({ ...filters, operators: updated });
  };

  const handleStatusSelect = (status: Filters['statusFilter']) => {
    onFiltersChange({ ...filters, statusFilter: status });
  };

  const hasActiveFilters =
    filters.municipalities.length > 0 ||
    filters.operators.length > 0 ||
    filters.statusFilter !== 'all';

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-4 custom-scrollbar overflow-y-auto max-h-[calc(100vh-280px)] md:max-h-[calc(100vh-400px)]">
      {/* Header with reset */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={() => onFiltersChange(DEFAULT_FILTERS)}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            Reset filters
          </button>
        )}
      </div>

      {/* Status filter */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Status
        </h4>
        <div className="space-y-0.5">
          {[
            { value: 'all' as const, label: 'Alle garages' },
            { value: 'open' as const, label: 'Open' },
            { value: 'available' as const, label: 'Beschikbaar' },
            { value: 'full' as const, label: 'Vol' },
          ].map((opt) => {
            const isSelected = filters.statusFilter === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => handleStatusSelect(opt.value)}
                className={`w-full flex items-center gap-2 p-2 md:p-1.5 rounded text-left transition min-h-[44px] md:min-h-0 ${
                  isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <div className={`w-5 h-5 md:w-4 md:h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                }`}>
                  {isSelected && (
                    <svg className="w-3 h-3 md:w-2.5 md:h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className="text-sm md:text-xs font-medium">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Operators */}
      <div>
        <div className="flex items-center mb-2">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Exploitanten
            {filters.operators.length > 0 && (
              <span className="ml-1 text-blue-600 normal-case">({filters.operators.length})</span>
            )}
          </h4>
          <SortButton sort={opSort} onToggle={() => setOpSort(cycleSortMode(opSort))} />
        </div>
        <input
          type="text"
          placeholder="Zoek exploitant..."
          value={opSearch}
          onChange={(e) => setOpSearch(e.target.value)}
          className="w-full px-2 py-1 text-xs border border-gray-200 rounded mb-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="space-y-0.5 max-h-36 overflow-y-auto custom-scrollbar">
          {filteredOps.map(([name, count]) => (
            <label
              key={name}
              className="flex items-center gap-2 p-2 md:p-1 rounded hover:bg-gray-50 cursor-pointer min-h-[44px] md:min-h-0"
            >
              <input
                type="checkbox"
                checked={filters.operators.includes(name)}
                onChange={() => toggleOperator(name)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 md:w-3.5 md:h-3.5"
              />
              <span className="text-sm md:text-xs text-gray-700 flex-1 truncate">{name}</span>
              <span className="text-xs md:text-[10px] text-gray-400">{count}</span>
            </label>
          ))}
          {filteredOps.length === 0 && (
            <p className="text-xs text-gray-400 py-2 text-center">Geen resultaten</p>
          )}
        </div>
      </div>

      {/* Municipalities */}
      <div>
        <div className="flex items-center mb-2">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Gemeenten
            {filters.municipalities.length > 0 && (
              <span className="ml-1 text-blue-600 normal-case">({filters.municipalities.length})</span>
            )}
          </h4>
          <SortButton sort={muniSort} onToggle={() => setMuniSort(cycleSortMode(muniSort))} />
        </div>
        <input
          type="text"
          placeholder="Zoek gemeente..."
          value={muniSearch}
          onChange={(e) => setMuniSearch(e.target.value)}
          className="w-full px-2 py-1 text-xs border border-gray-200 rounded mb-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="space-y-0.5 max-h-48 md:max-h-40 overflow-y-auto custom-scrollbar">
          {displayedMunis.map(([name, count]) => (
            <label
              key={name}
              className="flex items-center gap-2 p-2 md:p-1 rounded hover:bg-gray-50 cursor-pointer min-h-[44px] md:min-h-0"
            >
              <input
                type="checkbox"
                checked={filters.municipalities.includes(name)}
                onChange={() => toggleMunicipality(name)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 md:w-3.5 md:h-3.5"
              />
              <span className="text-sm md:text-xs text-gray-700 flex-1 truncate">{name}</span>
              <span className="text-xs md:text-[10px] text-gray-400">{count}</span>
            </label>
          ))}
          {filteredMunis.length === 0 && (
            <p className="text-xs text-gray-400 py-2 text-center">Geen resultaten</p>
          )}
        </div>
        {!muniSearch && municipalities.length > 10 && (
          <button
            onClick={() => setShowAllMunis(!showAllMunis)}
            className="mt-2 md:mt-1.5 text-xs md:text-[10px] text-blue-600 hover:text-blue-800 hover:underline p-1"
          >
            {showAllMunis ? 'Minder' : `Alle ${municipalities.length}`}
          </button>
        )}
      </div>
    </div>
  );
}
