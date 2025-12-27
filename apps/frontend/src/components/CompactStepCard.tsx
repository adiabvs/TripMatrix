'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import type { TripPlace, TripExpense } from '@tripmatrix/types';
import PhotoViewer from './PhotoViewer';
import Link from 'next/link';
import { MdDelete, MdLocationOn, MdStar, MdAttachMoney } from 'react-icons/md';
import { formatCurrency } from '@/lib/currencyUtils';

interface CompactStepCardProps {
  place: TripPlace;
  index: number;
  onEdit?: (place: TripPlace) => void;
  onDelete?: (place: TripPlace) => void;
  isCreator?: boolean;
  tripId: string;
  expenses?: TripExpense[];
}

export default function CompactStepCard({ 
  place, 
  index,
  onEdit,
  onDelete,
  isCreator,
  tripId,
  expenses = []
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

  // Filter expenses for this place
  const placeExpenses = expenses.filter(e => e.placeId === place.placeId);
  
  // Calculate total expenses by currency
  const expensesByCurrency = placeExpenses.reduce((acc, e) => {
    const curr = e.currency || 'USD';
    if (!acc[curr]) acc[curr] = 0;
    acc[curr] += e.amount;
    return acc;
  }, {} as Record<string, number>);

  const cardContent = (
    <div className="relative h-[160px] rounded-xl overflow-hidden bg-white shadow-lg cursor-pointer border border-gray-200">
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
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <MdLocationOn className="text-4xl text-gray-400" />
          </div>
        )}
        {/* Light overlay */}
        <div className="absolute inset-0 bg-[rgba(0,0,0,0.2)]" />
      </div>
      
      {/* Content Overlay - No padding, backgrounds cover completely */}
      <div className="absolute inset-0 flex flex-col justify-between">
        {/* Top Banner: Step Name - Full width, no padding */}
        <div className="flex justify-between items-center bg-[rgba(0,0,0,0.7)] w-full">
          <h3 className="text-[8px] font-semibold text-white flex-1 px-3 py-2 truncate leading-tight">
            {place.name}
          </h3>
          {/* Delete Button - Inside title banner */}
          {isCreator && onDelete && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (confirm(`Are you sure you want to delete "${place.name}"?`)) {
                  onDelete(place);
                }
              }}
              className="bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center mr-2 flex-shrink-0 transition-colors cursor-pointer"
              title="Delete step"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (confirm(`Are you sure you want to delete "${place.name}"?`)) {
                    onDelete(place);
                  }
                }
              }}
              style={{ width: '20px', height: '20px' }}
            >
              <div className="w-4 h-4 rounded-full border-2 border-[#800000] flex items-center justify-center">
                <MdDelete className="w-3 h-3 text-white" />
              </div>
            </div>
          )}
        </div>
        
        {/* Bottom Section: Date (left) and Rating/Expenses (right) - Full width, no padding */}
        <div className="flex justify-between items-center bg-[rgba(0,0,0,0.6)] w-full">
          {visitedDate && !isNaN(visitedDate.getTime()) && (
            <span className="text-[9px] text-white opacity-90 px-3 py-2 truncate leading-tight">
              {format(visitedDate, 'MMM dd')}
            </span>
          )}
          <div className="flex items-center gap-2 px-3 py-2">
            {place.rating && (
              <div className="flex items-center gap-0.5">
                <MdStar className="text-[9px] text-yellow-400" />
                <span className="text-[9px] text-white font-medium leading-tight">{place.rating}</span>
              </div>
            )}
            {placeExpenses.length > 0 && (
              <div className="flex items-center gap-1">
                <MdAttachMoney className="text-[9px] text-white" />
                <span className="text-[9px] text-white font-medium leading-tight">
                  {Object.entries(expensesByCurrency).map(([curr, total]) => 
                    formatCurrency(total, curr, false)
                  ).join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full">
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
