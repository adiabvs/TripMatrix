# Canva Auto-Generate Travel Diary Flow

## Overview

When a user clicks "Generate Diary", the system automatically:
1. Creates a Canva presentation with all trip photos and comments
2. Opens it in an embedded editor for editing
3. No manual design creation needed!

## Flow

### Step 1: User Connects Canva (One-Time)
- User clicks "Connect with Canva"
- OAuth popup opens
- User authorizes
- Token stored in Firestore

### Step 2: User Clicks "Generate Diary"
- Backend checks for Canva token
- If no token: Shows error "Please connect Canva first"
- If token exists:
  - Creates Canva presentation
  - Adds cover page with trip title and cover image
  - Adds pages for each place with:
    - Place name
    - Photos (up to 3 per page)
    - Comments/descriptions
    - Ratings (if available)
    - Mode of travel (if available)
  - Returns design ID and URLs

### Step 3: Embedded Editor Opens Automatically
- Frontend receives design ID
- Embedded editor opens automatically in modal
- User can edit the presentation
- Changes save automatically

## Backend Changes

### `apps/backend/src/routes/diary.ts`
- Modified `POST /api/diary/generate/:tripId`
- Now checks for Canva OAuth token
- Calls `generateTravelDiaryDesign()` to create design with content
- Returns design ID and URLs immediately

### `apps/backend/src/services/canvaDesignGenerator.ts`
- New service for generating Canva designs
- `generateTravelDiaryDesign()` - Main function
- `populateDesignWithContent()` - Adds images, text, etc.
- Uses Canva Design Editing API to add content programmatically

## Frontend Changes

### `apps/frontend/src/components/CanvaEmbeddedEditor.tsx`
- Auto-opens editor when `designId` is provided
- Shows helpful messages
- Handles OAuth in popup (no redirects)

### `apps/frontend/src/app/trips/[tripId]/diary/page.tsx`
- Updated `handleGenerateDiary()` to show success message
- Automatically opens editor after generation

## API Endpoints

### `POST /api/diary/generate/:tripId`
**Requires:** Canva OAuth token (user must connect Canva first)

**Response:**
```json
{
  "success": true,
  "data": {
    "diaryId": "...",
    "canvaDesignId": "...",
    "canvaDesignUrl": "...",
    "canvaEditorUrl": "...",
    "designData": { ... }
  }
}
```

**Error if no Canva token:**
```json
{
  "success": false,
  "error": "Canva not connected. Please connect your Canva account first..."
}
```

## User Experience

1. **First Time:**
   - User clicks "Connect with Canva" → Popup → Authorize
   - User clicks "Generate Diary" → Design created → Editor opens

2. **Subsequent Times:**
   - User clicks "Generate Diary" → Design created → Editor opens
   - No need to reconnect (token is stored)

3. **Editing:**
   - Editor opens automatically after generation
   - User can edit directly in embedded modal
   - Changes save automatically
   - User closes modal when done

## Notes

- Canva Design Editing API might have limitations
- If content population fails, design is still created (user can edit manually)
- Token refresh happens automatically
- All OAuth happens in popup (no redirects)






