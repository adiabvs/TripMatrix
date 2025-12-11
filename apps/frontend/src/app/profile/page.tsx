'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import { getUserTrips } from '@/lib/api';
import type { Trip } from '@tripmatrix/types';

export default function ProfilePage() {
  const { user, firebaseUser, loading: authLoading, signOut, getIdToken } = useAuth();
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
      loadUserTrips();
    }
  }, [user]);

  const loadUserTrips = async () => {
    try {
      const token = await getIdToken();
      if (token) {
        const userTrips = await getUserTrips(token);
        setTrips(userTrips);
      }
    } catch (error) {
      console.error('Failed to load trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      // Redirect to home page first, then sign out
      router.replace('/');
      await signOut();
    } catch (error) {
      console.error('Failed to sign out:', error);
      // Still redirect to home even if sign out fails
      router.replace('/');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const completedTrips = trips.filter((t) => t.status === 'completed').length;
  const activeTrips = trips.filter((t) => t.status === 'in_progress').length;
  const totalDistance = trips.reduce((sum, t) => sum + (t.totalDistance || 0), 0);
  const totalExpenses = trips.reduce((sum, t) => sum + (t.totalExpense || 0), 0);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/trips" className="text-2xl font-bold text-gray-900 tracking-tight">
            TripMatrix
          </Link>
          <Link
            href="/trips"
            className="text-gray-700 hover:text-gray-900 transition-colors text-sm font-medium"
          >
            Back to Trips
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Profile Header */}
        <div className="mb-12">
          <div className="flex items-start gap-6 mb-8">
            <div className="relative">
              {user.photoUrl ? (
                <img
                  src={user.photoUrl}
                  alt={user.name}
                  className="w-24 h-24 rounded-full object-cover border-4 border-gray-100"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center border-4 border-gray-100">
                  <span className="text-3xl font-bold text-white">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">{user.name}</h1>
              <p className="text-gray-600 mb-4">{user.email}</p>
              <p className="text-sm text-gray-500">
                Member since {format(toDate(user.createdAt), 'MMMM yyyy')}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="px-5 py-2.5 rounded-full border border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 transition-colors text-sm font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
            <p className="text-3xl font-bold text-gray-900 mb-1">{trips.length}</p>
            <p className="text-sm text-gray-600">Total Trips</p>
          </div>
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
            <p className="text-3xl font-bold text-gray-900 mb-1">{activeTrips}</p>
            <p className="text-sm text-gray-600">Active Trips</p>
          </div>
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
            <p className="text-3xl font-bold text-gray-900 mb-1">{completedTrips}</p>
            <p className="text-sm text-gray-600">Completed</p>
          </div>
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {(totalDistance / 1000).toFixed(0)}
            </p>
            <p className="text-sm text-gray-600">Kilometers</p>
          </div>
        </div>

        {/* Recent Trips */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">My Trips</h2>
          {trips.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-2xl">
              <p className="text-gray-600 mb-4">No trips yet</p>
              <Link
                href="/trips/new"
                className="inline-block bg-black text-white px-6 py-3 rounded-full hover:bg-gray-800 transition-colors font-medium"
              >
                Create Your First Trip
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        <svg
                          className="w-16 h-16 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 22V12h6v10"
                          />
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
                    <p className="text-xs text-gray-500">
                      {format(toDate(trip.startTime), 'MMM yyyy')}
                    </p>
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

