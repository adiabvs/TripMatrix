'use client';

import { useMemo, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { TripPlace, TripRoute, ModeOfTravel } from '@tripmatrix/types';

interface TripGlobeProps {
  places: TripPlace[];
  routes: TripRoute[];
  height?: string;
  highlightedStepIndex?: number;
  sortedPlaces?: TripPlace[];
}

// Vehicle type mapping based on mode of travel
const getVehicleType = (mode: ModeOfTravel | null | undefined): string => {
  switch (mode) {
    case 'walk':
      return '🚶';
    case 'bike':
      return '🚴';
    case 'car':
      return '🚗';
    case 'train':
      return '🚂';
    case 'bus':
      return '🚌';
    case 'flight':
      return '✈️';
    default:
      return '📍';
  }
};

// Get color based on mode of travel
const getModeColor = (mode: ModeOfTravel | null | undefined): string => {
  switch (mode) {
    case 'walk':
      return '#22c55e';
    case 'bike':
      return '#3b82f6';
    case 'car':
      return '#ef4444';
    case 'train':
      return '#8b5cf6';
    case 'bus':
      return '#f59e0b';
    case 'flight':
      return '#ec4899';
    default:
      return '#1976d2';
  }
};

// Get animation duration based on mode of travel (faster modes = shorter duration)
const getAnimationDuration = (mode: ModeOfTravel | null | undefined): number => {
  switch (mode) {
    case 'flight':
      return 1000; // Fastest
    case 'car':
      return 1500;
    case 'train':
      return 1800;
    case 'bus':
      return 2000;
    case 'bike':
      return 2500;
    case 'walk':
      return 3000; // Slowest
    default:
      return 2000;
  }
};

// Dynamically import Globe component
const Globe = dynamic(() => import('react-globe.gl'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <div className="text-white text-sm">Loading globe...</div>
    </div>
  ),
});

