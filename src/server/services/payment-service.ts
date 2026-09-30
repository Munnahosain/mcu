import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/server/db/mongodb';
import { Payment } from '@/server/models/Payment';
import { PaymentSettings } from '@/server/models/PaymentSettings';
import { Plan } from '@/server/models/Plan';
import { Subscription } from '@/server/models/Subscription';
import { User } from '@/server/models/User';
import { CreditLedger } from '@/server/models/CreditLedger';
import { AuditLog } from '@/server/models/AuditLog';
import { hasMongoDbConfig } from '@/server/db/database-config';
import { inMemoryStore } from '@/server/db/in-memory-store';

export type PaymentProvider = 'bkash' | 'nagad' | 'rocket' | 'upay';

export interface ProviderValidationRule {
  key: PaymentProvider;
  name: string;
  txIdPattern: RegExp;
  txIdLengthHint: string;
  txIdExample: string;
  senderPattern: RegExp;
  senderPlaceholder: string;
  senderHint: string;
  defaultInstructions: string;
}

export const PROVIDER_RULES: Record<PaymentProvider, ProviderValidationRule> = {
  bkash: {
    key: 'bkash',
    name: 'bKash',
    txIdPattern: /^[0-9A-Z]{10}$/,
    txIdLengthHint: 'Exactly 10 uppercase letters/numbers',
    txIdExample: 'BL67X9K2MQ',
    senderPattern: /^(?:\+?88)?01[3-9]\d{8}$/,
    senderPlaceholder: '017XXXXXXXX',
    senderHint: 'Valid 11-digit bKash mobile number',
    defaultInstructions: 'Send money / payment to the bKash Merchant or Personal number, then enter your 10-character Transaction ID (TrxID).',
  },
  nagad: {
    key: 'nagad',
    name: 'Nagad',
    txIdPattern: /^[0-9A-Z]{8}$/,
    txIdLengthHint: 'Exactly 8 uppercase letters/numbers',
    txIdExample: '71F8ABCD',
    senderPattern: /^(?:\+?88)?01[3-9]\d{8}$/,
    senderPlaceholder: '01XXXXXXXXX',
    senderHint: 'Valid 11-digit Nagad mobile number',
    defaultInstructions: 'Send money to the Nagad number, then submit your 8-character Transaction ID (TrxID).',
  },
  rocket: {
    key: 'rocket',
    name: 'Rocket',
    txIdPattern: /^[0-9A-Z]{10,12}$/,
    txIdLengthHint: '10 to 12 digits/alphanumeric characters',
    txIdExample: '2837482910',
    senderPattern: /^(?:\+?88)?01[3-9]\d{8,9}$/,
    senderPlaceholder: '01XXXXXXXXXX',
    senderHint: 'Valid 11 or 12 digit Rocket account number',
    defaultInstructions: 'Send money to the Rocket account number, then submit your 10-12 digit Transaction ID (TrxID).',
  },
  upay: {
    key: 'upay',
    name: 'Upay',
    txIdPattern: /^[0-9A-Z]{10}$/,
    txIdLengthHint: 'Exactly 10 alphanumeric characters',
    txIdExample: 'UP12345678',
    senderPattern: /^(?:\+?88)?01[3-9]\d{8}$/,
    senderPlaceholder: '01XXXXXXXXX',
    senderHint: 'Valid 11-digit Upay mobile number',
    defaultInstructions: 'Send money to the Upay number, then submit your 10-character Transaction ID (TrxID).',
  },
};

export function validateTransactionId(value: string, provider: PaymentProvider = 'bkash'): { valid: boolean; normalized: string; error?: string } {
  const normalized = value.trim().replace(/\s+/g, '').toUpperCase();
  const rule = PROVIDER_RULES[provider] || PROVIDER_RULES.bkash;
  if (!rule.txIdPattern.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: `Invalid ${rule.name} Transaction ID. Expected ${rule.txIdLengthHint} (e.g. ${rule.txIdExample}).`,
    };
  }
  return { valid: true, normalized };
}

export function validateSenderMobile(value: string, provider: PaymentProvider = 'bkash'): { valid: boolean; normalized: string; error?: string } {
  const compact = value.trim().replace(/[\s-]/g, '');
  const rule = PROVIDER_RULES[provider] || PROVIDER_RULES.bkash;
  if (!rule.senderPattern.test(compact)) {
    return {
      valid: false,
      normalized: compact,
      error: `Please enter a valid Bangladesh mobile number for ${rule.name} (e.g. ${rule.senderPlaceholder}).`,
    };
  }
  let formatted = compact;
  if (formatted.startsWith('+88')) formatted = formatted.slice(3);
  else if (formatted.startsWith('88')) formatted = formatted.slice(2);
  return { valid: true, normalized: formatted };
}

export function normalizeBangladeshMobile(value: string) {
  const res = validateSenderMobile(value, 'bkash');
  return res.valid ? res.normalized : null;
}

export function normalizeTransactionId(value: string) {
  const res = validateTransactionId(value, 'bkash');
  return res.valid ? res.normalized : null;
}

export function sanitizeText(value: string, maxLength: number) {
  return value.replace(/[<>]/g, '').trim().slice(0, maxLength);
}

