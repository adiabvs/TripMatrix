import { Request, Response, NextFunction } from 'express';
import { getAuth } from '../config/firebase.js';

export interface OptionalAuthRequest extends Request {
  uid?: string;
  user?: {
    uid: string;
    email?: string;
    name?: string;
    picture?: string;
  };
}

export async function optionalAuth(
  req: OptionalAuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      const auth = getAuth();
      
      try {
        const decodedToken = await auth.verifyIdToken(token);
        req.uid = decodedToken.uid;
        req.user = {
          uid: decodedToken.uid,
          email: decodedToken.email,
          name: decodedToken.name || undefined, // Google display name
          picture: decodedToken.picture || undefined, // Google photo URL
        };
      } catch (error) {
        // Token is invalid, but continue without auth (for public routes)
      }
    }
    
    next();
  } catch (error) {
    // If token is invalid, continue without auth (for public routes)
    next();
  }
}

