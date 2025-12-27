import express from 'express';
import { getFirestore } from '../config/firebase.js';
import { OptionalAuthRequest } from '../middleware/optionalAuth.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import type { TripPlace, PlaceComment } from '@tripmatrix/types';

const router = express.Router();

function getDb() {
  return getFirestore();
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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
      nextPlaceId, // If inserting between steps, this is the place that comes after
    } = req.body;
    const uid = req.uid!;

    if (!tripId || !name || !coordinates) {
      return res.status(400).json({
        success: false,
        error: 'tripId, name, and coordinates are required',
      });
    }

    // Verify trip exists and user has permission
    const db = getDb();
    const tripDoc = await db.collection('trips').doc(tripId).get();
    if (!tripDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = tripDoc.data()!;
    
    // Check authorization - allow creator or participants to add places
    if (!uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    const isCreator = trip.creatorId === uid;
    const isParticipant = trip.participants?.some((p: any) => p.uid === uid);
    
    if (!isCreator && !isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to add places. Only the creator or participants can add places.',
      });
    }

    // Calculate visitedAt timestamp if inserting between steps
    let finalVisitedAt: Date;
    if (visitedAt) {
      finalVisitedAt = new Date(visitedAt);
    } else if (nextPlaceId) {
      // If inserting between steps, set timestamp between previous and next
      const nextPlaceDoc = await db.collection('tripPlaces').doc(nextPlaceId).get();
      if (nextPlaceDoc.exists) {
        const nextPlace = nextPlaceDoc.data() as TripPlace;
        const nextVisitedAt = new Date(nextPlace.visitedAt);
        // Set new place's visitedAt to be 1 hour before the next place
        finalVisitedAt = new Date(nextVisitedAt.getTime() - 60 * 60 * 1000);
      } else {
        finalVisitedAt = new Date();
      }
    } else {
      finalVisitedAt = new Date();
    }

    // Build place data object, filtering out undefined values
    const placeData: any = {
      tripId,
      name,
      coordinates: {
        lat: coordinates.lat,
        lng: coordinates.lng,
      },
      visitedAt: finalVisitedAt,
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

    // If inserting between steps, update the next place's distance/time from the newly inserted place
    if (nextPlaceId) {
      const nextPlaceDoc = await db.collection('tripPlaces').doc(nextPlaceId).get();
      if (nextPlaceDoc.exists) {
        const nextPlace = nextPlaceDoc.data() as TripPlace;
        const newDistance = calculateDistance(
          coordinates.lat,
          coordinates.lng,
          nextPlace.coordinates.lat,
          nextPlace.coordinates.lng
        );
        
        // Update the next place to recalculate from the newly inserted place
        // Clear modeOfTravel so user can set it again if needed
        await db.collection('tripPlaces').doc(nextPlaceId).update({
          distanceFromPrevious: newDistance,
          timeFromPrevious: null, // Clear time, user can recalculate with mode
          modeOfTravel: null, // Clear mode, user needs to set it again
          updatedAt: new Date(),
        });
      }
    }

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

// Delete a place
router.delete('/:placeId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { placeId } = req.params;
    const uid = req.uid!;

    if (!uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const db = getDb();
    const placeRef = db.collection('tripPlaces').doc(placeId);
    const placeDoc = await placeRef.get();

    if (!placeDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Place not found',
      });
    }

    const place = placeDoc.data() as TripPlace;
    
    // Verify trip exists and user has permission
    const tripDoc = await db.collection('trips').doc(place.tripId).get();
    if (!tripDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = tripDoc.data()!;
    // Check if user is creator or participant
    if (trip.creatorId !== uid && 
        !trip.participants?.some((p: any) => p.uid === uid)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this place',
      });
    }

    // If deleting a place, we may need to update the next place's distance/time
    // Get all places for the trip to find the next one
    const allPlacesSnapshot = await db.collection('tripPlaces')
      .where('tripId', '==', place.tripId)
      .get();
    
    const allPlaces = allPlacesSnapshot.docs
      .map((doc) => ({ placeId: doc.id, ...doc.data() }))
      .filter((p) => p.placeId !== placeId) as TripPlace[];
    
    // Sort by visitedAt
    allPlaces.sort((a, b) => {
      const aTime = new Date(a.visitedAt).getTime();
      const bTime = new Date(b.visitedAt).getTime();
      return aTime - bTime;
    });

    // Find the place that was before the deleted one
    const deletedTime = new Date(place.visitedAt).getTime();
    const previousPlace = allPlaces
      .filter((p) => new Date(p.visitedAt).getTime() < deletedTime)
      .sort((a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime())[0];
    
    // Find the place that was after the deleted one
    const nextPlace = allPlaces
      .filter((p) => new Date(p.visitedAt).getTime() > deletedTime)
      .sort((a, b) => new Date(a.visitedAt).getTime() - new Date(b.visitedAt).getTime())[0];

    // Delete the place
    await placeRef.delete();

    // If there's a next place and a previous place, update next place's distance from previous
    if (nextPlace && previousPlace) {
      const newDistance = calculateDistance(
        previousPlace.coordinates.lat,
        previousPlace.coordinates.lng,
        nextPlace.coordinates.lat,
        nextPlace.coordinates.lng
      );
      
      await db.collection('tripPlaces').doc(nextPlace.placeId).update({
        distanceFromPrevious: newDistance,
        timeFromPrevious: null, // Clear time, user can recalculate with mode
        modeOfTravel: null, // Clear mode, user needs to set it again
        updatedAt: new Date(),
      });
    } else if (nextPlace && !previousPlace) {
      // If this was the first place, clear the next place's distance/time
      await db.collection('tripPlaces').doc(nextPlace.placeId).update({
        distanceFromPrevious: null,
        timeFromPrevious: null,
        modeOfTravel: null,
        updatedAt: new Date(),
      });
    }

    res.json({
      success: true,
      data: { placeId },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Update a place (for editing mode of travel, etc.)
router.patch('/:placeId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { placeId } = req.params;
    const updates = req.body;
    const uid = req.uid!;

    if (!uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const db = getDb();
    const placeRef = db.collection('tripPlaces').doc(placeId);
    const placeDoc = await placeRef.get();

    if (!placeDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Place not found',
      });
    }

    const place = placeDoc.data() as TripPlace;
    
    // Verify trip exists and user has permission
    const tripDoc = await db.collection('trips').doc(place.tripId).get();
    if (!tripDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = tripDoc.data()!;
    // Check if user is creator or participant
    if (trip.creatorId !== uid && 
        !trip.participants?.some((p: any) => p.uid === uid)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this place',
      });
    }

    // Build update object, filtering out undefined values
    const cleanUpdates: any = {};
    
    // Handle all possible update fields
    if (updates.name !== undefined) {
      cleanUpdates.name = updates.name;
    }
    if (updates.coordinates !== undefined) {
      cleanUpdates.coordinates = updates.coordinates;
    }
    if (updates.visitedAt !== undefined) {
      cleanUpdates.visitedAt = updates.visitedAt instanceof Date ? updates.visitedAt : new Date(updates.visitedAt);
    }
    if (updates.rating !== undefined) {
      cleanUpdates.rating = updates.rating;
    }
    if (updates.comment !== undefined) {
      cleanUpdates.comment = updates.comment;
    }
    if (updates.rewrittenComment !== undefined) {
      cleanUpdates.rewrittenComment = updates.rewrittenComment;
    }
    if (updates.modeOfTravel !== undefined) {
      cleanUpdates.modeOfTravel = updates.modeOfTravel || null;
    }
    if (updates.distanceFromPrevious !== undefined) {
      cleanUpdates.distanceFromPrevious = updates.distanceFromPrevious;
    }
    if (updates.timeFromPrevious !== undefined) {
      cleanUpdates.timeFromPrevious = updates.timeFromPrevious || null;
    }
    // Handle images - support both legacy and new format
    if (updates.images !== undefined) {
      cleanUpdates.images = updates.images;
    }
    if (updates.imageMetadata !== undefined) {
      cleanUpdates.imageMetadata = updates.imageMetadata;
    }
    
    // Always update the updatedAt timestamp
    cleanUpdates.updatedAt = new Date();

    await placeRef.update(cleanUpdates);

    const updatedDoc = await placeRef.get();
    const updatedPlace = { placeId: updatedDoc.id, ...updatedDoc.data() } as TripPlace;

    res.json({
      success: true,
      data: updatedPlace,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Add a comment to a place
router.post('/:placeId/comments', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { placeId } = req.params;
    const { text } = req.body;
    const uid = req.uid!;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Comment text is required',
      });
    }

    const db = getDb();
    const placeRef = db.collection('tripPlaces').doc(placeId);
    const placeDoc = await placeRef.get();

    if (!placeDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Place not found',
      });
    }

    const place = placeDoc.data() as TripPlace;
    
    // Check if trip is public or user has access
    const tripDoc = await db.collection('trips').doc(place.tripId).get();
    if (!tripDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = tripDoc.data()!;
    
    // Allow comments if trip is public, or if user is creator/participant
    if (!trip.isPublic) {
      if (trip.creatorId !== uid && 
          !trip.participants?.some((p: any) => p.uid === uid)) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to comment on this place',
        });
      }
    }

    // Create comment
    const commentId = db.collection('placeComments').doc().id;
    const comment: PlaceComment = {
      commentId,
      placeId,
      userId: uid,
      text: text.trim(),
      createdAt: new Date(),
    };

    await db.collection('placeComments').doc(commentId).set(comment);

    res.json({
      success: true,
      data: comment,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get comments for a place
router.get('/:placeId/comments', async (req: OptionalAuthRequest, res) => {
  try {
    const { placeId } = req.params;
    const db = getDb();

    const placeRef = db.collection('tripPlaces').doc(placeId);
    const placeDoc = await placeRef.get();

    if (!placeDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Place not found',
      });
    }

    const place = placeDoc.data() as TripPlace;
    
    // Check if trip is public or user has access
    const tripDoc = await db.collection('trips').doc(place.tripId).get();
    if (!tripDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = tripDoc.data()!;
    
    // Allow viewing comments if trip is public, or if user is authenticated and has access
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
          error: 'Not authorized to view comments',
        });
      }
    }

    // Get all comments for this place
    const commentsSnapshot = await db.collection('placeComments')
      .where('placeId', '==', placeId)
      .get();

    const comments = (commentsSnapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          commentId: doc.id,
          ...data,
          // Convert Firestore Timestamp to Date if needed
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        };
      }) as PlaceComment[])
      .sort((a, b) => {
        const aTime = a.createdAt instanceof Date 
          ? a.createdAt.getTime() 
          : typeof a.createdAt === 'string' 
            ? new Date(a.createdAt).getTime() 
            : 0;
        const bTime = b.createdAt instanceof Date 
          ? b.createdAt.getTime() 
          : typeof b.createdAt === 'string' 
            ? new Date(b.createdAt).getTime() 
            : 0;
        return bTime - aTime; // Sort descending (newest first)
      });

    res.json({
      success: true,
      data: comments,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Like a place
router.post('/:placeId/like', async (req: OptionalAuthRequest, res) => {
  try {
    if (!req.uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    const { placeId } = req.params;
    const uid = req.uid;
    const db = getDb();

    const placeRef = db.collection('tripPlaces').doc(placeId);
    const placeDoc = await placeRef.get();

    if (!placeDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Place not found',
      });
    }

    const place = placeDoc.data() as TripPlace;
    
    // Check if trip is public or user has access
    const tripDoc = await db.collection('trips').doc(place.tripId).get();
    if (!tripDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = tripDoc.data()!;
    
    // Allow likes if trip is public, or if user is creator/participant
    if (!trip.isPublic) {
      if (trip.creatorId !== uid && 
          !trip.participants?.some((p: any) => p.uid === uid)) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to like this place',
        });
      }
    }

    // Check if already liked
    const likeDoc = await db.collection('placeLikes')
      .where('placeId', '==', placeId)
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
    await db.collection('placeLikes').add({
      placeId,
      userId: uid,
      createdAt: new Date(),
    });

    res.json({
      success: true,
      data: { liked: true, message: 'Place liked' },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Unlike a place
router.delete('/:placeId/like', async (req: OptionalAuthRequest, res) => {
  try {
    if (!req.uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    const { placeId } = req.params;
    const uid = req.uid;
    const db = getDb();

    // Find and delete like
    const likeSnapshot = await db.collection('placeLikes')
      .where('placeId', '==', placeId)
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
      data: { liked: false, message: 'Place unliked' },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get like status and count for a place
router.get('/:placeId/likes', async (req: OptionalAuthRequest, res) => {
  try {
    const { placeId } = req.params;
    const uid = req.uid;
    const db = getDb();

    // Get all likes for this place
    const likesSnapshot = await db.collection('placeLikes')
      .where('placeId', '==', placeId)
      .get();

    const likeCount = likesSnapshot.size;
    const isLiked = uid ? likesSnapshot.docs.some(doc => doc.data().userId === uid) : false;

    res.json({
      success: true,
      data: {
        likeCount,
        isLiked,
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

