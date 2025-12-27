'use client';

import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useEffect, useState, useRef, useCallback } from 'react';
import { searchTrips } from '@/lib/api';
import type { Trip } from '@tripmatrix/types';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import { MdHome, MdPerson, MdAdd, MdSearch, MdLocationOn, MdAttachMoney, MdArrowBack } from 'react-icons/md';
import dynamic from 'next/dynamic';

const UserMenu = dynamic(() => import('@/components/UserMenu'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center gap-1">
      <div className="w-6 h-6 rounded-full bg-gray-400 animate-pulse" />
    </div>
  ),
});

export default function ExplorePage() {
  const { user, getIdToken } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'user' | 'place' | 'trip'>('all');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [lastTripId, setLastTripId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const performSearch = useCallback(async (query: string, loadMore: boolean = false) => {
    if (!query.trim()) {
      setTrips([]);
      setHasMore(false);
      return;
    }

    try {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setTrips([]);
      }

      const token = user ? await getIdToken() : null;
      const result = await searchTrips(
        query,
        searchType === 'all' ? undefined : searchType,
        20,
        loadMore ? lastTripId : undefined,
        token
      );

      if (loadMore) {
        setTrips(prev => [...prev, ...result.trips]);
      } else {
        setTrips(result.trips);
      }

      setHasMore(result.hasMore);
      setLastTripId(result.lastTripId);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user, searchType, lastTripId, getIdToken]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (searchQuery.trim()) {
        setLastTripId(null);
        performSearch(searchQuery, false);
      } else {
        setTrips([]);
        setHasMore(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, searchType]);

  // Intersection Observer for lazy loading
  const lastTripElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore || !hasMore || !searchQuery.trim()) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        performSearch(searchQuery, true);
      }
    });
    
    if (node) observerRef.current.observe(node);
  }, [loading, loadingMore, hasMore, searchQuery, performSearch]);

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black border-b border-gray-800">
        <div className="max-w-[600px] mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/" className="text-white">
              <MdArrowBack className="w-6 h-6" />
            </Link>
            <h1 className="text-xl font-semibold text-white">Explore</h1>
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search trips, users, places..."
              className="w-full bg-gray-900 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-800 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Search Type Filters */}
          <div className="flex gap-2 mt-3">
            {(['all', 'user', 'place', 'trip'] as const).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setSearchType(type);
                  setLastTripId(null);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  searchType === type
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Results */}
      <main className="max-w-[600px] mx-auto pb-20">
        {loading && searchQuery.trim() ? (
          <div className="flex justify-center py-20">
            <div className="text-gray-400">Searching...</div>
          </div>
        ) : trips.length === 0 && searchQuery.trim() ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <MdSearch className="w-16 h-16 text-gray-600 mb-4" />
            <p className="text-gray-400 text-center">No trips found</p>
          </div>
        ) : !searchQuery.trim() ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <MdSearch className="w-16 h-16 text-gray-600 mb-4" />
            <p className="text-gray-400 text-center">Search for trips, users, or places</p>
          </div>
        ) : (
          <div className="space-y-8">
            {trips.map((trip, index) => {
              const isLast = index === trips.length - 1;
              
              return (
                <div
                  key={trip.tripId}
                  ref={isLast ? lastTripElementRef : null}
                  className="bg-black border border-gray-800 rounded-lg overflow-hidden"
                >
                  {/* Cover Image */}
                  <Link href={`/trips/${trip.tripId}`}>
                    <div className="relative aspect-square bg-gray-900">
                      {trip.coverImage ? (
                        <img
                          src={trip.coverImage}
                          alt={trip.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <MdLocationOn className="w-16 h-16 text-gray-600" />
                        </div>
                      )}
                      <div className="absolute top-3 right-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            trip.status === 'completed'
                              ? 'bg-green-500 text-white'
                              : 'bg-blue-500 text-white'
                          }`}
                        >
                          {trip.status === 'completed' ? 'Completed' : 'Active'}
                        </span>
                      </div>
                    </div>
                  </Link>

                  {/* Trip Info */}
                  <div className="px-4 py-3 space-y-2">
                    <Link
                      href={`/trips/${trip.tripId}`}
                      className="text-white font-semibold text-sm hover:opacity-70 block"
                    >
                      {trip.title}
                    </Link>
                    {trip.description && (
                      <p className="text-gray-300 text-sm line-clamp-2">
                        {trip.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-gray-400 text-xs">
                      <span>{format(toDate(trip.startTime), 'MMM yyyy')}</span>
                      {trip.totalDistance && (
                        <span>{(trip.totalDistance / 1000).toFixed(0)} km</span>
                      )}
                      {trip.totalExpense && trip.totalExpense > 0 && (
                        <div className="flex items-center gap-1">
                          <MdAttachMoney className="w-3 h-3" />
                          <span>{trip.totalExpense.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Loading More Indicator */}
        {loadingMore && (
          <div className="flex justify-center py-8">
            <div className="text-gray-400">Loading more...</div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800">
        <div className="max-w-[600px] mx-auto flex items-center justify-around px-4 py-3">
          <Link href="/" className="text-white">
            <MdHome className="w-6 h-6" />
          </Link>
          <Link href="/explore" className="text-blue-500">
            <MdSearch className="w-6 h-6" />
          </Link>
          {user ? (
            <>
              <Link href="/trips/new" className="text-gray-400">
                <MdAdd className="w-6 h-6" />
              </Link>
              <UserMenu />
            </>
          ) : (
            <Link href="/auth" className="text-gray-400">
              <MdPerson className="w-6 h-6" />
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}


