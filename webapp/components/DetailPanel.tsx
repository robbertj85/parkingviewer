'use client';

import { useState, useEffect, useRef } from 'react';
import { ParkingFeature, DailySnapshots, getOccupancyColor, getOccupancyLabel } from '@/types/parking';

interface DetailPanelProps {
  feature: ParkingFeature;
  onClose: () => void;
  mobile?: boolean;
}

interface StaticInfo {
  address?: string;
  city?: string;
  zipcode?: string;
  openingTimes?: string;
  minHeight?: number;
  chargingPoints?: number;
}

function MiniMapView({ lat, lng, satellite, uuid }: { lat: number; lng: number; satellite: boolean; uuid: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    import('leaflet').then((L) => {
      if (cancelled || !containerRef.current) return;

      if (mapInstanceRef.current) {
        (mapInstanceRef.current as L.Map).remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: 17,
        zoomControl: true,
        attributionControl: false,
      });

      const tileUrl = satellite
        ? 'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/{z}/{x}/{y}.jpeg'
        : 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png';

      L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(map);

      const icon = L.divIcon({
        className: 'parking-marker',
        html: '<div style="width:14px;height:14px;background:#2563eb;border:2px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker([lat, lng], { icon }).addTo(map);

      // Leaflet needs a tick to measure the container size
      setTimeout(() => {
        if (!cancelled) map.invalidateSize();
      }, 100);

      mapInstanceRef.current = map;
    });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as L.Map).remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lng, satellite, uuid]);

  return (
    <div ref={containerRef} className="rounded-lg overflow-hidden border border-gray-200" style={{ height: '144px' }} />
  );
}

