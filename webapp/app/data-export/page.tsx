'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Summary, MunicipalityIndex, DailySnapshots } from '@/types/parking';

type ExportFormat = 'geojson' | 'json' | 'csv';

export default function DataExportPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [muniIndex, setMuniIndex] = useState<MunicipalityIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [dataMode, setDataMode] = useState<'realtime' | 'history'>('realtime');
  const [activeTab, setActiveTab] = useState<'download' | 'municipality'>('download');
  const [muniSearch, setMuniSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [historyData, setHistoryData] = useState<DailySnapshots | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/data/summary.json').then((r) => r.ok ? r.json() : null),
      fetch('/data/municipalities/index.json').then((r) => r.ok ? r.json() : null),
    ])
      .then(([sum, idx]) => {
        setSummary(sum);
        setMuniIndex(idx);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const downloadFile = async (url: string, filename: string) => {
    setDownloading(filename);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Download mislukt. Probeer het opnieuw.');
    } finally {
      setDownloading(null);
    }
  };

  const downloadAsFormat = async (format: ExportFormat) => {
    if (format === 'geojson') {
      await downloadFile('/data/parking_facilities.geojson', 'parkeerdata-nederland.geojson');
      return;
    }

    // For JSON/CSV, convert from GeoJSON
    setDownloading(format);
    try {
      const res = await fetch('/data/parking_facilities.geojson');
      const data = await res.json();
      const features = data.features || [];

      if (format === 'json') {
        const flat = features.map((f: { properties: Record<string, unknown>; geometry: { coordinates: number[] } }) => ({
          ...f.properties,
          latitude: f.geometry.coordinates[1],
          longitude: f.geometry.coordinates[0],
        }));
        const blob = new Blob([JSON.stringify(flat, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'parkeerdata-nederland.json';
        a.click();
        URL.revokeObjectURL(a.href);
      } else {
        // CSV
        const headers = ['uuid', 'name', 'municipality', 'operator', 'street', 'houseNumber', 'zipcode', 'city', 'province', 'latitude', 'longitude', 'capacity', 'vacantSpaces', 'occupancyPercent', 'open', 'full', 'lastUpdated', 'minimumHeightInMeters', 'chargingPointCapacity', 'disabledAccess', 'usage'];
        const rows = features.map((f: { properties: Record<string, unknown>; geometry: { coordinates: number[] } }) => {
          const p = f.properties;
          return headers.map((h) => {
            if (h === 'latitude') return f.geometry.coordinates[1];
            if (h === 'longitude') return f.geometry.coordinates[0];
            const val = p[h];
            if (val === null || val === undefined) return '';
            if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
            return val;
          }).join(',');
        });
        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'parkeerdata-nederland.csv';
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export mislukt.');
    } finally {
      setDownloading(null);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const [year, month, day] = selectedDate.split('-');
      const url = `/data/snapshots/${year}/${month}/${day}.json`;
      const res = await fetch(url);
      if (!res.ok) {
        setHistoryData(null);
        return;
      }
      setHistoryData(await res.json());
    } catch {
      setHistoryData(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (dataMode === 'history') {
      loadHistory();
    }
  }, [dataMode, selectedDate]);

  const filteredMunis = muniIndex?.municipalities.filter(
    (m) => m.name.toLowerCase().includes(muniSearch.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="text-lg font-bold text-gray-900 hover:text-blue-600 transition">
            Parkeerdataviewer
          </Link>
          <span className="text-gray-300">|</span>
          <h1 className="text-lg font-medium text-gray-700">Data Export</h1>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Summary stats */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-sm text-gray-500">Garages</div>
              <div className="text-2xl font-bold text-gray-900">{summary.total_facilities}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-sm text-gray-500">Gemeenten</div>
              <div className="text-2xl font-bold text-gray-900">{summary.municipalities}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-sm text-gray-500">Capaciteit</div>
              <div className="text-2xl font-bold text-gray-900">{summary.total_capacity.toLocaleString('nl-NL')}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-sm text-gray-500">Vrije plekken</div>
              <div className="text-2xl font-bold text-green-600">{summary.total_vacant.toLocaleString('nl-NL')}</div>
            </div>
          </div>
        )}

        {/* Data mode toggle */}
        <div className="flex gap-1 mb-4 bg-white rounded-lg shadow-sm p-1">
          <button
            onClick={() => setDataMode('realtime')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition ${dataMode === 'realtime' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Real-time data
          </button>
          <button
            onClick={() => setDataMode('history')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition ${dataMode === 'history' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Historische data
          </button>
        </div>

        {/* Scope tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg shadow-sm p-1">
          {[
            { key: 'download' as const, label: 'Nederland (volledig)' },
            { key: 'municipality' as const, label: 'Per gemeente' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* REAL-TIME MODE */}
        {dataMode === 'realtime' && activeTab === 'download' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Download parkeerdata Nederland</h2>
            <p className="text-sm text-gray-500 mb-6">
              Download de volledige dataset met alle parkeergarages in Nederland, inclusief real-time bezettingsdata.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { format: 'geojson' as ExportFormat, label: 'GeoJSON', desc: 'Geografisch formaat voor GIS', icon: '{}' },
                { format: 'json' as ExportFormat, label: 'JSON', desc: 'Platte lijst, makkelijk te verwerken', icon: '[]' },
                { format: 'csv' as ExportFormat, label: 'CSV', desc: 'Voor Excel en spreadsheets', icon: ',' },
              ].map((opt) => (
                <button
                  key={opt.format}
                  onClick={() => downloadAsFormat(opt.format)}
                  disabled={downloading !== null}
                  className="flex flex-col items-center p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition disabled:opacity-50"
                >
                  <span className="text-2xl font-mono text-gray-400 mb-2">{opt.icon}</span>
                  <span className="font-medium text-gray-900">{opt.label}</span>
                  <span className="text-xs text-gray-500 mt-1">{opt.desc}</span>
                  {downloading === opt.format && (
                    <span className="text-xs text-blue-600 mt-2">Downloaden...</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {dataMode === 'realtime' && activeTab === 'municipality' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Download per gemeente</h2>
            <input
              type="text"
              placeholder="Zoek gemeente..."
              value={muniSearch}
              onChange={(e) => setMuniSearch(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {loading ? (
              <div className="text-center py-8 text-gray-500">Laden...</div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {filteredMunis.map((muni) => (
                  <button
                    key={muni.slug}
                    onClick={() => downloadFile(`/data/municipalities/${muni.slug}.json`, `parkeerdata-${muni.slug}.json`)}
                    disabled={downloading !== null}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-left disabled:opacity-50"
                  >
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{muni.name}</div>
                      <div className="text-xs text-gray-500">{muni.facility_count} garages</div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                ))}
                {filteredMunis.length === 0 && (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    {muniSearch ? 'Geen gemeente gevonden' : 'Geen data beschikbaar'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* HISTORY MODE */}
        {dataMode === 'history' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Historische data {activeTab === 'municipality' ? 'per gemeente' : 'Nederland'}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Download uurlijkse snapshots van de bezettingsdata. Selecteer een datum om te bekijken of te downloaden.
            </p>
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <label className="text-sm font-medium text-gray-700">Datum:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {historyData && (
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(historyData, null, 2)], { type: 'application/json' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `parkeerdata-${selectedDate}.json`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
                >
                  Download dag
                </button>
              )}
            </div>

            {/* Municipality filter for history */}
            {activeTab === 'municipality' && (
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="Zoek gemeente..."
                  value={muniSearch}
                  onChange={(e) => setMuniSearch(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                  {filteredMunis.map((muni) => (
                    <button
                      key={muni.slug}
                      onClick={async () => {
                        if (!historyData) return;
                        setDownloading(muni.slug);
                        try {
                          // Fetch municipality file to get facility UUIDs
                          const muniRes = await fetch(`/data/municipalities/${muni.slug}.json`);
                          if (!muniRes.ok) throw new Error('Municipality data not found');
                          const muniData = await muniRes.json();
                          const uuids = new Set((muniData.facilities || []).map((f: { uuid: string }) => f.uuid));

                          // Filter snapshot data to only include this municipality's facilities
                          const filtered = {
                            ...historyData,
                            municipality: muni.name,
                            snapshots: Object.fromEntries(
                              Object.entries(historyData.snapshots).map(([hour, snap]) => [
                                hour,
                                {
                                  ...snap,
                                  facility_count: Object.keys(snap.facilities).filter(id => uuids.has(id)).length,
                                  facilities: Object.fromEntries(
                                    Object.entries(snap.facilities).filter(([id]) => uuids.has(id))
                                  ),
                                },
                              ])
                            ),
                          };
                          const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
                          const a = document.createElement('a');
                          a.href = URL.createObjectURL(blob);
                          a.download = `parkeerdata-${muni.slug}-${selectedDate}.json`;
                          a.click();
                          URL.revokeObjectURL(a.href);
                        } catch (err) {
                          console.error('Download failed:', err);
                          alert('Download mislukt.');
                        } finally {
                          setDownloading(null);
                        }
                      }}
                      disabled={downloading !== null || !historyData}
                      className="flex items-center justify-between p-2 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-left disabled:opacity-50 text-sm"
                    >
                      <span className="font-medium text-gray-900">{muni.name}</span>
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {historyLoading ? (
              <div className="text-center py-8 text-gray-500">Laden...</div>
            ) : historyData ? (
              <div>
                <div className="text-sm text-gray-500 mb-3">
                  {Object.keys(historyData.snapshots).length} snapshots beschikbaar voor {historyData.date}
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = i.toString().padStart(2, '0');
                    const snapshot = historyData.snapshots[hour];
                    return (
                      <div
                        key={hour}
                        className={`p-2 rounded-lg text-center text-sm ${
                          snapshot
                            ? 'bg-blue-50 border border-blue-200'
                            : 'bg-gray-50 border border-gray-200 opacity-50'
                        }`}
                      >
                        <div className="font-medium text-gray-900">{hour}:00</div>
                        {snapshot && (
                          <div className="text-xs text-gray-500 mt-1">
                            {snapshot.facility_count}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Geen data beschikbaar voor deze datum
              </div>
            )}
          </div>
        )}

        {/* Attribution */}
        <div className="mt-8 text-center text-xs text-gray-400">
          Data: <a href="https://npropendata.rdw.nl/parkingdata/v2" className="underline hover:text-gray-600" target="_blank" rel="noopener noreferrer">Open Parkeerdata (SPDP v2)</a> | Licentie: CC-0
          {' | '}
          <Link href="/" className="underline hover:text-gray-600">Terug naar kaart</Link>
        </div>
      </div>
    </div>
  );
}
