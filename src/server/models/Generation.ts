import { Schema, model, models } from 'mongoose';

const GenerationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['metadata', 'background_removal', '3d', 'upscale', 'other'], required: true },
  provider: { type: String, default: '' },
  model: { type: String, default: '' },
  inputCount: { type: Number, default: 0, min: 0 },
  outputCount: { type: Number, default: 0, min: 0 },
  creditsUsed: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['success', 'failed'], required: true },
  errorCode: { type: String, default: '' },
  durationMs: { type: Number, default: 0, min: 0 },
}, { timestamps: { createdAt: true, updatedAt: false } });

GenerationSchema.index({ userId: 1, createdAt: -1 });

export const Generation = models.Generation || model('Generation', GenerationSchema);