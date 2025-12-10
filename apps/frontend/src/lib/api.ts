import type {
  Trip,
  TripPlace,
  TripExpense,
  TripRoute,
  RewriteRequest,
  RewriteResponse,
  ExpenseSummary,
  ApiResponse,
  User,
} from '@tripmatrix/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {},
  token: string | null
): Promise<Response> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response;
}

// Trip APIs
export async function createTrip(
  tripData: Partial<Trip>,
  token: string | null
): Promise<Trip> {
  const response = await fetchWithAuth('/api/trips', {
    method: 'POST',
    body: JSON.stringify(tripData),
  }, token);
  const result: ApiResponse<Trip> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to create trip');
  }
  return result.data;
}

export async function getTrip(tripId: string, token: string | null): Promise<Trip> {
  const response = await fetchWithAuth(`/api/trips/${tripId}`, {}, token);
  const result: ApiResponse<Trip> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch trip');
  }
  return result.data;
}

export async function getUserTrips(
  status?: string,
  token: string | null
): Promise<Trip[]> {
  const params = status ? `?status=${status}` : '';
  const response = await fetchWithAuth(`/api/trips${params}`, {}, token);
  const result: ApiResponse<Trip[]> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch trips');
  }
  return result.data;
}

export async function updateTrip(
  tripId: string,
  updates: Partial<Trip>,
  token: string | null
): Promise<Trip> {
  const response = await fetchWithAuth(`/api/trips/${tripId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }, token);
  const result: ApiResponse<Trip> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to update trip');
  }
  return result.data;
}

export async function addParticipants(
  tripId: string,
  participants: string[],
  token: string | null
): Promise<{ participants: any[] }> {
  const response = await fetchWithAuth(`/api/trips/${tripId}/participants`, {
    method: 'POST',
    body: JSON.stringify({ participants }),
  }, token);
  const result: ApiResponse<{ participants: any[] }> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to add participants');
  }
  return result.data;
}

export async function getPublicTrips(): Promise<Trip[]> {
  const response = await fetch(`${API_URL}/api/trips/public/list`);
  const result: ApiResponse<Trip[]> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch public trips');
  }
  return result.data;
}

// Place APIs
export async function addPlace(
  placeData: Partial<TripPlace>,
  token: string | null
): Promise<TripPlace> {
  const response = await fetchWithAuth('/api/places', {
    method: 'POST',
    body: JSON.stringify(placeData),
  }, token);
  const result: ApiResponse<TripPlace> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to add place');
  }
  return result.data;
}

// Expense APIs
export async function createExpense(
  expenseData: Partial<TripExpense>,
  token: string | null
): Promise<TripExpense> {
  const response = await fetchWithAuth('/api/expenses', {
    method: 'POST',
    body: JSON.stringify(expenseData),
  }, token);
  const result: ApiResponse<TripExpense> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to create expense');
  }
  return result.data;
}

export async function getTripExpenses(
  tripId: string,
  token: string | null
): Promise<TripExpense[]> {
  const response = await fetchWithAuth(`/api/expenses/trip/${tripId}`, {}, token);
  const result: ApiResponse<TripExpense[]> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch expenses');
  }
  return result.data;
}

export async function getExpenseSummary(
  tripId: string,
  token: string | null
): Promise<ExpenseSummary> {
  const response = await fetchWithAuth(`/api/expenses/trip/${tripId}/summary`, {}, token);
  const result: ApiResponse<ExpenseSummary> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch expense summary');
  }
  return result.data;
}

// Route APIs
export async function recordRoutePoints(
  tripId: string,
  points: any[],
  modeOfTravel: string,
  token: string | null
): Promise<TripRoute> {
  const response = await fetchWithAuth(`/api/routes/${tripId}/points`, {
    method: 'POST',
    body: JSON.stringify({ points, modeOfTravel }),
  }, token);
  const result: ApiResponse<TripRoute> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to record route');
  }
  return result.data;
}

export async function getTripRoutes(
  tripId: string,
  token: string | null
): Promise<TripRoute[]> {
  const response = await fetchWithAuth(`/api/routes/${tripId}`, {}, token);
  const result: ApiResponse<TripRoute[]> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch routes');
  }
  return result.data;
}

// AI APIs
export async function rewriteText(
  request: RewriteRequest,
  token: string | null
): Promise<RewriteResponse> {
  const response = await fetchWithAuth('/api/ai/rewrite', {
    method: 'POST',
    body: JSON.stringify(request),
  }, token);
  const result: ApiResponse<RewriteResponse> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to rewrite text');
  }
  return result.data;
}

// User APIs
export async function searchUsers(query: string, token: string | null): Promise<User[]> {
  const response = await fetchWithAuth(`/api/users/search?q=${encodeURIComponent(query)}`, {}, token);
  const result: ApiResponse<User[]> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to search users');
  }
  return result.data;
}

// Upload APIs
export async function uploadImage(
  file: File,
  token: string | null,
  isPublic: boolean = false
): Promise<{ url: string; isPublic: boolean }> {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('isPublic', isPublic.toString());

  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}/api/upload/image`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const result: ApiResponse<{ url: string; isPublic: boolean }> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to upload image');
  }
  return result.data;
}

