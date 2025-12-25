'use client';

import { useAuth } from '@/lib/auth';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
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
import StepConnector from '@/components/StepConnector';
import UserMenu from '@/components/UserMenu';
import { formatDistance, formatDuration } from '@tripmatrix/utils';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';

// Dynamically import HomeMapView with SSR disabled
const HomeMapView = dynamic(() => import('@/components/HomeMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="text-sm text-gray-600">Loading map...</div>
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

  useEffect(() => {
    if (tripId) {
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
  }, [tripId, user]);

  const loadTripData = async (authToken?: string | null) => {
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
          if ((status === 401 || message.includes('Authentication required') || message.includes('401')) && !user) {
            router.push('/auth');
            throw err;
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

      // Subscribe to places updates (only if user is authenticated)
      let unsubscribe: (() => void) | undefined;
      if (user) {
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
      }

      setLoading(false);
      return () => {
        if (unsubscribe) unsubscribe();
      };
    } catch (error: any) {
      console.error('Failed to load trip data:', error);
      // If it's an authentication error and user is not logged in, redirect to auth
      if ((error.message?.includes('Authentication required') || error.message?.includes('401')) && !user) {
        router.push('/auth');
      }
      setLoading(false);
    }
  };

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

  const isCreator = user?.uid === trip.creatorId;
  const isParticipant = trip.participants?.some(p => p.uid === user?.uid) || false;
  const canEdit = isCreator || isParticipant;
  const statusColor = trip.status === 'completed' ? '#4caf50' : '#ffc107';

  // Sort places chronologically
  const sortedPlaces = [...places].sort((a, b) => {
    return toDate(a.visitedAt).getTime() - toDate(b.visitedAt).getTime();
  });

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

      {/* Map Section - Top 60% */}
      <div className="relative" style={{ height: '60vh', flexShrink: 0 }}>
        <HomeMapView 
          places={places} 
          routes={routes}
          trips={[]}
          height="60vh"
        />
      </div>

      {/* Steps Section - Bottom 40% */}
      <div className="flex-1 overflow-y-auto bg-[#424242]" style={{ height: '40vh' }}>
        <div className="px-4 py-4">
          {/* Trip Info */}
          <div className="mb-4">
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

          {/* Steps List - Horizontal Scroll */}
          {sortedPlaces.length > 0 ? (
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-3" style={{ width: 'max-content' }}>
                {canEdit && (
                  <div className="flex-shrink-0 flex flex-col items-center">
                    <Link
                      href={`/trips/${tripId}/steps/new`}
                      className="w-10 h-10 rounded-full bg-black flex items-center justify-center mb-2"
                    >
                      <span className="text-white text-xl">+</span>
                    </Link>
                    {sortedPlaces.length > 0 && (
                      <div className="flex gap-1">
                        <div className="w-1 h-1 bg-gray-500 rounded-full" />
                        <div className="w-1 h-1 bg-gray-500 rounded-full" />
                        <div className="w-1 h-1 bg-gray-500 rounded-full" />
                      </div>
                    )}
                  </div>
                )}
                {sortedPlaces.map((place, index) => (
                  <div key={place.placeId} className="flex-shrink-0 flex flex-col items-center">
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
                    {index < sortedPlaces.length - 1 && (
                      <div className="flex items-center my-2">
                        <StepConnector
                          fromPlace={place}
                          toPlace={sortedPlaces[index + 1]}
                          isCreator={canEdit}
                          onUpdateMode={async (placeId, modeOfTravel, distance, time) => {
                            if (!token) {
                              alert('Authentication token is missing. Please log in again.');
                              return;
                            }
                            try {
                              await updatePlace(
                                placeId,
                                {
                                  modeOfTravel: modeOfTravel || undefined,
                                  distanceFromPrevious: distance,
                                  timeFromPrevious: time || undefined,
                                },
                                token
                              );
                              await loadTripData();
                            } catch (error: any) {
                              console.error('Failed to update mode of travel:', error);
                              throw error;
                            }
                          }}
                          onAddStep={(previousPlace) => {
                            sessionStorage.setItem('previousPlaceForNewStep', JSON.stringify(previousPlace));
                            router.push(`/trips/${tripId}/steps/new?after=${previousPlace.placeId}`);
                          }}
                          token={token}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-10">
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
            <div className="bg-[#616161] rounded-lg p-4 mt-4">
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
          )}
        </div>
      </div>
    </div>
  );
}
