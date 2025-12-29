import mongoose, { Schema, Document } from 'mongoose';

export interface CanvaOAuthStateDocument extends Document<string> {
  _id: string;
  uid: string;
  diaryId?: string;
  codeVerifier: string;
  createdAt: Date;
  expiresAt: Date;
}

const CanvaOAuthStateSchema = new Schema<CanvaOAuthStateDocument>(
  {
    uid: {
      type: String,
      required: true,
    },
    diaryId: String,
    codeVerifier: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 600, // TTL index - expires after 10 minutes
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: false,
  }
);

// TTL index for automatic cleanup
CanvaOAuthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CanvaOAuthStateModel = mongoose.model<CanvaOAuthStateDocument>('CanvaOAuthState', CanvaOAuthStateSchema);

