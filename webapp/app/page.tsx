'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import StatsPanel from '@/components/StatsPanel';
import FilterPanel from '@/components/FilterPanel';
import AboutModal from '@/components/AboutModal';
import FeedbackModal from '@/components/FeedbackModal';
import DetailPanel from '@/components/DetailPanel';
import SearchBar from '@/components/SearchBar';
import { ParkingData, ParkingFeature, Filters, DEFAULT_FILTERS } from '@/types/parking';
import type { MapHandle } from '@/components/Map';

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
  const [showFeedback, setShowFeedback] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState<ParkingFeature | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const mapRef = useRef<MapHandle>(null);

  const handleSelectFacility = useCallback((feature: ParkingFeature) => {
    setSelectedFacility(feature);
  }, []);

  const handleSearchMunicipality = useCallback((name: string) => {
    setFilters(prev => ({
      ...prev,
      municipalities: prev.municipalities.includes(name) ? prev.municipalities : [name],
    }));
  }, []);

  const handleFlyTo = useCallback((lat: number, lng: number, zoom?: number) => {
    mapRef.current?.flyTo(lat, lng, zoom);
  }, []);

  const municipalityList = data?.metadata.municipalities ?? [];

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
          <div className="flex-shrink-0 flex items-center gap-1.5">
            <svg className="w-6 h-6 md:w-7 md:h-7 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <text x="12" y="17" textAnchor="middle" fill="currentColor" stroke="none" fontSize="14" fontWeight="bold" fontFamily="system-ui">P</text>
            </svg>
            <h1 className="text-lg md:text-xl font-bold text-gray-900">
              Parkeerdataviewer
            </h1>
          </div>

          {/* Subtitle */}
          <div className="hidden lg:block text-sm text-gray-500">
            Parkeerbezetting Nederland
          </div>

          {/* Search bar */}
          <div className="hidden sm:flex flex-1 max-w-md mx-2">
            <SearchBar
              municipalities={municipalityList}
              onSelectMunicipality={handleSearchMunicipality}
              onFlyTo={handleFlyTo}
            />
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
            <button
              onClick={() => setShowFeedback(true)}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              Feedback
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
              {/* Mobile search */}
              <div className="sm:hidden pb-2">
                <SearchBar
                  municipalities={municipalityList}
                  onSelectMunicipality={(name) => {
                    handleSearchMunicipality(name);
                    setMobileMenuOpen(false);
                  }}
                  onFlyTo={(lat, lng, zoom) => {
                    handleFlyTo(lat, lng, zoom);
                    setMobileMenuOpen(false);
                  }}
                />
              </div>
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
              <button
                onClick={() => {
                  setShowFeedback(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                Feedback
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
            fixed md:relative top-0 bottom-0 left-0 z-40 md:z-auto
            w-[85vw] max-w-[320px] md:w-80
            bg-gray-50 p-3 md:p-4 overflow-y-auto space-y-3 md:space-y-4
            transform transition-transform duration-300 ease-in-out
            ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            shadow-xl md:shadow-none safe-bottom
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
            ref={mapRef}
            data={data}
            filters={filters}
            onSelectFacility={handleSelectFacility}
            selectedUuid={selectedFacility?.properties.uuid ?? null}
          />

          {/* Mobile floating filter button - hide when detail panel or sidebar is open */}
          {!selectedFacility && !mobileSidebarOpen && (
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden fixed bottom-12 left-4 z-20 bg-blue-600 text-white p-3.5 rounded-full shadow-lg hover:bg-blue-700 active:bg-blue-800 transition safe-bottom"
              aria-label="Filters openen"
            >
              <FilterIcon className="w-5 h-5" />
            </button>
          )}
        </main>

        {/* Detail panel (right side on desktop, bottom sheet on mobile) */}
        {selectedFacility && (
          <>
            {/* Overlay */}
            <div
              className="md:hidden fixed inset-0 bg-black/50 z-30"
              onClick={() => setSelectedFacility(null)}
            />
            {/* Mobile: bottom sheet */}
            <aside
              className="
                md:hidden fixed bottom-0 left-0 right-0 z-40
                max-h-[85vh] rounded-t-2xl
                shadow-2xl
                transform transition-transform duration-300 ease-in-out
                translate-y-0
                safe-bottom
              "
            >
              <DetailPanel
                feature={selectedFacility}
                onClose={() => setSelectedFacility(null)}
                mobile
              />
            </aside>
            {/* Desktop: right panel */}
            <aside
              className="
                hidden md:block relative z-auto
                w-96
                border-l border-gray-200
                shadow-none
              "
            >
              <DetailPanel
                feature={selectedFacility}
                onClose={() => setSelectedFacility(null)}
              />
            </aside>
          </>
        )}
      </div>

      {/* Footer - hidden on mobile when detail panel is open */}
      <footer className={`bg-white border-t border-gray-200 px-3 md:px-4 py-1.5 md:py-2 safe-bottom ${selectedFacility ? 'hidden md:block' : ''}`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center text-[10px] md:text-xs text-gray-500">
          <button
            onClick={() => setShowAbout(true)}
            className="text-blue-600 hover:text-blue-800 hover:underline focus:outline-none py-0.5"
          >
            Info
          </button>
          {data && (
            <p className="text-right">
              <span className="hidden sm:inline">{data.metadata.total_facilities.toLocaleString('nl-NL')} parkeergarages | </span>
              <span className="sm:hidden">{data.metadata.total_facilities.toLocaleString('nl-NL')} | </span>
              {new Date(data.metadata.generated_at).toLocaleDateString('nl-NL')}
            </p>
          )}
        </div>
      </footer>

      {/* About Modal */}
      <AboutModal isOpen={showAbout} onClose={() => setShowAbout(false)} />
      <FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} />
    </div>
  );
}
