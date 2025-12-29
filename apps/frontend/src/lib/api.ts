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
  TravelDiary,
  PlaceComment,
  TripComment,
  Notification,
} from '@tripmatrix/types';

// Normalize API URL - remove port from HTTPS URLs (Railway uses default HTTPS port)
function normalizeApiUrl(url: string): string {
  if (!url) return 'http://localhost:3001';
  // Remove port from HTTPS URLs (Railway/production)
  if (url.startsWith('https://')) {
    return url.replace(/:\d+$/, ''); // Remove trailing :PORT
  }
  return url;
}

const API_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');

async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {},
  token: string | null
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Add authorization header only if token is provided (for public trips, token can be null)
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMessage = error.error || `HTTP ${response.status}`;
    const errorObj = new Error(errorMessage);
    (errorObj as any).status = response.status;
    throw errorObj;
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
  token: string | null,
  status?: string
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

export async function deleteTrip(tripId: string, token: string | null): Promise<void> {
  const response = await fetchWithAuth(`/api/trips/${tripId}`, {
    method: 'DELETE',
  }, token);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
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

export async function removeParticipants(
  tripId: string,
  participants: string[],
  token: string | null
): Promise<{ participants: any[] }> {
  const response = await fetchWithAuth(`/api/trips/${tripId}/participants`, {
    method: 'DELETE',
    body: JSON.stringify({ participants }),
  }, token);
  const result: ApiResponse<{ participants: any[] }> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to remove participants');
  }
  return result.data;
}

export async function getPublicTrips(search?: string): Promise<Trip[]> {
  const url = new URL(`${API_URL}/api/trips/public/list`);
  if (search) {
    url.searchParams.append('search', search);
  }
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(error.error || 'Failed to fetch public trips');
  }
  
  const result: ApiResponse<Trip[]> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch public trips');
  }
  return result.data;
}

export async function getPublicTripsWithData(
  limit: number = 20,
  lastTripId?: string,
  token?: string | null
): Promise<{
  trips: Trip[];
  placesByTrip: Record<string, TripPlace[]>;
  routesByTrip: Record<string, TripRoute[]>;
  creators: Record<string, User>;
  hasMore: boolean;
  lastTripId: string | null;
}> {
  const url = new URL(`${API_URL}/api/trips/public/list/with-data`);
  url.searchParams.append('limit', limit.toString());
  if (lastTripId) {
    url.searchParams.append('lastTripId', lastTripId);
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(error.error || 'Failed to fetch public trips with data');
  }
  
  const result: ApiResponse<{
    trips: Trip[];
    placesByTrip: Record<string, TripPlace[]>;
    routesByTrip: Record<string, TripRoute[]>;
    creators: Record<string, User>;
    hasMore: boolean;
    lastTripId: string | null;
  }> = await response.json();
  
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch public trips with data');
  }
  return result.data;
}

// Search trips by user, place, or keyword
export async function searchTrips(
  query: string,
  type?: 'user' | 'place' | 'trip' | 'all',
  limit: number = 20,
  lastTripId?: string,
  token?: string | null
): Promise<{
  trips: Trip[];
  users: User[];
  hasMore: boolean;
  lastTripId: string | null;
}> {
  const url = new URL(`${API_URL}/api/trips/search`);
  url.searchParams.append('q', query);
  if (type) {
    url.searchParams.append('type', type);
  }
  url.searchParams.append('limit', limit.toString());
  if (lastTripId) {
    url.searchParams.append('lastTripId', lastTripId);
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(error.error || 'Failed to search trips');
  }
  
  const result: ApiResponse<{
    trips: Trip[];
    users: User[];
    hasMore: boolean;
    lastTripId: string | null;
  }> = await response.json();
  
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to search trips');
  }
  
  return result.data;
}

// Trip Like APIs
export async function likeTrip(tripId: string, token: string | null): Promise<void> {
  const response = await fetchWithAuth(`/api/trips/${tripId}/like`, {
    method: 'POST',
  }, token);
  const result: ApiResponse<{ liked: boolean; message: string }> = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to like trip');
  }
}

export async function unlikeTrip(tripId: string, token: string | null): Promise<void> {
  const response = await fetchWithAuth(`/api/trips/${tripId}/like`, {
    method: 'DELETE',
  }, token);
  const result: ApiResponse<{ liked: boolean; message: string }> = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to unlike trip');
  }
}

export async function getTripLikes(tripId: string, token: string | null): Promise<{ likeCount: number; isLiked: boolean }> {
  const response = await fetchWithAuth(`/api/trips/${tripId}/likes`, {}, token);
  const result: ApiResponse<{ likeCount: number; isLiked: boolean }> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to get trip likes');
  }
  return result.data;
}

