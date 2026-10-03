import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { Subscription } from '@/server/models/Subscription';
import { Plan } from '@/server/models/Plan';
import { User } from '@/server/models/User';
import { consumeCredits, InsufficientCreditsError } from '@/server/services/credit-service';
import { hasMongoDbConfig } from '@/server/db/database-config';
import { getFeatureFlagDenial } from '@/server/services/feature-flag-service';

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

    if (body.action === 'refill' || body.action === 'claim_bonus') {
      return NextResponse.json(
        { success: false, error: 'Free credit refill is unavailable. Choose a plan to add credits.' },
        { status: 410 }
      );
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

    const aiMeteredFeatures = new Set([
      'metadata_generation', 'prompt_generation', 'advanced_metadata', 'batch_generation',
      'advanced_ai', 'heavy_ai', 'background_removal', 'svg_motion', 'general_ai',
    ]);
    if (aiMeteredFeatures.has(feature)) {
      const aiFeatureDenial = await getFeatureFlagDenial(user._id.toString(), 'ai_tools', 'AI tools');
      if (aiFeatureDenial) return NextResponse.json({ success: false, error: aiFeatureDenial }, { status: 403 });
    }
    const legacyKey = feature === 'background_removal' ? 'bg_remover' : undefined;
    const featureDenial = await getFeatureFlagDenial(user._id.toString(), feature, feature.replaceAll('_', ' '), legacyKey);
    if (featureDenial) return NextResponse.json({ success: false, error: featureDenial }, { status: 403 });
    if (feature === 'pattern_generation' || feature === 'image_palette') {
      const studioDenial = await getFeatureFlagDenial(user._id.toString(), 'pattern_maker', 'Pattern Maker');
      if (studioDenial) return NextResponse.json({ success: false, error: studioDenial }, { status: 403 });
    }
    if (feature === 'image_palette') {
      const extractionDenial = await getFeatureFlagDenial(user._id.toString(), 'color_extraction', 'Color extraction');
      if (extractionDenial) return NextResponse.json({ success: false, error: extractionDenial }, { status: 403 });
    }
    if (feature === 'splitter_export') {
      const splitterDenial = await getFeatureFlagDenial(user._id.toString(), 'vector_splitter', 'Vector splitter');
      if (splitterDenial) return NextResponse.json({ success: false, error: splitterDenial }, { status: 403 });
    }

    const updated = await consumeCredits(
      user._id.toString(),
      amount,
      `${feature} usage (${amount} creation${amount === 1 ? '' : 's'})`,
      feature as Parameters<typeof consumeCredits>[3]
    );
    const monthly = Number(updated?.credits?.monthly ?? 0);
    const bonus = Number(updated?.credits?.bonus ?? 0);
    const used = Number(updated?.credits?.used ?? 0);
    return NextResponse.json({
      success: true,
      credits: {
        monthly,
        bonus,
        used,
        remaining: monthly + bonus,
        total: monthly + bonus + used,
      },
    });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 402 });
    }
    return authorizationErrorResponse(error);
  }
}
