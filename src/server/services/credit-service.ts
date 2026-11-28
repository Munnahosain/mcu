import { connectToDatabase } from '@/server/db/mongodb';
import { CreditLedger } from '@/server/models/CreditLedger';
import { Subscription } from '@/server/models/Subscription';
import { User } from '@/server/models/User';
import { SystemSetting } from '@/server/models/SystemSetting';
import { hasMongoDbConfig } from '@/server/db/database-config';
import { findDevUserById, updateDevUserCredits, deductDevUserCredits } from '@/server/auth/dev-auth';
import { inMemoryStore } from '@/server/db/in-memory-store';
import { CreditCostKey, DEFAULT_CREDIT_COSTS } from '@/server/services/credit-costs';

type CreditOptions = { usesOwnApiKey?: boolean };

/** Exactly what a consumeCredits call took, so a refund can put it back in the same buckets. */
export interface CreditReceipt {
  monthlyDeducted: number;
  bonusDeducted: number;
  effectiveAmount: number;
}

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Yearly plans pay once but get monthly credits: every 30 days since the last refill the monthly
 * bucket is reset to the plan's monthly credits. Bonus credits are not touched. Runs lazily (no cron)
 * and is safe to call concurrently — the subscription row is claimed atomically.
 */
export async function ensureMonthlyRefill(userId: string) {
  if (!hasMongoDbConfig()) return;
  try {
    await connectToDatabase();
    const now = new Date();
    const due = new Date(now.getTime() - MONTH_MS);
    const sub = await Subscription.findOne({
      userId,
      status: 'active',
      billingInterval: 'year',
      currentPeriodEnd: { $gt: now },
      lastCreditRefillAt: { $lte: due },
    }).lean() as { _id: unknown; lastCreditRefillAt?: Date; monthlyCredits?: number } | null;
    if (!sub?.lastCreditRefillAt || !sub.monthlyCredits) return;

    const last = new Date(sub.lastCreditRefillAt).getTime();
    const periods = Math.floor((now.getTime() - last) / MONTH_MS);
    const nextRefill = new Date(last + periods * MONTH_MS);
    const claimed = await Subscription.findOneAndUpdate(
      { _id: sub._id, lastCreditRefillAt: sub.lastCreditRefillAt },
      { $set: { lastCreditRefillAt: nextRefill } },
      { new: true },
    ).lean();
    if (!claimed) return; // another request refilled first

    const before = await User.findByIdAndUpdate(
      userId,
      { $set: { 'credits.monthly': sub.monthlyCredits, updatedAt: now } },
      { new: false },
    ).select('credits').lean() as { credits?: { monthly?: number; bonus?: number } } | null;
    const balanceBefore = Number(before?.credits?.monthly ?? 0) + Number(before?.credits?.bonus ?? 0);
    await CreditLedger.create({
      userId,
      type: 'monthly_refill',
      amount: sub.monthlyCredits,
      reason: 'Monthly credits for yearly plan',
      description: 'Monthly credits for yearly plan',
      balanceBefore,
      balanceAfter: sub.monthlyCredits + Number(before?.credits?.bonus ?? 0),
    }).catch((error: unknown) => console.warn('[credits] refill ledger error:', error));
  } catch (error) {
    console.error('[credits] monthly refill failed:', error);
  }
}

async function resolveCreditAmount(amount: number, costKey?: CreditCostKey, options: CreditOptions = {}) {
  if (!costKey) return amount;
  const costs = hasMongoDbConfig()
    ? (await SystemSetting.findOne({ key: 'credit_costs' }).lean())?.value as Record<string, unknown> | undefined
    : inMemoryStore.creditCosts;
  const configured = Number(costs?.[costKey] ?? DEFAULT_CREDIT_COSTS[costKey]);
  const unitCost = Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_CREDIT_COSTS[costKey];
  if (options.usesOwnApiKey) {
    if (costs?.byo_api_mode === 'free') return 0;
    if (costs?.byo_api_mode === 'reduced') return Math.max(1, Math.ceil(amount * unitCost * 0.5));
  }
  return amount * unitCost;
}

export class InsufficientCreditsError extends Error {
  constructor() {
    super('You do not have enough credits to use this feature.');
    this.name = 'InsufficientCreditsError';
  }
}

