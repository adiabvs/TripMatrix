'use client';

import Link from 'next/link';
import type { Trip, User } from '@tripmatrix/types';

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
    // Fallback to participant guest name
    const creatorParticipant = trip.participants?.find(p => p.uid === trip.creatorId);
    if (creatorParticipant?.guestName) {
      return creatorParticipant.guestName;
    }
    // Last resort: extract from email or generate
    if (trip.creatorId?.includes('@')) {
      const emailPart = trip.creatorId.split('@')[0];
      return emailPart.charAt(0).toUpperCase() + emailPart.slice(1).replace(/[._-]/g, ' ');
    }
    return 'User';
  };
  
  const creatorName = getCreatorName();
  const loveCount = 0;
  const commentCount = 0;

  const cardContent = (
    <div className="relative h-[140px] rounded-lg overflow-hidden bg-gray-200 shadow-md cursor-pointer">
      {/* Cover Image or Gradient Background */}
      <div className="absolute inset-0">
        {trip.coverImage ? (
          <img
            src={trip.coverImage}
            alt={trip.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200">
            <span className="text-4xl">🗺️</span>
          </div>
        )}
        {/* Dark grey overlay */}
        <div className="absolute inset-0 bg-[rgba(66,66,66,0.4)]" />
      </div>
      
      {/* Content Overlay - No padding, backgrounds cover completely */}
      <div className="absolute inset-0 flex flex-col justify-between">
        {/* Top Banner: Trip Name (left) and Status (right) - Full width, no padding */}
        <div className="flex justify-between items-center bg-[rgba(66,66,66,0.85)] w-full">
          <h3 className="text-[9px] font-semibold text-white flex-1 px-2 py-1 truncate leading-tight">
            {trip.title}
          </h3>
          <div 
            className="w-2 h-2 rounded-full border border-white flex-shrink-0 mr-2"
            style={{ backgroundColor: statusColor }}
          />
        </div>
        
        {/* Bottom Section: Creator (left) and Counts (right) - Full width, no padding */}
        <div className="flex justify-between items-center bg-[rgba(66,66,66,0.7)] w-full">
          <span className="text-[9px] text-white opacity-90 px-2 py-1 truncate leading-tight">
            {creatorName}
          </span>
          <div className="flex items-center gap-0.5 px-2 py-1">
            <span className="text-[9px] text-white">❤️</span>
            <span className="text-[9px] text-white font-medium leading-tight">{loveCount}</span>
            <span className="text-[9px] text-white ml-0.5">💬</span>
            <span className="text-[9px] text-white font-medium leading-tight">{commentCount}</span>
          </div>
        </div>
      </div>
    </div>
  );

  if (onPress) {
    return (
      <div onClick={onPress} className="flex-shrink-0 w-[75vw] md:w-[400px] mr-3">
        {cardContent}
      </div>
    );
  }

  return (
    <Link href={`/trips/${trip.tripId}`} className="flex-shrink-0 w-[75vw] md:w-[400px] mr-3">
      {cardContent}
    </Link>
  );
}
