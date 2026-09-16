import { Schema, model, models } from 'mongoose';

const ApiUsageSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  provider: { type: String, required: true, index: true },
  model: { type: String, default: '' },
  requests: { type: Number, default: 0, min: 0 },
  inputTokens: { type: Number, default: 0, min: 0 },
  outputTokens: { type: Number, default: 0, min: 0 },
  estimatedCost: { type: Number, default: 0, min: 0 },
  errors: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

ApiUsageSchema.index({ provider: 1, createdAt: -1 });

export const ApiUsage = models.ApiUsage || model('ApiUsage', ApiUsageSchema);