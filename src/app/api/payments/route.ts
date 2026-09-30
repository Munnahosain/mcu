import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { Plan, OFFICIAL_PLANS_SEED } from '@/server/models/Plan';
import { Payment } from '@/server/models/Payment';
import { AuditLog } from '@/server/models/AuditLog';
import { enforceRateLimit } from '@/server/auth/rate-limit';
import {
  getPaymentSettings,
  validateTransactionId,
  validateSenderMobile,
  createPaymentId,
  PaymentProvider,
  PROVIDER_RULES,
} from '@/server/services/payment-service';
import { hasMongoDbConfig } from '@/server/db/database-config';
import { inMemoryStore } from '@/server/db/in-memory-store';

export async function GET(req: Request) {
  try {
    const user = await requireAuthenticatedUser(req);

    if (!hasMongoDbConfig()) {
      const userPayments = inMemoryStore.payments.filter(p => p.userId._id === String(user._id || user.id));
      return NextResponse.json({ success: true, payments: userPayments });
    }

    await connectToDatabase();
    const payments = await Payment.find({ userId: user._id }).sort({ createdAt: -1 }).limit(100).lean();
    return NextResponse.json({
      success: true,
      payments: payments.map((payment) => ({
        ...payment,
        _id: String(payment._id),
        userId: String(payment.userId),
        planId: String(payment.planId),
      })),
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuthenticatedUser(req);
    const limited = enforceRateLimit(req, String(user._id || user.id), {
      limit: 10,
      windowMs: 15 * 60 * 1000,
      keyPrefix: 'payment-submit',
    });
    if (limited) return limited;

    const body = await req.json().catch(() => ({}));
    const planId = typeof body.planId === 'string' ? body.planId.trim() : '';
    const billingInterval = body.billingInterval === 'year' ? 'year' : 'month';
    const requestedProvider = (typeof body.provider === 'string' && ['bkash', 'nagad', 'rocket', 'upay'].includes(body.provider.toLowerCase()))
      ? (body.provider.toLowerCase() as PaymentProvider)
      : 'bkash';

    if (!planId) return NextResponse.json({ success: false, error: 'Plan is required.' }, { status: 400 });
    if (body.termsAccepted !== true) return NextResponse.json({ success: false, error: 'Please accept the Terms and Conditions.' }, { status: 400 });

    // Strict validation based on provider rules
    const txValidation = validateTransactionId(body.transactionId || '', requestedProvider);
    if (!txValidation.valid) {
      return NextResponse.json({ success: false, error: txValidation.error }, { status: 400 });
    }

    const mobileValidation = validateSenderMobile(body.senderNumber || '', requestedProvider);
    if (!mobileValidation.valid) {
      return NextResponse.json({ success: false, error: mobileValidation.error }, { status: 400 });
    }

    const senderNumber = mobileValidation.normalized;
    const transactionId = txValidation.normalized;

    if (!hasMongoDbConfig()) {
      const targetPlan = OFFICIAL_PLANS_SEED.find(p => p.slug === planId || `seed-${OFFICIAL_PLANS_SEED.indexOf(p)}` === planId) || OFFICIAL_PLANS_SEED[1];
      const amount = billingInterval === 'year' ? targetPlan.yearlyPrice : targetPlan.monthlyPrice;
      const paymentId = createPaymentId();
      const newPayment = {
        _id: `pay-${Date.now()}`,
        paymentId,
        userId: { _id: String(user._id || user.id), name: user.name, email: user.email },
        planId: targetPlan.slug,
        planNameSnapshot: targetPlan.name,
        amount,
        provider: requestedProvider,
        senderNumber,
        transactionId,
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
      };
      inMemoryStore.payments.unshift(newPayment);
      return NextResponse.json({ success: true, payment: { paymentId, status: 'pending', amount, currency: 'BDT', provider: requestedProvider } }, { status: 201 });
    }

    await connectToDatabase();
    const settings = await getPaymentSettings(requestedProvider);
    if (!settings?.enabled || !settings?.accountNumber) {
      const providerName = PROVIDER_RULES[requestedProvider]?.name || requestedProvider;
      return NextResponse.json({ success: false, error: `${providerName} payment is temporarily unavailable.` }, { status: 503 });
    }

    const plan = await Plan.findOne({ _id: planId, active: true, isPublic: true }).lean();
    if (!plan) return NextResponse.json({ success: false, error: 'This plan is currently unavailable.' }, { status: 404 });

    const amount = billingInterval === 'year' ? plan.yearlyPrice : plan.monthlyPrice;
    if (amount <= 0) return NextResponse.json({ success: false, error: 'This plan does not require payment.' }, { status: 400 });
    if (amount < settings.minimumAmount || (settings.maximumAmount !== null && amount > settings.maximumAmount)) {
      return NextResponse.json({ success: false, error: 'This plan amount is outside the configured payment limits.' }, { status: 400 });
    }

    if (await Payment.exists({ provider: requestedProvider, transactionId })) {
      return NextResponse.json({ success: false, error: `This ${PROVIDER_RULES[requestedProvider]?.name || ''} transaction ID has already been submitted.` }, { status: 409 });
    }

    if (await Payment.exists({ userId: user._id, planId: plan._id, status: 'pending' })) {
      return NextResponse.json({ success: false, error: 'You already have a payment waiting for verification for this plan.' }, { status: 409 });
    }

    const payment = await Payment.create({
      paymentId: createPaymentId(),
      userId: user._id,
      planId: plan._id,
      planNameSnapshot: plan.name,
      planSnapshot: {
        name: plan.name,
        price: amount,
        currency: plan.currency || 'BDT',
        credits: plan.monthlyCredits,
        durationDays: billingInterval === 'year' ? Math.max(plan.validityDays, 365) : plan.validityDays,
        billingInterval,
      },
      provider: requestedProvider,
      amount,
      currency: plan.currency || 'BDT',
      senderNumber,
      transactionId,
      termsAccepted: true,
      termsAcceptedAt: new Date(),
      submittedAt: new Date(),
    });

    await AuditLog.create({
      actorId: user._id,
      actorRole: user.role || 'user',
      action: 'PAYMENT_SUBMITTED',
      targetUserId: user._id,
      metadata: { paymentId: payment.paymentId, planId: String(plan._id), amount, provider: requestedProvider },
    });

    return NextResponse.json({
      success: true,
      payment: {
        paymentId: payment.paymentId,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        provider: requestedProvider,
      },
    }, { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      return NextResponse.json({ success: false, error: 'This transaction ID has already been submitted.' }, { status: 409 });
    }
    return authorizationErrorResponse(error);
  }
}

