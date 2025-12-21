# Canva OAuth Integration - Quick Start

## Setup (5 minutes)

### 1. Get Your Credentials

From [Canva Developer Console](https://www.canva.dev/):
- **Client ID**: `CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Client Secret**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 2. Configure Backend

Add to `apps/backend/.env`:

```env
CANVA_CLIENT_ID=your_client_id_here
CANVA_CLIENT_SECRET=your_client_secret_here
CANVA_REDIRECT_URI=http://localhost:3001/api/canva/callback
FRONTEND_URL=http://localhost:3000
```

### 3. Configure Frontend

Add to `apps/frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 4. Set Redirect URI in Canva Console

In your Canva app settings, add:
- `http://localhost:3001/api/canva/callback` (development)
- `https://your-backend.com/api/canva/callback` (production)

### 5. Restart Servers

```bash
# Backend
cd apps/backend
pnpm dev

# Frontend  
cd apps/frontend
pnpm dev
```

## How to Use

1. Go to a completed trip
2. Click "Create Travel Diary"
3. Click "Connect with Canva" (first time only)
4. Authorize the app
5. Click "Create Travel Diary in Canva"
6. Design your diary in Canva
7. Your design is automatically saved!

## What Changed

✅ **OAuth-based** - Uses Client ID/Secret instead of API key
✅ **Secure** - Tokens stored on backend, never exposed to frontend
✅ **Automatic refresh** - Tokens refresh automatically
✅ **User-specific** - Each user has their own Canva connection

## Files Created

- `apps/backend/src/services/canvaOAuthService.ts` - OAuth service
- `apps/backend/src/routes/canva-oauth.ts` - OAuth routes
- `apps/frontend/src/components/CanvaOAuthEditor.tsx` - OAuth-based editor component

## Troubleshooting

**"Redirect URI mismatch"**
→ Check redirect URI in Canva Console matches your `.env`

**"Invalid credentials"**
→ Verify Client ID and Secret are correct

**"Token expired"**
→ Click "Connect with Canva" again to re-authorize

That's it! Your Canva OAuth integration is ready to use.




