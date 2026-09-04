import mongoose, { Schema, model, models } from 'mongoose';

const MetadataHistorySchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  filename: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  keywords: {
    type: [String],
    default: [],
  },
  category: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const MetadataHistory = models.MetadataHistory || model('MetadataHistory', MetadataHistorySchema);
