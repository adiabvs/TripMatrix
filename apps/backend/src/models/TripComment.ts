import mongoose, { Schema, Document } from 'mongoose';
import type { TripComment } from '@tripmatrix/types';

export interface TripCommentDocument extends Omit<TripComment, 'commentId'>, Document<string> {
  _id: string;
  commentId: string;
  createdAt: Date;
  updatedAt: Date;
}

const TripCommentSchema = new Schema<TripCommentDocument>(
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
    text: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
    },
  },
  {
    timestamps: false,
    toJSON: {
      transform: (doc, ret: any) => {
        ret.commentId = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

TripCommentSchema.index({ tripId: 1, createdAt: -1 });

export const TripCommentModel = mongoose.model<TripCommentDocument>('TripComment', TripCommentSchema);


