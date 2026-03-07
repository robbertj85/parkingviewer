'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import L from 'leaflet';
import { ParkingData, ParkingFeature, Filters, getOccupancyColor } from '@/types/parking';

interface MapProps {
  data: ParkingData | null;
  filters: Filters;
  onSelectFacility?: (feature: ParkingFeature) => void;
  selectedUuid?: string | null;
}

export interface MapHandle {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
}

const Map = forwardRef<MapHandle, MapProps>(function Map({ data, filters, onSelectFacility, selectedUuid }, ref) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markerMapRef = useRef<Record<string, L.Marker>>({});

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [52.1, 5.3],
      zoom: 8,
      zoomControl: false,
    });

    // Add zoom control to top-right to avoid conflict with mobile filter button
    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    flyTo: (lat: number, lng: number, zoom?: number) => {
      if (mapRef.current) {
        mapRef.current.flyTo([lat, lng], zoom ?? 14, { animate: true, duration: 1 });
      }
    },
  }));

  // Update markers when data or filters change
  useEffect(() => {
    if (!mapRef.current || !markersRef.current || !data) return;

    markersRef.current.clearLayers();
    markerMapRef.current = {};

    const filtered = data.features.filter((feature) => {
      const props = feature.properties;
      if (filters.municipalities.length > 0 && !filters.municipalities.includes(props.municipality)) return false;
      if (filters.operators.length > 0 && !filters.operators.includes(props.operator)) return false;
      if (filters.statusFilter === 'open' && !props.open) return false;
      if (filters.statusFilter === 'full' && !props.full) return false;
      if (filters.statusFilter === 'available' && (props.full || !props.open)) return false;
      return true;
    });

    filtered.forEach((feature) => {
      const { properties } = feature;
      const [lng, lat] = feature.geometry.coordinates;
      const color = getOccupancyColor(properties.occupancyPercent);
      const isSelected = properties.uuid === selectedUuid;
      const isStale = properties.lastUpdated
        ? (Date.now() / 1000 - properties.lastUpdated) > 24 * 60 * 60
        : false;

      const size = isSelected ? 18 : 14;
      const borderWidth = isSelected ? 3 : 2;
      const borderColor = isSelected ? '#2563eb' : 'white';
      const opacity = isStale ? 'opacity:0.5;' : '';

      const icon = L.divIcon({
        className: 'parking-marker',
        html: `<div class="marker-icon" style="width:${size}px;height:${size}px;background:${color};border:${borderWidth}px solid ${borderColor};${opacity}${isSelected ? 'box-shadow:0 0 0 3px rgba(37,99,235,0.3),0 2px 4px rgba(0,0,0,0.3);z-index:1000!important;' : ''}"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([lat, lng], { icon, zIndexOffset: isSelected ? 1000 : 0 });

      marker.on('click', () => {
        onSelectFacility?.(feature);
      });

      marker.addTo(markersRef.current!);
      markerMapRef.current[properties.uuid] = marker;
    });

    // Fit bounds if municipalities filter is active
    if (filters.municipalities.length > 0 && filtered.length > 0) {
      const bounds = L.latLngBounds(
        filtered.map(f => [f.geometry.coordinates[1], f.geometry.coordinates[0]] as [number, number])
      );
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [data, filters, onSelectFacility, selectedUuid]);

  // Pan to selected facility
  useEffect(() => {
    if (!mapRef.current || !selectedUuid || !data) return;
    const feature = data.features.find(f => f.properties.uuid === selectedUuid);
    if (feature) {
      const [lng, lat] = feature.geometry.coordinates;
      mapRef.current.setView([lat, lng], Math.max(mapRef.current.getZoom(), 14), { animate: true });
    }
  }, [selectedUuid, data]);

  return <div ref={containerRef} className="w-full h-full" />;
});

export default Map;
