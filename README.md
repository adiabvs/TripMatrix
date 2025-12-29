# TripMatrix

A trip-logging and social travel tracking platform where users can create trips, add companions, track navigation, log places visited, rate & comment, split expenses, rewrite text using AI, and optionally make their trip public.

## Tech Stack

- **Frontend**: Next.js 14 (TypeScript), React, TailwindCSS, Leaflet + OpenStreetMap
- **Backend**: Express.js (deployable to Cloud Run)
- **Database**: MongoDB (with Mongoose)
- **Authentication**: Firebase Auth with Google Sign-In
- **Storage**: Supabase Storage (for images)
- **APIs**: Google Maps Places API, Gemini API

## Project Structure

```
TripMatrix/
├── apps/
│   ├── frontend/     # Next.js application
│   └── backend/      # Express.js API server
├── packages/
│   ├── types/        # Shared TypeScript types
│   └── utils/        # Shared utility functions
└── package.json      # Root workspace configuration
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Firebase project with Firestore, Auth, and Storage enabled

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
# Copy .env.example files in apps/frontend and apps/backend
# Fill in your Firebase config and API keys

# Run development servers
pnpm dev              # Frontend (Next.js)
pnpm --filter backend dev  # Backend (Express)
```

### Environment Variables

#### Frontend (.env.local)
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_API_URL=http://localhost:3001
```

#### Backend (.env)
```
PORT=3001
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
GEMINI_API_KEY=
NODE_ENV=development
```

## Features

- ✅ Google Sign-In authentication
- ✅ Trip creation and management
- ✅ Add participants with @username tagging
- ✅ Public/Private trip settings
- ✅ Real-time GPS tracking
- ✅ Route recording with polylines
- ✅ Place logging with ratings and comments
- ✅ Expense splitting
- ✅ AI text rewriting (Gemini API)
- ✅ Public trip view

## Development

```bash
# Run all type checks
pnpm type-check

# Run linters
pnpm lint

# Build all packages
pnpm build
```

## License

MIT

