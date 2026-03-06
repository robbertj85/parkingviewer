'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

interface SearchBarProps {
  municipalities: string[];
  onSelectMunicipality: (name: string) => void;
  onFlyTo: (lat: number, lng: number, zoom?: number) => void;
}

interface PdokSuggestion {
  id: string;
  type: string;
  weergavenaam: string;
  score: number;
}

interface PdokLookupResult {
  centroide_ll: string; // "POINT(lng lat)"
}

export default function SearchBar({ municipalities, onSelectMunicipality, onFlyTo }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PdokSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [locating, setLocating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Municipality matches for quick filtering
  const muniMatches = useMemo(() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    return municipalities
      .filter(m => m.toLowerCase().includes(q))
      .slice(0, 5);
  }, [query, municipalities]);

  // Fetch PDOK suggestions
  useEffect(() => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: query,
          fq: 'type:(gemeente OR woonplaats OR weg OR adres OR postcode)',
          rows: '5',
        });
        const res = await fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        setSuggestions(data.response?.docs || []);
      } catch {
        // ignore
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelectSuggestion = async (suggestion: PdokSuggestion) => {
    setQuery(suggestion.weergavenaam);
    setShowSuggestions(false);

    try {
      const res = await fetch(
        `https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup?id=${encodeURIComponent(suggestion.id)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      const doc: PdokLookupResult = data.response?.docs?.[0];
      if (doc?.centroide_ll) {
        const match = doc.centroide_ll.match(/POINT\(([\d.]+)\s+([\d.]+)\)/);
        if (match) {
          const lng = parseFloat(match[1]);
          const lat = parseFloat(match[2]);
          const zoom = suggestion.type === 'gemeente' || suggestion.type === 'woonplaats' ? 13 : 16;
          onFlyTo(lat, lng, zoom);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleSelectMuni = (name: string) => {
    setQuery(name);
    setShowSuggestions(false);
    onSelectMunicipality(name);
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        onFlyTo(latitude, longitude, 14);

        // Reverse geocode to get municipality name
        try {
          const res = await fetch(
            `https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse?lon=${longitude}&lat=${latitude}&rows=1&fl=*`
          );
          if (res.ok) {
            const data = await res.json();
            const doc = data.response?.docs?.[0];
            if (doc?.gemeentenaam) {
              const gm = doc.gemeentenaam;
              setQuery(gm);
              if (municipalities.includes(gm)) {
                onSelectMunicipality(gm);
              }
            }
          }
        } catch {
          // ignore
        }
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const hasSuggestions = muniMatches.length > 0 || suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md flex gap-1">
      <div className="relative flex-1">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          placeholder="Zoek gemeente of adres..."
          className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setSuggestions([]);
              setShowSuggestions(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* GPS button */}
      <button
        onClick={handleGeolocate}
        disabled={locating}
        className="px-2 py-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition flex-shrink-0 border border-gray-200 bg-gray-50"
        title="Gebruik mijn locatie"
        aria-label="Gebruik mijn locatie"
      >
        {locating ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
          </svg>
        )}
      </button>

      {/* Suggestions dropdown */}
      {showSuggestions && hasSuggestions && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 sm:max-h-72 overflow-y-auto">
          {muniMatches.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-medium text-gray-400 uppercase tracking-wide bg-gray-50">
                Gemeenten met parkeerdata
              </div>
              {muniMatches.map((name) => (
                <button
                  key={name}
                  onClick={() => handleSelectMuni(name)}
                  className="w-full text-left px-3 py-2.5 sm:py-2 text-sm hover:bg-blue-50 hover:text-blue-700 active:bg-blue-100 transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {name}
                </button>
              ))}
            </div>
          )}
          {suggestions.length > 0 && (
            <div>
              {muniMatches.length > 0 && <div className="border-t border-gray-100" />}
              <div className="px-3 py-1.5 text-[10px] font-medium text-gray-400 uppercase tracking-wide bg-gray-50">
                Adressen & locaties
              </div>
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSelectSuggestion(s)}
                  className="w-full text-left px-3 py-2.5 sm:py-2 text-sm hover:bg-blue-50 hover:text-blue-700 active:bg-blue-100 transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="truncate">{s.weergavenaam}</span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0 ml-auto">{s.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
