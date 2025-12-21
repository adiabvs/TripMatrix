import express from 'express';
import { getFirestore } from '../config/firebase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { toDate } from '../utils/dateUtils.js';
import type { Trip, TripPlace, TravelDiary } from '@tripmatrix/types';
import { getTravelDiaryDesignData } from '../services/canvaService.js';
import { generateTravelDiaryDesign } from '../services/canvaDesignGenerator.js';
import { refreshAccessToken } from '../services/canvaOAuthService.js';

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

    // Check if user has Canva OAuth token
    const tokenDoc = await getDb().collection('canvaTokens').doc(uid).get();

    if (!tokenDoc.exists) {
      return res.status(400).json({
        success: false,
        error: 'Canva not connected. Please connect your Canva account first by clicking "Connect with Canva" on the diary page.',
      });
    }

    let tokenData = tokenDoc.data()!;
    let accessToken = tokenData.accessToken;

    // Check if token expired and refresh if needed
    if (new Date(tokenData.expiresAt.toDate()) < new Date()) {
      if (tokenData.refreshToken) {
        try {
          const { getCanvaConfig } = await import('../services/canvaOAuthService.js');
          const config = getCanvaConfig();
          const newToken = await refreshAccessToken(config, tokenData.refreshToken);
          accessToken = newToken.access_token;
          
          await getDb().collection('canvaTokens').doc(uid).update({
            accessToken: newToken.access_token,
            refreshToken: newToken.refresh_token || tokenData.refreshToken,
            expiresAt: new Date(Date.now() + (newToken.expires_in * 1000)),
            updatedAt: new Date(),
          });
        } catch (refreshError: any) {
          await getDb().collection('canvaTokens').doc(uid).delete();
          return res.status(401).json({
            success: false,
            error: 'Canva token expired. Please reconnect your Canva account.',
          });
        }
      } else {
        return res.status(401).json({
          success: false,
          error: 'Canva token expired. Please reconnect your Canva account.',
        });
      }
    }

    // Sort places by visitedAt
    const sortedPlaces = [...places].sort((a, b) => {
      const aTime = a.visitedAt ? new Date(a.visitedAt).getTime() : 0;
      const bTime = b.visitedAt ? new Date(b.visitedAt).getTime() : 0;
      return aTime - bTime;
    });

    // Prepare design data for reference
    let designData;
    try {
      console.log('=== Preparing Canva design data ===');
      console.log('Trip:', trip.title);
      console.log('Places count:', sortedPlaces.length);
      
      designData = getTravelDiaryDesignData(trip, sortedPlaces);
      
      console.log('Canva design data prepared successfully:', {
        hasCover: !!designData.cover,
        pagesCount: designData.pages.length,
      });
    } catch (error: any) {
      console.error('Failed to prepare Canva design data:', error);
      return res.status(500).json({
        success: false,
        error: `Failed to prepare design data: ${error.message}`,
      });
    }

    // Generate Canva design with all content
    let canvaDesign;
    try {
      console.log('=== Generating Canva design with content ===');
      canvaDesign = await generateTravelDiaryDesign(accessToken, trip, sortedPlaces);
      console.log('Canva design generated successfully:', {
        designId: canvaDesign.designId,
        designUrl: canvaDesign.designUrl,
      });
    } catch (error: any) {
      console.error('Failed to generate Canva design:', error);
      return res.status(500).json({
        success: false,
        error: `Failed to generate Canva design: ${error.message}. Please try again or check your Canva connection.`,
      });
    }

    // Create diary record with Canva design
    const diaryData: any = {
      tripId,
      title: trip.title,
      description: trip.description || null,
      coverImageUrl: trip.coverImage || null,
      canvaDesignId: canvaDesign.designId,
      canvaDesignUrl: canvaDesign.designUrl,
      canvaEditorUrl: canvaDesign.editorUrl,
      designData, // Store the prepared design data for reference
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const diaryRef = await getDb().collection('travelDiaries').add(diaryData);
    
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

    // If designData is missing, regenerate it
    if (!diary.designData) {
      try {
        // Get places
        const placesSnapshot = await db.collection('tripPlaces')
          .where('tripId', '==', tripId)
          .get();
        
        const places = placesSnapshot.docs.map((doc) => {
          const placeData = doc.data() as any;
          return {
            placeId: doc.id,
            ...placeData,
            visitedAt: toDate(placeData.visitedAt),
            createdAt: placeData.createdAt ? toDate(placeData.createdAt) : new Date(),
          };
        }) as TripPlace[];

        // Sort places by visitedAt
        const sortedPlaces = [...places].sort((a, b) => {
          const aTime = a.visitedAt ? new Date(a.visitedAt).getTime() : 0;
          const bTime = b.visitedAt ? new Date(b.visitedAt).getTime() : 0;
          return aTime - bTime;
        });

        // Regenerate designData
        const designData = getTravelDiaryDesignData(trip, sortedPlaces);
        
        // Update diary with designData
        await db.collection('travelDiaries').doc(diary.diaryId).update({
          designData,
          updatedAt: new Date(),
        });

        diary.designData = designData;
      } catch (error: any) {
        console.error('Failed to regenerate designData:', error);
        // Continue without designData - user can still use Canva editor
      }
    }

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

// Regenerate design data for a diary
router.post('/:diaryId/regenerate-design-data', async (req: AuthenticatedRequest, res) => {
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

    // Get places
    const placesSnapshot = await db.collection('tripPlaces')
      .where('tripId', '==', diary.tripId)
      .get();
    
    const places = placesSnapshot.docs.map((doc) => {
      const placeData = doc.data() as any;
      return {
        placeId: doc.id,
        ...placeData,
        visitedAt: toDate(placeData.visitedAt),
        createdAt: placeData.createdAt ? toDate(placeData.createdAt) : new Date(),
      };
    }) as TripPlace[];

    // Sort places by visitedAt
    const sortedPlaces = [...places].sort((a, b) => {
      const aTime = a.visitedAt ? new Date(a.visitedAt).getTime() : 0;
      const bTime = b.visitedAt ? new Date(b.visitedAt).getTime() : 0;
      return aTime - bTime;
    });

    // Regenerate designData
    const designData = getTravelDiaryDesignData(trip, sortedPlaces);
    
    // Update diary with designData
    await db.collection('travelDiaries').doc(diaryId).update({
      designData,
      updatedAt: new Date(),
    });

    const updatedDiary: TravelDiary = {
      ...diary,
      designData,
      diaryId,
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

// Update diary (for Canva design updates)
router.patch('/:diaryId', async (req: AuthenticatedRequest, res) => {
  try {
    const { diaryId } = req.params;
    const { canvaDesignId, canvaDesignUrl, canvaEditorUrl, videoUrl } = req.body;
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
    if (canvaDesignId !== undefined && canvaDesignId !== null) updateData.canvaDesignId = canvaDesignId;
    if (canvaDesignUrl !== undefined && canvaDesignUrl !== null) updateData.canvaDesignUrl = canvaDesignUrl;
    if (canvaEditorUrl !== undefined && canvaEditorUrl !== null) updateData.canvaEditorUrl = canvaEditorUrl;
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

