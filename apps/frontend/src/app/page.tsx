'use client';

import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useEffect, useState, useRef, useCallback } from 'react';
import { getPublicTripsWithData, searchTrips, likeTrip, unlikeTrip, getTripLikes, getTripCommentCount, followUser, getFollowing } from '@/lib/api';
import type { Trip, User } from '@tripmatrix/types';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import { MdHome, MdPerson, MdAdd, MdSearch, MdFavorite, MdChatBubbleOutline, MdMoreVert, MdLocationOn, MdMonetizationOn } from 'react-icons/md';
import dynamic from 'next/dynamic';

// Dynamically import UserMenu
const UserMenu = dynamic(() => import('@/components/UserMenu'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center gap-1">
      <div className="w-6 h-6 rounded-full bg-gray-400 animate-pulse" />
    </div>
  ),
});

export default function Home() {
  const { user, getIdToken, loading: authLoading } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [creators, setCreators] = useState<Record<string, User>>({});
  const [likes, setLikes] = useState<Record<string, { count: number; isLiked: boolean }>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastTripId, setLastTripId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [mounted, setMounted] = useState(false);

  const loadTrips = useCallback(async (loadMore: boolean = false, currentLastTripId?: string | null) => {
    try {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const token = user ? await getIdToken() : null;
      const lastTripIdValue = currentLastTripId ?? lastTripId;
      const tripIdForPagination = loadMore && lastTripIdValue != null ? lastTripIdValue : undefined;
      const result = await getPublicTripsWithData(20, tripIdForPagination, token);
      
      if (loadMore) {
        setTrips(prev => [...prev, ...result.trips]);
      } else {
        setTrips(result.trips);
      }
      
      setCreators(prev => ({ ...prev, ...result.creators }));
      setHasMore(result.hasMore);
      setLastTripId(result.lastTripId);

      // Load likes and comment counts for all trips
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
      console.error('Failed to load trips:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user, getIdToken, lastTripId]);

  // Set mounted flag after hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Only load trips after component is mounted and auth is ready
    if (!mounted || authLoading) return;
    
    // Reset state when user changes
    setTrips([]);
    setLastTripId(null);
    setHasMore(true);
    loadTrips(false);
    // Load following list if user is logged in
    if (user) {
      const loadFollowing = async () => {
        try {
          const token = await getIdToken();
          const followingList = await getFollowing(token);
          setFollowing(new Set(followingList.map(u => u.uid)));
        } catch (error) {
          console.error('Failed to load following:', error);
        }
      };
      loadFollowing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, mounted, authLoading]);

  // Intersection Observer for lazy loading
  const lastTripElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        loadTrips(true, lastTripId);
      }
    });
    
    if (node) observerRef.current.observe(node);
  }, [loading, loadingMore, hasMore, lastTripId, loadTrips]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      Object.keys(menuOpen).forEach(tripId => {
        if (menuOpen[tripId] && menuRefs.current[tripId] && !menuRefs.current[tripId]?.contains(event.target as Node)) {
          setMenuOpen(prev => ({ ...prev, [tripId]: false }));
        }
      });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  // Show loading state during initial mount or auth loading
  if (!mounted || authLoading || loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-black">
      {/* Instagram-like Header */}
      <header className="sticky top-0 z-50 bg-black border-b border-gray-800">
        <div className="max-w-[600px] mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-white">TripMatrix</h1>
          {!user && (
            <div className="flex items-center gap-4">
              <Link 
                href="/auth"
                className="text-white text-sm font-medium"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Instagram-like Feed */}
      <main className="max-w-[600px] mx-auto pb-20">
        {trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <MdHome className="w-16 h-16 text-gray-600 mb-4" />
            <p className="text-gray-400 text-center">No trips to show</p>
            {user && (
              <Link
                href="/trips/new"
                className="mt-4 px-6 py-2 bg-[#1976d2] text-white rounded-lg font-medium"
              >
                Create Your First Trip
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {trips.map((trip, index) => {
              const creator = creators[trip.creatorId];
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
                      {creator?.photoUrl ? (
                        <img
                          src={creator.photoUrl}
                          alt={creator.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                          <MdPerson className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div>
                        <Link
                          href={`/trips?user=${creator?.uid || trip.creatorId}`}
                          className="text-white font-semibold text-sm hover:opacity-70"
                        >
                          {creator?.name || 'Unknown User'}
                        </Link>
                        <p className="text-gray-400 text-xs" suppressHydrationWarning>
                          {mounted ? format(toDate(trip.createdAt), 'MMM dd, yyyy') : ''}
                        </p>
                      </div>
                    </div>
                    <div 
                      className="relative"
                      ref={(el) => {
                        menuRefs.current[trip.tripId] = el;
                      }}
                    >
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(prev => ({
                            ...prev,
                            [trip.tripId]: !prev[trip.tripId]
                          }));
                        }}
                        className="text-white"
                      >
                        <MdMoreVert className="w-5 h-5" />
                      </button>
                      {menuOpen[trip.tripId] && creator && user && creator.uid !== user.uid && (
                        <div className="absolute right-0 top-8 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 min-w-[120px]">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const token = await getIdToken();
                                const isFollowing = following.has(creator.uid);
                                if (isFollowing) {
                                  // Unfollow functionality can be added here if needed
                                  alert('Unfollow feature coming soon');
                                } else {
                                  await followUser(creator.uid, token);
                                  setFollowing(prev => new Set([...prev, creator.uid]));
                                  alert(`Now following ${creator.name}`);
                                }
                                setMenuOpen(prev => ({ ...prev, [trip.tripId]: false }));
                              } catch (error) {
                                console.error('Failed to follow user:', error);
                                alert('Failed to follow user');
                              }
                            }}
                            className="w-full px-4 py-2 text-left text-white text-sm hover:bg-gray-700 rounded-lg"
                          >
                            {following.has(creator.uid) ? 'Unfollow' : 'Follow'}
                          </button>
                        </div>
                      )}
                    </div>
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
                              : 'bg-blue-500 text-white'
                          }`}
                        >
                          {trip.status === 'completed' ? 'Completed' : 'Active'}
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
        )}

        {/* Loading More Indicator */}
        {loadingMore && (
          <div className="flex justify-center py-8">
            <div className="text-gray-400">Loading more trips...</div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 safe-area-inset-bottom">
        <div className="max-w-[600px] mx-auto flex items-center justify-around px-4 py-1.5">
          <Link href="/" className="text-white flex items-center justify-center p-1.5 rounded-full active:scale-95 active:bg-gray-800 transition-all">
            <MdHome className="w-6 h-6" />
          </Link>
          <Link href="/explore" className="text-gray-400 flex items-center justify-center p-1.5 rounded-full active:scale-95 active:bg-gray-800 transition-all">
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
