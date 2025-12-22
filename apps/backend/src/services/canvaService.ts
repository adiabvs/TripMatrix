/**
 * Canva Service
 * Handles Canva API integration for creating and managing travel diary designs
 */

export interface CanvaConfig {
  apiKey: string;
  clientId?: string;
  clientSecret?: string;
}

export interface CanvaDesign {
  designId: string;
  designUrl: string;
  editorUrl: string;
  thumbnailUrl?: string;
}

/**
 * Create a travel diary design in Canva
 * This function prepares the design data and returns URLs for the Canva Embed SDK
 */
export async function createTravelDiaryDesign(
  config: CanvaConfig,
  trip: {
    title: string;
    description?: string;
    coverImage?: string;
  },
  places: Array<{
    name: string;
    comment?: string;
    rewrittenComment?: string;
    rating?: number;
    imageMetadata?: Array<{ url: string }>;
    images?: string[];
    modeOfTravel?: string | null;
  }>
): Promise<CanvaDesign> {
  // Note: Canva Embed SDK is primarily frontend-based
  // The backend prepares the data structure for the frontend to use
  // The actual design creation happens in the frontend via the Embed SDK
  
  // For now, we'll return a structure that the frontend can use
  // The frontend will use the Embed SDK to create the design
  
  // Generate a unique design ID (this will be replaced by Canva's actual design ID after creation)
  const designId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    designId,
    designUrl: '', // Will be set after design is created in frontend
    editorUrl: '', // Will be set after design is created in frontend
  };
}

/**
 * Get design data structure for Canva Embed SDK
 * This prepares the content structure that will be used to populate the design
 */
export function getTravelDiaryDesignData(
  trip: {
    title: string;
    description?: string;
    coverImage?: string;
  },
  places: Array<{
    name: string;
    comment?: string;
    rewrittenComment?: string;
    rating?: number;
    imageMetadata?: Array<{ url: string }>;
    images?: string[];
    modeOfTravel?: string | null;
  }>
): {
  cover: {
    title: string;
    description?: string;
    coverImage?: string;
  };
  pages: Array<{
    placeName: string;
    description: string;
    rating?: number;
    images: string[];
    modeOfTravel?: string;
  }>;
} {
  // Sort places by visitedAt if available (assuming they're already sorted)
  const sortedPlaces = [...places];

  // Get cover image
  const coverImage = trip.coverImage || sortedPlaces[0]?.imageMetadata?.[0]?.url || sortedPlaces[0]?.images?.[0];

  // Build pages for each place
  const pages = sortedPlaces.map((place, index) => {
    const images: string[] = [];
    
    // Collect images from imageMetadata
    if (place.imageMetadata && place.imageMetadata.length > 0) {
      images.push(...place.imageMetadata.map(img => img.url));
    }
    
    // Collect images from legacy images array
    if (place.images && place.images.length > 0) {
      images.push(...place.images);
    }
    
    // Get description (prefer rewritten comment, fallback to regular comment)
    const description = place.rewrittenComment || place.comment || '';
    
    // Get mode of travel (for previous place to current)
    const modeOfTravel = index > 0 ? sortedPlaces[index - 1]?.modeOfTravel : null;

    // Build page object, only including defined values (Firestore doesn't allow undefined)
    const page: {
      placeName: string;
      description: string;
      images: string[];
      rating?: number;
      modeOfTravel?: string;
    } = {
      placeName: place.name,
      description,
      images,
    };

    // Only add rating if it exists
    if (place.rating !== undefined && place.rating !== null) {
      page.rating = place.rating;
    }

    // Only add modeOfTravel if it exists and is not null
    if (modeOfTravel !== undefined && modeOfTravel !== null) {
      page.modeOfTravel = modeOfTravel;
    }

    return page;
  });

  // Build cover object, only including defined values (Firestore doesn't allow undefined)
  const cover: {
    title: string;
    description?: string;
    coverImage?: string;
  } = {
    title: trip.title,
  };

  // Only add description if it exists
  if (trip.description) {
    cover.description = trip.description;
  }

  // Only add coverImage if it exists
  if (coverImage) {
    cover.coverImage = coverImage;
  }

  return {
    cover,
    pages,
  };
}

