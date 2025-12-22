/**
 * Canva Autofill Service
 * Uses Canva's Autofill API to populate designs with content
 * Following the official documentation: https://www.canva.dev/docs/connect/autofill-guide/
 */

import { getCanvaApiBaseUrl } from './canvaOAuthService.js';

export interface AutofillFieldData {
  type: 'text' | 'image';
  text?: string;
  asset_id?: string;
}

export interface AutofillData {
  [fieldName: string]: AutofillFieldData;
}

export interface BrandTemplateDataset {
  dataset: {
    [fieldName: string]: {
      type: 'text' | 'image';
    };
  };
}

export interface AutofillJob {
  id: string;
  status: 'in_progress' | 'success' | 'failed';
  result?: {
    type: string;
    design: {
      url: string;
      thumbnail?: {
        url: string;
      };
    };
  };
}

/**
 * Get brand template dataset to see available fields
 * Reference: https://www.canva.dev/docs/connect/autofill-guide/
 */
export async function getBrandTemplateDataset(
  accessToken: string,
  brandTemplateId: string
): Promise<BrandTemplateDataset> {
  const apiBaseUrl = getCanvaApiBaseUrl();
  const datasetEndpoint = apiBaseUrl.endsWith('/v1') 
    ? `${apiBaseUrl}/brand-templates/${brandTemplateId}/dataset` 
    : `${apiBaseUrl}/v1/brand-templates/${brandTemplateId}/dataset`;
  
  const response = await fetch(datasetEndpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get brand template dataset: ${response.status} ${error}`);
  }

  return await response.json() as BrandTemplateDataset;
}

/**
 * Create an autofill job to generate a design from a brand template
 * Reference: https://www.canva.dev/docs/connect/autofill-guide/
 * 
 * @param accessToken - Canva access token
 * @param brandTemplateId - Brand template ID (from published template URL)
 * @param autofillData - Data to fill into template fields
 * @returns Job ID and initial status
 */
export async function createAutofillJob(
  accessToken: string,
  brandTemplateId: string,
  autofillData: AutofillData
): Promise<{ jobId: string; status: string }> {
  const apiBaseUrl = getCanvaApiBaseUrl();
  const autofillEndpoint = apiBaseUrl.endsWith('/v1') 
    ? `${apiBaseUrl}/autofills` 
    : `${apiBaseUrl}/v1/autofills`;
  
  const requestBody = {
    brand_template_id: brandTemplateId,
    data: autofillData,
  };

  console.log('Creating autofill job with data:', JSON.stringify(requestBody, null, 2));

  const response = await fetch(autofillEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Autofill job creation failed:', error);
    throw new Error(`Failed to create autofill job: ${response.status} ${error}`);
  }

  const data = await response.json() as { job: { id: string; status: string } };
  console.log('Autofill job created:', data);
  return { jobId: data.job.id, status: data.job.status };
}

/**
 * Get autofill job status and result
 * Reference: https://www.canva.dev/docs/connect/autofill-guide/
 * 
 * @param accessToken - Canva access token
 * @param jobId - Autofill job ID
 * @returns Job status and design details if completed
 */
export async function getAutofillJobStatus(
  accessToken: string,
  jobId: string
): Promise<AutofillJob> {
  const apiBaseUrl = getCanvaApiBaseUrl();
  const statusEndpoint = apiBaseUrl.endsWith('/v1') 
    ? `${apiBaseUrl}/autofills/${jobId}` 
    : `${apiBaseUrl}/v1/autofills/${jobId}`;
  
  const response = await fetch(statusEndpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get autofill job status: ${response.status} ${error}`);
  }

  const data = await response.json() as { job: AutofillJob };
  return data.job;
}

/**
 * Poll autofill job until completion
 * @param accessToken - Canva access token
 * @param jobId - Autofill job ID
 * @param maxAttempts - Maximum polling attempts (default: 60, ~60 seconds)
 * @param intervalMs - Polling interval in milliseconds (default: 1000)
 * @returns Completed job with design details
 */
export async function waitForAutofillJob(
  accessToken: string,
  jobId: string,
  maxAttempts: number = 60,
  intervalMs: number = 1000
): Promise<AutofillJob> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const job = await getAutofillJobStatus(accessToken, jobId);
    
    console.log(`Autofill job status (attempt ${attempts + 1}): ${job.status}`);

    if (job.status === 'success') {
      return job;
    }

    if (job.status === 'failed') {
      throw new Error('Autofill job failed');
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs));
    attempts++;
  }

  throw new Error(`Autofill job timeout after ${maxAttempts} attempts`);
}

