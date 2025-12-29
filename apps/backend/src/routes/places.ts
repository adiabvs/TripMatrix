import express from 'express';
import { OptionalAuthRequest } from '../middleware/optionalAuth.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import type { TripPlace, PlaceComment } from '@tripmatrix/types';
import { TripModel } from '../models/Trip.js';
import { TripPlaceModel } from '../models/TripPlace.js';
import { PlaceCommentModel } from '../models/PlaceComment.js';
import { PlaceLikeModel } from '../models/PlaceLike.js';

const router = express.Router();

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
    const trip = await TripModel.findById(tripId);
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const tripData = trip.toJSON();
    
    // Check authorization - allow creator or accepted participants to add places
    if (!uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    const isCreator = tripData.creatorId === uid;
    // Check if user is an accepted participant (status is 'accepted' or undefined for backward compatibility)
    // Pending participants cannot add places until they accept the invitation
    const isParticipant = tripData.participants?.some((p: any) => 
      p.uid === uid && 
      !p.isGuest && 
      (p.status === 'accepted' || p.status === undefined)
    );
    
    if (!isCreator && !isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to add places. Only the creator or accepted participants can add places.',
      });
    }

    // Calculate visitedAt timestamp if inserting between steps
    let finalVisitedAt: Date;
    if (visitedAt) {
      finalVisitedAt = new Date(visitedAt);
    } else if (nextPlaceId) {
      // If inserting between steps, set timestamp between previous and next
      const nextPlace = await TripPlaceModel.findById(nextPlaceId);
      if (nextPlace) {
        const nextPlaceData = nextPlace.toJSON() as TripPlace;
        const nextVisitedAt = new Date(nextPlaceData.visitedAt);
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

    const placeDoc = new TripPlaceModel(placeData);
    const savedPlace = await placeDoc.save();
    
    const place: TripPlace = savedPlace.toJSON() as TripPlace;

    // If inserting between steps, update the next place's distance/time from the newly inserted place
    if (nextPlaceId) {
      const nextPlace = await TripPlaceModel.findById(nextPlaceId);
      if (nextPlace) {
        const nextPlaceData = nextPlace.toJSON() as TripPlace;
        const newDistance = calculateDistance(
          coordinates.lat,
          coordinates.lng,
          nextPlaceData.coordinates.lat,
          nextPlaceData.coordinates.lng
        );
        
        // Update the next place to recalculate from the newly inserted place
        // Clear modeOfTravel so user can set it again if needed
        nextPlace.distanceFromPrevious = newDistance;
        nextPlace.timeFromPrevious = undefined; // Clear time, user can recalculate with mode
        nextPlace.modeOfTravel = undefined; // Clear mode, user needs to set it again
        (nextPlace as any).updatedAt = new Date();
        await nextPlace.save();
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
    const trip = await TripModel.findById(tripId);
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const tripData = trip.toJSON();
    // Allow access if trip is public or user is authenticated participant
    if (!tripData.isPublic) {
      if (!req.uid) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }
      if (tripData.creatorId !== req.uid && 
          !tripData.participants?.some((p: any) => 
            p.uid === req.uid && 
            !p.isGuest && 
            (p.status === 'accepted' || p.status === undefined)
          )) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized',
        });
      }
    }
    
    const placesDocs = await TripPlaceModel.find({ tripId }).sort({ visitedAt: 1 }); // Sort ascending by visitedAt
    const places = placesDocs.map(doc => doc.toJSON() as TripPlace);

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

    const place = await TripPlaceModel.findById(placeId);
    if (!place) {
      return res.status(404).json({
        success: false,
        error: 'Place not found',
      });
    }

    const placeData = place.toJSON() as TripPlace;
    
    // Verify trip exists and user has permission
    const trip = await TripModel.findById(placeData.tripId);
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const tripData = trip.toJSON();
    // Check if user is creator or accepted participant
    if (tripData.creatorId !== uid && 
        !tripData.participants?.some((p: any) => 
          p.uid === uid && 
          !p.isGuest && 
          (p.status === 'accepted' || p.status === undefined)
        )) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this place',
      });
    }

    // If deleting a place, we may need to update the next place's distance/time
    // Get all places for the trip to find the next one
    const allPlacesDocs = await TripPlaceModel.find({ tripId: placeData.tripId });
    const allPlaces = allPlacesDocs
      .map((doc) => doc.toJSON() as TripPlace)
      .filter((p) => p.placeId !== placeId);
    
    // Sort by visitedAt
    allPlaces.sort((a, b) => {
      const aTime = new Date(a.visitedAt).getTime();
      const bTime = new Date(b.visitedAt).getTime();
      return aTime - bTime;
    });

    // Find the place that was before the deleted one
    const deletedTime = new Date(placeData.visitedAt).getTime();
    const previousPlace = allPlaces
      .filter((p) => new Date(p.visitedAt).getTime() < deletedTime)
      .sort((a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime())[0];
    
    // Find the place that was after the deleted one
    const nextPlace = allPlaces
      .filter((p) => new Date(p.visitedAt).getTime() > deletedTime)
      .sort((a, b) => new Date(a.visitedAt).getTime() - new Date(b.visitedAt).getTime())[0];

    // Delete the place
    await TripPlaceModel.findByIdAndDelete(placeId);

    // If there's a next place and a previous place, update next place's distance from previous
    if (nextPlace && previousPlace) {
      const newDistance = calculateDistance(
        previousPlace.coordinates.lat,
        previousPlace.coordinates.lng,
        nextPlace.coordinates.lat,
        nextPlace.coordinates.lng
      );
      
      const nextPlaceDoc = await TripPlaceModel.findById(nextPlace.placeId);
      if (nextPlaceDoc) {
        nextPlaceDoc.distanceFromPrevious = newDistance;
        nextPlaceDoc.timeFromPrevious = undefined;
        nextPlaceDoc.modeOfTravel = undefined;
        (nextPlaceDoc as any).updatedAt = new Date();
        await nextPlaceDoc.save();
      }
    } else if (nextPlace && !previousPlace) {
      // If this was the first place, clear the next place's distance/time
      const nextPlaceDoc = await TripPlaceModel.findById(nextPlace.placeId);
      if (nextPlaceDoc) {
        nextPlaceDoc.distanceFromPrevious = undefined;
        nextPlaceDoc.timeFromPrevious = undefined;
        nextPlaceDoc.modeOfTravel = undefined;
        (nextPlaceDoc as any).updatedAt = new Date();
        await nextPlaceDoc.save();
      }
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

    const place = await TripPlaceModel.findById(placeId);
    if (!place) {
      return res.status(404).json({
        success: false,
        error: 'Place not found',
      });
    }

    const placeData = place.toJSON() as TripPlace;
    
    // Verify trip exists and user has permission
    const trip = await TripModel.findById(placeData.tripId);
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const tripData = trip.toJSON();
    // Check if user is creator or accepted participant
    if (tripData.creatorId !== uid && 
        !tripData.participants?.some((p: any) => 
          p.uid === uid && 
          !p.isGuest && 
          (p.status === 'accepted' || p.status === undefined)
        )) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this place',
      });
    }

    // Apply updates
    if (updates.name !== undefined) place.name = updates.name;
    if (updates.coordinates !== undefined) place.coordinates = updates.coordinates;
    if (updates.visitedAt !== undefined) place.visitedAt = updates.visitedAt instanceof Date ? updates.visitedAt : new Date(updates.visitedAt);
    if (updates.rating !== undefined) place.rating = updates.rating;
    if (updates.comment !== undefined) place.comment = updates.comment;
    if (updates.rewrittenComment !== undefined) place.rewrittenComment = updates.rewrittenComment;
    if (updates.modeOfTravel !== undefined) place.modeOfTravel = updates.modeOfTravel || null;
    if (updates.distanceFromPrevious !== undefined) place.distanceFromPrevious = updates.distanceFromPrevious;
    if (updates.timeFromPrevious !== undefined) place.timeFromPrevious = updates.timeFromPrevious || undefined;
    if (updates.images !== undefined) place.images = updates.images;
    if (updates.imageMetadata !== undefined) place.imageMetadata = updates.imageMetadata;
    
    (place as any).updatedAt = new Date();
    const updatedPlace = await place.save();

    res.json({
      success: true,
      data: updatedPlace.toJSON() as TripPlace,
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

    const place = await TripPlaceModel.findById(placeId);
    if (!place) {
      return res.status(404).json({
        success: false,
        error: 'Place not found',
      });
    }

    const placeData = place.toJSON() as TripPlace;
    
    // Check if trip is public or user has access
    const trip = await TripModel.findById(placeData.tripId);
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const tripData = trip.toJSON();
    
    // Allow comments if trip is public, or if user is creator/participant
    if (!tripData.isPublic) {
      if (tripData.creatorId !== uid && 
          !tripData.participants?.some((p: any) => 
            p.uid === uid && 
            !p.isGuest && 
            (p.status === 'accepted' || p.status === undefined)
          )) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to comment on this place',
        });
      }
    }

    // Create comment
    const commentDoc = new PlaceCommentModel({
      placeId,
      userId: uid,
      text: text.trim(),
      createdAt: new Date(),
    });
    const savedComment = await commentDoc.save();
    const comment = savedComment.toJSON() as PlaceComment;

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

    const place = await TripPlaceModel.findById(placeId);
    if (!place) {
      return res.status(404).json({
        success: false,
        error: 'Place not found',
      });
    }

    const placeData = place.toJSON() as TripPlace;
    
    // Check if trip is public or user has access
    const trip = await TripModel.findById(placeData.tripId);
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const tripData = trip.toJSON();
    
    // Allow viewing comments if trip is public, or if user is authenticated and has access
    if (!tripData.isPublic) {
      if (!req.uid) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }
      if (tripData.creatorId !== req.uid && 
          !tripData.participants?.some((p: any) => 
            p.uid === req.uid && 
            !p.isGuest && 
            (p.status === 'accepted' || p.status === undefined)
          )) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to view comments',
        });
      }
    }

    // Get all comments for this place
    const commentsDocs = await PlaceCommentModel.find({ placeId }).sort({ createdAt: -1 });
    const comments = commentsDocs.map(doc => doc.toJSON() as PlaceComment);

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

    const place = await TripPlaceModel.findById(placeId);
    if (!place) {
      return res.status(404).json({
        success: false,
        error: 'Place not found',
      });
    }

    const placeData = place.toJSON() as TripPlace;
    
    // Check if trip is public or user has access
    const trip = await TripModel.findById(placeData.tripId);
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const tripData = trip.toJSON();
    
    // Allow likes if trip is public, or if user is creator/participant
    if (!tripData.isPublic) {
      if (tripData.creatorId !== uid && 
          !tripData.participants?.some((p: any) => 
            p.uid === uid && 
            !p.isGuest && 
            (p.status === 'accepted' || p.status === undefined)
          )) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to like this place',
        });
      }
    }

    // Check if already liked
    const existingLike = await PlaceLikeModel.findOne({ placeId, userId: uid });

    if (existingLike) {
      return res.json({
        success: true,
        data: { liked: true, message: 'Already liked' },
      });
    }

    // Add like
    await PlaceLikeModel.create({
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

    // Find and delete like
    const like = await PlaceLikeModel.findOneAndDelete({ placeId, userId: uid });

    if (!like) {
      return res.json({
        success: true,
        data: { liked: false, message: 'Not liked' },
      });
    }

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

    // Get all likes for this place
    const likes = await PlaceLikeModel.find({ placeId });

    const likeCount = likes.length;
    const isLiked = uid ? likes.some(like => like.userId === uid) : false;

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

