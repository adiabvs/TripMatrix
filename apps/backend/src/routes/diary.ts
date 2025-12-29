import express from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { toDate } from '../utils/dateUtils.js';
import type { Trip, TripPlace, TravelDiary } from '@tripmatrix/types';
import { getTravelDiaryDesignData } from '../services/canvaService.js';
import { generateTravelDiaryDesign } from '../services/canvaDesignGenerator.js';
import { refreshAccessToken } from '../services/canvaOAuthService.js';
import { generatePDFDiary } from '../services/pdfDiaryService.js';
import type { DiaryPlatform } from '@tripmatrix/types';
import { TripModel } from '../models/Trip.js';
import { TripPlaceModel } from '../models/TripPlace.js';
import { TravelDiaryModel } from '../models/TravelDiary.js';
import { CanvaTokenModel } from '../models/CanvaToken.js';

const router = express.Router();

// In-memory cache for PDF buffers (when Supabase upload fails due to size)
// Key: tripId, Value: { buffer: Buffer, fileName: string, timestamp: number }
const pdfCache = new Map<string, { buffer: Buffer; fileName: string; timestamp: number }>();

// Clean up old cache entries (older than 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [key, value] of pdfCache.entries()) {
    if (value.timestamp < oneHourAgo) {
      pdfCache.delete(key);
    }
  }
}, 30 * 60 * 1000); // Run cleanup every 30 minutes

