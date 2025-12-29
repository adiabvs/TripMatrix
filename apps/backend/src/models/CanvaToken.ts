import mongoose, { Schema, Document } from 'mongoose';

export interface CanvaTokenDocument extends Document<string> {
  _id: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CanvaTokenSchema = new Schema<CanvaTokenDocument>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    accessToken: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const CanvaTokenModel = mongoose.model<CanvaTokenDocument>('CanvaToken', CanvaTokenSchema);

