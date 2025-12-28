# Canva Embed SDK Setup Guide

This guide will help you set up Canva Embed SDK for creating travel diaries.

## Prerequisites

1. A Canva account
2. Access to Canva Developer Platform

## Step 1: Get Canva API Key

1. Go to [Canva Developer Platform](https://www.canva.dev/)
2. Sign in with your Canva account
3. Create a new app or select an existing app
4. Navigate to the "API Keys" section
5. Copy your API key

## Step 2: Configure Environment Variables

### Backend (.env)

Add the following to your backend `.env` file:

```env
CANVA_API_KEY=your_canva_api_key_here
```

### Frontend (.env.local)

Add the following to your frontend `.env.local` file:

```env
NEXT_PUBLIC_CANVA_API_KEY=your_canva_api_key_here
```

**Note:** The frontend needs the `NEXT_PUBLIC_` prefix to expose the variable to the browser.

## Step 3: How It Works

1. **Backend Preparation:**
   - When a user generates a travel diary, the backend prepares the design data structure
   - This includes trip information, places, images, descriptions, and ratings
   - The data is stored in the database for the frontend to use

2. **Frontend Creation:**
   - The frontend uses the Canva Embed SDK to open the Canva editor
   - Users can create and edit their travel diary designs directly in Canva
   - When a design is published, the design ID and URL are saved to the database

3. **Editing:**
   - Users can edit their designs at any time
   - Changes are automatically saved to Canva
   - The design can be viewed and downloaded

## Step 4: Testing

1. Start your backend server:
   ```bash
   cd apps/backend
   pnpm dev
   ```

2. Start your frontend server:
   ```bash
   cd apps/frontend
   pnpm dev
   ```

3. Navigate to a completed trip and click "Create Travel Diary"
4. Click "Create Travel Diary in Canva" to open the Canva editor
5. Design your travel diary in Canva
6. Publish the design - it will be automatically saved

## Troubleshooting

### "Failed to load Canva Embed SDK"
- Check your internet connection
- Verify that `https://sdk.canva.com/v1/embed.js` is accessible
- Check browser console for CORS or CSP errors

### "Canva editor not initialized"
- Verify that `NEXT_PUBLIC_CANVA_API_KEY` is set correctly
- Check that the API key is valid
- Ensure the Canva SDK script loaded successfully

### "Design not saving"
- Check that the `onDesignCreated` callback is working
- Verify backend API endpoint is accessible
- Check browser console and backend logs for errors

### API Key Issues
- Make sure your API key is active in Canva Developer Platform
- Verify the key has the necessary permissions
- Check that you're using the correct key for your app

## Canva Embed SDK Documentation

For more information, visit:
- [Canva Developer Documentation](https://www.canva.dev/docs/)
- [Canva Embed SDK Reference](https://www.canva.dev/docs/embed/)

## Features

- ✅ Create travel diary designs in Canva
- ✅ Edit existing designs
- ✅ View designs in embedded viewer
- ✅ Download designs
- ✅ Automatic saving of design IDs and URLs

## Next Steps

1. Set up your Canva API key
2. Configure environment variables
3. Test the integration
4. Customize the design templates (optional)







