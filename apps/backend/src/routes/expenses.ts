import express from 'express';
import { getFirestore } from '../config/firebase.js';
import { OptionalAuthRequest } from '../middleware/optionalAuth.js';
import { calculateExpenseShares } from '@tripmatrix/utils';
import type { TripExpense, ExpenseSummary } from '@tripmatrix/types';

const router = express.Router();

function getDb() {
  return getFirestore();
}

// Create expense
router.post('/', async (req: OptionalAuthRequest, res) => {
  try {
    const { tripId, amount, paidBy, splitBetween, description, placeId } = req.body;
    const uid = req.uid!;

    if (!tripId || !amount || !paidBy || !splitBetween || splitBetween.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'tripId, amount, paidBy, and splitBetween are required',
      });
    }

    // Verify trip exists and user has access
    const db = getDb();
    const tripDoc = await db.collection('trips').doc(tripId).get();
    if (!tripDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const calculatedShares = calculateExpenseShares(amount, splitBetween);

    const expenseData: Omit<TripExpense, 'expenseId'> = {
      tripId,
      amount: Number(amount),
      paidBy,
      splitBetween,
      calculatedShares,
      description: description || '',
      placeId: placeId || '',
      createdAt: new Date(),
    };

    const expenseRef = await db.collection('tripExpenses').add(expenseData);
    
    // Update trip total expense
    const trip = tripDoc.data()!;
    const currentTotal = trip.totalExpense || 0;
    await db.collection('trips').doc(tripId).update({
      totalExpense: currentTotal + Number(amount),
      updatedAt: new Date(),
    });

    const expense: TripExpense = {
      expenseId: expenseRef.id,
      ...expenseData,
    };

    res.json({
      success: true,
      data: expense,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get expenses for a trip (public access for public trips)
router.get('/trip/:tripId', async (req: OptionalAuthRequest, res) => {
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
    
    const snapshot = await db.collection('tripExpenses')
      .where('tripId', '==', tripId)
      .orderBy('createdAt', 'desc')
      .get();

    const expenses = snapshot.docs.map((doc) => ({
      expenseId: doc.id,
      ...doc.data(),
    })) as TripExpense[];

    res.json({ success: true, data: expenses });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get expense summary
router.get('/trip/:tripId/summary', async (req: OptionalAuthRequest, res) => {
  try {
    const { tripId } = req.params;
    
    // Get expenses
    const db = getDb();
    const expensesSnapshot = await db.collection('tripExpenses')
      .where('tripId', '==', tripId)
      .get();

    const expenses = expensesSnapshot.docs.map((doc) => ({
      expenseId: doc.id,
      ...doc.data(),
    })) as TripExpense[];

    // Get places for expense per place calculation
    const placesSnapshot = await db.collection('tripPlaces')
      .where('tripId', '==', tripId)
      .get();

    const places = placesSnapshot.docs.map((doc) => ({
      placeId: doc.id,
      name: doc.data().name,
    }));

    // Calculate summary
    const utils = await import('@tripmatrix/utils');
    const summary = utils.calculateExpenseSummary(expenses, places);

    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

