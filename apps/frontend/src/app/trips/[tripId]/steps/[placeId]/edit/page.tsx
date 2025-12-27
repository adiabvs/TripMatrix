'use client';

import { useAuth } from '@/lib/auth';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { getTrip, getTripPlaces, updatePlace, createExpense, uploadImage, getTripExpenses, deleteExpense } from '@/lib/api';
import type { Trip, TripPlace, ModeOfTravel, TripParticipant } from '@tripmatrix/types';
import { toDate, formatDateTimeLocalForInput, parseDateTimeLocalToUTC } from '@/lib/dateUtils';
import { format } from 'date-fns';
import type L from 'leaflet';
import ExpenseForm from '@/components/ExpenseForm';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { MdArrowBack, MdCameraAlt, MdAdd, MdRemove, MdSearch, MdRefresh, MdMyLocation, MdClose } from 'react-icons/md';

// Dynamically import PlaceMapSelector with SSR disabled
const PlaceMapSelector = dynamic(() => import('@/components/PlaceMapSelector'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="text-sm text-gray-600">Loading map...</div>
    </div>
  ),
});

// Component to display expense list with proper names
function ExpenseList({ 
  expenses, 
  participants, 
  tripId, 
  userNamesMap, 
  setUserNamesMap,
  canEdit = false
}: { 
  expenses: any[]; 
  participants: TripParticipant[]; 
  tripId: string;
  userNamesMap: Record<string, string>;
  setUserNamesMap: (map: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  canEdit?: boolean;
}) {
  const [namesMap, setNamesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadNames = async () => {
      const newMap: Record<string, string> = {};
      for (const expense of expenses) {
        const paidByLabel = participants.find(
          p => (p.uid || p.guestName) === expense.paidBy
        );
        
        if (paidByLabel?.isGuest && paidByLabel.guestName) {
          newMap[expense.paidBy] = paidByLabel.guestName;
        } else if (paidByLabel?.uid) {
          if (userNamesMap[paidByLabel.uid]) {
            newMap[expense.paidBy] = userNamesMap[paidByLabel.uid];
          } else {
            try {
              const userDoc = await getDoc(doc(db, 'users', paidByLabel.uid));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                const userName = userData.name || userData.email?.split('@')[0] || 'User';
                newMap[expense.paidBy] = userName;
                setUserNamesMap(prev => ({ ...prev, [paidByLabel.uid!]: userName }));
              } else {
                newMap[expense.paidBy] = 'User';
              }
            } catch (error) {
              console.error('Failed to fetch user name:', error);
              newMap[expense.paidBy] = 'User';
            }
          }
        } else {
          newMap[expense.paidBy] = expense.paidBy?.length > 20 ? 'User' : (expense.paidBy || 'Unknown');
        }
      }
      setNamesMap(newMap);
    };
    loadNames();
  }, [expenses, participants, userNamesMap, setUserNamesMap]);

  return (
    <div className="space-y-2 mb-4">
      {expenses.map((expense, index) => (
        <div key={expense.expenseId || index} className="bg-[#616161] rounded-lg p-3 flex justify-between items-center">
          <div className="flex-1">
            <p className="text-[11px] font-semibold text-white">
              {expense.currency || 'USD'} {expense.amount?.toFixed(2)}
            </p>
            <p className="text-[10px] text-[#bdbdbd]">
              Paid by: {namesMap[expense.paidBy] || 'Loading...'}
              {expense.description && ` • ${expense.description}`}
            </p>
          </div>
          {canEdit && (
          <Link
            href={`/trips/${tripId}/expenses/${expense.expenseId}/edit`}
            className="text-[10px] text-[#1976d2] hover:text-[#1565c0] ml-2"
          >
            Edit
          </Link>
          )}
        </div>
      ))}
    </div>
  );
}