export async function consumeCredits(
  userId: string,
  amount = 1,
  reason = 'Feature usage',
  costKey?: CreditCostKey,
  options: CreditOptions = {},
) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Credit amount must be a positive integer.');

  const effectiveAmount = await resolveCreditAmount(amount, costKey, options);
  if (effectiveAmount === 0) {
    const receipt: CreditReceipt = { monthlyDeducted: 0, bonusDeducted: 0, effectiveAmount: 0 };
    if (!hasMongoDbConfig()) {
      const user = findDevUserById(userId);
      if (!user) throw new InsufficientCreditsError();
      return { _id: userId, credits: user.credits, receipt };
    }
    await connectToDatabase();
    const user = await User.findById(userId).select('_id credits').lean();
    if (!user) throw new InsufficientCreditsError();
    return { ...user, receipt };
  }

  if (!hasMongoDbConfig()) {
    const user = findDevUserById(userId);
    const monthlyBefore = Number(user?.credits.monthly ?? 0);
    const updated = deductDevUserCredits(userId, effectiveAmount);
    if (!updated) throw new InsufficientCreditsError();
    const monthlyDeducted = Math.min(monthlyBefore, effectiveAmount);
    return {
      _id: userId,
      credits: updated.credits,
      receipt: { monthlyDeducted, bonusDeducted: effectiveAmount - monthlyDeducted, effectiveAmount },
    };
  }

  await ensureMonthlyRefill(userId);
  await connectToDatabase();
  // new: false returns the balance before the update, so we know which buckets paid.
  const before = await User.findOneAndUpdate(
    {
      _id: userId,
      $expr: { $gte: [{ $add: ['$credits.monthly', '$credits.bonus'] }, effectiveAmount] },
    },
    [
      {
        $set: {
          'credits.monthly': { $max: [0, { $subtract: ['$credits.monthly', effectiveAmount] }] },
          'credits.bonus': {
            $max: [0, { $subtract: ['$credits.bonus', { $max: [0, { $subtract: [effectiveAmount, '$credits.monthly'] }] }] }],
          },
          'credits.used': { $add: ['$credits.used', effectiveAmount] },
          updatedAt: new Date(),
        },
      },
    ],
    { new: false, updatePipeline: true },
  ).select('_id credits').lean() as { _id: unknown; credits?: { monthly?: number; bonus?: number; used?: number } } | null;

  if (!before) throw new InsufficientCreditsError();

  const monthlyBefore = Math.max(0, Number(before.credits?.monthly ?? 0));
  const bonusBefore = Math.max(0, Number(before.credits?.bonus ?? 0));
  const monthlyDeducted = Math.min(monthlyBefore, effectiveAmount);
  const bonusDeducted = effectiveAmount - monthlyDeducted;

  await CreditLedger.create({ userId, type: 'deduct', amount: effectiveAmount, reason });
  return {
    _id: before._id,
    credits: {
      monthly: monthlyBefore - monthlyDeducted,
      bonus: bonusBefore - bonusDeducted,
      used: Number(before.credits?.used ?? 0) + effectiveAmount,
    },
    receipt: { monthlyDeducted, bonusDeducted, effectiveAmount },
  };
}

/**
 * Puts credits back. Pass the receipt returned by consumeCredits to refund exactly the buckets and
 * amount that were taken. (Passing a number still works for older callers; that path recomputes the
 * cost and returns it to the monthly bucket.)
 */
export async function refundCredits(
  userId: string,
  amountOrReceipt: number | CreditReceipt = 1,
  reason = 'Failed feature usage refund',
  costKey?: CreditCostKey,
  options: CreditOptions = {},
) {
  let receipt: CreditReceipt;
  if (typeof amountOrReceipt === 'number') {
    if (!Number.isInteger(amountOrReceipt) || amountOrReceipt <= 0) throw new Error('Credit amount must be a positive integer.');
    const effectiveAmount = await resolveCreditAmount(amountOrReceipt, costKey, options);
    receipt = { monthlyDeducted: effectiveAmount, bonusDeducted: 0, effectiveAmount };
  } else {
    receipt = amountOrReceipt;
  }
  const { monthlyDeducted, bonusDeducted, effectiveAmount } = receipt;
  if (effectiveAmount <= 0) return;

  if (!hasMongoDbConfig()) {
    updateDevUserCredits(userId, monthlyDeducted, bonusDeducted, -effectiveAmount);
    return;
  }

  await connectToDatabase();
  await User.findByIdAndUpdate(userId, {
    $inc: { 'credits.monthly': monthlyDeducted, 'credits.bonus': bonusDeducted, 'credits.used': -effectiveAmount },
    $set: { updatedAt: new Date() },
  });
  await CreditLedger.create({ userId, type: 'refund', amount: effectiveAmount, reason });
}
