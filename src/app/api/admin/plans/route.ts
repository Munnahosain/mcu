import { NextResponse } from 'next/server';
import { requireAdmin, requireRole, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { AuditLog } from '@/server/models/AuditLog';
import { Plan, OFFICIAL_PLANS_SEED } from '@/server/models/Plan';

function normalizePlan(input: Record<string, unknown>) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const slug = typeof input.slug === 'string' ? input.slug.trim().toLowerCase() : '';
  const monthlyPrice = Number(input.monthlyPrice ?? input.price ?? 0);
  const yearlyPrice = Number(input.yearlyPrice ?? (monthlyPrice * 10));

  if (!name || !/^[a-z0-9-]+$/.test(slug) || !Number.isFinite(monthlyPrice) || monthlyPrice < 0) {
    return null;
  }

  return {
    name,
    slug,
    description: typeof input.description === 'string' ? input.description.trim() : '',
    monthlyPrice,
    yearlyPrice: Math.max(0, yearlyPrice),
    price: monthlyPrice,
    currency: 'BDT',
    billingInterval: input.billingInterval === 'year' ? 'year' : 'month',
    monthlyCredits: Math.max(0, Number(input.monthlyCredits) || 0),
    batchLimit: Math.max(1, Number(input.batchLimit) || 5),
    bgRemovalLimit: Math.max(0, Number(input.bgRemovalLimit) || 0),
    validityDays: Math.max(1, Number(input.validityDays) || 30),
    creditRolloverEnabled: Boolean(input.creditRolloverEnabled),
    maxRolloverCredits: Math.max(0, Number(input.maxRolloverCredits) || 0),
    activeDeviceLimit: Math.max(1, Number(input.activeDeviceLimit) || 1),
    priorityLevel: ['standard', 'high', 'maximum'].includes(String(input.priorityLevel))
      ? String(input.priorityLevel)
      : 'standard',
    badgeText: typeof input.badgeText === 'string' ? input.badgeText.trim() : '',
    isPopular: Boolean(input.isPopular),
    ctaText: typeof input.ctaText === 'string' && input.ctaText.trim() ? input.ctaText.trim() : 'Choose Plan',
    ctaAction: typeof input.ctaAction === 'string' ? input.ctaAction.trim() : '',
    features: Array.isArray(input.features)
      ? input.features.filter((f): f is string => typeof f === 'string').map((f) => f.trim()).filter(Boolean)
      : [],
    sortOrder: Number(input.sortOrder) || 0,
    active: input.active !== false,
    isPublic: input.isPublic !== false,
  };
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    await connectToDatabase();
    const plans = await Plan.find().sort({ sortOrder: 1, monthlyPrice: 1 }).lean();
    return NextResponse.json({
      success: true,
      plans: plans.map((plan) => ({ ...plan, _id: String(plan._id) })),
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireRole(req, ['super_admin', 'admin']);
    const body = await req.json().catch(() => ({}));

    await connectToDatabase();

    // Reset & seed official BDT plans action
    if (body.action === 'seed') {
      await Plan.deleteMany({});
      await Plan.insertMany(OFFICIAL_PLANS_SEED);

      await AuditLog.create({
        actorId: actor._id,
        actorRole: actor.role,
        action: 'SEED_OFFICIAL_PLANS',
        metadata: { plansCount: OFFICIAL_PLANS_SEED.length },
        ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
        userAgent: req.headers.get('user-agent') || '',
      });

      const seeded = await Plan.find().sort({ sortOrder: 1, monthlyPrice: 1 }).lean();
      return NextResponse.json({
        success: true,
        message: 'Previous plans deleted and official BDT plans seeded successfully.',
        plans: seeded.map((p) => ({ ...p, _id: String(p._id) })),
      });
    }

    const plan = normalizePlan(body);
    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Name, slug and a valid non-negative monthly price are required.' },
        { status: 400 }
      );
    }

    const created = await Plan.create(plan);
    await AuditLog.create({
      actorId: actor._id,
      actorRole: actor.role,
      action: 'CREATE_PLAN',
      metadata: { planId: String(created._id), slug: created.slug },
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
      userAgent: req.headers.get('user-agent') || '',
    });

    return NextResponse.json(
      { success: true, plan: { ...created.toObject(), _id: String(created._id) } },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'MongoServerError' && 'code' in error && (error as { code: number }).code === 11000) {
      return NextResponse.json({ success: false, error: 'That plan slug already exists.' }, { status: 409 });
    }
    return authorizationErrorResponse(error);
  }
}