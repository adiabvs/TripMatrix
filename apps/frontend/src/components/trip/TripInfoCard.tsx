import Link from 'next/link';
import type { Trip, User } from '@tripmatrix/types';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import { MdPerson } from 'react-icons/md';
import TripStatusBadge from './TripStatusBadge';
import CountdownTimer from './CountdownTimer';
import TripParticipants from './TripParticipants';

interface TripInfoCardProps {
  trip: Trip;
  creator: User | null;
  participants: User[];
  isUpcoming: boolean;
  placesCount?: number;
  className?: string;
}

export default function TripInfoCard({ 
  trip, 
  creator, 
  participants, 
  isUpcoming, 
  placesCount = 0,
  className = '' 
}: TripInfoCardProps) {
  return (
    <div className={`bg-black border border-gray-800 rounded-lg overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {creator?.photoUrl ? (
              <img
                src={creator.photoUrl}
                alt={creator.name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                <MdPerson className="w-5 h-5 text-white" />
              </div>
            )}
            <div>
              <Link
                href={`/trips?user=${trip.creatorId}`}
                className="text-white font-semibold text-sm hover:opacity-70"
              >
                {creator?.name || 'Trip Creator'}
              </Link>
              <p className="text-gray-400 text-xs">
                {format(toDate(trip.createdAt), 'MMM dd, yyyy')}
              </p>
            </div>
          </div>
          <TripStatusBadge status={trip.status} isUpcoming={isUpcoming} />
        </div>
      </div>
      <div className="px-4 py-3">
        <h2 className="text-white font-semibold text-sm mb-2">{trip.title}</h2>
        {trip.description && (
          <p className="text-gray-300 text-sm mb-4">{trip.description}</p>
        )}
        
        {/* Upcoming Trip Countdown */}
        {isUpcoming && trip.startTime && (
          <CountdownTimer startTime={trip.startTime} className="mb-4" />
        )}
        
        {/* Participants Section */}
        <TripParticipants 
          trip={trip} 
          creator={creator} 
          participants={participants}
          isUpcoming={isUpcoming}
          placesCount={placesCount}
          totalDistance={trip.totalDistance}
        />
      </div>
    </div>
  );
}

