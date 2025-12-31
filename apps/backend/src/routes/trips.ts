import express from 'express';
import { OptionalAuthRequest } from '../middleware/optionalAuth.js';
import type { Trip, TripParticipant, TripPlace, TripComment } from '@tripmatrix/types';
import { TripModel } from '../models/Trip.js';
import { TripPlaceModel } from '../models/TripPlace.js';
import { TripExpenseModel } from '../models/TripExpense.js';
import { TripRouteModel } from '../models/TripRoute.js';
import { TripLikeModel } from '../models/TripLike.js';
import { PlaceCommentModel } from '../models/PlaceComment.js';
import { TripCommentModel } from '../models/TripComment.js';
import { UserModel } from '../models/User.js';
import { NotificationModel } from '../models/Notification.js';
import { isMongoDBConnected } from '../config/mongodb.js';
import mongoose from 'mongoose';

const router = express.Router();

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

    // Process participants to ensure proper format and status
    const processedParticipants: TripParticipant[] = tripParticipants.map((p: any) => {
      if (typeof p === 'string') {
        // Check if it's a uid (starts with alphanumeric, no spaces)
        if (/^[a-zA-Z0-9]+$/.test(p)) {
          // For non-creator users, set status to pending
          return { uid: p, isGuest: false, status: p === uid ? 'accepted' : 'pending' };
        } else {
          return { guestName: p, isGuest: true };
        }
      }
      // If already a participant object, ensure status is set
      if (p.uid && p.uid !== uid && !p.status) {
        return { ...p, status: 'pending' };
      }
      if (p.uid === uid) {
        return { ...p, status: 'accepted' };
      }
      return p;
    });

    // Build trip data, excluding undefined values
    const tripData: any = {
      creatorId: uid,
      title,
      description: description || '',
      participants: processedParticipants,
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

    const tripDoc = new TripModel(tripData);
    const savedTrip = await tripDoc.save();
    
    const trip: Trip = savedTrip.toJSON() as Trip;

    // Get creator info for notification
    const creator = await UserModel.findOne({ uid });
    const creatorName = creator?.name || 'Someone';

    // Create notifications for participants (excluding creator)
    const participantsToNotify = processedParticipants
      .filter((p) => p.uid && p.uid !== uid && !p.isGuest)
      .map((p) => p.uid!);

    if (participantsToNotify.length > 0) {
      console.log(`Creating notifications for ${participantsToNotify.length} users during trip creation:`, participantsToNotify);
      const notificationPromises = participantsToNotify.map(async (userId) => {
        try {
          // Validate userId is a string and not empty
          if (!userId || typeof userId !== 'string') {
            console.error(`Invalid userId for notification: ${userId}`);
            return;
          }

          // Check if there's already an unread notification for this trip invitation to avoid duplicates
          const existingUnreadNotification = await NotificationModel.findOne({
            userId: userId.trim(),
            tripId: trip.tripId,
            type: 'trip_invitation',
            isRead: false,
          });

          // Only create notification if there's no existing unread one
          if (!existingUnreadNotification) {
            const notification = new NotificationModel({
              userId: userId.trim(),
              type: 'trip_invitation',
              title: 'Trip Invitation',
              message: `${creatorName} invited you to join "${title}"`,
              tripId: trip.tripId,
              fromUserId: uid,
              isRead: false,
            });
            const savedNotification = await notification.save();
            console.log(`✅ Notification created for user ${userId} for trip ${trip.tripId}`, savedNotification.toJSON());
          } else {
            console.log(`⏭️  Skipping notification for user ${userId} - unread notification already exists for trip ${trip.tripId}`);
          }
        } catch (error: any) {
          // Log error but don't fail the entire request
          console.error(`❌ Failed to create notification for user ${userId} for trip ${trip.tripId}:`, error.message || error);
        }
      });
      await Promise.all(notificationPromises);
      console.log(`Completed notification creation for new trip ${trip.tripId}`);
    } else {
      console.log(`No notifications to create for new trip ${trip.tripId}`);
    }

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

// Search trips by user, place, or keyword - MUST be before /:tripId route
router.get('/search', async (req: OptionalAuthRequest, res) => {
  try {
    const { q, type, limit = '20', lastTripId } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required',
      });
    }

    const searchType = type || 'all'; // 'user', 'place', 'trip', 'all'
    const searchLower = q.toLowerCase();
    let trips: Trip[] = [];
    let users: any[] = [];

    if (searchType === 'user' || searchType === 'all') {
      // Escape special regex characters for safe searching
      const escapedQuery = searchLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Search by user name, email, or username (case-insensitive contains)
      const usersDocs = await UserModel.find({
        $or: [
          { name: { $regex: escapedQuery, $options: 'i' } },
          { email: { $regex: escapedQuery, $options: 'i' } },
          { username: { $regex: escapedQuery, $options: 'i' } }
        ]
      }).limit(10);
      
      users = usersDocs.map(doc => doc.toJSON());
      
      const userIds = users.map(user => user.uid || user._id?.toString());
      
      if (userIds.length > 0) {
        // Get trips by these users
        const tripQuery: any = {
          creatorId: { $in: userIds },
          isPublic: true
        };
        
        const tripsDocs = await TripModel.find(tripQuery);
        const userTrips = tripsDocs.map(doc => doc.toJSON() as Trip);
        trips.push(...userTrips);
      }
    }

    if (searchType === 'trip' || searchType === 'all') {
      // Escape special regex characters for safe searching
      const escapedQuery = searchLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Search by trip title/description (case-insensitive contains)
      const tripQuery: any = {
        isPublic: true,
        $or: [
          { title: { $regex: escapedQuery, $options: 'i' } },
          { description: { $regex: escapedQuery, $options: 'i' } }
        ]
      };
      
      const tripsDocs = await TripModel.find(tripQuery);
      const matchingTrips = tripsDocs.map(doc => doc.toJSON() as Trip);
      trips.push(...matchingTrips);
      
      // Also search by participants (members in trip)
      // First find users matching the search query
      const matchingUsers = await UserModel.find({
        $or: [
          { name: { $regex: escapedQuery, $options: 'i' } },
          { email: { $regex: escapedQuery, $options: 'i' } },
          { username: { $regex: escapedQuery, $options: 'i' } }
        ]
      });
      
      const matchingUserIds = matchingUsers.map(u => u.uid || u._id?.toString()).filter(Boolean);
      
      if (matchingUserIds.length > 0) {
        // Find trips where these users are participants
        const participantTripsDocs = await TripModel.find({
          isPublic: true,
          'participants.uid': { $in: matchingUserIds }
        });
        
        const participantTrips = participantTripsDocs.map(doc => doc.toJSON() as Trip);
        trips.push(...participantTrips);
      }
    }

    if (searchType === 'place' || searchType === 'all') {
      // Escape special regex characters for safe searching
      const escapedQuery = searchLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Search by place name (case-insensitive contains)
      const placesDocs = await TripPlaceModel.find({
        name: { $regex: escapedQuery, $options: 'i' }
      }).limit(50);
      
      const tripIds = [...new Set(placesDocs.map(doc => doc.tripId).filter(Boolean))];
      
      if (tripIds.length > 0) {
        // Convert string tripIds to ObjectIds for querying
        const objectIds = tripIds
          .map(id => {
            try {
              return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
            } catch {
              return null;
            }
          })
          .filter((id): id is mongoose.Types.ObjectId => id !== null);
        
        if (objectIds.length > 0) {
          const tripQuery: any = {
            _id: { $in: objectIds },
            isPublic: true
          };
          
          const tripsDocs = await TripModel.find(tripQuery);
          const placeTrips = tripsDocs.map(doc => doc.toJSON() as Trip);
          trips.push(...placeTrips);
        }
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

    const limitNum = parseInt(limit as string, 10) || 20;
    const hasMore = paginatedTrips.length > limitNum;
    const finalTrips = hasMore ? paginatedTrips.slice(0, limitNum) : paginatedTrips;

    res.json({
      success: true,
      data: {
        trips: finalTrips,
        users,
        hasMore,
        lastTripId: hasMore && finalTrips.length > 0
          ? finalTrips[finalTrips.length - 1].tripId 
          : null
      }
    });
  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search trips',
    });
  }
});

