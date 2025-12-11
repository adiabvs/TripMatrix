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

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
});

