import { Schema, model, models } from 'mongoose';

const SubscriptionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true, index: true },
  status: { type: String, enum: ['active', 'cancelled', 'expired', 'trial'], default: 'active', index: true },
  startedAt: { type: Date, required: true },
  expiresAt: { type: Date, default: null },
  provider: { type: String, default: 'manual' },
  providerSubscriptionId: { type: String, default: '' },
  autoRenew: { type: Boolean, default: false },
}, { timestamps: true });

export const Subscription = models.Subscription || model('Subscription', SubscriptionSchema);