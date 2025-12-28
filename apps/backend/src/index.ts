import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeFirebase } from './config/firebase.js';
import { initializeSupabase, isSupabaseInitialized } from './config/supabase.js';
import { authenticateToken } from './middleware/auth.js';
import { optionalAuth } from './middleware/optionalAuth.js';
import tripRoutes from './routes/trips.js';
import aiRoutes from './routes/ai.js';
import expenseRoutes from './routes/expenses.js';
import routeRoutes from './routes/routes.js';
import placeRoutes from './routes/places.js';
import userRoutes from './routes/users.js';
import geocodingRoutes from './routes/geocoding.js';
import uploadRoutes from './routes/upload.js';
import diaryRoutes from './routes/diary.js';
import canvaOAuthRoutes from './routes/canva-oauth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Firebase Admin
initializeFirebase();

// Initialize Supabase
initializeSupabase();

// Ensure images bucket exists (async, don't block server start)
if (isSupabaseInitialized()) {
  import('./config/supabase.js').then(({ ensureImagesBucket }) => {
    ensureImagesBucket().catch((error) => {
      console.warn('⚠️  Could not ensure images bucket exists:', error.message);
    });
  });
}

// CORS configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Log the origin for debugging
    console.log('CORS request from origin:', origin);
    
    // Allow requests with no origin (like mobile apps, Postman, or curl)
    if (!origin) {
      console.log('No origin header, allowing request');
      return callback(null, true);
    }
    
    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      process.env.FRONTEND_URL, // Production frontend URL from env
      'https://tripmatrixfrontend-production.up.railway.app',
    ].filter(Boolean); // Remove undefined values
    
    console.log('Allowed origins:', allowedOrigins);
    
    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      console.log('Origin allowed:', origin);
      callback(null, true);
    } else {
      // In production on Railway, be more permissive (Railway may modify headers)
      // Allow any Railway subdomain
      if (origin.includes('.railway.app') || origin.includes('.up.railway.app')) {
        console.log('Railway origin detected, allowing:', origin);
        callback(null, true);
      } else if (process.env.NODE_ENV !== 'production') {
        // In development, allow all origins for easier testing
        console.log('Development mode, allowing origin:', origin);
        callback(null, true);
      } else {
        console.log('Origin not allowed:', origin);
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
// Public trips endpoint (no auth required) - must be registered BEFORE authenticated routes
app.get('/api/trips/public/list', async (req, res) => {
  try {
    const { limit, search } = req.query;
    const { getFirestore } = await import('./config/firebase.js');
    const db = getFirestore();
    const snapshot = await db.collection('trips')
      .where('isPublic', '==', true)
      .get();

    let trips = snapshot.docs.map((doc) => ({
      tripId: doc.id,
      ...doc.data(),
    }));

    // Filter by search query if provided
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      trips = trips.filter((trip: any) => {
        if (trip.title?.toLowerCase().includes(searchLower)) return true;
        if (trip.description?.toLowerCase().includes(searchLower)) return true;
        return false;
      });
    }

    // Sort by createdAt
    trips.sort((a: any, b: any) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

    // Apply limit only if provided
    if (limit) {
      trips = trips.slice(0, Number(limit));
    }

    res.json({ success: true, data: trips });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Trips routes - use optionalAuth to allow public trip viewing
// Individual routes will check authorization as needed
app.use('/api/trips', optionalAuth, tripRoutes);
app.use('/api/ai', authenticateToken, aiRoutes);
app.use('/api/expenses', optionalAuth, expenseRoutes);
app.use('/api/routes', optionalAuth, routeRoutes);
app.use('/api/places', optionalAuth, placeRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/geocoding', geocodingRoutes); // Public endpoint for geocoding
app.use('/api/upload', authenticateToken, uploadRoutes); // Image upload endpoint
app.use('/api/diary', authenticateToken, diaryRoutes); // Travel diary routes
// Canva OAuth routes - /oauth/redirect and /return-nav are public (no auth), /api/canva/* requires auth
app.use('/oauth', canvaOAuthRoutes); // OAuth redirect endpoint (public - Canva redirects here)
// Return navigation endpoint (public - Canva redirects here after editing)
// Handle directly in index.ts to avoid router mounting conflicts
app.get('/return-nav', async (req, res) => {
  try {
    const { correlation_jwt, correlation_state } = req.query;
    const { decodeJwt } = await import('jose');
    const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:3000';

    // Canva sends correlation_jwt (JWT token) or correlation_state (base64 encoded)
    const correlationToken = correlation_jwt || correlation_state;

    if (!correlationToken || typeof correlationToken !== 'string') {
      console.error('Missing correlation_jwt or correlation_state in return navigation');
      return res.redirect(`${frontendUrl}/trips?canva_error=missing_correlation_state`);
    }

    // Decode the correlation state
    let correlationState: {
      originPage?: string;
      returnTo?: string;
      diaryId?: string;
      tripId?: string;
    };

    try {
      if (correlation_jwt) {
        // Decode JWT token (Canva sends correlation_jwt)
        const decoded = await decodeJwt(correlationToken);
        console.log('Decoded correlation JWT payload:', decoded);
        
        // Extract correlation_state from JWT payload
        const encodedState = decoded.correlation_state as string;
        if (encodedState) {
          try {
            // Decode base64 correlation state
            const decodedState = Buffer.from(encodedState, 'base64').toString('utf-8');
            correlationState = JSON.parse(decodedState);
            console.log('Extracted correlation state from JWT:', correlationState);
          } catch (base64Error) {
            // Try base64url decoding (URL-safe base64)
            try {
              const decodedState = Buffer.from(encodedState.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
              correlationState = JSON.parse(decodedState);
              console.log('Extracted correlation state from JWT (base64url):', correlationState);
            } catch (urlError) {
              console.warn('Failed to decode correlation_state from JWT, using JWT payload directly');
              correlationState = decoded as any;
            }
          }
        } else {
          correlationState = decoded as any;
          console.log('No correlation_state in JWT, using JWT payload directly:', correlationState);
        }
      } else {
        // Legacy: decode base64 correlation_state
        const urlDecoded = decodeURIComponent(correlationToken);
        const decoded = Buffer.from(urlDecoded, 'base64').toString('utf-8');
        correlationState = JSON.parse(decoded);
        console.log('Decoded correlation state:', correlationState);
      }
    } catch (decodeError: any) {
      console.error('Failed to decode correlation state:', decodeError);
      console.error('Raw correlation token:', correlationToken);
      return res.redirect(`${frontendUrl}/trips?canva_error=invalid_correlation_state`);
    }
    
    // Determine where to redirect
    let redirectPath = '/trips';
    
    if (correlationState.returnTo) {
      redirectPath = correlationState.returnTo;
    } else if (correlationState.diaryId) {
      redirectPath = `/trips/${correlationState.tripId || correlationState.diaryId}/diary`;
    } else if (correlationState.tripId) {
      redirectPath = `/trips/${correlationState.tripId}`;
    }

    // Redirect to frontend with success indicator
    const redirectUrl = new URL(redirectPath, frontendUrl);
    redirectUrl.searchParams.append('canva_return', 'success');
    
    if (correlationState.diaryId) {
      redirectUrl.searchParams.append('diaryId', correlationState.diaryId);
    }
    
    console.log('Redirecting from Canva return navigation to:', redirectUrl.toString());
    res.redirect(redirectUrl.toString());
  } catch (error: any) {
    console.error('Failed to handle Canva return navigation:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:3000';
    res.redirect(`${frontendUrl}/trips?canva_error=${encodeURIComponent(error.message || 'return_nav_failed')}`);
  }
});
app.use('/api/canva', authenticateToken, canvaOAuthRoutes); // Other Canva API routes (authenticated)

// Error handling
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
});

