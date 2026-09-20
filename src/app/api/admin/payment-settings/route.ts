import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { PaymentSettings } from '@/server/models/PaymentSettings';
import { AuditLog } from '@/server/models/AuditLog';
import { sanitizeText } from '@/server/services/payment-service';

export async function GET(req: Request) {
  try { await requireAdmin(req); await connectToDatabase(); const settings = await PaymentSettings.findOne({ provider: 'bkash' }).lean(); return NextResponse.json({ success: true, settings: settings || { provider: 'bkash', enabled: false, paymentMethod: 'manual', accountNumber: '', accountType: 'merchant', instructions: '', minimumAmount: 0, maximumAmount: null } }); }
  catch (error) { return authorizationErrorResponse(error); }
}

export async function PUT(req: Request) {
  try {
    const admin = await requireAdmin(req); const body = await req.json().catch(() => ({}));
    const accountNumber = typeof body.accountNumber === 'string' ? body.accountNumber.replace(/[^0-9+]/g, '').slice(0, 20) : '';
    const instructions = typeof body.instructions === 'string' ? sanitizeText(body.instructions, 2000) : '';
    const enabled = body.enabled === true && Boolean(accountNumber);
    const accountType = body.accountType === 'personal' ? 'personal' : 'merchant';
    await connectToDatabase();
    const previous = await PaymentSettings.findOne({ provider: 'bkash' }).lean();
    const settings = await PaymentSettings.findOneAndUpdate({ provider: 'bkash' }, { $set: { provider: 'bkash', paymentMethod: 'manual', enabled, accountNumber, accountType, instructions, minimumAmount: Math.max(0, Number(body.minimumAmount) || 0), maximumAmount: body.maximumAmount === null || body.maximumAmount === '' ? null : Math.max(0, Number(body.maximumAmount) || 0), updatedBy: admin._id } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    await AuditLog.create({ actorId: admin._id, actorRole: admin.role, action: 'PAYMENT_SETTINGS_UPDATED', metadata: { oldValue: { accountNumber: previous?.accountNumber || '', instructions: previous?.instructions || '' }, newValue: { accountNumber, instructions } } });
    return NextResponse.json({ success: true, settings });
  } catch (error) { return authorizationErrorResponse(error); }
}
