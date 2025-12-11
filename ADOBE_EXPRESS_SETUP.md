# Adobe Express Embed SDK Setup Guide

## Overview

TripMatrix now uses **Adobe Express Embed SDK** for creating and editing travel diaries. This provides a seamless, embedded editing experience directly in your application.

## Step 1: Get Adobe Express Client ID and Configure Allowed Domains

1. Go to [Adobe Developer Console](https://developer.adobe.com/console)
2. Sign in with your Adobe account
3. Create a new project or select an existing one
4. Add the **Adobe Express Embed SDK** integration
5. Copy your **Client ID**
6. **IMPORTANT**: Configure Allowed Domains:
   - In your Adobe Developer Console project, find the **"Allowed Domains"** or **"Redirect URIs"** section
   - Add your domains:
     - For local development: `http://localhost:3000` (or your dev port)
     - For production: `https://yourdomain.com` (without trailing slash)
   - **The domain must match exactly** (including protocol and port for localhost)
   - Save the changes

## Step 2: Configure Environment Variables

Add to your `apps/frontend/.env.local`:

```env
NEXT_PUBLIC_ADOBE_EXPRESS_CLIENT_ID=your_client_id_here
```

**Important**: The variable must start with `NEXT_PUBLIC_` to be accessible in the browser.

## Step 3: How It Works

### Creating a Travel Diary

1. Complete a trip (mark it as completed)
2. Go to the trip detail page
3. Click "Create Travel Diary"
4. The Adobe Express editor will open embedded in the page
5. Create your travel diary design
6. Save your design - it will be automatically stored

### Editing a Travel Diary

1. Go to the travel diary page for your trip
2. Click "Edit Diary" or "Create/Edit Diary in Adobe Express"
3. The editor opens with your existing design (if any)
4. Make your changes
5. Save - changes are automatically stored

## Features

- ✅ **Embedded Editor**: Edit directly in your app, no external redirects
- ✅ **Auto-Save**: Designs are automatically saved when you save in Adobe Express
- ✅ **Mobile-Friendly**: Works on all devices
- ✅ **No OAuth Required**: Simpler setup than Canva
- ✅ **Professional Tools**: Full Adobe Express design capabilities

## Troubleshooting

### Error: "Adobe Express Client ID not configured"

**Solution**: Make sure `NEXT_PUBLIC_ADOBE_EXPRESS_CLIENT_ID` is set in your `.env.local` file and restart your Next.js dev server.

### Error: "Failed to load Adobe Express SDK"

**Solution**: 
- Check your internet connection
- Verify the SDK script URL is accessible: `https://cc-embed.adobe.com/sdk/v4/CCEverywhere.js`
- Check browser console for specific errors

### Editor Not Loading

**Solution**:
- Ensure your Client ID is correct
- Check that your Adobe Developer Console project is active
- Verify you have the necessary permissions in Adobe Developer Console

### Error: "Framing 'https://new.express.adobe.com/' violates Content Security Policy"

**This is a CSP (Content Security Policy) error. Solution:**

1. **Add Your Domain to Allowed Domains in Adobe Developer Console:**
   - Go to your project in [Adobe Developer Console](https://developer.adobe.com/console)
   - Find the **"Allowed Domains"** or **"Redirect URIs"** section
   - Add your exact domain:
     - For localhost: `http://localhost:3000` (must include port if using one)
     - For production: `https://yourdomain.com`
   - **Important**: The domain must match exactly, including:
     - Protocol (`http://` or `https://`)
     - Port number (for localhost: `:3000`)
     - No trailing slash
   - Save and wait a few minutes for changes to propagate

2. **Use HTTPS for Local Development (Recommended):**
   - Adobe Express Embed SDK works better with HTTPS
   - For Next.js, you can set up HTTPS for localhost
   - Or use a tool like [ngrok](https://ngrok.com/) to create an HTTPS tunnel

3. **Verify Domain Registration:**
   - Some integrations require business approval from Adobe
   - Check if your integration needs approval in the Adobe Developer Console
   - Contact Adobe support if domain registration is required

4. **Check Browser Console:**
   - The error message will show which domains are allowed
   - Make sure your domain matches one of the allowed domains exactly

### Error: "TARGET_LOAD_TIMED_OUT" or "Timeout loading iframe"

**Solution**:
- This usually happens when CSP blocks the iframe
- Follow the CSP error solution above
- Ensure your domain is properly registered in Adobe Developer Console
- Try refreshing the page after adding your domain

## API Reference

### Adobe Express Editor Component

```tsx
<AdobeExpressEditor
  clientId="your_client_id"
  designId="optional_existing_design_id"
  onDesignSave={(designId, editorUrl) => {
    // Handle save
  }}
  onError={(error) => {
    // Handle errors
  }}
/>
```

### Props

- `clientId` (required): Your Adobe Express Client ID
- `designId` (optional): Existing design ID to edit
- `onDesignSave` (optional): Callback when design is saved
- `onError` (optional): Callback for errors

## Next Steps

1. Get your Client ID from Adobe Developer Console
2. Add it to your `.env.local`
3. Restart your frontend server
4. Create a travel diary and enjoy the embedded editing experience!

## Resources

- [Adobe Express Embed SDK Documentation](https://developer.adobe.com/express/embed-sdk/)
- [Adobe Developer Console](https://developer.adobe.com/console)

