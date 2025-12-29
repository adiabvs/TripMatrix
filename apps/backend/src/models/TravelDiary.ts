import mongoose, { Schema, Document } from 'mongoose';
import type { TravelDiary, DiaryPlatform } from '@tripmatrix/types';

export interface TravelDiaryDocument extends Omit<TravelDiary, 'diaryId'>, Document<string> {
  _id: string;
  diaryId: string;
}

const TravelDiarySchema = new Schema<TravelDiaryDocument>(
  {
    tripId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: String,
    coverImageUrl: String,
    platform: {
      type: String,
      enum: ['canva', 'pdf'],
    },
    canvaDesignId: String,
    canvaDesignUrl: String,
    canvaEditorUrl: String,
    pdfUrl: String,
    pdfFileName: String,
    pdfDownloadUrl: String,
    designData: Schema.Types.Mixed, // JSONB equivalent
    videoUrl: String,
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
        ret.diaryId = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

TravelDiarySchema.index({ tripId: 1 });

export const TravelDiaryModel = mongoose.model<TravelDiaryDocument>('TravelDiary', TravelDiarySchema);