// Get trip by ID (public access for public trips)
router.get('/:tripId', async (req: OptionalAuthRequest, res) => {
  try {
    const { tripId } = req.params;
    const trip = await TripModel.findById(tripId);

    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const tripData = trip.toJSON() as Trip;
    
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

    res.json({ success: true, data: tripData });
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

    // Query trips where user is creator
    const creatorTripsDocs = await TripModel.find({ creatorId: uid });
    const creatorTrips = creatorTripsDocs.map(doc => doc.toJSON() as Trip);

    // Get all trips and filter for participant trips (in memory)
    // This is necessary since participants is an array of objects
    const allTripsDocs = await TripModel.find({});
    const allTrips = allTripsDocs.map(doc => doc.toJSON() as Trip);

    // Filter trips where user is a participant (not creator, already included)
    const participantTrips = allTrips.filter((trip) => {
      // Skip if already included as creator
      if (trip.creatorId === uid) return false;
      // Check if user is in participants array
      return trip.participants?.some((p: any) => p.uid === uid);
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

    const trip = await TripModel.findById(tripId);

    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const tripData = trip.toJSON() as Trip;
    
    // Check if user is creator or participant
    if (tripData.creatorId !== uid && !tripData.participants.some((p) => p.uid === uid)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to add participants',
      });
    }

    // Get creator info for notification
    const creator = await UserModel.findOne({ uid: tripData.creatorId });
    const creatorName = creator?.name || 'Someone';

    // Process participants (can be uids or guest names)
    const newParticipants: TripParticipant[] = participants.map((p: string | TripParticipant) => {
      if (typeof p === 'string') {
        // Check if it's a uid (starts with alphanumeric, no spaces)
        if (/^[a-zA-Z0-9]+$/.test(p)) {
          // For non-creator users, set status to pending
          return { uid: p, isGuest: false, status: p === tripData.creatorId ? 'accepted' : 'pending' };
        } else {
          return { guestName: p, isGuest: true };
        }
      }
      // If already a participant object, ensure status is set
      if (p.uid && p.uid !== tripData.creatorId && !p.status) {
        return { ...p, status: 'pending' };
      }
      return p;
    });

    // Merge with existing participants
    const existingUids = new Set(tripData.participants.map((p) => p.uid).filter(Boolean));
    const existingGuests = new Set(tripData.participants.map((p) => p.guestName).filter(Boolean));
    
    const mergedParticipants = [...tripData.participants];
    const newUserParticipants: string[] = [];
    
    newParticipants.forEach((newP) => {
      if (newP.uid && !existingUids.has(newP.uid)) {
        mergedParticipants.push(newP);
        existingUids.add(newP.uid);
        // Track new user participants for notifications (ALWAYS create notification regardless of profile privacy)
        // Only add if not the creator
        if (newP.uid && newP.uid !== tripData.creatorId) {
          newUserParticipants.push(newP.uid);
          console.log(`Added ${newP.uid} to notification list (new participant)`);
        }
      } else if (newP.guestName && !existingGuests.has(newP.guestName)) {
        mergedParticipants.push(newP);
        existingGuests.add(newP.guestName);
      } else if (newP.uid && existingUids.has(newP.uid)) {
        // If participant already exists, update status to pending if needed
        const existingIndex = mergedParticipants.findIndex(p => p.uid === newP.uid);
        if (existingIndex >= 0 && newP.uid && newP.uid !== tripData.creatorId) {
          // Update status to pending if not already accepted
          if (mergedParticipants[existingIndex].status !== 'accepted') {
            mergedParticipants[existingIndex].status = 'pending';
            // Create notification if not already sent (check if notification exists)
            if (!newUserParticipants.includes(newP.uid)) {
              newUserParticipants.push(newP.uid);
              console.log(`Added ${newP.uid} to notification list (existing participant, status updated)`);
            }
          }
        }
      }
    });
    
    console.log(`Total users to notify: ${newUserParticipants.length}`, newUserParticipants);

    trip.participants = mergedParticipants;
    trip.updatedAt = new Date();
    await trip.save();

    // Create notifications for new user participants
    // Always create notifications for new invitations (even if user was previously invited)
    if (newUserParticipants.length > 0) {
      console.log(`Creating notifications for ${newUserParticipants.length} users:`, newUserParticipants);
      const notificationPromises = newUserParticipants.map(async (userId) => {
        try {
          // Validate userId is a string and not empty
          if (!userId || typeof userId !== 'string') {
            console.error(`Invalid userId for notification: ${userId}`);
            return;
          }
          
          // Check if there's already an unread notification for this trip invitation to avoid duplicates
          const existingUnreadNotification = await NotificationModel.findOne({
            userId: userId.trim(),
            tripId: tripId,
            type: 'trip_invitation',
            isRead: false,
          });
          
          // Only create notification if there's no existing unread one
          if (!existingUnreadNotification) {
            const notification = new NotificationModel({
              userId: userId.trim(),
              type: 'trip_invitation',
              title: 'Trip Invitation',
              message: `${creatorName} invited you to join "${tripData.title}"`,
              tripId: tripId,
              fromUserId: uid,
              isRead: false,
            });
            const savedNotification = await notification.save();
            console.log(`✅ Notification created for user ${userId} for trip ${tripId}`, savedNotification.toJSON());
          } else {
            console.log(`⏭️  Skipping notification for user ${userId} - unread notification already exists for trip ${tripId}`);
          }
        } catch (error: any) {
          // Log error but don't fail the entire request
          console.error(`❌ Failed to create notification for user ${userId} for trip ${tripId}:`, error.message || error);
        }
      });
      await Promise.all(notificationPromises);
      console.log(`Completed notification creation for trip ${tripId}`);
    } else {
      console.log(`No notifications to create for trip ${tripId}`);
    }

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

// Remove participants from trip
router.delete('/:tripId/participants', async (req: OptionalAuthRequest, res) => {
  try {
    if (!req.uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    const { tripId } = req.params;
    const { participants } = req.body; // Array of uids or guestNames to remove
    const uid = req.uid;

    const trip = await TripModel.findById(tripId);

    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const tripData = trip.toJSON() as Trip;
    
    // Check if user is creator or participant
    if (tripData.creatorId !== uid && !tripData.participants.some((p) => p.uid === uid)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to remove participants',
      });
    }

    // Don't allow removing the creator
    const participantsToRemove = Array.isArray(participants) ? participants : [];
    const filteredParticipants = tripData.participants.filter((p) => {
      // Keep creator
      if (p.uid === tripData.creatorId && !p.isGuest) {
        return true;
      }
      // Remove if matches any in the removal list
      return !participantsToRemove.some((removeId: string) => {
        return (p.uid === removeId) || (p.guestName === removeId);
      });
    });

    trip.participants = filteredParticipants;
    trip.updatedAt = new Date();
    await trip.save();

    res.json({
      success: true,
      data: { participants: filteredParticipants },
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

    const trip = await TripModel.findById(tripId);

    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const tripData = trip.toJSON() as Trip;
    
    // Check authorization - allow creator or participants to edit
    const isCreator = tripData.creatorId === uid;
    const isParticipant = tripData.participants?.some((p) => p.uid === uid);
    
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

    // Apply updates
    Object.keys(updates).forEach((key) => {
      const value = updates[key as keyof typeof updates];
      if (value !== undefined) {
        (trip as any)[key] = value;
      }
    });

    trip.updatedAt = new Date();
    const updatedTrip = await trip.save();

    res.json({
      success: true,
      data: updatedTrip.toJSON() as Trip,
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

    const trip = await TripModel.findById(tripId);

    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const tripData = trip.toJSON() as Trip;

    // Check authorization - only creator can delete
    if (tripData.creatorId !== uid) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this trip',
      });
    }

    // Get all places for this trip to collect image URLs
    const placesDocs = await TripPlaceModel.find({ tripId });
    const places = placesDocs.map(doc => doc.toJSON() as TripPlace);
    
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

    // Delete all related data including notifications
    const deleteResults = await Promise.all([
      TripPlaceModel.deleteMany({ tripId }),
      TripExpenseModel.deleteMany({ tripId }),
      TripRouteModel.deleteMany({ tripId }),
      TripLikeModel.deleteMany({ tripId }),
      NotificationModel.deleteMany({ tripId }), // Delete all notifications for this trip (read and unread)
    ]);

    const notificationDeleteResult = deleteResults[4];
    console.log(`Deleted ${notificationDeleteResult.deletedCount} notifications for trip ${tripId}`);

    // Delete trip
    await TripModel.findByIdAndDelete(tripId);

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
    const tripsDocs = await TripModel.find({ isPublic: true }).sort({ createdAt: -1 });
    let trips = tripsDocs.map(doc => doc.toJSON() as Trip);

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

    // Already sorted by createdAt in query

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
    // Check MongoDB connection
    if (!isMongoDBConnected() && mongoose.connection.readyState !== 1) {
      console.error('MongoDB not connected. ReadyState:', mongoose.connection.readyState);
      return res.status(503).json({
        success: false,
        error: 'Database connection not available. Please try again later.',
      });
    }
    
    const { limit = '20', lastTripId } = req.query;
    
    // Get user's followed list if authenticated
    let followedUserIds: string[] = [];
    if (req.uid) {
      try {
        const user = await UserModel.findOne({ uid: req.uid });
        if (user) {
          followedUserIds = user.follows || [];
        }
      } catch (error) {
        console.error('Error fetching user for followed list:', error);
        // Continue without followed list
      }
    }
    
    // Get all public trips
    const tripsDocs = await TripModel.find({ isPublic: true }).sort({ createdAt: -1 });
    let trips = tripsDocs.map((doc: any) => {
      try {
        return doc.toJSON() as Trip;
      } catch (error) {
        console.error('Error converting trip to JSON:', error);
        return null;
      }
    }).filter((trip): trip is Trip => trip !== null);

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

    const tripIds = trips.map(t => t.tripId).filter(Boolean);
    
    // Batch fetch all places for all trips
    const placesPromises = tripIds.map(async (tripId) => {
      try {
        const placesDocs = await TripPlaceModel.find({ tripId: tripId.toString() });
        return placesDocs.map(doc => doc.toJSON());
      } catch (error) {
        console.error(`Error fetching places for trip ${tripId}:`, error);
        return [];
      }
    });

    // Batch fetch all routes for all trips
    const routesPromises = tripIds.map(async (tripId) => {
      try {
        const routesDocs = await TripRouteModel.find({ tripId: tripId.toString() });
        return routesDocs.map(doc => doc.toJSON());
      } catch (error) {
        console.error(`Error fetching routes for trip ${tripId}:`, error);
        return [];
      }
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
        const creator = await UserModel.findOne({ uid: creatorId.toString() });
        if (creator) {
          return { uid: creatorId, user: creator.toJSON() };
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
    const nextLastTripId = hasMore && trips.length > 0 ? trips[trips.length - 1].tripId : null;

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
    console.error('Error in /public/list/with-data:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
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

    const trip = await TripModel.findById(tripId);

    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const tripData = trip.toJSON() as Trip;
    
    // Check if trip is public or user has access
    if (!tripData.isPublic) {
      if (tripData.creatorId !== uid && 
          !tripData.participants?.some((p) => p.uid === uid)) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to like this trip',
        });
      }
    }

    // Check if already liked
    const existingLike = await TripLikeModel.findOne({ tripId, userId: uid });

    if (existingLike) {
      return res.json({
        success: true,
        data: { liked: true, message: 'Already liked' },
      });
    }

    // Add like
    await TripLikeModel.create({
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

    // Find and delete like
    const like = await TripLikeModel.findOneAndDelete({ tripId, userId: uid });

    if (!like) {
      return res.json({
        success: true,
        data: { liked: false, message: 'Not liked' },
      });
    }

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

    // Verify trip exists
    const trip = await TripModel.findById(tripId);
    if (!trip) {
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
      const likes = await TripLikeModel.find({ tripId });
      likeCount = likes.length;
      isLiked = uid ? likes.some(like => like.userId === uid) : false;
    } catch (queryError: any) {
      // If query fails, return defaults
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

    // Verify trip exists
    const trip = await TripModel.findById(tripId);
    if (!trip) {
      return res.json({
        success: true,
        data: { commentCount: 0 },
      });
    }

    // Get all comments for places in this trip
    const placesDocs = await TripPlaceModel.find({ tripId });
    const placeIds = placesDocs.map(doc => doc._id.toString());
    
    if (placeIds.length === 0) {
      return res.json({
        success: true,
        data: { commentCount: 0 },
      });
    }

    // Get comment count for all places in this trip
    let totalCommentCount = 0;
    
    try {
      const comments = await PlaceCommentModel.find({ placeId: { $in: placeIds } });
      totalCommentCount = comments.length;
    } catch (queryError: any) {
      // If query fails, return 0
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

// Add a comment to a trip
router.post('/:tripId/comments', async (req: OptionalAuthRequest, res) => {
  try {
    const { tripId } = req.params;
    const { text } = req.body;
    
    if (!req.uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    const uid = req.uid;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Comment text is required',
      });
    }

    // Verify trip exists
    const trip = await TripModel.findById(tripId);
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
          !tripData.participants?.some((p: any) => p.uid === uid)) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to comment on this trip',
        });
      }
    }

    // Create comment
    const commentDoc = new TripCommentModel({
      tripId,
      userId: uid,
      text: text.trim(),
      createdAt: new Date(),
    });
    const savedComment = await commentDoc.save();
    const comment = savedComment.toJSON() as TripComment;

    // Find mentioned users and create notifications
    const { findMentionedUsers } = await import('../utils/mentionUtils.js');
    const mentionedUserIds = await findMentionedUsers(text.trim());
    
    // Filter out the comment author and create notifications for mentioned users
    const mentionedUsersToNotify = mentionedUserIds.filter(userId => userId !== uid);
    
    if (mentionedUsersToNotify.length > 0) {
      const commentAuthor = await UserModel.findOne({ uid });
      const authorName = commentAuthor?.name || 'Someone';
      
      const notificationPromises = mentionedUsersToNotify.map(async (mentionedUserId) => {
        try {
          if (!mentionedUserId || typeof mentionedUserId !== 'string') {
            console.warn(`Invalid userId found in mentionedUsersToNotify: ${mentionedUserId}. Skipping notification.`);
            return null;
          }
          
          // Check if there's already an unread notification for this mention to avoid duplicates
          const existingUnreadNotification = await NotificationModel.findOne({
            userId: mentionedUserId.trim(),
            tripId: tripId,
            type: 'comment_mention',
            fromUserId: uid,
            isRead: false,
          });

          if (!existingUnreadNotification) {
            const notification = new NotificationModel({
              userId: mentionedUserId.trim(),
              type: 'comment_mention',
              title: 'You were mentioned in a comment',
              message: `${authorName} mentioned you in a comment on "${tripData.title}"`,
              tripId: tripId,
              commentId: comment.commentId,
              fromUserId: uid,
              isRead: false,
            });
            await notification.save();
            console.log(`Notification created for mentioned user ${mentionedUserId.trim()} in trip ${tripId} for comment ${comment.commentId}`);
          } else {
            console.log(`Skipping notification for user ${mentionedUserId.trim()} - unread mention notification already exists`);
          }
        } catch (error: any) {
          console.error(`Error creating mention notification for user ${mentionedUserId} in trip ${tripId}:`, error.message || error);
        }
        return null;
      });
      
      await Promise.all(notificationPromises);
      console.log(`Completed mention notification creation for trip ${tripId}`);
    }

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

// Get comments for a trip
router.get('/:tripId/comments', async (req: OptionalAuthRequest, res) => {
  try {
    const { tripId } = req.params;

    // Verify trip exists
    const trip = await TripModel.findById(tripId);
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
          !tripData.participants?.some((p: any) => p.uid === req.uid)) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to view comments',
        });
      }
    }

    // Get all comments for this trip
    const commentsDocs = await TripCommentModel.find({ tripId }).sort({ createdAt: -1 });
    const comments = commentsDocs.map(doc => doc.toJSON() as TripComment);

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

// Update a comment on a trip
router.put('/:tripId/comments/:commentId', async (req: OptionalAuthRequest, res) => {
  try {
    const { tripId, commentId } = req.params;
    const { text } = req.body;
    
    if (!req.uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    const uid = req.uid;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Comment text is required',
      });
    }

    // Find the comment
    const comment = await TripCommentModel.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found',
      });
    }

    // Verify comment belongs to the trip
    if (comment.tripId !== tripId) {
      return res.status(400).json({
        success: false,
        error: 'Comment does not belong to this trip',
      });
    }

    // Only the comment owner can edit
    if (comment.userId !== uid) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to edit this comment',
      });
    }

    // Update comment
    comment.text = text.trim();
    comment.updatedAt = new Date();
    await comment.save();

    const updatedComment = comment.toJSON() as TripComment;

    res.json({
      success: true,
      data: updatedComment,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Delete a comment from a trip
router.delete('/:tripId/comments/:commentId', async (req: OptionalAuthRequest, res) => {
  try {
    const { tripId, commentId } = req.params;
    
    if (!req.uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    const uid = req.uid;

    // Find the comment
    const comment = await TripCommentModel.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found',
      });
    }

    // Verify comment belongs to the trip
    if (comment.tripId !== tripId) {
      return res.status(400).json({
        success: false,
        error: 'Comment does not belong to this trip',
      });
    }

    // Only the comment owner can delete
    if (comment.userId !== uid) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this comment',
      });
    }

    // Delete comment
    await TripCommentModel.findByIdAndDelete(commentId);

    res.json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

