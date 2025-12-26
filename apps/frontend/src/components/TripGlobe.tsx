'use client';

import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { TripPlace, TripRoute, ModeOfTravel } from '@tripmatrix/types';
import { geoInterpolate } from 'd3-geo';

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
  const globeContainerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const currentAnimationProgress = useRef<number>(0);
  const initialViewSet = useRef<boolean>(false);
  const [vehiclePosition, setVehiclePosition] = useState<{ lat: number; lng: number } | null>(null);

  // Prepare points data from sorted places - using custom markers
  const points = useMemo(() => {
    const sorted = sortedPlaces.length > 0 ? sortedPlaces : places;
    const placePoints = sorted
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
    
    // Add vehicle point if it's moving
    if (vehiclePosition) {
      // Get mode of travel from the previous place (the one we're traveling from)
      const sorted = sortedPlaces.length > 0 ? sortedPlaces : places;
      const prevIndex = highlightedStepIndex > 0 ? highlightedStepIndex - 1 : 0;
      const prevPlace = sorted[prevIndex];
      const mode = prevPlace?.modeOfTravel;
      
      placePoints.push({
        lat: vehiclePosition.lat,
        lng: vehiclePosition.lng,
        size: 0.5,
        color: getModeColor(mode),
        name: `Vehicle (${mode || 'travel'})`,
        index: -1, // Special index for vehicle
        modeOfTravel: mode,
        marker: true,
      } as any);
    }
    
    return placePoints;
  }, [places, sortedPlaces, highlightedStepIndex, vehiclePosition]);

  // Prepare arcs data for paths between steps - use d3-geo for great circle paths
  const arcs = useMemo(() => {
    const sorted = sortedPlaces.length > 0 ? sortedPlaces : places;
    const arcData: any[] = [];
    
    // First, use routes if available (they have actual path points)
    routes.forEach((route) => {
      if (route.points && route.points.length > 1) {
        // Create arcs for each segment of the route using d3-geo for great circle paths
        for (let i = 0; i < route.points.length - 1; i++) {
          const start = route.points[i];
          const end = route.points[i + 1];
          
          arcData.push({
            startLat: start.lat,
            startLng: start.lng,
            endLat: end.lat,
            endLng: end.lng,
            color: getModeColor(route.modeOfTravel),
            modeOfTravel: route.modeOfTravel,
            stroke: 2,
            animateTime: getAnimationDuration(route.modeOfTravel),
          });
        }
      }
    });
    
    // If no routes available, create great circle arcs between consecutive places using d3-geo
    if (arcData.length === 0) {
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
          
          // Use d3-geo to create great circle path interpolator
          // d3-geo uses [longitude, latitude] format
          const interpolate = geoInterpolate(
            [current.coordinates.lng, current.coordinates.lat],
            [next.coordinates.lng, next.coordinates.lat]
          );
          
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
            interpolate, // Store interpolator for vehicle movement along great circle
          });
        }
      }
    } else {
      // If we have routes, highlight the active segment and add interpolators
      const sorted = sortedPlaces.length > 0 ? sortedPlaces : places;
      if (highlightedStepIndex > 0 && highlightedStepIndex < sorted.length) {
        const prevPlace = sorted[highlightedStepIndex - 1];
        const currentPlace = sorted[highlightedStepIndex];
        
        // Find and highlight the corresponding route segment
        arcData.forEach((arc, idx) => {
          const isPartOfActiveRoute = routes.some(route => {
            if (!route.points || route.points.length === 0) return false;
            const routeStart = route.points[0];
            const routeEnd = route.points[route.points.length - 1];
            return (
              (Math.abs(routeStart.lat - prevPlace.coordinates!.lat) < 0.01 &&
               Math.abs(routeStart.lng - prevPlace.coordinates!.lng) < 0.01 &&
               Math.abs(routeEnd.lat - currentPlace.coordinates!.lat) < 0.01 &&
               Math.abs(routeEnd.lng - currentPlace.coordinates!.lng) < 0.01)
            );
          });
          
          if (isPartOfActiveRoute) {
            arc.color = '#ffc107';
            arc.stroke = 3;
            // Add interpolator for this route
            if (arc.startLat && arc.startLng && arc.endLat && arc.endLng) {
              arc.interpolate = geoInterpolate(
                [arc.startLng, arc.startLat],
                [arc.endLng, arc.endLat]
              );
            }
          }
        });
      }
    }
    
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
    if (!globe || typeof globe.pointOfView !== 'function') return;
    
    // Smoothly animate camera to the highlighted point
    const targetLat = highlightedPoint.lat;
    const targetLng = highlightedPoint.lng;
    
    // Get current camera position using pointOfView
    let currentPOV;
    try {
      currentPOV = globe.pointOfView() || { lat: 0, lng: 0, altitude: 2.5 };
    } catch (error) {
      console.error('Error getting current view:', error);
      currentPOV = { lat: 0, lng: 0, altitude: 2.5 };
    }
    
    const currentLat = currentPOV.lat || 0;
    const currentLng = currentPOV.lng || 0;
    const currentAltitude = currentPOV.altitude || 2.5;
    
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
      
      try {
        globe.pointOfView({ lat, lng, altitude: currentAltitude }, 0);
      } catch (error) {
        console.error('Error animating view:', error);
        return;
      }
      
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

  // Set initial camera view to show all places with auto-zoom
  const setInitialView = useCallback(() => {
    if (!globeInstanceRef.current || points.length === 0 || initialViewSet.current) return;
    
    const globe = globeInstanceRef.current;
    if (!globe || typeof globe.pointOfView !== 'function') return;
    
    // Calculate bounds of all points (excluding vehicle point)
    const placePoints = points.filter(p => p.index !== -1);
    if (placePoints.length === 0) return;
    
    const lats = placePoints.map(p => p.lat);
    const lngs = placePoints.map(p => p.lng);
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    // Calculate center
    const avgLat = (minLat + maxLat) / 2;
    const avgLng = (minLng + maxLng) / 2;
    
    // Calculate span
    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;
    const maxSpan = Math.max(latSpan, lngSpan);
    
    // Calculate altitude based on span to auto-zoom
    // Larger span = higher altitude (zoomed out), smaller span = lower altitude (zoomed in)
    let altitude = 2.5;
    if (maxSpan > 0) {
      // Adjust altitude based on span
      if (maxSpan > 50) altitude = 3.5; // Very large area
      else if (maxSpan > 20) altitude = 2.8; // Large area
      else if (maxSpan > 10) altitude = 2.2; // Medium area
      else if (maxSpan > 5) altitude = 1.8; // Small area
      else altitude = 1.5; // Very small area
    }
    
    // Set initial view with calculated altitude
    try {
      globe.pointOfView({ lat: avgLat, lng: avgLng, altitude }, 0);
      initialViewSet.current = true;
    } catch (error) {
      console.error('Error setting initial view:', error);
    }
  }, [points]);
  
  useEffect(() => {
    if (points.length > 0 && globeInstanceRef.current) {
      setInitialView();
    }
  }, [points, setInitialView]);

  // Calculate vehicle position using d3-geo along the active path
  useEffect(() => {
    // Use setTimeout to ensure setState doesn't happen during render
    let mounted = true;
    
    const updateVehicle = () => {
      if (!mounted) return;
      
      if (arcs.length === 0 || highlightedStepIndex < 0) {
        setVehiclePosition(null);
        return;
      }
      
      // Find the arc that should be animated (the one ending at highlighted step)
      const activeArc = arcs.find(arc => arc.endIndex === highlightedStepIndex);
      if (!activeArc || !activeArc.interpolate) {
        setVehiclePosition(null);
        currentAnimationProgress.current = 0;
        return;
      }
      
      // Animate vehicle along the great circle path using d3-geo
      let progress = 0;
      const duration = getAnimationDuration(activeArc.modeOfTravel);
      const startTime = Date.now();
      
      const animate = () => {
        if (!mounted) return;
        
        const elapsed = Date.now() - startTime;
        progress = Math.min(elapsed / duration, 1);
        currentAnimationProgress.current = progress;
        
        // Use d3-geo interpolator to get position along great circle path
        if (activeArc.interpolate && mounted) {
          const [lng, lat] = activeArc.interpolate(progress);
          setVehiclePosition({ lat, lng });
        }
        
        if (progress < 1 && mounted) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else if (mounted) {
          // Vehicle reached destination
          setVehiclePosition({
            lat: activeArc.endLat,
            lng: activeArc.endLng
          });
        }
      };
      
      // Start animation on next frame to avoid setState during render
      requestAnimationFrame(animate);
    };
    
    // Delay initial update to avoid setState during render
    const timeoutId = setTimeout(updateVehicle, 0);
    
    return () => {
      mounted = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      clearTimeout(timeoutId);
    };
  }, [highlightedStepIndex, arcs]);
  

  // Calculate initial point of view based on points
  const initialPOV = useMemo(() => {
    if (points.length === 0) return null;
    
    const lats = points.map(p => p.lat);
    const lngs = points.map(p => p.lng);
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    const avgLat = (minLat + maxLat) / 2;
    const avgLng = (minLng + maxLng) / 2;
    
    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;
    const maxSpan = Math.max(latSpan, lngSpan);
    
    let altitude = 2.5;
    if (maxSpan > 0) {
      if (maxSpan > 50) altitude = 3.5;
      else if (maxSpan > 20) altitude = 2.8;
      else if (maxSpan > 10) altitude = 2.2;
      else if (maxSpan > 5) altitude = 1.8;
      else altitude = 1.5;
    }
    
    return { lat: avgLat, lng: avgLng, altitude };
  }, [points]);

  // Access globe instance after mount - react-globe.gl stores it on the canvas element
  useEffect(() => {
    if (initialViewSet.current || points.length === 0) return;
    
    const findGlobe = () => {
      if (initialViewSet.current) return;
      
      const container = globeContainerRef.current;
      if (!container) return;
      
      // Try to find the globe instance
      const canvas = container.querySelector('canvas');
      if (canvas) {
        // react-globe.gl stores the globe instance on the canvas element's userData
        // or we can access it through the Three.js scene
        let globe: any = null;
        
        // Method 1: Check canvas userData
        if ((canvas as any).userData && (canvas as any).userData.globe) {
          globe = (canvas as any).userData.globe;
        }
        
        // Method 2: Check canvas directly
        if (!globe) {
          globe = (canvas as any).__globeInstance || (canvas as any).__globe;
        }
        
        // Method 3: Access through Three.js renderer
        if (!globe && (canvas as any).__threejs) {
          const renderer = (canvas as any).__threejs;
          if (renderer && renderer.domElement && renderer.domElement.__globe) {
            globe = renderer.domElement.__globe;
          }
        }
        
        // Method 4: Check parent elements
        if (!globe) {
          let parent: any = canvas.parentElement;
          let depth = 0;
          while (parent && depth < 5 && !globe) {
            globe = parent.__globeInstance || parent.__globe;
            if (parent.querySelector && parent.querySelector('canvas')) {
              const childCanvas = parent.querySelector('canvas');
              if (childCanvas && (childCanvas as any).__globe) {
                globe = (childCanvas as any).__globe;
              }
            }
            parent = parent.parentElement;
            depth++;
          }
        }
        
        // If we found the globe, set it and initialize view
        if (globe && typeof globe.pointOfView === 'function') {
          globeInstanceRef.current = globe;
          setInitialView();
        }
      }
    };
    
    // Try multiple times with increasing delays
    const timers = [
      setTimeout(findGlobe, 100),
      setTimeout(findGlobe, 300),
      setTimeout(findGlobe, 500),
      setTimeout(findGlobe, 1000),
      setTimeout(findGlobe, 2000),
      setTimeout(findGlobe, 3000),
    ];
    
    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [points, setInitialView]);

  return (
    <div ref={globeContainerRef} style={{ width: '100%', height, position: 'relative', background: '#000' }}>
      <Globe
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        pointsData={points}
        pointColor={(point: any) => point.color || '#1976d2'}
        pointRadius={(point: any) => point.size || 0.4}
        pointLabel="name"
        pointAltitude={0.01}
        pointResolution={16}
        arcsData={arcs}
        arcColor="color"
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={(arc: any) => arc.animateTime || 2000}
        arcStroke={(arc: any) => arc.stroke || 2}
        showAtmosphere={true}
        atmosphereColor="#3a228a"
        atmosphereAltitude={0.15}
        onPointClick={(point: any) => {
          console.log('Point clicked:', point);
        }}
      />
    </div>
  );
}

