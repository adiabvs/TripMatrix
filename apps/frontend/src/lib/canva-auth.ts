/**
 * Canva Authentication Utilities
 * Following the pattern from canva-connect-api-starter-kit
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const endpoints = {
  AUTHORIZE: '/api/canva/auth',
  IS_AUTHORIZED: '/api/canva/token',
};

export const checkCanvaAuth = async (token: string | null | undefined): Promise<{ status: boolean }> => {
  if (!token) {
    return { status: false };
  }

  try {
    const url = new URL(endpoints.IS_AUTHORIZED, API_URL);
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      return { status: false };
    }

    const data = await response.json();
    return { status: data.hasToken || false };
  } catch (error) {
    console.error('Failed to check Canva auth:', error);
    return { status: false };
  }
};

export const connectCanva = async (
  token: string | null | undefined,
  diaryId?: string
): Promise<void> => {
  if (!token) {
    throw new Error('Authentication required');
  }

  try {
    const url = new URL(endpoints.AUTHORIZE, API_URL);
    if (diaryId) {
      url.searchParams.append('diaryId', diaryId);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get authorization URL');
    }

    const result = await response.json();
    if (result.success && result.authUrl) {
      // Redirect to Canva (following starter kit pattern)
      window.location.href = result.authUrl;
    } else {
      throw new Error(result.error || 'Failed to get authorization URL');
    }
  } catch (error: any) {
    console.error('Failed to connect Canva:', error);
    throw error;
  }
};


