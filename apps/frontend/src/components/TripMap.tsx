'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TripRoute, RoutePoint } from '@tripmatrix/types';

// Fix for default marker icons in Next.js
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
}

interface TripMapProps {
  routes: TripRoute[];
  places?: Array<{ coordinates: { lat: number; lng: number }; name: string }>;
  currentLocation?: { lat: number; lng: number };
  height?: string;
}

const modeColors: Record<string, string> = {
  walk: '#22c55e',
  bike: '#3b82f6',
  car: '#ef4444',
  train: '#8b5cf6',
  bus: '#f59e0b',
  flight: '#ec4899',
};

export default function TripMap({
  routes,
  places = [],
  currentLocation,
  height = '400px',
}: TripMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map
    const map = L.map(mapContainerRef.current).setView([0, 0], 2);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const bounds = L.latLngBounds([]);

    // Draw routes
    routes.forEach((route) => {
      if (route.points.length === 0) return;

      const color = modeColors[route.modeOfTravel] || '#3b82f6';
      const polyline = L.polyline(
        route.points.map((p) => [p.lat, p.lng] as [number, number]),
        {
          color,
          weight: 4,
          opacity: 0.7,
        }
      ).addTo(map);

      bounds.extend(polyline.getBounds());

      // Add start marker
      const startPoint = route.points[0];
      L.marker([startPoint.lat, startPoint.lng])
        .addTo(map)
        .bindPopup(`Start: ${route.modeOfTravel}`);

      // Add end marker
      const endPoint = route.points[route.points.length - 1];
      L.marker([endPoint.lat, endPoint.lng])
        .addTo(map)
        .bindPopup(`End: ${route.modeOfTravel}`);
    });

    // Add place markers
    places.forEach((place) => {
      const marker = L.marker([place.coordinates.lat, place.coordinates.lng])
        .addTo(map)
        .bindPopup(place.name);
      bounds.extend([place.coordinates.lat, place.coordinates.lng]);
    });

    // Add current location marker
    if (currentLocation) {
      L.marker([currentLocation.lat, currentLocation.lng], {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
        }),
      })
        .addTo(map)
        .bindPopup('Current Location');
      bounds.extend([currentLocation.lat, currentLocation.lng]);
    }

    // Fit map to bounds
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [routes, places, currentLocation]);

  return (
    <div
      ref={mapContainerRef}
      style={{ height, width: '100%' }}
      className="rounded-lg border border-gray-300"
    />
  );
}

