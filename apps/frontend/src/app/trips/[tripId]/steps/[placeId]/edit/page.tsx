'use client';

import { useAuth } from '@/lib/auth';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getTrip, getTripPlaces, updatePlace } from '@/lib/api';
import type { Trip, TripPlace } from '@tripmatrix/types';
import PlaceForm from '@/components/PlaceForm';
import { toDate } from '@/lib/dateUtils';

export default function EditStepPage() {
  const { user, loading: authLoading, getIdToken } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tripId = params.tripId as string;
  const placeId = params.placeId as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [place, setPlace] = useState<TripPlace | null>(null);
  const [places, setPlaces] = useState<TripPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [previousPlace, setPreviousPlace] = useState<TripPlace | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (tripId && placeId && user) {
      loadTripData();
      getIdToken().then(setToken).catch(console.error);
    }
  }, [tripId, placeId, user]);

  const loadTripData = async () => {
    try {
      const token = await getIdToken();
      const [tripData, placesData] = await Promise.all([
        getTrip(tripId, token),
        getTripPlaces(tripId, token),
      ]);

      setTrip(tripData);
      
      // Find the current place
      const currentPlace = placesData.find(p => p.placeId === placeId);
      if (!currentPlace) {
        throw new Error('Place not found');
      }
      setPlace(currentPlace);
      
      // Sort places by visitedAt
      const sortedPlaces = [...placesData].sort(
        (a, b) => toDate(a.visitedAt).getTime() - toDate(b.visitedAt).getTime()
      );
      setPlaces(sortedPlaces);
      
      // Find the previous place (the one before current in timeline)
      const currentIndex = sortedPlaces.findIndex(p => p.placeId === placeId);
      if (currentIndex > 0) {
        setPreviousPlace(sortedPlaces[currentIndex - 1]);
      }
    } catch (error) {
      console.error('Failed to load trip data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePlace = async (placeData: Partial<TripPlace> & { previousPlace?: TripPlace | null }) => {
    if (!token) {
      alert('Authentication token is missing. Please log in again.');
      return;
    }
    try {
      // Remove previousPlace from the data sent to API
      const { previousPlace, ...dataToSend } = placeData;
      await updatePlace(placeId, dataToSend, token);
      
      // Redirect back to trip detail page
      router.push(`/trips/${tripId}`);
    } catch (error: any) {
      console.error('Failed to update place:', error);
      alert(`Failed to update place: ${error.message || 'Unknown error'}`);
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

  if (!trip || !place) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-700">Step not found</div>
      </div>
    );
  }

  const isCreator = user?.uid === trip.creatorId;
  if (!isCreator) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-700">You don&apos;t have permission to edit this step</div>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Step</h1>
          <p className="text-gray-600">Edit step: {place.name}</p>
        </div>

            <PlaceForm
              tripId={tripId}
              onSubmit={handleUpdatePlace}
              onCancel={() => router.push(`/trips/${tripId}`)}
              token={token}
              previousPlace={previousPlace}
              initialData={place}
              participants={trip?.participants || []}
              placeCountry={undefined} // Will be detected from coordinates
            />
      </div>
    </div>
  );
}