// Generate travel diary for a completed trip
router.post('/generate/:tripId', async (req: AuthenticatedRequest, res) => {
  try {
    const { tripId } = req.params;
    const uid = req.uid!;

    // Get trip
    const tripDoc = await TripModel.findById(tripId);
    if (!tripDoc) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip: Trip = tripDoc.toJSON() as Trip;
    
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
    const placesDocs = await TripPlaceModel.find({ tripId });
    const places = placesDocs.map((doc) => doc.toJSON() as TripPlace);

    if (places.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Trip has no places to include in diary',
      });
    }

    // Get platform from request body (default to 'canva' for backward compatibility)
    const platform: DiaryPlatform = req.body?.platform || 'canva';
    console.log('Generating diary with platform:', platform);

    // Handle platform-specific requirements
    let accessToken: string | undefined;
    
    if (platform === 'canva') {
      // Check if user has Canva OAuth token
      const tokenDoc = await CanvaTokenModel.findOne({ userId: uid });

      if (!tokenDoc) {
        return res.status(400).json({
          success: false,
          error: 'Canva not connected. Please connect your Canva account first by clicking "Connect with Canva" on the diary page.',
        });
      }

      const tokenData = tokenDoc.toJSON();
      accessToken = tokenData.accessToken;

      // Check if token expired and refresh if needed
      if (new Date(tokenData.expiresAt) < new Date()) {
        if (tokenData.refreshToken) {
          try {
            const { getCanvaConfig } = await import('../services/canvaOAuthService.js');
            const config = getCanvaConfig();
            const newToken = await refreshAccessToken(config, tokenData.refreshToken);
            accessToken = newToken.access_token;
            
            tokenDoc.accessToken = newToken.access_token;
            tokenDoc.refreshToken = newToken.refresh_token || tokenData.refreshToken;
            tokenDoc.expiresAt = new Date(Date.now() + (newToken.expires_in * 1000));
            tokenDoc.updatedAt = new Date();
            await tokenDoc.save();
          } catch (refreshError: any) {
            await CanvaTokenModel.findOneAndDelete({ userId: uid });
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
    } else if (platform === 'pdf') {
      // PDF generation doesn't require additional authentication
    }

    // Sort places by visitedAt
    const sortedPlaces = [...places].sort((a, b) => {
      const aTime = a.visitedAt ? new Date(a.visitedAt).getTime() : 0;
      const bTime = b.visitedAt ? new Date(b.visitedAt).getTime() : 0;
      return aTime - bTime;
    });

    // Generate diary based on platform
    let diaryData: any = {
      tripId,
      title: trip.title,
      description: trip.description || null,
      coverImageUrl: trip.coverImage || null,
      platform,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (platform === 'canva') {
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
        canvaDesign = await generateTravelDiaryDesign(accessToken!, trip, sortedPlaces);
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

      // Helper function to remove undefined values recursively
      const removeUndefined = (obj: any): any => {
        if (obj === null || obj === undefined) {
          return null;
        }
        if (Array.isArray(obj)) {
          return obj.map(removeUndefined).filter(item => item !== undefined);
        }
        if (typeof obj === 'object') {
          const cleaned: any = {};
          for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
              cleaned[key] = removeUndefined(value);
            }
          }
          return cleaned;
        }
        return obj;
      };

      diaryData = {
        ...diaryData,
        canvaDesignId: canvaDesign.designId,
        canvaDesignUrl: canvaDesign.designUrl,
        canvaEditorUrl: canvaDesign.editorUrl,
        designData: removeUndefined(designData), // Remove any undefined values before saving
      };
    } else if (platform === 'pdf') {
      // Generate PDF diary
      let pdfResult;
      try {
        console.log('=== Generating PDF diary ===');
        pdfResult = await generatePDFDiary(trip, sortedPlaces, uid);
        console.log('PDF diary generated successfully:', {
          pdfUrl: pdfResult.pdfUrl,
          fileName: pdfResult.fileName,
        });
      } catch (error: any) {
        console.error('Failed to generate PDF diary:', error);
        return res.status(500).json({
          success: false,
          error: `Failed to generate PDF diary: ${error.message}.`,
        });
      }

      // Store PDF buffer in cache if Supabase upload failed (for download endpoint)
      if (pdfResult.pdfBuffer && pdfResult.downloadUrl) {
        console.log('Storing PDF in cache for tripId:', tripId, 'Size:', pdfResult.pdfBuffer.length);
        pdfCache.set(tripId, {
          buffer: pdfResult.pdfBuffer,
          fileName: pdfResult.fileName,
          timestamp: Date.now(),
        });
        console.log('PDF cached successfully. Cache size:', pdfCache.size);
      } else {
        console.log('PDF not cached - pdfBuffer:', !!pdfResult.pdfBuffer, 'downloadUrl:', !!pdfResult.downloadUrl);
      }

      // Helper function to remove undefined values recursively (reuse from Canva section)
      const removeUndefined = (obj: any): any => {
        if (obj === null || obj === undefined) {
          return null;
        }
        if (Array.isArray(obj)) {
          return obj.map(removeUndefined).filter(item => item !== undefined);
        }
        if (typeof obj === 'object') {
          const cleaned: any = {};
          for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
              cleaned[key] = removeUndefined(value);
            }
          }
          return cleaned;
        }
        return obj;
      };

      diaryData = {
        ...diaryData,
        ...removeUndefined({
          pdfUrl: pdfResult.pdfUrl,
          pdfFileName: pdfResult.fileName,
          pdfDownloadUrl: pdfResult.downloadUrl,
        }),
      };
    }


    const diaryDoc = new TravelDiaryModel(diaryData);
    const savedDiary = await diaryDoc.save();
    
    const diary: TravelDiary = savedDiary.toJSON() as TravelDiary;

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

    // Verify trip access
    const tripDoc = await TripModel.findById(tripId);
    if (!tripDoc) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = tripDoc.toJSON() as Trip;
    
    if (trip.creatorId !== uid && !trip.participants?.some((p: any) => p.uid === uid)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized',
      });
    }

    // Get diary
    const diaryDoc = await TravelDiaryModel.findOne({ tripId });

    if (!diaryDoc) {
      return res.status(404).json({
        success: false,
        error: 'Diary not found',
      });
    }

    let diary = diaryDoc.toJSON() as TravelDiary;

    // If designData is missing, regenerate it
    if (!diary.designData) {
      try {
        // Get places
        const placesDocs = await TripPlaceModel.find({ tripId });
        const places = placesDocs.map((doc) => doc.toJSON() as TripPlace);

        // Sort places by visitedAt
        const sortedPlaces = [...places].sort((a, b) => {
          const aTime = a.visitedAt ? new Date(a.visitedAt).getTime() : 0;
          const bTime = b.visitedAt ? new Date(b.visitedAt).getTime() : 0;
          return aTime - bTime;
        });

        // Regenerate designData
        const designData = getTravelDiaryDesignData(trip, sortedPlaces);
        
        // Update diary with designData
        diaryDoc.designData = designData;
        diaryDoc.updatedAt = new Date();
        await diaryDoc.save();

        diary = diaryDoc.toJSON() as TravelDiary;
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

    const diaryDoc = await TravelDiaryModel.findById(diaryId);
    if (!diaryDoc) {
      return res.status(404).json({
        success: false,
        error: 'Diary not found',
      });
    }

    const diary = diaryDoc.toJSON() as TravelDiary;
    
    // Verify trip access
    const tripDoc = await TripModel.findById(diary.tripId);
    if (!tripDoc) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = tripDoc.toJSON() as Trip;
    
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

    const diaryDoc = await TravelDiaryModel.findById(diaryId);
    if (!diaryDoc) {
      return res.status(404).json({
        success: false,
        error: 'Diary not found',
      });
    }

    const diary = diaryDoc.toJSON() as TravelDiary;
    
    // Verify trip access
    const tripDoc = await TripModel.findById(diary.tripId);
    if (!tripDoc) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = tripDoc.toJSON() as Trip;
    
    if (trip.creatorId !== uid && !trip.participants?.some((p: any) => p.uid === uid)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized',
      });
    }

    // Get places
    const placesDocs = await TripPlaceModel.find({ tripId: diary.tripId });
    const places = placesDocs.map((doc) => doc.toJSON() as TripPlace);

    // Sort places by visitedAt
    const sortedPlaces = [...places].sort((a, b) => {
      const aTime = a.visitedAt ? new Date(a.visitedAt).getTime() : 0;
      const bTime = b.visitedAt ? new Date(b.visitedAt).getTime() : 0;
      return aTime - bTime;
    });

    // Regenerate designData
    const designData = getTravelDiaryDesignData(trip, sortedPlaces);
    
    // Update diary with designData
    diaryDoc.designData = designData;
    diaryDoc.updatedAt = new Date();
    const updatedDiaryDoc = await diaryDoc.save();

    const updatedDiary = updatedDiaryDoc.toJSON() as TravelDiary;

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

    const diaryDoc = await TravelDiaryModel.findById(diaryId);
    if (!diaryDoc) {
      return res.status(404).json({
        success: false,
        error: 'Diary not found',
      });
    }

    const diary = diaryDoc.toJSON() as TravelDiary;
    
    // Verify trip access
    const tripDoc = await TripModel.findById(diary.tripId);
    if (!tripDoc) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = tripDoc.toJSON() as Trip;
    
    if (trip.creatorId !== uid && !trip.participants?.some((p: any) => p.uid === uid)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized',
      });
    }

    if (canvaDesignId !== undefined && canvaDesignId !== null) diaryDoc.canvaDesignId = canvaDesignId;
    if (canvaDesignUrl !== undefined && canvaDesignUrl !== null) diaryDoc.canvaDesignUrl = canvaDesignUrl;
    if (canvaEditorUrl !== undefined && canvaEditorUrl !== null) diaryDoc.canvaEditorUrl = canvaEditorUrl;
    if (videoUrl !== undefined && videoUrl !== null) diaryDoc.videoUrl = videoUrl;

    diaryDoc.updatedAt = new Date();
    const updatedDiaryDoc = await diaryDoc.save();

    const updatedDiary = updatedDiaryDoc.toJSON() as TravelDiary;

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

