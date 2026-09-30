import { Schema, model, models } from 'mongoose';

export const SUPPORTED_PAYMENT_PROVIDERS = ['bkash', 'nagad', 'rocket', 'upay'] as const;
export type SupportedPaymentProvider = (typeof SUPPORTED_PAYMENT_PROVIDERS)[number];

const PaymentSettingsSchema = new Schema({
  provider: { type: String, enum: SUPPORTED_PAYMENT_PROVIDERS, default: 'bkash', unique: true },
  enabled: { type: Boolean, default: false },
  paymentMethod: { type: String, enum: ['manual'], default: 'manual' },
  accountNumber: { type: String, default: '', trim: true },
  accountType: { type: String, enum: ['merchant', 'personal', 'agent'], default: 'merchant' },
  instructions: { type: String, default: '', maxlength: 2000 },
  minimumAmount: { type: Number, default: 0, min: 0 },
  maximumAmount: { type: Number, default: null, min: 0 },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

export const PaymentSettings = models.PaymentSettings || model('PaymentSettings', PaymentSettingsSchema);

