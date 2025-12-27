'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { getUserTrips, getTripPlaces, getTripRoutes } from '@/lib/api';
import type { Trip, TripPlace, TripRoute } from '@tripmatrix/types';
import CompactTripCard from '@/components/CompactTripCard';
import UserMenu from '@/components/UserMenu';
import { MdMap, MdHome } from 'react-icons/md';

// Dynamically import SimpleGlobe with SSR disabled
const SimpleGlobe = dynamic(() => import('@/components/SimpleGlobe'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="text-sm text-gray-600">Loading globe...</div>
    </div>
  ),
});

export default function TripsPage() {
  const { user, loading: authLoading, getIdToken } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [allPlaces, setAllPlaces] = useState<TripPlace[]>([]);
  const [allRoutes, setAllRoutes] = useState<TripRoute[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Draggable state
  const [modalHeight, setModalHeight] = useState(60); // Start at 60vh
  const [isDragging, setIsDragging] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(60);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadTrips();
    }
  }, [user]);

  const loadTrips = async () => {
    try {
      const token = await getIdToken();
      const userTrips = await getUserTrips(token);
      
      // Sort by date descending (newest first)
      const sorted = userTrips.sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
      });
      
      setTrips(sorted);

      // Load places and routes for all trips
      const placesPromises = sorted.map(trip => 
        getTripPlaces(trip.tripId, token).catch(() => [])
      );
      const routesPromises = sorted.map(trip => 
        getTripRoutes(trip.tripId, token).catch(() => [])
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
      console.error('Failed to load trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTripPress = (tripId: string) => {
    window.location.href = `/trips/${tripId}`;
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#424242] to-[#1a1a1a]">
        <div className="w-16 h-16 border-4 border-gray-600 border-t-[#1976d2] rounded-full animate-spin mb-4" />
        <p className="text-white text-sm font-medium animate-pulse">Loading your trips...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#424242] to-[#1a1a1a] flex flex-col items-center justify-center px-4">
        <div className="text-6xl mb-4 animate-bounce">🔒</div>
        <h2 className="text-lg font-semibold text-white mb-2">Sign in required</h2>
        <p className="text-sm text-gray-300 mb-8 text-center max-w-sm">
          Please sign in to view and manage your trips
        </p>
        <Link
          href="/auth"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#1976d2] text-white rounded-xl text-sm font-semibold shadow-lg hover:bg-[#1565c0] transition-all duration-200 hover:shadow-xl active:scale-95"
        >
          <span>Sign In</span>
        </Link>
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
          trips={[]}
          height={mapHeight}
        />
        
        {/* Header Overlay */}
        <div className="absolute top-0 left-0 right-0 pt-3 px-3 pb-2 bg-black/30 z-10">
          <div className="flex justify-between items-center">
            <h1 className="text-[8px] font-semibold text-white leading-tight">
              My Trips
            </h1>
            <Link 
              href="/trips/new" 
              className="w-8 h-8 bg-[#1976d2] text-white rounded-none flex items-center justify-center"
            >
              <span className="text-lg leading-none">+</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Trip Cards Modal - Draggable */}
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
              className="grid grid-cols-1 gap-5"
              style={{ width: '100%' }}
            >
              {trips.map((trip, index) => (
                <div key={trip.tripId} className={index === trips.length - 1 ? 'mb-6' : ''}>
                  <CompactTripCard 
                    trip={trip} 
                    onPress={() => handleTripPress(trip.tripId)}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4 pb-20 flex-1">
            <MdMap className="text-6xl mb-4 animate-bounce text-gray-400" />
            <p className="text-base text-white font-semibold mb-2">No trips yet</p>
            <p className="text-sm text-gray-400 text-center mb-8 max-w-xs">
              Start your first adventure and create beautiful travel stories
            </p>
            <Link
              href="/trips/new"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#1976d2] text-white rounded-xl text-sm font-semibold shadow-lg hover:bg-[#1565c0] transition-all duration-200 hover:shadow-xl active:scale-95"
            >
              <span className="text-lg">+</span>
              <span>Create Your First Trip</span>
            </Link>
          </div>
        )}

        {/* Bottom Navigation Menu */}
        <div className="absolute bottom-0 left-0 right-0 bg-[#424242] border-t border-gray-600 z-20">
          <div className="flex items-center justify-around px-2 py-2.5">
            <Link 
              href="/" 
              className="flex flex-col items-center gap-1 text-white active:opacity-70"
            >
              <MdHome className="text-xl" />
              <span className="text-[10px] font-medium">Discover</span>
            </Link>
            <Link 
              href="/trips" 
              className="flex flex-col items-center gap-1 text-white active:opacity-70"
            >
              <MdMap className="text-xl" />
              <span className="text-[10px] font-medium">My Trips</span>
            </Link>
            <div className="flex flex-col items-center gap-1">
              <UserMenu />
              <span className="text-[10px] font-medium text-white">Profile</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