export async function getTripCommentCount(tripId: string, token: string | null): Promise<number> {
  const response = await fetchWithAuth(`/api/trips/${tripId}/comments/count`, {}, token);
  const result: ApiResponse<{ commentCount: number }> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to get comment count');
  }
  return result.data.commentCount;
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

export async function getTripPlaces(
  tripId: string,
  token: string | null
): Promise<TripPlace[]> {
  const response = await fetchWithAuth(`/api/places/trip/${tripId}`, {}, token);
  const result: ApiResponse<TripPlace[]> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch places');
  }
  return result.data;
}

export async function updatePlace(
  placeId: string,
  updates: Partial<TripPlace>,
  token: string | null
): Promise<TripPlace> {
  const response = await fetchWithAuth(`/api/places/${placeId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }, token);
  const result: ApiResponse<TripPlace> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to update place');
  }
  return result.data;
}

export async function deletePlace(
  placeId: string,
  token: string | null
): Promise<void> {
  const response = await fetchWithAuth(`/api/places/${placeId}`, {
    method: 'DELETE',
  }, token);
  const result: ApiResponse<{ placeId: string }> = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to delete place');
  }
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

export async function updateExpense(
  expenseId: string,
  expenseData: Partial<TripExpense>,
  token: string | null
): Promise<TripExpense> {
  const response = await fetchWithAuth(`/api/expenses/${expenseId}`, {
    method: 'PATCH',
    body: JSON.stringify(expenseData),
  }, token);
  const result: ApiResponse<TripExpense> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to update expense');
  }
  return result.data;
}

export async function deleteExpense(
  expenseId: string,
  token: string | null
): Promise<void> {
  const response = await fetchWithAuth(`/api/expenses/${expenseId}`, {
    method: 'DELETE',
  }, token);
  const result: ApiResponse<{ expenseId: string }> = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to delete expense');
  }
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

export async function updateUser(
  updates: { country?: string; defaultCurrency?: string; isProfilePublic?: boolean },
  token: string | null
): Promise<User> {
  const response = await fetchWithAuth('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }, token);
  const result: ApiResponse<User> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to update user');
  }
  return result.data;
}

export async function followUser(userId: string, token: string | null): Promise<void> {
  const response = await fetchWithAuth(`/api/users/${userId}/follow`, {
    method: 'POST',
  }, token);
  const result: ApiResponse<{ message: string }> = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to follow user');
  }
}

export async function unfollowUser(userId: string, token: string | null): Promise<void> {
  const response = await fetchWithAuth(`/api/users/${userId}/unfollow`, {
    method: 'POST',
  }, token);
  const result: ApiResponse<{ message: string }> = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to unfollow user');
  }
}

export async function getFollowing(token: string | null): Promise<User[]> {
  const response = await fetchWithAuth('/api/users/me/following', {}, token);
  const result: ApiResponse<User[]> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to get following list');
  }
  return result.data;
}

export async function getUser(userId: string, token: string | null): Promise<User> {
  const response = await fetchWithAuth(`/api/users/${userId}`, {}, token);
  const result: ApiResponse<User> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to get user');
  }
  return result.data;
}

// Notification APIs
export async function getNotifications(token: string | null): Promise<Notification[]> {
  const response = await fetchWithAuth(`/api/notifications`, {}, token);
  const result: ApiResponse<Notification[]> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to get notifications');
  }
  return result.data;
}

export async function getUnreadNotificationCount(token: string | null): Promise<number> {
  const response = await fetchWithAuth(`/api/notifications/unread/count`, {}, token);
  const result: ApiResponse<{ count: number }> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to get notification count');
  }
  return result.data.count;
}

export async function markNotificationAsRead(notificationId: string, token: string | null): Promise<void> {
  const response = await fetchWithAuth(`/api/notifications/${notificationId}/read`, {
    method: 'PATCH',
  }, token);
  const result: ApiResponse<void> = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to mark notification as read');
  }
}

export async function markAllNotificationsAsRead(token: string | null): Promise<void> {
  const response = await fetchWithAuth(`/api/notifications/read-all`, {
    method: 'PATCH',
  }, token);
  const result: ApiResponse<void> = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to mark all notifications as read');
  }
}

export async function acceptTripInvitation(notificationId: string, token: string | null): Promise<Trip> {
  const response = await fetchWithAuth(`/api/notifications/${notificationId}/accept-invitation`, {
    method: 'POST',
  }, token);
  const result: ApiResponse<{ trip: Trip }> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to accept invitation');
  }
  return result.data.trip;
}

export async function rejectTripInvitation(notificationId: string, token: string | null): Promise<void> {
  const response = await fetchWithAuth(`/api/notifications/${notificationId}/reject-invitation`, {
    method: 'POST',
  }, token);
  const result: ApiResponse<void> = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to reject invitation');
  }
}

// Comment APIs
export async function addPlaceComment(
  placeId: string,
  text: string,
  token: string | null
): Promise<PlaceComment> {
  const response = await fetchWithAuth(`/api/places/${placeId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  }, token);
  const result: ApiResponse<PlaceComment> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to add comment');
  }
  return result.data;
}

