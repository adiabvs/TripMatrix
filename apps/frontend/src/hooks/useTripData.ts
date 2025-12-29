import { useState, useCallback } from 'react';
import type React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
  getTrip,
  getTripRoutes,
  getTripExpenses,
  getTripPlaces,
  getExpenseSummary,
  getUser,
} from '@/lib/api';
import type { Trip, TripRoute, TripPlace, TripExpense, ExpenseSummary, User } from '@tripmatrix/types';
import { toDate } from '@/lib/dateUtils';

export interface UseTripDataReturn {
  trip: Trip | null;
  routes: TripRoute[];
  places: TripPlace[];
  expenses: TripExpense[];
  expenseSummary: ExpenseSummary | null;
  creator: User | null;
  participants: User[];
  loading: boolean;
  error: string | null;
  loadTripData: (authToken?: string | null) => Promise<void>;
  refreshTrip: () => Promise<void>;
  setPlaces: React.Dispatch<React.SetStateAction<TripPlace[]>>;
  setExpenses: React.Dispatch<React.SetStateAction<TripExpense[]>>;
}

export function useTripData(tripId: string): UseTripDataReturn {
  const { user, loading: authLoading, getIdToken } = useAuth();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [routes, setRoutes] = useState<TripRoute[]>([]);
  const [places, setPlaces] = useState<TripPlace[]>([]);
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [expenseSummary, setExpenseSummary] = useState<ExpenseSummary | null>(null);
  const [creator, setCreator] = useState<User | null>(null);
  const [participants, setParticipants] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTripData = useCallback(async (authToken?: string | null) => {
    try {
      setError(null);
      // Use provided token or try to get one if user is logged in
      let token: string | null = authToken ?? null;
      if (!token && user) {
        try {
          token = await getIdToken(false);
          if (!token) {
            token = await getIdToken(true);
          }
        } catch (error) {
          console.log('No token available, attempting to load as public trip');
        }
      }

      // Try to load trip data (works for public trips without auth)
      const [tripData, routesData, expensesData, placesData] = await Promise.all([
        getTrip(tripId, token).catch((err: any) => {
          const status = err.status || 0;
          const message = err.message || '';
          // Only redirect if user is definitely not logged in (not just token issue)
          if ((status === 401 || message.includes('Authentication required') || message.includes('401')) && !user && !authLoading) {
            router.push('/auth');
            throw err;
          }
          throw err;
        }),
        getTripRoutes(tripId, token).catch(() => []),
        getTripExpenses(tripId, token).catch(() => []),
        getTripPlaces(tripId, token).catch(() => []),
      ]);

      setTrip(tripData);
      setRoutes(routesData);
      setExpenses(expensesData);
      setPlaces(placesData.sort((a, b) => toDate(a.visitedAt).getTime() - toDate(b.visitedAt).getTime()));

      // Load creator info
      try {
        const creatorData = await getUser(tripData.creatorId, token);
        setCreator(creatorData);
      } catch (error) {
        console.error('Failed to load creator:', error);
      }

      // Load participants info (include both accepted and pending)
      if (tripData.participants && tripData.participants.length > 0) {
        try {
          const participantUsers = await Promise.all(
            tripData.participants
              .filter((p: any) => p.uid && !p.isGuest)
              .map(async (p: any) => {
                try {
                  return await getUser(p.uid, token);
                } catch {
                  return null;
                }
              })
          );
          // Include all participants (accepted and pending) - filtering by status happens in display component
          setParticipants(participantUsers.filter((u): u is User => u !== null));
        } catch (error) {
          console.error('Failed to load participants:', error);
        }
      }

      // Load expense summary if trip is completed
      if (tripData.status === 'completed') {
        try {
          const summary = await getExpenseSummary(tripId, token);
          setExpenseSummary(summary);
        } catch (error) {
          console.error('Failed to load expense summary:', error);
        }
      }
    } catch (error: any) {
      console.error('Failed to load trip data:', error);
      // Only redirect if user is definitely not logged in (not just token issue)
      if ((error.message?.includes('Authentication required') || error.message?.includes('401')) && !user && !authLoading) {
        router.push('/auth');
      }
      setError(error.message || 'Failed to load trip');
    } finally {
      setLoading(false);
    }
  }, [tripId, user, authLoading, getIdToken, router]);

  const refreshTrip = useCallback(async () => {
    setLoading(true);
    await loadTripData();
  }, [loadTripData]);

  return {
    trip,
    routes,
    places,
    expenses,
    expenseSummary,
    creator,
    participants,
    loading,
    error,
    loadTripData,
    refreshTrip,
    setPlaces,
    setExpenses,
  };
}

