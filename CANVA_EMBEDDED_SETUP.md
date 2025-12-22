# Canva Embedded Editor Setup

## Overview

This implementation uses Canva OAuth with an embedded editor that opens in a modal dialog within your app - no full page redirects!

## Features

✅ **Popup OAuth** - OAuth happens in a popup window, not a full page redirect
✅ **Embedded Editor** - Canva editor opens in a modal dialog within your app
✅ **No Redirects** - Users stay in your app throughout the process
✅ **Automatic Token Management** - Tokens refresh automatically

## How It Works

1. **User clicks "Connect with Canva"**
   - Opens OAuth in a popup window (600x700px)
   - User authorizes in the popup
   - Popup closes automatically after authorization
   - User stays on your page

2. **User creates/edits design**
   - Design is created via API
   - Editor opens in a full-screen modal dialog
   - User edits directly in the embedded iframe
   - Changes are saved automatically by Canva

3. **User closes editor**
   - Modal closes
   - Design is already saved
   - User can view the design preview below

## Setup

### 1. Backend Environment Variables

Add to `apps/backend/.env`:

```env
CANVA_CLIENT_ID=your_client_id_here
CANVA_CLIENT_SECRET=your_client_secret_here
CANVA_REDIRECT_URI=http://localhost:3001/api/canva/callback
FRONTEND_URL=http://localhost:3000
```

### 2. Frontend Environment Variables

Add to `apps/frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Canva Developer Console

1. Go to https://www.canva.dev/
2. Add redirect URI: `http://localhost:3001/api/canva/callback`
3. Copy Client ID and Secret

## User Experience

1. User is on diary page
2. Clicks "Connect with Canva" → Popup opens
3. Authorizes in popup → Popup closes
4. Clicks "Create Travel Diary in Canva" → Modal opens with editor
5. Edits in embedded editor → Changes save automatically
6. Closes modal → Sees preview of design

**No page redirects! Everything happens in popups/modals.**

## Technical Details

- **OAuth Flow**: Popup window (not full page redirect)
- **Editor**: Embedded iframe in Material-UI Dialog
- **Token Storage**: Firestore (user-specific, secure)
- **Token Refresh**: Automatic on backend

## Troubleshooting

### Popup Blocked
- **Solution**: Browser may block popups. User needs to allow popups for your site.

### Editor Not Loading
- **Solution**: Check browser console for iframe/CSP errors
- **Solution**: Canva may require specific domains to be whitelisted

### Token Issues
- **Solution**: Tokens refresh automatically
- **Solution**: If refresh fails, user needs to reconnect

## Benefits Over Redirect Approach

✅ Better UX - users stay in your app
✅ No page reloads
✅ Seamless experience
✅ Professional appearance
✅ Users can see their app context while editing






