import type { TripStatus } from '@tripmatrix/types';
import { getTripStatusConfig } from '@/constants/tripConstants';

interface TripStatusBadgeProps {
  status: TripStatus;
  isUpcoming?: boolean;
  className?: string;
}

export default function TripStatusBadge({ status, isUpcoming = false, className = '' }: TripStatusBadgeProps) {
  const config = getTripStatusConfig(status, isUpcoming);

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${config.bgColor} ${config.color} ${className}`}>
      {config.label}
    </span>
  );
}


