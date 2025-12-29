'use client';

import { useAuth } from '@/lib/auth';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getTrip, updateTrip, addParticipants, removeParticipants, getExpenseSummary, getUser, getTripPlaces, getTripExpenses } from '@/lib/api';
import type { Trip, TripParticipant, TripStatus, ExpenseSummary } from '@tripmatrix/types';
import { MdArrowBack, MdPersonAdd, MdPersonRemove, MdSave, MdMonetizationOn, MdStraighten, MdLocationOn } from 'react-icons/md';
import ParticipantSelector from '@/components/ParticipantSelector';
import { formatDateTimeLocalForInput, parseDateTimeLocalToUTC } from '@/lib/dateUtils';
import { getCurrencySymbol, formatCurrency } from '@/lib/currencyUtils';

export default function TripInfoPage() {
  const { user, loading: authLoading, getIdToken } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tripId = params.tripId as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [expenseSummary, setExpenseSummary] = useState<ExpenseSummary | null>(null);
  const [userNamesMap, setUserNamesMap] = useState<Record<string, string>>({});
  const [placesCount, setPlacesCount] = useState(0);
  const [expenseCurrency, setExpenseCurrency] = useState<string>('USD'); // Default currency
  
  // Form state
  const [startTime, setStartTime] = useState('');
  const [status, setStatus] = useState<TripStatus>('in_progress');
  const [participants, setParticipants] = useState<TripParticipant[]>([]);
  
  // Get user's currency preference
  const userCurrency = user?.defaultCurrency || 'USD';

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
      const authToken = await getIdToken();
      const tripData = await getTrip(tripId, authToken);
      setTrip(tripData);
      setStartTime(formatDateTimeLocalForInput(new Date(tripData.startTime)));
      setStatus(tripData.status);
      setParticipants(tripData.participants || []);

      // Load places count
      try {
        const places = await getTripPlaces(tripId, authToken);
        setPlacesCount(places.length);
      } catch (error) {
        console.error('Failed to load places:', error);
      }

      // Load expenses to determine currency
      try {
        const expenses = await getTripExpenses(tripId, authToken);
        if (expenses.length > 0) {
          // Use the currency from the first expense, or fallback to user's currency
          const firstExpenseCurrency = expenses[0].currency || user?.defaultCurrency || 'USD';
          setExpenseCurrency(firstExpenseCurrency);
        } else {
          setExpenseCurrency(user?.defaultCurrency || 'USD');
        }
      } catch (error) {
        console.error('Failed to load expenses:', error);
        setExpenseCurrency(user?.defaultCurrency || 'USD');
      }

      // Load expense summary (for both in-progress and completed trips)
      try {
        const summary = await getExpenseSummary(tripId, authToken);
        setExpenseSummary(summary);

        // Load user names for participants
        const namesMap: Record<string, string> = {};
        const participantUids = tripData.participants
          ?.filter((p) => p.uid && !p.isGuest)
          .map((p) => p.uid) || [];
        
        await Promise.all(
          participantUids.filter((uid): uid is string => !!uid).map(async (uid) => {
            try {
              const user = await getUser(uid, authToken);
              namesMap[uid] = user.name;
            } catch (error) {
              console.error(`Failed to load user ${uid}:`, error);
            }
          })
        );

        // Add guest names
        tripData.participants?.forEach((p) => {
          if (p.isGuest && p.guestName) {
            namesMap[p.guestName] = p.guestName;
          }
        });

        setUserNamesMap(namesMap);
      } catch (error) {
        console.error('Failed to load expense summary:', error);
        // Don't fail the whole page if expense summary fails
      }
    } catch (error) {
      console.error('Failed to load trip data:', error);
      alert('Failed to load trip data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!trip || !token) return;

    setSaving(true);
    try {
      const updates: Partial<Trip> = {
        startTime: parseDateTimeLocalToUTC(startTime).toISOString(),
        status,
      };

      await updateTrip(tripId, updates, token);
      
      // Update participants if changed
      const originalParticipants = trip.participants || [];
      const addedParticipants = participants.filter(
        (p) => !originalParticipants.some(
          (op) => (op.uid && p.uid === op.uid) || (op.guestName && p.guestName === op.guestName)
        )
      );
      const removedParticipants = originalParticipants.filter(
        (op) => !participants.some(
          (p) => (op.uid && p.uid === op.uid) || (op.guestName && p.guestName === op.guestName)
        )
      );

      // Add new participants
      if (addedParticipants.length > 0) {
        const toAdd = addedParticipants.map((p) => p.uid || p.guestName || '').filter(Boolean);
        if (toAdd.length > 0) {
          await addParticipants(tripId, toAdd, token);
        }
      }

      // Remove participants
      if (removedParticipants.length > 0) {
        const toRemove = removedParticipants.map((p) => p.uid || p.guestName || '').filter(Boolean);
        if (toRemove.length > 0) {
          await removeParticipants(tripId, toRemove, token);
        }
      }

      alert('Trip info updated successfully!');
      router.push(`/trips/${tripId}`);
    } catch (error: any) {
      console.error('Failed to save trip info:', error);
      alert(`Failed to save trip info: ${error.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#424242]">
        <div className="text-sm text-white">Loading...</div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#424242]">
        <div className="text-sm text-white">Trip not found</div>
      </div>
    );
  }

  const isCreator = user?.uid === trip.creatorId;
  const isParticipant = trip.participants?.some((p) => p.uid === user?.uid);
  
  if (!isCreator && !isParticipant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#424242]">
        <div className="text-sm text-white">You don&apos;t have permission to edit this trip</div>
      </div>
    );
  }

  const totalDistanceKm = trip.totalDistance ? (trip.totalDistance / 1000).toFixed(1) : '0.0';

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0 bg-black">
        <Link href={`/trips/${tripId}`} className="w-10 h-10 flex items-center justify-center">
          <MdArrowBack className="text-white text-xl" />
        </Link>
        <h1 className="text-sm font-semibold text-white">Trip Info</h1>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: '80px' }}>
        {/* Instagram-style Header Card */}
        <div className="bg-black border-b border-gray-800 px-4 py-4 mb-1">
          <h2 className="text-lg font-semibold text-white mb-1">{trip.title}</h2>
          <p className="text-sm text-gray-400">Manage trip details and participants</p>
        </div>

        {/* Stats Card - Instagram style */}
        <div className="bg-black border-b border-gray-800 px-4 py-4">
          <div className="flex items-center gap-6">
            {placesCount > 0 && (
              <div className="flex items-center gap-2">
                <MdLocationOn className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-400">Places</p>
                  <p className="text-base font-semibold text-white">{placesCount}</p>
                </div>
              </div>
            )}
            {trip.totalDistance && trip.totalDistance > 0 && (
              <div className="flex items-center gap-2">
                <MdStraighten className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-400">Distance</p>
                  <p className="text-base font-semibold text-white">{totalDistanceKm} km</p>
                </div>
              </div>
            )}
            {expenseSummary && expenseSummary.totalSpent > 0 && (
              <div className="flex items-center gap-2">
                <MdMonetizationOn className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-400">Spent</p>
                  <p className="text-base font-semibold text-white flex items-center gap-1">
                    <span>{getCurrencySymbol(expenseCurrency)}</span>
                    <span>{expenseSummary.totalSpent.toFixed(0)}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1">
          {/* Start Date - Instagram style card */}
          <div className="bg-black border-b border-gray-800 px-4 py-4">
            <h2 className="text-sm font-semibold text-white mb-3">Start Date & Time</h2>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-900 text-white rounded-lg border border-gray-700 focus:outline-none focus:border-[#1976d2] text-sm"
            />
            <p className="text-xs text-gray-400 mt-2">
              When does this trip start?
            </p>
          </div>

          {/* Status - Instagram style card */}
          <div className="bg-black border-b border-gray-800 px-4 py-4">
            <h2 className="text-sm font-semibold text-white mb-3">Trip Status</h2>
            <div className="space-y-2">
              <label className="flex items-center cursor-pointer py-2">
                <input
                  type="radio"
                  name="status"
                  value="upcoming"
                  checked={status === 'upcoming'}
                  onChange={(e) => setStatus(e.target.value as TripStatus)}
                  className="mr-3 w-4 h-4 text-[#1976d2]"
                />
                <span className="text-sm text-white">Upcoming</span>
              </label>
              <label className="flex items-center cursor-pointer py-2">
                <input
                  type="radio"
                  name="status"
                  value="in_progress"
                  checked={status === 'in_progress'}
                  onChange={(e) => setStatus(e.target.value as TripStatus)}
                  className="mr-3 w-4 h-4 text-[#1976d2]"
                />
                <span className="text-sm text-white">In Progress</span>
              </label>
              <label className="flex items-center cursor-pointer py-2">
                <input
                  type="radio"
                  name="status"
                  value="completed"
                  checked={status === 'completed'}
                  onChange={(e) => setStatus(e.target.value as TripStatus)}
                  className="mr-3 w-4 h-4 text-[#1976d2]"
                />
                <span className="text-sm text-white">Completed</span>
              </label>
            </div>
          </div>

          {/* Participants - Instagram style card */}
          <div className="bg-black border-b border-gray-800 px-4 py-4">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <MdPersonAdd className="w-5 h-5" />
              Participants
            </h2>
            <ParticipantSelector
              participants={participants}
              onParticipantsChange={setParticipants}
              token={token}
            />
          </div>

          {/* Expense Summary - Instagram style card */}
          {expenseSummary && expenseSummary.totalSpent > 0 && (
            <div className="bg-black border-b border-gray-800 px-4 py-4">
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <MdMonetizationOn className="w-5 h-5" />
                Expense Summary
              </h2>
              <div className="space-y-3">
                {expenseSummary.settlements && expenseSummary.settlements.length > 0 ? (
                  <div>
                    <p className="text-xs text-gray-400 mb-3">Settlements:</p>
                    <div className="space-y-2">
                      {expenseSummary.settlements.map((settlement, index) => {
                        const fromName = userNamesMap[settlement.from] || settlement.from;
                        const toName = userNamesMap[settlement.to] || settlement.to;
                        return (
                          <div
                            key={index}
                            className="bg-gray-900 p-3 rounded-lg border border-gray-800"
                          >
                            <p className="text-sm text-white">
                              <span className="font-semibold">{fromName}</span>
                              {' should pay '}
                              <span className="font-semibold">{toName}</span>
                            </p>
                            <p className="text-lg font-bold text-[#1976d2] mt-1 flex items-center gap-1">
                              <span>{getCurrencySymbol(expenseCurrency)}</span>
                              <span>{settlement.amount.toFixed(2)}</span>
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-900 p-3 rounded-lg border border-gray-800">
                    <p className="text-xs text-gray-400">
                      No settlements needed. All expenses are balanced.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Action Buttons - Fixed at bottom */}
        <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 px-4 py-3 flex gap-3 z-10">
          <Link
            href={`/trips/${tripId}`}
            className="flex-1 text-center px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-[#1976d2] text-white py-3 px-4 rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-[#1565c0] transition-colors flex items-center justify-center gap-2"
          >
            <MdSave className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

