'use client';

import { useState, useEffect, useRef } from 'react';
import type { TripPlace, RewriteTone, ModeOfTravel } from '@tripmatrix/types';
import { rewriteText, uploadImage } from '@/lib/api';
import dynamic from 'next/dynamic';

const PlaceMapSelector = dynamic(() => import('./PlaceMapSelector'), { ssr: false });

interface PlaceFormProps {
  tripId: string;
  onSubmit: (place: Partial<TripPlace> & { modeOfTravel?: ModeOfTravel; previousPlace?: TripPlace | null }) => Promise<void>;
  onCancel: () => void;
  token: string | null;
  previousPlace?: TripPlace | null;
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate estimated time based on mode of travel (in seconds)
function calculateTime(distance: number, mode: ModeOfTravel): number {
  const speeds: Record<ModeOfTravel, number> = {
    walk: 1.4, // m/s (5 km/h)
    bike: 4.2, // m/s (15 km/h)
    car: 13.9, // m/s (50 km/h average)
    train: 27.8, // m/s (100 km/h average)
    bus: 8.3, // m/s (30 km/h average)
    flight: 250, // m/s (900 km/h average)
  };
  return Math.round(distance / speeds[mode]);
}

export default function PlaceForm({ tripId, onSubmit, onCancel, token, previousPlace }: PlaceFormProps) {
  const [placeName, setPlaceName] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [modeOfTravel, setModeOfTravel] = useState<ModeOfTravel>('car');
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [rewrittenComment, setRewrittenComment] = useState('');
  const [rewriteTone, setRewriteTone] = useState<RewriteTone>('friendly');
  const [rewriting, setRewriting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null);
  const [calculatedTime, setCalculatedTime] = useState<number | null>(null);
  const [images, setImages] = useState<Array<{ url: string; isPublic: boolean }>>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [defaultImagePrivacy, setDefaultImagePrivacy] = useState<boolean>(false); // false = private to trip members
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate distance and time when coordinates or mode changes
  useEffect(() => {
    if (coordinates && previousPlace) {
      const distance = calculateDistance(
        previousPlace.coordinates.lat,
        previousPlace.coordinates.lng,
        coordinates.lat,
        coordinates.lng
      );
      const time = calculateTime(distance, modeOfTravel);
      setCalculatedDistance(distance);
      setCalculatedTime(time);
    } else {
      setCalculatedDistance(null);
      setCalculatedTime(null);
    }
  }, [coordinates, modeOfTravel, previousPlace]);

  const handleLocationSelect = (coords: { lat: number; lng: number }, name?: string) => {
    setCoordinates(coords);
    if (name) setPlaceName(name);
    
    // Recalculate distance/time
    if (previousPlace) {
      const distance = calculateDistance(
        previousPlace.coordinates.lat,
        previousPlace.coordinates.lng,
        coords.lat,
        coords.lng
      );
      const time = calculateTime(distance, modeOfTravel);
      setCalculatedDistance(distance);
      setCalculatedTime(time);
    }
  };

  const handleModeChange = (mode: ModeOfTravel) => {
    setModeOfTravel(mode);
    if (coordinates && previousPlace && calculatedDistance !== null) {
      const time = calculateTime(calculatedDistance, mode);
      setCalculatedTime(time);
    }
  };

  const handleImageUpload = async (files: FileList) => {
    if (!token) {
      alert('Please sign in to upload images');
      return;
    }

    setUploadingImages(true);
    try {
      const uploadPromises = Array.from(files).map((file) => 
        uploadImage(file, token, defaultImagePrivacy)
      );
      const uploadedImages = await Promise.all(uploadPromises);
      setImages([...images, ...uploadedImages]);
    } catch (error) {
      console.error('Failed to upload images:', error);
      alert('Failed to upload some images');
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };

  const toggleImagePrivacy = (index: number) => {
    const newImages = [...images];
    newImages[index] = { ...newImages[index], isPublic: !newImages[index].isPublic };
    setImages(newImages);
  };

  const handleRewrite = async () => {
    if (!comment.trim() || !token) return;

    setRewriting(true);
    try {
      const result = await rewriteText({ text: comment, tone: rewriteTone }, token);
      setRewrittenComment(result.rewrittenText);
    } catch (error) {
      console.error('Failed to rewrite:', error);
      alert('Failed to rewrite text');
    } finally {
      setRewriting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!placeName || !coordinates) {
      alert('Please provide place name and select location on map');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        tripId,
        name: placeName,
        coordinates,
        visitedAt: new Date(),
        rating: rating > 0 ? rating : undefined,
        comment: rewrittenComment || comment || undefined,
        rewrittenComment: rewrittenComment || undefined,
        modeOfTravel: previousPlace ? modeOfTravel : undefined,
        distanceFromPrevious: calculatedDistance || undefined,
        timeFromPrevious: calculatedTime || undefined,
        imageMetadata: images.length > 0 ? images : undefined,
        previousPlace,
      });
      // Reset form
      setPlaceName('');
      setCoordinates(null);
      setRating(0);
      setComment('');
      setRewrittenComment('');
      setCalculatedDistance(null);
      setCalculatedTime(null);
      setImages([]);
      setDefaultImagePrivacy(false);
    } catch (error) {
      console.error('Failed to add place:', error);
      alert('Failed to add place');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <h3 className="text-2xl font-bold mb-6">Add Step</h3>

      {/* Map Selector - Always shown */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Location *
        </label>
        <PlaceMapSelector
          onLocationSelect={handleLocationSelect}
          initialCoords={coordinates || undefined}
          height="300px"
        />
        <input
          type="text"
          value={placeName}
          onChange={(e) => setPlaceName(e.target.value)}
          placeholder="Enter place name..."
          className="w-full mt-3 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      {/* Mode of Travel (only if there's a previous place) */}
      {previousPlace && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            How did you get here? *
          </label>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {(['walk', 'bike', 'car', 'train', 'bus', 'flight'] as ModeOfTravel[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleModeChange(mode)}
                className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                  modeOfTravel === mode
                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Distance and Time Info */}
      {calculatedDistance !== null && calculatedTime !== null && (
        <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Distance</p>
              <p className="text-lg font-bold text-gray-900">
                {(calculatedDistance / 1000).toFixed(2)} km
              </p>
            </div>
            <div>
              <p className="text-gray-600">Estimated Time</p>
              <p className="text-lg font-bold text-gray-900">
                {Math.floor(calculatedTime / 3600) > 0 && `${Math.floor(calculatedTime / 3600)}h `}
                {Math.floor((calculatedTime % 3600) / 60)}m
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Image Upload */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Photos
        </label>
        
        {/* Privacy Toggle for New Images */}
        <div className="mb-3 flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={defaultImagePrivacy}
              onChange={(e) => setDefaultImagePrivacy(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span>Make new photos public (visible to everyone)</span>
          </label>
          {!defaultImagePrivacy && (
            <span className="text-xs text-gray-500">(Private to trip members)</span>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            if (e.target.files) {
              handleImageUpload(e.target.files);
            }
          }}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingImages}
          className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50"
        >
          {uploadingImages ? 'Uploading...' : '+ Add Photos'}
        </button>
        {images.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {images.map((image, index) => (
              <div key={index} className="relative group">
                <img
                  src={image.url}
                  alt={`Step photo ${index + 1}`}
                  className="w-full h-24 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                >
                  ×
                </button>
                <button
                  type="button"
                  onClick={() => toggleImagePrivacy(index)}
                  className={`absolute top-1 left-1 px-2 py-1 rounded text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity ${
                    image.isPublic
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-700 text-white'
                  }`}
                  title={image.isPublic ? 'Public - Click to make private' : 'Private to trip members - Click to make public'}
                >
                  {image.isPublic ? '🌐 Public' : '🔒 Private'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Rating (1-5)
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className={`text-2xl transition-transform hover:scale-110 ${
                star <= rating ? 'text-yellow-400' : 'text-gray-300'
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Comment
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="Write about your experience..."
        />
      </div>

      {comment && (
        <div className="mb-6">
          <div className="flex gap-2 mb-2">
            <select
              value={rewriteTone}
              onChange={(e) => setRewriteTone(e.target.value as RewriteTone)}
              className="px-3 py-1 border border-gray-300 rounded-lg"
            >
              <option value="friendly">Friendly</option>
              <option value="professional">Professional</option>
              <option value="travel-blog">Travel Blog</option>
            </select>
            <button
              type="button"
              onClick={handleRewrite}
              disabled={rewriting}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
            >
              {rewriting ? 'Rewriting...' : 'Rewrite with AI'}
            </button>
          </div>
          {rewrittenComment && (
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-sm text-gray-700">{rewrittenComment}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading || !placeName || !coordinates}
          className="flex-1 bg-black text-white py-3 px-6 rounded-full hover:bg-gray-800 disabled:opacity-50 font-medium transition-colors"
        >
          {loading ? 'Adding...' : 'Add Step'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

