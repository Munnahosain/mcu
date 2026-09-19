import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { Subscription } from '@/server/models/Subscription';
import { Plan } from '@/server/models/Plan';
import { CreditLedger } from '@/server/models/CreditLedger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const user = await requireAuthenticatedUser(req);
    await connectToDatabase();

    const [subscription, currentPlan, transactions] = await Promise.all([
      Subscription.findOne({
        userId: user._id,
        status: { $in: ['active', 'trial', 'pending_payment'] },
      })
        .sort({ createdAt: -1 })
        .populate('planId')
        .lean(),
      user.planId ? Plan.findById(user.planId).lean() : null,
      CreditLedger.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    const monthly = user.credits?.monthly || 0;
    const bonus = user.credits?.bonus || 0;
    const used = user.credits?.used || 0;
    const remaining = monthly + bonus;
    const allowance = currentPlan?.monthlyCredits || 100;
    const usagePercent = allowance > 0 ? Math.min(100, Math.round((used / (allowance + bonus)) * 100)) : 0;

    const planData = currentPlan
      ? {
          id: String(currentPlan._id),
          name: currentPlan.name,
          slug: currentPlan.slug,
          description: currentPlan.description,
          monthlyPrice: currentPlan.monthlyPrice ?? 0,
          yearlyPrice: currentPlan.yearlyPrice ?? 0,
          currency: currentPlan.currency || 'BDT',
          monthlyCredits: currentPlan.monthlyCredits ?? 100,
          batchLimit: currentPlan.batchLimit ?? 5,
          bgRemovalLimit: currentPlan.bgRemovalLimit ?? 3,
          activeDeviceLimit: currentPlan.activeDeviceLimit ?? 1,
          creditRolloverEnabled: Boolean(currentPlan.creditRolloverEnabled),
          maxRolloverCredits: currentPlan.maxRolloverCredits ?? 0,
        }
      : {
          id: 'free',
          name: 'Free',
          slug: 'free',
          description: 'Essential tools for stock creators.',
          monthlyPrice: 0,
          yearlyPrice: 0,
          currency: 'BDT',
          monthlyCredits: 100,
          batchLimit: 5,
          bgRemovalLimit: 3,
          activeDeviceLimit: 1,
          creditRolloverEnabled: false,
          maxRolloverCredits: 0,
        };

    const subData = subscription
      ? {
          id: String(subscription._id),
          status: subscription.status,
          startedAt: subscription.startedAt || subscription.createdAt,
          currentPeriodStart: subscription.currentPeriodStart || subscription.startedAt,
          currentPeriodEnd: subscription.currentPeriodEnd || subscription.expiresAt,
          expiresAt: subscription.expiresAt,
          billingInterval: subscription.billingInterval || 'month',
          cancelledAt: subscription.cancelledAt || null,
        }
      : {
          id: 'free',
          status: 'active',
          startedAt: new Date().toISOString(),
          currentPeriodStart: new Date().toISOString(),
          currentPeriodEnd: null,
          expiresAt: null,
          billingInterval: 'month',
          cancelledAt: null,
        };

    return NextResponse.json({
      success: true,
      user: {
        id: String(user._id),
        email: user.email,
        name: user.name,
        role: user.role,
      },
      plan: planData,
      subscription: subData,
      credits: {
        balance: remaining,
        remaining,
        monthly,
        bonus,
        used,
        monthlyAllowance: allowance,
        rolloverCredits: bonus,
        usedThisCycle: used,
        usagePercent,
      },
      transactions: transactions.map((t) => ({
        _id: String(t._id),
        id: String(t._id),
        type: t.type,
        amount: t.amount,
        balanceBefore: t.balanceBefore ?? remaining,
        balanceAfter: t.balanceAfter ?? remaining,
        description: t.description || t.reason || 'AI Credit Operation',
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuthenticatedUser(req);
    await connectToDatabase();
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === 'cancel') {
      const activeSub = await Subscription.findOne({
        userId: user._id,
        status: 'active',
      }).sort({ createdAt: -1 });

      if (!activeSub) {
        return NextResponse.json({ success: false, error: 'No active subscription found to cancel.' }, { status: 404 });
      }

      activeSub.autoRenew = false;
      activeSub.cancelledAt = new Date();
      await activeSub.save();

      return NextResponse.json({
        success: true,
        message: 'Subscription renewal cancelled. Your benefits remain active until the end of the billing period.',
      });
    }

    if (action === 'resume') {
      const cancelledSub = await Subscription.findOne({
        userId: user._id,
        cancelledAt: { $ne: null },
      }).sort({ createdAt: -1 });

      if (!cancelledSub) {
        return NextResponse.json({ success: false, error: 'No cancelled subscription found to resume.' }, { status: 404 });
      }

      cancelledSub.autoRenew = true;
      cancelledSub.cancelledAt = null;
      await cancelledSub.save();

      return NextResponse.json({
        success: true,
        message: 'Subscription renewal resumed successfully.',
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid billing action.' }, { status: 400 });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
