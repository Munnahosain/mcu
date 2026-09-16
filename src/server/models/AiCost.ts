import { Schema, model, models } from 'mongoose';

const AiCostSchema = new Schema({
  provider: { type: String, required: true, index: true },
  model: { type: String, required: true },
  inputTokens: { type: Number, default: 0, min: 0 },
  outputTokens: { type: Number, default: 0, min: 0 },
  requests: { type: Number, default: 0, min: 0 },
  estimatedCost: { type: Number, default: 0, min: 0 },
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  feature: { type: String, default: '' },
}, { timestamps: { createdAt: true, updatedAt: false } });

AiCostSchema.index({ createdAt: -1 });

export const AiCost = models.AiCost || model('AiCost', AiCostSchema);