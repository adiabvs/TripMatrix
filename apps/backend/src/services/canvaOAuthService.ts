/**
 * Canva OAuth Service
 * Handles OAuth 2.0 authentication with Canva Connect API
 */

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
  const redirectUri = process.env.CANVA_REDIRECT_URI || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/canva/callback`;

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
 * Get OAuth authorization URL
 */
export function getCanvaAuthUrl(config: CanvaOAuthConfig, state?: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'design:read design:write', // Required scopes for design operations
    ...(state && { state }),
  });

  return `https://www.canva.com/api/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  config: CanvaOAuthConfig,
  code: string
): Promise<CanvaTokenResponse> {
  const response = await fetch('https://api.canva.com/rest/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for token: ${response.status} ${error}`);
  }

  return await response.json();
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  config: CanvaOAuthConfig,
  refreshToken: string
): Promise<CanvaTokenResponse> {
  const response = await fetch('https://api.canva.com/rest/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${response.status} ${error}`);
  }

  return await response.json();
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
): Promise<{ designId: string; designUrl: string }> {
  const response = await fetch('https://api.canva.com/rest/v1/designs', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: designData.title,
      type: designData.type || 'PRESENTATION',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create design: ${response.status} ${error}`);
  }

  const data = await response.json();
  return {
    designId: data.id,
    designUrl: `https://www.canva.com/design/${data.id}/edit`,
  };
}

/**
 * Get design details
 */
export async function getCanvaDesign(
  accessToken: string,
  designId: string
): Promise<any> {
  const response = await fetch(`https://api.canva.com/rest/v1/designs/${designId}`, {
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

