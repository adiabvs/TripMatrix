'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { Trip, TripRoute, TripPlace, TripExpense, User } from '@tripmatrix/types';
import TripHeader from '@/components/trip/TripHeader';
import TripInfoCard from '@/components/trip/TripInfoCard';
import TripStepsList from '@/components/trip/TripStepsList';
import { useTripPermissions } from '@/hooks/useTripPermissions';
import { useAuth } from '@/lib/auth';
import { MdMap, MdLogin, MdHome } from 'react-icons/md';
import { getTrip, getTripPlaces, getTripRoutes, getTripExpenses, getUser } from '@/lib/api';

// Dynamically import TripMapbox with SSR disabled
const TripMapbox = dynamic(() => import('@/components/TripMapbox'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <div className="text-sm text-white">Loading map...</div>
    </div>
  ),
});

export default function PublicTripViewPage() {
  const params = useParams();
  const tripId = params.tripId as string;
  const { user, loading: authLoading } = useAuth();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [creator, setCreator] = useState<User | null>(null);
  const [participants, setParticipants] = useState<User[]>([]);
  const [routes, setRoutes] = useState<TripRoute[]>([]);
  const [places, setPlaces] = useState<TripPlace[]>([]);
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleStepIndex, setVisibleStepIndex] = useState<number>(0);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const stepsContainerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (tripId) {
      loadTripData();
    }
  }, [tripId]);

  // Refresh data periodically (MongoDB doesn't have real-time subscriptions)
  useEffect(() => {
    if (!tripId) return;

    // Refresh data every 5 seconds when page is visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && !loading && trip) {
        loadTripData();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [tripId, loading, trip]);

  const loadTripData = async () => {
    try {
      // Get trip (public endpoint, no auth required)
      const tripData = await getTrip(tripId, null);
      
      if (!tripData.isPublic) {
        throw new Error('This trip is private');
      }

      setTrip(tripData);

      // Load creator info (public endpoint)
      try {
        const creatorData = await getUser(tripData.creatorId, null);
        setCreator(creatorData);
      } catch (error) {
        console.error('Failed to load creator:', error);
      }

      // Load participants (public endpoint)
      if (tripData.participants && tripData.participants.length > 0) {
        const participantUids = tripData.participants
          .filter((p: any) => !p.isGuest && p.uid)
          .map((p: any) => p.uid);
        
        if (participantUids.length > 0) {
          try {
            const participantsData = await Promise.all(
              participantUids.map(async (uid: string) => {
                try {
                  return await getUser(uid, null);
                } catch {
                  return null;
                }
              })
            );
            setParticipants(participantsData.filter((u): u is User => u !== null));
          } catch (error) {
            console.error('Failed to load participants:', error);
          }
        }
      }

      // Load routes (public endpoint)
      try {
        const routesData = await getTripRoutes(tripId, null);
        setRoutes(routesData);
      } catch (error) {
        console.error('Failed to load routes:', error);
      }

      // Load places (public endpoint - works for public trips)
      try {
        const placesData = await getTripPlaces(tripId, null);
        // Sort by visitedAt
        placesData.sort((a, b) => new Date(a.visitedAt).getTime() - new Date(b.visitedAt).getTime());
        setPlaces(placesData);
      } catch (error) {
        console.error('Failed to load places:', error);
      }

      // Load expenses (public endpoint, filtered by expenseVisibility setting)
      try {
        const expensesData = await getTripExpenses(tripId, null);
        // Filter expenses based on trip's expenseVisibility setting
        let visibleExpenses = expensesData;
        if (tripData.expenseVisibility === 'members') {
          // For public view, don't show expenses if visibility is 'members'
          visibleExpenses = [];
        } else if (tripData.expenseVisibility === 'creator') {
          // For public view, don't show expenses if visibility is 'creator'
          visibleExpenses = [];
        }
        // If expenseVisibility is 'everyone' or undefined, show all expenses
        setExpenses(visibleExpenses);
      } catch (error) {
        console.error('Failed to load expenses:', error);
      }

      setLoading(false);
    } catch (error: any) {
      console.error('Failed to load trip data:', error);
      setLoading(false);
    }
  };

  // Sort places chronologically for map display
  const sortedPlaces = [...places].sort((a, b) => {
    return new Date(a.visitedAt).getTime() - new Date(b.visitedAt).getTime();
  });

  // Set up intersection observer to track visible step cards (same as trip details)
  useEffect(() => {
    if (sortedPlaces.length === 0) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let mostVisibleIndex = 0;
        let mostVisibleEntry: IntersectionObserverEntry | null = null;

        for (const entry of entries) {
          const stepIndex = parseInt(entry.target.getAttribute('data-step-index') || '0', 10);
          const rect = entry.boundingClientRect;
          const viewportCenter = window.innerHeight / 2;
          const cardCenter = rect.top + rect.height / 2;
          const distanceFromCenter = Math.abs(cardCenter - viewportCenter);
          
          const centerWeight = 1 / (1 + distanceFromCenter / 100);
          const weightedRatio = entry.intersectionRatio * centerWeight;
          
          if (weightedRatio > maxRatio && entry.intersectionRatio > 0.2) {
            maxRatio = weightedRatio;
            mostVisibleIndex = stepIndex;
            mostVisibleEntry = entry;
          }
        }

        if (mostVisibleEntry !== null && maxRatio > 0) {
          setVisibleStepIndex(mostVisibleIndex);
          
          const entry: IntersectionObserverEntry = mostVisibleEntry;
          const rect = entry.boundingClientRect;
          const viewportHeight = window.innerHeight;
          const viewportCenter = viewportHeight / 2;
          const cardCenter = rect.top + rect.height / 2;
          
          const normalizedProgress = Math.max(0, Math.min(1, (cardCenter - viewportCenter + viewportHeight / 4) / (viewportHeight / 2)));
          setScrollProgress(normalizedProgress);
        }
      },
      {
        root: null,
        rootMargin: '-30% 0px -30% 0px',
        threshold: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
      }
    );

    const timeoutId = setTimeout(() => {
      const stepCards = document.querySelectorAll('[data-step-index]');
      stepCards.forEach((card) => {
        observerRef.current?.observe(card);
      });
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [sortedPlaces.length]);

  const { isUpcoming } = useTripPermissions(trip, null);
  const canShare = trip ? trip.isPublic : false;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#424242] to-[#1a1a1a]">
        <div className="w-16 h-16 border-4 border-gray-600 border-t-[#1976d2] rounded-full animate-spin mb-4" />
        <p className="text-white text-sm font-medium animate-pulse">Loading trip...</p>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#424242] to-[#1a1a1a] px-4">
        <MdMap className="text-6xl mb-4 text-gray-400" />
        <h2 className="text-lg font-semibold text-white mb-2">Trip not found</h2>
        <p className="text-gray-400 text-sm text-center mb-6">
          The trip you&apos;re looking for doesn&apos;t exist or is private.
        </p>
        <Link
          href="/trips/public"
          className="px-6 py-3 bg-[#1976d2] text-white rounded-xl font-medium hover:bg-[#1565c0] transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          Back to Public Trips
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-black flex flex-col">
      <TripHeader title={trip.title} canEdit={false} tripId={tripId} />

      {/* Map Section - 25% height */}
      <div className="relative flex-shrink-0" style={{ height: '25vh' }}>
        <TripMapbox 
          places={places} 
          routes={routes}
          height="25vh"
          highlightedStepIndex={visibleStepIndex}
          sortedPlaces={sortedPlaces}
          autoPlay={false}
          animationSpeed={1.0}
          scrollProgress={scrollProgress}
        />
      </div>

      {/* Instagram-like Feed */}
      <main className="w-full md:max-w-[600px] md:mx-auto pb-20 flex-1" ref={stepsContainerRef}>
        <TripInfoCard
          trip={trip}
          creator={creator}
          participants={participants}
          isUpcoming={isUpcoming}
          placesCount={places.length}
          canShare={canShare}
          className="mb-8"
        />

        <TripStepsList
          places={places}
          canEdit={false}
          tripId={tripId}
          expenses={expenses}
          creator={creator || undefined}
          onDeletePlace={async () => {}}
          onEditPlace={() => {}}
          isUpcoming={isUpcoming}
          trip={trip}
        />

        {/* Login Prompt for Non-Logged-In Users - Shown at the end */}
        {!authLoading && !user && (
          <div className="mt-8 mx-4 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <MdLogin className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold text-sm mb-1">Join TripMatrix</h3>
                <p className="text-gray-300 text-xs mb-3">
                  Sign in to create your own trips, share experiences, and connect with travelers around the world.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Link
                    href="/auth"
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-[#1976d2] text-white rounded-lg text-sm font-medium hover:bg-[#1565c0] active:scale-95 transition-all"
                  >
                    <MdLogin className="w-4 h-4" />
                    <span>Sign In</span>
                  </Link>
                  <Link
                    href="/"
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 active:scale-95 transition-all border border-gray-700"
                  >
                    <MdHome className="w-4 h-4" />
                    <span>Explore More</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

