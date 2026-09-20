import { Schema, model, models } from 'mongoose';

export const PAYMENT_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const PaymentSchema = new Schema({
  paymentId: { type: String, required: true, unique: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true, index: true },
  planNameSnapshot: { type: String, required: true },
  planSnapshot: {
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'BDT' },
    credits: { type: Number, required: true, min: 0 },
    durationDays: { type: Number, required: true, min: 1 },
    billingInterval: { type: String, enum: ['month', 'year'], default: 'month' },
  },
  provider: { type: String, enum: ['bkash'], required: true, default: 'bkash' },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true, default: 'BDT' },
  senderNumber: { type: String, required: true, trim: true },
  transactionId: { type: String, required: true, trim: true },
  status: { type: String, enum: PAYMENT_STATUSES, default: 'pending', index: true },
  rejectionReason: { type: String, default: '', maxlength: 500 },
  termsAccepted: { type: Boolean, required: true },
  termsAcceptedAt: { type: Date, required: true },
  submittedAt: { type: Date, default: Date.now, index: true },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

PaymentSchema.index({ provider: 1, transactionId: 1 }, { unique: true });
PaymentSchema.index({ userId: 1, createdAt: -1 });
PaymentSchema.index({ status: 1, createdAt: -1 });

export const Payment = models.Payment || model('Payment', PaymentSchema);
