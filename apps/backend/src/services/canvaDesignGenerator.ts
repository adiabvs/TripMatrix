/**
 * Canva Design Generator Service
 * Generates travel diary presentations in Canva with photos and content
 * Uses Autofill API with Brand Templates for automatic design generation
 * Reference: https://www.canva.dev/docs/connect/autofill-guide/
 */

import { uploadImagesToCanva } from './canvaAssetService.js';
import {
  getBrandTemplateDataset,
  createAutofillJob,
  waitForAutofillJob,
  type AutofillData,
} from './canvaAutofillService.js';
import type { Trip, TripPlace } from '@tripmatrix/types';

export interface CanvaDesignGenerationResult {
  designId: string;
  designUrl: string;
  editorUrl: string;
}

/**
 * Generate a travel diary design in Canva using Autofill API with Brand Templates
 * This automatically creates a design with content populated from trip data
 * Reference: https://www.canva.dev/docs/connect/autofill-guide/
 */
export async function generateTravelDiaryDesign(
  accessToken: string,
  trip: Trip,
  places: TripPlace[]
): Promise<CanvaDesignGenerationResult> {
  try {
    // Get brand template ID from environment variable
    const brandTemplateId = process.env.CANVA_BRAND_TEMPLATE_ID;
    
    if (!brandTemplateId) {
      throw new Error('CANVA_BRAND_TEMPLATE_ID environment variable is not set. Please configure a brand template ID.');
    }

    console.log('Using brand template:', brandTemplateId);

    // Step 1: Get brand template dataset to understand available fields
    console.log('Fetching brand template dataset...');
    const dataset = await getBrandTemplateDataset(accessToken, brandTemplateId);
    console.log('Available template fields:', Object.keys(dataset.dataset));

    // Step 2: Sort places by visitedAt
    const sortedPlaces = [...places].sort((a, b) => {
      const aTime = a.visitedAt ? new Date(a.visitedAt).getTime() : 0;
      const bTime = b.visitedAt ? new Date(b.visitedAt).getTime() : 0;
      return aTime - bTime;
    });

    // Step 3: Upload images to Canva as assets
    console.log('Uploading images to Canva...');
    const imageUrls: string[] = [];
    
    // Collect all image URLs
    if (trip.coverImage) {
      imageUrls.push(trip.coverImage);
    }
    
    sortedPlaces.forEach(place => {
      if (place.imageMetadata && place.imageMetadata.length > 0) {
        imageUrls.push(...place.imageMetadata.map(img => img.url));
      }
      if (place.images && place.images.length > 0) {
        imageUrls.push(...place.images);
      }
    });

    const imageToAssetMap = new Map<string, string>();
    
    if (imageUrls.length > 0) {
      try {
        const uploadedAssets = await uploadImagesToCanva(accessToken, imageUrls);
        console.log(`Uploaded ${uploadedAssets.length} images to Canva`);
        
        // Map uploaded assets back to their original URLs
        uploadedAssets.forEach((asset, index) => {
          if (index < imageUrls.length && !asset.assetId.startsWith('placeholder-')) {
            imageToAssetMap.set(imageUrls[index], asset.assetId);
          }
        });
      } catch (error: any) {
        console.warn('Failed to upload some images to Canva:', error.message);
        // Continue - we'll use available assets
      }
    }

    // Step 4: Prepare autofill data based on template fields
    const autofillData: AutofillData = {};
    
    // Map trip data to template fields
    // Common field names (adjust based on your template)
    const fieldMappings: Record<string, string> = {
      'TRIP_TITLE': 'TRIP_TITLE',
      'TRIP_DESCRIPTION': 'TRIP_DESCRIPTION',
      'COVER_IMAGE': 'COVER_IMAGE',
      'PLACE_NAME': 'PLACE_NAME',
      'PLACE_DESCRIPTION': 'PLACE_DESCRIPTION',
      'PLACE_IMAGE': 'PLACE_IMAGE',
    };

    // Get available fields from template
    const availableFields = Object.keys(dataset.dataset);
    console.log('Template fields:', availableFields);

    // Fill text fields
    availableFields.forEach(fieldName => {
      const fieldType = dataset.dataset[fieldName].type;
      
      if (fieldType === 'text') {
        // Map common field names to trip data
        if (fieldName.toUpperCase().includes('TITLE') || fieldName === 'TRIP_TITLE') {
          autofillData[fieldName] = {
            type: 'text',
            text: trip.title || '',
          };
        } else if (fieldName.toUpperCase().includes('DESCRIPTION') || fieldName === 'TRIP_DESCRIPTION') {
          autofillData[fieldName] = {
            type: 'text',
            text: trip.description || '',
          };
        } else if (fieldName.toUpperCase().includes('PLACE') && fieldName.toUpperCase().includes('NAME')) {
          // Use first place name if available
          const firstPlace = sortedPlaces[0];
          if (firstPlace) {
            autofillData[fieldName] = {
              type: 'text',
              text: firstPlace.name || '',
            };
          }
        } else if (fieldName.toUpperCase().includes('PLACE') && fieldName.toUpperCase().includes('DESCRIPTION')) {
          // Use first place description if available
          const firstPlace = sortedPlaces[0];
          if (firstPlace) {
            const description = firstPlace.rewrittenComment || firstPlace.comment || '';
            autofillData[fieldName] = {
              type: 'text',
              text: description,
            };
          }
        }
      } else if (fieldType === 'image') {
        // Map image fields
        if (fieldName.toUpperCase().includes('COVER') || fieldName === 'COVER_IMAGE') {
          const coverAssetId = trip.coverImage ? imageToAssetMap.get(trip.coverImage) : undefined;
          if (coverAssetId) {
            autofillData[fieldName] = {
              type: 'image',
              asset_id: coverAssetId,
            };
          }
        } else if (fieldName.toUpperCase().includes('PLACE') && fieldName.toUpperCase().includes('IMAGE')) {
          // Use first place image if available
          const firstPlace = sortedPlaces[0];
          if (firstPlace) {
            const placeImageUrl = firstPlace.imageMetadata?.[0]?.url || firstPlace.images?.[0];
            if (placeImageUrl) {
              const placeAssetId = imageToAssetMap.get(placeImageUrl);
              if (placeAssetId) {
                autofillData[fieldName] = {
                  type: 'image',
                  asset_id: placeAssetId,
                };
              }
            }
          }
        }
      }
    });

    console.log('Prepared autofill data:', JSON.stringify(autofillData, null, 2));

    // Step 5: Create autofill job
    console.log('Creating autofill job...');
    const { jobId } = await createAutofillJob(accessToken, brandTemplateId, autofillData);
    console.log('Autofill job created:', jobId);

    // Step 6: Wait for job completion
    console.log('Waiting for autofill job to complete...');
    const completedJob = await waitForAutofillJob(accessToken, jobId);
    
    if (completedJob.status !== 'success' || !completedJob.result) {
      throw new Error(`Autofill job failed or incomplete: ${completedJob.status}`);
    }

    // Extract design ID from URL
    // URL format: https://www.canva.com/design/{DESIGN-ID}/edit
    const designUrl = completedJob.result.design.url;
    const designIdMatch = designUrl.match(/\/design\/([^\/]+)\//);
    if (!designIdMatch) {
      throw new Error('Could not extract design ID from autofill result');
    }

    const designId = designIdMatch[1];
    console.log('Design generated successfully:', designId);

    return {
      designId,
      designUrl: designUrl.replace('/edit', '/view'),
      editorUrl: designUrl,
    };
  } catch (error: any) {
    console.error('Failed to generate Canva design:', error);
    throw new Error(`Failed to generate Canva design: ${error.message}`);
  }
}

