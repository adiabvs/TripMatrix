'use client';

import { useEffect, useRef, useState } from 'react';
import type { Trip, TripPlace, TripRoute } from '@tripmatrix/types';
import { getModeIconHTML } from '@/lib/iconUtils';

interface HomeMapViewProps {
  places: TripPlace[];
  routes: TripRoute[];
  trips?: Trip[];
  onTripMarkerClick?: (trip: Trip, coords: { lat: number; lng: number }) => void;
  height?: string;
  highlightedStepIndex?: number;
  sortedPlaces?: TripPlace[];
}

export default function HomeMapView({ 
  places, 
  routes, 
  trips = [], 
  onTripMarkerClick, 
  height = '75vh',
  highlightedStepIndex,
  sortedPlaces = []
}: HomeMapViewProps) {
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<any[]>([]);
  const animationLayerRef = useRef<any>(null);
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

    // Add place markers (circular)
    places.forEach((place) => {
      if (place.coordinates && place.coordinates.lat && place.coordinates.lng) {
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
          .bindPopup(place.name || 'Place');
        layersRef.current.push(marker);
        bounds.extend([place.coordinates.lat, place.coordinates.lng]);
      }
    });

    // Add trip start location markers (circular)
    trips.forEach((trip) => {
      const tripWithCoords = trip as Trip & { startLocationCoords?: { lat: number; lng: number } };
      if (tripWithCoords.startLocationCoords && 
          tripWithCoords.startLocationCoords.lat !== 0 && 
          tripWithCoords.startLocationCoords.lng !== 0) {
        const coords = tripWithCoords.startLocationCoords;
        // Create circular marker (navy blue for following) - responsive across devices
        const circleIcon = L.divIcon({
          className: 'trip-marker',
          html: `<div style="
            width: 14px;
            height: 14px;
            min-width: 14px;
            min-height: 14px;
            border-radius: 50%;
            background-color: #001f3f;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            display: block;
            position: relative;
          "></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        const marker = L.marker([coords.lat, coords.lng], { icon: circleIcon })
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

    // Draw lines between consecutive places based on mode of travel
    if (sortedPlaces.length > 0) {
      for (let i = 0; i < sortedPlaces.length - 1; i++) {
        const currentPlace = sortedPlaces[i];
        const nextPlace = sortedPlaces[i + 1];
        
        if (currentPlace.coordinates && nextPlace.coordinates && nextPlace.modeOfTravel) {
          const color = nextPlace.modeOfTravel === 'walk' ? '#22c55e' :
                       nextPlace.modeOfTravel === 'bike' ? '#3b82f6' :
                       nextPlace.modeOfTravel === 'car' ? '#ef4444' :
                       nextPlace.modeOfTravel === 'train' ? '#8b5cf6' :
                       nextPlace.modeOfTravel === 'bus' ? '#f59e0b' :
                       nextPlace.modeOfTravel === 'flight' ? '#ec4899' : '#3b82f6';
          
          const isHighlighted = highlightedStepIndex !== undefined && i === highlightedStepIndex;
          
          const polyline = L.polyline(
            [
              [currentPlace.coordinates.lat, currentPlace.coordinates.lng],
              [nextPlace.coordinates.lat, nextPlace.coordinates.lng]
            ] as [number, number][],
            {
              color,
              weight: isHighlighted ? 6 : 3,
              opacity: isHighlighted ? 1 : 0.5,
              dashArray: nextPlace.modeOfTravel === 'flight' ? '10, 10' : undefined,
            }
          ).addTo(map);
          layersRef.current.push(polyline);
          
          // Add animated icon for highlighted route
          if (isHighlighted) {
            const midLat = (currentPlace.coordinates.lat + nextPlace.coordinates.lat) / 2;
            const midLng = (currentPlace.coordinates.lng + nextPlace.coordinates.lng) / 2;
            
            const iconHTML = getModeIconHTML(nextPlace.modeOfTravel, color, true);
            
            // Remove previous animation layer
            if (animationLayerRef.current) {
              map.removeLayer(animationLayerRef.current);
            }
            
            const animatedIcon = L.divIcon({
              className: 'animated-mode-icon',
              html: `<div style="
                background: white;
                border: 3px solid ${color};
                border-radius: 50%;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 8px rgba(0,0,0,0.4);
                animation: pulse 2s infinite;
                color: ${color};
              ">${iconHTML}</div>
              <style>
                @keyframes pulse {
                  0%, 100% { transform: scale(1); opacity: 1; }
                  50% { transform: scale(1.2); opacity: 0.8; }
                }
              </style>`,
              iconSize: [40, 40],
              iconAnchor: [20, 20],
            });
            
            animationLayerRef.current = L.marker([midLat, midLng], { icon: animatedIcon })
              .addTo(map);
            
            // Animate map to show current and next step
            const currentBounds = L.latLngBounds([
              [currentPlace.coordinates.lat, currentPlace.coordinates.lng],
              [nextPlace.coordinates.lat, nextPlace.coordinates.lng]
            ]);
            map.flyToBounds(currentBounds, {
              padding: [100, 100],
              duration: 1,
            });
          }
        }
      }
    }

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
  }, [places, routes, trips, onTripMarkerClick, leafletLoaded, highlightedStepIndex, sortedPlaces]);

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
