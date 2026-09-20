import { Schema, model, models } from 'mongoose';

const CreditLedgerSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['add', 'deduct', 'refund', 'bonus', 'monthly_grant', 'rollover', 'subscription_purchase'], required: true },
  amount: { type: Number, required: true, min: 0 },
  reason: { type: String, required: true, maxlength: 500 },
  adminId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  description: { type: String, default: '' },
  paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', default: null, index: true },
  planId: { type: Schema.Types.ObjectId, ref: 'Plan', default: null },
  balanceBefore: { type: Number, default: 0 },
  balanceAfter: { type: Number, default: 0 },
}, { timestamps: { createdAt: true, updatedAt: false } });

CreditLedgerSchema.index({ paymentId: 1, type: 1 }, { unique: true, sparse: true });

export const CreditLedger = models.CreditLedger || model('CreditLedger', CreditLedgerSchema);