export default function DetailPanel({ feature, onClose, mobile }: DetailPanelProps) {
  const [staticInfo, setStaticInfo] = useState<StaticInfo | null>(null);
  const [staticLoading, setStaticLoading] = useState(false);
  const [todayData, setTodayData] = useState<DailySnapshots | null>(null);
  const [historyDays, setHistoryDays] = useState<DailySnapshots[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [chartMode, setChartMode] = useState<'pct' | 'abs'>('pct');
  const [showStaticJson, setShowStaticJson] = useState(false);
  const [showDynamicJson, setShowDynamicJson] = useState(false);
  const [staticJson, setStaticJson] = useState<string | null>(null);
  const [dynamicJson, setDynamicJson] = useState<string | null>(null);
  const [staticJsonLoading, setStaticJsonLoading] = useState(false);
  const [dynamicJsonLoading, setDynamicJsonLoading] = useState(false);
  const [miniMapSatellite, setMiniMapSatellite] = useState(false);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '1y'>('7d');

  const props = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;
  const color = getOccupancyColor(props.occupancyPercent);
  const label = getOccupancyLabel(props.occupancyPercent);

  // Fetch static API data for address info
  useEffect(() => {
    setStaticInfo(null);
    setSelectedHour(null);
    setStaticLoading(true);
    fetch(`https://npropendata.rdw.nl/parkingdata/v2/static/${props.uuid}`, {
      headers: { 'Accept': 'application/json' },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.parkingFacilityInformation) return;
        const info = data.parkingFacilityInformation;

        // Extract address from accessPoints
        let address = '';
        let city = '';
        let zipcode = '';
        const accessPoints = info.accessPoints || [];
        for (const ap of accessPoints) {
          const addr = ap.accessPointAddress;
          if (addr?.streetName) {
            address = addr.streetName + (addr.houseNumber ? ' ' + addr.houseNumber : '');
            city = addr.city || '';
            zipcode = addr.zipcode || '';
            break;
          }
        }

        // Extract specs
        const specs = info.specifications?.[0];
        const minHeight = specs?.minimumHeightInMeters;
        const chargingPoints = specs?.chargingPointCapacity;

        // Opening times
        let openingTimes = '';
        const times = info.openingTimes?.[0];
        if (times) {
          if (times.openAllYear && times.exitPossibleAllDay) {
            openingTimes = '24/7 geopend';
          } else if (times.openAllYear) {
            openingTimes = 'Hele jaar geopend';
          }
        }

        setStaticInfo({ address, city, zipcode, openingTimes, minHeight, chargingPoints });

        // If no address from static API, try PDOK reverse geocoding
        if (!address) {
          fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse?lon=${lng}&lat=${lat}&rows=1&fl=*`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              const doc = data?.response?.docs?.[0];
              if (doc) {
                setStaticInfo(prev => prev ? {
                  ...prev,
                  address: doc.straatnaam ? `${doc.straatnaam}${doc.huisnummer ? ' ' + doc.huisnummer : ''}` : prev.address,
                  city: doc.woonplaatsnaam || prev.city,
                  zipcode: doc.postcode || prev.zipcode,
                } : prev);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        // Static API failed entirely, try PDOK reverse geocoding
        fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse?lon=${lng}&lat=${lat}&rows=1&fl=*`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            const doc = data?.response?.docs?.[0];
            if (doc) {
              setStaticInfo({
                address: doc.straatnaam ? `${doc.straatnaam}${doc.huisnummer ? ' ' + doc.huisnummer : ''}` : '',
                city: doc.woonplaatsnaam || '',
                zipcode: doc.postcode || '',
              });
            }
          })
          .catch(() => {});
      })
      .finally(() => setStaticLoading(false));
  }, [props.uuid, lat, lng]);

  // Fetch today's + history hourly data based on time range
  useEffect(() => {
    setTodayData(null);
    setHistoryDays([]);
    setHistoryLoading(true);

    const rangeDays = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 365;
    const dates: string[] = [];
    for (let i = 0; i <= rangeDays; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dates.push(`${y}/${m}/${day}`);
    }

    Promise.all(
      dates.map((datePath) =>
        fetch(`/data/snapshots/${datePath}.json`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    ).then((results) => {
      const valid = results.filter(Boolean) as DailySnapshots[];
      if (valid.length > 0) {
        setTodayData(valid[0]); // most recent = today
      }
      if (valid.length > 1) {
        setHistoryDays(valid.slice(1)); // past days
      }
      setHistoryLoading(false);
    });
  }, [props.uuid, timeRange]);

  // Helper: extract occupancy data from a snapshot for this facility
  const extractData = (snapshot: DailySnapshots['snapshots'][string] | undefined): { pct: number; occupied: number; capacity: number } | null => {
    if (!snapshot) return null;
    const fac = snapshot.facilities[props.uuid];
    if (fac && fac.c && fac.c > 0 && fac.v !== undefined) {
      const occupied = fac.c - fac.v;
      return { pct: Math.round((occupied / fac.c) * 100), occupied, capacity: fac.c };
    }
    return null;
  };

  // Build hourly chart data with historical averages
  const hourlyData = (() => {
    if (!todayData && historyDays.length === 0) return null;
    const hours: { hour: string; pct: number | null; occupied: number | null; capacity: number | null; histAvg: number | null; isLatest: boolean }[] = [];
    let lastDataHour = -1;

    for (let h = 0; h < 24; h++) {
      const key = h.toString().padStart(2, '0');

      // Today's value
      const todayResult = todayData ? extractData(todayData.snapshots[key]) : null;
      if (todayResult !== null) lastDataHour = h;

      // Historical average from past days
      const histValues: number[] = [];
      for (const day of historyDays) {
        const val = extractData(day.snapshots[key]);
        if (val !== null) histValues.push(val.pct);
      }
      const histAvg = histValues.length > 0
        ? Math.round(histValues.reduce((a, b) => a + b, 0) / histValues.length)
        : null;

      hours.push({
        hour: key,
        pct: todayResult?.pct ?? null,
        occupied: todayResult?.occupied ?? null,
        capacity: todayResult?.capacity ?? null,
        histAvg,
        isLatest: false,
      });
    }

    // Mark the latest data point
    if (lastDataHour >= 0) {
      hours[lastDataHour].isLatest = true;
    }

    return hours;
  })();

  const avgPct = (() => {
    if (!hourlyData) return null;
    const valid = hourlyData.filter(h => h.pct !== null).map(h => h.pct!);
    if (valid.length === 0) return null;
    return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
  })();

  // Get capacity for absolute mode
  const chartCapacity = (() => {
    if (!hourlyData) return null;
    const caps = hourlyData.filter(h => h.capacity !== null).map(h => h.capacity!);
    return caps.length > 0 ? Math.max(...caps) : null;
  })();

  const lastUpdate = props.lastUpdated
    ? new Date(props.lastUpdated * 1000).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })
    : 'Onbekend';

  const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  const loadStaticJson = async () => {
    if (staticJson) { setShowStaticJson(!showStaticJson); return; }
    setStaticJsonLoading(true);
    setShowStaticJson(true);
    try {
      const r = await fetch(`https://npropendata.rdw.nl/parkingdata/v2/static/${props.uuid}`, { headers: { Accept: 'application/json' } });
      if (r.status === 404) { setStaticJson('Geen statische data beschikbaar voor deze garage'); }
      else { const data = await r.json(); setStaticJson(JSON.stringify(data, null, 2)); }
    } catch { setStaticJson('Kon data niet ophalen (netwerkfout)'); }
    setStaticJsonLoading(false);
  };

  const loadDynamicJson = async () => {
    if (dynamicJson) { setShowDynamicJson(!showDynamicJson); return; }
    setDynamicJsonLoading(true);
    setShowDynamicJson(true);
    try {
      const r = await fetch(`https://npropendata.rdw.nl/parkingdata/v2/dynamic/${props.uuid}`, { headers: { Accept: 'application/json' } });
      if (r.status === 404) { setDynamicJson('Geen dynamische data beschikbaar voor deze garage'); }
      else { const data = await r.json(); setDynamicJson(JSON.stringify(data, null, 2)); }
    } catch { setDynamicJson('Kon data niet ophalen (netwerkfout)'); }
    setDynamicJsonLoading(false);
  };

  return (
    <div className={`flex flex-col bg-white ${mobile ? 'rounded-t-2xl max-h-[85vh]' : 'h-full'}`}>
      {/* Mobile drag handle */}
      {mobile && (
        <div className="flex justify-center pt-3 pb-1">
          <div className="bottom-sheet-handle" />
        </div>
      )}

      {/* Header */}
      <div className={`flex items-start justify-between ${mobile ? 'px-4 pt-1 pb-3' : 'p-4'} border-b border-gray-200`}>
        <div className="flex-1 min-w-0 mr-2">
          <h2 className={`font-bold text-gray-900 truncate ${mobile ? 'text-lg' : 'text-base'}`}>{props.name}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{props.municipality} | {props.operator}</p>
        </div>
        <button
          onClick={onClose}
          className={`text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition flex-shrink-0 ${mobile ? 'p-2' : 'p-1.5'}`}
          aria-label="Sluiten"
        >
          <svg className={mobile ? 'w-6 h-6' : 'w-5 h-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div className={`flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 ${mobile ? 'pb-6' : ''}`}>
        {/* Occupancy */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bezetting</span>
            <span className="text-sm font-bold" style={{ color }}>{label}</span>
          </div>
          {props.occupancyPercent !== null && (
            <div className="occupancy-bar mb-2">
              <div
                className="occupancy-fill"
                style={{ width: `${Math.min(props.occupancyPercent, 100)}%`, background: color }}
              />
            </div>
          )}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-gray-900">{props.capacity ?? '?'}</div>
              <div className="text-[10px] text-gray-500">Capaciteit</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-blue-600">{props.vacantSpaces ?? '?'}</div>
              <div className="text-[10px] text-gray-500">Vrij</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold" style={{ color }}>
                {props.capacity != null && props.vacantSpaces != null ? props.capacity - props.vacantSpaces : '?'}
              </div>
              <div className="text-[10px] text-gray-500">Bezet</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold" style={{ color }}>
                {props.occupancyPercent !== null ? `${props.occupancyPercent}%` : '?'}
              </div>
              <div className="text-[10px] text-gray-500">Bezet %</div>
            </div>
          </div>
        </div>

        {/* Status */}
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Status</h3>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Open</span>
              <span className="font-medium text-gray-600">{props.open ? 'Ja' : props.open === false ? 'Nee' : '?'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Vol</span>
              <span className="font-medium text-gray-600">{props.full ? 'Ja' : props.full === false ? 'Nee' : '?'}</span>
            </div>
          </div>
        </div>

        {/* Address & details */}
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Details</h3>
          {staticLoading ? (
            <div className="animate-pulse space-y-1.5">
              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ) : staticInfo ? (
            <div className="space-y-1 text-xs">
              {staticInfo.address && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Adres</span>
                  <span className="font-medium text-gray-600 text-right">{staticInfo.address}</span>
                </div>
              )}
              {staticInfo.city && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Plaats</span>
                  <span className="font-medium text-gray-600">{staticInfo.city}{staticInfo.zipcode ? ` (${staticInfo.zipcode})` : ''}</span>
                </div>
              )}
              {staticInfo.openingTimes && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Openingstijden</span>
                  <span className="font-medium text-gray-600">{staticInfo.openingTimes}</span>
                </div>
              )}
              {staticInfo.minHeight !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Min. hoogte</span>
                  <span className="font-medium text-gray-600">{staticInfo.minHeight}m</span>
                </div>
              )}
              {staticInfo.chargingPoints !== undefined && staticInfo.chargingPoints > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Laadpunten</span>
                  <span className="font-medium text-gray-600">{staticInfo.chargingPoints}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Geen details beschikbaar</p>
          )}
        </div>

        {/* Hourly occupancy chart */}
        <div>
          <div className="mb-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bezetting vandaag (per uur)</h3>
              {/* % / # toggle */}
              {hourlyData && chartCapacity && (
                <div className="flex bg-gray-100 rounded text-[10px] font-medium">
                  <button
                    onClick={() => setChartMode('pct')}
                    className={`px-2 py-0.5 rounded transition ${chartMode === 'pct' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400'}`}
                  >
                    %
                  </button>
                  <button
                    onClick={() => setChartMode('abs')}
                    className={`px-2 py-0.5 rounded transition ${chartMode === 'abs' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400'}`}
                  >
                    #
                  </button>
                </div>
              )}
            </div>
            {/* Time range filter */}
            <div className="flex gap-1 mt-1.5">
              {(['24h', '7d', '30d', '1y'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${timeRange === range ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-50 text-gray-400 border border-gray-100 hover:text-gray-600'}`}
                >
                  {range === '1y' ? '1j' : range}
                </button>
              ))}
            </div>
          </div>
          {historyLoading ? (
            <div className="animate-pulse h-24 bg-gray-100 rounded"></div>
          ) : hourlyData ? (
            <div className="flex">
              {/* Y-axis labels */}
              <div className="flex flex-col justify-between h-28 pr-1.5 text-[9px] text-gray-400 flex-shrink-0 text-right">
                {chartMode === 'pct' || !chartCapacity ? (
                  <>
                    <span>100%</span>
                    <span>75%</span>
                    <span>50%</span>
                    <span>25%</span>
                    <span>0%</span>
                  </>
                ) : (
                  <>
                    <span>{chartCapacity}</span>
                    <span>{Math.round(chartCapacity * 0.75)}</span>
                    <span>{Math.round(chartCapacity * 0.5)}</span>
                    <span>{Math.round(chartCapacity * 0.25)}</span>
                    <span>0</span>
                  </>
                )}
              </div>
              {/* Chart area */}
              <div className="flex-1 relative h-28">
                {/* Grid lines */}
                {[0, 25, 50, 75].map((pct) => (
                  <div
                    key={pct}
                    className="absolute left-0 right-0 border-t border-gray-100 pointer-events-none"
                    style={{ bottom: `${pct}%` }}
                  />
                ))}
                {/* Average line */}
                {avgPct !== null && (
                  <div
                    className="absolute left-0 right-0 border-t-2 border-dashed border-blue-400/60 pointer-events-none z-10"
                    style={{ bottom: `${Math.max(avgPct, 2)}%` }}
                    title={`Gemiddeld vandaag: ${avgPct}%`}
                  >
                    <span className="absolute -top-3.5 right-0 text-[9px] font-medium text-blue-500 bg-white/80 px-0.5 rounded">
                      gem. {chartMode === 'abs' && chartCapacity ? Math.round(chartCapacity * avgPct / 100) : `${avgPct}%`}
                    </span>
                  </div>
                )}
                {/* Connecting lines for history */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
                  {hourlyData.map(({ histAvg }, i) => {
                    if (histAvg === null) return null;
                    const nextWithAvg = hourlyData.slice(i + 1).findIndex(h => h.histAvg !== null);
                    if (nextWithAvg === -1) return null;
                    const j = i + 1 + nextWithAvg;
                    const x1 = ((i + 0.5) / 24) * 100;
                    const x2 = ((j + 0.5) / 24) * 100;
                    const y1 = 100 - Math.max(histAvg, 2);
                    const y2 = 100 - Math.max(hourlyData[j].histAvg!, 2);
                    return <line key={`hl-${i}`} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="3 2" />;
                  })}
                </svg>
                {/* Connecting lines for today */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-[2]" preserveAspectRatio="none">
                  {hourlyData.map(({ pct }, i) => {
                    if (pct === null) return null;
                    const nextWithPct = hourlyData.slice(i + 1).findIndex(h => h.pct !== null);
                    if (nextWithPct === -1) return null;
                    const j = i + 1 + nextWithPct;
                    const x1 = ((i + 0.5) / 24) * 100;
                    const x2 = ((j + 0.5) / 24) * 100;
                    const y1 = 100 - Math.max(pct, 2);
                    const y2 = 100 - Math.max(hourlyData[j].pct!, 2);
                    return <line key={`tl-${i}`} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} stroke="#3b82f6" strokeWidth="2" />;
                  })}
                </svg>
                {/* Data points */}
                <div className="flex items-end gap-[2px] h-full relative z-[3]">
                  {hourlyData.map(({ hour, pct, occupied, capacity, histAvg, isLatest }, idx) => {
                    const isSelected = selectedHour === idx;
                    const showLabel = isSelected && pct !== null;
                    return (
                    <div
                      key={hour}
                      className="flex-1 flex flex-col items-center h-full relative cursor-pointer"
                      onClick={() => setSelectedHour(isSelected ? null : (pct !== null ? idx : null))}
                    >
                      {/* Historical average dot */}
                      {histAvg !== null && (
                        <div
                          className="absolute w-2 h-2 rounded-full bg-blue-300 left-1/2 -translate-x-1/2"
                          style={{ bottom: `calc(${Math.max(histAvg, 2)}% - 4px)` }}
                        />
                      )}
                      {/* Today's dot */}
                      {pct !== null && (
                        <div
                          className={`absolute left-1/2 -translate-x-1/2 rounded-full z-[1] transition-all ${isLatest ? 'w-3 h-3 bg-blue-600 ring-2 ring-blue-300' : isSelected ? 'w-3 h-3 bg-blue-600' : 'w-2 h-2 bg-blue-600'}`}
                          style={{ bottom: `calc(${Math.max(pct, 2)}% - ${isLatest || isSelected ? 6 : 4}px)` }}
                        />
                      )}
                      {/* Clicked tooltip */}
                      {showLabel && (
                        <div
                          className="absolute left-1/2 -translate-x-1/2 z-20 bg-gray-800 text-white text-[9px] font-medium px-1.5 py-0.5 rounded shadow whitespace-nowrap"
                          style={{ bottom: `calc(${Math.max(pct!, 2)}% + 6px)` }}
                        >
                          {chartMode === 'abs' && occupied !== null ? `${occupied}/${capacity}` : `${pct}%`}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-r-[3px] border-t-[3px] border-transparent border-t-gray-800" />
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Geen data beschikbaar</p>
          )}
          {hourlyData && (
            <div className="flex">
              <div className="w-[30px] flex-shrink-0" />
              <div className="flex-1 flex justify-between mt-1 text-[9px] text-gray-400">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>23:00</span>
              </div>
            </div>
          )}
          {/* Legend */}
          {hourlyData && historyDays.length > 0 && (
            <div className="flex items-center gap-3 mt-1.5 text-[9px] text-gray-400">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600 ring-1 ring-blue-300"></span>
                Laatste meting
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-600"></span>
                Vandaag
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-300"></span>
                Gem. {timeRange === '1y' ? '1j' : timeRange}
              </span>
            </div>
          )}
        </div>

        {/* Mini-map */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Locatie</h3>
            <div className="flex bg-gray-100 rounded text-[10px] font-medium">
              <button
                onClick={() => setMiniMapSatellite(false)}
                className={`px-2 py-0.5 rounded transition ${!miniMapSatellite ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400'}`}
              >
                Kaart
              </button>
              <button
                onClick={() => setMiniMapSatellite(true)}
                className={`px-2 py-0.5 rounded transition ${miniMapSatellite ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400'}`}
              >
                Satelliet
              </button>
            </div>
          </div>
          <MiniMapView lat={lat} lng={lng} satellite={miniMapSatellite} uuid={props.uuid} />
          <div className="flex gap-2 mt-1.5">
            <a href={streetViewUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:underline">Street View</a>
            <span className="text-gray-300">|</span>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:underline">Google Maps</a>
          </div>
        </div>

        {/* API Data */}
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">API Data</h3>
          <div className="space-y-2">
            {/* Static API */}
            <div>
              <button
                onClick={loadStaticJson}
                className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 w-full text-left"
              >
                <svg className={`w-3 h-3 transition-transform flex-shrink-0 ${showStaticJson ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
                Static API
                {staticJsonLoading && <span className="text-gray-400 text-[10px]">laden...</span>}
              </button>
              {showStaticJson && staticJson && (
                <pre className="mt-1 p-2 bg-gray-50 border border-gray-200 rounded text-[10px] text-gray-700 font-mono overflow-x-auto max-h-48 overflow-y-auto custom-scrollbar whitespace-pre-wrap break-all">
                  {staticJson}
                </pre>
              )}
            </div>
            {/* Dynamic API */}
            <div>
              <button
                onClick={loadDynamicJson}
                className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 w-full text-left"
              >
                <svg className={`w-3 h-3 transition-transform flex-shrink-0 ${showDynamicJson ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
                Dynamic API
                {dynamicJsonLoading && <span className="text-gray-400 text-[10px]">laden...</span>}
              </button>
              {showDynamicJson && dynamicJson && (
                <pre className="mt-1 p-2 bg-gray-50 border border-gray-200 rounded text-[10px] text-gray-700 font-mono overflow-x-auto max-h-48 overflow-y-auto custom-scrollbar whitespace-pre-wrap break-all">
                  {dynamicJson}
                </pre>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-[10px] text-gray-400 pt-2 border-t border-gray-100 space-y-0.5">
          <div>Laatst bijgewerkt: {lastUpdate}</div>
          <div>{lat.toFixed(6)}, {lng.toFixed(6)} | UUID: <span className="font-mono">{props.uuid.slice(0, 8)}...</span></div>
        </div>
      </div>
    </div>
  );
}
