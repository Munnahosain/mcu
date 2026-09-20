import { connectToDatabase } from '@/server/db/mongodb';
import { CreditLedger } from '@/server/models/CreditLedger';
import { User } from '@/server/models/User';
import { SystemSetting } from '@/server/models/SystemSetting';

type CreditCostKey =
  | 'metadata_generation'
  | 'prompt_generation'
  | 'advanced_metadata'
  | 'batch_generation'
  | 'advanced_ai'
  | 'heavy_ai'
  | 'background_removal'
  | 'three_d_generation'
  | 'grid_generation'
  | 'palette_generation'
  | 'typebox_generation'
  | 'bento_generation'
  | 'ascii_generation'
  | 'trading_generation'
  | 'splitter_export';

async function resolveCreditAmount(amount: number, costKey?: CreditCostKey) {
  if (!costKey) return amount;
  const setting = await SystemSetting.findOne({ key: 'credit_costs' }).lean();
  const configured = Number((setting?.value as Record<string, unknown> | undefined)?.[costKey]);
  return Number.isFinite(configured) && configured >= 0 ? amount * Math.floor(configured) : amount;
}

export class InsufficientCreditsError extends Error {
  constructor() {
    super('You do not have enough credits to use this feature.');
    this.name = 'InsufficientCreditsError';
  }
}

export async function consumeCredits(userId: string, amount = 1, reason = 'Feature usage', costKey?: CreditCostKey) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Credit amount must be a positive integer.');
  await connectToDatabase();
  const effectiveAmount = await resolveCreditAmount(amount, costKey);
  if (effectiveAmount === 0) return User.findById(userId).select('_id credits').lean();

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

export async function refundCredits(userId: string, amount = 1, reason = 'Failed feature usage refund', costKey?: CreditCostKey) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Credit amount must be a positive integer.');
  await connectToDatabase();
  const effectiveAmount = await resolveCreditAmount(amount, costKey);
  if (effectiveAmount === 0) return;

  await User.findByIdAndUpdate(userId, {
    $inc: { 'credits.bonus': effectiveAmount, 'credits.used': -effectiveAmount },
    $set: { updatedAt: new Date() },
  });
  await CreditLedger.create({ userId, type: 'refund', amount: effectiveAmount, reason });
}
