# Canva OAuth Integration Setup Guide

This guide will help you set up Canva OAuth integration using Client ID and Secret.

## Prerequisites

1. A Canva account
2. Access to Canva Developer Platform
3. A registered Canva application

## Step 1: Get Canva OAuth Credentials

1. Go to [Canva Developer Platform](https://www.canva.dev/)
2. Sign in with your Canva account
3. Create a new app or select an existing app
4. Go to **OAuth** or **Credentials** section
5. Copy your:
   - **Client ID**
   - **Client Secret**

## Step 2: Configure Redirect URI

In your Canva app settings:

1. Add authorized redirect URIs:
   - For development: `http://localhost:3001/api/canva/callback`
   - For production: `https://your-backend-domain.com/api/canva/callback`

**Important:** The redirect URI must match exactly what you configure in your backend.

## Step 3: Backend Environment Variables

Add to `apps/backend/.env`:

```env
CANVA_CLIENT_ID=your_client_id_here
CANVA_CLIENT_SECRET=your_client_secret_here
CANVA_REDIRECT_URI=http://localhost:3001/api/canva/callback
FRONTEND_URL=http://localhost:3000
```

For production:
```env
CANVA_CLIENT_ID=your_client_id_here
CANVA_CLIENT_SECRET=your_client_secret_here
CANVA_REDIRECT_URI=https://your-backend-domain.com/api/canva/callback
FRONTEND_URL=https://your-frontend-domain.com
```

## Step 4: Frontend Environment Variables

Add to `apps/frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

For production:
```env
NEXT_PUBLIC_API_URL=https://your-backend-domain.com
```

## Step 5: How It Works

1. **User clicks "Connect with Canva"**
   - Frontend calls `/api/canva/auth`
   - Backend generates OAuth URL and redirects user to Canva

2. **User authorizes on Canva**
   - Canva redirects back to `/api/canva/callback` with authorization code
   - Backend exchanges code for access token
   - Tokens are stored in Firestore (associated with user)

3. **User creates design**
   - Frontend calls `/api/canva/designs` with trip data
   - Backend uses stored access token to create design via Canva API
   - Design ID and URL are saved to diary

4. **Token refresh**
   - Backend automatically refreshes expired tokens using refresh token
   - If refresh fails, user needs to re-authorize

## Step 6: Testing

1. Start your backend:
   ```bash
   cd apps/backend
   pnpm dev
   ```

2. Start your frontend:
   ```bash
   cd apps/frontend
   pnpm dev
   ```

3. Navigate to a completed trip
4. Click "Create Travel Diary"
5. Click "Connect with Canva"
6. Authorize the app
7. Click "Create Travel Diary in Canva"

## Troubleshooting

### "Redirect URI mismatch"
- **Solution:** Ensure the redirect URI in Canva Developer Console matches exactly what's in your `.env` file
- Check for trailing slashes, http vs https, etc.

### "Invalid client credentials"
- **Solution:** Verify your Client ID and Secret are correct
- Make sure there are no extra spaces or quotes in `.env` file

### "Token expired"
- **Solution:** The backend should automatically refresh tokens
- If refresh fails, user needs to click "Connect with Canva" again

### "Failed to create design"
- **Solution:** Check that:
  - User has authorized Canva (token exists)
  - Access token has not expired
  - Canva API is accessible

## Security Notes

- **Client Secret** should NEVER be exposed to the frontend
- All OAuth operations happen on the backend
- Tokens are stored securely in Firestore
- State parameter is used to prevent CSRF attacks

## API Endpoints

### Backend Routes

- `GET /api/canva/auth?diaryId=xxx` - Initiate OAuth flow
- `GET /api/canva/callback?code=xxx&state=xxx` - OAuth callback
- `GET /api/canva/token` - Check if user has valid token
- `POST /api/canva/designs` - Create a new design

All routes require authentication (Bearer token).

## Next Steps

1. Set up your OAuth credentials
2. Configure environment variables
3. Test the integration
4. Deploy to production with production URLs







