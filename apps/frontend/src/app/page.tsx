'use client';

import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { getPublicTrips, getTripPlaces, getTripRoutes } from '@/lib/api';
import type { Trip, TripPlace, TripRoute } from '@tripmatrix/types';
import UserMenu from '@/components/UserMenu';
import CompactTripCard from '@/components/CompactTripCard';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { User } from '@tripmatrix/types';

// Dynamically import HomeMapView with SSR disabled since it uses Leaflet
const HomeMapView = dynamic(() => import('@/components/HomeMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="text-sm text-gray-600">Loading map...</div>
    </div>
  ),
});

export default function Home() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [allPlaces, setAllPlaces] = useState<TripPlace[]>([]);
  const [allRoutes, setAllRoutes] = useState<TripRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [creatorMap, setCreatorMap] = useState<Record<string, User>>({});
  
  // Draggable state
  const [modalHeight, setModalHeight] = useState(25); // Start at 25vh
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(25);

  useEffect(() => {
    loadPublicTrips();
  }, []);

  const loadPublicTrips = async () => {
    try {
      const publicTrips = await getPublicTrips();
      const sorted = publicTrips.sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
      });
      
      // Get start location for each trip from first place
      const tripsWithLocations = await Promise.all(
        sorted.map(async (trip) => {
          try {
            const places = await getTripPlaces(trip.tripId, null).catch(() => []);
            if (places.length > 0 && places[0].coordinates) {
              return {
                ...trip,
                startLocationCoords: places[0].coordinates,
              } as Trip & { startLocationCoords?: { lat: number; lng: number } };
            }
          } catch (error) {
            console.error(`Failed to load places for trip ${trip.tripId}:`, error);
          }
          return trip;
        })
      );
      
      setTrips(tripsWithLocations as Trip[]);

      // Load creator info for all trips
      const creatorIds = [...new Set(sorted.map(t => t.creatorId))];
      const creatorPromises = creatorIds.map(async (creatorId) => {
        try {
          const creatorDoc = await getDoc(doc(db, 'users', creatorId));
          if (creatorDoc.exists()) {
            return { uid: creatorId, user: creatorDoc.data() as User };
          }
        } catch (error) {
          console.error(`Failed to load creator ${creatorId}:`, error);
        }
        return null;
      });
      
      const creatorResults = await Promise.all(creatorPromises);
      const newCreatorMap: Record<string, User> = {};
      creatorResults.forEach(result => {
        if (result) {
          newCreatorMap[result.uid] = result.user;
        }
      });
      setCreatorMap(newCreatorMap);

      // Load places and routes for all trips
      const placesPromises = sorted.map(trip => 
        getTripPlaces(trip.tripId, null).catch(() => [])
      );
      const routesPromises = sorted.map(trip => 
        getTripRoutes(trip.tripId, null).catch(() => [])
      );

      const [placesResults, routesResults] = await Promise.all([
        Promise.all(placesPromises),
        Promise.all(routesPromises),
      ]);

      // Flatten all places and routes
      const flattenedPlaces = placesResults.flat();
      const flattenedRoutes = routesResults.flat();

      setAllPlaces(flattenedPlaces);
      setAllRoutes(flattenedRoutes);
    } catch (error) {
      console.error('Failed to load public trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTripPress = (tripId: string) => {
    window.location.href = `/trips/${tripId}`;
  };

  const handleTripMarkerClick = (trip: Trip) => {
    setSelectedTrip(trip);
  };

  // Draggable handlers
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    dragStartY.current = clientY;
    dragStartHeight.current = modalHeight;
  };

  useEffect(() => {
    const handleDragMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const deltaY = dragStartY.current - clientY; // Negative when dragging up
      const screenHeight = window.innerHeight;
      const deltaVh = (deltaY / screenHeight) * 100;
      const newHeight = Math.max(25, Math.min(80, dragStartHeight.current + deltaVh));
      setModalHeight(newHeight);
    };

    const handleDragEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.addEventListener('touchmove', handleDragMove, { passive: false });
      document.addEventListener('touchend', handleDragEnd);
      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
        document.removeEventListener('touchmove', handleDragMove);
        document.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [isDragging, modalHeight]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#424242]">
        <div className="text-sm text-white">Loading...</div>
      </div>
    );
  }

  const mapHeight = `${100 - modalHeight}vh`;
  const modalHeightVh = `${modalHeight}vh`;

  return (
    <div className="min-h-screen bg-[#424242] flex flex-col overflow-hidden">
      {/* Map Section */}
      <div className="relative" style={{ height: mapHeight }}>
        <HomeMapView 
          routes={allRoutes} 
          places={allPlaces}
          trips={trips}
          onTripMarkerClick={handleTripMarkerClick}
          height={mapHeight}
        />
        
        {/* Header Overlay */}
        <div className="absolute top-0 left-0 right-0 pt-3 px-3 pb-2 bg-black/30 z-10">
          <div className="flex justify-between items-center">
            <h1 className="text-[6px] font-semibold text-white leading-tight">
              Explore the world
            </h1>
            <div className="flex items-center gap-2">
              {user ? (
                <Link 
                  href="/trips/new" 
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#1976d2] text-white rounded-none text-[10px] font-semibold leading-tight h-6"
                >
                  <span className="text-[12px] leading-none">+</span>
                  <span>Create</span>
                </Link>
              ) : (
                <Link 
                  href="/auth" 
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#1976d2] text-white rounded-none text-[10px] font-semibold leading-tight h-6"
                >
                  <span>Sign In</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Trip Marker Popup */}
        {selectedTrip && (
          <div className="absolute top-12 left-0 right-0 flex justify-center z-20 px-4">
            <div className="bg-white rounded-lg p-2 shadow-lg max-w-xs">
              <h3 className="text-[11px] font-semibold text-black mb-0.5 leading-tight">{selectedTrip.title}</h3>
              <p className="text-[10px] text-gray-600 mb-1.5 leading-tight line-clamp-2">{selectedTrip.description || 'No description'}</p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleTripPress(selectedTrip.tripId)}
                  className="flex-1 bg-[#1976d2] text-white px-2 py-1 rounded text-[10px] font-medium leading-tight"
                >
                  View Trip
                </button>
                <button
                  onClick={() => setSelectedTrip(null)}
                  className="px-2 py-1 border border-gray-300 rounded text-[10px] font-medium leading-tight"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Trip Cards Section - Draggable Modal */}
      <div 
        className="absolute bottom-0 left-0 right-0 bg-[#424242] border-t border-gray-600 overflow-hidden flex flex-col"
        style={{ height: modalHeightVh }}
      >
        {/* Drag Handle */}
        <div 
          className="flex justify-center py-3 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <div className="w-10 h-1 bg-gray-500 rounded-full" />
        </div>

        {trips.length > 0 ? (
          <div className="overflow-x-auto pb-16 px-4 flex-1">
            <div className="flex gap-3" style={{ width: 'max-content' }}>
              {trips.map((trip) => (
                <CompactTripCard 
                  key={trip.tripId} 
                  trip={trip} 
                  onPress={() => handleTripPress(trip.tripId)}
                  creator={creatorMap[trip.creatorId]}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4 pb-16">
            <span className="text-4xl mb-2">🗺️</span>
            <p className="text-[11px] text-gray-300 font-semibold">No trips available</p>
          </div>
        )}

        {/* Bottom Navigation Menu */}
        <div className="absolute bottom-0 left-0 right-0 bg-[#424242] border-t border-gray-600 z-20">
          <div className="flex items-center justify-around px-2 py-2.5">
            <Link 
              href="/" 
              className="flex flex-col items-center gap-1 text-white active:opacity-70"
            >
              <span className="text-xl">🏠</span>
              <span className="text-[10px] font-medium">Discover</span>
            </Link>
            <Link 
              href="/trips" 
              className="flex flex-col items-center gap-1 text-white active:opacity-70"
            >
              <span className="text-xl">🗺️</span>
              <span className="text-[10px] font-medium">My Trips</span>
            </Link>
            {user ? (
              <div className="flex flex-col items-center gap-1">
                <UserMenu />
                <span className="text-[10px] font-medium text-white">Profile</span>
              </div>
            ) : (
              <Link 
                href="/auth" 
                className="flex flex-col items-center gap-1 text-white active:opacity-70"
              >
                <span className="text-xl">👤</span>
                <span className="text-[10px] font-medium">Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
