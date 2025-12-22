/**
 * Canva OAuth Service
 * Handles OAuth 2.0 authentication with Canva Connect API
 * Following the pattern from canva-connect-api-starter-kit
 */

import crypto from 'node:crypto';
import * as jose from 'jose';

export interface CanvaOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Get Canva OAuth configuration from environment
 */
export function getCanvaConfig(): CanvaOAuthConfig {
  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  // Redirect URI following starter kit pattern: /oauth/redirect
  const redirectUri = process.env.CANVA_REDIRECT_URI || `${process.env.BACKEND_URL || 'http://127.0.0.1:3001'}/oauth/redirect`;

  if (!clientId || !clientSecret) {
    throw new Error('Canva OAuth credentials not configured. Please set CANVA_CLIENT_ID and CANVA_CLIENT_SECRET.');
  }

  return { clientId, clientSecret, redirectUri };
}

export interface CanvaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

/**
 * Get Canva Connect API base URL
 * Following the starter kit pattern: https://api.canva.com/rest
 */
export function getCanvaApiBaseUrl(): string {
  return process.env.BASE_CANVA_CONNECT_API_URL || 'https://api.canva.com/rest';
}

/**
 * Get Canva Connect Auth base URL
 * Following the starter kit pattern: https://www.canva.com/api
 */
function getCanvaAuthBaseUrl(): string {
  return process.env.BASE_CANVA_CONNECT_AUTH_URL || 'https://www.canva.com/api';
}

/**
 * Generate PKCE code verifier and challenge
 */
export function generatePKCE() {
  const codeVerifier = crypto.randomBytes(96).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest()
    .toString('base64url');
  
  return { codeVerifier, codeChallenge };
}

/**
 * Get OAuth authorization URL with PKCE
 * Following the pattern from canva-connect-api-starter-kit
 */
export function getCanvaAuthUrl(
  config: CanvaOAuthConfig,
  state: string,
  codeChallenge: string
): string {
  const scopes = [
    'asset:read',
    'asset:write',
    'brandtemplate:content:read',
    'brandtemplate:meta:read',
    'design:content:read',
    'design:content:write',
    'design:meta:read',
    'profile:read',
  ];
  const scopeString = scopes.join(' ');

  const authBaseUrl = getCanvaAuthBaseUrl();
  const url = new URL(`${authBaseUrl}/oauth/authorize`);
  url.searchParams.append('code_challenge', codeChallenge);
  url.searchParams.append('code_challenge_method', 'S256');
  url.searchParams.append('scope', scopeString);
  url.searchParams.append('response_type', 'code');
  url.searchParams.append('client_id', config.clientId);
  url.searchParams.append('redirect_uri', config.redirectUri);
  url.searchParams.append('state', state);

  return url.toString();
}

/**
 * Get basic auth client for Canva API
 */
export function getBasicAuthClient() {
  const config = getCanvaConfig();
  const credentials = `${config.clientId}:${config.clientSecret}`;
  const localClient = createClient({
    headers: {
      Authorization: `Basic ${Buffer.from(credentials).toString('base64')}`,
    },
    baseUrl: getCanvaApiBaseUrl(),
  });

  return localClient;
}

/**
 * Exchange authorization code for access token with PKCE
 * Following the pattern from canva-connect-api-starter-kit
 */
export async function exchangeCodeForToken(
  config: CanvaOAuthConfig,
  code: string,
  codeVerifier: string
): Promise<CanvaTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
    code,
    redirect_uri: config.redirectUri,
  });

  const apiBaseUrl = getCanvaApiBaseUrl();
  // Starter kit uses base /rest, so we need to add /v1 for the endpoint
  const tokenEndpoint = apiBaseUrl.endsWith('/v1') 
    ? `${apiBaseUrl}/oauth/token` 
    : `${apiBaseUrl}/v1/oauth/token`;
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for token: ${response.status} ${error}`);
  }

  return await response.json() as CanvaTokenResponse;
}

/**
 * Refresh access token using refresh token
 * Following the pattern from canva-connect-api-starter-kit
 */
export async function refreshAccessToken(
  config: CanvaOAuthConfig,
  refreshToken: string
): Promise<CanvaTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const apiBaseUrl = getCanvaApiBaseUrl();
  // Starter kit uses base /rest, so we need to add /v1 for the endpoint
  const tokenEndpoint = apiBaseUrl.endsWith('/v1') 
    ? `${apiBaseUrl}/oauth/token` 
    : `${apiBaseUrl}/v1/oauth/token`;
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${response.status} ${error}`);
  }

  return await response.json() as CanvaTokenResponse;
}

/**
 * Get user client with access token
 */
export function getUserClient(accessToken: string) {
  const localClient = createClient({
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    baseUrl: getCanvaApiBaseUrl(),
  });

  return localClient;
}

/**
 * Create a design using Canva Connect API
 */
export async function createCanvaDesign(
  accessToken: string,
  designData: {
    title: string;
    type?: string;
  }
): Promise<{ designId: string; designUrl: string; editUrl: string }> {
  const apiBaseUrl = getCanvaApiBaseUrl();
  // Starter kit uses base /rest, so we need to add /v1 for the endpoint
  const designsEndpoint = apiBaseUrl.endsWith('/v1') 
    ? `${apiBaseUrl}/designs` 
    : `${apiBaseUrl}/v1/designs`;
  
  // Canva API requires 'design_type' field as an object with type and name
  const requestBody: any = {
    title: designData.title,
  };
  
  // Map 'type' to 'design_type' for Canva API
  // design_type should be an object: { type: "preset", name: "presentation" }
  const designType = (designData.type || 'PRESENTATION').toLowerCase();
  requestBody.design_type = {
    type: 'preset',
    name: designType === 'presentation' ? 'presentation' : 'presentation', // Default to presentation
  };
  
  const response = await fetch(designsEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Canva API error response:', error);
    throw new Error(`Failed to create design: ${response.status} ${error}`);
  }

  const data = await response.json();
  console.log('Canva API response:', JSON.stringify(data, null, 2));
  
  // Canva API returns nested structure: { design: { id: "...", urls: { edit_url: "...", view_url: "..." } } }
  const design = data.design || data;
  const designId = design.id || data.id || data.designId || data.design_id;
  
  if (!designId) {
    console.error('No design ID in response:', data);
    throw new Error('Failed to create design: No design ID in response');
  }
  
  // Use URLs from API response if available, otherwise construct them
  const editUrl = design.urls?.edit_url || `https://www.canva.com/design/${designId}/edit`;
  const viewUrl = design.urls?.view_url || `https://www.canva.com/design/${designId}/view`;
  
  return {
    designId,
    designUrl: viewUrl,
    editUrl,
  };
}

/**
 * Get design details
 */
export async function getCanvaDesign(
  accessToken: string,
  designId: string
): Promise<any> {
  const apiBaseUrl = getCanvaApiBaseUrl();
  // Starter kit uses base /rest, so we need to add /v1 for the endpoint
  const designEndpoint = apiBaseUrl.endsWith('/v1') 
    ? `${apiBaseUrl}/designs/${designId}` 
    : `${apiBaseUrl}/v1/designs/${designId}`;
  const response = await fetch(designEndpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get design: ${response.status} ${error}`);
  }

  return await response.json();
}

