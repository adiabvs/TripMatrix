import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import type { Trip, User } from '@tripmatrix/types';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import { MdPerson, MdShare, MdContentCopy, MdCheck } from 'react-icons/md';
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
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
        setShowShareMenu(false);
      }
    };

    if (showShareMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showShareMenu]);

  const getTripUrl = () => {
    if (typeof window === 'undefined') return '';
    return trip.isPublic 
      ? `${window.location.origin}/trip/${trip.tripId}`
      : `${window.location.origin}/trips/${trip.tripId}`;
  };

  const handleWhatsAppShare = () => {
    if (typeof window === 'undefined') return;
    
    const tripUrl = getTripUrl();
    const shareText = `Check out this trip: ${trip.title}${trip.description ? ` - ${trip.description}` : ''}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${tripUrl}`)}`;
    
    window.open(whatsappUrl, '_blank');
    setShowShareMenu(false);
  };

  const handleCopyLink = async () => {
    if (typeof window === 'undefined') return;
    
    const tripUrl = getTripUrl();
    
    try {
      await navigator.clipboard.writeText(tripUrl);
      setLinkCopied(true);
      setShowShareMenu(false);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = tripUrl;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setLinkCopied(true);
        setShowShareMenu(false);
        setTimeout(() => setLinkCopied(false), 2000);
      } catch (err) {
        console.error('Fallback copy failed:', err);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="bg-black border border-gray-800 rounded-lg overflow-hidden">
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
                <div className="relative" ref={shareMenuRef}>
                  <button
                    onClick={() => setShowShareMenu(!showShareMenu)}
                    className="p-2 hover:bg-gray-800 rounded-full transition-colors active:scale-95 relative"
                    aria-label="Share trip"
                    title="Share trip"
                  >
                    {linkCopied ? (
                      <MdCheck className="w-5 h-5 text-green-500" />
                    ) : (
                      <MdShare className="w-5 h-5 text-white" />
                    )}
                  </button>
                  
                  {showShareMenu && (
                    <div className="absolute right-0 top-full mt-2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[180px]">
                      <button
                        onClick={handleWhatsAppShare}
                        className="w-full px-4 py-3 text-left text-white hover:bg-gray-800 flex items-center gap-3 transition-colors first:rounded-t-lg"
                      >
                        <MdShare className="w-5 h-5" />
                        <span className="text-sm">Share on WhatsApp</span>
                      </button>
                      <button
                        onClick={handleCopyLink}
                        className="w-full px-4 py-3 text-left text-white hover:bg-gray-800 flex items-center gap-3 transition-colors last:rounded-b-lg border-t border-gray-700"
                      >
                        <MdContentCopy className="w-5 h-5" />
                        <span className="text-sm">Copy Link</span>
                      </button>
                    </div>
                  )}
                </div>
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
    </div>
  );
}

