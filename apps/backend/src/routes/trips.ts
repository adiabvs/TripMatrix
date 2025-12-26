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

    const initialStatus = status === 'completed' ? 'completed' : 'in_progress';
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
router.get('/public/list/with-data', async (req, res) => {
  try {
    const { limit = '50' } = req.query;
    const db = getDb();
    
    // Get public trips with limit
    const snapshot = await db.collection('trips')
      .where('isPublic', '==', true)
      .limit(Number(limit))
      .get();

    const trips = snapshot.docs.map((doc) => ({
      tripId: doc.id,
      ...doc.data(),
    })) as Trip[];

    // Sort by createdAt
    trips.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

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

    // Build response with trips, places, routes, and creators
    res.json({
      success: true,
      data: {
        trips,
        placesByTrip,
        routesByTrip,
        creators: creatorMap,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

