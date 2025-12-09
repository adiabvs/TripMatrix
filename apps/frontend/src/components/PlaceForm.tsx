'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import type { TripPlace, RewriteTone } from '@tripmatrix/types';
import { rewriteText } from '@/lib/api';

interface PlaceFormProps {
  tripId: string;
  onSubmit: (place: Partial<TripPlace>) => Promise<void>;
  onCancel: () => void;
  token: string | null;
}

export default function PlaceForm({ tripId, onSubmit, onCancel, token }: PlaceFormProps) {
  const [placeName, setPlaceName] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [rewrittenComment, setRewrittenComment] = useState('');
  const [rewriteTone, setRewriteTone] = useState<RewriteTone>('friendly');
  const [rewriting, setRewriting] = useState(false);
  const [loading, setLoading] = useState(false);
  const autocompleteRef = useRef<HTMLInputElement>(null);
  const autocompleteInstanceRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!autocompleteRef.current || !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) return;

    const loader = new Loader({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      version: 'weekly',
      libraries: ['places'],
    });

    loader.load().then(() => {
      if (autocompleteRef.current) {
        const autocomplete = new google.maps.places.Autocomplete(autocompleteRef.current, {
          types: ['establishment', 'geocode'],
        });

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place.geometry?.location) {
            setPlaceName(place.name || '');
            setCoordinates({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            });
          }
        });

        autocompleteInstanceRef.current = autocomplete;
      }
    });

    return () => {
      if (autocompleteInstanceRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteInstanceRef.current);
      }
    };
  }, []);

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
      alert('Please select a place');
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
      });
      // Reset form
      setPlaceName('');
      setCoordinates(null);
      setRating(0);
      setComment('');
      setRewrittenComment('');
      if (autocompleteRef.current) {
        autocompleteRef.current.value = '';
      }
    } catch (error) {
      console.error('Failed to add place:', error);
      alert('Failed to add place');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">Add Place Visited</h3>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Place Name *
        </label>
        <input
          ref={autocompleteRef}
          type="text"
          placeholder="Search for a place..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      {coordinates && (
        <div className="mb-4 text-sm text-gray-600">
          Location: {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Rating (1-5)
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className={`text-2xl ${
                star <= rating ? 'text-yellow-400' : 'text-gray-300'
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
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
        <div className="mb-4">
          <div className="flex gap-2 mb-2">
            <select
              value={rewriteTone}
              onChange={(e) => setRewriteTone(e.target.value as RewriteTone)}
              className="px-3 py-1 border border-gray-300 rounded"
            >
              <option value="friendly">Friendly</option>
              <option value="professional">Professional</option>
              <option value="travel-blog">Travel Blog</option>
            </select>
            <button
              type="button"
              onClick={handleRewrite}
              disabled={rewriting}
              className="px-4 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {rewriting ? 'Rewriting...' : 'Rewrite with AI'}
            </button>
          </div>
          {rewrittenComment && (
            <div className="p-3 bg-purple-50 rounded border border-purple-200">
              <p className="text-sm text-gray-700">{rewrittenComment}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading || !placeName || !coordinates}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Adding...' : 'Add Place'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

