import { Schema, model, models } from 'mongoose';

const CreditLedgerSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['add', 'deduct', 'refund', 'bonus'], required: true },
  amount: { type: Number, required: true, min: 0 },
  reason: { type: String, required: true, maxlength: 500 },
  adminId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });

export const CreditLedger = models.CreditLedger || model('CreditLedger', CreditLedgerSchema);