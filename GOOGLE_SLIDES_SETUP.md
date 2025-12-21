# Google Slides Travel Diary Setup

This guide explains how to set up Google Slides integration for the travel diary feature.

## Overview

The travel diary feature automatically generates a beautiful Google Slides presentation from completed trips, including:
- Cover slide with trip photo, title, and description
- Step slides with photos, descriptions, ratings, and mode of transport
- Automatic storage in Google Drive
- Edit and download capabilities

## Prerequisites

1. Google Cloud Platform (GCP) account
2. A GCP project with Google Slides API and Google Drive API enabled

## Setup Steps

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project ID

### 2. Enable Required APIs

1. In Google Cloud Console, go to "APIs & Services" > "Library"
2. Enable the following APIs:
   - **Google Slides API**
   - **Google Drive API**

### 3. Create a Service Account

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in:
   - **Name**: `tripmatrix-slides-service` (or any name you prefer)
   - **Description**: Service account for generating travel diary slides
4. Click "Create and Continue"
5. Skip the optional steps (role and user access)
6. Click "Done"

### 4. Generate Service Account Key

1. Click on the service account you just created
2. Go to the "Keys" tab
3. Click "Add Key" > "Create new key"
4. Choose "JSON" format
5. Click "Create" - this downloads a JSON file

### 5. Extract Credentials from JSON

Open the downloaded JSON file. You'll need:
- `client_email`: The service account email
- `private_key`: The private key (keep the `\n` characters)

Example:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "tripmatrix-slides-service@your-project-id.iam.gserviceaccount.com",
  ...
}
```

### 6. Set Environment Variables

Add these to your backend `.env` file:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=tripmatrix-slides-service@your-project-id.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_FOLDER_ID=your-folder-id-here
```

**Optional: Google Drive Folder**
- If you want to store all slides in a specific folder, add `GOOGLE_DRIVE_FOLDER_ID`
- Get the folder ID from the URL: `https://drive.google.com/drive/folders/FOLDER_ID`
- Make sure to share the folder with your service account email (give it "Editor" permissions)

**Important Notes:**
- The private key must be in quotes and include the `\n` characters
- For Railway/production, add these as environment variables in your project settings
- Never commit the JSON file or private key to version control

### 7. Share Google Drive Folder (Optional)

If you want to organize slides in a specific folder:

1. Create a folder in Google Drive
2. Share it with your service account email (from step 5)
3. Give it "Editor" permissions
4. Note the folder ID from the URL: `https://drive.google.com/drive/folders/FOLDER_ID`

You can then modify the service to save slides in this folder.

## How It Works

1. **User completes a trip** - Trip status is set to "completed"
2. **User clicks "Create Travel Diary"** - Frontend calls `/api/diary/generate/:tripId`
3. **Backend generates slides**:
   - Creates a new Google Slides presentation
   - Adds cover slide with trip photo, title, and description
   - Adds a slide for each trip step with photos, description, rating, and mode of transport
   - Stores presentation ID and URL in database
4. **User can view/edit**:
   - View embedded slides in the app
   - Open in Google Slides for full editing
   - Download as PDF

## Slide Structure

### Cover Slide
- Large trip cover image (if available)
- Trip title in elegant font (Playfair Display, 72pt)
- Trip description (if available) in readable font (Lato, 18pt)

### Step Slides
Each step gets its own slide with:
- Step name as title (Montserrat, 48pt)
- Up to 3 photos in a row
- Description/comment (if available)
- Rating with stars (if available)
- Mode of transport indicator at bottom (if not first step)

## Troubleshooting

### Error: "Google service account not configured"
- Check that `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` are set
- Verify the private key includes `\n` characters and is in quotes

### Error: "Failed to create Google Slides"
- Verify Google Slides API is enabled
- Check service account has proper permissions
- Ensure private key is correctly formatted

### Slides not appearing
- Check browser console for errors
- Verify the presentation ID is saved in the database
- Try refreshing the page

### Images not loading
- Ensure image URLs are publicly accessible
- Check CORS settings if images are on your own server
- Verify image URLs are valid

## Security Best Practices

1. **Never commit credentials**:
   - Add `.env` to `.gitignore`
   - Never commit the service account JSON file

2. **Use environment variables**:
   - Store credentials in environment variables
   - Use secrets management in production (Railway, Vercel, etc.)

3. **Limit service account permissions**:
   - Only grant necessary permissions
   - Use principle of least privilege

4. **Rotate keys regularly**:
   - Generate new keys periodically
   - Revoke old keys when no longer needed

## Cost Considerations

- Google Slides API: Free tier includes generous quotas
- Google Drive API: Free tier includes 15GB storage
- Additional storage: $0.005/GB/month (if needed)

For most use cases, the free tier is sufficient.

## Support

If you encounter issues:
1. Check the backend logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure APIs are enabled in Google Cloud Console
4. Check service account permissions

