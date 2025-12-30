'use client';

import { useAuth } from '@/lib/auth';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { getFollowersForUser } from '@/lib/api';
import type { User } from '@tripmatrix/types';
import { MdHome, MdArrowBack, MdPerson } from 'react-icons/md';

export default function UserFollowersPage() {
  const { user: currentUser, getIdToken } = useAuth();
  const router = useRouter();
  const params = useParams();
  const userId = params?.userId as string;
  const [followers, setFollowers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastUserElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore();
      }
    });
    if (node) observerRef.current.observe(node);
  }, [loading, hasMore]);

  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    if (userId) {
      loadFollowers();
    }
  }, [userId, currentUser]);

  const loadFollowers = async () => {
    try {
      setLoading(true);
      const token = currentUser ? await getIdToken() : null;
      if (token && userId) {
        const allFollowers = await getFollowersForUser(userId, token);
        setFollowers(allFollowers);
        setHasMore(allFollowers.length > ITEMS_PER_PAGE);
      }
    } catch (error: any) {
      console.error('Failed to load followers:', error);
      if (error.message?.includes('private') || error.message?.includes('Cannot view')) {
        // Profile is private and user doesn't have access
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!hasMore || loading) return;
    setPage(prev => prev + 1);
  };

  const displayedFollowers = followers.slice(0, (page + 1) * ITEMS_PER_PAGE);
  const hasMoreToShow = followers.length > displayedFollowers.length;

  if (loading && followers.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <div className="text-sm text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-black">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black border-b border-gray-800">
        <div className="max-w-[600px] mx-auto px-4 py-3 flex items-center gap-3">
          <Link 
            href={`/users/${userId}`} 
            className="text-white hover:bg-gray-900 active:bg-gray-800 rounded-lg p-1.5 transition-all duration-200 active:scale-95"
          >
            <MdArrowBack className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-semibold text-white">Followers</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[600px] mx-auto px-4 py-4 pb-20">
        {followers.length === 0 ? (
          <div className="bg-black border border-gray-800 rounded-lg p-8 text-center">
            <p className="text-sm text-gray-400">No followers yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayedFollowers.map((follower, index) => (
              <div
                key={follower.uid}
                ref={index === displayedFollowers.length - 1 ? lastUserElementRef : null}
                className="bg-black border border-gray-800 rounded-lg p-3 flex items-center justify-between"
              >
                <Link 
                  href={`/users/${follower.uid}`}
                  className="flex items-center gap-3 flex-1"
                >
                  {follower.photoUrl ? (
                    <img
                      src={follower.photoUrl}
                      alt={follower.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                      <MdPerson className="text-xl text-white" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-white">{follower.name}</p>
                    <p className="text-xs text-gray-400">{follower.email}</p>
                  </div>
                </Link>
              </div>
            ))}
            {hasMoreToShow && (
              <div className="text-center py-4">
                <div className="text-sm text-gray-400">Loading more...</div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 safe-area-inset-bottom">
        <div className="max-w-[600px] mx-auto flex items-center justify-around px-4 py-1.5">
          <Link href="/" className="text-gray-400 flex items-center justify-center p-1.5 rounded-full active:scale-95 active:bg-gray-800 transition-all">
            <MdHome className="w-6 h-6" />
          </Link>
        </div>
      </nav>
    </div>
  );
}

