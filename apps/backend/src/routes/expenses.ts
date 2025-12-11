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
    const { tripId, amount, currency, paidBy, splitBetween, description, placeId } = req.body;
    const uid = req.uid!;

    if (!tripId || !amount || !paidBy || !splitBetween || splitBetween.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'tripId, amount, paidBy, and splitBetween are required',
      });
    }

    // Default currency to USD if not provided
    const expenseCurrency = currency || 'USD';

    // Verify trip exists and user has access
    const db = getDb();
    const tripDoc = await db.collection('trips').doc(tripId).get();
    if (!tripDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = tripDoc.data()!;
    
    // Check authorization - allow creator or participants to add expenses
    if (!uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    const isCreator = trip.creatorId === uid;
    const isParticipant = trip.participants?.some((p: any) => p.uid === uid);
    
    if (!isCreator && !isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to add expenses. Only the creator or participants can add expenses.',
      });
    }

    const calculatedShares = calculateExpenseShares(amount, splitBetween);

    const expenseData: Omit<TripExpense, 'expenseId'> = {
      tripId,
      amount: Number(amount),
      currency: expenseCurrency,
      paidBy,
      splitBetween,
      calculatedShares,
      description: description || '',
      placeId: placeId || '',
      createdAt: new Date(),
    };

    const expenseRef = await db.collection('tripExpenses').add(expenseData);
    
    // Update trip total expense
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
      .get();

    const expenses = snapshot.docs.map((doc) => ({
      expenseId: doc.id,
      ...doc.data(),
    })) as TripExpense[];

    // Sort by createdAt in memory (avoids needing composite index)
    expenses.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime; // Descending order
    });

    res.json({ success: true, data: expenses });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Update expense
router.patch('/:expenseId', async (req: OptionalAuthRequest, res) => {
  try {
    const { expenseId } = req.params;
    const { amount, currency, paidBy, splitBetween, description } = req.body;
    const uid = req.uid!;

    if (!uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const db = getDb();
    const expenseDoc = await db.collection('tripExpenses').doc(expenseId).get();
    
    if (!expenseDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Expense not found',
      });
    }

    const expense = expenseDoc.data() as TripExpense;
    
    // Verify trip exists and user has access
    const tripDoc = await db.collection('trips').doc(expense.tripId).get();
    if (!tripDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = tripDoc.data()!;
    const isCreator = trip.creatorId === uid;
    const isParticipant = trip.participants?.some((p: any) => p.uid === uid);
    
    if (!isCreator && !isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to edit expenses',
      });
    }

    const updateData: any = { updatedAt: new Date() };
    
    if (amount !== undefined) {
      updateData.amount = Number(amount);
      // Recalculate shares if amount or splitBetween changed
      const newSplitBetween = splitBetween || expense.splitBetween;
      updateData.calculatedShares = calculateExpenseShares(Number(amount), newSplitBetween);
    }
    
    if (currency !== undefined) updateData.currency = currency;
    if (paidBy !== undefined) updateData.paidBy = paidBy;
    if (splitBetween !== undefined) {
      updateData.splitBetween = splitBetween;
      // Recalculate shares if splitBetween changed
      const newAmount = amount !== undefined ? Number(amount) : expense.amount;
      updateData.calculatedShares = calculateExpenseShares(newAmount, splitBetween);
    }
    if (description !== undefined) updateData.description = description;

    await db.collection('tripExpenses').doc(expenseId).update(updateData);

    // Update trip total expense if amount changed
    if (amount !== undefined) {
      const oldAmount = expense.amount;
      const newAmount = Number(amount);
      const difference = newAmount - oldAmount;
      const currentTotal = trip.totalExpense || 0;
      await db.collection('trips').doc(expense.tripId).update({
        totalExpense: currentTotal + difference,
        updatedAt: new Date(),
      });
    }

    const updatedExpense: TripExpense = {
      ...expense,
      ...updateData,
    };

    res.json({
      success: true,
      data: updatedExpense,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Delete expense
router.delete('/:expenseId', async (req: OptionalAuthRequest, res) => {
  try {
    const { expenseId } = req.params;
    const uid = req.uid!;

    if (!uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const db = getDb();
    const expenseDoc = await db.collection('tripExpenses').doc(expenseId).get();
    
    if (!expenseDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Expense not found',
      });
    }

    const expense = expenseDoc.data() as TripExpense;
    
    // Verify trip exists and user has access
    const tripDoc = await db.collection('trips').doc(expense.tripId).get();
    if (!tripDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = tripDoc.data()!;
    const isCreator = trip.creatorId === uid;
    const isParticipant = trip.participants?.some((p: any) => p.uid === uid);
    
    if (!isCreator && !isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete expenses',
      });
    }

    // Delete expense
    await db.collection('tripExpenses').doc(expenseId).delete();

    // Update trip total expense
    const currentTotal = trip.totalExpense || 0;
    await db.collection('trips').doc(expense.tripId).update({
      totalExpense: Math.max(0, currentTotal - expense.amount),
      updatedAt: new Date(),
    });

    res.json({
      success: true,
      data: { expenseId },
    });
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

