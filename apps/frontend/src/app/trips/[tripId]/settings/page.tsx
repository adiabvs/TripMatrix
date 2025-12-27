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
  if (!isCreator) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#424242]">
        <div className="text-sm text-white">You don&apos;t have permission to access trip settings</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#424242] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-600 flex-shrink-0">
        <Link href={`/trips/${tripId}`} className="w-10 h-10 flex items-center justify-center">
          <span className="text-white text-xl">←</span>
        </Link>
        <h1 className="text-xs font-semibold text-white">Trip Settings</h1>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="mb-6">
          <h2 className="text-[10px] font-semibold text-white mb-1">{trip.title}</h2>
          <p className="text-[12px] text-gray-300">Manage your trip settings</p>
        </div>

        <div className="space-y-6">
          {/* Cover Image */}
          <div className="bg-[#616161] p-4 rounded-lg">
            <h2 className="text-xs font-semibold text-white mb-4">Cover Image</h2>
            
            <div className="space-y-4">
              {coverImage ? (
                <div className="relative">
                  <img
                    src={coverImage}
                    alt="Cover"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveCoverImage}
                    className="absolute top-2 right-2 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-[12px] font-medium"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="w-full h-48 bg-[#757575] rounded-lg flex items-center justify-center">
                  <p className="text-[12px] text-gray-300">No cover image</p>
                </div>
              )}
              
              <div>
                <label className="block text-[12px] font-semibold text-[#bdbdbd] mb-2">
                  {coverImage ? 'Change Cover Image' : 'Upload Cover Image'}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverImageChange}
                  disabled={uploadingCover}
                  className="block w-full text-[12px] text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-[12px] file:font-semibold file:bg-[#1976d2] file:text-white hover:file:bg-[#1565c0] file:cursor-pointer disabled:opacity-50"
                />
                {uploadingCover && (
                  <p className="text-[12px] text-gray-400 mt-2">Uploading...</p>
                )}
              </div>
            </div>
          </div>

          {/* Privacy Settings */}
          <div className="bg-[#616161] p-4 rounded-lg">
            <h2 className="text-xs font-semibold text-white mb-4">Privacy Settings</h2>
            
            {/* Public/Private Toggle */}
            <div className="mb-6">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-[14px] font-semibold text-white">Make Trip Public</p>
                  <p className="text-[12px] text-gray-300 mt-1">
                    {settings.isPublic 
                      ? 'Anyone can view this trip' 
                      : 'Only trip members can view this trip'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, isPublic: !settings.isPublic })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.isPublic ? 'bg-[#1976d2]' : 'bg-[#757575]'
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
              <label className="block text-[12px] font-semibold text-[#bdbdbd] mb-2">
                Default Photo Sharing
              </label>
              <p className="text-[12px] text-gray-300 mb-3">
                Who can see photos by default when you add them to steps
              </p>
              <div className="space-y-3">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="photoSharing"
                    value="everyone"
                    checked={settings.defaultPhotoSharing === 'everyone'}
                    onChange={(e) => setSettings({ ...settings, defaultPhotoSharing: e.target.value as PhotoSharingPrivacy })}
                    className="mr-3 w-4 h-4 text-[#1976d2]"
                  />
                  <span className="text-[14px] text-white">Everyone (public)</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="photoSharing"
                    value="members"
                    checked={settings.defaultPhotoSharing === 'members'}
                    onChange={(e) => setSettings({ ...settings, defaultPhotoSharing: e.target.value as PhotoSharingPrivacy })}
                    className="mr-3 w-4 h-4 text-[#1976d2]"
                  />
                  <span className="text-[14px] text-white">Only Trip Members</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="photoSharing"
                    value="creator"
                    checked={settings.defaultPhotoSharing === 'creator'}
                    onChange={(e) => setSettings({ ...settings, defaultPhotoSharing: e.target.value as PhotoSharingPrivacy })}
                    className="mr-3 w-4 h-4 text-[#1976d2]"
                  />
                  <span className="text-[14px] text-white">Only Creator (You)</span>
                </label>
              </div>
            </div>

            {/* Expense Visibility */}
            <div>
              <label className="block text-[12px] font-semibold text-[#bdbdbd] mb-2">
                Expense Visibility
              </label>
              <p className="text-[12px] text-gray-300 mb-3">
                Who can view expenses for this trip
              </p>
              <div className="space-y-3">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="expenseVisibility"
                    value="everyone"
                    checked={settings.expenseVisibility === 'everyone'}
                    onChange={(e) => setSettings({ ...settings, expenseVisibility: e.target.value as ExpenseVisibility })}
                    className="mr-3 w-4 h-4 text-[#1976d2]"
                  />
                  <span className="text-[14px] text-white">Everyone (public)</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="expenseVisibility"
                    value="members"
                    checked={settings.expenseVisibility === 'members'}
                    onChange={(e) => setSettings({ ...settings, expenseVisibility: e.target.value as ExpenseVisibility })}
                    className="mr-3 w-4 h-4 text-[#1976d2]"
                  />
                  <span className="text-[14px] text-white">Only Trip Members</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="expenseVisibility"
                    value="creator"
                    checked={settings.expenseVisibility === 'creator'}
                    onChange={(e) => setSettings({ ...settings, expenseVisibility: e.target.value as ExpenseVisibility })}
                    className="mr-3 w-4 h-4 text-[#1976d2]"
                  />
                  <span className="text-[14px] text-white">Only Creator (You)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-[#616161] p-4 rounded-lg border border-red-600">
            <h2 className="text-xs font-semibold text-red-400 mb-4">Danger Zone</h2>
            
            <div className="mb-4">
              <p className="text-[12px] text-red-300 mb-2">
                Deleting this trip will permanently remove:
              </p>
              <ul className="text-[12px] text-red-200 list-disc list-inside space-y-1">
                <li>The trip and all its data</li>
                <li>All steps and places</li>
                <li>All expenses</li>
                <li>All photos (from Supabase storage)</li>
              </ul>
            </div>

            <button
              onClick={handleDeleteTrip}
              disabled={deleting}
              className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-[12px] font-medium"
            >
              {deleting ? 'Deleting...' : 'Delete Trip'}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pb-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-[#1976d2] text-white py-3 px-4 rounded-lg text-[14px] font-semibold disabled:opacity-50 hover:bg-[#1565c0] transition-colors"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            <Link
              href={`/trips/${tripId}`}
              className="w-full text-center px-4 py-3 bg-[#616161] text-white rounded-lg hover:bg-[#757575] transition-colors text-[14px] font-medium"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

