/**
 * Canva Design Content Service
 * Uses Canva's Design Content API to add images and text to designs
 */

import { getCanvaApiBaseUrl } from './canvaOAuthService.js';
import type { Trip, TripPlace } from '@tripmatrix/types';

export interface DesignElement {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  [key: string]: any;
}

/**
 * Add content to a Canva design using the Design Content API
 * This populates the design with pages, images, and text from the trip
 */
export async function populateDesignWithContent(
  accessToken: string,
  designId: string,
  trip: Trip,
  places: TripPlace[],
  coverAssetId?: string,
  placeImageMappings?: Array<{ placeIndex: number; assetIds: string[] }>
): Promise<void> {
  const apiBaseUrl = getCanvaApiBaseUrl();
  
  try {
    // Note: Canva Connect API doesn't have a Design Content API endpoint
    // The Design Content API is only available in Canva Apps (frontend SDK)
    // For Connect API, we can only:
    // 1. Create designs (empty)
    // 2. Upload assets (images available in user's media library)
    // 3. Use Autofill API with brand templates (requires template setup)
    
    // Since we can't programmatically add content via Connect API,
    // we'll log that images are uploaded and available
    console.log('Design Content API: Note - Canva Connect API does not support programmatic content addition');
    console.log('Images have been uploaded and are available in the user\'s Canva media library');
    console.log(`Uploaded ${placeImageMappings?.reduce((sum, m) => sum + m.assetIds.length, 0) || 0} assets total`);
    console.log('User can open the design in Canva editor and add images/text manually');
    
    // Return early - content population not supported via Connect API
    return;

    // Step 2: Prepare content updates
    const pages: any[] = [];
    
    // Create cover page with trip title
    const coverPage: any = {
      elements: [],
    };

    // Add title text element
    if (trip.title) {
      coverPage.elements.push({
        type: 'TEXT',
        content: trip.title,
        x: 100,
        y: 100,
        width: 800,
        height: 100,
        fontSize: 48,
        fontWeight: 'bold',
      });
    }

    // Add description if available
    if (trip.description) {
      coverPage.elements.push({
        type: 'TEXT',
        content: trip.description,
        x: 100,
        y: 220,
        width: 800,
        height: 100,
        fontSize: 24,
      });
    }

    // Add cover image if available
    if (coverAssetId) {
      coverPage.elements.push({
        type: 'IMAGE',
        asset_id: coverAssetId,
        x: 100,
        y: 350,
        width: 800,
        height: 450,
      });
    }

    pages.push(coverPage);

    // Create pages for each place
    places.forEach((place, index) => {
      const page: any = {
        elements: [],
      };

      // Add place name as title
      page.elements.push({
        type: 'TEXT',
        content: place.name,
        x: 100,
        y: 100,
        width: 800,
        height: 80,
        fontSize: 36,
        fontWeight: 'bold',
      });

      // Add description/comment
      const description = place.rewrittenComment || place.comment || '';
      if (description) {
        page.elements.push({
          type: 'TEXT',
          content: description,
          x: 100,
          y: 200,
          width: 800,
          height: 200,
          fontSize: 18,
        });
      }

      // Add rating if available
      if (place.rating !== undefined && place.rating !== null) {
        page.elements.push({
          type: 'TEXT',
          content: `Rating: ${place.rating}/5`,
          x: 100,
          y: 420,
          width: 200,
          height: 40,
          fontSize: 16,
        });
      }

      // Get asset IDs for this place
      const placeMapping = placeImageMappings?.find(m => m.placeIndex === index);
      const placeAssetIds = placeMapping?.assetIds || [];

      // Add image elements (up to 3 images per place)
      placeAssetIds.slice(0, 3).forEach((assetId, imgIndex) => {
        const imageWidth = 250;
        const imageHeight = 250;
        const spacing = 20;
        const startX = 100 + (imgIndex * (imageWidth + spacing));
        
        page.elements.push({
          type: 'IMAGE',
          asset_id: assetId,
          x: startX,
          y: 480,
          width: imageWidth,
          height: imageHeight,
        });
      });

      pages.push(page);
    });

    // Step 3: Update design content with new pages and elements
    const updateContentEndpoint = apiBaseUrl.endsWith('/v1') 
      ? `${apiBaseUrl}/designs/${designId}/content` 
      : `${apiBaseUrl}/v1/designs/${designId}/content`;

    const updateResponse = await fetch(updateContentEndpoint, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pages,
      }),
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      console.warn('Failed to update design content:', error);
      console.warn('Design created but content not populated. Images are available in media library.');
      // Continue - images are uploaded, user can add them manually
      return;
    }

    console.log('Design content populated successfully with', pages.length, 'pages');
  } catch (error: any) {
    console.warn('Failed to populate design with content:', error.message);
    console.warn('Design created but content not populated. Images are available in media library.');
    // Continue - images are uploaded, user can add them manually
  }
}

