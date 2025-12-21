'use client';

import { useAuth } from '@/lib/auth';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
      getTrip,
      updateTrip,
      getTripRoutes,
      getTripExpenses,
      getExpenseSummary,
      recordRoutePoints,
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
import StepConnector from '@/components/StepConnector';
import UserMenu from '@/components/UserMenu';
import { formatDistance, formatDuration } from '@tripmatrix/utils';
import { format } from 'date-fns';
import dynamic from 'next/dynamic';
import { toDate } from '@/lib/dateUtils';
import { formatCurrency, getCurrencyFromCountry } from '@/lib/currencyUtils';

const TripMap = dynamic(() => import('@/components/TripMap'), { ssr: false });

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
  const [trackingLocation, setTrackingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (tripId) {
      loadTripData();
      // Load token for forms if user is logged in
      if (user) {
        getIdToken().then(setToken).catch(console.error);
      }
    }
  }, [tripId, user]);

  const loadTripData = async () => {
    try {
      // Get token if user is logged in, otherwise null (for public trips)
      let token: string | null = null;
      try {
        if (user) {
          token = await getIdToken();
        }
      } catch (error) {
        // If getting token fails, continue without token (for public trips)
        console.log('No token available, attempting to load as public trip');
      }
      
      // Try to load trip data (works for public trips without auth)
      const [tripData, routesData, expensesData, placesData] = await Promise.all([
        getTrip(tripId, token).catch((err) => {
          // If it's a private trip and user is not logged in, redirect to auth
          if (!user && (err.message.includes('Authentication required') || err.message.includes('401'))) {
            router.push('/auth');
            throw err;
          }
          throw err;
        }),
        getTripRoutes(tripId, token).catch(() => []), // Routes may fail for public trips
        getTripExpenses(tripId, token).catch(() => []), // Expenses may fail for public trips
        getTripPlaces(tripId, token).catch(() => []), // Places may fail for public trips
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

      // Subscribe to places updates
      const placesQuery = query(
        collection(db, 'tripPlaces'),
        where('tripId', '==', tripId)
      );
      const unsubscribe = onSnapshot(placesQuery, (snapshot) => {
        const placesData = snapshot.docs.map((doc) => ({
          placeId: doc.id,
          ...doc.data(),
        })) as TripPlace[];
        setPlaces(placesData);
      });

      setLoading(false);
      return () => unsubscribe();
    } catch (error) {
      console.error('Failed to load trip data:', error);
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

  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setTrackingLocation(true);
    const id = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Failed to get location');
        setTrackingLocation(false);
      },
      { enableHighAccuracy: true }
    );
    setWatchId(id);

    // Record location every 10 seconds
    const interval = setInterval(async () => {
      if (currentLocation) {
        try {
          const token = await getIdToken();
          await recordRoutePoints(
            tripId,
            [
              {
                lat: currentLocation.lat,
                lng: currentLocation.lng,
                timestamp: new Date(),
                modeOfTravel: 'car', // Default, can be made configurable
              },
            ],
            'car',
            token
          );
          await loadTripData();
        } catch (error) {
          console.error('Failed to record location:', error);
        }
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  };

  const stopLocationTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setTrackingLocation(false);
  };



  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Trip not found</div>
      </div>
    );
  }

  const isCreator = user?.uid === trip.creatorId;
  const isParticipant = trip.participants?.some(p => p.uid === user?.uid) || false;
  const canEdit = isCreator || isParticipant; // Can edit if creator or participant
  const allRoutePoints = routes.flatMap((r) => r.points);
  const totalDistance = trip.totalDistance || 0;
  const totalDuration =
    trip.endTime && trip.startTime
      ? Math.floor(
          (toDate(trip.endTime).getTime() - toDate(trip.startTime).getTime()) / 1000
        )
      : 0;

  // Sort places chronologically
  const sortedPlaces = [...places].sort((a, b) => {
    return toDate(a.visitedAt).getTime() - toDate(b.visitedAt).getTime();
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Minimal Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/trips" className="text-gray-700 hover:text-gray-900 transition-colors flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Back</span>
          </Link>
          <div className="flex items-center gap-4">
            {canEdit && (
              <Link
                href={`/trips/${tripId}/settings`}
                className="text-gray-600 hover:text-gray-900 transition-colors"
                title="Trip Settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
            )}
            <UserMenu />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-6">
        {/* Cover Image Banner */}
        {trip.coverImage && (
          <div className="w-full h-48 mb-8 rounded-2xl overflow-hidden">
            <img
              src={trip.coverImage}
              alt={trip.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Trip Title and Details */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{trip.title}</h1>
          {trip.description && (
            <p className="text-base text-gray-700 mb-6">{trip.description}</p>
          )}
          <div className="flex items-center gap-6 text-gray-600 text-sm">
            <span>{format(toDate(trip.startTime), 'MMM d, yyyy')}</span>
            {trip.endTime && (
              <>
                <span>→</span>
                <span>{format(toDate(trip.endTime), 'MMM d, yyyy')}</span>
              </>
            )}
            {totalDistance > 0 && (
              <>
                <span>•</span>
                <span>{formatDistance(totalDistance)}</span>
              </>
            )}
            {totalDuration > 0 && (
              <>
                <span>•</span>
                <span>{formatDuration(totalDuration)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* Timeline - Steps (Places) */}
        <div className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Steps</h2>
            {canEdit && (
              <Link
                href={`/trips/${tripId}/steps/new`}
                className="text-sm font-medium text-gray-700 hover:text-gray-900 px-4 py-2 rounded-full border border-gray-300 hover:border-gray-400 transition-colors"
              >
                + Add Step
              </Link>
            )}
          </div>

          {sortedPlaces.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-2xl">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-200 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-gray-600 mb-2">No steps yet</p>
              <p className="text-sm text-gray-500">Add your first step to start your journey</p>
            </div>
          ) : (
            <div className="space-y-0">
              {sortedPlaces.map((place, index) => (
                <div key={place.placeId}>
                  <StepCard
                    place={place}
                    index={index}
                    isLast={index === sortedPlaces.length - 1}
                    expenses={expenses}
                    showAddButton={canEdit && index === sortedPlaces.length - 1}
                    onAddStep={() => {
                      router.push(`/trips/${tripId}/steps/new`);
                    }}
                    onEdit={(place) => {
                      router.push(`/trips/${tripId}/steps/${place.placeId}/edit`);
                    }}
                    onDelete={handleDeletePlace}
                    onAddExpense={async (place) => {
                      // Navigate to new expense page with placeId
                      router.push(`/trips/${tripId}/expenses/new?placeId=${place.placeId}`);
                    }}
                    onEditExpense={handleEditExpense}
                    onDeleteExpense={handleDeleteExpense}
                    isCreator={canEdit}
                    expenseVisibility={trip.expenseVisibility || 'members'}
                    currentUserId={user?.uid}
                    isTripMember={isCreator || trip.participants?.some(p => p.uid === user?.uid) || false}
                  />
                  {/* Connector between steps */}
                  {index < sortedPlaces.length - 1 && (
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
                          await loadTripData(); // Reload to refresh the display
                        } catch (error: any) {
                          console.error('Failed to update mode of travel:', error);
                          throw error;
                        }
                      }}
                      onAddStep={(previousPlace) => {
                        // Store the previous place in sessionStorage or state to pass to new step page
                        sessionStorage.setItem('previousPlaceForNewStep', JSON.stringify(previousPlace));
                        router.push(`/trips/${tripId}/steps/new?after=${previousPlace.placeId}`);
                      }}
                      token={token}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Map Section */}
        {(routes.length > 0 || places.length > 0) && (
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Route</h2>
            <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
              <TripMap
                routes={routes}
                places={sortedPlaces.map(place => ({
                  coordinates: place.coordinates,
                  name: place.name,
                  modeOfTravel: place.modeOfTravel ?? undefined,
                }))}
                currentLocation={currentLocation || undefined}
                height="500px"
              />
            </div>
          </div>
        )}

        {/* Actions for Creator */}
        {canEdit && (
          <div className="mb-16 p-6 bg-gray-50 rounded-2xl">
            <div className="flex flex-wrap gap-3">
              {!trackingLocation ? (
                <button
                  onClick={startLocationTracking}
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 px-4 py-2 rounded-full border border-gray-300 hover:border-gray-400 transition-colors"
                >
                  📍 Start Tracking
                </button>
              ) : (
                <button
                  onClick={stopLocationTracking}
                  className="text-sm font-medium text-red-600 hover:text-red-700 px-4 py-2 rounded-full border border-red-300 hover:border-red-400 transition-colors"
                >
                  ⏹ Stop Tracking
                </button>
              )}
            </div>
          </div>
        )}

        {/* Travel Diary */}
        {canEdit && (
          <div className="mb-16 p-6 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border border-purple-100">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Travel Diary</h3>
                {trip.status === 'completed' ? (
                  <>
                    <p className="text-sm text-gray-600 mb-4">
                      Create a beautiful travel diary with Google Slides
                    </p>
                    <Link
                      href={`/trips/${tripId}/diary`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      Create Travel Diary
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 mb-4">
                      Complete your trip to create a beautiful travel diary with Google Slides
                    </p>
                    <button
                      onClick={handleEndTrip}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Mark Trip as Completed
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Expense Summary (if trip completed) */}
        {trip.status === 'completed' && expenseSummary && (
          <div className="mb-16 p-6 bg-blue-50 rounded-2xl border border-blue-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Expense Summary</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Total Spent</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(
                    expenseSummary.totalSpent,
                    user?.defaultCurrency || (user?.country ? getCurrencyFromCountry(user.country) : 'USD')
                  )}
                </p>
              </div>
              {expenseSummary.settlements.length > 0 && (
                <div className="pt-4 border-t border-blue-200">
                  <p className="text-sm font-semibold text-gray-900 mb-2">Settlements:</p>
                  <ul className="space-y-2">
                    {expenseSummary.settlements.map((settlement, idx) => {
                      const defaultCurrency = user?.defaultCurrency || (user?.country ? getCurrencyFromCountry(user.country) : 'USD');
                      return (
                        <li key={idx} className="text-sm text-gray-700">
                          {settlement.from.substring(0, 8)}... owes{' '}
                          <span className="font-semibold">{formatCurrency(settlement.amount, defaultCurrency)}</span> to{' '}
                          {settlement.to.substring(0, 8)}...
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

