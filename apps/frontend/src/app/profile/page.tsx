'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import { getUserTrips, updateUser, getFollowing, unfollowUser, likeTrip, unlikeTrip, getTripLikes, getTripCommentCount } from '@/lib/api';
import type { Trip, User } from '@tripmatrix/types';
import { MdHome, MdArrowBack, MdLogout, MdPerson, MdMap, MdCheckCircle, MdTrendingUp, MdPublic, MdLock, MdClose, MdFavorite, MdChatBubbleOutline, MdMoreVert, MdLocationOn, MdAttachMoney, MdSearch, MdAdd, MdSettings } from 'react-icons/md';

export default function ProfilePage() {
  const { user, firebaseUser, loading: authLoading, signOut, getIdToken } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState<User[]>([]);
  const [followers, setFollowers] = useState<User[]>([]);
  const [likes, setLikes] = useState<Record<string, { count: number; isLiked: boolean }>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
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
      loadFollowers();
      setIsProfilePublic(user.isProfilePublic || false);
    }
  }, [user]);

  const loadUserTrips = async () => {
    try {
      const token = await getIdToken();
      if (token) {
        const userTrips = await getUserTrips(token);
        setTrips(userTrips);

        // Load likes and comment counts
        if (userTrips.length > 0) {
          const likesPromises = userTrips.map(async (trip: Trip) => {
            try {
              const likesData = await getTripLikes(trip.tripId, token);
              return { tripId: trip.tripId, ...likesData };
            } catch {
              return { tripId: trip.tripId, likeCount: 0, isLiked: false };
            }
          });

          const commentPromises = userTrips.map(async (trip: Trip) => {
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
          setLikes(likesMap);

          const commentsMap: Record<string, number> = {};
          commentResults.forEach(({ tripId, count }) => {
            commentsMap[tripId] = count;
          });
          setCommentCounts(commentsMap);
        }
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

  const loadFollowers = async () => {
    try {
      // TODO: Implement followers endpoint in backend
      // For now, we'll calculate from user data if available
      // This would require querying all users which is inefficient
      // A proper solution would need a backend endpoint
      setFollowers([]);
    } catch (error) {
      console.error('Failed to load followers:', error);
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
    <div className="h-full overflow-y-auto bg-black">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black border-b border-gray-800">
        <div className="max-w-[600px] mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-white">
            <MdArrowBack className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-semibold text-white">{user.name}</h1>
          <Link href="/profile/settings" className="text-white">
            <MdSettings className="w-6 h-6" />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[600px] mx-auto px-4 py-4 pb-20">
        {/* Profile Header - Instagram Style */}
        <div className="mb-6">
          <div className="flex items-center gap-6 mb-4">
            <div className="relative">
              {user.photoUrl ? (
                <img
                  src={user.photoUrl}
                  alt={user.name}
                  className="w-20 h-20 rounded-full object-cover border-2 border-gray-800"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center border-2 border-gray-800">
                  <MdPerson className="text-3xl text-white" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="text-center">
                  <div className="text-lg font-semibold text-white">{trips.length}</div>
                  <div className="text-xs text-gray-400">trips</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-white">{followers.length}</div>
                  <div className="text-xs text-gray-400">followers</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-white">{following.length}</div>
                  <div className="text-xs text-gray-400">following</div>
                </div>
              </div>
              <h2 className="text-sm font-semibold text-white mb-1">{user.name}</h2>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
          </div>

          {/* Profile Privacy Settings */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-800">
            <div className="flex items-center gap-2">
              {isProfilePublic ? (
                <MdPublic className="w-5 h-5 text-blue-500" />
              ) : (
                <MdLock className="w-5 h-5 text-gray-400" />
              )}
              <div>
                <p className="text-sm font-semibold text-white">Profile Privacy</p>
                <p className="text-xs text-gray-400">
                  {isProfilePublic ? 'Your profile is public' : 'Your profile is private'}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleProfilePrivacy}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isProfilePublic ? 'bg-blue-500' : 'bg-gray-700'
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

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-black border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <MdMap className="w-4 h-4 text-gray-400" />
              <p className="text-xs font-semibold text-gray-400">Total Trips</p>
            </div>
            <p className="text-xl font-bold text-white">{trips.length}</p>
          </div>
          <div className="bg-black border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <MdTrendingUp className="w-4 h-4 text-gray-400" />
              <p className="text-xs font-semibold text-gray-400">Active Trips</p>
            </div>
            <p className="text-xl font-bold text-white">{activeTrips}</p>
          </div>
          <div className="bg-black border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <MdCheckCircle className="w-4 h-4 text-gray-400" />
              <p className="text-xs font-semibold text-gray-400">Completed</p>
            </div>
            <p className="text-xl font-bold text-white">{completedTrips}</p>
          </div>
          <div className="bg-black border border-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <MdMap className="w-4 h-4 text-gray-400" />
              <p className="text-xs font-semibold text-gray-400">Kilometers</p>
            </div>
            <p className="text-xl font-bold text-white">
              {(totalDistance / 1000).toFixed(0)}
            </p>
          </div>
        </div>

        {/* Following List */}
        <div className="mb-6 bg-black border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Following</h2>
          {following.length === 0 ? (
            <div className="bg-black border border-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400 text-center">You&apos;re not following anyone yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {following.map((followedUser) => (
                <div
                  key={followedUser.uid}
                  className="bg-black border border-gray-800 rounded-lg p-3 flex items-center justify-between"
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
                      <p className="text-sm font-semibold text-white">{followedUser.name}</p>
                      <p className="text-xs text-gray-400">{followedUser.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnfollow(followedUser.uid)}
                    className="p-2 hover:bg-gray-900 rounded-lg transition-colors"
                    title="Unfollow"
                  >
                    <MdClose className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Trips */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">My Trips</h2>
          {trips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 bg-black border border-gray-800 rounded-lg">
              <MdLocationOn className="w-16 h-16 text-gray-600 mb-4" />
              <p className="text-gray-400 text-center mb-4">No trips yet</p>
              <Link
                href="/trips/new"
                className="px-6 py-2 bg-[#1976d2] text-white rounded-lg font-medium hover:bg-[#1565c0] transition-colors"
              >
                Create Your First Trip
              </Link>
            </div>
          ) : (
            <div className="space-y-8">
              {trips.map((trip) => (
                <div
                  key={trip.tripId}
                  className="bg-black border border-gray-800 rounded-lg overflow-hidden"
                >
                  {/* Post Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                    <div className="flex items-center gap-3">
                      {user.photoUrl ? (
                        <img
                          src={user.photoUrl}
                          alt={user.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                          <MdPerson className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div>
                        <Link
                          href="/profile"
                          className="text-white font-semibold text-sm hover:opacity-70"
                        >
                          {user.name}
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
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                          <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full blur-2xl opacity-30"></div>
                            <div className="relative bg-gradient-to-br from-blue-400 to-purple-500 rounded-full p-8">
                              <MdLocationOn className="w-20 h-20 text-white" />
                            </div>
                          </div>
                          <p className="mt-4 text-sm text-gray-400 font-medium">No Photo</p>
                          <p className="text-xs text-gray-500 mt-1">Add a cover image to make it beautiful</p>
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
                          <MdAttachMoney className="w-4 h-4" />
                          <span>{trip.totalExpense.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
              <Link href="/profile" className="text-white">
                <MdPerson className="w-6 h-6" />
              </Link>
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

