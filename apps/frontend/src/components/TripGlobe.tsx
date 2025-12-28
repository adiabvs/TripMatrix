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
  autoPlay?: boolean; // Enable auto-play animation like mult.dev
  animationSpeed?: number; // Speed multiplier for animations
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
  sortedPlaces = [],
  autoPlay = false,
  animationSpeed = 1.0
}: TripGlobeProps) {
  const globeInstanceRef = useRef<any>(null);
  const globeContainerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const currentAnimationProgress = useRef<number>(0);
  const initialViewSet = useRef<boolean>(false);
  const [vehiclePosition, setVehiclePosition] = useState<{ lat: number; lng: number } | null>(null);
  const [animatedArcProgress, setAnimatedArcProgress] = useState<Record<number, number>>({});
  const autoPlayStepRef = useRef<number>(0);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Calculate initial point of view - focus on starting location (first point)
  const initialPOV = useMemo(() => {
    if (points.length === 0) return null;
    
    // Get the starting location (first point, excluding vehicle point)
    const placePoints = points.filter(p => p.index !== -1);
    if (placePoints.length === 0) return null;
    
    // Sort by index to get the first place
    const sortedPlacePoints = [...placePoints].sort((a, b) => a.index - b.index);
    const startingPoint = sortedPlacePoints[0];
    
    if (!startingPoint) return null;
    
    // Focus on the starting location with a close-up view
    return { 
      lat: startingPoint.lat, 
      lng: startingPoint.lng, 
      altitude: 1.5 // Close-up view for starting location
    };
  }, [points]);

  // Set initial camera view to focus on starting location
  const setInitialView = useCallback((pov: { lat: number; lng: number; altitude: number } | null) => {
    if (!globeInstanceRef.current || !pov || initialViewSet.current) return;
    
    const globe = globeInstanceRef.current;
    if (!globe || typeof globe.pointOfView !== 'function') return;
    
    // Set initial view to focus on starting location
    try {
      globe.pointOfView(pov, 0);
      initialViewSet.current = true;
    } catch (error) {
      console.error('Error setting initial view:', error);
    }
  }, []);
  
  useEffect(() => {
    if (initialPOV && globeInstanceRef.current) {
      setInitialView(initialPOV);
    }
  }, [initialPOV, setInitialView]);

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
  
  // Auto-play animation like mult.dev - automatically progress through the trip
  useEffect(() => {
    if (!autoPlay || sortedPlaces.length === 0) {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      return;
    }
    
    const sorted = sortedPlaces.length > 0 ? sortedPlaces : places;
    if (autoPlayStepRef.current >= sorted.length) {
      autoPlayStepRef.current = 0; // Loop back to start
    }
    
    const currentStep = sorted[autoPlayStepRef.current];
    if (!currentStep) return;
    
    // Animate camera to current step
    if (globeInstanceRef.current && typeof globeInstanceRef.current.pointOfView === 'function') {
      const globe = globeInstanceRef.current;
      const coords = currentStep.coordinates;
      
      if (coords && coords.lat && coords.lng) {
        try {
          // Smooth camera movement
          globe.pointOfView(
            { 
              lat: coords.lat, 
              lng: coords.lng, 
              altitude: 1.8 
            }, 
            1500 / animationSpeed // Smooth transition
          );
        } catch (error) {
          console.error('Error animating camera:', error);
        }
      }
    }
    
    // Move to next step after delay
    const stepDuration = 3000 / animationSpeed; // 3 seconds per step
    autoPlayTimerRef.current = setTimeout(() => {
      autoPlayStepRef.current++;
      // Force re-render by updating a state
      setVehiclePosition(prev => prev ? { ...prev } : null);
    }, stepDuration);
    
    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
      }
    };
  }, [autoPlay, sortedPlaces, places, animationSpeed]);

  // Access globe instance after mount - react-globe.gl stores it on the canvas element
  useEffect(() => {
    if (initialViewSet.current || !initialPOV) return;
    
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
        
        // If we found the globe, set it and initialize view to starting location
        if (globe && typeof globe.pointOfView === 'function') {
          globeInstanceRef.current = globe;
          // Set initial view to starting location
          if (initialPOV && !initialViewSet.current) {
            try {
              globe.pointOfView(initialPOV, 0);
              initialViewSet.current = true;
            } catch (error) {
              console.error('Error setting initial view:', error);
            }
          }
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
  }, [initialPOV]);

  return (
    <div ref={globeContainerRef} style={{ width: '100%', height, position: 'relative', background: '#000' }}>
      <Globe
        globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"
        pointsData={points}
        pointColor={(point: any) => {
          // Add glow effect for highlighted points
          if (point.index === highlightedStepIndex) {
            return point.color || '#ffc107';
          }
          return point.color || '#1976d2';
        }}
        pointRadius={(point: any) => {
          // Larger radius for highlighted points
          if (point.index === highlightedStepIndex) {
            return (point.size || 0.4) * 1.5;
          }
          return point.size || 0.4;
        }}
        pointLabel="name"
        pointAltitude={0.01}
        pointResolution={16}
        arcsData={arcs}
        arcColor="color"
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={(arc: any) => {
          const baseTime = arc.animateTime || 2000;
          return baseTime / animationSpeed;
        }}
        arcStroke={(arc: any) => {
          // Thicker stroke for active/highlighted arcs
          const baseStroke = arc.stroke || 2;
          const isActive = arc.endIndex === highlightedStepIndex;
          return isActive ? baseStroke * 1.5 : baseStroke;
        }}
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

