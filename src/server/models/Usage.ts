import { Schema, model, models } from 'mongoose';

const UsageSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  period: { type: String, required: true },
  metadataGenerated: { type: Number, default: 0, min: 0 },
  backgroundRemoved: { type: Number, default: 0, min: 0 },
  threeDGenerated: { type: Number, default: 0, min: 0 },
  imagesUploaded: { type: Number, default: 0, min: 0 },
  apiRequests: { type: Number, default: 0, min: 0 },
  storageUsedMB: { type: Number, default: 0, min: 0 },
  creditsUsed: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

UsageSchema.index({ userId: 1, period: 1 }, { unique: true });

export const Usage = models.Usage || model('Usage', UsageSchema);