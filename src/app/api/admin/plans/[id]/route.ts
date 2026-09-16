import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { requireRole, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { AuditLog } from '@/server/models/AuditLog';
import { Plan } from '@/server/models/Plan';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const actor = await requireRole(req, ['super_admin', 'admin']);
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ success: false, error: 'Invalid plan id.' }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const update: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.trim()) update.name = body.name.trim();
    if (body.price !== undefined && Number.isFinite(Number(body.price)) && Number(body.price) >= 0) update.price = Number(body.price);
    if (body.billingInterval === 'month' || body.billingInterval === 'year') update.billingInterval = body.billingInterval;
    if (typeof body.monthlyCredits === 'number' && body.monthlyCredits >= 0) update.monthlyCredits = body.monthlyCredits;
    if (typeof body.active === 'boolean') update.active = body.active;
    if (Array.isArray(body.features)) update.features = body.features.filter((feature: unknown): feature is string => typeof feature === 'string').slice(0, 100);
    if (typeof body.limits === 'object' && body.limits) update.limits = body.limits;
    if (!Object.keys(update).length) return NextResponse.json({ success: false, error: 'No valid changes provided.' }, { status: 400 });

    await connectToDatabase();
    const before = await Plan.findById(id).lean();
    if (!before) return NextResponse.json({ success: false, error: 'Plan not found.' }, { status: 404 });
    const updated = await Plan.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    await AuditLog.create({ actorId: actor._id, actorRole: actor.role, action: 'UPDATE_PLAN', metadata: { planId: id, before, after: update }, ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '', userAgent: req.headers.get('user-agent') || '' });
    return NextResponse.json({ success: true, plan: updated ? { ...updated, _id: String(updated._id) } : null });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}