import express from 'express';
import { OptionalAuthRequest } from '../middleware/optionalAuth.js';
import { calculateExpenseShares } from '@tripmatrix/utils';
import type { TripExpense, TripPlace } from '@tripmatrix/types';
import { TripModel } from '../models/Trip.js';
import { TripExpenseModel } from '../models/TripExpense.js';
import { TripPlaceModel } from '../models/TripPlace.js';

const router = express.Router();

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
    const trip = await TripModel.findById(tripId);
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const tripData = trip.toJSON();
    
    // Check authorization - allow creator or participants to add expenses
    if (!uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    const isCreator = tripData.creatorId === uid;
    const isParticipant = tripData.participants?.some((p: any) => p.uid === uid);
    
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

    const expenseDoc = new TripExpenseModel(expenseData);
    const savedExpense = await expenseDoc.save();
    
    // Update trip total expense
    const currentTotal = tripData.totalExpense || 0;
    trip.totalExpense = currentTotal + Number(amount);
    trip.updatedAt = new Date();
    await trip.save();

    const expense: TripExpense = savedExpense.toJSON() as TripExpense;

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
    
    const expensesDocs = await TripExpenseModel.find({ tripId }).sort({ createdAt: -1 });
    const expenses = expensesDocs.map(doc => doc.toJSON() as TripExpense);

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

    const expense = await TripExpenseModel.findById(expenseId);
    if (!expense) {
      return res.status(404).json({
        success: false,
        error: 'Expense not found',
      });
    }

    const expenseData = expense.toJSON() as TripExpense;
    
    // Verify trip exists and user has access
    const trip = await TripModel.findById(expenseData.tripId);
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const tripData = trip.toJSON();
    const isCreator = tripData.creatorId === uid;
    const isParticipant = tripData.participants?.some((p: any) => p.uid === uid);
    
    if (!isCreator && !isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to edit expenses',
      });
    }

    const oldAmount = expenseData.amount;
    
    if (amount !== undefined) {
      expense.amount = Number(amount);
      // Recalculate shares if amount or splitBetween changed
      const newSplitBetween = splitBetween || expenseData.splitBetween;
      const shares = calculateExpenseShares(Number(amount), newSplitBetween);
      expense.calculatedShares = new Map(Object.entries(shares));
    }
    
    if (currency !== undefined) expense.currency = currency;
    if (paidBy !== undefined) expense.paidBy = paidBy;
    if (splitBetween !== undefined) {
      expense.splitBetween = splitBetween;
      // Recalculate shares if splitBetween changed
      const newAmount = amount !== undefined ? Number(amount) : expenseData.amount;
      const shares = calculateExpenseShares(newAmount, splitBetween);
      expense.calculatedShares = new Map(Object.entries(shares));
    }
    if (description !== undefined) expense.description = description;

    const updatedExpense = await expense.save();

    // Update trip total expense if amount changed
    if (amount !== undefined) {
      const newAmount = Number(amount);
      const difference = newAmount - oldAmount;
      const currentTotal = tripData.totalExpense || 0;
      trip.totalExpense = currentTotal + difference;
      trip.updatedAt = new Date();
      await trip.save();
    }

    res.json({
      success: true,
      data: updatedExpense.toJSON() as TripExpense,
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

    const expense = await TripExpenseModel.findById(expenseId);
    if (!expense) {
      return res.status(404).json({
        success: false,
        error: 'Expense not found',
      });
    }

    const expenseData = expense.toJSON() as TripExpense;
    
    // Verify trip exists and user has access
    const trip = await TripModel.findById(expenseData.tripId);
    if (!trip) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const tripData = trip.toJSON();
    const isCreator = tripData.creatorId === uid;
    const isParticipant = tripData.participants?.some((p: any) => p.uid === uid);
    
    if (!isCreator && !isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete expenses',
      });
    }

    // Delete expense
    await TripExpenseModel.findByIdAndDelete(expenseId);

    // Update trip total expense
    const currentTotal = tripData.totalExpense || 0;
    trip.totalExpense = Math.max(0, currentTotal - expenseData.amount);
    trip.updatedAt = new Date();
    await trip.save();

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
    const expensesDocs = await TripExpenseModel.find({ tripId });
    const expenses = expensesDocs.map(doc => doc.toJSON() as TripExpense);

    // Get places for expense per place calculation
    const placesDocs = await TripPlaceModel.find({ tripId });
    const places = placesDocs.map((doc) => {
      const placeData = doc.toJSON() as TripPlace;
      return {
        placeId: placeData.placeId,
        name: placeData.name,
      };
    });

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

