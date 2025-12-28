'use client';

import { useAuth } from '@/lib/auth';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { updateTrip, deletePlace, deleteExpense, updatePlace } from '@/lib/api';
import type { TripExpense, ModeOfTravel } from '@tripmatrix/types';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import type { TripPlace } from '@tripmatrix/types';
import { useTripData } from '@/hooks/useTripData';
import { useTripPermissions } from '@/hooks/useTripPermissions';
import TripHeader from '@/components/trip/TripHeader';
import TripInfoCard from '@/components/trip/TripInfoCard';
import TripStepsList from '@/components/trip/TripStepsList';
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

export default function TripDetailPage() {
  const { user, loading: authLoading, getIdToken } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tripId = params.tripId as string;

  const {
    trip,
    routes,
    places,
    expenses,
    expenseSummary,
    creator,
    participants,
    loading,
    loadTripData,
    setPlaces,
    setExpenses,
  } = useTripData(tripId);

  const { canEdit, isUpcoming } = useTripPermissions(trip, user);

  const [token, setToken] = useState<string | null>(null);
  const [visibleStepIndex, setVisibleStepIndex] = useState<number>(0);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const stepsContainerRef = useRef<HTMLDivElement>(null);
  const stepCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Draggable state
  const [modalHeight, setModalHeight] = useState(50); // Start at 50vh
  const [isDragging, setIsDragging] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(50);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Initialize trip data loading
  useEffect(() => {
    if (tripId && !authLoading) {
      const initializeAndLoad = async () => {
        let authToken: string | null = null;
        if (user) {
          try {
            authToken = await getIdToken(false);
            if (!authToken) {
              authToken = await getIdToken(true);
            }
            if (authToken) {
              setToken(authToken);
            }
          } catch (error) {
            console.error('Failed to get auth token:', error);
          }
        }
        await loadTripData(authToken);
      };
      initializeAndLoad();
    }
  }, [tripId, user, authLoading, getIdToken, loadTripData]);

  // Subscribe to places updates
  useEffect(() => {
    if (!user || !tripId) return;

    let unsubscribe: (() => void) | undefined;
    try {
      const placesQuery = query(
        collection(db, 'tripPlaces'),
        where('tripId', '==', tripId)
      );
      unsubscribe = onSnapshot(placesQuery, (snapshot) => {
        const placesData = snapshot.docs.map((doc) => ({
          placeId: doc.id,
          ...doc.data(),
        })) as TripPlace[];
        setPlaces(placesData);
      });
    } catch (error) {
      console.error('Failed to subscribe to places updates:', error);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, tripId]);

  // Subscribe to expenses updates
  useEffect(() => {
    if (!tripId) return;

    let unsubscribe: (() => void) | undefined;
    try {
      const expensesQuery = query(
        collection(db, 'tripExpenses'),
        where('tripId', '==', tripId)
      );
      unsubscribe = onSnapshot(expensesQuery, (snapshot) => {
        const expensesData = snapshot.docs.map((doc) => ({
          expenseId: doc.id,
          ...doc.data(),
        })) as TripExpense[];
        console.log('Expenses updated:', expensesData.length, 'expenses');
        setExpenses(expensesData);
      });
    } catch (error) {
      console.error('Failed to subscribe to expenses updates:', error);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [tripId]);

  // Reload data when page becomes visible (user navigates back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && tripId && !loading) {
        console.log('Page visible, reloading trip data...');
        loadTripData(token);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [tripId, token, loading, loadTripData]);

  const handleEndTrip = async () => {
    if (!trip || !confirm('Are you sure you want to end this trip?')) return;

    try {
      const token = await getIdToken();
      await updateTrip(tripId, { status: 'completed' }, token);
      await loadTripData();
    } catch (error) {
      console.error('Failed to end trip:', error);
      alert('Failed to end trip');
    }
  };

  const handleTogglePublic = async () => {
    if (!trip) return;

    try {
      const token = await getIdToken();
      await updateTrip(tripId, { isPublic: !trip.isPublic }, token);
      await loadTripData();
    } catch (error) {
      console.error('Failed to update trip:', error);
      alert('Failed to update trip');
    }
  };

  const handleUpdateModeOfTravel = async (placeId: string, mode: ModeOfTravel | null) => {
    if (!token) {
      alert('Authentication token is missing. Please log in again.');
      return;
    }
    try {
      await updatePlace(placeId, { modeOfTravel: mode || undefined }, token);
      await loadTripData(); // Reload data to reflect changes
    } catch (error) {
      console.error('Failed to update mode of travel:', error);
      alert('Failed to update mode of travel');
    }
  };

  const handleDeletePlace = async (placeId: string) => {
    if (!token) {
      alert('Authentication token is missing. Please log in again.');
      return;
    }
    try {
      await deletePlace(placeId, token);
      await loadTripData(); // Reload data to reflect changes
    } catch (error: any) {
      console.error('Failed to delete place:', error);
      alert(`Failed to delete place: ${error.message || 'Unknown error'}`);
    }
  };

  const handleEditExpense = async (expense: TripExpense) => {
    router.push(`/trips/${tripId}/expenses/${expense.expenseId}/edit`);
  };

  const handleDeleteExpense = async (expense: TripExpense) => {
    if (!token) {
      alert('Authentication token is missing. Please log in again.');
      return;
    }
    try {
      await deleteExpense(expense.expenseId, token);
      await loadTripData(); // Reload data to reflect changes
    } catch (error: any) {
      console.error('Failed to delete expense:', error);
      alert(`Failed to delete expense: ${error.message || 'Unknown error'}`);
    }
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
      // Minimum is 50vh (can't drag steps below 50%), maximum is 80vh
      const newHeight = Math.max(50, Math.min(80, dragStartHeight.current + deltaVh));
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

  // Sort places chronologically for map display
  const sortedPlaces = [...places].sort((a, b) => {
    return new Date(a.visitedAt).getTime() - new Date(b.visitedAt).getTime();
  });

  // Set up intersection observer to track visible step cards
  useEffect(() => {
    if (sortedPlaces.length === 0) return;

    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new intersection observer using viewport as root
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the entry with the highest intersection ratio that's in the center of viewport
        let maxRatio = 0;
        let mostVisibleIndex = 0;
        let mostVisibleEntry: IntersectionObserverEntry | null = null;

        entries.forEach((entry) => {
          const stepIndex = parseInt(entry.target.getAttribute('data-step-index') || '0', 10);
          // Prefer entries that are more centered in the viewport
          const rect = entry.boundingClientRect;
          const viewportCenter = window.innerHeight / 2;
          const cardCenter = rect.top + rect.height / 2;
          const distanceFromCenter = Math.abs(cardCenter - viewportCenter);
          
          // Weight intersection ratio by proximity to center
          const centerWeight = 1 / (1 + distanceFromCenter / 100);
          const weightedRatio = entry.intersectionRatio * centerWeight;
          
          if (weightedRatio > maxRatio && entry.intersectionRatio > 0.2) {
            maxRatio = weightedRatio;
            mostVisibleIndex = stepIndex;
            mostVisibleEntry = entry;
          }
        });

        // Update visible step index
        if (mostVisibleEntry && maxRatio > 0) {
          setVisibleStepIndex(mostVisibleIndex);
          
          // Calculate scroll progress: how far through the current step we are
          const rect = mostVisibleEntry.boundingClientRect;
          const viewportHeight = window.innerHeight;
          const viewportCenter = viewportHeight / 2;
          const cardCenter = rect.top + rect.height / 2;
          
          // Progress: 0 when card center is at viewport top, 1 when at bottom
          // Normalize to 0-1 range
          const normalizedProgress = Math.max(0, Math.min(1, (cardCenter - viewportCenter + viewportHeight / 4) / (viewportHeight / 2)));
          setScrollProgress(normalizedProgress);
        }
      },
      {
        root: null, // Use viewport as root
        rootMargin: '-30% 0px -30% 0px', // Trigger when card is in center 40% of viewport
        threshold: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
      }
    );

    // Observe all step cards after a short delay to ensure DOM is ready
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

  // Update step card refs when places change
  useEffect(() => {
    if (stepsContainerRef.current) {
      const stepCards = stepsContainerRef.current.querySelectorAll('[data-step-index]');
      stepCardRefs.current = Array.from(stepCards) as HTMLDivElement[];
    }
  }, [sortedPlaces]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#424242] to-[#1a1a1a]">
        <div className="w-16 h-16 border-4 border-gray-600 border-t-[#1976d2] rounded-full animate-spin mb-4" />
        <p className="text-white text-sm font-medium animate-pulse">Loading your trip...</p>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#424242] to-[#1a1a1a] px-4">
        <MdMap className="text-6xl mb-4 text-gray-400" />
        <h2 className="text-lg font-semibold text-white mb-2">Trip not found</h2>
        <p className="text-gray-400 text-sm text-center mb-6">
          The trip you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <Link
          href="/profile"
          className="px-6 py-3 bg-[#1976d2] text-white rounded-xl font-medium hover:bg-[#1565c0] transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          Back to Trips
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-black flex flex-col">
      <TripHeader title={trip.title} canEdit={canEdit} tripId={tripId} />

      {/* Map Section - 30% height */}
      <div className="relative flex-shrink-0" style={{ height: '30vh' }}>
        <TripMapbox 
          places={places} 
          routes={routes}
          height="30vh"
          highlightedStepIndex={visibleStepIndex}
          sortedPlaces={sortedPlaces}
          autoPlay={false}
          animationSpeed={1.0}
          scrollProgress={scrollProgress}
        />
      </div>

      {/* Instagram-like Feed */}
      <main className="max-w-[600px] mx-auto pb-20 flex-1" ref={stepsContainerRef}>
        <TripInfoCard
          trip={trip}
          creator={creator}
          participants={participants}
          isUpcoming={isUpcoming}
          placesCount={places.length}
          className="mb-8"
        />

        <TripStepsList
          places={places}
          canEdit={canEdit}
          tripId={tripId}
          expenses={expenses}
          creator={creator || undefined}
          onDeletePlace={handleDeletePlace}
          onEditPlace={(place) => router.push(`/trips/${tripId}/steps/${place.placeId}/edit`)}
          isUpcoming={isUpcoming}
        />
      </main>

    </div>
  );
}
