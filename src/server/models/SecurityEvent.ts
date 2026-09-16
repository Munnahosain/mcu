import { Schema, model, models } from 'mongoose';

const SecurityEventSchema = new Schema({
  type: { type: String, required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false } });

export const SecurityEvent = models.SecurityEvent || model('SecurityEvent', SecurityEventSchema);