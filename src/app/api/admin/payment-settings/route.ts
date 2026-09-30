import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { PaymentSettings, SUPPORTED_PAYMENT_PROVIDERS, SupportedPaymentProvider } from '@/server/models/PaymentSettings';
import { AuditLog } from '@/server/models/AuditLog';
import { sanitizeText, PROVIDER_RULES, PaymentProvider } from '@/server/services/payment-service';
import { hasMongoDbConfig } from '@/server/db/database-config';
import { inMemoryStore } from '@/server/db/in-memory-store';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const { searchParams } = new URL(req.url);
    const providerParam = searchParams.get('provider') || 'bkash';
    const provider = (SUPPORTED_PAYMENT_PROVIDERS.includes(providerParam as SupportedPaymentProvider)
      ? providerParam
      : 'bkash') as PaymentProvider;

    if (!hasMongoDbConfig()) {
      return NextResponse.json({
        success: true,
        settings: { ...inMemoryStore.paymentSettings, provider },
        supportedProviders: SUPPORTED_PAYMENT_PROVIDERS,
        rules: PROVIDER_RULES,
      });
    }

    await connectToDatabase();
    let settings = await PaymentSettings.findOne({ provider }).lean();
    if (!settings) {
      settings = await PaymentSettings.create({
        provider,
        paymentMethod: 'manual',
        enabled: false,
        accountNumber: '',
        accountType: 'merchant',
        instructions: PROVIDER_RULES[provider]?.defaultInstructions || '',
      });
    }

    return NextResponse.json({
      success: true,
      settings,
      supportedProviders: SUPPORTED_PAYMENT_PROVIDERS,
      rules: PROVIDER_RULES,
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function PUT(req: Request) {
  try {
    const admin = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const provider = (SUPPORTED_PAYMENT_PROVIDERS.includes(body.provider) ? body.provider : 'bkash') as PaymentProvider;
    const accountNumber = typeof body.accountNumber === 'string' ? body.accountNumber.replace(/[^0-9+]/g, '').slice(0, 20) : '';
    const instructions = typeof body.instructions === 'string' ? sanitizeText(body.instructions, 2000) : '';
    const enabled = body.enabled === true && Boolean(accountNumber);
    const accountType = ['merchant', 'personal', 'agent'].includes(body.accountType) ? body.accountType : 'merchant';

    if (!hasMongoDbConfig()) {
      inMemoryStore.paymentSettings = {
        ...inMemoryStore.paymentSettings,
        provider,
        enabled,
        accountNumber,
        accountType,
        instructions,
        minimumAmount: Math.max(0, Number(body.minimumAmount) || 0),
        maximumAmount: body.maximumAmount === null || body.maximumAmount === '' ? null : Math.max(0, Number(body.maximumAmount) || 0),
      };
      return NextResponse.json({ success: true, settings: inMemoryStore.paymentSettings });
    }

    await connectToDatabase();
    const previous = await PaymentSettings.findOne({ provider }).lean();
    const settings = await PaymentSettings.findOneAndUpdate(
      { provider },
      {
        $set: {
          provider,
          paymentMethod: 'manual',
          enabled,
          accountNumber,
          accountType,
          instructions,
          minimumAmount: Math.max(0, Number(body.minimumAmount) || 0),
          maximumAmount: body.maximumAmount === null || body.maximumAmount === '' ? null : Math.max(0, Number(body.maximumAmount) || 0),
          updatedBy: admin._id,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    await AuditLog.create({
      actorId: admin._id,
      actorRole: admin.role,
      action: 'PAYMENT_SETTINGS_UPDATED',
      metadata: {
        provider,
        oldValue: { accountNumber: previous?.accountNumber || '', instructions: previous?.instructions || '' },
        newValue: { accountNumber, instructions, enabled },
      },
    });

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

