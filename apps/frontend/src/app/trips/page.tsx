'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getUserTrips } from '@/lib/api';
import type { Trip } from '@tripmatrix/types';
import Link from 'next/link';
import { format } from 'date-fns';

export default function TripsPage() {
  const { user, loading: authLoading, getIdToken } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadTrips();
    }
  }, [user]);

  const loadTrips = async () => {
    try {
      const token = await getIdToken();
      const userTrips = await getUserTrips(undefined, token);
      setTrips(userTrips);
    } catch (error) {
      console.error('Failed to load trips:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">TripMatrix</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/trips/public"
              className="text-blue-600 hover:text-blue-700"
            >
              Explore Public Trips
            </Link>
            <Link
              href="/trips/new"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              New Trip
            </Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-6">My Trips</h2>
        
        {trips.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">No trips yet. Create your first trip!</p>
            <Link
              href="/trips/new"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              Create Trip
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map((trip) => (
              <Link
                key={trip.tripId}
                href={`/trips/${trip.tripId}`}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                {trip.coverImage && (
                  <img
                    src={trip.coverImage}
                    alt={trip.title}
                    className="w-full h-48 object-cover"
                  />
                )}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {trip.title}
                    </h3>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        trip.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {trip.status === 'completed' ? 'Completed' : 'In Progress'}
                    </span>
                  </div>
                  {trip.description && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {trip.description}
                    </p>
                  )}
                  <div className="text-sm text-gray-500">
                    <p>
                      Started: {format(new Date(trip.startTime), 'MMM d, yyyy')}
                    </p>
                    {trip.totalDistance && (
                      <p>Distance: {(trip.totalDistance / 1000).toFixed(2)} km</p>
                    )}
                    {trip.totalExpense && (
                      <p>Expenses: ${trip.totalExpense.toFixed(2)}</p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

