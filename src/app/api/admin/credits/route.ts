import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { SystemSetting } from '@/server/models/SystemSetting';
import { User } from '@/server/models/User';
import { CreditLedger } from '@/server/models/CreditLedger';
import { hasMongoDbConfig } from '@/server/db/database-config';
import { inMemoryStore } from '@/server/db/in-memory-store';
import { updateDevUserCredits, findDevUserById } from '@/server/auth/dev-auth';

const DEFAULT_CREDIT_COSTS = {
  metadata_generation: 1,
  prompt_generation: 1,
  advanced_metadata: 2,
  batch_generation: 1,
  advanced_ai: 2,
  heavy_ai: 5,
  background_removal: 5,
  three_d_generation: 1,
  grid_generation: 1,
  palette_generation: 1,
  typebox_generation: 1,
  bento_generation: 1,
  ascii_generation: 1,
  trading_generation: 1,
  splitter_export: 1,
  byo_api_mode: 'charge', // 'charge' | 'free' | 'reduced'
};

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    if (!hasMongoDbConfig()) {
      return NextResponse.json({
        success: true,
        creditCosts: inMemoryStore.creditCosts,
      });
    }

    await connectToDatabase();

    const setting = await SystemSetting.findOne({ key: 'credit_costs' }).lean();
    const creditCosts = { ...DEFAULT_CREDIT_COSTS, ...(setting?.value as Record<string, unknown> || {}) };

    return NextResponse.json({
      success: true,
      creditCosts,
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));

    if (!hasMongoDbConfig()) {
      if (body.action === 'adjust_user') {
        const { userId, amount, reason } = body;
        const numAmount = Number(amount);
        if (!userId || !Number.isFinite(numAmount) || numAmount === 0) {
          return NextResponse.json({ success: false, error: 'Valid userId and non-zero amount are required.' }, { status: 400 });
        }
        const updated = updateDevUserCredits(userId, numAmount > 0 ? numAmount : 0, 0, numAmount < 0 ? Math.abs(numAmount) : 0);
        const target = findDevUserById(userId);
        return NextResponse.json({
          success: true,
          message: `Successfully adjusted credits by ${numAmount > 0 ? `+${numAmount}` : numAmount}.`,
          user: {
            id: userId,
            email: target?.email || 'user@mcustock.com',
            balance: (target?.credits.monthly ?? 0) + (target?.credits.bonus ?? 0),
          },
        });
      }

      if (body.creditCosts && typeof body.creditCosts === 'object') {
        Object.assign(inMemoryStore.creditCosts, body.creditCosts);
        return NextResponse.json({
          success: true,
          message: 'Credit costs updated successfully.',
          creditCosts: inMemoryStore.creditCosts,
        });
      }
      return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
    }

    await connectToDatabase();

    // Manual user credit adjustment
    if (body.action === 'adjust_user') {
      const { userId, amount, reason } = body;
      const numAmount = Number(amount);
      if (!userId || !Number.isFinite(numAmount) || numAmount === 0) {
        return NextResponse.json({ success: false, error: 'Valid userId and non-zero amount are required.' }, { status: 400 });
      }

      const user = await User.findById(userId);
      if (!user) {
        return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
      }

      const beforeBalance = (user.credits?.monthly || 0) + (user.credits?.bonus || 0);

      if (numAmount > 0) {
        user.credits = {
          ...user.credits,
          bonus: (user.credits?.bonus || 0) + numAmount,
        };
      } else {
        const deduct = Math.abs(numAmount);
        const monthly = user.credits?.monthly || 0;
        const bonus = user.credits?.bonus || 0;
        const newMonthly = Math.max(0, monthly - deduct);
        const remainingDeduct = Math.max(0, deduct - monthly);
        const newBonus = Math.max(0, bonus - remainingDeduct);
        user.credits = {
          ...user.credits,
          monthly: newMonthly,
          bonus: newBonus,
        };
      }

      await user.save();
      const afterBalance = (user.credits?.monthly || 0) + (user.credits?.bonus || 0);

      await CreditLedger.create({
        userId,
        type: numAmount > 0 ? 'admin_grant' : 'admin_deduct',
        amount: numAmount,
        balanceBefore: beforeBalance,
        balanceAfter: afterBalance,
        reason: reason || 'Admin manual credit adjustment',
        createdBy: actor._id,
      });

      return NextResponse.json({
        success: true,
        message: `Successfully adjusted credits by ${numAmount > 0 ? `+${numAmount}` : numAmount}.`,
        user: {
          id: user._id,
          email: user.email,
          balance: afterBalance,
        },
      });
    }

    // Save credit costs configuration
    if (body.creditCosts && typeof body.creditCosts === 'object') {
      const updated = await SystemSetting.findOneAndUpdate(
        { key: 'credit_costs' },
        {
          $set: {
            key: 'credit_costs',
            value: { ...DEFAULT_CREDIT_COSTS, ...body.creditCosts },
            updatedBy: actor._id,
          },
        },
        { upsert: true, new: true }
      ).lean();

      return NextResponse.json({
        success: true,
        message: 'Credit costs updated successfully.',
        creditCosts: updated?.value,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
