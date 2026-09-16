import { Schema, model, models } from 'mongoose';

const CouponSchema = new Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  type: { type: String, enum: ['percentage', 'fixed', 'bonus_credits'], required: true },
  value: { type: Number, required: true, min: 0 },
  maxUses: { type: Number, default: 0, min: 0 },
  usedCount: { type: Number, default: 0, min: 0 },
  expiresAt: { type: Date, default: null },
  active: { type: Boolean, default: true, index: true },
  applicablePlans: { type: [String], default: [] },
}, { timestamps: true });

export const Coupon = models.Coupon || model('Coupon', CouponSchema);