import mongoose, { Schema, Document } from 'mongoose';
import type { TripExpense } from '@tripmatrix/types';

export interface TripExpenseDocument extends Omit<TripExpense, 'expenseId' | 'calculatedShares'>, Document<string> {
  _id: string;
  expenseId: string;
  calculatedShares: Map<string, number>; // Store as Map in MongoDB
}

const TripExpenseSchema = new Schema<TripExpenseDocument>(
  {
    tripId: {
      type: String,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      default: 'USD',
    },
    paidBy: {
      type: String,
      required: true, // uid or guestName
    },
    splitBetween: {
      type: [String],
      required: true, // Array of uids or guestNames
    },
    calculatedShares: {
      type: Map,
      of: Number,
      required: true,
    },
    description: String,
    placeId: String, // Optional: link expense to a place
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false, // We only want createdAt, not updatedAt
    toJSON: {
      transform: (doc, ret: any) => {
        ret.expenseId = ret._id;
        delete ret._id;
        delete ret.__v;
        // Convert Map to Object for JSON
        if (ret.calculatedShares instanceof Map) {
          ret.calculatedShares = Object.fromEntries(ret.calculatedShares);
        }
        return ret;
      },
    },
  }
);

TripExpenseSchema.index({ tripId: 1, createdAt: -1 });
TripExpenseSchema.index({ placeId: 1 });

export const TripExpenseModel = mongoose.model<TripExpenseDocument>('TripExpense', TripExpenseSchema);

