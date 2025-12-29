import mongoose, { Schema, Document } from 'mongoose';

export interface PlaceLikeDocument extends Document<string> {
  _id: string;
  placeId: string;
  userId: string;
  createdAt: Date;
}

const PlaceLikeSchema = new Schema<PlaceLikeDocument>(
  {
    placeId: {
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
PlaceLikeSchema.index({ placeId: 1, userId: 1 }, { unique: true });

export const PlaceLikeModel = mongoose.model<PlaceLikeDocument>('PlaceLike', PlaceLikeSchema);

