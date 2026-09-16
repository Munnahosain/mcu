import { Schema, model, models } from 'mongoose';

const PlanSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    price: { type: Number, required: true, min: 0, default: 0 },
    billingInterval: { type: String, enum: ['month', 'year'], default: 'month' },
    limits: {
      metadata: { type: Number, default: 0, min: 0 },
      backgroundRemoval: { type: Number, default: 0, min: 0 },
      threeDGeneration: { type: Number, default: 0, min: 0 },
      imageUploads: { type: Number, default: 0, min: 0 },
      apiRequests: { type: Number, default: 0, min: 0 },
      storageMB: { type: Number, default: 0, min: 0 },
    },
    monthlyCredits: { type: Number, default: 0, min: 0 },
    features: { type: [String], default: [] },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const Plan = models.Plan || model('Plan', PlanSchema);