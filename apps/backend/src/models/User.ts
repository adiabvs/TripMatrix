import mongoose, { Schema, Document } from 'mongoose';
import type { User } from '@tripmatrix/types';

export interface UserDocument extends Omit<User, 'uid'>, Document<string> {
  _id: string;
  uid: string;
}

const UserSchema = new Schema<UserDocument>(
  {
    _id: { type: String, required: true }, // Use uid as _id
    uid: { type: String, required: true, unique: true, index: true }, // Store uid explicitly
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      sparse: true,
      index: true,
    },
    photoUrl: String,
    country: String, // ISO country code
    defaultCurrency: String, // ISO currency code
    isProfilePublic: {
      type: Boolean,
      default: false,
    },
    follows: [String], // Array of user UIDs
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true, // Use custom _id (will be set to uid)
    timestamps: true, // Adds createdAt and updatedAt automatically
    toJSON: {
      transform: (doc, ret: any) => {
        ret.uid = ret._id || ret.uid;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const UserModel = mongoose.model<UserDocument>('User', UserSchema);

