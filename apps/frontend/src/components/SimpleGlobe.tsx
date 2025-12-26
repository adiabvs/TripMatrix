'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { Trip, TripPlace, TripRoute } from '@tripmatrix/types';

interface SimpleGlobeProps {
  places: TripPlace[];
  routes: TripRoute[];
  trips?: Trip[];
  onTripMarkerClick?: (trip: Trip, coords: { lat: number; lng: number }) => void;
  height?: string;
}

// Dynamically import Globe component
const Globe = dynamic(() => import('react-globe.gl'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <div className="text-white text-sm">Loading globe...</div>
    </div>
  ),
});

export default function SimpleGlobe({ 
  places, 
  routes, 
  trips = [], 
  onTripMarkerClick, 
  height = '75vh' 
}: SimpleGlobeProps) {
  // Prepare points data
  const points = useMemo(() => {
    const placePoints = places
      .filter(p => p.coordinates && p.coordinates.lat && p.coordinates.lng)
      .map(p => ({
        lat: p.coordinates!.lat,
        lng: p.coordinates!.lng,
        size: 0.3,
        color: '#1976d2',
        name: p.name,
      }));

    const tripPoints = trips
      .filter((t: any) => t.startLocationCoords && t.startLocationCoords.lat && t.startLocationCoords.lng)
      .map((t: any) => ({
        lat: t.startLocationCoords.lat,
        lng: t.startLocationCoords.lng,
        size: 0.4,
        color: '#d32f2f',
        trip: t,
      }));

    return [...placePoints, ...tripPoints];
  }, [places, trips]);

  // Prepare arcs data
  const arcs = useMemo(() => {
    const arcData: any[] = [];
    routes.forEach((route) => {
      if (route.points && route.points.length > 1) {
        const start = route.points[0];
        const end = route.points[route.points.length - 1];
        arcData.push({
          startLat: start.lat,
          startLng: start.lng,
          endLat: end.lat,
          endLng: end.lng,
          color: [
            ['walk', '#22c55e'],
            ['bike', '#3b82f6'],
            ['car', '#ef4444'],
            ['train', '#8b5cf6'],
            ['bus', '#f59e0b'],
            ['flight', '#ec4899'],
          ].find(([mode]) => mode === route.modeOfTravel)?.[1] || '#3b82f6',
        });
      }
    });
    return arcData;
  }, [routes]);

  return (
    <div style={{ width: '100%', height, position: 'relative', background: '#000' }}>
      <Globe
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        pointsData={points}
        pointColor="color"
        pointRadius="size"
        pointLabel="name"
        arcsData={arcs}
        arcColor="color"
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={1000}
        showAtmosphere={true}
        atmosphereColor="#3a228a"
        atmosphereAltitude={0.15}
        onPointClick={(point: any) => {
          if (point.trip && onTripMarkerClick) {
            onTripMarkerClick(point.trip, { lat: point.lat, lng: point.lng });
          }
        }}
      />
    </div>
  );
}

