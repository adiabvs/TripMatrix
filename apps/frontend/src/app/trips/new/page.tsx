'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createTrip, uploadImage } from '@/lib/api';
import type { Trip, TripParticipant } from '@tripmatrix/types';
import ParticipantSelector from '@/components/ParticipantSelector';
import { parseDateTimeLocalToUTC } from '@/lib/dateUtils';

export default function NewTripPage() {
  const { user, loading: authLoading, getIdToken } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [participants, setParticipants] = useState<TripParticipant[]>([]);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
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
      // Convert local datetime to UTC for storage
      const startTimeUTC = parseDateTimeLocalToUTC(formData.startTime);
      const endTimeUTC = formData.endTime ? parseDateTimeLocalToUTC(formData.endTime) : undefined;
      
      const trip = await createTrip(
        {
          ...formData,
          startTime: startTimeUTC.toISOString(),
          endTime: endTimeUTC?.toISOString(),
          status: formData.isCompleted ? 'completed' : 'in_progress',
          participants,
          coverImage: coverImage || undefined,
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
      <div className="min-h-screen flex items-center justify-center bg-[#424242]">
        <div className="text-sm text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#424242]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-600">
        <Link href="/trips" className="w-10 h-10 flex items-center justify-center">
          <span className="text-white text-xl">←</span>
        </Link>
        <h1 className="text-xs font-semibold text-white">New Trip</h1>
        <div className="w-10" />
      </div>

      <div className="px-4 py-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Cover Image Section */}
          <div>
            <label className="block text-[12px] font-semibold text-[#bdbdbd] mb-2">
              Cover Image (Optional)
            </label>
            {coverImage ? (
              <div className="relative rounded-lg overflow-hidden mt-2">
                <img
                  src={coverImage}
                  alt="Cover preview"
                  className="w-full h-48 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setCoverImage(null)}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center"
                >
                  <span className="text-white text-lg">×</span>
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#616161] rounded-lg p-4 mt-2 cursor-pointer hover:border-[#757575] transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !token) return;
                    setUploadingCover(true);
                    try {
                      const uploaded = await uploadImage(file, token, true);
                      setCoverImage(uploaded.url);
                    } catch (error) {
                      console.error('Failed to upload cover image:', error);
                      alert('Failed to upload cover image');
                    } finally {
                      setUploadingCover(false);
                    }
                  }}
                  className="hidden"
                  disabled={uploadingCover}
                />
                <span className="text-2xl mb-2">📷</span>
                <span className="text-[14px] text-[#9e9e9e]">
                  {uploadingCover ? 'Uploading...' : 'Add Cover Image'}
                </span>
              </label>
            )}
          </div>

          {/* Trip Title */}
          <div>
            <label htmlFor="title" className="block text-[12px] font-semibold text-[#bdbdbd] mb-2">
              Trip Title *
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-transparent px-0 py-3 text-[14px] text-white border-0 border-b border-[#9e9e9e] focus:outline-none focus:border-[#1976d2] rounded-none"
              placeholder="Enter trip title"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-[12px] font-semibold text-[#bdbdbd] mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full bg-transparent px-0 py-3 text-[14px] text-white border-0 border-b border-[#9e9e9e] focus:outline-none focus:border-[#1976d2] rounded-none min-h-[100px]"
              placeholder="Enter trip description (optional)"
            />
          </div>

          {/* Start Date/Time */}
          <div>
            <label htmlFor="startTime" className="block text-[12px] font-semibold text-[#bdbdbd] mb-2">
              Start Date & Time *
            </label>
            <div className="flex items-center gap-3 px-0 py-3 border-0 border-b border-[#616161]">
              <span className="text-xl">📅</span>
              <input
                type="datetime-local"
                id="startTime"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="flex-1 bg-transparent text-[14px] text-white focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[12px] font-semibold text-[#bdbdbd] mb-2">
              Status
            </label>
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, isCompleted: false })}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border ${
                  !formData.isCompleted
                    ? 'bg-[#1976d2] border-[#1976d2] text-white'
                    : 'bg-transparent border-[#616161] text-white'
                }`}
              >
                <span>▶️</span>
                <span className="text-[14px] font-medium">Active</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, isCompleted: true })}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border ${
                  formData.isCompleted
                    ? 'bg-[#1976d2] border-[#1976d2] text-white'
                    : 'bg-transparent border-[#616161] text-white'
                }`}
              >
                <span>✓</span>
                <span className="text-[14px] font-medium">Completed</span>
              </button>
            </div>
          </div>

          {/* Public/Private Toggle */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <span className="text-xl">🌐</span>
              <div>
                <label className="block text-[12px] font-semibold text-white mb-0.5">
                  Public Trip
                </label>
                <p className="text-[10px] text-[#9e9e9e]">
                  Allow others to discover and view this trip
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isPublic}
                onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#616161] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1976d2]"></div>
            </label>
          </div>

          {/* Participants */}
          {token && (
            <div>
              <ParticipantSelector
                participants={participants}
                onParticipantsChange={setParticipants}
                token={token}
              />
            </div>
          )}

          {/* Create Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-4 bg-[#1976d2] text-white rounded-lg text-[14px] font-semibold disabled:opacity-50 mt-4"
          >
            <span>✓</span>
            <span>{loading ? 'Creating...' : 'Create Trip'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
