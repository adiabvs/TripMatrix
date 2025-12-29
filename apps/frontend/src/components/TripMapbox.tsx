'use client';

import { useMemo, useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { TripPlace, TripRoute, ModeOfTravel } from '@tripmatrix/types';
import { geoInterpolate } from 'd3-geo';
import { getModeIconSVG } from '@/lib/iconUtils';
// @ts-ignore - Turf types have export resolution issues
import * as turf from '@turf/turf';

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

// Vehicle speed constants (km/h) for normalization
const getVehicleSpeed = (mode: ModeOfTravel | null | undefined): number => {
  switch (mode) {
    case 'walk':
      return 5; // 5 km/h
    case 'bike':
      return 20; // 20 km/h
    case 'car':
      return 80; // 80 km/h
    case 'train':
      return 120; // 120 km/h
    case 'bus':
      return 60; // 60 km/h
    case 'flight':
      return 800; // 800 km/h
    default:
      return 50; // Default 50 km/h
  }
};

// Animation state machine
type AnimationState = 'IDLE' | 'STEP_TRANSITION' | 'FOLLOWING';

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
  const placeNameMarkersRef = useRef<maplibregl.Marker[]>([]);
  const polylinesRef = useRef<any[]>([]);
  const routesRef = useRef<any[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const targetVehiclePosRef = useRef<[number, number] | null>(null);
  const lastHighlightedStepRef = useRef<number>(-1);
  const lastScrollProgressRef = useRef<number>(-1);
  const [mapLoaded, setMapLoaded] = useState(false);
  const routeCoordinatesCache = useRef<Map<string, [number, number][]>>(new Map());
  const routeCreationAbortRef = useRef<AbortController | null>(null);
  const animationStateRef = useRef<AnimationState>('IDLE');
  const lastCameraUpdateRef = useRef<number>(0);
  const lastLogUpdateRef = useRef<number>(0);
  const routeDistancesRef = useRef<Map<number, number>>(new Map()); // Cache route distances (routeIndex -> distance in km)
  const lastPlacesDataRef = useRef<string>(''); // Track places data to detect actual changes
  const cumulativeDistancesRef = useRef<number[]>([]); // Cumulative distances for all steps
  const lineStringCacheRef = useRef<Map<number, turf.Feature<turf.LineString>>>(new Map()); // Cache Turf LineStrings
  const lastScrollYRef = useRef<number>(0); // Track scroll direction

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

    // Create a stable key from places data to detect actual changes
    const placesKey = sortedPlacesData.map(p => `${p.placeId}-${p.coordinates?.lat}-${p.coordinates?.lng}`).join('|');
    const placesChanged = lastPlacesDataRef.current !== placesKey;
    
    // Only proceed if places data actually changed or we have routes from props
    if (!placesChanged && routes.length === 0 && routesRef.current.length > 0) {
      console.log('⏭️ Skipping route creation - places data unchanged and routes already exist');
      return;
    }

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    
    // Clear existing place name markers
    placeNameMarkersRef.current.forEach(marker => marker.remove());
    placeNameMarkersRef.current = [];

    // Cancel any ongoing route creation
    if (routeCreationAbortRef.current) {
      console.log('🛑 Aborting previous route creation');
      routeCreationAbortRef.current.abort();
      routeCreationAbortRef.current = null;
    }

    // Clear existing routes only if places actually changed or we have routes from props
    const shouldCreateRoutes = routes.length === 0 && sortedPlacesData.length > 1;
    const isCreatingRoutes = routeCreationAbortRef.current !== null;
    
    // Only clear routes if:
    // 1. Places data changed AND we need to create new routes AND routes aren't currently being created
    // 2. OR we have routes from props to replace existing ones
    if ((placesChanged && shouldCreateRoutes && !isCreatingRoutes) || (routes.length > 0 && !isCreatingRoutes)) {
      console.log('🗑️ Clearing existing routes. Current count:', routesRef.current.length, 'isCreating:', isCreatingRoutes, 'placesChanged:', placesChanged);
      routesRef.current.forEach(route => {
        if (route.layerId && map.getLayer(route.layerId)) {
          map.removeLayer(route.layerId);
        }
        if (route.sourceId && map.getSource(route.sourceId)) {
          map.removeSource(route.sourceId);
        }
      });
      routesRef.current = [];
      console.log('🗑️ Routes cleared. routesRef.current.length:', routesRef.current.length);
    } else if (isCreatingRoutes) {
      console.log('⏸️ Skipping route clear - routes are currently being created');
    } else if (!placesChanged) {
      console.log('⏸️ Skipping route clear - places data unchanged');
    }
    
    // Update the places key tracker
    lastPlacesDataRef.current = placesKey;
    
    console.log('🗺️ Route creation starting:', {
      routesPropLength: routes.length,
      sortedPlacesCount: sortedPlacesData.length,
      willCreateRoutes: shouldCreateRoutes,
      existingRoutesCleared: shouldCreateRoutes || routes.length > 0
    });

    // Add routes FIRST (before markers) to ensure they're created
    console.log('🛣️ Route creation check:', {
      routesPropLength: routes.length,
      sortedPlacesCount: sortedPlacesData.length,
      willUseProps: routes.length > 0,
      willCreateRoutes: routes.length === 0 && sortedPlacesData.length > 1
    });
    
    if (routes.length > 0) {
      console.log('📦 Using routes from props');
      routes.forEach((route, routeIndex) => {
        if (!route.points || route.points.length < 2) {
          console.warn('⚠️ Route skipped - insufficient points:', routeIndex, route.points?.length);
          return;
        }

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

        // Ensure coordinates are in [lng, lat] format for MapLibre GL JS
        const validCoordinates = coordinates.map(coord => {
          if (Array.isArray(coord) && coord.length >= 2) {
            return [coord[0], coord[1]] as [number, number];
          }
          return null;
        }).filter(coord => coord !== null) as [number, number][];

        if (validCoordinates.length < 2) {
          console.warn(`⚠️ Not enough valid coordinates for route from props, skipping`);
          return;
        }

        // Create GeoJSON Feature following MapLibre GL JS documentation pattern
        // Reference: https://maplibre.org/maplibre-gl-js/docs/examples/animate-a-line/
        const geojsonFeature: GeoJSON.Feature<GeoJSON.LineString> = {
          type: 'Feature',
          properties: {
            modeOfTravel: route.modeOfTravel,
            startIndex: startIndex,
            endIndex: endIndex,
          },
          geometry: {
            type: 'LineString',
            coordinates: validCoordinates,
          },
        };

        // Add or update source using MapLibre GL JS API (following documentation pattern)
        if (map.getSource(sourceId)) {
          // Update existing source data using setData() method (as per MapLibre docs)
          const source = map.getSource(sourceId) as maplibregl.GeoJSONSource;
          source.setData(geojsonFeature);
          console.log(`🔄 Updated route source (from props): ${sourceId}`);
        } else {
          // Add new GeoJSON source following MapLibre GL JS documentation pattern
          map.addSource(sourceId, {
            type: 'geojson',
            data: geojsonFeature,
          });
          console.log(`➕ Added route source (from props): ${sourceId} with ${validCoordinates.length} coordinates`);
        }
        
        // Immediately add route to routesRef so it's available for animation
        const routeInfo = {
          sourceId,
          layerId,
          coordinates: validCoordinates,
          startIndex,
          endIndex,
          modeOfTravel: route.modeOfTravel,
        };
        
        // Check if route already exists to avoid duplicates
        const existingRouteIndex = routesRef.current.findIndex(
          r => r.startIndex === startIndex && r.endIndex === endIndex
        );
        
        if (existingRouteIndex >= 0) {
          // Update existing route
          routesRef.current[existingRouteIndex] = routeInfo;
          console.log(`🔄 Updated route from props in routesRef`);
        } else {
          // Add new route
          routesRef.current.push(routeInfo);
          console.log(`📝 Route from props added to routesRef. Total routes now: ${routesRef.current.length}`);
        }

        // Check if layer already exists and update it, otherwise add new layer
        const isScrolling = scrollProgress > 0;
        if (map.getLayer(layerId)) {
          // Update existing layer properties
          if (isActive) {
            // Active route - always visible, different styling based on scroll
            if (isScrolling) {
              map.setPaintProperty(layerId, 'line-color', '#ffc107');
              map.setPaintProperty(layerId, 'line-width', 10); // Thick when scrolling
              map.setPaintProperty(layerId, 'line-opacity', 1.0);
            } else {
              map.setPaintProperty(layerId, 'line-color', '#ffc107');
              map.setPaintProperty(layerId, 'line-width', 6); // Medium when at step
              map.setPaintProperty(layerId, 'line-opacity', 0.8);
            }
            map.setLayoutProperty(layerId, 'visibility', 'visible');
          } else {
            map.setPaintProperty(layerId, 'line-color', color);
            map.setPaintProperty(layerId, 'line-width', 3);
            map.setPaintProperty(layerId, 'line-opacity', isScrolling ? 0.4 : 0.6);
            map.setLayoutProperty(layerId, 'visibility', 'visible');
          }
        } else {
          // Initial layer creation using MapLibre GL JS - always visible
          console.log('🛣️ Creating route layer with MapLibre GL JS (from routes prop):', layerId, 'isActive:', isActive, 'isScrolling:', isScrolling);
          
          map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
              'visibility': 'visible', // Always visible
            },
            paint: {
              'line-color': isActive ? '#ffc107' : color,
              'line-width': isActive ? (isScrolling ? 10 : 6) : 3, // Thick when active scrolling, medium when at step
              'line-opacity': isActive ? (isScrolling ? 1.0 : 0.8) : (isScrolling ? 0.4 : 0.6),
            },
          });
          
          console.log(`✅ Route layer added to map (from props): ${layerId}`);
        }
        
        console.log('✅ Route fully created from props:', {
          layerId,
          startIndex,
          endIndex,
          coordinatesCount: validCoordinates.length,
          totalRoutes: routesRef.current.length,
          hasSource: !!map.getSource(sourceId),
          hasLayer: !!map.getLayer(layerId)
        });
      });
      
      console.log('📦 Finished adding routes from props. Total:', routesRef.current.length);
    } else {
      // Create routes between consecutive places
      console.log('🚀 About to call createRoutes() - routes.length:', routes.length, 'sortedPlacesData.length:', sortedPlacesData.length);
      const createRoutes = async () => {
        console.log('✅ createRoutes() function called!');
        try {
          // Create abort controller for this route creation
          const abortController = new AbortController();
          routeCreationAbortRef.current = abortController;

          const routesToCreate = sortedPlacesData.length - 1;
          console.log('🔄 Starting route creation loop for', routesToCreate, 'routes. Places:', sortedPlacesData.map(p => p.name || 'Unnamed'));
          
          if (routesToCreate <= 0) {
            console.warn('⚠️ No routes to create - need at least 2 places');
            return;
          }

          for (let i = 0; i < routesToCreate; i++) {
            // Check if operation was aborted
            if (abortController.signal.aborted) {
              console.warn('⚠️ Route creation aborted at index', i);
              return;
            }

            const current = sortedPlacesData[i];
            const next = sortedPlacesData[i + 1];

            console.log(`🔄 Processing route ${i}:`, {
              current: current?.name,
              next: next?.name,
              currentCoords: current?.coordinates,
              nextCoords: next?.coordinates
            });

            if (
              !current.coordinates ||
              !current.coordinates.lat ||
              !current.coordinates.lng ||
              !next.coordinates ||
              !next.coordinates.lat ||
              !next.coordinates.lng
            ) {
              console.warn(`⚠️ Skipping route ${i} - missing coordinates`, {
                current: current?.name,
                next: next?.name
              });
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
              console.log(`🌐 Fetching route from OSRM for route ${i}:`, current.name, '->', next.name);
              coordinates = await fetchRoadRoute(
                current.coordinates.lng,
                current.coordinates.lat,
                next.coordinates.lng,
                next.coordinates.lat
              );
              
              if (!coordinates || coordinates.length === 0) {
                console.warn(`⚠️ No coordinates returned from OSRM for route ${i}, using direct path`);
                // Fallback: create direct path
                coordinates = [
                  [current.coordinates.lng, current.coordinates.lat],
                  [next.coordinates.lng, next.coordinates.lat]
                ];
              }
              
              console.log(`✅ Got ${coordinates.length} coordinates for route ${i}`);
              
              // Check again after async operation
              if (abortController.signal.aborted) {
                console.warn('⚠️ Route creation aborted after fetch');
                return;
              }
              routeCoordinatesCache.current.set(cacheKey, coordinates);
            }
          }

          // Final check before adding to map
          if (abortController.signal.aborted) {
            console.warn('⚠️ Route creation aborted before adding to map');
            return;
          }
          
          if (!coordinates || coordinates.length < 2) {
            console.warn(`⚠️ Invalid coordinates for route ${i}, skipping`);
            continue;
          }

          // Ensure coordinates are in [lng, lat] format for MapLibre GL JS
          const validCoordinates = coordinates.map(coord => {
            if (Array.isArray(coord) && coord.length >= 2) {
              return [coord[0], coord[1]] as [number, number];
            }
            return null;
          }).filter(coord => coord !== null) as [number, number][];

          if (validCoordinates.length < 2) {
            console.warn(`⚠️ Not enough valid coordinates for route ${i}, skipping`);
            continue;
          }

          // Create GeoJSON Feature following MapLibre GL JS documentation pattern
          // https://maplibre.org/maplibre-gl-js/docs/examples/animate-a-line/
          const geojsonFeature: GeoJSON.Feature<GeoJSON.LineString> = {
            type: 'Feature',
            properties: {
              modeOfTravel: mode,
              startIndex: i,
              endIndex: i + 1,
            },
            geometry: {
              type: 'LineString',
              coordinates: validCoordinates,
            },
          };

          // Add or update source using MapLibre GL JS API (following documentation pattern)
          // Reference: https://maplibre.org/maplibre-gl-js/docs/examples/animate-a-line/
          if (map.getSource(sourceId)) {
            // Update existing source data using setData() method (as per MapLibre docs)
            const source = map.getSource(sourceId) as maplibregl.GeoJSONSource;
            source.setData(geojsonFeature);
            console.log(`🔄 Updated route source: ${sourceId} with ${validCoordinates.length} coordinates`);
          } else {
            // Add new GeoJSON source following MapLibre GL JS documentation pattern
            map.addSource(sourceId, {
              type: 'geojson',
              data: geojsonFeature,
            });
            console.log(`➕ Added route source: ${sourceId} with ${validCoordinates.length} coordinates`);
          }
          
          // Immediately add route to routesRef so it's available for animation
          // This ensures routes are available even if layer creation is delayed
          const routeInfo = {
            sourceId,
            layerId,
            coordinates: validCoordinates,
            startIndex: i,
            endIndex: i + 1,
            modeOfTravel: mode,
          };
          
          // Check if route already exists to avoid duplicates
          const existingRouteIndex = routesRef.current.findIndex(
            r => r.startIndex === i && r.endIndex === i + 1
          );
          
          if (existingRouteIndex >= 0) {
            // Update existing route
            routesRef.current[existingRouteIndex] = routeInfo;
            console.log(`🔄 Updated route ${i} in routesRef`);
          } else {
            // Add new route
            routesRef.current.push(routeInfo);
            console.log(`📝 Route ${i} added to routesRef. Total routes now: ${routesRef.current.length}`);
          }

          // Check if layer already exists and update it, otherwise add new layer
          const isScrolling = scrollProgress > 0;
          if (map.getLayer(layerId)) {
            // Update existing layer properties
            if (isActive) {
              // Active route - always visible, different styling based on scroll
              if (isScrolling) {
                map.setPaintProperty(layerId, 'line-color', '#ffc107');
                map.setPaintProperty(layerId, 'line-width', 10); // Thick when scrolling
                map.setPaintProperty(layerId, 'line-opacity', 1.0);
              } else {
                map.setPaintProperty(layerId, 'line-color', '#ffc107');
                map.setPaintProperty(layerId, 'line-width', 6); // Medium when at step
                map.setPaintProperty(layerId, 'line-opacity', 0.8);
              }
              map.setLayoutProperty(layerId, 'visibility', 'visible');
            } else {
              map.setPaintProperty(layerId, 'line-color', color);
              map.setPaintProperty(layerId, 'line-width', 3);
              map.setPaintProperty(layerId, 'line-opacity', isScrolling ? 0.4 : 0.6);
              map.setLayoutProperty(layerId, 'visibility', 'visible');
            }
          } else {
            // Initial layer creation - always visible
            console.log('🛣️ Creating route layer with MapLibre GL JS:', layerId, 'isActive:', isActive, 'isScrolling:', isScrolling);
            
            map.addLayer({
              id: layerId,
              type: 'line',
              source: sourceId,
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
                'visibility': 'visible', // Always visible
              },
              paint: {
                'line-color': isActive ? '#ffc107' : color,
                'line-width': isActive ? (isScrolling ? 10 : 6) : 3, // Thick when active scrolling, medium when at step
                'line-opacity': isActive ? (isScrolling ? 1.0 : 0.8) : (isScrolling ? 0.4 : 0.6),
              },
            });
            
            console.log(`✅ Route layer added to map: ${layerId}`);
          }
          
          console.log('✅ Route fully created:', {
            layerId,
            startIndex: i,
            endIndex: i + 1,
            coordinatesCount: validCoordinates.length,
            modeOfTravel: mode,
            totalRoutesNow: routesRef.current.length,
            hasSource: !!map.getSource(sourceId),
            hasLayer: !!map.getLayer(layerId)
          });
        }
        
          // Clear abort controller when done
          if (routeCreationAbortRef.current === abortController) {
            routeCreationAbortRef.current = null;
          }
          
          console.log('🛣️ All routes created successfully!', {
            totalRoutes: routesRef.current.length,
            routes: routesRef.current.map(r => `${r.startIndex}->${r.endIndex}`),
            routesRefLength: routesRef.current.length,
            allRouteDetails: routesRef.current.map(r => ({
              startIndex: r.startIndex,
              endIndex: r.endIndex,
              layerId: r.layerId,
              hasSource: !!map.getSource(r.sourceId),
              hasLayer: !!map.getLayer(r.layerId),
              coordinatesCount: r.coordinates?.length || 0
            }))
          });
        } catch (error) {
          console.error('❌ Error in route creation:', error);
          // Clear abort controller on error
          if (routeCreationAbortRef.current) {
            routeCreationAbortRef.current = null;
          }
        }
      };
      
      console.log('🎬 Calling createRoutes() now...');
      createRoutes().then(() => {
        console.log('✅ createRoutes() promise resolved. routesRef.current.length:', routesRef.current.length);
      }).catch((error) => {
        console.error('❌ createRoutes() promise rejected:', error);
      });
    }
  }, [mapLoaded, sortedPlacesData, routes]); // Removed scrollProgress - route creation shouldn't depend on scroll

  // Add place name labels to the map
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || sortedPlacesData.length === 0) return;

    const map = mapRef.current;

    // Clear existing place name markers
    placeNameMarkersRef.current.forEach(marker => marker.remove());
    placeNameMarkersRef.current = [];

    // Add place name labels
    sortedPlacesData.forEach((place, index) => {
      if (!place.coordinates || !place.coordinates.lat || !place.coordinates.lng) return;

      const isHighlighted = index === highlightedStepIndex;

      // Create place name label
      const labelEl = document.createElement('div');
      labelEl.className = 'place-name-label';
      labelEl.textContent = place.name || 'Place';
      labelEl.style.backgroundColor = isHighlighted ? 'rgba(255, 193, 7, 0.95)' : 'rgba(0, 0, 0, 0.85)';
      labelEl.style.color = isHighlighted ? '#000' : 'white';
      labelEl.style.padding = '4px 8px';
      labelEl.style.borderRadius = '4px';
      labelEl.style.fontSize = '11px';
      labelEl.style.fontWeight = '400'; // Regular weight, not bold
      labelEl.style.whiteSpace = 'nowrap';
      labelEl.style.pointerEvents = 'none';
      labelEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.4)';
      labelEl.style.border = isHighlighted ? '2px solid #ffc107' : '1px solid rgba(255,255,255,0.3)';
      labelEl.style.zIndex = '10001';
      labelEl.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      labelEl.style.letterSpacing = '0.2px';

      const labelMarker = new maplibregl.Marker({
        element: labelEl,
        anchor: 'bottom',
        offset: [0, -15], // Offset above the place marker
      })
        .setLngLat([place.coordinates.lng, place.coordinates.lat])
        .addTo(map);

      placeNameMarkersRef.current.push(labelMarker);
    });

    return () => {
      placeNameMarkersRef.current.forEach(marker => marker.remove());
      placeNameMarkersRef.current = [];
    };
  }, [mapLoaded, sortedPlacesData, highlightedStepIndex]);

  // Calculate and cache route distances and cumulative distances
  useEffect(() => {
    if (routesRef.current.length === 0 || !mapLoaded) return;

    // Reset cumulative distances
    cumulativeDistancesRef.current = [];
    let cumulative = 0;

    routesRef.current.forEach((route, index) => {
      if (!route.coordinates || route.coordinates.length < 2) {
        cumulativeDistancesRef.current.push(cumulative);
        return;
      }

      // Check cache first
      if (lineStringCacheRef.current.has(index)) {
        const lineString = lineStringCacheRef.current.get(index)!;
        const distance = turf.length(lineString, { units: 'kilometers' });
        routeDistancesRef.current.set(index, distance);
        cumulative += distance;
        cumulativeDistancesRef.current.push(cumulative);
      } else {
        // Create Turf LineString
        const lineString = turf.lineString(route.coordinates);
        lineStringCacheRef.current.set(index, lineString);
        
        // Calculate distance
        const distance = turf.length(lineString, { units: 'kilometers' });
        routeDistancesRef.current.set(index, distance);
        cumulative += distance;
        cumulativeDistancesRef.current.push(cumulative);
      }
    });
  }, [routesRef.current.length, mapLoaded]);

  // Update route colors and visibility when highlighted step or scroll progress changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const map = mapRef.current;
    const isScrolling = scrollProgress > 0; // Show route when any scrolling (even 0.01%)

    console.log('🗺️ Route Update:', {
      scrollProgress,
      isScrolling,
      highlightedStepIndex,
      routesCount: routesRef.current.length,
      routeDetails: routesRef.current.map(r => ({
        layerId: r.layerId,
        startIndex: r.startIndex,
        endIndex: r.endIndex,
        hasLayer: map.getLayer(r.layerId) ? true : false
      }))
    });

    // Update all route layers with correct active state and visibility
    routesRef.current.forEach((route) => {
      const isActive = route.startIndex === highlightedStepIndex;
      const color = getModeColor(route.modeOfTravel);
      
      if (!map.getLayer(route.layerId)) {
        console.warn('⚠️ Route layer not found:', route.layerId, 'startIndex:', route.startIndex, 'endIndex:', route.endIndex);
        return;
      }
      
      // Always show routes - never hide them
      // Active route (from current step to next step)
      if (isActive) {
        if (isScrolling) {
          // Show route prominently when scrolling - make it very thick and visible
          console.log('✅ Highlighting active route (scrolling):', route.layerId, 'at scrollProgress:', scrollProgress);
          map.setPaintProperty(route.layerId, 'line-color', '#ffc107'); // Yellow highlight
          map.setPaintProperty(route.layerId, 'line-width', 10); // Thick when scrolling
          map.setPaintProperty(route.layerId, 'line-opacity', 1.0);
        } else {
          // Show route but less prominent when at step
          console.log('✅ Showing active route (at step):', route.layerId);
          map.setPaintProperty(route.layerId, 'line-color', '#ffc107'); // Yellow highlight
          map.setPaintProperty(route.layerId, 'line-width', 6); // Medium thickness when at step
          map.setPaintProperty(route.layerId, 'line-opacity', 0.8);
        }
        map.setLayoutProperty(route.layerId, 'visibility', 'visible');
      } else {
        // Inactive routes - show with mode color but dimmed
        map.setPaintProperty(route.layerId, 'line-color', color);
        map.setPaintProperty(route.layerId, 'line-width', 3);
        map.setPaintProperty(route.layerId, 'line-opacity', isScrolling ? 0.4 : 0.6);
        map.setLayoutProperty(route.layerId, 'visibility', 'visible');
      }
    });
  }, [highlightedStepIndex, scrollProgress, mapLoaded]);

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
      // Don't remove markers - keep them visible even if route is being calculated
      // Only remove vehicle marker if no route
      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.remove();
        vehicleMarkerRef.current = null;
      }
      
      // Check if routes are still being created
      const isCreatingRoutes = routeCreationAbortRef.current !== null;
      
      if (routesRef.current.length === 0) {
        if (isCreatingRoutes) {
          console.log('⏳ Routes are being created, waiting... (step:', highlightedStepIndex, ')');
        } else {
          console.warn('⚠️ No routes available. Routes count:', routesRef.current.length, 'Step:', highlightedStepIndex, 'Places count:', sortedPlacesData.length);
        }
      } else {
        console.warn('⚠️ No active route found for step:', highlightedStepIndex, 'routes available:', routesRef.current.length, 'Available routes:', routesRef.current.map(r => `${r.startIndex}->${r.endIndex}`));
      }
      return;
    }

    // Show start and end points of the active route
    const startPlace = sortedPlacesData[activeRoute.startIndex];
    const endPlace = sortedPlacesData[activeRoute.endIndex];
    
    // Get mode of travel for vehicle icon (from the destination place - where you're going)
    // Use the next step's mode of travel, or the route's mode if not available
    const mode = endPlace?.modeOfTravel || activeRoute.modeOfTravel;
    
    // Update vehicle icon if mode changed
    if (vehicleMarkerRef.current) {
      const vehicleEl = vehicleMarkerRef.current.getElement();
      if (vehicleEl) {
        vehicleEl.innerHTML = getVehicleIcon(mode);
      }
    }

    // Create/update start point marker (circular) - always keep visible
    if (startPlace && startPlace.coordinates && startPlace.coordinates.lat && startPlace.coordinates.lng) {
      if (!routeStartMarkerRef.current) {
        const startEl = document.createElement('div');
        startEl.className = 'route-start-marker';
        startEl.style.width = '14px';
        startEl.style.height = '14px';
        startEl.style.borderRadius = '50%';
        startEl.style.backgroundColor = '#22c55e';
        startEl.style.border = '3px solid white';
        startEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.5)';
        startEl.style.zIndex = '9999';
        startEl.style.pointerEvents = 'none';

        routeStartMarkerRef.current = new maplibregl.Marker({
          element: startEl,
          anchor: 'center',
        })
          .setLngLat([startPlace.coordinates.lng, startPlace.coordinates.lat])
          .addTo(map);
      } else {
        // Always update position, don't remove
        routeStartMarkerRef.current.setLngLat([startPlace.coordinates.lng, startPlace.coordinates.lat]);
      }
    }

    // Create/update end point marker (circular) - always keep visible
    if (endPlace && endPlace.coordinates && endPlace.coordinates.lat && endPlace.coordinates.lng) {
      if (!routeEndMarkerRef.current) {
        const endEl = document.createElement('div');
        endEl.className = 'route-end-marker';
        endEl.style.width = '14px';
        endEl.style.height = '14px';
        endEl.style.borderRadius = '50%';
        endEl.style.backgroundColor = '#ef4444';
        endEl.style.border = '3px solid white';
        endEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.5)';
        endEl.style.zIndex = '9999';
        endEl.style.pointerEvents = 'none';

        routeEndMarkerRef.current = new maplibregl.Marker({
          element: endEl,
          anchor: 'center',
        })
          .setLngLat([endPlace.coordinates.lng, endPlace.coordinates.lat])
          .addTo(map);
      } else {
        // Always update position, don't remove
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

    // Get route index for distance lookup
    const routeIndex = routesRef.current.findIndex(
      r => r.startIndex === activeRoute.startIndex && r.endIndex === activeRoute.endIndex
    );

    // Get or create Turf LineString for this route
    let lineString: turf.Feature<turf.LineString>;
    if (lineStringCacheRef.current.has(routeIndex)) {
      lineString = lineStringCacheRef.current.get(routeIndex)!;
    } else {
      lineString = turf.lineString(activeRoute.coordinates);
      lineStringCacheRef.current.set(routeIndex, lineString);
    }

    // Calculate route distance (in km)
    const routeDistance = routeDistancesRef.current.get(routeIndex) || 
      turf.length(lineString, { units: 'kilometers' });
    
    // Normalize scroll progress to route distance
    // Target: 1% scroll = 1km movement (adjustable)
    const TARGET_DISTANCE_PER_SCROLL = 1; // km per 1% scroll
    const normalizedProgress = Math.max(0, Math.min(1, scrollProgress));
    
    // Calculate progress based on scroll position (0 = start, 1 = end)
    // If at last step, vehicle should be at destination (progress = 1)
    let finalProgress: number;
    if (highlightedStepIndex === sortedPlacesData.length - 1) {
      finalProgress = 1;
    } else {
      // Normalize scroll progress to actual route distance
      const targetDistance = normalizedProgress * routeDistance;
      const normalizedDistance = Math.min(routeDistance, targetDistance);
      finalProgress = routeDistance > 0 ? normalizedDistance / routeDistance : 0;
    }

    // Use Turf's along() for distance-based interpolation
    // Fix reverse direction: invert progress so vehicle moves forward as scrollProgress increases
    const reversedProgress = 1 - finalProgress; // Invert to fix reverse direction
    const targetDistanceAlongRoute = reversedProgress * routeDistance;
    const point = turf.along(lineString, targetDistanceAlongRoute, { units: 'kilometers' });
    const [initialLng, initialLat] = point.geometry.coordinates;

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
      // Update vehicle icon if mode changed
      const vehicleEl = vehicleMarkerRef.current.getElement();
      if (vehicleEl) {
        const currentIcon = vehicleEl.innerHTML;
        const newIcon = getVehicleIcon(mode);
        if (currentIcon !== newIcon) {
          vehicleEl.innerHTML = newIcon;
        }
      }
      // Don't set position here - let animation handle it
    }

    // Calculate target position based on scroll progress using Turf (distance-based)
    const calculateTargetPosition = (): [number, number] => {
      // Get route index for distance lookup
      const routeIdx = routesRef.current.findIndex(
        r => r.startIndex === activeRoute.startIndex && r.endIndex === activeRoute.endIndex
      );

      // Get or create Turf LineString
      let lineStr: turf.Feature<turf.LineString>;
      if (lineStringCacheRef.current.has(routeIdx)) {
        lineStr = lineStringCacheRef.current.get(routeIdx)!;
      } else {
        lineStr = turf.lineString(activeRoute.coordinates);
        lineStringCacheRef.current.set(routeIdx, lineStr);
      }

      // Get route distance
      const routeDist = routeDistancesRef.current.get(routeIdx) || 
        turf.length(lineStr, { units: 'kilometers' });

      // Calculate progress
      let progress: number;
      if (highlightedStepIndex === sortedPlacesData.length - 1) {
        progress = 1;
      } else if (highlightedStepIndex === 0 && scrollProgress === 0) {
        progress = 0;
      } else {
        // Normalize scroll progress to route distance
        // scrollProgress: 0 = at current step (start), 1 = at next step (end)
        const normalizedProgress = Math.max(0, Math.min(1, scrollProgress));
        const targetDistance = normalizedProgress * routeDist;
        const normalizedDistance = Math.min(routeDist, targetDistance);
        progress = routeDist > 0 ? normalizedDistance / routeDist : 0;
      }

      // Use Turf's along() for precise distance-based interpolation
      // Fix reverse direction: invert progress so vehicle moves forward as scrollProgress increases
      // When scrollProgress = 0, vehicle at start. When scrollProgress = 1, vehicle at end.
      // If vehicle moves backwards, use reversed distance
      const reversedProgress = 1 - progress; // Invert progress to fix reverse direction
      const targetDistanceAlongRoute = reversedProgress * routeDist;
      const point = turf.along(lineStr, targetDistanceAlongRoute, { units: 'kilometers' });
      return point.geometry.coordinates as [number, number];
    };

    // Update target position
    targetVehiclePosRef.current = calculateTargetPosition();

    // If vehicle doesn't exist yet, set directly
    if (!vehicleMarkerRef.current) {
      return;
    }

    // Check if step changed - trigger step transition state
    const stepChanged = lastHighlightedStepRef.current !== highlightedStepIndex;
    if (stepChanged) {
      animationStateRef.current = 'STEP_TRANSITION';
      // Cancel any pending camera animations
      if (map.isMoving()) {
        map.stop();
      }
    }

    // Update vehicle position directly based on scroll progress (smooth and responsive)
    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Get route distance and mode for speed normalization
    const routeIdx = routesRef.current.findIndex(
      r => r.startIndex === activeRoute.startIndex && r.endIndex === activeRoute.endIndex
    );
    const routeDist = routeDistancesRef.current.get(routeIdx) || 1; // Default 1km if not calculated
    const vehicleSpeed = getVehicleSpeed(mode); // km/h
    const baseRouteLength = 10; // Base route length for normalization (10km)
    
    // Normalize easing factor based on route length and vehicle speed
    // Longer routes or faster vehicles get higher easing factor for smoother movement
    const speedMultiplier = vehicleSpeed / 50; // Normalize to 50 km/h base
    const lengthMultiplier = Math.min(2, Math.max(0.5, baseRouteLength / routeDist));
    const baseEasingFactor = 0.25;
    const normalizedEasingFactor = baseEasingFactor * speedMultiplier * lengthMultiplier;

    // Smooth animation loop that moves vehicle and camera follows it
    const animateVehicle = () => {
      if (!vehicleMarkerRef.current || !targetVehiclePosRef.current || !map) {
        animationFrameRef.current = null;
        return;
      }

      // Don't animate camera during step transition
      if (animationStateRef.current === 'STEP_TRANSITION') {
        animationFrameRef.current = requestAnimationFrame(animateVehicle);
        return;
      }

      // Set state to FOLLOWING after step transition completes
      if (animationStateRef.current === 'IDLE') {
        animationStateRef.current = 'FOLLOWING';
      }

      const currentLngLat = vehicleMarkerRef.current.getLngLat();
      const [currentLng, currentLat] = [currentLngLat.lng, currentLngLat.lat];
      const [targetLng, targetLat] = targetVehiclePosRef.current;

      // Calculate distance
      const deltaLng = targetLng - currentLng;
      const deltaLat = targetLat - currentLat;
      const distance = Math.sqrt(deltaLng * deltaLng + deltaLat * deltaLat);

      // If very close, snap to target
      if (distance < 0.00001) {
        vehicleMarkerRef.current.setLngLat(targetVehiclePosRef.current);
        // Continue checking for new targets
        animationFrameRef.current = requestAnimationFrame(animateVehicle);
        return;
      }

      // Smooth interpolation with normalized easing
      const newLng = currentLng + deltaLng * normalizedEasingFactor;
      const newLat = currentLat + deltaLat * normalizedEasingFactor;
      const newPos: [number, number] = [newLng, newLat];

      // Update vehicle marker position
      vehicleMarkerRef.current.setLngLat(newPos);

      // Throttle camera updates (only update every 100-200ms, not every frame)
      const now = Date.now();
      const timeSinceLastUpdate = now - lastCameraUpdateRef.current;
      const CAMERA_UPDATE_INTERVAL = 150; // ms

      // Camera follows the vehicle smoothly (only if moving and enough time passed)
      // Note: Zoom changes are handled by a separate useEffect to avoid conflicts
      if (distance > 0.0001 && timeSinceLastUpdate >= CAMERA_UPDATE_INTERVAL && animationStateRef.current === 'FOLLOWING') {
        // Don't update camera if map is already animating (prevents conflicts)
        if (!map.isMoving() && scrollProgress > 0.05) {
          // Only follow vehicle when scrolling (not when at step)
          // Follow vehicle position while maintaining zoom (zoom is handled by separate effect)
          const bearing = Math.atan2(deltaLng, deltaLat) * (180 / Math.PI);
          map.easeTo({
            center: newPos,
            zoom: 15, // 100% zoom (maintained by separate effect)
            pitch: 60,
            bearing: bearing,
            duration: CAMERA_UPDATE_INTERVAL,
            easing: (t) => t,
          });
          
          lastCameraUpdateRef.current = now;
        }
      }

      // Log vehicle position and distances during scrolling (throttled to once per second)
      const LOG_UPDATE_INTERVAL = 1000; // 1 second
      const timeSinceLastLog = now - lastLogUpdateRef.current;
      if (timeSinceLastLog >= LOG_UPDATE_INTERVAL && activeRoute) {
        const currentPlace = sortedPlacesData[highlightedStepIndex];
        const nextPlace = sortedPlacesData[highlightedStepIndex + 1];
        
        if (currentPlace?.coordinates) {
          // Calculate distance from current step to vehicle position
          const distanceFromCurrent = calculateDistance(
            currentPlace.coordinates.lat,
            currentPlace.coordinates.lng,
            newLat,
            newLng
          );
          
          // Calculate distance to next step if it exists
          let distanceToNext = null;
          if (nextPlace?.coordinates) {
            distanceToNext = calculateDistance(
              newLat,
              newLng,
              nextPlace.coordinates.lat,
              nextPlace.coordinates.lng
            );
          }
          
          console.log('🚗 Vehicle Position:', {
            gps: { lat: newLat, lng: newLng },
            distanceFromCurrentStep: `${distanceFromCurrent.toFixed(2)} km`,
            distanceToNextStep: distanceToNext ? `${distanceToNext.toFixed(2)} km` : 'N/A',
            scrollProgress: `${(scrollProgress * 100).toFixed(1)}%`,
            stepIndex: highlightedStepIndex,
            stepName: currentPlace.name
          });
          
          lastLogUpdateRef.current = now;
        }
      }

      // Continue animation loop
      animationFrameRef.current = requestAnimationFrame(animateVehicle);
    };

    // Start animation loop
    animationFrameRef.current = requestAnimationFrame(animateVehicle);
    
    // Handle zoom to step location when step changes (with state machine coordination)
    if (stepChanged && activeRoute) {
      try {
        const currentPlace = sortedPlacesData[highlightedStepIndex];
        const nextPlace = sortedPlacesData[highlightedStepIndex + 1];
        
        // Log current step information
        if (currentPlace?.coordinates?.lat && currentPlace?.coordinates?.lng) {
          console.log('📍 Current Step:', {
            index: highlightedStepIndex,
            name: currentPlace.name,
            gps: {
              lat: currentPlace.coordinates.lat,
              lng: currentPlace.coordinates.lng
            },
            mode: currentPlace.modeOfTravel || 'walk'
          });
          
          // Calculate distance to next step if it exists
          if (nextPlace?.coordinates?.lat && nextPlace?.coordinates?.lng) {
            const distance = calculateDistance(
              currentPlace.coordinates.lat,
              currentPlace.coordinates.lng,
              nextPlace.coordinates.lat,
              nextPlace.coordinates.lng
            );
            console.log('➡️ Next Step:', {
              index: highlightedStepIndex + 1,
              name: nextPlace.name,
              gps: {
                lat: nextPlace.coordinates.lat,
                lng: nextPlace.coordinates.lng
              },
              distance: `${distance.toFixed(2)} km`,
              mode: nextPlace.modeOfTravel || 'walk'
            });
          } else {
            console.log('🏁 Last Step - No next step');
          }
        }
        
        // Cancel any pending animations before starting step transition
        if (map.isMoving()) {
          map.stop();
        }
        
        // Set transition state
        animationStateRef.current = 'STEP_TRANSITION';
        
        // When step changes, always zoom to 80% (zoom level 8) at current step location
        // If scrollProgress > 0, we'll transition to route view in the animation loop
        if (currentPlace?.coordinates?.lat && currentPlace?.coordinates?.lng) {
          if (scrollProgress === 0) {
            // Completely on step - zoom to 80% at step location
            map.flyTo({
              center: [currentPlace.coordinates.lng, currentPlace.coordinates.lat],
              zoom: 8, // 80% zoom level
              duration: 800,
              essential: true,
            }, () => {
              // Transition complete, allow following
              animationStateRef.current = 'FOLLOWING';
            });
          } else {
            // Moving towards next step - show route at 100% zoom with both places visible
            const nextPlace = sortedPlacesData[highlightedStepIndex + 1];
            if (nextPlace?.coordinates?.lat && nextPlace?.coordinates?.lng) {
              // Calculate bounding box to fit both places
              const lngs = [currentPlace.coordinates.lng, nextPlace.coordinates.lng];
              const lats = [currentPlace.coordinates.lat, nextPlace.coordinates.lat];
              
              const minLng = Math.min(...lngs);
              const maxLng = Math.max(...lngs);
              const minLat = Math.min(...lats);
              const maxLat = Math.max(...lats);
              
              // Add padding to the bounds
              const padding = 0.01; // ~1km padding
              
              map.fitBounds(
                [
                  [minLng - padding, minLat - padding],
                  [maxLng + padding, maxLat + padding]
                ],
                {
                  padding: { top: 50, bottom: 50, left: 50, right: 50 },
                  maxZoom: 15, // 100% zoom
                  duration: 800,
                }
              );
              
              // Transition complete, allow following
              setTimeout(() => {
                animationStateRef.current = 'FOLLOWING';
              }, 800);
            } else {
              // No next place, just zoom to current step
              map.flyTo({
                center: [currentPlace.coordinates.lng, currentPlace.coordinates.lat],
                zoom: 8, // 80% zoom level
                duration: 800,
                essential: true,
              }, () => {
                animationStateRef.current = 'FOLLOWING';
              });
            }
          }
        } else {
          animationStateRef.current = 'FOLLOWING';
        }
        
        // Update refs
        lastHighlightedStepRef.current = highlightedStepIndex;
        lastScrollProgressRef.current = scrollProgress;
      } catch (error) {
        console.warn('Failed to update map view:', error);
        animationStateRef.current = 'FOLLOWING';
      }
    } else {
      // Update scroll progress ref even if step didn't change
      lastScrollProgressRef.current = scrollProgress;
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

  // Separate effect to handle zoom changes based on scrollProgress
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    
    const map = mapRef.current;
    const lastScrollProgress = lastScrollProgressRef.current;
    const wasAtStep = lastScrollProgress === 0 || lastScrollProgress < 0.05;
    const isAtStep = scrollProgress === 0 || scrollProgress < 0.05;
    const transitionedToRoute = wasAtStep && scrollProgress > 0.05;
    const transitionedToStep = !wasAtStep && isAtStep;
    
    // Don't update if map is already animating (unless it's a transition)
    if (map.isMoving() && !transitionedToRoute && !transitionedToStep) {
      return;
    }
    
    // Update zoom based on scroll progress
    if (isAtStep || transitionedToStep) {
      // When completely on a step: zoom to 80% (zoom level 8) at current step location
      const currentPlace = sortedPlacesData[highlightedStepIndex];
      if (currentPlace?.coordinates?.lat && currentPlace?.coordinates?.lng) {
        console.log('🗺️ Map: Zooming to step view (80%) at', currentPlace.name);
        map.easeTo({
          center: [currentPlace.coordinates.lng, currentPlace.coordinates.lat],
          zoom: 8, // 80% zoom
          pitch: 0,
          bearing: 0,
          duration: transitionedToStep ? 500 : 300,
          easing: (t) => t,
        });
      }
    } else if (scrollProgress > 0.05 || transitionedToRoute) {
      // When moving towards next step: show route at 100% zoom (zoom level 15)
      // Fit both places in view using fitBounds
      const currentPlace = sortedPlacesData[highlightedStepIndex];
      const nextPlace = sortedPlacesData[highlightedStepIndex + 1];
      
      if (currentPlace?.coordinates && nextPlace?.coordinates) {
        console.log('🗺️ Map: Zooming to route view (100%) showing', currentPlace.name, 'to', nextPlace.name);
        
        // Calculate bounding box to fit both places
        const lngs = [currentPlace.coordinates.lng, nextPlace.coordinates.lng];
        const lats = [currentPlace.coordinates.lat, nextPlace.coordinates.lat];
        
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        
        // Add padding to the bounds (percentage of the range)
        const lngRange = maxLng - minLng;
        const latRange = maxLat - minLat;
        const paddingLng = Math.max(0.01, lngRange * 0.1); // 10% padding or minimum 0.01
        const paddingLat = Math.max(0.01, latRange * 0.1);
        
        // Use fitBounds to show both places at 100% zoom
        map.fitBounds(
          [
            [minLng - paddingLng, minLat - paddingLat],
            [maxLng + paddingLng, maxLat + paddingLat]
          ],
          {
            padding: { top: 50, bottom: 50, left: 50, right: 50 },
            maxZoom: 15, // 100% zoom
            duration: transitionedToRoute ? 500 : 300,
          }
        );
      }
    }
    
    // Update last scroll progress ref
    lastScrollProgressRef.current = scrollProgress;
  }, [mapLoaded, highlightedStepIndex, scrollProgress, sortedPlacesData]);

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