export default function TripGlobe({ 
  places, 
  routes, 
  height = '75vh',
  highlightedStepIndex = 0,
  sortedPlaces = []
}: TripGlobeProps) {
  const globeInstanceRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const currentAnimationProgress = useRef<number>(0);
  const initialViewSet = useRef<boolean>(false);

  // Prepare points data from sorted places - using custom markers
  const points = useMemo(() => {
    const sorted = sortedPlaces.length > 0 ? sortedPlaces : places;
    return sorted
      .filter(p => p.coordinates && p.coordinates.lat && p.coordinates.lng)
      .map((p, index) => {
        const isHighlighted = index === highlightedStepIndex;
        const modeColor = getModeColor(p.modeOfTravel);
        return {
          lat: p.coordinates!.lat,
          lng: p.coordinates!.lng,
          size: isHighlighted ? 0.6 : 0.4,
          color: isHighlighted ? '#ffc107' : modeColor,
          name: p.name,
          index,
          modeOfTravel: p.modeOfTravel,
          // Use custom marker properties
          marker: true,
        };
      });
  }, [places, sortedPlaces, highlightedStepIndex]);

  // Prepare arcs data for paths between steps
  const arcs = useMemo(() => {
    const sorted = sortedPlaces.length > 0 ? sortedPlaces : places;
    const arcData: any[] = [];
    
    // Create arcs between consecutive places
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      
      if (
        current.coordinates && 
        current.coordinates.lat && 
        current.coordinates.lng &&
        next.coordinates && 
        next.coordinates.lat && 
        next.coordinates.lng
      ) {
        const mode = current.modeOfTravel || next.modeOfTravel;
        const isActive = i === highlightedStepIndex - 1 || (highlightedStepIndex === 0 && i === 0);
        
        arcData.push({
          startLat: current.coordinates.lat,
          startLng: current.coordinates.lng,
          endLat: next.coordinates.lat,
          endLng: next.coordinates.lng,
          color: isActive ? '#ffc107' : getModeColor(mode),
          modeOfTravel: mode,
          startIndex: i,
          endIndex: i + 1,
          stroke: isActive ? 3 : 2,
          animateTime: getAnimationDuration(mode),
        });
      }
    }
    
    // Also add routes if available (for detailed paths)
    routes.forEach((route) => {
      if (route.points && route.points.length > 1) {
        const start = route.points[0];
        const end = route.points[route.points.length - 1];
        arcData.push({
          startLat: start.lat,
          startLng: start.lng,
          endLat: end.lat,
          endLng: end.lng,
          color: getModeColor(route.modeOfTravel),
          modeOfTravel: route.modeOfTravel,
          stroke: 1.5,
          animateTime: getAnimationDuration(route.modeOfTravel),
        });
      }
    });
    
    return arcData;
  }, [places, sortedPlaces, routes, highlightedStepIndex]);

  // Note: Labels removed due to FontLoader compatibility issues with emojis
  // Vehicle types are shown via point colors and sizes instead

  // Animate camera to highlighted step
  useEffect(() => {
    if (!globeInstanceRef.current || points.length === 0) return;
    
    const highlightedPoint = points.find(p => p.index === highlightedStepIndex);
    if (!highlightedPoint) return;

    const globe = globeInstanceRef.current;
    
    // Smoothly animate camera to the highlighted point
    const targetLat = highlightedPoint.lat;
    const targetLng = highlightedPoint.lng;
    
    // Get current camera position using pointOfView
    const currentPOV = globe.pointOfView() || { lat: 0, lng: 0, altitude: 2.5 };
    const currentLat = currentPOV.lat || 0;
    const currentLng = currentPOV.lng || 0;
    
    // Animate smoothly
    let progress = 0;
    const duration = 1000; // 1 second animation
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const lat = currentLat + (targetLat - currentLat) * easeOut;
      const lng = currentLng + (targetLng - currentLng) * easeOut;
      
      globe.pointOfView({ lat, lng, altitude: 2.5 }, 0);
      
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };
    
    animate();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [highlightedStepIndex, points]);

  // Set initial camera view to show all places
  useEffect(() => {
    if (!globeInstanceRef.current || points.length === 0 || initialViewSet.current) return;
    
    const globe = globeInstanceRef.current;
    
    // Calculate center of all points
    if (points.length > 0) {
      const avgLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
      const avgLng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
      
      // Set initial view with a good altitude to see the path
      globe.pointOfView({ lat: avgLat, lng: avgLng, altitude: 2.5 }, 0);
      initialViewSet.current = true;
    }
  }, [points]);

  // Calculate animation progress for vehicle movement
  useEffect(() => {
    if (arcs.length === 0 || highlightedStepIndex < 0) return;
    
    // Find the arc that should be animated (the one ending at highlighted step)
    const activeArc = arcs.find(arc => arc.endIndex === highlightedStepIndex);
    if (!activeArc) {
      currentAnimationProgress.current = 0;
      return;
    }
    
    // Animate vehicle along the path
    let progress = 0;
    const duration = 2000; // 2 seconds to travel along path
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      progress = Math.min(elapsed / duration, 1);
      currentAnimationProgress.current = progress;
      
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };
    
    animate();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [highlightedStepIndex, arcs]);

  return (
    <div style={{ width: '100%', height, position: 'relative', background: '#000' }}>
      <Globe
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        pointsData={points}
        pointColor="color"
        pointRadius="size"
        pointLabel="name"
        pointAltitude={0.01}
        pointResolution={16}
        pointLabelSize={1.2}
        arcsData={arcs}
        arcColor="color"
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={(arc: any) => arc.animateTime || 2000}
        arcStroke={(arc: any) => arc.stroke || 2}
        showAtmosphere={true}
        atmosphereColor="#3a228a"
        atmosphereAltitude={0.15}
        onGlobeReady={(globe: any) => {
          globeInstanceRef.current = globe;
          
          // Set initial view if points are available
          if (points.length > 0 && !initialViewSet.current) {
            const avgLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
            const avgLng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
            globe.pointOfView({ lat: avgLat, lng: avgLng, altitude: 2.5 }, 0);
            initialViewSet.current = true;
          }
        }}
        onPointClick={(point: any) => {
          console.log('Point clicked:', point);
        }}
      />
    </div>
  );
}

