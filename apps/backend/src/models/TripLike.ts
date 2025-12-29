import mongoose, { Schema, Document } from 'mongoose';

export interface TripLikeDocument extends Document<string> {
  _id: string;
  tripId: string;
  userId: string;
  createdAt: Date;
}

const TripLikeSchema = new Schema<TripLikeDocument>(
  {
    tripId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Unique compound index to prevent duplicate likes
TripLikeSchema.index({ tripId: 1, userId: 1 }, { unique: true });

export const TripLikeModel = mongoose.model<TripLikeDocument>('TripLike', TripLikeSchema);

