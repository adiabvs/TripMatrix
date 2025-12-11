// User Types
export interface User {
  uid: string;
  name: string;
  email: string;
  photoUrl?: string;
  country?: string; // ISO country code (e.g., 'US', 'IN', 'GB')
  defaultCurrency?: string; // ISO currency code (e.g., 'USD', 'INR', 'GBP')
  createdAt: Date | string;
}

// Trip Types
export type TripStatus = 'in_progress' | 'completed';
export type ModeOfTravel = 'walk' | 'bike' | 'car' | 'train' | 'bus' | 'flight';

export interface TripParticipant {
  uid?: string; // If linked user
  guestName?: string; // If guest
  guestEmail?: string; // Optional email for guest
  isGuest: boolean;
}

export type PhotoSharingPrivacy = 'everyone' | 'members' | 'creator';
export type ExpenseVisibility = 'everyone' | 'members' | 'creator';

export interface Trip {
  tripId: string;
  creatorId: string;
  title: string;
  description?: string;
  participants: TripParticipant[];
  isPublic: boolean;
  status: TripStatus;
  startTime: Date | string;
  endTime?: Date | string;
  coverImage?: string;
  totalExpense?: number;
  totalDistance?: number;
  defaultPhotoSharing?: PhotoSharingPrivacy; // Default privacy for photos
  expenseVisibility?: ExpenseVisibility; // Who can view expenses
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Route Types
export interface RoutePoint {
  lat: number;
  lng: number;
  timestamp: Date | string;
  modeOfTravel?: ModeOfTravel;
}

export interface TripRoute {
  routeId: string;
  tripId: string;
  points: RoutePoint[];
  modeOfTravel: ModeOfTravel;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Place Types
export interface TripPlace {
  placeId: string;
  tripId: string;
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  visitedAt: Date | string;
  rating?: number; // 1-5
  comment?: string;
  rewrittenComment?: string;
  modeOfTravel?: ModeOfTravel; // How they got here from previous place
  distanceFromPrevious?: number; // in meters
  timeFromPrevious?: number; // in seconds
  images?: string[]; // Array of image URLs (deprecated, use imageMetadata)
  imageMetadata?: Array<{
    url: string;
    isPublic: boolean; // true = public, false = private to trip members
  }>;
  createdAt: Date | string;
}

// Expense Types
export interface ExpenseShare {
  userId: string;
  amount: number;
}

export interface TripExpense {
  expenseId: string;
  tripId: string;
  amount: number;
  currency: string; // ISO currency code (e.g., 'USD', 'INR', 'GBP')
  paidBy: string; // uid or guestName
  splitBetween: string[]; // uids or guestNames
  calculatedShares: Record<string, number>; // userId/guestName -> amount
  description?: string;
  placeId?: string; // If linked to a place
  createdAt: Date | string;
}

// AI Rewrite Types
export type RewriteTone = 'friendly' | 'professional' | 'travel-blog';

export interface RewriteRequest {
  text: string;
  tone: RewriteTone;
}

export interface RewriteResponse {
  rewrittenText: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Public Trip View Types
export interface PublicTripView extends Trip {
  creator: User;
  routes: TripRoute[];
  places: TripPlace[];
  expenses: TripExpense[];
}

// Expense Summary Types
export interface ExpenseSummary {
  totalSpent: number;
  expensePerPlace: Record<string, number>;
  expensePerCategory: Record<string, number>;
  splitDue: Record<string, number>; // userId/guestName -> amount owed
  settlements: Settlement[];
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

// Trip Summary Types
export interface TripSummary {
  tripId: string;
  totalDistance: number;
  totalDuration: number; // in seconds
  totalExpenses: number;
  travelTimeline: RoutePoint[];
  placesVisited: TripPlace[];
  expenseSummary: ExpenseSummary;
}

