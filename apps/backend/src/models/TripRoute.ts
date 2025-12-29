import mongoose, { Schema, Document } from 'mongoose';
import type { TripRoute, RoutePoint, ModeOfTravel } from '@tripmatrix/types';

export interface TripRouteDocument extends Omit<TripRoute, 'routeId'>, Document<string> {
  _id: string;
  routeId: string;
}

const RoutePointSchema = new Schema(
  {
    lat: Number,
    lng: Number,
    timestamp: Date,
    modeOfTravel: {
      type: String,
      enum: ['walk', 'bike', 'car', 'train', 'bus', 'flight'],
    },
  },
  { _id: false }
);

const TripRouteSchema = new Schema<TripRouteDocument>(
  {
    tripId: {
      type: String,
      required: true,
      // Index defined below
    },
    points: {
      type: [RoutePointSchema],
      required: true,
    },
    modeOfTravel: {
      type: String,
      enum: ['walk', 'bike', 'car', 'train', 'bus', 'flight'],
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
    toJSON: {
      transform: (doc, ret: any) => {
        ret.routeId = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

TripRouteSchema.index({ tripId: 1 });

export const TripRouteModel = mongoose.model<TripRouteDocument>('TripRoute', TripRouteSchema);

