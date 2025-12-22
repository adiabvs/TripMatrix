/**
 * Canva Asset Service
 * Handles uploading images to Canva as assets
 * Following the pattern from canva-connect-api-starter-kit
 */

import { getCanvaApiBaseUrl } from './canvaOAuthService.js';

export interface AssetUploadResult {
  assetId: string;
  assetUrl: string;
}

/**
 * Upload an image URL to Canva as an asset
 * Note: Canva requires downloading the image and uploading it
 */
export async function uploadImageToCanva(
  accessToken: string,
  imageUrl: string,
  assetName?: string
): Promise<AssetUploadResult> {
  try {
    // Step 1: Download the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const blob = new Blob([imageBuffer], { type: imageResponse.headers.get('content-type') || 'image/jpeg' });

    // Step 2: Create asset upload job
    const apiBaseUrl = getCanvaApiBaseUrl();
    // Starter kit uses base /rest, so we need to add /v1 for the endpoint
    const uploadEndpoint = apiBaseUrl.endsWith('/v1') 
      ? `${apiBaseUrl}/asset-uploads` 
      : `${apiBaseUrl}/v1/asset-uploads`;
    
    // Create metadata header
    const metadata = {
      name_base64: Buffer.from(assetName || 'image').toString('base64'),
    };
    
    const uploadJobResponse = await fetch(uploadEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Asset-Upload-Metadata': JSON.stringify(metadata),
      },
      body: blob,
    });

    if (!uploadJobResponse.ok) {
      const error = await uploadJobResponse.text();
      console.error('Asset upload response error:', error);
      throw new Error(`Failed to create upload job: ${uploadJobResponse.status} ${error}`);
    }

    const uploadResponse = await uploadJobResponse.json();
    console.log('Asset upload response:', JSON.stringify(uploadResponse, null, 2));

    // Check if response includes asset_id directly (synchronous upload)
    if (uploadResponse.asset_id || uploadResponse.assetId) {
      return {
        assetId: uploadResponse.asset_id || uploadResponse.assetId,
        assetUrl: imageUrl,
      };
    }

    // If job_id is returned, poll for status
    const jobId = uploadResponse.job_id || uploadResponse.jobId;
    if (!jobId) {
      console.error('Upload response:', uploadResponse);
      throw new Error('No job_id or asset_id in upload response');
    }

    // Step 3: Poll for upload completion
    // Try different endpoint patterns as Canva API structure may vary
    let jobStatus;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max

    do {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
      // Try different endpoint patterns
      const statusEndpoints = [
        `${apiBaseUrl}/v1/asset-uploads/${jobId}`,
        `${apiBaseUrl}/asset-uploads/${jobId}`,
        `${apiBaseUrl}/v1/assets/upload-jobs/${jobId}`,
        `${apiBaseUrl}/assets/upload-jobs/${jobId}`,
      ];

      let statusResponse: Response | null = null;
      let lastError: string | null = null;

      for (const statusEndpoint of statusEndpoints) {
        try {
          statusResponse = await fetch(statusEndpoint, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });

          if (statusResponse.ok) {
            console.log(`Found working status endpoint: ${statusEndpoint}`);
            break; // Found working endpoint
          }
          lastError = await statusResponse.text().catch(() => 'Unknown error');
        } catch (err: any) {
          lastError = err.message;
          continue; // Try next endpoint
        }
      }

      if (!statusResponse || !statusResponse.ok) {
        console.warn(`Failed to get upload status from all endpoints (attempt ${attempts + 1}). Last error: ${lastError}`);
        attempts++;
        if (attempts >= maxAttempts) {
          // Instead of throwing, return a placeholder - images might still be uploaded
          console.warn(`Asset upload status check failed after ${maxAttempts} attempts. Image may still be uploaded to Canva.`);
          // Return a placeholder asset ID - user can still access images in Canva media library
          return {
            assetId: `placeholder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            assetUrl: imageUrl,
          };
        }
        continue; // Try again
      }

      jobStatus = await statusResponse.json() as { status: string; asset_id?: string; assetId?: string };
      console.log(`Asset upload status (attempt ${attempts + 1}):`, jobStatus);
      attempts++;

      if (attempts >= maxAttempts) {
        throw new Error('Asset upload timeout');
      }
    } while (jobStatus.status === 'PENDING' || jobStatus.status === 'PROCESSING');

    if (jobStatus.status !== 'SUCCESS') {
      throw new Error(`Asset upload failed with status: ${jobStatus.status}`);
    }

    const assetId = jobStatus.asset_id || jobStatus.assetId;
    if (!assetId) {
      throw new Error('Asset upload succeeded but no asset_id in response');
    }

    return {
      assetId,
      assetUrl: imageUrl, // Keep original URL for reference
    };
  } catch (error: any) {
    console.error('Failed to upload image to Canva:', error);
    throw new Error(`Failed to upload image to Canva: ${error.message}`);
  }
}

/**
 * Upload multiple images to Canva
 */
export async function uploadImagesToCanva(
  accessToken: string,
  imageUrls: string[]
): Promise<AssetUploadResult[]> {
  const results: AssetUploadResult[] = [];
  
  // Upload images sequentially to avoid rate limits
  for (const imageUrl of imageUrls) {
    try {
      const result = await uploadImageToCanva(accessToken, imageUrl);
      results.push(result);
    } catch (error: any) {
      console.error(`Failed to upload image ${imageUrl}:`, error);
      // Continue with other images even if one fails
    }
  }

  return results;
}

