import Link from 'next/link';
import type { Trip, TripParticipant, User } from '@tripmatrix/types';
import { MdPerson, MdLocationOn, MdStraighten } from 'react-icons/md';

interface TripParticipantsProps {
  trip: Trip;
  creator: User | null;
  participants: User[];
  isUpcoming?: boolean;
  placesCount?: number;
  totalDistance?: number;
  className?: string;
}

export default function TripParticipants({ 
  trip, 
  creator, 
  participants, 
  isUpcoming = false,
  placesCount = 0,
  totalDistance,
  className = '' 
}: TripParticipantsProps) {
  const guestParticipants = trip.participants?.filter((p: TripParticipant) => p.isGuest) || [];
  
  // Remove duplicates - create a Set of unique participant UIDs
  const uniqueParticipantUids = new Set<string>();
  const uniqueParticipants: User[] = [];
  
  // Add creator if exists
  if (creator) {
    uniqueParticipantUids.add(creator.uid);
  }
  
  // Add other participants (excluding creator)
  participants.forEach((participant) => {
    if (!uniqueParticipantUids.has(participant.uid)) {
      uniqueParticipantUids.add(participant.uid);
      uniqueParticipants.push(participant);
    }
  });
  
  const totalCount = (creator ? 1 : 0) + uniqueParticipants.length + guestParticipants.length;

  if (totalCount === 0) {
    return null;
  }

  // Get status message based on trip status
  const getStatusMessage = () => {
    if (isUpcoming) {
      return `${totalCount} ${totalCount === 1 ? 'person is' : 'people are'} going on this trip`;
    } else if (trip.status === 'completed') {
      return `These ${totalCount === 1 ? 'person' : 'people'} enjoyed the trip`;
    } else {
      return `Following ${totalCount === 1 ? 'person is' : 'people are'} enjoying the trip`;
    }
  };

  return (
    <div className={`mt-4 pt-4 border-t border-gray-800 ${className}`}>
      <p className="text-gray-400 text-xs mb-3">
        {getStatusMessage()}
      </p>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Creator */}
        {creator && (
          <Link
            href={`/trips?user=${creator.uid}`}
            className="flex items-center gap-2 hover:opacity-70"
          >
            {creator.photoUrl ? (
              <img
                src={creator.photoUrl}
                alt={creator.name}
                className="w-10 h-10 rounded-full object-cover border-2 border-gray-700"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center border-2 border-gray-700">
                <MdPerson className="w-6 h-6 text-white" />
              </div>
            )}
            <span className="text-white text-sm font-medium">{creator.name}</span>
          </Link>
        )}
        {/* Other Participants (excluding creator) */}
        {uniqueParticipants.map((participant) => (
          <Link
            key={participant.uid}
            href={`/trips?user=${participant.uid}`}
            className="flex items-center gap-2 hover:opacity-70"
          >
            {participant.photoUrl ? (
              <img
                src={participant.photoUrl}
                alt={participant.name}
                className="w-10 h-10 rounded-full object-cover border-2 border-gray-700"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center border-2 border-gray-700">
                <MdPerson className="w-6 h-6 text-white" />
              </div>
            )}
            <span className="text-white text-sm font-medium">{participant.name}</span>
          </Link>
        ))}
        {/* Guest Participants */}
        {guestParticipants.map((guest, idx) => (
          <div key={`guest-${idx}`} className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center border-2 border-gray-700">
              <MdPerson className="w-6 h-6 text-white" />
            </div>
            <span className="text-white text-sm font-medium">{guest.guestName}</span>
          </div>
        ))}
      </div>
      
      {/* Completed Trip Stats */}
      {trip.status === 'completed' && (placesCount > 0 || totalDistance) && (
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
          {placesCount > 0 && (
            <div className="flex items-center gap-1">
              <MdLocationOn className="w-4 h-4" />
              <span>{placesCount} {placesCount === 1 ? 'place' : 'places'} visited</span>
            </div>
          )}
          {totalDistance && totalDistance > 0 && (
            <div className="flex items-center gap-1">
              <MdStraighten className="w-4 h-4" />
              <span>{(totalDistance / 1000).toFixed(1)} km crossed</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

