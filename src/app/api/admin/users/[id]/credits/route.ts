import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { requireRole, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { AuditLog } from '@/server/models/AuditLog';
import { CreditLedger } from '@/server/models/CreditLedger';
import { User } from '@/server/models/User';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const actor = await requireRole(req, ['super_admin', 'admin']);
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ success: false, error: 'Invalid user id.' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const amount = Number(body.amount);
    if (!['add', 'remove', 'reset'].includes(action)) return NextResponse.json({ success: false, error: 'Invalid credit action.' }, { status: 400 });
    if (action !== 'reset' && (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000)) return NextResponse.json({ success: false, error: 'Amount must be a positive whole number.' }, { status: 400 });

    await connectToDatabase();
    let updated;
    if (action === 'reset') {
      updated = await User.findByIdAndUpdate(id, { $set: { 'credits.monthly': 0, 'credits.bonus': 0, 'credits.used': 0, updatedAt: new Date() } }, { new: true }).select('-password').lean();
    } else if (action === 'add') {
      updated = await User.findByIdAndUpdate(id, { $inc: { 'credits.bonus': amount }, $set: { updatedAt: new Date() } }, { new: true }).select('-password').lean();
    } else {
      updated = await User.findOneAndUpdate({ _id: id, 'credits.bonus': { $gte: amount } }, { $inc: { 'credits.bonus': -amount }, $set: { updatedAt: new Date() } }, { new: true }).select('-password').lean();
      if (!updated) updated = await User.findOneAndUpdate({ _id: id, 'credits.monthly': { $gte: amount } }, { $inc: { 'credits.monthly': -amount }, $set: { updatedAt: new Date() } }, { new: true }).select('-password').lean();
    }

    if (!updated) return NextResponse.json({ success: false, error: action === 'remove' ? 'User does not have enough credits.' : 'User not found.' }, { status: action === 'remove' ? 409 : 404 });

    const ledgerType = action === 'reset' ? 'deduct' : action;
    await CreditLedger.create({ userId: id, type: ledgerType, amount: action === 'reset' ? 0 : amount, reason: `Admin ${action} credits`, adminId: actor._id });
    await AuditLog.create({ actorId: actor._id, actorRole: actor.role, action: action === 'add' ? 'ADD_CREDITS' : action === 'remove' ? 'REMOVE_CREDITS' : 'RESET_CREDITS', targetUserId: id, metadata: { amount: action === 'reset' ? 0 : amount, action }, ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '', userAgent: req.headers.get('user-agent') || '' });

    return NextResponse.json({ success: true, user: { ...updated, _id: String(updated._id) } });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}