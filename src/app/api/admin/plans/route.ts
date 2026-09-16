import { NextResponse } from 'next/server';
import { requireAdmin, requireRole, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { AuditLog } from '@/server/models/AuditLog';
import { Plan } from '@/server/models/Plan';

function normalizePlan(input: Record<string, unknown>) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const slug = typeof input.slug === 'string' ? input.slug.trim().toLowerCase() : '';
  const price = Number(input.price);
  if (!name || !/^[a-z0-9-]+$/.test(slug) || !Number.isFinite(price) || price < 0) return null;

  return {
    name,
    slug,
    price,
    billingInterval: input.billingInterval === 'year' ? 'year' : 'month',
    monthlyCredits: Math.max(0, Number(input.monthlyCredits) || 0),
    limits: typeof input.limits === 'object' && input.limits ? input.limits : {},
    features: Array.isArray(input.features) ? input.features.filter((feature): feature is string => typeof feature === 'string').slice(0, 100) : [],
    active: input.active !== false,
  };
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    await connectToDatabase();
    const plans = await Plan.find().sort({ price: 1, createdAt: 1 }).lean();
    return NextResponse.json({ success: true, plans: plans.map((plan) => ({ ...plan, _id: String(plan._id) })) });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireRole(req, ['super_admin', 'admin']);
    const plan = normalizePlan(await req.json().catch(() => ({})));
    if (!plan) return NextResponse.json({ success: false, error: 'Name, slug and a valid non-negative price are required.' }, { status: 400 });

    await connectToDatabase();
    const created = await Plan.create(plan);
    await AuditLog.create({ actorId: actor._id, actorRole: actor.role, action: 'CREATE_PLAN', metadata: { planId: String(created._id), slug: created.slug }, ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '', userAgent: req.headers.get('user-agent') || '' });
    return NextResponse.json({ success: true, plan: { ...created.toObject(), _id: String(created._id) } }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'MongoServerError' && 'code' in error && error.code === 11000) return NextResponse.json({ success: false, error: 'That plan slug already exists.' }, { status: 409 });
    return authorizationErrorResponse(error);
  }
}