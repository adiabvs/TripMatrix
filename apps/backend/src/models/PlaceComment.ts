import mongoose, { Schema, Document } from 'mongoose';
import type { PlaceComment } from '@tripmatrix/types';

export interface PlaceCommentDocument extends Omit<PlaceComment, 'commentId'>, Document<string> {
  _id: string;
  commentId: string;
}

const PlaceCommentSchema = new Schema<PlaceCommentDocument>(
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
    text: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
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

PlaceCommentSchema.index({ placeId: 1, createdAt: -1 });

export const PlaceCommentModel = mongoose.model<PlaceCommentDocument>('PlaceComment', PlaceCommentSchema);

