import mongoose, { Schema, Document } from 'mongoose';
import type { Trip, TripParticipant, TripStatus } from '@tripmatrix/types';

export interface TripDocument extends Omit<Trip, 'tripId'>, Document<string> {
  _id: string;
  tripId: string;
}

const TripParticipantSchema = new Schema(
  {
    uid: String,
    guestName: String,
    guestEmail: String,
    isGuest: {
      type: Boolean,
      required: true,
    },
  },
  { _id: false }
);

const TripSchema = new Schema<TripDocument>(
  {
    creatorId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: String,
    participants: {
      type: [TripParticipantSchema],
      default: [],
    },
    isPublic: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ['upcoming', 'in_progress', 'completed'],
      required: true,
      index: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: Date,
    coverImage: String,
    totalExpense: {
      type: Number,
      default: 0,
    },
    totalDistance: Number, // in meters
    defaultPhotoSharing: {
      type: String,
      enum: ['everyone', 'members', 'creator'],
    },
    expenseVisibility: {
      type: String,
      enum: ['everyone', 'members', 'creator'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret: any) => {
        ret.tripId = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for common queries
TripSchema.index({ creatorId: 1, createdAt: -1 });
TripSchema.index({ isPublic: 1, createdAt: -1 });
TripSchema.index({ status: 1, createdAt: -1 });

export const TripModel = mongoose.model<TripDocument>('Trip', TripSchema);

