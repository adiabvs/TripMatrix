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
    const { title, description, startTime, coverImage, isPublic } = req.body;
    const uid = req.uid!;

    if (!title || !startTime) {
      return res.status(400).json({
        success: false,
        error: 'Title and startTime are required',
      });
    }

    const tripData: Omit<Trip, 'tripId'> = {
      creatorId: uid,
      title,
      description: description || '',
      participants: [{ uid, isGuest: false }],
      isPublic: isPublic || false,
      status: 'in_progress',
      startTime: new Date(startTime),
      coverImage: coverImage || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

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
    const db = getDb();

    let query: FirebaseFirestore.Query = db.collection('trips')
      .where('participants', 'array-contains', uid);

    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    const trips = snapshot.docs.map((doc) => ({
      tripId: doc.id,
      ...doc.data(),
    })) as Trip[];

    // Filter by isPublic if needed
    const filteredTrips = isPublic !== undefined
      ? trips.filter((t) => t.isPublic === (isPublic === 'true'))
      : trips;

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

    await tripRef.update({
      ...updates,
      updatedAt: new Date(),
    });

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
      .orderBy('createdAt', 'desc')
      .limit(Number(limit))
      .get();

    const trips = snapshot.docs.map((doc) => ({
      tripId: doc.id,
      ...doc.data(),
    })) as Trip[];

    res.json({ success: true, data: trips });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

