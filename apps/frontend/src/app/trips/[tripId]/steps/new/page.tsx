'use client';

import { useAuth } from '@/lib/auth';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { getTrip, addPlace, getTripPlaces, createExpense } from '@/lib/api';
import type { Trip, TripPlace, ModeOfTravel } from '@tripmatrix/types';
import { toDate } from '@/lib/dateUtils';
import { format } from 'date-fns';
import type L from 'leaflet';
import ExpenseForm from '@/components/ExpenseForm';

// Dynamically import PlaceMapSelector with SSR disabled
const PlaceMapSelector = dynamic(() => import('@/components/PlaceMapSelector'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <div className="text-sm text-gray-600">Loading map...</div>
    </div>
  ),
});

export default function NewStepPage() {
  const { user, loading: authLoading, getIdToken } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tripId = params.tripId as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [places, setPlaces] = useState<TripPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [previousPlace, setPreviousPlace] = useState<TripPlace | null>(null);
  const [nextPlace, setNextPlace] = useState<TripPlace | null>(null);
  
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
  const [newPlaceId, setNewPlaceId] = useState<string | null>(null);
  
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
    if (tripId && user) {
      loadTripData();
      getIdToken().then(setToken).catch(console.error);
    }
  }, [tripId, user]);

  const loadTripData = async () => {
    try {
      const token = await getIdToken();
      const [tripData, placesData] = await Promise.all([
        getTrip(tripId, token),
        getTripPlaces(tripId, token),
      ]);

      setTrip(tripData);
      
      // Sort places by visitedAt
      const sortedPlaces = [...placesData].sort(
        (a, b) => toDate(a.visitedAt).getTime() - toDate(b.visitedAt).getTime()
      );
      setPlaces(sortedPlaces);
      
      // Set the previous and next place based on URL param or last place
      const urlParams = new URLSearchParams(window.location.search);
      const afterPlaceId = urlParams.get('after');
      if (afterPlaceId) {
        const afterIndex = sortedPlaces.findIndex(p => p.placeId === afterPlaceId);
        if (afterIndex >= 0) {
          setPreviousPlace(sortedPlaces[afterIndex]);
          if (afterIndex + 1 < sortedPlaces.length) {
            setNextPlace(sortedPlaces[afterIndex + 1]);
          }
        } else if (sortedPlaces.length > 0) {
          setPreviousPlace(sortedPlaces[sortedPlaces.length - 1]);
        }
      } else if (sortedPlaces.length > 0) {
        setPreviousPlace(sortedPlaces[sortedPlaces.length - 1]);
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
        }
      }
    } catch (error) {
      console.error('Failed to get country from coordinates:', error);
    }
    
    // Always try to reverse geocode to get place name using backend API
    let placeName = name;
    if (!placeName) {
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
            if (data.display_name) {
              placeName = data.display_name;
            } else if (data.address) {
              // Try to construct name from address components
              const addr = data.address;
              placeName = addr.name || addr.road || addr.city || addr.town || addr.village || addr.county || null;
            }
          }
        }
      } catch (error) {
        console.error('Reverse geocoding error:', error);
      }
    }
    
    // Extract simple place name (first part before comma)
    if (placeName && placeName.trim()) {
      const parts = placeName.split(',');
      const mainName = parts[0].trim();
      if (mainName && mainName.length > 0) {
        setPlaceName(mainName);
        return;
      }
    }
    
    // Only use coordinates as last resort if no name found
    setPlaceName(`Location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);
    
    // Update marker if map is ready
    if (mapRef.current) {
      if (markerRef.current) {
        markerRef.current.setLatLng([coords.lat, coords.lng]);
      } else {
        const L = await import('leaflet');
        // Create custom icon for person/location marker
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
          icon: personIcon
        }).addTo(mapRef.current);
        markerRef.current.on('dragend', async (e: any) => {
          const marker = e.target;
          const position = marker.getLatLng();
          const newCoords = { lat: position.lat, lng: position.lng };
          setCoordinates(newCoords);
          await handleLocationSelect(newCoords);
        });
      }
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !mapRef.current) return;
    
    setIsSearching(true);
    try {
      const rawUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const apiUrl = rawUrl.startsWith('https://') ? rawUrl.replace(/:\d+$/, '') : rawUrl;
      const response = await fetch(
        `${apiUrl}/api/geocoding/search?q=${encodeURIComponent(searchQuery)}&limit=1`
      );
      
      if (!response.ok) {
        throw new Error('Search request failed');
      }
      
      const data = await response.json();
      
      if (!data.success || !data.data || data.data.length === 0) {
        alert('No results found');
        setIsSearching(false);
        return;
      }
      
      const result = data.data[0];
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);
      
      // Update map view
      const map = mapRef.current;
      map.setView([lat, lng], 15);
      
      // Update or create marker
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const L = await import('leaflet');
        // Create custom icon for person/location marker
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
        
        markerRef.current = L.marker([lat, lng], { 
          draggable: true,
          icon: personIcon
        }).addTo(map);
        markerRef.current.on('dragend', async (e: any) => {
          const marker = e.target;
          const position = marker.getLatLng();
          await handleLocationSelect({ lat: position.lat, lng: position.lng });
        });
      }
      
      markerRef.current.bindPopup(result.display_name).openPopup();
      
      // Update coordinates and place name
      await handleLocationSelect({ lat, lng }, result.display_name);
    } catch (error) {
      console.error('Search error:', error);
      alert('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleGetCurrentLocation = async () => {
    if (!navigator.geolocation || !mapRef.current) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const map = mapRef.current!;
        
        // Update map view
        map.setView([latitude, longitude], 15);
        
        // Update or create marker
        if (markerRef.current) {
          markerRef.current.setLatLng([latitude, longitude]);
        } else {
          const L = await import('leaflet');
          // Create custom icon for person/location marker
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
          
          markerRef.current = L.marker([latitude, longitude], { 
            draggable: true,
            icon: personIcon
          }).addTo(map);
          markerRef.current.on('dragend', async (e: any) => {
            const marker = e.target;
            const position = marker.getLatLng();
            await handleLocationSelect({ lat: position.lat, lng: position.lng });
          });
        }
        
        markerRef.current.bindPopup('Your Current Location').openPopup();
        
        await handleLocationSelect({ lat: latitude, lng: longitude });
        setLocationLoading(false);
      },
      (error) => {
        console.error('GPS error:', error);
        alert('Failed to get your location. Please check location permissions.');
        setLocationLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !token) return;

    if (images.length + files.length > 10) {
      alert(`Maximum 10 photos allowed. You have ${images.length} photos.`);
      return;
    }

    setUploadingImages(true);
    try {
      const { uploadImage } = await import('@/lib/api');
      const uploadPromises = Array.from(files).map(file => uploadImage(file, token, false));
      const uploadedImages = await Promise.all(uploadPromises);
      setImages([...images, ...uploadedImages]);
    } catch (error) {
      console.error('Failed to upload images:', error);
      alert('Failed to upload images');
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };


  const handleAddExpense = async (expenseData: Partial<any>) => {
    if (!token) {
      alert('Authentication token is missing. Please log in again.');
      return;
    }
    if (!newPlaceId) {
      alert('Please save the step first before adding an expense.');
      return;
    }
    try {
      await createExpense({
        ...expenseData,
        tripId,
        placeId: newPlaceId,
      }, token);
      alert('Expense added successfully!');
      setShowExpenseForm(false);
      router.push(`/trips/${tripId}`);
    } catch (error: any) {
      console.error('Failed to add expense:', error);
      alert(`Failed to add expense: ${error.message || 'Unknown error'}`);
    }
  };

  const handleSubmitWithExpense = async (e: React.FormEvent) => {
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
      const { addPlace } = await import('@/lib/api');
      const newPlace = await addPlace({
        tripId,
        name: placeName.trim(),
        coordinates: coordinates || { lat: 0, lng: 0 },
        visitedAt: visitedDateTime,
        rating: rating > 0 ? rating : undefined,
        comment: comment || undefined,
        modeOfTravel: previousPlace && modeOfTravel ? modeOfTravel : undefined,
        imageMetadata: images.length > 0 ? images : undefined,
      }, token);
      
      // Store the new place ID for expense creation
      if (newPlace && newPlace.placeId) {
        setNewPlaceId(newPlace.placeId);
      }
      
      // If expense form is shown, don't redirect yet - let user add expense
      if (showExpenseForm) {
        alert('Step saved! You can now add an expense below.');
        return;
      }
      
      router.push(`/trips/${tripId}`);
    } catch (error: any) {
      console.error('Failed to add place:', error);
      alert(`Failed to add place: ${error.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#424242]">
        <div className="text-sm text-white">Loading...</div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#424242]">
        <div className="text-sm text-white">Trip not found</div>
      </div>
    );
  }

  const isCreator = user?.uid === trip.creatorId;
  if (!isCreator) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#424242]">
        <div className="text-sm text-white">You don&apos;t have permission to add steps to this trip</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#424242] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-600">
        <Link href={`/trips/${tripId}`} className="w-10 h-10 flex items-center justify-center">
          <span className="text-white text-xl">←</span>
        </Link>
        <h1 className="text-[11px] font-semibold text-white">Add Step</h1>
        <div className="w-10" />
      </div>

      {/* Map Section - Fixed at 40% */}
      <div className="relative" style={{ height: '40vh', flexShrink: 0 }}>
        <PlaceMapSelector
          onLocationSelect={handleLocationSelect}
          height="40vh"
          initialCoords={coordinates || undefined}
          hideUI={true}
          onMapReady={(map) => {
            mapRef.current = map;
            // Set up marker when map is ready
            if (coordinates) {
              import('leaflet').then(async (L) => {
                if (!markerRef.current) {
                  // Create custom icon for person/location marker
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
                  
                  markerRef.current = L.marker([coordinates.lat, coordinates.lng], { 
                    draggable: true,
                    icon: personIcon
                  }).addTo(map);
                  markerRef.current.on('dragend', async (e: any) => {
                    const marker = e.target;
                    const position = marker.getLatLng();
                    await handleLocationSelect({ lat: position.lat, lng: position.lng });
                  });
                }
              });
            }
          }}
        />
        
        {/* Search Bar - Simple bottom border only */}
        <div className="absolute top-0 left-0 right-0 px-4 pt-3 z-10">
          <div className="flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              placeholder="Search for a location..."
              className="flex-1 px-0 py-2 bg-transparent text-[14px] text-white border-0 border-b-2 border-white/50 focus:outline-none focus:border-white rounded-none placeholder:text-white/60"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="ml-2 px-2 py-2 text-white disabled:opacity-50"
            >
              {isSearching ? (
                <span className="text-xs">Searching...</span>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </button>
          </div>
        </div>
        
        {/* Compass Icon Button - Bottom right */}
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          disabled={locationLoading}
          className="absolute bottom-4 right-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center z-10 disabled:opacity-50"
        >
          {locationLoading ? (
            <svg className="animate-spin h-6 w-6 text-[#1976d2]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-6 h-6 text-[#1976d2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </div>

      {/* Form Section - Bottom 60% */}
      <div className="flex-1 overflow-y-auto" style={{ height: '60vh' }}>
        <form onSubmit={handleSubmitWithExpense} className="px-4 py-4 space-y-6">
          {/* Date & Time */}
          <div>
            <label className="block text-[12px] font-semibold text-[#bdbdbd] mb-2">
              Date & Time *
            </label>
            <p className="text-[14px] text-white mb-1">
              {format(visitedDateTime, 'MMM dd, yyyy HH:mm')}
            </p>
            <p className="text-[10px] text-[#9e9e9e]">Using current date/time</p>
          </div>

          {/* Place Name */}
          <div>
            <label className="block text-[12px] font-semibold text-[#bdbdbd] mb-2">
              Place Name *
            </label>
            <input
              type="text"
              value={placeName}
              onChange={(e) => setPlaceName(e.target.value)}
              placeholder="Enter place name (e.g., Paris, France)"
              className="w-full bg-transparent px-0 py-3 text-[14px] text-white border-0 border-b border-[#9e9e9e] focus:outline-none focus:border-[#1976d2] rounded-none"
              required
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
                  onClick={() => setModeOfTravel(modeOfTravel === mode ? null : mode)}
                  className={`px-4 py-2 rounded-lg border ${
                    modeOfTravel === mode
                      ? 'bg-[#1976d2] border-[#1976d2] text-white'
                      : 'bg-[#616161] border-[#616161] text-white'
                  }`}
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
            <label className="flex flex-col items-center justify-center border border-dashed border-[#616161] rounded-lg p-4 cursor-pointer hover:border-[#757575] transition-colors">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                disabled={uploadingImages || images.length >= 10}
              />
              <span className="text-2xl mb-2">📷</span>
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
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center"
                    >
                      <span className="text-white text-xs">×</span>
                    </button>
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
                  onClick={() => setRating(star)}
                  className="text-3xl"
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
              onChange={(e) => setComment(e.target.value)}
              placeholder="Write about your experience..."
              rows={4}
              className="w-full bg-transparent px-0 py-3 text-[14px] text-white border-0 border-b border-[#9e9e9e] focus:outline-none focus:border-[#1976d2] rounded-none min-h-[100px]"
            />
          </div>

          {/* Expense Section */}
          {trip.participants && trip.participants.length > 0 && (
            <div className="pt-4 border-t border-[#616161]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-[14px] font-semibold text-white mb-1">Expenses</h3>
                  <p className="text-[10px] text-[#9e9e9e]">Add expenses for this step</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExpenseForm(!showExpenseForm)}
                  className="px-4 py-2 bg-[#1976d2] text-white rounded-lg hover:bg-[#1565c0] transition-colors text-[12px] font-semibold"
                >
                  {showExpenseForm ? 'Cancel' : '+ Add Expense'}
                </button>
              </div>

              {showExpenseForm && (
                <div className="mt-4 bg-[#616161] rounded-lg p-4">
                  <ExpenseForm
                    tripId={tripId}
                    participants={trip.participants}
                    onSubmit={handleAddExpense}
                    onCancel={() => setShowExpenseForm(false)}
                    placeCountry={placeCountry}
                  />
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-3 pb-4">
            <button
              type="submit"
              disabled={submitting || !placeName.trim()}
              className="flex-1 bg-[#1976d2] text-white py-3 px-4 rounded-lg text-[14px] font-semibold disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add Step'}
            </button>
            <button
              type="button"
              onClick={() => router.push(`/trips/${tripId}`)}
              className="px-4 py-3 bg-[#616161] text-white rounded-lg text-[14px] font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
