# TripMatrix Setup Guide

## Prerequisites

1. **Node.js** >= 18.0.0
2. **pnpm** >= 8.0.0 (install with `npm install -g pnpm`)
3. **Firebase Project** with:
   - Authentication enabled (Google Sign-In)
   - Firestore Database
   - Storage (optional, for images)
4. **Google Cloud APIs**:
   - Google Maps Places API
   - Gemini API (for AI rewriting)

## Step 1: Clone and Install

```bash
# Install dependencies
pnpm install
```

## Step 2: Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Authentication with Google Sign-In provider
3. Create a Firestore database
4. Enable Storage (optional)
5. Get your Firebase config from Project Settings > General > Your apps

## Step 3: Backend Configuration

1. Create a service account:
   - Go to Firebase Console > Project Settings > Service Accounts
   - Click "Generate New Private Key"
   - Save the JSON file

2. Copy `apps/backend/.env.example` to `apps/backend/.env` and fill in:

```env
PORT=3001
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
GEMINI_API_KEY=your-gemini-api-key
NODE_ENV=development
```

**Note**: For `FIREBASE_PRIVATE_KEY`, copy the entire private key from the JSON file, including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines, and replace newlines with `\n`.

## Step 4: Frontend Configuration

1. Copy `apps/frontend/.env.example` to `apps/frontend/.env.local` and fill in:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Step 5: Firestore Security Rules

1. Go to Firebase Console > Firestore Database > Rules
2. Copy the contents of `firestore.rules` and paste into the rules editor
3. Publish the rules

## Step 6: Google APIs Setup

### Google Maps Places API
1. Go to Google Cloud Console
2. Enable "Places API"
3. Create an API key
4. Restrict the API key to "Places API" only
5. Add the key to your frontend `.env.local`

### Gemini API
1. Go to Google AI Studio (https://makersuite.google.com/app/apikey)
2. Create an API key
3. Add the key to your backend `.env`

## Step 7: Run the Application

### Development Mode

Terminal 1 - Backend:
```bash
cd apps/backend
pnpm dev
```

Terminal 2 - Frontend:
```bash
cd apps/frontend
pnpm dev
```

The frontend will be available at http://localhost:3000
The backend API will be available at http://localhost:3001

## Step 8: Build for Production

```bash
# Build all packages
pnpm build

# Start backend
cd apps/backend
pnpm start

# Start frontend
cd apps/frontend
pnpm start
```

## Troubleshooting

### Firebase Admin SDK Errors
- Ensure your service account JSON is correctly formatted
- Check that `FIREBASE_PRIVATE_KEY` has `\n` for newlines
- Verify `FIREBASE_PROJECT_ID` matches your Firebase project

### Google Maps Not Loading
- Check that `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set
- Verify Places API is enabled in Google Cloud Console
- Check browser console for API errors

### Authentication Issues
- Ensure Google Sign-In is enabled in Firebase Console
- Check that authorized domains include `localhost` (for development)
- Verify Firebase config values in `.env.local`

### CORS Errors
- Ensure backend CORS is configured (already set in `apps/backend/src/index.ts`)
- Check that `NEXT_PUBLIC_API_URL` matches your backend URL

## Project Structure

```
TripMatrix/
├── apps/
│   ├── frontend/          # Next.js frontend application
│   └── backend/           # Express.js backend API
├── packages/
│   ├── types/             # Shared TypeScript types
│   └── utils/             # Shared utility functions
├── firestore.rules        # Firestore security rules
└── README.md              # Project documentation
```

## Features Implemented

✅ Google Sign-In authentication
✅ Trip creation and management
✅ Add participants with @username tagging
✅ Public/Private trip settings
✅ Real-time GPS tracking
✅ Route recording with polylines
✅ Place logging with ratings and comments
✅ Expense splitting
✅ AI text rewriting (Gemini API)
✅ Public trip view
✅ Expense summary and settlements

## Next Steps

1. Deploy backend to Cloud Run or similar platform
2. Deploy frontend to Vercel or similar platform
3. Set up production environment variables
4. Configure custom domain (optional)
5. Set up monitoring and error tracking

