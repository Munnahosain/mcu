import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { SystemSetting } from '@/server/models/SystemSetting';
import { SupportSettings } from '@/server/models/SupportSettings';
import { buildWhatsAppUrl, DEFAULT_WHATSAPP_MESSAGE, normalizeWhatsAppNumber, sanitizeSupportText } from '@/server/services/support-service';

const WHATSAPP_KEY = 'whatsapp_support';

function readWhatsApp(value: unknown) {
  const config = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    enabled: config.enabled === true,
    number: typeof config.number === 'string' ? config.number : '',
    message: typeof config.message === 'string' ? config.message : DEFAULT_WHATSAPP_MESSAGE,
    availabilityText: typeof config.availabilityText === 'string' ? config.availabilityText : 'Usually replies during business hours.',
  };
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    await connectToDatabase();
    const [support, whatsapp] = await Promise.all([
      SupportSettings.findOneAndUpdate({ key: 'default' }, { $setOnInsert: { key: 'default' } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean(),
      SystemSetting.findOne({ key: WHATSAPP_KEY }).lean(),
    ]);
    const whatsappConfig = readWhatsApp(whatsapp?.value);
    return NextResponse.json({ success: true, settings: { ...(support || {}), whatsapp: { ...whatsappConfig, validNumber: Boolean(normalizeWhatsAppNumber(whatsappConfig.number)), previewUrl: normalizeWhatsAppNumber(whatsappConfig.number) ? buildWhatsAppUrl(normalizeWhatsAppNumber(whatsappConfig.number) as string, whatsappConfig.message.replaceAll('{USER_ID}', 'USER_ID').replaceAll('{USER_EMAIL}', 'user@example.com')) : '' } } });
  } catch (error) { return authorizationErrorResponse(error); }
}

export async function PUT(req: Request) {
  try {
    const admin = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    await connectToDatabase();
    const support = await SupportSettings.findOneAndUpdate({ key: 'default' }, { $set: { supportEnabled: body.supportEnabled !== false, allowNewTickets: body.allowNewTickets !== false, autoResponse: body.autoResponse !== false, emailNotifications: body.emailNotifications === true, updatedBy: admin._id } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    const whatsappBody = body.whatsapp && typeof body.whatsapp === 'object' ? body.whatsapp as Record<string, unknown> : {};
    const rawNumber = typeof whatsappBody.number === 'string' ? whatsappBody.number : '';
    const number = normalizeWhatsAppNumber(rawNumber);
    if (whatsappBody.enabled === true && !number) return NextResponse.json({ success: false, error: 'Enter a valid WhatsApp number in international format, for example 8801XXXXXXXXX.' }, { status: 400 });
    const message = sanitizeSupportText(whatsappBody.message || DEFAULT_WHATSAPP_MESSAGE, 1000) || DEFAULT_WHATSAPP_MESSAGE;
    const availabilityText = sanitizeSupportText(whatsappBody.availabilityText, 160);
    const whatsapp = await SystemSetting.findOneAndUpdate({ key: WHATSAPP_KEY }, { $set: { value: { enabled: whatsappBody.enabled === true, number: number || '', message, availabilityText }, updatedBy: admin._id } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    return NextResponse.json({ success: true, settings: { ...support, whatsapp: { ...readWhatsApp(whatsapp?.value), validNumber: Boolean(number), previewUrl: number ? buildWhatsAppUrl(number, message.replaceAll('{USER_ID}', 'USER_ID').replaceAll('{USER_EMAIL}', 'user@example.com')) : '' } } });
  } catch (error) { return authorizationErrorResponse(error); }
}
