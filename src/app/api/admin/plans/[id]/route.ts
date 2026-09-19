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
    if (typeof body.description === 'string') update.description = body.description.trim();
    
    if (body.monthlyPrice !== undefined && Number.isFinite(Number(body.monthlyPrice)) && Number(body.monthlyPrice) >= 0) {
      update.monthlyPrice = Number(body.monthlyPrice);
      update.price = Number(body.monthlyPrice); // backwards compatibility
    }
    if (body.yearlyPrice !== undefined && Number.isFinite(Number(body.yearlyPrice)) && Number(body.yearlyPrice) >= 0) {
      update.yearlyPrice = Number(body.yearlyPrice);
    }
    if (typeof body.currency === 'string') update.currency = body.currency;
    if (body.monthlyCredits !== undefined && Number.isFinite(Number(body.monthlyCredits)) && Number(body.monthlyCredits) >= 0) {
      update.monthlyCredits = Number(body.monthlyCredits);
    }
    if (body.batchLimit !== undefined && Number.isFinite(Number(body.batchLimit)) && Number(body.batchLimit) >= 1) {
      update.batchLimit = Number(body.batchLimit);
    }
    if (body.bgRemovalLimit !== undefined && Number.isFinite(Number(body.bgRemovalLimit)) && Number(body.bgRemovalLimit) >= 0) {
      update.bgRemovalLimit = Number(body.bgRemovalLimit);
    }
    if (body.validityDays !== undefined && Number.isFinite(Number(body.validityDays)) && Number(body.validityDays) >= 1) {
      update.validityDays = Number(body.validityDays);
    }
    if (typeof body.creditRolloverEnabled === 'boolean') update.creditRolloverEnabled = body.creditRolloverEnabled;
    if (body.maxRolloverCredits !== undefined && Number.isFinite(Number(body.maxRolloverCredits))) {
      update.maxRolloverCredits = Number(body.maxRolloverCredits);
    }
    if (body.activeDeviceLimit !== undefined && Number.isFinite(Number(body.activeDeviceLimit))) {
      update.activeDeviceLimit = Number(body.activeDeviceLimit);
    }
    if (typeof body.badgeText === 'string') update.badgeText = body.badgeText.trim();
    if (typeof body.isPopular === 'boolean') update.isPopular = body.isPopular;
    if (typeof body.ctaText === 'string') update.ctaText = body.ctaText.trim();
    if (typeof body.ctaAction === 'string') update.ctaAction = body.ctaAction.trim();
    if (body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))) {
      update.sortOrder = Number(body.sortOrder);
    }
    if (typeof body.active === 'boolean') update.active = body.active;
    if (typeof body.isPublic === 'boolean') update.isPublic = body.isPublic;
    if (Array.isArray(body.features)) {
      update.features = body.features.filter((feature: unknown): feature is string => typeof feature === 'string').slice(0, 100);
    }
    if (typeof body.limits === 'object' && body.limits) update.limits = body.limits;

    if (!Object.keys(update).length) return NextResponse.json({ success: false, error: 'No valid changes provided.' }, { status: 400 });

    await connectToDatabase();
    const before = await Plan.findById(id).lean();
    if (!before) return NextResponse.json({ success: false, error: 'Plan not found.' }, { status: 404 });
    const updated = await Plan.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    await AuditLog.create({ 
      actorId: actor._id, 
      actorRole: actor.role, 
      action: 'UPDATE_PLAN', 
      metadata: { planId: id, before, after: update }, 
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '', 
      userAgent: req.headers.get('user-agent') || '' 
    });
    return NextResponse.json({ success: true, plan: updated ? { ...updated, _id: String(updated._id) } : null });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const actor = await requireRole(req, ['super_admin', 'admin']);
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ success: false, error: 'Invalid plan id.' }, { status: 400 });

    await connectToDatabase();
    const before = await Plan.findById(id).lean();
    if (!before) return NextResponse.json({ success: false, error: 'Plan not found.' }, { status: 404 });

    await Plan.findByIdAndDelete(id);
    await AuditLog.create({ 
      actorId: actor._id, 
      actorRole: actor.role, 
      action: 'DELETE_PLAN', 
      metadata: { planId: id, name: before.name, slug: before.slug }, 
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '', 
      userAgent: req.headers.get('user-agent') || '' 
    });

    return NextResponse.json({ success: true, message: 'Plan deleted successfully.' });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}