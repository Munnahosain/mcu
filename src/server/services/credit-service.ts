import { connectToDatabase } from '@/server/db/mongodb';
import { CreditLedger } from '@/server/models/CreditLedger';
import { User } from '@/server/models/User';
import { SystemSetting } from '@/server/models/SystemSetting';
import { hasMongoDbConfig } from '@/server/db/database-config';
import { findDevUserById, updateDevUserCredits, deductDevUserCredits } from '@/server/auth/dev-auth';
import { inMemoryStore } from '@/server/db/in-memory-store';
import { CreditCostKey, DEFAULT_CREDIT_COSTS } from '@/server/services/credit-costs';

type CreditOptions = { usesOwnApiKey?: boolean };

async function resolveCreditAmount(amount: number, costKey?: CreditCostKey, options: CreditOptions = {}) {
  if (!costKey) return amount;
  const costs = hasMongoDbConfig()
    ? (await SystemSetting.findOne({ key: 'credit_costs' }).lean())?.value as Record<string, unknown> | undefined
    : inMemoryStore.creditCosts;
  const configured = Number(costs?.[costKey] ?? DEFAULT_CREDIT_COSTS[costKey]);
  const unitCost = Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_CREDIT_COSTS[costKey];
  if (options.usesOwnApiKey) {
    if (costs?.byo_api_mode === 'free') return 0;
    if (costs?.byo_api_mode === 'reduced') return amount * unitCost * 0.5;
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
    if (!hasMongoDbConfig()) {
      const user = findDevUserById(userId);
      if (!user) throw new InsufficientCreditsError();
      return { _id: userId, credits: user.credits };
    }
    await connectToDatabase();
    const user = await User.findById(userId).select('_id credits').lean();
    if (!user) throw new InsufficientCreditsError();
    return user;
  }

  if (!hasMongoDbConfig()) {
    try {
      const updated = deductDevUserCredits(userId, effectiveAmount);
      if (!updated) throw new InsufficientCreditsError();
      return { _id: userId, credits: updated.credits };
    } catch {
      throw new InsufficientCreditsError();
    }
  }

  await connectToDatabase();
  const updated = await User.findOneAndUpdate(
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
    { new: true, updatePipeline: true },
  ).select('_id credits').lean();

  if (!updated) throw new InsufficientCreditsError();

  await CreditLedger.create({ userId, type: 'deduct', amount: effectiveAmount, reason });
  return updated;
}

export async function refundCredits(
  userId: string,
  amount = 1,
  reason = 'Failed feature usage refund',
  costKey?: CreditCostKey,
  options: CreditOptions = {},
) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Credit amount must be a positive integer.');

  const effectiveAmount = await resolveCreditAmount(amount, costKey, options);
  if (effectiveAmount === 0) return;

  if (!hasMongoDbConfig()) {
    updateDevUserCredits(userId, effectiveAmount, 0, -effectiveAmount);
    return;
  }

  await connectToDatabase();
  await User.findByIdAndUpdate(userId, {
    $inc: { 'credits.bonus': effectiveAmount, 'credits.used': -effectiveAmount },
    $set: { updatedAt: new Date() },
  });
  await CreditLedger.create({ userId, type: 'refund', amount: effectiveAmount, reason });
}
