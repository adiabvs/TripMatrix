'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TripRoute, RoutePoint } from '@tripmatrix/types';
import { getModeIconSVG } from '@/lib/iconUtils';

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
  places?: Array<{ 
    coordinates: { lat: number; lng: number }; 
    name: string;
    modeOfTravel?: string | null;
  }>;
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


const modeLabels: Record<string, string> = {
  walk: 'Walk',
  bike: 'Bike',
  car: 'Car',
  train: 'Train',
  bus: 'Bus',
  flight: 'Flight',
};

export default function TripMap({
  routes,
  places = [],
  currentLocation,
  height = '400px',
}: TripMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<L.Layer[]>([]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map
    const map = L.map(mapContainerRef.current).setView([0, 0], 2);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '',
      maxZoom: 19,
    }).addTo(map);

    // Remove Leaflet attribution control
    map.attributionControl.remove();

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

    // Clear previous layers
    layersRef.current.forEach(layer => {
      map.removeLayer(layer);
    });
    layersRef.current = [];

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
      layersRef.current.push(polyline);

      bounds.extend(polyline.getBounds());

      // Add start marker (circular)
      const startPoint = route.points[0];
      const startCircleIcon = L.divIcon({
        className: 'start-marker',
        html: `<div style="
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: #22c55e;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });
      const startMarker = L.marker([startPoint.lat, startPoint.lng], { icon: startCircleIcon })
        .addTo(map)
        .bindPopup(`Start: ${route.modeOfTravel}`);
      layersRef.current.push(startMarker);

      // Add end marker (circular)
      const endPoint = route.points[route.points.length - 1];
      const endCircleIcon = L.divIcon({
        className: 'end-marker',
        html: `<div style="
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: #ef4444;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });
      const endMarker = L.marker([endPoint.lat, endPoint.lng], { icon: endCircleIcon })
        .addTo(map)
        .bindPopup(`End: ${route.modeOfTravel}`);
      layersRef.current.push(endMarker);
    });

    // Draw lines between consecutive places based on mode of travel
    for (let i = 0; i < places.length - 1; i++) {
      const currentPlace = places[i];
      const nextPlace = places[i + 1];
      
      if (nextPlace.modeOfTravel) {
        const color = modeColors[nextPlace.modeOfTravel] || '#3b82f6';
        const iconHTML = getModeIconSVG(nextPlace.modeOfTravel, color);
        const label = modeLabels[nextPlace.modeOfTravel] || 'Travel';
        
        // Draw line between places
        const polyline = L.polyline(
          [
            [currentPlace.coordinates.lat, currentPlace.coordinates.lng],
            [nextPlace.coordinates.lat, nextPlace.coordinates.lng]
          ],
          {
            color,
            weight: 5,
            opacity: 0.8,
            dashArray: nextPlace.modeOfTravel === 'flight' ? '10, 10' : undefined,
          }
        ).addTo(map);
        layersRef.current.push(polyline);
        
        bounds.extend(polyline.getBounds());
        
        // Add mode icon at midpoint of the route
        const midLat = (currentPlace.coordinates.lat + nextPlace.coordinates.lat) / 2;
        const midLng = (currentPlace.coordinates.lng + nextPlace.coordinates.lng) / 2;
        
        // Create custom icon with react-icons
        const modeIcon = L.divIcon({
          className: 'mode-travel-icon',
          html: `<div style="
            background: white;
            border: 2px solid ${color};
            border-radius: 50%;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            color: ${color};
          ">${iconHTML}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        
        const modeMarker = L.marker([midLat, midLng], { icon: modeIcon })
          .addTo(map)
          .bindPopup(`${label}: ${currentPlace.name} → ${nextPlace.name}`);
        layersRef.current.push(modeMarker);
      } else {
        // If no mode of travel, draw a simple gray line
        const polyline = L.polyline(
          [
            [currentPlace.coordinates.lat, currentPlace.coordinates.lng],
            [nextPlace.coordinates.lat, nextPlace.coordinates.lng]
          ],
          {
            color: '#9ca3af',
            weight: 3,
            opacity: 0.5,
            dashArray: '5, 5',
          }
        ).addTo(map);
        layersRef.current.push(polyline);
        
        bounds.extend(polyline.getBounds());
      }
    }

    // Add place markers (circular)
    places.forEach((place) => {
      const circleIcon = L.divIcon({
        className: 'place-marker',
        html: `<div style="
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background-color: #1976d2;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      const marker = L.marker([place.coordinates.lat, place.coordinates.lng], { icon: circleIcon })
        .addTo(map)
        .bindPopup(place.name);
      layersRef.current.push(marker);
      bounds.extend([place.coordinates.lat, place.coordinates.lng]);
    });

    // Add current location marker (circular)
    if (currentLocation) {
      const currentCircleIcon = L.divIcon({
        className: 'current-location-marker',
        html: `<div style="
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background-color: #3b82f6;
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        "></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const currentMarker = L.marker([currentLocation.lat, currentLocation.lng], { icon: currentCircleIcon })
        .addTo(map)
        .bindPopup('Current Location');
      layersRef.current.push(currentMarker);
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
      className="rounded-xl border border-gray-200 overflow-hidden"
    />
  );
}

