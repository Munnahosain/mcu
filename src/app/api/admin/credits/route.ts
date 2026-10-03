import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { SystemSetting } from '@/server/models/SystemSetting';
import { User } from '@/server/models/User';
import { CreditLedger } from '@/server/models/CreditLedger';
import { hasMongoDbConfig } from '@/server/db/database-config';
import { inMemoryStore } from '@/server/db/in-memory-store';
import { updateDevUserCredits, findDevUserById } from '@/server/auth/dev-auth';
import { CREDIT_COST_KEYS, DEFAULT_CREDIT_COSTS, MAX_CREDIT_COST } from '@/server/services/credit-costs';

function validateCreditCosts(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'Credit costs must be an object.' };
  }

  const entries = Object.entries(input);
  const unknownKey = entries.find(([key]) => !CREDIT_COST_KEYS.includes(key as keyof typeof DEFAULT_CREDIT_COSTS));
  if (unknownKey) return { error: `Unsupported credit cost key: ${unknownKey[0]}.` };

  const costs: Record<string, number | string> = {};
  for (const [key, value] of entries) {
    if (key === 'byo_api_mode') {
      if (value !== 'charge' && value !== 'free' && value !== 'reduced') {
        return { error: 'BYO API mode must be charge, free, or reduced.' };
      }
      costs[key] = value;
    } else {
      const amount = Number(value);
      if (!Number.isInteger(amount) || amount < 1 || amount > MAX_CREDIT_COST) {
        return { error: `${key} must be an integer between 1 and ${MAX_CREDIT_COST}.` };
      }
      costs[key] = amount;
    }
  }
  return { costs };
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    if (!hasMongoDbConfig()) {
      return NextResponse.json({
        success: true,
        creditCosts: { ...DEFAULT_CREDIT_COSTS, ...inMemoryStore.creditCosts },
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

      if (body.creditCosts !== undefined) {
        const validation = validateCreditCosts(body.creditCosts);
        if (validation.error) return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
        Object.assign(inMemoryStore.creditCosts, validation.costs);
        return NextResponse.json({
          success: true,
          message: 'Credit costs updated successfully.',
          creditCosts: { ...DEFAULT_CREDIT_COSTS, ...inMemoryStore.creditCosts },
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
    if (body.creditCosts !== undefined) {
      const validation = validateCreditCosts(body.creditCosts);
      if (validation.error) return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
      const existing = await SystemSetting.findOne({ key: 'credit_costs' }).lean();
      const updated = await SystemSetting.findOneAndUpdate(
        { key: 'credit_costs' },
        {
          $set: {
            key: 'credit_costs',
            value: { ...DEFAULT_CREDIT_COSTS, ...(existing?.value as Record<string, unknown> || {}), ...validation.costs },
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
