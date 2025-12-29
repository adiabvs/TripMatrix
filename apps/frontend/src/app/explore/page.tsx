'use client';

import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useEffect, useState, useRef, useCallback } from 'react';
import { searchTrips, likeTrip, unlikeTrip, getTripLikes, getTripCommentCount } from '@/lib/api';
import type { Trip, User } from '@tripmatrix/types';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import { MdHome, MdPerson, MdAdd, MdSearch, MdLocationOn, MdMonetizationOn, MdArrowBack, MdFavorite, MdChatBubbleOutline, MdMoreVert, MdPublic, MdLock } from 'react-icons/md';
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
  const [trips, setTrips] = useState<Trip[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [likes, setLikes] = useState<Record<string, { count: number; isLiked: boolean }>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [lastTripId, setLastTripId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const performSearch = useCallback(async (query: string, loadMore: boolean = false) => {
    if (!query.trim()) {
      setTrips([]);
      setUsers([]);
      setHasMore(false);
      return;
    }

    try {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setTrips([]);
        setUsers([]);
      }

      const token = user ? await getIdToken() : null;
      const result = await searchTrips(
        query,
        'all', // Search all types
        20,
        loadMore && lastTripId ? lastTripId : undefined,
        token
      );

      if (loadMore) {
        setTrips(prev => [...prev, ...result.trips]);
      } else {
        setTrips(result.trips);
        setUsers(result.users || []);
      }

      setHasMore(result.hasMore);
      setLastTripId(result.lastTripId);

      // Load likes and comment counts
      if (result.trips.length > 0) {
        const likesPromises = result.trips.map(async (trip: Trip) => {
          try {
            const likesData = await getTripLikes(trip.tripId, token);
            return { tripId: trip.tripId, ...likesData };
          } catch {
            return { tripId: trip.tripId, likeCount: 0, isLiked: false };
          }
        });

        const commentPromises = result.trips.map(async (trip: Trip) => {
          try {
            const count = await getTripCommentCount(trip.tripId, token);
            return { tripId: trip.tripId, count };
          } catch {
            return { tripId: trip.tripId, count: 0 };
          }
        });

        const [likesResults, commentResults] = await Promise.all([
          Promise.all(likesPromises),
          Promise.all(commentPromises),
        ]);

        const likesMap: Record<string, { count: number; isLiked: boolean }> = {};
        likesResults.forEach(({ tripId, likeCount, isLiked }) => {
          likesMap[tripId] = { count: likeCount, isLiked };
        });
        setLikes(prev => ({ ...prev, ...likesMap }));

        const commentsMap: Record<string, number> = {};
        commentResults.forEach(({ tripId, count }) => {
          commentsMap[tripId] = count;
        });
        setCommentCounts(prev => ({ ...prev, ...commentsMap }));
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user, lastTripId, getIdToken]);

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
        setUsers([]);
        setHasMore(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, performSearch]);


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
    <div className="h-full overflow-y-auto bg-black">
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
          <div className="relative mb-3">
            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search trips, users, places..."
              className="w-full bg-gray-900 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-800 focus:border-blue-500 focus:outline-none"
              autoFocus
            />
          </div>

        </div>
      </header>

      {/* Results */}
      <main className="max-w-[600px] mx-auto pb-20">
        {loading && searchQuery.trim() ? (
          <div className="flex justify-center py-20">
            <div className="text-gray-400">Searching...</div>
          </div>
        ) : trips.length === 0 && users.length === 0 && searchQuery.trim() ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <MdSearch className="w-16 h-16 text-gray-600 mb-4" />
            <p className="text-gray-400 text-center">No results found</p>
          </div>
        ) : !searchQuery.trim() ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <MdSearch className="w-16 h-16 text-gray-600 mb-4" />
            <p className="text-gray-400 text-center">Search for trips, users, or places</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Users Section */}
            {users.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-white px-4 mb-3">People</h2>
                <div className="space-y-2">
                  {users.map((user) => (
                    <Link
                      key={user.uid}
                      href={`/users/${user.uid}`}
                      className="flex items-center gap-3 px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg hover:bg-gray-800 transition-all"
                    >
                      {user.photoUrl ? (
                        <img
                          src={user.photoUrl}
                          alt={user.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                          <MdPerson className="w-6 h-6 text-white" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-white font-semibold">{user.name || 'User'}</p>
                        {user.username && (
                          <p className="text-gray-400 text-sm">@{user.username}</p>
                        )}
                      </div>
                      <div className="text-gray-400">
                        {user.isProfilePublic ? <MdPublic className="w-5 h-5" /> : <MdLock className="w-5 h-5" />}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Trips Section */}
            {trips.length > 0 && (
              <div>
                {users.length > 0 && <h2 className="text-lg font-semibold text-white px-4 mb-3">Trips</h2>}
                <div className="space-y-8">
                  {trips.map((trip, index) => {
                    const isLast = index === trips.length - 1;
                    
                    return (
                      <div
                        key={trip.tripId}
                        ref={isLast ? lastTripElementRef : null}
                        className="bg-black border border-gray-800 rounded-lg overflow-hidden"
                      >
                        {/* Post Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                              <MdPerson className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <Link
                                href={`/users/${trip.creatorId}`}
                                className="text-white font-semibold text-sm hover:opacity-70"
                              >
                                User
                              </Link>
                              <p className="text-gray-400 text-xs">
                                {format(toDate(trip.createdAt), 'MMM dd, yyyy')}
                              </p>
                            </div>
                          </div>
                          <button className="text-white">
                            <MdMoreVert className="w-5 h-5" />
                          </button>
                        </div>

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
                            {/* Status Badge */}
                            <div className="absolute top-3 right-3">
                              <span
                                className={`px-2 py-1 rounded text-xs font-semibold ${
                                  trip.status === 'completed'
                                    ? 'bg-green-500 text-white'
                                    : trip.status === 'upcoming'
                                    ? 'bg-yellow-500 text-white'
                                    : 'bg-blue-500 text-white'
                                }`}
                              >
                                {trip.status === 'completed' ? 'Completed' : trip.status === 'upcoming' ? 'Upcoming' : 'Ongoing'}
                              </span>
                            </div>
                          </div>
                        </Link>

                        {/* Actions */}
                        <div className="px-4 py-3 space-y-2">
                          <div className="flex items-center gap-4">
                            <button 
                              onClick={async () => {
                                if (!user) return;
                                const token = await getIdToken();
                                const currentLike = likes[trip.tripId];
                                try {
                                  if (currentLike?.isLiked) {
                                    await unlikeTrip(trip.tripId, token);
                                    setLikes(prev => ({
                                      ...prev,
                                      [trip.tripId]: { count: Math.max(0, (prev[trip.tripId]?.count || 0) - 1), isLiked: false }
                                    }));
                                  } else {
                                    await likeTrip(trip.tripId, token);
                                    setLikes(prev => ({
                                      ...prev,
                                      [trip.tripId]: { count: (prev[trip.tripId]?.count || 0) + 1, isLiked: true }
                                    }));
                                  }
                                } catch (error) {
                                  console.error('Failed to toggle like:', error);
                                }
                              }}
                              className="text-white hover:opacity-70"
                            >
                              <MdFavorite className={`w-6 h-6 ${likes[trip.tripId]?.isLiked ? 'text-red-500 fill-red-500' : ''}`} />
                            </button>
                            <Link href={`/trips/${trip.tripId}`} className="text-white hover:opacity-70 flex items-center gap-1">
                              <MdChatBubbleOutline className="w-6 h-6" />
                            </Link>
                          </div>
                          {(likes[trip.tripId]?.count > 0 || commentCounts[trip.tripId] > 0) && (
                            <div className="flex items-center gap-4 text-sm">
                              {likes[trip.tripId]?.count > 0 && (
                                <span className="text-white font-semibold">
                                  {likes[trip.tripId].count} {likes[trip.tripId].count === 1 ? 'like' : 'likes'}
                                </span>
                              )}
                              {commentCounts[trip.tripId] > 0 && (
                                <Link href={`/trips/${trip.tripId}`} className="text-gray-400 hover:text-white">
                                  {commentCounts[trip.tripId]} {commentCounts[trip.tripId] === 1 ? 'comment' : 'comments'}
                                </Link>
                              )}
                            </div>
                          )}

                          {/* Trip Info */}
                          <div>
                            <Link
                              href={`/trips/${trip.tripId}`}
                              className="text-white font-semibold text-sm hover:opacity-70"
                            >
                              {trip.title}
                            </Link>
                            {trip.description && (
                              <p className="text-gray-300 text-sm mt-1 line-clamp-2">
                                {trip.description}
                              </p>
                            )}
                            {trip.totalExpense && trip.totalExpense > 0 && (
                              <div className="flex items-center gap-1 mt-2 text-gray-400 text-xs">
                                <MdMonetizationOn className="w-4 h-4" />
                                <span>{trip.totalExpense.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
      <nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 safe-area-inset-bottom">
        <div className="max-w-[600px] mx-auto flex items-center justify-around px-4 py-1.5">
          <Link href="/" className="text-white flex items-center justify-center p-1.5 rounded-full active:scale-95 active:bg-gray-800 transition-all">
            <MdHome className="w-6 h-6" />
          </Link>
          <Link href="/explore" className="text-blue-500 flex items-center justify-center p-1.5 rounded-full active:scale-95 active:bg-gray-800 transition-all">
            <MdSearch className="w-6 h-6" />
          </Link>
          {user ? (
            <>
              <Link href="/trips/new" className="text-gray-400 flex items-center justify-center p-1.5 rounded-full active:scale-95 active:bg-gray-800 transition-all">
                <MdAdd className="w-6 h-6" />
              </Link>
              <div className="flex items-center justify-center p-1.5 rounded-full active:scale-95 active:bg-gray-800 transition-all">
                <UserMenu />
              </div>
            </>
          ) : (
            <Link href="/auth" className="text-gray-400 flex items-center justify-center p-1.5 rounded-full active:scale-95 active:bg-gray-800 transition-all">
              <MdPerson className="w-6 h-6" />
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
