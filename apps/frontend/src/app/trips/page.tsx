'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { getUserTrips, getTripPlaces, getTripRoutes } from '@/lib/api';
import type { Trip, TripPlace, TripRoute } from '@tripmatrix/types';
import CompactTripCard from '@/components/CompactTripCard';
import UserMenu from '@/components/UserMenu';

// Dynamically import HomeMapView with SSR disabled
const HomeMapView = dynamic(() => import('@/components/HomeMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="text-sm text-gray-600">Loading map...</div>
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#424242]">
        <div className="text-sm text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#424242] flex flex-col items-center justify-center px-4">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-xl font-semibold text-white mb-2">Sign in required</h2>
        <p className="text-sm text-gray-300 mb-6 text-center">
          Please sign in to view and manage your trips
        </p>
        <Link
          href="/auth"
          className="flex items-center gap-2 px-6 py-3 bg-[#1976d2] text-white rounded-none text-sm font-semibold"
        >
          <span>Sign In</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#424242] flex flex-col">
      {/* Map Section - Full height */}
      <div className="relative flex-1" style={{ height: '100vh' }}>
        <HomeMapView 
          routes={allRoutes} 
          places={allPlaces}
          trips={[]}
          height="100vh"
        />
        
        {/* Header Overlay */}
        <div className="absolute top-0 left-0 right-0 pt-3 px-3 pb-2 bg-black/30 z-10">
          <div className="flex justify-between items-center">
            <h1 className="text-[9px] font-semibold text-white leading-tight">
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

      {/* Trip Cards Modal - Dark Grey Bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-[#424242] border-t border-gray-600" style={{ height: '25vh', minHeight: '200px' }}>
        {/* Drag Handle */}
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 bg-gray-500 rounded-full" />
        </div>

        {trips.length > 0 ? (
          <div className="overflow-x-auto pb-4 px-4 h-full">
            <div className="flex gap-3" style={{ width: 'max-content' }}>
              {trips.map((trip) => (
                <CompactTripCard 
                  key={trip.tripId} 
                  trip={trip} 
                  onPress={() => handleTripPress(trip.tripId)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full px-4">
            <span className="text-4xl mb-3">🗺️</span>
            <p className="text-[11px] text-gray-300 font-semibold mb-4">No trips yet</p>
            <p className="text-[10px] text-gray-400 text-center mb-6">
              Start your first adventure and create beautiful travel stories
            </p>
            <Link
              href="/trips/new"
              className="flex items-center gap-2 px-6 py-3 bg-[#1976d2] text-white rounded-none text-sm font-semibold"
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
