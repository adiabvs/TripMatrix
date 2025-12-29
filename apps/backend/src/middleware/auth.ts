import { Request, Response, NextFunction } from 'express';
import { getAuth } from '../config/firebase.js';

export interface AuthenticatedRequest extends Request {
  uid?: string;
  user?: {
    uid: string;
    email?: string;
    name?: string;
    picture?: string;
  };
}

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No authorization token provided',
      });
    }

    const token = authHeader.split('Bearer ')[1];
    const auth = getAuth();
    
    // Verify the JWT token with Firebase Admin
    const decodedToken = await auth.verifyIdToken(token);
    
    req.uid = decodedToken.uid;
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || undefined, // Google display name
      picture: decodedToken.picture || undefined, // Google photo URL
    };
    
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
}

