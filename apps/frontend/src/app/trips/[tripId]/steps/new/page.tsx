'use client';

import { useAuth } from '@/lib/auth';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getTrip, addPlace, getTripPlaces } from '@/lib/api';
import type { Trip, TripPlace } from '@tripmatrix/types';
import PlaceForm from '@/components/PlaceForm';
import { toDate } from '@/lib/dateUtils';

export default function NewStepPage() {
  const { user, loading: authLoading, getIdToken } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tripId = params.tripId as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [places, setPlaces] = useState<TripPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [previousPlace, setPreviousPlace] = useState<TripPlace | null>(null);
  const [nextPlace, setNextPlace] = useState<TripPlace | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (tripId && user) {
      loadTripData();
      getIdToken().then(setToken).catch(console.error);
    }
  }, [tripId, user]);


  const loadTripData = async () => {
    try {
      const token = await getIdToken();
      const [tripData, placesData] = await Promise.all([
        getTrip(tripId, token),
        getTripPlaces(tripId, token),
      ]);

      setTrip(tripData);
      
      // Sort places by visitedAt
      const sortedPlaces = [...placesData].sort(
        (a, b) => toDate(a.visitedAt).getTime() - toDate(b.visitedAt).getTime()
      );
      setPlaces(sortedPlaces);
      
      // Set the previous and next place based on URL param or last place
      const urlParams = new URLSearchParams(window.location.search);
      const afterPlaceId = urlParams.get('after');
      if (afterPlaceId) {
        // Find the place we're inserting after
        const afterIndex = sortedPlaces.findIndex(p => p.placeId === afterPlaceId);
        if (afterIndex >= 0) {
          setPreviousPlace(sortedPlaces[afterIndex]);
          // The next place is the one that comes after the insertion point
          if (afterIndex + 1 < sortedPlaces.length) {
            setNextPlace(sortedPlaces[afterIndex + 1]);
          }
        } else if (sortedPlaces.length > 0) {
          setPreviousPlace(sortedPlaces[sortedPlaces.length - 1]);
        }
      } else if (sortedPlaces.length > 0) {
        setPreviousPlace(sortedPlaces[sortedPlaces.length - 1]);
      }
    } catch (error) {
      console.error('Failed to load trip data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlace = async (placeData: Partial<TripPlace> & { previousPlace?: TripPlace | null; nextPlace?: TripPlace | null }) => {
    if (!token) {
      alert('Authentication token is missing. Please log in again.');
      return;
    }
    try {
      // Remove previousPlace and nextPlace from the data sent to API
      // nextPlaceId will be sent separately if inserting between steps
      const { previousPlace, nextPlace, ...dataToSend } = placeData;
      
      // If inserting between steps, include nextPlaceId so backend can update it
      if (nextPlace) {
        (dataToSend as any).nextPlaceId = nextPlace.placeId;
      }
      
      const createdPlace = await addPlace(dataToSend, token);
      
      // Check if there's a pending expense to add
      const pendingExpense = (window as any).pendingExpenseForPlace;
      if (pendingExpense && createdPlace?.placeId) {
        try {
          const { createExpense } = await import('@/lib/api');
          await createExpense({
            ...pendingExpense,
            placeId: createdPlace.placeId,
          }, token);
          delete (window as any).pendingExpenseForPlace;
        } catch (error) {
          console.error('Failed to add expense:', error);
          // Don't block navigation if expense fails
        }
      }
      
      // Redirect back to trip detail page
      router.push(`/trips/${tripId}`);
    } catch (error: any) {
      console.error('Failed to add place:', error);
      alert(`Failed to add place: ${error.message || 'Unknown error'}`);
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

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-700">Trip not found</div>
      </div>
    );
  }

  const isCreator = user?.uid === trip.creatorId;
  if (!isCreator) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-700">You don't have permission to add steps to this trip</div>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Add Step</h1>
          <p className="text-gray-600">Add a new step to {trip.title}</p>
        </div>

        <PlaceForm
          tripId={tripId}
          onSubmit={handleAddPlace}
          onCancel={() => router.push(`/trips/${tripId}`)}
          token={token}
          previousPlace={previousPlace}
          nextPlace={nextPlace}
        />
      </div>
    </div>
  );
}

