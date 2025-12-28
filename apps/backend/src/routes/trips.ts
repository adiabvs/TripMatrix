import express from 'express';
import { getFirestore } from '../config/firebase.js';
import { OptionalAuthRequest } from '../middleware/optionalAuth.js';
import type { Trip, TripParticipant, TripPlace } from '@tripmatrix/types';

const router = express.Router();

function getDb() {
  return getFirestore();
}

// Create a new trip
router.post('/', async (req: OptionalAuthRequest, res) => {
  try {
    if (!req.uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    const { title, description, startTime, endTime, coverImage, isPublic, status, participants } = req.body;
    const uid = req.uid;

    if (!title || !startTime) {
      return res.status(400).json({
        success: false,
        error: 'Title and startTime are required',
      });
    }

    const initialStatus = status === 'completed' ? 'completed' : status === 'upcoming' ? 'upcoming' : 'in_progress';
    const initialEndTime = status === 'completed'
      ? endTime
        ? new Date(endTime)
        : new Date()
      : undefined;

    // Ensure creator is in participants
    const tripParticipants = participants && Array.isArray(participants) && participants.length > 0
      ? participants
      : [{ uid, isGuest: false }];
    
    // Make sure creator is included
    if (!tripParticipants.some((p: any) => p.uid === uid && !p.isGuest)) {
      tripParticipants.unshift({ uid, isGuest: false });
    }

    // Build trip data, excluding undefined values
    const tripData: any = {
      creatorId: uid,
      title,
      description: description || '',
      participants: tripParticipants,
      isPublic: isPublic || false,
      status: initialStatus,
      startTime: new Date(startTime),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Only add endTime if it's defined
    if (initialEndTime !== undefined) {
      tripData.endTime = initialEndTime;
    }

    // Only add coverImage if it's provided
    if (coverImage) {
      tripData.coverImage = coverImage;
    }

    const db = getDb();
    const tripRef = await db.collection('trips').add(tripData);
    
    const trip: Trip = {
      tripId: tripRef.id,
      ...tripData,
    };

    res.json({
      success: true,
      data: trip,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get trip by ID (public access for public trips)
router.get('/:tripId', async (req: OptionalAuthRequest, res) => {
  try {
    const { tripId } = req.params;
    const db = getDb();
    const tripDoc = await db.collection('trips').doc(tripId).get();

    if (!tripDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = { tripId: tripDoc.id, ...tripDoc.data() } as Trip;
    
    // Allow access if trip is public or user is authenticated participant
    if (!trip.isPublic) {
      if (!req.uid) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }
      if (trip.creatorId !== req.uid && 
          !trip.participants?.some((p) => (p.uid === req.uid))) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to view this trip',
        });
      }
    }

    res.json({ success: true, data: trip });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get user's trips
router.get('/', async (req: OptionalAuthRequest, res) => {
  try {
    if (!req.uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    const uid = req.uid;
    const { status, isPublic } = req.query;
    const db = getFirestore();

    // Query trips where user is creator
    const creatorQuery = db.collection('trips')
      .where('creatorId', '==', uid);
    
    // Get all trips and filter in memory (since participants is an array of objects)
    const creatorSnapshot = await creatorQuery.get();
    const creatorTrips = creatorSnapshot.docs.map((doc) => ({
      tripId: doc.id,
      ...doc.data(),
    })) as Trip[];

    // Also get all trips and filter for participant trips (in memory)
    // This is necessary since participants is an array of objects, not strings
    const allTripsSnapshot = await db.collection('trips').get();
    const allTrips = allTripsSnapshot.docs.map((doc) => ({
      tripId: doc.id,
      ...doc.data(),
    })) as Trip[];

    // Filter trips where user is a participant (not creator, already included)
    const participantTrips = allTrips.filter((trip) => {
      // Skip if already included as creator
      if (trip.creatorId === uid) return false;
      // Check if user is in participants array
      return trip.participants?.some((p) => p.uid === uid);
    });

    // Combine and deduplicate
    const allUserTrips = [...creatorTrips, ...participantTrips];
    const uniqueTrips = Array.from(
      new Map(allUserTrips.map((trip) => [trip.tripId, trip])).values()
    );

    // Filter by status if provided
    let filteredTrips = status
      ? uniqueTrips.filter((t) => t.status === status)
      : uniqueTrips;

    // Filter by isPublic if needed
    filteredTrips = isPublic !== undefined
      ? filteredTrips.filter((t) => t.isPublic === (isPublic === 'true'))
      : filteredTrips;

    // Sort by createdAt (newest first)
    filteredTrips.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

    res.json({ success: true, data: filteredTrips });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Add participants to trip
router.post('/:tripId/participants', async (req: OptionalAuthRequest, res) => {
  try {
    if (!req.uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    const { tripId } = req.params;
    const { participants } = req.body;
    const uid = req.uid;
    const db = getDb();

    const tripRef = db.collection('trips').doc(tripId);
    const tripDoc = await tripRef.get();

    if (!tripDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = tripDoc.data() as Trip;
    
    // Check if user is creator or participant
    if (trip.creatorId !== uid && !trip.participants.some((p) => p.uid === uid)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to add participants',
      });
    }

    // Process participants (can be uids or guest names)
    const newParticipants: TripParticipant[] = participants.map((p: string | TripParticipant) => {
      if (typeof p === 'string') {
        // Check if it's a uid (starts with alphanumeric, no spaces)
        if (/^[a-zA-Z0-9]+$/.test(p)) {
          return { uid: p, isGuest: false };
        } else {
          return { guestName: p, isGuest: true };
        }
      }
      return p;
    });

    // Merge with existing participants
    const existingUids = new Set(trip.participants.map((p) => p.uid).filter(Boolean));
    const existingGuests = new Set(trip.participants.map((p) => p.guestName).filter(Boolean));
    
    const mergedParticipants = [...trip.participants];
    newParticipants.forEach((newP) => {
      if (newP.uid && !existingUids.has(newP.uid)) {
        mergedParticipants.push(newP);
        existingUids.add(newP.uid);
      } else if (newP.guestName && !existingGuests.has(newP.guestName)) {
        mergedParticipants.push(newP);
        existingGuests.add(newP.guestName);
      }
    });

    await tripRef.update({
      participants: mergedParticipants,
      updatedAt: new Date(),
    });

    res.json({
      success: true,
      data: { participants: mergedParticipants },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Update trip (e.g., make public/private, end trip)
router.patch('/:tripId', async (req: OptionalAuthRequest, res) => {
  try {
    if (!req.uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    const { tripId } = req.params;
    const updates = req.body;
    const uid = req.uid;
    const db = getDb();

    const tripRef = db.collection('trips').doc(tripId);
    const tripDoc = await tripRef.get();

    if (!tripDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = tripDoc.data() as Trip;
    
    // Check authorization - allow creator or participants to edit
    const isCreator = trip.creatorId === uid;
    const isParticipant = trip.participants?.some((p) => p.uid === uid);
    
    if (!isCreator && !isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this trip. Only the creator or participants can edit.',
      });
    }

    // If ending trip, set endTime and status
    if (updates.status === 'completed' && !updates.endTime) {
      updates.endTime = new Date();
    }

    // Remove undefined values from updates
    const cleanUpdates: any = {
      updatedAt: new Date(),
    };
    
    Object.keys(updates).forEach((key) => {
      const value = updates[key as keyof typeof updates];
      if (value !== undefined) {
        cleanUpdates[key] = value;
      }
    });

    await tripRef.update(cleanUpdates);

    const updatedDoc = await tripRef.get();
    const updatedTrip = { tripId: updatedDoc.id, ...updatedDoc.data() } as Trip;

    res.json({
      success: true,
      data: updatedTrip,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Delete trip
router.delete('/:tripId', async (req: OptionalAuthRequest, res) => {
  try {
    if (!req.uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    const { tripId } = req.params;
    const uid = req.uid;
    const db = getDb();

    const tripRef = db.collection('trips').doc(tripId);
    const tripDoc = await tripRef.get();

    if (!tripDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = tripDoc.data() as Trip;

    // Check authorization - only creator can delete
    if (trip.creatorId !== uid) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this trip',
      });
    }

    // Get all places for this trip to collect image URLs
    const placesSnapshot = await db.collection('tripPlaces')
      .where('tripId', '==', tripId)
      .get();

    const places = placesSnapshot.docs.map(doc => doc.data() as TripPlace);
    
    // Collect all image URLs from places
    const imageUrls: string[] = [];
    places.forEach(place => {
      if (place.imageMetadata) {
        place.imageMetadata.forEach(img => imageUrls.push(img.url));
      }
      if (place.images) {
        place.images.forEach(url => imageUrls.push(url));
      }
    });

    // Delete images from Supabase
    if (imageUrls.length > 0) {
      try {
        const { getSupabase } = await import('../config/supabase.js');
        const supabase = getSupabase();
        
        // Extract file paths from URLs
        const filePaths = imageUrls
          .map(url => {
            try {
              const urlObj = new URL(url);
              // Extract path from Supabase URL (e.g., /storage/v1/object/public/images/trips/uid/file.jpg)
              const pathMatch = urlObj.pathname.match(/\/images\/(.+)$/);
              if (pathMatch) {
                return pathMatch[1];
              }
              return null;
            } catch {
              return null;
            }
          })
          .filter((path): path is string => path !== null);

        // Delete files from Supabase storage
        if (filePaths.length > 0) {
          const { error: deleteError } = await supabase.storage
            .from('images')
            .remove(filePaths);

          if (deleteError) {
            console.error('Error deleting images from Supabase:', deleteError);
            // Continue with trip deletion even if image deletion fails
          } else {
            console.log(`Deleted ${filePaths.length} images from Supabase`);
          }
        }
      } catch (error: any) {
        console.error('Error deleting images:', error);
        // Continue with trip deletion even if image deletion fails
      }
    }

    // Delete all related data
    const batch = db.batch();

    // Delete places
    placesSnapshot.docs.forEach(doc => batch.delete(doc.ref));

    // Delete expenses
    const expensesSnapshot = await db.collection('tripExpenses')
      .where('tripId', '==', tripId)
      .get();
    expensesSnapshot.docs.forEach(doc => batch.delete(doc.ref));

    // Delete routes
    const routesSnapshot = await db.collection('tripRoutes')
      .where('tripId', '==', tripId)
      .get();
    routesSnapshot.docs.forEach(doc => batch.delete(doc.ref));

    // Delete trip
    batch.delete(tripRef);

    await batch.commit();

    res.json({
      success: true,
      data: null,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get public trips (no auth required)
router.get('/public/list', async (req, res) => {
  try {
    const { limit, search } = req.query;
    const db = getDb();
    const snapshot = await db.collection('trips')
      .where('isPublic', '==', true)
      .get();

    let trips = snapshot.docs.map((doc) => ({
      tripId: doc.id,
      ...doc.data(),
    })) as Trip[];

    // Filter by search query if provided
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      trips = trips.filter((trip) => {
        // Search in title
        if (trip.title.toLowerCase().includes(searchLower)) return true;
        // Search in description
        if (trip.description?.toLowerCase().includes(searchLower)) return true;
        // Search in places (location names) - would need to fetch places
        // For now, just search title and description
        return false;
      });
    }

    // Sort by createdAt in memory (avoids needing composite index)
    trips.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime; // Descending order
    });

    // Apply limit only if provided (otherwise return all)
    if (limit) {
      trips = trips.slice(0, Number(limit));
    }

    res.json({ success: true, data: trips });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get public trips with essential data (places, routes, creators) - optimized endpoint
// Prioritizes trips from followed users if user is authenticated
// Supports pagination with lastTripId
router.get('/public/list/with-data', async (req: OptionalAuthRequest, res) => {
  try {
    const { limit = '20', lastTripId } = req.query;
    const db = getDb();
    
    // Get user's followed list if authenticated
    let followedUserIds: string[] = [];
    if (req.uid) {
      const userDoc = await db.collection('users').doc(req.uid).get();
      if (userDoc.exists) {
        followedUserIds = userDoc.data()?.follows || [];
      }
    }
    
    // Get all public trips (fetch without orderBy to avoid composite index requirement)
    const snapshot = await db.collection('trips')
      .where('isPublic', '==', true)
      .get();

    let trips = snapshot.docs.map((doc) => ({
      tripId: doc.id,
      ...doc.data(),
    })) as Trip[];

    // Sort: followed users first, then by createdAt
    trips.sort((a, b) => {
      const aIsFollowed = followedUserIds.includes(a.creatorId);
      const bIsFollowed = followedUserIds.includes(b.creatorId);
      
      // If one is followed and the other isn't, prioritize followed
      if (aIsFollowed && !bIsFollowed) return -1;
      if (!aIsFollowed && bIsFollowed) return 1;
      
      // Otherwise sort by createdAt (newest first)
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

    // Handle pagination in memory
    if (lastTripId && typeof lastTripId === 'string') {
      const lastIndex = trips.findIndex(t => t.tripId === lastTripId);
      if (lastIndex >= 0) {
        trips = trips.slice(lastIndex + 1);
      }
    }

    // Apply limit after sorting and pagination
    const limitNum = Number(limit);
    const totalAfterPagination = trips.length;
    const hasMore = totalAfterPagination > limitNum;
    trips = trips.slice(0, limitNum);

    const tripIds = trips.map(t => t.tripId);
    
    // Batch fetch all places for all trips
    const placesPromises = tripIds.map(async (tripId) => {
      const placesSnapshot = await db.collection('tripPlaces')
        .where('tripId', '==', tripId)
        .get();
      return placesSnapshot.docs.map(doc => ({
        placeId: doc.id,
        ...doc.data(),
      }));
    });

    // Batch fetch all routes for all trips
    const routesPromises = tripIds.map(async (tripId) => {
      const routesSnapshot = await db.collection('tripRoutes')
        .where('tripId', '==', tripId)
        .get();
      return routesSnapshot.docs.map(doc => ({
        routeId: doc.id,
        ...doc.data(),
      }));
    });

    // Fetch all in parallel
    const [placesResults, routesResults] = await Promise.all([
      Promise.all(placesPromises),
      Promise.all(routesPromises),
    ]);

    // Organize places and routes by tripId
    const placesByTrip: Record<string, any[]> = {};
    const routesByTrip: Record<string, any[]> = {};
    
    tripIds.forEach((tripId, index) => {
      placesByTrip[tripId] = placesResults[index] || [];
      routesByTrip[tripId] = routesResults[index] || [];
    });

    // Get unique creator IDs
    const creatorIds = [...new Set(trips.map(t => t.creatorId))];
    
    // Batch fetch creator info
    const creatorPromises = creatorIds.map(async (creatorId) => {
      try {
        const creatorDoc = await db.collection('users').doc(creatorId).get();
        if (creatorDoc.exists) {
          return { uid: creatorId, user: creatorDoc.data() };
        }
      } catch (error) {
        console.error(`Failed to load creator ${creatorId}:`, error);
      }
      return null;
    });

    const creatorResults = await Promise.all(creatorPromises);
    const creatorMap: Record<string, any> = {};
    creatorResults.forEach(result => {
      if (result) {
        creatorMap[result.uid] = result.user;
      }
    });

    // Calculate pagination info
    const nextLastTripId = trips.length > 0 ? trips[trips.length - 1].tripId : null;

    // Build response with trips, places, routes, and creators
    res.json({
      success: true,
      data: {
        trips,
        placesByTrip,
        routesByTrip,
        creators: creatorMap,
        hasMore,
        lastTripId: nextLastTripId,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Search trips by user, place, or keyword
router.get('/search', async (req: OptionalAuthRequest, res) => {
  try {
    const { q, type, limit = '20', lastTripId } = req.query;
    const db = getDb();
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required',
      });
    }

    const searchType = type || 'all'; // 'user', 'place', 'trip', 'all'
    const searchLower = q.toLowerCase();
    let trips: Trip[] = [];

    if (searchType === 'user' || searchType === 'all') {
      // Search by user name/email
      const usersSnapshot = await db.collection('users')
        .where('name', '>=', searchLower)
        .where('name', '<=', searchLower + '\uf8ff')
        .limit(10)
        .get();
      
      const userIds = usersSnapshot.docs.map(doc => doc.id);
      
      if (userIds.length > 0) {
        // Get trips by these users
        const tripsPromises = userIds.map(async (userId) => {
          const tripsSnapshot = await db.collection('trips')
            .where('creatorId', '==', userId)
            .where('isPublic', '==', true)
            .get();
          return tripsSnapshot.docs.map(doc => ({
            tripId: doc.id,
            ...doc.data(),
          })) as Trip[];
        });
        
        const userTrips = await Promise.all(tripsPromises);
        trips.push(...userTrips.flat());
      }
    }

    if (searchType === 'trip' || searchType === 'all') {
      // Search by trip title/description
      const allTripsSnapshot = await db.collection('trips')
        .where('isPublic', '==', true)
        .get();
      
      const allTrips = allTripsSnapshot.docs.map((doc) => ({
        tripId: doc.id,
        ...doc.data(),
      })) as Trip[];
      
      const matchingTrips = allTrips.filter((trip) => {
        if (trip.title.toLowerCase().includes(searchLower)) return true;
        if (trip.description?.toLowerCase().includes(searchLower)) return true;
        return false;
      });
      
      trips.push(...matchingTrips);
    }

    if (searchType === 'place' || searchType === 'all') {
      // Search by place name
      const placesSnapshot = await db.collection('tripPlaces')
        .where('name', '>=', searchLower)
        .where('name', '<=', searchLower + '\uf8ff')
        .limit(50)
        .get();
      
      const placeDocs = placesSnapshot.docs;
      const tripIds = [...new Set(placeDocs.map(doc => doc.data().tripId))];
      
      if (tripIds.length > 0) {
        const tripsPromises = tripIds.map(async (tripId) => {
          const tripDoc = await db.collection('trips').doc(tripId).get();
          if (tripDoc.exists) {
            const tripData = tripDoc.data();
            if (tripData && tripData.isPublic) {
              return { tripId: tripDoc.id, ...tripData } as Trip;
            }
          }
          return null;
        });
        
        const placeTrips = await Promise.all(tripsPromises);
        trips.push(...placeTrips.filter(t => t !== null) as Trip[]);
      }
    }

    // Remove duplicates
    const uniqueTrips = Array.from(
      new Map(trips.map(trip => [trip.tripId, trip])).values()
    );

    // Sort by createdAt
    uniqueTrips.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

    // Apply pagination
    let paginatedTrips = uniqueTrips;
    if (lastTripId && typeof lastTripId === 'string') {
      const lastIndex = paginatedTrips.findIndex(t => t.tripId === lastTripId);
      if (lastIndex >= 0) {
        paginatedTrips = paginatedTrips.slice(lastIndex + 1);
      }
    }
    paginatedTrips = paginatedTrips.slice(0, Number(limit));

    const hasMore = paginatedTrips.length === Number(limit) && 
                    uniqueTrips.length > paginatedTrips.length;
    const newLastTripId = paginatedTrips.length > 0 
      ? paginatedTrips[paginatedTrips.length - 1].tripId 
      : null;

    res.json({
      success: true,
      data: {
        trips: paginatedTrips,
        hasMore,
        lastTripId: newLastTripId,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Like a trip
router.post('/:tripId/like', async (req: OptionalAuthRequest, res) => {
  try {
    if (!req.uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    const { tripId } = req.params;
    const uid = req.uid;
    const db = getDb();

    const tripRef = db.collection('trips').doc(tripId);
    const tripDoc = await tripRef.get();

    if (!tripDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = tripDoc.data() as Trip;
    
    // Check if trip is public or user has access
    if (!trip.isPublic) {
      if (trip.creatorId !== uid && 
          !trip.participants?.some((p) => p.uid === uid)) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to like this trip',
        });
      }
    }

    // Check if already liked
    const likeDoc = await db.collection('tripLikes')
      .where('tripId', '==', tripId)
      .where('userId', '==', uid)
      .limit(1)
      .get();

    if (!likeDoc.empty) {
      return res.json({
        success: true,
        data: { liked: true, message: 'Already liked' },
      });
    }

    // Add like
    await db.collection('tripLikes').add({
      tripId,
      userId: uid,
      createdAt: new Date(),
    });

    res.json({
      success: true,
      data: { liked: true, message: 'Trip liked' },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Unlike a trip
router.delete('/:tripId/like', async (req: OptionalAuthRequest, res) => {
  try {
    if (!req.uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    const { tripId } = req.params;
    const uid = req.uid;
    const db = getDb();

    // Find and delete like
    const likeSnapshot = await db.collection('tripLikes')
      .where('tripId', '==', tripId)
      .where('userId', '==', uid)
      .limit(1)
      .get();

    if (likeSnapshot.empty) {
      return res.json({
        success: true,
        data: { liked: false, message: 'Not liked' },
      });
    }

    await likeSnapshot.docs[0].ref.delete();

    res.json({
      success: true,
      data: { liked: false, message: 'Trip unliked' },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get like status and count for a trip
router.get('/:tripId/likes', async (req: OptionalAuthRequest, res) => {
  try {
    const { tripId } = req.params;
    const uid = req.uid;
    const db = getDb();

    // Verify trip exists
    const tripDoc = await db.collection('trips').doc(tripId).get();
    if (!tripDoc.exists) {
      return res.json({
        success: true,
        data: {
          likeCount: 0,
          isLiked: false,
        },
      });
    }

    // Get all likes for this trip
    let likeCount = 0;
    let isLiked = false;

    try {
      const likesSnapshot = await db.collection('tripLikes')
        .where('tripId', '==', tripId)
        .get();

      likeCount = likesSnapshot.size;
      isLiked = uid ? likesSnapshot.docs.some(doc => doc.data().userId === uid) : false;
    } catch (queryError: any) {
      // If query fails (e.g., collection doesn't exist), return defaults
      console.warn('Error querying tripLikes:', queryError.message);
      likeCount = 0;
      isLiked = false;
    }

    res.json({
      success: true,
      data: {
        likeCount,
        isLiked,
      },
    });
  } catch (error: any) {
    console.error('Error getting trip likes:', error);
    // Return defaults instead of error to prevent UI issues
    res.json({
      success: true,
      data: {
        likeCount: 0,
        isLiked: false,
      },
    });
  }
});

// Get comment count for a trip
router.get('/:tripId/comments/count', async (req: OptionalAuthRequest, res) => {
  try {
    const { tripId } = req.params;
    const db = getDb();

    // Verify trip exists
    const tripDoc = await db.collection('trips').doc(tripId).get();
    if (!tripDoc.exists) {
      return res.json({
        success: true,
        data: { commentCount: 0 },
      });
    }

    // Get all comments for places in this trip
    const placesSnapshot = await db.collection('tripPlaces')
      .where('tripId', '==', tripId)
      .get();

    const placeIds = placesSnapshot.docs.map(doc => doc.id);
    
    if (placeIds.length === 0) {
      return res.json({
        success: true,
        data: { commentCount: 0 },
      });
    }

    // Get comment count for all places in this trip
    // Use a single query with 'in' operator if possible, or batch queries
    let totalCommentCount = 0;
    
    try {
      // Firestore 'in' operator supports up to 10 items, so we need to batch if more
      if (placeIds.length <= 10) {
        // Single query for all place IDs
        const commentsSnapshot = await db.collection('placeComments')
          .where('placeId', 'in', placeIds)
          .get();
        totalCommentCount = commentsSnapshot.size;
      } else {
        // Batch queries for more than 10 places
        const batches = [];
        for (let i = 0; i < placeIds.length; i += 10) {
          const batch = placeIds.slice(i, i + 10);
          batches.push(
            db.collection('placeComments')
              .where('placeId', 'in', batch)
              .get()
          );
        }
        const results = await Promise.all(batches);
        totalCommentCount = results.reduce((sum, snapshot) => sum + snapshot.size, 0);
      }
    } catch (queryError: any) {
      // If query fails (e.g., collection doesn't exist), return 0
      console.warn('Error querying placeComments:', queryError.message);
      totalCommentCount = 0;
    }

    res.json({
      success: true,
      data: { commentCount: totalCommentCount },
    });
  } catch (error: any) {
    console.error('Error getting comment count:', error);
    // Return 0 instead of error to prevent UI issues
    res.json({
      success: true,
      data: { commentCount: 0 },
    });
  }
});

export default router;

