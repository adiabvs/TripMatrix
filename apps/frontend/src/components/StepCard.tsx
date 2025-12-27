'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import type { TripPlace, TripExpense, ModeOfTravel } from '@tripmatrix/types';
import PhotoViewer from './PhotoViewer';
import { formatCurrency } from '@/lib/currencyUtils';
import { MdEdit, MdDelete, MdStar } from 'react-icons/md';

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
  onEditExpense?: (expense: TripExpense) => void;
  onDeleteExpense?: (expense: TripExpense) => void;
  isCreator?: boolean;
  expenseVisibility?: 'everyone' | 'members' | 'creator';
  currentUserId?: string;
  isTripMember?: boolean;
}

const modeLabels: Record<ModeOfTravel, string> = {
  walk: '🚶 Walk',
  bike: '🚴 Bike',
  car: '🚗 Car',
  train: '🚂 Train',
  bus: '🚌 Bus',
  flight: '✈️ Flight',
};

export default function StepCard({ 
  place, 
  index, 
  isLast, 
  expenses = [], 
  onAddStep, 
  showAddButton, 
  onEdit, 
  onDelete, 
  onAddExpense, 
  onEditExpense, 
  onDeleteExpense, 
  isCreator, 
  expenseVisibility = 'members', 
  currentUserId, 
  isTripMember = false 
}: StepCardProps) {
  const [viewingPhotos, setViewingPhotos] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const visitedDate = toDate(place.visitedAt);
  
  // Filter expenses based on visibility settings
  let visibleExpenses = expenses.filter((e) => e.placeId === place.placeId);
  
  if (expenseVisibility === 'creator') {
    visibleExpenses = isCreator ? visibleExpenses : [];
  } else if (expenseVisibility === 'members') {
    visibleExpenses = isTripMember || isCreator ? visibleExpenses : [];
  }
  
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

  // Get image list
  const imageList = place.imageMetadata 
    ? place.imageMetadata.map(img => img.url)
    : (place.images || []);

  const imageMetadata = place.imageMetadata || place.images?.map(url => ({ url, isPublic: false })) || [];

  const handlePhotoClick = (index: number) => {
    setPhotoIndex(index);
    setViewingPhotos(true);
  };

  return (
    <div className="mb-4">
      <div className="flex gap-4">
        {/* Timeline dot - Matching mobile app exactly */}
        <div className="relative z-10 flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-white border-[3px] border-black flex items-center justify-center">
            <span className="text-sm font-bold text-black">{index + 1}</span>
          </div>
        </div>

        {/* Card - Matching mobile app */}
        <div className="flex-1">
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-lg">
            {/* Card Header - Matching mobile app */}
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <h3 className="text-sm font-bold text-black mb-1">{place.name}</h3>
                <p className="text-xs text-gray-600">{format(visitedDate, 'MMM d, yyyy h:mm a')}</p>
              </div>
              {isCreator && (onEdit || onDelete) && (
                <div className="flex gap-2">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(place)}
                      className="p-1"
                      title="Edit step"
                    >
                      <MdEdit className="text-base" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete "${place.name}"?`)) {
                          onDelete(place);
                        }
                      }}
                      className="p-1"
                      title="Delete step"
                    >
                      <MdDelete className="text-base" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Rating - Matching mobile app */}
            {place.rating && (
              <div className="mb-2">
                <div className="flex gap-0.5">
                  {Array.from({ length: place.rating }).map((_, i) => (
                    <MdStar key={i} className="text-sm text-yellow-400" />
                  ))}
                </div>
              </div>
            )}

            {/* Comment - Matching mobile app */}
            {place.comment && (
              <p className="text-sm text-gray-800 mb-2 leading-5">{place.comment}</p>
            )}

            {/* Rewritten Comment - Matching mobile app */}
            {place.rewrittenComment && (
              <div className="bg-gray-100 p-3 rounded-lg mb-2">
                <p className="text-xs font-semibold text-gray-600 mb-1">AI Enhanced:</p>
                <p className="text-sm text-gray-800 leading-5">{place.rewrittenComment}</p>
              </div>
            )}

            {/* Mode of Travel - Matching mobile app */}
            {place.modeOfTravel && (
              <div className="mb-2">
                <span className="text-sm text-gray-600">{modeLabels[place.modeOfTravel]}</span>
              </div>
            )}

            {/* Images - Matching mobile app horizontal scroll */}
            {imageList.length > 0 && (
              <div className="flex gap-2 mb-2 overflow-x-auto">
                {imageList.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`${place.name} ${idx + 1}`}
                    className="w-24 h-24 rounded-lg object-cover flex-shrink-0 cursor-pointer"
                    onClick={() => handlePhotoClick(idx)}
                  />
                ))}
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

            {/* Expenses - Matching mobile app */}
            {totalByCurrency.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="text-xs font-semibold text-gray-600 mb-1">Expenses:</p>
                {totalByCurrency.map((t) => (
                  <p key={t.currency} className="text-sm font-semibold text-black">
                    {formatCurrency(t.total, t.currency)}
                  </p>
                ))}
              </div>
            )}

            {/* Add Expense Button - Matching mobile app */}
            {isCreator && onAddExpense && (
              <button
                onClick={() => onAddExpense(place)}
                className="mt-2 py-2 px-3 bg-gray-50 rounded-lg text-center w-full"
                title="Add expense"
              >
                <span className="text-xs text-gray-600 font-medium">+ Add Expense</span>
              </button>
            )}

            {/* Individual Expenses List */}
            {visibleExpenses.length > 0 && (
              <div className="mt-2 space-y-2">
                {visibleExpenses.map((expense) => (
                  <div key={expense.expenseId} className="text-xs bg-gray-50 rounded-lg p-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {formatCurrency(expense.amount, expense.currency || 'USD')}
                          </span>
                          {isCreator && (onEditExpense || onDeleteExpense) && (
                            <div className="flex items-center gap-1">
                              {onEditExpense && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditExpense(expense);
                                  }}
                                  className="text-gray-400 hover:text-blue-600 transition-colors p-0.5"
                                  title="Edit expense"
                                >
                                  <MdEdit className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {onDeleteExpense && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`Are you sure you want to delete this expense of ${formatCurrency(expense.amount, expense.currency || 'USD')}?`)) {
                                      onDeleteExpense(expense);
                                    }
                                  }}
                                  className="text-gray-400 hover:text-red-600 transition-colors p-0.5"
                                  title="Delete expense"
                                >
                                  <MdDelete className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <span className="text-gray-500 text-xs block mt-0.5">{expense.paidBy}</span>
                      </div>
                    </div>
                    {expense.description && (
                      <p className="text-gray-600 mt-1">{expense.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
