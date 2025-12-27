'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import { getUserTrips, updateUser, getFollowing, unfollowUser } from '@/lib/api';
import type { Trip, User } from '@tripmatrix/types';
import { MdHome, MdArrowBack, MdLogout, MdPerson, MdMap, MdCheckCircle, MdTrendingUp, MdPublic, MdLock, MdClose } from 'react-icons/md';

export default function ProfilePage() {
  const { user, firebaseUser, loading: authLoading, signOut, getIdToken } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState<User[]>([]);
  const [isProfilePublic, setIsProfilePublic] = useState(user?.isProfilePublic || false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadUserTrips();
      loadFollowing();
      setIsProfilePublic(user.isProfilePublic || false);
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

  const loadFollowing = async () => {
    try {
      const token = await getIdToken();
      if (token) {
        const followingList = await getFollowing(token);
        setFollowing(followingList);
      }
    } catch (error) {
      console.error('Failed to load following:', error);
    }
  };

  const handleToggleProfilePrivacy = async () => {
    try {
      setSaving(true);
      const token = await getIdToken();
      if (token) {
        await updateUser({ isProfilePublic: !isProfilePublic }, token);
        setIsProfilePublic(!isProfilePublic);
      }
    } catch (error) {
      console.error('Failed to update profile privacy:', error);
      alert('Failed to update profile privacy');
    } finally {
      setSaving(false);
    }
  };

  const handleUnfollow = async (userId: string) => {
    try {
      const token = await getIdToken();
      if (token) {
        await unfollowUser(userId, token);
        setFollowing(following.filter(u => u.uid !== userId));
      }
    } catch (error) {
      console.error('Failed to unfollow user:', error);
      alert('Failed to unfollow user');
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
      <div className="h-screen flex items-center justify-center bg-[#424242]">
        <div className="text-sm text-white">Loading...</div>
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
    <div className="h-screen bg-[#424242] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-600 flex-shrink-0">
        <Link href="/trips" className="w-10 h-10 flex items-center justify-center">
          <MdArrowBack className="text-white text-xl" />
        </Link>
        <h1 className="text-xs font-semibold text-white">Profile</h1>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: '32px' }}>
        {/* Profile Header */}
        <div className="mb-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="relative">
              {user.photoUrl ? (
                <img
                  src={user.photoUrl}
                  alt={user.name}
                  className="w-20 h-20 rounded-full object-cover border-2 border-gray-500"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center border-2 border-gray-500">
                  <MdPerson className="text-3xl text-white" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-[14px] font-semibold text-white mb-1">{user.name}</h2>
              <p className="text-[12px] text-gray-300 mb-2">{user.email}</p>
              <p className="text-[10px] text-gray-400">
                Member since {format(toDate(user.createdAt), 'MMMM yyyy')}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 rounded-lg border border-gray-600 hover:border-gray-500 text-white hover:bg-[#616161] transition-colors text-[12px] font-medium flex items-center gap-2"
            >
              <MdLogout className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Profile Privacy Settings */}
        <div className="bg-[#616161] rounded-lg p-4 border border-gray-600 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isProfilePublic ? (
                <MdPublic className="w-4 h-4 text-[#1976d2]" />
              ) : (
                <MdLock className="w-4 h-4 text-gray-400" />
              )}
              <div>
                <p className="text-[12px] font-semibold text-white">Profile Privacy</p>
                <p className="text-[10px] text-gray-300">
                  {isProfilePublic ? 'Your profile is public' : 'Your profile is private'}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleProfilePrivacy}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isProfilePublic ? 'bg-[#1976d2]' : 'bg-[#757575]'
              } ${saving ? 'opacity-50' : ''}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isProfilePublic ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Following List */}
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-white mb-3">Following</h2>
          {following.length === 0 ? (
            <div className="bg-[#616161] rounded-lg p-4 border border-gray-600">
              <p className="text-[12px] text-gray-300 text-center">You're not following anyone yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {following.map((followedUser) => (
                <div
                  key={followedUser.uid}
                  className="bg-[#616161] rounded-lg p-3 border border-gray-600 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    {followedUser.photoUrl ? (
                      <img
                        src={followedUser.photoUrl}
                        alt={followedUser.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                        <MdPerson className="text-xl text-white" />
                      </div>
                    )}
                    <div>
                      <p className="text-[12px] font-semibold text-white">{followedUser.name}</p>
                      <p className="text-[10px] text-gray-400">{followedUser.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnfollow(followedUser.uid)}
                    className="p-2 hover:bg-[#757575] rounded-lg transition-colors"
                    title="Unfollow"
                  >
                    <MdClose className="w-4 h-4 text-gray-300" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[#616161] rounded-lg p-4 border border-gray-600">
            <div className="flex items-center gap-2 mb-2">
              <MdMap className="w-4 h-4 text-gray-300" />
              <p className="text-[10px] font-semibold text-gray-300">Total Trips</p>
            </div>
            <p className="text-[18px] font-bold text-white">{trips.length}</p>
          </div>
          <div className="bg-[#616161] rounded-lg p-4 border border-gray-600">
            <div className="flex items-center gap-2 mb-2">
              <MdTrendingUp className="w-4 h-4 text-gray-300" />
              <p className="text-[10px] font-semibold text-gray-300">Active Trips</p>
            </div>
            <p className="text-[18px] font-bold text-white">{activeTrips}</p>
          </div>
          <div className="bg-[#616161] rounded-lg p-4 border border-gray-600">
            <div className="flex items-center gap-2 mb-2">
              <MdCheckCircle className="w-4 h-4 text-gray-300" />
              <p className="text-[10px] font-semibold text-gray-300">Completed</p>
            </div>
            <p className="text-[18px] font-bold text-white">{completedTrips}</p>
          </div>
          <div className="bg-[#616161] rounded-lg p-4 border border-gray-600">
            <div className="flex items-center gap-2 mb-2">
              <MdMap className="w-4 h-4 text-gray-300" />
              <p className="text-[10px] font-semibold text-gray-300">Kilometers</p>
            </div>
            <p className="text-[18px] font-bold text-white">
              {(totalDistance / 1000).toFixed(0)}
            </p>
          </div>
        </div>

        {/* Recent Trips */}
        <div>
          <h2 className="text-xs font-semibold text-white mb-4">My Trips</h2>
          {trips.length === 0 ? (
            <div className="text-center py-12 bg-[#616161] rounded-lg border border-gray-600">
              <MdMap className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-[12px] text-gray-300 mb-4">No trips yet</p>
              <Link
                href="/trips/new"
                className="inline-block bg-[#1976d2] text-white px-6 py-3 rounded-lg hover:bg-[#1565c0] transition-colors text-[12px] font-medium"
              >
                Create Your First Trip
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {trips.map((trip) => (
                <Link
                  key={trip.tripId}
                  href={`/trips/${trip.tripId}`}
                  className="block"
                >
                  <div className="bg-[#616161] rounded-lg border border-gray-600 overflow-hidden">
                    <div className="relative aspect-[4/3]">
                      {trip.coverImage ? (
                        <img
                          src={trip.coverImage}
                          alt={trip.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#757575]">
                          <MdHome className="w-12 h-12 text-gray-400" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2">
                        <span
                          className={`px-2 py-1 rounded text-[10px] font-semibold ${
                            trip.status === 'completed'
                              ? 'bg-green-500 text-white'
                              : 'bg-blue-500 text-white'
                          }`}
                        >
                          {trip.status === 'completed' ? 'Completed' : 'Active'}
                        </span>
                      </div>
                    </div>
                    <div className="p-3">
                      <h3 className="text-[12px] font-semibold text-white mb-1">
                        {trip.title}
                      </h3>
                      <p className="text-[10px] text-gray-400">
                        {format(toDate(trip.startTime), 'MMM yyyy')}
                      </p>
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

