import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { Subscription } from '@/server/models/Subscription';
import { Plan } from '@/server/models/Plan';
import { User } from '@/server/models/User';
import { consumeCredits, InsufficientCreditsError } from '@/server/services/credit-service';
import { hasMongoDbConfig } from '@/server/db/database-config';

export async function GET(req: Request) {
  try {
    const user = await requireAuthenticatedUser(req);

    if (!hasMongoDbConfig()) {
      const monthly = user.credits?.monthly ?? 2000;
      const bonus = user.credits?.bonus ?? 500;
      const used = user.credits?.used ?? 0;
      return NextResponse.json({
        success: true,
        credits: {
          monthly,
          bonus,
          used,
          remaining: monthly + bonus,
          total: monthly + bonus + used,
        },
        plan: 'free',
        subscription: {
          status: 'active',
          expiresAt: null,
          provider: 'free',
          plan: { name: 'Free', slug: 'free', monthlyCredits: 100, billingInterval: 'month' },
        },
      });
    }

    await connectToDatabase();

    const subscription = await Subscription.findOne({
      userId: user._id,
      status: { $in: ['active', 'trial'] },
    }).sort({ createdAt: -1 }).populate('planId', 'name slug monthlyCredits billingInterval').lean();

    let monthly = Number(user.credits?.monthly ?? 0);
    const bonus = Number(user.credits?.bonus ?? 0);
    const used = Number(user.credits?.used ?? 0);

    // Resolve active plan (from subscription, user planId, or default free plan)
    let activePlan = subscription?.planId as { _id?: unknown; monthlyCredits?: number } | null;
    if (!activePlan) {
      if (user.planId) {
        activePlan = await Plan.findById(user.planId).select('name slug monthlyCredits billingInterval').lean();
      } else {
        activePlan = await Plan.findOne({ slug: 'free', active: true }).select('name slug monthlyCredits billingInterval').lean();
      }
    }

    // If admin increased plan monthlyCredits and user's monthly credits is lower than the new allowance
    if (activePlan?.monthlyCredits && typeof activePlan.monthlyCredits === 'number') {
      const planAllowance = Number(activePlan.monthlyCredits);
      if (monthly < planAllowance && used === 0) {
        monthly = planAllowance;
        await User.updateOne(
          { _id: user._id },
          { $set: { 'credits.monthly': planAllowance, ...(activePlan._id ? { planId: activePlan._id } : {}) } }
        );
      }
    }

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

    // Support 1-Click refill action for testing & creator bonus
    if (body.action === 'refill' || body.action === 'claim_bonus') {
      const refillAmount = Number.isInteger(Number(body.amount)) && Number(body.amount) > 0 ? Number(body.amount) : 5000;
      if (!hasMongoDbConfig()) {
        const { refillDevUserCredits } = await import('@/server/auth/dev-auth');
        const updated = refillDevUserCredits(user._id.toString(), refillAmount);
        const monthly = updated?.credits.monthly ?? 20000;
        const bonus = updated?.credits.bonus ?? 5000;
        const used = updated?.credits.used ?? 0;
        return NextResponse.json({
          success: true,
          message: `Successfully claimed +${refillAmount} bonus credits!`,
          credits: {
            monthly,
            bonus,
            used,
            remaining: monthly + bonus,
            total: monthly + bonus + used,
          },
        });
      }
      await connectToDatabase();
      const updated = await User.findByIdAndUpdate(
        user._id,
        { $inc: { 'credits.bonus': refillAmount }, $set: { updatedAt: new Date() } },
        { new: true }
      ).select('credits').lean();
      const monthly = updated?.credits?.monthly ?? 0;
      const bonus = updated?.credits?.bonus ?? 0;
      const used = updated?.credits?.used ?? 0;
      return NextResponse.json({
        success: true,
        message: `Successfully claimed +${refillAmount} bonus credits!`,
        credits: {
          monthly,
          bonus,
          used,
          remaining: monthly + bonus,
          total: monthly + bonus + used,
        },
      });
    }

    const feature = typeof body.feature === 'string' ? body.feature : '';
    const amount = body.amount === undefined ? 1 : Number(body.amount);
    const allowedFeatures = new Set([
      'three_d_generation', 'grid_generation', 'palette_generation', 'typebox_generation',
      'bento_generation', 'ascii_generation', 'trading_generation', 'splitter_export',
      'metadata_generation', 'prompt_generation', 'advanced_metadata', 'batch_generation',
      'advanced_ai', 'heavy_ai', 'background_removal', 'pattern_generation',
      'svg_motion', 'motion_generation', 'color_extraction', 'image_palette', 'pattern_maker',
      'vector_splitter', 'general_ai'
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
