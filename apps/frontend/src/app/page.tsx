'use client';

import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getPublicTrips } from '@/lib/api';
import type { Trip } from '@tripmatrix/types';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import UserMenu from '@/components/UserMenu';

export default function Home() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTrips, setFilteredTrips] = useState<Trip[]>([]);

  useEffect(() => {
    loadPublicTrips();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = trips.filter((trip) => {
        // Search in title
        if (trip.title.toLowerCase().includes(query)) return true;
        // Search in description
        if (trip.description?.toLowerCase().includes(query)) return true;
        // Search in creator name (if available)
        // Note: We'd need to fetch user data for this, for now just search title/description
        return false;
      });
      setFilteredTrips(filtered); // Show all filtered results
    } else {
      setFilteredTrips(trips.slice(0, 5)); // Top 5 public trips
    }
  }, [searchQuery, trips]);

  const loadPublicTrips = async () => {
    try {
      // Fetch all public trips (no limit, backend will handle it)
      const publicTrips = await getPublicTrips();
      console.log('Loaded public trips:', publicTrips.length);
      // Sort by createdAt (newest first)
      const sorted = publicTrips.sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
      });
      setTrips(sorted);
      // Show top 5 by default
      setFilteredTrips(sorted.slice(0, 5));
    } catch (error) {
      console.error('Failed to load public trips:', error);
      alert('Failed to load public trips. Please refresh the page.');
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
          <Link href="/" className="text-2xl font-bold text-gray-900 tracking-tight">
            TripMatrix
          </Link>
          <div className="flex items-center gap-6">
            {user ? (
              <>
                <Link
                  href="/trips"
                  className="text-gray-700 hover:text-gray-900 transition-colors text-sm font-medium"
                >
                  My Trips
                </Link>
                <Link
                  href="/trips/new"
                  className="text-gray-700 hover:text-gray-900 transition-colors text-sm font-medium"
                >
                  Create Trip
                </Link>
              </>
            ) : (
              <Link
                href="/auth"
                className="text-gray-700 hover:text-gray-900 transition-colors text-sm font-medium"
              >
                Sign In
              </Link>
            )}
            <UserMenu />
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4 tracking-tight">
            Discover Amazing Trips
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Explore travel stories from around the world
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by location, user, or trip name..."
                className="w-full px-6 py-4 pl-12 border border-gray-300 rounded-full focus:ring-2 focus:ring-black focus:border-transparent text-lg"
              />
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Top 5 Trips */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {searchQuery ? `Search Results (${filteredTrips.length})` : `Featured Trips (${trips.length} total)`}
          </h2>
          
          {filteredTrips.length === 0 ? (
            <div className="text-center py-20">
              <div className="max-w-md mx-auto">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No trips found</h3>
                <p className="text-gray-600">Try a different search term</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredTrips.map((trip) => (
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

        {!searchQuery && trips.length > 5 && (
          <div className="text-center mt-12">
            <Link
              href="/trips/public"
              className="text-gray-700 hover:text-gray-900 transition-colors text-sm font-medium"
            >
              View All {trips.length} Public Trips →
            </Link>
          </div>
        )}

        {!user && (
          <div className="mt-16 text-center">
            <div className="max-w-2xl mx-auto bg-gray-50 rounded-2xl p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Start Your Own Journey
              </h3>
              <p className="text-gray-600 mb-6">
                Sign in to create and share your travel stories
              </p>
              <Link
                href="/auth"
                className="inline-block bg-black text-white px-8 py-3 rounded-full font-semibold hover:bg-gray-800 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
