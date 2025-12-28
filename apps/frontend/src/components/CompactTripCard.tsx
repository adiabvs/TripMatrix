'use client';

import Link from 'next/link';
import type { Trip, User } from '@tripmatrix/types';
import { MdMap, MdFavorite, MdChatBubbleOutline } from 'react-icons/md';

interface CompactTripCardProps {
  trip: Trip;
  onPress?: () => void;
  creator?: User;
}

export default function CompactTripCard({ trip, onPress, creator }: CompactTripCardProps) {
  const statusColor = trip.status === 'completed' ? '#4caf50' : '#ffc107';
  
  // Get creator name from user profile or fallback
  const getCreatorName = () => {
    if (creator?.name) {
      return creator.name;
    }
    // Find creator in participants
    const creatorParticipant = trip.participants?.find(p => 
      (p.uid && p.uid === trip.creatorId) || 
      (!p.uid && p.guestName && trip.creatorId === p.guestName)
    );
    
    // If creator is a guest, use guest name
    if (creatorParticipant?.isGuest && creatorParticipant.guestName) {
      return creatorParticipant.guestName;
    }
    
    // If creator is a user participant but we don't have user data, show "You" if it's the current user
    // Otherwise, try to extract a readable name from the UID
    if (creatorParticipant?.uid) {
      // If it's a Firebase UID (long alphanumeric), show a shortened version
      if (creatorParticipant.uid.length > 20) {
        return 'Trip Creator';
      }
      return creatorParticipant.uid;
    }
    
    // Last resort: extract from email or generate
    if (trip.creatorId?.includes('@')) {
      const emailPart = trip.creatorId.split('@')[0];
      return emailPart.charAt(0).toUpperCase() + emailPart.slice(1).replace(/[._-]/g, ' ');
    }
    
    return 'Trip Creator';
  };
  
  const creatorName = getCreatorName();
  const loveCount = 0;
  const commentCount = 0;

  const cardContent = (
    <div className="relative h-[160px] rounded-xl overflow-hidden bg-white shadow-lg cursor-pointer border border-gray-200">
      {/* Cover Image or Gradient Background */}
      <div className="absolute inset-0">
        {trip.coverImage ? (
          <img
            src={trip.coverImage}
            alt={trip.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <MdMap className="text-4xl text-gray-400" />
          </div>
        )}
        {/* Light overlay */}
        <div className="absolute inset-0 bg-[rgba(0,0,0,0.2)]" />
      </div>
      
      {/* Content Overlay - No padding, backgrounds cover completely */}
      <div className="absolute inset-0 flex flex-col justify-between">
        {/* Top Banner: Trip Name (left) and Status (right) - Full width, no padding */}
        <div className="flex justify-between items-center bg-[rgba(0,0,0,0.7)] w-full">
          <h3 className="text-[8px] font-semibold text-white flex-1 px-3 py-2 truncate leading-tight">
            {trip.title}
          </h3>
          <div 
            className="w-2 h-2 rounded-full border border-white flex-shrink-0 mr-2"
            style={{ backgroundColor: statusColor }}
          />
        </div>
        
        {/* Bottom Section: Creator (left) and Counts (right) - Full width, no padding */}
        <div className="flex justify-between items-center bg-[rgba(0,0,0,0.6)] w-full">
          <span className="text-[9px] text-white opacity-90 px-3 py-2 truncate leading-tight">
            {creatorName}
          </span>
          <div className="flex items-center gap-0.5 px-3 py-2">
            <MdFavorite className="text-[9px] text-white" />
            <span className="text-[9px] text-white font-medium leading-tight">{loveCount}</span>
            <MdChatBubbleOutline className="text-[9px] text-white ml-0.5" />
            <span className="text-[9px] text-white font-medium leading-tight">{commentCount}</span>
          </div>
        </div>
      </div>
    </div>
  );

  if (onPress) {
    return (
      <div onClick={onPress} className="w-full">
        {cardContent}
      </div>
    );
  }

  return (
    <Link href={`/trips/${trip.tripId}`} className="w-full">
      {cardContent}
    </Link>
  );
}
