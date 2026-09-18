import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { requireRole, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { AuditLog } from '@/server/models/AuditLog';
import { Plan } from '@/server/models/Plan';
import { Subscription } from '@/server/models/Subscription';
import { User } from '@/server/models/User';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const actor = await requireRole(req, ['super_admin', 'admin']);
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const planId = typeof body.planId === 'string' ? body.planId : '';
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(planId)) return NextResponse.json({ success: false, error: 'Invalid user or plan.' }, { status: 400 });

    await connectToDatabase();
    const [user, plan] = await Promise.all([User.findById(id).select('planId').lean(), Plan.findOne({ _id: planId, active: true }).lean()]);
    if (!user) return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    if (!plan) return NextResponse.json({ success: false, error: 'Active plan not found.' }, { status: 404 });

    await Subscription.updateMany({ userId: id, status: { $in: ['active', 'trial'] } }, { $set: { status: 'cancelled', autoRenew: false, updatedAt: new Date() } });
    const startedAt = new Date();
    const expiresAt = new Date(startedAt);
    if (plan.billingInterval === 'year') expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    else expiresAt.setMonth(expiresAt.getMonth() + 1);
    const subscription = await Subscription.create({ userId: id, planId, status: 'active', startedAt, expiresAt, provider: 'manual', autoRenew: false });
    const updated = await User.findByIdAndUpdate(id, { $set: { planId, 'credits.monthly': plan.monthlyCredits, updatedAt: new Date() } }, { new: true }).select('-password').lean();

    await AuditLog.create({ actorId: actor._id, actorRole: actor.role, action: 'CHANGE_PLAN', targetUserId: id, metadata: { beforePlanId: user.planId ? String(user.planId) : null, afterPlanId: planId, subscriptionId: String(subscription._id) }, ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '', userAgent: req.headers.get('user-agent') || '' });
    return NextResponse.json({ success: true, plan: { ...plan, _id: String(plan._id) }, subscription: { ...subscription.toObject(), _id: String(subscription._id) }, user: updated ? { ...updated, _id: String(updated._id), planId: String(updated.planId) } : null });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}