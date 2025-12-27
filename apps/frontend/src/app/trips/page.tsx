'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { getUserTrips } from '@/lib/api';
import type { Trip, User } from '@tripmatrix/types';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import { MdHome, MdPerson, MdAdd, MdSearch, MdFavorite, MdChatBubbleOutline, MdMoreVert, MdLocationOn, MdAttachMoney } from 'react-icons/md';

// Dynamically import UserMenu
const UserMenu = dynamic(() => import('@/components/UserMenu'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center gap-1">
      <div className="w-6 h-6 rounded-full bg-gray-400 animate-pulse" />
    </div>
  ),
});

export default function TripsPage() {
  const { user, loading: authLoading, getIdToken } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [userInfo, setUserInfo] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);

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
      setLoading(true);
      const token = await getIdToken();
      const userTrips = await getUserTrips(token);
      
      // Sort by date descending (newest first)
      const sorted = userTrips.sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
      });
      
      setTrips(sorted);

      // Set user info for display
      if (user) {
        setUserInfo(user);
      }
    } catch (error) {
      console.error('Failed to load trips:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="h-full overflow-y-auto bg-black">
      {/* Instagram-like Header */}
      <header className="sticky top-0 z-50 bg-black border-b border-gray-800">
        <div className="max-w-[600px] mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-white">My Trips</h1>
          <div className="flex items-center gap-4">
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Instagram-like Feed */}
      <main className="max-w-[600px] mx-auto pb-20">
        {trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <MdLocationOn className="w-16 h-16 text-gray-600 mb-4" />
            <p className="text-gray-400 text-center">No trips yet</p>
            <Link
              href="/trips/new"
              className="mt-4 px-6 py-2 bg-[#1976d2] text-white rounded-lg font-medium"
            >
              Create Your First Trip
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {trips.map((trip, index) => {
              const isLast = index === trips.length - 1;
              
              return (
                <div
                  key={trip.tripId}
                  ref={isLast ? (node: HTMLDivElement | null) => {
                    if (node && observerRef.current) {
                      observerRef.current.observe(node);
                    }
                  } : null}
                  className="bg-black border border-gray-800 rounded-lg overflow-hidden"
                >
                  {/* Post Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                    <div className="flex items-center gap-3">
                      {userInfo?.photoUrl ? (
                        <img
                          src={userInfo.photoUrl}
                          alt={userInfo.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                          <MdPerson className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div>
                        <Link
                          href="/trips"
                          className="text-white font-semibold text-sm hover:opacity-70"
                        >
                          {userInfo?.name || 'You'}
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
                      <button className="text-white hover:opacity-70">
                        <MdFavorite className="w-6 h-6" />
                      </button>
                      <Link href={`/trips/${trip.tripId}`} className="text-white hover:opacity-70">
                        <MdChatBubbleOutline className="w-6 h-6" />
                      </Link>
                    </div>

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
                          <MdAttachMoney className="w-4 h-4" />
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
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800">
        <div className="max-w-[600px] mx-auto flex items-center justify-around px-4 py-3">
          <Link href="/" className="text-gray-400">
            <MdHome className="w-6 h-6" />
          </Link>
          <Link href="/explore" className="text-gray-400">
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
