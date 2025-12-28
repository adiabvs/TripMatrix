import Link from 'next/link';
import type { Trip, User } from '@tripmatrix/types';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import { MdPerson, MdShare } from 'react-icons/md';
import TripStatusBadge from './TripStatusBadge';
import CountdownTimer from './CountdownTimer';
import TripParticipants from './TripParticipants';

interface TripInfoCardProps {
  trip: Trip;
  creator: User | null;
  participants: User[];
  isUpcoming: boolean;
  placesCount?: number;
  canShare?: boolean; // Whether user has access to share this trip
  className?: string;
}

export default function TripInfoCard({ 
  trip, 
  creator, 
  participants, 
  isUpcoming, 
  placesCount = 0,
  canShare = false,
  className = '' 
}: TripInfoCardProps) {
  const handleShare = () => {
    if (typeof window === 'undefined') return;
    
    // Use public route for public trips, regular route for private trips
    const tripUrl = trip.isPublic 
      ? `${window.location.origin}/trip/${trip.tripId}`
      : `${window.location.origin}/trips/${trip.tripId}`;
    const shareText = `Check out this trip: ${trip.title}${trip.description ? ` - ${trip.description}` : ''}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${tripUrl}`)}`;
    
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className={`bg-black border border-gray-800 rounded-lg overflow-hidden ${className}`}>
      {/* Instagram-style Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {creator?.photoUrl ? (
              <img
                src={creator.photoUrl}
                alt={creator.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                <MdPerson className="w-6 h-6 text-white" />
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
          <div className="flex items-center gap-2">
            <TripStatusBadge status={trip.status} isUpcoming={isUpcoming} />
            {canShare && (
              <button
                onClick={handleShare}
                className="p-2 hover:bg-gray-800 rounded-full transition-colors active:scale-95"
                aria-label="Share trip on WhatsApp"
                title="Share on WhatsApp"
              >
                <MdShare className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="px-4 py-3">
        <h2 className="text-white font-semibold text-base mb-2">{trip.title}</h2>
        {trip.description && (
          <p className="text-gray-300 text-sm mb-4 whitespace-pre-wrap">{trip.description}</p>
        )}
        
        {/* Upcoming Trip Countdown - Show for upcoming trips with no steps */}
        {isUpcoming && trip.startTime && placesCount === 0 && (
          <div className="mb-4">
            <CountdownTimer startTime={trip.startTime} />
            <p className="text-gray-400 text-sm text-center mt-3 italic">
              Stay tuned for updates
            </p>
          </div>
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

