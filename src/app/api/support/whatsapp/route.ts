import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { SystemSetting } from '@/server/models/SystemSetting';
import { AuditLog } from '@/server/models/AuditLog';
import { buildWhatsAppUrl, DEFAULT_WHATSAPP_MESSAGE, normalizeWhatsAppNumber, sanitizeSupportText } from '@/server/services/support-service';

const SETTING_KEY = 'whatsapp_support';

function getConfig(value: unknown) {
  const config = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return { enabled: config.enabled === true, number: normalizeWhatsAppNumber(config.number), message: sanitizeSupportText(config.message || DEFAULT_WHATSAPP_MESSAGE, 1000), availabilityText: sanitizeSupportText(config.availabilityText, 160) };
}

export async function GET(req: Request) {
  try {
    const user = await requireAuthenticatedUser(req);
    await connectToDatabase();
    const setting = await SystemSetting.findOne({ key: SETTING_KEY }).lean();
    const config = getConfig(setting?.value);
    if (!config.enabled || !config.number) return NextResponse.json({ success: true, enabled: false, availabilityText: config.availabilityText });
    const message = config.message.replaceAll('{USER_ID}', String(user._id)).replaceAll('{USER_EMAIL}', user.email);
    return NextResponse.json({ success: true, enabled: true, availabilityText: config.availabilityText, url: buildWhatsAppUrl(config.number, message) });
  } catch (error) { return authorizationErrorResponse(error); }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuthenticatedUser(req);
    await connectToDatabase();
    const setting = await SystemSetting.findOne({ key: SETTING_KEY }).lean();
    const config = getConfig(setting?.value);
    if (!config.enabled || !config.number) return NextResponse.json({ success: false, error: 'WhatsApp Support is currently unavailable.' }, { status: 503 });
    await AuditLog.create({ actorId: user._id, actorRole: user.role || 'user', action: 'WHATSAPP_SUPPORT_CLICKED', targetUserId: user._id, metadata: { event: 'whatsapp_support_clicked' } });
    return NextResponse.json({ success: true });
  } catch (error) { return authorizationErrorResponse(error); }
}
