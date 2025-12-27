import type { Trip, User } from '@tripmatrix/types';

export interface TripPermissions {
  isCreator: boolean;
  isParticipant: boolean;
  canEdit: boolean;
  isUpcoming: boolean;
}

export function useTripPermissions(trip: Trip | null, user: User | null): TripPermissions {
  if (!trip) {
    return {
      isCreator: false,
      isParticipant: false,
      canEdit: false,
      isUpcoming: false,
    };
  }

  const isCreator = user?.uid === trip.creatorId;
  const isParticipant = trip.participants?.some((p) => p.uid === user?.uid) || false;
  const canEdit = isCreator || isParticipant;
  
  const isUpcoming = trip.startTime 
    ? new Date(trip.startTime).getTime() > Date.now()
    : false;

  return {
    isCreator,
    isParticipant,
    canEdit,
    isUpcoming,
  };
}


