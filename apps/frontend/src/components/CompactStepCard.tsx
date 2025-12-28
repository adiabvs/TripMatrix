'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import type { TripPlace, TripExpense, User } from '@tripmatrix/types';
import PhotoViewer from './PhotoViewer';
import Link from 'next/link';
import { MdDelete, MdLocationOn, MdStar, MdAttachMoney, MdFavorite, MdChatBubbleOutline, MdMoreVert, MdPerson } from 'react-icons/md';
import { formatCurrency } from '@/lib/currencyUtils';
import { likePlace, unlikePlace, getPlaceLikes, getPlaceComments } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface CompactStepCardProps {
  place: TripPlace;
  index: number;
  onEdit?: (place: TripPlace) => void;
  onDelete?: (placeId: string) => Promise<void>;
  isCreator?: boolean;
  tripId: string;
  expenses?: TripExpense[];
  creator?: User;
}

export default function CompactStepCard({ 
  place, 
  index,
  onEdit,
  onDelete,
  isCreator,
  tripId,
  expenses = [],
  creator
}: CompactStepCardProps) {
  const { user, getIdToken } = useAuth();
  const [viewingPhotos, setViewingPhotos] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [likes, setLikes] = useState<{ count: number; isLiked: boolean }>({ count: 0, isLiked: false });
  const [commentCount, setCommentCount] = useState(0);
  const [loadingLikes, setLoadingLikes] = useState(true);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
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

  // Load likes and comment count
  useEffect(() => {
    const loadLikesAndComments = async () => {
      try {
        const token = user ? await getIdToken() : null;
        const [likesData, comments] = await Promise.all([
          getPlaceLikes(place.placeId, token).catch(() => ({ likeCount: 0, isLiked: false })),
          getPlaceComments(place.placeId, token).catch(() => []),
        ]);
        setLikes({ count: likesData.likeCount, isLiked: likesData.isLiked });
        setCommentCount(comments.length);
      } catch (error) {
        console.error('Failed to load likes/comments:', error);
      } finally {
        setLoadingLikes(false);
      }
    };

    loadLikesAndComments();
  }, [place.placeId, user, getIdToken]);

  // Reset image index when place changes
  useEffect(() => {
    setCurrentImageIndex(0);
  }, [place.placeId]);

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

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    
    try {
      const token = await getIdToken();
      if (likes.isLiked) {
        await unlikePlace(place.placeId, token);
        setLikes(prev => ({ count: Math.max(0, prev.count - 1), isLiked: false }));
      } else {
        await likePlace(place.placeId, token);
        setLikes(prev => ({ count: prev.count + 1, isLiked: true }));
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  };

  return (
    <div className="w-full">
      <div className="bg-black border border-gray-800 rounded-lg overflow-hidden">
        {/* Post Header - Only delete button if creator */}
        {isCreator && onDelete && (
          <div className="flex items-center justify-end px-4 py-3 border-b border-gray-800">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (confirm(`Are you sure you want to delete "${place.name}"?`)) {
                  onDelete(place.placeId);
                }
              }}
              className="text-white hover:opacity-70"
            >
              <MdMoreVert className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Cover Image with Carousel */}
        <div 
          className="relative w-full aspect-square bg-gray-900 overflow-hidden cursor-pointer"
          onTouchStart={(e) => {
            e.stopPropagation();
            setTouchStart(e.targetTouches[0].clientX);
            setTouchEnd(0);
          }}
          onTouchMove={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setTouchEnd(e.targetTouches[0].clientX);
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            if (!touchStart || !touchEnd) {
              setTouchStart(0);
              setTouchEnd(0);
              return;
            }
            const distance = touchStart - touchEnd;
            const isLeftSwipe = distance > 50;
            const isRightSwipe = distance < -50;
            
            if (isLeftSwipe && currentImageIndex < imageList.length - 1) {
              setCurrentImageIndex(currentImageIndex + 1);
            } else if (isRightSwipe && currentImageIndex > 0) {
              setCurrentImageIndex(currentImageIndex - 1);
            }
            
            // Reset touch values
            setTouchStart(0);
            setTouchEnd(0);
          }}
        >
            {imageList.length > 0 ? (
              <>
                <div className="relative h-full w-full">
                  {imageList.map((img, idx) => (
                    <div
                      key={idx}
                      className="absolute inset-0 h-full w-full transition-opacity duration-300"
                      style={{
                        opacity: idx === currentImageIndex ? 1 : 0,
                        zIndex: idx === currentImageIndex ? 1 : 0,
                        pointerEvents: idx === currentImageIndex ? 'auto' : 'none'
                      }}
                    >
                      {isCreator ? (
                        <Link 
                          href={`/trips/${tripId}/steps/${place.placeId}/edit`}
                          onClick={(e) => {
                            // Only navigate if not swiping
                            if (touchStart && touchEnd && Math.abs(touchStart - touchEnd) > 10) {
                              e.preventDefault();
                            }
                          }}
                          className="block w-full h-full"
                        >
                          <img
                            src={img}
                            alt={`${place.name} - Image ${idx + 1}`}
                            className="w-full h-full object-cover select-none pointer-events-none"
                            draggable={false}
                            loading="lazy"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handlePhotoClick(idx);
                            }}
                          />
                        </Link>
                      ) : (
                        <div className="block w-full h-full">
                          <img
                            src={img}
                            alt={`${place.name} - Image ${idx + 1}`}
                            className="w-full h-full object-cover select-none pointer-events-none"
                            draggable={false}
                            loading="lazy"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handlePhotoClick(idx);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* Carousel Dots */}
                {imageList.length > 1 && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-0.5 z-10 pointer-events-none">
                    {imageList.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setCurrentImageIndex(idx);
                        }}
                        className={`rounded-full transition-all pointer-events-auto ${
                          idx === currentImageIndex ? 'bg-white' : 'bg-white/50'
                        }`}
                        style={{
                          width: idx === currentImageIndex ? '8px' : '4px',
                          height: '4px',
                          minWidth: '4px',
                          minHeight: '4px',
                          padding: 0
                        }}
                        aria-label={`Go to image ${idx + 1}`}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full blur-2xl opacity-30"></div>
                  <div className="relative bg-gradient-to-br from-blue-400 to-purple-500 rounded-full p-8">
                    <MdLocationOn className="w-20 h-20 text-white" />
                  </div>
                </div>
                <p className="mt-4 text-sm text-gray-400 font-medium">No Photo</p>
                <p className="text-xs text-gray-500 mt-1">Add a photo to make it beautiful</p>
              </div>
            )}
            {/* Rating Badge */}
            {place.rating && (
              <div className="absolute top-3 left-3">
                <div className="flex items-center gap-1 bg-black/70 px-2 py-1 rounded">
                  <MdStar className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs font-semibold text-white">{place.rating}</span>
                </div>
              </div>
            )}
        </div>

        {/* Actions */}
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleLike}
              className="text-white hover:opacity-70 active:scale-95 transition-transform p-1 rounded-full"
              disabled={loadingLikes || !user}
            >
              <MdFavorite className={`w-6 h-6 ${likes.isLiked ? 'text-red-500 fill-red-500' : ''}`} />
            </button>
            {isCreator ? (
              <Link 
                href={`/trips/${tripId}/steps/${place.placeId}/edit`} 
                className="text-white hover:opacity-70 active:scale-95 transition-transform p-1 rounded-full flex items-center gap-1"
              >
                <MdChatBubbleOutline className="w-6 h-6" />
              </Link>
            ) : (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePhotoClick(0);
                }}
                className="text-white hover:opacity-70 active:scale-95 transition-transform p-1 rounded-full flex items-center gap-1"
              >
                <MdChatBubbleOutline className="w-6 h-6" />
              </button>
            )}
          </div>
          {(likes.count > 0 || commentCount > 0) && (
            <div className="flex items-center gap-4 text-sm">
              {likes.count > 0 && (
                <span className="text-white font-semibold">
                  {likes.count} {likes.count === 1 ? 'like' : 'likes'}
                </span>
              )}
              {commentCount > 0 && (isCreator ? (
                <Link 
                  href={`/trips/${tripId}/steps/${place.placeId}/edit`} 
                  className="text-gray-400 hover:text-white"
                >
                  {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
                </Link>
              ) : (
                <span className="text-gray-400">
                  {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
                </span>
              ))}
            </div>
          )}

          {/* Place Info */}
          <div>
            {isCreator ? (
              <Link
                href={`/trips/${tripId}/steps/${place.placeId}/edit`}
                className="text-white font-semibold text-sm hover:opacity-70"
              >
                {place.name}
              </Link>
            ) : (
              <span className="text-white font-semibold text-sm">
                {place.name}
              </span>
            )}
            {place.comment && (
              <p className="text-gray-300 text-sm mt-1 line-clamp-2">
                {place.comment}
              </p>
            )}
            {place.rewrittenComment && (
              <p className="text-gray-300 text-sm mt-1 line-clamp-2 italic">
                {place.rewrittenComment}
              </p>
            )}
            {Object.keys(expensesByCurrency).length > 0 && (
              <div className="flex items-center gap-1 mt-2 text-gray-400 text-xs">
                <MdAttachMoney className="w-4 h-4" />
                <span>
                  {Object.entries(expensesByCurrency).map(([curr, total]) => 
                    formatCurrency(total, curr, false)
                  ).join(', ')}
                </span>
              </div>
            )}
          </div>
          
          {/* Creator name and date at bottom */}
          <div className="mt-2 pt-2 border-t border-gray-800">
            <div className="flex items-center gap-2">
              <Link
                href={`/trips?user=${creator?.uid || tripId}`}
                className="text-white font-semibold text-sm hover:opacity-70"
              >
                {creator?.name || 'Trip'}
              </Link>
              {visitedDate && !isNaN(visitedDate.getTime()) && (
                <>
                  <span className="text-gray-500">•</span>
                  <span className="text-gray-400 text-xs">
                    {format(visitedDate, 'MMM dd, yyyy')}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      
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
