'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getTrip, getTripRoutes, getTripExpenses } from '@/lib/api';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import type { Trip, TripRoute, TripPlace, TripExpense, User } from '@tripmatrix/types';
import TripMap from '@/components/TripMap';
import { formatDistance, formatDuration } from '@tripmatrix/utils';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import { MdArrowBack } from 'react-icons/md';

export default function PublicTripViewPage() {
  const params = useParams();
  const tripId = params.tripId as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [creator, setCreator] = useState<User | null>(null);
  const [routes, setRoutes] = useState<TripRoute[]>([]);
  const [places, setPlaces] = useState<TripPlace[]>([]);
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Trip not found or is private</div>
      </div>
    );
  }

  const allRoutePoints = routes.flatMap((r) => r.points);
  const totalDistance = trip.totalDistance || 0;
  const totalDuration =
    trip.endTime && trip.startTime
      ? Math.floor(
          (toDate(trip.endTime).getTime() - toDate(trip.startTime).getTime()) / 1000
        )
      : 0;

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <nav className="bg-white shadow-sm flex-shrink-0">
        <div className="container mx-auto px-4 py-4">
          <Link href="/trips/public" className="text-blue-600 hover:text-blue-700 flex items-center gap-2">
            <MdArrowBack className="w-4 h-4" />
            <span>Back to Public Trips</span>
          </Link>
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="container mx-auto px-4 py-8">
        {/* Trip Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">{trip.title}</h1>
              {trip.description && (
                <p className="text-gray-600 mb-4">{trip.description}</p>
              )}
              {creator && (
                <p className="text-sm text-gray-500">
                  By {creator.name || creator.email}
                </p>
              )}
            </div>
            <span
              className={`px-3 py-1 rounded text-sm font-semibold ${
                trip.status === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {trip.status === 'completed' ? 'Completed' : 'In Progress'}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Started</p>
              <p className="font-semibold">{format(toDate(trip.startTime), 'MMM d, yyyy')}</p>
            </div>
            {trip.endTime && (
              <div>
                <p className="text-gray-500">Ended</p>
                <p className="font-semibold">{format(toDate(trip.endTime), 'MMM d, yyyy')}</p>
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

        {/* Map */}
        {routes.length > 0 || places.length > 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-200">
            <h2 className="text-xl font-bold mb-4">Route Map</h2>
            <TripMap 
              routes={routes} 
              places={places.map(p => ({
                coordinates: p.coordinates,
                name: p.name,
                modeOfTravel: p.modeOfTravel ?? undefined,
              }))} 
              height="500px" 
            />
          </div>
        ) : null}

        {/* Places */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-200">
          <h2 className="text-xl font-bold mb-4">Places Visited ({places.length})</h2>
          {places.length === 0 ? (
            <p className="text-gray-500">No places visited yet</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {places.map((place) => (
                <div key={place.placeId} className="border border-gray-200 rounded-xl p-6 bg-white shadow-lg">
                  <h3 className="font-semibold text-sm mb-3">{place.name}</h3>
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
                    {format(toDate(place.visitedAt), 'MMM d, yyyy HH:mm')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Participants */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-200">
          <h2 className="text-xl font-bold mb-4">Participants</h2>
          <div className="flex flex-wrap gap-2">
            {trip.participants.map((participant, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-gray-100 rounded-full text-sm"
              >
                {participant.isGuest ? participant.guestName : `User ${participant.uid?.substring(0, 8)}`}
              </span>
            ))}
          </div>
        </div>

        {/* Expenses (if allowed) */}
        {trip.totalExpense !== undefined && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">
              Total Expenses: ${trip.totalExpense.toFixed(2)}
            </h2>
            {expenses.length > 0 && (
              <div className="space-y-2">
                {expenses.map((expense) => (
                  <div key={expense.expenseId} className="border border-gray-200 rounded-lg p-3">
                    <p className="font-semibold">${expense.amount.toFixed(2)}</p>
                    {expense.description && (
                      <p className="text-sm text-gray-600">{expense.description}</p>
                    )}
                  </div>
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

