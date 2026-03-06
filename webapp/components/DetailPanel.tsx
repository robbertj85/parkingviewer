'use client';

import { useState, useEffect } from 'react';
import { ParkingFeature, DailySnapshots, getOccupancyColor, getOccupancyLabel } from '@/types/parking';

interface DetailPanelProps {
  feature: ParkingFeature;
  onClose: () => void;
}

interface StaticInfo {
  address?: string;
  city?: string;
  zipcode?: string;
  openingTimes?: string;
  minHeight?: number;
  chargingPoints?: number;
}

export default function DetailPanel({ feature, onClose }: DetailPanelProps) {
  const [staticInfo, setStaticInfo] = useState<StaticInfo | null>(null);
  const [staticLoading, setStaticLoading] = useState(false);
  const [todayData, setTodayData] = useState<DailySnapshots | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const props = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;
  const color = getOccupancyColor(props.occupancyPercent);
  const label = getOccupancyLabel(props.occupancyPercent);

  // Fetch static API data for address info
  useEffect(() => {
    setStaticInfo(null);
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
      })
      .catch(() => {})
      .finally(() => setStaticLoading(false));
  }, [props.uuid]);

  // Fetch today's hourly data
  useEffect(() => {
    setTodayData(null);
    setHistoryLoading(true);
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    fetch(`/data/snapshots/${year}/${month}/${day}.json`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setTodayData(data))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [props.uuid]);

  // Build hourly chart data
  const hourlyData = (() => {
    if (!todayData) return null;
    const hours: { hour: string; pct: number | null }[] = [];
    for (let h = 0; h < 24; h++) {
      const key = h.toString().padStart(2, '0');
      const snapshot = todayData.snapshots[key];
      if (snapshot) {
        const fac = snapshot.facilities[props.uuid];
        if (fac && fac.c && fac.c > 0 && fac.v !== undefined) {
          hours.push({ hour: key, pct: Math.round(((fac.c - fac.v) / fac.c) * 100) });
        } else {
          hours.push({ hour: key, pct: null });
        }
      } else {
        hours.push({ hour: key, pct: null });
      }
    }
    return hours;
  })();

  const lastUpdate = props.lastUpdated
    ? new Date(props.lastUpdated * 1000).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })
    : 'Onbekend';

  const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-gray-200">
        <div className="flex-1 min-w-0 mr-2">
          <h2 className="text-base font-bold text-gray-900 truncate">{props.name}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{props.municipality} | {props.operator}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
          aria-label="Sluiten"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
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
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-gray-900">{props.capacity ?? '?'}</div>
              <div className="text-[10px] text-gray-500">Capaciteit</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-green-600">{props.vacantSpaces ?? '?'}</div>
              <div className="text-[10px] text-gray-500">Vrij</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold" style={{ color }}>
                {props.occupancyPercent !== null ? `${props.occupancyPercent}%` : '?'}
              </div>
              <div className="text-[10px] text-gray-500">Bezet</div>
            </div>
          </div>
        </div>

        {/* Status */}
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Status</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Open</span>
              <span className="font-medium">{props.open ? 'Ja' : props.open === false ? 'Nee' : '?'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Vol</span>
              <span className="font-medium">{props.full ? 'Ja' : props.full === false ? 'Nee' : '?'}</span>
            </div>
          </div>
          <div className="text-[11px] text-gray-400 mt-1">Laatst bijgewerkt: {lastUpdate}</div>
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
                  <span className="font-medium text-right">{staticInfo.address}</span>
                </div>
              )}
              {staticInfo.city && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Plaats</span>
                  <span className="font-medium">{staticInfo.city}{staticInfo.zipcode ? ` (${staticInfo.zipcode})` : ''}</span>
                </div>
              )}
              {staticInfo.openingTimes && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Openingstijden</span>
                  <span className="font-medium">{staticInfo.openingTimes}</span>
                </div>
              )}
              {staticInfo.minHeight !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Min. hoogte</span>
                  <span className="font-medium">{staticInfo.minHeight}m</span>
                </div>
              )}
              {staticInfo.chargingPoints !== undefined && staticInfo.chargingPoints > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Laadpunten</span>
                  <span className="font-medium">{staticInfo.chargingPoints}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Geen details beschikbaar</p>
          )}
        </div>

        {/* Hourly occupancy chart */}
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Bezetting vandaag (per uur)</h3>
          {historyLoading ? (
            <div className="animate-pulse h-24 bg-gray-100 rounded"></div>
          ) : hourlyData ? (
            <div className="flex items-end gap-px h-24">
              {hourlyData.map(({ hour, pct }) => (
                <div key={hour} className="flex-1 flex flex-col items-center justify-end h-full">
                  {pct !== null ? (
                    <div
                      className="w-full rounded-t-sm min-h-[2px] transition-all"
                      style={{
                        height: `${Math.max(pct, 2)}%`,
                        backgroundColor: getOccupancyColor(pct),
                      }}
                      title={`${hour}:00 - ${pct}%`}
                    />
                  ) : (
                    <div
                      className="w-full rounded-t-sm bg-gray-200"
                      style={{ height: '2px' }}
                      title={`${hour}:00 - geen data`}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Geen data beschikbaar voor vandaag</p>
          )}
          {hourlyData && (
            <div className="flex justify-between mt-1 text-[9px] text-gray-400">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>23:00</span>
            </div>
          )}
        </div>

        {/* Links */}
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Links</h3>
          <div className="space-y-1.5">
            <a
              href={streetViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              Google Street View
            </a>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
              </svg>
              Google Maps
            </a>
            <a
              href={`https://npropendata.rdw.nl/parkingdata/v2/static/${props.uuid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              Static API (JSON)
            </a>
            <a
              href={`https://npropendata.rdw.nl/parkingdata/v2/dynamic/${props.uuid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
              </svg>
              Dynamic API (JSON)
            </a>
          </div>
        </div>

        {/* Coordinates */}
        <div className="text-[10px] text-gray-400 pt-2 border-t border-gray-100">
          {lat.toFixed(6)}, {lng.toFixed(6)} | UUID: <span className="font-mono">{props.uuid.slice(0, 8)}...</span>
        </div>
      </div>
    </div>
  );
}
