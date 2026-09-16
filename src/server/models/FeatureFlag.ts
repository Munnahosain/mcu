import { Schema, model, models } from 'mongoose';

const FeatureFlagSchema = new Schema({
  key: { type: String, required: true, unique: true, index: true },
  enabled: { type: Boolean, default: false },
  plans: { type: [String], default: [] },
}, { timestamps: true });

export const FeatureFlag = models.FeatureFlag || model('FeatureFlag', FeatureFlagSchema);