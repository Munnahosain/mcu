import { Schema, model, models } from 'mongoose';

const ProviderKeySchema = new Schema({
  userId: { type: String, required: true, index: true },
  provider: { type: String, required: true },
  encryptedKey: { type: String, required: true },
  fingerprint: { type: String, required: true },
  lastFour: { type: String, required: true },
  model: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

ProviderKeySchema.index({ userId: 1, provider: 1, fingerprint: 1 }, { unique: true });

export const ProviderKey = models.ProviderKey || model('ProviderKey', ProviderKeySchema);