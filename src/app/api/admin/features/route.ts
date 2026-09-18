import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { FeatureFlag } from '@/server/models/FeatureFlag';

function normalizeFlag(input: Record<string, unknown>) {
  const key = typeof input.key === 'string' ? input.key.trim().toLowerCase() : '';
  if (!key) return null;

  const plans = Array.isArray(input.plans)
    ? input.plans.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : [];

  return {
    key,
    enabled: input.enabled === true,
    plans,
  };
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    await connectToDatabase();
    const flags = await FeatureFlag.find().sort({ key: 1 }).lean();
    return NextResponse.json({ success: true, flags: flags.map((flag) => ({ ...flag, _id: String(flag._id) })) });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const flag = normalizeFlag(body);
    if (!flag) return NextResponse.json({ success: false, error: 'Feature key is required.' }, { status: 400 });

    await connectToDatabase();
    const updated = await FeatureFlag.findOneAndUpdate(
      { key: flag.key },
      { $set: { ...flag } },
      { upsert: true, new: true },
    ).lean();

    return NextResponse.json({ success: true, flag: updated ? { ...updated, _id: String(updated._id) } : null });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
