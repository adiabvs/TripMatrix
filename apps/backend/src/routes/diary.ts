import express from 'express';
import { getFirestore } from '../config/firebase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { toDate } from '../utils/dateUtils.js';
import type { Trip, TripPlace, TravelDiary } from '@tripmatrix/types';

const router = express.Router();

function getDb() {
  return getFirestore();
}

// Generate travel diary for a completed trip
router.post('/generate/:tripId', async (req: AuthenticatedRequest, res) => {
  try {
    const { tripId } = req.params;
    const uid = req.uid!;

    const db = getDb();
    
    // Get trip
    const tripDoc = await db.collection('trips').doc(tripId).get();
    if (!tripDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const tripData = tripDoc.data() as any;
    
    if (!tripData) {
      return res.status(404).json({
        success: false,
        error: 'Trip data not found',
      });
    }
    
    // Convert Firestore Timestamps to Date objects
    const trip: Trip = {
      ...tripData,
      tripId: tripDoc.id,
      startTime: toDate(tripData.startTime),
      endTime: tripData.endTime ? toDate(tripData.endTime) : undefined,
      createdAt: tripData.createdAt ? toDate(tripData.createdAt) : new Date(),
      updatedAt: tripData.updatedAt ? toDate(tripData.updatedAt) : new Date(),
    };
    
    // Check authorization
    if (trip.creatorId !== uid && !trip.participants?.some((p: any) => p.uid === uid)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to generate diary for this trip',
      });
    }

    // Check if trip is completed
    if (trip.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Trip must be completed before generating a diary',
      });
    }

    // Get places
    const placesSnapshot = await db.collection('tripPlaces')
      .where('tripId', '==', tripId)
      .get();
    
    const places = placesSnapshot.docs.map((doc) => {
      const placeData = doc.data() as any;
      if (!placeData) {
        throw new Error(`Place data not found for ${doc.id}`);
      }
      return {
        placeId: doc.id,
        ...placeData,
        visitedAt: toDate(placeData.visitedAt),
        createdAt: placeData.createdAt ? toDate(placeData.createdAt) : new Date(),
      };
    }) as TripPlace[];

    if (places.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Trip has no places to include in diary',
      });
    }

    // Create diary record - user will create/edit in Adobe Express editor
    const diaryData: any = {
      tripId,
      title: trip.title,
      description: trip.description || null,
      coverImageUrl: trip.coverImage || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const diaryRef = await db.collection('travelDiaries').add(diaryData);
    
    const diary: TravelDiary = {
      diaryId: diaryRef.id,
      ...diaryData,
    };

    res.json({
      success: true,
      data: diary,
    });
  } catch (error: any) {
    console.error('Failed to generate diary:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate travel diary',
    });
  }
});

// Get diary for a trip
router.get('/trip/:tripId', async (req: AuthenticatedRequest, res) => {
  try {
    const { tripId } = req.params;
    const uid = req.uid!;

    const db = getDb();
    
    // Verify trip access
    const tripDoc = await db.collection('trips').doc(tripId).get();
    if (!tripDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = tripDoc.data() as Trip;
    
    if (trip.creatorId !== uid && !trip.participants?.some((p: any) => p.uid === uid)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized',
      });
    }

    // Get diary
    const diarySnapshot = await db.collection('travelDiaries')
      .where('tripId', '==', tripId)
      .limit(1)
      .get();

    if (diarySnapshot.empty) {
      return res.status(404).json({
        success: false,
        error: 'Diary not found',
      });
    }

    const diary = {
      diaryId: diarySnapshot.docs[0].id,
      ...diarySnapshot.docs[0].data(),
    } as TravelDiary;

    res.json({
      success: true,
      data: diary,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Generate video for diary
router.post('/:diaryId/video', async (req: AuthenticatedRequest, res) => {
  try {
    const { diaryId } = req.params;
    const uid = req.uid!;

    const db = getDb();
    const diaryDoc = await db.collection('travelDiaries').doc(diaryId).get();
    
    if (!diaryDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Diary not found',
      });
    }

    const diary = diaryDoc.data() as TravelDiary;
    
    // Verify trip access
    const tripDoc = await db.collection('trips').doc(diary.tripId).get();
    if (!tripDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = tripDoc.data() as Trip;
    
    if (trip.creatorId !== uid && !trip.participants?.some((p: any) => p.uid === uid)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized',
      });
    }

    // Video generation placeholder - not yet implemented
    return res.status(501).json({
      success: false,
      error: 'Video generation not yet implemented',
    });

    // Video generation placeholder - not yet implemented
    return res.status(501).json({
      success: false,
      error: 'Video generation not yet implemented',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Update diary (for Adobe Express editing)
router.patch('/:diaryId', async (req: AuthenticatedRequest, res) => {
  try {
    const { diaryId } = req.params;
    const { adobeExpressDesignId, adobeExpressEditorUrl, videoUrl } = req.body;
    const uid = req.uid!;

    const db = getDb();
    const diaryDoc = await db.collection('travelDiaries').doc(diaryId).get();
    
    if (!diaryDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Diary not found',
      });
    }

    const diary = diaryDoc.data() as TravelDiary;
    
    // Verify trip access
    const tripDoc = await db.collection('trips').doc(diary.tripId).get();
    if (!tripDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = tripDoc.data() as Trip;
    
    if (trip.creatorId !== uid && !trip.participants?.some((p: any) => p.uid === uid)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized',
      });
    }

    const updateData: any = { updatedAt: new Date() };
    if (adobeExpressDesignId !== undefined && adobeExpressDesignId !== null) updateData.adobeExpressDesignId = adobeExpressDesignId;
    if (adobeExpressEditorUrl !== undefined && adobeExpressEditorUrl !== null) updateData.adobeExpressEditorUrl = adobeExpressEditorUrl;
    if (videoUrl !== undefined && videoUrl !== null) updateData.videoUrl = videoUrl;

    await db.collection('travelDiaries').doc(diaryId).update(updateData);

    const updatedDiary: TravelDiary = {
      ...diary,
      ...updateData,
    };

    res.json({
      success: true,
      data: updatedDiary,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

