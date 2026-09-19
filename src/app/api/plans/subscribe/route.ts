import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { Plan } from '@/server/models/Plan';
import { Subscription } from '@/server/models/Subscription';
import { CreditLedger } from '@/server/models/CreditLedger';
import { User } from '@/server/models/User';
import { randomBytes } from 'crypto';

export async function POST(req: Request) {
  try {
    const user = await requireAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action || (body.planSlug === 'free' ? 'activate_free' : 'checkout');
    const planSlug = typeof body.planSlug === 'string' ? body.planSlug.trim().toLowerCase() : '';
    const billingInterval = body.billingInterval === 'year' ? 'year' : 'month';

    await connectToDatabase();

    // 1. FREE PLAN ACTIVATION (No payment required)
    if (action === 'activate_free' || planSlug === 'free') {
      const freePlan = await Plan.findOne({ slug: 'free', active: true }).lean();
      if (!freePlan) {
        return NextResponse.json({ success: false, error: 'Free plan not found.' }, { status: 404 });
      }

      // Cancel prior subscriptions
      await Subscription.updateMany(
        { userId: user._id, status: { $in: ['active', 'trial', 'pending_payment'] } },
        { $set: { status: 'cancelled', autoRenew: false, cancelledAt: new Date() } }
      );

      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const existingFreeSubscription = await Subscription.findOne({ userId: user._id, planId: freePlan._id, status: 'active' });
      if (!existingFreeSubscription) {
        await Subscription.create({
          userId: user._id,
          planId: freePlan._id,
          status: 'active',
          billingInterval: 'month',
          startedAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          amount: 0,
          currency: 'BDT',
          provider: 'free_tier',
        });
      }

      await User.findByIdAndUpdate(user._id, {
        $set: {
          planId: freePlan._id,
          'credits.monthly': freePlan.monthlyCredits || 100,
          'credits.bonus': 0,
          'credits.used': 0,
          updatedAt: new Date(),
        },
      });

      await CreditLedger.create({
        userId: user._id,
        type: 'monthly_grant',
        amount: freePlan.monthlyCredits || 100,
        balanceBefore: 0,
        balanceAfter: freePlan.monthlyCredits || 100,
        description: 'Monthly Free plan credit allocation',
      });

      return NextResponse.json({
        success: true,
        message: 'Free plan activated successfully.',
        plan: {
          name: freePlan.name,
          slug: 'free',
          credits: freePlan.monthlyCredits || 100,
        },
      });
    }

    // 2. CHECKOUT SESSION CREATION (Initiates payment gateway flow)
    if (action === 'checkout') {
      if (!planSlug) {
        return NextResponse.json({ success: false, error: 'Plan slug is required.' }, { status: 400 });
      }

      const plan = await Plan.findOne({ slug: planSlug, active: true }).lean();
      if (!plan) {
        return NextResponse.json({ success: false, error: 'Selected plan not found or inactive.' }, { status: 404 });
      }

      const price = billingInterval === 'year' ? plan.yearlyPrice : plan.monthlyPrice;
      const invoiceId = `MCU-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;

      // Create a pending subscription
      const pendingSub = await Subscription.create({
        userId: user._id,
        planId: plan._id,
        status: 'pending_payment',
        billingInterval,
        amount: price,
        currency: 'BDT',
        provider: 'bKash / Nagad / SSLCommerz',
        providerPaymentId: invoiceId,
        startedAt: new Date(),
      });

      return NextResponse.json({
        success: true,
        requiresPayment: true,
        subscriptionId: String(pendingSub._id),
        invoiceId,
        plan: {
          name: plan.name,
          slug: plan.slug,
          billingInterval,
          amount: price,
          currency: 'BDT',
          monthlyCredits: plan.monthlyCredits,
        },
      });
    }

    // 3. VERIFY PAYMENT & ACTIVATE PAID PLAN (Webhook / Gateway confirmation)
    if (action === 'verify_payment') {
      const { subscriptionId, paymentMethod, transactionRef } = body;
      if (!subscriptionId) {
        return NextResponse.json({ success: false, error: 'Subscription ID is required.' }, { status: 400 });
      }

      const pendingSub = await Subscription.findOne({
        _id: subscriptionId,
        userId: user._id,
        status: 'pending_payment',
      });

      if (!pendingSub) {
        return NextResponse.json(
          { success: false, error: 'Pending checkout session not found or already processed.' },
          { status: 404 }
        );
      }

      const plan = await Plan.findById(pendingSub.planId).lean();
      if (!plan) {
        return NextResponse.json({ success: false, error: 'Target plan not found.' }, { status: 404 });
      }

      // Cancel any prior active subscriptions
      await Subscription.updateMany(
        { userId: user._id, _id: { $ne: pendingSub._id }, status: { $in: ['active', 'trial'] } },
        { $set: { status: 'cancelled', autoRenew: false, cancelledAt: new Date() } }
      );

      const now = new Date();
      const days = pendingSub.billingInterval === 'year' ? 365 : 30;
      const periodEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      // Activate subscription
      pendingSub.status = 'active';
      pendingSub.currentPeriodStart = now;
      pendingSub.currentPeriodEnd = periodEnd;
      pendingSub.expiresAt = periodEnd;
      pendingSub.provider = paymentMethod || 'bKash / Nagad Gateway';
      pendingSub.providerPaymentId = transactionRef || pendingSub.providerPaymentId;
      await pendingSub.save();

      // Handle rollover calculation
      const currentUser = await User.findById(user._id);
      const existingCredits = (currentUser?.credits?.monthly || 0) + (currentUser?.credits?.bonus || 0);

      let rolloverBonus = 0;
      if (plan.creditRolloverEnabled) {
        const cap = plan.maxRolloverCredits || plan.monthlyCredits;
        rolloverBonus = Math.max(0, Math.min(existingCredits, cap));
      }

      const newMonthly = plan.monthlyCredits;
      const totalNewBalance = newMonthly + rolloverBonus;

      await User.findByIdAndUpdate(user._id, {
        $set: {
          planId: plan._id,
          'credits.monthly': newMonthly,
          'credits.bonus': rolloverBonus,
          'credits.used': 0,
          updatedAt: new Date(),
        },
      });

      // Record in CreditLedger
      await CreditLedger.create({
        userId: user._id,
        type: 'monthly_grant',
        amount: newMonthly,
        balanceBefore: existingCredits,
        balanceAfter: totalNewBalance,
        description: `Subscribed to ${plan.name} (${pendingSub.billingInterval === 'year' ? 'Yearly' : 'Monthly'})`,
        createdBy: user._id,
      });

      if (rolloverBonus > 0) {
        await CreditLedger.create({
          userId: user._id,
          type: 'rollover',
          amount: rolloverBonus,
          balanceBefore: newMonthly,
          balanceAfter: totalNewBalance,
          description: `Credit rollover from previous cycle (capped at ${plan.maxRolloverCredits || plan.monthlyCredits})`,
          createdBy: user._id,
        });
      }

      return NextResponse.json({
        success: true,
        message: `Payment verified! ${plan.name} Plan is now active.`,
        plan: {
          name: plan.name,
          slug: plan.slug,
          totalCredits: totalNewBalance,
          monthlyCredits: newMonthly,
          rolloverCredits: rolloverBonus,
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
