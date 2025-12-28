# Canva Template Setup

## Template Information

**Template URL**: https://www.canva.com/design/DAG8PtKY0TE/gxzfmNhwrKsX2-xMTLnDjQ

**Template ID**: `DAG8PtKY0TE`

**Template Field Names** (exact names to use in Canva):
- `time` - Time at top (text)
- `place` - Place name below time (text)
- `comments` - Comments on the left (text)
- `cover_image` - Cover image in the middle (image)
- `temperature` - Temperature at bottom-right (text)

## Setup Steps

1. **Add Template ID to Environment Variables**

   Add to `apps/backend/.env`:
   ```env
   CANVA_BRAND_TEMPLATE_ID=DAG8PtKY0TE
   ```

2. **Verify Template Fields in Canva**

   Make sure your template has these exact field names:
   - Open the template in Canva
   - Use the "Data autofill" app
   - Verify field names match: `time`, `place`, `comments`, `cover_image`, `temperature`

3. **Restart Backend Server**

   After adding the environment variable, restart your backend server.

## How It Works

The system will:
1. Query your template to get available fields
2. Upload all trip images to Canva
3. Map trip data to template fields:
   - `time` → Time from `visitedAt` (formatted as HH:MM AM/PM)
   - `place` → Place name
   - `comments` → Place description/comment
   - `cover_image` → First image from place (or trip cover image)
   - `temperature` → Empty (can be extended later)
4. Create autofill job to generate the design
5. Return the generated design URL

## Field Mapping Details

- **time**: Extracted from `place.visitedAt` timestamp, formatted as "2:30 PM"
- **place**: Uses `place.name`
- **comments**: Uses `place.rewrittenComment` or `place.comment`
- **cover_image**: Uses first image from `place.imageMetadata` or `place.images`, falls back to `trip.coverImage`
- **temperature**: Left empty (can be populated if you add weather data to places)

## Notes

- Currently creates one design with the first place's data
- You can duplicate the slide in Canva for other places
- All images are uploaded to your Canva media library
- The design will be automatically populated with the first place's data


