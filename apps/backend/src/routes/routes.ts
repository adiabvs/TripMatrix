import express from 'express';
import { OptionalAuthRequest } from '../middleware/optionalAuth.js';
import { calculateTotalDistance } from '@tripmatrix/utils';
import type { TripRoute, RoutePoint } from '@tripmatrix/types';
import { TripModel } from '../models/Trip.js';
import { TripRouteModel } from '../models/TripRoute.js';

const router = express.Router();

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
    const trip = await TripModel.findById(tripId);
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    // Get or create route document
    let route = await TripRouteModel.findOne({
      tripId,
      modeOfTravel: modeOfTravel || 'car'
    });

    let existingPoints: RoutePoint[] = [];

    if (route) {
      existingPoints = route.points || [];
    } else {
      route = new TripRouteModel({
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
    route.points = mergedPoints;
    route.updatedAt = new Date();
    const savedRoute = await route.save();

    // Update trip total distance
    const tripData = trip.toJSON();
    const currentDistance = tripData.totalDistance || 0;
    trip.totalDistance = Math.max(currentDistance, totalDistance);
    trip.updatedAt = new Date();
    await trip.save();

    const routeData: TripRoute = savedRoute.toJSON() as TripRoute;

    res.json({
      success: true,
      data: routeData,
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
    const trip = await TripModel.findById(tripId);
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const tripData = trip.toJSON();
    // Allow access if trip is public or user is authenticated participant
    if (!tripData.isPublic) {
      if (!req.uid) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }
      if (tripData.creatorId !== req.uid && 
          !tripData.participants?.some((p: any) => p.uid === req.uid)) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized',
        });
      }
    }
    
    const routesDocs = await TripRouteModel.find({ tripId }).sort({ createdAt: 1 });
    const routes = routesDocs.map(doc => doc.toJSON() as TripRoute);

    res.json({ success: true, data: routes });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