export default function EditStepPage() {
  const { user, loading: authLoading, getIdToken } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tripId = params.tripId as string;
  const placeId = params.placeId as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [place, setPlace] = useState<TripPlace | null>(null);
  const [places, setPlaces] = useState<TripPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [previousPlace, setPreviousPlace] = useState<TripPlace | null>(null);
  
  // Form state
  const [placeName, setPlaceName] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [visitedDateTime, setVisitedDateTime] = useState(new Date());
  const [modeOfTravel, setModeOfTravel] = useState<ModeOfTravel | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [images, setImages] = useState<Array<{ url: string; isPublic: boolean }>>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [placeCountry, setPlaceCountry] = useState<string | undefined>(undefined);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [userNamesMap, setUserNamesMap] = useState<Record<string, string>>({});
  
  // Map search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const modes: ModeOfTravel[] = ['walk', 'bike', 'car', 'train', 'bus', 'flight'];
  const modeLabels: Record<string, string> = {
    walk: 'Walk',
    bike: 'Bike',
    car: 'Car',
    train: 'Train',
    bus: 'Bus',
    flight: 'Flight',
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (tripId && placeId && user) {
      loadTripData();
      getIdToken().then(setToken).catch(console.error);
    }
  }, [tripId, placeId, user]);

  const loadTripData = async () => {
    try {
      const token = await getIdToken();
      const [tripData, placesData, expensesData] = await Promise.all([
        getTrip(tripId, token),
        getTripPlaces(tripId, token),
        getTripExpenses(tripId, token),
      ]);

      setTrip(tripData);
      
      // Filter expenses for this place
      const placeExpenses = expensesData.filter((e: any) => e.placeId === placeId);
      setExpenses(placeExpenses);
      
      // Find the current place
      const currentPlace = placesData.find(p => p.placeId === placeId);
      if (!currentPlace) {
        throw new Error('Place not found');
      }
      setPlace(currentPlace);
      
      // Prefill form with existing data
      setPlaceName(currentPlace.name || '');
      setCoordinates(currentPlace.coordinates || null);
      setVisitedDateTime(toDate(currentPlace.visitedAt));
      setModeOfTravel(currentPlace.modeOfTravel || null);
      setRating(currentPlace.rating || 0);
      setComment(currentPlace.comment || '');
      setImages(currentPlace.imageMetadata || currentPlace.images?.map(url => ({ url, isPublic: false })) || []);
      
      // Sort places by visitedAt
      const sortedPlaces = [...placesData].sort(
        (a, b) => toDate(a.visitedAt).getTime() - toDate(b.visitedAt).getTime()
      );
      setPlaces(sortedPlaces);
      
      // Find the previous place (the one before current in timeline)
      const currentIndex = sortedPlaces.findIndex(p => p.placeId === placeId);
      if (currentIndex > 0) {
        setPreviousPlace(sortedPlaces[currentIndex - 1]);
      }

      // Get country from place coordinates if available
      if (currentPlace.coordinates) {
        try {
          const rawUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
          const apiUrl = rawUrl.startsWith('https://') ? rawUrl.replace(/:\d+$/, '') : rawUrl;
          const response = await fetch(
            `${apiUrl}/api/geocoding/reverse?lat=${currentPlace.coordinates.lat}&lon=${currentPlace.coordinates.lng}`
          );
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data?.address?.country_code) {
              setPlaceCountry(result.data.address.country_code.toUpperCase());
            }
          }
        } catch (error) {
          console.error('Failed to get country from coordinates:', error);
        }
      }
    } catch (error) {
      console.error('Failed to load trip data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSelect = async (coords: { lat: number; lng: number }, name?: string) => {
    setCoordinates(coords);
    
    // Get country from coordinates
    try {
      const rawUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const apiUrl = rawUrl.startsWith('https://') ? rawUrl.replace(/:\d+$/, '') : rawUrl;
      const response = await fetch(
        `${apiUrl}/api/geocoding/reverse?lat=${coords.lat}&lon=${coords.lng}`
      );
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const data = result.data;
          if (data.address?.country_code) {
            setPlaceCountry(data.address.country_code.toUpperCase());
          }
          // Always update place name when location changes
          if (data.display_name) {
            const parts = data.display_name.split(',');
            const mainName = parts[0].trim();
            if (mainName && mainName.length > 0) {
              setPlaceName(mainName);
            }
          } else if (name) {
            // Use provided name if available
            const parts = name.split(',');
            const mainName = parts[0].trim();
            if (mainName && mainName.length > 0) {
              setPlaceName(mainName);
            }
          }
        }
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    }
    
    // Update marker if map is ready
    if (mapRef.current && mapRef.current.getContainer()) {
      try {
        if (markerRef.current) {
          markerRef.current.setLatLng([coords.lat, coords.lng]);
        } else {
          const L = await import('leaflet');
          const personIcon = L.divIcon({
            className: 'custom-person-marker',
            html: `
              <div style="
                width: 32px;
                height: 32px;
                background-color: #1976d2;
                border: 3px solid white;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                position: relative;
                margin: 0;
                padding: 0;
              ">
                <div style="
                  width: 12px;
                  height: 12px;
                  background-color: white;
                  border-radius: 50%;
                  position: absolute;
                  top: 6px;
                  left: 6px;
                  transform: rotate(45deg);
                "></div>
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
          });
          
          markerRef.current = L.marker([coords.lat, coords.lng], { 
            draggable: true,
            icon: personIcon,
            riseOnHover: false
          }).addTo(mapRef.current);
          markerRef.current.on('dragend', async (e: any) => {
            const marker = e.target;
            const position = marker.getLatLng();
            await handleLocationSelect({ lat: position.lat, lng: position.lng });
          });
        }
      } catch (error) {
        console.error('Error updating marker:', error);
      }
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || isSearching) return;
    
    setIsSearching(true);
    try {
      const rawUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const apiUrl = rawUrl.startsWith('https://') ? rawUrl.replace(/:\d+$/, '') : rawUrl;
      const response = await fetch(
        `${apiUrl}/api/geocoding/search?q=${encodeURIComponent(searchQuery)}`
      );
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data && result.data.length > 0) {
          const firstResult = result.data[0];
          const coords = { lat: parseFloat(firstResult.lat), lng: parseFloat(firstResult.lon) };
          setCoordinates(coords);
          setPlaceName(firstResult.display_name?.split(',')[0] || searchQuery);
          
          // Update map if ready
          if (mapRef.current) {
            mapRef.current.setView([coords.lat, coords.lng], 13);
            if (markerRef.current) {
              markerRef.current.setLatLng([coords.lat, coords.lng]);
            }
          }
          
          await handleLocationSelect(coords, firstResult.display_name);
        }
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCoordinates(coords);
        await handleLocationSelect(coords);
        setLocationLoading(false);
        
        if (mapRef.current) {
          mapRef.current.setView([coords.lat, coords.lng], 13);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Failed to get your location');
        setLocationLoading(false);
      }
    );
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !token) return;
    
    if (images.length + files.length > 10) {
      alert('Maximum 10 photos allowed');
      return;
    }
    
    setUploadingImages(true);
    try {
      const uploadPromises = Array.from(files).map(file => uploadImage(file, token, false));
      const uploadedImages = await Promise.all(uploadPromises);
      setImages([...images, ...uploadedImages]);
    } catch (error) {
      console.error('Failed to upload images:', error);
      alert('Failed to upload some images');
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!placeName.trim()) {
      alert('Please provide a place name');
      return;
    }

    if (!token) {
      alert('Authentication token is missing. Please log in again.');
      return;
    }

    setSubmitting(true);
    try {
      await updatePlace(placeId, {
        name: placeName.trim(),
        coordinates: coordinates || { lat: 0, lng: 0 },
        visitedAt: visitedDateTime.toISOString(),
        rating: rating > 0 ? rating : undefined,
        comment: comment || undefined,
        modeOfTravel: previousPlace && modeOfTravel ? modeOfTravel : undefined,
        imageMetadata: images.length > 0 ? images : undefined,
      }, token);
      
      router.push(`/trips/${tripId}`);
    } catch (error: any) {
      console.error('Failed to update place:', error);
      alert(`Failed to update place: ${error.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddExpense = async (expenseData: Partial<any>) => {
    if (!token) {
      alert('Authentication token is missing. Please log in again.');
      return;
    }
    try {
      await createExpense({
        ...expenseData,
        tripId,
        placeId,
      }, token);
      // Reload expenses
      const expensesData = await getTripExpenses(tripId, token);
      const placeExpenses = expensesData.filter((e: any) => e.placeId === placeId);
      setExpenses(placeExpenses);
      alert('Expense added successfully!');
      setShowExpenseForm(false);
    } catch (error: any) {
      console.error('Failed to add expense:', error);
      alert(`Failed to add expense: ${error.message || 'Unknown error'}`);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#424242]">
        <div className="text-sm text-white">Loading...</div>
      </div>
    );
  }

  if (!trip || !place) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#424242]">
        <div className="text-sm text-white">Step not found</div>
      </div>
    );
  }

  const isCreator = user?.uid === trip.creatorId;
  const canEdit = isCreator;
  const canView = isCreator || trip.isPublic || trip.participants?.some(p => p.uid === user?.uid);
  
  if (!canView) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#424242]">
        <div className="text-sm text-white">You don&apos;t have permission to view this step</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#424242] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-600 flex-shrink-0">
        <Link href={`/trips/${tripId}`} className="w-10 h-10 flex items-center justify-center">
          <MdArrowBack className="text-white text-xl" />
        </Link>
        <h1 className="text-xs font-semibold text-white">{canEdit ? 'Edit Step' : 'View Step'}</h1>
        <div className="w-10" />
      </div>

      {/* Map Section - Fixed at 40% */}
      <div className="relative" style={{ height: '40vh', flexShrink: 0 }}>
        <PlaceMapSelector
          onLocationSelect={canEdit ? handleLocationSelect : undefined}
          height="40vh"
          initialCoords={coordinates || undefined}
          hideUI={true}
          disabled={!canEdit}
          onMapReady={(map) => {
            mapRef.current = map;
            // Set up marker when map is ready - use setTimeout to ensure map container is fully ready
            if (coordinates) {
              setTimeout(() => {
                import('leaflet').then(async (L) => {
                  if (!markerRef.current && mapRef.current) {
                    try {
                      // Create circular marker for location
                      const locationIcon = L.divIcon({
                        className: 'custom-location-marker',
                        html: `<div style="
                          width: 18px;
                          height: 18px;
                          border-radius: 50%;
                          background-color: #1976d2;
                          border: 3px solid white;
                          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
                          cursor: move;
                        "></div>`,
                        iconSize: [18, 18],
                        iconAnchor: [9, 9],
                      });
                      
                      if (mapRef.current && mapRef.current.getContainer()) {
                        markerRef.current = L.marker([coordinates.lat, coordinates.lng], { 
                          draggable: true,
                          icon: locationIcon
                        }).addTo(mapRef.current);
                        markerRef.current.on('dragend', async (e: any) => {
                          const marker = e.target;
                          const position = marker.getLatLng();
                          await handleLocationSelect({ lat: position.lat, lng: position.lng });
                        });
                      }
                    } catch (error) {
                      console.error('Error adding marker to map:', error);
                    }
                  }
                });
              }, 100);
            }
          }}
        />
        
        {/* Search Bar */}
        <div className="absolute top-0 left-0 right-0 px-4 pt-3 z-10">
          <div className="flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && canEdit) {
                  handleSearch();
                }
              }}
              placeholder="Search for a location..."
              className="flex-1 px-0 py-2 bg-transparent text-[14px] text-white border-0 border-b-2 border-white/50 focus:outline-none focus:border-white rounded-none placeholder:text-white/60"
              disabled={!canEdit}
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={!canEdit || isSearching || !searchQuery.trim()}
              className="ml-2 px-2 py-2 text-white disabled:opacity-50"
            >
              {isSearching ? (
                <span className="text-xs">Searching...</span>
              ) : (
                <MdSearch className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
        
        {/* Compass Icon Button */}
        {canEdit && (
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          disabled={locationLoading}
          className="absolute bottom-4 right-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center z-10 disabled:opacity-50"
        >
          {locationLoading ? (
            <MdRefresh className="animate-spin h-6 w-6 text-[#1976d2]" />
          ) : (
            <MdMyLocation className="w-6 h-6 text-[#1976d2]" />
          )}
        </button>
        )}
      </div>

      {/* Form Section - Bottom 60% */}
      <div className="flex-1 overflow-y-auto" style={{ height: '60vh', WebkitOverflowScrolling: 'touch' }}>
        <form onSubmit={canEdit ? handleSubmit : (e) => { e.preventDefault(); }} className="px-4 py-4 space-y-6">
          {/* Date & Time */}
          <div>
            <label className="block text-[12px] font-semibold text-[#bdbdbd] mb-2">
              Date & Time *
            </label>
            <input
              type="datetime-local"
              value={formatDateTimeLocalForInput(visitedDateTime)}
              onChange={(e) => {
                if (canEdit) {
                  const utcDate = parseDateTimeLocalToUTC(e.target.value);
                  if (!isNaN(utcDate.getTime())) {
                    setVisitedDateTime(utcDate);
                  }
                }
              }}
              className="w-full bg-transparent px-0 py-3 text-[14px] text-white border-0 border-b border-[#9e9e9e] focus:outline-none focus:border-[#1976d2] rounded-none"
              required
              disabled={!canEdit}
              readOnly={!canEdit}
            />
          </div>

          {/* Place Name */}
          <div>
            <label className="block text-[12px] font-semibold text-[#bdbdbd] mb-2">
              Place Name *
            </label>
            <input
              type="text"
              value={placeName}
              onChange={(e) => canEdit && setPlaceName(e.target.value)}
              placeholder="Enter place name (e.g., Paris, France)"
              className="w-full bg-transparent px-0 py-3 text-[14px] text-white border-0 border-b border-[#9e9e9e] focus:outline-none focus:border-[#1976d2] rounded-none"
              required
              disabled={!canEdit}
              readOnly={!canEdit}
            />
          </div>

          {/* Mode of Travel */}
          <div>
            <label className="block text-[12px] font-semibold text-[#bdbdbd] mb-2">
              Mode of Travel (optional)
            </label>
            <div className="flex flex-wrap gap-2 mt-2">
              {modes.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => canEdit && setModeOfTravel(modeOfTravel === mode ? null : mode)}
                  disabled={!canEdit}
                  className={`px-4 py-2 rounded-lg border ${
                    modeOfTravel === mode
                      ? 'bg-[#1976d2] border-[#1976d2] text-white'
                      : 'bg-[#616161] border-[#616161] text-white'
                  } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="text-[12px]">{modeLabels[mode]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Photos */}
          <div>
            <label className="block text-[12px] font-semibold text-[#bdbdbd] mb-2">
              Photos
            </label>
            <label className={`flex flex-col items-center justify-center border border-dashed border-[#616161] rounded-lg p-4 ${canEdit ? 'cursor-pointer hover:border-[#757575]' : 'cursor-not-allowed opacity-50'} transition-colors`}>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                disabled={!canEdit || uploadingImages || images.length >= 10}
              />
              <MdCameraAlt className="text-2xl mb-2" />
              <span className="text-[14px] text-[#9e9e9e]">
                {uploadingImages
                  ? 'Uploading...'
                  : images.length >= 10
                  ? `Maximum 10 photos (${images.length}/10)`
                  : `Add Photos (${images.length}/10)`}
              </span>
            </label>
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {images.map((image, index) => (
                  <div key={index} className="relative w-24 h-24">
                    <img
                      src={image.url}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    {canEdit && (
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center"
                    >
                      <MdClose className="text-white text-xs" />
                    </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rating */}
          <div>
            <label className="block text-[12px] font-semibold text-[#bdbdbd] mb-2">
              Rating (1-5)
            </label>
            <div className="flex gap-2 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => canEdit && setRating(star)}
                  disabled={!canEdit}
                  className={`text-3xl ${!canEdit ? 'cursor-not-allowed' : ''}`}
                >
                  <span className={star <= rating ? 'text-yellow-400' : 'text-[#616161]'}>★</span>
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-[12px] font-semibold text-[#bdbdbd] mb-2">
              Comment
            </label>
            <textarea
              value={comment}
              onChange={(e) => canEdit && setComment(e.target.value)}
              placeholder="Write about your experience..."
              rows={4}
              className="w-full bg-transparent px-0 py-3 text-[14px] text-white border-0 border-b border-[#9e9e9e] focus:outline-none focus:border-[#1976d2] rounded-none min-h-[100px]"
              disabled={!canEdit}
              readOnly={!canEdit}
            />
          </div>

          {/* Expense Section */}
          {trip.participants && trip.participants.length > 0 && (
            <div className="pt-4 border-t border-[#616161]">
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-white mb-2">Expenses</h3>
                <p className="text-[10px] text-[#9e9e9e] mb-3">Manage expenses for this step</p>
              </div>

              {/* Existing Expenses List */}
              {expenses.length > 0 && (
                <ExpenseList 
                  expenses={expenses}
                  participants={trip.participants}
                  tripId={tripId}
                  userNamesMap={userNamesMap}
                  setUserNamesMap={setUserNamesMap}
                  canEdit={canEdit}
                />
              )}

              {/* Add Expense Button - Only show if can edit */}
              {canEdit && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setShowExpenseForm(!showExpenseForm)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-[#1976d2] text-white rounded-lg text-[12px] font-medium hover:bg-[#1565c0] transition-colors"
                >
                  {showExpenseForm ? <MdRemove className="text-xl" /> : <MdAdd className="text-xl" />}
                  <span>{showExpenseForm ? 'Cancel' : 'Add Expense'}</span>
                </button>
              </div>
              )}

              {showExpenseForm && (
                <div className="mt-4 bg-[#616161] rounded-lg p-4">
                  <ExpenseForm
                    tripId={tripId}
                    participants={trip.participants}
                    onSubmit={handleAddExpense}
                    onCancel={() => setShowExpenseForm(false)}
                    placeId={placeId}
                    placeCountry={placeCountry}
                  />
                </div>
              )}
            </div>
          )}

          {/* Submit Button - Only show if can edit */}
          {canEdit && (
          <div className="flex gap-3 pb-4">
            <button
              type="submit"
              disabled={submitting || !placeName.trim()}
              className="flex-1 bg-[#1976d2] text-white py-3 px-4 rounded-lg text-[14px] font-semibold disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/trips/${tripId}`)}
              className="px-4 py-3 bg-[#616161] text-white rounded-lg text-[14px] font-medium"
            >
              Cancel
            </button>
          </div>
          )}
          
          {/* View-only mode - Just show back button */}
          {!canEdit && (
          <div className="flex gap-3 pb-4">
            <button
              type="button"
              onClick={() => router.push(`/trips/${tripId}`)}
              className="w-full px-4 py-3 bg-[#616161] text-white rounded-lg text-[14px] font-medium"
            >
              Back to Trip
            </button>
          </div>
          )}
        </form>
      </div>
    </div>
  );
}
