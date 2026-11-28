import { Schema, model, models } from 'mongoose';

const SubscriptionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true, index: true },
    billingInterval: { type: String, enum: ['month', 'year'], default: 'month' },
    status: {
      type: String,
      enum: ['active', 'trial', 'past_due', 'cancelled', 'expired', 'suspended', 'pending_payment'],
      default: 'active',
      index: true,
    },
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'BDT' },
    startedAt: { type: Date, required: true, default: Date.now },
    currentPeriodStart: { type: Date, default: Date.now },
    currentPeriodEnd: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    provider: { type: String, default: 'manual' },
    providerPaymentId: { type: String, default: '' },
    autoRenew: { type: Boolean, default: true },
    /** Yearly plans: monthly credits refilled every 30 days from this date. */
    monthlyCredits: { type: Number, default: 0 },
    lastCreditRefillAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Subscription = models.Subscription || model('Subscription', SubscriptionSchema);