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
export interface ImageMetadata {
  url: string;
  isPublic: boolean;
}

export interface TripPlace {
  placeId: string;
  tripId: string;
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  visitedAt: Date | string;
  comment?: string;
  rewrittenComment?: string;
  rating?: number; // 1-5
  imageMetadata?: ImageMetadata[];
  images?: string[]; // Legacy support
  modeOfTravel?: ModeOfTravel | null;
  distanceFromPrevious?: number; // in meters
  timeFromPrevious?: number; // in seconds
  country?: string; // Country code
  createdAt: Date | string;
}

// Expense Types
export interface ExpenseShare {
  participant: string; // uid or guestName
  amount: number;
}

export interface TripExpense {
  expenseId: string;
  tripId: string;
  amount: number;
  currency: string;
  paidBy: string; // uid or guestName
  splitBetween: string[]; // Array of uids or guestNames
  calculatedShares: Record<string, number>; // Map of participant to share amount
  description?: string;
  placeId?: string; // Optional: link expense to a place
  createdAt: Date | string;
}

// Public Trip View (for public trip pages)
export interface PublicTripView extends Trip {
  places: TripPlace[];
  expenses: TripExpense[];
}

export interface ExpenseSummary {
  totalSpent: number;
  expensePerPlace: Record<string, number>;
  expensePerCategory: Record<string, number>;
  splitDue: Record<string, number>;
  settlements: Settlement[];
}

export interface Settlement {
  from: string; // uid or guestName
  to: string; // uid or guestName
  amount: number;
}

// AI Types
export type RewriteTone = 'casual' | 'formal' | 'poetic' | 'humorous' | 'friendly';

export interface RewriteRequest {
  text: string;
  style?: RewriteTone;
  tone?: RewriteTone; // Legacy support
}

export interface RewriteResponse {
  original: string;
  rewritten: string;
  rewrittenText?: string; // Legacy support
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Book/Diary Types
export interface TravelDiary {
  diaryId: string;
  tripId: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  adobeExpressDesignId?: string; // Adobe Express design ID for editing
  adobeExpressEditorUrl?: string; // Adobe Express editor URL
  videoUrl?: string; // Video of book opening
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface DiaryPage {
  pageNumber: number;
  type: 'cover' | 'chapter' | 'photo' | 'closing';
  content: {
    title?: string;
    text?: string;
    images?: string[];
    modeOfTravel?: ModeOfTravel;
    fromPlace?: string;
    toPlace?: string;
  };
}
