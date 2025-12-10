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
    // Allow requests with no origin (like mobile apps, Postman, or curl)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      process.env.FRONTEND_URL, // Production frontend URL from env
      'https://tripmatrixfrontend-production.up.railway.app',
    ].filter(Boolean); // Remove undefined values
    
    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // In development, allow all origins for easier testing
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/trips', authenticateToken, tripRoutes);
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

