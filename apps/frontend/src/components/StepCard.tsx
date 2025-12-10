'use client';

import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import type { TripPlace, TripExpense, ModeOfTravel } from '@tripmatrix/types';

interface StepCardProps {
  place: TripPlace;
  index: number;
  isLast: boolean;
  expenses?: TripExpense[];
  onAddStep?: () => void;
  showAddButton?: boolean;
}

const modeLabels: Record<ModeOfTravel, string> = {
  walk: '🚶 Walk',
  bike: '🚴 Bike',
  car: '🚗 Car',
  train: '🚂 Train',
  bus: '🚌 Bus',
  flight: '✈️ Flight',
};

export default function StepCard({ place, index, isLast, expenses = [], onAddStep, showAddButton }: StepCardProps) {
  const visitedDate = toDate(place.visitedAt);
  const stepExpenses = expenses.filter((e) => e.placeId === place.placeId);
  const totalStepExpense = stepExpenses.reduce((sum, e) => sum + e.amount, 0);

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
            {/* Place images */}
            {(() => {
              // Support both legacy images array and new imageMetadata
              const imageList = place.imageMetadata 
                ? place.imageMetadata.map(img => img.url)
                : (place.images || []);
              
              return imageList.length > 0 ? (
                <div className="w-full h-64 relative">
                  {imageList.length === 1 ? (
                    <div className="relative">
                      <img
                        src={imageList[0]}
                        alt={place.name}
                        className="w-full h-full object-cover"
                      />
                      {place.imageMetadata && place.imageMetadata[0] && (
                        <div className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium bg-black/50 text-white">
                          {place.imageMetadata[0].isPublic ? '🌐 Public' : '🔒 Private'}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 h-full">
                      {imageList.slice(0, 4).map((imageUrl, idx) => (
                        <div key={idx} className="relative">
                          <img
                            src={imageUrl}
                            alt={`${place.name} ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {place.imageMetadata && place.imageMetadata[idx] && (
                            <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-xs font-medium bg-black/50 text-white">
                              {place.imageMetadata[idx].isPublic ? '🌐' : '🔒'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null;
            })()}
            {(!place.images || place.images.length === 0) && (!place.imageMetadata || place.imageMetadata.length === 0) && (
              <div className="w-full h-64 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            )}

            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">{place.name}</h3>
                  <p className="text-sm text-gray-500">
                    {format(visitedDate, 'MMMM d, yyyy • h:mm a')}
                  </p>
                </div>
                {place.rating && (
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        className={`w-5 h-5 ${
                          i < place.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                        }`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                )}
              </div>

              {/* Travel Info */}
              {place.modeOfTravel && place.distanceFromPrevious && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-900">
                      {modeLabels[place.modeOfTravel]}
                    </span>
                    <div className="flex items-center gap-4 text-gray-600">
                      <span>{(place.distanceFromPrevious / 1000).toFixed(2)} km</span>
                      {place.timeFromPrevious && (
                        <span>
                          {Math.floor(place.timeFromPrevious / 3600) > 0 && `${Math.floor(place.timeFromPrevious / 3600)}h `}
                          {Math.floor((place.timeFromPrevious % 3600) / 60)}m
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {(place.rewrittenComment || place.comment) && (
                <div className="mt-4">
                  <p className="text-gray-700 leading-relaxed">
                    {place.rewrittenComment || place.comment}
                  </p>
                </div>
              )}

              {/* Expenses for this step */}
              {stepExpenses.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-700 mb-2">
                    Expenses: ${totalStepExpense.toFixed(2)}
                  </p>
                  <div className="space-y-2">
                    {stepExpenses.map((expense) => (
                      <div key={expense.expenseId} className="text-xs bg-gray-50 rounded-lg p-2">
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-900">${expense.amount.toFixed(2)}</span>
                          <span className="text-gray-500">{expense.paidBy.substring(0, 8)}...</span>
                        </div>
                        {expense.description && (
                          <p className="text-gray-600 mt-1">{expense.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

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

