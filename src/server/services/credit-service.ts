import { connectToDatabase } from '@/server/db/mongodb';
import { CreditLedger } from '@/server/models/CreditLedger';
import { User } from '@/server/models/User';
import { SystemSetting } from '@/server/models/SystemSetting';
import { hasMongoDbConfig } from '@/server/db/database-config';
import { updateDevUserCredits, deductDevUserCredits } from '@/server/auth/dev-auth';

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
  | 'splitter_export'
  | 'pattern_generation'
  | 'svg_motion'
  | 'motion_generation'
  | 'color_extraction'
  | 'image_palette'
  | 'pattern_maker'
  | 'vector_splitter'
  | 'general_ai';

async function resolveCreditAmount(amount: number, costKey?: CreditCostKey) {
  if (!costKey) return amount;
  if (!hasMongoDbConfig()) return amount;
  try {
    const setting = await SystemSetting.findOne({ key: 'credit_costs' }).lean();
    const configured = Number((setting?.value as Record<string, unknown> | undefined)?.[costKey]);
    return Number.isFinite(configured) && configured >= 0 ? amount * Math.floor(configured) : amount;
  } catch {
    return amount;
  }
}

export class InsufficientCreditsError extends Error {
  constructor() {
    super('You do not have enough credits to use this feature.');
    this.name = 'InsufficientCreditsError';
  }
}

export async function consumeCredits(userId: string, amount = 1, reason = 'Feature usage', costKey?: CreditCostKey) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Credit amount must be a positive integer.');

  if (!hasMongoDbConfig()) {
    const effectiveAmount = await resolveCreditAmount(amount, costKey);
    try {
      const updated = deductDevUserCredits(userId, effectiveAmount);
      return { _id: userId, credits: updated?.credits || { monthly: 2000, bonus: 500, used: effectiveAmount } };
    } catch {
      throw new InsufficientCreditsError();
    }
  }

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

  if (!hasMongoDbConfig()) {
    updateDevUserCredits(userId, amount, 0, -amount);
    return;
  }

  await connectToDatabase();
  const effectiveAmount = await resolveCreditAmount(amount, costKey);
  if (effectiveAmount === 0) return;

  await User.findByIdAndUpdate(userId, {
    $inc: { 'credits.bonus': effectiveAmount, 'credits.used': -effectiveAmount },
    $set: { updatedAt: new Date() },
  });
  await CreditLedger.create({ userId, type: 'refund', amount: effectiveAmount, reason });
}
