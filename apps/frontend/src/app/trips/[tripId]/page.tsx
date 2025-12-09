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
} from '@/lib/api';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import type { Trip, TripRoute, TripPlace, TripExpense, ExpenseSummary } from '@tripmatrix/types';
import TripMap from '@/components/TripMap';
import PlaceForm from '@/components/PlaceForm';
import ExpenseForm from '@/components/ExpenseForm';
import { formatDistance, formatDuration } from '@tripmatrix/utils';
import { format } from 'date-fns';

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
  const [showPlaceForm, setShowPlaceForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [trackingLocation, setTrackingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (tripId && user) {
      loadTripData();
    }
  }, [tripId, user]);

  const loadTripData = async () => {
    try {
      const token = await getIdToken();
      const [tripData, routesData, expensesData] = await Promise.all([
        getTrip(tripId, token),
        getTripRoutes(tripId, token),
        getTripExpenses(tripId, token),
      ]);

      setTrip(tripData);
      setRoutes(routesData);
      setExpenses(expensesData);

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

  const handleAddPlace = async (placeData: Partial<TripPlace>) => {
    try {
      const token = await getIdToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/places`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(placeData),
      });

      if (!response.ok) {
        throw new Error('Failed to add place');
      }

      setShowPlaceForm(false);
    } catch (error) {
      console.error('Failed to add place:', error);
      throw error;
    }
  };

  const handleAddExpense = async (expenseData: Partial<TripExpense>) => {
    try {
      const token = await getIdToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/expenses`, {
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
          (new Date(trip.endTime).getTime() - new Date(trip.startTime).getTime()) / 1000
        )
      : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/trips" className="text-blue-600 hover:text-blue-700">
            ← Back to Trips
          </Link>
          {isCreator && trip.status === 'in_progress' && (
            <button
              onClick={handleEndTrip}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              End Trip
            </button>
          )}
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Trip Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{trip.title}</h1>
              {trip.description && (
                <p className="text-gray-600 mb-4">{trip.description}</p>
              )}
            </div>
            <div className="flex gap-2">
              <span
                className={`px-3 py-1 rounded text-sm font-semibold ${
                  trip.status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {trip.status === 'completed' ? 'Completed' : 'In Progress'}
              </span>
              {isCreator && (
                <button
                  onClick={handleTogglePublic}
                  className={`px-3 py-1 rounded text-sm font-semibold ${
                    trip.isPublic
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {trip.isPublic ? 'Public' : 'Private'}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Started</p>
              <p className="font-semibold">{format(new Date(trip.startTime), 'MMM d, yyyy')}</p>
            </div>
            {trip.endTime && (
              <div>
                <p className="text-gray-500">Ended</p>
                <p className="font-semibold">{format(new Date(trip.endTime), 'MMM d, yyyy')}</p>
              </div>
            )}
            {totalDistance > 0 && (
              <div>
                <p className="text-gray-500">Distance</p>
                <p className="font-semibold">{formatDistance(totalDistance)}</p>
              </div>
            )}
            {totalDuration > 0 && (
              <div>
                <p className="text-gray-500">Duration</p>
                <p className="font-semibold">{formatDuration(totalDuration)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {isCreator && trip.status === 'in_progress' && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => setShowPlaceForm(!showPlaceForm)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                {showPlaceForm ? 'Cancel' : 'Add Place'}
              </button>
              <button
                onClick={() => setShowExpenseForm(!showExpenseForm)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                {showExpenseForm ? 'Cancel' : 'Add Expense'}
              </button>
              {!trackingLocation ? (
                <button
                  onClick={startLocationTracking}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                >
                  Start Tracking
                </button>
              ) : (
                <button
                  onClick={stopLocationTracking}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                >
                  Stop Tracking
                </button>
              )}
            </div>
          </div>
        )}

        {/* Forms */}
        {showPlaceForm && (
          <div className="mb-6">
            <PlaceForm
              tripId={tripId}
              onSubmit={handleAddPlace}
              onCancel={() => setShowPlaceForm(false)}
              token={await getIdToken()}
            />
          </div>
        )}

        {showExpenseForm && (
          <div className="mb-6">
            <ExpenseForm
              tripId={tripId}
              participants={trip.participants}
              onSubmit={handleAddExpense}
              onCancel={() => setShowExpenseForm(false)}
            />
          </div>
        )}

        {/* Map */}
        {routes.length > 0 || places.length > 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4">Route Map</h2>
            <TripMap
              routes={routes}
              places={places}
              currentLocation={currentLocation || undefined}
              height="500px"
            />
          </div>
        ) : null}

        {/* Places */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">Places Visited ({places.length})</h2>
          {places.length === 0 ? (
            <p className="text-gray-500">No places visited yet</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {places.map((place) => (
                <div key={place.placeId} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-2">{place.name}</h3>
                  {place.rating && (
                    <div className="mb-2">
                      {'★'.repeat(place.rating)}{'☆'.repeat(5 - place.rating)}
                    </div>
                  )}
                  {place.rewrittenComment && (
                    <p className="text-gray-700 mb-2">{place.rewrittenComment}</p>
                  )}
                  {place.comment && !place.rewrittenComment && (
                    <p className="text-gray-700 mb-2">{place.comment}</p>
                  )}
                  <p className="text-sm text-gray-500">
                    {format(new Date(place.visitedAt), 'MMM d, yyyy HH:mm')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expenses */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">
            Expenses (${trip.totalExpense?.toFixed(2) || '0.00'})
          </h2>
          {expenses.length === 0 ? (
            <p className="text-gray-500">No expenses logged yet</p>
          ) : (
            <div className="space-y-4">
              {expenses.map((expense) => (
                <div key={expense.expenseId} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold">${expense.amount.toFixed(2)}</p>
                      {expense.description && (
                        <p className="text-sm text-gray-600">{expense.description}</p>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      Paid by: {expense.paidBy.substring(0, 8)}...
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">
                    Split between {expense.splitBetween.length} people
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expense Summary (if trip completed) */}
        {trip.status === 'completed' && expenseSummary && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Expense Summary</h2>
            <div className="space-y-4">
              <div>
                <p className="text-lg font-semibold">
                  Total Spent: ${expenseSummary.totalSpent.toFixed(2)}
                </p>
              </div>
              {expenseSummary.settlements.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Settlements:</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {expenseSummary.settlements.map((settlement, idx) => (
                      <li key={idx} className="text-sm">
                        {settlement.from.substring(0, 8)}... owes ${settlement.amount.toFixed(2)} to{' '}
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

