import { NextResponse } from 'next/server';
import { requireAdmin, authorizationErrorResponse } from '@/server/auth/authorization';
import { connectToDatabase } from '@/server/db/mongodb';
import { SystemSetting } from '@/server/models/SystemSetting';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    await connectToDatabase();
    const settings = await SystemSetting.find().sort({ key: 1 }).lean();
    return NextResponse.json({ success: true, settings: settings.map((setting) => ({ ...setting, _id: String(setting._id) })) });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const key = typeof body.key === 'string' ? body.key.trim() : '';
    if (!key) return NextResponse.json({ success: false, error: 'A setting key is required.' }, { status: 400 });

    await connectToDatabase();
    const updated = await SystemSetting.findOneAndUpdate(
      { key },
      { $set: { key, value: body.value ?? '', updatedBy: actor._id } },
      { upsert: true, new: true },
    ).lean();

    return NextResponse.json({ success: true, setting: updated ? { ...updated, _id: String(updated._id) } : null });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
