'use client';

import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/trips');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-6xl font-bold text-gray-900 mb-6">
            TripMatrix
          </h1>
          <p className="text-xl text-gray-700 mb-12">
            Your trip-logging and social travel tracking platform
          </p>
          
          {!user ? (
            <div className="space-y-4">
              <p className="text-gray-600 mb-8">
                Sign in with Google to start tracking your trips
              </p>
              <Link
                href="/auth"
                className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Get Started
              </Link>
            </div>
          ) : (
            <Link
              href="/trips"
              className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Go to My Trips
            </Link>
          )}

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-2">Track Routes</h3>
              <p className="text-gray-600">
                Record your journey with real-time GPS tracking and beautiful maps
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-2">Log Places</h3>
              <p className="text-gray-600">
                Rate and comment on places you visit, enhanced with AI rewriting
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-2">Split Expenses</h3>
              <p className="text-gray-600">
                Automatically calculate and split expenses among trip participants
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

