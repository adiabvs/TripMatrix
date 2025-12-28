'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';
import { FaGoogle } from 'react-icons/fa';
import { MdHome } from 'react-icons/md';

export default function AuthPage() {
  const { signIn, user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/profile');
    }
  }, [user, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-gray-600 border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Instagram-like Header */}
      <header className="sticky top-0 z-50 bg-black border-b border-gray-800">
        <div className="max-w-[600px] mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-xl font-semibold text-white hover:opacity-70">
            TripMatrix
          </Link>
          <Link 
            href="/"
            className="text-white text-sm font-medium hover:opacity-70"
          >
            <MdHome className="w-6 h-6" />
          </Link>
        </div>
      </header>

      {/* Auth Content */}
      <main className="max-w-[600px] mx-auto px-4 py-12">
        <div className="bg-black border border-gray-800 rounded-lg overflow-hidden">
          <div className="px-6 py-8">
            <h1 className="text-2xl font-semibold text-white text-center mb-2">
              Welcome to TripMatrix
            </h1>
            <p className="text-gray-400 text-center mb-8">
              Sign in with your Google account to start tracking your trips
            </p>
            
            <div className="space-y-3">
              <button
                onClick={signIn}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#4285F4] hover:bg-[#357AE8] text-white font-medium rounded-lg transition-colors"
              >
                <FaGoogle className="w-5 h-5" />
                Sign in with Google
              </button>
              
              <Link href="/" className="block">
                <button
                  className="w-full px-4 py-3 bg-transparent border border-gray-700 hover:border-gray-600 text-white font-medium rounded-lg transition-colors"
                >
                  Continue without signing in
                </button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
