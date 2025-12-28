import type { ModeOfTravel, TripStatus } from '@tripmatrix/types';

export const VEHICLE_TYPE_LABELS: Record<ModeOfTravel, string> = {
  walk: '🚶 Walking',
  bike: '🚴 Bicycle',
  car: '🚗 Car',
  train: '🚂 Train',
  bus: '🚌 Bus',
  flight: '✈️ Airplane',
};

export const TRIP_STATUS_CONFIG: Record<TripStatus | 'upcoming', { label: string; color: string; bgColor: string }> = {
  in_progress: {
    label: 'Active',
    color: 'text-white',
    bgColor: 'bg-blue-500',
  },
  completed: {
    label: 'Completed',
    color: 'text-white',
    bgColor: 'bg-green-500',
  },
  upcoming: {
    label: 'Upcoming',
    color: 'text-white',
    bgColor: 'bg-purple-500',
  },
};

export const getTripStatusConfig = (status: TripStatus, isUpcoming: boolean = false) => {
  if (isUpcoming) {
    return TRIP_STATUS_CONFIG.upcoming;
  }
  return TRIP_STATUS_CONFIG[status];
};






