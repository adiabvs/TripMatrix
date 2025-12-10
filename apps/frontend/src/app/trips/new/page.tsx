'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createTrip } from '@/lib/api';
import type { Trip, TripParticipant } from '@tripmatrix/types';
import ParticipantSelector from '@/components/ParticipantSelector';

export default function NewTripPage() {
  const { user, loading: authLoading, getIdToken } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [participants, setParticipants] = useState<TripParticipant[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: new Date().toISOString().slice(0, 16),
    endTime: '',
    isPublic: false,
    isCompleted: false,
  });

  useEffect(() => {
    if (user) {
      getIdToken().then(setToken).catch(console.error);
      // Add creator as first participant
      if (user.uid) {
        setParticipants([{ uid: user.uid, isGuest: false }]);
      }
    }
  }, [user, getIdToken]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('Title is required');
      return;
    }
    if (formData.isCompleted && formData.endTime) {
      const start = new Date(formData.startTime).getTime();
      const end = new Date(formData.endTime).getTime();
      if (end < start) {
        alert('End time cannot be before start time');
        return;
      }
    }

    setLoading(true);
    try {
      const token = await getIdToken();
      const trip = await createTrip(
        {
          ...formData,
          startTime: new Date(formData.startTime),
          endTime: formData.endTime ? new Date(formData.endTime) : undefined,
          status: formData.isCompleted ? 'completed' : 'in_progress',
          participants,
        },
        token
      );
      router.push(`/trips/${trip.tripId}`);
    } catch (error: any) {
      console.error('Failed to create trip:', error);
      alert(error.message || 'Failed to create trip');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link href="/trips" className="text-gray-700 hover:text-gray-900 transition-colors flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Back</span>
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-8 text-gray-900">Create New Trip</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Trip Title *
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              placeholder="Describe your trip..."
            />
          </div>

          <div>
            <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-2">
              Start Date & Time *
            </label>
            <input
              type="datetime-local"
              id="startTime"
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={formData.isCompleted}
                onChange={(e) => setFormData({ ...formData, isCompleted: e.target.checked })}
                className="w-4 h-4"
              />
              This trip already happened (completed)
            </label>
          </div>

          {formData.isCompleted && (
            <div>
              <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-2">
                End Date & Time (optional)
              </label>
              <input
                type="datetime-local"
                id="endTime"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                If left empty, the trip will be marked completed at the current time.
              </p>
            </div>
          )}

          <div>
            <ParticipantSelector
              participants={participants}
              onParticipantsChange={setParticipants}
              token={token}
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={formData.isPublic}
                onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                className="w-4 h-4"
              />
              Make this trip public
            </label>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-black text-white py-3 px-6 rounded-full font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating...' : 'Create Trip'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

