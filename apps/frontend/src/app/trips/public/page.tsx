'use client';

import { useEffect, useState } from 'react';
import { getPublicTrips } from '@/lib/api';
import type { Trip } from '@tripmatrix/types';
import Link from 'next/link';
import { format } from 'date-fns';

export default function PublicTripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPublicTrips();
  }, []);

  const loadPublicTrips = async () => {
    try {
      const publicTrips = await getPublicTrips();
      setTrips(publicTrips);
    } catch (error) {
      console.error('Failed to load public trips:', error);
    } finally {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">TripMatrix</h1>
          <Link
            href="/trips"
            className="text-blue-600 hover:text-blue-700"
          >
            My Trips
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-6">Explore Public Trips</h2>
        
        {trips.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No public trips available yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map((trip) => (
              <Link
                key={trip.tripId}
                href={`/trip/${trip.tripId}`}
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

