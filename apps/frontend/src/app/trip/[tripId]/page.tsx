'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import type { Trip, TripRoute, TripPlace, TripExpense, User } from '@tripmatrix/types';
import TripHeader from '@/components/trip/TripHeader';
import TripInfoCard from '@/components/trip/TripInfoCard';
import TripStepsList from '@/components/trip/TripStepsList';
import { useTripPermissions } from '@/hooks/useTripPermissions';
import { MdMap } from 'react-icons/md';

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

  const loadTripData = async () => {
    try {
      // Get trip (public endpoint, no auth required)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/trips/${tripId}`);
      if (!response.ok) {
        throw new Error('Trip not found');
      }
      const result = await response.json();
      const tripData = result.data as Trip;

      if (!tripData.isPublic) {
        throw new Error('This trip is private');
      }

      setTrip(tripData);

      // Load creator info
      const creatorDoc = await getDoc(doc(db, 'users', tripData.creatorId));
      if (creatorDoc.exists()) {
        setCreator(creatorDoc.data() as User);
      }

      // Load participants
      if (tripData.participants && tripData.participants.length > 0) {
        const participantUids = tripData.participants
          .filter((p: any) => !p.isGuest && p.uid)
          .map((p: any) => p.uid);
        
        if (participantUids.length > 0) {
          const participantDocs = await Promise.all(
            participantUids.map((uid: string) => getDoc(doc(db, 'users', uid)))
          );
          const participantsData = participantDocs
            .filter(doc => doc.exists())
            .map(doc => doc.data() as User);
          setParticipants(participantsData);
        }
      }

      // Load routes (public endpoint)
      const routesResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/routes/${tripId}`
      );
      if (routesResponse.ok) {
        const routesResult = await routesResponse.json();
        setRoutes(routesResult.data || []);
      }

      // Subscribe to places (public read)
      const placesQuery = query(
        collection(db, 'tripPlaces'),
        where('tripId', '==', tripId)
      );
      const unsubscribePlaces = onSnapshot(placesQuery, (snapshot) => {
        const placesData = snapshot.docs.map((doc) => ({
          placeId: doc.id,
          ...doc.data(),
        })) as TripPlace[];
        setPlaces(placesData);
      });

      // Load expenses (public endpoint, but may be filtered)
      const expensesResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/expenses/trip/${tripId}`
      );
      if (expensesResponse.ok) {
        const expensesResult = await expensesResponse.json();
        setExpenses(expensesResult.data || []);
      }

      setLoading(false);
      return () => unsubscribePlaces();
    } catch (error) {
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
      </main>
    </div>
  );
}

