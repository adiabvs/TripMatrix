'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import type { TripPlace, TripExpense, ModeOfTravel } from '@tripmatrix/types';
import PhotoViewer from './PhotoViewer';
import { formatCurrency } from '@/lib/currencyUtils';

interface StepCardProps {
  place: TripPlace;
  index: number;
  isLast: boolean;
  expenses?: TripExpense[];
  onAddStep?: () => void;
  showAddButton?: boolean;
  onEdit?: (place: TripPlace) => void;
  onDelete?: (place: TripPlace) => void;
  onAddExpense?: (place: TripPlace) => void;
  isCreator?: boolean; // Can edit (creator or participant)
  expenseVisibility?: 'everyone' | 'members' | 'creator'; // Trip expense visibility setting
  currentUserId?: string; // Current user ID to check visibility
  isTripMember?: boolean; // Whether current user is a trip member
}

const modeLabels: Record<ModeOfTravel, string> = {
  walk: '🚶 Walk',
  bike: '🚴 Bike',
  car: '🚗 Car',
  train: '🚂 Train',
  bus: '🚌 Bus',
  flight: '✈️ Flight',
};

export default function StepCard({ place, index, isLast, expenses = [], onAddStep, showAddButton, onEdit, onDelete, onAddExpense, isCreator, expenseVisibility = 'members', currentUserId, isTripMember = false }: StepCardProps) {
  const [viewingPhotos, setViewingPhotos] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const visitedDate = toDate(place.visitedAt);
  
  // Filter expenses based on visibility settings
  let visibleExpenses = expenses.filter((e) => e.placeId === place.placeId);
  
  if (expenseVisibility === 'creator') {
    // Only creator can see expenses
    visibleExpenses = isCreator ? visibleExpenses : [];
  } else if (expenseVisibility === 'members') {
    // Only trip members can see expenses
    visibleExpenses = isTripMember || isCreator ? visibleExpenses : [];
  }
  // If 'everyone', show all expenses (no filtering needed)
  
  // Group expenses by currency
  const expensesByCurrency = visibleExpenses.reduce((acc, e) => {
    const curr = e.currency || 'USD';
    if (!acc[curr]) acc[curr] = [];
    acc[curr].push(e);
    return acc;
  }, {} as Record<string, TripExpense[]>);
  
  const totalByCurrency = Object.entries(expensesByCurrency).map(([curr, exps]) => ({
    currency: curr,
    total: exps.reduce((sum, e) => sum + e.amount, 0),
  }));

  // Get image list (support both formats)
  const imageList = place.imageMetadata 
    ? place.imageMetadata.map(img => img.url)
    : (place.images || []);

  const imageMetadata = place.imageMetadata || place.images?.map(url => ({ url, isPublic: false })) || [];

  const handlePhotoClick = (index: number) => {
    setPhotoIndex(index);
    setViewingPhotos(true);
  };

  return (
    <div className="relative">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-8 top-20 bottom-0 w-0.5 bg-gray-200" />
      )}
      
      <div className="flex gap-6 pb-12">
        {/* Timeline dot */}
        <div className="relative z-10 flex-shrink-0">
          <div className="w-16 h-16 rounded-full bg-white border-4 border-gray-900 flex items-center justify-center shadow-lg">
            <span className="text-sm font-bold text-gray-900">{index + 1}</span>
          </div>
          {/* Add Step Button */}
          {showAddButton && onAddStep && (
            <button
              onClick={onAddStep}
              className="absolute left-1/2 -translate-x-1/2 top-20 w-10 h-10 rounded-full bg-black text-white flex items-center justify-center shadow-lg hover:bg-gray-800 transition-colors z-20"
              title="Add step here"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 pt-2">
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            {/* Place images - Stacked cards style */}
            {imageList.length > 0 ? (
              <div 
                className="w-full h-64 relative cursor-pointer"
                onClick={() => handlePhotoClick(0)}
              >
                {/* Stacked cards effect */}
                {imageList.slice(0, 3).map((imageUrl, idx) => {
                  const zIndex = imageList.length - idx;
                  const offset = idx * 8;
                  const scale = 1 - (idx * 0.05);
                  const opacity = idx === 0 ? 1 : 0.7;
                  
                  return (
                    <div
                      key={idx}
                      className="absolute inset-0 rounded-t-2xl overflow-hidden"
                      style={{
                        zIndex,
                        transform: `translate(${offset}px, ${offset}px) scale(${scale})`,
                        opacity,
                      }}
                    >
                      <img
                        src={imageUrl}
                        alt={`${place.name} ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {idx === 0 && imageMetadata[0] && (
                        <div className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium bg-black/50 text-white">
                          {imageMetadata[0].isPublic ? '🌐 Public' : '🔒 Private'}
                        </div>
                      )}
                      {idx === 0 && imageList.length > 1 && (
                        <div className="absolute bottom-2 right-2 px-2 py-1 rounded text-xs font-medium bg-black/50 text-white">
                          {imageList.length} photos
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
            {imageList.length === 0 && (
              <div className="w-full h-64 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            )}

            {/* Photo Viewer */}
            {viewingPhotos && imageList.length > 0 && (
              <PhotoViewer
                images={imageMetadata.length > 0 ? imageMetadata : imageList.map(url => ({ url, isPublic: false }))}
                initialIndex={photoIndex}
                onClose={() => setViewingPhotos(false)}
              />
            )}

            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-xl font-bold text-gray-900">{place.name}</h3>
                    {isCreator && (onEdit || onDelete) && (
                      <div className="flex items-center gap-2">
                        {onEdit && (
                          <button
                            onClick={() => onEdit(place)}
                            className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                            title="Edit step"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete "${place.name}"?`)) {
                                onDelete(place);
                              }
                            }}
                            className="text-gray-400 hover:text-red-600 transition-colors p-1"
                            title="Delete step"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {format(visitedDate, 'MMMM d, yyyy • h:mm a')}
                  </p>
                </div>
                {place.rating && (
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => {
                      const rating = place.rating ?? 0;
                      return (
                        <svg
                          key={i}
                          className={`w-5 h-5 ${
                            i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                          }`}
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      );
                    })}
                  </div>
                )}
              </div>


              {(place.rewrittenComment || place.comment) && (
                <div className="mt-4">
                  <p className="text-gray-700 leading-relaxed">
                    {place.rewrittenComment || place.comment}
                  </p>
                </div>
              )}

              {/* Expenses for this step */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-700">
                    Expenses
                    {totalByCurrency.length > 0 && (
                      <span className="ml-2">
                        {totalByCurrency.map((t, idx) => (
                          <span key={t.currency}>
                            {idx > 0 && ', '}
                            {formatCurrency(t.total, t.currency)}
                          </span>
                        ))}
                      </span>
                    )}
                  </p>
                  {isCreator && onAddExpense && (
                    <button
                      onClick={() => onAddExpense(place)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                      title="Add expense"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Expense
                    </button>
                  )}
                </div>
                {visibleExpenses.length > 0 && (
                  <div className="space-y-2">
                    {visibleExpenses.map((expense) => (
                      <div key={expense.expenseId} className="text-xs bg-gray-50 rounded-lg p-2">
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-900">
                            {formatCurrency(expense.amount, expense.currency || 'USD')}
                          </span>
                          <span className="text-gray-500 text-xs">{expense.paidBy}</span>
                        </div>
                        {expense.description && (
                          <p className="text-gray-600 mt-1">{expense.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  📍 {place.coordinates.lat.toFixed(4)}, {place.coordinates.lng.toFixed(4)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

