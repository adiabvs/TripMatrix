import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeFirebase } from './config/firebase.js';
import { authenticateToken } from './middleware/auth.js';
import { optionalAuth } from './middleware/optionalAuth.js';
import tripRoutes from './routes/trips.js';
import aiRoutes from './routes/ai.js';
import expenseRoutes from './routes/expenses.js';
import routeRoutes from './routes/routes.js';
import placeRoutes from './routes/places.js';
import userRoutes from './routes/users.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Firebase Admin
initializeFirebase();

// Middleware
app.use(cors());
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

