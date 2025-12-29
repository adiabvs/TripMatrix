import mongoose, { Schema, Document } from 'mongoose';
import type { TripPlace, ModeOfTravel, ImageMetadata } from '@tripmatrix/types';

export interface TripPlaceDocument extends Omit<TripPlace, 'placeId'>, Document<string> {
  _id: string;
  placeId: string;
  updatedAt?: Date;
}

const ImageMetadataSchema = new Schema(
  {
    url: String,
    isPublic: Boolean,
  },
  { _id: false }
);

const CoordinatesSchema = new Schema(
  {
    lat: Number,
    lng: Number,
  },
  { _id: false, required: true }
);

const TripPlaceSchema = new Schema<TripPlaceDocument>(
  {
    tripId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    coordinates: {
      type: CoordinatesSchema,
      required: true,
    },
    visitedAt: {
      type: Date,
      required: true,
      index: true,
    },
    comment: String,
    rewrittenComment: String,
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    imageMetadata: [ImageMetadataSchema],
    images: [String], // Legacy support
    modeOfTravel: {
      type: String,
      enum: ['walk', 'bike', 'car', 'train', 'bus', 'flight'],
    },
    distanceFromPrevious: { type: Number, required: false }, // in meters
    timeFromPrevious: { type: Number, required: false }, // in seconds
    country: String, // Country code
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
    toJSON: {
      transform: (doc, ret: any) => {
        ret.placeId = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

TripPlaceSchema.index({ tripId: 1, visitedAt: 1 });

export const TripPlaceModel = mongoose.model<TripPlaceDocument>('TripPlace', TripPlaceSchema);