export async function getPlaceComments(placeId: string, token: string | null): Promise<PlaceComment[]> {
  const response = await fetchWithAuth(`/api/places/${placeId}/comments`, {}, token);
  const result: ApiResponse<PlaceComment[]> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to get comments');
  }
  return result.data;
}

// Trip Comment APIs
export async function addTripComment(
  tripId: string,
  text: string,
  token: string | null
): Promise<TripComment> {
  const response = await fetchWithAuth(`/api/trips/${tripId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  }, token);
  const result: ApiResponse<TripComment> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to add comment');
  }
  return result.data;
}

export async function getTripComments(tripId: string, token: string | null): Promise<TripComment[]> {
  const response = await fetchWithAuth(`/api/trips/${tripId}/comments`, {}, token);
  const result: ApiResponse<TripComment[]> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to get comments');
  }
  return result.data;
}

// Place Like APIs
export async function likePlace(placeId: string, token: string | null): Promise<void> {
  const response = await fetchWithAuth(`/api/places/${placeId}/like`, {
    method: 'POST',
  }, token);
  const result: ApiResponse<{ liked: boolean; message: string }> = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to like place');
  }
}

export async function unlikePlace(placeId: string, token: string | null): Promise<void> {
  const response = await fetchWithAuth(`/api/places/${placeId}/like`, {
    method: 'DELETE',
  }, token);
  const result: ApiResponse<{ liked: boolean; message: string }> = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to unlike place');
  }
}

export async function getPlaceLikes(placeId: string, token: string | null): Promise<{ likeCount: number; isLiked: boolean }> {
  const response = await fetchWithAuth(`/api/places/${placeId}/likes`, {}, token);
  const result: ApiResponse<{ likeCount: number; isLiked: boolean }> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to get place likes');
  }
  return result.data;
}

// Diary APIs
export async function generateDiary(
  tripId: string,
  token: string | null,
  platform: 'canva' | 'pdf' = 'canva'
): Promise<TravelDiary> {
  const response = await fetchWithAuth(`/api/diary/generate/${tripId}`, {
    method: 'POST',
    body: JSON.stringify({ platform }),
  }, token);
  const result: ApiResponse<TravelDiary> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to generate diary');
  }
  return result.data;
}

export async function getDiary(
  tripId: string,
  token: string | null
): Promise<TravelDiary | null> {
  const response = await fetchWithAuth(`/api/diary/trip/${tripId}`, {}, token);
  const result: ApiResponse<TravelDiary> = await response.json();
  if (!result.success) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(result.error || 'Failed to fetch diary');
  }
  return result.data || null;
}

export async function deleteDiary(
  diaryId: string,
  token: string | null
): Promise<void> {
  const response = await fetchWithAuth(`/api/diary/${diaryId}`, {
    method: 'DELETE',
  }, token);
  const result: ApiResponse<void> = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to delete diary');
  }
}

export async function updateDiary(
  diaryId: string,
  updates: Partial<TravelDiary>,
  token: string | null
): Promise<TravelDiary> {
  const response = await fetchWithAuth(`/api/diary/${diaryId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }, token);
  const result: ApiResponse<TravelDiary> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to update diary');
  }
  return result.data;
}

export async function regenerateDesignData(
  diaryId: string,
  token: string | null
): Promise<TravelDiary> {
  const response = await fetchWithAuth(`/api/diary/${diaryId}/regenerate-design-data`, {
    method: 'POST',
  }, token);
  const result: ApiResponse<TravelDiary> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to regenerate design data');
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

  try {
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
  } catch (error: any) {
    // Handle connection errors
    if (error.message?.includes('Failed to fetch') || error.message?.includes('ERR_CONNECTION_RESET')) {
      throw new Error('Connection failed. Please check if the backend server is running and try again.');
    }
    // Re-throw other errors
    throw error;
  }
}

