'use client';

import { useAuth } from '@/lib/auth';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
      getTrip,
      updateTrip,
      getTripRoutes,
      getTripExpenses,
      getExpenseSummary,
      updatePlace,
      deletePlace,
      getTripPlaces,
      updateExpense,
      deleteExpense,
    } from '@/lib/api';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import type { Trip, TripRoute, TripPlace, TripExpense, ExpenseSummary, ModeOfTravel } from '@tripmatrix/types';
import StepCard from '@/components/StepCard';
import CompactStepCard from '@/components/CompactStepCard';
import UserMenu from '@/components/UserMenu';
import { formatDistance, formatDuration } from '@tripmatrix/utils';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';

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

  const [trip, setTrip] = useState<Trip | null>(null);
  const [routes, setRoutes] = useState<TripRoute[]>([]);
  const [places, setPlaces] = useState<TripPlace[]>([]);
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [expenseSummary, setExpenseSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [visibleStepIndex, setVisibleStepIndex] = useState<number>(0);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const stepsContainerRef = useRef<HTMLDivElement>(null);
  const stepCardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Draggable state
  const [modalHeight, setModalHeight] = useState(50); // Start at 50vh
  const [isDragging, setIsDragging] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(50);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const loadTripData = useCallback(async (authToken?: string | null) => {
    try {
      // Use provided token or try to get one if user is logged in
      let token: string | null = authToken ?? null;
      if (!token && user) {
        try {
          // Try to get token, with fallback to force refresh
          token = await getIdToken(false);
          if (!token) {
            token = await getIdToken(true);
          }
          if (token) {
            setToken(token);
          } else {
            // If getting token fails, continue without token (for public trips)
            console.log('No token available, attempting to load as public trip');
          }
        } catch (error) {
          // If getting token fails, continue without token (for public trips)
          console.log('No token available, attempting to load as public trip');
          // Don't throw - allow graceful degradation
        }
      }
      
      // Try to load trip data (works for public trips without auth)
      const [tripData, routesData, expensesData, placesData] = await Promise.all([
        getTrip(tripId, token).catch((err: any) => {
          // If it's a private trip and user is not logged in, redirect to auth
          const status = err.status || 0;
          const message = err.message || '';
          // Only redirect if user is definitely not logged in (not just token issue)
          if ((status === 401 || message.includes('Authentication required') || message.includes('401')) && !user && !authLoading) {
            router.push('/auth');
            throw err;
          }
          // If user is logged in but token failed, try again or show error
          if (user && (status === 401 || message.includes('401'))) {
            console.warn('Token may have expired, but user is still logged in. Retrying...');
            // Don't redirect - user is still logged in, just token issue
          }
          throw err;
        }),
        getTripRoutes(tripId, token).catch((err: any) => {
          // Silently fail for routes if unauthorized (might be private trip)
          if (err.status === 401 || err.message?.includes('401')) {
            return [];
          }
          return [];
        }),
        getTripExpenses(tripId, token).catch((err: any) => {
          // Silently fail for expenses if unauthorized (might be private trip)
          if (err.status === 401 || err.message?.includes('401')) {
            return [];
          }
          return [];
        }),
        getTripPlaces(tripId, token).catch((err: any) => {
          // Silently fail for places if unauthorized (might be private trip)
          if (err.status === 401 || err.message?.includes('401')) {
            return [];
          }
          return [];
        }),
      ]);

      setTrip(tripData);
      setRoutes(routesData);
      setExpenses(expensesData);
      setPlaces(placesData.sort((a, b) => toDate(a.visitedAt).getTime() - toDate(b.visitedAt).getTime()));

      // Load expense summary if trip is completed
      if (tripData.status === 'completed') {
        try {
          const summary = await getExpenseSummary(tripId, token);
          setExpenseSummary(summary);
        } catch (error) {
          console.error('Failed to load expense summary:', error);
        }
      }

      setLoading(false);
    } catch (error: any) {
      console.error('Failed to load trip data:', error);
      // Only redirect if user is definitely not logged in (not just token issue)
      // Don't redirect if auth is still loading or if user exists but token failed
      if ((error.message?.includes('Authentication required') || error.message?.includes('401')) && !user && !authLoading) {
        router.push('/auth');
      }
      // If user exists but we got 401, it's likely a token issue, not a logout
      // Don't redirect in this case - user is still logged in
      setLoading(false);
    }
  }, [tripId, user, getIdToken, router]);

  useEffect(() => {
    if (tripId && !authLoading) {
      // Only run when auth loading is complete to prevent premature execution
      // First get token if user is logged in, then load data
      const initializeAndLoad = async () => {
        let authToken: string | null = null;
        if (user) {
          try {
            // Try to get token, force refresh if needed
            authToken = await getIdToken(false);
            if (!authToken) {
              // If token is null, try force refresh once
              authToken = await getIdToken(true);
            }
            if (authToken) {
              setToken(authToken);
            }
          } catch (error) {
            console.error('Failed to get auth token:', error);
            // Continue without token - will try to load as public trip
            // Don't throw to prevent logout
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

  const handleDeletePlace = async (place: TripPlace) => {
    if (!token) {
      alert('Authentication token is missing. Please log in again.');
      return;
    }
    try {
      await deletePlace(place.placeId, token);
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

  // Calculate derived values (before early returns)
  const isCreator = trip ? user?.uid === trip.creatorId : false;
  const isParticipant = trip ? trip.participants?.some(p => p.uid === user?.uid) || false : false;
  const canEdit = isCreator || isParticipant;
  const statusColor = trip?.status === 'completed' ? '#4caf50' : '#ffc107';

  // Sort places chronologically
  const sortedPlaces = [...places].sort((a, b) => {
    return toDate(a.visitedAt).getTime() - toDate(b.visitedAt).getTime();
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#424242]">
        <div className="text-sm text-white">Loading...</div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#424242]">
        <div className="text-sm text-white">Trip not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#424242] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-600">
        <Link href="/trips" className="w-10 h-10 flex items-center justify-center">
          <span className="text-white text-xl">←</span>
        </Link>
        <h1 className="text-[11px] font-semibold text-white">Trip Details</h1>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Link
              href={`/trips/${tripId}/settings`}
              className="w-10 h-10 flex items-center justify-center"
              title="Trip Settings"
            >
              <span className="text-white text-xl">⚙️</span>
            </Link>
          )}
          <UserMenu />
        </div>
      </div>

      {/* Map Section - Dynamic height based on modal */}
      <div className="relative" style={{ height: `${100 - modalHeight}vh`, flexShrink: 0 }}>
        <TripMapbox 
          places={places} 
          routes={routes}
          height={`${100 - modalHeight}vh`}
          highlightedStepIndex={visibleStepIndex}
          sortedPlaces={sortedPlaces}
          autoPlay={false}
          animationSpeed={1.0}
          scrollProgress={scrollProgress}
        />
      </div>

      {/* Steps Section - Draggable Modal */}
      <div 
        className="absolute bottom-0 left-0 right-0 bg-[#424242] border-t border-gray-600 flex flex-col"
        style={{ height: `${modalHeight}vh`, overflow: 'hidden' }}
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

        {/* Trip Info */}
        <div className="px-4 pt-4 pb-2 flex-shrink-0">
          <h2 className="text-[14px] font-semibold text-white mb-2">{trip.title}</h2>
          <div className="flex items-center gap-2 mb-2">
            <div 
              className="w-2 h-2 rounded-full border border-white"
              style={{ backgroundColor: statusColor }}
            />
            <span className="text-[11px] text-white">
              {trip.status === 'completed' ? 'Completed' : 'Active'}
            </span>
            {trip.startTime && (
              <>
                <span className="text-[11px] text-gray-400">•</span>
                <span className="text-[11px] text-gray-400">
                  {format(toDate(trip.startTime), 'MMM dd, yyyy')}
                </span>
              </>
            )}
          </div>
          {trip.description && (
            <p className="text-[12px] text-gray-300">{trip.description}</p>
          )}
        </div>

        {/* Steps List - Vertical Scroll */}
        {sortedPlaces.length > 0 ? (
          <div 
            ref={stepsContainerRef}
            className="overflow-y-auto overflow-x-hidden flex-1"
            style={{
              WebkitOverflowScrolling: 'touch',
              scrollBehavior: 'smooth',
              paddingBottom: '16px',
              paddingLeft: '16px',
              paddingRight: '16px'
            }}
            onScroll={() => {
              if (!stepsContainerRef.current) return;
              
              const container = stepsContainerRef.current;
              const containerTop = container.scrollTop;
              const containerHeight = container.clientHeight;
              const viewportCenter = containerTop + containerHeight / 2;
              
              // Find which step is currently in the center of the viewport
              let closestIndex = 0;
              let closestDistance = Infinity;
              let currentCardTop = 0;
              let currentCardHeight = 0;
              let nextCardTop = 0;
              
              stepCardRefs.current.forEach((ref, index) => {
                if (!ref) return;
                const rect = ref.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                const cardTop = rect.top - containerRect.top;
                const cardCenter = cardTop + rect.height / 2;
                const distance = Math.abs(cardCenter - containerHeight / 2);
                
                if (distance < closestDistance) {
                  closestDistance = distance;
                  closestIndex = index;
                  currentCardTop = cardTop;
                  currentCardHeight = rect.height;
                  
                  // Get next card position for progress calculation
                  if (index + 1 < stepCardRefs.current.length && stepCardRefs.current[index + 1]) {
                    const nextRect = stepCardRefs.current[index + 1]!.getBoundingClientRect();
                    nextCardTop = nextRect.top - containerRect.top;
                  } else {
                    nextCardTop = currentCardTop + currentCardHeight;
                  }
                }
              });
              
              // Calculate scroll progress between current and next step
              let progress = 0;
              if (closestIndex < sortedPlaces.length - 1 && nextCardTop > currentCardTop) {
                const scrollPosition = viewportCenter - containerHeight / 2;
                const relativePosition = scrollPosition - currentCardTop;
                const stepHeight = nextCardTop - currentCardTop;
                progress = Math.max(0, Math.min(1, relativePosition / stepHeight));
              }
              
              setScrollProgress(progress);
              
              if (closestIndex !== visibleStepIndex) {
                setVisibleStepIndex(closestIndex);
              }
            }}
          >
            <div className="flex flex-col items-center">
              {sortedPlaces.map((place, index) => (
                <React.Fragment key={place.placeId}>
                  {/* Add Step Button Before (only show before first step) */}
                  {canEdit && index === 0 && (
                    <div className="relative flex flex-col items-center justify-center flex-shrink-0 w-full mb-6" style={{ minHeight: '80px' }}>
                      {/* Dotted line from + to first step */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 h-[50px] w-0.5 border-l-2 border-dashed border-white" style={{ transform: 'translate(-50%, -50%) translateY(50px)' }} />
                      <Link
                        href={`/trips/${tripId}/steps/new`}
                        className="relative z-10 w-10 h-10 rounded-full bg-black flex items-center justify-center"
                      >
                        <span className="text-white text-xl">+</span>
                      </Link>
                    </div>
                  )}
                  
                  {/* Step Card */}
                  <div 
                    ref={(el) => {
                      stepCardRefs.current[index] = el;
                    }}
                    className="w-full"
                  >
                    <CompactStepCard
                      place={place}
                      index={index}
                      onEdit={(place) => {
                        router.push(`/trips/${tripId}/steps/${place.placeId}/edit`);
                      }}
                      onDelete={handleDeletePlace}
                      isCreator={canEdit}
                      tripId={tripId}
                    />
                  </div>
                  
                  {/* Add Step Button After (between steps and after last step) */}
                  {canEdit && (
                    <div className="relative flex flex-col items-center justify-center flex-shrink-0 w-full mt-6 mb-6" style={{ minHeight: index < sortedPlaces.length - 1 ? '120px' : '80px' }}>
                      {/* Dotted line from step to + */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[60px] w-0.5 border-l-2 border-dashed border-white" />
                      {/* Dotted line from + to next step (only if not last step) */}
                      {index < sortedPlaces.length - 1 && (
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[60px] w-0.5 border-l-2 border-dashed border-white" />
                      )}
                      <Link
                        href={`/trips/${tripId}/steps/new${index < sortedPlaces.length - 1 ? `?after=${place.placeId}` : ''}`}
                        className="relative z-10 w-10 h-10 rounded-full bg-black flex items-center justify-center"
                      >
                        <span className="text-white text-xl">+</span>
                      </Link>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="text-5xl mb-2">📍</div>
            <p className="text-[12px] font-semibold text-white mb-1">No steps yet</p>
            <p className="text-[10px] text-gray-400">Add your first step to start your journey</p>
            {canEdit && (
              <Link
                href={`/trips/${tripId}/steps/new`}
                className="inline-block mt-4 px-4 py-2 bg-[#1976d2] text-white rounded-lg text-[12px] font-semibold"
              >
                + Add Step
              </Link>
            )}
          </div>
        )}

        {/* Expense Summary */}
        {trip.status === 'completed' && expenseSummary && (
          <div className="px-4 pb-4 flex-shrink-0">
            <div className="bg-[#616161] rounded-lg p-4">
              <h3 className="text-[13px] font-bold text-white mb-2">Expense Summary</h3>
              <p className="text-2xl font-bold text-white mb-3">
                ${expenseSummary.totalSpent.toFixed(2)}
              </p>
              {expenseSummary.settlements.length > 0 && (
                <div className="pt-3 border-t border-gray-500">
                  <p className="text-[11px] font-semibold text-white mb-2">Settlements:</p>
                  {expenseSummary.settlements.map((settlement, idx) => (
                    <p key={idx} className="text-[10px] text-gray-300 mb-1">
                      {settlement.from.substring(0, 8)}... owes ${settlement.amount.toFixed(2)} to{' '}
                      {settlement.to.substring(0, 8)}...
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
