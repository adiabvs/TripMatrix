/**
 * Canva Design Generator Service
 * Generates travel diary presentations in Canva with photos and content
 * 
 * Without Brand Templates: Creates empty design and uploads images to user's media library
 * With Brand Templates: Uses Autofill API for automatic design generation
 * 
 * Reference: https://www.canva.dev/docs/connect/
 */

import { createCanvaDesign } from './canvaOAuthService.js';
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
 * Generate a travel diary design in Canva
 * 
 * If CANVA_BRAND_TEMPLATE_ID is set: Uses Autofill API with Brand Templates for automatic design
 * Otherwise: Creates empty design and uploads images to user's media library
 * 
 * Reference: https://www.canva.dev/docs/connect/
 */
export async function generateTravelDiaryDesign(
  accessToken: string,
  trip: Trip,
  places: TripPlace[]
): Promise<CanvaDesignGenerationResult> {
  try {
    // Check if brand template is configured
    const brandTemplateId = process.env.CANVA_BRAND_TEMPLATE_ID;
    
    if (brandTemplateId) {
      // Use Autofill API with Brand Template
      return await generateDesignWithAutofill(accessToken, trip, places, brandTemplateId);
    } else {
      // Create empty design and upload images
      return await generateDesignWithoutTemplate(accessToken, trip, places);
    }
  } catch (error: any) {
    console.error('Failed to generate Canva design:', error);
    throw new Error(`Failed to generate Canva design: ${error.message}`);
  }
}

/**
 * Generate design using Autofill API with Brand Templates
 * This automatically creates a design with content populated from trip data
 */
async function generateDesignWithAutofill(
  accessToken: string,
  trip: Trip,
  places: TripPlace[],
  brandTemplateId: string
): Promise<CanvaDesignGenerationResult> {
    console.log('Using brand template:', brandTemplateId);

    // Step 1: Get brand template dataset to understand available fields
    console.log('Fetching brand template dataset...');
    const dataset = await getBrandTemplateDataset(accessToken, brandTemplateId);
    console.log('Available template fields:', Object.keys(dataset.dataset));
    
    // Expected fields based on template: time, place, comments, cover_image, temperature
    const expectedFields = ['time', 'place', 'comments', 'cover_image', 'temperature'];
    const availableFieldNames = Object.keys(dataset.dataset).map(f => f.toLowerCase());
    console.log('Template field mapping check:', {
      expected: expectedFields,
      available: availableFieldNames,
      match: expectedFields.filter(f => availableFieldNames.includes(f.toLowerCase())),
    });

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

    // Step 4: Prepare autofill data for the template
    // Template field names: time, place, comments, cover_image, temperature
    // We'll use the first place for now - user can duplicate slides in Canva for other places
    const placeToUse = sortedPlaces[0];
    
    if (!placeToUse) {
      throw new Error('No places found in trip');
    }

    const autofillData: AutofillData = {};
    const availableFields = Object.keys(dataset.dataset);
    
    console.log('Mapping data for place:', placeToUse.name);
    console.log('Available template fields:', availableFields);

    // Map to exact field names: time, place, comments, cover_image, temperature
    availableFields.forEach(fieldName => {
      const fieldType = dataset.dataset[fieldName].type;
      const fieldNameLower = fieldName.toLowerCase();
      
      if (fieldType === 'text') {
        // Map exact field names from template
        if (fieldNameLower === 'time') {
          // Format time from visitedAt
          let timeStr = '';
          if (placeToUse.visitedAt) {
            const visitedDate = new Date(placeToUse.visitedAt);
            timeStr = visitedDate.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: true 
            });
          } else {
            timeStr = new Date().toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: true 
            });
          }
          autofillData[fieldName] = {
            type: 'text',
            text: timeStr,
          };
        } else if (fieldNameLower === 'place') {
          // Place name
          autofillData[fieldName] = {
            type: 'text',
            text: placeToUse.name || '',
          };
        } else if (fieldNameLower === 'comments') {
          // Place comments/description
          const description = placeToUse.rewrittenComment || placeToUse.comment || '';
          autofillData[fieldName] = {
            type: 'text',
            text: description,
          };
        } else if (fieldNameLower === 'temperature') {
          // Temperature - leave empty (can be extended to include weather data)
          autofillData[fieldName] = {
            type: 'text',
            text: '', // Empty by default
          };
        }
      } else if (fieldType === 'image') {
        // Map image field
        if (fieldNameLower === 'cover_image') {
          // Use place image (first image from place)
          let assetId: string | undefined;
          
          // Get first image from place
          const imageUrl = placeToUse.imageMetadata?.[0]?.url || placeToUse.images?.[0];
          if (imageUrl) {
            assetId = imageToAssetMap.get(imageUrl);
          }
          
          // Fallback to trip cover image if place has no image
          if (!assetId && trip.coverImage) {
            assetId = imageToAssetMap.get(trip.coverImage);
          }
          
          if (assetId) {
            autofillData[fieldName] = {
              type: 'image',
              asset_id: assetId,
            };
          } else {
            console.warn('No image available for cover_image field');
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
    const designIdMatch = designUrl.match(/\/design\/([^/]+)\//);
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
}

/**
 * Generate design without Brand Template
 * Creates an empty presentation and uploads images to user's Canva media library
 * Images will be available when user opens the design in Canva editor
 */
async function generateDesignWithoutTemplate(
  accessToken: string,
  trip: Trip,
  places: TripPlace[]
): Promise<CanvaDesignGenerationResult> {
  console.log('Creating design without template (images will be uploaded to media library)');

  // Step 1: Sort places by visitedAt
  const sortedPlaces = [...places].sort((a, b) => {
    const aTime = a.visitedAt ? new Date(a.visitedAt).getTime() : 0;
    const bTime = b.visitedAt ? new Date(b.visitedAt).getTime() : 0;
    return aTime - bTime;
  });

  // Step 2: Collect all image URLs
  const imageUrls: string[] = [];
  
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

  // Step 3: Upload images to Canva as assets (they'll be in user's media library)
  console.log(`Uploading ${imageUrls.length} images to Canva...`);
  let coverAssetId: string | undefined;
  
  if (imageUrls.length > 0) {
    try {
      const uploadedAssets = await uploadImagesToCanva(accessToken, imageUrls);
      console.log(`Successfully uploaded ${uploadedAssets.length} images to Canva`);
      
      // Get cover image asset ID if available (for optional initial asset)
      if (trip.coverImage) {
        const coverAsset = uploadedAssets.find(asset => 
          !asset.assetId.startsWith('placeholder-') && 
          asset.assetUrl === trip.coverImage
        );
        if (coverAsset) {
          coverAssetId = coverAsset.assetId;
          console.log('Cover image uploaded as asset:', coverAssetId);
        }
      }
    } catch (error: any) {
      console.warn('Failed to upload some images to Canva:', error.message);
      // Continue - design will still be created
    }
  }

  // Step 4: Create presentation design
  // Optionally include cover image as initial asset if available
  console.log('Creating presentation design...');
  const design = await createCanvaDesign(accessToken, {
    title: `${trip.title} - Travel Diary`,
    type: 'PRESENTATION',
    assetId: coverAssetId, // Add cover image to design if available
  });

  console.log('Design created:', design.designId);
  console.log('All images have been uploaded to your Canva media library.');
  console.log('Open the design in Canva editor to add images and text.');

  return {
    designId: design.designId,
    designUrl: design.designUrl,
    editorUrl: design.editUrl,
  };
}

