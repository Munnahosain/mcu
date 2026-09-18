import { connectToDatabase } from '@/server/db/mongodb';
import { CreditLedger } from '@/server/models/CreditLedger';
import { User } from '@/server/models/User';

export class InsufficientCreditsError extends Error {
  constructor() {
    super('You do not have enough credits to use this feature.');
    this.name = 'InsufficientCreditsError';
  }
}

export async function consumeCredits(userId: string, amount = 1, reason = 'Feature usage') {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Credit amount must be a positive integer.');
  await connectToDatabase();

  const updated = await User.findOneAndUpdate(
    {
      _id: userId,
      $expr: { $gte: [{ $add: ['$credits.monthly', '$credits.bonus'] }, amount] },
    },
    [
      {
        $set: {
          'credits.monthly': { $max: [0, { $subtract: ['$credits.monthly', amount] }] },
          'credits.bonus': {
            $max: [0, { $subtract: ['$credits.bonus', { $max: [0, { $subtract: [amount, '$credits.monthly'] }] }] }],
          },
          'credits.used': { $add: ['$credits.used', amount] },
          updatedAt: new Date(),
        },
      },
    ],
    { new: true },
  ).select('_id credits').lean();

  if (!updated) throw new InsufficientCreditsError();

  await CreditLedger.create({ userId, type: 'deduct', amount, reason });
  return updated;
}

export async function refundCredits(userId: string, amount = 1, reason = 'Failed feature usage refund') {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Credit amount must be a positive integer.');
  await connectToDatabase();

  await User.findByIdAndUpdate(userId, {
    $inc: { 'credits.bonus': amount, 'credits.used': -amount },
    $set: { updatedAt: new Date() },
  });
  await CreditLedger.create({ userId, type: 'refund', amount, reason });
}
