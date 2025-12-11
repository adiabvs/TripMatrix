# Travel Diary Feature

## Overview

The Travel Diary feature allows users to create beautiful travel diaries from their completed trips using Adobe Express. Users can create and edit their travel diaries directly in an embedded Adobe Express editor.

## Features

### 1. Adobe Express Integration
- **Embedded Editor**: Full Adobe Express editor embedded in the application
- **Auto-Save**: Designs are automatically saved when users save in Adobe Express
- **Mobile-Friendly**: Works seamlessly on all devices
- **No OAuth Required**: Simpler setup than other design tools

### 2. Diary Creation
- Users can create a travel diary after completing a trip
- The diary is linked to the trip and can be edited anytime
- All design work happens in the embedded Adobe Express editor

### 3. Editing
- Users can edit their diary at any time
- Changes are saved automatically
- Design ID and editor URL are stored for future access

## Setup

### 1. Adobe Express Client ID

1. Go to [Adobe Developer Console](https://developer.adobe.com/console)
2. Sign in with your Adobe account
3. Create a new project or select an existing one
4. Add the **Adobe Express Embed SDK** integration
5. Copy your **Client ID**

### 2. Environment Variables

Add to `apps/frontend/.env.local`:

```env
NEXT_PUBLIC_ADOBE_EXPRESS_CLIENT_ID=your_client_id_here
```

**Important**: The variable must start with `NEXT_PUBLIC_` to be accessible in the browser.

## Usage

### Creating a Travel Diary

1. Complete a trip (mark it as completed)
2. Go to the trip detail page
3. Click "Create Travel Diary"
4. The Adobe Express editor opens embedded in the page
5. Create your travel diary design
6. Save your design - it's automatically stored

### Editing a Travel Diary

1. Go to the travel diary page for your trip
2. Click "Edit Diary" or "Create/Edit Diary in Adobe Express"
3. The editor opens with your existing design (if any)
4. Make your changes
5. Save - changes are automatically stored

## API Endpoints

### POST /api/diary/generate/:tripId
Creates a new travel diary record for a completed trip.

**Response:**
```json
{
  "success": true,
  "data": {
    "diaryId": "...",
    "tripId": "...",
    "title": "...",
    "description": "...",
    "coverImageUrl": "...",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### GET /api/diary/trip/:tripId
Retrieves the diary for a given trip.

**Response:**
```json
{
  "success": true,
  "data": {
    "diaryId": "...",
    "tripId": "...",
    "title": "...",
    "adobeExpressDesignId": "...",
    "adobeExpressEditorUrl": "...",
    ...
  }
}
```

### PATCH /api/diary/:diaryId
Updates a diary (e.g., after Adobe Express editing).

**Body:** { adobeExpressDesignId?, adobeExpressEditorUrl?, videoUrl? }

## File Structure

```
apps/
├── backend/
│   └── src/
│       └── routes/
│           └── diary.ts          # Diary API routes
└── frontend/
    └── src/
        ├── app/
        │   └── trips/
        │       └── [tripId]/
        │           └── diary/
        │               └── page.tsx  # Diary page
        └── components/
            └── AdobeExpressEditor.tsx  # Adobe Express editor component
```

## Component: AdobeExpressEditor

The `AdobeExpressEditor` component embeds the Adobe Express editor in your application.

**Props:**
- `clientId` (required): Your Adobe Express Client ID
- `designId` (optional): Existing design ID to edit
- `onDesignSave` (optional): Callback when design is saved
- `onError` (optional): Callback for errors

**Example:**
```tsx
<AdobeExpressEditor
  clientId={process.env.NEXT_PUBLIC_ADOBE_EXPRESS_CLIENT_ID}
  designId={diary.adobeExpressDesignId}
  onDesignSave={(designId, editorUrl) => {
    // Save design ID and editor URL
  }}
  onError={(error) => {
    // Handle errors
  }}
/>
```

## Data Model

### TravelDiary

```typescript
interface TravelDiary {
  diaryId: string;
  tripId: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  adobeExpressDesignId?: string;  // Adobe Express design ID
  adobeExpressEditorUrl?: string;  // Adobe Express editor URL
  videoUrl?: string;               // Video (future feature)
  createdAt: Date | string;
  updatedAt: Date | string;
}
```

## Mobile Support

- Adobe Express editor is fully responsive
- Works on all screen sizes
- Touch-friendly interface

## Troubleshooting

### Editor Not Loading

- Ensure `NEXT_PUBLIC_ADOBE_EXPRESS_CLIENT_ID` is set correctly
- Check that your Adobe Developer Console project is active
- Verify the SDK script loads: `https://sdk.adobe.com/express/embed-sdk.js`

### Design Not Saving

- Check browser console for errors
- Verify network connectivity
- Ensure Adobe Express Client ID has proper permissions

## Resources

- [Adobe Express Embed SDK Documentation](https://developer.adobe.com/express/embed-sdk/)
- [Adobe Developer Console](https://developer.adobe.com/console)
