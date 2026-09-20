import { NextResponse } from 'next/server';
import { getBkashSettings } from '@/server/services/payment-service';

export async function GET() {
  try {
    const settings = await getBkashSettings();
    return NextResponse.json({ success: true, settings: { provider: settings.provider, enabled: settings.enabled, paymentMethod: settings.paymentMethod, accountNumber: settings.accountNumber, accountType: settings.accountType, instructions: settings.instructions, minimumAmount: settings.minimumAmount, maximumAmount: settings.maximumAmount } });
  } catch { return NextResponse.json({ success: false, error: 'Unable to load payment settings.' }, { status: 500 }); }
}
