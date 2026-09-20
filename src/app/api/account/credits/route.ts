import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { Subscription } from '@/server/models/Subscription';
import '@/server/models/Plan';
import { consumeCredits, InsufficientCreditsError } from '@/server/services/credit-service';

export async function GET(req: Request) {
  try {
    const user = await requireAuthenticatedUser(req);
    await connectToDatabase();

    const subscription = await Subscription.findOne({
      userId: user._id,
      status: { $in: ['active', 'trial'] },
    }).sort({ createdAt: -1 }).populate('planId', 'name slug monthlyCredits billingInterval').lean();

    const monthly = user.credits?.monthly || 0;
    const bonus = user.credits?.bonus || 0;
    const used = user.credits?.used || 0;

    return NextResponse.json({
      success: true,
      credits: {
        monthly,
        bonus,
        used,
        remaining: monthly + bonus,
        total: monthly + bonus + used,
      },
      plan: user.planId ? String(user.planId) : null,
      subscription: subscription ? {
        status: subscription.status,
        expiresAt: subscription.expiresAt,
        provider: subscription.provider,
        plan: subscription.planId,
      } : null,
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const feature = typeof body.feature === 'string' ? body.feature : '';
    const amount = body.amount === undefined ? 1 : Number(body.amount);
    const allowedFeatures = new Set([
      'three_d_generation', 'grid_generation', 'palette_generation', 'typebox_generation',
      'bento_generation', 'ascii_generation', 'trading_generation', 'splitter_export',
    ]);
    if (!allowedFeatures.has(feature)) {
      return NextResponse.json({ success: false, error: 'Invalid metered feature.' }, { status: 400 });
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Amount must be a positive integer.' }, { status: 400 });
    }

    await consumeCredits(user._id.toString(), amount, `${feature} usage (${amount} creation${amount === 1 ? '' : 's'})`, feature as Parameters<typeof consumeCredits>[3]);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 402 });
    }
    return authorizationErrorResponse(error);
  }
}
