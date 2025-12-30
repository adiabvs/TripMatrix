'use client';

import { useAuth } from '@/lib/auth';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import { getUser, getUserTrips, getFollowing, followUser, unfollowUser, likeTrip, unlikeTrip, getTripLikes, getTripCommentCount, getFollowingForUser, getFollowersForUser } from '@/lib/api';
import type { Trip, User } from '@tripmatrix/types';
import { MdHome, MdArrowBack, MdPerson, MdFavorite, MdChatBubbleOutline, MdPublic, MdLock, MdLocationOn, MdMonetizationOn } from 'react-icons/md';

export default function UserProfilePage() {
  const { user: currentUser, getIdToken } = useAuth();
  const router = useRouter();
  const params = useParams();
  const userId = params?.userId as string;
  
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState<User[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [likes, setLikes] = useState<Record<string, { count: number; isLiked: boolean }>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [canViewFollowersFollowing, setCanViewFollowersFollowing] = useState(false);

  useEffect(() => {
    if (userId) {
      loadUserProfile();
    }
  }, [userId, currentUser]);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      const token = currentUser ? await getIdToken() : null;
      
      // Load user profile
      const user = await getUser(userId, token);
      setProfileUser(user);
      
      // Check if current user follows this user
      if (currentUser && currentUser.uid !== userId) {
        const followingList = await getFollowing(token);
        setIsFollowing(followingList.some(u => u.uid === userId));
      } else {
        setIsFollowing(false);
      }
      
      // Load user trips (only public trips if profile is private and not following)
      const isProfilePublic = user.isProfilePublic || false;
      const canViewAllTrips = currentUser?.uid === userId || isProfilePublic || isFollowing;
      
      if (canViewAllTrips) {
        // Load all trips where user is creator or participant
        const userTrips = await getUserTrips(token);
        // Filter to only trips created by this user
        const createdTrips = userTrips.filter(trip => trip.creatorId === userId);
        setTrips(createdTrips);
      } else {
        // Only show public trips
        const userTrips = await getUserTrips(token);
        const publicTrips = userTrips.filter(trip => trip.creatorId === userId && trip.isPublic);
        setTrips(publicTrips);
      }
      
      // Load following and followers counts (only if can view)
      const isOwnProfile = currentUser?.uid === userId;
      const canViewFollowersFollowing = isOwnProfile || isProfilePublic || isFollowing;
      setCanViewFollowersFollowing(canViewFollowersFollowing);
      
      if (canViewFollowersFollowing) {
        try {
          const followingList = await getFollowingForUser(userId, token);
          setFollowingCount(followingList.length);
        } catch (error: any) {
          // If error is about private profile, that's expected
          if (error.message?.includes('private') || error.message?.includes('Cannot view')) {
            setCanViewFollowersFollowing(false);
          } else {
            console.error('Failed to load following count:', error);
          }
        }
        
        try {
          const followersList = await getFollowersForUser(userId, token);
          setFollowersCount(followersList.length);
        } catch (error: any) {
          // If error is about private profile, that's expected
          if (error.message?.includes('private') || error.message?.includes('Cannot view')) {
            setCanViewFollowersFollowing(false);
          } else {
            console.error('Failed to load followers count:', error);
          }
        }
      } else {
        setCanViewFollowersFollowing(false);
      }
      
      // Load likes and comment counts
      if (trips.length > 0) {
        const likesPromises = trips.map(async (trip: Trip) => {
          try {
            const likesData = await getTripLikes(trip.tripId, token);
            return { tripId: trip.tripId, ...likesData };
          } catch {
            return { tripId: trip.tripId, likeCount: 0, isLiked: false };
          }
        });

        const commentPromises = trips.map(async (trip: Trip) => {
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
    } catch (error: any) {
      console.error('Failed to load user profile:', error);
      if (error.message?.includes('Profile is private')) {
        // Show limited view
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!currentUser) {
      router.push('/auth');
      return;
    }
    
    try {
      const token = await getIdToken();
      if (isFollowing) {
        await unfollowUser(userId, token);
        setIsFollowing(false);
      } else {
        await followUser(userId, token);
        setIsFollowing(true);
        // Reload trips to show all if profile was private
        loadUserProfile();
      }
    } catch (error) {
      console.error('Failed to follow/unfollow user:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">User not found</div>
      </div>
    );
  }

  const isOwnProfile = currentUser?.uid === userId;
  const isProfilePublic = profileUser.isProfilePublic || false;
  const canViewAllTrips = isOwnProfile || isProfilePublic || isFollowing;

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black border-b border-gray-800">
        <div className="max-w-[600px] mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-white">
            <MdArrowBack className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-semibold text-white">{profileUser.name || 'User'}</h1>
        </div>
      </header>

      <main className="max-w-[600px] mx-auto">
        {/* Profile Info */}
        <div className="px-4 py-6 border-b border-gray-800">
          <div className="flex items-start gap-4 mb-4">
            {profileUser.photoUrl ? (
              <img
                src={profileUser.photoUrl}
                alt={profileUser.name}
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                <MdPerson className="w-10 h-10 text-white" />
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-white mb-1">{profileUser.name || 'User'}</h2>
              <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                <span>{trips.length} {trips.length === 1 ? 'trip' : 'trips'}</span>
                {canViewFollowersFollowing && (
                  <>
                    <Link href={`/users/${userId}/followers`} className="hover:opacity-70 transition-opacity">
                      <span>{followersCount} {followersCount === 1 ? 'follower' : 'followers'}</span>
                    </Link>
                    <Link href={`/users/${userId}/following`} className="hover:opacity-70 transition-opacity">
                      <span>{followingCount} {followingCount === 1 ? 'following' : 'followings'}</span>
                    </Link>
                  </>
                )}
              </div>
              {!isOwnProfile && currentUser && (
                <button
                  onClick={handleFollow}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    isFollowing
                      ? 'bg-gray-800 text-white hover:bg-gray-700'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
            <div className="text-gray-400">
              {isProfilePublic ? <MdPublic className="w-5 h-5" /> : <MdLock className="w-5 h-5" />}
            </div>
          </div>
        </div>

        {/* Trips */}
        {trips.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-gray-400">No trips yet</p>
          </div>
        ) : (
          <div className="space-y-8">
            {trips.map((trip) => (
              <div
                key={trip.tripId}
                className="bg-black border border-gray-800 rounded-lg overflow-hidden"
              >
                {/* Cover Image */}
                {trip.coverImage && (
                  <Link href={`/trips/${trip.tripId}`}>
                    <img
                      src={trip.coverImage}
                      alt={trip.title}
                      className="w-full h-64 object-cover"
                    />
                  </Link>
                )}

                {/* Trip Info */}
                <div className="p-4">
                  <Link href={`/trips/${trip.tripId}`}>
                    <h3 className="text-lg font-semibold text-white mb-2">{trip.title}</h3>
                    {trip.description && (
                      <p className="text-gray-400 text-sm mb-3">{trip.description}</p>
                    )}
                  </Link>

                  {/* Trip Meta */}
                  <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                    {trip.startTime && (
                      <span suppressHydrationWarning>
                        {format(toDate(trip.startTime), 'MMM dd, yyyy')}
                      </span>
                    )}
                    <span className="capitalize">{trip.status?.replace('_', ' ')}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-4">
                    <button
                      onClick={async () => {
                        if (!currentUser) {
                          router.push('/auth');
                          return;
                        }
                        try {
                          const token = await getIdToken();
                          if (likes[trip.tripId]?.isLiked) {
                            await unlikeTrip(trip.tripId, token);
                            setLikes(prev => ({
                              ...prev,
                              [trip.tripId]: {
                                count: (prev[trip.tripId]?.count || 0) - 1,
                                isLiked: false,
                              },
                            }));
                          } else {
                            await likeTrip(trip.tripId, token);
                            setLikes(prev => ({
                              ...prev,
                              [trip.tripId]: {
                                count: (prev[trip.tripId]?.count || 0) + 1,
                                isLiked: true,
                              },
                            }));
                          }
                        } catch (error) {
                          console.error('Failed to like/unlike trip:', error);
                        }
                      }}
                      className="text-white hover:bg-gray-900 active:bg-gray-800 rounded-lg p-1.5 flex items-center gap-1 transition-all duration-200 active:scale-95"
                    >
                      <MdFavorite className={`w-6 h-6 transition-all duration-200 ${likes[trip.tripId]?.isLiked ? 'text-red-500 fill-red-500' : ''}`} />
                    </button>
                    <Link 
                      href={`/trips/${trip.tripId}`} 
                      className="text-white hover:bg-gray-900 active:bg-gray-800 rounded-lg p-1.5 flex items-center gap-1 transition-all duration-200 active:scale-95"
                    >
                      <MdChatBubbleOutline className="w-6 h-6" />
                    </Link>
                  </div>
                  {(likes[trip.tripId]?.count > 0 || commentCounts[trip.tripId] > 0) && (
                    <div className="flex items-center gap-4 text-sm mt-2">
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
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

