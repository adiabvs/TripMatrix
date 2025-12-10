'use client';

import { useAuth } from '@/lib/auth';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getTrip, updateTrip, deleteTrip, uploadImage } from '@/lib/api';
import type { Trip, PhotoSharingPrivacy, ExpenseVisibility } from '@tripmatrix/types';

export default function TripSettingsPage() {
  const { user, loading: authLoading, getIdToken } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tripId = params.tripId as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    isPublic: false,
    defaultPhotoSharing: 'members' as PhotoSharingPrivacy,
    expenseVisibility: 'members' as ExpenseVisibility,
  });
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

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
      const tripData = await getTrip(tripId, token);
      setTrip(tripData);
      setSettings({
        isPublic: tripData.isPublic || false,
        defaultPhotoSharing: tripData.defaultPhotoSharing || 'members',
        expenseVisibility: tripData.expenseVisibility || 'members',
      });
      setCoverImage(tripData.coverImage || null);
    } catch (error) {
      console.error('Failed to load trip data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCoverImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setUploadingCover(true);
    try {
      const result = await uploadImage(file, token, true); // isPublic = true for cover images
      setCoverImage(result.url);
    } catch (error) {
      console.error('Failed to upload cover image:', error);
      alert('Failed to upload cover image');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleRemoveCoverImage = () => {
    setCoverImage(null);
  };

  const handleSave = async () => {
    if (!trip || !token) return;

    setSaving(true);
    try {
      await updateTrip(tripId, {
        isPublic: settings.isPublic,
        defaultPhotoSharing: settings.defaultPhotoSharing,
        expenseVisibility: settings.expenseVisibility,
        coverImage: coverImage || undefined, // Include coverImage in update
      }, token);
      alert('Settings saved successfully!');
      router.push(`/trips/${tripId}`);
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTrip = async () => {
    if (!trip || !token) return;

    const confirmMessage = `Are you sure you want to delete "${trip.title}"? This will permanently delete:\n- The trip\n- All steps and places\n- All expenses\n- All photos\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmMessage)) return;

    setDeleting(true);
    try {
      await deleteTrip(tripId, token);
      alert('Trip deleted successfully');
      router.push('/trips');
    } catch (error) {
      console.error('Failed to delete trip:', error);
      alert('Failed to delete trip');
    } finally {
      setDeleting(false);
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
        <div className="text-lg text-gray-700">You don't have permission to access trip settings</div>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Trip Settings</h1>
          <p className="text-gray-600">{trip.title}</p>
        </div>

        <div className="space-y-6">
          {/* Cover Image */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Cover Image</h2>
            
            <div className="space-y-4">
              {coverImage ? (
                <div className="relative">
                  <img
                    src={coverImage}
                    alt="Cover"
                    className="w-full h-64 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveCoverImage}
                    className="absolute top-2 right-2 px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                  <p className="text-gray-500">No cover image</p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {coverImage ? 'Change Cover Image' : 'Upload Cover Image'}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverImageChange}
                  disabled={uploadingCover}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800 file:cursor-pointer disabled:opacity-50"
                />
                {uploadingCover && (
                  <p className="text-sm text-gray-500 mt-2">Uploading...</p>
                )}
              </div>
            </div>
          </div>

          {/* Privacy Settings */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Privacy Settings</h2>
            
            {/* Public/Private Toggle */}
            <div className="mb-6">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-gray-900">Make Trip Public</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {settings.isPublic 
                      ? 'Anyone can view this trip' 
                      : 'Only trip members can view this trip'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, isPublic: !settings.isPublic })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.isPublic ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.isPublic ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>
            </div>

            {/* Default Photo Sharing */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Default Photo Sharing
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Who can see photos by default when you add them to steps
              </p>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="photoSharing"
                    value="everyone"
                    checked={settings.defaultPhotoSharing === 'everyone'}
                    onChange={(e) => setSettings({ ...settings, defaultPhotoSharing: e.target.value as PhotoSharingPrivacy })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Everyone (public)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="photoSharing"
                    value="members"
                    checked={settings.defaultPhotoSharing === 'members'}
                    onChange={(e) => setSettings({ ...settings, defaultPhotoSharing: e.target.value as PhotoSharingPrivacy })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Only Trip Members</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="photoSharing"
                    value="creator"
                    checked={settings.defaultPhotoSharing === 'creator'}
                    onChange={(e) => setSettings({ ...settings, defaultPhotoSharing: e.target.value as PhotoSharingPrivacy })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Only Creator (You)</span>
                </label>
              </div>
            </div>

            {/* Expense Visibility */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Expense Visibility
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Who can view expenses for this trip
              </p>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="expenseVisibility"
                    value="everyone"
                    checked={settings.expenseVisibility === 'everyone'}
                    onChange={(e) => setSettings({ ...settings, expenseVisibility: e.target.value as ExpenseVisibility })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Everyone (public)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="expenseVisibility"
                    value="members"
                    checked={settings.expenseVisibility === 'members'}
                    onChange={(e) => setSettings({ ...settings, expenseVisibility: e.target.value as ExpenseVisibility })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Only Trip Members</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="expenseVisibility"
                    value="creator"
                    checked={settings.expenseVisibility === 'creator'}
                    onChange={(e) => setSettings({ ...settings, expenseVisibility: e.target.value as ExpenseVisibility })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Only Creator (You)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-red-50 p-6 rounded-2xl border border-red-200">
            <h2 className="text-xl font-bold text-red-900 mb-4">Danger Zone</h2>
            
            <div className="mb-4">
              <p className="text-sm text-red-800 mb-2">
                Deleting this trip will permanently remove:
              </p>
              <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                <li>The trip and all its data</li>
                <li>All steps and places</li>
                <li>All expenses</li>
                <li>All photos (from Supabase storage)</li>
              </ul>
            </div>

            <button
              onClick={handleDeleteTrip}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
            >
              {deleting ? 'Deleting...' : 'Delete Trip'}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-black text-white px-6 py-3 rounded-full hover:bg-gray-800 disabled:opacity-50 transition-colors font-semibold"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            <Link
              href={`/trips/${tripId}`}
              className="px-6 py-3 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

