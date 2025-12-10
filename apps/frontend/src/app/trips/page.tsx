'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getUserTrips } from '@/lib/api';
import type { Trip } from '@tripmatrix/types';
import Link from 'next/link';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import UserMenu from '@/components/UserMenu';

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
      const userTrips = await getUserTrips(token);
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
    <div className="min-h-screen bg-white">
      {/* Minimal Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/trips" className="text-2xl font-bold text-gray-900 tracking-tight">
            TripMatrix
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/trips/public"
              className="text-gray-700 hover:text-gray-900 transition-colors text-sm font-medium"
            >
              Explore
            </Link>
            <Link
              href="/trips/new"
              className="bg-black text-white px-5 py-2.5 rounded-full hover:bg-gray-800 transition-colors text-sm font-medium"
            >
              New Trip
            </Link>
            <UserMenu />
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">My Trips</h1>
          <p className="text-gray-600">Your travel stories and adventures</p>
        </div>
        
        {trips.length === 0 ? (
          <div className="text-center py-20">
            <div className="max-w-md mx-auto">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No trips yet</h3>
              <p className="text-gray-600 mb-6">Start your first adventure and create beautiful travel stories</p>
              <Link
                href="/trips/new"
                className="inline-block bg-black text-white px-6 py-3 rounded-full hover:bg-gray-800 transition-colors font-medium"
              >
                Create Your First Trip
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {trips.map((trip) => (
              <Link
                key={trip.tripId}
                href={`/trips/${trip.tripId}`}
                className="group block"
              >
                <div className="relative overflow-hidden rounded-2xl bg-gray-100 aspect-[4/3] mb-4">
                  {trip.coverImage ? (
                    <img
                      src={trip.coverImage}
                      alt={trip.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-100">
                      <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 22V12h6v10" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute top-4 right-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm ${
                        trip.status === 'completed'
                          ? 'bg-green-500/90 text-white'
                          : 'bg-blue-500/90 text-white'
                      }`}
                    >
                      {trip.status === 'completed' ? 'Completed' : 'Active'}
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1 group-hover:text-gray-700 transition-colors">
                    {trip.title}
                  </h3>
                  {trip.description && (
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      {trip.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{format(toDate(trip.startTime), 'MMM yyyy')}</span>
                    {trip.totalDistance && (
                      <span>{(trip.totalDistance / 1000).toFixed(0)} km</span>
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

