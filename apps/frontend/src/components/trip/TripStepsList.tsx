import Link from 'next/link';
import React from 'react';
import { MdAdd, MdLocationOn } from 'react-icons/md';
import type { TripPlace, Trip, User } from '@tripmatrix/types';
import CompactStepCard from '@/components/CompactStepCard';
import CountdownTimer from './CountdownTimer';
import { VEHICLE_TYPE_LABELS } from '@/constants/tripConstants';

interface TripStepsListProps {
  places: TripPlace[];
  canEdit: boolean;
  tripId: string;
  expenses: any[];
  creator?: User;
  onDeletePlace: (placeId: string) => Promise<void>;
  onEditPlace: (place: TripPlace) => void;
  isUpcoming?: boolean;
  trip?: Trip | null;
}

export default function TripStepsList({
  places,
  canEdit,
  tripId,
  expenses,
  creator,
  onDeletePlace,
  onEditPlace,
  isUpcoming = false,
  trip,
}: TripStepsListProps) {
  const sortedPlaces = [...places].sort((a, b) => {
    return new Date(a.visitedAt).getTime() - new Date(b.visitedAt).getTime();
  });

  if (isUpcoming) {
    // Show countdown timer for upcoming trips with no steps
    if (trip?.startTime && places.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <CountdownTimer startTime={trip.startTime} />
          <p className="text-gray-400 text-sm text-center mt-4 italic">
            Stay tuned for updates
          </p>
        </div>
      );
    }
    
    // Show message if upcoming but has steps or no start time
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <MdLocationOn className="w-16 h-16 text-gray-600 mb-4" />
        <p className="text-gray-400 text-center mb-2">Trip hasn&apos;t started yet.</p>
        <p className="text-gray-500 text-center text-sm italic">Steps will appear here once the trip begins.</p>
      </div>
    );
  }

  if (sortedPlaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <MdLocationOn className="w-16 h-16 text-gray-600 mb-4" />
        <p className="text-gray-400 text-center mb-4">No steps yet</p>
        {canEdit && (
          <Link
            href={`/trips/${tripId}/steps/new`}
            className="px-6 py-2 bg-[#1976d2] text-white rounded-lg font-medium hover:bg-[#1565c0] transition-colors"
          >
            Add Your First Step
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {sortedPlaces.map((place, index) => {
        const nextPlace = index < sortedPlaces.length - 1 ? sortedPlaces[index + 1] : null;
        const modeOfTravel = nextPlace?.modeOfTravel || place.modeOfTravel;

        return (
          <React.Fragment key={place.placeId}>
            {/* Add Step Button Before (only show before first step) */}
            {canEdit && index === 0 && (
              <div className="relative flex justify-center py-2">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[30px] w-0.5 border-l-2 border-dashed border-gray-600" />
                <Link
                  href={`/trips/${tripId}/steps/new`}
                  className="relative z-10 w-8 h-8 rounded-full bg-[#1976d2] flex items-center justify-center hover:bg-[#1565c0] transition-colors shadow-lg"
                >
                  <MdAdd className="text-white text-lg" />
                </Link>
              </div>
            )}

            {/* Step Card */}
            <div data-step-index={index}>
              <CompactStepCard
                place={place}
                index={index}
                onEdit={onEditPlace}
                onDelete={onDeletePlace}
                isCreator={canEdit}
                tripId={tripId}
                expenses={expenses}
                creator={creator}
              />
            </div>

            {/* Connector between steps */}
            {index < sortedPlaces.length - 1 && (
              <div className="relative flex items-center justify-center py-2">
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 border-l-2 border-dashed border-gray-600 -translate-x-1/2" />

                {canEdit ? (
                  <div className="relative z-10 flex items-center gap-3">
                    <Link
                      href={`/trips/${tripId}/steps/new?after=${place.placeId}`}
                      className="w-8 h-8 rounded-full bg-[#1976d2] flex items-center justify-center hover:bg-[#1565c0] transition-colors shadow-lg"
                    >
                      <MdAdd className="text-white text-lg" />
                    </Link>
                  </div>
                ) : (
                  modeOfTravel && (
                    <div className="relative z-10 px-4 py-2 bg-gray-800 border border-gray-700 rounded-full">
                      <span className="text-white text-sm font-medium">
                        {VEHICLE_TYPE_LABELS[modeOfTravel] || modeOfTravel}
                      </span>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Add Step Button After (only after last step in edit mode) */}
            {canEdit && index === sortedPlaces.length - 1 && (
              <div className="relative flex justify-center py-2">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[30px] w-0.5 border-l-2 border-dashed border-gray-600" />
                <Link
                  href={`/trips/${tripId}/steps/new`}
                  className="relative z-10 w-8 h-8 rounded-full bg-[#1976d2] flex items-center justify-center hover:bg-[#1565c0] transition-colors shadow-lg"
                >
                  <MdAdd className="text-white text-lg" />
                </Link>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

