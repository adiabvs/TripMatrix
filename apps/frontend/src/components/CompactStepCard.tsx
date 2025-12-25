'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import type { TripPlace } from '@tripmatrix/types';
import PhotoViewer from './PhotoViewer';
import Link from 'next/link';

interface CompactStepCardProps {
  place: TripPlace;
  index: number;
  onEdit?: (place: TripPlace) => void;
  onDelete?: (place: TripPlace) => void;
  isCreator?: boolean;
  tripId: string;
}

export default function CompactStepCard({ 
  place, 
  index,
  onEdit,
  onDelete,
  isCreator,
  tripId
}: CompactStepCardProps) {
  const [viewingPhotos, setViewingPhotos] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const visitedDate = toDate(place.visitedAt);
  
  // Get image list
  const imageList = place.imageMetadata 
    ? place.imageMetadata.map(img => img.url)
    : (place.images || []);

  const imageMetadata = place.imageMetadata || place.images?.map(url => ({ url, isPublic: false })) || [];

  const handlePhotoClick = (index: number) => {
    setPhotoIndex(index);
    setViewingPhotos(true);
  };

  // Use first image as cover, or placeholder
  const coverImage = imageList.length > 0 ? imageList[0] : null;

  const cardContent = (
    <div className="relative h-[140px] rounded-lg overflow-hidden bg-gray-200 shadow-md cursor-pointer">
      {/* Cover Image or Gradient Background */}
      <div className="absolute inset-0">
        {coverImage ? (
          <img
            src={coverImage}
            alt={place.name}
            className="w-full h-full object-cover"
            onClick={() => handlePhotoClick(0)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200">
            <span className="text-4xl">📍</span>
          </div>
        )}
        {/* Dark grey overlay */}
        <div className="absolute inset-0 bg-[rgba(66,66,66,0.4)]" />
      </div>
      
      {/* Delete Button */}
      {isCreator && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (confirm(`Are you sure you want to delete "${place.name}"?`)) {
              onDelete(place);
            }
          }}
          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500/90 flex items-center justify-center z-10"
          title="Delete step"
        >
          <span className="text-white text-xs">×</span>
        </button>
      )}
      
      {/* Content Overlay - No padding, backgrounds cover completely */}
      <div className="absolute inset-0 flex flex-col justify-between">
        {/* Top Banner: Step Name - Full width, no padding */}
        <div className="flex justify-between items-center bg-[rgba(66,66,66,0.85)] w-full">
          <h3 className="text-[9px] font-semibold text-white flex-1 px-2 py-1 truncate leading-tight">
            {place.name}
          </h3>
        </div>
        
        {/* Bottom Section: Date (left) and Rating (right) - Full width, no padding */}
        <div className="flex justify-between items-center bg-[rgba(66,66,66,0.7)] w-full">
          {visitedDate && !isNaN(visitedDate.getTime()) && (
            <span className="text-[9px] text-white opacity-90 px-2 py-1 truncate leading-tight">
              {format(visitedDate, 'MMM dd')}
            </span>
          )}
          {place.rating && (
            <div className="flex items-center gap-0.5 px-2 py-1">
              <span className="text-[9px] text-white">⭐</span>
              <span className="text-[9px] text-white font-medium leading-tight">{place.rating}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-shrink-0 w-[160px] mr-3">
      <Link 
        href={`/trips/${tripId}/steps/${place.placeId}/edit`}
        className="block"
      >
        {cardContent}
      </Link>
      
      {/* Photo Viewer */}
      {viewingPhotos && imageList.length > 0 && (
        <PhotoViewer
          images={imageMetadata.length > 0 ? imageMetadata : imageList.map(url => ({ url, isPublic: false }))}
          initialIndex={photoIndex}
          onClose={() => setViewingPhotos(false)}
        />
      )}
    </div>
  );
}
