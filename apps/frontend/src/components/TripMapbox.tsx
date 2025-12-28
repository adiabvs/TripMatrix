'use client';

import { useMemo, useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { TripPlace, TripRoute, ModeOfTravel } from '@tripmatrix/types';
import { geoInterpolate } from 'd3-geo';
import { getModeIconSVG } from '@/lib/iconUtils';

interface TripMapboxProps {
  places: TripPlace[];
  routes: TripRoute[];
  height?: string;
  highlightedStepIndex?: number;
  sortedPlaces?: TripPlace[];
  autoPlay?: boolean;
  animationSpeed?: number;
  scrollProgress?: number; // Progress between current and next step (0-1)
}

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

// Get animation duration based on mode of travel
const getAnimationDuration = (mode: ModeOfTravel | null | undefined): number => {
  switch (mode) {
    case 'flight':
      return 1000;
    case 'car':
      return 1500;
    case 'train':
      return 1800;
    case 'bus':
      return 2000;
    case 'bike':
      return 2500;
    case 'walk':
      return 3000;
    default:
      return 2000;
  }
};

// Get vehicle icon HTML
const getVehicleIcon = (mode: ModeOfTravel | null | undefined): string => {
  return getModeIconSVG(mode, '#000');
};

// Fetch road route from OSRM (free routing service)
async function fetchRoadRoute(
  startLng: number,
  startLat: number,
  endLng: number,
  endLat: number
): Promise<[number, number][]> {
  try {
    // Use OSRM demo server (free, no API key needed)
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      return data.routes[0].geometry.coordinates as [number, number][];
    }
  } catch (error) {
    console.warn('Failed to fetch road route from OSRM:', error);
  }
  
  // Fallback: return direct path
  return [[startLng, startLat], [endLng, endLat]];
}

