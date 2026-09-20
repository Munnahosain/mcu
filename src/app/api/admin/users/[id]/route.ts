import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { requireAdmin, requireRole, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { AuditLog } from '@/server/models/AuditLog';
import { User } from '@/server/models/User';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    await requireAdmin(req);
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ success: false, error: 'Invalid user id.' }, { status: 400 });

    await connectToDatabase();
    const user = await User.findById(id).select('-password').populate('planId', 'name slug price billingInterval monthlyCredits').lean();
    if (!user) return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });

    return NextResponse.json({ success: true, user: { ...user, _id: String(user._id), planId: user.planId ? String(user.planId) : null } });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const actor = await requireRole(req, ['super_admin', 'admin']);
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ success: false, error: 'Invalid user id.' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const requestedStatus = typeof body.status === 'string' ? body.status : undefined;
    const requestedRole = typeof body.role === 'string' ? body.role : undefined;
    if (requestedStatus && !['active', 'suspended', 'banned', 'pending'].includes(requestedStatus)) {
      return NextResponse.json({ success: false, error: 'Invalid account status.' }, { status: 400 });
    }
    if (requestedRole && !['super_admin', 'admin', 'support', 'user'].includes(requestedRole)) {
      return NextResponse.json({ success: false, error: 'Invalid account role.' }, { status: 400 });
    }

    await connectToDatabase();
    const target = await User.findById(id).select('role status').lean();
    if (!target) return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    if (target.role === 'super_admin' && actor.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Super Admin accounts cannot be modified by this role.' }, { status: 403 });
    }
    if (requestedRole && actor.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Only Super Admin can change roles.' }, { status: 403 });
    }
    if (id === String(actor._id) && (requestedRole || requestedStatus === 'suspended' || requestedStatus === 'banned')) {
      return NextResponse.json({ success: false, error: 'You cannot disable or demote your own account.' }, { status: 400 });
    }

    const update: Record<string, string> = {};
    if (requestedStatus) update.status = requestedStatus;
    if (requestedRole) update.role = requestedRole;
    if (Object.keys(update).length === 0) return NextResponse.json({ success: false, error: 'No changes provided.' }, { status: 400 });

    const updated = await User.findByIdAndUpdate(id, { $set: { ...update, updatedAt: new Date() } }, { new: true })
      .select('-password')
      .lean();
    await AuditLog.create({
      actorId: actor._id,
      actorRole: actor.role,
      action: requestedRole ? 'CHANGE_ROLE' : 'CHANGE_USER_STATUS',
      targetUserId: id,
      metadata: { before: { role: target.role, status: target.status }, after: update },
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
      userAgent: req.headers.get('user-agent') || '',
    });

    return NextResponse.json({ success: true, user: updated ? { ...updated, _id: String(updated._id) } : null });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const actor = await requireRole(req, ['super_admin', 'admin']);
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ success: false, error: 'Invalid user id.' }, { status: 400 });

    await connectToDatabase();
    const target = await User.findById(id).select('name email role').lean();
    if (!target) return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    if (id === String(actor._id)) return NextResponse.json({ success: false, error: 'You cannot delete your own account.' }, { status: 400 });
    if (target.role === 'super_admin' && actor.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Super Admin accounts cannot be deleted by this role.' }, { status: 403 });
    }

    await User.findByIdAndDelete(id);
    await AuditLog.create({
      actorId: actor._id,
      actorRole: actor.role,
      action: 'DELETE_USER',
      targetUserId: id,
      metadata: { email: target.email, name: target.name, role: target.role },
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
      userAgent: req.headers.get('user-agent') || '',
    });

    return NextResponse.json({ success: true, message: 'User deleted successfully.' });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}