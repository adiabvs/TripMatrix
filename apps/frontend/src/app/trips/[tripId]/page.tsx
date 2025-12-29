'use client';

import { useAuth } from '@/lib/auth';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { updateTrip, deletePlace, deleteExpense, updatePlace, getTripCommentCount } from '@/lib/api';
import type { TripExpense, ModeOfTravel } from '@tripmatrix/types';
import type { TripPlace } from '@tripmatrix/types';
import { MdStop } from 'react-icons/md';
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

  const { canEdit, isUpcoming, isCreator, isParticipant } = useTripPermissions(trip, user);
  
  // User can share if trip is public OR user is creator/participant
  // If trip is public, anyone viewing can share (even if not logged in)
  const canShare = trip ? (trip.isPublic || isCreator || isParticipant) : false;

  const [token, setToken] = useState<string | null>(null);
  const [visibleStepIndex, setVisibleStepIndex] = useState<number>(0);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [commentCount, setCommentCount] = useState<number>(0);
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

  // Refresh places and expenses periodically (MongoDB doesn't have real-time subscriptions)
  useEffect(() => {
    if (!tripId) return;

    // Refresh data every 5 seconds when page is visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && !loading) {
        loadTripData(token);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [tripId, token, loading, loadTripData]);

  // Reload data when page becomes visible (user navigates back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && tripId && !loading) {
        loadTripData(token);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [tripId, token, loading, loadTripData]);

  const handleEndTrip = async () => {
    if (!trip || !confirm('Are you sure you want to end this trip? This will mark it as completed.')) return;

    try {
      const authToken = token || await getIdToken();
      await updateTrip(tripId, { status: 'completed', endTime: new Date().toISOString() }, authToken);
      await loadTripData(authToken);
      alert('Trip ended successfully!');
    } catch (error: any) {
      console.error('Failed to end trip:', error);
      alert(`Failed to end trip: ${error.message || 'Unknown error'}`);
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

  // Set up scroll-based tracking for step cards (fixed to use scroll position, not viewport)
  useEffect(() => {
    if (sortedPlaces.length === 0 || !stepsContainerRef.current) return;

    const container = stepsContainerRef.current;
    const stepCards = Array.from(container.querySelectorAll('[data-step-index]')) as HTMLElement[];
    
    if (stepCards.length === 0) return;

    // Helper function to calculate distance between two coordinates (Haversine formula)
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

    // Track scroll direction
    let lastScrollY = window.scrollY;
    const scrollDirectionRef = { current: 0 }; // 1 = down, -1 = up, 0 = none
    let lastLogTime = 0;
    const LOG_THROTTLE_MS = 200; // Log every 200ms to avoid spam (reduced for better visibility)

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      scrollDirectionRef.current = currentScrollY > lastScrollY ? 1 : currentScrollY < lastScrollY ? -1 : 0;
      lastScrollY = currentScrollY;

      // Find the step card that's currently most visible/centered
      let mostVisibleIndex = 0;
      let minDistanceFromCenter = Infinity;

      stepCards.forEach((card) => {
        const stepIndex = parseInt(card.getAttribute('data-step-index') || '0', 10);
        const rect = card.getBoundingClientRect();
        const viewportCenter = window.innerHeight / 2;
        const cardCenter = rect.top + rect.height / 2;
        const distanceFromCenter = Math.abs(cardCenter - viewportCenter);

        // Card is visible and closer to center
        if (rect.top < window.innerHeight && rect.bottom > 0 && distanceFromCenter < minDistanceFromCenter) {
          minDistanceFromCenter = distanceFromCenter;
          mostVisibleIndex = stepIndex;
        }
      });

      setVisibleStepIndex(mostVisibleIndex);

      // Calculate scroll progress based on scroll position relative to card position
      const activeCard = stepCards.find(card => 
        parseInt(card.getAttribute('data-step-index') || '0', 10) === mostVisibleIndex
      );

      if (activeCard) {
        const cardRect = activeCard.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportCenter = viewportHeight / 2;
        const cardCenter = cardRect.top + cardRect.height / 2;
        
        // Calculate progress based on how much the card has scrolled past the center
        // Progress: 0 when card center is at viewport center, 1 when card bottom is at viewport bottom
        // This works for both forward and reverse scrolling
        let normalizedProgress = 0;
        if (cardCenter > viewportCenter) {
          // Card is below center - calculate progress towards next step
          const distanceFromCenter = cardCenter - viewportCenter;
          const availableDistance = viewportHeight - viewportCenter; // Distance from center to bottom
          
          // Normalize progress: use 70% of available distance for smoother animation
          normalizedProgress = Math.max(0, Math.min(1, distanceFromCenter / (availableDistance * 0.7)));
          setScrollProgress(normalizedProgress);
        } else if (cardCenter < viewportCenter && scrollDirectionRef.current === -1) {
          // Scrolling up and card is above center - reverse progress
          const distanceFromCenter = viewportCenter - cardCenter;
          const availableDistance = viewportCenter; // Distance from top to center
          
          // Reverse progress calculation
          normalizedProgress = Math.max(0, Math.min(1, 1 - (distanceFromCenter / (availableDistance * 0.7))));
          setScrollProgress(normalizedProgress);
        } else {
          // Card is at or above center and not scrolling up - no progress
          setScrollProgress(0);
        }

        // Log step information during scrolling (throttled)
        const now = Date.now();
        if (now - lastLogTime >= LOG_THROTTLE_MS) {
          // Get fresh sortedPlaces from the component scope
          const currentPlace = sortedPlaces[mostVisibleIndex];
          const nextPlace = sortedPlaces[mostVisibleIndex + 1];
          
          if (currentPlace) {
            // Always log current step info, even if coordinates are missing
            if (currentPlace.coordinates?.lat && currentPlace.coordinates?.lng) {
              // Calculate distance to next step if it exists
              if (nextPlace?.coordinates?.lat && nextPlace?.coordinates?.lng) {
                const totalDistanceToNext = calculateDistance(
                  currentPlace.coordinates.lat,
                  currentPlace.coordinates.lng,
                  nextPlace.coordinates.lat,
                  nextPlace.coordinates.lng
                );
                
                // Calculate current progress distance (how far we've traveled towards next step)
                const currentProgressDistance = totalDistanceToNext * normalizedProgress;
                const remainingDistance = totalDistanceToNext - currentProgressDistance;
                const progressPercentage = normalizedProgress * 100;
              }
            }
          }
          
          lastLogTime = now;
        }
      } else {
        setScrollProgress(0);
      }
    };

    // Use IntersectionObserver for step detection, but scroll listener for progress
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the entry with the highest intersection ratio
        let maxRatio = 0;
        let mostVisibleIndex = 0;

        for (const entry of entries) {
          const stepIndex = parseInt(entry.target.getAttribute('data-step-index') || '0', 10);
          if (entry.intersectionRatio > maxRatio && entry.intersectionRatio > 0.3) {
            maxRatio = entry.intersectionRatio;
            mostVisibleIndex = stepIndex;
          }
        }

        if (maxRatio > 0) {
          setVisibleStepIndex(mostVisibleIndex);
        }
      },
      {
        root: null,
        rootMargin: '-30% 0px -30% 0px',
        threshold: [0, 0.3, 0.5, 0.7, 1.0],
      }
    );

    // Observe all step cards
    const timeoutId = setTimeout(() => {
      stepCards.forEach((card) => {
        observerRef.current?.observe(card);
      });
    }, 100);

    // Add scroll listener
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial calculation

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('scroll', handleScroll);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [sortedPlaces]);

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
          onCommentClick={async () => {
            // Refresh comment count when comments are toggled
            try {
              const token = user ? await getIdToken() : null;
              const count = await getTripCommentCount(tripId, token);
              setCommentCount(count || 0);
            } catch (error) {
              console.error('Failed to refresh comment count:', error);
            }
          }}
          commentCount={commentCount}
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
          trip={trip}
        />

        {/* End Trip Button - Show at the end for in_progress trips if user can edit */}
        {canEdit && trip.status === 'in_progress' && (
          <div className="mt-8 mb-8">
            <button
              onClick={handleEndTrip}
              className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors active:scale-95 shadow-lg"
            >
              <MdStop className="w-5 h-5" />
              <span>End Trip</span>
            </button>
          </div>
        )}
      </main>

    </div>
  );
}