export default function TripMapbox({
  places,
  routes,
  height = '75vh',
  highlightedStepIndex = 0,
  sortedPlaces = [],
  autoPlay = false,
  animationSpeed = 1.0,
  scrollProgress = 0,
}: TripMapboxProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const vehicleMarkerRef = useRef<maplibregl.Marker | null>(null);
  const routeStartMarkerRef = useRef<maplibregl.Marker | null>(null);
  const routeEndMarkerRef = useRef<maplibregl.Marker | null>(null);
  const polylinesRef = useRef<any[]>([]);
  const routesRef = useRef<any[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const routeCoordinatesCache = useRef<Map<string, [number, number][]>>(new Map());
  const routeCreationAbortRef = useRef<AbortController | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    try {
      // Using MapLibre GL JS (like leafmap does)
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            'satellite': {
              type: 'raster',
              tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
              ],
              tileSize: 256,
              attribution: '© Esri'
            }
          },
          layers: [
            {
              id: 'satellite-layer',
              type: 'raster',
              source: 'satellite',
              minzoom: 0,
              maxzoom: 19
            }
          ]
        },
        center: [0, 0],
        zoom: 2,
        attributionControl: false,
      });

      // Handle map load
      map.on('load', () => {
        setMapLoaded(true);
        mapRef.current = map;
        
        // Hide MapLibre attribution and controls
        setTimeout(() => {
          const attribution = map.getContainer().querySelector('.maplibregl-ctrl-attrib');
          if (attribution) {
            (attribution as HTMLElement).style.display = 'none';
          }
          const bottomRight = map.getContainer().querySelector('.maplibregl-ctrl-bottom-right');
          if (bottomRight) {
            (bottomRight as HTMLElement).style.display = 'none';
          }
          // Hide navigation controls
          const navControls = map.getContainer().querySelectorAll('.maplibregl-ctrl');
          navControls.forEach((ctrl: any) => {
            if (ctrl) ctrl.style.display = 'none';
          });
        }, 100);
      });

      map.on('error', (e) => {
        if (e.error) {
          const errorMsg = e.error.message || String(e.error);
          if (!errorMsg.includes('tile') && !errorMsg.includes('Tile')) {
            console.error('MapLibre error:', errorMsg);
          }
        }
      });

      return () => {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    } catch (error) {
      console.error('Failed to initialize MapLibre:', error);
    }
  }, []);

  // Get sorted places
  const sortedPlacesData = useMemo(() => {
    return sortedPlaces.length > 0 ? sortedPlaces : places;
  }, [places, sortedPlaces]);

  // Calculate distance between two coordinates (Haversine formula) in kilometers
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Calculate bounds from all places for initial view
  const allPlacesBounds = useMemo(() => {
    const validPlaces = sortedPlacesData.filter(p => p.coordinates && p.coordinates.lat && p.coordinates.lng);
    if (validPlaces.length === 0) return null;

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    validPlaces.forEach(place => {
      if (place.coordinates?.lat && place.coordinates?.lng) {
        minLat = Math.min(minLat, place.coordinates.lat);
        maxLat = Math.max(maxLat, place.coordinates.lat);
        minLng = Math.min(minLng, place.coordinates.lng);
        maxLng = Math.max(maxLng, place.coordinates.lng);
      }
    });

    // Calculate maximum distance between any two points
    let maxDistance = 0;
    for (let i = 0; i < validPlaces.length; i++) {
      for (let j = i + 1; j < validPlaces.length; j++) {
        const p1 = validPlaces[i];
        const p2 = validPlaces[j];
        if (p1.coordinates && p2.coordinates) {
          const dist = calculateDistance(
            p1.coordinates.lat,
            p1.coordinates.lng,
            p2.coordinates.lat,
            p2.coordinates.lng
          );
          maxDistance = Math.max(maxDistance, dist);
        }
      }
    }

    // Add padding to bounds
    const latPadding = (maxLat - minLat) * 0.1 || 0.01;
    const lngPadding = (maxLng - minLng) * 0.1 || 0.01;

    return {
      sw: [minLng - lngPadding, minLat - latPadding] as [number, number],
      ne: [maxLng + lngPadding, maxLat + latPadding] as [number, number],
      maxDistance, // Store max distance for zoom calculation
    };
  }, [sortedPlacesData]);

  // Set initial view to fit all places (only once)
  const initialBoundsSet = useRef(false);
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !allPlacesBounds || initialBoundsSet.current) return;

    try {
      // Use MapLibre's fitBounds with proper bounds format
      const bounds = new maplibregl.LngLatBounds(allPlacesBounds.sw, allPlacesBounds.ne);
      
      // Calculate zoom limits based on distance
      // Small distance (< 10km) = zoom in more (maxZoom: 15)
      // Medium distance (10-100km) = moderate zoom (maxZoom: 12)
      // Large distance (100-1000km) = zoom out (maxZoom: 8)
      // Very large distance (> 1000km) = zoom out more (maxZoom: 5)
      let maxZoom = 12;
      let minZoom = 2;
      
      if (allPlacesBounds.maxDistance < 10) {
        maxZoom = 15; // Very close points, zoom in
      } else if (allPlacesBounds.maxDistance < 100) {
        maxZoom = 12; // Medium distance
      } else if (allPlacesBounds.maxDistance < 1000) {
        maxZoom = 8; // Large distance, zoom out
      } else {
        maxZoom = 5; // Very large distance, zoom out more
      }
      
      mapRef.current.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        duration: 0, // No animation for initial bounds
        maxZoom, // Limit zoom based on distance
        minZoom, // Minimum zoom level
      });
      initialBoundsSet.current = true;
    } catch (error) {
      console.error('Failed to set initial bounds:', error);
    }
  }, [mapLoaded, allPlacesBounds]);

  // Update markers and routes - delay marker rendering to prevent icons from appearing on initial load
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const map = mapRef.current;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Cancel any ongoing route creation
    if (routeCreationAbortRef.current) {
      routeCreationAbortRef.current.abort();
      routeCreationAbortRef.current = null;
    }

    // Clear existing routes
    routesRef.current.forEach(route => {
      if (route.layerId && map.getLayer(route.layerId)) {
        map.removeLayer(route.layerId);
      }
      if (route.sourceId && map.getSource(route.sourceId)) {
        map.removeSource(route.sourceId);
      }
    });
    routesRef.current = [];

    // Delay marker rendering to prevent icons from appearing immediately
    const markerTimeout = setTimeout(() => {
      // Add markers for places
      sortedPlacesData.forEach((place, index) => {
        if (!place.coordinates || !place.coordinates.lat || !place.coordinates.lng) return;

        const isHighlighted = index === highlightedStepIndex;
        const modeColor = getModeColor(place.modeOfTravel);
        const color = isHighlighted ? '#ffc107' : modeColor;

        // Create custom marker element
        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.style.width = isHighlighted ? '32px' : '24px';
        el.style.height = isHighlighted ? '32px' : '24px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = color;
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.fontSize = isHighlighted ? '16px' : '12px';
        el.style.cursor = 'pointer';
        el.title = place.name;

        const marker = new maplibregl.Marker(el)
          .setLngLat([place.coordinates.lng, place.coordinates.lat])
          .addTo(map);

        markersRef.current.push(marker);
      });
    }, 500); // Delay by 500ms to prevent icons from appearing on initial load

    return () => {
      clearTimeout(markerTimeout);
    };

    // Add routes
    if (routes.length > 0) {
      routes.forEach((route, routeIndex) => {
        if (!route.points || route.points.length < 2) return;

        const coordinates = route.points.map(p => [p.lng, p.lat] as [number, number]);
        const color = getModeColor(route.modeOfTravel);
        
        // Find which place index this route corresponds to
        const startPlace = sortedPlacesData.find(p => 
          p.coordinates && 
          Math.abs(p.coordinates.lat - route.points[0].lat) < 0.01 &&
          Math.abs(p.coordinates.lng - route.points[0].lng) < 0.01
        );
        const startIndex = startPlace ? sortedPlacesData.indexOf(startPlace) : -1;
        const endIndex = startIndex >= 0 ? startIndex + 1 : -1;
        // Route is active if it starts at the highlighted step (going from current to next)
        const isActive = startIndex === highlightedStepIndex;

        const sourceId = `route-${routeIndex}`;
        const layerId = `route-layer-${routeIndex}`;

        // Check if source already exists
        if (map.getSource(sourceId)) {
          map.removeLayer(layerId);
          map.removeSource(sourceId);
        }

        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates,
            },
          },
        });

        // Check if layer already exists and update it, otherwise add new layer
        if (map.getLayer(layerId)) {
          // Update existing layer
          map.setPaintProperty(layerId, 'line-color', isActive ? '#ffc107' : color);
          map.setPaintProperty(layerId, 'line-width', isActive ? 4 : 3);
        } else {
          map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': isActive ? '#ffc107' : color,
              'line-width': isActive ? 4 : 3,
              'line-opacity': 0.8,
            },
          });
        }

        routesRef.current.push({ 
          sourceId, 
          layerId, 
          coordinates, 
          startIndex, 
          endIndex,
          modeOfTravel: route.modeOfTravel 
        });
      });
    } else {
      // Create routes between consecutive places
      const createRoutes = async () => {
        // Create abort controller for this route creation
        const abortController = new AbortController();
        routeCreationAbortRef.current = abortController;

        for (let i = 0; i < sortedPlacesData.length - 1; i++) {
          // Check if operation was aborted
          if (abortController.signal.aborted) {
            return;
          }

          const current = sortedPlacesData[i];
          const next = sortedPlacesData[i + 1];

          if (
            !current.coordinates ||
            !current.coordinates.lat ||
            !current.coordinates.lng ||
            !next.coordinates ||
            !next.coordinates.lat ||
            !next.coordinates.lng
          ) {
            continue;
          }

          // Mode of travel should come from the destination step (next)
          const mode = next.modeOfTravel;
          const color = getModeColor(mode);
          // Route is active if it starts at the highlighted step (going from current to next)
          const isActive = i === highlightedStepIndex;

          const sourceId = `route-place-${i}`;
          const layerId = `route-layer-place-${i}`;
          const cacheKey = `${current.coordinates.lng},${current.coordinates.lat}-${next.coordinates.lng},${next.coordinates.lat}-${mode}`;

          // Check if source already exists and remove it
          if (map.getSource(sourceId)) {
            if (map.getLayer(layerId)) {
              map.removeLayer(layerId);
            }
            map.removeSource(sourceId);
          }

          // For flight: use great circle path (direct)
          // For others: fetch road route
          let coordinates: [number, number][];
          
          if (mode === 'flight') {
            // Use great circle for flights
            const interpolate = geoInterpolate(
              [current.coordinates.lng, current.coordinates.lat],
              [next.coordinates.lng, next.coordinates.lat]
            );
            const numPoints = 50;
            coordinates = [];
            for (let j = 0; j <= numPoints; j++) {
              const t = j / numPoints;
              const [lng, lat] = interpolate(t);
              coordinates.push([lng, lat]);
            }
          } else {
            // Check cache first
            if (routeCoordinatesCache.current.has(cacheKey)) {
              coordinates = routeCoordinatesCache.current.get(cacheKey)!;
            } else {
              // Check if aborted before fetching
              if (abortController.signal.aborted) {
                return;
              }
              // Fetch road route from OSRM
              coordinates = await fetchRoadRoute(
                current.coordinates.lng,
                current.coordinates.lat,
                next.coordinates.lng,
                next.coordinates.lat
              );
              // Check again after async operation
              if (abortController.signal.aborted) {
                return;
              }
              routeCoordinatesCache.current.set(cacheKey, coordinates);
            }
          }

          // Final check before adding to map
          if (abortController.signal.aborted) {
            return;
          }

          map.addSource(sourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates,
              },
            },
          });

          // Check if layer already exists and update it, otherwise add new layer
          if (map.getLayer(layerId)) {
            // Update existing layer
            map.setPaintProperty(layerId, 'line-color', isActive ? '#ffc107' : color);
            map.setPaintProperty(layerId, 'line-width', isActive ? 4 : 3);
          } else {
            map.addLayer({
              id: layerId,
              type: 'line',
              source: sourceId,
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
              },
              paint: {
                'line-color': isActive ? '#ffc107' : color,
                'line-width': isActive ? 4 : 3,
                'line-opacity': 0.8,
              },
            });
          }

          routesRef.current.push({ 
            sourceId, 
            layerId, 
            coordinates, 
            startIndex: i, 
            endIndex: i + 1,
            modeOfTravel: mode 
          });
        }
        
        // Clear abort controller when done
        if (routeCreationAbortRef.current === abortController) {
          routeCreationAbortRef.current = null;
        }
      };
      createRoutes();
    }
  }, [mapLoaded, sortedPlacesData, routes]);

  // Update route colors when highlighted step changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const map = mapRef.current;

    // Update all route layers with correct active state
    routesRef.current.forEach((route) => {
      const isActive = route.startIndex === highlightedStepIndex;
      const color = getModeColor(route.modeOfTravel);
      
      if (map.getLayer(route.layerId)) {
        map.setPaintProperty(route.layerId, 'line-color', isActive ? '#ffc107' : color);
        map.setPaintProperty(route.layerId, 'line-width', isActive ? 4 : 3);
      }
    });
  }, [highlightedStepIndex, mapLoaded]);

  // Animate vehicle along active route using leafmap-style approach
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) {
      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.remove();
        vehicleMarkerRef.current = null;
      }
      return;
    }

    const map = mapRef.current;

    // If no highlighted step, remove vehicle
    if (highlightedStepIndex < 0 || sortedPlacesData.length === 0) {
      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.remove();
        vehicleMarkerRef.current = null;
      }
      return;
    }

    // Find the active route: route from current step to next step
    // The route should start at highlightedStepIndex and end at highlightedStepIndex + 1
    let activeRoute = routesRef.current.find(
      route => route.startIndex === highlightedStepIndex && route.endIndex === highlightedStepIndex + 1
    );
    
    // If no route found and we're at the last step, try to find route ending at current step
    // (meaning we're at the destination, so show the route that led here)
    if (!activeRoute && highlightedStepIndex === sortedPlacesData.length - 1 && highlightedStepIndex > 0) {
      activeRoute = routesRef.current.find(
        route => route.endIndex === highlightedStepIndex
      );
    }
    
    // If still no route found and we're at the first step, try to find the first route
    if (!activeRoute && highlightedStepIndex === 0 && sortedPlacesData.length > 1) {
      activeRoute = routesRef.current.find(
        route => route.startIndex === 0 && route.endIndex === 1
      );
    }
    
    if (!activeRoute || !activeRoute.coordinates || activeRoute.coordinates.length === 0) {
      // Clear route markers if no active route
      if (routeStartMarkerRef.current) {
        routeStartMarkerRef.current.remove();
        routeStartMarkerRef.current = null;
      }
      if (routeEndMarkerRef.current) {
        routeEndMarkerRef.current.remove();
        routeEndMarkerRef.current = null;
      }
      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.remove();
        vehicleMarkerRef.current = null;
      }
      return;
    }

    // Show start and end points of the active route
    const startPlace = sortedPlacesData[activeRoute.startIndex];
    const endPlace = sortedPlacesData[activeRoute.endIndex];
    
    // Get mode of travel for vehicle icon (from the destination place - where you're going)
    const mode = endPlace?.modeOfTravel || activeRoute.modeOfTravel;

    // Create/update start point marker (circular)
    if (startPlace && startPlace.coordinates && startPlace.coordinates.lat && startPlace.coordinates.lng) {
      if (!routeStartMarkerRef.current) {
        const startEl = document.createElement('div');
        startEl.className = 'route-start-marker';
        startEl.style.width = '12px';
        startEl.style.height = '12px';
        startEl.style.borderRadius = '50%';
        startEl.style.backgroundColor = '#22c55e';
        startEl.style.border = '2px solid white';
        startEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        startEl.style.zIndex = '9999';
        startEl.style.pointerEvents = 'none';

        routeStartMarkerRef.current = new maplibregl.Marker({
          element: startEl,
          anchor: 'center',
        })
          .setLngLat([startPlace.coordinates.lng, startPlace.coordinates.lat])
          .addTo(map);
      } else {
        routeStartMarkerRef.current.setLngLat([startPlace.coordinates.lng, startPlace.coordinates.lat]);
      }
    }

    // Create/update end point marker (circular)
    if (endPlace && endPlace.coordinates && endPlace.coordinates.lat && endPlace.coordinates.lng) {
      if (!routeEndMarkerRef.current) {
        const endEl = document.createElement('div');
        endEl.className = 'route-end-marker';
        endEl.style.width = '12px';
        endEl.style.height = '12px';
        endEl.style.borderRadius = '50%';
        endEl.style.backgroundColor = '#ef4444';
        endEl.style.border = '2px solid white';
        endEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        endEl.style.zIndex = '9999';
        endEl.style.pointerEvents = 'none';

        routeEndMarkerRef.current = new maplibregl.Marker({
          element: endEl,
          anchor: 'center',
        })
          .setLngLat([endPlace.coordinates.lng, endPlace.coordinates.lat])
          .addTo(map);
      } else {
        routeEndMarkerRef.current.setLngLat([endPlace.coordinates.lng, endPlace.coordinates.lat]);
      }
    }

    // Get starting position for the route
    if (!startPlace || !startPlace.coordinates || !startPlace.coordinates.lat || !startPlace.coordinates.lng) {
      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.remove();
        vehicleMarkerRef.current = null;
      }
      return;
    }

    // Calculate progress based on scroll position (0 = start, 1 = end)
    // scrollProgress is the progress between current step and next step
    const routeCoords = activeRoute.coordinates;
    // If at last step, vehicle should be at destination (progress = 1)
    const finalProgress = highlightedStepIndex === sortedPlacesData.length - 1 ? 1 : Math.max(0, Math.min(1, scrollProgress));
    const coordIndex = Math.floor(routeCoords.length * finalProgress);
    const [initialLng, initialLat] = routeCoords[Math.min(coordIndex, routeCoords.length - 1)];

    // Create or update vehicle marker (no circle, just icon)
    if (!vehicleMarkerRef.current) {
      const vehicleEl = document.createElement('div');
      vehicleEl.className = 'vehicle-marker';
      vehicleEl.style.fontSize = '20px';
      vehicleEl.style.zIndex = '10000';
      vehicleEl.style.pointerEvents = 'none';
      vehicleEl.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))';
      vehicleEl.innerHTML = getVehicleIcon(mode);

      vehicleMarkerRef.current = new maplibregl.Marker({
        element: vehicleEl,
        anchor: 'center',
      })
        .setLngLat([initialLng, initialLat])
        .addTo(map);
    } else {
      vehicleMarkerRef.current.setLngLat([initialLng, initialLat]);
    }

    // Update vehicle position based on scroll progress (no animation, direct update)
    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }

    // Update vehicle position directly based on scroll progress
    const updateVehiclePosition = () => {
      // If at last step, vehicle should be at destination (progress = 1)
      let progress: number;
      if (highlightedStepIndex === sortedPlacesData.length - 1) {
        // At the last step, vehicle is at destination
        progress = 1;
      } else if (highlightedStepIndex === 0 && scrollProgress === 0) {
        // At the first step with no scroll, vehicle is at start
        progress = 0;
      } else {
        // Normalize scroll progress between 0 and 1
        progress = Math.max(0, Math.min(1, scrollProgress));
      }
      
      const coordIndex = Math.floor(routeCoords.length * progress);
      const targetIndex = Math.min(Math.max(0, coordIndex), routeCoords.length - 1);
      const [lng, lat] = routeCoords[targetIndex];
      
      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.setLngLat([lng, lat]);
      }
    };

    updateVehiclePosition();
    
    // Also pan map to show the active route when highlighted step changes
    if (activeRoute && activeRoute.coordinates && activeRoute.coordinates.length > 0) {
      try {
        const bounds = activeRoute.coordinates.reduce((bounds: maplibregl.LngLatBounds, coord: [number, number]) => {
          return bounds.extend(coord);
        }, new maplibregl.LngLatBounds(activeRoute.coordinates[0], activeRoute.coordinates[0]));
        
        map.fitBounds(bounds, {
          padding: { top: 50, bottom: 50, left: 50, right: 50 },
          duration: 500,
          maxZoom: 12,
        });
      } catch (error) {
        console.warn('Failed to fit bounds for active route:', error);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
      // Clean up route markers
      if (routeStartMarkerRef.current) {
        routeStartMarkerRef.current.remove();
        routeStartMarkerRef.current = null;
      }
      if (routeEndMarkerRef.current) {
        routeEndMarkerRef.current.remove();
        routeEndMarkerRef.current = null;
      }
      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.remove();
        vehicleMarkerRef.current = null;
      }
    };
  }, [mapLoaded, highlightedStepIndex, sortedPlacesData, animationSpeed, scrollProgress]);

  // Optionally pan to highlighted step (without zoom) - commented out to prevent zoom changes
  // useEffect(() => {
  //   if (!mapRef.current || !mapLoaded || highlightedStepIndex < 0) return;
  //
  //   const place = sortedPlacesData[highlightedStepIndex];
  //   if (!place?.coordinates) return;
  //
  //   // Only pan, don't change zoom
  //   mapRef.current.panTo({
  //     lng: place.coordinates.lng,
  //     lat: place.coordinates.lat,
  //   });
  // }, [mapLoaded, highlightedStepIndex, sortedPlacesData]);

  return (
    <>
      {/* Hide MapLibre attribution with CSS */}
      <style jsx global>{`
        .maplibregl-ctrl-attrib {
          display: none !important;
        }
        .maplibregl-ctrl-bottom-right {
          display: none !important;
        }
      `}</style>
      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height,
          position: 'relative',
          background: '#000',
        }}
      />
    </>
  );
}
