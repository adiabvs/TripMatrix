import express from 'express';
import { getFirestore } from '../config/firebase.js';
import { OptionalAuthRequest } from '../middleware/optionalAuth.js';
import { calculateTotalDistance } from '@tripmatrix/utils';
import type { TripRoute, RoutePoint } from '@tripmatrix/types';

const router = express.Router();

function getDb() {
  return getFirestore();
}

// Record route points
router.post('/:tripId/points', async (req: OptionalAuthRequest, res) => {
  try {
    const { tripId } = req.params;
    const { points, modeOfTravel } = req.body;
    req.uid!; // User ID for authentication check

    if (!points || !Array.isArray(points) || points.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Points array is required',
      });
    }

    // Verify trip exists
    const db = getDb();
    const tripDoc = await db.collection('trips').doc(tripId).get();
    if (!tripDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    // Get or create route document
    const routeQuery = await db.collection('tripRoutes')
      .where('tripId', '==', tripId)
      .where('modeOfTravel', '==', modeOfTravel || 'car')
      .limit(1)
      .get();

    let routeRef: FirebaseFirestore.DocumentReference;
    let existingPoints: RoutePoint[] = [];

    if (!routeQuery.empty) {
      routeRef = routeQuery.docs[0].ref;
      const routeData = routeQuery.docs[0].data() as TripRoute;
      existingPoints = routeData.points || [];
    } else {
      routeRef = db.collection('tripRoutes').doc();
      await routeRef.set({
        tripId,
        points: [],
        modeOfTravel: modeOfTravel || 'car',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Merge new points with existing ones
    const newPoints: RoutePoint[] = points.map((p: any) => ({
      lat: p.lat,
      lng: p.lng,
      timestamp: p.timestamp ? new Date(p.timestamp) : new Date(),
      modeOfTravel: p.modeOfTravel || modeOfTravel,
    }));

    const mergedPoints = [...existingPoints, ...newPoints];
    
    // Calculate total distance
    const totalDistance = calculateTotalDistance(mergedPoints);

    // Update route
    await routeRef.update({
      points: mergedPoints,
      updatedAt: new Date(),
    });

    // Update trip total distance
    const trip = tripDoc.data()!;
    const currentDistance = trip.totalDistance || 0;
    await db.collection('trips').doc(tripId).update({
      totalDistance: Math.max(currentDistance, totalDistance),
      updatedAt: new Date(),
    });

    const route: TripRoute = {
      routeId: routeRef.id,
      tripId,
      points: mergedPoints,
      modeOfTravel: modeOfTravel || 'car',
      createdAt: routeQuery.empty ? new Date() : routeQuery.docs[0].data().createdAt,
      updatedAt: new Date(),
    };

    res.json({
      success: true,
      data: route,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get route for a trip (public access for public trips)
router.get('/:tripId', async (req: OptionalAuthRequest, res) => {
  try {
    const { tripId } = req.params;
    
    // Check if trip is public
    const db = getDb();
    const tripDoc = await db.collection('trips').doc(tripId).get();
    if (!tripDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = tripDoc.data()!;
    // Allow access if trip is public or user is authenticated participant
    if (!trip.isPublic) {
      if (!req.uid) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }
      if (trip.creatorId !== req.uid && 
          !trip.participants?.some((p: any) => p.uid === req.uid)) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized',
        });
      }
    }
    
    const snapshot = await db.collection('tripRoutes')
      .where('tripId', '==', tripId)
      .get();

    const routes = snapshot.docs.map((doc) => ({
      routeId: doc.id,
      ...doc.data(),
    })) as TripRoute[];

    // Sort by createdAt in memory (avoids needing composite index)
    routes.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return aTime - bTime;
    });

    res.json({ success: true, data: routes });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