export async function getPaymentSettings(requestedProvider?: string) {
  const provider = (requestedProvider && ['bkash', 'nagad', 'rocket', 'upay'].includes(requestedProvider.toLowerCase()))
    ? requestedProvider.toLowerCase() as PaymentProvider
    : null;

  if (!hasMongoDbConfig()) {
    return inMemoryStore.paymentSettings;
  }
  await connectToDatabase();
  
  if (provider) {
    let settings = await PaymentSettings.findOne({ provider }).lean();
    if (!settings) {
      settings = await PaymentSettings.create({
        provider,
        paymentMethod: 'manual',
        enabled: false,
        accountNumber: '',
        accountType: 'merchant',
        instructions: PROVIDER_RULES[provider]?.defaultInstructions || '',
      });
    }
    return settings;
  }

  // Find first enabled provider or fallback to bkash
  const enabledSettings = await PaymentSettings.findOne({ enabled: true }).lean();
  if (enabledSettings) return enabledSettings;

  return PaymentSettings.findOneAndUpdate(
    { provider: 'bkash' },
    { $setOnInsert: { provider: 'bkash', paymentMethod: 'manual', enabled: false, accountNumber: '', accountType: 'merchant', instructions: PROVIDER_RULES.bkash.defaultInstructions } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
}

export async function getBkashSettings() {
  return getPaymentSettings('bkash');
}

export async function approvePayment(paymentObjectId: string, adminId: string, request: Request) {
  if (!hasMongoDbConfig()) {
    const payment = inMemoryStore.payments.find(p => p._id === paymentObjectId);
    if (!payment) throw new Error('PAYMENT_NOT_FOUND');
    payment.status = 'approved';
    return { paymentId: payment.paymentId, amount: payment.amount, credits: 5000, expiresAt: new Date(Date.now() + 30 * 86400000).toISOString() };
  }

  await connectToDatabase();
  const session = await mongoose.startSession();
  try {
    let result: unknown;
    await session.withTransaction(async () => {
      const payment = await Payment.findById(paymentObjectId).session(session);
      if (!payment) throw new Error('PAYMENT_NOT_FOUND');
      if (payment.status !== 'pending') throw new Error(payment.status === 'approved' ? 'PAYMENT_ALREADY_APPROVED' : 'PAYMENT_ALREADY_PROCESSED');
      const [user, plan] = await Promise.all([
        User.findById(payment.userId).session(session),
        Plan.findById(payment.planId).session(session),
      ]);
      if (!user) throw new Error('USER_NOT_FOUND');
      if (!plan) throw new Error('PLAN_NOT_FOUND');

      const now = new Date();
      payment.status = 'approved';
      payment.reviewedAt = now;
      payment.reviewedBy = adminId;
      payment.approvedAt = now;
      await payment.save({ session });

      const existing = await Subscription.findOne({ userId: user._id, status: { $in: ['active', 'trial'] } }).session(session);
      if (existing) {
        existing.status = 'cancelled';
        existing.autoRenew = false;
        existing.cancelledAt = now;
        await existing.save({ session });
      }

      const currentBalance = (user.credits?.monthly || 0) + (user.credits?.bonus || 0);
      const rollover = plan.creditRolloverEnabled ? Math.min(currentBalance, plan.maxRolloverCredits || payment.planSnapshot.credits) : 0;
      const totalCredits = payment.planSnapshot.credits + rollover;
      const end = new Date(now.getTime() + payment.planSnapshot.durationDays * 86400000);
      await Subscription.create([{
        userId: user._id, planId: payment.planId, status: 'active', billingInterval: payment.planSnapshot.billingInterval,
        amount: payment.amount, currency: payment.currency, startedAt: now, currentPeriodStart: now,
        currentPeriodEnd: end, expiresAt: end, provider: 'bkash', providerPaymentId: payment.paymentId, autoRenew: false,
      }], { session });
      await User.updateOne({ _id: user._id }, { $set: { planId: payment.planId, 'credits.monthly': payment.planSnapshot.credits, 'credits.bonus': rollover, 'credits.used': 0, updatedAt: now } }, { session });
      await CreditLedger.create([{
        userId: user._id, type: 'subscription_purchase', amount: payment.planSnapshot.credits,
        reason: `${payment.planSnapshot.name} plan purchase`, description: `${payment.planSnapshot.name} plan purchase`,
        paymentId: payment._id, planId: payment.planId, adminId, balanceBefore: currentBalance, balanceAfter: totalCredits,
      }], { session });
      if (rollover > 0) await CreditLedger.create([{
        userId: user._id, type: 'rollover', amount: rollover, reason: 'Credit rollover', description: 'Credit rollover', adminId,
        paymentId: payment._id, planId: payment.planId, balanceBefore: payment.planSnapshot.credits, balanceAfter: totalCredits,
      }], { session });
      await AuditLog.create([{ actorId: adminId, actorRole: 'admin', action: 'PAYMENT_APPROVED', targetUserId: user._id, metadata: { paymentId: payment.paymentId, amount: payment.amount, planId: String(payment.planId) }, ip: request.headers.get('x-forwarded-for') || '', userAgent: request.headers.get('user-agent') || '' }], { session });
      result = { paymentId: payment.paymentId, amount: payment.amount, credits: totalCredits, expiresAt: end.toISOString() };
    });
    return result as { paymentId: string; amount: number; credits: number; expiresAt: string };
  } finally { await session.endSession(); }
}

export function createPaymentId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `MCUPAY-${date}-${randomBytes(3).toString('hex').toUpperCase()}`;
}
