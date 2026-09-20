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

export function normalizeBangladeshMobile(value: string) {
  const compact = value.trim().replace(/[\s-]/g, '');
  if (/^\+8801\d{9}$/.test(compact)) return `0${compact.slice(4)}`;
  if (/^8801\d{9}$/.test(compact)) return `0${compact.slice(3)}`;
  if (/^01\d{9}$/.test(compact)) return compact;
  return null;
}

export function normalizeTransactionId(value: string) {
  const normalized = value.trim().replace(/\s+/g, '').toUpperCase();
  return /^[A-Z0-9_-]{4,80}$/.test(normalized) ? normalized : null;
}

export function sanitizeText(value: string, maxLength: number) {
  return value.replace(/[<>]/g, '').trim().slice(0, maxLength);
}

export async function getBkashSettings() {
  await connectToDatabase();
  return PaymentSettings.findOneAndUpdate(
    { provider: 'bkash' },
    { $setOnInsert: { provider: 'bkash', paymentMethod: 'manual', enabled: false, accountNumber: '', accountType: 'merchant', instructions: '' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
}

export async function approvePayment(paymentObjectId: string, adminId: string, request: Request) {
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
