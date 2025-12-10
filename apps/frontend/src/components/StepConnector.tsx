'use client';

import { useState } from 'react';
import type { TripPlace, ModeOfTravel } from '@tripmatrix/types';
import { formatDistance, formatDuration } from '@tripmatrix/utils';

interface StepConnectorProps {
  fromPlace: TripPlace;
  toPlace: TripPlace;
  isCreator: boolean;
  onUpdateMode: (placeId: string, modeOfTravel: ModeOfTravel | null, distance: number, time: number | null) => Promise<void>;
  onAddStep?: (previousPlace: TripPlace) => void;
  token: string | null;
}

const modeLabels: Record<ModeOfTravel, string> = {
  walk: '🚶 Walk',
  bike: '🚴 Bike',
  car: '🚗 Car',
  train: '🚂 Train',
  bus: '🚌 Bus',
  flight: '✈️ Flight',
};

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

export default function StepConnector({ fromPlace, toPlace, isCreator, onUpdateMode, onAddStep, token }: StepConnectorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedMode, setSelectedMode] = useState<ModeOfTravel | null>(toPlace.modeOfTravel || null);
  const [isSaving, setIsSaving] = useState(false);

  const distance = toPlace.distanceFromPrevious || calculateDistance(
    fromPlace.coordinates.lat,
    fromPlace.coordinates.lng,
    toPlace.coordinates.lat,
    toPlace.coordinates.lng
  );

  const handleSave = async () => {
    if (!token || !isCreator) return;
    
    setIsSaving(true);
    try {
      const time = selectedMode ? calculateTime(distance, selectedMode) : null;
      await onUpdateMode(toPlace.placeId, selectedMode, distance, time);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update mode of travel:', error);
      alert('Failed to update mode of travel');
    } finally {
      setIsSaving(false);
    }
  };

  const hasMode = toPlace.modeOfTravel !== undefined && toPlace.modeOfTravel !== null;

  return (
    <div className="relative flex items-center justify-center py-4">
      {/* Dotted line - centered between place tiles */}
      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 border-l-2 border-dashed border-gray-300 -translate-x-1/2" />
      
      {/* Content - centered */}
      <div className="relative z-10 flex items-center gap-3">
        {!isEditing ? (
          <>
            {/* + Button before mode of travel */}
            {isCreator && onAddStep && (
              <button
                onClick={() => onAddStep(fromPlace)}
                className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors shadow-lg z-20"
                title="Add step before"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
            
            {/* Mode of travel badge */}
            {hasMode ? (
              <div 
                className={`px-4 py-2 rounded-lg border-2 cursor-pointer transition-colors ${
                  isCreator 
                    ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' 
                    : 'bg-gray-50 border-gray-200'
                }`}
                onClick={() => isCreator && setIsEditing(true)}
              >
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-medium text-gray-900">
                    {modeLabels[toPlace.modeOfTravel!]}
                  </span>
                  <span className="text-gray-500">•</span>
                  <span className="text-gray-600">{formatDistance(distance)}</span>
                  {toPlace.timeFromPrevious && (
                    <>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-600">{formatDuration(toPlace.timeFromPrevious)}</span>
                    </>
                  )}
                </div>
              </div>
            ) : (
              isCreator && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 flex items-center justify-center transition-colors border-2 border-dashed border-gray-400"
                  title="Add mode of travel"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )
            )}
            
            {/* + Button after mode of travel */}
            {isCreator && onAddStep && (
              <button
                onClick={() => onAddStep(fromPlace)}
                className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors shadow-lg z-20"
                title="Add step after"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
          </>
        ) : (
          <div className="px-4 py-3 bg-white rounded-lg border-2 border-blue-300 shadow-lg">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Distance: {formatDistance(distance)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['walk', 'bike', 'car', 'train', 'bus', 'flight'] as ModeOfTravel[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSelectedMode(mode)}
                    disabled={isSaving}
                    className={`px-3 py-1.5 rounded-lg border-2 transition-colors text-xs ${
                      selectedMode === mode
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedMode(null)}
                  disabled={isSaving}
                  className={`px-3 py-1.5 rounded-lg border-2 transition-colors text-xs ${
                    selectedMode === null
                      ? 'border-gray-400 bg-gray-100 text-gray-700 font-semibold'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Skip
                </button>
              </div>
              {selectedMode && (
                <div className="text-xs text-gray-600">
                  Est. time: {formatDuration(calculateTime(distance, selectedMode))}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-xs font-medium"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setSelectedMode(toPlace.modeOfTravel || null);
                  }}
                  disabled={isSaving}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

