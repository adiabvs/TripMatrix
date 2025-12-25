'use client';

import { useAuth } from '@/lib/auth';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getTrip, updateExpense, getTripExpenses } from '@/lib/api';
import type { Trip, TripExpense } from '@tripmatrix/types';
import ExpenseForm from '@/components/ExpenseForm';

export default function EditExpensePage() {
  const { user, loading: authLoading, getIdToken } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tripId = params.tripId as string;
  const expenseId = params.expenseId as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [expense, setExpense] = useState<TripExpense | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [placeCountry, setPlaceCountry] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (tripId && expenseId && user) {
      loadData();
      getIdToken().then(setToken).catch(console.error);
    }
  }, [tripId, expenseId, user]);

  const loadData = async () => {
    try {
      const token = await getIdToken();
      const [tripData, expenses] = await Promise.all([
        getTrip(tripId, token),
        getTripExpenses(tripId, token),
      ]);
      setTrip(tripData);
      const expenseData = expenses.find(e => e.expenseId === expenseId);
      if (!expenseData) {
        alert('Expense not found');
        router.push(`/trips/${tripId}`);
        return;
      }
      setExpense(expenseData);
    } catch (error) {
      console.error('Failed to load data:', error);
      alert('Failed to load expense data');
      router.push(`/trips/${tripId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateExpense = async (expenseData: Partial<TripExpense>) => {
    if (!token) {
      alert('Authentication token is missing. Please log in again.');
      return;
    }
    try {
      await updateExpense(expenseId, expenseData, token);
      router.push(`/trips/${tripId}`);
    } catch (error: any) {
      console.error('Failed to update expense:', error);
      alert(`Failed to update expense: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-700">Loading...</div>
      </div>
    );
  }

  if (!trip || !expense) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-700">Expense not found</div>
      </div>
    );
  }

  const isCreator = user?.uid === trip.creatorId;
  if (!isCreator && !trip.participants.some(p => p.uid === user?.uid)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-700">You don&apos;t have permission to edit expenses for this trip</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link
            href={`/trips/${tripId}`}
            className="text-gray-700 hover:text-gray-900 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Trip
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Expense</h1>
          <p className="text-gray-600">Edit expense for {trip.title}</p>
        </div>

        <ExpenseForm
          tripId={tripId}
          participants={trip.participants || []}
          onSubmit={handleUpdateExpense}
          onCancel={() => router.push(`/trips/${tripId}`)}
          placeId={expense.placeId}
          placeCountry={placeCountry}
          initialData={expense}
        />
      </div>
    </div>
  );
}


