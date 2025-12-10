import express from 'express';
import { getFirestore } from '../config/firebase.js';
import { OptionalAuthRequest } from '../middleware/optionalAuth.js';
import type { TripPlace } from '@tripmatrix/types';

const router = express.Router();

function getDb() {
  return getFirestore();
}

// Add a place visited
router.post('/', async (req: OptionalAuthRequest, res) => {
  try {
    const { 
      tripId, 
      name, 
      coordinates, 
      visitedAt, 
      rating, 
      comment, 
      rewrittenComment,
      modeOfTravel,
      distanceFromPrevious,
      timeFromPrevious,
      images, // Legacy support
      imageMetadata, // New format with privacy
    } = req.body;
    const uid = req.uid!;

    if (!tripId || !name || !coordinates) {
      return res.status(400).json({
        success: false,
        error: 'tripId, name, and coordinates are required',
      });
    }

    // Verify trip exists
    const db = getDb();
    const tripDoc = await db.collection('trips').doc(tripId).get();
    if (!tripDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    // Build place data object, filtering out undefined values
    const placeData: any = {
      tripId,
      name,
      coordinates: {
        lat: coordinates.lat,
        lng: coordinates.lng,
      },
      visitedAt: visitedAt ? new Date(visitedAt) : new Date(),
      createdAt: new Date(),
    };

    // Only add fields that have values (not undefined)
    if (rating !== undefined && rating !== null) placeData.rating = rating;
    if (comment) placeData.comment = comment;
    if (rewrittenComment) placeData.rewrittenComment = rewrittenComment;
    if (modeOfTravel) placeData.modeOfTravel = modeOfTravel;
    if (distanceFromPrevious !== undefined && distanceFromPrevious !== null) {
      placeData.distanceFromPrevious = distanceFromPrevious;
    }
    if (timeFromPrevious !== undefined && timeFromPrevious !== null) {
      placeData.timeFromPrevious = timeFromPrevious;
    }
    if (images && images.length > 0) placeData.images = images; // Legacy support
    if (imageMetadata && imageMetadata.length > 0) placeData.imageMetadata = imageMetadata; // New format with privacy

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
    const db = getDb();
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
      .get();

    const places = snapshot.docs.map((doc) => ({
      placeId: doc.id,
      ...doc.data(),
    })) as TripPlace[];

    // Sort by visitedAt in memory (avoids needing composite index)
    places.sort((a, b) => {
      const aTime = new Date(a.visitedAt).getTime();
      const bTime = new Date(b.visitedAt).getTime();
      return bTime - aTime; // Descending order
    });

    res.json({ success: true, data: places });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

