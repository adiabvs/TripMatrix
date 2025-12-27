'use client';

import { useEffect, useState } from 'react';
import { getPublicTrips } from '@/lib/api';
import type { Trip } from '@tripmatrix/types';
import Link from 'next/link';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import UserMenu from '@/components/UserMenu';
import { MdSearch, MdHome } from 'react-icons/md';

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
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/trips" className="text-xl font-bold text-gray-900 tracking-tight">
            TripMatrix
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/trips"
              className="text-gray-700 hover:text-gray-900 transition-colors text-sm font-medium"
            >
              My Trips
            </Link>
            <UserMenu />
          </div>
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Explore Public Trips</h1>
          <p className="text-gray-600">Discover amazing travel stories from around the world</p>
        </div>
        
        {trips.length === 0 ? (
          <div className="text-center py-20">
            <div className="max-w-md mx-auto">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
                <MdSearch className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No public trips yet</h3>
              <p className="text-gray-600">Be the first to share your travel story!</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map((trip) => (
              <Link
                key={trip.tripId}
                href={`/trip/${trip.tripId}`}
                className="group block"
              >
                <div className="relative overflow-hidden rounded-2xl bg-white aspect-[4/3] mb-5 border border-gray-200 shadow-lg">
                  {trip.coverImage ? (
                    <img
                      src={trip.coverImage}
                      alt={trip.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <MdHome className="w-16 h-16 text-gray-400" />
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
                  <h3 className="text-base font-bold text-gray-900 mb-1 group-hover:text-gray-700 transition-colors">
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
    </div>
  );
}

