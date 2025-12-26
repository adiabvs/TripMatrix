'use client';

import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { getPublicTripsWithData } from '@/lib/api';
import type { Trip, TripPlace, TripRoute } from '@tripmatrix/types';
import CompactTripCard from '@/components/CompactTripCard';
import type { User } from '@tripmatrix/types';

// Dynamically import heavy components to reduce initial bundle size
const SimpleGlobe = dynamic(() => import('@/components/SimpleGlobe'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="text-sm text-gray-600">Loading globe...</div>
    </div>
  ),
});

// Dynamically import UserMenu since it uses Material-UI (heavy)
const UserMenu = dynamic(() => import('@/components/UserMenu'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center gap-1">
      <div className="w-6 h-6 rounded-full bg-gray-400 animate-pulse" />
      <span className="text-[10px] font-medium text-white">Profile</span>
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
  const [modalHeight, setModalHeight] = useState(60); // Start at 60vh
  const [isDragging, setIsDragging] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(60);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Load data after initial render to improve perceived performance
    const timer = setTimeout(() => {
      loadPublicTrips();
    }, 0);
    
    return () => clearTimeout(timer);
  }, []);

  const loadPublicTrips = async () => {
    try {
      // Use optimized endpoint that returns trips with places, routes, and creators in one call
      const { trips, placesByTrip, routesByTrip, creators } = await getPublicTripsWithData(50);
      
      // Add start location coordinates to trips from first place
      const tripsWithLocations = trips.map((trip) => {
        const places = placesByTrip[trip.tripId] || [];
        if (places.length > 0 && places[0].coordinates) {
          return {
            ...trip,
            startLocationCoords: places[0].coordinates,
          } as Trip & { startLocationCoords?: { lat: number; lng: number } };
        }
        return trip;
      });
      
      setTrips(tripsWithLocations as Trip[]);
      setCreatorMap(creators);

      // Flatten all places and routes for the map
      const flattenedPlaces = Object.values(placesByTrip).flat();
      const flattenedRoutes = Object.values(routesByTrip).flat();

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

  // Long press handler
  const handleLongPressStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Only preventDefault for mouse events (touch events are passive)
    if (!('touches' in e)) {
      e.preventDefault();
    }
    
    // Store the initial touch position
    const initialClientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    // Start long press timer
    longPressTimer.current = setTimeout(() => {
      setIsLongPressing(true);
      setIsDragging(true);
      dragStartY.current = initialClientY;
      dragStartHeight.current = modalHeight;
    }, 300); // 300ms for long press
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!isDragging) {
      setIsLongPressing(false);
    }
  };

  // Draggable handlers
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Only preventDefault for mouse events (touch events are passive)
    if (!('touches' in e)) {
      e.preventDefault();
    }
    // For mouse, start dragging immediately
    if (!('touches' in e)) {
      setIsDragging(true);
      const clientY = (e as React.MouseEvent).clientY;
      dragStartY.current = clientY;
      dragStartHeight.current = modalHeight;
    }
  };

  useEffect(() => {
    const handleDragMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      
      // Prevent default for touch events to prevent scrolling
      if ('touches' in e) {
        e.preventDefault();
      }
      
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const deltaY = dragStartY.current - clientY; // Negative when dragging up
      const screenHeight = window.innerHeight;
      const deltaVh = (deltaY / screenHeight) * 100;
      const newHeight = Math.max(25, Math.min(80, dragStartHeight.current + deltaVh));
      setModalHeight(newHeight);
    };

    const handleDragEnd = () => {
      setIsDragging(false);
      setIsLongPressing(false);
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

  // Cleanup long press timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

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
    <div className="min-h-screen bg-[#424242] flex flex-col" style={{ overflow: 'hidden' }}>
      {/* Globe Section */}
      <div className="relative" style={{ height: mapHeight }}>
        <SimpleGlobe 
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
        className="absolute bottom-0 left-0 right-0 bg-[#424242] border-t border-gray-600 flex flex-col"
        style={{ height: modalHeightVh, overflow: 'hidden' }}
      >
        {/* Drag Handle */}
        <div 
          className="flex justify-center py-3 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleDragStart}
          onTouchStart={handleLongPressStart}
          onTouchEnd={handleLongPressEnd}
          onTouchCancel={handleLongPressEnd}
          onMouseUp={handleLongPressEnd}
          onMouseLeave={handleLongPressEnd}
        >
          <div 
            className={`w-10 h-1 rounded-full transition-colors duration-200 ${
              isLongPressing ? 'bg-green-500' : 'bg-gray-500'
            }`} 
          />
        </div>

        {trips.length > 0 ? (
          <div 
            className="overflow-y-auto overflow-x-hidden flex-1"
            style={{
              WebkitOverflowScrolling: 'touch',
              scrollBehavior: 'smooth',
              paddingBottom: '64px',
              paddingLeft: '16px',
              paddingRight: '16px'
            }}
          >
            <div 
              className="grid grid-cols-1 gap-3"
              style={{ width: '100%' }}
            >
              {trips.map((trip, index) => (
                <div key={trip.tripId} className={index === trips.length - 1 ? 'mb-4' : ''}>
                  <CompactTripCard 
                    trip={trip} 
                    onPress={() => handleTripPress(trip.tripId)}
                    creator={creatorMap[trip.creatorId]}
                  />
                </div>
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