/**
 * Delete a diary
 */
router.delete('/:diaryId', async (req: AuthenticatedRequest, res) => {
  try {
    const { diaryId } = req.params;
    const uid = req.uid!;

    // Get diary to verify ownership
    const diaryDoc = await TravelDiaryModel.findById(diaryId);
    if (!diaryDoc) {
      return res.status(404).json({
        success: false,
        error: 'Diary not found',
      });
    }

    const diary = diaryDoc.toJSON() as TravelDiary;
    
    // Verify trip access
    const tripDoc = await TripModel.findById(diary.tripId);
    if (!tripDoc) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = tripDoc.toJSON() as Trip;
    
    if (trip.creatorId !== uid && !trip.participants?.some((p: any) => p.uid === uid)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this diary',
      });
    }

    // Delete diary
    await TravelDiaryModel.findByIdAndDelete(diaryId);

    res.json({
      success: true,
      message: 'Diary deleted successfully',
    });
  } catch (error: any) {
    console.error('Failed to delete diary:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete diary',
    });
  }
});

/**
 * Download PDF diary endpoint (fallback when Supabase upload fails due to size)
 * Note: Already authenticated via router-level middleware in index.ts
 */
router.get('/download-pdf/:tripId', async (req: AuthenticatedRequest, res) => {
  try {
    const { tripId } = req.params;
    const uid = req.uid!;

    // Verify trip access
    const tripDoc = await TripModel.findById(tripId);
    if (!tripDoc) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = tripDoc.toJSON() as Trip;
    
    if (trip.creatorId !== uid && !trip.participants?.some((p: any) => p.uid === uid)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized',
      });
    }

    // Check cache for PDF buffer
    const cached = pdfCache.get(tripId);
    if (!cached) {
      console.error('PDF cache miss for tripId:', tripId);
      console.error('Cache keys:', Array.from(pdfCache.keys()));
      return res.status(404).json({
        success: false,
        error: 'PDF not found in cache. Please regenerate the diary.',
      });
    }

    console.log('Serving PDF from cache:', {
      tripId,
      fileName: cached.fileName,
      size: cached.buffer.length,
      sizeMB: (cached.buffer.length / (1024 * 1024)).toFixed(2),
    });

    // Check if buffer is too large (safety check)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (cached.buffer.length > maxSize) {
      console.error('PDF buffer too large:', cached.buffer.length);
      return res.status(500).json({
        success: false,
        error: 'PDF file is too large to download',
      });
    }

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${cached.fileName}"`);
    res.setHeader('Content-Length', cached.buffer.length.toString());
    res.setHeader('Cache-Control', 'no-cache');

    // Send PDF buffer directly - use end() for binary data to avoid string conversion
    // This prevents "Invalid string length" errors for large buffers
    // Don't use 'binary' encoding as it's deprecated - Buffer is already binary
    res.end(cached.buffer);
  } catch (error: any) {
    console.error('Failed to download PDF:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to download PDF',
    });
  }
});

export default router;

