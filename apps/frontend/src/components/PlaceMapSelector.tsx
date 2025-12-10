'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Next.js
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
}

interface PlaceMapSelectorProps {
  onLocationSelect: (coords: { lat: number; lng: number }, name?: string) => void;
  initialCoords?: { lat: number; lng: number };
  height?: string;
}

export default function PlaceMapSelector({
  onLocationSelect,
  initialCoords,
  height = '400px',
}: PlaceMapSelectorProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map
    const map = L.map(mapContainerRef.current).setView(
      initialCoords ? [initialCoords.lat, initialCoords.lng] : [0, 0],
      initialCoords ? 13 : 2
    );

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Handle map click
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
        markerRef.current.on('dragend', (e) => {
          const marker = e.target;
          const position = marker.getLatLng();
          onLocationSelect({ lat: position.lat, lng: position.lng });
        });
      }
      
      markerRef.current.bindPopup(`Selected: ${lat.toFixed(4)}, ${lng.toFixed(4)}`).openPopup();
      onLocationSelect({ lat, lng });
    });

    // Add initial marker if coordinates provided
    if (initialCoords) {
      markerRef.current = L.marker([initialCoords.lat, initialCoords.lng], { draggable: true })
        .addTo(map)
        .bindPopup('Selected Location')
        .openPopup();
      
      markerRef.current.on('dragend', (e) => {
        const marker = e.target;
        const position = marker.getLatLng();
        onLocationSelect({ lat: position.lat, lng: position.lng });
      });
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Search function using backend proxy (avoids CORS issues)
  const performSearch = async () => {
    if (!searchQuery.trim() || !mapRef.current) return;
    
    setIsSearching(true);
    try {
      // Normalize API URL - remove port from HTTPS URLs (Railway uses default HTTPS port)
      const rawUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const apiUrl = rawUrl.startsWith('https://') ? rawUrl.replace(/:\d+$/, '') : rawUrl;
      const response = await fetch(
        `${apiUrl}/api/geocoding/search?q=${encodeURIComponent(searchQuery)}&limit=5`
      );
      
      if (!response.ok) {
        throw new Error('Search request failed');
      }
      
      const data = await response.json();
      
      if (!data.success || !data.data || data.data.length === 0) {
        alert('No results found');
        setIsSearching(false);
        return;
      }
      
      const results = data.data;
      const result = results[0];
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);
      
      const map = mapRef.current;
      map.setView([lat, lng], 15);
      
      // Update marker
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
        markerRef.current.on('dragend', (e) => {
          const marker = e.target;
          const position = marker.getLatLng();
          onLocationSelect({ lat: position.lat, lng: position.lng });
        });
      }
      
      markerRef.current.bindPopup(result.display_name).openPopup();
      onLocationSelect({ lat, lng }, result.display_name);
    } catch (error) {
      console.error('Search error:', error);
      alert('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // GPS Location Button
  const handleGetGPSLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsSearching(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });
        
        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 15);
          
          if (markerRef.current) {
            markerRef.current.setLatLng([latitude, longitude]);
          } else {
            markerRef.current = L.marker([latitude, longitude], { draggable: true }).addTo(mapRef.current);
            markerRef.current.on('dragend', (e) => {
              const marker = e.target;
              const position = marker.getLatLng();
              onLocationSelect({ lat: position.lat, lng: position.lng });
            });
          }
          
          markerRef.current
            .bindPopup('Your Current Location')
            .openPopup();
          
          onLocationSelect({ lat: latitude, lng: longitude }, 'Current Location');
        }
        setIsSearching(false);
      },
      (error) => {
        console.error('GPS error:', error);
        alert('Failed to get your location. Please check location permissions.');
        setIsSearching(false);
      },
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="relative">
      <div className="mb-2 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                performSearch();
              }
            }}
            placeholder="Search for a place..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={performSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
        <button
          type="button"
          onClick={handleGetGPSLocation}
          disabled={isSearching}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          {isSearching ? 'Getting Location...' : 'Use GPS Location'}
        </button>
      </div>
      <div
        ref={mapContainerRef}
        style={{ height, width: '100%' }}
        className="rounded-lg border border-gray-300"
      />
      <p className="text-xs text-gray-500 mt-2">
        💡 Click on the map to set location, search for places, or use GPS
      </p>
    </div>
  );
}

