'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import StatsPanel from '@/components/StatsPanel';
import FilterPanel from '@/components/FilterPanel';
import AboutModal from '@/components/AboutModal';
import DetailPanel from '@/components/DetailPanel';
import { ParkingData, ParkingFeature, Filters, DEFAULT_FILTERS } from '@/types/parking';

const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-500">Kaart laden...</p>
      </div>
    </div>
  ),
});

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  );
}

export default function Home() {
  const [data, setData] = useState<ParkingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showAbout, setShowAbout] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState<ParkingFeature | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleSelectFacility = useCallback((feature: ParkingFeature) => {
    setSelectedFacility(feature);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setMobileSidebarOpen(false);
        setSelectedFacility(null);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch('/data/parking_facilities.geojson')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: ParkingData) => {
        setData(data);
        setError(null);
      })
      .catch((err) => {
        console.error('Error loading data:', err);
        setError('Kon data niet laden. Probeer het later opnieuw.');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm z-20">
        <div className="px-3 py-2 md:px-4 md:py-3 flex items-center gap-2 md:gap-4">
          {/* Logo */}
          <div className="flex-shrink-0">
            <h1 className="text-lg md:text-xl font-bold text-gray-900">
              <span className="hidden sm:inline">Parkeerviewer</span>
              <span className="sm:hidden">Parkeerviewer</span>
            </h1>
          </div>

          {/* Subtitle */}
          <div className="hidden md:block text-sm text-gray-500">
            Parkeerbezetting Nederland
          </div>

          {/* Loading indicator */}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500 ml-auto md:ml-0">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="hidden sm:inline">Laden...</span>
            </div>
          )}

          {/* Desktop action buttons */}
          <div className="hidden lg:flex gap-2 ml-auto">
            <Link
              href="/data-export"
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Data Export
            </Link>
            <Link
              href="/api/v1/docs"
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              API
            </Link>
            <button
              onClick={() => setShowAbout(true)}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Over
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition ml-auto"
            aria-label="Menu openen"
          >
            {mobileMenuOpen ? <CloseIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 bg-white">
            <div className="px-3 py-2 space-y-1">
              <Link
                href="/data-export"
                className="flex items-center px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Data Export
              </Link>
              <Link
                href="/api/v1/docs"
                className="flex items-center px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                API Documentatie
              </Link>
              <button
                onClick={() => {
                  setShowAbout(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Over dit project
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile sidebar overlay */}
        {mobileSidebarOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-30"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed md:relative inset-y-0 left-0 z-40 md:z-auto
            w-[85vw] max-w-[320px] md:w-80
            bg-gray-50 p-3 md:p-4 overflow-y-auto space-y-3 md:space-y-4
            transform transition-transform duration-300 ease-in-out
            ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            shadow-xl md:shadow-none
          `}
        >
          {/* Mobile sidebar header */}
          <div className="md:hidden flex items-center justify-between pb-2 border-b border-gray-200 mb-2">
            <h2 className="text-lg font-semibold text-gray-900">Filters & Stats</h2>
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition"
              aria-label="Sluiten"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>

          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
            </div>
          ) : (
            <>
              <StatsPanel data={data} filters={filters} />
              <FilterPanel data={data} filters={filters} onFiltersChange={setFilters} />
            </>
          )}
        </aside>

        {/* Map */}
        <main className="flex-1 relative">
          <Map
            data={data}
            filters={filters}
            onSelectFacility={handleSelectFacility}
            selectedUuid={selectedFacility?.properties.uuid ?? null}
          />

          {/* Mobile floating filter button */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden fixed bottom-20 left-4 z-20 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 active:bg-blue-800 transition"
            aria-label="Filters openen"
          >
            <FilterIcon className="w-6 h-6" />
          </button>
        </main>

        {/* Detail panel (right side) */}
        {selectedFacility && (
          <>
            {/* Mobile: overlay */}
            <div
              className="md:hidden fixed inset-0 bg-black/50 z-30"
              onClick={() => setSelectedFacility(null)}
            />
            <aside
              className={`
                fixed md:relative inset-y-0 right-0 z-40 md:z-auto
                w-[85vw] max-w-[360px] md:w-96
                border-l border-gray-200
                transform transition-transform duration-300 ease-in-out
                translate-x-0
                shadow-xl md:shadow-none
              `}
            >
              <DetailPanel
                feature={selectedFacility}
                onClose={() => setSelectedFacility(null)}
              />
            </aside>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 px-3 md:px-4 py-2">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-1 sm:gap-0 text-xs text-gray-500">
          <button
            onClick={() => setShowAbout(true)}
            className="text-blue-600 hover:text-blue-800 hover:underline focus:outline-none py-1"
          >
            Info over databronnen
          </button>
          {data && (
            <p className="text-center sm:text-right">
              {data.metadata.total_facilities.toLocaleString('nl-NL')} parkeergarages | Update: {new Date(data.metadata.generated_at).toLocaleDateString('nl-NL')}
            </p>
          )}
        </div>
      </footer>

      {/* About Modal */}
      <AboutModal isOpen={showAbout} onClose={() => setShowAbout(false)} />
    </div>
  );
}
