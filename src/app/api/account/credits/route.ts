import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { Subscription } from '@/server/models/Subscription';

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
