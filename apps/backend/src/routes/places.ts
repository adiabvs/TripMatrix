import express from 'express';
import { getFirestore } from '../config/firebase.js';
import { OptionalAuthRequest } from '../middleware/optionalAuth.js';
import type { TripPlace } from '@tripmatrix/types';

const router = express.Router();
const db = getFirestore();

// Add a place visited
router.post('/', async (req: OptionalAuthRequest, res) => {
  try {
    const { tripId, name, coordinates, visitedAt, rating, comment, rewrittenComment } = req.body;
    const uid = req.uid!;

    if (!tripId || !name || !coordinates) {
      return res.status(400).json({
        success: false,
        error: 'tripId, name, and coordinates are required',
      });
    }

    // Verify trip exists
    const tripDoc = await db.collection('trips').doc(tripId).get();
    if (!tripDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const placeData: Omit<TripPlace, 'placeId'> = {
      tripId,
      name,
      coordinates: {
        lat: coordinates.lat,
        lng: coordinates.lng,
      },
      visitedAt: visitedAt ? new Date(visitedAt) : new Date(),
      rating: rating || undefined,
      comment: comment || undefined,
      rewrittenComment: rewrittenComment || undefined,
      createdAt: new Date(),
    };

    const placeRef = await db.collection('tripPlaces').add(placeData);
    
    const place: TripPlace = {
      placeId: placeRef.id,
      ...placeData,
    };

    res.json({
      success: true,
      data: place,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get places for a trip (public access for public trips)
router.get('/trip/:tripId', async (req: OptionalAuthRequest, res) => {
  try {
    const { tripId } = req.params;
    
    // Check if trip is public
    const tripDoc = await db.collection('trips').doc(tripId).get();
    if (!tripDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = tripDoc.data()!;
    // Allow access if trip is public or user is authenticated participant
    if (!trip.isPublic) {
      if (!req.uid) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }
      if (trip.creatorId !== req.uid && 
          !trip.participants?.some((p: any) => p.uid === req.uid)) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized',
        });
      }
    }
    
    const snapshot = await db.collection('tripPlaces')
      .where('tripId', '==', tripId)
      .orderBy('visitedAt', 'desc')
      .get();

    const places = snapshot.docs.map((doc) => ({
      placeId: doc.id,
      ...doc.data(),
    })) as TripPlace[];

    res.json({ success: true, data: places });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

