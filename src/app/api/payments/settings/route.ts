import { NextResponse } from 'next/server';
import { getPaymentSettings, PROVIDER_RULES } from '@/server/services/payment-service';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedProvider = searchParams.get('provider') || undefined;
    const settings = await getPaymentSettings(requestedProvider);
    
    // Provide sanitized rules for client UI
    const clientRules = Object.fromEntries(
      Object.entries(PROVIDER_RULES).map(([key, rule]) => [
        key,
        {
          key: rule.key,
          name: rule.name,
          txIdLengthHint: rule.txIdLengthHint,
          txIdExample: rule.txIdExample,
          txIdPatternStr: rule.txIdPattern.source,
          senderPlaceholder: rule.senderPlaceholder,
          senderHint: rule.senderHint,
          senderPatternStr: rule.senderPattern.source,
        },
      ])
    );

    return NextResponse.json({
      success: true,
      settings: {
        provider: settings.provider || 'bkash',
        enabled: Boolean(settings.enabled),
        paymentMethod: settings.paymentMethod || 'manual',
        accountNumber: settings.accountNumber || '',
        accountType: settings.accountType || 'merchant',
        instructions: settings.instructions || '',
        minimumAmount: settings.minimumAmount || 0,
        maximumAmount: settings.maximumAmount ?? null,
      },
      rules: clientRules,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to load payment settings.' }, { status: 500 });
  }
}

