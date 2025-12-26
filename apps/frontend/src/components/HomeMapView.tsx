'use client';

import { useEffect, useRef, useState } from 'react';
import type { Trip, TripPlace, TripRoute } from '@tripmatrix/types';

interface HomeMapViewProps {
  places: TripPlace[];
  routes: TripRoute[];
  trips?: Trip[];
  onTripMarkerClick?: (trip: Trip, coords: { lat: number; lng: number }) => void;
  height?: string;
}

export default function HomeMapView({ 
  places, 
  routes, 
  trips = [], 
  onTripMarkerClick, 
  height = '75vh' 
}: HomeMapViewProps) {
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<any[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // Load Leaflet dynamically on client side only
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    import('leaflet').then((leafletModule) => {
      const L = leafletModule.default;
      // CSS is loaded via Next.js CSS handling, no need to dynamically import
      
      // Fix for default marker icons in Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });
      
      // Store L in a way we can access it
      (window as any).L = L;
      setLeafletLoaded(true);
    });
  }, []);

  useEffect(() => {
    // Get user location or use default
    if (typeof window === 'undefined') return;
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          // Use default location if geolocation fails
          setUserLocation({ lat: 0, lng: 0 });
        },
        { timeout: 5000, maximumAge: 60000 }
      );
    } else {
      setUserLocation({ lat: 0, lng: 0 });
    }
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !userLocation || !leafletLoaded) return;
    
    const L = (window as any).L;
    if (!L) return;

    // Ensure container exists and is in DOM
    const container = mapContainerRef.current;
    if (!container || !container.parentElement) return;

    // Initialize map
    const map = L.map(container).setView([userLocation.lat || 0, userLocation.lng || 0], 2);

    // Add satellite layer (Esri World Imagery)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
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
  }, [userLocation, leafletLoaded]);

  useEffect(() => {
    if (!mapRef.current || !leafletLoaded) return;
    
    const L = (window as any).L;
    if (!L) return;

    const map = mapRef.current;
    const bounds = L.latLngBounds([]);

    // Clear previous layers
    layersRef.current.forEach(layer => {
      map.removeLayer(layer);
    });
    layersRef.current = [];

    // Add place markers (blue pin style)
    places.forEach((place) => {
      if (place.coordinates && place.coordinates.lat && place.coordinates.lng) {
        const marker = L.marker([place.coordinates.lat, place.coordinates.lng], {
          icon: L.divIcon({
            className: 'place-marker',
            html: `<div style="position: relative; cursor: pointer; transform: translate(-50%, -100%);">
              <svg width="30" height="42" viewBox="0 0 30 42" fill="none" style="filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4));">
                <path d="M15 0C9.48 0 5 4.48 5 10c0 7 10 20 10 20s10-13 10-20c0-5.52-4.48-10-10-10z" fill="#1976d2"/>
                <path d="M15 6c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" fill="white"/>
                <path d="M15 30L10 42h10l-5-12z" fill="#1976d2"/>
              </svg>
            </div>`,
            iconSize: [30, 42],
            iconAnchor: [15, 42],
          }),
        })
          .addTo(map)
          .bindPopup(place.name || 'Place');
        layersRef.current.push(marker);
        bounds.extend([place.coordinates.lat, place.coordinates.lng]);
      }
    });

    // Add trip start location markers (red pin with star icon)
    trips.forEach((trip) => {
      const tripWithCoords = trip as Trip & { startLocationCoords?: { lat: number; lng: number } };
      if (tripWithCoords.startLocationCoords && 
          tripWithCoords.startLocationCoords.lat !== 0 && 
          tripWithCoords.startLocationCoords.lng !== 0) {
        const coords = tripWithCoords.startLocationCoords;
        const marker = L.marker([coords.lat, coords.lng], {
          icon: L.divIcon({
            className: 'trip-marker',
            html: `<div style="position: relative; cursor: pointer; transform: translate(-50%, -100%);">
              <svg width="34" height="46" viewBox="0 0 34 46" fill="none" style="filter: drop-shadow(0 3px 8px rgba(0,0,0,0.5));">
                <path d="M17 0C11.48 0 7 4.48 7 10c0 7 10 20 10 20s10-13 10-20c0-5.52-4.48-10-10-10z" fill="#d32f2f"/>
                <path d="M17 7c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="white"/>
                <path d="M17 10.5l1.5 3 3.5 0.5-2.5 2.5 0.5 3.5-3-1.5-3 1.5 0.5-3.5-2.5-2.5 3.5-0.5z" fill="#ffc107"/>
                <path d="M17 32L12 46h10l-5-14z" fill="#d32f2f"/>
              </svg>
            </div>`,
            iconSize: [34, 46],
            iconAnchor: [17, 46],
          }),
        })
          .addTo(map)
          .bindPopup(trip.title || 'Trip')
          .on('click', () => {
            if (onTripMarkerClick) {
              onTripMarkerClick(trip, coords);
            }
          });
        layersRef.current.push(marker);
        bounds.extend([coords.lat, coords.lng]);
      }
    });

    // Draw routes
    routes.forEach((route) => {
      if (route.points && route.points.length > 0) {
        const color = route.modeOfTravel === 'walk' ? '#22c55e' :
                     route.modeOfTravel === 'bike' ? '#3b82f6' :
                     route.modeOfTravel === 'car' ? '#ef4444' :
                     route.modeOfTravel === 'train' ? '#8b5cf6' :
                     route.modeOfTravel === 'bus' ? '#f59e0b' :
                     route.modeOfTravel === 'flight' ? '#ec4899' : '#3b82f6';
        
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
      }
    });

    // Fit bounds to show all markers
    if (bounds.isValid() && (places.length > 0 || trips.length > 0)) {
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      // Default view
      map.setView([0, 0], 2);
    }

    // Disable zoom controls and other interactions for cleaner look
    map.zoomControl.remove();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
  }, [places, routes, trips, onTripMarkerClick, leafletLoaded]);

  if (!userLocation || !leafletLoaded) {
    return (
      <div 
        className="w-full flex items-center justify-center bg-gray-100"
        style={{ height }}
      >
        <div className="text-sm text-gray-600">Loading map...</div>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      style={{ height, width: '100%' }}
      className="w-full"
    />
  );
}
