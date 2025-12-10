import express from 'express';
import { getFirestore } from '../config/firebase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { OptionalAuthRequest } from '../middleware/optionalAuth.js';
import type { Trip, TripParticipant } from '@tripmatrix/types';

const router = express.Router();

function getDb() {
  return getFirestore();
}

// Create a new trip
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { title, description, startTime, endTime, coverImage, isPublic, status, participants } = req.body;
    const uid = req.uid!;

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
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.uid!;
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
router.post('/:tripId/participants', async (req: AuthenticatedRequest, res) => {
  try {
    const { tripId } = req.params;
    const { participants } = req.body;
    const uid = req.uid!;
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
router.patch('/:tripId', async (req: AuthenticatedRequest, res) => {
  try {
    const { tripId } = req.params;
    const updates = req.body;
    const uid = req.uid!;
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
    
    // Check authorization
    if (trip.creatorId !== uid) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this trip',
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

// Get public trips (no auth required)
router.get('/public/list', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const db = getDb();
    const snapshot = await db.collection('trips')
      .where('isPublic', '==', true)
      .get();

    let trips = snapshot.docs.map((doc) => ({
      tripId: doc.id,
      ...doc.data(),
    })) as Trip[];

    // Sort by createdAt in memory (avoids needing composite index)
    trips.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime; // Descending order
    });

    // Apply limit after sorting
    trips = trips.slice(0, Number(limit));

    res.json({ success: true, data: trips });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

