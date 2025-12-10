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
    } from '@/lib/api';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import type { Trip, TripRoute, TripPlace, TripExpense, ExpenseSummary, ModeOfTravel } from '@tripmatrix/types';
import ExpenseForm from '@/components/ExpenseForm';
import StepCard from '@/components/StepCard';
import StepConnector from '@/components/StepConnector';
import UserMenu from '@/components/UserMenu';
import { formatDistance, formatDuration } from '@tripmatrix/utils';
import { format } from 'date-fns';
import dynamic from 'next/dynamic';
import { toDate } from '@/lib/dateUtils';

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
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expensePlace, setExpensePlace] = useState<TripPlace | null>(null);
  const [placeCountry, setPlaceCountry] = useState<string | undefined>(undefined);
  const [trackingLocation, setTrackingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (tripId && user) {
      loadTripData();
      // Load token for forms
      getIdToken().then(setToken).catch(console.error);
    }
  }, [tripId, user]);

  const loadTripData = async () => {
    try {
      const token = await getIdToken();
      const [tripData, routesData, expensesData, placesData] = await Promise.all([
        getTrip(tripId, token),
        getTripRoutes(tripId, token),
        getTripExpenses(tripId, token),
        getTripPlaces(tripId, token),
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


  const handleAddExpense = async (expenseData: Partial<TripExpense>) => {
    try {
      const token = await getIdToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(expenseData),
      });

      if (!response.ok) {
        throw new Error('Failed to add expense');
      }

      setShowExpenseForm(false);
      setExpensePlace(null);
      setPlaceCountry(undefined);
      await loadTripData();
    } catch (error) {
      console.error('Failed to add expense:', error);
      throw error;
    }
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
            {isCreator && (
              <>
                {trip.status === 'in_progress' && (
                  <button
                    onClick={handleEndTrip}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    End Trip
                  </button>
                )}
                {trip.status === 'completed' && (
                  <button
                    onClick={async () => {
                      if (!trip || !confirm('Resume this trip?')) return;
                      try {
                        const token = await getIdToken();
                        await updateTrip(tripId, { status: 'in_progress' }, token);
                        await loadTripData();
                      } catch (error) {
                        console.error('Failed to resume trip:', error);
                        alert('Failed to resume trip');
                      }
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Resume Trip
                  </button>
                )}
                <button
                  onClick={handleTogglePublic}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                    trip.isPublic
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {trip.isPublic ? 'Public' : 'Private'}
                </button>
              </>
            )}
            <UserMenu />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative">
        {trip.coverImage ? (
          <div className="w-full h-[60vh] min-h-[400px] relative overflow-hidden">
            <img
              src={trip.coverImage}
              alt={trip.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-12 max-w-4xl mx-auto">
              <h1 className="text-5xl font-bold text-white mb-4">{trip.title}</h1>
              {trip.description && (
                <p className="text-xl text-white/90 mb-6">{trip.description}</p>
              )}
              <div className="flex items-center gap-6 text-white/80 text-sm">
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
        ) : (
          <div className="w-full h-[40vh] min-h-[300px] bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
            <div className="text-center max-w-4xl mx-auto px-6">
              <h1 className="text-5xl font-bold text-gray-900 mb-4">{trip.title}</h1>
              {trip.description && (
                <p className="text-xl text-gray-700 mb-6">{trip.description}</p>
              )}
              <div className="flex items-center justify-center gap-6 text-gray-600 text-sm">
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
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* Timeline - Steps (Places) */}
        <div className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Steps</h2>
            {isCreator && (
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
                    showAddButton={isCreator && index === sortedPlaces.length - 1}
                    onAddStep={() => {
                      router.push(`/trips/${tripId}/steps/new`);
                    }}
                    onEdit={(place) => {
                      router.push(`/trips/${tripId}/steps/${place.placeId}/edit`);
                    }}
                    onDelete={handleDeletePlace}
                    onAddExpense={async (place) => {
                      // Try to get country from place coordinates
                      try {
                        const response = await fetch(
                          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/geocoding/reverse?lat=${place.coordinates.lat}&lng=${place.coordinates.lng}`
                        );
                        if (response.ok) {
                          const data = await response.json();
                          if (data.success && data.data?.address?.country_code) {
                            setPlaceCountry(data.data.address.country_code.toUpperCase());
                          }
                        }
                      } catch (error) {
                        console.error('Failed to get country:', error);
                      }
                      setExpensePlace(place);
                      setShowExpenseForm(true);
                    }}
                    isCreator={isCreator}
                  />
                  {/* Connector between steps */}
                  {index < sortedPlaces.length - 1 && (
                    <StepConnector
                      fromPlace={place}
                      toPlace={sortedPlaces[index + 1]}
                      isCreator={isCreator}
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
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Route</h2>
            <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
              <TripMap
                routes={routes}
                places={places}
                currentLocation={currentLocation || undefined}
                height="500px"
              />
            </div>
          </div>
        )}

        {/* Actions for Creator */}
        {isCreator && (
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
            {showExpenseForm && expensePlace && trip && (
              <div className="mt-6">
                <ExpenseForm
                  tripId={tripId}
                  participants={trip.participants || []}
                  onSubmit={handleAddExpense}
                  onCancel={() => {
                    setShowExpenseForm(false);
                    setExpensePlace(null);
                    setPlaceCountry(undefined);
                  }}
                  placeId={expensePlace.placeId}
                  placeCountry={placeCountry}
                />
              </div>
            )}
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
                  ${expenseSummary.totalSpent.toFixed(2)}
                </p>
              </div>
              {expenseSummary.settlements.length > 0 && (
                <div className="pt-4 border-t border-blue-200">
                  <p className="text-sm font-semibold text-gray-900 mb-2">Settlements:</p>
                  <ul className="space-y-2">
                    {expenseSummary.settlements.map((settlement, idx) => (
                      <li key={idx} className="text-sm text-gray-700">
                        {settlement.from.substring(0, 8)}... owes{' '}
                        <span className="font-semibold">${settlement.amount.toFixed(2)}</span> to{' '}
                        {settlement.to.substring(0, 8)}...
                      </li>
                    ))}
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

